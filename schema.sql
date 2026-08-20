CREATE DATABASE IF NOT EXISTS agency_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE agency_db;

-- 1. Agency info
CREATE TABLE IF NOT EXISTS agency_info (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  tagline VARCHAR(255),
  description TEXT,
  skills TEXT
);

-- 2. Roles
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  permissions TEXT
);

-- 3. Users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),
  roleId VARCHAR(255),
  avatar VARCHAR(500),
  status VARCHAR(50) DEFAULT 'active'
);

-- 4. Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(255),
  description TEXT
);

-- 5. Folders
CREATE TABLE IF NOT EXISTS folders (
  id VARCHAR(255) PRIMARY KEY,
  workspaceId VARCHAR(255),
  name VARCHAR(255) NOT NULL
);

-- 6. Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(255) PRIMARY KEY,
  folderId VARCHAR(255),
  workspaceId VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'todo',
  priority VARCHAR(50) DEFAULT 'medium',
  dueDate VARCHAR(50),
  assignedTo VARCHAR(255),
  tags TEXT
);

-- 7. Personal Todos
CREATE TABLE IF NOT EXISTS personal_todos (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'todo'
);

-- 8. Clients
CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(100),
  status VARCHAR(50) DEFAULT 'lead',
  revenue DECIMAL(12, 2) DEFAULT 0
);

-- 9. Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id VARCHAR(255) PRIMARY KEY,
  clientId VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  date VARCHAR(50)
);

-- 10. Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id VARCHAR(255) PRIMARY KEY,
  clientId VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  value DECIMAL(12, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  startDate VARCHAR(50),
  endDate VARCHAR(50)
);

-- 11. Services
CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(12, 2) DEFAULT 0,
  type VARCHAR(50) DEFAULT 'one_time'
);

-- 12. Credentials
CREATE TABLE IF NOT EXISTS credentials (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  url VARCHAR(500),
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255),
  notes TEXT,
  category VARCHAR(255) DEFAULT 'other'
);

-- 13. Chat Channels
CREATE TABLE IF NOT EXISTS chat_channels (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  type VARCHAR(50) DEFAULT 'public'
);

-- 14. Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(255) PRIMARY KEY,
  channelId VARCHAR(255) NOT NULL,
  userId VARCHAR(255) NOT NULL,
  userName VARCHAR(255),
  userAvatar VARCHAR(500),
  text TEXT NOT NULL,
  timestamp VARCHAR(100)
);

-- 15. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  text TEXT NOT NULL,
  type VARCHAR(100) DEFAULT 'general',
  `read` BOOLEAN DEFAULT FALSE,
  timestamp VARCHAR(100)
);

-- 16. Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  creatorName VARCHAR(255),
  creatorEmail VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open',
  priority VARCHAR(50) DEFAULT 'medium',
  category VARCHAR(50) DEFAULT 'bug',
  createdAt VARCHAR(100)
);

-- 17. Ticket Comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id VARCHAR(255) PRIMARY KEY,
  ticketId VARCHAR(255) NOT NULL,
  authorName VARCHAR(255),
  authorEmail VARCHAR(255),
  text TEXT NOT NULL,
  timestamp VARCHAR(100),
  isAdmin BOOLEAN DEFAULT FALSE
);

-- 18. Portfolio Items
CREATE TABLE IF NOT EXISTS portfolio (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image VARCHAR(500),
  category VARCHAR(255) DEFAULT 'General',
  clientUrl VARCHAR(500)
);

-- 19. Solicitudes
CREATE TABLE IF NOT EXISTS solicitudes (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  date VARCHAR(50)
);
