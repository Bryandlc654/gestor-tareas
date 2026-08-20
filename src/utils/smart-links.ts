import { cacheGet, cacheSet } from '../db/redis';
import { detectProvider, getFaviconUrl } from './url-utils';
import type { SmartLinkData } from '../types';

const OG_TTL = 3600;
const API_TTL = 900;
const FETCH_TIMEOUT = 5000;
const USER_AGENT = 'Mozilla/5.0 (compatible; SmartLinkBot/1.0)';

function extractMeta(html: string, patterns: (string | RegExp)[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function resolveUrl(base: string, relative: string): string {
  if (!relative) return '';
  if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

async function fetchOpenGraphMetadata(url: string): Promise<SmartLinkData> {
  const provider = detectProvider(url);
  const favicon = getFaviconUrl(url);
  const fallback: SmartLinkData = {
    url, title: provider || new URL(url).hostname, description: '', image: '', favicon, provider,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) return fallback;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return fallback;

    const html = await res.text();
    const head = html.slice(0, html.indexOf('</head>') > -1 ? html.indexOf('</head>') : 50000);

    const title = extractMeta(head, [
      /<meta\s+property="og:title"\s+content="([^"]*)"/i,
      /<meta\s+content="([^"]*)"\s+property="og:title"/i,
      /<meta\s+name="twitter:title"\s+content="([^"]*)"/i,
      /<title>([^<]*)<\/title>/i,
    ]);

    const description = extractMeta(head, [
      /<meta\s+property="og:description"\s+content="([^"]*)"/i,
      /<meta\s+content="([^"]*)"\s+property="og:description"/i,
      /<meta\s+name="description"\s+content="([^"]*)"/i,
      /<meta\s+name="twitter:description"\s+content="([^"]*)"/i,
    ]);

    const image = extractMeta(head, [
      /<meta\s+property="og:image"\s+content="([^"]*)"/i,
      /<meta\s+content="([^"]*)"\s+property="og:image"/i,
      /<meta\s+name="twitter:image"\s+content="([^"]*)"/i,
    ]);

    return {
      url,
      title: title || fallback.title,
      description: description || '',
      image: resolveUrl(url, image),
      favicon: extractMeta(head, [
        /<link\s+rel="icon"\s+href="([^"]*)"/i,
        /<link\s+rel="shortcut icon"\s+href="([^"]*)"/i,
        /<link\s+href="([^"]*)"\s+rel="icon"/i,
      ]) ? resolveUrl(url, extractMeta(head, [
        /<link\s+rel="icon"\s+href="([^"]*)"/i,
        /<link\s+rel="shortcut icon"\s+href="([^"]*)"/i,
        /<link\s+href="([^"]*)"\s+rel="icon"/i,
      ])) : favicon,
      provider,
    };
  } catch {
    return fallback;
  }
}

export async function getSmartLinkMetadata(url: string, forceRefresh = false): Promise<SmartLinkData> {
  const cacheKey = `smart-link:${url}`;

  if (!forceRefresh) {
    const cached = await cacheGet<SmartLinkData>(cacheKey);
    if (cached) return cached;
  }

  const metadata = await fetchOpenGraphMetadata(url);
  const provider = detectProvider(url);
  const isKnownProvider = provider !== new URL(url).hostname.replace(/^www\./, '');
  const ttl = isKnownProvider ? API_TTL : OG_TTL;
  await cacheSet(cacheKey, metadata, ttl);
  return metadata;
}
