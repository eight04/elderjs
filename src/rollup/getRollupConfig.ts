import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import babel from 'rollup-plugin-babel';
import multiInput from 'rollup-plugin-multi-input';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';
import glob from 'glob';
import defaultsDeep from 'lodash.defaultsdeep';
import { getElderConfig } from '../index';
import { getDefaultRollup } from '../utils/validations';
import getPluginLocations from '../utils/getPluginLocations';
import { Framework } from '../utils/types';
import elder from './rollupPlugin';

const production = process.env.NODE_ENV === 'production' || !process.env.ROLLUP_WATCH;

export function createBrowserConfig({
  input,
  output,
  multiInputConfig,
  frameworks,
  replacements = {},
  elderConfig,
  startDevServer = false,
}) {
  const toReplace = {
    'process.env.componentType': "'browser'",
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    preventAssignment: true,
    ...replacements,
  };

  const config = {
    cache: true,
    treeshake: production,
    input,
    output,
    plugins: [
      replace(toReplace),
      json(),
      ...frameworks.map((f) => f.getPlugins({ system: 'rollup', type: 'client' })).flat(),
      elder({ type: 'client', elderConfig, startDevServer, frameworks }),
      nodeResolve({
        browser: true,
        dedupe: [...frameworks.map((f) => f.dedupe).flat()],
        preferBuiltins: true,
        rootDir: process.cwd(),
      }),
      commonjs({ sourceMap: !production }),
    ],
    watch: {
      chokidar: {
        usePolling: process.platform !== 'darwin',
      },
    },
  };

  // bundle splitting.
  if (multiInputConfig) {
    config.plugins.unshift(multiInputConfig);
  }

  // ie11 babel

  // if is production let's babelify everything and minify it.
  if (production) {
    config.plugins.push(
      babel({
        extensions: ['.js', '.mjs', '.cjs', '.html', ...frameworks.map((f) => f.extensions).flat()],
        include: ['node_modules/**', 'src/**'],
        exclude: ['node_modules/@babel/**'],
        runtimeHelpers: true,
      }),
    );

    // terser on prod
    config.plugins.push(terser());
  }

  return config;
}

export function createSSRConfig({
  input,
  output,
  frameworks,
  replacements = {},
  multiInputConfig,
  elderConfig,
  startDevServer = false,
}) {
  const toReplace = {
    'process.env.componentType': "'server'",
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    ...replacements,
  };

  const config = {
    cache: true,
    treeshake: production,
    input,
    output,
    plugins: [
      replace(toReplace),
      json(),
      ...frameworks.map((f) => f.getPlugins({ system: 'rollup', type: 'ssr' })).flat(),
      elder({ type: 'ssr', elderConfig, startDevServer, frameworks }),
      nodeResolve({
        browser: false,
        dedupe: [...frameworks.map((f) => f.dedupe).flat()],
      }),
      commonjs({ sourceMap: true }),
      production && terser(),
    ],
    watch: {
      chokidar: {
        usePolling: !/^(win32|darwin)$/.test(process.platform),
      },
    },
  };
  // if we are bundle splitting include them.
  if (multiInputConfig) {
    config.plugins.unshift(multiInputConfig);
  }

  return config;
}

type getRollupConfigOptions = {
  replacements?: object;
  startDevServer?: boolean;
  frameworks: Array<Framework>;
};

export default function getRollupConfig(options: getRollupConfigOptions) {
  const defaultOptions = getDefaultRollup();
  const { frameworks, replacements, startDevServer } = defaultsDeep(options, defaultOptions);
  const elderConfig = getElderConfig();
  const relSrcDir = elderConfig.srcDir.replace(elderConfig.rootDir, '').substr(1);

  console.log(`Elder.js using rollup in ${production ? 'production' : 'development'} mode.`);

  const configs = [];

  const { paths: pluginPaths } = getPluginLocations(elderConfig);
  const pluginGlobs = pluginPaths.map((plugin) => `${plugin}*.svelte`);

  function* serverEntries() {
    for (const framework of frameworks) {
      for (const ext of framework.extensions) {
        yield `${relSrcDir}/layouts/*${ext}`;
        yield `${relSrcDir}/routes/**/*${ext}`;
      }
    }
  }

  function* clientEntries() {
    for (const framework of frameworks) {
      for (const ext of framework.extensions) {
        yield `${relSrcDir}/components/**/*${ext}`;
      }
    }
  }

  configs.push(
    createSSRConfig({
      input: [...serverEntries(), ...clientEntries(), ...pluginGlobs],
      output: {
        dir: elderConfig.$$internal.ssrComponents,
        format: 'cjs',
        exports: 'auto',
        sourcemap: !production ? 'inline' : false,
      },
      multiInputConfig: multiInput({
        relative: 'src/',
      }),
      frameworks,
      replacements,
      elderConfig,
      startDevServer,
    }),
  );

  const clientComponents = [...glob.sync(`${relSrcDir}/components/**/*.svelte`), ...pluginGlobs];

  if (clientComponents.length > 0) {
    // keep things from crashing of there are no components
    configs.push(
      createBrowserConfig({
        input: [...clientEntries(), ...pluginGlobs],
        output: [
          {
            dir: elderConfig.$$internal.clientComponents,
            sourcemap: !production ? 'inline' : false,
            format: 'esm',
            entryFileNames: '[name].[hash].js',
          },
        ],
        multiInputConfig: multiInput({
          relative: 'src/',
        }),
        frameworks,
        replacements,
        elderConfig,
        startDevServer,
      }),
    );
  }

  return configs;
}
