import React, { useState } from 'react';
import { 
  Plus, DollarSign, Calendar, FileText, CheckCircle, Clock, 
  Trash, Edit, Briefcase, ChevronRight, UserPlus, FileSignature, Sparkles,
  Pencil, Trash2, Eye, X, Phone, Mail, Building2, User,
  Target, ArrowRight, MapPin
} from 'lucide-react';
import { Client, Quote, Contract, Service } from '../types';

interface PipelineViewProps {
  clients: Client[];
  quotes: Quote[];
  contracts: Contract[];
  services: Service[];
  activeUserId?: string;
  onAddClient: (c: Partial<Client>) => Promise<any>;
  onUpdateClient: (id: string, c: Partial<Client>) => Promise<any>;
  onDeleteClient: (id: string) => Promise<any>;
  onAddQuote: (q: Partial<Quote>) => Promise<any>;
  onUpdateQuote: (id: string, q: Partial<Quote>) => Promise<any>;
  onAddContract: (c: Partial<Contract>) => Promise<any>;
  onUpdateContract: (id: string, c: Partial<Contract>) => Promise<any>;
  onDeleteQuote: (id: string) => Promise<any>;
  onDeleteContract: (id: string) => Promise<any>;
  onAddService: (s: Partial<Service>) => Promise<any>;
  onUpdateService: (id: string, s: Partial<Service>) => Promise<any>;
  onDeleteService: (id: string) => Promise<any>;
}

export default function PipelineView({
  clients, quotes, contracts, services,
  onAddClient, onUpdateClient, onDeleteClient,
  onAddQuote, onUpdateQuote, onDeleteQuote,
  onAddContract, onUpdateContract, onDeleteContract,
  onAddService, onUpdateService, onDeleteService
}: PipelineViewProps) {
  const [activeTab, setActiveTab] = useState<'leads' | 'quotes' | 'contracts' | 'services'>('leads');
  
  // Modal configurations
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', company: '', email: '', phone: '', status: 'lead', revenue: '', city: '', serviceInterest: '', notes: '' });
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ clientId: '', description: '', amount: '', status: 'draft', date: '' });
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);

  const [showContractModal, setShowContractModal] = useState(false);
  const [contractForm, setContractForm] = useState({ clientId: '', title: '', value: '', status: 'draft', startDate: '', endDate: '' });
  const [editingContractId, setEditingContractId] = useState<string | null>(null);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', price: '', type: 'one_time' as any });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'quote' | 'contract'; id: string; name: string } | null>(null);

  // Detail modals
  const [detailClientId, setDetailClientId] = useState<string | null>(null);
  const detailClient = detailClientId ? clients.find(c => c.id === detailClientId) : null;
  const clientQuotes = detailClientId ? quotes.filter(q => q.clientId === detailClientId) : [];
  const clientContracts = detailClientId ? contracts.filter(c => c.clientId === detailClientId) : [];

  const [detailQuoteId, setDetailQuoteId] = useState<string | null>(null);
  const detailQuote = detailQuoteId ? quotes.find(q => q.id === detailQuoteId) : null;
  const detailQuoteClient = detailQuoteId && detailQuote ? clients.find(c => c.id === detailQuote.clientId) : null;

  const [detailContractId, setDetailContractId] = useState<string | null>(null);
  const detailContract = detailContractId ? contracts.find(c => c.id === detailContractId) : null;
  const detailContractClient = detailContractId && detailContract ? clients.find(c => c.id === detailContract.clientId) : null;

  // Hanlders
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClientId) {
      await onUpdateClient(editingClientId, {
        ...clientForm,
        revenue: parseFloat(clientForm.revenue) || 0
      });
    } else {
      await onAddClient({
        ...clientForm,
        revenue: parseFloat(clientForm.revenue) || 0
      });
    }
    setShowClientModal(false);
    setClientForm({ name: '', company: '', email: '', phone: '', status: 'lead', revenue: '', city: '', serviceInterest: '', notes: '' });
    setEditingClientId(null);
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      clientId: quoteForm.clientId,
      description: quoteForm.description,
      amount: parseFloat(quoteForm.amount) || 0,
      status: quoteForm.status as any,
      date: quoteForm.date || new Date().toISOString().split('T')[0]
    };
    if (editingQuoteId) {
      await onUpdateQuote(editingQuoteId, data);
    } else {
      await onAddQuote(data);
    }
    setShowQuoteModal(false);
    setQuoteForm({ clientId: '', description: '', amount: '', status: 'draft', date: '' });
    setEditingQuoteId(null);
  };

  const handleContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      clientId: contractForm.clientId,
      title: contractForm.title,
      value: parseFloat(contractForm.value) || 0,
      status: contractForm.status as any,
      startDate: contractForm.startDate || new Date().toISOString().split('T')[0],
      endDate: contractForm.endDate
    };
    if (editingContractId) {
      await onUpdateContract(editingContractId, data);
    } else {
      await onAddContract(data);
    }
    setShowContractModal(false);
    setContractForm({ clientId: '', title: '', value: '', status: 'draft', startDate: '', endDate: '' });
    setEditingContractId(null);
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingServiceId) {
      await onUpdateService(editingServiceId, {
        ...serviceForm,
        price: parseFloat(serviceForm.price) || 0
      });
    } else {
      await onAddService({
        ...serviceForm,
        price: parseFloat(serviceForm.price) || 0
      });
    }
    setShowServiceModal(false);
    setServiceForm({ name: '', description: '', price: '', type: 'one_time' });
    setEditingServiceId(null);
  };

  // Pipeline stages helpers
  const stages = [
    { key: 'lead' as const, label: 'Contacto Inicial', bg: 'bg-[#F7F7F5]', text: 'text-[#5A5A57]' },
    { key: 'contacted' as const, label: 'Reunión / Contactado', bg: 'bg-[#F1F1EF]', text: 'text-[#37352F]' },
    { key: 'proposal' as const, label: 'Propuesta Enviada', bg: 'bg-[#DBEDDB]/20', text: 'text-[#37352F]' },
    { key: 'negotiation' as const, label: 'Negociación / Demo', bg: 'bg-[#D3E5EF]/35', text: 'text-[#2383E2]' },
    { key: 'won' as const, label: 'Ganado ✔', bg: 'bg-[#DBEDDB]/45', text: 'text-[#2D4D2E]' }
  ];

  return (
    <div className="space-y-6 animate-fade-in" id="pipeline-view-container">
      {/* Header */}
      <div className="border-b border-[#EDEDEB] pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[#37352F] flex items-center gap-1.5">
            CRM y Negocios <Briefcase className="w-4 h-4 text-[#91918E]" />
          </h1>
          <p className="text-xs text-[#91918E] mt-1">
            Gestión comercial de la agencia: prospectos, cotizaciones, contratos de servicio y catálogo.
          </p>
        </div>

        {/* Top Control Buttons */}
        <div className="flex gap-2">
          {activeTab === 'leads' && (
            <button
              onClick={() => {
                setEditingClientId(null);
                setClientForm({ name: '', company: '', email: '', phone: '', status: 'lead', revenue: '', city: '', serviceInterest: '', notes: '' });
                setShowClientModal(true);
              }}
              className="px-3 py-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-95 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" /> Agregar Lead / Cliente
            </button>
          )}

          {activeTab === 'quotes' && (
            <button
              onClick={() => {
                setEditingQuoteId(null);
                setQuoteForm({ clientId: '', description: '', amount: '', status: 'draft', date: '' });
                setShowQuoteModal(true);
              }}
              className="px-3 py-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-95 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Crear Cotización
            </button>
          )}

          {activeTab === 'contracts' && (
            <button
              onClick={() => {
                setEditingContractId(null);
                setContractForm({ clientId: '', title: '', value: '', status: 'draft', startDate: '', endDate: '' });
                setShowContractModal(true);
              }}
              className="px-3 py-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-95 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <FileSignature className="w-3.5 h-3.5" /> Generar Contrato
            </button>
          )}

          {activeTab === 'services' && (
            <button
              onClick={() => {
                setEditingServiceId(null);
                setServiceForm({ name: '', description: '', price: '', type: 'one_time' });
                setShowServiceModal(true);
              }}
              className="px-3 py-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-95 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Ofrecer Nuevo Servicio
            </button>
          )}
        </div>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="border-b border-[#EDEDEB] flex gap-4 text-xs font-semibold pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('leads')}
          className={`pb-2.5 transition-all relative cursor-pointer ${activeTab === 'leads' ? 'text-[#37352F] font-bold border-b-2 border-[#37352F]' : 'text-[#91918E] hover:text-[#37352F]'}`}
        >
          Embudo de Ventas (Pipeline)
        </button>
        <button
          onClick={() => setActiveTab('quotes')}
          className={`pb-2.5 transition-all relative cursor-pointer ${activeTab === 'quotes' ? 'text-[#37352F] font-bold border-b-2 border-[#37352F]' : 'text-[#91918E] hover:text-[#37352F]'}`}
        >
          Cotizaciones ({quotes.length})
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={`pb-2.5 transition-all relative cursor-pointer ${activeTab === 'contracts' ? 'text-[#37352F] font-bold border-b-2 border-[#37352F]' : 'text-[#91918E] hover:text-[#37352F]'}`}
        >
          Contratos Activos
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`pb-2.5 transition-all relative cursor-pointer ${activeTab === 'services' ? 'text-[#37352F] font-bold border-b-2 border-[#37352F]' : 'text-[#91918E] hover:text-[#37352F]'}`}
        >
          Catálogo de Servicios
        </button>
      </div>

      {/* TAB 1: PIPELINE EMBUDO DE VENTAS */}
      {activeTab === 'leads' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3" id="pipeline-board">
          {stages.map(stage => {
            const stageClients = clients.filter(c => c.status === stage.key);
            return (
              <div key={stage.key} className="flex flex-col h-full min-h-[200px] lg:min-h-[500px]" id={`stage-${stage.key}`}>
                {/* Stage Header */}
                <div className="flex items-center justify-between py-2 px-1 border-b border-[#EDEDEB]">
                  <span className={`text-xs font-semibold truncate ${stage.text}`}>
                    {stage.label}
                  </span>
                  <span className="px-1.5 py-0.2 bg-[#F1F1EF] text-[10px] text-[#5A5A57] rounded font-semibold">
                    {stageClients.length}
                  </span>
                </div>

                {/* Stage Body */}
                <div className={`p-2 flex-1 rounded-b-lg space-y-2 mt-2 ${stage.bg} transition-all border border-[#EDEDEB]/40`}>
                  {stageClients.map(client => (
                    <div 
                      key={client.id} 
                      className="p-3 bg-white border border-[#EDEDEB] rounded shadow-xs hover:border-[#91918E] transition-all group relative text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <h3 
                          className="font-semibold text-[#37352F] cursor-pointer hover:text-[#2383E2] transition-colors"
                          onClick={() => setDetailClientId(client.id)}
                        >{client.name}</h3>
                        <button
                          onClick={() => setDetailClientId(client.id)}
                          className="text-[#91918E] hover:text-[#2383E2] p-0.5 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Ver detalle"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[11px] text-[#5A5A57] mt-0.5">{client.company}</p>
                      
                      {client.revenue ? (
                        <div className="flex items-center gap-0.5 text-[#2D4D2E] text-[11px] mt-2 font-mono font-semibold">
                          <DollarSign className="w-3 h-3" />
                          <span>{client.revenue.toLocaleString()}</span>
                        </div>
                      ) : null}

                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#EDEDEB] opacity-90 group-hover:opacity-100 transition-all">
                        {/* Status switcher shortcut */}
                        <select
                          value={client.status}
                          onChange={(e) => onUpdateClient(client.id, { status: e.target.value as any })}
                          className="bg-transparent border-0 text-[10px] text-[#91918E] font-medium focus:ring-0 max-w-[85px] cursor-pointer"
                        >
                          <option value="lead">Lead</option>
                          <option value="contacted">Contactado</option>
                          <option value="proposal">Propuesta</option>
                          <option value="negotiation">Negociación</option>
                          <option value="won">Ganado</option>
                          <option value="lost">Perdido</option>
                        </select>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setEditingClientId(client.id);
                              setClientForm({
                                name: client.name,
                                company: client.company,
                                email: client.email,
                                phone: client.phone,
                                status: client.status,
                                revenue: client.revenue ? client.revenue.toString() : '',
                                city: client.city || '',
                                serviceInterest: client.serviceInterest || '',
                                notes: client.notes || ''
                              });
                              setShowClientModal(true);
                            }}
                            className="text-[#91918E] hover:text-[#37352F] p-0.5 transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onDeleteClient(client.id)}
                            className="text-[#91918E] hover:text-[#712D23] p-0.5 transition-colors cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {stageClients.length === 0 && (
                    <div className="text-center py-10 text-[9px] text-[#91918E] font-mono leading-relaxed">
                      Sin registros en esta etapa.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: COTIZACIONES */}
      {activeTab === 'quotes' && (
        <div className="border border-[#EDEDEB] bg-white rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F7F7F5] border-b border-[#EDEDEB] uppercase tracking-wider text-[9px] text-[#5A5A57] font-semibold">
                  <th className="py-2.5 px-4">Cliente</th>
                  <th className="py-2.5 px-4">Descripción del Proyecto</th>
                  <th className="py-2.5 px-4">Monto Estimado</th>
                  <th className="py-2.5 px-4">Fecha de Envío</th>
                  <th className="py-2.5 px-4">Estado</th>
                  <th className="py-2.5 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEDEB]">
                {quotes.map(quote => {
                  const client = clients.find(c => c.id === quote.clientId);
                  return (
                    <tr key={quote.id} className="hover:bg-[#F7F7F5]/50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#37352F]">{client ? client.name : 'Desconocido'}</p>
                        <p className="text-[10px] text-[#91918E]">{client?.company}</p>
                      </td>
                      <td className="py-3 px-4 text-[#5A5A57] max-w-sm font-normal">
                        {quote.description}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#37352F]">
                        $ {quote.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-[#91918E] font-mono">
                        {quote.date}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={quote.status}
                          onChange={async (e) => {
                            await onUpdateQuote(quote.id, { status: e.target.value as any });
                            // If approved, sync won stage
                            if (e.target.value === 'approved' && client) {
                              await onUpdateClient(client.id, { status: 'won', revenue: quote.amount });
                            }
                          }}
                          className={`px-2 py-0.5 border text-[10px] uppercase font-semibold tracking-wider rounded focus:ring-0 cursor-pointer ${
                            quote.status === 'approved' ? 'bg-[#DBEDDB]/60 text-[#2D4D2E] border-[#EDEDEB]' :
                            quote.status === 'sent' ? 'bg-[#D3E5EF]/50 text-[#2383E2] border-[#EDEDEB]' :
                            quote.status === 'rejected' ? 'bg-[#FFE2DD] text-[#712D23] border-[#EDEDEB]' :
                            'bg-[#F1F1EF] text-[#5A5A57] border-[#EDEDEB]'
                          }`}
                        >
                          <option value="draft">Borrador</option>
                          <option value="sent">Enviada</option>
                          <option value="approved">Aprobada</option>
                          <option value="rejected">Rechazada</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setDetailQuoteId(quote.id)}
                            className="text-[#91918E] hover:text-[#2383E2] p-0.5 transition-colors cursor-pointer"
                            title="Ver detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingQuoteId(quote.id);
                              setQuoteForm({
                                clientId: quote.clientId,
                                description: quote.description,
                                amount: quote.amount.toString(),
                                status: quote.status,
                                date: quote.date
                              });
                              setShowQuoteModal(true);
                            }}
                            className="text-[#91918E] hover:text-[#37352F] p-0.5 transition-colors cursor-pointer"
                            title="Editar Cotización"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'quote', id: quote.id, name: `${client?.name || 'Desconocido'} - ${quote.description}` })}
                            className="text-[#91918E] hover:text-[#712D23] p-0.5 transition-colors cursor-pointer"
                            title="Eliminar Cotización"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {quotes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[#91918E]">
                      No hay cotizaciones enviadas ni presupuestos generados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CONTRATOS */}
      {activeTab === 'contracts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="contracts-grid">
          {contracts.map(contract => {
            const client = clients.find(c => c.id === contract.clientId);
            return (
              <div key={contract.id} className="border border-[#EDEDEB] bg-white rounded-lg p-5 flex flex-col justify-between hover:border-[#91918E] transition-all relative shadow-sm">
                <span className={`absolute top-4 right-4 px-2 py-0.5 rounded text-[9px] font-semibold uppercase ${
                  contract.status === 'active' ? 'bg-[#DBEDDB]/60 text-[#2D4D2E] border border-[#EDEDEB]' :
                  'bg-[#F1F1EF] text-[#5A5A57] border border-[#EDEDEB]'
                }`}>
                  {contract.status === 'active' ? 'Activo' : 'Firmado'}
                </span>

                <div>
                  <div className="flex items-center gap-1 text-[#91918E] text-[8px] uppercase tracking-wider font-bold">
                    <FileText className="w-3 h-3" /> CONTRATO AGENCIA
                  </div>
                  <h3 className="text-xs font-semibold text-[#37352F] mt-2.5">{contract.title}</h3>
                  <div className="text-xs text-[#5A5A57] mt-1">
                    Comitente: <span className="font-semibold text-[#37352F]">{client ? client.name : 'General'}</span> ({client?.company})
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#EDEDEB] text-xs">
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-[#91918E] font-bold">Fecha Inicio</p>
                      <p className="font-mono text-[#37352F] font-medium mt-0.5">{contract.startDate}</p>
                    </div>
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-[#91918E] font-bold">Fecha Fin</p>
                      <p className="font-mono text-[#37352F] font-medium mt-0.5">{contract.endDate || 'No definida'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-5 pt-3 border-t border-[#EDEDEB]">
                  <div className="text-xs font-semibold text-[#37352F]">
                    Monto total: <span className="font-mono font-bold text-[#2D4D2E]">$ {contract.value.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setDetailContractId(contract.id)}
                        className="text-[#91918E] hover:text-[#2383E2] p-0.5 transition-colors cursor-pointer"
                        title="Ver detalle"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingContractId(contract.id);
                          setContractForm({
                            clientId: contract.clientId,
                            title: contract.title,
                            value: contract.value.toString(),
                            status: contract.status,
                            startDate: contract.startDate,
                            endDate: contract.endDate || ''
                          });
                          setShowContractModal(true);
                        }}
                        className="text-[#91918E] hover:text-[#37352F] p-0.5 transition-colors cursor-pointer"
                        title="Editar Contrato"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'contract', id: contract.id, name: contract.title })}
                        className="text-[#91918E] hover:text-[#712D23] p-0.5 transition-colors cursor-pointer"
                        title="Eliminar Contrato"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <select
                      value={contract.status}
                      onChange={(e) => onUpdateContract(contract.id, { status: e.target.value as any })}
                      className="text-[10px] border-[#EDEDEB] bg-white rounded focus:ring-0 cursor-pointer py-0.5 px-1.5 focus:outline-none"
                    >
                      <option value="draft">Borrador</option>
                      <option value="signed">Firmado</option>
                      <option value="active">Activo</option>
                      <option value="expired">Expirado</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
          {contracts.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#91918E] border border-dashed border-[#EDEDEB] rounded-lg bg-white">
              No hay contratos legales de desarrollo cargados actualmente en este espacio.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SERVICIOS */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="services-grid">
          {services.map(service => (
            <div key={service.id} className="border border-[#EDEDEB] bg-white rounded-lg p-5 flex flex-col justify-between hover:border-[#91918E] transition-all shadow-sm">
              <div>
                <span className="px-2 py-0.5 bg-[#F1F1EF] text-[#5A5A57] border border-[#EDEDEB] font-semibold text-[9px] uppercase tracking-wider rounded">
                  {service.type === 'monthly' ? 'Mensual / Recurrente' : service.type === 'hourly' ? 'Por Hora' : 'Proyecto Clave en mano'}
                </span>
                <h3 className="text-xs font-semibold text-[#37352F] mt-3">{service.name}</h3>
                <p className="text-xs text-[#5A5A57] mt-2 leading-relaxed">
                  {service.description}
                </p>
              </div>

              <div className="flex items-center justify-between mt-5 pt-3 border-t border-[#EDEDEB]">
                <span className="text-xs font-mono font-bold text-[#37352F]">
                  $ {service.price.toLocaleString()} {service.type === 'monthly' ? '/ mes' : ''}
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingServiceId(service.id);
                      setServiceForm({
                        name: service.name,
                        description: service.description,
                        price: service.price.toString(),
                        type: service.type
                      });
                      setShowServiceModal(true);
                    }}
                    className="p-1 text-[#91918E] hover:text-[#37352F] transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteService(service.id)}
                    className="p-1 text-[#91918E] hover:text-[#712D23] transition-colors cursor-pointer"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: ADD CLIENT / LEAD */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <form onSubmit={handleClientSubmit} className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg text-[#37352F] text-xs">
            <h2 className="text-sm font-semibold text-[#37352F] flex items-center gap-1 pb-2 border-b border-[#EDEDEB]">
              <Sparkles className="w-4 h-4 text-[#91918E]" />
              {editingClientId ? 'Actualizar Información del Cliente' : 'Agregar Nuevo Lead de Negocio'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-[#5A5A57]">Nombre del Contacto</label>
                <input
                  type="text"
                  required
                  value={clientForm.name}
                  onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                  placeholder="Ej. Juan de Dios"
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded bg-white focus:outline-none focus:border-[#37352F]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Compañía / Empresa</label>
                <input
                  type="text"
                  required
                  value={clientForm.company}
                  onChange={e => setClientForm({ ...clientForm, company: e.target.value })}
                  placeholder="Ej. Alimentos del Sol"
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded bg-white focus:outline-none focus:border-[#37352F]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={clientForm.email}
                  onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
                  placeholder="cliente@empresa.com"
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded bg-white focus:outline-none focus:border-[#37352F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#5A5A57]">Teléfono</label>
                  <input
                    type="text"
                    value={clientForm.phone}
                    onChange={e => setClientForm({ ...clientForm, phone: e.target.value })}
                    placeholder="+54 XX XXXX XXXX"
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white focus:outline-none focus:border-[#37352F]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#5A5A57]">Ingreso Estimado</label>
                  <input
                    type="number"
                    value={clientForm.revenue}
                    onChange={e => setClientForm({ ...clientForm, revenue: e.target.value })}
                    placeholder="3500"
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white focus:outline-none focus:border-[#37352F]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Estado Inicial</label>
                <select
                  value={clientForm.status}
                  onChange={e => setClientForm({ ...clientForm, status: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-[#EDEDEB] rounded bg-white focus:outline-none focus:border-[#37352F]"
                >
                  <option value="lead">Contacto Inicial (Lead)</option>
                  <option value="contacted">Reunión Agendada</option>
                  <option value="proposal">Propuesta Enviada</option>
                  <option value="negotiation">Fase de Negociación</option>
                  <option value="won">Ganado / Firma</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#5A5A57]">Servicio de Interés</label>
                  <input
                    type="text"
                    value={clientForm.serviceInterest}
                    onChange={e => setClientForm({ ...clientForm, serviceInterest: e.target.value })}
                    placeholder="Ej. Desarrollo Web"
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white focus:outline-none focus:border-[#37352F]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#5A5A57]">Ciudad</label>
                  <input
                    type="text"
                    value={clientForm.city}
                    onChange={e => setClientForm({ ...clientForm, city: e.target.value })}
                    placeholder="Ej. Lima"
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white focus:outline-none focus:border-[#37352F]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Dato Relevante de la Conversación</label>
                <textarea
                  value={clientForm.notes}
                  onChange={e => setClientForm({ ...clientForm, notes: e.target.value })}
                  placeholder="Información más relevante del contacto..."
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded bg-white focus:outline-none focus:border-[#37352F] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setShowClientModal(false)}
                className="px-3 py-1.5 border border-[#EDEDEB] text-[#5A5A57] rounded hover:bg-[#F7F7F5] cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-95 cursor-pointer font-medium transition-colors"
              >
                {editingClientId ? 'Guardar Cambios' : 'Ingresar Lead'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 1b: CLIENT DETAIL */}
      {detailClient && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in" onClick={() => setDetailClientId(null)}>
          <div className="bg-white border border-[#EDEDEB] rounded-lg w-full max-w-lg shadow-lg text-[#37352F] text-xs overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDEDEB]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#F1F1EF] flex items-center justify-center">
                  <User className="w-4 h-4 text-[#5A5A57]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">{detailClient.name}</h2>
                  <p className="text-[10px] text-[#91918E]">{detailClient.company}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailClientId(null)}
                className="p-1 text-[#91918E] hover:text-[#37352F] cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </span>
                  <p className="font-medium">{detailClient.email || '—'}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Teléfono
                  </span>
                  <p className="font-medium">{detailClient.phone || '—'}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold flex items-center gap-1">
                    <Target className="w-3 h-3" /> Etapa
                  </span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                    detailClient.status === 'won' ? 'bg-[#DBEDDB] text-[#2D4D2E]' :
                    detailClient.status === 'lost' ? 'bg-[#F5DEDB] text-[#712D23]' :
                    detailClient.status === 'negotiation' ? 'bg-[#D3E5EF] text-[#2383E2]' :
                    detailClient.status === 'proposal' ? 'bg-[#DBEDDB]/40 text-[#2D4D2E]' :
                    'bg-[#F1F1EF] text-[#5A5A57]'
                  }`}>
                    {stages.find(s => s.key === detailClient.status)?.label || detailClient.status}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Ingreso Est.
                  </span>
                  <p className="font-medium font-mono">{detailClient.revenue ? `$ ${detailClient.revenue.toLocaleString()}` : '—'}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold flex items-center gap-1">
                    <Target className="w-3 h-3" /> Servicio
                  </span>
                  <p className="font-medium">{detailClient.serviceInterest || '—'}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Ciudad
                  </span>
                  <p className="font-medium">{detailClient.city || '—'}</p>
                </div>
              </div>

              {detailClient.notes && (
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider text-[#91918E] font-semibold mb-2 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Dato Relevante
                  </h3>
                  <p className="bg-[#F7F7F5] border border-[#EDEDEB] rounded p-3 text-[#5A5A57]">{detailClient.notes}</p>
                </div>
              )}

              {/* Related Quotes */}
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-[#91918E] font-semibold mb-2 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Cotizaciones ({clientQuotes.length})
                </h3>
                {clientQuotes.length === 0 ? (
                  <p className="text-[#91918E] italic">Sin cotizaciones asociadas</p>
                ) : (
                  <div className="space-y-1.5">
                    {clientQuotes.map(q => (
                      <div key={q.id} className="flex items-center justify-between px-3 py-2 bg-[#F7F7F5] rounded border border-[#EDEDEB]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{q.description}</span>
                          <span className="text-[#91918E]">— $ {q.amount?.toLocaleString()}</span>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          q.status === 'approved' ? 'bg-[#DBEDDB] text-[#2D4D2E]' :
                          q.status === 'sent' ? 'bg-[#D3E5EF] text-[#2383E2]' :
                          'bg-[#F1F1EF] text-[#5A5A57]'
                        }`}>
                          {q.status === 'approved' ? 'Aprobado' : q.status === 'sent' ? 'Enviado' : 'Borrador'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Related Contracts */}
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-[#91918E] font-semibold mb-2 flex items-center gap-1">
                  <FileSignature className="w-3 h-3" /> Contratos ({clientContracts.length})
                </h3>
                {clientContracts.length === 0 ? (
                  <p className="text-[#91918E] italic">Sin contratos asociados</p>
                ) : (
                  <div className="space-y-1.5">
                    {clientContracts.map(c => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-[#F7F7F5] rounded border border-[#EDEDEB]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.title}</span>
                          <span className="text-[#91918E]">— $ {c.value?.toLocaleString()}</span>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          c.status === 'active' ? 'bg-[#DBEDDB] text-[#2D4D2E]' :
                          c.status === 'completed' ? 'bg-[#D3E5EF] text-[#2383E2]' :
                          'bg-[#F1F1EF] text-[#5A5A57]'
                        }`}>
                          {c.status === 'active' ? 'Activo' : c.status === 'completed' ? 'Completado' : c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#EDEDEB] bg-[#F7F7F5]">
              <button
                onClick={() => { setShowClientModal(true); setEditingClientId(detailClient.id); setClientForm({
                  name: detailClient.name,
                  company: detailClient.company,
                  email: detailClient.email,
                  phone: detailClient.phone,
                  status: detailClient.status,
                  revenue: detailClient.revenue ? detailClient.revenue.toString() : ''
                }); setDetailClientId(null); }}
                className="px-3 py-1.5 border border-[#EDEDEB] text-[#5A5A57] rounded hover:bg-white cursor-pointer transition-colors flex items-center gap-1"
              >
                <Edit className="w-3 h-3" /> Editar Lead
              </button>
              <button
                onClick={() => setDetailClientId(null)}
                className="px-3 py-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-95 cursor-pointer font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1c: QUOTE DETAIL */}
      {detailQuote && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in" onClick={() => setDetailQuoteId(null)}>
          <div className="bg-white border border-[#EDEDEB] rounded-lg w-full max-w-lg shadow-lg text-[#37352F] text-xs overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDEDEB]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#DBEDDB]/40 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#2D4D2E]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Cotización</h2>
                  <p className="text-[10px] text-[#91918E]">{detailQuote.id}</p>
                </div>
              </div>
              <button onClick={() => setDetailQuoteId(null)} className="p-1 text-[#91918E] hover:text-[#37352F] cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold">Cliente</span>
                  <p className="font-medium">{detailQuoteClient?.name || 'Desconocido'}</p>
                  <p className="text-[10px] text-[#91918E]">{detailQuoteClient?.company}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold">Estado</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                    detailQuote.status === 'approved' ? 'bg-[#DBEDDB] text-[#2D4D2E]' :
                    detailQuote.status === 'sent' ? 'bg-[#D3E5EF] text-[#2383E2]' :
                    detailQuote.status === 'rejected' ? 'bg-[#FFE2DD] text-[#712D23]' :
                    'bg-[#F1F1EF] text-[#5A5A57]'
                  }`}>
                    {detailQuote.status === 'approved' ? 'Aprobada' : detailQuote.status === 'sent' ? 'Enviada' : detailQuote.status === 'rejected' ? 'Rechazada' : 'Borrador'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Monto
                  </span>
                  <p className="font-medium font-mono text-sm">$ {detailQuote.amount.toLocaleString()}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Fecha
                  </span>
                  <p className="font-medium">{detailQuote.date}</p>
                </div>
              </div>

              <div>
                <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold">Descripción del Proyecto</span>
                <p className="mt-1.5 text-[#37352F] leading-relaxed bg-[#F7F7F5] p-3 rounded border border-[#EDEDEB]">
                  {detailQuote.description}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#EDEDEB] bg-[#F7F7F5]">
              <button
                onClick={() => { setEditingQuoteId(detailQuote.id); setQuoteForm({
                  clientId: detailQuote.clientId, description: detailQuote.description,
                  amount: detailQuote.amount.toString(), status: detailQuote.status, date: detailQuote.date
                }); setShowQuoteModal(true); setDetailQuoteId(null); }}
                className="px-3 py-1.5 border border-[#EDEDEB] text-[#5A5A57] rounded hover:bg-white cursor-pointer transition-colors flex items-center gap-1"
              >
                <Edit className="w-3 h-3" /> Editar
              </button>
              <button onClick={() => setDetailQuoteId(null)} className="px-3 py-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-95 cursor-pointer font-medium transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1d: CONTRACT DETAIL */}
      {detailContract && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in" onClick={() => setDetailContractId(null)}>
          <div className="bg-white border border-[#EDEDEB] rounded-lg w-full max-w-lg shadow-lg text-[#37352F] text-xs overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDEDEB]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#D3E5EF]/30 flex items-center justify-center">
                  <FileSignature className="w-4 h-4 text-[#2383E2]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">{detailContract.title}</h2>
                  <p className="text-[10px] text-[#91918E]">{detailContract.id}</p>
                </div>
              </div>
              <button onClick={() => setDetailContractId(null)} className="p-1 text-[#91918E] hover:text-[#37352F] cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Comitente
                  </span>
                  <p className="font-medium">{detailContractClient?.name || 'General'}</p>
                  <p className="text-[10px] text-[#91918E]">{detailContractClient?.company}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold">Estado</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                    detailContract.status === 'active' ? 'bg-[#DBEDDB] text-[#2D4D2E]' :
                    detailContract.status === 'signed' ? 'bg-[#D3E5EF] text-[#2383E2]' :
                    detailContract.status === 'expired' ? 'bg-[#F1F1EF] text-[#5A5A57]' :
                    'bg-[#F1F1EF] text-[#5A5A57]'
                  }`}>
                    {detailContract.status === 'active' ? 'Activo' : detailContract.status === 'signed' ? 'Firmado' : detailContract.status === 'expired' ? 'Expirado' : 'Borrador'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Valor del Contrato
                  </span>
                  <p className="font-medium font-mono text-sm">$ {detailContract.value.toLocaleString()}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] font-semibold flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Vigencia
                  </span>
                  <p className="font-medium">{detailContract.startDate} — {detailContract.endDate || 'Indefinido'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#EDEDEB] bg-[#F7F7F5]">
              <button
                onClick={() => { setEditingContractId(detailContract.id); setContractForm({
                  clientId: detailContract.clientId, title: detailContract.title,
                  value: detailContract.value.toString(), status: detailContract.status,
                  startDate: detailContract.startDate, endDate: detailContract.endDate || ''
                }); setShowContractModal(true); setDetailContractId(null); }}
                className="px-3 py-1.5 border border-[#EDEDEB] text-[#5A5A57] rounded hover:bg-white cursor-pointer transition-colors flex items-center gap-1"
              >
                <Edit className="w-3 h-3" /> Editar
              </button>
              <button onClick={() => setDetailContractId(null)} className="px-3 py-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-95 cursor-pointer font-medium transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD QUOTE */}
      {showQuoteModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <form onSubmit={handleQuoteSubmit} className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg text-[#37352F] text-xs">
            <h2 className="text-sm font-semibold text-[#37352F] pb-2 border-b border-[#EDEDEB]">{editingQuoteId ? 'Editar Cotización' : 'Generar Cotización Formal'}</h2>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-[#5A5A57]">Asociar a Cliente Lead</label>
                <select
                  required
                  value={quoteForm.clientId}
                  onChange={e => setQuoteForm({ ...quoteForm, clientId: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs text-[#37352F] focus:outline-none"
                >
                  <option value="">-- Seleccionar Cliente --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Presupuesto ($)</label>
                <input
                  type="number"
                  required
                  placeholder="Ej. 12000"
                  value={quoteForm.amount}
                  onChange={e => setQuoteForm({ ...quoteForm, amount: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Alcance Técnico</label>
                <textarea
                  required
                  placeholder="Describe el alcance del proyecto..."
                  value={quoteForm.description}
                  onChange={e => setQuoteForm({ ...quoteForm, description: e.target.value })}
                  rows={3}
                  className="w-full mt-1 px-3 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#5A5A57]">Fecha Registro</label>
                  <input
                     type="date"
                     value={quoteForm.date}
                     onChange={e => setQuoteForm({ ...quoteForm, date: e.target.value })}
                     className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#5A5A57]">Estado</label>
                  <select
                    value={quoteForm.status}
                    onChange={e => setQuoteForm({ ...quoteForm, status: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white focus:outline-none"
                  >
                    <option value="draft">Borrador</option>
                    <option value="sent">Enviada</option>
                    <option value="approved">Aprobada</option>
                    <option value="rejected">Rechazada</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setShowQuoteModal(false)}
                className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#37352F] text-white rounded font-medium hover:bg-opacity-95 cursor-pointer"
              >
                {editingQuoteId ? 'Guardar Cambios' : 'Enviar Presupuesto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: CONTRACTS */}
      {showContractModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <form onSubmit={handleContractSubmit} className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg text-[#37352F] text-xs">
            <h2 className="text-sm font-semibold text-[#37352F] pb-2 border-b border-[#EDEDEB]">{editingContractId ? 'Editar Contrato' : 'Generar Contrato de Desarrollo Web'}</h2>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-[#5A5A57]">Comitente / Cliente</label>
                <select
                  required
                  value={contractForm.clientId}
                  onChange={e => setContractForm({ ...contractForm, clientId: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none"
                >
                  <option value="">-- Seleccionar --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Título del Acuerdo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Acuerdo de Soporte Técnico"
                  value={contractForm.title}
                  onChange={e => setContractForm({ ...contractForm, title: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#5A5A57]">Monto ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="8500"
                    value={contractForm.value}
                    onChange={e => setContractForm({ ...contractForm, value: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#5A5A57]">Estado Legal</label>
                  <select
                    value={contractForm.status}
                    onChange={e => setContractForm({ ...contractForm, status: e.target.value as any })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none"
                  >
                    <option value="draft">Borrador</option>
                    <option value="signed">Firmado</option>
                    <option value="active">Activo y Vigente</option>
                    <option value="expired">Expirado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#5A5A57]">Fecha Apertura</label>
                  <input
                    type="date"
                    value={contractForm.startDate}
                    onChange={e => setContractForm({ ...contractForm, startDate: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#5A5A57]">Fecha Expiración</label>
                  <input
                    type="date"
                    value={contractForm.endDate}
                    onChange={e => setContractForm({ ...contractForm, endDate: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setShowContractModal(false)}
                className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#37352F] text-white rounded font-medium hover:bg-opacity-95 cursor-pointer"
              >
                {editingContractId ? 'Guardar Cambios' : 'Guardar Contrato'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-xs space-y-4 shadow-lg text-[#37352F] text-xs">
            <h2 className="text-sm font-semibold text-[#37352F] pb-2 border-b border-[#EDEDEB]">Confirmar Eliminación</h2>
            <p className="text-[#5A5A57] leading-relaxed">
              ¿Estás seguro de que deseas eliminar <span className="font-semibold text-[#37352F]">{deleteConfirm.name}</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (deleteConfirm.type === 'quote') {
                    await onDeleteQuote(deleteConfirm.id);
                  } else {
                    await onDeleteContract(deleteConfirm.id);
                  }
                  setDeleteConfirm(null);
                }}
                className="px-3 py-1.5 bg-[#712D23] text-white rounded font-medium hover:bg-opacity-90 cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SERVICES */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <form onSubmit={handleServiceSubmit} className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg text-[#37352F] text-xs">
            <h2 className="text-sm font-semibold text-[#37352F] pb-2 border-b border-[#EDEDEB]">
              {editingServiceId ? 'Actualizar Información del Servicio' : 'Lanzar Nuevo Servicio de Agencia'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-[#5A5A57]">Nombre del Servicio</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Soporte Completo"
                  value={serviceForm.name}
                  onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none focus:border-[#37352F]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Descripción Alcance</label>
                <textarea
                  required
                  placeholder="Alcance técnico o entregables del servicio..."
                  value={serviceForm.description}
                  onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })}
                  rows={3}
                  className="w-full mt-1 px-3 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none focus:border-[#37352F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#5A5A57]">Precio ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="Ej. 1500"
                    value={serviceForm.price}
                    onChange={e => setServiceForm({ ...serviceForm, price: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#5A5A57]">Tipo de Cobro</label>
                  <select
                    value={serviceForm.type}
                    onChange={e => setServiceForm({ ...serviceForm, type: e.target.value as any })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs focus:outline-none"
                  >
                    <option value="one_time">Pago Único</option>
                    <option value="monthly">Mensual / Recurrente</option>
                    <option value="hourly">Pago Por hora</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setShowServiceModal(false)}
                className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#37352F] text-white rounded font-medium hover:bg-opacity-95 cursor-pointer"
              >
                {editingServiceId ? 'Guardar Cambios' : 'Publicar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
