export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  roleId: string;
  avatar?: string;
  status: 'active' | 'inactive';
  provider?: 'credentials' | 'google';
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // e.g., ['manage_workspaces', 'manage_crm', 'manage_users', 'view_all']
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface Folder {
  id: string;
  workspaceId: string;
  name: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface TaskLink {
  id: string;
  title: string;
  url: string;
}

export interface Task {
  id: string;
  folderId: string;
  workspaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assignedTo: string[]; // userIds
  tags: string[];
  checklist?: TaskChecklistItem[];
  attachments?: TaskAttachment[];
  links?: TaskLink[];
  taskOrder: number;
  commentsCount?: number;
}

export interface PersonalTodo {
  id: string;
  userId: string;
  title: string;
  status: 'todo' | 'done';
}

export interface Meeting {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: string;       // YYYY-MM-DD
  time: string;        // HH:MM
  attendees: string;   // comma-separated names
  link?: string;       // meeting URL (Google Meet, Zoom, etc.)
  assignedTo: string[]; // user IDs for notifications
  reminderMinutes: number; // minutes before meeting to remind, 0 = no reminder
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';
  revenue?: number;
}

export interface Quote {
  id: string;
  clientId: string;
  description: string;
  amount: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  date: string;
}

export interface Contract {
  id: string;
  clientId: string;
  title: string;
  value: number;
  status: 'draft' | 'signed' | 'active' | 'expired';
  startDate: string;
  endDate: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'monthly' | 'one_time' | 'hourly';
}

export interface CredentialWeb {
  id: string;
  title: string;
  url: string;
  username: string;
  password?: string;
  notes?: string;
  category: 'hosting' | 'database' | 'api' | 'cms' | 'domain' | 'other';
}

export interface ChatChannel {
  id: string;
  name: string;
  description: string;
  type: 'public' | 'private';
}

export interface MessageAttachment {
  type: 'image' | 'file' | 'link';
  url: string;
  name: string;
  size?: number;
  smartLink?: SmartLinkData;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  timestamp: string;
  attachments?: MessageAttachment[];
}

export interface Notification {
  id: string;
  userId: string;
  text: string;
  type: 'info' | 'task' | 'chat' | 'ticket' | 'chat_mention';
  read: boolean;
  timestamp: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  timestamp: string;
}

export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  creatorName: string;
  creatorEmail: string;
  clientId?: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  category: 'bug' | 'feature' | 'billing' | 'access' | 'other';
  createdAt: string;
  comments: TicketComment[];
  attachments?: TicketAttachment[];
}

export interface TicketClient {
  id: string;
  name: string;
  email: string;
  code: string;
  createdAt: string;
}

export interface TicketComment {
  id: string;
  authorName: string;
  authorEmail: string;
  text: string;
  timestamp: string;
  isAdmin: boolean;
  attachments?: TicketAttachment[];
}

export interface TicketAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  clientUrl?: string;
}

export interface AgencyInfo {
  name: string;
  tagline: string;
  description: string;
  skills: string[];
}

export interface FCMToken {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
}

export interface SmartLinkData {
  url: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
  provider: string;
}

export interface MeetingMinute {
  id: string;
  title: string;
  date: string;
  participants: string;
  observations: string;
  documentUrl: string;
  createdAt: string;
}

// --- Vendor Leads & Activities ---
export type LeadStatus = 'pending' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type ActivityType = 'call' | 'meeting' | 'email' | 'whatsapp' | 'visit' | 'other';

export interface VendorLead {
  id: string;
  vendorId: string;
  clientName: string;
  phone: string;
  serviceInterest: string;
  city: string;
  email: string;
  notes: string;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VendorLeadActivity {
  id: string;
  leadId: string;
  vendorId: string;
  type: ActivityType;
  description: string;
  createdAt: string;
}
