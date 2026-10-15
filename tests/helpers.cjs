const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function context(extra = {}) {
  const events = new Map();
  const c = vm.createContext({
    console, setTimeout, clearTimeout, queueMicrotask, URL, URLSearchParams,
    requestAnimationFrame: () => {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: {
      readyState: 'loading',
      addEventListener(name, cb) { events.set(name, [...(events.get(name) || []), cb]); },
      dispatchEvent(e) { (events.get(e.type) || []).forEach(cb => cb(e)); },
      getElementById: () => null
    },
    CustomEvent: class { constructor(type) { this.type = type; } },
    ...extra
  });
  c.window = c;
  c.events = events;
  return c;
}
function load(c, ...files) {
  files.forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, { filename: file }));
  return c;
}
module.exports = { context, load, root };
