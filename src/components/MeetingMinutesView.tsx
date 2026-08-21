import React, { useState } from 'react';
import { MeetingMinute } from '../types';
import { Search, Plus, Calendar, Users, FileText, FileDown, MoreHorizontal, Pencil, Trash2, ArrowUpRight, X } from 'lucide-react';
import { showConfirm, showToast } from '../utils/alerts';

interface MeetingMinutesViewProps {
  meetingMinutes: MeetingMinute[];
  onAdd: (data: Partial<MeetingMinute>) => Promise<void>;
  onUpdate: (id: string, data: Partial<MeetingMinute>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function MeetingMinutesView({ meetingMinutes, onAdd, onUpdate, onDelete }: MeetingMinutesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<MeetingMinute>>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    participants: '',
    observations: '',
    documentUrl: ''
  });

  const filteredMinutes = meetingMinutes.filter(m => 
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.participants.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;
    
    try {
      if (editingId) {
        await onUpdate(editingId, formData);
        showToast('Acta actualizada correctamente.', 'success');
      } else {
        await onAdd(formData);
        showToast('Acta creada correctamente.', 'success');
      }
      setShowForm(false);
    } catch (e) {
      showToast('Error al guardar el acta.', 'error');
    }
  };

  const handleEdit = (mm: MeetingMinute) => {
    setFormData(mm);
    setEditingId(mm.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (await showConfirm('¿Estás seguro de eliminar esta acta?')) {
      await onDelete(id);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden animate-fade-in bg-[#F7F7F5]">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-[#37352F] tracking-tight">Actas de Reunión</h2>
          <p className="text-sm text-[#5A5A57] mt-1">Registra y administra las minutas de reuniones con clientes y equipo.</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setFormData({ title: '', date: new Date().toISOString().split('T')[0], participants: '', observations: '', documentUrl: '' }); setShowForm(true); }}
          className="px-4 py-2 bg-[#37352F] text-white rounded text-sm font-semibold hover:bg-opacity-90 flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nueva Acta
        </button>
      </div>

      <div className="bg-white border border-[#EDEDEB] rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#EDEDEB] flex items-center gap-4 bg-[#F9F9F8]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#91918E]" />
            <input 
              type="text" 
              placeholder="Buscar por título o participante..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#EDEDEB] rounded-lg text-sm focus:outline-none focus:border-[#37352F] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMinutes.map(mm => (
              <div key={mm.id} className="bg-white border border-[#EDEDEB] rounded-xl p-5 hover:border-[#D4D4D4] transition-colors shadow-sm relative group">
                
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => handleEdit(mm)} className="p-1.5 hover:bg-[#F7F7F5] rounded text-[#91918E] hover:text-[#37352F] cursor-pointer" title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(mm.id)} className="p-1.5 hover:bg-[#F7F7F5] rounded text-[#91918E] hover:text-red-600 cursor-pointer" title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mb-4 pr-12">
                  <h3 className="font-semibold text-[#37352F] text-[15px] truncate">{mm.title}</h3>
                  <div className="flex items-center gap-3 text-[11px] text-[#91918E] mt-1.5 font-medium">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {mm.date}</span>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#91918E] uppercase tracking-wider mb-1"><Users className="w-3 h-3" /> Participantes</span>
                    <p className="text-xs text-[#5A5A57] line-clamp-2">{mm.participants || 'No especificados'}</p>
                  </div>
                  <div>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#91918E] uppercase tracking-wider mb-1"><FileText className="w-3 h-3" /> Observaciones</span>
                    <p className="text-xs text-[#5A5A57] line-clamp-3 bg-[#F7F7F5] p-2 rounded border border-[#EDEDEB]">{mm.observations || 'Sin observaciones'}</p>
                  </div>
                </div>

                {mm.documentUrl && (
                  <a 
                    href={mm.documentUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-between w-full p-2.5 bg-[#F9F9F8] border border-[#EDEDEB] rounded-lg hover:bg-[#F1F1EF] transition-colors text-xs font-medium text-[#37352F]"
                  >
                    <span className="flex items-center gap-2">
                      <FileDown className="w-4 h-4 text-[#2383E2]" />
                      Ver Documento Adjunto
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#91918E]" />
                  </a>
                )}
              </div>
            ))}

            {filteredMinutes.length === 0 && (
              <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-[#EDEDEB] rounded-xl bg-[#F9F9F8]">
                <FileText className="w-8 h-8 text-[#D4D4D4] mb-3" />
                <p className="text-[#91918E] font-medium">No se encontraron actas de reunión.</p>
                <button onClick={() => { setEditingId(null); setShowForm(true); }} className="mt-4 px-4 py-1.5 bg-white border border-[#EDEDEB] text-[#37352F] text-xs font-semibold rounded hover:bg-[#F7F7F5] cursor-pointer">
                  Crear primera acta
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#EDEDEB] flex items-center justify-between bg-[#F9F9F8]">
              <h3 className="font-bold text-[#37352F] flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {editingId ? 'Editar Acta de Reunión' : 'Nueva Acta de Reunión'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-[#E5E5E5] rounded-md text-[#91918E]"><X className="w-4 h-4" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#37352F] mb-1.5 uppercase tracking-wide">Título / Tema</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 bg-[#F7F7F5] border border-[#EDEDEB] rounded-lg text-sm focus:outline-none focus:border-[#37352F]" placeholder="Reunión Kick-off Proyecto X" />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#37352F] mb-1.5 uppercase tracking-wide">Fecha</label>
                <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-3 py-2 bg-[#F7F7F5] border border-[#EDEDEB] rounded-lg text-sm focus:outline-none focus:border-[#37352F]" />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#37352F] mb-1.5 uppercase tracking-wide">Participantes</label>
                <input type="text" value={formData.participants} onChange={e => setFormData({...formData, participants: e.target.value})} className="w-full px-3 py-2 bg-[#F7F7F5] border border-[#EDEDEB] rounded-lg text-sm focus:outline-none focus:border-[#37352F]" placeholder="Nombres o correos de los asistentes" />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#37352F] mb-1.5 uppercase tracking-wide">Observaciones / Acuerdos</label>
                <textarea rows={4} value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full px-3 py-2 bg-[#F7F7F5] border border-[#EDEDEB] rounded-lg text-sm focus:outline-none focus:border-[#37352F] resize-none" placeholder="Resumen de la reunión, decisiones tomadas..."></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#37352F] mb-1.5 uppercase tracking-wide">Enlace al Documento (Opcional)</label>
                <input type="url" value={formData.documentUrl} onChange={e => setFormData({...formData, documentUrl: e.target.value})} className="w-full px-3 py-2 bg-[#F7F7F5] border border-[#EDEDEB] rounded-lg text-sm focus:outline-none focus:border-[#37352F]" placeholder="https://docs.google.com/..." />
                <p className="text-[10px] text-[#91918E] mt-1">Sube el acta a tu Drive o nube favorita y pega aquí el enlace de compartir.</p>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-[#EDEDEB]">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold text-[#5A5A57] bg-white border border-[#EDEDEB] rounded-lg hover:bg-[#F7F7F5] cursor-pointer">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-[#37352F] rounded-lg hover:bg-opacity-90 cursor-pointer">Guardar Acta</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
