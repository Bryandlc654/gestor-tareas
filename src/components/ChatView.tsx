import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, Plus, Lock, Hash, Star, User, 
  Sparkles, HelpCircle, AlertCircle, RefreshCw, Paperclip, 
  FileText, Image as ImageIcon, Link, X, Pencil, Trash2
} from 'lucide-react';
import { ChatChannel, ChatMessage, MessageAttachment, User as DBUser, SmartLinkData } from '../types';
import UserAvatar from './UserAvatar';
import SmartLinkCard, { SmartLinkLoading, SmartLinkError } from './SmartLinkCard';
import { URL_REGEX, extractUrls } from '../utils/url-utils';

interface ChatViewProps {
  channels: ChatChannel[];
  messages: ChatMessage[];
  users: DBUser[];
  activeUserId: string;
  onAddChannel: (c: { name: string; description: string; type: 'public' | 'private' }) => Promise<any>;
  onSendMessage: (channelId: string, userId: string, text: string, attachments?: MessageAttachment[]) => Promise<any>;
  onRefreshMessages: (channelId: string) => void;
  onUpdateChannel?: (id: string, chan: Partial<ChatChannel>) => Promise<any>;
  onDeleteChannel?: (id: string) => Promise<any>;
  onDeleteMessage?: (id: string) => Promise<any>;
}

export default function ChatView({
  channels, messages, users, activeUserId,
  onAddChannel, onSendMessage, onRefreshMessages,
  onUpdateChannel, onDeleteChannel, onDeleteMessage
}: ChatViewProps) {
  const [activeChannelId, setActiveChannelId] = useState<string>(channels[0]?.id || '');
  const [typedMessage, setTypedMessage] = useState('');
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [newChanName, setNewChanName] = useState('');
  const [newChanDesc, setNewChanDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editChanName, setEditChanName] = useState('');
  const [confirmDeleteChannelId, setConfirmDeleteChannelId] = useState<string | null>(null);
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<string | null>(null);
  const [mobileShowChannels, setMobileShowChannels] = useState(true);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);

  // Fetch messages when channel changes
  useEffect(() => {
    if (!activeChannelId) return;
    onRefreshMessages(activeChannelId);
  }, [activeChannelId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    const container = document.getElementById('chat-messages-viewport');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, activeChannelId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!typedMessage.trim() && pendingAttachments.length === 0) || !activeChannelId || isSendingRef.current) return;
    isSendingRef.current = true;
    setIsSending(true);
    try {
      await onSendMessage(activeChannelId, activeUserId, typedMessage.trim(), pendingAttachments.length > 0 ? pendingAttachments : undefined);
      setTypedMessage('');
      setPendingAttachments([]);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions) {
      const filtered = users.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 8);
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(prev => Math.min(prev + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(prev => Math.max(prev - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (filtered[mentionIndex]) selectMention(filtered[mentionIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setShowMentions(false); return; }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setTypedMessage(value);
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (/\s/.test(charBefore)) {
        const afterAt = textBeforeCursor.slice(lastAtIndex + 1);
        if (!afterAt.includes(' ')) {
          setMentionQuery(afterAt);
          setMentionStart(lastAtIndex);
          setShowMentions(true);
          setMentionIndex(0);
          return;
        }
      }
    }
    setShowMentions(false);
  };

  const selectMention = (user: DBUser) => {
    if (mentionStart === -1) return;
    const before = typedMessage.slice(0, mentionStart);
    const after = typedMessage.slice(mentionStart + 1 + mentionQuery.length);
    const insertText = '@' + user.name + ' ';
    setTypedMessage(before + insertText + after);
    setShowMentions(false);
    const newCursorPos = before.length + insertText.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        setPendingAttachments(prev => [...prev, {
          type: 'image',
          url: dataUrl,
          name: file.name || 'pegado.png',
          size: file.size
        }]);
        return;
      }
    }
    const text = e.clipboardData.getData('text/plain');
    const urls = extractUrls(text);
    if (urls.length === 1 && text.trim() === urls[0]) {
      e.preventDefault();
      const url = urls[0];
      setPendingAttachments(prev => [...prev, { type: 'link', url, name: url }]);
      fetchSmartLinkMeta(url).then(meta => {
        if (meta) {
          setPendingAttachments(prev => prev.map(a => a.url === url && a.type === 'link' ? { ...a, name: meta.title || url, smartLink: meta } : a));
        }
      });
    }
  };

  const fetchSmartLinkMeta = async (url: string): Promise<SmartLinkData | null> => {
    try {
      const res = await fetch('/api/smart-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (res.ok) return res.json();
    } catch {}
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      setPendingAttachments(prev => [...prev, {
        type: isImage ? 'image' : 'file',
        url: dataUrl,
        name: file.name,
        size: file.size
      }]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const downloadFile = (att: MessageAttachment) => {
    const a = document.createElement('a');
    a.href = att.url;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openPreview = (att: MessageAttachment) => {
    if (att.type === 'image' || att.name.toLowerCase().endsWith('.pdf')) {
      setPreviewUrl(att.url);
      setPreviewType(att.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
    }
  };

  const renderTextWithLinks = (text: string) => {
    const combinedRegex = /(https?:\/\/[^\s<]+)|@[\p{L}\p{M}]+/gu;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = combinedRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<React.Fragment key={key++}>{text.slice(lastIndex, match.index)}</React.Fragment>);
      }
      const matched = match[0];
      if (matched.startsWith('http')) {
        parts.push(<a key={key++} href={matched} target="_blank" rel="noopener noreferrer" className="text-[#2383E2] underline hover:text-blue-700">{matched}</a>);
      } else {
        parts.push(<span key={key++} className="text-[#2383E2] font-medium bg-blue-50 px-0.5 rounded">{matched}</span>);
      }
      lastIndex = match.index + matched.length;
    }
    if (lastIndex < text.length) {
      parts.push(<React.Fragment key={key++}>{text.slice(lastIndex)}</React.Fragment>);
    }
    return parts.length > 0 ? parts : text;
  };

  const handleChannelCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName.trim()) return;
    const added = await onAddChannel({
      name: newChanName,
      description: newChanDesc,
      type: isPrivate ? 'private' : 'public'
    });
    if (added) {
      setActiveChannelId(added.id);
    }
    setNewChanName('');
    setNewChanDesc('');
    setIsPrivate(false);
    setShowChannelModal(false);
  };

  const filteredUsers = mentionQuery
    ? users.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 8)
    : users.slice(0, 8);

  const activeChannel = channels.find(c => c.id === activeChannelId);
  const activeUser = users.find(u => u.id === activeUserId);

  return (
    <div className="border border-[#EDEDEB] bg-white rounded h-[calc(100vh-16rem)] min-h-[400px] lg:h-[550px] flex flex-col lg:grid lg:grid-cols-4 overflow-hidden shadow-xs text-[#37352F] text-xs font-sans" id="chat-hub-layout">
      {/* LEFT COLUMN: Channels sidebar */}
      <div className={`lg:col-span-1 border-r border-[#EDEDEB] bg-[#F7F7F5] p-4 flex flex-col justify-between h-full ${mobileShowChannels ? 'block' : 'hidden'} lg:flex`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#91918E] uppercase tracking-wider flex items-center gap-1 font-mono">
              Canales Integrados <Star className="w-2.5 h-2.5 text-[#91918E]" />
            </span>
            <button
              onClick={() => setShowChannelModal(true)}
              className="p-1 hover:bg-[#EDEDEB] border border-[#EDEDEB] rounded text-[#5A5A57] hover:text-[#37352F] transition-all cursor-pointer"
              title="Añadir canal"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-0.5 overflow-y-auto max-h-[380px]" id="chat-channels-list">
            {channels.map(chan => {
              const isActive = chan.id === activeChannelId;
              return (
                <div key={chan.id} className="group relative">
                  <button
                    onClick={() => { setActiveChannelId(chan.id); setMobileShowChannels(false); }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-[#EDEDEB] text-[#37352F] font-semibold' 
                        : 'text-[#5A5A57] hover:bg-[#EDEDEB]/50 hover:text-[#37352F]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {chan.type === 'private' ? (
                        <Lock className="w-3 h-3 text-[#91918E] shrink-0" />
                      ) : (
                        <Hash className={`w-3.5 h-3.5 ${isActive ? 'text-[#37352F]' : 'text-[#91918E]'} shrink-0`} />
                      )}
                      <span className="truncate">{chan.name}</span>
                    </div>
                  </button>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-[#EDEDEB] rounded px-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingChannelId(chan.id); setEditChanName(chan.name); }}
                      className="p-0.5 text-[#5A5A57] hover:text-[#2383E2] transition-colors cursor-pointer"
                      title="Renombrar canal"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteChannelId(chan.id); }}
                      className="p-0.5 text-[#5A5A57] hover:text-red-500 transition-colors cursor-pointer"
                      title="Eliminar canal"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {editingChannelId === chan.id && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border border-[#EDEDEB] rounded p-2 shadow-md" onClick={e => e.stopPropagation()}>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (editChanName.trim() && onUpdateChannel) {
                          await onUpdateChannel(chan.id, { name: editChanName.trim() });
                        }
                        setEditingChannelId(null);
                      }}>
                        <input
                          type="text"
                          value={editChanName}
                          onChange={e => setEditChanName(e.target.value)}
                          className="w-full px-2 py-1 border border-[#EDEDEB] rounded text-xs focus:outline-none focus:border-[#37352F]"
                          autoFocus
                        />
                        <div className="flex justify-end gap-1 mt-1.5">
                          <button type="button" onClick={() => setEditingChannelId(null)} className="px-2 py-0.5 text-[10px] text-[#5A5A57] hover:bg-[#F7F7F5] rounded cursor-pointer">Cancelar</button>
                          <button type="submit" className="px-2 py-0.5 text-[10px] bg-[#37352F] text-white rounded cursor-pointer">Guardar</button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic chat connection banner */}
        <div className="p-3 bg-white border border-[#EDEDEB] rounded text-[10px] text-[#5A5A57] space-y-1">
          <div className="flex items-center gap-1.5 text-[#37352F] font-semibold uppercase tracking-wider text-[9px] font-mono">
            <span className="w-1.5 h-1.5 bg-[#37352F] rounded-full animate-pulse"></span>
            <span>Canal Sincronizado</span>
          </div>
          <p className="leading-tight text-[#91918E]">Mensajes persistidos en base de datos relacional.</p>
        </div>
      </div>

      {/* RIGHT COLUMN: Active Chat Messages column */}
      <div className={`lg:col-span-3 flex flex-col h-full min-h-0 bg-white ${!mobileShowChannels ? 'block' : 'hidden'} lg:flex`}>

        {/* Chat top info header */}
        <div className="p-4 border-b border-[#EDEDEB] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileShowChannels(true)}
              className="lg:hidden p-1 -ml-1 hover:bg-[#F1F1EF] text-[#5A5A57] rounded cursor-pointer"
              title="Canales"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
            <div>
              <h3 className="text-xs font-semibold text-[#37352F] flex items-center gap-1">
                #{activeChannel?.name || 'Canal'} 
                {activeChannel?.type === 'private' && <Lock className="w-3 h-3 text-[#91918E]" />}
              </h3>
              <p className="text-[10px] text-[#91918E] line-clamp-1">{activeChannel?.description || 'Canal público de comunicación interna'}</p>
            </div>
          </div>

          <button
            onClick={() => activeChannelId && onRefreshMessages(activeChannelId)}
            className="p-1 hover:bg-[#F1F1EF] text-[#5A5A57] hover:text-[#37352F] transition-colors rounded cursor-pointer"
            title="Sincronizar Mensajes"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Chat message tree viewport */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4" id="chat-messages-viewport">
          {messages.map((msg, index) => {
            const isMe = msg.userId === activeUserId;
            return (
              <div 
                key={msg.id} 
                className={`group flex gap-3 text-xs max-w-2xl ${isMe ? 'ml-auto flex-row-reverse text-right' : ''}`}
                id={`msg-id-${msg.id}`}
              >
                <UserAvatar name={msg.userName} avatar={msg.userAvatar} size={28} className="border border-[#EDEDEB]" />
                
                <div className="space-y-0.5">
                  <div className={`flex items-baseline gap-2 text-[10px] text-[#91918E] ${isMe ? 'justify-end' : ''}`}>
                    <span className="font-semibold text-[#37352F] text-xs">{msg.userName}</span>
                    <span className="font-mono">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && (
                      <button
                        onClick={() => setConfirmDeleteMessageId(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-[#91918E] hover:text-red-500 transition-all cursor-pointer"
                        title="Eliminar mensaje"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  <div className={`p-2.5 rounded text-[#37352F] leading-relaxed text-xs border space-y-2 ${
                    isMe 
                      ? 'bg-[#F7F7F5] border-[#EDEDEB]' 
                      : 'bg-white border-[#EDEDEB]'
                  }`}>
                    {msg.text && <div>{renderTextWithLinks(msg.text)}</div>}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="space-y-1.5">
                        {msg.attachments.map((att, i) => (
                          <div key={i}>
                            {att.type === 'image' ? (
                              <button type="button" onClick={() => openPreview(att)} className="block p-0 border-0 bg-transparent cursor-pointer">
                                <img src={att.url} alt={att.name} className="max-w-full sm:max-w-xs max-h-48 rounded border border-[#EDEDEB] object-contain hover:opacity-90 transition-opacity" />
                              </button>
                            ) : att.type === 'link' ? (
                              att.smartLink ? (
                                <div className="max-w-sm"><SmartLinkCard data={att.smartLink} /></div>
                              ) : (
                                <SmartLinkLoading compact />
                              )
                            ) : (
                              <div className="flex items-center gap-1.5 text-[11px] bg-[#F7F7F5] p-1.5 rounded border border-[#EDEDEB]">
                                <FileText className="w-3.5 h-3.5 shrink-0 text-[#5A5A57]" />
                                <span className="truncate flex-1">{att.name}</span>
                                {att.size && <span className="text-[9px] text-[#91918E] font-mono shrink-0">({(att.size / 1024).toFixed(1)} KB)</span>}
                                <button type="button" onClick={() => openPreview(att)} className="text-[#2383E2] hover:text-blue-700 text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors cursor-pointer">
                                  Vista previa
                                </button>
                                <button type="button" onClick={() => downloadFile(att)} className="text-[#5A5A57] hover:text-[#37352F] p-0.5 rounded hover:bg-[#EDEDEB] transition-colors cursor-pointer" title="Descargar">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {messages.length === 0 && (
            <div className="text-center py-24 text-xs text-[#91918E] flex flex-col items-center gap-1 leading-relaxed">
              <MessageSquare className="w-6 h-6 text-[#91918E]/60 mb-1" />
              <span>No hay mensajes en este canal. ¡Sé el primero en saludar al equipo!</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat input box form */}
        <form onSubmit={handleSend} className="p-3.5 border-t border-[#EDEDEB] bg-white shrink-0">
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {pendingAttachments.map((att, i) => (
                att.type === 'link' ? (
                  <div key={i} className="relative max-w-xs">
                    {att.smartLink ? <SmartLinkCard data={att.smartLink} compact /> : <SmartLinkLoading compact />}
                    <button type="button" onClick={() => removeAttachment(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-[#EDEDEB] rounded-full flex items-center justify-center text-[#91918E] hover:text-red-500 hover:border-red-300 cursor-pointer shadow-sm">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div key={i} className="flex items-center gap-1 bg-[#F7F7F5] border border-[#EDEDEB] rounded px-2 py-1 text-[10px] text-[#5A5A57]">
                    {att.type === 'image' ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                    <span className="truncate max-w-[120px]">{att.name}</span>
                    <button type="button" onClick={() => removeAttachment(i)} className="text-[#91918E] hover:text-red-500 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              ))}
            </div>
          )}
          <div className="flex gap-2 relative">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[#5A5A57] hover:text-[#37352F] hover:bg-[#F1F1EF] rounded transition-colors cursor-pointer"
              title="Adjuntar archivos o imágenes"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              hidden
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.csv"
            />
            <div className="flex-1 relative">
              {showMentions && filteredUsers.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-[#EDEDEB] rounded shadow-lg max-h-40 overflow-y-auto z-50">
                  {filteredUsers.map((u, i) => (
                    <button
                      key={u.id}
                      type="button"
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${i === mentionIndex ? 'bg-[#EDEDEB]' : 'hover:bg-[#F7F7F5]'}`}
                      onMouseDown={(e) => { e.preventDefault(); selectMention(u); }}
                    >
                      <img src={u.avatar} className="w-5 h-5 rounded-full object-cover border border-[#EDEDEB]" alt="" />
                      <span className="truncate">{u.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                placeholder={`Escribe un mensaje en #${activeChannel?.name || 'chat'}...`}
                value={typedMessage}
                onChange={handleInputChange}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => setShowMentions(false), 200)}
                rows={2}
                className="w-full bg-white border border-[#EDEDEB] rounded px-3 py-2 text-xs focus:outline-none focus:border-[#37352F] text-[#37352F] resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={isSending}
              className={`px-3 py-2 rounded transition-all shadow-xs ${isSending ? 'bg-[#91918E] cursor-not-allowed' : 'bg-[#37352F] hover:bg-opacity-95 cursor-pointer text-white'}`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* CONFIRM DELETE CHANNEL */}
      {confirmDeleteChannelId && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in" onClick={() => setConfirmDeleteChannelId(null)}>
          <div className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-xs space-y-4 shadow-lg text-xs text-[#37352F]" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-500" /> Eliminar Canal
            </h3>
            <p className="text-[#5A5A57]">¿Estás seguro de eliminar este canal? Se eliminarán todos los mensajes asociados.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteChannelId(null)} className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer">Cancelar</button>
              <button onClick={async () => {
                if (onDeleteChannel) await onDeleteChannel(confirmDeleteChannelId);
                if (activeChannelId === confirmDeleteChannelId) {
                  const remaining = channels.filter(c => c.id !== confirmDeleteChannelId);
                  if (remaining.length > 0) setActiveChannelId(remaining[0].id);
                  else setActiveChannelId('');
                }
                setConfirmDeleteChannelId(null);
              }} className="px-3 py-1.5 bg-red-600 text-white rounded font-medium hover:bg-red-700 cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MESSAGE */}
      {confirmDeleteMessageId && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in" onClick={() => setConfirmDeleteMessageId(null)}>
          <div className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-xs space-y-4 shadow-lg text-xs text-[#37352F]" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-500" /> Eliminar Mensaje
            </h3>
            <p className="text-[#5A5A57]">¿Estás seguro de eliminar este mensaje? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteMessageId(null)} className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer">Cancelar</button>
              <button onClick={async () => {
                if (onDeleteMessage) await onDeleteMessage(confirmDeleteMessageId);
                setConfirmDeleteMessageId(null);
              }} className="px-3 py-1.5 bg-red-600 text-white rounded font-medium hover:bg-red-700 cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* CHANNEL MODAL */}
      {showChannelModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <form onSubmit={handleChannelCreate} className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg text-xs text-[#37352F]">
            <h2 className="text-sm font-semibold text-[#37352F] flex items-center gap-1.5 pb-2 border-b border-[#EDEDEB]">
              <Sparkles className="w-4 h-4 text-[#91918E]" /> Añadir Canal de Comunicación Interna
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-[#5A5A57]">Nombre del Canal</label>
                <input
                  type="text"
                  required
                  placeholder="ej. despliegues-backend"
                  value={newChanName}
                  onChange={e => setNewChanName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none focus:border-[#37352F]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Meta o Propósito</label>
                <input
                  type="text"
                  placeholder="ej. Sincronización de tareas de base de datos..."
                  value={newChanDesc}
                  onChange={e => setNewChanDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none focus:border-[#37352F]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1 pb-1">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={isPrivate}
                  onChange={e => setIsPrivate(e.target.checked)}
                  className="text-[#37352F] focus:ring-0 rounded"
                />
                <label htmlFor="isPrivate" className="font-semibold text-[#5A5A57] cursor-pointer select-none">Establecer Canal como Privado</label>
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setShowChannelModal(false)}
                className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#37352F] text-white rounded font-medium hover:bg-opacity-95 cursor-pointer"
              >
                Crear Canal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => { setPreviewUrl(null); setPreviewType(null); }}>
          <div className="relative max-w-4xl max-h-[90vh] w-full mx-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setPreviewUrl(null); setPreviewType(null); }}
              className="absolute -top-3 -right-3 bg-white border border-[#EDEDEB] rounded-full p-1 shadow-md hover:bg-[#F7F7F5] transition-colors z-10 cursor-pointer"
            >
              <X className="w-4 h-4 text-[#5A5A57]" />
            </button>
            {previewType === 'pdf' ? (
              <iframe src={previewUrl} className="w-full h-[85vh] rounded-lg bg-white shadow-xl" title="PDF Preview" />
            ) : (
              <img src={previewUrl} className="max-w-full max-h-[85vh] mx-auto rounded-lg shadow-xl" alt="Preview" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
