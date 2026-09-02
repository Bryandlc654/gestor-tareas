import "dotenv/config";
import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import compression from "compression";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { getAuthConfig } from "./src/auth-config";
import { bootstrapMysqlSchema } from "./src/db/mysql";
import * as dao from "./src/db/dao";
import { initFirebaseAdmin, sendFCMToUser, sendFCMToMultipleUsers } from "./src/utils/fcm-server";
import { sendEmail, emailTemplate } from "./src/utils/smtp";
import { getSmartLinkMetadata } from "./src/utils/smart-links";
import type { User, Role, Workspace, Folder, Task, PersonalTodo, Meeting, Client, Quote, Contract, Service, CredentialWeb, ChatChannel, ChatMessage, Notification, SupportTicket, TicketClient, PortfolioItem } from "./src/types";

// Lazy-loaded ESM-only Auth.js modules (loaded at startup via dynamic import)
let authJsGetSession: any = null;
let authJsExpressAuth: any = null;
let authJsConfig: any = null;

const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  console.warn("[WARN] JWT_SECRET no configurado. Usando valor por defecto. RECOMENDADO CONFIGURAR EN PRODUCCIÓN.");
  return "agencia-jwt-secret-dev-2026";
})();
const JWT_EXPIRES_IN = "24h";

function genId(prefix: string): string {
  return prefix + crypto.randomUUID();
}

interface JwtPayload {
  userId: string;
  email: string;
  roleId: string;
}

const MAX_STR_LEN = 5000;
const MAX_SHORT_STR = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeStr(val: unknown, max = MAX_STR_LEN): string {
  if (typeof val !== 'string') return '';
  const s = val.trim().slice(0, max);
  return s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

function safeFloat(val: unknown): number {
  if (val === undefined || val === null) return 0;
  const n = parseFloat(String(val));
  return isNaN(n) ? 0 : Math.max(0, n);
}

function safeEmail(val: unknown): string {
  const s = sanitizeStr(val, 254);
  return EMAIL_RE.test(s) ? s : '';
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.path.startsWith('/api/')) return next();

  const publicPaths = [
    '/api/auth/login',
    '/api/auth/csrf',
    { path: '/api/tickets', method: 'POST' },
    { path: '/api/ticket-clients/login', method: 'POST' },
    { path: '/api/tickets/by-client', method: 'POST' },
    { path: '/api/agency', method: 'GET' },
    { path: '/api/portfolio', method: 'GET' },
    { path: '/api/upload-public', method: 'POST' },
  ];
  const isTicketComment = req.path.startsWith('/api/tickets/') && req.path.endsWith('/comments') && req.method === 'POST';
  const isClientTicketEdit = (req.path.startsWith('/api/tickets/') && (req.method === 'PUT' || req.method === 'DELETE'))
    && req.headers['x-client-code'];
  const isClientTicketsGet = req.path === '/api/tickets' && req.method === 'GET' && req.headers['x-client-code'];

  const isPublic = publicPaths.some(p => {
    if (typeof p === 'string') return req.path === p;
    return req.path === p.path && req.method === p.method;
  });
  if (isPublic || isTicketComment || isClientTicketEdit || isClientTicketsGet) return next();

  // Skip Auth.js internal routes (handled by ExpressAuth)
  if (req.path.startsWith('/api/auth/')) return next();

  // Try Auth.js session first (cookie-based)
  authJsGetSession(req, authJsConfig).then(session => {
    if (session?.user) {
      (req as any).user = { userId: (session.user as any).id, email: session.user.email, roleId: '' };
      return next();
    }
    // Fallback: legacy JWT bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      (req as any).user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  }).catch(() => {
    return res.status(401).json({ error: 'Token requerido' });
  });
}

function asyncHandler(fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<any>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.set('trust proxy', 1);
  // Compression skips SSE: buffering would delay real-time events
  app.use(compression({
    filter: (req, res) => {
      if (req.path === '/api/realtime') return false;
      return compression.filter(req, res);
    }
  }));
  app.use(express.json({ limit: '5mb' }));

  const limiter = rateLimit({
    windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
    skip: (req) => req.path === '/realtime',
    message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' }
  });
  const authLimiter = rateLimit({
    windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Demasiados intentos de login. Intenta de nuevo en un minuto.' }
  });
  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Demasiadas subidas. Intenta de nuevo en un minuto.' }
  });
  const smartLinkLimiter = rateLimit({
    windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' }
  });
  app.use('/api/', limiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/upload', uploadLimiter);
  app.use('/api/upload-public', uploadLimiter);
  app.use('/api/smart-links', smartLinkLimiter);

  let sseClients: Array<{ id: string; userId: string; res: any }> = [];

  function broadcastToUser(userId: string, data: any) {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(c => {
      if (c.userId === userId) {
        try { c.res.write(msg); } catch {}
      }
    });
  }

  function getAppUrl() {
    return (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
  }

  async function sendEmailToUser(userId: string, subject: string, html: string) {
    try {
      const user = await dao.getUserById(userId);
      if (user?.email) await sendEmail(user.email, subject, html);
    } catch (err) {
      console.error(`[SMTP] Error sending to ${userId}:`, err);
    }
  }

  app.get("/api/realtime", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.header('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const clientId = crypto.randomUUID();
    const userId = (req.query.userId as string) || '';
    sseClients.push({ id: clientId, userId, res });
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const pingInterval = setInterval(() => {
      try { res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`); } catch {}
    }, 20000);

    req.on("close", () => {
      clearInterval(pingInterval);
      sseClients = sseClients.filter(c => c.id !== clientId);
    });
  });

  const sseCleanupInterval = setInterval(() => {
    const before = sseClients.length;
    sseClients = sseClients.filter(c => {
      try { c.res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`); return true; }
      catch { return false; }
    });
    if (sseClients.length < before) console.debug(`[SSE] Cleaned up ${before - sseClients.length} stale connection(s)`);
  }, 60000);

  if (process.env.USE_MYSQL === "true") {
    try { await bootstrapMysqlSchema(); }
    catch (e) { console.error("[MySQL] Error auto-bootstrapping:", e); }
  }

  initFirebaseAdmin();

  // --- AUTH.JS (Google + Credentials) - Dynamic ESM imports ---
  const [{ ExpressAuth, getSession }, authConfigMod] = await Promise.all([
    import("@auth/express"),
    import("./src/auth-config"),
  ]);
  authJsGetSession = getSession;
  authJsExpressAuth = ExpressAuth;
  authJsConfig = await authConfigMod.getAuthConfig();

  // Legacy email/password login (must be before ExpressAuth to avoid interception)
  app.post("/api/auth/login", asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email y contraseña requeridos" });
    const user = await dao.getUserByEmail(email);
    if (!user || !user.password) return res.status(401).json({ error: "Credenciales inválidas" });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: "Credenciales inválidas" });
    const payload: JwtPayload = { userId: user.id, email: user.email, roleId: user.roleId };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  }));

  // Get current user from Auth.js session or legacy JWT
  app.get("/api/auth/me", asyncHandler(async (req, res) => {
    // Try Auth.js session first
    const session = await authJsGetSession(req, authJsConfig);
    if (session?.user) {
      const userId = (session.user as any).id;
      if (userId) {
        const user = await dao.getUserById(userId);
        if (user) {
          const { password: _, ...safeUser } = user;
          return res.json(safeUser);
        }
      }
    }
    // Fallback: legacy JWT from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as JwtPayload;
        const user = await dao.getUserById(decoded.userId);
        if (user) {
          const { password: _, ...safeUser } = user;
          return res.json(safeUser);
        }
      } catch {}
    }
    return res.status(401).json({ error: "No autenticado" });
  }));

  // Auth.js catch-all (Google, CSRF, session, signout, etc.)
  app.use("/api/auth", authJsExpressAuth(authJsConfig));

  app.use(authMiddleware);

  // 1. AGENCY & PORTFOLIO
  app.get("/api/agency", asyncHandler(async (_req, res) => {
    const info = await dao.getAgencyInfo();
    res.json(info);
  }));

  app.put("/api/agency", asyncHandler(async (req, res) => {
    const info = await dao.upsertAgencyInfo(req.body);
    res.json(info);
  }));

  app.get("/api/portfolio", asyncHandler(async (_req, res) => {
    res.json(await dao.listPortfolio());
  }));

  app.post("/api/portfolio", asyncHandler(async (req, res) => {
    const item: PortfolioItem = {
      id: genId("port-"),
      title: sanitizeStr(req.body.title, MAX_SHORT_STR) || "Nuevo Proyecto",
      description: sanitizeStr(req.body.description),
      image: sanitizeStr(req.body.image, 2000) || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600",
      category: sanitizeStr(req.body.category, 100) || "General",
      clientUrl: sanitizeStr(req.body.clientUrl, 2000)
    };
    await dao.createPortfolio(item);
    res.status(201).json(item);
  }));

  app.delete("/api/portfolio/:id", asyncHandler(async (req, res) => {
    await dao.deletePortfolio(req.params.id);
    res.json({ success: true });
  }));

  app.put("/api/portfolio/:id", asyncHandler(async (req, res) => {
    const ok = await dao.updatePortfolioItem(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: "Item de portafolio no encontrado" });
    res.json({ success: true });
  }));

  // 2. ROLES
  app.get("/api/roles", asyncHandler(async (_req, res) => {
    res.json(await dao.listRoles());
  }));

  app.post("/api/roles", asyncHandler(async (req, res) => {
    const role: Role = {
      id: genId("role-"),
      name: sanitizeStr(req.body.name, MAX_SHORT_STR),
      description: sanitizeStr(req.body.description),
      permissions: Array.isArray(req.body.permissions) ? req.body.permissions.slice(0, 50).map((p: unknown) => sanitizeStr(p, 100)) : []
    };
    await dao.createRole(role);
    res.status(201).json(role);
  }));

  app.put("/api/roles/:id", asyncHandler(async (req, res) => {
    const ok = await dao.updateRole(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: "Rol no encontrado" });
    const role = await dao.getRoleById(req.params.id);
    res.json(role);
  }));

  app.delete("/api/roles/:id", asyncHandler(async (req, res) => {
    const ok = await dao.deleteRole(req.params.id);
    if (!ok) return res.status(404).json({ error: "Rol no encontrado" });
    res.json({ success: true });
  }));

  // 3. USERS
  app.get("/api/users", asyncHandler(async (_req, res) => {
    const users = await dao.listUsers();
    res.json(users.map(u => { const { password, ...safe } = u; return safe; }));
  }));

  app.post("/api/users", asyncHandler(async (req, res) => {
    const passwordHash = req.body.password ? bcrypt.hashSync(sanitizeStr(req.body.password, 128), 10) : undefined;
    const user: User = {
      id: genId("user-"),
      name: sanitizeStr(req.body.name, MAX_SHORT_STR),
      email: safeEmail(req.body.email),
      password: passwordHash,
      roleId: sanitizeStr(req.body.roleId, 100) || "role-developer",
      avatar: sanitizeStr(req.body.avatar, 2000) || `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random()*1000000)}?auto=format&fit=crop&q=80&w=150`,
      status: ['active', 'inactive', 'suspended'].includes(req.body.status) ? req.body.status : "active"
    };
    await dao.createUser(user);
    const { password: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  }));

  app.put("/api/users/:id", asyncHandler(async (req, res) => {
    const updates = { ...req.body };
    if (updates.password) updates.password = bcrypt.hashSync(updates.password, 10);
    else delete updates.password;
    const ok = await dao.updateUser(req.params.id, updates);
    if (!ok) return res.status(404).json({ error: "Usuario no encontrado" });
    const user = await dao.getUserById(req.params.id);
    const { password: _, ...safeUser } = user!;
    res.json(safeUser);
  }));

  app.delete("/api/users/:id", asyncHandler(async (req, res) => {
    const ok = await dao.deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ success: true });
  }));

  // 4. WORKSPACES, FOLDERS & TASKS
  app.get("/api/workspaces", asyncHandler(async (_req, res) => {
    res.json(await dao.listWorkspaces());
  }));

  app.post("/api/workspaces", asyncHandler(async (req, res) => {
    const ws: Workspace = {
      id: genId("ws-"),
      name: sanitizeStr(req.body.name, MAX_SHORT_STR),
      icon: sanitizeStr(req.body.icon, 100) || "Folder",
      description: sanitizeStr(req.body.description)
    };
    await dao.createWorkspace(ws);
    res.status(201).json(ws);
  }));

  app.put("/api/workspaces/:id", asyncHandler(async (req, res) => {
    const ok = await dao.updateWorkspace(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: "Workspace no encontrado" });
    res.json({ success: true });
  }));

  app.delete("/api/workspaces/:id", asyncHandler(async (req, res) => {
    await dao.deleteWorkspace(req.params.id);
    res.json({ success: true });
  }));

  app.get("/api/folders", asyncHandler(async (_req, res) => {
    res.json(await dao.listFolders());
  }));

  app.post("/api/folders", asyncHandler(async (req, res) => {
    const folder: Folder = {
      id: genId("fold-"),
      workspaceId: sanitizeStr(req.body.workspaceId, 100),
      name: sanitizeStr(req.body.name, MAX_SHORT_STR)
    };
    await dao.createFolder(folder);
    res.status(201).json(folder);
  }));

  app.delete("/api/folders/:id", asyncHandler(async (req, res) => {
    await dao.deleteFolder(req.params.id);
    res.json({ success: true });
  }));

  app.put("/api/folders/:id", asyncHandler(async (req, res) => {
    const ok = await dao.updateFolder(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: "Carpeta no encontrada" });
    res.json({ success: true });
  }));

  app.get("/api/tasks", asyncHandler(async (_req, res) => {
    res.json(await dao.listTasks());
  }));

  app.post("/api/tasks", asyncHandler(async (req, res) => {
    const bodyAssigned = req.body.assignedTo;
    const assignedTo: string[] = Array.isArray(bodyAssigned) ? bodyAssigned.map((s: any) => sanitizeStr(s, 100)).filter(Boolean)
      : typeof bodyAssigned === 'string' && bodyAssigned ? [sanitizeStr(bodyAssigned, 100)]
      : ['user-1'];
    const task: Task = {
      id: genId("task-"),
      workspaceId: sanitizeStr(req.body.workspaceId, 100),
      folderId: sanitizeStr(req.body.folderId, 100),
      title: sanitizeStr(req.body.title, MAX_SHORT_STR),
      description: sanitizeStr(req.body.description),
      status: ['todo', 'in_progress', 'done'].includes(req.body.status) ? req.body.status : "todo",
      priority: ['low', 'medium', 'high', 'urgent'].includes(req.body.priority) ? req.body.priority : "medium",
      dueDate: req.body.dueDate || new Date().toISOString().split('T')[0],
      assignedTo,
      tags: Array.isArray(req.body.tags) ? req.body.tags.slice(0, 20).map((t: unknown) => sanitizeStr(t, 100)) : [],
      checklist: Array.isArray(req.body.checklist) ? req.body.checklist : [],
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      links: Array.isArray(req.body.links) ? req.body.links : [],
      taskOrder: typeof req.body.taskOrder === 'number' ? req.body.taskOrder : 0
    };
    await dao.createTask(task);
    res.status(201).json(task);

    // Fire-and-forget: notifications must not block the HTTP response
    if (task.assignedTo.length) {
      void (async () => {
        try {
          const users = await dao.listUsers();
          const appUrl = getAppUrl();
          for (const uid of task.assignedTo) {
            const n = {
              id: genId("n-"), userId: uid,
              text: `Nueva tarea asignada en Kanban: "${task.title}"`,
              type: "task", read: false, timestamp: new Date().toISOString()
            };
            await dao.createNotification(n);
            broadcastToUser(uid, { type: 'notification', notification: n });
            sendFCMToUser(uid, 'Nueva tarea asignada', n.text, { type: 'task', taskId: task.id }).catch(e => console.error(e));
            const u = users.find(u => u.id === uid);
            sendEmailToUser(uid, `Nueva tarea asignada: ${task.title}`,
              emailTemplate({
                userName: u?.name || '',
                title: 'Nueva tarea asignada',
                message: `Se te asignó la tarea <strong>${task.title}</strong> en el tablero Kanban.`,
                buttonText: 'Ver en Kanban',
                buttonUrl: `${appUrl}/workspace`,
                details: [
                  { label: 'Prioridad', value: task.priority === 'high' ? '🔴 Alta' : task.priority === 'medium' ? '🟡 Media' : '🟢 Baja' },
                  { label: 'Vence', value: task.dueDate },
                ]
              })
            ).catch(e => console.error(e));
          }
        } catch (err) { console.error('[Notify] task assignment failed:', err); }
      })();
    }
  }));

  // Batch reorder tasks (drag-and-drop Kanban)
  app.post("/api/tasks/reorder", asyncHandler(async (req, res) => {
    const { tasks: updates } = req.body;
    if (!Array.isArray(updates)) return res.status(400).json({ error: "Se requiere array 'tasks'" });
    for (const u of updates) {
      if (u.id) {
        await dao.updateTask(u.id, { status: u.status, taskOrder: u.taskOrder });
      }
    }
    res.json({ success: true });
  }));

  app.put("/api/tasks/:id", asyncHandler(async (req, res) => {
    const original = await dao.getTaskById(req.params.id);
    if (!original) return res.status(404).json({ error: "Tarea no encontrada" });
    const updated = { ...original, ...req.body };
    if (Array.isArray(req.body.assignedTo)) {
      updated.assignedTo = req.body.assignedTo.map((s: any) => sanitizeStr(s, 100)).filter(Boolean);
    }
    const oldAssigned = original.assignedTo || [];
    const newAssigned = updated.assignedTo || [];
    const added = newAssigned.filter((uid: string) => !oldAssigned.includes(uid));
    await dao.updateTask(req.params.id, updated);
    res.json(updated);

    // Fire-and-forget: notifications must not block the HTTP response
    void (async () => {
      try {
        for (const uid of added) {
          const n = {
            id: genId("n-"), userId: uid,
            text: `Te asignaron la tarea: "${updated.title}"`,
            type: "task", read: false, timestamp: new Date().toISOString()
          };
          await dao.createNotification(n);
          broadcastToUser(uid, { type: 'notification', notification: n });
          sendFCMToUser(uid, 'Tarea reasignada', n.text, { type: 'task', taskId: updated.id }).catch(e => console.error(e));
          sendEmailToUser(uid, `Tarea asignada: ${updated.title}`,
            emailTemplate({
              userName: '',
              title: 'Tarea reasignada',
              message: `Se te asignó la tarea <strong>${updated.title}</strong>.`,
              buttonText: 'Ver en Kanban',
              buttonUrl: `${getAppUrl()}/workspace`,
            })
          ).catch(e => console.error(e));
        }
        const statusChanged = updated.status !== original.status;
        if (statusChanged) {
          const users = await dao.listUsers();
          const appUrl = getAppUrl();
          const statusLabels: Record<string, string> = { todo: 'Sin Empezar', in_progress: 'En Progreso', review: 'Revisión', done: 'Completada' };
          const label = statusLabels[updated.status] || updated.status;
          // Notify all assignees about status change
          for (const uid of newAssigned) {
            const n = {
              id: genId("n-"), userId: uid,
              text: `Tarea "${updated.title}" cambió a: ${label}`,
              type: "task", read: false, timestamp: new Date().toISOString()
            };
            await dao.createNotification(n);
            broadcastToUser(uid, { type: 'notification', notification: n });
            sendFCMToUser(uid, 'Estado de tarea actualizado', n.text, { type: 'task', taskId: updated.id }).catch(e => console.error(e));
            const u = users.find(u => u.id === uid);
            sendEmailToUser(uid, `Tarea actualizada: ${updated.title}`,
              emailTemplate({
                userName: u?.name || '',
                title: 'Estado de tarea actualizado',
                message: `La tarea <strong>${updated.title}</strong> cambió a <strong>${label}</strong>.`,
                buttonText: 'Ver en Kanban',
                buttonUrl: `${appUrl}/workspace`,
              })
            ).catch(e => console.error(e));
          }
          // Notify admins on any status change (not just done)
          const assigneeNames = newAssigned.map((uid: string) => users.find(u => u.id === uid)?.name).filter(Boolean).join(', ') || 'sin asignar';
          users.filter(u => u.roleId === 'role-admin').forEach(async (pm) => {
            const n = {
              id: genId("n-"), userId: pm.id,
              text: `Tarea "${updated.title}" (${assigneeNames}) cambió a: ${label}`,
              type: "task", read: false, timestamp: new Date().toISOString()
            };
            await dao.createNotification(n);
            broadcastToUser(pm.id, { type: 'notification', notification: n });
            sendFCMToUser(pm.id, 'Tarea actualizada', n.text, { type: 'task', taskId: updated.id }).catch(e => console.error(e));
            const pmUser = users.find(u => u.id === pm.id);
            sendEmailToUser(pm.id, `Tarea actualizada: ${updated.title}`,
              emailTemplate({
                userName: pmUser?.name || '',
                title: 'Tarea actualizada',
                message: `La tarea <strong>${updated.title}</strong> (asignada a: ${assigneeNames}) cambió a <strong>${label}</strong>.`,
                buttonText: 'Ver en Kanban',
                buttonUrl: `${appUrl}/workspace`,
              })
            ).catch(e => console.error(e));
          });
        }
      } catch (err) { console.error('[Notify] task update failed:', err); }
    })();
  }));

  app.delete("/api/tasks/:id", asyncHandler(async (req, res) => {
    await dao.deleteTask(req.params.id);
    res.json({ success: true });
  }));

  // 4b. Task Comments
  app.get("/api/tasks/:id/comments", asyncHandler(async (req, res) => {
    res.json(await dao.listTaskComments(req.params.id));
  }));

  app.post("/api/tasks/:id/comments", asyncHandler(async (req, res) => {
    const now = new Date().toISOString();
    const comment = {
      id: genId("tc-"),
      taskId: req.params.id,
      userId: sanitizeStr(req.body.userId, 100),
      userName: sanitizeStr(req.body.userName, 255),
      userAvatar: sanitizeStr(req.body.userAvatar, 500) || '',
      text: sanitizeStr(req.body.text),
      timestamp: now
    };
    await dao.createTaskComment(comment);
    res.status(201).json(comment);

    // Fire-and-forget: notify assignees about comment without blocking response
    void (async () => {
      try {
        const task = await dao.getTaskById(req.params.id);
        if (task && task.assignedTo.length) {
          const users = await dao.listUsers();
          const recipients = task.assignedTo.filter(uid => uid !== comment.userId);
          for (const uid of recipients) {
            const n = {
              id: genId("n-"), userId: uid,
              text: `Nuevo comentario en "${task.title}": "${comment.text.slice(0, 80)}"`,
              type: "task" as const, read: false, timestamp: now
            };
            await dao.createNotification(n);
            broadcastToUser(uid, { type: 'notification', notification: n });
            sendFCMToUser(uid, 'Nuevo comentario en tarea', n.text, { type: 'task_comment', taskId: task.id }).catch(e => console.error(e));
            sendEmailToUser(uid, `Nuevo comentario: ${task.title}`,
              emailTemplate({
                userName: users.find(u => u.id === uid)?.name || '',
                title: 'Nuevo comentario',
                message: `<strong>${comment.userName}</strong> comentó en <strong>${task.title}</strong>:<br/><br/><em>"${comment.text.slice(0, 200)}"</em>`,
                buttonText: 'Ver Tarea',
                buttonUrl: `${getAppUrl()}/workspace`,
              })
            ).catch(e => console.error(e));
          }
        }
      } catch (err) { console.error('[Notify] task comment failed:', err); }
    })();
  }));

  app.delete("/api/tasks/:id/comments/:commentId", asyncHandler(async (req, res) => {
    await dao.deleteTaskComment(req.params.commentId);
    res.json({ success: true });
  }));

  // 5. TODOS
  app.get("/api/todos", asyncHandler(async (_req, res) => {
    res.json(await dao.listTodos());
  }));

  app.post("/api/todos", asyncHandler(async (req, res) => {
    const todo: PersonalTodo = {
      id: genId("todo-"),
      userId: sanitizeStr(req.body.userId, 100) || "user-1",
      title: sanitizeStr(req.body.title, MAX_SHORT_STR),
      status: 'todo'
    };
    await dao.createTodo(todo);
    res.status(201).json(todo);
  }));

  app.put("/api/todos/:id", asyncHandler(async (req, res) => {
    const ok = await dao.updateTodo(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: "Item Todo no encontrado" });
    res.json({ success: true });
  }));

  app.delete("/api/todos/:id", asyncHandler(async (req, res) => {
    await dao.deleteTodo(req.params.id);
    res.json({ success: true });
  }));

  // 5b. MEETINGS
  app.get("/api/meetings", asyncHandler(async (_req, res) => {
    res.json(await dao.listMeetings());
  }));

  app.post("/api/meetings", asyncHandler(async (req, res) => {
    const bodyAssigned = req.body.assignedTo;
    const assignedTo: string[] = Array.isArray(bodyAssigned) ? bodyAssigned.map((s: any) => sanitizeStr(s, 100)).filter(Boolean) : [];
    const meeting: Meeting = {
      id: genId("meet-"),
      userId: sanitizeStr(req.body.userId, 100) || "user-1",
      title: sanitizeStr(req.body.title, MAX_SHORT_STR),
      description: sanitizeStr(req.body.description),
      date: req.body.date || new Date().toISOString().split('T')[0],
      time: sanitizeStr(req.body.time, 10) || "12:00",
      attendees: sanitizeStr(req.body.attendees, 1000),
      link: sanitizeStr(req.body.link, 500) || '',
      assignedTo,
      reminderMinutes: typeof req.body.reminderMinutes === 'number' ? req.body.reminderMinutes : 0,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };
    await dao.createMeeting(meeting);
    res.status(201).json(meeting);

    // Fire-and-forget: notify assigned users without blocking response
    if (assignedTo.length) {
      void (async () => {
        try {
          const users = await dao.listUsers();
          const appUrl = getAppUrl();
          for (const uid of assignedTo.filter(u => u !== meeting.userId)) {
            const n = {
              id: genId("n-"), userId: uid,
              text: `Nueva reunión: "${meeting.title}" el ${meeting.date} a las ${meeting.time}`,
              type: "task", read: false, timestamp: meeting.createdAt
            };
            await dao.createNotification(n);
            broadcastToUser(uid, { type: 'notification', notification: n });
            sendFCMToUser(uid, 'Nueva reunión programada', n.text, { type: 'meeting', meetingId: meeting.id }).catch(e => console.error(e));
            const u = users.find(user => user.id === uid);
            sendEmailToUser(uid, `Nueva reunión: ${meeting.title}`,
              emailTemplate({
                userName: u?.name || '',
                title: 'Nueva reunión agendada',
                message: `Se te ha invitado a la reunión <strong>${meeting.title}</strong> el ${meeting.date} a las ${meeting.time}.<br/><br/>${meeting.description ? `<em>${meeting.description}</em>` : ''}`,
                buttonText: 'Ver Detalles',
                buttonUrl: `${appUrl}/calendar`,
                details: [
                  { label: 'Fecha y Hora', value: `${meeting.date} - ${meeting.time}` },
                  { label: 'Enlace', value: meeting.link || 'Presencial' },
                ]
              })
            ).catch(e => console.error(e));
          }
        } catch (err) { console.error('[Notify] meeting failed:', err); }
      })();
    }
  }));

  app.put("/api/meetings/:id", asyncHandler(async (req, res) => {
    const ok = await dao.updateMeeting(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: "Reunión no encontrada" });
    res.json({ success: true });
  }));

  app.delete("/api/meetings/:id", asyncHandler(async (req, res) => {
    await dao.deleteMeeting(req.params.id);
    res.json({ success: true });
  }));

  // -- Meeting Minutes --
  app.get("/api/meeting-minutes", asyncHandler(async (_req, res) => {
    res.json(await dao.getMeetingMinutes());
  }));

  app.post("/api/meeting-minutes", asyncHandler(async (req, res) => {
    const mm = {
      id: genId("mm-"),
      title: sanitizeStr(req.body.title, 255),
      date: sanitizeStr(req.body.date, 50),
      participants: sanitizeStr(req.body.participants, 1000),
      observations: sanitizeStr(req.body.observations, 5000),
      documentUrl: sanitizeStr(req.body.documentUrl, 500),
      createdAt: new Date().toISOString()
    };
    await dao.createMeetingMinute(mm as any);
    res.status(201).json(mm);
  }));

  app.put("/api/meeting-minutes/:id", asyncHandler(async (req, res) => {
    await dao.updateMeetingMinute(req.params.id, req.body);
    res.json({ success: true });
  }));

  app.delete("/api/meeting-minutes/:id", asyncHandler(async (req, res) => {
    await dao.deleteMeetingMinute(req.params.id);
    res.json({ success: true });
  }));

  // 6. CRM
  app.get("/api/clients", asyncHandler(async (_req, res) => {
    res.json(await dao.listClients());
  }));

  app.post("/api/clients", asyncHandler(async (req, res) => {
    const vendorId = await getVendorId(req);
    const client: Client = {
      id: genId("cli-"),
      name: sanitizeStr(req.body.name, MAX_SHORT_STR),
      company: sanitizeStr(req.body.company, MAX_SHORT_STR) || "Particular",
      email: safeEmail(req.body.email),
      phone: sanitizeStr(req.body.phone, 50),
      status: ['lead', 'contacted', 'proposal', 'negotiation', 'won', 'lost'].includes(req.body.status) ? req.body.status : "lead",
      revenue: safeFloat(req.body.revenue),
      vendorId: vendorId || req.body.vendorId || undefined,
      city: sanitizeStr(req.body.city, 255) || '',
      serviceInterest: sanitizeStr(req.body.serviceInterest, 255) || '',
      notes: sanitizeStr(req.body.notes) || '',
      createdAt: new Date().toISOString()
    };
    await dao.createClient(client);
    res.status(201).json(client);
  }));

  app.put("/api/clients/:id", asyncHandler(async (req, res) => {
    const ok = await dao.updateClient(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json({ success: true });
  }));

  app.delete("/api/clients/:id", asyncHandler(async (req, res) => {
    await dao.deleteClient(req.params.id);
    res.json({ success: true });
  }));

  app.get("/api/quotes", asyncHandler(async (_req, res) => {
    res.json(await dao.listQuotes());
  }));

  app.post("/api/quotes", asyncHandler(async (req, res) => {
    const quote: Quote = {
      id: genId("q-"),
      clientId: sanitizeStr(req.body.clientId, 100),
      description: sanitizeStr(req.body.description),
      amount: safeFloat(req.body.amount),
      status: ['draft', 'sent', 'approved', 'rejected'].includes(req.body.status) ? req.body.status : 'draft',
      date: new Date().toISOString().split('T')[0]
    };
    await dao.createQuote(quote);
    res.status(201).json(quote);
  }));

  app.put("/api/quotes/:id", asyncHandler(async (req, res) => {
    const ok = await dao.updateQuote(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: "Cotización no encontrada" });
    res.json({ success: true });
  }));

  app.delete("/api/quotes/:id", asyncHandler(async (req, res) => {
    await dao.deleteQuote(req.params.id);
    res.json({ success: true });
  }));

  app.get("/api/contracts", asyncHandler(async (_req, res) => {
    res.json(await dao.listContracts());
  }));

  app.post("/api/contracts", asyncHandler(async (req, res) => {
    const contract: Contract = {
      id: genId("con-"),
      clientId: sanitizeStr(req.body.clientId, 100),
      title: sanitizeStr(req.body.title, MAX_SHORT_STR),
      value: safeFloat(req.body.value),
      status: ['draft', 'active', 'completed', 'cancelled'].includes(req.body.status) ? req.body.status : 'draft',
      startDate: new Date().toISOString().split('T')[0],
      endDate: sanitizeStr(req.body.endDate, 20)
    };
    await dao.createContract(contract);
    res.status(201).json(contract);
  }));

  app.put("/api/contracts/:id", asyncHandler(async (req, res) => {
    const ok = await dao.updateContract(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: "Contrato no encontrado" });
    res.json({ success: true });
  }));

  app.delete("/api/contracts/:id", asyncHandler(async (req, res) => {
    await dao.deleteContract(req.params.id);
    res.json({ success: true });
  }));

  app.get("/api/services", asyncHandler(async (_req, res) => {
    res.json(await dao.listServices());
  }));

  app.post("/api/services", asyncHandler(async (req, res) => {
    const service: Service = {
      id: genId("ser-"),
      name: sanitizeStr(req.body.name, MAX_SHORT_STR),
      description: sanitizeStr(req.body.description),
      price: safeFloat(req.body.price),
      type: ['one_time', 'monthly', 'yearly'].includes(req.body.type) ? req.body.type : 'one_time'
    };
    await dao.createService(service);
    res.status(201).json(service);
  }));

  app.put("/api/services/:id", asyncHandler(async (req, res) => {
    const ok = await dao.updateService(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: "Servicio no encontrado" });
    res.json({ success: true });
  }));

  app.delete("/api/services/:id", asyncHandler(async (req, res) => {
    await dao.deleteService(req.params.id);
    res.json({ success: true });
  }));

  // 7. CREDENTIALS
  app.get("/api/credentials", asyncHandler(async (_req, res) => {
    res.json(await dao.listCredentials());
  }));

  app.post("/api/credentials", asyncHandler(async (req, res) => {
    const cred: CredentialWeb = {
      id: genId("cred-"),
      title: sanitizeStr(req.body.title, MAX_SHORT_STR),
      url: sanitizeStr(req.body.url, 2000),
      username: sanitizeStr(req.body.username, MAX_SHORT_STR),
      password: sanitizeStr(req.body.password, 2000),
      notes: sanitizeStr(req.body.notes),
      category: sanitizeStr(req.body.category, 100) || "other"
    };
    await dao.createCredential(cred);
    res.status(201).json(cred);
  }));

  app.put("/api/credentials/:id", asyncHandler(async (req, res) => {
    const ok = await dao.updateCredential(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: "Credencial no encontrada" });
    res.json({ success: true });
  }));

  app.delete("/api/credentials/:id", asyncHandler(async (req, res) => {
    await dao.deleteCredential(req.params.id);
    res.json({ success: true });
  }));

  // 8. CHAT
  app.get("/api/channels", asyncHandler(async (_req, res) => {
    res.json(await dao.listChannels());
  }));

  app.post("/api/channels", asyncHandler(async (req, res) => {
    const chan: ChatChannel = {
      id: genId("chan-"),
      name: sanitizeStr(req.body.name, 100).toLowerCase().replace(/\s+/g, '-'),
      description: sanitizeStr(req.body.description),
      type: ['public', 'private'].includes(req.body.type) ? req.body.type : "public"
    };
    await dao.createChannel(chan);
    res.status(201).json(chan);
  }));

  app.put("/api/channels/:id", asyncHandler(async (req, res) => {
    const ok = await dao.updateChannel(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: "Canal no encontrado" });
    res.json({ success: true });
  }));

  app.delete("/api/channels/:id", asyncHandler(async (req, res) => {
    const ok = await dao.deleteChannel(req.params.id);
    if (!ok) return res.status(404).json({ error: "Canal no encontrado" });
    await dao.deleteChannelMessages(req.params.id);
    res.json({ success: true });
  }));

  app.get("/api/messages/:channelId", asyncHandler(async (req, res) => {
    res.json(await dao.getChannelMessages(req.params.channelId));
  }));

  app.post("/api/messages", asyncHandler(async (req, res) => {
    const userId = sanitizeStr(req.body.userId, 100);
    const user = userId ? await dao.getUserById(userId) : null;
    const msg: ChatMessage = {
      id: genId("m-"),
      channelId: sanitizeStr(req.body.channelId, 100),
      userId,
      userName: user ? user.name : "Sistema",
      userAvatar: user ? user.avatar : "",
      text: sanitizeStr(req.body.text, 10000),
      timestamp: new Date().toISOString(),
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments.slice(0, 10) : undefined
    };
    await dao.createMessage(msg);
    // Broadcast chat message to all connected SSE clients immediately
    const chatPayload = { type: 'chat_message', message: msg };
    sseClients.forEach(c => { try { c.res.write(`data: ${JSON.stringify(chatPayload)}\n\n`); } catch {} });
    res.status(201).json(msg);

    // Fire-and-forget: mentions + FCM pushes must not block the response
    void (async () => {
      try {
        // Parse @mentions and notify mentioned users
        const allUsers = await dao.listUsers();
        const mentionRegex = /@([\p{L}\p{M}]+)/gu;
        let mentionMatch;
        while ((mentionMatch = mentionRegex.exec(msg.text)) !== null) {
          const mentionText = mentionMatch[1];
          if (!mentionText) continue;
          const mentionedUser = allUsers.find(u =>
            u.name.toLowerCase().split(' ')[0] === mentionText.toLowerCase() ||
            u.name.toLowerCase().startsWith(mentionText.toLowerCase())
          );
          if (mentionedUser && mentionedUser.id !== userId) {
            const n = {
              id: genId("n-mention-"),
              userId: mentionedUser.id,
              text: `${user?.name || 'Alguien'} te mencionó en el chat: "${msg.text.slice(0, 100)}"`,
              type: "chat_mention",
              read: false,
              timestamp: new Date().toISOString()
            };
            await dao.createNotification(n);
            broadcastToUser(mentionedUser.id, { type: 'notification', notification: n });
            sendFCMToUser(mentionedUser.id, 'Mención en chat', n.text, { type: 'chat_mention' }).catch(e => console.error(e));
          }
        }
        // Send FCM push to all connected users (except sender)
        const fcmUserIds = [...new Set(sseClients.map(c => c.userId))].filter(uid => uid !== userId);
        await sendFCMToMultipleUsers(fcmUserIds, `Nuevo mensaje en #${msg.channelId}`, msg.text.slice(0, 100), { type: 'chat', channelId: msg.channelId, messageId: msg.id });
      } catch (err) { console.error('[Notify] chat message failed:', err); }
    })();
  }));

  app.delete("/api/messages/:id", asyncHandler(async (req, res) => {
    const ok = await dao.deleteMessage(req.params.id);
    if (!ok) return res.status(404).json({ error: "Mensaje no encontrado" });
    res.json({ success: true });
  }));

  // 9. NOTIFICATIONS
  app.get("/api/notifications/:userId", asyncHandler(async (req, res) => {
    res.json(await dao.getUserNotifications(req.params.userId));
  }));

  app.post("/api/notifications", asyncHandler(async (req, res) => {
    const n = {
      id: genId("n-"),
      userId: sanitizeStr(req.body.userId, 100),
      text: sanitizeStr(req.body.text),
      type: sanitizeStr(req.body.type, 50) || 'info',
      read: false,
      timestamp: new Date().toISOString()
    };
    await dao.createNotification(n);
    broadcastToUser(n.userId, { type: 'notification', notification: n });
    sendFCMToUser(n.userId, 'Notificación', n.text, { type: n.type }).catch(e => console.error(e));
    res.status(201).json(n);
  }));

  app.put("/api/notifications/:id/read", asyncHandler(async (req, res) => {
    const ok = await dao.markNotificationRead(req.params.id);
    if (!ok) return res.status(404).json({ error: "Notificación no encontrada" });
    res.json({ success: true });
  }));

  app.put("/api/notifications/user/:userId/read-all", asyncHandler(async (req, res) => {
    await dao.markAllNotificationsRead(req.params.userId);
    res.json({ success: true });
  }));

  // 9b. FCM TOKEN REGISTRATION
  app.post("/api/fcm/register", asyncHandler(async (req, res) => {
    const userId = sanitizeStr(req.body.userId, 100);
    const token = sanitizeStr(req.body.token);
    if (!userId || !token) return res.status(400).json({ error: "userId and token required" });
    await dao.registerFCMToken(genId("fcm-"), userId, token);
    res.json({ success: true });
  }));

  app.delete("/api/fcm/unregister", asyncHandler(async (req, res) => {
    const token = sanitizeStr(req.body.token);
    if (!token) return res.status(400).json({ error: "token required" });
    await dao.unregisterFCMToken(token);
    res.json({ success: true });
  }));

  // 9c. SMART LINKS — URL metadata
  app.post("/api/smart-links", asyncHandler(async (req, res) => {
    const url = sanitizeStr(req.body.url, 2000);
    if (!url) return res.status(400).json({ error: "URL requerida" });
    try { new URL(url); } catch { return res.status(400).json({ error: "URL inválida" }); }
    const force = req.body.force === true;
    const metadata = await getSmartLinkMetadata(url, force);
    res.json(metadata);
  }));

  // 10. TICKETS
  app.get("/api/tickets", asyncHandler(async (_req, res) => {
    res.json(await dao.listTickets());
  }));

  app.post("/api/tickets", asyncHandler(async (req, res) => {
    const ticket: SupportTicket = {
      id: genId("tk-"),
      title: sanitizeStr(req.body.title, MAX_SHORT_STR),
      description: sanitizeStr(req.body.description),
      creatorName: sanitizeStr(req.body.creatorName, MAX_SHORT_STR),
      creatorEmail: safeEmail(req.body.creatorEmail),
      clientId: sanitizeStr(req.body.clientId, 255) || undefined,
      status: ['open', 'in_progress', 'resolved', 'closed'].includes(req.body.status) ? req.body.status : 'open',
      priority: ['low', 'medium', 'high', 'urgent'].includes(req.body.priority) ? req.body.priority : 'medium',
      category: sanitizeStr(req.body.category, 100) || 'bug',
      createdAt: new Date().toISOString(),
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments.map((a: any) => ({
        id: genId("att-"),
        name: sanitizeStr(a.name, 255),
        url: sanitizeStr(a.url, 500),
        type: sanitizeStr(a.type, 100),
        size: safeFloat(a.size)
      })) : [],
      comments: req.body.initialComment ? [{
        id: genId("c-init-"),
        authorName: sanitizeStr(req.body.creatorName, MAX_SHORT_STR),
        authorEmail: safeEmail(req.body.creatorEmail),
        text: sanitizeStr(req.body.initialComment),
        timestamp: new Date().toISOString(),
        isAdmin: false,
        attachments: []
      }] : []
    };
    await dao.createTicket(ticket);
    res.status(201).json(ticket);

    // Fire-and-forget: notify admins without blocking response
    void (async () => {
      try {
        const admins = (await dao.listUsers()).filter(u => u.roleId === 'role-admin');
        for (const admin of admins) {
          const n = {
            id: genId("n-ticket-") + "-" + admin.id, userId: admin.id,
            text: `Nuevo ticket creado: "${ticket.title}" por ${ticket.creatorName}`,
            type: "ticket", read: false, timestamp: new Date().toISOString()
          };
          await dao.createNotification(n);
          broadcastToUser(admin.id, { type: 'notification', notification: n });
          sendFCMToUser(admin.id, 'Nuevo ticket', n.text, { type: 'ticket', ticketId: ticket.id }).catch(e => console.error(e));
        }
      } catch (err) { console.error('[Notify] ticket created failed:', err); }
    })();
  }));

  app.post("/api/tickets/:id/comments", asyncHandler(async (req, res) => {
    const ticket = await dao.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });
    const comment = {
      id: genId("c-reply-"),
      authorName: sanitizeStr(req.body.authorName, MAX_SHORT_STR),
      authorEmail: safeEmail(req.body.authorEmail),
      text: sanitizeStr(req.body.text),
      timestamp: new Date().toISOString(),
      isAdmin: req.body.isAdmin || false,
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments.map((a: any) => ({
        id: genId("att-"),
        name: sanitizeStr(a.name, 255),
        url: sanitizeStr(a.url, 500),
        type: sanitizeStr(a.type, 100),
        size: safeFloat(a.size)
      })) : []
    };
    await dao.addTicketComment(req.params.id, comment);
    // Return full ticket with comment appended locally (no extra DB roundtrip)
    ticket.comments = [...ticket.comments, comment];
    res.json(ticket);

    // Fire-and-forget: notify without blocking response
    void (async () => {
      try {
        if (!comment.isAdmin) {
          const admins = (await dao.listUsers()).filter(u => u.roleId === 'role-admin');
          for (const admin of admins) {
            const n = {
              id: genId("n-tcom-") + "-" + admin.id, userId: admin.id,
              text: `Nueva respuesta en ticket "${ticket.title}" de ${comment.authorName}`,
              type: "ticket", read: false, timestamp: new Date().toISOString()
            };
            await dao.createNotification(n);
            broadcastToUser(admin.id, { type: 'notification', notification: n });
            sendFCMToUser(admin.id, 'Nueva respuesta en ticket', n.text, { type: 'ticket', ticketId: ticket.id }).catch(e => console.error(e));
          }
        } else {
          const clientUser = await dao.getUserByEmail(ticket.creatorEmail);
          if (clientUser) {
            const n = {
              id: genId("n-tcom-client-"), userId: clientUser.id,
              text: `Una respuesta administrativa ha sido añadida a tu ticket: "${ticket.title}"`,
              type: "ticket", read: false, timestamp: new Date().toISOString()
            };
            await dao.createNotification(n);
            broadcastToUser(clientUser.id, { type: 'notification', notification: n });
            sendFCMToUser(clientUser.id, 'Respuesta administrativa', n.text, { type: 'ticket', ticketId: ticket.id }).catch(e => console.error(e));
          }
        }
      } catch (err) { console.error('[Notify] ticket comment failed:', err); }
    })();
  }));

  // Helper: resolve client from request header
  async function resolveClient(req: express.Request): Promise<TicketClient | null> {
    const code = req.headers['x-client-code'] as string;
    if (!code) return null;
    return await dao.getTicketClientByCode(code);
  }

  // 10b. TICKET CLIENT ROUTES (public, authenticated by code)
  app.post("/api/ticket-clients/login", asyncHandler(async (req, res) => {
    const code = sanitizeStr(req.body.code, 50);
    if (!code) return res.status(400).json({ error: "Código requerido" });
    const client = await dao.getTicketClientByCode(code);
    if (!client) return res.status(401).json({ error: "Código inválido" });
    res.json(client);
  }));

  // Protected admin routes for managing clients
  app.get("/api/ticket-clients", asyncHandler(async (_req, res) => {
    res.json(await dao.listTicketClients());
  }));

  app.post("/api/ticket-clients", asyncHandler(async (req, res) => {
    const code = crypto.randomUUID().slice(0, 8).toUpperCase();
    const client: TicketClient = {
      id: genId("tc-"),
      name: sanitizeStr(req.body.name, MAX_SHORT_STR),
      email: safeEmail(req.body.email),
      code,
      createdAt: new Date().toISOString()
    };
    await dao.createTicketClient(client);
    res.status(201).json(client);
  }));

  app.put("/api/ticket-clients/:id", asyncHandler(async (req, res) => {
    const { code, ...safe } = req.body;
    const ok = await dao.updateTicketClient(req.params.id, safe);
    if (!ok) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json({ success: true });
  }));

  app.delete("/api/ticket-clients/:id", asyncHandler(async (req, res) => {
    const ok = await dao.deleteTicketClient(req.params.id);
    if (!ok) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json({ success: true });
  }));

  // Public: list tickets by client code (body)
  app.post("/api/tickets/by-client", asyncHandler(async (req, res) => {
    const code = sanitizeStr(req.body.code, 50);
    if (!code) return res.status(400).json({ error: "Código requerido" });
    const client = await dao.getTicketClientByCode(code);
    if (!client) return res.status(401).json({ error: "Código inválido" });
    res.json(await dao.listTicketsByClientId(client.id));
  }));

  app.put("/api/tickets/:id", asyncHandler(async (req, res) => {
    const client = await resolveClient(req);
    const ticketId = req.params.id;
    if (client) {
      const ticket = await dao.getTicketById(ticketId);
      if (!ticket || ticket.clientId !== client.id) return res.status(403).json({ error: "No puedes editar este ticket" });
      const allowed = ['title', 'description', 'priority', 'category'];
      const safeBody: any = {};
      for (const k of allowed) {
        if (req.body[k] !== undefined) safeBody[k] = sanitizeStr(req.body[k], k === 'description' ? 10000 : MAX_SHORT_STR);
      }
      if (Object.keys(safeBody).length === 0) return res.status(400).json({ error: "Sin campos válidos" });
      await dao.updateTicket(ticketId, safeBody);
      return res.json({ success: true });
    }
    const { comments, ...safeBody } = req.body;
    const ok = await dao.updateTicket(ticketId, safeBody);
    if (!ok) return res.status(404).json({ error: "Ticket no encontrado" });
    res.json({ success: true });
  }));

  app.delete("/api/tickets/:id", asyncHandler(async (req, res) => {
    const client = await resolveClient(req);
    const ticketId = req.params.id;
    if (client) {
      const ticket = await dao.getTicketById(ticketId);
      if (!ticket || ticket.clientId !== client.id) return res.status(403).json({ error: "No puedes eliminar este ticket" });
      await dao.deleteTicket(ticketId);
      return res.json({ success: true });
    }
    const ok = await dao.deleteTicket(ticketId);
    if (!ok) return res.status(404).json({ error: "Ticket no encontrado" });
    res.json({ success: true });
  }));

  // 12. AI ASSISTANT
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.warn('[Assistant] OPENAI_API_KEY not set. AI assistant disabled.');
  }

  app.post("/api/assistant/chat", asyncHandler(async (req, res) => {
    if (!openaiKey) return res.status(503).json({ error: "AI assistant not configured" });
    const { message, userId } = req.body;
    if (!message || !userId) return res.status(400).json({ error: "message and userId required" });

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: openaiKey });

    const [allUsers, allTasks, allFolders, allTodos, allMeetings, allClients, allQuotes, allContracts, allServices, allChannels] = await Promise.all([
      dao.listUsers().then(r => r.slice(0, 50)),
      dao.listTasks().then(r => r.slice(0, 200)),
      dao.listFolders().then(r => r.slice(0, 50)),
      dao.listTodos().then(r => r.slice(0, 100)),
      dao.listMeetings().then(r => r.slice(0, 100)),
      dao.listClients().then(r => r.slice(0, 100)),
      dao.listQuotes().then(r => r.slice(0, 100)),
      dao.listContracts().then(r => r.slice(0, 100)),
      dao.listServices().then(r => r.slice(0, 100)),
      dao.listChannels().then(r => r.slice(0, 50)),
    ]);

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "get_tasks",
          description: "Get all tasks, optionally filtered by status, priority, or assigned user name. Returns formatted task list.",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["todo", "in_progress", "review", "done"], description: "Filter by status" },
              priority: { type: "string", enum: ["low", "medium", "high"], description: "Filter by priority" },
              assigneeName: { type: "string", description: "Filter by assignee name (partial match)" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "create_task",
          description: "Create a new task in the Kanban board",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Task title" },
              description: { type: "string", description: "Task description" },
              status: { type: "string", enum: ["todo", "in_progress", "review", "done"], description: "Task status. Default: todo" },
              priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority. Default: medium" },
              dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
              assigneeName: { type: "string", description: "Assignee name(s), comma-separated for multiple (must match existing user names)" },
            },
            required: ["title"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "update_task",
          description: "Update an existing task's properties: status, priority, title, description, due date, or assignee",
          parameters: {
            type: "object",
            properties: {
              taskId: { type: "string", description: "The ID of the task to update" },
              title: { type: "string", description: "New task title" },
              description: { type: "string", description: "New task description" },
              status: { type: "string", enum: ["todo", "in_progress", "review", "done"], description: "New task status" },
              priority: { type: "string", enum: ["low", "medium", "high"], description: "New task priority" },
              dueDate: { type: "string", description: "New due date in YYYY-MM-DD format" },
              assigneeName: { type: "string", description: "New assignee name(s), comma-separated for multiple (must match existing user names)" },
            },
            required: ["taskId"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_todos",
          description: "Get personal todo list items, optionally filtered by status. Can also return todos for a specific user.",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["todo", "done"], description: "Filter by status" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "create_todo",
          description: "Create a new personal todo item",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Todo title" },
            },
            required: ["title"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "update_todo",
          description: "Update a personal todo (mark as done, change title, etc.)",
          parameters: {
            type: "object",
            properties: {
              todoId: { type: "string", description: "The ID of the todo to update" },
              title: { type: "string", description: "New title" },
              status: { type: "string", enum: ["todo", "done"], description: "New status" },
            },
            required: ["todoId"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_meetings",
          description: "Get all scheduled meetings. Optionally filter by date (YYYY-MM-DD) to see meetings on a specific day.",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Filter by date in YYYY-MM-DD format" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "create_meeting",
          description: "Schedule a new meeting",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Meeting title" },
              date: { type: "string", description: "Date in YYYY-MM-DD format" },
              time: { type: "string", description: "Time in HH:MM format" },
              description: { type: "string", description: "Meeting description or agenda" },
              attendees: { type: "string", description: "Comma-separated attendee names" },
            },
            required: ["title", "date", "time"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_notifications",
          description: "Get unread notifications for the current user",
          parameters: {
            type: "object",
            properties: {
              includeRead: { type: "boolean", description: "Set to true to include already-read notifications" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_clients",
          description: "Get CRM client list. Optionally filter by name or company.",
          parameters: {
            type: "object",
            properties: {
              search: { type: "string", description: "Search by name or company (partial match)" },
              status: { type: "string", enum: ["lead", "contacted", "proposal", "negotiation", "won", "lost"], description: "Filter by client status" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_quotes",
          description: "Get sales quotes. Optionally filter by status.",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["draft", "sent", "approved", "rejected"], description: "Filter by quote status" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_contracts",
          description: "Get contracts. Optionally filter by status.",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["draft", "signed", "active", "expired"], description: "Filter by contract status" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_services",
          description: "Get the list of services offered by the agency",
          parameters: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["monthly", "one_time", "hourly"], description: "Filter by service type" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "get_summary",
          description: "Get a dashboard summary: tasks due soon or overdue, meetings today, unread notifications count, incomplete todos for the current user",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
    ];

    const messages: any[] = [
      {
        role: "system",
        content: `Eres un asistente de gestión de proyectos para "Iceberg Agency". Ayudas a los miembros del equipo a consultar y gestionar el sistema completo.

Tus capacidades incluyen:
- TAREAS: Consultar, crear y actualizar tareas del Kanban (cambiar estado, prioridad, asignado, etc.)
- TODOS PERSONALES: Consultar, crear y marcar como completados los todos del usuario
- REUNIONES: Consultar el calendario y agendar nuevas reuniones
- NOTIFICACIONES: Consultar notificaciones no leídas del usuario actual
- CRM: Consultar clientes, cotizaciones, contratos y servicios
- RESUMEN: Generar un resumen del día (tareas próximas, reuniones hoy, pendientes)

Usuarios del sistema: ${JSON.stringify(allUsers.map(u => ({ id: u.id, name: u.name, email: u.email })))}
Carpetas del sistema: ${JSON.stringify(allFolders.map(f => ({ id: f.id, name: f.name, workspaceId: f.workspaceId })))}

Para marcar una tarea como completada usa update_task con status "done".
Para crear un todo personal usa la función create_todo.
Para agendar una reunión usa create_meeting.

Responde siempre en español, de forma clara y profesional. Si el usuario pide crear una tarea sin especificar carpeta, usa la primera carpeta disponible.`,
      },
      { role: "user", content: message },
    ];

    async function callAI(messages: any[], toolCallsCount = 0): Promise<{ reply: string }> {
      if (toolCallsCount > 5) return { reply: "Lo siento, la conversación se ha vuelto demasiado compleja. Intenta de nuevo." };

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools,
        tool_choice: "auto",
      });

      const choice = response.choices[0];
      const finishReason = choice.finish_reason;

      if (finishReason === "stop") {
        return { reply: choice.message.content || "Entendido." };
      }

      if (finishReason === "tool_calls" && choice.message.tool_calls) {
        const toolCalls = choice.message.tool_calls;
        messages.push(choice.message);

        for (const tc of toolCalls) {
          const args = JSON.parse(tc.function.arguments);

          if (tc.function.name === "get_tasks") {
            let filtered = [...allTasks];
            if (args.status) filtered = filtered.filter(t => t.status === args.status);
            if (args.priority) filtered = filtered.filter(t => t.priority === args.priority);
            if (args.assigneeName) {
              const matchUsers = allUsers.filter(u => u.name.toLowerCase().includes(args.assigneeName.toLowerCase()));
              const matchIds = matchUsers.map(u => u.id);
              filtered = filtered.filter(t => t.assignedTo.some(id => matchIds.includes(id)));
            }
            const taskList = filtered.map(t => {
              const assignees = t.assignedTo.map(id => allUsers.find(u => u.id === id)?.name).filter(Boolean).join(', ') || 'Sin asignar';
              return `- [${t.status}] ${t.title} (Prioridad: ${t.priority}, Asignado: ${assignees}, Vence: ${t.dueDate || 'Sin fecha'})`;
            }).join('\n');
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: taskList || "No se encontraron tareas con esos criterios.",
            });

          } else if (tc.function.name === "create_task") {
            const defaultFolder = allFolders[0];
            if (!defaultFolder) {
              messages.push({ role: "tool", tool_call_id: tc.id, content: "Error: No hay carpetas disponibles para crear la tarea." });
              continue;
            }
            let assigneeIds: string[] = [userId];
            if (args.assigneeName) {
              const names = args.assigneeName.split(',').map((s: string) => s.trim().toLowerCase());
              assigneeIds = names.map((n: string) => allUsers.find(u => u.name.toLowerCase() === n)?.id).filter(Boolean);
              if (!assigneeIds.length) assigneeIds = [userId];
            }
            const newTask: import("./src/types").Task = {
              id: genId("task-"),
              folderId: defaultFolder.id,
              workspaceId: defaultFolder.workspaceId,
              title: args.title,
              description: args.description || '',
              status: args.status || 'todo',
              priority: args.priority || 'medium',
              dueDate: args.dueDate || '',
              assignedTo: assigneeIds,
              tags: [],
            };
            await dao.createTask(newTask);
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: `Tarea creada exitosamente con ID: ${newTask.id}. Título: ${newTask.title}. ¿Necesitas algo más?`,
            });

          } else if (tc.function.name === "update_task") {
            const task = allTasks.find(t => t.id === args.taskId);
            if (!task) {
              messages.push({ role: "tool", tool_call_id: tc.id, content: `Error: No se encontró una tarea con ID "${args.taskId}".` });
              continue;
            }
            const updates: Record<string, any> = {};
            if (args.title !== undefined) updates.title = args.title;
            if (args.description !== undefined) updates.description = args.description;
            if (args.status !== undefined) updates.status = args.status;
            if (args.priority !== undefined) updates.priority = args.priority;
            if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
            if (args.assigneeName !== undefined) {
              const names = args.assigneeName.split(',').map((s: string) => s.trim().toLowerCase());
              const ids = names.map((n: string) => allUsers.find(u => u.name.toLowerCase() === n)?.id).filter(Boolean);
              if (!ids.length) {
                messages.push({ role: "tool", tool_call_id: tc.id, content: `Error: No se encontró un usuario con nombre "${args.assigneeName}".` });
                continue;
              }
              updates.assignedTo = ids;
            }
            await dao.updateTask(args.taskId, updates);
            const changeDesc = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(', ');
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: `Tarea "${task.title}" actualizada exitosamente: ${changeDesc}.`,
            });

          } else if (tc.function.name === "get_todos") {
            let filtered = allTodos.filter(t => t.userId === userId);
            if (args.status) filtered = filtered.filter(t => t.status === args.status);
            const todoList = filtered.map(t => `- [${t.status}] ${t.title} (ID: ${t.id})`).join('\n');
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: todoList || "No tienes todos personales.",
            });

          } else if (tc.function.name === "create_todo") {
            const newTodo = {
              id: genId("todo-"),
              userId,
              title: args.title,
              status: "todo" as const,
            };
            await dao.createTodo(newTodo);
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: `Todo creado: "${args.title}".`,
            });

          } else if (tc.function.name === "update_todo") {
            const todo = allTodos.find(t => t.id === args.todoId && t.userId === userId);
            if (!todo) {
              messages.push({ role: "tool", tool_call_id: tc.id, content: `No se encontró un todo con ID "${args.todoId}".` });
              continue;
            }
            const updates: Record<string, any> = {};
            if (args.title !== undefined) updates.title = args.title;
            if (args.status !== undefined) updates.status = args.status;
            await dao.updateTodo(args.todoId, updates);
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: `Todo "${todo.title}" actualizado.`,
            });

          } else if (tc.function.name === "get_meetings") {
            let filtered = [...allMeetings];
            if (args.date) filtered = filtered.filter(m => m.date === args.date);
            const meetingList = filtered.map(m =>
              `- ${m.date} ${m.time} - ${m.title}${m.attendees ? ` (Asistentes: ${m.attendees})` : ''}${m.description ? ` - ${m.description}` : ''}`
            ).join('\n');
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: meetingList || "No se encontraron reuniones.",
            });

          } else if (tc.function.name === "create_meeting") {
            const newMeeting = {
              id: genId("mtg-"),
              userId,
              title: args.title,
              date: args.date,
              time: args.time,
              description: args.description || '',
              attendees: args.attendees || '',
              reminderMinutes: 30,
              status: "scheduled",
              createdAt: new Date().toISOString(),
            };
            await dao.createMeeting(newMeeting);
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: `Reunión "${args.title}" agendada para el ${args.date} a las ${args.time}.`,
            });

          } else if (tc.function.name === "get_notifications") {
            const notifs = await dao.getUserNotifications(userId);
            let filtered = args.includeRead ? notifs : notifs.filter(n => !n.read);
            const notifList = filtered.slice(0, 20).map(n =>
              `- [${n.read ? 'leída' : 'no leída'}] ${n.text} (${new Date(n.timestamp).toLocaleDateString()})`
            ).join('\n');
            const unreadCount = notifs.filter(n => !n.read).length;
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: `Tienes ${unreadCount} notificaciones no leídas.\n${notifList || 'Sin notificaciones.'}`,
            });

          } else if (tc.function.name === "get_clients") {
            let filtered = [...allClients];
            if (args.search) {
              const q = args.search.toLowerCase();
              filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || (c.company && c.company.toLowerCase().includes(q)));
            }
            if (args.status) filtered = filtered.filter(c => c.status === args.status);
            const clientList = filtered.map(c =>
              `- ${c.name} (${c.company || 'Sin empresa'}) - ${c.status} - ${c.email}${c.phone ? ` - ${c.phone}` : ''}`
            ).join('\n');
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: clientList || "No se encontraron clientes.",
            });

          } else if (tc.function.name === "get_quotes") {
            let filtered = [...allQuotes];
            if (args.status) filtered = filtered.filter(q => q.status === args.status);
            const quoteList = filtered.map(q => {
              const client = allClients.find(c => c.id === q.clientId);
              return `- ${q.description} - S/${q.amount} - ${q.status}${client ? ` (Cliente: ${client.name})` : ''}`;
            }).join('\n');
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: quoteList || "No se encontraron cotizaciones.",
            });

          } else if (tc.function.name === "get_contracts") {
            let filtered = [...allContracts];
            if (args.status) filtered = filtered.filter(c => c.status === args.status);
            const contractList = filtered.map(c => {
              const client = allClients.find(cl => cl.id === c.clientId);
              return `- ${c.title} - S/${c.value} - ${c.status} (${c.startDate} a ${c.endDate})${client ? ` - Cliente: ${client.name}` : ''}`;
            }).join('\n');
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: contractList || "No se encontraron contratos.",
            });

          } else if (tc.function.name === "get_services") {
            let filtered = [...allServices];
            if (args.type) filtered = filtered.filter(s => s.type === args.type);
            const serviceList = filtered.map(s => `- ${s.name} - S/${s.price} (${s.type})${s.description ? `: ${s.description}` : ''}`).join('\n');
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: serviceList || "No se encontraron servicios.",
            });

          } else if (tc.function.name === "get_summary") {
            const today = new Date().toISOString().slice(0, 10);
            const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const tasksDueSoon = allTasks.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= in3Days && t.status !== 'done');
            const tasksOverdue = allTasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
            const meetingsToday = allMeetings.filter(m => m.date === today);
            const myTodos = allTodos.filter(t => t.userId === userId && t.status === 'todo');
            const notifs = await dao.getUserNotifications(userId);
            const unreadNotifs = notifs.filter(n => !n.read).length;
            const parts: string[] = [];
            parts.push(`📋 Resumen del día (${today}):`);
            if (tasksDueSoon.length) parts.push(`\nTareas próximas a vencer (3 días):\n${tasksDueSoon.map(t => `  - ${t.title} (Vence: ${t.dueDate})`).join('\n')}`);
            if (tasksOverdue.length) parts.push(`\nTareas vencidas:\n${tasksOverdue.map(t => `  - ${t.title} (Vencía: ${t.dueDate})`).join('\n')}`);
            if (!tasksDueSoon.length && !tasksOverdue.length) parts.push('\nNo hay tareas próximas a vencer.');
            parts.push(`\nReuniones hoy: ${meetingsToday.length ? meetingsToday.map(m => `\n  - ${m.time} ${m.title}`).join('') : 'Ninguna'}`);
            parts.push(`\nTodos pendientes: ${myTodos.length}`);
            parts.push(`\nNotificaciones no leídas: ${unreadNotifs}`);
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: parts.join(''),
            });
          }
        }

        return callAI(messages, toolCallsCount + 1);
      }

      return { reply: choice.message.content || "Entendido." };
    }

    const result = await callAI(messages);
    res.json(result);
  }));

  // Serve Firebase Cloud Messaging service worker with config injected
  app.get("/firebase-messaging-sw.js", (_req, res) => {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId) {
      res.type('application/javascript').send('// FCM not configured');
      return;
    }
    const fcmFile = process.env.NODE_ENV !== "production"
      ? path.join(process.cwd(), 'public', 'firebase-messaging-sw.js')
      : path.join(process.cwd(), 'dist', 'firebase-messaging-sw.js');
    try {
      let swContent = fs.readFileSync(fcmFile, 'utf-8');
      swContent = swContent
        .replace('FCM_API_KEY', process.env.VITE_FIREBASE_API_KEY || '')
        .replace('FCM_AUTH_DOMAIN', process.env.VITE_FIREBASE_AUTH_DOMAIN || '')
        .replace('FCM_PROJECT_ID', projectId)
        .replace('FCM_STORAGE_BUCKET', process.env.VITE_FIREBASE_STORAGE_BUCKET || '')
        .replace('FCM_SENDER_ID', process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '')
        .replace('FCM_APP_ID', process.env.VITE_FIREBASE_APP_ID || '');
      res.type('application/javascript').send(swContent);
    } catch {
      res.type('application/javascript').send('// FCM service worker error');
    }
  });

  // --- VENDOR LEADS & ACTIVITIES ---
  // Resolve the current user id from a legacy JWT Bearer token OR the Auth.js (cookie) session.
  async function getVendorId(req: express.Request): Promise<string | null> {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any;
        const id = payload.userId || payload.id;
        if (id) return id;
      } catch { /* fall through to session */ }
    }
    try {
      const session = await authJsGetSession(req, authJsConfig);
      const id = (session?.user as any)?.id;
      return id || null;
    } catch { return null; }
  }

  async function isAdminUser(req: express.Request): Promise<boolean> {
    let roleId: string | null = null;
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any;
        roleId = payload.roleId || null;
      } catch { /* fall through to session */ }
    }
    if (!roleId) {
      try {
        const session = await authJsGetSession(req, authJsConfig);
        const uid = (session?.user as any)?.id;
        if (uid) {
          const user = await dao.getUserById(uid);
          roleId = user?.roleId || null;
        }
      } catch { /* ignore */ }
    }
    return roleId === 'role-admin' || roleId === 'role-superadmin';
  }

  // List vendor leads: each user only sees leads they manage (isolated by userId)
  app.get("/api/vendor-leads", asyncHandler(async (req, res) => {
    const vendorId = await getVendorId(req);
    if (!vendorId) return res.status(401).json({ error: "No autenticado" });
    const leads = await dao.listVendorLeads(vendorId);
    res.json(leads);
  }));

  // Report endpoint: aggregated data for PDF generation
  // (MUST be registered before /api/vendor-leads/:id so "report" is not captured as an id)
  app.get("/api/vendor-leads/report", asyncHandler(async (req, res) => {
    const vendorId = await getVendorId(req);
    if (!vendorId) return res.status(401).json({ error: "No autenticado" });
    // Each user only sees their own leads/activities in the report (isolated by userId)
    const targetVendorId = vendorId;
    const from = req.query.from as string || undefined;
    const to = req.query.to as string || undefined;

    const leads = await dao.listVendorLeads(targetVendorId);
    const activities = await dao.listVendorActivities(undefined, targetVendorId, from, to);

    // Detailed client section always shows all leads so the PDF detail is never blank.
    const filteredLeads = leads;

    // Count by status
    const byStatus: Record<string, number> = { pending: 0, contacted: 0, proposal: 0, negotiation: 0, won: 0, lost: 0 };
    for (const l of leads) { byStatus[l.status] = (byStatus[l.status] || 0) + 1; }

    // Count by activity type
    const byActivityType: Record<string, number> = { call: 0, meeting: 0, email: 0, whatsapp: 0, visit: 0, other: 0 };
    for (const a of activities) { byActivityType[a.type] = (byActivityType[a.type] || 0) + 1; }

    const won = byStatus.won || 0;
    const total = leads.length || 1;
    const conversionRate = `${Math.round((won / total) * 100)}%`;

    res.json({
      vendor: targetVendorId ? { id: targetVendorId } : null,
      dateRange: { from: from || null, to: to || null },
      summary: {
        totalLeads: leads.length,
        totalActivities: activities.length,
        byStatus,
        byActivityType,
        conversionRate
      },
      leads: filteredLeads,
      activities
    });
  }));

  // Get single vendor lead
  app.get("/api/vendor-leads/:id", asyncHandler(async (req, res) => {
    const vendorId = await getVendorId(req);
    if (!vendorId) return res.status(401).json({ error: "No autenticado" });
    const lead = await dao.getVendorLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });
    if (lead.vendorId !== vendorId) return res.status(403).json({ error: "Acceso denegado" });
    res.json(lead);
  }));

  // Create vendor lead (creates a CRM client row with vendor fields)
  app.post("/api/vendor-leads", asyncHandler(async (req, res) => {
    const vendorId = await getVendorId(req);
    if (!vendorId) return res.status(401).json({ error: "No autenticado" });
    const clientName = String(req.body.clientName || '').trim();
    if (!clientName) return res.status(400).json({ error: "Nombre del cliente es obligatorio" });
    const lead = await dao.upsertVendorLeadIntoClient({
      vendorId,
      clientName,
      phone: String(req.body.phone || '').trim(),
      serviceInterest: String(req.body.serviceInterest || '').trim(),
      city: String(req.body.city || '').trim(),
      email: String(req.body.email || '').trim(),
      notes: String(req.body.notes || '').trim(),
      status: ['pending', 'contacted', 'proposal', 'negotiation', 'won', 'lost'].includes(req.body.status) ? req.body.status : 'pending'
    });
    res.status(201).json(lead);
  }));

  // Update vendor lead
  app.put("/api/vendor-leads/:id", asyncHandler(async (req, res) => {
    const vendorId = await getVendorId(req);
    if (!vendorId) return res.status(401).json({ error: "No autenticado" });
    const existing = await dao.getVendorLeadById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Lead no encontrado" });
    if (existing.vendorId !== vendorId) return res.status(403).json({ error: "Acceso denegado" });
    const updates: any = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates.id;
    delete updates.vendorId;
    await dao.updateVendorLead(req.params.id, updates);
    res.json({ ...existing, ...updates });
  }));

  // Delete vendor lead
  app.delete("/api/vendor-leads/:id", asyncHandler(async (req, res) => {
    const vendorId = await getVendorId(req);
    if (!vendorId) return res.status(401).json({ error: "No autenticado" });
    const existing = await dao.getVendorLeadById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Lead no encontrado" });
    if (existing.vendorId !== vendorId) return res.status(403).json({ error: "Acceso denegado" });
    await dao.deleteVendorLead(req.params.id);
    res.json({ success: true });
  }));

  // List activities for a lead
  app.get("/api/vendor-leads/:id/activities", asyncHandler(async (req, res) => {
    const vendorId = await getVendorId(req);
    if (!vendorId) return res.status(401).json({ error: "No autenticado" });
    const lead = await dao.getVendorLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });
    if (lead.vendorId !== vendorId) return res.status(403).json({ error: "Acceso denegado" });
    const activities = await dao.listVendorActivities(req.params.id);
    res.json(activities);
  }));

  // Create activity for a lead
  app.post("/api/vendor-leads/:id/activities", asyncHandler(async (req, res) => {
    const vendorId = await getVendorId(req);
    if (!vendorId) return res.status(401).json({ error: "No autenticado" });
    const lead = await dao.getVendorLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead no encontrado" });
    if (lead.vendorId !== vendorId) return res.status(403).json({ error: "Acceso denegado" });
    const activity = {
      id: `va-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      leadId: req.params.id,
      vendorId,
      type: ['call', 'meeting', 'email', 'whatsapp', 'visit', 'other'].includes(req.body.type) ? req.body.type : 'other',
      description: String(req.body.description || '').trim(),
      createdAt: new Date().toISOString()
    };
    await dao.createVendorActivity(activity);
    // Auto-update lead status to 'contacted' if still pending after first activity
    if (lead.status === 'pending') {
      await dao.updateVendorLead(lead.id, { status: 'contacted', updatedAt: new Date().toISOString() });
    }
    res.status(201).json(activity);
  }));

  // Error handler global
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Error]', err?.message || err);
    res.status(500).json({ error: err?.message || 'Error interno del servidor' });
  });

  // --- STATIC / VITE ---
  // Serve uploads BEFORE SPA catch-all to prevent index.html interception
  // Long-lived cache: uploaded files are immutable (unique filename per upload)
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir, {
    maxAge: '7d',
    immutable: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));
    app.get('/solicitudes', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Multer config for file uploads
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname))
  });
  const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = /\.(jpg|jpeg|png|gif|webp|svg|pdf|doc|docx|xls|xlsx|zip|rar|txt|md|mp4|avi|mov)$/i;
      if (allowed.test(path.extname(file.originalname))) cb(null, true);
      else cb(new Error('Tipo de archivo no permitido'));
    }
  });
  app.post("/api/upload", authMiddleware, upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No se envió ningún archivo" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url, name: req.file.originalname, type: req.file.mimetype, size: req.file.size });
  }));

  // Public upload for ticket attachments (no auth required)
  app.post("/api/upload-public", upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No se envió ningún archivo" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url, name: req.file.originalname, type: req.file.mimetype, size: req.file.size });
  }));

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
  // Hardening: drop slow/stalled connections so sockets never pile up
  server.headersTimeout = 65000;
  server.requestTimeout = 60000;
  server.keepAliveTimeout = 61000;
  server.maxHeadersCount = 100;

  const shutdown = () => {
    console.log("\n[Server] Apagando servidor...");
    clearInterval(sseCleanupInterval);
    sseClients.forEach(c => { try { c.res.end(); } catch {} });
    server.close(() => { console.log("[Server] Servidor detenido."); process.exit(0); });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch(err => {
  console.error("[FATAL] Server failed to start:", err);
  process.exit(1);
});
