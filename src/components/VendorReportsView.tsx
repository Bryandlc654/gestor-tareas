import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Search, Plus, Pencil, Trash2, Eye, FileText, Phone, Mail, MapPin, Building, MessageSquare, Calendar, User, ChevronLeft, Download, X, Clock } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { VendorLead, VendorLeadActivity, LeadStatus, ActivityType, User as UserType } from '../types';

const STATUS_COLORS: Record<LeadStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Pendiente' },
  contacted: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Contactado' },
  proposal: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Propuesta' },
  negotiation: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Negociación' },
  won: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ganado' },
  lost: { bg: 'bg-red-100', text: 'text-red-700', label: 'Perdido' },
};

const ACTIVITY_ICONS: Record<ActivityType, typeof Phone> = {
  call: Phone, meeting: Calendar, email: Mail, whatsapp: MessageSquare, visit: MapPin, other: Clock,
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: 'Llamada', meeting: 'Reunión', email: 'Correo', whatsapp: 'WhatsApp', visit: 'Visita', other: 'Otro',
};

interface Props {
  vendorLeads: VendorLead[];
  users: UserType[];
  activeUserId: string;
  onAdd: (lead: Partial<VendorLead>) => Promise<void>;
  onUpdate: (id: string, lead: Partial<VendorLead>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function VendorReportsView({ vendorLeads, users, activeUserId, onAdd, onUpdate, onDelete }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<'leads' | 'report'>('leads');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<VendorLead | null>(null);
  const [selectedLead, setSelectedLead] = useState<VendorLead | null>(null);
  const [activities, setActivities] = useState<VendorLeadActivity[]>([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Report state
  const [reportFrom, setReportFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const [form, setForm] = useState({ clientName: '', phone: '', serviceInterest: '', city: '', email: '', notes: '', status: 'pending' as LeadStatus });
  const [activityForm, setActivityForm] = useState({ type: 'call' as ActivityType, description: '' });

  const isAdmin = users.find(u => u.id === activeUserId)?.roleId === 'role-admin' || users.find(u => u.id === activeUserId)?.roleId === 'role-superadmin';

  const getToken = () => localStorage.getItem('auth_token') || '';

  const apiFetch = useCallback(async (url: string, method: string, body?: any) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  const filteredLeads = vendorLeads.filter(l =>
    l.clientName.toLowerCase().includes(search.toLowerCase()) ||
    l.city.toLowerCase().includes(search.toLowerCase()) ||
    l.serviceInterest.toLowerCase().includes(search.toLowerCase()) ||
    l.email.toLowerCase().includes(search.toLowerCase())
  );

  const loadActivities = useCallback(async (leadId: string) => {
    try {
      const data = await apiFetch(`/api/vendor-leads/${leadId}/activities`, 'GET');
      setActivities(Array.isArray(data) ? data : []);
    } catch { setActivities([]); }
  }, [apiFetch]);

  const openDetail = (lead: VendorLead) => {
    setSelectedLead(lead);
    setShowDetailModal(true);
    loadActivities(lead.id);
  };

  const openEdit = (lead: VendorLead) => {
    setEditingLead(lead);
    setForm({ clientName: lead.clientName, phone: lead.phone, serviceInterest: lead.serviceInterest, city: lead.city, email: lead.email, notes: lead.notes, status: lead.status });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim()) return;
    setSubmitting(true);
    try {
      if (editingLead) {
        await onUpdate(editingLead.id, form);
      } else {
        await onAdd(form);
      }
      setShowModal(false);
      setEditingLead(null);
      setForm({ clientName: '', phone: '', serviceInterest: '', city: '', email: '', notes: '', status: 'pending' });
    } finally { setSubmitting(false); }
  };

  const handleAddActivity = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !activityForm.description.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/vendor-leads/${selectedLead.id}/activities`, 'POST', activityForm);
      setActivityForm({ type: 'call', description: '' });
      setShowActivityModal(false);
      loadActivities(selectedLead.id);
    } finally { setSubmitting(false); }
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm('¿Eliminar este lead y todas sus gestiones?')) return;
    await onDelete(id);
  };

  const generateReport = async () => {
    setLoadingReport(true);
    try {
      const params = new URLSearchParams();
      if (reportFrom) params.set('from', reportFrom);
      if (reportTo) params.set('to', reportTo);
      const data = await apiFetch(`/api/vendor-leads/report?${params.toString()}`, 'GET');
      setReportData(data);
    } catch { } finally { setLoadingReport(false); }
  };

  const getVendorName = (vendorId: string) => users.find(u => u.id === vendorId)?.name || vendorId;

  // --- PDF Generation ---
  const generatePDF = () => {
    if (!reportData) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header
    doc.setFillColor(55, 53, 47);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('REPORTE DE GESTIONES', 15, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Periodo: ${reportData.dateRange.from || 'Inicio'} al ${reportData.dateRange.to || 'Fin'}`, 15, y);
    y += 12;

    // KPI Cards
    const s = reportData.summary;
    const cardW = (pageWidth - 40) / 4;
    const cards = [
      { label: 'Total Leads', value: String(s.totalLeads) },
      { label: 'Gestiones', value: String(s.totalActivities) },
      { label: 'Ganados', value: String(s.byStatus?.won || 0) },
      { label: 'Conversión', value: s.conversionRate },
    ];
    cards.forEach((c, i) => {
      const x = 15 + i * (cardW + 3);
      doc.setFillColor(247, 247, 245);
      doc.roundedRect(x, y, cardW, 18, 2, 2, 'F');
      doc.setTextColor(55, 53, 47);
      doc.setFontSize(14);
      doc.text(c.value, x + cardW / 2, y + 8, { align: 'center' });
      doc.setFontSize(7);
      doc.setTextColor(145, 145, 142);
      doc.text(c.label, x + cardW / 2, y + 14, { align: 'center' });
    });
    y += 25;

    // Status distribution
    doc.setTextColor(55, 53, 47);
    doc.setFontSize(11);
    doc.text('ESTADOS DE NEGOCIACIÓN', 15, y);
    y += 6;
    const statusEntries = Object.entries(s.byStatus || {}) as [string, number][];
    const maxCount = Math.max(...statusEntries.map(([, v]) => v), 1);
    statusEntries.forEach(([status, count]) => {
      const sc = STATUS_COLORS[status as LeadStatus];
      const barWidth = (count / maxCount) * (pageWidth - 70);
      doc.setFillColor(237, 237, 235);
      doc.roundedRect(50, y - 3, pageWidth - 70, 5, 1, 1, 'F');
      doc.setFillColor(55, 53, 47);
      if (barWidth > 0) doc.roundedRect(50, y - 3, barWidth, 5, 1, 1, 'F');
      doc.setFontSize(8);
      doc.setTextColor(55, 53, 47);
      doc.text(`${sc?.label || status}`, 15, y);
      doc.text(`${count} (${s.totalLeads ? Math.round((count / s.totalLeads) * 100) : 0}%)`, pageWidth - 15, y, { align: 'right' });
      y += 7;
    });
    y += 5;

    // Activity type distribution
    doc.setFontSize(11);
    doc.text('ACTIVIDADES REALIZADAS', 15, y);
    y += 6;
    const actEntries = Object.entries(s.byActivityType || {}).filter(([, v]) => (v as number) > 0) as [string, number][];
    actEntries.forEach(([type, count]) => {
      doc.setFontSize(8);
      doc.setTextColor(55, 53, 47);
      doc.text(`${ACTIVITY_LABELS[type as ActivityType] || type}: ${count}`, 15, y);
      y += 5;
    });
    y += 5;

    // Detailed client data
    if (y > 250) { doc.addPage(); y = 15; }
    doc.setFontSize(11);
    doc.setTextColor(55, 53, 47);
    doc.text('DETALLE DE CLIENTES', 15, y);
    y += 7;

    const labelVal = (label: string, value: string, valueX: number) => {
      doc.setFontSize(7);
      doc.setTextColor(145, 145, 142);
      doc.text(label, 18, y);
      doc.setTextColor(55, 53, 47);
      doc.text(value || '—', valueX, y);
    };

    const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-PE') : '—');

    (reportData.leads || []).forEach((lead: VendorLead, i: number) => {
      const leadActivities = (reportData.activities || []).filter((a: VendorLeadActivity) => a.leadId === lead.id);

      // Section card
      if (y > 265) { doc.addPage(); y = 15; }
      doc.setFillColor(247, 247, 245);
      doc.rect(15, y - 4, pageWidth - 30, 18, 'F');
      doc.setFontSize(9);
      doc.setTextColor(55, 53, 47);
      doc.text(`#${i + 1} ${lead.clientName}`, 18, y);
      const st = STATUS_COLORS[lead.status]?.label || lead.status;
      doc.setFontSize(7);
      doc.text(`Estado: ${st}`, pageWidth - 18, y, { align: 'right' });
      y += 5;
      doc.setFontSize(7);
      doc.setTextColor(145, 145, 142);
      doc.text(`Registrado: ${fmtDate(lead.createdAt)}`, 18, y - 1);
      y += 5;

      // Contact data rows (full width)
      [['Teléfono', lead.phone], ['Email', lead.email], ['Servicio de interés', lead.serviceInterest], ['Ciudad', lead.city]].forEach(([lb, val]) => {
        labelVal(lb as string, val as string, 45);
        y += 5;
      });

      // Notes (dato relevante)
      if (lead.notes) {
        const notesLines = doc.splitTextToSize(`Dato relevante: ${lead.notes}`, pageWidth - 36);
        notesLines.forEach((line: string) => {
          if (y > 280) { doc.addPage(); y = 15; }
          doc.setFontSize(7);
          doc.setTextColor(145, 145, 142);
          doc.text(line, 18, y);
          y += 4;
        });
      }

      // Client activities
      if (leadActivities.length > 0) {
        if (y > 272) { doc.addPage(); y = 15; }
        doc.setFontSize(7);
        doc.setTextColor(90, 90, 87);
        doc.text('Gestiones:', 18, y);
        y += 4;
        leadActivities.forEach((act: VendorLeadActivity) => {
          if (y > 280) { doc.addPage(); y = 15; }
          const date = fmtDate(act.createdAt);
          const typeLabel = ACTIVITY_LABELS[act.type] || act.type;
          doc.setFontSize(7);
          doc.setTextColor(145, 145, 142);
          doc.text(`  • ${date}`, 18, y);
          doc.setTextColor(90, 90, 87);
          doc.text(typeLabel, 52, y);
          doc.setTextColor(55, 53, 47);
          const descLines = doc.splitTextToSize(act.description || '—', pageWidth - 60);
          descLines[0] = `   ${descLines[0]}`;
          descLines.forEach((line: string) => {
            if (y > 280) { doc.addPage(); y = 15; }
            doc.text(line, 62, y);
            y += 4;
          });
          y += 1;
        });
      }
      y += 5;
    });

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(145, 145, 142);
      doc.text(`Generado el ${new Date().toLocaleDateString('es-PE')} - Página ${i}/${totalPages}`, pageWidth / 2, 290, { align: 'center' });
    }

    doc.save(`reporte-vendedor-${reportFrom}-${reportTo}.pdf`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#37352F]">Reportes de Vendedores</h1>
          <p className="text-sm text-[#91918E] mt-1">Gestión de leads y generación de reportes de actividad</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-[#EDEDEB]">
        {([
          { key: 'leads', label: 'Leads', icon: User },
          { key: 'report', label: 'Reporte PDF', icon: FileText },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveSubTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeSubTab === key ? 'border-[#37352F] text-[#37352F]' : 'border-transparent text-[#91918E] hover:text-[#5A5A57]'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* LEADS TAB */}
      {activeSubTab === 'leads' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#91918E]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, ciudad, servicio..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-[#EDEDEB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2383E2]/30" />
            </div>
            <button onClick={() => { setEditingLead(null); setForm({ clientName: '', phone: '', serviceInterest: '', city: '', email: '', notes: '', status: 'pending' }); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#37352F] text-white rounded-lg text-sm font-medium hover:bg-[#2F2D28] transition-colors">
              <Plus className="w-4 h-4" /> Registrar Lead
            </button>
          </div>

          {/* Stats bar */}
          <div className="flex gap-3 text-xs text-[#91918E]">
            <span>{filteredLeads.length} leads</span>
            <span>|</span>
            {Object.entries(STATUS_COLORS).map(([k, v]) => {
              const count = filteredLeads.filter(l => l.status === k).length;
              return count > 0 ? <span key={k} className={`${v.text}`}>{v.label}: {count}</span> : null;
            })}
          </div>

          {/* Leads Table */}
          <div className="bg-white border border-[#EDEDEB] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F7F5] border-b border-[#EDEDEB] text-left text-xs text-[#91918E] uppercase tracking-wide">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Servicio</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-[#91918E]">No hay leads registrados</td></tr>
                )}
                {filteredLeads.map(lead => {
                  const sc = STATUS_COLORS[lead.status];
                  return (
                    <tr key={lead.id} className="border-b border-[#EDEDEB] hover:bg-[#F7F7F5] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#37352F]">{lead.clientName}</div>
                        {isAdmin && <div className="text-xs text-[#91918E]">{getVendorName(lead.vendorId)}</div>}
                      </td>
                      <td className="px-4 py-3 text-[#5A5A57]">{lead.phone || '-'}</td>
                      <td className="px-4 py-3 text-[#5A5A57]">{lead.serviceInterest || '-'}</td>
                      <td className="px-4 py-3 text-[#5A5A57]">{lead.city || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#91918E]">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('es-PE') : '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openDetail(lead)} className="p-1.5 rounded hover:bg-[#EDEDEB] text-[#91918E] hover:text-[#37352F]" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => openEdit(lead)} className="p-1.5 rounded hover:bg-[#EDEDEB] text-[#91918E] hover:text-[#37352F]" title="Editar"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteLead(lead.id)} className="p-1.5 rounded hover:bg-red-50 text-[#91918E] hover:text-red-500" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT TAB */}
      {activeSubTab === 'report' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#EDEDEB] rounded-lg p-6">
            <h3 className="font-semibold text-[#37352F] mb-4">Generar Reporte de Gestiones</h3>
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="block text-xs text-[#91918E] mb-1">Desde</label>
                <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)}
                  className="px-3 py-2 text-sm border border-[#EDEDEB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2383E2]/30" />
              </div>
              <div>
                <label className="block text-xs text-[#91918E] mb-1">Hasta</label>
                <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)}
                  className="px-3 py-2 text-sm border border-[#EDEDEB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2383E2]/30" />
              </div>
              <button onClick={generateReport} disabled={loadingReport}
                className="flex items-center gap-2 px-4 py-2 bg-[#2383E2] text-white rounded-lg text-sm font-medium hover:bg-[#1B6EC2] disabled:opacity-50 transition-colors">
                {loadingReport ? 'Cargando...' : 'Consultar'}
              </button>
              {reportData && (
                <button onClick={generatePDF}
                  className="flex items-center gap-2 px-4 py-2 bg-[#37352F] text-white rounded-lg text-sm font-medium hover:bg-[#2F2D28] transition-colors">
                  <Download className="w-4 h-4" /> Descargar PDF
                </button>
              )}
            </div>
          </div>

          {/* Report Preview */}
          {reportData && (
            <div className="bg-white border border-[#EDEDEB] rounded-lg p-6 space-y-6">
              <h3 className="font-semibold text-[#37352F]">Vista Previa del Reporte</h3>

              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Leads', value: reportData.summary.totalLeads },
                  { label: 'Gestiones', value: reportData.summary.totalActivities },
                  { label: 'Ganados', value: reportData.summary.byStatus?.won || 0 },
                  { label: 'Tasa Conversión', value: reportData.summary.conversionRate },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-[#F7F7F5] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-[#37352F]">{kpi.value}</div>
                    <div className="text-xs text-[#91918E] mt-1">{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Status bars */}
              <div>
                <h4 className="text-sm font-semibold text-[#37352F] mb-3">Estados de Negociación</h4>
                <div className="space-y-2">
                  {Object.entries(reportData.summary.byStatus || {}).map(([status, count]) => {
                    const sc = STATUS_COLORS[status as LeadStatus];
                    const cnt = count as number;
                    const pct = reportData.summary.totalLeads ? Math.round((cnt / reportData.summary.totalLeads) * 100) : 0;
                    return (
                      <div key={status} className="flex items-center gap-3 text-sm">
                        <span className="w-24 text-[#5A5A57]">{sc?.label || status}</span>
                        <div className="flex-1 h-4 bg-[#EDEDEB] rounded-full overflow-hidden">
                          <div className="h-full bg-[#37352F] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-20 text-right text-xs text-[#91918E]">{cnt} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Activities breakdown */}
              <div>
                <h4 className="text-sm font-semibold text-[#37352F] mb-3">Actividades por Tipo</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(reportData.summary.byActivityType || {}).filter(([, v]) => (v as number) > 0).map(([type, count]) => {
                    const Icon = ACTIVITY_ICONS[type as ActivityType] || Clock;
                    const cnt = count as number;
                    return (
                      <div key={type} className="flex items-center gap-2 bg-[#F7F7F5] rounded-lg px-3 py-1.5 text-sm">
                        <Icon className="w-3.5 h-3.5 text-[#91918E]" />
                        <span className="text-[#5A5A57]">{ACTIVITY_LABELS[type as ActivityType]}:</span>
                        <span className="font-medium text-[#37352F]">{cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leads table */}
              {reportData.leads?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-[#37352F] mb-3">Leads en Periodo ({reportData.leads.length})</h4>
                  <div className="border border-[#EDEDEB] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#F7F7F5] border-b border-[#EDEDEB] text-left text-xs text-[#91918E]">
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Cliente</th>
                          <th className="px-3 py-2">Servicio</th>
                          <th className="px-3 py-2">Ciudad</th>
                          <th className="px-3 py-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.leads.map((lead: VendorLead, i: number) => (
                          <tr key={lead.id} className="border-b border-[#EDEDEB]">
                            <td className="px-3 py-2 text-[#91918E]">{i + 1}</td>
                            <td className="px-3 py-2 text-[#37352F] font-medium">{lead.clientName}</td>
                            <td className="px-3 py-2 text-[#5A5A57]">{lead.serviceInterest || '-'}</td>
                            <td className="px-3 py-2 text-[#5A5A57]">{lead.city || '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status]?.bg} ${STATUS_COLORS[lead.status]?.text}`}>
                                {STATUS_COLORS[lead.status]?.label}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Activities list */}
              {reportData.activities?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-[#37352F] mb-3">Historial de Gestiones ({reportData.activities.length})</h4>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {reportData.activities.map((act: VendorLeadActivity) => {
                      const Icon = ACTIVITY_ICONS[act.type] || Clock;
                      const leadName = reportData.leads?.find((l: VendorLead) => l.id === act.leadId)?.clientName || act.leadId;
                      return (
                        <div key={act.id} className="flex items-start gap-3 p-3 bg-[#F7F7F5] rounded-lg text-sm">
                          <div className="p-1.5 bg-white rounded-md border border-[#EDEDEB]">
                            <Icon className="w-4 h-4 text-[#5A5A57]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[#37352F]">{ACTIVITY_LABELS[act.type]}</span>
                              <span className="text-[#91918E]">•</span>
                              <span className="text-[#5A5A57]">{leadName}</span>
                            </div>
                            <p className="text-[#5A5A57] text-xs mt-0.5 truncate">{act.description}</p>
                          </div>
                          <span className="text-xs text-[#91918E] whitespace-nowrap">{act.createdAt ? new Date(act.createdAt).toLocaleDateString('es-PE') : '-'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* LEAD DETAIL MODAL */}
      {showDetailModal && selectedLead && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#EDEDEB] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDEDEB]">
              <div>
                <h2 className="font-bold text-[#37352F]">{selectedLead.clientName}</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${STATUS_COLORS[selectedLead.status].bg} ${STATUS_COLORS[selectedLead.status].text}`}>
                  {STATUS_COLORS[selectedLead.status].label}
                </span>
              </div>
              <button onClick={() => { setShowDetailModal(false); setSelectedLead(null); }} className="p-1.5 rounded hover:bg-[#EDEDEB]"><X className="w-5 h-5 text-[#91918E]" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Lead info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { icon: Phone, label: 'Teléfono', value: selectedLead.phone },
                  { icon: Mail, label: 'Correo', value: selectedLead.email },
                  { icon: Building, label: 'Servicio', value: selectedLead.serviceInterest },
                  { icon: MapPin, label: 'Ciudad', value: selectedLead.city },
                ].map(({ icon: Icon, label, value }) => value ? (
                  <div key={label} className="flex items-center gap-2 text-[#5A5A57]">
                    <Icon className="w-3.5 h-3.5 text-[#91918E]" />
                    <span className="text-[#91918E]">{label}:</span>
                    <span>{value}</span>
                  </div>
                ) : null)}
              </div>
              {selectedLead.notes && (
                <div className="bg-[#F7F7F5] rounded-lg p-3 text-sm text-[#5A5A57]">
                  <span className="text-[#91918E] text-xs">Nota relevante:</span><br />
                  {selectedLead.notes}
                </div>
              )}

              {/* Activities */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#37352F]">Gestiones Registradas ({activities.length})</h3>
                  <button onClick={() => setShowActivityModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2383E2] text-white rounded-lg text-xs font-medium hover:bg-[#1B6EC2] transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Nueva Gestión
                  </button>
                </div>
                {activities.length === 0 ? (
                  <p className="text-sm text-[#91918E] text-center py-4">No hay gestiones registradas</p>
                ) : (
                  <div className="space-y-2">
                    {activities.map(act => {
                      const Icon = ACTIVITY_ICONS[act.type] || Clock;
                      return (
                        <div key={act.id} className="flex items-start gap-3 p-3 bg-[#F7F7F5] rounded-lg text-sm">
                          <div className="p-1.5 bg-white rounded-md border border-[#EDEDEB]">
                            <Icon className="w-4 h-4 text-[#5A5A57]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-[#37352F]">{ACTIVITY_LABELS[act.type]}</span>
                            <p className="text-[#5A5A57] text-xs mt-0.5">{act.description}</p>
                          </div>
                          <span className="text-xs text-[#91918E] whitespace-nowrap">{act.createdAt ? new Date(act.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT LEAD MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#EDEDEB] shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-bold text-[#37352F]">{editingLead ? 'Editar Lead' : 'Registrar Lead'}</h2>
            <div>
              <label className="block text-xs text-[#91918E] mb-1">Nombre del Cliente *</label>
              <input value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} required
                className="w-full px-3 py-2 text-sm border border-[#EDEDEB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2383E2]/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#91918E] mb-1">Teléfono</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#EDEDEB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2383E2]/30" />
              </div>
              <div>
                <label className="block text-xs text-[#91918E] mb-1">Correo</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email"
                  className="w-full px-3 py-2 text-sm border border-[#EDEDEB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2383E2]/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#91918E] mb-1">Servicio de Interés</label>
                <input value={form.serviceInterest} onChange={e => setForm({ ...form, serviceInterest: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#EDEDEB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2383E2]/30" />
              </div>
              <div>
                <label className="block text-xs text-[#91918E] mb-1">Ciudad</label>
                <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-[#EDEDEB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2383E2]/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-[#91918E] mb-1">Estado</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as LeadStatus })}
                className="w-full px-3 py-2 text-sm border border-[#EDEDEB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2383E2]/30">
                {Object.entries(STATUS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#91918E] mb-1">Dato Relevante de la Conversación</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                className="w-full px-3 py-2 text-sm border border-[#EDEDEB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2383E2]/30 resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowModal(false); setEditingLead(null); }} className="px-4 py-2 text-sm text-[#5A5A57] hover:bg-[#F1F1EF] rounded-lg transition-colors">Cancelar</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-[#37352F] text-white rounded-lg text-sm font-medium hover:bg-[#2F2D28] disabled:opacity-50 transition-colors">
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD ACTIVITY MODAL */}
      {showActivityModal && selectedLead && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddActivity} className="bg-white rounded-xl border border-[#EDEDEB] shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-bold text-[#37352F]">Nueva Gestión — {selectedLead.clientName}</h2>
            <div>
              <label className="block text-xs text-[#91918E] mb-1">Tipo de Gestión *</label>
              <select value={activityForm.type} onChange={e => setActivityForm({ ...activityForm, type: e.target.value as ActivityType })}
                className="w-full px-3 py-2 text-sm border border-[#EDEDEB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2383E2]/30">
                {Object.entries(ACTIVITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#91918E] mb-1">Descripción *</label>
              <textarea value={activityForm.description} onChange={e => setActivityForm({ ...activityForm, description: e.target.value })} rows={4} required
                placeholder="Describe la gestión realizada..."
                className="w-full px-3 py-2 text-sm border border-[#EDEDEB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2383E2]/30 resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowActivityModal(false); setActivityForm({ type: 'call', description: '' }); }} className="px-4 py-2 text-sm text-[#5A5A57] hover:bg-[#F1F1EF] rounded-lg transition-colors">Cancelar</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-[#2383E2] text-white rounded-lg text-sm font-medium hover:bg-[#1B6EC2] disabled:opacity-50 transition-colors">
                {submitting ? 'Guardando...' : 'Registrar Gestión'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
