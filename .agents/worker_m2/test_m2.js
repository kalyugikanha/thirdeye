const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const assert = require('assert');

const teJsPath = path.join(__dirname, '..', '..', 'apps', 'api', 'public', 'te.js');
const rrwebPath = path.join(__dirname, '..', '..', 'apps', 'api', 'public', 'rrweb-record.min.js');

console.log('Testing snippet at:', teJsPath);
assert(fs.existsSync(teJsPath), 'te.js must exist');
assert(fs.existsSync(rrwebPath), 'rrweb-record.min.js must exist');
assert(fs.statSync(rrwebPath).size > 10000, 'rrweb-record.min.js must be > 10KB');

// a) node --check
execSync(`node --check "${teJsPath}"`, { stdio: 'inherit' });
execSync(`node --check "${rrwebPath}"`, { stdio: 'inherit' });
console.log('node --check passed cleanly.');

// b) privacy masking parameters
const code = fs.readFileSync(teJsPath, 'utf8');
assert(code.includes('maskAllInputs: true'), 'Must include maskAllInputs: true');
assert(code.includes("'***'"), "Must include '***'");
assert(code.includes('maskTextFn'), 'Must include maskTextFn');
assert(code.includes('maskInputFn'), 'Must include maskInputFn');
assert(code.includes("maskTextSelector: '*'"), "Must include maskTextSelector: '*'");

// c) 5-second interval and endpoint
assert(code.includes('5000'), 'Must include 5000 interval');
assert(code.includes('/api/v1/recordings'), 'Must include /api/v1/recordings');
assert(code.includes('POST'), "Must include POST");
assert(code.includes('session_id'), 'Must include session_id');
assert(code.includes('duration'), 'Must include duration');
assert(code.includes('events'), 'Must include events');

// d) Beacon & unload
assert(code.includes('beforeunload'), 'Must include beforeunload');
assert(code.includes('pagehide'), 'Must include pagehide');
assert(code.includes('sendBeacon'), 'Must include sendBeacon');

console.log('ALL NODE ASSERTIONS PASSED!');
