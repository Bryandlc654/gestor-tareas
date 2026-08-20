import { useState, useEffect } from 'react';
import type { SmartLinkData } from '../types';

const cache = new Map<string, SmartLinkData>();

export function useSmartLink(url: string | null): {
  data: SmartLinkData | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<SmartLinkData | null>(() => url ? cache.get(url) || null : null);
  const [loading, setLoading] = useState<boolean>(!!url && !cache.has(url));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) { setData(null); setLoading(false); return; }
    const cached = cache.get(url);
    if (cached) { setData(cached); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/smart-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((meta: SmartLinkData) => {
        if (cancelled) return;
        cache.set(url, meta);
        setData(meta);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}
