const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const teJsPath = path.join(__dirname, '..', '..', 'apps', 'api', 'public', 'te.js');
const teJsCode = fs.readFileSync(teJsPath, 'utf8');

// Mock browser environment
const storage = {};
let fetchCalls = [];
let beaconCalls = [];

const mockWindow = {
  location: { href: 'http://example.com/test' },
  addEventListener: (event, handler) => {},
};

const mockDocument = {
  referrer: 'http://google.com',
  currentScript: {
    src: 'http://localhost:8000/public/te.js',
    getAttribute: (attr) => (attr === 'data-key' ? 'test_api_key_123' : null)
  },
  createElement: (tag) => ({
    tagName: tag,
    src: '',
    async: false,
    onload: null,
    onerror: null
  }),
  head: {
    appendChild: (el) => {
      // Simulate script loading
      setTimeout(() => {
        if (el.onload) el.onload();
      }, 10);
    }
  },
  querySelector: () => null
};

const mockLocalStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); }
};

const mockFetch = (url, options) => {
  fetchCalls.push({ url, options });
  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
};

const mockNavigator = {
  sendBeacon: (url, blob) => {
    beaconCalls.push({ url, blob });
    return true;
  }
};

const context = vm.createContext({
  window: mockWindow,
  document: mockDocument,
  localStorage: mockLocalStorage,
  fetch: mockFetch,
  navigator: mockNavigator,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  Date: Date,
  Blob: class MockBlob { constructor(parts, opts) { this.parts = parts; this.opts = opts; } },
  URL: URL,
  Math: Math,
  // Mock rrwebRecord already present
  rrwebRecord: function mockRecord(opts) {
    mockRecord.configuredOpts = opts;
    return () => {};
  }
});

// Run te.js in the context
vm.runInContext(teJsCode, context);

// Assertions on initial run
assert(context.window.ThirdEye, 'window.ThirdEye should be defined');
assert.strictEqual(typeof context.window.ThirdEye.track, 'function', 'track function should exist');
assert.strictEqual(typeof context.window.ThirdEye.getSessionId, 'function', 'getSessionId should exist');
assert.strictEqual(typeof context.window.ThirdEye.flush, 'function', 'flush function should exist');

// Verify initial pageview was sent
const pageviewCall = fetchCalls.find(c => c.url === 'http://localhost:8000/api/v1/track');
assert(pageviewCall, 'Pageview track call should have been made');
const pageviewBody = JSON.parse(pageviewCall.options.body);
assert.strictEqual(pageviewBody.api_key, 'test_api_key_123');
assert.strictEqual(pageviewBody.event_type, 'pageview');
assert.strictEqual(pageviewBody.session_id, storage['te_session']);

// Verify rrweb options
const opts = context.rrwebRecord.configuredOpts;
assert(opts, 'rrwebRecord should have been called with options');
assert.strictEqual(opts.maskAllInputs, true);
assert.strictEqual(opts.maskTextSelector, '*');
assert.strictEqual(opts.maskInputFn('secret_password', {}), '***');
assert.strictEqual(opts.maskTextFn('sensitive text here', {}), '***');
assert.strictEqual(opts.maskTextFn('   ', {}), '   '); // Whitespace preserved

// Emit simulated events and flush
opts.emit({ type: 1, data: {}, timestamp: Date.now() });
opts.emit({ type: 2, data: {}, timestamp: Date.now() });

context.window.ThirdEye.flush();

const recordingCall = fetchCalls.find(c => c.url === 'http://localhost:8000/api/v1/recordings');
assert(recordingCall, 'Recording flush should send to /api/v1/recordings');
const recordingBody = JSON.parse(recordingCall.options.body);
assert.strictEqual(recordingBody.session_id, storage['te_session']);
assert.strictEqual(recordingBody.api_key, 'test_api_key_123');
assert.strictEqual(recordingBody.events.length, 2);

console.log('RUNTIME BEHAVIORAL VERIFICATION PASSED COMPLETELY!');
process.exit(0);
