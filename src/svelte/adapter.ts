/* eslint-disable no-underscore-dangle, camelcase, no-new */
export const __ejs_render = (comp, props) => {
  const { head, html } = comp.render({ props });
  return { head, html };
};

export const __ejs_mount = (comp, target, props) => {
  new (comp.default || comp)({
    target,
    props,
    hydrate: true,
  });
};
