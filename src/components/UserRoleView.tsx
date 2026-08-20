import React, { useState, useRef } from 'react';
import { 
  Users, Shield, ShieldCheck, UserPlus, ToggleLeft, 
  Settings2, Plus, Sparkles, Check, Play, Pencil, Trash2, X, Upload
} from 'lucide-react';
import { User, Role } from '../types';
import UserAvatar from './UserAvatar';

interface UserRoleViewProps {
  users: User[];
  roles: Role[];
  activeUserId: string;
  onAddUser: (u: Partial<User>) => Promise<any>;
  onUpdateUser: (id: string, u: Partial<User>) => Promise<any>;
  onDeleteUser: (id: string) => Promise<any>;
  onAddRole: (r: Partial<Role>) => Promise<any>;
  onUpdateRole: (id: string, r: Partial<Role>) => Promise<any>;
  onDeleteRole: (id: string) => Promise<any>;
}

export default function UserRoleView({
  users, roles, activeUserId,
  onAddUser, onUpdateUser, onDeleteUser,
  onAddRole, onUpdateRole, onDeleteRole
}: UserRoleViewProps) {
  const [activeRbacTab, setActiveRbacTab] = useState<'users' | 'permissions'>('users');
  const [showUserModal, setShowUserModal] = useState<'add' | 'edit' | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRoleId, setUserRoleId] = useState('role-developer');
  const [userAvatar, setUserAvatar] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'user' | 'role'; id: string; name: string } | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleDesc, setEditRoleDesc] = useState('');

  // List of all permissions globally in our system
  const availablePermissions = [
    { key: 'manage_workspaces', label: 'Gestión de Workspaces & Kanban', desc: 'Crear tableros, folders y tarjetas de tareas' },
    { key: 'manage_crm', label: 'Módulo CRM Ventas', desc: 'Gestionar clientes, cotizaciones y contratos' },
    { key: 'manage_users', label: 'Control de Usuarios', desc: 'Ver, añadir o editar usuarios registrados' },
    { key: 'manage_roles', label: 'Gestión RBAC y Roles', desc: 'Modificar la matriz de permisos de seguridad' },
    { key: 'manage_credentials', label: 'Bóveda de Credenciales', desc: 'Leer contraseñas y agregar llaves de acceso' },
    { key: 'view_all_tickets', label: 'Atención a Tickets Soporte', desc: 'Resolver y comentar en requerimientos de clientes' },
    { key: 'chat_all', label: 'Canales de Chat Internos', desc: 'Acceso a escribir en canales generales y técnicos' }
  ];

  const AVATAR_COLORS = ['2563eb','7c3aed','db2777','dc2626','ea580c','ca8a04','16a34a','0891b2'];

  function hashName(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  }

  function generateAvatarUrl(name: string): string {
    const encoded = encodeURIComponent(name || 'User');
    const colorIndex = hashName(name || 'User') % AVATAR_COLORS.length;
    return `https://ui-avatars.com/api/?name=${encoded}&background=${AVATAR_COLORS[colorIndex]}&color=fff&bold=true`;
  }

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userEmail) return;
    const avatarUrl = userAvatar || generateAvatarUrl(userName);
    if (showUserModal === 'edit' && editingUserId) {
      await onUpdateUser(editingUserId, {
        name: userName,
        email: userEmail,
        password: userPassword || undefined,
        roleId: userRoleId,
        avatar: avatarUrl
      });
    } else {
      await onAddUser({
        name: userName,
        email: userEmail,
        password: userPassword || '123456',
        roleId: userRoleId,
        status: 'active',
        avatar: avatarUrl
      });
    }
    setUserName('');
    setUserEmail('');
    setUserPassword('');
    setUserRoleId('role-developer');
    setUserAvatar('');
    setEditingUserId(null);
    setShowUserModal(null);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      const data = await res.json();
      if (data.url) setUserAvatar(data.url);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const openEditUser = (user: User) => {
    setEditingUserId(user.id);
    setUserName(user.name);
    setUserEmail(user.email);
    setUserPassword('');
    setUserRoleId(user.roleId);
    setUserAvatar(user.avatar || '');
    setShowUserModal('edit');
  };

  const openAddUser = () => {
    setEditingUserId(null);
    setUserName('');
    setUserEmail('');
    setUserPassword('');
    setUserRoleId('role-developer');
    setUserAvatar('');
    setShowUserModal('add');
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName) return;
    await onAddRole({
      name: roleName,
      description: roleDesc,
      permissions: selectedPermissions
    });
    setRoleName('');
    setRoleDesc('');
    setSelectedPermissions([]);
    setShowRoleModal(false);
  };

  const handleTogglePermission = (permKey: string, roleId: string, currentPerms: string[]) => {
    const isChecked = currentPerms.includes(permKey);
    const newPerms = isChecked 
      ? currentPerms.filter(k => k !== permKey)
      : [...currentPerms, permKey];
    onUpdateRole(roleId, { permissions: newPerms });
  };

  const handlePermissionCheckbox = (permKey: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permKey) ? prev.filter(k => k !== permKey) : [...prev, permKey]
    );
  };

  const activeUser = users.find(u => u.id === activeUserId);
  const activeUserRole = roles.find(r => r.id === activeUser?.roleId);

  return (
    <div className="space-y-6 animate-fade-in" id="user-role-view-container">
      {/* Header */}
      <div className="border-b border-[#EDEDEB] pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[#37352F] flex items-center gap-1.5">
            Usuarios, Roles & RBAC <Shield className="w-4 h-4 text-[#91918E]" />
          </h1>
          <p className="text-xs text-[#91918E] mt-1">
            Gestión granular de accesos de la agencia de desarrollo. Matriz de permisos de seguridad basada en roles (RBAC).
          </p>
        </div>

        {/* Current User Display */}
        <div className="bg-[#37352F] text-white p-2.5 rounded-lg shadow-sm flex items-center gap-3 max-w-sm border border-[#EDEDEB] self-start" id="user-simulator-box">
          <div className="p-1.5 bg-white/10 rounded">
            <ToggleLeft className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="block text-[8px] text-[#91918E] uppercase tracking-wider font-bold">Sesión Activa</span>
            <span className="mt-0.5 block text-xs font-semibold text-white">
              {users.find(u => u.id === activeUserId)?.name || 'Usuario'} — {roles.find(r => r.id === users.find(u => u.id === activeUserId)?.roleId)?.name}
            </span>
          </div>
        </div>
      </div>

      {/* Active simulation notice */}
      <div className="p-3 bg-[#F1F1EF] border border-[#EDEDEB] rounded-md flex items-center gap-2.5 text-xs text-[#37352F]">
        <ShieldCheck className="w-4 h-4 text-[#5A5A57] self-start mt-0.5 shrink-0" />
        <div>
          Estás visualizando la intranet como <span className="font-semibold text-[#2383E2]">{activeUser?.name}</span>. Permisos asignados: {' '}
          <span className="font-mono text-[11px] text-[#5A5A57]">
            {activeUserRole?.permissions && activeUserRole.permissions.length > 0 
              ? activeUserRole.permissions.join(', ') 
              : 'Lectura básica de Portafolio / Envío de tickets'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-[#EDEDEB] mb-4">
        <button
          onClick={() => setActiveRbacTab('users')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeRbacTab === 'users' ? 'border-[#37352F] text-[#37352F]' : 'border-transparent text-[#91918E] hover:text-[#5A5A57]'
          }`}
        >
          <Users className="w-3.5 h-3.5 inline mr-1" /> Miembros
        </button>
        <button
          onClick={() => setActiveRbacTab('permissions')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeRbacTab === 'permissions' ? 'border-[#37352F] text-[#37352F]' : 'border-transparent text-[#91918E] hover:text-[#5A5A57]'
          }`}
        >
          <Shield className="w-3.5 h-3.5 inline mr-1" /> Matriz de Permisos por Rol
        </button>
      </div>

      {activeRbacTab === 'users' && (
      <div className="space-y-4" id="users-section">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[#37352F] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#91918E]" /> Miembros de la Agencia
          </h2>
          <button
            onClick={openAddUser}
            className="px-2.5 py-1 text-[11px] bg-[#F1F1EF] border border-[#EDEDEB] hover:border-[#91918E] text-[#37352F] font-semibold rounded flex items-center gap-1 transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" /> Registrar Personal
          </button>
        </div>

        <div className="border border-[#EDEDEB] bg-white rounded-lg shadow-xs overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F7F5] border-b border-[#EDEDEB] uppercase text-[9px] text-[#5A5A57] font-semibold tracking-wider">
                <th className="py-2.5 px-4">Miembro</th>
                <th className="py-2.5 px-4 font-mono">Email</th>
                <th className="py-2.5 px-4">Rol Asignado</th>
                <th className="py-2.5 px-4">Estado</th>
                <th className="py-2.5 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEDEB]">
              {users.map(user => {
                const role = roles.find(r => r.id === user.roleId);
                return (
                  <tr key={user.id} className={`hover:bg-[#F7F7F5]/50 transition-colors ${user.id === activeUserId ? 'bg-[#F7F7F5]/60 font-medium' : ''}`}>
                    <td className="py-3 px-4 flex items-center gap-2.5">
                      <UserAvatar name={user.name} avatar={user.avatar} size={28} className="border border-[#EDEDEB]" />
                      <div>
                        <p className="font-semibold text-[#37352F] flex items-center gap-1">
                          {user.name}
                          {user.id === activeUserId && (
                            <span className="px-1.5 py-0.2 bg-[#37352F] text-white text-[8px] uppercase tracking-wide rounded">Tú</span>
                          )}
                        </p>
                        <p className="text-[9px] text-[#91918E]">ID: {user.id}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#5A5A57] font-mono text-[10px]">
                      {user.email}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 border border-[#EDEDEB] rounded text-[10px] font-semibold text-[#37352F] bg-[#F1F1EF]">
                        {role ? role.name : 'Invitado'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1 text-[10px] text-[#2D4D2E]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>Activo</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditUser(user)}
                          className="p-1 hover:bg-[#F1F1EF] rounded transition-colors cursor-pointer"
                          title="Editar usuario"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#91918E]" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'user', id: user.id, name: user.name })}
                          className="p-1 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
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

      {activeRbacTab === 'permissions' && (
      <div className="space-y-4" id="permissions-section">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[#37352F] flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#91918E]" /> Matriz de Permisos por Rol
          </h2>
        </div>

        <div className="space-y-3" id="roles-accordion">
          {roles.map(role => (
            <div key={role.id} className="border border-[#EDEDEB] bg-white rounded-lg p-4 space-y-3 shadow-xs">
              <div>
                <h3 className="font-semibold text-xs text-[#37352F] flex items-center justify-between">
                  <span>{role.name}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-[8px] text-[#91918E] bg-[#F1F1EF] border border-[#EDEDEB] px-1.5 rounded uppercase font-mono">{role.id.split('-')[1]}</span>
                    <button
                      onClick={() => { setEditingRoleId(role.id); setEditRoleName(role.name); setEditRoleDesc(role.description || ''); }}
                      className="p-1 hover:bg-[#F1F1EF] rounded transition-colors cursor-pointer"
                      title="Editar rol"
                    >
                      <Pencil className="w-3 h-3 text-[#91918E]" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'role', id: role.id, name: role.name })}
                      className="p-1 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      title="Eliminar rol"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </span>
                </h3>
                <p className="text-[10px] text-[#5A5A57] mt-1 leading-relaxed">{role.description}</p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#EDEDEB] text-xs">
                <span className="text-[8px] text-[#91918E] font-bold uppercase tracking-wider block mb-1">Permisos Granulares</span>
                {availablePermissions.map(perm => {
                  const isGranted = role.permissions.includes(perm.key);
                  return (
                    <label key={perm.key} className="flex items-start gap-2 p-1.5 hover:bg-[#F1F1EF] rounded cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={isGranted}
                        onChange={() => handleTogglePermission(perm.key, role.id, role.permissions)}
                        className="mt-0.5 text-[#37352F] focus:ring-0 rounded border-[#EDEDEB]"
                      />
                      <div className="ml-2">
                        <p className={`font-semibold text-[10px] ${isGranted ? 'text-[#37352F]' : 'text-[#91918E]'}`}>{perm.label}</p>
                        <p className="text-[9px] text-[#91918E] font-normal leading-tight">{perm.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <form onSubmit={handleUserSubmit} className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg text-xs text-[#37352F]">
            <h2 className="text-sm font-semibold text-[#37352F] flex items-center gap-1.5 pb-2 border-b border-[#EDEDEB]">
              {showUserModal === 'edit' ? <Pencil className="w-4 h-4 text-[#91918E]" /> : <UserPlus className="w-4 h-4 text-[#91918E]" />}
              {showUserModal === 'edit' ? 'Editar Usuario' : 'Registrar Personal'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-[#5A5A57]">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Rodrigo San Martín"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded focus:outline-none focus:border-[#37352F] bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57] font-mono">Email Corporativo</label>
                <input
                  type="email"
                  required
                  placeholder="usuario@nextboostperu.com"
                  value={userEmail}
                  onChange={e => setUserEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded focus:outline-none focus:border-[#37352F] bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Contraseña {showUserModal === 'edit' ? '(dejar vacío para mantener)' : 'inicial'}</label>
                <input
                  type="text"
                  placeholder={showUserModal === 'edit' ? "Nueva contraseña (opcional)" : "123456 (por defecto)"}
                  value={userPassword}
                  onChange={e => setUserPassword(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded focus:outline-none focus:border-[#37352F] bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Asignar Rol (RBAC)</label>
                <select
                  value={userRoleId}
                  onChange={e => setUserRoleId(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 border border-[#EDEDEB] rounded focus:outline-none focus:border-[#37352F] bg-white text-xs transition-colors"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Avatar / Photo picker */}
              <div>
                <label className="block font-medium text-[#5A5A57] mb-1.5">Foto / Avatar</label>
                <div className="flex items-center gap-3 mb-2">
                  <UserAvatar name={userName || ''} avatar={userAvatar || null} size={48} className="border border-[#EDEDEB]" />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="px-2.5 py-1 text-[10px] border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    >
                      <Upload className="w-3 h-3" /> {uploadingAvatar ? 'Subiendo...' : 'Subir Foto'}
                    </button>
                    {userAvatar && (
                      <button
                        type="button"
                        onClick={() => setUserAvatar('')}
                        className="px-2 py-1 text-[10px] border border-[#EDEDEB] rounded text-red-400 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }}
                  />
                </div>
                <p className="text-[10px] text-[#91918E] mt-1">El avatar se genera automáticamente con las iniciales del nombre. Sube una foto para personalizarlo.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => { setShowUserModal(null); setEditingUserId(null); }}
                className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#37352F] text-white rounded font-medium hover:bg-opacity-95 transition-colors cursor-pointer"
              >
                {showUserModal === 'edit' ? 'Guardar Cambios' : 'Registrar Miembro'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ROLE EDIT MODAL */}
      {editingRoleId && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!editRoleName) return;
            await onUpdateRole(editingRoleId, { name: editRoleName, description: editRoleDesc });
            setEditingRoleId(null);
          }} className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg text-xs text-[#37352F]">
            <h2 className="text-sm font-semibold text-[#37352F] flex items-center gap-1.5 pb-2 border-b border-[#EDEDEB]">
              <Pencil className="w-4 h-4 text-[#91918E]" /> Editar Rol
            </h2>
            <div>
              <label className="block font-medium text-[#5A5A57]">Nombre del Rol</label>
              <input type="text" required value={editRoleName}
                onChange={e => setEditRoleName(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded focus:outline-none focus:border-[#37352F] bg-white" />
            </div>
            <div>
              <label className="block font-medium text-[#5A5A57]">Descripción</label>
              <textarea value={editRoleDesc}
                onChange={e => setEditRoleDesc(e.target.value)} rows={3}
                className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded focus:outline-none focus:border-[#37352F] bg-white" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingRoleId(null)}
                className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer">Cancelar</button>
              <button type="submit"
                className="px-3 py-1.5 bg-[#37352F] text-white rounded font-medium hover:bg-opacity-95 cursor-pointer">Guardar Cambios</button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg text-xs text-[#37352F]">
            <div className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              <h2 className="text-sm font-semibold">Confirmar eliminación</h2>
            </div>
            <p className="text-[#5A5A57]">
              ¿Estás seguro de eliminar <span className="font-semibold text-[#37352F]">{deleteConfirm.name}</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirm.type === 'user') await onDeleteUser(deleteConfirm.id);
                  else await onDeleteRole(deleteConfirm.id);
                  setDeleteConfirm(null);
                }}
                className="px-3 py-1.5 bg-red-600 text-white rounded font-medium hover:bg-red-700 transition-colors cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
