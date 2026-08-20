import React, { useState, useEffect } from 'react';
import { 
  LifeBuoy, CheckSquare, Plus, Clock, User, AlertCircle, 
  Trash, MessageSquare, ChevronRight, HelpCircle, ArrowUpRight, Trash2,
  KeyRound, Copy, Users, X, Image, FileText, Paperclip
} from 'lucide-react';
import { SupportTicket, TicketComment, TicketClient, TicketAttachment } from '../types';
import { SmartLinkRenderer } from './SmartLinkCard';

interface TicketsViewProps {
  tickets: SupportTicket[];
  activeUserEmail: string;
  activeUserName: string;
  onUpdateTicket: (id: string, t: Partial<SupportTicket>) => Promise<any>;
  onAddComment: (ticketId: string, comment: { authorName: string; authorEmail: string; text: string; isAdmin: boolean }) => Promise<any>;
  onDeleteTicket: (id: string) => Promise<any>;
}

export default function TicketsView({
  tickets, activeUserEmail, activeUserName, onUpdateTicket, onAddComment, onDeleteTicket
}: TicketsViewProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string>(tickets[0]?.id || '');
  const [replyText, setReplyText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [ticketClients, setTicketClients] = useState<TicketClient[]>([]);
  const [showClientPanel, setShowClientPanel] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/ticket-clients', { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } })
      .then(r => r.json())
      .then(data => setTicketClients(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientEmail.trim()) return;
    try {
      const data = await fetch('/api/ticket-clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({ name: newClientName.trim(), email: newClientEmail.trim() })
      }).then(r => r.json());
      if (data.id) {
        setTicketClients(prev => [data, ...prev]);
        setNewClientName('');
        setNewClientEmail('');
      }
    } catch {}
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return;
    try {
      await fetch(`/api/ticket-clients/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      setTicketClients(prev => prev.filter(c => c.id !== id));
    } catch {}
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Código copiado: ' + code);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicketId) return;
    await onAddComment(selectedTicketId, {
      authorName: activeUserName,
      authorEmail: activeUserEmail,
      text: replyText.trim(),
      isAdmin: true  // replies are administrative
    });
    setReplyText('');
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high': return 'bg-[#FFE2DD] text-[#712D23] border-0';
      case 'low': return 'bg-[#F1F1EF] text-[#5A5A57] border-0';
      default: return 'bg-[#F1F1EF] text-[#37352F] border-0';
    }
  };

  const filteredTickets = tickets.filter(tk => {
    if (activeFilter === 'open') return tk.status !== 'resolved';
    if (activeFilter === 'resolved') return tk.status === 'resolved';
    return true;
  });

  const selectedTicket = tickets.find(t => t.id === selectedTicketId) || filteredTickets[0];

  return (
    <div className="space-y-6 text-[#37352F] text-xs font-sans animate-fade-in" id="tickets-billing-dashboard">
      {/* Header */}
      <div className="border-b border-[#EDEDEB] pb-5" id="tickets-header">
        <h1 className="text-sm font-semibold text-[#37352F] flex items-center gap-2">
          Mesa de Ayuda & Tickets <LifeBuoy className="w-4 h-4 text-[#91918E]" />
        </h1>
        <p className="text-[11px] text-[#91918E] mt-1 pr-12">
          Bandeja interna de resolución de incidencias. Los clientes pueden reportar fallos técnicos o bugs corporativos desde el portal público.
        </p>
      </div>

      {/* Client Codes Management */}
      <div className="border border-[#EDEDEB] bg-white rounded-lg shadow-xs">
        <button
          onClick={() => setShowClientPanel(!showClientPanel)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-[#37352F] hover:bg-[#F7F7F5] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5 text-[#91918E]" /> Códigos de Clientes ({ticketClients.length})</span>
          <ChevronRight className={`w-3.5 h-3.5 text-[#91918E] transition-transform ${showClientPanel ? 'rotate-90' : ''}`} />
        </button>
        {showClientPanel && (
          <div className="px-4 pb-4 border-t border-[#EDEDEB] pt-3 space-y-3">
            <form onSubmit={handleAddClient} className="flex flex-col sm:flex-row gap-2 items-end">
              <div className="flex-1">
                <label className="block text-[9px] font-medium text-[#91918E] mb-0.5">Nombre</label>
                <input type="text" required value={newClientName} onChange={e => setNewClientName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#EDEDEB] rounded text-xs focus:outline-none focus:border-[#37352F]" placeholder="Cliente Corp." />
              </div>
              <div className="flex-1">
                <label className="block text-[9px] font-medium text-[#91918E] mb-0.5">Email</label>
                <input type="email" required value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#EDEDEB] rounded text-xs focus:outline-none focus:border-[#37352F]" placeholder="cliente@corp.com" />
              </div>
              <button type="submit" className="px-3 py-1.5 bg-[#37352F] text-white rounded text-[10px] font-semibold hover:bg-opacity-95 cursor-pointer whitespace-nowrap flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar</button>
            </form>
            <div className="max-h-36 overflow-y-auto space-y-1">
              {ticketClients.map(c => (
                <div key={c.id} className="flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-[#F7F7F5] text-[10px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-3 h-3 text-[#91918E] shrink-0" />
                    <span className="font-medium truncate">{c.name}</span>
                    <span className="text-[#91918E] hidden sm:inline truncate">{c.email}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <code className="font-mono text-[9px] bg-[#F1F1EF] px-1.5 py-0.5 rounded tracking-widest">{c.code}</code>
                    <button onClick={() => copyCode(c.code)} className="p-1 text-[#91918E] hover:text-[#37352F] cursor-pointer" title="Copiar código"><Copy className="w-3 h-3" /></button>
                    <button onClick={() => handleDeleteClient(c.id)} className="p-1 text-red-300 hover:text-red-500 cursor-pointer" title="Eliminar"><X className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
              {ticketClients.length === 0 && <p className="text-[10px] text-[#91918E] italic text-center py-2">Sin clientes registrados.</p>}
            </div>
          </div>
        )}
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 text-[10px] font-mono flex-wrap">
        {['all', 'open', 'resolved'].map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter as any)}
            className={`px-2.5 py-1.5 rounded transition-all capitalize font-medium border cursor-pointer ${
              activeFilter === filter 
                ? 'bg-[#37352F] text-white border-[#37352F]' 
                : 'bg-white text-[#5A5A57] border-[#EDEDEB] hover:border-[#91918E]'
            }`}
          >
            {filter === 'all' ? 'Ver Todos los Tickets' : filter === 'open' ? 'Pendientes de Resolución' : 'Resueltos'}
          </button>
        ))}
      </div>

      {/* Main Two Column Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="tickets-split-grid">
        
        {/* LEFT COLUMN: LIST (1/3 Width) */}
        <div className="lg:col-span-1 border border-[#EDEDEB] bg-white rounded p-3 space-y-2.5 max-h-[500px] overflow-y-auto shadow-xs">
          <span className="block text-[10px] text-[#91918E] uppercase tracking-wider font-bold px-1 font-mono">
            Bandeja de Requerimientos ({filteredTickets.length})
          </span>

          <div className="space-y-1" id="tickets-tray">
            {filteredTickets.map(tk => {
              const isSelected = tk.id === selectedTicket?.id;
              return (
                <button
                  key={tk.id}
                  onClick={() => setSelectedTicketId(tk.id)}
                  className={`w-full text-left p-3 rounded border text-xs transition-all flex flex-col gap-2 cursor-pointer ${
                    isSelected 
                      ? 'bg-[#EDEDEB] text-[#37352F] border-[#EDEDEB] font-medium animate-fade-in' 
                      : 'bg-[#F7F7F5] hover:bg-[#EDEDEB]/40 text-[#5A5A57] border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-1.5 py-0.2 rounded text-[8px] uppercase font-bold ${isSelected ? 'bg-[#37352F] text-white' : getPriorityColor(tk.priority)}`}>
                      {tk.priority}
                    </span>
                    <span className="font-mono text-[8px] text-[#91918E]">
                      {new Date(tk.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <h3 className={`font-semibold text-xs ${isSelected ? 'text-[#37352F]' : 'text-[#37352F]'} line-clamp-1`}>{tk.title}</h3>
                    <p className={`text-[10px] truncate ${isSelected ? 'text-[#5A5A57]' : 'text-[#91918E]'} mt-0.5`}>De: {tk.creatorName}</p>
                  </div>

                  <div className="flex items-center justify-between mt-1 pt-2 border-t border-dashed border-[#EDEDEB] text-[9px] font-mono">
                    <span className={`uppercase font-bold ${
                      tk.status === 'open' ? 'text-[#C99026]' :
                      tk.status === 'resolved' ? 'text-[#2EA55F]' :
                      'text-[#91918E]'
                    }`}>
                      ● {tk.status === 'open' ? 'Pendiente' : tk.status === 'in_progress' ? 'Atendiendo' : 'Resuelto'}
                    </span>
                    <span className="font-semibold text-[#91918E] flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {tk.comments?.length || 0}
                    </span>
                  </div>
                </button>
              );
            })}

            {filteredTickets.length === 0 && (
              <div className="text-center py-12 text-[#91918E] font-mono text-[11px]">
                No hay tickets en este filtro.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Ticket Full Details & Reply Board (2/3 Width) */}
        <div className="lg:col-span-2 border border-[#EDEDEB] bg-white rounded p-5 space-y-5 shadow-xs min-h-0 lg:min-h-[450px]">
          {selectedTicket ? (
            <div className="space-y-4 animate-fade-in" id="ticket-focus-details">
              {/* Ticket header row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#EDEDEB] pb-4 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-[8px] text-[#91918E] font-mono bg-[#F1F1EF] px-1.5 py-0.5 rounded w-fit uppercase font-semibold">
                    REF: #{selectedTicket.id.split('-')[1]}
                  </div>
                  <input
                    type="text"
                    value={selectedTicket.title}
                    onChange={(e) => onUpdateTicket(selectedTicket.id, { title: e.target.value })}
                    className="text-xs font-semibold text-[#37352F] mt-2 leading-tight bg-transparent border border-transparent hover:border-[#EDEDEB] focus:border-[#37352F] rounded px-1 -ml-1 w-full focus:outline-none"
                  />
                  <p className="text-[11px] text-[#91918E] mt-1">
                    Enviado por: <span className="font-semibold text-[#37352F]">{selectedTicket.creatorName}</span> ({selectedTicket.creatorEmail})
                  </p>
                </div>

                {/* Dropdown status switcher + delete */}
                <div className="flex gap-2 items-center">
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => onUpdateTicket(selectedTicket.id, { status: e.target.value as any })}
                    className="text-[10px] border border-[#EDEDEB] rounded bg-white px-2.5 py-1.5 font-mono text-[#37352F] focus:outline-none focus:border-[#37352F] cursor-pointer"
                  >
                    <option value="open">Abierto (Pendiente)</option>
                    <option value="in_progress">En Progreso / Analizando</option>
                    <option value="resolved">Resuelto / Concluido</option>
                  </select>
                  {confirmDeleteId === selectedTicket.id ? (
                    <div className="flex gap-1 items-center">
                      <button
                        onClick={async () => {
                          await onDeleteTicket(selectedTicket.id);
                          setConfirmDeleteId(null);
                          setSelectedTicketId(filteredTickets[0]?.id || '');
                        }}
                        className="px-2 py-1 bg-red-600 text-white text-[10px] font-semibold rounded cursor-pointer"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 bg-[#EDEDEB] text-[#37352F] text-[10px] font-semibold rounded cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(selectedTicket.id)}
                      className="p-1.5 text-[#91918E] hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      title="Eliminar ticket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Initial Ticket Problem Description */}
              <div className="p-4 bg-[#F7F7F5] rounded border border-[#EDEDEB] text-xs text-[#37352F] space-y-2">
                <span className="font-semibold text-[#5A5A57] block text-[10px] uppercase font-mono tracking-wider">Alcance del Reporte Cliente:</span>
                <textarea
                  value={selectedTicket.description}
                  onChange={(e) => onUpdateTicket(selectedTicket.id, { description: e.target.value })}
                  rows={3}
                  className="w-full leading-relaxed whitespace-pre-wrap font-mono text-[11px] text-[#37352F] bg-white p-3 border border-[#EDEDEB] rounded focus:outline-none focus:border-[#37352F] resize-y"
                />
                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedTicket.attachments.map((att: TicketAttachment) => (
                      att.type.startsWith('image/') ? (
                        <div key={att.id} className="block cursor-pointer" onClick={() => setPreviewImage(att.url)}>
                          <img src={att.url} alt={att.name} className="max-w-[200px] max-h-[140px] rounded border border-[#EDEDEB] object-cover hover:opacity-80 transition-opacity" loading="lazy" />
                          <span className="text-[9px] text-[#91918E] mt-0.5 block truncate max-w-[200px]">{att.name}</span>
                        </div>
                      ) : (
                        <div key={att.id} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-[#EDEDEB] rounded text-[10px] text-[#5A5A57]">
                          <FileText className="w-3 h-3 text-[#91918E]" />
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#2383E2] truncate max-w-[140px]">{att.name}</a>
                        </div>
                      )
                    ))}
                  </div>
                )}
                <div className="pt-2 flex gap-4 text-[9px] text-[#91918E] font-mono items-center">
                  <span className="flex items-center gap-1">
                    Categoría:
                    <select
                      value={selectedTicket.category}
                      onChange={(e) => onUpdateTicket(selectedTicket.id, { category: e.target.value as any })}
                      className="text-[10px] border border-[#EDEDEB] rounded bg-white px-1.5 py-0.5 font-mono text-[#37352F] focus:outline-none focus:border-[#37352F] cursor-pointer uppercase"
                    >
                      <option value="bug">Bug</option>
                      <option value="feature">Feature</option>
                      <option value="billing">Billing</option>
                      <option value="access">Access</option>
                      <option value="other">Other</option>
                    </select>
                  </span>
                  <span className="flex items-center gap-1">
                    Impacto:
                    <select
                      value={selectedTicket.priority}
                      onChange={(e) => onUpdateTicket(selectedTicket.id, { priority: e.target.value as any })}
                      className="text-[10px] border border-[#EDEDEB] rounded bg-white px-1.5 py-0.5 font-mono text-[#37352F] focus:outline-none focus:border-[#37352F] cursor-pointer uppercase"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </span>
                </div>
              </div>

              {/* Chat Thread reply comments */}
              <div className="space-y-3 pt-2">
                <h3 className="text-[11px] font-bold text-[#5A5A57] flex items-center gap-1 uppercase font-mono tracking-wider">
                  <MessageSquare className="w-3.5 h-3.5 text-[#91918E]" /> Historial de Respuestas ({selectedTicket.comments?.length || 0})
                </h3>

                <div className="space-y-3 max-h-56 overflow-y-auto pr-1" id="comments-timeline">
                  {selectedTicket.comments && selectedTicket.comments.map((comm) => (
                    <div 
                      key={comm.id} 
                      className={`p-3 border rounded text-xs space-y-1.5 ${
                        comm.isAdmin 
                          ? 'bg-[#F7F7F5] text-[#37352F] border-[#EDEDEB] ml-6' 
                          : 'bg-white text-[#37352F] border-[#EDEDEB] mr-6 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[9px] text-[#91918E] font-mono">
                        <span className="font-bold flex items-center gap-1">
                          {comm.authorName} {comm.isAdmin ? ' (Agencia)' : ' (Cliente)'}
                        </span>
                        <span>{new Date(comm.timestamp).toLocaleString()}</span>
                      </div>
                      <SmartLinkRenderer text={comm.text} className="whitespace-pre-wrap leading-relaxed block" />
                      {comm.attachments && comm.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {comm.attachments.map((att: TicketAttachment) => (
                            att.type.startsWith('image/') ? (
                              <div key={att.id} className="block cursor-pointer" onClick={() => setPreviewImage(att.url)}>
                                <img src={att.url} alt={att.name} className="max-w-[180px] max-h-[120px] rounded border border-[#EDEDEB] object-cover hover:opacity-80 transition-opacity" loading="lazy" />
                                <span className="text-[8px] text-[#91918E] mt-0.5 block truncate max-w-[180px]">{att.name}</span>
                              </div>
                            ) : (
                              <div key={att.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-[#EDEDEB] rounded text-[9px] text-[#5A5A57]">
                                <FileText className="w-2.5 h-2.5 text-[#91918E]" />
                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#2383E2] truncate max-w-[120px]">{att.name}</a>
                              </div>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {(!selectedTicket.comments || selectedTicket.comments.length === 0) && (
                    <div className="text-center py-6 text-[#91918E] text-[10px] font-mono">
                      Aún no hay respuestas de soporte técnico en este caso. Elige un campo de respuesta abajo.
                    </div>
                  )}
                </div>
              </div>

              {/* Reply feedback submission box */}
              {selectedTicket.status !== 'resolved' ? (
                <form onSubmit={handleSendReply} className="pt-3 border-t border-[#EDEDEB] flex flex-col gap-2">
                  <textarea
                    required
                    placeholder="Escribe una respuesta aclaratoria o confirma la solución..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    rows={2.5}
                    className="w-full text-xs p-3 border border-[#EDEDEB] rounded bg-white text-[#37352F] focus:outline-none focus:border-[#37352F]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#37352F] hover:bg-opacity-95 text-white text-xs font-semibold rounded cursor-pointer self-end shadow-xs transition-colors"
                  >
                    Enviar Respuesta
                  </button>
                </form>
              ) : (
                <div className="p-3.5 bg-[#F7F7F5] rounded border border-[#EDEDEB] text-[11px] text-[#5A5A57] text-center">
                  Este ticket se encuentra catalogado como <span className="font-bold text-[#37352F]">Resuelto</span>. Si requiere actualizaciones o hilos de correo, cambie el estado en el selector superior.
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#91918E] gap-2 text-xs py-24 border border-dashed border-[#EDEDEB] rounded">
              <LifeBuoy className="w-8 h-8 text-[#EDEDEB] animate-spin" style={{ animationDuration: '3s' }} />
              <span className="font-mono">Ningún ticket seleccionado de la bandeja lateral.</span>
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute -top-3 -right-3 w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center text-[#37352F] hover:bg-[#F1F1EF] cursor-pointer z-10">
              <X className="w-4 h-4" />
            </button>
            <img src={previewImage} alt="Vista previa" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
