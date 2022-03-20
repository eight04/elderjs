/* eslint-disable global-require */
/* eslint-disable no-param-reassign */
import path, { sep } from 'path';
// import CleanCSS from 'clean-css';
import { Plugin } from 'rollup';

// import { compile, preprocess } from 'svelte/compiler';
// import sparkMd5 from 'spark-md5';
import fs from 'fs-extra';
// import devalue from 'devalue';
import btoa from 'btoa';
// eslint-disable-next-line import/no-unresolved
import { CompileOptions } from 'svelte/types/compiler/interfaces';
import del from 'del';
import { fork, ChildProcess } from 'child_process';
import chokidar from 'chokidar';
import MagicString from 'magic-string';

// import partialHydration from '../partialHydration/partialHydration';
import windowsPathFix from '../utils/windowsPathFix';
import { SettingsOptions, Framework } from '../utils/types';
import collectComponentCss from '../utils/collectComponentCss';

export function silentDelete(file) {
  try {
    del.sync(file);
  } catch (err) {
    // pass
  }
}

export type RollupCacheElder = {
  [name: string]: Set<string>;
};

let dependencyCache: RollupCacheElder = {};

const cache = new Map();

const isDev =
  process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'PRODUCTION' && !!process.env.ROLLUP_WATCH;

let srcWatcher;

const mapIntro = `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,`;
export const encodeSourceMap = (map) => {
  if (!map || !map.toString) return '';
  return `${mapIntro}${btoa(map.toString())} */`;
};

export const cssFilePriority = (pathStr) => {
  const normalizedPath = windowsPathFix(pathStr);
  if (normalizedPath.includes('node_modules')) return 6;
  if (normalizedPath.includes('src/layouts')) return 3;
  if (normalizedPath.includes('src/routes')) return 2;
  if (normalizedPath.includes('src/components')) return 1;

  return 0;
};

export const getDependencies = (file) => {
  let dependencies = new Set([file]);
  if (dependencyCache[file]) {
    [...dependencyCache[file].values()]
      .filter((d) => d !== file)
      .forEach((dependency) => {
        dependencies = new Set([...dependencies, ...getDependencies(dependency)]);
      });
  }
  return [...dependencies.values()];
};

export const getCompilerOptions = ({ type }) => {
  const compilerOptions: CompileOptions = {
    hydratable: true,
    generate: 'ssr',
    css: false,
    dev: isDev,
    format: 'esm',
  };

  if (type === 'client') {
    compilerOptions.generate = 'dom';
    compilerOptions.format = 'esm';
  }

  return compilerOptions;
};

export function logDependency(importee, importer) {
  if (importee === 'svelte/internal' || importee === 'svelte') return;
  if (importer) {
    const parsedImporter = path.parse(importer);

    // The following two expressions are used to determine if we are trying to import
    // a svelte file from an external dependency and ensure that we add the correct path to that dependency
    const externalDependencyImport = path.resolve(
      parsedImporter.dir.substr(0, parsedImporter.dir.lastIndexOf('src')),
      'node_modules',
      importee,
    );
    const isExternalDependency = fs.pathExistsSync(externalDependencyImport);
    if (!dependencyCache[importer]) dependencyCache[importer] = new Set();
    if (importee.includes('node_modules')) {
      dependencyCache[importer].add(importee);
    } else if (importer.includes('node_modules')) {
      const fullImportee = path.resolve(parsedImporter.dir, importee);
      dependencyCache[importer].add(fullImportee);
    } else if (importee.includes('.svelte') && isExternalDependency) {
      dependencyCache[importer].add(externalDependencyImport);
    } else if ((parsedImporter.ext === '.svelte' && importee.includes('.svelte')) || importee.includes('.css')) {
      const fullImportee = path.resolve(parsedImporter.dir, importee);
      dependencyCache[importer].add(fullImportee);
    } else {
      dependencyCache[importer].add(importee);
    }
  }
  // eslint-disable-next-line consistent-return
  return dependencyCache;
}

export function getDependencyCache() {
  return dependencyCache;
}

export function resetDependencyCache() {
  dependencyCache = {};
}

// allows for injection of the cache and future sharing with esbuild
export function resolveFn(importee, importer) {
  // build list of dependencies so we know what CSS to inject into the export.

  logDependency(importee, importer);
  // below largely adapted from the rollup svelte plugin
  // ----------------------------------------------

  if (!importer || importee[0] === '.' || importee[0] === '\0' || path.isAbsolute(importee)) return null;
  // if this is a bare import, see if there's a valid pkg.svelte
  const parts = importee.split('/');

  let dir;
  let pkg;
  let name = parts.shift();
  if (name[0] === '@') {
    name += `/${parts.shift()}`;
  }

  try {
    const file = `.${path.sep}${['node_modules', name, 'package.json'].join(path.sep)}`;
    const resolved = path.resolve(process.cwd(), file);
    dir = path.dirname(resolved);
    // eslint-disable-next-line import/no-dynamic-require
    pkg = require(resolved);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      if (err.message && name !== 'svelte') console.log(err);
      return null;
    }
    throw err;
  }

  // use pkg.svelte
  if (parts.length === 0 && pkg.svelte) {
    const svelteResolve = path.resolve(dir, pkg.svelte);
    // console.log('-----------------', svelteResolve, name);
    logDependency(svelteResolve, name);
    return svelteResolve;
  }
  return null;
}

export const devServer = ({
  elderConfig,
  forceStart = false,
}: {
  elderConfig: SettingsOptions;
  forceStart: boolean;
}) => {
  /**
   * Dev server bootstrapping and restarting.
   */
  let childProcess: ChildProcess;
  let bootingServer = false;

  function startOrRestartServer(count = 0) {
    if (!isDev && !forceStart) return;
    if (!bootingServer) {
      bootingServer = true;

      const serverJs = path.resolve(process.cwd(), elderConfig.srcDir, './server.js');

      if (!fs.existsSync(serverJs)) {
        console.error(`No server file found at ${serverJs}, unable to start dev server.`);
        return;
      }

      setTimeout(() => {
        // prevent multiple calls
        if (childProcess) childProcess.kill('SIGINT');
        bootingServer = false;
        childProcess = fork(serverJs);
        childProcess.on('exit', (code) => {
          if (code !== null) {
            console.log(`> Elder.js process exited with code ${code}`);
          }
        });
        childProcess.on('error', (err) => {
          console.error(err);
          if (count < 1) {
            startOrRestartServer(count + 1);
          }
        });
      }, 10);
    }
  }

  function handleChange(watchedPath) {
    const parsed = path.parse(watchedPath);
    if (parsed.ext !== '.svelte') {
      // prevents double reload as the compiled svelte templates are output
      startOrRestartServer();
    }
  }

  function startWatcher() {
    // notes: This is hard to reason about.
    // This should only after the initial client rollup as finished as it runs last. The srcWatcher should then live between reloads
    // until the watch process is killed.
    //
    // this should watch the ./src, elder.config.js, and the client side folders... trigging a restart of the server when something changes
    // We don't want to change when a svelte file changes because it will cause a double reload when rollup outputs the rebundled file.

    if ((isDev || forceStart) && !srcWatcher) {
      srcWatcher = chokidar.watch(
        [
          path.resolve(process.cwd(), './src'),
          path.resolve(process.cwd(), './elder.config.js'),
          path.join(elderConfig.$$internal.distElder, 'assets', sep),
          path.join(elderConfig.$$internal.distElder, 'svelte', sep),
          path.join(elderConfig.$$internal.ssrComponents, 'components', sep),
          path.join(elderConfig.$$internal.ssrComponents, 'layouts', sep),
          path.join(elderConfig.$$internal.ssrComponents, 'routes', sep),
        ],
        {
          ignored: '*.svelte',
          usePolling: !/^(win32|darwin)$/.test(process.platform),
        },
      );

      srcWatcher.on('change', (watchedPath) => handleChange(watchedPath));
      srcWatcher.on('add', (watchedPath) => handleChange(watchedPath));
    }
  }
  return {
    startWatcher,
    childProcess,
    startOrRestartServer,
  };
};

export interface IElderjsRollupConfig {
  type: 'ssr' | 'client';
  elderConfig: SettingsOptions;
  startDevServer?: boolean;
  frameworks: Array<Framework>;
}

export default function elderjsRollup({
  elderConfig,
  frameworks,
  type = 'ssr',
  startDevServer = false,
}: IElderjsRollupConfig): Partial<Plugin> {
  const { childProcess, startWatcher, startOrRestartServer } = devServer({ elderConfig, forceStart: false });

  function getFramework(id) {
    return frameworks.find((f) => f.extensions.some((e) => id.endsWith(e)));
  }

  return {
    name: 'rollup-plugin-elder',

    watchChange(id) {
      // clean out dependency relationships on a file change.
      const prior = cache.get('dependencies');
      prior[id] = new Set();

      if (!dependencyCache) dependencyCache = {};
      dependencyCache = prior;
    },

    /**
     * Essentially what is happening here is that we need to say we're going to
     * emit these files before we know the content.
     * We are given a hash that we later use to populate them with data.
     */
    buildStart() {
      // kill server to prevent failures.
      if (childProcess) childProcess.kill('SIGINT');

      // cleaning up folders that need to be deleted.
      if (type === 'ssr') {
        silentDelete(elderConfig.$$internal.ssrComponents);
        silentDelete(path.resolve(elderConfig.$$internal.distElder, `.${sep}assets${sep}`));
        silentDelete(path.resolve(elderConfig.$$internal.distElder, `.${sep}props${sep}`));
      } else if (type === 'client') {
        silentDelete(path.resolve(elderConfig.$$internal.distElder, `.${sep}svelte${sep}`));
      }
    },

    resolveId: resolveFn,
    // load: loadCss,
    async transform(code, id) {
      if (id.endsWith('.css')) {
        // FIXME: we should only transform CSS imported by components
        return {
          code: `export default ${JSON.stringify(code)}`,
        };
      }

      const framework = getFramework(id);
      if (!framework) return null;

      const s = new MagicString(code);

      let i = 0;
      const imported = new Set();
      // FIXME: this naive approach will extract imports from source map
      for (const match of code.matchAll(/import\s+[^;\n]*(['"]([^\n;'"]+)['"])/g)) {
        const [, source, importee] = match;
        if (!imported.has(importee)) {
          if (importee.endsWith('.css')) {
            const repl = type === 'ssr' ? `import __css${i} from ${source}` : '';
            s.overwrite(match.index, match.index + match[0].length, repl);
            i += 1;
          } else if (getFramework(importee) && type === 'ssr') {
            s.append(`\nimport {_css as __css${i}} from ${source};`);
            i += 1;
          }
        }
        imported.add(importee);
      }

      if (type === 'ssr') {
        s.append(
          `\nexport const _css = () => [${Array.from({ length: i })
            .map((v, j) => `__css${j}`)
            .join(', ')}];`,
        );
      }

      s.append(`\nexport * from ${JSON.stringify(framework.adapterPath)};`);

      return {
        code: s.toString(),
        map: s.generateMap(),
      };
    },

    /**
     * generateBundle is used to write all of the CSS to the file system
     * @param options
     * @param bundle
     * @param isWrite
     */

    writeBundle(outputOptions, bundle) {
      if (startDevServer && type === 'client') {
        startWatcher();
        startOrRestartServer();
      }
      // output css
      if (type === 'ssr') {
        const css = [];
        for (const chunk of Object.values(bundle)) {
          if (chunk.type === 'chunk' && chunk.isEntry) {
            const url = path.join(outputOptions.dir, chunk.fileName);
            /* eslint-disable import/no-dynamic-require, no-underscore-dangle */
            const mod = require(url);
            if (mod._css) {
              css.push(mod._css);
            }
            /* eslint-enable import/no-dynamic-require, no-underscore-dangle */
          }
        }
        const code = collectComponentCss(css);
        if (code) {
          const ssrOutput = path.join(elderConfig.$$internal.ssrComponents, 'assets/style.css');
          const clientOutput = path.join(elderConfig.$$internal.distElder, 'assets/style.css');
          for (const filename of [ssrOutput, clientOutput]) {
            fs.ensureDirSync(path.dirname(filename));
            fs.writeFile(filename, code);
          }
        }
      }
    },
  };
}
