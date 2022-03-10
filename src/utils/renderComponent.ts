/* eslint-disable global-require */
import { ComponentPayload } from './types';
import collectComponentCss from './collectComponentCss';

export const getComponentName = (str) => {
  let out = str.replace('.svelte', '').replace('.js', '');
  if (out.includes('/')) {
    out = out.split('/').pop();
  }
  return out;
};

export function renderComponent({ path, props, page }) {
  /* eslint-disable import/no-dynamic-require, no-underscore-dangle */
  const component = require(path);
  const result = component.__ejs_render?.(component, props, page);

  // stacks
  if (result?.head) {
    page.headStack.push({ source: path, priority: 50, string: result.head });
  }
  if (page.settings.css === 'inline') {
    const css = result?.css || (component._css && { code: collectComponentCss(component._css), map: null });
    if (css) {
      page.svelteCss.push({ css: css.code, cssMap: css.map });
    }
  }
  return result;
}

export default (componentName: String, folder: String = 'components') =>
  ({ page, props }: ComponentPayload): string => {
    const { ssr } = page.settings.$$internal.findComponent(componentName, folder);
    return renderComponent({ path: ssr, props, page }).html || '';
  };
