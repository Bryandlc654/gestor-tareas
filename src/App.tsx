import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Folder, Key, Users, Hash, LifeBuoy, Bell, 
  HelpCircle, ChevronRight, Menu, Layers, LogOut, ShieldAlert,
  Sliders,   Calendar, CheckSquare, Sparkles, AlertTriangle, Play, X
} from 'lucide-react';
import UserAvatar from './components/UserAvatar';
import { 
  User, Role, Workspace, Folder as DBFolder, Task, TaskStatus, PersonalTodo, Meeting, Client, 
  Quote, Contract, Service, CredentialWeb, ChatChannel, 
  ChatMessage, MessageAttachment, Notification, SupportTicket, MeetingMinute, VendorLead
} from './types';

// Component view imports
import DashboardView from './components/DashboardView';
import PipelineView from './components/PipelineView';
import WorkspaceView from './components/WorkspaceView';
import CredentialsView from './components/CredentialsView';
import ChatView from './components/ChatView';
import TicketsView from './components/TicketsView';
import UserRoleView from './components/UserRoleView';
import CalendarTodoView from './components/CalendarTodoView';
import PublicTicketForm from './components/PublicTicketForm';
import AIAssistantView from './components/AIAssistantView';
import LoginPage from './components/LoginPage';
import MeetingMinutesView from './components/MeetingMinutesView';
import VendorReportsView from './components/VendorReportsView';
import { useAuth } from './contexts/AuthContext';
import { notifySoundAndBrowser, requestNotifPermission } from './utils/notify';
import { getFCMToken } from './firebase';
import { ToastContainer, showToast } from './utils/alerts';

export default function App() {
  const { user: authUser, token, isAuthenticated, isAuthLoading, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'pipeline' | 'workspaces' | 'credentials' | 
    'chat' | 'tickets' | 'rbac' | 'agency' | 'calendar' | 'public_portal' | 'assistant' | 'actas' | 'vendor_reports'
  >((sessionStorage.getItem('nbp_activeTab') as any) || 'dashboard');

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Database states
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [folders, setFolders] = useState<DBFolder[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [personalTodos, setPersonalTodos] = useState<PersonalTodo[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [credentials, setCredentials] = useState<CredentialWeb[]>([]);
  const [chatChannels, setChatChannels] = useState<ChatChannel[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [meetingMinutes, setMeetingMinutes] = useState<MeetingMinute[]>([]);
  const [vendorLeads, setVendorLeads] = useState<VendorLead[]>([]);

  // Mode Selection: Portal público vs. Intranet Interna
  const isPublicPath = window.location.pathname === '/solicitudes';
  const [accessMode, setAccessMode] = useState<'internal' | 'public'>(isPublicPath ? 'public' : 'internal');

  // RBAC active user (derived from authenticated user)
  const activeUserId = authUser?.id || '';

  // Safe fetch helper: on failure returns default empty array instead of corrupting state
  const safeFetch = async (url: string, defaultVal: any = []) => {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return defaultVal;
      return await res.json();
    } catch {
      return defaultVal;
    }
  };

  const fetchAllData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [
        resUsers, resRoles, resWS, resFolders, resTasks, resTodos, resMeetings,
        resClients, resQuotes, resContracts, resServices, resCreds,
        resChans, resTickets, resMinutes
      ] = await Promise.all([
        safeFetch('/api/users'),
        safeFetch('/api/roles'),
        safeFetch('/api/workspaces'),
        safeFetch('/api/folders'),
        safeFetch('/api/tasks'),
        safeFetch('/api/todos'),
        safeFetch('/api/meetings'),
        safeFetch('/api/clients'),
        safeFetch('/api/quotes'),
        safeFetch('/api/contracts'),
        safeFetch('/api/services'),
        safeFetch('/api/credentials'),
        safeFetch('/api/channels'),
        safeFetch('/api/tickets'),
        safeFetch('/api/meeting-minutes')
      ]);

      setUsers(Array.isArray(resUsers) ? resUsers : []);
      setRoles(Array.isArray(resRoles) ? resRoles : []);
      setWorkspaces(Array.isArray(resWS) ? resWS : []);
      setFolders(Array.isArray(resFolders) ? resFolders : []);
      setTasks(Array.isArray(resTasks) ? resTasks : []);
      setPersonalTodos(Array.isArray(resTodos) ? resTodos : []);
      setMeetings(Array.isArray(resMeetings) ? resMeetings : []);
      setClients(Array.isArray(resClients) ? resClients : []);
      setQuotes(Array.isArray(resQuotes) ? resQuotes : []);
      setContracts(Array.isArray(resContracts) ? resContracts : []);
      setServices(Array.isArray(resServices) ? resServices : []);
      setCredentials(Array.isArray(resCreds) ? resCreds : []);
      setChatChannels(Array.isArray(resChans) ? resChans : []);
      setTickets(Array.isArray(resTickets) ? resTickets : []);
      setMeetingMinutes(Array.isArray(resMinutes) ? resMinutes : []);

      // Vendor Leads
      const resVendorLeads = await safeFetch('/api/vendor-leads');
      setVendorLeads(Array.isArray(resVendorLeads) ? resVendorLeads : []);

      // Fetch notifications relative to authenticated user
      if (activeUserId) {
        const notis = await safeFetch(`/api/notifications/${activeUserId}`);
        setNotifications(Array.isArray(notis) ? notis : []);

        // Check for approaching due dates (within 24h)
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const pendingTasks = resTasks.filter((t: any) =>
          t.assignedTo.includes(activeUserId) &&
          t.dueDate &&
          t.dueDate <= tomorrow &&
          t.status !== 'done' &&
          !Array.isArray(notis?.some((n: any) => n.text?.includes(t.title) && n.text?.includes('vence')))
        );
        for (const pt of pendingTasks.slice(0, 5)) {
          const already = Array.isArray(notis) ? notis.some((n: any) => n.text?.includes(pt.title) && n.text?.includes('vence')) : false;
          if (!already) {
            try {
              await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ userId: activeUserId, text: `La tarea "${pt.title}" vence pronto (${pt.dueDate})`, type: 'task' })
              });
            } catch {}
          }
        }
      }

    } catch (error) {
      console.error("Error executing API fetches: ", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Persist active tab across page reloads
  useEffect(() => {
    sessionStorage.setItem('nbp_activeTab', activeTab);
  }, [activeTab]);
  useEffect(() => {
    requestNotifPermission();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !activeUserId) return;
    fetchAllData();
  }, [activeUserId, isAuthenticated]);

  // Real-time synchronization via Server-Sent Events (SSE)
  useEffect(() => {
    if (!activeUserId) return;
    const eventSource = new EventSource(`/api/realtime?userId=${activeUserId}`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'notification') {
          const n = payload.notification;
          setNotifications(prev => [n, ...prev]);
          notifySoundAndBrowser('Iceberg Agency', n.text);
        } else if (payload.type === 'chat_message') {
          const msg = payload.message;
          setChatMessages(prev => [...prev, msg]);
          notifySoundAndBrowser('Nuevo mensaje', `${msg.userName}: ${msg.text.slice(0, 100)}`);
        }
      } catch (err) {
        console.error('[SSE] Event parse error:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [activeUserId]);

  // Firebase Cloud Messaging - register push token on auth
  useEffect(() => {
    if (!activeUserId) return;
    let currentToken: string | null = null;
    getFCMToken().then(async (token) => {
      if (!token) return;
      currentToken = token;
      try {
        await fetch('/api/fcm/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ userId: activeUserId, token }),
        });
      } catch {}
    });
    return () => {
      if (currentToken) {
        fetch('/api/fcm/unregister', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ token: currentToken }),
        }).catch(() => {});
      }
    };
  }, [activeUserId]);

  // --- ACCESS HELPERS (RBAC GATEKEEPER) ---
  const currentUser = users.find(u => u.id === activeUserId);
  const currentRole = roles.find(r => r.id === currentUser?.roleId);

  const hasPermission = (permissionKey: string) => {
    if (!currentRole) return false;
    // Admins bypass standard checks
    if (currentRole.id === 'role-admin' || currentRole.id === 'role-superadmin') return true;
    return currentRole.permissions.includes(permissionKey);
  };

  // --- MUTATIVE ASYNC ACTION MIDDLEWARE PIPELINE ---
  const callApi = async (url: string, method: string, body?: any) => {
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errBody.slice(0, 200)}`);
      }
      return await response.json();
    } catch (e) {
      console.error("Mutative action failed: ", e);
      if (e instanceof TypeError) {
        showToast("Error de conexión con el servidor.", "error");
      } else {
        showToast("Error sincronizando cambios.", "error");
      }
    }
  };

  // --- Mutation handlers: actualizan estado local sin recargar ---
  const handleAddClient = async (client: Partial<Client>) => {
    const data = await callApi('/api/clients', 'POST', client);
    if (data) setClients(prev => [...prev, data]);
  };
  const handleUpdateClient = async (id: string, client: Partial<Client>) => {
    await callApi(`/api/clients/${id}`, 'PUT', client);
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...client } : c));
  };
  const handleDeleteClient = async (id: string) => {
    await callApi(`/api/clients/${id}`, 'DELETE');
    setClients(prev => prev.filter(c => c.id !== id));
  };

  const handleAddQuote = async (quote: Partial<Quote>) => {
    const data = await callApi('/api/quotes', 'POST', quote);
    if (data) setQuotes(prev => [...prev, data]);
  };
  const handleUpdateQuote = async (id: string, quote: Partial<Quote>) => {
    await callApi(`/api/quotes/${id}`, 'PUT', quote);
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...quote } : q));
  };
  const handleDeleteQuote = async (id: string) => {
    await callApi(`/api/quotes/${id}`, 'DELETE');
    setQuotes(prev => prev.filter(q => q.id !== id));
  };

  const handleAddContract = async (cnt: Partial<Contract>) => {
    const data = await callApi('/api/contracts', 'POST', cnt);
    if (data) setContracts(prev => [...prev, data]);
  };
  const handleUpdateContract = async (id: string, cnt: Partial<Contract>) => {
    await callApi(`/api/contracts/${id}`, 'PUT', cnt);
    setContracts(prev => prev.map(c => c.id === id ? { ...c, ...cnt } : c));
  };
  const handleDeleteContract = async (id: string) => {
    await callApi(`/api/contracts/${id}`, 'DELETE');
    setContracts(prev => prev.filter(c => c.id !== id));
  };

  const handleAddService = async (srv: Partial<Service>) => {
    const data = await callApi('/api/services', 'POST', srv);
    if (data) setServices(prev => [...prev, data]);
  };
  const handleUpdateService = async (id: string, srv: Partial<Service>) => {
    await callApi(`/api/services/${id}`, 'PUT', srv);
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...srv } : s));
  };
  const handleDeleteService = async (id: string) => {
    await callApi(`/api/services/${id}`, 'DELETE');
    setServices(prev => prev.filter(s => s.id !== id));
  };

  // 2. Workspaces, folders, Tasks
  const handleAddWorkspace = async (ws: Partial<Workspace>) => {
    const data = await callApi('/api/workspaces', 'POST', ws);
    if (data) { setWorkspaces(prev => [...prev, data]); return data; }
  };
  const handleUpdateWorkspace = async (id: string, ws: Partial<Workspace>) => {
    await callApi(`/api/workspaces/${id}`, 'PUT', ws);
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...ws } : w));
  };
  const handleDeleteWorkspace = async (id: string) => {
    await callApi(`/api/workspaces/${id}`, 'DELETE');
    setWorkspaces(prev => prev.filter(w => w.id !== id));
    setFolders(prev => prev.filter(f => f.workspaceId !== id));
    setTasks(prev => prev.filter(t => t.workspaceId !== id));
  };
  const handleAddFolder = async (folder: Partial<DBFolder>) => {
    const data = await callApi('/api/folders', 'POST', folder);
    if (data) { setFolders(prev => [...prev, data]); return data; }
  };
  const handleUpdateFolder = async (id: string, folder: Partial<DBFolder>) => {
    await callApi(`/api/folders/${id}`, 'PUT', folder);
    setFolders(prev => prev.map(f => f.id === id ? { ...f, ...folder } : f));
  };
  const handleDeleteFolder = async (id: string) => {
    await callApi(`/api/folders/${id}`, 'DELETE');
    setFolders(prev => prev.filter(f => f.id !== id));
    setTasks(prev => prev.filter(t => t.folderId !== id));
  };

  const handleAddTask = async (task: Partial<Task>) => {
    const data = await callApi('/api/tasks', 'POST', task);
    if (data) setTasks(prev => [...prev, data]);
  };
  const handleUpdateTask = async (id: string, task: Partial<Task>) => {
    const data = await callApi(`/api/tasks/${id}`, 'PUT', task);
    if (data) setTasks(prev => prev.map(t => t.id === id ? data : t));
  };
  const handleDeleteTask = async (id: string) => {
    await callApi(`/api/tasks/${id}`, 'DELETE');
    setTasks(prev => prev.filter(t => t.id !== id));
  };
  const handleReorderTasks = async (updates: { id: string; status: TaskStatus; taskOrder: number }[]) => {
    const data = await callApi('/api/tasks/reorder', 'POST', { tasks: updates });
    if (data) {
      const updatedIds = new Set(updates.map(u => u.id));
      const updatedMap = new Map(updates.map(u => [u.id, u]));
      setTasks(prev => prev.map(t => updatedIds.has(t.id) ? { ...t, ...updatedMap.get(t.id) } : t));
    }
  };

  // 3b. Task Comments
  const handleAddTaskComment = async (taskId: string, comment: { text: string }): Promise<any> => {
    const data = await callApi(`/api/tasks/${taskId}/comments`, 'POST', { ...comment, userId: activeUserId, userName: currentUser?.name || 'Usuario', userAvatar: currentUser?.avatar });
    return data;
  };
  const handleDeleteTaskComment = async (taskId: string, commentId: string) => {
    await callApi(`/api/tasks/${taskId}/comments/${commentId}`, 'DELETE');
  };

  // 3. Todo-List
  const handleAddTodo = async (todo: Partial<PersonalTodo>) => {
    const data = await callApi('/api/todos', 'POST', todo);
    if (data) setPersonalTodos(prev => [...prev, data]);
  };
  const handleUpdateTodo = async (id: string, todo: Partial<PersonalTodo>) => {
    await callApi(`/api/todos/${id}`, 'PUT', todo);
    setPersonalTodos(prev => prev.map(t => t.id === id ? { ...t, ...todo } : t));
  };
  const handleDeleteTodo = async (id: string) => {
    await callApi(`/api/todos/${id}`, 'DELETE');
    setPersonalTodos(prev => prev.filter(t => t.id !== id));
  };

  // 4. Meetings
  const handleAddMeeting = async (meeting: Partial<Meeting>) => {
    const data = await callApi('/api/meetings', 'POST', meeting);
    if (data) setMeetings(prev => [...prev, data]);
  };
  const handleUpdateMeeting = async (id: string, meeting: Partial<Meeting>) => {
    await callApi(`/api/meetings/${id}`, 'PUT', meeting);
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, ...meeting } : m));
  };
  const handleDeleteMeeting = async (id: string) => {
    await callApi(`/api/meetings/${id}`, 'DELETE');
    setMeetings(prev => prev.filter(m => m.id !== id));
  };

  // 5. Secure passwords
  const handleAddCredential = async (cred: Partial<CredentialWeb>) => {
    const data = await callApi('/api/credentials', 'POST', cred);
    if (data) setCredentials(prev => [...prev, data]);
  };
  const handleUpdateCredential = async (id: string, cred: Partial<CredentialWeb>) => {
    await callApi(`/api/credentials/${id}`, 'PUT', cred);
    setCredentials(prev => prev.map(c => c.id === id ? { ...c, ...cred } : c));
  };
  const handleDeleteCredential = async (id: string) => {
    await callApi(`/api/credentials/${id}`, 'DELETE');
    setCredentials(prev => prev.filter(c => c.id !== id));
  };

  // 5. Chat Communication
  const handleAddChannel = async (chan: Partial<ChatChannel>) => {
    const data = await callApi('/api/channels', 'POST', chan);
    if (data) setChatChannels(prev => [...prev, data]);
  };
  const handleUpdateChannel = async (id: string, chan: Partial<ChatChannel>) => {
    await callApi(`/api/channels/${id}`, 'PUT', chan);
    setChatChannels(prev => prev.map(c => c.id === id ? { ...c, ...chan } : c));
  };
  const handleDeleteChannel = async (id: string) => {
    await callApi(`/api/channels/${id}`, 'DELETE');
    setChatChannels(prev => prev.filter(c => c.id !== id));
    setChatMessages(prev => prev.filter(m => m.channelId !== id));
  };
  const handleSendMessage = async (channelId: string, userId: string, text: string, attachments?: MessageAttachment[]) => {
    const data = await callApi('/api/messages', 'POST', { channelId, userId, text, attachments });
    if (data) setChatMessages(prev => [...prev, data]);
  };
  const handleDeleteMessage = async (id: string) => {
    await callApi(`/api/messages/${id}`, 'DELETE');
    setChatMessages(prev => prev.filter(m => m.id !== id));
  };
  
  const handleRefreshMessages = async (channelId: string) => {
    try {
      const msgs = await fetch(`/api/messages/${channelId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      if (Array.isArray(msgs)) setChatMessages(msgs);
    } catch (e) {
      console.error(e);
    }
  };

  // 6. Tickets
  const handleAddTicketAndNotify = async (ticket: Partial<SupportTicket> & { initialComment?: string }) => {
    const data = await callApi('/api/tickets', 'POST', ticket);
    if (data) setTickets(prev => [...prev, data]);
  };
  const handleUpdateTicket = async (id: string, ticket: Partial<SupportTicket>) => {
    await callApi(`/api/tickets/${id}`, 'PUT', ticket);
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...ticket } : t));
  };
  const handleDeleteTicket = async (id: string) => {
    await callApi(`/api/tickets/${id}`, 'DELETE');
    setTickets(prev => prev.filter(t => t.id !== id));
  };
  const handleAddCommentToTicket = async (ticketId: string, payload: any) => {
    const data = await callApi(`/api/tickets/${ticketId}/comments`, 'POST', payload);
    if (data) setTickets(prev => prev.map(t => t.id === ticketId ? data : t));
  };
  const handleAddMeetingMinute = async (mm: Partial<MeetingMinute>) => {
    const data = await callApi('/api/meeting-minutes', 'POST', mm);
    if (data) setMeetingMinutes(prev => [data, ...prev]);
  };
  const handleUpdateMeetingMinute = async (id: string, mm: Partial<MeetingMinute>) => {
    await callApi(`/api/meeting-minutes/${id}`, 'PUT', mm);
    setMeetingMinutes(prev => prev.map(m => m.id === id ? { ...m, ...mm } : m));
  };
  const handleDeleteMeetingMinute = async (id: string) => {
    await callApi(`/api/meeting-minutes/${id}`, 'DELETE');
    setMeetingMinutes(prev => prev.filter(m => m.id !== id));
  };

  // Vendor Leads CRUD
  const handleAddVendorLead = async (lead: Partial<VendorLead>) => {
    const data = await callApi('/api/vendor-leads', 'POST', lead);
    if (data) setVendorLeads(prev => [data, ...prev]);
  };
  const handleUpdateVendorLead = async (id: string, lead: Partial<VendorLead>) => {
    const data = await callApi(`/api/vendor-leads/${id}`, 'PUT', lead);
    if (data) setVendorLeads(prev => prev.map(l => l.id === id ? data : l));
  };
  const handleDeleteVendorLead = async (id: string) => {
    await callApi(`/api/vendor-leads/${id}`, 'DELETE');
    setVendorLeads(prev => prev.filter(l => l.id !== id));
  };

  // Mark notifications locally without refetch
  const handleMarkAllNotifications = async () => {
    if (!activeUserId) return;
    await callApi(`/api/notifications/user/${activeUserId}/read-all`, 'PUT');
    setNotifications(prev => prev.map(n => n.userId === activeUserId ? { ...n, read: true } : n));
  };

  const handleMarkNotificationSingle = async (nId: string) => {
    await callApi(`/api/notifications/${nId}/read`, 'PUT');
    setNotifications(prev => prev.map(n => n.id === nId ? { ...n, read: true } : n));
  };

  // Notification counting badge helper
  const unreadCount = notifications.filter(n => !n.read).length;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-2 font-sans text-[#37352F]">
        <div className="w-5 h-5 border-2 border-[#EDEDEB] border-t-[#37352F] rounded-full animate-spin"></div>
        <p className="text-xs text-[#91918E] font-medium font-mono">Verificando sesión...</p>
      </div>
    );
  }

  // Render client public portal view directly if selected (no auth required)
  if (accessMode === 'public') {
    return (
      <div className="min-h-screen bg-[#FBFBFB] text-[#37352F] font-sans" id="public-main-stage">
        <div className="max-w-5xl mx-auto p-4 sm:p-6">
          <div className="flex items-center justify-between border-b border-[#EDEDEB] pb-4 mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neutral-700" />
              <span className="font-semibold text-[#37352F] tracking-tight text-sm">Iceberg Agency — Portal de Soporte</span>
            </div>
            {!isPublicPath && (
              <button
                onClick={() => {
                  setAccessMode('internal');
                  setActiveTab('dashboard');
                }}
                className="px-3 py-1.5 bg-[#37352F] text-white rounded text-xs font-medium hover:bg-opacity-90 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                ← Volver a la Intranet
              </button>
            )}
          </div>

          <PublicTicketForm />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-2 font-sans text-[#37352F]">
        <div className="w-5 h-5 border-2 border-[#EDEDEB] border-t-[#37352F] rounded-full animate-spin"></div>
        <p className="text-xs text-[#91918E] font-medium font-mono">Cargando Workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans flex text-[#37352F] relative" id="intranet-panel">
      
      {/* Mobile overlay backdrop */}
      <ToastContainer />
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 1. LEFT NAVIGATION SIDEBAR (Notion Style) */}
      <aside className={`
        fixed top-0 left-0 z-50
        w-64 p-5
        border-r border-[#EDEDEB] bg-[#F7F7F5] 
        flex flex-col justify-between h-screen overflow-y-auto
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `} id="sidebar-container">
        
        <div className="space-y-6">
          {/* Brand/Logo header */}
          <div className="flex items-center justify-between border-b border-[#EDEDEB] pb-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Iceberg Agency Logo" className="w-6 h-6 object-contain" />
              <div>
                <h2 className="font-semibold text-sm tracking-tight text-[#37352F]">Iceberg Agency</h2>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-[#EDEDEB] rounded text-[#5A5A57] cursor-pointer" title="Cerrar menú">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Access Switch to Public Ticket Portal */}
          <div className="p-3 bg-white border border-[#EDEDEB] rounded-md space-y-2">
            <span className="block text-[9px] text-[#91918E] font-bold uppercase tracking-wider">Portal Público</span>
            <p className="text-[10px] text-[#5A5A57] leading-relaxed">Envía tickets como cliente externo o comparte el enlace único.</p>
            <button
              onClick={() => {
                setAccessMode('public');
              }}
              className="w-full text-center py-1.5 bg-[#37352F] text-white hover:bg-[#2383E2] transition-colors text-[10px] font-semibold rounded flex items-center justify-center gap-1 cursor-pointer"
            >
              Abrir Portal Público ↗
            </button>
            {!isPublicPath && (
              <button
                onClick={() => {
                  const url = window.location.origin + '/solicitudes';
                  navigator.clipboard.writeText(url);
                  showToast('Enlace copiado: ' + url, 'success');
                }}
                className="w-full text-center py-1 bg-[#F7F7F5] border border-[#EDEDEB] text-[#5A5A57] hover:bg-[#EDEDEB] transition-colors text-[9px] font-medium rounded flex items-center justify-center gap-1 cursor-pointer mt-1"
              >
                Copiar enlace público
              </button>
            )}
          </div>

          {/* Menu Sections Block */}
          <nav className="space-y-5" id="main-sidebar-navigation-box">
            <div>
              <span className="block text-[10px] text-[#91918E] uppercase tracking-wider font-semibold mb-2">Administración</span>
              
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors font-medium flex items-center justify-between ${
                    activeTab === 'dashboard' ? 'bg-[#EDEDEB] text-[#37352F]' : 'text-[#5A5A57] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`}
                >
                  <span>Dashboard Principal</span>
                </button>

                {hasPermission('manage_crm') && (
                <button
                  onClick={() => setActiveTab('pipeline')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors font-medium flex items-center justify-between ${
                    activeTab === 'pipeline' ? 'bg-[#EDEDEB] text-[#37352F]' : 'text-[#5A5A57] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`}
                >
                  <span>CRM / Ventas</span>
                </button>
                )}

                {hasPermission('manage_crm') && (
                <button
                  onClick={() => setActiveTab('vendor_reports')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors font-medium flex items-center justify-between ${
                    activeTab === 'vendor_reports' ? 'bg-[#EDEDEB] text-[#37352F]' : 'text-[#5A5A57] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`}
                >
                  <span>Reportes Vendedores</span>
                </button>
                )}

                {hasPermission('manage_workspaces') && (
                <button
                  onClick={() => setActiveTab('workspaces')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors font-medium flex items-center justify-between ${
                    activeTab === 'workspaces' ? 'bg-[#EDEDEB] text-[#37352F]' : 'text-[#5A5A57] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`}
                >
                  <span className="flex items-center gap-1">Kanban & Workspaces</span>
                  <span className="bg-[#EDEDEB] text-[#5A5A57] text-[9px] px-1 rounded font-medium font-mono">
                    {workspaces.length}
                  </span>
                </button>
                )}

                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors font-medium flex items-center justify-between ${
                    activeTab === 'calendar' ? 'bg-[#EDEDEB] text-[#37352F]' : 'text-[#5A5A57] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`}
                >
                  <span>Calendario & Todo</span>
                </button>

                <button
                  onClick={() => setActiveTab('actas')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors font-medium flex items-center justify-between ${
                    activeTab === 'actas' ? 'bg-[#EDEDEB] text-[#37352F]' : 'text-[#5A5A57] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`}
                >
                  <span>Actas de Reunión</span>
                </button>
              </div>
            </div>

            <div>
              <span className="block text-[10px] text-[#91918E] uppercase tracking-wider font-semibold mb-2">Asistente</span>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('assistant')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors font-medium flex items-center justify-between ${
                    activeTab === 'assistant' ? 'bg-[#EDEDEB] text-[#37352F]' : 'text-[#5A5A57] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`}
                >
                  <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Asistente IA</span>
                </button>
              </div>
            </div>

            <div>
              <span className="block text-[10px] text-[#91918E] uppercase tracking-wider font-semibold mb-2">Seguridad & Datos</span>
              
              <div className="space-y-0.5">
              {hasPermission('manage_credentials') && (
                <button
                  onClick={() => setActiveTab('credentials')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors font-medium flex items-center justify-between ${
                    activeTab === 'credentials' ? 'bg-[#EDEDEB] text-[#37352F]' : 'text-[#5A5A57] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`}
                >
                  <span>Bóveda Credenciales</span>
                </button>
              )}

              {(hasPermission('manage_users') || hasPermission('manage_roles')) && (
                <button
                  onClick={() => setActiveTab('rbac')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors font-medium flex items-center justify-between ${
                    activeTab === 'rbac' ? 'bg-[#EDEDEB] text-[#37352F]' : 'text-[#5A5A57] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`}
                >
                  <span>Roles & Personal</span>
                </button>
              )}
              </div>
            </div>

            <div>
              <span className="block text-[10px] text-[#91918E] uppercase tracking-wider font-semibold mb-2">Comunicación</span>
              
              <div className="space-y-0.5">
              {hasPermission('chat_all') && (
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors font-medium flex items-center justify-between ${
                    activeTab === 'chat' ? 'bg-[#EDEDEB] text-[#37352F]' : 'text-[#5A5A57] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`}
                >
                  <span>Chat Interno</span>
                </button>
              )}

              {hasPermission('view_all_tickets') && (
                <button
                  onClick={() => setActiveTab('tickets')}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors font-medium flex items-center justify-between ${
                    activeTab === 'tickets' ? 'bg-[#EDEDEB] text-[#37352F]' : 'text-[#5A5A57] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`}
                >
                  <span>Tickets Soporte</span>
                  {tickets.filter(t => t.status === 'open').length > 0 && (
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                  )}
                </button>
              )}

              </div>
            </div>
          </nav>
        </div>

        {/* User context footer with logout */}
        <div className="pt-4 border-t border-[#EDEDEB] text-xs">
          <div className="flex items-center gap-2.5 mb-2">
            <UserAvatar name={currentUser?.name} avatar={currentUser?.avatar} size={32} className="border border-[#EDEDEB]" />
            <div className="truncate">
              <p className="font-semibold text-[#37352F] truncate tracking-tight flex items-center gap-1">
                {currentUser ? currentUser.name : 'Usuario'}
                <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
              </p>
              <span className="block text-[10px] text-[#91918E] capitalize">{currentRole ? currentRole.name : 'Miembro'}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-[#91918E] hover:text-red-500 hover:bg-red-50 rounded transition-colors font-medium cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* 2. MAIN CENTER CONTENT STAGE */}
      <main className="flex-1 min-h-screen bg-white flex flex-col p-4 sm:p-6 lg:p-8 space-y-6" id="applet-center-content">
        
        {/* Dynamic header navbar containing live status and notifications */}
        <div className="flex items-center justify-between p-3 bg-white border border-[#EDEDEB] rounded-lg shadow-sm" id="quick-action-header-nav">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 hover:bg-[#F1F1EF] rounded transition-colors cursor-pointer"
              title={sidebarOpen ? "Cerrar menú lateral" : "Abrir menú lateral"}
            >
              <Menu className="w-4 h-4 text-[#5A5A57]" />
            </button>

            {isSyncing && (
              <span className="text-[10px] text-[#91918E] font-medium italic animate-pulse">Sincronizando...</span>
            )}
          </div>

          <div className="flex items-center gap-5">
            {/* Quick access to Switch profile helper directly */}
            {(hasPermission('manage_users') || hasPermission('manage_roles')) && (
              <button
                onClick={() => setActiveTab('rbac')}
                className="text-xs text-[#5A5A57] hover:text-[#37352F] font-medium flex items-center gap-1 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" /> Administrar Roles
              </button>
            )}

            {/* Notification drop center */}
            <div className="relative group/noti cursor-pointer">
              <div className="flex items-center gap-1 p-1 hover:bg-[#F1F1EF] rounded transition-colors relative">
                <Bell className="w-4 h-4 text-[#5A5A57] hover:text-[#37352F]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white font-mono text-[8px] h-3.5 w-3.5 rounded-full flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>

              {/* Notification drop drawer hover */}
              <div className="absolute right-0 top-6 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-white border border-[#EDEDEB] rounded-lg shadow-md p-3 hidden group-hover/noti:block z-40 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#EDEDEB] font-bold text-[#37352F]">
                  <span>Notificaciones</span>
                  <button 
                    onClick={handleMarkAllNotifications}
                    className="text-[10px] text-[#91918E] hover:text-[#37352F] hover:underline"
                  >
                    Marcar todo leído
                  </button>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto" id="notifications-tray">
                  {notifications.map(not => (
                    <div 
                      key={not.id} 
                      onClick={() => handleMarkNotificationSingle(not.id)}
                      className={`p-2.5 rounded border text-[11px] leading-relaxed transition-all cursor-pointer ${
                        not.read ? 'bg-white text-[#91918E] border-[#EDEDEB]' : 'bg-[#F7F7F5] text-[#37352F] border-[#EDEDEB]'
                      }`}
                    >
                      <p>{not.text}</p>
                      <span className="block text-[8px] text-[#91918E] font-mono mt-1">
                        {new Date(not.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}

                  {notifications.length === 0 && (
                    <div className="text-center py-6 text-[#91918E] text-[10px]">
                      No tienes alertas pendientes.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. CONDITIONAL MODULE RENDERER */}
        <section className="flex-1" id="active-tab-port">
          
          {activeTab === 'dashboard' && (
            <DashboardView 
              tasks={tasks}
              clients={clients}
              quotes={quotes}
              contracts={contracts}
              users={users}
              tickets={tickets}
            />
          )}

          {activeTab === 'pipeline' && (
            <div className="animate-fade-in">
              {hasPermission('manage_crm') ? (
                <PipelineView
                  clients={clients}
                  quotes={quotes}
                  contracts={contracts}
                  services={services}
                  onAddClient={handleAddClient}
                  onUpdateClient={handleUpdateClient}
                  onDeleteClient={handleDeleteClient}
                  onAddQuote={handleAddQuote}
                  onUpdateQuote={handleUpdateQuote}
                  onDeleteQuote={handleDeleteQuote}
                  onAddContract={handleAddContract}
                  onUpdateContract={handleUpdateContract}
                  onDeleteContract={handleDeleteContract}
                  onAddService={handleAddService}
                  onUpdateService={handleUpdateService}
                  onDeleteService={handleDeleteService}
                />
              ) : (
                <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-1 border border-dashed rounded-lg bg-white">
                  <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
                  <span className="font-bold text-neutral-800">Acceso Comercial Restringido por RBAC</span>
                  <span className="text-xs">Asigna a tu usuario activo un rol con permisos CRM (ej. Administrador / CEO) para acceder a reportes e ingresos.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'vendor_reports' && (
            <div className="animate-fade-in">
              {hasPermission('manage_crm') ? (
                <VendorReportsView
                  vendorLeads={vendorLeads}
                  users={users}
                  activeUserId={activeUserId}
                  onAdd={handleAddVendorLead}
                  onUpdate={handleUpdateVendorLead}
                  onDelete={handleDeleteVendorLead}
                />
              ) : (
                <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-1 border border-dashed rounded-lg bg-white">
                  <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
                  <span className="font-bold text-neutral-800">Acceso Restringido</span>
                  <span className="text-xs">Se requiere permisos CRM para acceder a Reportes de Vendedores.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'workspaces' && (
            <div className="animate-fade-in">
              {hasPermission('manage_workspaces') ? (
                <WorkspaceView
                  workspaces={workspaces}
                  folders={folders}
                  tasks={tasks}
                  users={users}
                  onAddWorkspace={handleAddWorkspace}
                  onDeleteWorkspace={handleDeleteWorkspace}
                  onUpdateWorkspace={handleUpdateWorkspace}
                  onAddFolder={handleAddFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onUpdateFolder={handleUpdateFolder}
                  onAddTask={handleAddTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  onReorderTasks={handleReorderTasks}
                  onAddTaskComment={handleAddTaskComment}
                  onDeleteTaskComment={handleDeleteTaskComment}
                  activeUserId={activeUserId}
                />
              ) : (
                <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-1 border border-dashed rounded-lg bg-white">
                  <ShieldAlert className="w-8 h-8 text-neutral-400" />
                  <span className="font-bold text-neutral-800">Sin Permisos para Gestionar Carpetas y Kanban</span>
                  <span className="text-xs">Usa el probador rbac arriba para cambiar tu rol de visualización.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="animate-fade-in">
              <CalendarTodoView
                personalTodos={personalTodos}
                meetings={meetings}
                tasks={tasks}
                users={users}
                activeUserId={activeUserId}
                onAddTodo={handleAddTodo}
                onUpdateTodo={handleUpdateTodo}
                onDeleteTodo={handleDeleteTodo}
                onAddMeeting={handleAddMeeting}
                onUpdateMeeting={handleUpdateMeeting}
                onDeleteMeeting={handleDeleteMeeting}
              />
            </div>
          )}

          {activeTab === 'credentials' && (
            <div className="animate-fade-in">
              {hasPermission('manage_credentials') ? (
                <CredentialsView
                  credentials={credentials}
                  onAddCredential={handleAddCredential}
                  onUpdateCredential={handleUpdateCredential}
                  onDeleteCredential={handleDeleteCredential}
                />
              ) : (
                <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-1 border border-dashed rounded-lg bg-white">
                  <ShieldAlert className="w-8 h-8 text-red-500" />
                  <span className="font-bold text-neutral-800">Contraseñas Bloqueadas</span>
                  <span className="text-xs">Debes poseer el permiso "view_credentials" / "manage_credentials" para auditar tokens y APIs de servidores.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'rbac' && (
            <div className="animate-fade-in">
              {hasPermission('manage_users') || hasPermission('manage_roles') ? (
                <UserRoleView
                  users={users}
                  roles={roles}
                  activeUserId={activeUserId}
                  onAddUser={async (user) => {
                    const data = await callApi('/api/users', 'POST', user);
                    if (data) setUsers(prev => [...prev, data]);
                  }}
                  onUpdateUser={async (id, updates) => {
                    const data = await callApi(`/api/users/${id}`, 'PUT', updates);
                    if (data) setUsers(prev => prev.map(u => u.id === id ? data : u));
                  }}
                  onDeleteUser={async (id) => {
                    await callApi(`/api/users/${id}`, 'DELETE');
                    setUsers(prev => prev.filter(u => u.id !== id));
                  }}
                  onAddRole={async (role) => {
                    const data = await callApi('/api/roles', 'POST', role);
                    if (data) setRoles(prev => [...prev, data]);
                  }}
                  onUpdateRole={async (id, role) => {
                    const data = await callApi(`/api/roles/${id}`, 'PUT', role);
                    if (data) setRoles(prev => prev.map(r => r.id === id ? data : r));
                  }}
                  onDeleteRole={async (id) => {
                    await callApi(`/api/roles/${id}`, 'DELETE');
                    setRoles(prev => prev.filter(r => r.id !== id));
                  }}
                />
              ) : (
                <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-1 border border-dashed rounded-lg bg-white">
                  <ShieldAlert className="w-8 h-8 text-neutral-400" />
                  <span className="font-bold text-neutral-800">Acceso Restringido</span>
                  <span className="text-xs">No tienes permisos para gestionar usuarios y roles.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="animate-fade-in">
              {hasPermission('chat_all') ? (
                <ChatView
                  channels={chatChannels}
                  messages={chatMessages}
                  users={users}
                  activeUserId={activeUserId}
                  onAddChannel={handleAddChannel}
                  onSendMessage={handleSendMessage}
                  onRefreshMessages={handleRefreshMessages}
                  onUpdateChannel={handleUpdateChannel}
                  onDeleteChannel={handleDeleteChannel}
                  onDeleteMessage={handleDeleteMessage}
                />
              ) : (
                <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-1 border border-dashed rounded-lg bg-white">
                  <ShieldAlert className="w-8 h-8 text-neutral-400" />
                  <span className="font-bold text-neutral-800">Salas de Chat Privadas</span>
                  <span className="text-xs">Tu perfil corporativo requiere autorización de mensajería para chatear con ingenieros.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="animate-fade-in">
              {hasPermission('view_all_tickets') ? (
                <TicketsView
                  tickets={tickets}
                  activeUserEmail={currentUser?.email || ''}
                  activeUserName={currentUser?.name || ''}
                  onUpdateTicket={handleUpdateTicket}
                  onAddComment={handleAddCommentToTicket}
                  onDeleteTicket={handleDeleteTicket}
                />
              ) : (
                <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center gap-1 border border-dashed rounded-lg bg-white">
                  <ShieldAlert className="w-8 h-8 text-neutral-400" />
                  <span className="font-bold text-neutral-800">Atención a Tickets Restringido</span>
                  <span className="text-xs">Cambia a perfil "Administrador / CEO" o de soporte técnico para interactuar comercialmente con tickets públicos de clientes.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'assistant' && (
            <div className="animate-fade-in h-full">
              <AIAssistantView token={token} />
            </div>
          )}

          {activeTab === 'actas' && (
            <div className="animate-fade-in h-full">
              <MeetingMinutesView 
                meetingMinutes={meetingMinutes} 
                onAdd={handleAddMeetingMinute} 
                onUpdate={handleUpdateMeetingMinute} 
                onDelete={handleDeleteMeetingMinute} 
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
