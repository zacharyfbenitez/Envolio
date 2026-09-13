import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import native from '../vite.native.config.js';

test('native assets are isolated from the deployed web build', () => {
  assert.equal(native.base, '/');
  assert.equal(native.build.outDir, 'dist-native');
  assert.equal(native.define['import.meta.env.VITE_NATIVE_SHELL'], '"true"');
});
test('wrapper bundles assets with the owner-selected reverse-DNS identifier', async () => {
  const config=await readFile(new URL('../capacitor.config.ts',import.meta.url),'utf8');
  assert.match(config,/process\.env\.ENVOLIO_APP_ID/);
  assert.match(config,/const appId = 'app\.envolio'/);
  assert.match(config,/throw new Error/);
  assert.match(config,/webDir: 'dist-native'/);
  assert.doesNotMatch(config,/server\s*:/);
});
test('iOS and Android identities agree with Capacitor', async () => {
  const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
  const xcode=await read('ios/App/App.xcodeproj/project.pbxproj');
  const ids=[...xcode.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map(m=>m[1]);
  assert.deepEqual(ids,['app.envolio','app.envolio']);
  const gradle=await read('android/app/build.gradle');
  assert.match(gradle,/namespace = "app\.envolio"/);
  assert.match(gradle,/applicationId "app\.envolio"/);
  assert.match(await read('android/app/src/main/java/app/envolio/MainActivity.java'),/^package app\.envolio;/);
  const strings=await read('android/app/src/main/res/values/strings.xml');
  for(const name of ['package_name','custom_url_scheme']) assert.ok(strings.includes(`<string name="${name}">app.envolio</string>`));
  for(const path of ['ios/App/App/capacitor.config.json','android/app/src/main/assets/capacitor.config.json']) {
    assert.equal(JSON.parse(await read(path)).appId,'app.envolio');
  }
});
test('native build replaces PWA shell without modifying web behavior', async () => {
  assert.equal(native.resolve.alias[0].find,'./PwaShell.jsx');
  const shell=await readFile(new URL('../native/NativeShell.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(shell,/serviceWorker\.register|beforeinstallprompt/);
  assert.match(shell,/flight connectivity is not configured/);
});
