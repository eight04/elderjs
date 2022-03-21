import { resolve, sep } from 'path';
import * as path from 'path';
import fs from 'fs-extra';
// eslint-disable-next-line import/no-unresolved
import { Plugin, PartialMessage } from 'esbuild';

import type { PreprocessorGroup } from 'svelte/types/compiler/preprocess/types';
import { silentDelete } from '../rollup/rollupPlugin';

// eslint-disable-next-line import/no-unresolved
import { SettingsOptions } from '..';

export type cssCacheObj = {
  code: string;
  map: string;
  time: number;
  priority: number;
};
export type TCache = Map<
  string,
  {
    contents: string;
    css?: cssCacheObj;
    warnings: PartialMessage[];
    time: number;
    priority?: number;
    map?: string;
  }
>;

export type TPreprocess = PreprocessorGroup | PreprocessorGroup[] | false;

export interface IEsBuildPluginSvelte {
  type: 'ssr' | 'client';
  elderConfig: SettingsOptions;
  startDevServer?: boolean;
}

function createEntryLoader(entries: Array<string>): string {
  return entries
    .map((p) => (path.isAbsolute(p) ? p : `./${p}`))
    .map((p) => `import ${JSON.stringify(p)};`)
    .join('\n');
}

function getAllEntries(entries) {
  if (!entries) return [];
  if (Array.isArray(entries)) return entries;
  return Object.values(entries);
}

function modifyEntries(entries, fn) {
  if (!entries) return;
  if (Array.isArray(entries)) {
    for (let i = 0; i < entries.length; i += 1) {
      entries[i] = fn(entries[i]);
    }
    return;
  }
  // eslint-disable-next-line
  for (const key in entries) {
    entries[key] = fn(entries[key]);
  }
}

function addEntry(entries, newFile) {
  if (!entries) return;
  if (Array.isArray(entries)) {
    entries.push(newFile);
  } else {
    // FIXME: strip extension
    entries[newFile] = newFile;
  }
}

// FIXME: move to utils
function getFramework(id, frameworks) {
  return frameworks.find((f) => f.extensions.some((e) => id.endsWith(e)));
}

function esbuildPlugin({ type, elderConfig }: IEsBuildPluginSvelte): Plugin {
  return {
    name: 'esbuild-plugin-elderjs',

    setup(build) {
      const dedupes = elderConfig.frameworks.map((f) => f.dedupe || []).flat();
      if (dedupes.length) {
        const resolveCache = new Map();
        const resolveFromRoot = async (args) => {
          for (const dir of [elderConfig.rootDir, process.cwd()]) {
            try {
              // eslint-disable-next-line no-await-in-loop
              const result = await build.resolve(args.path, {
                resolveDir: dir,
                kind: args.kind,
                pluginData: { resolveFromRoot: true },
              });
              if (result.errors.length) {
                throw new Error(result.errors[0].text);
              }
              return result;
            } catch (err) {
              // pass
            }
          }
          return undefined;
        };
        build.onResolve({ filter: new RegExp(`^(${dedupes.join('|')})(/|\\|$)`) }, (args) => {
          if (args.pluginData && args.pluginData.resolveFromRoot) {
            return undefined;
          }
          if (!resolveCache.has(args.path)) {
            resolveCache.set(args.path, resolveFromRoot(args));
          }
          return resolveCache.get(args.path);
        });
      }

      build.onStart(() => {
        if (type === 'ssr') {
          silentDelete(elderConfig.$$internal.ssrComponents);
          silentDelete(resolve(elderConfig.$$internal.distElder, `.${sep}assets${sep}`));
          silentDelete(resolve(elderConfig.$$internal.distElder, `.${sep}props${sep}`));
        } else if (type === 'client') {
          silentDelete(resolve(elderConfig.$$internal.distElder, `.${sep}svelte${sep}`));
        }
      });

      const allEntries = getAllEntries(build.initialOptions.entryPoints);
      modifyEntries(build.initialOptions.entryPoints, (e) => `${e}?ejs_entry`);

      const cwd = build.initialOptions.absWorkingDir || process.cwd();

      if (type === 'ssr') {
        const src = path.relative(elderConfig.rootDir, elderConfig.srcDir);
        addEntry(build.initialOptions.entryPoints, `${src}/__ejs_css`);

        build.onResolve({ filter: /__ejs_css$/ }, ({ path: filePath }) => {
          return {
            path: filePath,
            namespace: 'ejs-css',
          };
        });

        build.onLoad({ filter: /.*/, namespace: 'ejs-css' }, () => {
          return {
            contents: createEntryLoader(allEntries),
            loader: 'js',
            resolveDir: cwd,
          };
        });
      }

      build.initialOptions.metafile = true; // eslint-disable-line no-param-reassign

      build.onResolve({ filter: /\?ejs_entry$/ }, (args) => {
        const newPath = path.resolve(cwd, args.path.slice(0, -10));
        return {
          path: newPath,
          namespace: 'ejs-entry',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'ejs-entry' }, (args) => {
        const framework = getFramework(args.path, elderConfig.frameworks);
        // FIXME: does it work if there is no default export?
        return {
          contents: `export * from ${JSON.stringify(args.path)}; export {default} from ${JSON.stringify(
            args.path,
          )}; export * from ${JSON.stringify(framework.adapterPath)}; export const _css = "__EJS_COMPONENT_CSS__";`,
          loader: 'js',
          resolveDir: path.dirname(args.path),
        };
      });

      build.onEnd((result) => {
        const emitBundledCss = (file: string) => {
          const code = fs.readFileSync(path.resolve(cwd, file), 'utf8');
          if (code) {
            // FIXME: move this into utils to share with rollup
            // FIXME: add hash, minify css?
            const ssrOutput = path.join(elderConfig.$$internal.ssrComponents, 'assets/style.css');
            const clientOutput = path.join(elderConfig.$$internal.distElder, 'assets/style.css');
            for (const filename of [ssrOutput, clientOutput]) {
              fs.ensureDirSync(path.dirname(filename));
              fs.writeFile(filename, code);
            }
          }
        };
        const injectComponentCss = (file: string) => {
          const jsFile = file.replace(/\.css/, '.js');
          const cssCode = fs.readFileSync(path.resolve(cwd, file), 'utf8');
          let jsCode = fs.readFileSync(path.resolve(cwd, jsFile), 'utf8');
          jsCode = jsCode.replace(/['"]__EJS_COMPONENT_CSS__['"]/, JSON.stringify(cssCode));
          fs.writeFileSync(path.resolve(cwd, jsFile), jsCode);
        };

        for (const key of Object.keys(result.metafile.outputs)) {
          try {
            if (/__ejs_css\.css$/.test(key) && type === 'ssr') {
              emitBundledCss(key);
            } else if (/\.css$/.test(key)) {
              if (type === 'ssr') {
                injectComponentCss(key);
              } else {
                fs.rmSync(path.resolve(cwd, key));
                // NOTE: this may throw
                fs.rmSync(path.resolve(cwd, `${key}.map`));
              }
            }
          } catch (err) {
            console.warn(err);
          }
        }
      });
    },
  };
}
export default esbuildPlugin;
