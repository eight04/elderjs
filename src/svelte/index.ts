import rollupSvelte from 'rollup-plugin-svelte';
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
      if (system === 'rollup') {
        return [
          rollupSvelte({
            preprocess: [preprocess, ...arrayify(userPreprocess)],
            compilerOptions: {
              generate: type === 'ssr' ? 'ssr' : 'dom',
              // FIXME: only set hydratable if module id matches `/components/**/*.svelte`
              hydratable: true,
            },
            emitCss: true,
          }),
        ];
      }
      throw new Error(`Unsupported build system: ${system}`);
    },
  };
}
