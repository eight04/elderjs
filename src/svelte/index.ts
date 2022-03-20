import rollupSvelte from 'rollup-plugin-svelte';
import esbuildSvelte from 'esbuild-svelte';
import { Framework } from '../utils/types';
import preprocess from './preprocess';

function arrayify(value: any): Array<any> {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

export default function svelteFramework({ preprocess: userPreprocess = null } = {}): Framework {
  return {
    name: 'SvelteFramework',
    extensions: ['.svelte'],
    adapterPath: require.resolve('./adapter.mjs'),
    dedupe: ['svelte'],
    getPlugins: ({ system, type }) => {
      let plugin: Function;
      if (system === 'rollup') {
        plugin = rollupSvelte;
      } else if (system === 'esbuild') {
        plugin = esbuildSvelte;
      } else {
        throw new Error(`Unsupported build system: ${system}`);
      }
      return [
        plugin({
          // FIXME: this only works when both plugins use the same interface
          preprocess: [preprocess, ...arrayify(userPreprocess)],
          compilerOptions: {
            generate: type === 'ssr' ? 'ssr' : 'dom',
            // FIXME: only set hydratable if module id matches `/components/**/*.svelte`
            hydratable: true,
            css: false,
          },
          emitCss: true,
        }),
      ];
    },
  };
}
