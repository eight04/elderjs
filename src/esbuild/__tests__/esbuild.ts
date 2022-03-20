/* eslint-disable global-require, import/no-dynamic-require, no-underscore-dangle */
import * as fs from 'fs/promises';
import { withDir } from 'tempdir-yaml';
import glob from 'fast-glob';
import bundler from '../esbuildBundler';

function stableHash(p: string): string {
  return p.replace(/\.[a-z0-9]{6,8}\./i, (match) => `.${'X'.repeat(match.length - 2)}.`);
}

test(
  'esbuild',
  () =>
    withDir(
      `
  - package.json: |
      {}
  - src:
    - components:
      - Foo.svelte: |
          <div class="container">FOO</div>
          <style>
            .container { color: red; }
          </style>
      - Bar.svelte: |
          <script>
            import "./bar.css";
          </script>
          <div class="container">BAR</div>
          <style>
            .container {background: black; }
          </style>
      - bar.css: |
         body {font-size: 16px;}
  `,
      async (resolve) => {
        await bundler({
          initializationOptions: {
            rootDir: resolve('.'),
          },
          watch: false,
        });
        const files = (await glob(['___ELDER___/**/*', 'public/**/*'], { cwd: resolve('.') })).map(stableHash);
        expect(files.sort()).toMatchInlineSnapshot(`
          Array [
            "___ELDER___/compiled/__ejs_css.css",
            "___ELDER___/compiled/__ejs_css.css.map",
            "___ELDER___/compiled/__ejs_css.js",
            "___ELDER___/compiled/__ejs_css.js.map",
            "___ELDER___/compiled/assets/style.css",
            "___ELDER___/compiled/components/Bar.css",
            "___ELDER___/compiled/components/Bar.css.map",
            "___ELDER___/compiled/components/Bar.js",
            "___ELDER___/compiled/components/Bar.js.map",
            "___ELDER___/compiled/components/Foo.css",
            "___ELDER___/compiled/components/Foo.css.map",
            "___ELDER___/compiled/components/Foo.js",
            "___ELDER___/compiled/components/Foo.js.map",
            "public/_elderjs/assets/style.css",
            "public/_elderjs/svelte/chunks/chunk.XXXXXXXX.js",
            "public/_elderjs/svelte/chunks/chunk.XXXXXXXX.js.map",
            "public/_elderjs/svelte/components/Bar.XXXXXXXX.css",
            "public/_elderjs/svelte/components/Bar.XXXXXXXX.css.map",
            "public/_elderjs/svelte/components/Bar.XXXXXXXX.js",
            "public/_elderjs/svelte/components/Bar.XXXXXXXX.js.map",
            "public/_elderjs/svelte/components/Foo.XXXXXXXX.css",
            "public/_elderjs/svelte/components/Foo.XXXXXXXX.css.map",
            "public/_elderjs/svelte/components/Foo.XXXXXXXX.js",
            "public/_elderjs/svelte/components/Foo.XXXXXXXX.js.map",
          ]
        `);
        const foo = require(resolve('___ELDER___/compiled/components/Foo'));
        expect(foo.__ejs_render(foo, {})).toMatchInlineSnapshot(`
          Object {
            "head": "",
            "html": "<div class=\\"container svelte-iv7sqn\\">FOO</div>",
          }
        `);
        expect(foo._css).toMatchInlineSnapshot(`
          ".container.svelte-iv7sqn{color:red}
          /*# sourceMappingURL=Foo.css.map */
          "
        `);

        const bundledCss = await fs.readFile(resolve('public/_elderjs/assets/style.css'), 'utf8');
        expect(bundledCss).toMatchInlineSnapshot(`
          "body{font-size:16px}.container.svelte-w1pk7u{background:black}.container.svelte-iv7sqn{color:red}
          /*# sourceMappingURL=__ejs_css.css.map */
          "
        `);
      },
    ),
  5 * 60 * 1000,
);
