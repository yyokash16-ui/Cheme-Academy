import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('the install manifest declares a standalone app and required icon sizes', () => {
  assert.equal(manifest.name, 'ChemE Academy');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.type === 'image/png'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.type === 'image/png'));
});

test('the service worker never intercepts account or owner API responses', () => {
  const handlers = new Map();
  const self = {
    location: { origin: 'https://academy.example' },
    clients: { claim: () => Promise.resolve() },
    addEventListener: (name, handler) => handlers.set(name, handler),
    skipWaiting: () => Promise.resolve()
  };
  const context = {
    self,
    caches: { open: () => Promise.resolve({ addAll: () => Promise.resolve() }), keys: () => Promise.resolve([]) },
    URL,
    fetch: globalThis.fetch,
    Response
  };
  vm.runInNewContext(serviceWorker, context);

  for (const path of ['/api/me', '/api/owner']) {
    let intercepted = false;
    handlers.get('fetch')({
      request: { method: 'GET', url: `https://academy.example${path}`, mode: 'cors' },
      respondWith: () => { intercepted = true; }
    });
    assert.equal(intercepted, false, `${path} must remain network-only`);
  }
});
