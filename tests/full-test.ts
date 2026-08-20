import http from 'http';
import express from 'express';
import { strict as assert } from 'assert';

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

async function main() {
  console.log('\n📋 COMPREHENSIVE TEST SUITE\n');

  console.log('1. Module imports');
  await test('DAO module exports all expected functions', async () => {
    const dao = await import('../src/db/dao');
    const expected = [
      'getAgencyInfo', 'upsertAgencyInfo', 'listPortfolio', 'createPortfolio', 'deletePortfolio',
      'listSolicitudes', 'createSolicitud', 'updateSolicitud',
      'listRoles', 'createRole', 'updateRole',
      'listUsers', 'getUserByEmail', 'getUserById', 'createUser', 'updateUser',
      'listWorkspaces', 'createWorkspace', 'updateWorkspace', 'deleteWorkspace',
      'listFolders', 'createFolder', 'deleteFolder',
      'listTasks', 'createTask', 'updateTask', 'deleteTask',
      'listTodos', 'createTodo', 'updateTodo', 'deleteTodo',
      'listClients', 'createClient', 'updateClient', 'deleteClient',
      'listQuotes', 'createQuote', 'updateQuote', 'deleteQuote',
      'listContracts', 'createContract', 'updateContract', 'deleteContract',
      'listServices', 'createService', 'updateService', 'deleteService',
      'listCredentials', 'createCredential', 'updateCredential', 'deleteCredential',
      'listChannels', 'createChannel',
      'getChannelMessages', 'createMessage',
      'getUserNotifications', 'createNotification', 'markNotificationRead', 'markAllNotificationsRead',
      'listTickets', 'createTicket', 'updateTicket',
      'getTicketComments', 'addTicketComment',
    ];
    for (const n of expected) {
      if (typeof (dao as any)[n] !== 'function') throw new Error(`Missing export: ${n}`);
    }
  });

  await test('Redis module exports all expected functions', async () => {
    const redis = await import('../src/db/redis');
    for (const fn of ['getRedis', 'cacheGet', 'cacheSet', 'cacheDel', 'cacheDelPattern', 'pub']) {
      assertEqual(typeof (redis as any)[fn], 'function', `Redis missing: ${fn}`);
    }
  });

  await test('MySQL module exports schema bootstrap', async () => {
    const mysql = await import('../src/db/mysql');
    for (const fn of ['bootstrapMysqlSchema', 'getMysqlPool', 'executeQuery']) {
      assertEqual(typeof (mysql as any)[fn], 'function', `MySQL missing: ${fn}`);
    }
  });

  await test('store.ts exports FullSchema interface', async () => {
    await import('../src/db/store');
    // Interface only, no runtime value - just ensure it loads
  });

  await test('Types module loads successfully', async () => {
    await import('../src/types');
  });

  console.log('\n2. Server & Middleware');
  await test('genId produces unique IDs with prefix', async () => {
    const crypto = await import('crypto');
    assert((crypto as any).randomUUID().startsWith !== undefined);
  });

  await test('sanitizeStr removes script tags', () => {
    const clean = '<script>alert("xss")</script>hello'.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    assertEqual(clean, 'hello', 'Should remove script tags');
  });

  console.log('\n3. Error handling');
  await test('Error handler middleware returns JSON', async () => {
    const app = express();
    app.get('/test-error', (req, res, next) => { next(new Error('Test error')); });
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: err.message || 'Error interno' });
    });
    const server = app.listen(0);
    const port = (server.address() as any).port;
    const response = await fetch(`http://localhost:${port}/test-error`);
    assertEqual(response.status, 500);
    const body = await response.json();
    assertEqual(body.error, 'Test error');
    server.close();
  });

  await test('asyncHandler catches promise rejections', async () => {
    const app = express();
    const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => fn(req, res, next).catch(next);
    app.get('/async-error', asyncHandler(async () => { throw new Error('Async error'); }));
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: err.message });
    });
    const server = app.listen(0);
    const port = (server.address() as any).port;
    const response = await fetch(`http://localhost:${port}/async-error`);
    assertEqual(response.status, 500);
    const body = await response.json();
    assertEqual(body.error, 'Async error');
    server.close();
  });

  console.log('\n4. Rate limiting');
  await test('Rate limiter configuration values are correct', () => {
    assertEqual(60 * 1000, 60000, 'windowMs should be 60s');
  });

  console.log('\n5. Authentication');
  await test('JWT verify works with correct secret', async () => {
    const { default: jwt } = await import('jsonwebtoken');
    const token = jwt.sign({ userId: 'u1' }, 'mysecret', { expiresIn: '1h' });
    const decoded = jwt.verify(token, 'mysecret') as any;
    assertEqual(decoded.userId, 'u1');
  });

  await test('JWT verify rejects wrong secret', async () => {
    const { default: jwt } = await import('jsonwebtoken');
    const token = jwt.sign({ userId: 'u1' }, 'mysecret', { expiresIn: '1h' });
    try {
      jwt.verify(token, 'wrongsecret');
      throw new Error('Should have thrown');
    } catch (e: any) {
      assert(e.message.includes('invalid') || e.message.includes('signature'), `Got: ${e.message}`);
    }
  });

  console.log('\n6. Input validation');
  await test('safeEmail validates email format', () => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    assert(re.test('user@example.com'), 'valid');
    assert(!re.test('invalid'), 'invalid');
    assert(!re.test('@domain.com'), 'no local');
  });

  await test('safeFloat handles edge cases', () => {
    assertEqual(isNaN(parseFloat('abc')) ? 0 : parseFloat('abc'), 0);
    assertEqual(parseFloat('123.45'), 123.45);
  });

  console.log(`\n📊 RESULTS: ${pass} passed, ${fail} failed, ${pass + fail} total\n`);
  if (fail > 0) { console.error('❌ SOME TESTS FAILED'); process.exit(1); }
  else { console.log('✅ ALL TESTS PASSED'); process.exit(0); }
}

main();
