/* eslint-disable no-underscore-dangle, camelcase, no-new */
export const __ejs_render = (comp, props) => {
  const { head, html } = (comp.default || comp).render(props);
  // we don't use css from Comp.render
  return { head, html };
};

export const __ejs_mount = (comp, target, props) => {
  new (comp.default || comp)({
    target,
    props,
    hydrate: true,
  });
};
