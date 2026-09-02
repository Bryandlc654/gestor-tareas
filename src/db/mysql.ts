import mysql from 'mysql2/promise';
import { 
  User, Role, Workspace, Folder, Task, PersonalTodo, Client, 
  Quote, Contract, Service, CredentialWeb, ChatChannel, 
  ChatMessage, Notification, SupportTicket, PortfolioItem, 
  Solicitud, AgencyInfo 
} from '../types';

// MySQL Connection Config via Environment Variables
const config = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'agency_db',
  connectionLimit: parseInt(process.env.MYSQL_POOL_LIMIT || '10'),
  // Hardening: never let the event loop hang on a dead DB connection
  waitForConnections: true,
  queueLimit: 50,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  maxIdle: 10,
  idleTimeout: 60000
};

const QUERY_TIMEOUT_MS = parseInt(process.env.MYSQL_QUERY_TIMEOUT || '15000');

let pool: mysql.Pool | null = null;

// Lazy initialization for the database pool
export function getMysqlPool(): mysql.Pool | null {
  if (process.env.USE_MYSQL !== "true") {
    return null;
  }
  if (!pool) {
    try {
      console.log(`[MySQL] Initializing connection pool to ${config.host}:${config.port}/${config.database}`);
      pool = mysql.createPool(config);
    } catch (e) {
      console.error('[MySQL] Failed to create connection pool:', e);
    }
  }
  return pool;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[MySQL] Query timeout after ${ms}ms: ${label.slice(0, 80)}`)), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

// Safe query runner with timeout guard
export async function executeQuery<T>(sql: string, params: any[] = []): Promise<any> {
  const connectionPool = getMysqlPool();
  if (!connectionPool) {
    throw new Error('MySQL is not enabled or pool is uninitialized. Check USE_MYSQL variable.');
  }
  const [results] = await withTimeout(
    connectionPool.execute(sql, params),
    QUERY_TIMEOUT_MS,
    sql
  );
  return results;
}

// Auto-migration & Schema Builder to seed tables in production if needed
export async function bootstrapMysqlSchema(): Promise<void> {
  if (process.env.USE_MYSQL !== "true") {
    return;
  }
  
  console.log('[MySQL] Bootstrapping schema auto-migration...');

  try {
    // 1. Agency info table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS agency_info (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tagline VARCHAR(255),
        description TEXT,
        skills TEXT
      );
    `);

    // 2. Roles
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        permissions TEXT
      );
    `);

    // 3. Users
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255),
        roleId VARCHAR(255),
        avatar VARCHAR(500),
        status VARCHAR(50) DEFAULT 'active'
      );
    `);

    // 4. Workspaces
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(255),
        description TEXT
      );
    `);

    // 5. Folders
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS folders (
        id VARCHAR(255) PRIMARY KEY,
        workspaceId VARCHAR(255),
        name VARCHAR(255) NOT NULL
      );
    `);

    // 6. Tasks
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(255) PRIMARY KEY,
        folderId VARCHAR(255),
        workspaceId VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'todo',
        priority VARCHAR(50) DEFAULT 'medium',
        dueDate VARCHAR(50),
        assignedTo TEXT,
        tags TEXT,
        checklist TEXT,
        attachments TEXT,
        links TEXT,
        taskOrder INT DEFAULT 0
      );
    `);

    // Migration: add checklist/attachments/links/taskOrder columns if missing
    try { await executeQuery(`ALTER TABLE tasks ADD COLUMN checklist TEXT;`); } catch {}
    try { await executeQuery(`ALTER TABLE tasks ADD COLUMN attachments TEXT;`); } catch {}
    try { await executeQuery(`ALTER TABLE tasks ADD COLUMN links TEXT;`); } catch {}
    try { await executeQuery(`ALTER TABLE tasks ADD COLUMN taskOrder INT DEFAULT 0;`); } catch {}

    // 7. Personal Todos
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS personal_todos (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'todo'
      );
    `);

    // 8. Meetings / Reuniones
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS meetings (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        time VARCHAR(10) DEFAULT '12:00',
        attendees TEXT,
        link VARCHAR(500) DEFAULT '',
        assignedTo TEXT,
        reminderMinutes INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'scheduled',
        createdAt VARCHAR(50) DEFAULT ''
      );
    `);
    // ALTER for existing DBs that miss columns
    try { await executeQuery("ALTER TABLE meetings ADD COLUMN reminderMinutes INT DEFAULT 0"); } catch {}
    try { await executeQuery("ALTER TABLE meetings ADD COLUMN createdAt VARCHAR(50) DEFAULT ''"); } catch {}
    try { await executeQuery("ALTER TABLE meetings ADD COLUMN link VARCHAR(500) DEFAULT ''"); } catch {}
    try { await executeQuery("ALTER TABLE meetings ADD COLUMN assignedTo TEXT"); } catch {}

    // 9. Clients
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(100),
        status VARCHAR(50) DEFAULT 'lead',
        revenue DECIMAL(12, 2) DEFAULT 0
      );
    `);
    // Migration: add vendor/sales columns if missing (kept in sync with VendorLead)
    try { await executeQuery(`ALTER TABLE clients ADD COLUMN vendorId VARCHAR(255)`); } catch {}
    try { await executeQuery(`ALTER TABLE clients ADD COLUMN city VARCHAR(255)`); } catch {}
    try { await executeQuery(`ALTER TABLE clients ADD COLUMN serviceInterest VARCHAR(255)`); } catch {}
    try { await executeQuery(`ALTER TABLE clients ADD COLUMN notes TEXT`); } catch {}
    try { await executeQuery(`ALTER TABLE clients ADD COLUMN createdAt VARCHAR(100)`); } catch {}
    try { await executeQuery(`ALTER TABLE clients ADD COLUMN updatedAt VARCHAR(100)`); } catch {}

    // 9. Quotes
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS quotes (
        id VARCHAR(255) PRIMARY KEY,
        clientId VARCHAR(255) NOT NULL,
        description TEXT,
        amount DECIMAL(12, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        date VARCHAR(50)
      );
    `);

    // 10. Contracts
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS contracts (
        id VARCHAR(255) PRIMARY KEY,
        clientId VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        value DECIMAL(12, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        startDate VARCHAR(50),
        endDate VARCHAR(50)
      );
    `);

    // 11. Services
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(12, 2) DEFAULT 0,
        type VARCHAR(50) DEFAULT 'one_time'
      );
    `);

    // 12. Credentials
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS credentials (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        url VARCHAR(500),
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255),
        notes TEXT,
        category VARCHAR(255) DEFAULT 'other'
      );
    `);

    // 13. Chat Channels
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS chat_channels (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        type VARCHAR(50) DEFAULT 'public'
      );
    `);

    // 14. Chat Messages
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(255) PRIMARY KEY,
        channelId VARCHAR(255) NOT NULL,
        userId VARCHAR(255) NOT NULL,
        userName VARCHAR(255),
        userAvatar VARCHAR(500),
        text TEXT NOT NULL,
        timestamp VARCHAR(100)
      );
    `);

    // 15. Notifications
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        type VARCHAR(100) DEFAULT 'general',
        \`read\` BOOLEAN DEFAULT FALSE,
        timestamp VARCHAR(100)
      );
    `);

    // 15b. Task Comments
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS task_comments (
        id VARCHAR(255) PRIMARY KEY,
        taskId VARCHAR(255) NOT NULL,
        userId VARCHAR(255) NOT NULL,
        userName VARCHAR(255) NOT NULL,
        userAvatar VARCHAR(500),
        text TEXT NOT NULL,
        timestamp VARCHAR(100)
      );
    `);

    // 16. Support Tickets
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        creatorName VARCHAR(255),
        creatorEmail VARCHAR(255),
        clientId VARCHAR(255) DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'open',
        priority VARCHAR(50) DEFAULT 'medium',
        category VARCHAR(50) DEFAULT 'bug',
        createdAt VARCHAR(100)
      );
    `);
    // Migration: add clientId if missing
    try { await executeQuery(`ALTER TABLE support_tickets ADD COLUMN clientId VARCHAR(255) DEFAULT NULL`); } catch {}
    // Migration: add attachments if missing
    try { await executeQuery(`ALTER TABLE support_tickets ADD COLUMN attachments TEXT`); } catch {}

    // 16b. Ticket Clients
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS ticket_clients (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        createdAt VARCHAR(100)
      );
    `);

    // 17. Ticket Comments
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS ticket_comments (
        id VARCHAR(255) PRIMARY KEY,
        ticketId VARCHAR(255) NOT NULL,
        authorName VARCHAR(255),
        authorEmail VARCHAR(255),
        text TEXT NOT NULL,
        timestamp VARCHAR(100),
        isAdmin BOOLEAN DEFAULT FALSE,
        attachments TEXT
      );
    `);
    // Migration: add attachments to ticket_comments if missing
    try { await executeQuery(`ALTER TABLE ticket_comments ADD COLUMN attachments TEXT`); } catch {}

    // 18. Portfolio Items
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS portfolio (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image VARCHAR(500),
        category VARCHAR(255) DEFAULT 'General',
        clientUrl VARCHAR(500)
      );
    `);

    // 19. FCM Tokens for push notifications
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS fcm_tokens (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        token TEXT NOT NULL,
        createdAt VARCHAR(100)
      );
    `);

    await executeQuery(`
      CREATE TABLE IF NOT EXISTS meeting_minutes (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date VARCHAR(50),
        participants TEXT,
        observations TEXT,
        documentUrl VARCHAR(500),
        createdAt VARCHAR(100)
      );
    `);

    // 20. Vendor Leads
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS vendor_leads (
        id VARCHAR(255) PRIMARY KEY,
        vendorId VARCHAR(255) NOT NULL,
        clientName VARCHAR(255) NOT NULL,
        phone VARCHAR(100),
        serviceInterest VARCHAR(255),
        city VARCHAR(255),
        email VARCHAR(255),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        createdAt VARCHAR(100),
        updatedAt VARCHAR(100)
      );
    `);

    // 21. Vendor Lead Activities (gestiones)
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS vendor_activities (
        id VARCHAR(255) PRIMARY KEY,
        leadId VARCHAR(255) NOT NULL,
        vendorId VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        createdAt VARCHAR(100)
      );
    `);
    console.log('[MySQL] Auto-migration schema successfully validated & created.');

    // Performance indexes on FK / filter columns (idempotent via try/catch)
    const indexStatements: Array<[string, string]> = [
      ['idx_tasks_workspace', 'ALTER TABLE tasks ADD INDEX idx_tasks_workspace (workspaceId)'],
      ['idx_tasks_folder', 'ALTER TABLE tasks ADD INDEX idx_tasks_folder (folderId)'],
      ['idx_folders_workspace', 'ALTER TABLE folders ADD INDEX idx_folders_workspace (workspaceId)'],
      ['idx_chat_messages_channel', 'ALTER TABLE chat_messages ADD INDEX idx_chat_messages_channel (channelId)'],
      ['idx_notifications_user', 'ALTER TABLE notifications ADD INDEX idx_notifications_user (userId)'],
      ['idx_task_comments_task', 'ALTER TABLE task_comments ADD INDEX idx_task_comments_task (taskId)'],
      ['idx_ticket_comments_ticket', 'ALTER TABLE ticket_comments ADD INDEX idx_ticket_comments_ticket (ticketId)'],
      ['idx_support_tickets_client', 'ALTER TABLE support_tickets ADD INDEX idx_support_tickets_client (clientId)'],
      ['idx_support_tickets_created', 'ALTER TABLE support_tickets ADD INDEX idx_support_tickets_created (createdAt)'],
      ['idx_personal_todos_user', 'ALTER TABLE personal_todos ADD INDEX idx_personal_todos_user (userId)'],
      ['idx_fcm_tokens_user', 'ALTER TABLE fcm_tokens ADD INDEX idx_fcm_tokens_user (userId)'],
      ['idx_clients_vendor', 'ALTER TABLE clients ADD INDEX idx_clients_vendor (vendorId)'],
      ['idx_vendor_leads_vendor', 'ALTER TABLE vendor_leads ADD INDEX idx_vendor_leads_vendor (vendorId)'],
      ['idx_vendor_activities_lead', 'ALTER TABLE vendor_activities ADD INDEX idx_vendor_activities_lead (leadId)'],
      ['idx_vendor_activities_vendor', 'ALTER TABLE vendor_activities ADD INDEX idx_vendor_activities_vendor (vendorId)'],
    ];
    for (const [name, stmt] of indexStatements) {
      try { await executeQuery(stmt); } catch { /* already exists or column missing */ }
    }
    console.log('[MySQL] Performance indexes ensured.');

    // One-time migration: move legacy vendor_leads rows into the CRM `clients` table
    // (vendor leads and CRM clients are now the same data).
    try {
      const [legacyRows] = await (getMysqlPool() as any).execute('SELECT * FROM vendor_leads WHERE 1=1');
      for (const lr of legacyRows as any[]) {
        const [existing] = await (getMysqlPool() as any).execute('SELECT id FROM clients WHERE id=?', [lr.id]);
        if (existing.length) continue;
        await executeQuery('INSERT INTO clients (id,name,company,email,phone,status,revenue,vendorId,city,serviceInterest,notes,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [lr.id, lr.clientName || lr.name, 'Particular', lr.email || '', lr.phone || '', lr.status || 'pending', 0, lr.vendorId || 'user-1', lr.city || '', lr.serviceInterest || '', lr.notes || '', lr.createdAt || new Date().toISOString(), lr.updatedAt || lr.createdAt || new Date().toISOString()]);
      }
    } catch { /* vendor_leads table may not exist yet */ }

    await seedIfEmpty();
    await seedCredentialsIfEmpty();
  } catch (error) {
    console.error('[MySQL] Auto-migration failed. Ensure connection parameters are correct.', error);
  }
}

import { hashSync } from 'bcryptjs';
const DEFAULT_PASSWORD_HASH = hashSync('123456', 10);

async function seedIfEmpty(): Promise<void> {
  try {
    const [rows] = await (getMysqlPool() as any).execute('SELECT COUNT(*) as cnt FROM roles');
    if (rows[0].cnt > 0) { console.log('[MySQL] Data already seeded, skipping.'); return; }
  } catch { /* table may not exist yet */ }

  console.log('[MySQL] Seeding initial data...');

  await executeQuery(`INSERT INTO agency_info (id,name,tagline,description,skills) VALUES (?,?,?,?,?)`,
    ['main', 'Iceberg Agency', 'Desarrollo Web & Apps de Alto Rendimiento', 'Especializados en crear plataformas web ultrarrápidas, diseño de experiencia de usuario minimalista y automatizaciones a medida.', JSON.stringify(['React & Next.js', 'Tailwind CSS', 'Node.js & Express', 'Docker & Kubernetes', 'Cloud Run Integrations'])]);

  const roles = [
    { id: 'role-superadmin', name: 'Super Administrador', description: 'Acceso absoluto a todos los módulos.', permissions: JSON.stringify(['view_dashboard','view_calendar','view_actas','view_assistant','manage_workspaces','manage_crm','manage_users','manage_roles','manage_credentials','view_all_tickets','chat_all','manage_agency']) },
    { id: 'role-admin', name: 'Administrador / CEO', description: 'Acceso total al sistema.', permissions: JSON.stringify(['view_dashboard','view_calendar','view_actas','view_assistant','manage_workspaces','manage_crm','manage_users','manage_roles','manage_credentials','view_all_tickets','chat_all']) },
    { id: 'role-developer', name: 'Desarrollador / Líder Técnico', description: 'Acceso a workspaces, Kanban, credenciales y tickets.', permissions: JSON.stringify(['manage_workspaces','view_all_tickets','chat_all','view_credentials']) },
    { id: 'role-designer', name: 'Diseñador UX/UI', description: 'Diseño de interfaces y chat.', permissions: JSON.stringify(['manage_workspaces','chat_all']) },
    { id: 'role-client', name: 'Cliente Invitado', description: 'Lectura de proyectos, tickets y contratos.', permissions: JSON.stringify(['view_assigned_workspace','create_ticket']) },
  ];
  for (const r of roles) {
    await executeQuery('INSERT IGNORE INTO roles (id,name,description,permissions) VALUES (?,?,?,?)', [r.id, r.name, r.description, r.permissions]);
  }

  const users = [
    { id: 'user-super', name: 'Root Admin', email: 'root@agenciadev.com', password: DEFAULT_PASSWORD_HASH, roleId: 'role-superadmin', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150', status: 'active' },
    { id: 'user-1', name: 'Sofía Alarcón', email: 'sofia@agenciadev.com', password: DEFAULT_PASSWORD_HASH, roleId: 'role-admin', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150', status: 'active' },
    { id: 'user-2', name: 'Diego Gómez', email: 'diego@agenciadev.com', password: DEFAULT_PASSWORD_HASH, roleId: 'role-developer', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150', status: 'active' },
    { id: 'user-3', name: 'Mateo Ruiz', email: 'mateo@agenciadev.com', password: DEFAULT_PASSWORD_HASH, roleId: 'role-designer', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=150', status: 'active' },
    { id: 'user-4', name: 'Eduardo Cisneros', email: 'eduardo@elcisneshoes.com', password: DEFAULT_PASSWORD_HASH, roleId: 'role-client', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150', status: 'active' },
  ];
  for (const u of users) {
    await executeQuery('INSERT IGNORE INTO users (id,name,email,password,roleId,avatar,status) VALUES (?,?,?,?,?,?,?)', [u.id, u.name, u.email, u.password, u.roleId, u.avatar, u.status]);
  }

  const workspaces = [
    { id: 'ws-1', name: 'Diseño & Marca Hub', icon: 'Palette', description: 'Espacio centralizado para definir la identidad visual.' },
    { id: 'ws-2', name: 'Core Frontend & Next.js', icon: 'CodeXml', description: 'Desarrollo de módulos interactivos responsive.' },
    { id: 'ws-3', name: 'Infraestructura & MySQL DB', icon: 'Server', description: 'Configuración de servidores, endpoints REST, bases de datos.' },
  ];
  for (const w of workspaces) {
    await executeQuery('INSERT IGNORE INTO workspaces (id,name,icon,description) VALUES (?,?,?,?)', [w.id, w.name, w.icon, w.description]);
  }

  const folders = [
    { id: 'fold-1', workspaceId: 'ws-1', name: 'Figma Prototipos v1' },
    { id: 'fold-2', workspaceId: 'ws-1', name: 'Ajustes de Branding' },
    { id: 'fold-3', workspaceId: 'ws-2', name: 'Componentes de Biblioteca' },
    { id: 'fold-4', workspaceId: 'ws-2', name: 'Rutamiento dinámico' },
    { id: 'fold-5', workspaceId: 'ws-3', name: 'Esquemas MySQL' },
    { id: 'fold-6', workspaceId: 'ws-3', name: 'Docker Web Containers' },
  ];
  for (const f of folders) {
    await executeQuery('INSERT IGNORE INTO folders (id,workspaceId,name) VALUES (?,?,?)', [f.id, f.workspaceId, f.name]);
  }

  const tasks = [
    { id: 'task-1', folderId: 'fold-1', workspaceId: 'ws-1', title: 'Definir guía de estilos e íconos', description: 'Seleccionar paletas de colores neutras.', status: 'todo', priority: 'medium', dueDate: '2026-06-25', assignedTo: JSON.stringify(['user-3']), tags: JSON.stringify(['UI','Colores','Boceto']), taskOrder: 0 },
    { id: 'task-2', folderId: 'fold-2', workspaceId: 'ws-1', title: 'Ajuste de imagotipo responsivo', description: 'Modificar renders del logo.', status: 'in_progress', priority: 'high', dueDate: '2026-06-20', assignedTo: JSON.stringify(['user-3']), tags: JSON.stringify(['Logo','SVG']), taskOrder: 0 },
    { id: 'task-3', folderId: 'fold-3', workspaceId: 'ws-2', title: 'Desarrollar tablero Kanban reactivo', description: 'Programar lógica de arrastre.', status: 'in_progress', priority: 'high', dueDate: '2026-06-22', assignedTo: JSON.stringify(['user-2', 'user-3']), tags: JSON.stringify(['React','State','Interactivo']), taskOrder: 0 },
    { id: 'task-4', folderId: 'fold-5', workspaceId: 'ws-3', title: 'Migración de tablas relacionales a MySQL', description: 'Escribir DDL para tablas de CRM.', status: 'todo', priority: 'high', dueDate: '2026-06-30', assignedTo: JSON.stringify(['user-2']), tags: JSON.stringify(['MySQL','SQL Schema','Database']), taskOrder: 1 },
    { id: 'task-5', folderId: 'fold-6', workspaceId: 'ws-3', title: 'Asegurar puertos SSL en Cloud Run', description: 'Pruebas de puertos proxy HTTP.', status: 'done', priority: 'low', dueDate: '2026-06-12', assignedTo: JSON.stringify(['user-2']), tags: JSON.stringify(['Nginx','SSL','Cloud']), taskOrder: 0 },
  ];
  for (const t of tasks) {
    await executeQuery('INSERT IGNORE INTO tasks (id,folderId,workspaceId,title,description,status,priority,dueDate,assignedTo,tags,taskOrder) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [t.id, t.folderId, t.workspaceId, t.title, t.description, t.status, t.priority, t.dueDate, t.assignedTo, t.tags, t.taskOrder]);
  }

  const todos = [
    { id: 'todo-1', userId: 'user-1', title: 'Llamar a cliente Eduardo para aprobación de cotización', status: 'todo' },
    { id: 'todo-2', userId: 'user-1', title: 'Subir logs de errores en Docker', status: 'done' },
    { id: 'todo-3', userId: 'user-2', title: 'Actualizar constantes de MySQL en archivo .env', status: 'todo' },
  ];
  for (const t of todos) {
    await executeQuery('INSERT IGNORE INTO personal_todos (id,userId,title,status) VALUES (?,?,?,?)', [t.id, t.userId, t.title, t.status]);
  }

  const meetings = [
    { id: 'meet-1', userId: 'user-1', title: 'Revisión semanal de proyectos', description: 'Reunión de equipo para revisar avances de la semana.', date: '2026-06-22', time: '10:00', attendees: 'root@agenciadev.com, soporte@nexboost.com', link: '', assignedTo: JSON.stringify(['user-1','user-2']), reminderMinutes: 30, status: 'scheduled', createdAt: '2026-06-18T12:00:00.000Z' },
    { id: 'meet-2', userId: 'user-2', title: 'Presentación a cliente nuevo', description: 'Presentar propuesta de desarrollo web.', date: '2026-06-25', time: '15:30', attendees: 'cliente@example.com', link: '', assignedTo: JSON.stringify(['user-2']), reminderMinutes: 60, status: 'scheduled', createdAt: '2026-06-18T12:00:00.000Z' },
    { id: 'meet-3', userId: 'user-1', title: 'Sprint planning', description: 'Planificar tareas del siguiente sprint.', date: '2026-06-18', time: '09:00', attendees: 'Equipo de desarrollo', link: '', assignedTo: JSON.stringify(['user-1','user-3']), reminderMinutes: 15, status: 'scheduled', createdAt: '2026-06-17T10:00:00.000Z' },
  ];
  for (const m of meetings) {
    await executeQuery('INSERT IGNORE INTO meetings (id,userId,title,description,date,time,attendees,link,assignedTo,reminderMinutes,status,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [m.id, m.userId, m.title, m.description, m.date, m.time, m.attendees, m.link, m.assignedTo, m.reminderMinutes, m.status, m.createdAt]);
  }

  const clients = [
    { id: 'cli-1', name: 'Eduardo Cisneros', company: 'Zapatos El Cisne S.A.', email: 'eduardo@elcisneshoes.com', phone: '+52 55 4312 9088', status: 'negotiation', revenue: 5500 },
    { id: 'cli-2', name: 'Beatriz Pérez', company: 'FitLife Centers España', email: 'b.perez@fitlifecenter.es', phone: '+34 682 110 322', status: 'won', revenue: 12000 },
    { id: 'cli-3', name: 'Roberto Méndez', company: 'TechInno Consulting', email: 'roberto@techinno.cl', phone: '+56 9 8812 7741', status: 'lead', revenue: 3200 },
  ];
  for (const c of clients) {
    await executeQuery('INSERT IGNORE INTO clients (id,name,company,email,phone,status,revenue) VALUES (?,?,?,?,?,?,?)',
      [c.id, c.name, c.company, c.email, c.phone, c.status, c.revenue]);
  }

  const qs = [
    { id: 'q-1', clientId: 'cli-1', description: 'Desarrollo de e-commerce completo con Stripe y MySQL.', amount: 5500, status: 'sent', date: '2026-06-15' },
    { id: 'q-2', clientId: 'cli-2', description: 'Migración de WordPress a Next.js + Panel de roles.', amount: 12000, status: 'approved', date: '2026-06-01' },
  ];
  for (const q of qs) {
    await executeQuery('INSERT IGNORE INTO quotes (id,clientId,description,amount,status,date) VALUES (?,?,?,?,?,?)',
      [q.id, q.clientId, q.description, q.amount, q.status, q.date]);
  }

  await executeQuery('INSERT IGNORE INTO contracts (id,clientId,title,value,status,startDate,endDate) VALUES (?,?,?,?,?,?,?)',
    ['con-1', 'cli-2', 'Contrato de Desarrollo Frontend & CMS FitLife', 12000, 'active', '2026-06-05', '2026-12-05']);

  const svcs = [
    { id: 'ser-1', name: 'Desarrollo Landing Page Landing+', description: 'Página única estática de alta conversión.', price: 1500, type: 'one_time' },
    { id: 'ser-2', name: 'Mantenimiento & Soporte MySQL de Producción', description: 'Soporte para bases de datos relacionales.', price: 450, type: 'monthly' },
    { id: 'ser-3', name: 'Desarrollo E-Commerce Completo', description: 'Catálogos dinámicos, pasarela de pago, panel admin.', price: 4900, type: 'one_time' },
  ];
  for (const s of svcs) {
    await executeQuery('INSERT IGNORE INTO services (id,name,description,price,type) VALUES (?,?,?,?,?)', [s.id, s.name, s.description, s.price, s.type]);
  }

  await seedCredentialsData();

  const chans = [
    { id: 'chan-1', name: 'general', description: 'Noticias de la agencia y anuncios generales.', type: 'public' },
    { id: 'chan-2', name: 'frontend', description: 'Tecnologías web, estilos CSS y animaciones.', type: 'public' },
    { id: 'chan-3', name: 'core-db', description: 'Consultas de MySQL y migraciones.', type: 'public' },
  ];
  for (const ch of chans) {
    await executeQuery('INSERT IGNORE INTO chat_channels (id,name,description,type) VALUES (?,?,?,?)', [ch.id, ch.name, ch.description, ch.type]);
  }

  const msgs = [
    { id: 'm-1', channelId: 'chan-1', userId: 'user-1', userName: 'Sofía Alarcón', userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150', text: 'Hola equipo! Bienvenidos al portal interno.', timestamp: '2026-06-18T10:00:00Z' },
    { id: 'm-2', channelId: 'chan-1', userId: 'user-2', userName: 'Diego Gómez', userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150', text: 'Excelente. He actualizado el módulo de credenciales.', timestamp: '2026-06-18T10:05:00Z' },
    { id: 'm-3', channelId: 'chan-3', userId: 'user-2', userName: 'Diego Gómez', userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150', text: 'Recuerden que la BD debe almacenar las relaciones en cascada.', timestamp: '2026-06-18T10:20:00Z' },
  ];
  for (const m of msgs) {
    await executeQuery('INSERT IGNORE INTO chat_messages (id,channelId,userId,userName,userAvatar,text,timestamp) VALUES (?,?,?,?,?,?,?)',
      [m.id, m.channelId, m.userId, m.userName, m.userAvatar, m.text, m.timestamp]);
  }

  const notifs = [
    { id: 'n-1', userId: 'user-1', text: 'Se ha creado un nuevo ticket de soporte de Eduardo Cisneros', type: 'ticket', read: false, timestamp: '2026-06-18T12:00:00Z' },
    { id: 'n-2', userId: 'user-2', text: 'Tienes una nueva tarea asignada: Desarrollar tablero Kanban', type: 'task', read: false, timestamp: '2026-06-18T11:30:00Z' },
  ];
  for (const n of notifs) {
    await executeQuery('INSERT IGNORE INTO notifications (id,userId,text,type,`read`,timestamp) VALUES (?,?,?,?,?,?)',
      [n.id, n.userId, n.text, n.type, n.read, n.timestamp]);
  }

  await executeQuery('INSERT IGNORE INTO support_tickets (id,title,description,creatorName,creatorEmail,clientId,status,priority,category,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
    ['tk-1', 'Fallo de conexión base de datos remota', 'Error de conexión timeout para MySQL.', 'Eduardo Cisneros', 'eduardo@elcisneshoes.com', null, 'open', 'high', 'bug', '2026-06-18T11:45:00Z']);
  await executeQuery('INSERT IGNORE INTO ticket_comments (id,ticketId,authorName,authorEmail,text,timestamp,isAdmin) VALUES (?,?,?,?,?,?,?)',
    ['c-1', 'tk-1', 'Eduardo Cisneros', 'eduardo@elcisneshoes.com', 'Error 1045 (28000): Access denied for user.', '2026-06-18T11:50:00Z', false]);
  await executeQuery('INSERT IGNORE INTO support_tickets (id,title,description,creatorName,creatorEmail,clientId,status,priority,category,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
    ['tk-2', 'Factura del mes no recibida', 'No recibo el cargo de soporte MySQL de Junio.', 'Beatriz Pérez', 'b.perez@fitlifecenter.es', null, 'resolved', 'low', 'billing', '2026-06-12T09:00:00Z']);
  await executeQuery('INSERT IGNORE INTO ticket_comments (id,ticketId,authorName,authorEmail,text,timestamp,isAdmin) VALUES (?,?,?,?,?,?,?)',
    ['c-2', 'tk-2', 'Sofía Alarcón', 'sofia@agenciadev.com', 'Factura re-enviada al administrador.', '2026-06-12T16:00:00Z', true]);

  const port = [
    { id: 'port-1', title: 'SaaS Financiero - EcoPay', description: 'Plataforma administrativa de facturación electrónica.', image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=600', category: 'SaaS / Fintech', clientUrl: 'https://ecopay-demo.com' },
    { id: 'port-2', title: 'E-Commerce de Moda - TrendVibe', description: 'Tienda virtual optimizada para móviles.', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=600', category: 'Comercio Electrónico', clientUrl: 'https://trendvibe-app.com' },
    { id: 'port-3', title: 'Portal Inmobiliario - NeoHabitat', description: 'Plataforma interactiva con geolocalización.', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=600', category: 'Real Estate', clientUrl: 'https://neohabitat.io' },
  ];
  for (const p of port) {
    await executeQuery('INSERT IGNORE INTO portfolio (id,title,description,image,category,clientUrl) VALUES (?,?,?,?,?,?)',
      [p.id, p.title, p.description, p.image, p.category, p.clientUrl]);
  }

  console.log('[MySQL] Seed data inserted successfully.');
}

async function seedCredentialsData(): Promise<void> {
  const creds = [
    { id: 'cred-1', title: 'Servidor de Producción MySQL (GCP Cloud SQL)', url: 'https://console.cloud.google.com/sql/instances', username: 'db_deploy_prod', password: 'MyS@QLMasterPass', notes: 'Conexión restringida por IP.', category: 'database' },
    { id: 'cred-2', title: 'Cuenta Hosting Vercel Team', url: 'https://vercel.com/dashboard', username: 'dev_team_agencia@agenciadev.com', password: 'Vercel@Team2026', notes: 'Para despliegues inmediatos.', category: 'hosting' },
    { id: 'cred-3', title: 'API Google Maps Services', url: 'https://console.cloud.google.com', username: 'developer_api_key_gmaps', password: 'AIzaSyCxV...', notes: 'Clave restringida a URLs autorizadas.', category: 'api' },
  ];
  for (const c of creds) {
    await executeQuery('INSERT IGNORE INTO credentials (id,title,url,username,password,notes,category) VALUES (?,?,?,?,?,?,?)',
      [c.id, c.title, c.url, c.username, c.password, c.notes, c.category]);
  }

  const webCreds: any[] = [
    {id:1,title:'Verne',url:'https://verne.nextboostperu.com/',username:'nextboost53',password:'i5Gd37Cy$#&!8e@&@#@893!x5',access_type:'Wordpress',notes:''},
    {id:2,title:'Mi Brevetex',url:'https://mibrevetex.com/',username:'bdelacruz654@gmail.com',password:'(pW3!&HkMjAgAoeewUXWulhn',access_type:'Wordpress',notes:''},
    {id:3,title:'Alamece',url:'https://alamece.com/',username:'webmaster_alamece',password:'kX%9hl&k903(htstnIiiDccO',access_type:'Wordpress',notes:''},
    {id:5,title:'T-Conecto',url:'https://t-conectoperu.com/',username:'nextboost53',password:'k&M9@i&87F569@737Fr&9!!$$',access_type:'Wordpress',notes:''},
    {id:6,title:'Expotravel',url:'https://expotravelperu.com.pe',username:'administrador',password:'tl6R1fDFEIPCoa0k',access_type:'Wordpress',notes:''},
    {id:7,title:'Despega Perú Digital',url:'https://despegaperudigital.com',username:'editor',password:'Dlb5e)At)8c8lMPqdQ@Cklni',access_type:'Wordpress',notes:''},
    {id:8,title:'Sumaq Allpa',url:'https://sumaqallpa.com/',username:'nextboost53',password:'*6*w66789@25#&$S*@!7',access_type:'Wordpress',notes:''},
    {id:11,title:'SUAREZ & SUAREZ',url:'https://suarezysuarezcourrier.com/',username:'nextboost53',password:'j#2!!%76&!!6$Mf766#N!$355',access_type:'Wordpress',notes:''},
    {id:12,title:'Fuerza Gym',url:'https://maquinasdegimnasio.com.pe',username:'samuel@gmail.com',password:'KR2XM$V1jEvNRBmg(44(dG%A',access_type:'Wordpress',notes:''},
    {id:13,title:'Geanine Betancourt',url:'https://geaninebetancourt.com',username:'samuel@gmail.com',password:'8Q4hUAI@NGs0&LN%X1idao4u',access_type:'Wordpress',notes:''},
    {id:14,title:'EuroProyectos',url:'https://europroyectos.pe/',username:'editor',password:'rmmos%tGF!P$STP&JSSC%fsS',access_type:'Wordpress',notes:''},
    {id:15,title:'BK Bienes Raíces',url:'https://bkbienesraices.com/',username:'bryan',password:'JWdim0O4IiV@',access_type:'Wordpress',notes:''},
    {id:16,title:'Moon Express',url:'https://moonexpressec.com/',username:'nextboost53',password:'aU55!3*&2q7i265#%!%%$i9Cb',access_type:'Wordpress',notes:''},
    {id:17,title:'Ciape',url:'https://ciape.pe/',username:'editor',password:'k4Okm(1xQF$gXVjIGpTFr##V',access_type:'Wordpress',notes:''},
    {id:18,title:'CiapeShop',url:'https://shop.ciape.pe/',username:'editor',password:'k4Okm(1xQF$gXVjIGpTFr##V',access_type:'Wordpress',notes:''},
    {id:19,title:'Miskiyaku',url:'https://miskiyaku.com/',username:'samuel@gmail.com',password:'@LHvD6hucF5NgIHhHt88ETzK',access_type:'Wordpress',notes:''},
    {id:20,title:'NEXUS Equilibrio de vida',url:'https://nexusequilibrio.com/',username:'editor',password:'pxxmpgxJEv53lxWaB8oa8kE6',access_type:'Wordpress',notes:''},
    {id:21,title:'Cilantro Fusion',url:'https://cilantrofusion.pe/',username:'nextboost53',password:'fd&J9$&9689*D!4#nd^$%65!5',access_type:'Wordpress',notes:''},
    {id:22,title:'CR MOTORS',url:'https://crmotors.com.pe/',username:'nextboost53',password:'2!p^73*9@R28%67&^@$2',access_type:'Wordpress',notes:''},
    {id:23,title:'Diartco',url:'https://diartco.nextboostperu.com/',username:'nextboost53',password:'$&437Cq9#A^28J36i@#5@39#@',access_type:'Wordpress',notes:''},
    {id:24,title:'Club Kallpa',url:'https://kallpa.nextboostperu.com/',username:'nextboost53',password:'H6858U@&DV#^w&2G6@7!7&&29',access_type:'Wordpress',notes:''},
    {id:25,title:'Corporación Totos',url:'https://corporaciontotos.com/',username:'editor@gmail.com',password:'!&^45&72K8!2y335^*@#',access_type:'Wordpress',notes:''},
    {id:26,title:'Estamos Contigo',url:'https://estamoscontigosiempre.com/',username:'nextboost53',password:'Vt@JNK55%Yz*PR&xyqqRU2%u',access_type:'Wordpress',notes:''},
    {id:28,title:'Graduate',url:'https://graduate.ec/',username:'info@groduate.ec',password:'g#TPHd&B*NAUapkYsB9ps@o!',access_type:'Wordpress',notes:''},
    {id:29,title:'Graduate Panel Hostgator Jorge',url:'https://billing.hostgator.mx/',username:'graduateecuador@gmail.com',password:'sdfjHSDJ$$33145',access_type:'Otro',notes:null},
    {id:30,title:'CGAP',url:'https://cgap.edu.pe/',username:'nextboost53',password:'lYw&$rNJyL9CdwJgDmVS9T$V',access_type:'Wordpress',notes:''},
    {id:31,title:'Falcon Logística y Servicios',url:'https://falconlogisticayservicios.com/',username:'nextboost53',password:'!2$5#R5J6q54A&^5%8&@X9%v&',access_type:'Wordpress',notes:''},
    {id:32,title:'FACTISA',url:'https://factisa.pe/',username:'samuel@gmail.com',password:'ZmkgLc@8Pk&au^iMPgb(uxktsa',access_type:'Wordpress',notes:''},
    {id:33,title:'CLIDENT',url:'https://clidentdentistas.com/',username:'samuel@gmail.com',password:'(1XL$!lha0U1FioTWk9EY4qn',access_type:'Wordpress',notes:''},
    {id:34,title:'Altruisticcr',url:'https://altruisticcr.com/wp-admin',username:'admin',password:'iA&%B9wugZ',access_type:'Wordpress',notes:''},
    {id:35,title:'Codex Fraternidades',url:'https://codexfraternidades.com/',username:'paolo.ayamamani@gmail.com',password:'J5CB89wsvh*kY71@Thfh#$52',access_type:'Wordpress',notes:''},
    {id:36,title:'REIC',url:'https://reiccommunity.com/',username:'editor@gmail.com',password:'0Uq2O@cQwdVBkNfjjslQ11Tq',access_type:'Wordpress',notes:''},
    {id:37,title:'Alamece Congresos',url:'https://alamececongresos.com/',username:'webmaster',password:'U1g5Xf(dlZT@y%$@leMZTTa6',access_type:'Wordpress',notes:''},
    {id:38,title:'Iceberg Agency',url:'https://icebergup.com/',username:'alonso@gmail.com',password:'W%CXb(0%iWl%*KtqxrwbJ9Do',access_type:'Wordpress',notes:''},
    {id:39,title:'Consultoría Grupo JC',url:'https://consultoriagrupojc.com/',username:'consultoriagrupojc',password:'j)Bt#!P0cEO!4o42IWdclXNo',access_type:'Wordpress',notes:''},
    {id:40,title:'Esencia Natural',url:'https://esencianatural.pe/',username:'nextboost53',password:'I5&gu!*9peH4%%LS*GcQ^zw!',access_type:'Wordpress',notes:''},
    {id:41,title:'Hosting Web EuroProyectos',url:'http://s13.papahost.net:2222/evo/login',username:'europroyectos',password:'6HGVfgc2yx2u67w6ZNph',access_type:'Wordpress',notes:''},
    {id:42,title:'FIDES',url:'https://fideslatam.com/',username:'nextboost53',password:'%tV$!9FpBP!Ln7yHAe@3bKp^',access_type:'Wordpress',notes:''},
    {id:43,title:'WCA Group',url:'https://wcagroup.com.pe/',username:'samuel@gmail.com',password:'Dx8kpePcCKe$b)XYUF@6AIo4',access_type:'Wordpress',notes:''},
    {id:44,title:'Observatorio Ucayali',url:'https://observatorioviolencia.regionucayali.gob.pe/',username:'samuel@gmail.com',password:'@FDoF9JR@FPt52wO@OyufUAq',access_type:'Wordpress',notes:''},
    {id:45,title:'Correo corporativo Despega Peru',url:'https://despegaperudigital.com/webmail',username:'desarrollo@despegaperudigital.com',password:'DPeruDigit@l2025',access_type:'Otro',notes:'Esta cuenta hay que mantenerlo para lo que amerite con clientes de Despega Peru Digital'},
    {id:46,title:'Fragancias bono y guerlan',url:'https://fraganciasbonoyguerlan.pe/wp-admin',username:'nextboost53',password:'R)6ezUpVn@2v+2-',access_type:'Wordpress',notes:''},
    {id:47,title:'Summilab',url:'https://summilab.com/',username:'samuel@gmail.com',password:'Dg4g%CyV(iSPYPuOUk()AtVO',access_type:'Wordpress',notes:''},
    {id:48,title:'Loginexia',url:'https://loginexia.com/',username:'nuveryatm_awkuu8b7',password:'X!B7nd31Bi',access_type:'Wordpress',notes:''},
    {id:49,title:'Book Tesis Vip',url:'https://book.tesis-vip.com/',username:'samuel@gmail.com',password:'SPLsE2KvRDm)FEfvDCuzjELZ',access_type:'Wordpress',notes:''},
    {id:50,title:'Invial MX',url:'https://invial.mx/',username:'samuel@gmail.com',password:'g(9)0WkI#BFLkmsOM*8)9&z8',access_type:'Wordpress',notes:''},
    {id:51,title:'MetaTesis',url:'https://metatesis.pe/',username:'samuel@gmail.com',password:'Rw@kB!vAeaV7e(Zpu!yAMfbo',access_type:'Wordpress',notes:''},
    {id:52,title:'NewVolt Motors',url:'https://newvoltmotorsperu.com/',username:'samuel@gmail.com',password:'b)gZfDird3VyaasEn9vtip&)',access_type:'Wordpress',notes:''},
    {id:53,title:'Flipper Inmuebles',url:'https://flipperinmuebles.com/',username:'bdelacruz654@gmail.com',password:'zwGgZi(YWcoh#&(ST8FIa%TI',access_type:'Wordpress',notes:''},
    {id:54,title:'Fertur',url:'https://www.fertur-travel.com/',username:'moises',password:'MqDBsnCVz7W3',access_type:'Wordpress',notes:''},
    {id:55,title:'Hosting Next Boost Peru Cpanel',url:'https://bzcreativa.com:2087/',username:'bzcreativa',password:'q~[eY4?fE&&2',access_type:'Cpanel',notes:''},
    {id:56,title:'ITAMOS PERU',url:'https://itamosperu.com/',username:'marketing',password:'Marketing12345.',access_type:'Wordpress',notes:''},
    {id:57,title:'Sergio Salinas',url:'https://sergio-salinas.com/',username:'nextboost53@gmail.com',password:'1OOrTRl9tjh%Ms0nIfP*A(uB',access_type:'Wordpress',notes:''},
    {id:58,title:'API Reniec',url:'https://apiperu.dev/',username:'bdelacruz654@gmail.com',password:'y0xLMzqed',access_type:'Otro',notes:''},
    {id:59,title:'Ecotours Cpanel',url:'https://ecotourstravel.com:2083/',username:'ecotourstravel',password:'eX+Z{ZeyJpeM',access_type:'Cpanel',notes:''},
    {id:60,title:'Moradito Show (Sorteos)',url:'https://moraditochow.com/',username:'nextboost53',password:'jzs0t&TBeVqbN0aRYnVK2oaj',access_type:'Wordpress',notes:''},
    {id:61,title:'Asesores Academicos PRO',url:'https://asesoresacademicos.pro/',username:'nextboost53',password:'w3rjup#~2{5HRbV9~',access_type:'Wordpress',notes:''},
    {id:62,title:'Siseg Solutions',url:'https://sisegsolutions.com/',username:'bdelacruz654@gmail.com',password:'wkI!DPX5x6nDVnU832hNPXqU',access_type:'Wordpress',notes:''},
    {id:63,title:'Asdet',url:'https://asdet.edu.pe/wp-admin',username:'bdelacruz654@gmail.com',password:'ejbtxXJDRl^Jrft2KK#$qgox',access_type:'Wordpress',notes:null},
    {id:64,title:'Constructora Mallorca',url:'https://constructoramallorca.com/',username:'Editor',password:'N6BFGdbSenBtyz0y3Vpm720s',access_type:'Wordpress',notes:''},
    {id:65,title:'ASIPC',url:'https://asipc.pe/',username:'samuel@gmail.com',password:'0Qz8AArqyjg&DEx$lusBfj)H',access_type:'Wordpress',notes:''},
    {id:66,title:'Corporación Traveldyn',url:'https://corptraveldyn.com/',username:'samuel@gmail.com',password:'@9wG3Wz*EMvSfG5Zi^H)VEcJ',access_type:'Wordpress',notes:''},
    {id:67,title:'Casa & Estilo',url:'https://casayestilo.com.pe/',username:'nextboost53',password:'L%62*8$3%2$m243F7cA6#^*2^',access_type:'Wordpress',notes:null},
    {id:68,title:'Nuevo Hosting Next Boost Peru Cpanel',url:'https://nextboost.tech:2087/',username:'nextboos',password:'QpRzz*9+6Dt7T1',access_type:'Cpanel',notes:''},
    {id:69,title:'90teros',url:'https://90teros.com.pe/wp-login',username:'bdelacruz654@gmail.com',password:'@aWOi5dbAA99SvB4',access_type:'Wordpress',notes:''},
    {id:70,title:'WHM Cpanel Martin España',url:'https://whm.hostingkitdigital.es/cpsess9253404003/',username:'martingo',password:'kDuit!EiEYmg6*gaDw',access_type:'Wordpress',notes:''},
    {id:71,title:'Andes Mining Eval',url:'https://andesminingeval.com/',username:'nextboost53',password:'2&Bv22u7f8#o!%2@&*@8$77Uy',access_type:'Wordpress',notes:null},
    {id:72,title:'ESSNOVA',url:'https://www.essnnova.com/',username:'nnova',password:'$Prueba.2025..$',access_type:'admin',notes:null},
    {id:73,title:'HTP (Human Talent Partners)',url:'https://humantp.com/',username:'nextboost53',password:'i67@5*3^@E@6$P4o7G%*5#27#',access_type:'admin',notes:null},
    {id:74,title:'Babyland',url:'https://bloomland.com.pe/',username:'nextboost53',password:'^23@#@r9^68$5&r!5956$pL39',access_type:'admin',notes:null},
    {id:75,title:'Hydrogroup',url:'https://hydrogroup.nextboostperu.com/',username:'nextboost53',password:'26k#373&g*X7N!!94K9V&@&!W',access_type:'admin',notes:null},
    {id:76,title:'Anies Floristeria',url:'https://aniesfloristeria.com/',username:'nextboost53',password:'45B4$%Td#@K@%5&97%5x%44*7',access_type:'admin',notes:null},
    {id:77,title:'Todo en pesca',url:'https://todoenpesca.com/',username:'nextboost53',password:'&3@5^r948X^i!896m!&3iR$^6',access_type:'admin',notes:''},
    {id:78,title:'Cilantro Fusion Cpanel',url:'https://cilantrofusion.pe:2083/',username:'cilantrofusion',password:'N5+Hsony$4*K',access_type:'admin',notes:null},
    {id:79,title:'Iceberg Panel Hostgator Jorge',url:'https://billing.hostgator.net.ec/',username:'icebergagencyec@gmail.com',password:'ADSAFDsfafsd##$$//1246',access_type:'admin',notes:null},
    {id:80,title:'Kiwi Limón',url:'https://kiwilimon.icebergup.com/',username:'nextboost53',password:'#5X42V*E642%$*4i*4*^!y#35',access_type:'admin',notes:null},
    {id:81,title:'Artículos Digitales MX',url:'https://articulosdigitales.store/',username:'nextboost53',password:'%!m&6!6K6$@7982!r68^%3eG5',access_type:'admin',notes:null},
    {id:82,title:'Indigo',url:'https://indigo.icebergup.com/',username:'admin',password:'23&g*&79#7%!8%9#X&Cbp59H&',access_type:'admin',notes:''},
    {id:83,title:'AXIO',url:'https://axio.pe/',username:'admin',password:'9t&%$N5%7D7^384#9#8b469@#',access_type:'admin',notes:''},
    {id:85,title:'DECORCASAS',url:'https://decorcasas.com/',username:'nextboost53',password:'94#$7*#2v49F@3*K@87!@4wkp',access_type:'admin',notes:''},
    {id:86,title:'FORINTEP',url:'https://forintep.com/',username:'admin',password:'2t%9@$b65^&&7^6!#^2#L2iK9',access_type:'admin',notes:''},
    {id:87,title:'Nuevo Hosting Next Boost Peru Cpanel',url:'https://server.intecdev.com:2087/',username:'astrostu',password:'7+h5ZB2P1gy(kV',access_type:'admin',notes:''},
    {id:88,title:'CONNECTIC',url:'https://connectic.pe/',username:'admin',password:'*676q$N3*N2X*Vk@2nQ&9eZTv',access_type:'admin',notes:''},
    {id:89,title:'Hostinger Martin España',url:'https://auth.hostinger.com/',username:'info@martinsthings.es',password:'Martin7651+',access_type:'admin',notes:''},
    {id:90,title:'SN WHITE HOSTING Martin España',url:'https://clients.snwhitehosting.com/clientarea.php',username:'info@redmartins.es',password:'vRHuzUiugt',access_type:'admin',notes:''},
    {id:91,title:'PROMACOFI',url:'https://tienda.promacofi.com/',username:'Admin',password:'v36GYa*Y5QG)NNvyr&Prom',access_type:'admin',notes:''},
    {id:92,title:'FAJAS SHANIA SHAPEWEAR',url:'https://fajasshania.com/',username:'nextboost53@gmail.com',password:'H%7nLa3e&79^c$TYACcU8!5&4',access_type:'admin',notes:''},
    {id:93,title:'QATA Group',url:'https://grupoqata.pe/qata-admin/',username:'QT-Group',password:'doJx@RUmhgtALL561D',access_type:'admin',notes:''},
    {id:94,title:'Erat Go',url:'https://eratgo.com/',username:'nextboost53@gmail.com',password:'DL9NJoiB0v%@4mBXK1jAxjA1',access_type:'admin',notes:''},
    {id:95,title:'Landing Renaced Manchas y Melasma',url:'https://manchasymelasma.renacedoficial.com/',username:'admin',password:'66X!#@Q2kyg%u$38X527%7xD^',access_type:'admin',notes:''},
    {id:96,title:'VPS',url:'https://76.13.160.64:8888/authentication',username:'fastuser',password:'VPSNextboost@2026',access_type:'admin',notes:''},
    {id:97,title:'Hosting Renaced',url:'https://cp7207.webempresa.eu:2443/login/collaborators/',username:'renaced1 / bdelacruz654@gmail.com',password:'8f118¿bR.ZME.1A^g',access_type:'admin',notes:'Usuario: renaced1\nCorreo: bdelacruz654@gmail.com'},
    {id:98,title:'Gousac',url:'https://gousaclogistics.com/panelgousac/',username:'bdelacruz',password:'GhWDb+ot38Cn6dAeOQvVtzo6eGQxbkU3UEVINzRNb3kxMzhjamJBeDRuSE16ZGNJTm9sKzdobkNLWDZjaz0=',access_type:'admin',notes:''},
    {id:99,title:'Janeth Zambrano',url:'https://janethzambrano.com/',username:'admin',password:'Abp8x+LUxywvq7pLQCFkJDo6QUN2RS9lUDdJQnR6ZGVqU1lWbVVUaVl6WVUyWkY4bC9hZ0ZSQVV2Z2FhVT0=',access_type:'admin',notes:''},
  ];
  for (const wc of webCreds) {
    const notes = (wc.notes || '') + (wc.notes ? ' | ' : '') + 'Tipo: ' + wc.access_type;
    const catMap: Record<string, string> = { Wordpress: 'cms', Cpanel: 'hosting', admin: 'other', Otro: 'other' };
    const category = catMap[wc.access_type] || 'other';
    await executeQuery('INSERT IGNORE INTO credentials (id,title,url,username,password,notes,category) VALUES (?,?,?,?,?,?,?)',
      ['cred-web-' + wc.id, wc.title, wc.url, wc.username, wc.password, notes, category]);
  }
}

async function seedCredentialsIfEmpty(): Promise<void> {
  try {
    const [rows] = await (getMysqlPool() as any).execute('SELECT COUNT(*) as cnt FROM credentials');
    if (rows[0].cnt > 0) { console.log('[MySQL] Credentials already seeded, skipping.'); return; }
  } catch { /* table may not exist yet */ }
  console.log('[MySQL] Seeding credentials...');
  await seedCredentialsData();
}
