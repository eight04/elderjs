const cache = new Map();

function collectComponentCss(input: any): string {
  const collected = new Set();
  const result = [];

  const search = (value) => {
    // break recursive imports
    if (collected.has(value)) return;
    collected.add(value);

    if (value.forEach) {
      value.forEach(search);
    } else if (typeof value === 'string') {
      result.push(value);
    } else if (typeof value === 'function') {
      search(value());
    }
  };

  search(input);

  return result.join('');
}

type collectComponentCssType = typeof collectComponentCss;

function memo(store: Map<any, any>, fn: collectComponentCssType): collectComponentCssType {
  return (value) => {
    if (store.has(value)) return store.get(value);

    const result = fn(value);
    store.set(value, result);
    return result;
  };
}

export default memo(cache, collectComponentCss);
