/* eslint-disable import/no-dynamic-require */
// reload the build process when svelte files are added clearing the cache.

// server that reloads the app which watches the file system for changes.
// reload can also be called after esbuild finishes the rebuild.
// the file watcher should restart the entire esbuild process when a new svelte file is seen. This includes clearing caches.

import { build, BuildResult } from 'esbuild';
import fg from 'fast-glob';
import path from 'path';
import EventEmitter from 'events';

// eslint-disable-next-line import/no-unresolved
import { PreprocessorGroup } from 'svelte/types/compiler/preprocess/types';
import esbuildPlugin from './esbuildPlugin';
import { InitializationOptions, SettingsOptions } from '../utils/types';
import { getElderConfig } from '..';
import { devServer } from '../rollup/rollupPlugin';
import getPluginLocations from '../utils/getPluginLocations';

const production = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'PRODUCTION';
export type TPreprocess = PreprocessorGroup | PreprocessorGroup[] | false;
export type TSvelteHandler = {
  config: SettingsOptions;
  preprocess: TPreprocess;
};

const getRestartHelper = (startOrRestartServer) => {
  let state;
  const defaultState = { ssr: false, client: false };
  const resetState = () => {
    state = JSON.parse(JSON.stringify(defaultState));
  };

  resetState();

  // eslint-disable-next-line consistent-return
  return (type: 'start' | 'reset' | 'client' | 'ssr') => {
    if (type === 'start') {
      return startOrRestartServer();
    }
    if (type === 'reset') {
      return resetState();
    }

    state[type] = true;
    if (state.ssr && state.client) {
      startOrRestartServer();
      resetState();
    }
  };
};

// FIXME: move this to utils to share it with rollup
function getEntries(elderConfig: SettingsOptions) {
  const patterns = [];
  const src = path.relative(elderConfig.rootDir, elderConfig.srcDir);
  for (const framework of elderConfig.frameworks) {
    for (const ext of framework.extensions) {
      patterns.push(`${src}/**/*${ext}`);
    }
  }
  return fg.sync(patterns, { cwd: elderConfig.rootDir });
}

const BUILD_TYPES = ['ssr', 'client'] as const;
type BUILD_TYPE = typeof BUILD_TYPES[number];

type PrepareBuilderOptions = {
  elderConfig: SettingsOptions;
  replacements?: { [pattern: string]: string | boolean };
};
const prepareBuilder = ({ elderConfig, replacements }: PrepareBuilderOptions) => {
  const ee = new EventEmitter();
  const builders: { ssr?: BuildResult; client?: BuildResult } = {};

  // eslint-disable-next-line global-require
  const pkg = require(path.resolve(elderConfig.rootDir, './package.json'));
  const initialEntryPoints = getEntries(elderConfig);
  const elderPlugins = getPluginLocations(elderConfig);

  async function start(type: BUILD_TYPE, force = false, watch = false): Promise<boolean> {
    if (builders[type] && !force) {
      return false;
    }

    if (builders[type]) {
      builders[type].stop();
      ee.emit('reset', type);
    }

    builders[type] = await build({
      absWorkingDir: elderConfig.rootDir,
      entryPoints: [
        ...initialEntryPoints.filter((e) => (type === 'ssr' ? true : e.includes('src/components'))),
        ...elderPlugins.files,
      ],
      entryNames: `[dir]/[name]${type === 'ssr' ? '' : '.[hash]'}`,
      splitting: type !== 'ssr',
      bundle: true,
      outdir: type === 'ssr' ? elderConfig.$$internal.ssrComponents : elderConfig.$$internal.clientComponents,
      plugins: [
        esbuildPlugin({
          type,
          elderConfig,
        }),
        ...elderConfig.frameworks.map((f) => f.getPlugins({ type, system: 'esbuild' })).flat(),
      ],
      watch: watch && {
        onRebuild(error) {
          ee.emit('finished', type, error);
        },
      },
      format: type === 'ssr' ? 'cjs' : 'esm',
      target: [type === 'ssr' ? 'node12' : 'es2020'],
      platform: type === 'ssr' ? 'node' : 'browser',
      sourcemap: !production,
      minify: true, // FIXME: obey production. note that we need minify: true in jest snapshot test to strip filenames in CSS
      outbase: elderConfig.srcDir,
      // FIXME: what is pkg.dependents?
      external: pkg.dependents ? [...Object.keys(pkg.dependents)] : [],
      chunkNames: 'chunks/[name].[hash]',
      logLevel: 'error',
      define: {
        'process.env.componentType': type === 'ssr' ? "'server'" : "'client'",
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        ...replacements,
      },
    });
    return true;
  }

  function startAll(watch: boolean) {
    return Promise.all(BUILD_TYPES.map((type) => start(type, false, watch)));
  }

  return Object.assign(ee, {
    start,
    startAll,
  });
};

type TEsbuildBundler = {
  initializationOptions?: InitializationOptions;
  replacements?: { [key: string]: string | boolean };
  watch?: boolean;
};

const esbuildBundler = async ({
  initializationOptions = {},
  replacements = {},
  watch = true,
}: TEsbuildBundler = {}) => {
  const elderConfig = getElderConfig(initializationOptions);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { startOrRestartServer, startWatcher, childProcess } = devServer({
    forceStart: true,
    elderConfig,
  });
  const restartHelper = getRestartHelper(startOrRestartServer);

  // a simpler strategy is to stop server when bundler starts / start the server when bundler stops
  const builder = prepareBuilder({ elderConfig, replacements });
  builder.on('finished', (type, err) => {
    console.warn('build error', err);
    restartHelper(type);
  });
  builder.on('reset', () => {
    // FIXME: not sure how this helper work
    restartHelper('reset');
  });
  if (watch) {
    restartHelper('start');
  }

  await builder.startAll(watch);

  if (watch) {
    startWatcher();
  }
};
export default esbuildBundler;
