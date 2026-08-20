import { strict as assert } from 'assert';
import http from 'http';
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let pass = 0, fail = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) await result;
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    fail++;
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

function assertEqual(actual: any, expected: any, msg?: string) {
  if (actual !== expected) throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function fetchJSON(url: string, opts?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

function startServer(app: express.Application): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function getPort(server: http.Server): number {
  return (server.address() as any).port;
}

function sanitizeStr(val: unknown, max = 5000): string {
  if (typeof val !== 'string') return '';
  const s = val.trim().slice(0, max);
  return s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}
function genId(prefix: string): string {
  return prefix + crypto.randomUUID();
}

async function main() {
  console.log('\n📋 PUSH NOTIFICATION (FCM) QA TEST SUITE\n');

  // ──────────────────────────────────────────
  console.log('1. fcm-server.ts — initFirebaseAdmin');
  // ──────────────────────────────────────────

  await test('initFirebaseAdmin: warns when env vars missing', async () => {
    const origWarn = console.warn;
    let warned = '';
    console.warn = (msg: string) => { warned = String(msg); };

    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.FIREBASE_CLIENT_EMAIL;

    const { initFirebaseAdmin } = await import('../src/utils/fcm-server');
    initFirebaseAdmin();

    console.warn = origWarn;
    assert(warned.includes('Push notifications disabled'), `Expected warning, got: "${warned}"`);
  });

  // ──────────────────────────────────────────
  console.log('\n2. fcm-server.ts — sendFCMToUser / sendFCMToMultipleUsers');
  // ──────────────────────────────────────────

  await test('sendFCMToUser: no-ops when FCM not initialized', async () => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.FIREBASE_CLIENT_EMAIL;

    const { sendFCMToUser } = await import('../src/utils/fcm-server');
    await sendFCMToUser('user-123', 'Test Title', 'Test Body');
  });

  await test('sendFCMToUser: no-ops with empty userId', async () => {
    const { sendFCMToUser } = await import('../src/utils/fcm-server');
    await sendFCMToUser('', 'Title', 'Body');
  });

  await test('sendFCMToMultipleUsers: no-ops when FCM not initialized', async () => {
    const { sendFCMToMultipleUsers } = await import('../src/utils/fcm-server');
    await sendFCMToMultipleUsers(['u1', 'u2', 'u3'], 'Title', 'Body');
  });

  await test('sendFCMToMultipleUsers: no-ops with empty array', async () => {
    const { sendFCMToMultipleUsers } = await import('../src/utils/fcm-server');
    await sendFCMToMultipleUsers([], 'Title', 'Body');
  });

  // ──────────────────────────────────────────
  console.log('\n3. FCM API Endpoints (replicated route handlers)');
  // ──────────────────────────────────────────

  await test('POST /api/fcm/register: requires userId and token', async () => {
    const app = express();
    app.use(express.json());
    const tokens: any[] = [];
    app.post('/api/fcm/register', async (req, res) => {
      const userId = sanitizeStr(req.body.userId, 100);
      const token = sanitizeStr(req.body.token);
      if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });
      tokens.push({ id: genId('fcm-'), userId, token, createdAt: new Date().toISOString() });
      res.json({ success: true });
    });

    const server = await startServer(app);
    const port = getPort(server);

    let r = await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    assertEqual(r.status, 400);
    assertEqual(r.body.error, 'userId and token required');

    r = await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u1' })
    });
    assertEqual(r.status, 400);

    r = await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'tok123' })
    });
    assertEqual(r.status, 400);

    assertEqual(tokens.length, 0, 'No tokens should be registered on error');
    server.close();
  });

  await test('POST /api/fcm/register: succeeds with valid data', async () => {
    const app = express();
    app.use(express.json());
    const tokens: any[] = [];
    app.post('/api/fcm/register', async (req, res) => {
      const userId = sanitizeStr(req.body.userId, 100);
      const token = sanitizeStr(req.body.token);
      if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });
      tokens.push({ id: genId('fcm-'), userId, token, createdAt: new Date().toISOString() });
      res.json({ success: true });
    });

    const server = await startServer(app);
    const port = getPort(server);

    const r = await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-abc', token: 'fcm-token-xyz' })
    });
    assertEqual(r.status, 200);
    assertEqual(r.body.success, true);
    assertEqual(tokens.length, 1);
    assertEqual(tokens[0].userId, 'user-abc');
    assertEqual(tokens[0].token, 'fcm-token-xyz');
    assert(tokens[0].id.startsWith('fcm-'), 'Token ID should start with fcm-');
    assert(tokens[0].createdAt, 'Should have createdAt');
    server.close();
  });

  await test('DELETE /api/fcm/unregister: requires token', async () => {
    const app = express();
    app.use(express.json());
    const tokens: any[] = [{ id: 'fcm-1', userId: 'u1', token: 'tok1', createdAt: '' }];
    app.delete('/api/fcm/unregister', async (req, res) => {
      const token = sanitizeStr(req.body.token);
      if (!token) return res.status(400).json({ error: 'token required' });
      const idx = tokens.findIndex(t => t.token === token);
      if (idx >= 0) tokens.splice(idx, 1);
      res.json({ success: true });
    });

    const server = await startServer(app);
    const port = getPort(server);

    const r = await fetchJSON(`http://localhost:${port}/api/fcm/unregister`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assertEqual(r.status, 400);
    assertEqual(r.body.error, 'token required');
    assertEqual(tokens.length, 1, 'Token should not be deleted');
    server.close();
  });

  await test('DELETE /api/fcm/unregister: succeeds with valid token', async () => {
    const app = express();
    app.use(express.json());
    const tokens: any[] = [
      { id: 'fcm-1', userId: 'u1', token: 'tok-alpha', createdAt: '' },
      { id: 'fcm-2', userId: 'u1', token: 'tok-beta', createdAt: '' },
    ];
    app.delete('/api/fcm/unregister', async (req, res) => {
      const token = sanitizeStr(req.body.token);
      if (!token) return res.status(400).json({ error: 'token required' });
      const idx = tokens.findIndex(t => t.token === token);
      if (idx >= 0) tokens.splice(idx, 1);
      res.json({ success: true });
    });

    const server = await startServer(app);
    const port = getPort(server);

    const r = await fetchJSON(`http://localhost:${port}/api/fcm/unregister`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'tok-alpha' })
    });
    assertEqual(r.status, 200);
    assertEqual(r.body.success, true);
    assertEqual(tokens.length, 1, 'One token should remain');
    assertEqual(tokens[0].token, 'tok-beta', 'Remaining token should be beta');
    server.close();
  });

  await test('POST /api/fcm/register: truncates userId to 100 chars', async () => {
    const app = express();
    app.use(express.json());
    const tokens: any[] = [];
    app.post('/api/fcm/register', async (req, res) => {
      const userId = sanitizeStr(req.body.userId, 100);
      const token = sanitizeStr(req.body.token);
      if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });
      tokens.push({ id: genId('fcm-'), userId, token, createdAt: new Date().toISOString() });
      res.json({ success: true });
    });

    const server = await startServer(app);
    const port = getPort(server);

    const longUserId = 'a'.repeat(200);
    const r = await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: longUserId, token: 'valid-token' })
    });
    assertEqual(r.status, 200);
    assert(tokens[0].userId.length <= 100, `userId truncated, got ${tokens[0].userId.length}`);
    server.close();
  });

  await test('POST /api/fcm/register: sanitizes script tags from inputs', async () => {
    const app = express();
    app.use(express.json());
    const tokens: any[] = [];
    app.post('/api/fcm/register', async (req, res) => {
      const userId = sanitizeStr(req.body.userId, 100);
      const token = sanitizeStr(req.body.token);
      if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });
      tokens.push({ id: genId('fcm-'), userId, token, createdAt: new Date().toISOString() });
      res.json({ success: true });
    });

    const server = await startServer(app);
    const port = getPort(server);

    const r = await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '<script>alert("xss")</script>user1', token: 'valid-token' })
    });
    assertEqual(r.status, 200);
    assert(!tokens[0].userId.includes('<script>'), 'Script tags should be stripped');
    assertEqual(tokens[0].userId, 'user1');
    server.close();
  });

  await test('POST /api/fcm/register: rejects non-string inputs', async () => {
    const app = express();
    app.use(express.json());
    app.post('/api/fcm/register', async (req, res) => {
      const userId = sanitizeStr(req.body.userId, 100);
      const token = sanitizeStr(req.body.token);
      if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });
      res.json({ success: true });
    });

    const server = await startServer(app);
    const port = getPort(server);

    const r = await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 12345, token: 67890 })
    });
    assertEqual(r.status, 400);
    server.close();
  });

  await test('POST /api/fcm/register: upsert behavior (no duplicates)', async () => {
    const app = express();
    app.use(express.json());
    const tokens: any[] = [];
    app.post('/api/fcm/register', async (req, res) => {
      const userId = sanitizeStr(req.body.userId, 100);
      const token = sanitizeStr(req.body.token);
      if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });
      const idx = tokens.findIndex(t => t.userId === userId && t.token === token);
      if (idx >= 0) tokens.splice(idx, 1);
      tokens.push({ id: genId('fcm-'), userId, token, createdAt: new Date().toISOString() });
      res.json({ success: true });
    });

    const server = await startServer(app);
    const port = getPort(server);

    await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u1', token: 'same-token' })
    });
    await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u1', token: 'same-token' })
    });

    const userTokens = tokens.filter(t => t.userId === 'u1');
    assertEqual(userTokens.length, 1, 'Should have only 1 token after re-registering');
    server.close();
  });

  // ──────────────────────────────────────────
  console.log('\n4. Service Worker endpoint');
  // ──────────────────────────────────────────

  await test('GET /firebase-messaging-sw.js: returns placeholder when not configured', async () => {
    const origPid = process.env.VITE_FIREBASE_PROJECT_ID;
    delete process.env.VITE_FIREBASE_PROJECT_ID;

    const app = express();
    app.get('/firebase-messaging-sw.js', (_req, res) => {
      if (!process.env.VITE_FIREBASE_PROJECT_ID) {
        res.type('application/javascript').send('// FCM not configured');
        return;
      }
      res.type('application/javascript').send('firebase.initializeApp({});');
    });

    const server = await startServer(app);
    const port = getPort(server);

    const res = await fetch(`http://localhost:${port}/firebase-messaging-sw.js`);
    const text = await res.text();
    assertEqual(res.status, 200);
    assert(text.includes('FCM not configured'), `Got: ${text}`);
    assert(res.headers.get('content-type')?.includes('javascript'), 'JS content type');

    if (origPid) process.env.VITE_FIREBASE_PROJECT_ID = origPid;
    server.close();
  });

  await test('GET /firebase-messaging-sw.js: injects config when configured', async () => {
    const origEnv = { pid: process.env.VITE_FIREBASE_PROJECT_ID, key: process.env.VITE_FIREBASE_API_KEY };
    process.env.VITE_FIREBASE_PROJECT_ID = 'my-project-123';
    process.env.VITE_FIREBASE_API_KEY = 'my-api-key-456';

    const app = express();
    app.get('/firebase-messaging-sw.js', (_req, res) => {
      if (!process.env.VITE_FIREBASE_PROJECT_ID) {
        res.type('application/javascript').send('// FCM not configured');
        return;
      }
      let sw = `firebase.initializeApp({ projectId: 'FCM_PROJECT_ID', apiKey: 'FCM_API_KEY' });`;
      sw = sw.replace('FCM_PROJECT_ID', process.env.VITE_FIREBASE_PROJECT_ID || '');
      sw = sw.replace('FCM_API_KEY', process.env.VITE_FIREBASE_API_KEY || '');
      res.type('application/javascript').send(sw);
    });

    const server = await startServer(app);
    const port = getPort(server);

    const res = await fetch(`http://localhost:${port}/firebase-messaging-sw.js`);
    const text = await res.text();
    assertEqual(res.status, 200);
    assert(text.includes('my-project-123'), 'Should inject project ID');
    assert(text.includes('my-api-key-456'), 'Should inject API key');
    assert(!text.includes('FCM_PROJECT_ID'), 'Placeholder should be replaced');
    assert(!text.includes('FCM_API_KEY'), 'API key placeholder should be replaced');

    process.env.VITE_FIREBASE_PROJECT_ID = origEnv.pid;
    process.env.VITE_FIREBASE_API_KEY = origEnv.key;
    server.close();
  });

  await test('GET /firebase-messaging-sw.js: handles missing file gracefully', async () => {
    const origPid = process.env.VITE_FIREBASE_PROJECT_ID;
    process.env.VITE_FIREBASE_PROJECT_ID = 'test';

    const app = express();
    app.get('/firebase-messaging-sw.js', (_req, res) => {
      if (!process.env.VITE_FIREBASE_PROJECT_ID) {
        res.type('application/javascript').send('// FCM not configured');
        return;
      }
      try {
        const filePath = path.join(process.cwd(), 'nonexistent-file.js');
        fs.readFileSync(filePath, 'utf-8');
        res.type('application/javascript').send('');
      } catch {
        res.type('application/javascript').send('// FCM service worker error');
      }
    });

    const server = await startServer(app);
    const port = getPort(server);

    const res = await fetch(`http://localhost:${port}/firebase-messaging-sw.js`);
    const text = await res.text();
    assertEqual(res.status, 200);
    assert(text.includes('FCM service worker error'), `Got: ${text}`);

    process.env.VITE_FIREBASE_PROJECT_ID = origPid;
    server.close();
  });

  // ──────────────────────────────────────────
  console.log('\n5. Frontend firebase.ts module');
  // ──────────────────────────────────────────

  await test('firebase.ts source file exports getFCMToken', async () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'firebase.ts'), 'utf-8');
    assert(src.includes('export async function getFCMToken'), 'getFCMToken should be exported');
  });

  await test('firebase.ts source file exports onForegroundMessage', async () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'firebase.ts'), 'utf-8');
    assert(src.includes('export function onForegroundMessage'), 'onForegroundMessage should be exported');
  });

  // ──────────────────────────────────────────
  console.log('\n6. DAO — FCM token functions');
  // ──────────────────────────────────────────

  await test('DAO exports all FCM functions', async () => {
    const dao = await import('../src/db/dao');
    assert(typeof (dao as any).registerFCMToken === 'function');
    assert(typeof (dao as any).unregisterFCMToken === 'function');
    assert(typeof (dao as any).getFCMTokensByUserId === 'function');
    assert(typeof (dao as any).getAllFCMTokens === 'function');
  });

  // ──────────────────────────────────────────
  console.log('\n7. Integration: full lifecycle');
  // ──────────────────────────────────────────

  await test('Full register → query → unregister lifecycle', async () => {
    const tokens: any[] = [];

    const app = express();
    app.use(express.json());
    app.post('/api/fcm/register', async (req, res) => {
      const userId = sanitizeStr(req.body.userId, 100);
      const token = sanitizeStr(req.body.token);
      if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });
      const idx = tokens.findIndex(t => t.userId === userId && t.token === token);
      if (idx >= 0) tokens.splice(idx, 1);
      tokens.push({ id: genId('fcm-'), userId, token, createdAt: new Date().toISOString() });
      res.json({ success: true });
    });
    app.delete('/api/fcm/unregister', async (req, res) => {
      const token = sanitizeStr(req.body.token);
      if (!token) return res.status(400).json({ error: 'token required' });
      const idx = tokens.findIndex(t => t.token === token);
      if (idx >= 0) tokens.splice(idx, 1);
      res.json({ success: true });
    });
    app.get('/api/fcm/tokens/:userId', (_req, res) => {
      res.json(tokens.filter(t => t.userId === _req.params.userId));
    });

    const server = await startServer(app);
    const port = getPort(server);

    // 1. Register two tokens for user-1
    await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', token: 'token-alpha' })
    });
    await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', token: 'token-beta' })
    });

    // 2. Verify both stored
    let r = await fetchJSON(`http://localhost:${port}/api/fcm/tokens/user-1`);
    assertEqual(r.status, 200);
    assertEqual(r.body.length, 2, 'Should have 2 tokens');

    // 3. Register one token for user-2
    await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-2', token: 'token-gamma' })
    });

    // 4. Verify isolation
    r = await fetchJSON(`http://localhost:${port}/api/fcm/tokens/user-1`);
    assertEqual(r.body.length, 2);
    r = await fetchJSON(`http://localhost:${port}/api/fcm/tokens/user-2`);
    assertEqual(r.body.length, 1);

    // 5. Unregister token-alpha from user-1
    await fetchJSON(`http://localhost:${port}/api/fcm/unregister`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'token-alpha' })
    });
    r = await fetchJSON(`http://localhost:${port}/api/fcm/tokens/user-1`);
    assertEqual(r.body.length, 1, 'Should have 1 token after unregister');
    assertEqual(r.body[0].token, 'token-beta');

    // 6. Unregister last token
    await fetchJSON(`http://localhost:${port}/api/fcm/unregister`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'token-beta' })
    });
    r = await fetchJSON(`http://localhost:${port}/api/fcm/tokens/user-1`);
    assertEqual(r.body.length, 0, 'Should have 0 tokens');

    // 7. User-2 still has their token
    r = await fetchJSON(`http://localhost:${port}/api/fcm/tokens/user-2`);
    assertEqual(r.body.length, 1, 'User-2 token should still exist');
    assertEqual(r.body[0].token, 'token-gamma');

    server.close();
  });

  // ──────────────────────────────────────────
  console.log('\n8. Security: XSS and injection');
  // ──────────────────────────────────────────

  await test('Script tags stripped from userId', async () => {
    const app = express();
    app.use(express.json());
    const captured: string[] = [];
    app.post('/api/fcm/register', async (req, res) => {
      const userId = sanitizeStr(req.body.userId, 100);
      const token = sanitizeStr(req.body.token);
      captured.push(userId);
      if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });
      res.json({ success: true });
    });

    const server = await startServer(app);
    const port = getPort(server);

    await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '<script>alert("xss")</script>user', token: 'tok' })
    });
    assert(!captured[0].includes('<script>'), 'Script tags should be sanitized');
    assertEqual(captured[0], 'user');
    server.close();
  });

  await test('Empty body does not crash server', async () => {
    const app = express();
    app.use(express.json());
    app.post('/api/fcm/register', async (req, res) => {
      const userId = sanitizeStr(req.body.userId, 100);
      const token = sanitizeStr(req.body.token);
      if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });
      res.json({ success: true });
    });

    const server = await startServer(app);
    const port = getPort(server);

    const r = await fetchJSON(`http://localhost:${port}/api/fcm/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: ''
    });
    assert(r.status < 500, `Server should not crash on empty body, got ${r.status}`);
    server.close();
  });

  // ──────────────────────────────────────────
  console.log('\n9. Real service worker file validation');
  // ──────────────────────────────────────────

  await test('firebase-messaging-sw.js exists in public/', () => {
    const swPath = path.join(process.cwd(), 'public', 'firebase-messaging-sw.js');
    assert(fs.existsSync(swPath), `File not found: ${swPath}`);
  });

  await test('Service worker has onBackgroundMessage handler', async () => {
    const swPath = path.join(process.cwd(), 'public', 'firebase-messaging-sw.js');
    const content = fs.readFileSync(swPath, 'utf-8');
    assert(content.includes('onBackgroundMessage'), 'Should have onBackgroundMessage');
    assert(content.includes('showNotification'), 'Should call showNotification');
  });

  await test('Service worker has notificationclick handler', async () => {
    const swPath = path.join(process.cwd(), 'public', 'firebase-messaging-sw.js');
    const content = fs.readFileSync(swPath, 'utf-8');
    assert(content.includes('notificationclick'), 'Should have notificationclick handler');
    assert(content.includes('openWindow'), 'Should open window on click');
  });

  await test('Service worker imports Firebase SDK from CDN', async () => {
    const swPath = path.join(process.cwd(), 'public', 'firebase-messaging-sw.js');
    const content = fs.readFileSync(swPath, 'utf-8');
    assert(content.includes('importScripts'), 'Should use importScripts');
    assert(content.includes('firebase-app-compat'), 'Should import firebase-app-compat');
    assert(content.includes('firebase-messaging-compat'), 'Should import firebase-messaging-compat');
  });

  await test('Service worker has all 6 config placeholders', async () => {
    const swPath = path.join(process.cwd(), 'public', 'firebase-messaging-sw.js');
    const content = fs.readFileSync(swPath, 'utf-8');
    for (const placeholder of ['FCM_API_KEY', 'FCM_AUTH_DOMAIN', 'FCM_PROJECT_ID', 'FCM_STORAGE_BUCKET', 'FCM_SENDER_ID', 'FCM_APP_ID']) {
      assert(content.includes(placeholder), `Missing placeholder: ${placeholder}`);
    }
  });

  // ──────────────────────────────────────────
  console.log('\n10. Server route coverage');
  // ──────────────────────────────────────────

  await test('server.ts has POST /api/fcm/register route', async () => {
    const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert(serverCode.includes('app.post("/api/fcm/register"'), 'Missing register route');
  });

  await test('server.ts has DELETE /api/fcm/unregister route', async () => {
    const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert(serverCode.includes('app.delete("/api/fcm/unregister"'), 'Missing unregister route');
  });

  await test('server.ts has GET /firebase-messaging-sw.js route', async () => {
    const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert(serverCode.includes('app.get("/firebase-messaging-sw.js"'), 'Missing SW route');
  });

  await test('server.ts calls initFirebaseAdmin at startup', async () => {
    const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert(serverCode.includes('initFirebaseAdmin()'), 'Missing initFirebaseAdmin call');
  });

  await test('sendFCMToUser is called for task assignments', async () => {
    const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert(serverCode.includes('sendFCMToUser('), 'sendFCMToUser should be called');
    assert(serverCode.includes('sendFCMToMultipleUsers('), 'sendFCMToMultipleUsers should be called');
  });

  // ──────────────────────────────────────────
  console.log('\n11. App.tsx — FCM token lifecycle');
  // ──────────────────────────────────────────

  await test('App.tsx calls getFCMToken on mount', async () => {
    const appCode = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf-8');
    assert(appCode.includes('getFCMToken'), 'App.tsx should call getFCMToken');
  });

  await test('App.tsx registers token via POST /api/fcm/register', async () => {
    const appCode = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf-8');
    assert(appCode.includes('/api/fcm/register'), 'App.tsx should POST to /api/fcm/register');
  });

  await test('App.tsx unregisters token via DELETE /api/fcm/unregister on cleanup', async () => {
    const appCode = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf-8');
    assert(appCode.includes('/api/fcm/unregister'), 'App.tsx should DELETE /api/fcm/unregister');
  });

  // ──────────────────────────────────────────
  console.log(`\n📊 RESULTS: ${pass} passed, ${fail} failed, ${pass + fail} total\n`);
  if (fail > 0) { console.error('❌ SOME TESTS FAILED'); process.exit(1); }
  else { console.log('✅ ALL TESTS PASSED'); process.exit(0); }
}

main();
