import React, { useState, useEffect, useRef } from 'react';
import {
  LifeBuoy, Send, AlertCircle, Search, MessageSquare, Plus, Trash2, Pencil, X, CheckCircle, LogIn, KeyRound, User, Mail, Calendar, Clock, Image, FileText, Paperclip
} from 'lucide-react';
import { SupportTicket, TicketClient, TicketComment, TicketAttachment } from '../types';
import { SmartLinkRenderer } from './SmartLinkCard';

const STORAGE_KEY = 'nbp_client_code';

async function api(path: string, options: RequestInit = {}) {
  const code = localStorage.getItem(STORAGE_KEY);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (code) headers['X-Client-Code'] = code;
  const res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } as any });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Error de conexión' })); throw new Error(e.error || 'Error'); }
  return res.json();
}

async function uploadFile(file: File): Promise<TicketAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload-public', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Error al subir archivo');
  const data = await res.json();
  return { id: 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), name: data.name, url: data.url, type: data.type, size: data.size };
}

function AttachmentPreview({ attachment, onRemove, onPreviewImage }: { attachment: TicketAttachment; onRemove?: () => void; onPreviewImage?: (url: string) => void; key?: string }) {
  const isImage = attachment.type.startsWith('image/');
  return (
    <div className="relative group inline-flex items-center gap-1.5 px-2 py-1 bg-[#F7F7F5] border border-[#EDEDEB] rounded text-[10px] text-[#5A5A57]">
      {isImage ? <Image className="w-3 h-3 text-[#2383E2]" /> : <FileText className="w-3 h-3 text-[#91918E]" />}
      {isImage && onPreviewImage ? (
        <button type="button" onClick={() => onPreviewImage(attachment.url)} className="hover:text-[#2383E2] truncate max-w-[120px] cursor-pointer">{attachment.name}</button>
      ) : (
        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#2383E2] truncate max-w-[120px]">{attachment.name}</a>
      )}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 text-[#91918E] hover:text-red-500 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
      )}
    </div>
  );
}

export default function PublicTicketForm() {
  const [client, setClient] = useState<TicketClient | null>(null);
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [logging, setLogging] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Create/edit form
  const [showForm, setShowForm] = useState(false);
  const [editTicketId, setEditTicketId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [formCategory, setFormCategory] = useState<'bug' | 'feature' | 'billing' | 'access' | 'other'>('bug');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formAttachments, setFormAttachments] = useState<TicketAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [commentAttachments, setCommentAttachments] = useState<TicketAttachment[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      api('/api/ticket-clients/login', { method: 'POST', body: JSON.stringify({ code: saved }) })
        .then(c => { setClient(c); fetchTickets(c.code); })
        .catch(() => localStorage.removeItem(STORAGE_KEY));
    }
  }, []);

  const fetchTickets = async (code?: string) => {
    setLoadingTickets(true);
    try {
      const c = code || client?.code;
      if (!c) return;
      const data = await api('/api/tickets/by-client', { method: 'POST', body: JSON.stringify({ code: c }) });
      setTickets(Array.isArray(data) ? data : []);
    } catch { setTickets([]); }
    finally { setLoadingTickets(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCode.trim()) return;
    setLogging(true);
    setLoginError('');
    try {
      const c = await api('/api/ticket-clients/login', { method: 'POST', body: JSON.stringify({ code: loginCode.trim() }) });
      localStorage.setItem(STORAGE_KEY, c.code);
      setClient(c);
      setLoginCode('');
      fetchTickets(c.code);
    } catch (err: any) {
      setLoginError(err.message || 'Código inválido');
    } finally { setLogging(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setClient(null);
    setTickets([]);
    setSelectedTicket(null);
  };

  const openCreateForm = () => {
    setEditTicketId(null);
    setFormTitle('');
    setFormDesc('');
    setFormPriority('medium');
    setFormCategory('bug');
    setFormError('');
    setFormSuccess('');
    setFormAttachments([]);
    setShowForm(true);
  };

  const openEditForm = (t: SupportTicket) => {
    setEditTicketId(t.id);
    setFormTitle(t.title);
    setFormDesc(t.description);
    setFormPriority(t.priority);
    setFormCategory(t.category);
    setFormError('');
    setFormSuccess('');
    setFormAttachments(t.attachments || []);
    setShowForm(true);
    setSelectedTicket(null);
  };

  const handleFormFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingFile(true);
    try {
      const fileList = Array.from(files) as File[];
      for (const file of fileList) {
        if (file.size > 50 * 1024 * 1024) { setFormError('Archivo demasiado grande (máx 50MB)'); continue; }
        const att = await uploadFile(file);
        setFormAttachments(prev => [...prev, att]);
      }
    } catch { setFormError('Error al subir archivo'); }
    finally { setUploadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleCommentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingFile(true);
    try {
      const fileList = Array.from(files) as File[];
      for (const file of fileList) {
        if (file.size > 50 * 1024 * 1024) { setFormError('Archivo demasiado grande (máx 50MB)'); continue; }
        const att = await uploadFile(file);
        setCommentAttachments(prev => [...prev, att]);
      }
    } catch { setFormError('Error al subir archivo'); }
    finally { setUploadingFile(false); if (commentFileInputRef.current) commentFileInputRef.current.value = ''; }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDesc.trim()) return;
    setFormError('');
    setFormSuccess('');
    try {
      if (editTicketId) {
        await api(`/api/tickets/${editTicketId}`, {
          method: 'PUT',
          body: JSON.stringify({ title: formTitle.trim(), description: formDesc.trim(), priority: formPriority, category: formCategory })
        });
        setFormSuccess('Ticket actualizado correctamente');
      } else {
        await api('/api/tickets', {
          method: 'POST',
          body: JSON.stringify({
            title: formTitle.trim(), description: formDesc.trim(), priority: formPriority, category: formCategory,
            creatorName: client!.name, creatorEmail: client!.email, clientId: client!.id,
            initialComment: 'Ticket creado desde el portal de cliente.',
            attachments: formAttachments
          })
        });
        setFormSuccess('Ticket creado correctamente');
      }
      fetchTickets();
      setTimeout(() => setShowForm(false), 1000);
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este ticket definitivamente?')) return;
    try {
      await api(`/api/tickets/${id}`, { method: 'DELETE' });
      setTickets(prev => prev.filter(t => t.id !== id));
      if (selectedTicket?.id === id) setSelectedTicket(null);
    } catch {}
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && commentAttachments.length === 0) || !selectedTicket || submittingComment) return;
    setSubmittingComment(true);
    try {
      const updated = await api(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ authorName: client!.name, authorEmail: client!.email, text: newComment.trim(), isAdmin: false, attachments: commentAttachments })
      });
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      setNewComment('');
      setCommentAttachments([]);
    } catch {} finally { setSubmittingComment(false); }
  };

  // --- LOGIN SCREEN ---
  if (!client) {
    return (
      <div className="max-w-md mx-auto mt-12 animate-fade-in text-[#37352F] text-xs">
        <div className="border border-[#EDEDEB] bg-white rounded-lg p-8 shadow-xs text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-[#F1F1EF] flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6 text-[#5A5A57]" />
          </div>
          <div>
            <h1 className="text-sm font-bold">Portal de Clientes</h1>
            <p className="text-[#91918E] mt-1 leading-relaxed">Ingresa tu código único de cliente para gestionar tus tickets de soporte.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="text"
              required
              placeholder="Ej: A1B2C3D4"
              value={loginCode}
              onChange={e => setLoginCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-2.5 border border-[#EDEDEB] rounded text-xs text-center font-mono text-sm tracking-widest focus:outline-none focus:border-[#37352F] bg-white"
            />
            {loginError && <p className="text-red-500 text-[10px]">{loginError}</p>}
            <button
              type="submit"
              disabled={logging}
              className="w-full py-2.5 bg-[#37352F] text-white rounded font-semibold text-xs hover:bg-opacity-95 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {logging ? 'Verificando...' : <><LogIn className="w-3.5 h-3.5" /> Ingresar</>}
            </button>
          </form>
          <p className="text-[9px] text-[#91918E] font-mono">¿No tienes código? Solicítalo a tu ejecutivo de cuenta.</p>
        </div>
      </div>
    );
  }

  // --- TICKET DETAIL VIEW ---
  if (selectedTicket) {
    const actualTicket = tickets.find(t => t.id === selectedTicket.id) || selectedTicket;
    return (
      <div className="animate-fade-in space-y-4 text-[#37352F] text-xs">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelectedTicket(null)} className="text-[10px] font-semibold text-[#5A5A57] hover:text-[#37352F] flex items-center gap-1 cursor-pointer">
            ← Volver a mis tickets
          </button>
          <div className="flex gap-1.5">
            <button onClick={() => openEditForm(actualTicket)} className="px-2 py-1 border border-[#EDEDEB] rounded text-[10px] text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer flex items-center gap-1"><Pencil className="w-3 h-3" /> Editar</button>
            <button onClick={() => handleDelete(actualTicket.id)} className="px-2 py-1 border border-[#EDEDEB] rounded text-[10px] text-red-400 hover:bg-red-50 cursor-pointer flex items-center gap-1"><Trash2 className="w-3 h-3" /> Eliminar</button>
          </div>
        </div>
        <div className="border border-[#EDEDEB] bg-white rounded-lg p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono font-bold text-[#91918E] uppercase">REF: #{actualTicket.id.split('-')[1]}</span>
            <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-bold border ${
              actualTicket.status === 'resolved' ? 'bg-[#DBEDDB] text-[#2D4D2E] border-[#DBEDDB]' :
              actualTicket.status === 'in_progress' ? 'bg-[#D3E5EF] text-[#2383E2] border-[#D3E5EF]' :
              'bg-[#F1F1EF] text-[#5A5A57] border-[#EDEDEB]'
            }`}>
              {actualTicket.status === 'open' ? 'Abierto' : actualTicket.status === 'in_progress' ? 'En Progreso' : 'Resuelto'}
            </span>
          </div>
          <h3 className="font-semibold text-sm">{actualTicket.title}</h3>
          <p className="text-[#5A5A57] leading-relaxed whitespace-pre-wrap">{actualTicket.description}</p>
          {actualTicket.attachments && actualTicket.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#EDEDEB]">
              {actualTicket.attachments.map(att => (
                <AttachmentPreview key={att.id} attachment={att} onPreviewImage={setPreviewImage} />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-[10px] text-[#91918E]">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(actualTicket.createdAt).toLocaleDateString('es')}</span>
            <span>Prioridad: {actualTicket.priority === 'high' ? 'Alta' : actualTicket.priority === 'medium' ? 'Media' : 'Baja'}</span>
            <span>Categoría: {actualTicket.category}</span>
          </div>
        </div>
        {/* Comments */}
        <div className="border border-[#EDEDEB] bg-white rounded-lg p-5 space-y-3 shadow-xs">
          <h4 className="text-[10px] font-bold text-[#5A5A57] uppercase tracking-wider flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Conversación ({actualTicket.comments?.length || 0})</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {(actualTicket.comments || []).length === 0 ? (
              <p className="text-[10px] text-[#91918E] italic">Sin respuestas aún.</p>
            ) : (
              actualTicket.comments.map(c => (
                <div key={c.id} className={`p-3 rounded border text-[11px] ${c.isAdmin ? 'bg-[#F7F7F5] border-[#EDEDEB]' : 'bg-white border-[#EDEDEB]'}`}>
                  <span className="text-[9px] font-bold text-[#91918E] font-mono">{c.authorName} {c.isAdmin ? '(Soporte)' : '(Tú)'}</span>
                  {c.text && <SmartLinkRenderer text={c.text} className="mt-0.5 text-[#37352F] whitespace-pre-wrap block" />}
                  {c.attachments && c.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {c.attachments.map(att => (
                        <AttachmentPreview key={att.id} attachment={att} onPreviewImage={setPreviewImage} />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          {actualTicket.status !== 'resolved' ? (
            <div className="space-y-2">
              {commentAttachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {commentAttachments.map(att => (
                    <AttachmentPreview key={att.id} attachment={att} onRemove={() => setCommentAttachments(prev => prev.filter(a => a.id !== att.id))} onPreviewImage={setPreviewImage} />
                  ))}
                </div>
              )}
              <form onSubmit={handleAddComment} className="flex flex-col sm:flex-row gap-2">
                <input type="text" required placeholder="Escribe tu respuesta..." value={newComment} onChange={e => setNewComment(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-[#EDEDEB] rounded text-xs bg-white focus:outline-none focus:border-[#37352F]" />
                <input ref={commentFileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.md" className="hidden" onChange={handleCommentFileUpload} />
                <button type="button" onClick={() => commentFileInputRef.current?.click()} disabled={uploadingFile}
                  className="px-2 py-1.5 border border-[#EDEDEB] rounded hover:bg-[#F7F7F5] cursor-pointer disabled:opacity-50 flex items-center justify-center" title="Adjuntar archivos">
                  <Paperclip className="w-3 h-3 text-[#91918E]" />
                </button>
                <button type="submit" disabled={submittingComment || (!newComment.trim() && commentAttachments.length === 0)}
                  className="px-3 py-1.5 bg-[#37352F] text-white rounded text-xs font-semibold cursor-pointer hover:bg-opacity-95 disabled:opacity-50 flex items-center justify-center gap-1">
                  {submittingComment ? '...' : <><Send className="w-3 h-3" /> Enviar</>}
                </button>
              </form>
            </div>
          ) : (
            <p className="text-center text-[10px] text-[#91918E] py-2">Este ticket está cerrado.</p>
          )}
        </div>
      </div>
    );
  }

  // --- TICKET FORM (CREATE/EDIT) ---
  if (showForm) {
    return (
      <div className="animate-fade-in max-w-lg mx-auto text-[#37352F] text-xs">
        <div className="border border-[#EDEDEB] bg-white rounded-lg p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#EDEDEB]">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">{editTicketId ? <Pencil className="w-4 h-4 text-[#91918E]" /> : <Plus className="w-4 h-4 text-[#91918E]" />}{editTicketId ? 'Editar Ticket' : 'Nuevo Ticket'}</h2>
            <button onClick={() => setShowForm(false)} className="p-1 text-[#91918E] hover:text-[#37352F] cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmitForm} className="space-y-3">
            <div>
              <label className="block font-medium text-[#5A5A57] mb-1">Título</label>
              <input type="text" required value={formTitle} onChange={e => setFormTitle(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none focus:border-[#37352F]" />
            </div>
            <div>
              <label className="block font-medium text-[#5A5A57] mb-1">Descripción</label>
              <textarea required value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3}
                className="w-full px-3 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none focus:border-[#37352F]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#5A5A57] mb-1">Prioridad</label>
                <select value={formPriority} onChange={e => setFormPriority(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none focus:border-[#37352F]">
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-[#5A5A57] mb-1">Categoría</label>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none focus:border-[#37352F]">
                  <option value="bug">Fallo (Bug)</option>
                  <option value="feature">Nueva Funcionalidad</option>
                  <option value="billing">Facturación</option>
                  <option value="access">Acceso / Credenciales</option>
                  <option value="other">Otros</option>
                </select>
              </div>
            </div>
            {/* Attachments section */}
            <div>
              <label className="block font-medium text-[#5A5A57] mb-1">Archivos adjuntos</label>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.md" className="hidden" onChange={handleFormFileUpload} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
                className="w-full px-3 py-2 border border-dashed border-[#EDEDEB] rounded bg-[#F7F7F5] text-[#5A5A57] text-[10px] hover:border-[#91918E] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
                {uploadingFile ? 'Subiendo...' : <><Paperclip className="w-3 h-3" /> Adjuntar imágenes o archivos (máx 50MB)</>}
              </button>
              {formAttachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formAttachments.map(att => (
                    <AttachmentPreview key={att.id} attachment={att} onRemove={() => setFormAttachments(prev => prev.filter(a => a.id !== att.id))} onPreviewImage={setPreviewImage} />
                  ))}
                </div>
              )}
            </div>
            {formError && <p className="text-red-500 text-[10px]">{formError}</p>}
            {formSuccess && <p className="text-green-600 text-[10px] font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" />{formSuccess}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer">Cancelar</button>
              <button type="submit" className="px-3 py-1.5 bg-[#37352F] text-white rounded font-semibold hover:bg-opacity-95 cursor-pointer">{editTicketId ? 'Guardar Cambios' : 'Crear Ticket'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- TICKET LIST (DEFAULT VIEW) ---
  return (
    <div className="animate-fade-in space-y-4 text-[#37352F] text-xs">
      {/* Client info bar */}
      <div className="flex items-center justify-between bg-white border border-[#EDEDEB] rounded-lg px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#F1F1EF] flex items-center justify-center">
            <User className="w-4 h-4 text-[#5A5A57]" />
          </div>
          <div>
            <p className="font-semibold text-xs">{client.name}</p>
            <p className="text-[9px] text-[#91918E] font-mono">{client.email} — Código: {client.code}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="px-2.5 py-1 border border-[#EDEDEB] rounded text-[10px] text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer">Cerrar Sesión</button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-1.5"><LifeBuoy className="w-4 h-4 text-[#91918E]" /> Mis Tickets ({tickets.length})</h2>
        <button onClick={openCreateForm} className="px-3 py-1.5 bg-[#37352F] text-white rounded text-[10px] font-semibold hover:bg-opacity-95 cursor-pointer flex items-center gap-1"><Plus className="w-3 h-3" /> Nuevo Ticket</button>
      </div>

      {loadingTickets ? (
        <div className="text-center py-10 text-[#91918E]">Cargando...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-[#91918E] border border-dashed border-[#EDEDEB] rounded-lg">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
          <p className="font-medium">No tienes tickets registrados</p>
          <p className="text-[10px] mt-1">Crea un nuevo ticket para recibir soporte.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => (
            <div key={t.id} className="bg-white border border-[#EDEDEB] rounded-lg p-4 hover:border-[#91918E] transition-colors cursor-pointer shadow-xs" onClick={() => setSelectedTicket(t)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${
                      t.status === 'resolved' ? 'bg-[#2D4D2E]' : t.status === 'in_progress' ? 'bg-[#2383E2]' : 'bg-[#D4402A]'
                    }`} />
                    <span className="text-[9px] font-mono font-bold text-[#91918E]">#{t.id.split('-')[1]}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[8px] font-semibold ${
                      t.priority === 'high' ? 'bg-red-50 text-red-600' : t.priority === 'medium' ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50 text-gray-500'
                    }`}>{t.priority === 'high' ? 'Urgente' : t.priority === 'medium' ? 'Media' : 'Baja'}</span>
                    {t.attachments && t.attachments.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-semibold bg-blue-50 text-blue-600 flex items-center gap-0.5"><Paperclip className="w-2.5 h-2.5" />{t.attachments.length}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm truncate">{t.title}</h3>
                  <p className="text-[10px] text-[#5A5A57] mt-0.5 line-clamp-2">{t.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[9px] text-[#91918E]">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(t.createdAt).toLocaleDateString('es')}</span>
                    <span>{t.comments?.length || 0} comentarios</span>
                    <span className={`px-1.5 py-0.2 rounded text-[8px] font-semibold ${
                      t.status === 'resolved' ? 'bg-[#DBEDDB] text-[#2D4D2E]' : t.status === 'in_progress' ? 'bg-[#D3E5EF] text-[#2383E2]' : 'bg-[#F1F1EF] text-[#5A5A57]'
                    }`}>{t.status === 'open' ? 'Abierto' : t.status === 'in_progress' ? 'En Progreso' : 'Resuelto'}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEditForm(t)} className="p-1.5 border border-[#EDEDEB] rounded hover:bg-[#F7F7F5] cursor-pointer" title="Editar"><Pencil className="w-3 h-3 text-[#91918E]" /></button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 border border-[#EDEDEB] rounded hover:bg-red-50 cursor-pointer" title="Eliminar"><Trash2 className="w-3 h-3 text-red-400" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute -top-3 -right-3 w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center text-[#37352F] hover:bg-[#F1F7F5] cursor-pointer z-10">
              <X className="w-4 h-4" />
            </button>
            <img src={previewImage} alt="Vista previa" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
