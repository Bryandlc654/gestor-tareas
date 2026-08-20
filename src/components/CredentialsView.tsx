import React, { useState } from 'react';
import { 
  Key, Plus, Eye, EyeOff, Copy, Search, Trash, Edit, Pencil,
  ExternalLink, Database, Server, Cpu, Globe, Lock, ShieldCheck 
} from 'lucide-react';
import { CredentialWeb } from '../types';

interface CredentialsViewProps {
  credentials: CredentialWeb[];
  onAddCredential: (c: Partial<CredentialWeb>) => Promise<any>;
  onUpdateCredential: (id: string, c: Partial<CredentialWeb>) => Promise<any>;
  onDeleteCredential: (id: string) => Promise<any>;
}

export default function CredentialsView({
  credentials, onAddCredential, onUpdateCredential, onDeleteCredential
}: CredentialsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingCredentialId, setEditingCredentialId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<'hosting' | 'database' | 'api' | 'cms' | 'domain' | 'other'>('database');

  const [revealedIds, setRevealedIds] = useState<{ [id: string]: boolean }>({});

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEditClick = (cred: CredentialWeb) => {
    setEditingCredentialId(cred.id);
    setTitle(cred.title);
    setUrl(cred.url || '');
    setUsername(cred.username);
    setPassword(cred.password || '');
    setNotes(cred.notes || '');
    setCategory(cred.category);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !username || !password) return;
    if (editingCredentialId) {
      await onUpdateCredential(editingCredentialId, { title, url, username, password, notes, category });
    } else {
      await onAddCredential({ title, url, username, password, notes, category });
    }
    setShowModal(false);
    setEditingCredentialId(null);
    setTitle('');
    setUrl('');
    setUsername('');
    setPassword('');
    setNotes('');
    setCategory('database');
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'database': return <Database className="w-4 h-4 text-neutral-500" />;
      case 'hosting': return <Server className="w-4 h-4 text-neutral-500" />;
      case 'api': return <Cpu className="w-4 h-4 text-neutral-500" />;
      case 'domain': return <Globe className="w-4 h-4 text-neutral-500" />;
      case 'cms': return <Edit className="w-4 h-4 text-neutral-500" />;
      default: return <Key className="w-4 h-4 text-neutral-500" />;
    }
  };

  const filteredCredentials = credentials.filter(cred => {
    const matchesSearch = cred.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          cred.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cred.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || cred.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 animate-fade-in" id="credentials-view-container">
      <div className="border-b border-[#EDEDEB] pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[#37352F] flex items-center gap-1.5">
            Credenciales de Servidores <Lock className="w-4 h-4 text-[#91918E]" />
          </h1>
          <p className="text-xs text-[#91918E] mt-1">
            Gestión segura de accesos: Bases de datos de clientes, paneles de hosting AWS, Google APIs y tokens.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-95 text-xs font-semibold flex items-center gap-1.5 self-start transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Registrar Credencial
        </button>
      </div>

      <div className="p-3.5 bg-[#DBEDDB]/40 border border-[#EDEDEB] rounded-md flex items-start gap-2.5 text-xs text-[#2D4D2E]" id="safety-banner">
        <ShieldCheck className="w-4 h-4 mt-0.5 text-[#2D4D2E] shrink-0" />
        <div>
          <span className="font-bold">Seguridad de la Agencia:</span> Las credenciales se almacenan de forma segura y se visualizan según los roles asignados por el RBAC.
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#91918E]" />
          <input
            type="text"
            placeholder="Buscar credenciales..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 border border-[#EDEDEB] bg-white rounded-md focus:outline-none focus:border-[#37352F]"
          />
        </div>

        <div className="flex gap-2.5 text-xs overflow-x-auto pb-1" id="categories-credentials-filter">
          {['all', 'database', 'hosting', 'api', 'cms', 'domain', 'other'].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full border transition-all text-[11px] capitalize font-medium cursor-pointer ${
                activeCategory === cat 
                  ? 'bg-[#37352F] text-white border-[#37352F] font-semibold' 
                  : 'bg-white text-[#5A5A57] border-[#EDEDEB] hover:border-[#91918E] hover:text-[#37352F]'
              }`}
            >
              {cat === 'all' ? 'Todo' : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="cred-cards-grid">
        {filteredCredentials.map(cred => (
          <div key={cred.id} className="border border-[#EDEDEB] bg-white rounded-lg p-5 hover:border-[#91918E] transition-all space-y-4 shadow-sm relative">
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#F1F1EF] rounded border border-[#EDEDEB]/30">
                  {getCategoryIcon(cred.category)}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[#37352F] line-clamp-1">{cred.title}</h3>
                  <span className="text-[9px] uppercase tracking-wider text-[#91918E] bg-[#F1F1EF] px-1.5 py-0.2 rounded font-semibold">
                    {cred.category}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEditClick(cred)}
                  className="text-[#91918E] hover:text-[#37352F] p-1 transition-colors cursor-pointer"
                  title="Editar clave"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("¿Estás seguro de eliminar esta clave?")) {
                      onDeleteCredential(cred.id);
                    }
                  }}
                  className="text-[#91918E] hover:text-[#712D23] p-1 transition-colors cursor-pointer"
                  title="Eliminar clave"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-[#F7F7F5] rounded border border-[#EDEDEB]">
                <div className="truncate">
                  <span className="block text-[8px] text-[#91918E] uppercase tracking-wider font-semibold leading-none">Usuario</span>
                  <span className="font-mono text-[11px] font-medium text-[#37352F] truncate block mt-1.5">{cred.username}</span>
                </div>
                <button
                  onClick={() => handleCopy(cred.id + '-usr', cred.username)}
                  className="p-1 hover:bg-[#EBEBE9] rounded text-[#91918E] hover:text-[#37352F] transition-colors cursor-pointer"
                  title="Copiar usuario"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-[#F7F7F5] rounded border border-[#EDEDEB]">
                <div>
                  <span className="block text-[8px] text-[#91918E] uppercase tracking-wider font-semibold leading-none">Contraseña</span>
                  <span className="font-mono text-[11px] font-medium text-[#37352F] block mt-1.5">
                    {revealedIds[cred.id] ? (cred.password || '••••••••') : '••••••••••••'}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleReveal(cred.id)}
                    className="p-1 hover:bg-[#EBEBE9] rounded text-[#91918E] hover:text-[#37352F] transition-colors cursor-pointer"
                    title={revealedIds[cred.id] ? "Ocultar" : "Mostrar"}
                  >
                    {revealedIds[cred.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => handleCopy(cred.id + '-pwd', cred.password || '')}
                    className="p-1 hover:bg-[#EBEBE9] rounded text-[#91918E] hover:text-[#37352F] transition-colors cursor-pointer"
                    title="Copiar clave"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {cred.notes && (
              <p className="text-[10px] text-[#5A5A57] bg-[#F1F1EF]/40 p-2 border border-[#EDEDEB] rounded italic">
                Nota: {cred.notes}
              </p>
            )}

            {cred.url && (
              <a
                href={cred.url}
                target="_blank"
                referrerPolicy="no-referrer"
                className="text-[10px] text-[#91918E] hover:text-[#37352F] flex items-center gap-1 mt-3"
              >
                <span>Acceder enlace de servicio</span> <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}

            {copiedId && copiedId.startsWith(cred.id) && (
              <div className="absolute inset-x-0 bottom-2 text-center pointer-events-none">
                <span className="bg-[#37352F] text-white text-[9px] px-2 py-1 rounded shadow-md font-mono">
                  ¡Copiado!
                </span>
              </div>
            )}
          </div>
        ))}

        {filteredCredentials.length === 0 && (
          <div className="col-span-full text-center py-16 text-[#91918E] border border-dashed border-[#EDEDEB] rounded-lg bg-white">
            No hay credenciales registradas.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <form onSubmit={handleSubmit} className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg text-xs text-[#37352F]">
            <h2 className="text-sm font-semibold text-[#37352F] flex items-center gap-1.5 pb-2 border-b border-[#EDEDEB]">
              <Key className="w-4 h-4 text-[#91918E]" /> {editingCredentialId ? 'Editar Credencial' : 'Registrar Credencial'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-[#5A5A57]">Nombre</label>
                <input type="text" required placeholder="Ej. Servidor de Pruebas" value={title} onChange={e => setTitle(e.target.value)} className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded focus:outline-none focus:border-[#37352F] bg-white transition-colors" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-[#5A5A57]">Categoría</label>
                  <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded bg-white focus:outline-none focus:border-[#37352F] transition-colors">
                    <option value="database">Database</option>
                    <option value="hosting">Hosting</option>
                    <option value="api">API Keys</option>
                    <option value="cms">CMS</option>
                    <option value="domain">Domain</option>
                    <option value="other">Otros</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[#5A5A57]">URL</label>
                  <input type="url" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded focus:outline-none focus:border-[#37352F] bg-white transition-colors" />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Usuario</label>
                <input type="text" required placeholder="db_master_user" value={username} onChange={e => setUsername(e.target.value)} className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded focus:outline-none focus:border-[#37352F] bg-white transition-colors" />
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Contraseña</label>
                <div className="flex gap-2">
                  <input type="text" required placeholder="Clave segura..." value={password} onChange={e => setPassword(e.target.value)} className="flex-1 mt-1 px-3 py-2 border border-[#EDEDEB] rounded focus:outline-none focus:border-[#37352F] bg-white transition-colors font-mono text-xs" />
                  <button type="button" onClick={() => { const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+"; let pass = ""; for (let i = 0; i < 16; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length)); setPassword(pass); }} className="mt-1 px-2.5 py-2 border border-[#EDEDEB] text-[10px] bg-[#F7F7F5] rounded hover:bg-[#EBEBE9] transition-colors font-semibold cursor-pointer">Auto-Gen</button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Notas</label>
                <input type="text" placeholder="Ej. IP restringida" value={notes} onChange={e => setNotes(e.target.value)} className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded focus:outline-none focus:border-[#37352F] bg-white transition-colors" />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button type="button" onClick={() => { setShowModal(false); setEditingCredentialId(null); }} className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] transition-colors cursor-pointer">Cancelar</button>
              <button type="submit" className="px-3 py-1.5 bg-[#37352F] text-white rounded font-medium hover:bg-opacity-95 transition-colors cursor-pointer">{editingCredentialId ? 'Actualizar' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}