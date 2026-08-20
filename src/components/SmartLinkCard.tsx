import React, { useState, useEffect } from 'react';
import { ExternalLink, Link as LinkIcon, Loader2, AlertCircle } from 'lucide-react';
import type { SmartLinkData } from '../types';

interface SmartLinkCardProps {
  data: SmartLinkData;
  compact?: boolean;
}

export default function SmartLinkCard({ data, compact = false }: SmartLinkCardProps) {
  const [imgError, setImgError] = useState(false);

  if (compact) {
    return (
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 bg-[#F7F7F5] border border-[#EDEDEB] rounded-lg hover:bg-white hover:shadow-sm transition-all group no-underline"
      >
        {data.favicon ? (
          <img src={data.favicon} alt="" className="w-4 h-4 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <LinkIcon className="w-4 h-4 shrink-0 text-[#91918E]" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-[#37352F] truncate">{data.title || data.url}</div>
          <div className="text-[10px] text-[#91918E] truncate">{data.provider}</div>
        </div>
        <ExternalLink className="w-3 h-3 shrink-0 text-[#91918E] group-hover:text-[#2383E2] transition-colors" />
      </a>
    );
  }

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-[#EDEDEB] rounded-lg overflow-hidden bg-[#F7F7F5] hover:bg-white hover:shadow-sm transition-all group no-underline"
    >
      {data.image && !imgError && (
        <img
          src={data.image}
          alt={data.title}
          loading="lazy"
          className="w-full h-32 object-cover border-b border-[#EDEDEB]"
          onError={() => setImgError(true)}
        />
      )}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          {data.favicon ? (
            <img src={data.favicon} alt="" className="w-4 h-4 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <LinkIcon className="w-4 h-4 shrink-0 text-[#91918E]" />
          )}
          <span className="text-[11px] font-medium text-[#5A5A57]">{data.provider}</span>
          <span className="text-[10px] text-[#91918E] ml-auto truncate max-w-[120px]">{new URL(data.url).hostname}</span>
        </div>
        <div className="text-sm font-medium text-[#37352F] leading-snug line-clamp-2">{data.title || data.url}</div>
        {data.description && (
          <div className="text-xs text-[#5A5A57] mt-1 leading-relaxed line-clamp-2">{data.description}</div>
        )}
      </div>
    </a>
  );
}

export function SmartLinkSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-[#F7F7F5] border border-[#EDEDEB] rounded-lg animate-pulse">
        <div className="w-4 h-4 bg-[#EDEDEB] rounded" />
        <div className="flex-1">
          <div className="h-3 bg-[#EDEDEB] rounded w-3/4 mb-1" />
          <div className="h-2 bg-[#EDEDEB] rounded w-1/2" />
        </div>
      </div>
    );
  }
  return (
    <div className="border border-[#EDEDEB] rounded-lg overflow-hidden bg-[#F7F7F5] animate-pulse">
      <div className="h-32 bg-[#EDEDEB]" />
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#EDEDEB] rounded" />
          <div className="h-2 bg-[#EDEDEB] rounded w-16" />
        </div>
        <div className="h-4 bg-[#EDEDEB] rounded w-3/4" />
        <div className="h-3 bg-[#EDEDEB] rounded w-full" />
      </div>
    </div>
  );
}

export function SmartLinkError({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[#2383E2] underline hover:text-blue-700 text-xs"
    >
      <AlertCircle className="w-3 h-3" />
      {url}
    </a>
  );
}

export function SmartLinkLoading({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-[#F7F7F5] border border-[#EDEDEB] rounded-lg">
        <Loader2 className="w-4 h-4 text-[#91918E] animate-spin" />
        <span className="text-[11px] text-[#91918E]">Cargando vista previa...</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center p-6 border border-[#EDEDEB] rounded-lg bg-[#F7F7F5]">
      <Loader2 className="w-5 h-5 text-[#91918E] animate-spin mr-2" />
      <span className="text-xs text-[#91918E]">Cargando vista previa...</span>
    </div>
  );
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

function SmartLinkInline({ url }: { url: string }) {
  const [data, setData] = useState<SmartLinkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/smart-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(meta => { if (!cancelled) { setData(meta); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return <SmartLinkLoading compact />;
  if (!data) return <SmartLinkError url={url} />;
  return <SmartLinkCard data={data} compact />;
}

export function SmartLinkRenderer({ text, className = '' }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  const regex = new RegExp(URL_RE.source, 'gi');

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<React.Fragment key={key++}>{text.slice(lastIndex, match.index)}</React.Fragment>);
    }
    const url = match[0].replace(/[.,;:!?)\]]+$/, '');
    parts.push(
      <div key={key++} className="my-2 max-w-sm">
        <SmartLinkInline url={url} />
      </div>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<React.Fragment key={key++}>{text.slice(lastIndex)}</React.Fragment>);
  }

  if (parts.length === 0) return <span className={className}>{text}</span>;
  return <span className={className}>{parts}</span>;
}
