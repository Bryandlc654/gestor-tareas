import { executeQuery } from './mysql';
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from './redis';
import type {
  User, Role, Workspace, Folder, Task, PersonalTodo, Meeting, Client,
  Quote, Contract, Service, CredentialWeb, ChatChannel,
  ChatMessage, Notification, SupportTicket, TicketComment, TicketClient,
  PortfolioItem, AgencyInfo, TaskComment, FCMToken, MeetingMinute
} from '../types';

const CACHE_PREFIX = 'dao:';

function cacheKey(entity: string, id?: string): string {
  return `${CACHE_PREFIX}${entity}${id ? ':' + id : ''}`;
}

function mapRow<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    if (typeof val === 'string') {
      try { result[key] = JSON.parse(val); continue; } catch { /* not JSON */ }
    }
    result[key] = val;
  }
  return result as T;
}

function parseJSON(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

// --- AGENCY INFO ---
export async function getAgencyInfo(): Promise<AgencyInfo | null> {
  const key = cacheKey('agency');
  const cached = await cacheGet<AgencyInfo>(key);
  if (cached) return cached;
  const rows = await executeQuery('SELECT * FROM agency_info LIMIT 1');
  if (!rows.length) return null;
  const row = rows[0];
  const info: AgencyInfo = { name: row.name, tagline: row.tagline, description: row.description, skills: parseJSON(row.skills) };
  await cacheSet(key, info);
  return info;
}

export async function upsertAgencyInfo(data: Partial<AgencyInfo>): Promise<AgencyInfo> {
  const existing = await getAgencyInfo();
  if (existing) {
    await executeQuery('UPDATE agency_info SET name=?, tagline=?, description=?, skills=? WHERE id=?',
      [data.name ?? existing.name, data.tagline ?? existing.tagline, data.description ?? existing.description, JSON.stringify(data.skills ?? existing.skills), 'main']);
  } else {
    await executeQuery('INSERT INTO agency_info (id,name,tagline,description,skills) VALUES (?,?,?,?,?)',
      ['main', data.name ?? '', data.tagline ?? '', data.description ?? '', JSON.stringify(data.skills ?? [])]);
  }
  await cacheDel(cacheKey('agency'));
  return (await getAgencyInfo())!;
}

// --- PORTFOLIO ---
export async function listPortfolio(): Promise<PortfolioItem[]> {
  const key = cacheKey('portfolio');
  const cached = await cacheGet<PortfolioItem[]>(key);
  if (cached) return cached;
  const rows = await executeQuery('SELECT * FROM portfolio ORDER BY id LIMIT 100000');
  const items: PortfolioItem[] = rows.map((r: any) => ({ id: r.id, title: r.title, description: r.description, image: r.image, category: r.category, clientUrl: r.clientUrl }));
  await cacheSet(key, items);
  return items;
}

export async function createPortfolio(data: PortfolioItem): Promise<void> {
  await executeQuery('INSERT INTO portfolio (id,title,description,image,category,clientUrl) VALUES (?,?,?,?,?,?)',
    [data.id, data.title, data.description, data.image, data.category, data.clientUrl ?? '']);
  await cacheDel(cacheKey('portfolio'));
}

export async function deletePortfolio(id: string): Promise<boolean> {
  const result = await executeQuery('DELETE FROM portfolio WHERE id=?', [id]);
  await cacheDel(cacheKey('portfolio'));
  return result.affectedRows > 0;
}

export async function updatePortfolioItem(id: string, data: Partial<PortfolioItem>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE portfolio SET ${sets} WHERE id=?`, vals);
  await cacheDel(cacheKey('portfolio'));
  return result.affectedRows > 0;
}

// --- ROLES ---
export async function listRoles(): Promise<Role[]> {
  const key = cacheKey('roles');
  const cached = await cacheGet<Role[]>(key);
  if (cached) return cached;
  const rows = await executeQuery('SELECT * FROM roles LIMIT 100000');
  const items: Role[] = rows.map((r: any) => ({ id: r.id, name: r.name, description: r.description, permissions: parseJSON(r.permissions) }));
  await cacheSet(key, items);
  return items;
}

export async function getRoleById(id: string): Promise<Role | null> {
  const rows = await executeQuery('SELECT * FROM roles WHERE id=? LIMIT 1', [id]);
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, name: r.name, description: r.description, permissions: parseJSON(r.permissions) };
}

export async function createRole(data: Role): Promise<void> {
  await executeQuery('INSERT INTO roles (id,name,description,permissions) VALUES (?,?,?,?)',
    [data.id, data.name, data.description, JSON.stringify(data.permissions)]);
  await cacheDel(cacheKey('roles'));
}

export async function updateRole(id: string, data: Partial<Role>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => f === 'permissions' ? `${f}=?` : `${f}=?`).join(',');
  const vals = fields.map(f => f === 'permissions' ? JSON.stringify((data as any)[f]) : (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE roles SET ${sets} WHERE id=?`, vals);
  await cacheDel(cacheKey('roles'));
  return result.affectedRows > 0;
}

export async function deleteRole(id: string): Promise<boolean> {
  await cacheDel(cacheKey('roles'));
  const result = await executeQuery('DELETE FROM roles WHERE id=?', [id]);
  return result.affectedRows > 0;
}

// --- USERS ---
export async function listUsers(): Promise<User[]> {
  const rows = await executeQuery('SELECT id,name,email,password,roleId,avatar,status FROM users LIMIT 100000');
  return rows.map((r: any) => ({ id: r.id, name: r.name, email: r.email, password: r.password, roleId: r.roleId, avatar: r.avatar, status: r.status }));
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await executeQuery('SELECT * FROM users WHERE email=? LIMIT 1', [email]);
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, name: r.name, email: r.email, password: r.password, roleId: r.roleId, avatar: r.avatar, status: r.status };
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await executeQuery('SELECT * FROM users WHERE id=? LIMIT 1', [id]);
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, name: r.name, email: r.email, password: r.password, roleId: r.roleId, avatar: r.avatar, status: r.status };
}

export async function createUser(data: User): Promise<void> {
  await executeQuery('INSERT INTO users (id,name,email,password,roleId,avatar,status) VALUES (?,?,?,?,?,?,?)',
    [data.id, data.name, data.email, data.password, data.roleId, data.avatar, data.status]);
}

export async function updateUser(id: string, data: Partial<User>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE users SET ${sets} WHERE id=?`, vals);
  return result.affectedRows > 0;
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await executeQuery('DELETE FROM users WHERE id=?', [id]);
  return result.affectedRows > 0;
}

// --- WORKSPACES ---
export async function listWorkspaces(): Promise<Workspace[]> {
  const key = cacheKey('workspaces');
  const cached = await cacheGet<Workspace[]>(key);
  if (cached) return cached;
  const rows = await executeQuery('SELECT * FROM workspaces LIMIT 100000');
  const items: Workspace[] = rows.map((r: any) => ({ id: r.id, name: r.name, icon: r.icon, description: r.description }));
  await cacheSet(key, items);
  return items;
}

export async function createWorkspace(data: Workspace): Promise<void> {
  await executeQuery('INSERT INTO workspaces (id,name,icon,description) VALUES (?,?,?,?)',
    [data.id, data.name, data.icon, data.description]);
  await cacheDel(cacheKey('workspaces'));
}

export async function updateWorkspace(id: string, data: Partial<Workspace>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE workspaces SET ${sets} WHERE id=?`, vals);
  await cacheDel(cacheKey('workspaces'));
  return result.affectedRows > 0;
}

export async function deleteWorkspace(id: string): Promise<void> {
  await executeQuery('DELETE FROM tasks WHERE workspaceId=?', [id]);
  await executeQuery('DELETE FROM folders WHERE workspaceId=?', [id]);
  await executeQuery('DELETE FROM workspaces WHERE id=?', [id]);
  await cacheDelPattern(cacheKey('*'));
}

// --- FOLDERS ---
export async function listFolders(): Promise<Folder[]> {
  const rows = await executeQuery('SELECT * FROM folders LIMIT 100000');
  return rows.map((r: any) => ({ id: r.id, workspaceId: r.workspaceId, name: r.name }));
}

export async function createFolder(data: Folder): Promise<void> {
  await executeQuery('INSERT INTO folders (id,workspaceId,name) VALUES (?,?,?)', [data.id, data.workspaceId, data.name]);
}

export async function deleteFolder(id: string): Promise<void> {
  await executeQuery('DELETE FROM tasks WHERE folderId=?', [id]);
  await executeQuery('DELETE FROM folders WHERE id=?', [id]);
}

export async function updateFolder(id: string, data: Partial<Folder>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE folders SET ${sets} WHERE id=?`, vals);
  return result.affectedRows > 0;
}

// --- TASKS ---
export async function listTasks(): Promise<Task[]> {
  const rows = await executeQuery('SELECT t.*, (SELECT COUNT(*) FROM task_comments c WHERE c.taskId = t.id) as commentsCount FROM tasks t LIMIT 100000');
  return rows.map((r: any) => parseTaskRow(r));
}

const TASK_JSON_FIELDS = ['tags', 'checklist', 'attachments', 'links', 'assignedTo'];

export async function createTask(data: Task): Promise<void> {
  await executeQuery('INSERT INTO tasks (id,folderId,workspaceId,title,description,status,priority,dueDate,assignedTo,tags,checklist,attachments,links,taskOrder) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [data.id, data.folderId, data.workspaceId, data.title, data.description, data.status, data.priority, data.dueDate, JSON.stringify(data.assignedTo ?? []), JSON.stringify(data.tags ?? []), JSON.stringify(data.checklist ?? []), JSON.stringify(data.attachments ?? []), JSON.stringify(data.links ?? []), data.taskOrder ?? 0]);
}

export async function updateTask(id: string, data: Partial<Task>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => TASK_JSON_FIELDS.includes(f) ? JSON.stringify((data as any)[f] ?? []) : (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE tasks SET ${sets} WHERE id=?`, vals);
  return result.affectedRows > 0;
}

function parseTaskRow(r: any): Task {
  let assignedTo: string[] = [];
  if (r.assignedTo) {
    try { assignedTo = JSON.parse(r.assignedTo); } catch { assignedTo = [r.assignedTo]; }
  }
  return {
    id: r.id, folderId: r.folderId, workspaceId: r.workspaceId,
    title: r.title, description: r.description, status: r.status, priority: r.priority,
    dueDate: r.dueDate, assignedTo,
    tags: parseJSON(r.tags) || [],
    checklist: parseJSON(r.checklist) || [],
    attachments: parseJSON(r.attachments) || [],
    links: parseJSON(r.links) || [],
    taskOrder: r.taskOrder ?? 0,
    commentsCount: r.commentsCount ? Number(r.commentsCount) : 0
  };
}

export async function deleteTask(id: string): Promise<void> {
  await executeQuery('DELETE FROM tasks WHERE id=?', [id]);
}

// --- PERSONAL TODOS ---
export async function listTodos(): Promise<PersonalTodo[]> {
  const rows = await executeQuery('SELECT * FROM personal_todos LIMIT 100000');
  return rows.map((r: any) => ({ id: r.id, userId: r.userId, title: r.title, status: r.status }));
}

export async function createTodo(data: PersonalTodo): Promise<void> {
  await executeQuery('INSERT INTO personal_todos (id,userId,title,status) VALUES (?,?,?,?)', [data.id, data.userId, data.title, data.status]);
}

export async function updateTodo(id: string, data: Partial<PersonalTodo>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE personal_todos SET ${sets} WHERE id=?`, vals);
  return result.affectedRows > 0;
}

export async function deleteTodo(id: string): Promise<void> {
  await executeQuery('DELETE FROM personal_todos WHERE id=?', [id]);
}

// --- MEETINGS ---
export async function listMeetings(): Promise<Meeting[]> {
  const rows = await executeQuery('SELECT * FROM meetings ORDER BY date ASC, time ASC LIMIT 100000');
  return rows.map((r: any) => ({
    id: r.id, userId: r.userId, title: r.title, description: r.description,
    date: r.date, time: r.time, attendees: r.attendees || '',
    link: r.link || '', assignedTo: parseJSON(r.assignedTo),
    reminderMinutes: r.reminderMinutes ?? 0, status: r.status,
    createdAt: r.createdAt || ''
  }));
}

export async function createMeeting(data: Meeting): Promise<void> {
  await executeQuery('INSERT INTO meetings (id,userId,title,description,date,time,attendees,link,assignedTo,reminderMinutes,status,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [data.id, data.userId, data.title, data.description, data.date, data.time, data.attendees, data.link || '', JSON.stringify(data.assignedTo || []), data.reminderMinutes, data.status, data.createdAt]);
}

export async function updateMeeting(id: string, data: Partial<Meeting>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE meetings SET ${sets} WHERE id=?`, vals);
  return result.affectedRows > 0;
}

export async function deleteMeeting(id: string): Promise<void> {
  await executeQuery('DELETE FROM meetings WHERE id=?', [id]);
}

// --- CLIENTS ---
export async function listClients(): Promise<Client[]> {
  const rows = await executeQuery('SELECT * FROM clients LIMIT 100000');
  return rows.map((r: any) => ({ id: r.id, name: r.name, company: r.company, email: r.email, phone: r.phone, status: r.status, revenue: Number(r.revenue) }));
}

export async function createClient(data: Client): Promise<void> {
  await executeQuery('INSERT INTO clients (id,name,company,email,phone,status,revenue) VALUES (?,?,?,?,?,?,?)',
    [data.id, data.name, data.company, data.email, data.phone, data.status, data.revenue ?? 0]);
}

export async function updateClient(id: string, data: Partial<Client>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE clients SET ${sets} WHERE id=?`, vals);
  return result.affectedRows > 0;
}

export async function deleteClient(id: string): Promise<void> {
  await executeQuery('DELETE FROM clients WHERE id=?', [id]);
}

// --- QUOTES ---
export async function listQuotes(): Promise<Quote[]> {
  const rows = await executeQuery('SELECT * FROM quotes LIMIT 100000');
  return rows.map((r: any) => ({ id: r.id, clientId: r.clientId, description: r.description, amount: Number(r.amount), status: r.status, date: r.date }));
}

export async function createQuote(data: Quote): Promise<void> {
  await executeQuery('INSERT INTO quotes (id,clientId,description,amount,status,date) VALUES (?,?,?,?,?,?)',
    [data.id, data.clientId, data.description, data.amount, data.status, data.date]);
}

export async function updateQuote(id: string, data: Partial<Quote>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE quotes SET ${sets} WHERE id=?`, vals);
  return result.affectedRows > 0;
}

export async function deleteQuote(id: string): Promise<void> {
  await executeQuery('DELETE FROM quotes WHERE id=?', [id]);
}

// --- CONTRACTS ---
export async function listContracts(): Promise<Contract[]> {
  const rows = await executeQuery('SELECT * FROM contracts LIMIT 100000');
  return rows.map((r: any) => ({ id: r.id, clientId: r.clientId, title: r.title, value: Number(r.value), status: r.status, startDate: r.startDate, endDate: r.endDate }));
}

export async function createContract(data: Contract): Promise<void> {
  await executeQuery('INSERT INTO contracts (id,clientId,title,value,status,startDate,endDate) VALUES (?,?,?,?,?,?,?)',
    [data.id, data.clientId, data.title, data.value, data.status, data.startDate, data.endDate]);
}

export async function updateContract(id: string, data: Partial<Contract>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE contracts SET ${sets} WHERE id=?`, vals);
  return result.affectedRows > 0;
}

export async function deleteContract(id: string): Promise<void> {
  await executeQuery('DELETE FROM contracts WHERE id=?', [id]);
}

// --- SERVICES ---
export async function listServices(): Promise<Service[]> {
  const rows = await executeQuery('SELECT * FROM services LIMIT 100000');
  return rows.map((r: any) => ({ id: r.id, name: r.name, description: r.description, price: Number(r.price), type: r.type }));
}

export async function createService(data: Service): Promise<void> {
  await executeQuery('INSERT INTO services (id,name,description,price,type) VALUES (?,?,?,?,?)',
    [data.id, data.name, data.description, data.price, data.type]);
}

export async function updateService(id: string, data: Partial<Service>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE services SET ${sets} WHERE id=?`, vals);
  return result.affectedRows > 0;
}

export async function deleteService(id: string): Promise<void> {
  await executeQuery('DELETE FROM services WHERE id=?', [id]);
}

// --- CREDENTIALS ---
export async function listCredentials(): Promise<CredentialWeb[]> {
  const rows = await executeQuery('SELECT * FROM credentials LIMIT 100000');
  return rows.map((r: any) => ({ id: r.id, title: r.title, url: r.url, username: r.username, password: r.password, notes: r.notes, category: r.category }));
}

export async function createCredential(data: CredentialWeb): Promise<void> {
  await executeQuery('INSERT INTO credentials (id,title,url,username,password,notes,category) VALUES (?,?,?,?,?,?,?)',
    [data.id, data.title, data.url, data.username, data.password, data.notes, data.category]);
}

export async function updateCredential(id: string, data: Partial<CredentialWeb>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE credentials SET ${sets} WHERE id=?`, vals);
  return result.affectedRows > 0;
}

export async function deleteCredential(id: string): Promise<void> {
  await executeQuery('DELETE FROM credentials WHERE id=?', [id]);
}

// --- CHAT CHANNELS ---
export async function listChannels(): Promise<ChatChannel[]> {
  const key = cacheKey('channels');
  const cached = await cacheGet<ChatChannel[]>(key);
  if (cached) return cached;
  const rows = await executeQuery('SELECT * FROM chat_channels LIMIT 100000');
  const items: ChatChannel[] = rows.map((r: any) => ({ id: r.id, name: r.name, description: r.description, type: r.type }));
  await cacheSet(key, items);
  return items;
}

export async function createChannel(data: ChatChannel): Promise<void> {
  await executeQuery('INSERT INTO chat_channels (id,name,description,type) VALUES (?,?,?,?)',
    [data.id, data.name, data.description, data.type]);
  await cacheDel(cacheKey('channels'));
}

export async function updateChannel(id: string, data: Partial<ChatChannel>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE chat_channels SET ${sets} WHERE id=?`, vals);
  await cacheDel(cacheKey('channels'));
  return result.affectedRows > 0;
}

export async function deleteChannel(id: string): Promise<boolean> {
  await cacheDel(cacheKey('channels'));
  const result = await executeQuery('DELETE FROM chat_channels WHERE id=?', [id]);
  return result.affectedRows > 0;
}

export async function deleteChannelMessages(channelId: string): Promise<void> {
  await executeQuery('DELETE FROM chat_messages WHERE channelId=?', [channelId]);
}

// --- CHAT MESSAGES ---
export async function getChannelMessages(channelId: string): Promise<ChatMessage[]> {
  const rows = await executeQuery('SELECT * FROM chat_messages WHERE channelId=? ORDER BY timestamp ASC LIMIT 1000', [channelId]);
  return rows.map((r: any) => ({ id: r.id, channelId: r.channelId, userId: r.userId, userName: r.userName, userAvatar: r.userAvatar, text: r.text, timestamp: r.timestamp }));
}

export async function createMessage(data: ChatMessage): Promise<void> {
  await executeQuery('INSERT INTO chat_messages (id,channelId,userId,userName,userAvatar,text,timestamp) VALUES (?,?,?,?,?,?,?)',
    [data.id, data.channelId, data.userId, data.userName, data.userAvatar, data.text, data.timestamp]);
}

export async function deleteMessage(id: string): Promise<boolean> {
  const result = await executeQuery('DELETE FROM chat_messages WHERE id=?', [id]);
  return result.affectedRows > 0;
}

// --- NOTIFICATIONS ---
export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const rows = await executeQuery('SELECT * FROM notifications WHERE userId=? ORDER BY timestamp DESC LIMIT 1000', [userId]);
  return rows.map((r: any) => ({ id: r.id, userId: r.userId, text: r.text, type: r.type, read: !!r.read, timestamp: r.timestamp }));
}

export async function createNotification(data: Notification): Promise<void> {
  await executeQuery('INSERT INTO notifications (id,userId,text,type,`read`,timestamp) VALUES (?,?,?,?,?,?)',
    [data.id, data.userId, data.text, data.type, data.read, data.timestamp]);
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const result = await executeQuery('UPDATE notifications SET `read`=TRUE WHERE id=?', [id]);
  return result.affectedRows > 0;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await executeQuery('UPDATE notifications SET `read`=TRUE WHERE userId=?', [userId]);
}

// --- TASK COMMENTS ---
export async function listTaskComments(taskId: string): Promise<TaskComment[]> {
  const rows = await executeQuery('SELECT * FROM task_comments WHERE taskId=? ORDER BY timestamp ASC LIMIT 1000', [taskId]);
  return rows.map((r: any) => ({ id: r.id, taskId: r.taskId, userId: r.userId, userName: r.userName, userAvatar: r.userAvatar, text: r.text, timestamp: r.timestamp }));
}

export async function createTaskComment(data: TaskComment): Promise<void> {
  await executeQuery('INSERT INTO task_comments (id,taskId,userId,userName,userAvatar,text,timestamp) VALUES (?,?,?,?,?,?,?)',
    [data.id, data.taskId, data.userId, data.userName, data.userAvatar, data.text, data.timestamp]);
}

export async function deleteTaskComment(id: string): Promise<void> {
  await executeQuery('DELETE FROM task_comments WHERE id=?', [id]);
}

// --- SUPPORT TICKETS ---
export async function listTickets(): Promise<SupportTicket[]> {
  const rows = await executeQuery('SELECT * FROM support_tickets ORDER BY createdAt DESC LIMIT 100000');
  const tickets: SupportTicket[] = [];
  const ticketIds = rows.map((r: any) => r.id);
  const commentsByTicket: Record<string, TicketComment[]> = {};
  if (ticketIds.length > 0) {
    const placeholders = ticketIds.map(() => '?').join(',');
    const commentRows = await executeQuery(`SELECT * FROM ticket_comments WHERE ticketId IN (${placeholders}) ORDER BY timestamp ASC`, ticketIds);
    for (const r of commentRows) {
      if (!commentsByTicket[r.ticketId]) commentsByTicket[r.ticketId] = [];
      commentsByTicket[r.ticketId].push({
        id: r.id, authorName: r.authorName, authorEmail: r.authorEmail,
        text: r.text, timestamp: r.timestamp, isAdmin: !!r.isAdmin,
        attachments: r.attachments ? JSON.parse(r.attachments) : []
      });
    }
  }
  for (const r of rows) {
    const comments = commentsByTicket[r.id] || [];
    const attachments = r.attachments ? JSON.parse(r.attachments) : [];
    tickets.push({ id: r.id, title: r.title, description: r.description, creatorName: r.creatorName, creatorEmail: r.creatorEmail, clientId: r.clientId, status: r.status, priority: r.priority, category: r.category, createdAt: r.createdAt, comments, attachments });
  }
  return tickets;
}

export async function createTicket(data: SupportTicket): Promise<void> {
  await executeQuery('INSERT INTO support_tickets (id,title,description,creatorName,creatorEmail,clientId,status,priority,category,createdAt,attachments) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [data.id, data.title, data.description, data.creatorName, data.creatorEmail, data.clientId || null, data.status, data.priority, data.category, data.createdAt, data.attachments ? JSON.stringify(data.attachments) : null]);
  for (const c of data.comments) {
    await addTicketComment(data.id, c);
  }
}

export async function updateTicket(id: string, data: Partial<SupportTicket>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'comments');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE support_tickets SET ${sets} WHERE id=?`, vals);
  return result.affectedRows > 0;
}

export async function deleteTicket(id: string): Promise<boolean> {
  const result = await executeQuery('DELETE FROM support_tickets WHERE id=?', [id]);
  return result.affectedRows > 0;
}

export async function getTicketComments(ticketId: string): Promise<TicketComment[]> {
  const rows = await executeQuery('SELECT * FROM ticket_comments WHERE ticketId=? ORDER BY timestamp ASC', [ticketId]);
  return rows.map((r: any) => ({ id: r.id, authorName: r.authorName, authorEmail: r.authorEmail, text: r.text, timestamp: r.timestamp, isAdmin: !!r.isAdmin, attachments: r.attachments ? JSON.parse(r.attachments) : [] }));
}

export async function addTicketComment(ticketId: string, data: TicketComment): Promise<void> {
  await executeQuery('INSERT INTO ticket_comments (id,ticketId,authorName,authorEmail,text,timestamp,isAdmin,attachments) VALUES (?,?,?,?,?,?,?,?)',
    [data.id, ticketId, data.authorName, data.authorEmail, data.text, data.timestamp, data.isAdmin, data.attachments ? JSON.stringify(data.attachments) : null]);
}

// --- TICKET CLIENTS ---
export async function listTicketClients(): Promise<TicketClient[]> {
  const rows = await executeQuery('SELECT * FROM ticket_clients ORDER BY createdAt DESC LIMIT 100000');
  return rows.map((r: any) => ({ id: r.id, name: r.name, email: r.email, code: r.code, createdAt: r.createdAt }));
}

export async function createTicketClient(data: TicketClient): Promise<void> {
  await executeQuery('INSERT INTO ticket_clients (id,name,email,code,createdAt) VALUES (?,?,?,?,?)',
    [data.id, data.name, data.email, data.code, data.createdAt]);
}

export async function updateTicketClient(id: string, data: Partial<TicketClient>): Promise<boolean> {
  const fields = Object.keys(data).filter(k => k !== 'id');
  if (!fields.length) return false;
  const sets = fields.map(f => `${f}=?`).join(',');
  const vals = fields.map(f => (data as any)[f]);
  vals.push(id);
  const result = await executeQuery(`UPDATE ticket_clients SET ${sets} WHERE id=?`, vals);
  return result.affectedRows > 0;
}

export async function deleteTicketClient(id: string): Promise<boolean> {
  const result = await executeQuery('DELETE FROM ticket_clients WHERE id=?', [id]);
  return result.affectedRows > 0;
}

export async function getTicketClientByCode(code: string): Promise<TicketClient | null> {
  const rows = await executeQuery('SELECT * FROM ticket_clients WHERE code=?', [code]);
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, name: r.name, email: r.email, code: r.code, createdAt: r.createdAt };
}

export async function listTicketsByClientId(clientId: string): Promise<SupportTicket[]> {
  const rows = await executeQuery('SELECT * FROM support_tickets WHERE clientId=? ORDER BY createdAt DESC LIMIT 100000', [clientId]);
  const tickets: SupportTicket[] = [];
  const ticketIds = rows.map((r: any) => r.id);
  const commentsByTicket: Record<string, TicketComment[]> = {};
  if (ticketIds.length > 0) {
    const placeholders = ticketIds.map(() => '?').join(',');
    const commentRows = await executeQuery(`SELECT * FROM ticket_comments WHERE ticketId IN (${placeholders}) ORDER BY timestamp ASC`, ticketIds);
    for (const r of commentRows) {
      if (!commentsByTicket[r.ticketId]) commentsByTicket[r.ticketId] = [];
      commentsByTicket[r.ticketId].push({
        id: r.id, authorName: r.authorName, authorEmail: r.authorEmail,
        text: r.text, timestamp: r.timestamp, isAdmin: !!r.isAdmin,
        attachments: r.attachments ? JSON.parse(r.attachments) : []
      });
    }
  }
  for (const r of rows) {
    const comments = commentsByTicket[r.id] || [];
    const attachments = r.attachments ? JSON.parse(r.attachments) : [];
    tickets.push({ id: r.id, title: r.title, description: r.description, creatorName: r.creatorName, creatorEmail: r.creatorEmail, clientId: r.clientId, status: r.status, priority: r.priority, category: r.category, createdAt: r.createdAt, comments, attachments });
  }
  return tickets;
}

export async function registerFCMToken(tokenId: string, userId: string, token: string): Promise<void> {
  const now = new Date().toISOString();
  // Upsert: delete old token first, then insert
  await executeQuery('DELETE FROM fcm_tokens WHERE userId=? AND token=?', [userId, token]);
  await executeQuery('INSERT INTO fcm_tokens (id,userId,token,createdAt) VALUES (?,?,?,?)', [tokenId, userId, token, now]);
}

export async function unregisterFCMToken(token: string): Promise<void> {
  await executeQuery('DELETE FROM fcm_tokens WHERE token=?', [token]);
}

export async function getFCMTokensByUserId(userId: string): Promise<FCMToken[]> {
  const rows = await executeQuery('SELECT * FROM fcm_tokens WHERE userId=?', [userId]);
  return rows.map((r: any) => ({ id: r.id, userId: r.userId, token: r.token, createdAt: r.createdAt }));
}

export async function getAllFCMTokens(): Promise<FCMToken[]> {
  const rows = await executeQuery('SELECT * FROM fcm_tokens', []);
  return rows.map((r: any) => ({ id: r.id, userId: r.userId, token: r.token, createdAt: r.createdAt }));
}

// -- Meeting Minutes DAO --
export async function getMeetingMinutes(): Promise<MeetingMinute[]> {
  const key = cacheKey('meeting_minutes');
  const cached = await cacheGet(key);
  if (cached) return JSON.parse(cached as string);

  const rows = await executeQuery('SELECT * FROM meeting_minutes ORDER BY date DESC', []);
  const items = rows.map((r: any) => mapRow<MeetingMinute>(r));
  await cacheSet(key, JSON.stringify(items), 1800);
  return items;
}

export async function createMeetingMinute(item: MeetingMinute): Promise<void> {
  await executeQuery(
    'INSERT INTO meeting_minutes (id,title,date,participants,observations,documentUrl,createdAt) VALUES (?,?,?,?,?,?,?)',
    [item.id, item.title, item.date, item.participants, item.observations, item.documentUrl, item.createdAt]
  );
  await cacheDelPattern('dao:meeting_minutes*');
}

export async function updateMeetingMinute(id: string, updates: Partial<MeetingMinute>): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'id') continue;
    sets.push(`\`${k}\` = ?`);
    params.push(typeof v === 'object' ? JSON.stringify(v) : v);
  }
  if (sets.length === 0) return;
  params.push(id);
  await executeQuery(`UPDATE meeting_minutes SET ${sets.join(', ')} WHERE id=?`, params);
  await cacheDelPattern('dao:meeting_minutes*');
}

export async function deleteMeetingMinute(id: string): Promise<void> {
  await executeQuery('DELETE FROM meeting_minutes WHERE id=?', [id]);
  await cacheDelPattern('dao:meeting_minutes*');
}
