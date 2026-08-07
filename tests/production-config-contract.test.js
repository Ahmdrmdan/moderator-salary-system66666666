'use strict';

const assert = require('assert');
const fs = require('fs');

const projectId = 'ahmed123-95a0e';
const firebaseConfigSource = fs.readFileSync('js/firebase.js', 'utf8');
const rootRouterSource = fs.readFileSync('index.html', 'utf8');
const firebaseRc = JSON.parse(fs.readFileSync('.firebaserc', 'utf8'));

assert.strictEqual(firebaseRc.projects.default, projectId,
  'Firebase CLI deployment target is the production project');
assert.match(firebaseConfigSource, new RegExp(`projectId:\\s*["']${projectId}["']`),
  'the dashboard Firebase client targets the production project');
assert.match(rootRouterSource, new RegExp(`projectId:\\s*'${projectId}'`),
  'the Hosting root auth router targets the same production project');
assert.match(rootRouterSource, new RegExp(`authDomain:\\s*'${projectId}\\.firebaseapp\\.com'`),
  'the Hosting root auth router uses the matching production Auth domain');
assert.doesNotMatch(rootRouterSource, /moderator-salary9/,
  'the root router does not revive the retired Firebase project session');
assert.match(firebaseConfigSource, /useLocalFirebaseEmulators[\s\S]*?\['127\.0\.0\.1', 'localhost'\]/,
  'the local UAT emulator guard is explicit and limited to localhost hosts');
assert.match(firebaseConfigSource, /auth\.useEmulator\('http:\/\/127\.0\.0\.1:9099'/,
  'local UAT routes Authentication to the local emulator');
assert.match(firebaseConfigSource, /db\.useEmulator\('127\.0\.0\.1', 8080\)/,
  'local UAT routes Firestore to the local emulator');
assert.match(rootRouterSource, /rootAuth\.useEmulator\('http:\/\/127\.0\.0\.1:9099'/,
  'the root auth router follows the same localhost-only UAT boundary');

console.log('production configuration contract tests passed');
