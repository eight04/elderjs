export default function collectComponentCss(input) {
  const collected = new Set();
  const result = [];

  function search(value) {
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
  }

  search(input);
  return result.join('');
}
