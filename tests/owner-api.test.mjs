import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ownerHandler from '../api/owner.ts';

test('Vercel packages shared API helpers with each function', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.functions['api/*.ts'].includeFiles, 'api/_lib/**/*.ts');
});

test('the owner endpoint rejects unauthenticated requests before accessing data', async () => {
  const oldDatabaseUrl = process.env.DATABASE_URL;
  const oldOwnerEmail = process.env.OWNER_EMAIL;
  process.env.DATABASE_URL = 'postgresql://unused.invalid/database';
  process.env.OWNER_EMAIL = 'owner@example.com';

  const response = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  try {
    await ownerHandler({ method: 'GET', headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.ok, false);
  } finally {
    if (oldDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldDatabaseUrl;
    if (oldOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
    else process.env.OWNER_EMAIL = oldOwnerEmail;
  }
});

test('the owner endpoint rejects malformed bearer tokens without accessing data', async () => {
  const oldDatabaseUrl = process.env.DATABASE_URL;
  const oldOwnerEmail = process.env.OWNER_EMAIL;
  process.env.DATABASE_URL = 'postgresql://unused.invalid/database';
  process.env.OWNER_EMAIL = 'owner@example.com';
  const response = {
    statusCode: 200,
    setHeader() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  try {
    await ownerHandler({ method: 'GET', headers: { authorization: 'Bearer malformed' } }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.error, 'Invalid session');
  } finally {
    if (oldDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldDatabaseUrl;
    if (oldOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
    else process.env.OWNER_EMAIL = oldOwnerEmail;
  }
});
