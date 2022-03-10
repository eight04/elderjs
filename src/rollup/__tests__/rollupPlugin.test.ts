/* eslint-disable no-underscore-dangle */
import path from 'path';
import fsExtra from 'fs-extra';
import getConfig from '../../utils/getConfig';
import { createSSRConfig } from '../getRollupConfig';
import collectComponentCss from '../../utils/collectComponentCss';
import svelte from '../../svelte';

const rollup = require('rollup');

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

  it('SSR: Properly rolls up 3 components including _css and css output', async () => {
    const { input, plugins, output } = createSSRConfig({
      input: [
        path.resolve(`./src/rollup/__tests__/__fixtures__/simple/src/components/One.svelte`),
        path.resolve(`./src/rollup/__tests__/__fixtures__/simple/src/layouts/Two.svelte`),
        path.resolve(`./src/rollup/__tests__/__fixtures__/simple/src/routes/Three.svelte`),
      ],
      output: {
        dir: `${__dirname}/../../../___ELDER___/compiled/`,
        format: 'cjs',
        exports: 'named',
      },
      multiInputConfig: false,
      frameworks: [svelte()],
      elderConfig,
    });

    const bundle = await rollup.rollup({ input, plugins });

    await bundle.write({ output });

    // properly prioritizes css dependencies with components, routes, layouts in order
    const one = require('../../../___ELDER___/compiled/One.js');
    expect(collectComponentCss(one._css)).toMatchInlineSnapshot(
      `".route.svelte-plwlu6{background:#f0f8ff}.layout.svelte-1pyy034{background:purple}.component.svelte-5m4l82{display:flex;flex-direction:column;font-size:14px}@media(min-width: 768px){.component.svelte-5m4l82{flex-direction:row}}"`,
    );

    const two = require('../../../___ELDER___/compiled/Two.js');
    expect(collectComponentCss(two._css)).toMatchInlineSnapshot(
      `".route.svelte-plwlu6{background:#f0f8ff}.layout.svelte-1pyy034{background:purple}"`,
    );

    const three = require('../../../___ELDER___/compiled/Three.js');
    expect(collectComponentCss(three._css)).toMatchInlineSnapshot(`".route.svelte-plwlu6{background:#f0f8ff}"`);
  });

  it('SSR: Properly imports an npm dependency', async () => {
    // eslint-disable-next-line prefer-destructuring
    const cwd = process.cwd;

    const root = path.resolve('./src/rollup/__tests__/__fixtures__/external');

    process.cwd = jest.fn(process.cwd).mockImplementation(() => root);

    const { input, plugins, output } = createSSRConfig({
      input: [
        path.resolve(`./src/rollup/__tests__/__fixtures__/external/src/layouts/External.svelte`),
        path.resolve(`./src/rollup/__tests__/__fixtures__/external/src/components/Component.svelte`),
      ],
      output: {
        dir: `${__dirname}/../../../___ELDER___/compiled/`,
        format: 'cjs',
        exports: 'named',
      },
      multiInputConfig: false,
      frameworks: [svelte()],
      elderConfig,
    });

    const bundle = await rollup.rollup({ input, plugins });

    await bundle.write({ output });

    const externalComponent = require('../../../___ELDER___/compiled/External.js');

    // css is ordered by import order
    expect(collectComponentCss(externalComponent._css)).toMatchInlineSnapshot(`
      ".icon.svelte-1kfpccr{background-color:#fff;border-radius:10px;width:10px;height:10px;color:#000}.button.svelte-11xgp0c{padding:10px 20px;background-color:#f50;color:#fff;font-weight:bold}.component.svelte-1be6npj{background:orange}.layout.svelte-1e9whng{content:'we did it.'
      }"
    `);

    const componentComponent = require('../../../___ELDER___/compiled/Component.js');
    expect(collectComponentCss(componentComponent._css)).toMatchInlineSnapshot(
      `".icon.svelte-1kfpccr{background-color:#fff;border-radius:10px;width:10px;height:10px;color:#000}.component.svelte-1be6npj{background:orange}"`,
    );

    process.cwd = cwd;
  });

  fsExtra.copyFileSync = cfs;
  fsExtra.readdirSync = rds;
  fsExtra.ensureDirSync = eds;
});
