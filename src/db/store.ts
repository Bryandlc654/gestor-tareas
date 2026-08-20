import type { User, Role, Workspace, Folder, Task, PersonalTodo, Client, Quote, Contract, Service, CredentialWeb, ChatChannel, ChatMessage, Notification, SupportTicket, PortfolioItem, AgencyInfo } from '../types';

export interface FullSchema {
  users: User[];
  roles: Role[];
  workspaces: Workspace[];
  folders: Folder[];
  tasks: Task[];
  personalTodos: PersonalTodo[];
  clients: Client[];
  quotes: Quote[];
  contracts: Contract[];
  services: Service[];
  credentials: CredentialWeb[];
  chatChannels: ChatChannel[];
  chatMessages: ChatMessage[];
  notifications: Notification[];
  tickets: SupportTicket[];
  portfolio: PortfolioItem[];
  agencyInfo: AgencyInfo;
}
