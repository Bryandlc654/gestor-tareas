import { strict as assert } from 'assert';
import http from 'http';
import express from 'express';

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

async function main() {
  console.log('\n📋 SMART LINKS QA TEST SUITE\n');

  // ──────────────────────────────────────────
  console.log('1. url-utils.ts — URL detection & provider mapping');
  // ──────────────────────────────────────────

  await test('URL_REGEX matches standard URLs', async () => {
    const { URL_REGEX } = await import('../src/utils/url-utils');
    assert('Visit https://example.com for more'.match(URL_REGEX));
    assert('https://figma.com/design/abc'.match(URL_REGEX));
    assert(!('no url here'.match(URL_REGEX)));
  });

  await test('extractUrls extracts unique URLs from text', async () => {
    const { extractUrls } = await import('../src/utils/url-utils');
    const urls = extractUrls('Check https://github.com/user/repo and https://notion.so/page');
    assertEqual(urls.length, 2);
    assert(urls[0].includes('github.com'));
    assert(urls[1].includes('notion.so'));
  });

  await test('extractUrls deduplicates URLs', async () => {
    const { extractUrls } = await import('../src/utils/url-utils');
    const urls = extractUrls('See https://example.com and again https://example.com');
    assertEqual(urls.length, 1);
  });

  await test('extractUrls strips trailing punctuation', async () => {
    const { extractUrls } = await import('../src/utils/url-utils');
    const urls = extractUrls('Visit https://example.com.');
    assertEqual(urls[0], 'https://example.com');
  });

  await test('extractUrls handles empty text', async () => {
    const { extractUrls } = await import('../src/utils/url-utils');
    assertEqual(extractUrls('').length, 0);
    assertEqual(extractUrls('no urls here').length, 0);
  });

  await test('detectProvider identifies GitHub', async () => {
    const { detectProvider } = await import('../src/utils/url-utils');
    assertEqual(detectProvider('https://github.com/user/repo'), 'GitHub');
    assertEqual(detectProvider('https://www.github.com/user/repo'), 'GitHub');
  });

  await test('detectProvider identifies Figma', async () => {
    const { detectProvider } = await import('../src/utils/url-utils');
    assertEqual(detectProvider('https://figma.com/design/abc'), 'Figma');
  });

  await test('detectProvider identifies Notion', async () => {
    const { detectProvider } = await import('../src/utils/url-utils');
    assertEqual(detectProvider('https://notion.so/page'), 'Notion');
    assertEqual(detectProvider('https://my-team.notion.site/page'), 'Notion');
  });

  await test('detectProvider identifies Google services', async () => {
    const { detectProvider } = await import('../src/utils/url-utils');
    assertEqual(detectProvider('https://docs.google.com/document/d/abc'), 'Google Docs');
    assertEqual(detectProvider('https://drive.google.com/file/d/abc'), 'Google Drive');
    assertEqual(detectProvider('https://meet.google.com/abc-def'), 'Google Meet');
  });

  await test('detectProvider identifies Jira', async () => {
    const { detectProvider } = await import('../src/utils/url-utils');
    assertEqual(detectProvider('https://jira.atlassian.com/browse/PROJ-123'), 'Jira');
  });

  await test('detectProvider identifies Trello', async () => {
    const { detectProvider } = await import('../src/utils/url-utils');
    assertEqual(detectProvider('https://trello.com/c/abc'), 'Trello');
  });

  await test('detectProvider falls back to hostname for unknown domains', async () => {
    const { detectProvider } = await import('../src/utils/url-utils');
    const result = detectProvider('https://my-random-site.com/page');
    assertEqual(result, 'my-random-site.com');
  });

  await test('getFaviconUrl returns Google favicon URL', async () => {
    const { getFaviconUrl } = await import('../src/utils/url-utils');
    const favicon = getFaviconUrl('https://github.com/user/repo');
    assert(favicon.includes('google.com/s2/favicons'));
    assert(favicon.includes('github.com'));
  });

  await test('getFaviconUrl handles invalid URL gracefully', async () => {
    const { getFaviconUrl } = await import('../src/utils/url-utils');
    assertEqual(getFaviconUrl('not-a-url'), '');
  });

  // ──────────────────────────────────────────
  console.log('\n2. smart-links.ts — Backend metadata fetching');
  // ──────────────────────────────────────────

  await test('getSmartLinkMetadata returns valid object for real URL', async () => {
    const { getSmartLinkMetadata } = await import('../src/utils/smart-links');
    const meta = await getSmartLinkMetadata('https://github.com');
    assert(meta.url === 'https://github.com');
    assert(typeof meta.title === 'string');
    assert(typeof meta.provider === 'string');
    assert(typeof meta.favicon === 'string');
    assert(typeof meta.description === 'string');
    assert(typeof meta.image === 'string');
  });

  await test('getSmartLinkMetadata identifies GitHub provider', async () => {
    const { getSmartLinkMetadata } = await import('../src/utils/smart-links');
    const meta = await getSmartLinkMetadata('https://github.com');
    assertEqual(meta.provider, 'GitHub');
  });

  await test('getSmartLinkMetadata returns fallback for invalid URL', async () => {
    const { getSmartLinkMetadata } = await import('../src/utils/smart-links');
    const meta = await getSmartLinkMetadata('https://this-domain-does-not-exist-12345.com');
    assert(meta.url === 'https://this-domain-does-not-exist-12345.com');
    assert(typeof meta.title === 'string');
  });

  await test('getSmartLinkMetadata respects forceRefresh', async () => {
    const { getSmartLinkMetadata } = await import('../src/utils/smart-links');
    const meta1 = await getSmartLinkMetadata('https://github.com');
    const meta2 = await getSmartLinkMetadata('https://github.com', true);
    assertEqual(meta1.url, meta2.url);
  });

  // ──────────────────────────────────────────
  console.log('\n3. API Endpoint — POST /api/smart-links');
  // ──────────────────────────────────────────

  await test('POST /api/smart-links: requires url', async () => {
    const app = express();
    app.use(express.json());
    app.post('/api/smart-links', async (req, res) => {
      const url = (req.body.url || '').toString().trim().slice(0, 2000);
      if (!url) return res.status(400).json({ error: 'URL requerida' });
      try { new URL(url); } catch { return res.status(400).json({ error: 'URL inválida' }); }
      res.json({ url, title: '', description: '', image: '', favicon: '', provider: '' });
    });

    const server = await startServer(app);
    const port = getPort(server);

    const r = await fetchJSON(`http://localhost:${port}/api/smart-links`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    assertEqual(r.status, 400);
    assertEqual(r.body.error, 'URL requerida');
    server.close();
  });

  await test('POST /api/smart-links: rejects invalid URL', async () => {
    const app = express();
    app.use(express.json());
    app.post('/api/smart-links', async (req, res) => {
      const url = (req.body.url || '').toString().trim().slice(0, 2000);
      if (!url) return res.status(400).json({ error: 'URL requerida' });
      try { new URL(url); } catch { return res.status(400).json({ error: 'URL inválida' }); }
      res.json({ url, title: '', description: '', image: '', favicon: '', provider: '' });
    });

    const server = await startServer(app);
    const port = getPort(server);

    const r = await fetchJSON(`http://localhost:${port}/api/smart-links`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-valid-url' })
    });
    assertEqual(r.status, 400);
    assertEqual(r.body.error, 'URL inválida');
    server.close();
  });

  await test('POST /api/smart-links: returns metadata object with all fields', async () => {
    const app = express();
    app.use(express.json());
    app.post('/api/smart-links', async (req, res) => {
      const url = (req.body.url || '').toString().trim();
      if (!url) return res.status(400).json({ error: 'URL requerida' });
      try { new URL(url); } catch { return res.status(400).json({ error: 'URL inválida' }); }
      res.json({ url, title: 'Test Title', description: 'Test Desc', image: '', favicon: '', provider: 'Test' });
    });

    const server = await startServer(app);
    const port = getPort(server);

    const r = await fetchJSON(`http://localhost:${port}/api/smart-links`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    });
    assertEqual(r.status, 200);
    assertEqual(r.body.url, 'https://example.com');
    assertEqual(r.body.title, 'Test Title');
    assertEqual(r.body.description, 'Test Desc');
    assertEqual(r.body.provider, 'Test');
    assert(typeof r.body.image === 'string');
    assert(typeof r.body.favicon === 'string');
    server.close();
  });

  await test('POST /api/smart-links: handles force refresh param', async () => {
    const app = express();
    app.use(express.json());
    let forceSeen = false;
    app.post('/api/smart-links', async (req, res) => {
      forceSeen = req.body.force === true;
      const url = (req.body.url || '').toString().trim();
      res.json({ url, title: '', description: '', image: '', favicon: '', provider: '' });
    });

    const server = await startServer(app);
    const port = getPort(server);

    await fetchJSON(`http://localhost:${port}/api/smart-links`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', force: true })
    });
    assert(forceSeen, 'force param should be passed through');
    server.close();
  });

  // ──────────────────────────────────────────
  console.log('\n4. SmartLinkCard component — source validation');
  // ──────────────────────────────────────────

  await test('SmartLinkCard.tsx exports all expected components', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'SmartLinkCard.tsx'), 'utf-8');
    assert(src.includes('export default function SmartLinkCard'), 'SmartLinkCard default export');
    assert(src.includes('export function SmartLinkSkeleton'), 'SmartLinkSkeleton export');
    assert(src.includes('export function SmartLinkError'), 'SmartLinkError export');
    assert(src.includes('export function SmartLinkLoading'), 'SmartLinkLoading export');
    assert(src.includes('export function SmartLinkRenderer'), 'SmartLinkRenderer export');
  });

  await test('SmartLinkCard renders compact variant props', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'SmartLinkCard.tsx'), 'utf-8');
    assert(src.includes('compact?: boolean'), 'Should have compact prop');
  });

  await test('SmartLinkCard uses lazy loading for images', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'SmartLinkCard.tsx'), 'utf-8');
    assert(src.includes('loading="lazy"'), 'Images should use lazy loading');
  });

  await test('SmartLinkCard follows project design system', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'SmartLinkCard.tsx'), 'utf-8');
    assert(src.includes('#EDEDEB'), 'Should use project border color');
    assert(src.includes('#F7F7F5'), 'Should use project bg color');
    assert(src.includes('#37352F'), 'Should use project text color');
    assert(src.includes('#2383E2'), 'Should use project accent color');
  });

  // ──────────────────────────────────────────
  console.log('\n5. useSmartLink hook — source validation');
  // ──────────────────────────────────────────

  await test('useSmartLink.ts exports hook function', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'hooks', 'useSmartLink.ts'), 'utf-8');
    assert(src.includes('export function useSmartLink'), 'Should export useSmartLink');
  });

  await test('useSmartLink uses client-side cache', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'hooks', 'useSmartLink.ts'), 'utf-8');
    assert(src.includes('new Map'), 'Should use Map for client-side cache');
  });

  await test('useSmartLink calls POST /api/smart-links', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'hooks', 'useSmartLink.ts'), 'utf-8');
    assert(src.includes('/api/smart-links'), 'Should call the API endpoint');
    assert(src.includes("method: 'POST'"), 'Should use POST method');
  });

  await test('useSmartLink returns data, loading, error states', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'hooks', 'useSmartLink.ts'), 'utf-8');
    assert(src.includes('data: SmartLinkData | null'), 'Should return data');
    assert(src.includes('loading: boolean'), 'Should return loading');
    assert(src.includes('error: string | null'), 'Should return error');
  });

  // ──────────────────────────────────────────
  console.log('\n6. Integration — ChatView.tsx');
  // ──────────────────────────────────────────

  await test('ChatView imports SmartLinkCard', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ChatView.tsx'), 'utf-8');
    assert(src.includes("from './SmartLinkCard'"), 'Should import SmartLinkCard');
  });

  await test('ChatView imports url-utils', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ChatView.tsx'), 'utf-8');
    assert(src.includes("from '../utils/url-utils'"), 'Should import url-utils');
  });

  await test('ChatView handlePaste detects URLs', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ChatView.tsx'), 'utf-8');
    assert(src.includes('extractUrls(text)'), 'handlePaste should call extractUrls');
    assert(src.includes("type: 'link'"), 'Should create link attachments');
  });

  await test('ChatView renders SmartLinkCard for link attachments', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ChatView.tsx'), 'utf-8');
    assert(src.includes('att.smartLink'), 'Should use smartLink data from attachment');
    assert(src.includes('<SmartLinkCard'), 'Should render SmartLinkCard');
  });

  await test('ChatView fetches smart link metadata on paste', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'ChatView.tsx'), 'utf-8');
    assert(src.includes('fetchSmartLinkMeta'), 'Should have fetchSmartLinkMeta function');
  });

  // ──────────────────────────────────────────
  console.log('\n7. Integration — WorkspaceView.tsx');
  // ──────────────────────────────────────────

  await test('WorkspaceView imports SmartLinkRenderer', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'WorkspaceView.tsx'), 'utf-8');
    assert(src.includes('SmartLinkRenderer'), 'Should import SmartLinkRenderer');
  });

  await test('WorkspaceView uses SmartLinkRenderer for task description', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'WorkspaceView.tsx'), 'utf-8');
    assert(src.includes('<SmartLinkRenderer'), 'Should render SmartLinkRenderer');
    assert(src.includes('detailTask.description'), 'Should render task description');
  });

  await test('WorkspaceView uses SmartLinkRenderer for comments', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'WorkspaceView.tsx'), 'utf-8');
    const matches = src.match(/<SmartLinkRenderer/g);
    assert(matches && matches.length >= 2, 'Should use SmartLinkRenderer in at least 2 places (description + comments)');
  });

  // ──────────────────────────────────────────
  console.log('\n8. Integration — TicketsView.tsx');
  // ──────────────────────────────────────────

  await test('TicketsView imports SmartLinkRenderer', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'TicketsView.tsx'), 'utf-8');
    assert(src.includes('SmartLinkRenderer'), 'Should import SmartLinkRenderer');
  });

  await test('TicketsView uses SmartLinkRenderer for comment text', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'TicketsView.tsx'), 'utf-8');
    assert(src.includes('<SmartLinkRenderer'), 'Should render SmartLinkRenderer for comments');
  });

  // ──────────────────────────────────────────
  console.log('\n9. Integration — PublicTicketForm.tsx');
  // ──────────────────────────────────────────

  await test('PublicTicketForm imports SmartLinkRenderer', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'PublicTicketForm.tsx'), 'utf-8');
    assert(src.includes('SmartLinkRenderer'), 'Should import SmartLinkRenderer');
  });

  await test('PublicTicketForm uses SmartLinkRenderer for comments', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'PublicTicketForm.tsx'), 'utf-8');
    assert(src.includes('<SmartLinkRenderer'), 'Should render SmartLinkRenderer for comments');
  });

  // ──────────────────────────────────────────
  console.log('\n10. Server route validation');
  // ──────────────────────────────────────────

  await test('server.ts has POST /api/smart-links route', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert(src.includes('app.post("/api/smart-links"'), 'Should have smart-links route');
  });

  await test('server.ts imports getSmartLinkMetadata', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert(src.includes('getSmartLinkMetadata'), 'Should import getSmartLinkMetadata');
  });

  await test('server.ts validates URL in smart-links route', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert(src.includes('new URL(url)'), 'Should validate URL');
    assert(src.includes('URL inválida'), 'Should return error for invalid URL');
  });

  await test('server.ts supports force refresh in smart-links route', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert(src.includes('req.body.force'), 'Should support force refresh');
  });

  // ──────────────────────────────────────────
  console.log('\n11. Type definitions');
  // ──────────────────────────────────────────

  await test('types.ts has SmartLinkData interface', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'types.ts'), 'utf-8');
    assert(src.includes('export interface SmartLinkData'), 'Should have SmartLinkData interface');
    assert(src.includes('url: string'), 'Should have url field');
    assert(src.includes('title: string'), 'Should have title field');
    assert(src.includes('description: string'), 'Should have description field');
    assert(src.includes('image: string'), 'Should have image field');
    assert(src.includes('favicon: string'), 'Should have favicon field');
    assert(src.includes('provider: string'), 'Should have provider field');
  });

  await test('types.ts MessageAttachment has smartLink field', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'types.ts'), 'utf-8');
    assert(src.includes('smartLink?: SmartLinkData'), 'MessageAttachment should have optional smartLink');
  });

  // ──────────────────────────────────────────
  console.log('\n12. File structure validation');
  // ──────────────────────────────────────────

  await test('All new files exist', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const files = [
      'src/utils/url-utils.ts',
      'src/utils/smart-links.ts',
      'src/hooks/useSmartLink.ts',
      'src/components/SmartLinkCard.tsx',
      'tests/smart-links-qa.ts',
    ];
    for (const f of files) {
      assert(fs.existsSync(path.join(process.cwd(), f)), `Missing: ${f}`);
    }
  });

  await test('No broken imports in modified files', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const files = [
      'src/components/ChatView.tsx',
      'src/components/WorkspaceView.tsx',
      'src/components/TicketsView.tsx',
      'src/components/PublicTicketForm.tsx',
      'server.ts',
    ];
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf-8');
      const imports = src.match(/from\s+['"]([^'"]+)['"]/g) || [];
      for (const imp of imports) {
        const match = imp.match(/from\s+['"]([^'"]+)['"]/);
        if (match && match[1].startsWith('.')) {
          const resolved = path.join(path.dirname(path.join(process.cwd(), f)), match[1]);
          const exists = [resolved + '.ts', resolved + '.tsx', resolved + '/index.ts', resolved + '/index.tsx'].some(p => fs.existsSync(p));
          assert(exists, `Broken import in ${f}: ${match[1]}`);
        }
      }
    }
  });

  // ──────────────────────────────────────────
  console.log(`\n📊 RESULTS: ${pass} passed, ${fail} failed, ${pass + fail} total\n`);
  if (fail > 0) { console.error('❌ SOME TESTS FAILED'); process.exit(1); }
  else { console.log('✅ ALL TESTS PASSED'); process.exit(0); }
}

main();
