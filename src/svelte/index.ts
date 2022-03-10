import rollupSvelte from 'rollup-plugin-svelte';
// import hooks from '../hooks';
import { Framework } from '../utils/types';
import preprocess from './preprocess';

// hooks.push({
// hook: 'bundle',
// run: ({ frameworks, ...props }) => {
// return {
// frameworks: [...frameworks, svelteFramework(props)],
// };
// },
// });

export default function svelteFramework(config = {}): Framework {
  return {
    name: 'SvelteFramework',
    extensions: ['.svelte'],
    adapterPath: require.resolve('./adapter'),
    dedupe: ['svelte'],
    getPlugins: ({ system, type }) => {
      if (system === 'rollup') {
        return [
          rollupSvelte({
            preprocess,
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
