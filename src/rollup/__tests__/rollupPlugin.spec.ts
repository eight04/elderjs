/* eslint-disable no-shadow */
/* eslint-disable no-param-reassign */
import path from 'path';

import fsExtra from 'fs-extra';
import del from 'del';

import windowsPathFix from '../../utils/windowsPathFix';
import normalizeSnapshot from '../../utils/normalizeSnapshot';
import getConfig from '../../utils/getConfig';
import svelte from '../../svelte';

import elderjsRollup, {
  encodeSourceMap,
  getDependencies,
  cssFilePriority,
  logDependency,
  resetDependencyCache,
  getDependencyCache,
} from '../rollupPlugin';

jest.mock('del');

describe('#rollupPlugin', () => {
  const cfs = fsExtra.copyFileSync;
  const rds = fsExtra.readdirSync;
  const eds = fsExtra.ensureDirSync;

  // @ts-ignore
  fsExtra.copyFileSync = jest.fn(cfs);
  // @ts-ignore
  fsExtra.copyFileSync.mockImplementation(() => 'copied');
  // @ts-ignore
  fsExtra.readdirSync = jest.fn(rds);
  // @ts-ignore
  fsExtra.readdirSync.mockImplementation(() => ['style.css', 'style.css.map']);
  // @ts-ignore
  fsExtra.ensureDirSync = jest.fn(eds);
  // @ts-ignore
  fsExtra.ensureDirSync.mockImplementation(console.log);
  // @ts-ignore

  const elderConfig = getConfig();

  fsExtra.copyFileSync = cfs;
  fsExtra.readdirSync = rds;
  fsExtra.ensureDirSync = eds;

  describe('#encodeSourceMap', () => {
    it('properly generates an encoded string', () => {
      const m = {
        toString: () => {
          return 'Im stringy';
        },
      };
      expect(encodeSourceMap(m)).toBe(
        '/*# sourceMappingURL=data:application/json;charset=utf-8;base64,SW0gc3RyaW5neQ== */',
      );
    });
    it('returns empty when undefined', () => {
      expect(encodeSourceMap(undefined)).toBe('');
    });
    it('returns empty when no toString', () => {
      expect(encodeSourceMap(NaN)).toBe('');
    });
  });

  describe('#cssFilePriority', () => {
    it('properly maps components', () => {
      expect(cssFilePriority('foo/bar/src/components')).toBe(1);
    });
    it('properly maps routes', () => {
      expect(cssFilePriority('foo/bar/src/routes')).toBe(2);
    });
    it('properly maps layouts', () => {
      expect(cssFilePriority('foo/bar/src/layouts')).toBe(3);
    });

    it('properly node_modules layouts', () => {
      expect(cssFilePriority('/blah/foo/node_modules/bloo/boo')).toBe(6);
    });
    it('properly maps something unknown', () => {
      expect(cssFilePriority('foo/barasdfasdfasdfasdfasda')).toBe(0);
    });
  });

  describe('#logDependency', () => {
    it('adds a css file as a dependency when it is imported.', () => {
      const importee = path.resolve('./test/src/style.css');
      const importer = path.resolve('./test/src/routes/home/home.svelte');
      const expected = {};
      expected[importer] = new Set([importee]);
      resetDependencyCache();
      expect(normalizeSnapshot(logDependency(importee, importer))).toEqual(normalizeSnapshot(expected));
    });
    it('adds the importee as the dependency of the importer', () => {
      const importee = path.resolve('./test/src/components/AutoComplete.svelte');
      const importer = path.resolve('./test/src/components/AutoCompleteHome.svelte');
      const expected = {};
      expected[importer] = new Set([importee]);

      resetDependencyCache();
      expect(normalizeSnapshot(logDependency(importee, importer))).toEqual(normalizeSnapshot(expected));
    });
    it('Properly attributes external npm packages', () => {
      resetDependencyCache();
      logDependency(
        path.resolve(`./src/rollup/__tests__/__fixtures__/external/src/layouts/External.svelte`),
        undefined,
      );

      logDependency(
        `svelte/internal`,
        path.resolve(`./src/rollup/__tests__/__fixtures__/external/src/layouts/External.svelte`),
      );

      logDependency(
        `test-external-svelte-library`,
        path.resolve(`./src/rollup/__tests__/__fixtures__/external/src/layouts/External.svelte`),
      );

      logDependency(
        path.resolve(
          `./src/rollup/__tests__/__fixtures__/external/node_modules/test-external-svelte-library/src/index.js`,
        ),
        `test-external-svelte-library`,
      );

      logDependency(
        `../components/Component.svelte`,
        path.resolve(`./src/rollup/__tests__/__fixtures__/external/src/layouts/External.svelte`),
      );

      logDependency(
        `test-external-svelte-library/src/components/Button.svelte`,
        path.resolve(
          `./src/rollup/__tests__/__fixtures__/external/node_modules/test-external-svelte-library/src/index.js`,
        ),
      );

      logDependency(
        `svelte/internal`,
        path.resolve(`./src/rollup/__tests__/__fixtures__/external/src/components/Component.svelte`),
      );

      logDependency(
        `svelte/internal`,
        path.resolve(
          `./src/rollup/__tests__/__fixtures__/external/node_modules/test-external-svelte-library/src/components/Button.svelte`,
        ),
      );

      logDependency(
        `../components/Icon.svelte`,
        path.resolve(
          `./src/rollup/__tests__/__fixtures__/external/node_modules/test-external-svelte-library/src/components/Button.svelte`,
        ),
      );

      logDependency(
        `svelte/internal`,
        path.resolve(
          `./src/rollup/__tests__/__fixtures__/external/node_modules/test-external-svelte-library/src/components/Icon.svelte`,
        ),
      );

      expect(
        getDependencies(path.resolve(`./src/rollup/__tests__/__fixtures__/external/src/layouts/External.svelte`)),
      ).toEqual([
        path.resolve(`./src/rollup/__tests__/__fixtures__/external/src/layouts/External.svelte`),
        'test-external-svelte-library',
        path.resolve(
          './src/rollup/__tests__/__fixtures__/external/node_modules/test-external-svelte-library/src/index.js',
        ),
        path.resolve(
          './src/rollup/__tests__/__fixtures__/external/node_modules/test-external-svelte-library/src/test-external-svelte-library/src/components/Button.svelte',
        ),
        path.resolve(`./src/rollup/__tests__/__fixtures__/external/src/components/Component.svelte`),
      ]);

      const abs = {
        './src/rollup/__tests__/__fixtures__/external/src/layouts/External.svelte': new Set([
          'test-external-svelte-library',
          './src/rollup/__tests__/__fixtures__/external/src/components/Component.svelte',
        ]),
        'test-external-svelte-library': new Set([
          './src/rollup/__tests__/__fixtures__/external/node_modules/test-external-svelte-library/src/index.js',
        ]),
        './src/rollup/__tests__/__fixtures__/external/node_modules/test-external-svelte-library/src/index.js': new Set([
          './src/rollup/__tests__/__fixtures__/external/node_modules/test-external-svelte-library/src/test-external-svelte-library/src/components/Button.svelte',
        ]),
        './src/rollup/__tests__/__fixtures__/external/node_modules/test-external-svelte-library/src/components/Button.svelte':
          new Set([
            './src/rollup/__tests__/__fixtures__/external/node_modules/test-external-svelte-library/src/components/Icon.svelte',
          ]),
      };

      const cleanPath = (str) => (str[0] === '.' ? path.resolve(str) : str);
      const rel = Object.entries(abs).reduce((out, cv) => {
        out[cleanPath(cv[0])] = new Set([...cv[1].values()].map(cleanPath));
        return out;
      }, {});

      expect(getDependencyCache()).toEqual(rel);
    });
  });

  describe('#getDependencies', () => {
    it('finds deep dependencies', () => {
      logDependency(
        path.resolve(`./test/src/components/AutoComplete.svelte`),
        path.resolve(`./test/src/components/AutoCompleteHome.svelte`),
      );
      logDependency(
        path.resolve(`./test/src/components/AutoCompleteHome.svelte`),
        path.resolve(`./test/src/components/Deeper.svelte`),
      );
      logDependency(
        path.resolve(`./test/src/components/Deeper.svelte`),
        path.resolve(`./test/src/components/Deepest.svelte`),
      );
      const deps = getDependencies(path.resolve(`./test/src/components/Deepest.svelte`));
      expect(normalizeSnapshot(deps)).toEqual(
        normalizeSnapshot([
          path.resolve(`./test/src/components/Deepest.svelte`),
          path.resolve(`./test/src/components/Deeper.svelte`),
          path.resolve(`./test/src/components/AutoCompleteHome.svelte`),
          path.resolve(`./test/src/components/AutoComplete.svelte`),
        ]),
      );
    });
    it("doesn't crash on circular deps", () => {
      resetDependencyCache();
      logDependency(
        path.resolve(`./test/src/components/Deeper.svelte`),
        path.resolve(`./test/src/components/Circular.svelte`),
      );
      logDependency(
        path.resolve(`./test/src/components/Circular.svelte`),
        path.resolve(`./test/src/components/Circular.svelte`),
      );
      const deps = getDependencies(path.resolve(`./test/src/components/Circular.svelte`));
      expect(normalizeSnapshot(deps)).toEqual(
        normalizeSnapshot([
          path.resolve(`./test/src/components/Circular.svelte`),
          path.resolve(`./test/src/components/Deeper.svelte`),
        ]),
      );
    });

    it(`Finds proper deps and not additional ones`, () => {
      resetDependencyCache();
      logDependency(
        path.resolve(`./test/src/components/AutoComplete.svelte`),
        path.resolve(`./test/src/components/AutoCompleteHome.svelte`),
      );
      logDependency(
        path.resolve(`./test/src/components/AutoCompleteHome.svelte`),
        path.resolve(`./test/src/components/Deeper.svelte`),
      );
      logDependency(
        path.resolve(`./test/src/components/Deeper.svelte`),
        path.resolve(`./test/src/components/Circular.svelte`),
      );
      logDependency(
        path.resolve(`./test/src/components/Dep.svelte`),
        path.resolve(`./test/src/components/Single.svelte`),
      );
      const deps = getDependencies(path.resolve(`./test/src/components/Single.svelte`));
      expect(normalizeSnapshot(deps)).toEqual(
        normalizeSnapshot([
          path.resolve(`./test/src/components/Single.svelte`),
          path.resolve(`./test/src/components/Dep.svelte`),
        ]),
      );
    });

    it(`Finds no deps when there are none`, () => {
      resetDependencyCache();
      logDependency(
        path.resolve(`./test/src/components/AutoComplete.svelte`),
        path.resolve(`./test/src/components/AutoCompleteHome.svelte`),
      );
      logDependency(
        path.resolve(`./test/src/components/AutoCompleteHome.svelte`),
        path.resolve(`./test/src/components/Deeper.svelte`),
      );
      const deps = getDependencies(path.resolve(`./test/src/components/wtf.svelte`));
      expect(normalizeSnapshot(deps)).toEqual(normalizeSnapshot([path.resolve(`./test/src/components/wtf.svelte`)]));
    });
  });

  describe('shared', () => {
    resetDependencyCache();
    const files = normalizeSnapshot([
      path.resolve(`./test/src/components/AutoComplete.svelte`),
      path.resolve(`./test/src/components/AutoCompleteHome.svelte`),
      path.resolve(`./test/src/components/Deeper.svelte`),
      path.resolve(`./test/src/components/Circular.svelte`),
      path.resolve(`./test/src/routes/Dep.svelte`),
      path.resolve(`./test/src/layouts/Single.svelte`),
    ]);

    const cssCache = new Map();
    function createCss(str) {
      const normalized = windowsPathFix(str);
      cssCache.set(`css${normalized}`, {
        code: `.content{content:"${normalized}"}`,
        map: undefined,
        priority: cssFilePriority(normalized),
      });
    }

    files.forEach((file, i, arr) => {
      createCss(file);
      if (i < arr.length - 2) {
        logDependency(file, arr[i + 1]);
      }
    });
    it('validates the testing env is correct', () => {
      expect([...cssCache.entries()]).toStrictEqual(
        normalizeSnapshot([
          [
            `css${path.resolve('./test/src/components/AutoComplete.svelte')}`,
            {
              code: `.content{content:"${path.resolve('./test/src/components/AutoComplete.svelte')}"}`,
              map: undefined,
              priority: 1,
            },
          ],
          [
            `css${path.resolve('./test/src/components/AutoCompleteHome.svelte')}`,
            {
              code: `.content{content:"${path.resolve('./test/src/components/AutoCompleteHome.svelte')}"}`,
              map: undefined,
              priority: 1,
            },
          ],
          [
            `css${path.resolve('./test/src/components/Deeper.svelte')}`,
            {
              code: `.content{content:"${path.resolve('./test/src/components/Deeper.svelte')}"}`,
              map: undefined,
              priority: 1,
            },
          ],
          [
            `css${path.resolve('./test/src/components/Circular.svelte')}`,
            {
              code: `.content{content:"${path.resolve('./test/src/components/Circular.svelte')}"}`,
              map: undefined,
              priority: 1,
            },
          ],
          [
            `css${path.resolve('./test/src/routes/Dep.svelte')}`,
            {
              code: `.content{content:"${path.resolve('./test/src/routes/Dep.svelte')}"}`,
              map: undefined,
              priority: 2,
            },
          ],
          [
            `css${path.resolve('./test/src/layouts/Single.svelte')}`,
            {
              code: `.content{content:"${path.resolve('./test/src/layouts/Single.svelte')}"}`,
              map: undefined,
              priority: 3,
            },
          ],
        ]),
      );
    });

    describe('#elderjsRollup', () => {
      const shared = {
        elderConfig,
        frameworks: [svelte()],
      };

      const ssrPlugin = elderjsRollup({
        ...shared,
        type: 'ssr',
      });

      const clientPlugin = elderjsRollup({
        ...shared,
        type: 'client',
      });

      // non crappy mocks: https://gist.githubusercontent.com/rickhanlonii/c695cbc51ae6ffd81c46f46509171650/raw/a0b7f851be704b739be76b2543deff577b449fee/mock_jest_spyOn_sugar.js

      describe('#watchChange', () => {
        describe('#buildStart', () => {
          const delsync = del.sync;
          // @ts-ignore
          del.sync = jest.fn(delsync).mockImplementation((pay) => pay);
          del.sync = delsync;
          it('tests ssr functionality', () => {
            const t = {
              values: [],
              emitFile: jest.fn((pay) => {
                t.values.push(pay);
                return pay.name;
              }),
            };

            const buildStartBound = ssrPlugin.buildStart.bind(t);

            buildStartBound();

            // expect(t.values).toEqual([{ name: 'svelte.css', type: 'asset' }]);
            expect(del.sync).toHaveBeenCalledTimes(3);
            expect(del.sync).toHaveBeenCalledWith(elderConfig.$$internal.ssrComponents);
            expect(del.sync).toHaveBeenCalledWith(path.join(elderConfig.$$internal.distElder, 'assets'));
          });
          it('tests client functionality', () => {
            const t = {
              values: [],
              emitFile: jest.fn((pay) => {
                t.values.push(pay);
              }),
            };
            const buildStartBound = clientPlugin.buildStart.bind(t);
            buildStartBound();
            expect(t.values).toEqual([]);
            expect(del.sync).toHaveBeenCalledTimes(4);
            expect(del.sync).toHaveBeenCalledWith(elderConfig.$$internal.clientComponents);
            expect(del.sync).toHaveBeenCalledWith(elderConfig.$$internal.ssrComponents);
            expect(del.sync).toHaveBeenCalledWith(path.join(elderConfig.$$internal.distElder, 'assets'));
          });
        });

        describe('#resolveId', () => {
          it(`doesn't resolve anything not in node_modules`, async () => {
            expect(
              // @ts-ignore
              ssrPlugin.resolveId('../components/Header/Header.svelte', '/test/src/layouts/Layout.svelte'),
            ).toBeNull();
          });

          it(`Resolves a node_module that uses svelte in their package.json`, async () => {
            jest.mock(
              path.resolve('./node_modules/uses-export/package.json'),
              () => ({
                svelte: windowsPathFix('src/Component.svelte'),
              }),
              { virtual: true },
            );
            // @ts-ignore
            expect(ssrPlugin.resolveId('uses-export', path.resolve('./test/src/layouts/Layout.svelte'))).toEqual(
              path.resolve('./node_modules/uses-export/src/Component.svelte'),
            );
          });

          it(`Resolves a node_module that uses svelte and exports their package.json`, async () => {
            jest.mock(
              path.resolve('./node_modules/package-exports/package.json'),
              () => ({
                main: './main.js',
                svelte: windowsPathFix('src/Exported.svelte'),
                exports: {
                  '.': './main.js',
                  './package.json': './package.json',
                },
              }),
              { virtual: true },
            );
            // @ts-ignore
            expect(ssrPlugin.resolveId('package-exports', path.resolve('./test/src/layouts/Layout.svelte'))).toEqual(
              path.resolve('./node_modules/package-exports/src/Exported.svelte'),
            );
          });

          it(`Does not resolve a module that doesn't use svelte in package.json`, async () => {
            jest.mock(
              path.resolve('./node_modules/no-svelte/package.json'),
              () => ({
                main: windowsPathFix('./main.js'),
                exports: {
                  '.': './main.js',
                  './package.json': './package.json',
                },
              }),
              { virtual: true },
            );
            // @ts-ignore
            expect(ssrPlugin.resolveId('no-svelte', path.resolve('./test/src/layouts/Layout.svelte'))).toBeNull();
          });
        });
        describe('#transform', () => {
          it('compiles a svelte component and sets the css while adding to watch files', async () => {
            const t = {
              addWatchFile: jest.fn(() => ''),
            };
            const bound = ssrPlugin.transform.bind(t);

            const component = `<script> let foo = 1; </script><style>.container{background: yellow}</style> <div class="container">something</div>`;
            await bound(component, '/test/src/components/tester.svelte');
            // expect(t.addWatchFile).toHaveBeenCalledTimes(2);
          });
        });
      });
    });
  });
});
