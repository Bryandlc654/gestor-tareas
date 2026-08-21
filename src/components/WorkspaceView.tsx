import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, Folder, FolderPlus, Trash, Pencil, CheckCircle, 
  Clock, Tag, HelpCircle, ChevronRight, User, Calendar, 
  Layers, AlertTriangle, Play, CheckSquare, Sparkles, 
  Paperclip, Link, Upload, X, FileText, Image,
  Layout, List, PanelLeft, PanelLeftClose, Eye, Download,
  MessageCircle, BarChart3, Flag
} from 'lucide-react';
import { Workspace, Folder as DBFolder, Task, User as DBUser, TaskStatus, TaskPriority, TaskComment } from '../types';
import UserAvatar from './UserAvatar';
import { showConfirm } from '../utils/alerts';
import SmartLinkCard, { SmartLinkLoading, SmartLinkRenderer } from './SmartLinkCard';
import { extractUrls } from '../utils/url-utils';
import {
  DndContext, DragOverlay, closestCenter, pointerWithin, PointerSensor, useSensor, useSensors, useDroppable,
  type DragEndEvent, type DragStartEvent, type CollisionDetection
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WorkspaceViewProps {
  workspaces: Workspace[];
  folders: DBFolder[];
  tasks: Task[];
  users: DBUser[];
  onAddWorkspace: (w: Partial<Workspace>) => Promise<any>;
  onDeleteWorkspace: (id: string) => Promise<any>;
  onUpdateWorkspace: (id: string, w: Partial<Workspace>) => Promise<any>;
  onUpdateFolder: (id: string, f: Partial<DBFolder>) => Promise<any>;
  onAddFolder: (f: Partial<DBFolder>) => Promise<any>;
  onDeleteFolder: (id: string) => Promise<any>;
  onAddTask: (t: Partial<Task>) => Promise<any>;
  onUpdateTask: (id: string, t: Partial<Task>) => Promise<any>;
  onDeleteTask: (id: string) => Promise<any>;
  onReorderTasks: (updates: { id: string; status: TaskStatus; taskOrder: number }[]) => Promise<any>;
  onAddTaskComment: (taskId: string, comment: { text: string }) => Promise<any>;
  onDeleteTaskComment: (taskId: string, commentId: string) => Promise<void>;
  activeUserId: string;
}

function getPriorityBadge(p: TaskPriority) {
  switch (p) {
    case 'high': return 'bg-[#FFE2DD] text-[#712D23] font-semibold border-0 text-[9px]';
    case 'medium': return 'bg-[#FDEBEC] text-[#37352F] font-semibold border-0 text-[10px]';
    case 'low': return 'bg-[#F1F1EF] text-[#5A5A57] font-semibold border-0 text-[9px]';
  }
}

// Drag-and-drop Kanban card
function SortableTaskCard({ task, users, onDeleteTask, handleEditTask, setDetailTaskId }: {
  task: Task;
  users: DBUser[];
  onDeleteTask: (id: string) => Promise<any>;
  handleEditTask: (task: Task) => void;
  setDetailTaskId: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const assignees = task.assignedTo.map(id => users.find(u => u.id === id)).filter(Boolean);
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="p-2.5 sm:p-3.5 bg-white border border-[#EDEDEB] rounded shadow-xs hover:border-[#91918E] transition-all text-xs space-y-2.5 relative group cursor-grab active:cursor-grabbing" id={`task-card-${task.id}`}>
      <div>
        <span className={`px-1.5 py-0.5 rounded tracking-wide ${getPriorityBadge(task.priority)}`}>{task.priority}</span>
        <h4 className="font-semibold text-[#37352F] mt-2 leading-snug text-[11px] sm:text-xs">{task.title}</h4>
      </div>
      {task.description && (
        <p className="text-[10px] sm:text-[11px] text-[#5A5A57] line-clamp-2 leading-relaxed">{task.description}</p>
      )}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag, idx) => (
            <span key={idx} className="bg-[#F1F1EF] text-[#5A5A57] px-1 py-0.2 rounded text-[9px] font-medium">#{tag}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-[#EDEDEB] text-[10px] text-[#91918E]">
        <div className="flex items-center gap-1 text-[9px] font-mono">
          <Calendar className="w-3 h-3 text-[#91918E]" />
          <span>{task.dueDate}</span>
        </div>
        <div className="flex items-center -space-x-1.5" title={assignees.map(a => a!.name).join(', ') || 'Sin asignar'}>
          {assignees.length > 0 ? assignees.slice(0, 3).map((a) => (
            <UserAvatar key={a!.id} name={a!.name} avatar={a!.avatar} size={16} className="border border-white" />
          )) : (
            <User className="w-3 h-3 text-[#91918E]" />
          )}
          {assignees.length > 3 && (
            <span className="text-[8px] text-[#91918E] ml-0.5">+{assignees.length - 3}</span>
          )}
        </div>
      </div>
      <div className="absolute right-2 top-2 hidden group-hover:flex items-center bg-white border border-[#EDEDEB] rounded p-1 shadow-xs gap-1 z-10">
        <button onClick={() => setDetailTaskId(task.id)} className="p-1 hover:text-[#2383E2] transition-colors" title="Ver detalle">
          <Eye className="w-3 h-3 text-neutral-400" />
        </button>
        <button onClick={() => handleEditTask(task)} className="p-1 hover:text-[#37352F] transition-colors" title="Editar Tarea">
          <Pencil className="w-3 h-3 text-neutral-400" />
        </button>
        <button onClick={() => onDeleteTask(task.id)} className="p-1 hover:text-red-500 transition-colors" title="Eliminar Tarea">
          <Trash className="w-3 h-3 text-neutral-400 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
}

// Droppable Kanban column
function DroppableColumn({ stat, tasks: colTasks, users, onDeleteTask, handleEditTask, setDetailTaskId }: {
  stat: { key: TaskStatus; label: string; bg: string; dot: string };
  tasks: Task[];
  users: DBUser[];
  onDeleteTask: (id: string) => Promise<any>;
  handleEditTask: (task: Task) => void;
  setDetailTaskId: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${stat.key}` });
  const sorted = [...colTasks].sort((a, b) => a.taskOrder - b.taskOrder);
  return (
    <div className="flex flex-col min-h-[450px]" id={`col-${stat.key}`}>
      <div className="flex items-center justify-between px-1 py-1.5 border-b border-[#EDEDEB]">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#37352F]">
          <span className={`w-2 h-2 rounded-full ${stat.dot}`}></span>
          <span>{stat.label}</span>
        </div>
        <span className="font-mono text-[9px] text-[#5A5A57] font-semibold bg-[#F1F1EF] px-1.5 py-0.2 rounded">{sorted.length}</span>
      </div>
      <div ref={setNodeRef} className={`p-2 rounded flex-1 mt-2 space-y-2.5 transition-all border ${isOver ? 'border-[#37352F] bg-[#F1F1EF]' : 'border-[#EDEDEB]/40'} ${stat.bg}`}>
        <SortableContext items={sorted.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {sorted.map(task => (
            <SortableTaskCard key={task.id} task={task} users={users} onDeleteTask={onDeleteTask} handleEditTask={handleEditTask} setDetailTaskId={setDetailTaskId} />
          ))}
        </SortableContext>
        {sorted.length === 0 && (
          <div className="text-center py-10 text-[10px] text-neutral-400">Sin tareas en esta fase.</div>
        )}
      </div>
    </div>
  );
}

export default function WorkspaceView({
  workspaces, folders, tasks, users,
  onAddWorkspace, onDeleteWorkspace, onUpdateWorkspace,
  onAddFolder, onDeleteFolder, onUpdateFolder,
  onAddTask, onUpdateTask, onDeleteTask,
  onReorderTasks,
  onAddTaskComment, onDeleteTaskComment, activeUserId
}: WorkspaceViewProps) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(workspaces[0]?.id || '');
  const [activeFolderId, setActiveFolderId] = useState<string>('');

  // States for creation
  const [showWSModal, setShowWSModal] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsIcon, setWsIcon] = useState('Workspace');
  const [wsDesc, setWsDesc] = useState('');
  const [editingWsId, setEditingWsId] = useState<string | null>(null);

  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', status: 'todo' as TaskStatus, priority: 'medium' as TaskPriority,
    dueDate: new Date().toISOString().split('T')[0], assignedTo: [] as string[],
    tagsInput: '',
    checklist: [] as TaskChecklistItem[],
    attachments: [] as TaskAttachment[],
    links: [] as TaskLink[]
  });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'gantt'>('kanban');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // DnD state
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  
  // Custom collision detection for cross-column drag and drop
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First check pointer collision (for droppable columns)
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    // Fall back to closest center for sortable items
    return closestCenter(args);
  }, []);
  const handleDragStart = (event: DragStartEvent) => {
    const task = folderTasks.find(t => t.id === event.active.id);
    setActiveDragTask(task || null);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeTask = folderTasks.find(t => t.id === active.id);
    if (!activeTask) return;
    const overId = over.id as string;
    let targetStatus: TaskStatus;
    if (overId.startsWith('col-')) {
      targetStatus = overId.replace('col-', '') as TaskStatus;
    } else {
      const overTask = folderTasks.find(t => t.id === overId);
      if (!overTask) return;
      targetStatus = overTask.status;
    }
    const sameStatuses = [activeTask.status, targetStatus];
    const updates: { id: string; status: TaskStatus; taskOrder: number }[] = [];
    for (const st of sameStatuses) {
      const colTasks = folderTasks
        .filter(t => t.id !== activeTask.id || st === targetStatus)
        .filter(t => t.status === st)
        .sort((a, b) => a.taskOrder - b.taskOrder);
      if (st === targetStatus) {
        const overTask = colTasks.find(t => t.id === overId && !overId.startsWith('col-'));
        const dropIndex = overTask ? colTasks.indexOf(overTask) : colTasks.length;
        colTasks.splice(dropIndex, 0, activeTask);
      }
      colTasks.forEach((t, i) => {
        const newSt = t.id === activeTask.id ? targetStatus : t.status;
        updates.push({ id: t.id, status: newSt, taskOrder: i * 1000 });
      });
    }
    // Deduplicate (keep last update per task)
    const deduped = new Map<string, { id: string; status: TaskStatus; taskOrder: number }>();
    for (const u of updates) deduped.set(u.id, u);
    onReorderTasks(Array.from(deduped.values()));
  };
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const detailTask = detailTaskId ? tasks.find(t => t.id === detailTaskId) : null;
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  const [previewAttName, setPreviewAttName] = useState('');
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  // Fetch comments when task detail opens
  useEffect(() => {
    if (detailTaskId) {
      fetch(`/api/tasks/${detailTaskId}/comments`)
        .then(r => r.json())
        .then(data => setTaskComments(Array.isArray(data) ? data : []))
        .catch(() => setTaskComments([]));
    } else {
      setTaskComments([]);
    }
  }, [detailTaskId]);

  const selectedWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const wsFolders = folders.filter(f => f.workspaceId === activeWorkspaceId);

  // Fallback selected folder if none is selected
  const currentFolderId = activeFolderId || wsFolders[0]?.id || '';
  const folderTasks = tasks.filter(t => t.folderId === currentFolderId && t.workspaceId === activeWorkspaceId);

  // Kanban status categories
  const statuses: { key: TaskStatus; label: string; bg: string; dot: string }[] = [
    { key: 'todo', label: 'Sin Empezar', bg: 'bg-[#F7F7F5] border-[#EDEDEB]', dot: 'bg-[#91918E]' },
    { key: 'in_progress', label: 'En Progreso', bg: 'bg-[#FDEBEC]/40 border-[#EDEDEB]', dot: 'bg-[#D4402A]' },
    { key: 'review', label: 'En Revisión (QA)', bg: 'bg-[#D3E5EF]/25 border-[#EDEDEB]', dot: 'bg-[#2383E2]' },
    { key: 'done', label: 'Listo', bg: 'bg-[#DBEDDB]/30 border-[#EDEDEB]', dot: 'bg-[#2D4D2E]' }
  ];

  const handleAddWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim()) return;
    if (editingWsId) {
      await onUpdateWorkspace(editingWsId, { name: wsName, icon: wsIcon, description: wsDesc });
    } else {
      const added = await onAddWorkspace({ name: wsName, icon: wsIcon, description: wsDesc });
      if (added) {
        setActiveWorkspaceId(added.id);
        setActiveFolderId('');
      }
    }
    setShowWSModal(false);
    setEditingWsId(null);
    setWsName('');
    setWsDesc('');
  };

  const handleAddFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !activeWorkspaceId) return;
    const added = await onAddFolder({ workspaceId: activeWorkspaceId, name: newFolderName });
    if (added) {
      setActiveFolderId(added.id);
    }
    setNewFolderName('');
  };

  const handleEditWorkspace = (ws: Workspace) => {
    setEditingWsId(ws.id);
    setWsName(ws.name);
    setWsDesc(ws.description || '');
    setShowWSModal(true);
  };

  const handleEditFolder = (folder: DBFolder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const handleFolderRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolderName.trim() || !editingFolderId) return;
    await onUpdateFolder(editingFolderId, { name: editingFolderName });
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim() || !currentFolderId) return;
    const tagArray = taskForm.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    if (editingTaskId) {
      await onUpdateTask(editingTaskId, {
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate,
        assignedTo: taskForm.assignedTo,
        tags: tagArray,
        checklist: taskForm.checklist,
        attachments: taskForm.attachments,
        links: taskForm.links
      });
    } else {
      await onAddTask({
        workspaceId: activeWorkspaceId,
        folderId: currentFolderId,
        title: taskForm.title,
        description: taskForm.description,
        status: 'todo',
        priority: taskForm.priority,
        dueDate: taskForm.dueDate,
        assignedTo: taskForm.assignedTo,
        tags: tagArray,
        checklist: taskForm.checklist,
        attachments: taskForm.attachments,
        links: taskForm.links
      });
    }

    setShowTaskModal(false);
    setEditingTaskId(null);
    setTaskForm({
      title: '', description: '', status: 'todo' as TaskStatus, priority: 'medium' as TaskPriority,
      dueDate: new Date().toISOString().split('T')[0], assignedTo: [], tagsInput: '',
      checklist: [], attachments: [], links: []
    });
  };

  const handleEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate || new Date().toISOString().split('T')[0],
      assignedTo: task.assignedTo || [],
      tagsInput: task.tags ? task.tags.join(', ') : '',
      checklist: task.checklist || [],
      attachments: task.attachments || [],
      links: task.links || []
    });
    setShowTaskModal(true);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
      const data = await res.json();
      setTaskForm({
        ...taskForm,
        attachments: [...taskForm.attachments, { id: crypto.randomUUID(), name: data.name, url: data.url, type: data.type, size: data.size }]
      });
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 lg:gap-6 animate-fade-in" id="workspace-view-grid">
      {/* 1. Left side navigation: Workspace switch and internal folders */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} lg:block lg:col-span-1 space-y-6`} id="ws-left-bar">
        {/* Workspace selector dropdown */}
        <div className="border border-[#EDEDEB] bg-white p-4 rounded shadow-xs" id="ws-selector-card">
          <label className="block text-[8px] font-bold text-[#91918E] uppercase tracking-wider mb-2">
            Espacio de Trabajo Activo
          </label>
          <div className="space-y-2">
            <select
              value={activeWorkspaceId}
              onChange={(e) => {
                setActiveWorkspaceId(e.target.value);
                setActiveFolderId('');
              }}
              className="w-full bg-white border border-[#EDEDEB] rounded py-1.5 px-2.5 text-xs text-[#37352F] focus:ring-1 focus:ring-[#37352F] focus:outline-none focus:border-[#37352F] font-semibold cursor-pointer"
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setShowWSModal(true)}
                className="w-full py-1 text-[10px] text-center border border-dashed border-[#EDEDEB] text-[#5A5A57] rounded hover:text-[#37352F] hover:border-[#91918E] transition-all cursor-pointer font-medium flex items-center justify-center gap-1"
              >
                <Layers className="w-3 h-3" /> + Nuevo Espacio
              </button>

              {workspaces.length > 1 && (
                <button
                  onClick={async () => {
                    if (await showConfirm("¿Estás seguro de eliminar este espacio, folders y tareas asociadas?")) {
                      onDeleteWorkspace(activeWorkspaceId);
                    }
                  }}
                  className="py-1 px-2 border border-[#EDEDEB] text-[#91918E] hover:text-[#712D23] rounded transition-colors text-[10px] cursor-pointer"
                  title="Eliminar Espacio"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Selected workspace description */}
        {selectedWorkspace && (
          <div className="text-xs p-4 bg-[#F7F7F5] rounded border border-[#EDEDEB]" id="ws-description-box">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[#37352F]">{selectedWorkspace.name}</p>
              <button
                onClick={() => handleEditWorkspace(selectedWorkspace)}
                className="p-1 hover:bg-white rounded transition-colors cursor-pointer"
                title="Editar Espacio"
              >
                <Pencil className="w-3 h-3 text-[#91918E]" />
              </button>
            </div>
            <p className="text-[#5A5A57] mt-1.5 leading-relaxed font-normal">{selectedWorkspace.description || "Sin descripción"}</p>
          </div>
        )}

        {/* Folder items tree ("lista de carpetas") */}
        <div className="border border-[#EDEDEB] bg-white rounded p-4 shadow-xs">
          <span className="block text-[8px] font-bold text-[#91918E] uppercase tracking-wider mb-2.5">
            Carpetas del Espacio
          </span>

          {/* Folder add form */}
          <form onSubmit={handleAddFolderSubmit} className="flex gap-2 mb-4">
            <input
              type="text"
              required
              placeholder="Nueva carpeta de tareas..."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              className="flex-1 bg-white border border-[#EDEDEB] rounded px-2.5 py-1 text-xs focus:outline-none focus:border-[#37352F] text-[#37352F]"
            />
            <button
              type="submit"
              className="p-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-95 cursor-pointer transition-all"
              title="Agregar Carpeta"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Folder rows */}
          <div className="space-y-0.5 max-h-56 overflow-y-auto" id="folders-tree-list">
            {wsFolders.map(folder => {
              const isActive = folder.id === currentFolderId;
              const fTasksCount = tasks.filter(t => t.folderId === folder.id).length;
              return (
                <div
                  key={folder.id}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-xs transition-all group ${
                    isActive ? 'bg-[#37352F] text-white font-medium shadow-xs' : 'text-[#5A5A57] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveFolderId(folder.id);
                    }}
                    className="flex items-center gap-1.5 truncate text-left flex-1 cursor-pointer"
                  >
                    <Folder className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#91918E]'}`} />
                    <span className="truncate">{folder.name}</span>
                  </button>

                  <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100">
                    <span className={`text-[9px] font-mono font-semibold px-1 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-[#EBEBE9] text-[#5A5A57]'}`}>
                      {fTasksCount}
                    </span>
                    <button
                      onClick={() => handleEditFolder(folder)}
                      className={`hover:text-[#37352F] p-0.5 cursor-pointer ${isActive ? 'text-neutral-300' : 'text-[#91918E]'}`}
                      title="Renombrar carpeta"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDeleteFolder(folder.id)}
                      className={`hover:text-red-500 p-0.5 cursor-pointer ${isActive ? 'text-neutral-300' : 'text-[#91918E]'}`}
                      title="Eliminar carpeta"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {wsFolders.length === 0 && (
              <div className="text-center py-6 text-xs text-[#91918E] font-mono leading-relaxed">
                Sin carpetas en este espacio.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Middle area: Kanban board of selected folder inside workspace */}
      <div className="lg:col-span-3 space-y-4" id="kanban-area">
        <div className="flex items-center justify-between border-b border-[#EDEDEB] pb-3" id="kanban-header">
          <div>
            <h3 className="text-xs font-semibold text-[#37352F] flex items-center gap-1.5">
              <span>Módulo Kanban</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#91918E]" />
              <span className="text-[#91918E] font-medium">
                {wsFolders.find(f => f.id === currentFolderId)?.name || 'Selecciona una carpeta'}
              </span>
            </h3>
            <p className="text-[10px] text-[#91918E] mt-0.5">Gestión y avance de requerimientos por fases.</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden px-2 py-1.5 border border-[#EDEDEB] rounded text-[#91918E] hover:text-[#37352F] hover:bg-[#F7F7F5] transition-all cursor-pointer"
              title={sidebarOpen ? "Cerrar panel" : "Abrir panel"}
            >
              {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
            </button>

            {/* View toggle */}
            <div className="flex items-center gap-1 bg-[#F1F1EF] rounded p-0.5">
              <button onClick={() => setViewMode('kanban')} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${viewMode === 'kanban' ? 'bg-white shadow-xs text-[#37352F]' : 'text-[#91918E] hover:text-[#37352F]'}`}>
                <Layout className="w-3.5 h-3.5 inline mr-1" />Kanban
              </button>
              <button onClick={() => setViewMode('list')} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white shadow-xs text-[#37352F]' : 'text-[#91918E] hover:text-[#37352F]'}`}>
                <List className="w-3.5 h-3.5 inline mr-1" />Lista
              </button>
              <button onClick={() => setViewMode('gantt')} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${viewMode === 'gantt' ? 'bg-white shadow-xs text-[#37352F]' : 'text-[#91918E] hover:text-[#37352F]'}`}>
                <BarChart3 className="w-3.5 h-3.5 inline mr-1" />Gantt
              </button>
            </div>

            {currentFolderId && (
              <button
                onClick={() => setShowTaskModal(true)}
                className="px-3 py-1.5 bg-[#37352F] hover:bg-opacity-95 text-white text-xs font-semibold rounded flex items-center gap-1 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> + Agregar Tarea
              </button>
            )}
          </div>
        </div>

        {/* Grid Kanban Columns with Drag-and-Drop */}
        {viewMode === 'kanban' && (
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-2 sm:px-0" id="kanban-columns-container">
              {statuses.map(stat => {
                const statTasks = folderTasks.filter(t => t.status === stat.key);
                return <DroppableColumn key={stat.key} stat={stat} tasks={statTasks} users={users} onDeleteTask={onDeleteTask} handleEditTask={handleEditTask} setDetailTaskId={setDetailTaskId} />;
              })}
            </div>
            <DragOverlay dropAnimation={null}>
              {activeDragTask ? (
                <div className="p-2.5 sm:p-3.5 bg-white border-2 border-[#37352F] rounded shadow-lg text-xs space-y-2.5 opacity-85 rotate-2">
                  <h4 className="font-semibold text-[#37352F] text-[11px]">{activeDragTask.title}</h4>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EDEDEB] text-[9px] font-bold text-[#91918E] uppercase tracking-wider">
                <th className="text-left py-2 px-2">Título</th>
                <th className="text-left py-2 px-2">Estado</th>
                <th className="text-left py-2 px-2">Asignado</th>
                <th className="text-left py-2 px-2">Fecha Límite</th>
                <th className="text-left py-2 px-2">Prioridad</th>
                <th className="text-right py-2 px-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {folderTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[10px] text-neutral-400">
                    Sin tareas en esta carpeta.
                  </td>
                </tr>
              ) : (
                folderTasks.map(task => {
                  const assignees = task.assignedTo.map(id => users.find(u => u.id === id)).filter(Boolean);
                  return (
                    <tr key={task.id} className="border-b border-[#EDEDEB]/60 hover:bg-[#F7F7F5] transition-colors group">
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded tracking-wide ${getPriorityBadge(task.priority)}`}>
                            {task.priority}
                          </span>
                          <span className="font-medium text-[#37352F]">{task.title}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <select
                          value={task.status}
                          onChange={(e) => onUpdateTask(task.id, { status: e.target.value as TaskStatus })}
                          className="text-[10px] bg-transparent border border-[#EDEDEB] rounded px-1.5 py-0.5 cursor-pointer text-[#37352F] focus:outline-none focus:border-[#37352F]"
                        >
                          <option value="todo">Sin Empezar</option>
                          <option value="in_progress">En Progreso</option>
                          <option value="review">Revisión (QA)</option>
                          <option value="done">Terminado</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-2 text-[#5A5A57]">
                        <div className="flex items-center -space-x-1.5" title={assignees.map(a => a!.name).join(', ') || 'Sin asignar'}>
                          {assignees.length > 0 ? assignees.slice(0, 3).map((a) => (
                            <UserAvatar key={a!.id} name={a!.name} avatar={a!.avatar} size={16} className="border border-white" />
                          )) : (
                            <User className="w-3.5 h-3.5 text-[#91918E]" />
                          )}
                          {assignees.length > 3 && (
                            <span className="text-[8px] text-[#91918E] ml-0.5">+{assignees.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-[#91918E] font-mono text-[10px]">{task.dueDate}</td>
                      <td className="py-2.5 px-2">
                        <span className={`px-1.5 py-0.5 rounded tracking-wide ${getPriorityBadge(task.priority)}`}>
                          {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailTaskId(task.id)}
                            className="p-1 hover:text-[#2383E2] transition-colors text-[#91918E]"
                            title="Ver detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEditTask(task)}
                            className="p-1 hover:text-[#37352F] transition-colors text-[#91918E]"
                            title="Editar Tarea"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTask(task.id)}
                            className="p-1 hover:text-red-500 transition-colors text-[#91918E]"
                            title="Eliminar Tarea"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* Gantt View */}
        {viewMode === 'gantt' && (
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[800px]">
            {/* Timeline header */}
            {(() => {
              const today = new Date();
              const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
              startDate.setDate(startDate.getDate() - startDate.getDay());
              const dayCount = 42;
              const days = Array.from({ length: dayCount }, (_, i) => {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                return d;
              });
              const formatDate = (d: Date) => d.toISOString().split('T')[0];
              const todayStr = formatDate(today);
              return (
                <div>
                  {/* Month header */}
                  <div className="flex sticky top-0 bg-white z-10 border-b border-[#EDEDEB]">
                    <div className="w-48 shrink-0 px-3 py-2 text-[9px] font-bold text-[#91918E] uppercase tracking-wider">
                      Tareas
                    </div>
                    <div className="flex">
                      {days.map((d, i) => (
                        <div key={i} className={`w-6 text-[8px] text-center py-2 border-l border-[#EDEDEB] ${d.getDate() === 1 ? 'font-bold text-[#37352F]' : 'text-[#91918E]'}`}>
                          {d.getDate() === 1 ? `${d.toLocaleDateString('es', { month: 'short' })} ${d.getDate()}` : d.getDate()}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Day-of-week row */}
                  <div className="flex border-b border-[#EDEDEB] bg-[#F7F7F5]">
                    <div className="w-48 shrink-0" />
                    <div className="flex">
                      {days.map((d, i) => (
                        <div key={i} className={`w-6 text-[7px] text-center py-1 border-l border-[#EDEDEB] text-[#91918E] ${formatDate(d) === todayStr ? 'bg-[#D3E5EF]/30' : ''}`}>
                          {d.toLocaleDateString('es', { weekday: 'narrow' })}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Gantt rows grouped by folder */}
                  {wsFolders.map(folder => {
                    const fTasks = folderTasks.filter(t => t.folderId === folder.id);
                    if (fTasks.length === 0) return null;
                    return (
                      <div key={folder.id}>
                        <div className="flex border-b border-[#EDEDEB] bg-[#F1F1EF]/50">
                          <div className="w-48 shrink-0 px-3 py-1.5 text-[10px] font-semibold text-[#5A5A57] flex items-center gap-1">
                            <Folder className="w-3 h-3" />{folder.name}
                          </div>
                          <div className="flex-1" />
                        </div>
                        {fTasks.map(task => {
                          const start = task.createdAt?.split('T')[0] || todayStr;
                          const end = task.dueDate || todayStr;
                          const startIdx = days.findIndex(d => formatDate(d) >= start);
                          const endIdx = days.findLastIndex(d => formatDate(d) <= end);
                          const left = Math.max(0, startIdx) * 24;
                          const width = Math.max(6, (endIdx >= 0 ? endIdx : dayCount - 1) - Math.max(0, startIdx) + 1) * 24;
                          return (
                            <div key={task.id} className="flex border-b border-[#EDEDEB]/60 hover:bg-[#F7F7F5] transition-colors group">
                              <div className="w-48 shrink-0 px-3 py-2 text-[10px] text-[#37352F] truncate flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  task.status === 'done' ? 'bg-[#2D4D2E]' :
                                  task.status === 'in_progress' ? 'bg-[#D4402A]' :
                                  task.status === 'review' ? 'bg-[#2383E2]' : 'bg-[#91918E]'
                                }`} />
                                <span className="truncate">{task.title}</span>
                              </div>
                              <div className="relative flex-1 h-8">
                                <div
                                  className="absolute top-1.5 h-5 rounded cursor-pointer transition-all hover:opacity-80"
                                  style={{
                                    left: `${left}px`,
                                    width: `${width}px`,
                                    backgroundColor: task.status === 'done' ? '#2D4D2E' :
                                      task.status === 'in_progress' ? '#D4402A' :
                                      task.status === 'review' ? '#2383E2' : '#91918E'
                                  }}
                                  title={`${task.title} (${start} → ${end})`}
                                  onClick={() => setDetailTaskId(task.id)}
                                />
                                {/* Today marker */}
                                {days.map((d, i) => formatDate(d) === todayStr && (
                                  <div key="today" className="absolute top-0 w-0.5 h-full bg-[#D4402A] z-10" style={{ left: `${i * 24}px` }} />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  {folderTasks.length === 0 && (
                    <div className="text-center py-10 text-[10px] text-neutral-400">Sin tareas para mostrar en el diagrama Gantt.</div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        )}
      </div>

      {/* MODAL 1: NEW WORKSPACE */}
      {showWSModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <form onSubmit={handleAddWorkspaceSubmit} className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg text-[#37352F] text-xs">
            <h2 className="text-sm font-semibold text-[#37352F] flex items-center gap-1.5 pb-2 border-b border-[#EDEDEB]">
              <Layers className="w-4 h-4 text-[#91918E]" /> {editingWsId ? 'Editar Espacio de Trabajo' : 'Nuevo Espacio de Trabajo'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block font-medium text-[#5A5A57]">Nombre del Espacio</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Integración Pasarela ERP 🏦"
                  value={wsName}
                  onChange={e => setWsName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded bg-white text-xs text-[#37352F] focus:outline-none focus:border-[#37352F]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#5A5A57]">Descripción o Meta</label>
                <textarea
                  placeholder="Explica qué hitos se rastrean en este tablero..."
                  value={wsDesc}
                  onChange={e => setWsDesc(e.target.value)}
                  rows={3}
                  className="w-full mt-1 px-3 py-1.5 border border-[#EDEDEB] rounded bg-white text-xs text-[#37352F] focus:outline-none focus:border-[#37352F]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setShowWSModal(false)}
                className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer transition-colors"
              >
                Cerrar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#37352F] text-white rounded font-medium hover:bg-opacity-95 cursor-pointer transition-colors"
              >
                {editingWsId ? 'Guardar Cambios' : 'Generar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: RENAME FOLDER */}
      {editingFolderId && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <form onSubmit={handleFolderRenameSubmit} className="bg-white border border-[#EDEDEB] rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg text-[#37352F] text-xs">
            <h2 className="text-sm font-semibold text-[#37352F] flex items-center gap-1.5 pb-2 border-b border-[#EDEDEB]">
              <Folder className="w-4 h-4 text-[#91918E]" /> Renombrar Carpeta
            </h2>

            <div>
              <label className="block font-medium text-[#5A5A57]">Nombre de la Carpeta</label>
              <input
                type="text"
                required
                placeholder="Ej. Backend API"
                value={editingFolderName}
                onChange={e => setEditingFolderName(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-[#EDEDEB] rounded bg-white text-xs text-[#37352F] focus:outline-none focus:border-[#37352F]"
              />
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingFolderId(null);
                  setEditingFolderName('');
                }}
                className="px-3 py-1.5 border border-[#EDEDEB] rounded text-[#5A5A57] hover:bg-[#F7F7F5] cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#37352F] text-white rounded font-medium hover:bg-opacity-95 cursor-pointer transition-colors"
              >
                Renombrar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: NEW/EDIT TASK */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-2 sm:p-4">
          <form onSubmit={handleAddTaskSubmit} className="bg-white border border-gray-200 rounded-xl w-full max-w-6xl shadow-xl text-gray-900 text-body-md max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <div>
                  <span className="font-title-sm text-gray-900">{editingTaskId ? 'Editar Tarea' : 'Nueva Tarea'}</span>
                  <p className="text-body-sm text-gray-500">{editingTaskId ? 'Modifica los campos necesarios' : 'Completa la información de la tarea'}</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowTaskModal(false)} className="p-2 text-gray-500 hover:bg-white rounded-full cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* LEFT: Main fields */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                {/* Title */}
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Título de la tarea"
                    value={taskForm.title}
                    onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                    className="w-full font-display-lg text-display-lg text-gray-900 placeholder:text-gray-400 bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black"
                  />
                </div>

                {/* Details Grid - 2 columns with more space */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-10">
                  {/* Left Column */}
                  <div className="space-y-5">
                    {/* Estado */}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-gray-500 font-label-md w-28 shrink-0">
                        <CheckCircle className="w-4 h-4" /> Estado
                      </span>
                      <select
                        value={taskForm.status}
                        onChange={e => setTaskForm({ ...taskForm, status: e.target.value as TaskStatus })}
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-body-sm text-gray-900 focus:outline-none focus:border-black font-label-md"
                      >
                        <option value="todo">Sin Empezar</option>
                        <option value="in_progress">En Progreso</option>
                        <option value="review">En Revisión</option>
                        <option value="done">Listo</option>
                      </select>
                    </div>

                    {/* Fechas */}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-gray-500 font-label-md w-28 shrink-0">
                        <Calendar className="w-4 h-4" /> Fecha Límite
                      </span>
                      <input
                        type="date"
                        value={taskForm.dueDate}
                        onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-body-sm text-gray-900 focus:outline-none focus:border-black font-label-md"
                      />
                    </div>

                    {/* Tags */}
                    <div className="flex items-start gap-3">
                      <span className="flex items-center gap-1.5 text-gray-500 font-label-md w-28 shrink-0 pt-1">
                        <Tag className="w-4 h-4" /> Etiquetas
                      </span>
                      <input
                        type="text"
                        placeholder="Backend, Docker, Frontend"
                        value={taskForm.tagsInput}
                        onChange={e => setTaskForm({ ...taskForm, tagsInput: e.target.value })}
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-body-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-5">
                    {/* Asignados */}
                    <div className="flex items-start gap-3">
                      <span className="flex items-center gap-1.5 text-gray-500 font-label-md w-28 shrink-0 pt-1">
                        <User className="w-4 h-4" /> Asignados
                      </span>
                      <div className="flex-1 space-y-1 max-h-44 overflow-y-auto border border-gray-200 rounded-lg p-2">
                        {users.filter(u => u.roleId !== 'role-client').map(u => {
                          const checked = taskForm.assignedTo.includes(u.id);
                          return (
                            <label key={u.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-body-sm hover:bg-white transition-colors ${checked ? 'bg-gray-50' : ''}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setTaskForm({
                                    ...taskForm,
                                    assignedTo: checked
                                      ? taskForm.assignedTo.filter(id => id !== u.id)
                                      : [...taskForm.assignedTo, u.id]
                                  });
                                }}
                                className="w-4 h-4 accent-primary rounded cursor-pointer shrink-0"
                              />
                              <UserAvatar name={u.name} avatar={u.avatar} size={24} />
                              <span className="text-body-sm text-gray-900">{u.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Prioridad */}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-gray-500 font-label-md w-28 shrink-0">
                        <Flag className="w-4 h-4" /> Prioridad
                      </span>
                      <select
                        value={taskForm.priority}
                        onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority })}
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-body-sm text-gray-900 focus:outline-none focus:border-black font-label-md"
                      >
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="pt-5 border-t border-gray-200">
                  <textarea
                    placeholder="Añade una descripción o escríbela con IA..."
                    value={taskForm.description}
                    onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                    rows={5}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-body-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black resize-none"
                  />
                </div>

                {/* Checklist */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" /> Checklist
                  </h3>
                  <div className="space-y-1">
                    {taskForm.checklist.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg">
                        <input type="checkbox" checked={item.done} onChange={() => { const updated = [...taskForm.checklist]; updated[idx] = { ...updated[idx], done: !updated[idx].done }; setTaskForm({ ...taskForm, checklist: updated }); }} className="w-4 h-4 accent-primary rounded cursor-pointer shrink-0" />
                        <span className={`flex-1 text-body-sm min-w-0 ${item.done ? 'line-through text-gray-500' : 'text-gray-900'}`}>{item.text}</span>
                        <button type="button" onClick={() => setTaskForm({ ...taskForm, checklist: taskForm.checklist.filter((_, i) => i !== idx) })} className="text-gray-500 hover:text-red-500 cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Nuevo item..." value={newChecklistText} onChange={e => setNewChecklistText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newChecklistText.trim()) { setTaskForm({ ...taskForm, checklist: [...taskForm.checklist, { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false }] }); setNewChecklistText(''); } } }} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-body-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black" />
                    <button type="button" onClick={() => { if (newChecklistText.trim()) { setTaskForm({ ...taskForm, checklist: [...taskForm.checklist, { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false }] }); setNewChecklistText(''); } }} className="px-4 py-2 bg-black text-white rounded-lg font-label-md hover:opacity-90 transition-opacity cursor-pointer">Agregar</button>
                  </div>
                </div>

                {/* Attachments & Links */}
                <div className="space-y-4 pt-2">
                  <div>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors group cursor-pointer disabled:opacity-50">
                      <Paperclip className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span className="font-label-md">{uploadingFile ? 'Subiendo...' : 'Adjuntar archivos'}</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    {taskForm.attachments.length > 0 && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {taskForm.attachments.map((att, idx) => (
                          <div key={att.id} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg">
                            {att.type?.startsWith('image/') ? <img src={att.url} alt={att.name} className="w-8 h-8 rounded object-cover shrink-0" /> : <FileText className="w-5 h-5 text-gray-500 shrink-0" />}
                            <span className="flex-1 text-body-sm text-gray-900 truncate min-w-0">{att.name}</span>
                            <button type="button" onClick={() => setTaskForm({ ...taskForm, attachments: taskForm.attachments.filter((_, i) => i !== idx) })} className="text-gray-500 hover:text-red-500 cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <button type="button" onClick={() => setShowLinkInput(!showLinkInput)} className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors group cursor-pointer">
                      <Link className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span className="font-label-md">Añadir enlace</span>
                    </button>
                    {showLinkInput && (
                      <div className="mt-2 flex flex-col sm:flex-row gap-2">
                        <input type="text" placeholder="Título..." value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-body-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black" />
                        <input type="url" placeholder="https://..." value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-body-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black" />
                        <button type="button" onClick={() => { if (newLinkTitle.trim() && newLinkUrl.trim()) { setTaskForm({ ...taskForm, links: [...taskForm.links, { id: crypto.randomUUID(), title: newLinkTitle.trim(), url: newLinkUrl.trim() }] }); setNewLinkTitle(''); setNewLinkUrl(''); } }} className="px-4 py-2 bg-black text-white rounded-lg font-label-md hover:opacity-90 transition-opacity cursor-pointer">Agregar</button>
                      </div>
                    )}
                    {taskForm.links.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {taskForm.links.map((link, idx) => (
                          <div key={link.id} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg">
                            <Link className="w-4 h-4 text-gray-500 shrink-0" />
                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-body-sm text-black truncate hover:underline min-w-0">{link.title}</a>
                            <button type="button" onClick={() => setTaskForm({ ...taskForm, links: taskForm.links.filter((_, i) => i !== idx) })} className="text-gray-500 hover:text-red-500 cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT: Actions sidebar */}
              <div className="w-[300px] shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col justify-between p-5">
                <div className="space-y-4">
                  <button type="submit" className="w-full py-3 bg-black text-white rounded-lg font-label-md hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 text-body-sm">
                    <Sparkles className="w-4 h-4" />
                    {editingTaskId ? 'Guardar Cambios' : 'Crear Tarea'}
                  </button>
                  <button type="button" onClick={() => setShowTaskModal(false)} className="w-full py-3 border border-gray-200 text-gray-900 rounded-lg font-label-md hover:bg-white transition-colors cursor-pointer text-body-sm">
                    Cancelar
                  </button>
                </div>
                <p className="text-body-sm text-gray-500 text-center">Enter para {editingTaskId ? 'guardar' : 'crear'}</p>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: TASK DETAIL - Rediseñado */}
      {detailTask && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-2 sm:p-4" onClick={() => setDetailTaskId(null)}>
          <div className="bg-white rounded-xl w-full max-w-6xl shadow-xl text-gray-900 text-body-md overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50-high cursor-pointer">
                  <CheckSquare className="w-4 h-4 text-gray-500" />
                  <span className="font-label-md text-gray-500">Tarea</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                  <div className="flex items-center gap-1 text-gray-500 cursor-pointer hover:text-black">
                    <User className="w-3.5 h-3.5" />
                    <span className="text-body-sm">{detailTask.assignedTo.length}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500 cursor-pointer hover:text-black">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="text-body-sm">{detailTask.attachments?.length || 0}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { handleEditTask(detailTask); setDetailTaskId(null); }}
                  className="p-2 text-gray-500 hover:bg-white rounded-full cursor-pointer transition-colors"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDetailTaskId(null)}
                  className="p-2 text-gray-500 hover:bg-white rounded-full cursor-pointer transition-colors"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* LEFT: Task Details */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                {/* Title */}
                <h1 className="font-display-lg text-display-lg text-gray-900 leading-tight">{detailTask.title}</h1>

                {/* AI Prompt Box */}
                <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-dashed border-gray-300">
                  <Sparkles className="w-5 h-5 text-black shrink-0" />
                  <p className="text-gray-500">
                    <span className="text-black font-bold">Pregúntale a Brain²</span> una presentación, documento o prototipo
                  </p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
                  {/* Left Col */}
                  <div className="space-y-5">
                    {/* Estado */}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-gray-500 font-label-md w-28 shrink-0">
                        <CheckCircle className="w-4 h-4" /> Estado
                      </span>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-caps text-[11px] ${
                        detailTask.status === 'done' ? 'bg-black-container text-white-container' :
                        detailTask.status === 'in_progress' ? 'bg-red-100 text-red-700' :
                        detailTask.status === 'review' ? 'bg-[#D3E5EF] text-[#1A5C8A]' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {detailTask.status === 'todo' ? 'SIN EMPEZAR' : detailTask.status === 'in_progress' ? 'EN CURSO' : detailTask.status === 'review' ? 'EN REVISIÓN' : 'LISTO'}
                        {detailTask.status === 'in_progress' && <Play className="w-3 h-3" />}
                        {detailTask.status === 'done' && <CheckCircle className="w-3 h-3" />}
                      </span>
                    </div>

                    {/* Fechas */}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-gray-500 font-label-md w-28 shrink-0">
                        <Calendar className="w-4 h-4" /> Fechas
                      </span>
                      <div className="flex items-center gap-2 font-label-md">
                        <span className="text-gray-500">Vence</span>
                        <span className={`flex items-center gap-1 ${detailTask.dueDate && new Date(detailTask.dueDate) < new Date() && detailTask.status !== 'done' ? 'text-red-500' : 'text-gray-900'}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          {detailTask.dueDate ? new Date(detailTask.dueDate + 'T12:00:00').toLocaleDateString('es', { month: 'numeric', day: 'numeric' }) : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Duración */}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-gray-500 font-label-md w-28 shrink-0">
                        <Clock className="w-4 h-4" /> Duración
                      </span>
                      <span className="text-gray-500 font-label-md">—</span>
                    </div>

                    {/* Etiquetas */}
                    <div className="flex items-start gap-3">
                      <span className="flex items-center gap-1.5 text-gray-500 font-label-md w-28 shrink-0 pt-0.5">
                        <Tag className="w-4 h-4" /> Etiquetas
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {detailTask.tags && detailTask.tags.length > 0 ? detailTask.tags.map((tag, idx) => (
                          <span key={idx} className="bg-gray-50 text-gray-500 px-2 py-0.5 rounded text-[11px] font-medium">#{tag}</span>
                        )) : (
                          <span className="text-gray-400 font-label-md">Vaciar</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Col */}
                  <div className="space-y-5">
                    {/* Asignados */}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-gray-500 font-label-md w-28 shrink-0">
                        <User className="w-4 h-4" /> Asignados
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {detailTask.assignedTo.length > 0 ? detailTask.assignedTo.map(uid => {
                          const u = users.find(user => user.id === uid);
                          return (
                            <div key={uid} className="flex items-center gap-1.5">
                              <UserAvatar name={u?.name} avatar={u?.avatar} size={24} />
                              <span className="font-label-md text-gray-900">{u?.name || 'Usuario'}</span>
                            </div>
                          );
                        }) : (
                          <span className="text-gray-400 font-label-md">Sin asignar</span>
                        )}
                      </div>
                    </div>

                    {/* Prioridad */}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-gray-500 font-label-md w-28 shrink-0">
                        <Flag className="w-4 h-4" /> Prioridad
                      </span>
                      <span className={`flex items-center gap-1 font-label-md ${
                        detailTask.priority === 'urgent' || detailTask.priority === 'high' ? 'text-tertiary' :
                        detailTask.priority === 'low' ? 'text-gray-500' : 'text-gray-900'
                      }`}>
                        <Flag className="w-4 h-4" />
                        {detailTask.priority === 'high' ? 'Alta' : detailTask.priority === 'medium' ? 'Media' : detailTask.priority === 'urgent' ? 'Urgente' : 'Baja'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {detailTask.description ? (
                  <div className="pt-5 border-t border-gray-200">
                    <SmartLinkRenderer text={detailTask.description} className="text-gray-900 leading-relaxed whitespace-pre-wrap text-body-md" />
                  </div>
                ) : (
                  <div className="pt-5 border-t border-gray-200">
                    <p className="text-gray-400 cursor-text hover:bg-white transition-colors p-2 -mx-2 rounded">
                      Añade una descripción o escríbela con <Sparkles className="inline w-4 h-4 text-black align-middle" /> IA
                    </p>
                  </div>
                )}

                {/* Checklist */}
                {detailTask.checklist && detailTask.checklist.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      <CheckSquare className="w-3.5 h-3.5 inline mr-1" /> Checklist ({detailTask.checklist.filter(i => i.done).length}/{detailTask.checklist.length})
                    </h3>
                    <div className="space-y-1">
                      {detailTask.checklist.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => {
                              const newChecklist = detailTask.checklist.map(ci =>
                                ci.id === item.id ? { ...ci, done: !ci.done } : ci
                              );
                              onUpdateTask(detailTask.id, { checklist: newChecklist });
                            }}
                            className="w-4 h-4 accent-primary rounded cursor-pointer"
                          />
                          <span className={`text-body-sm min-w-0 ${item.done ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {detailTask.attachments && detailTask.attachments.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      <Paperclip className="w-3.5 h-3.5 inline mr-1" /> Adjuntos ({detailTask.attachments.length})
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {detailTask.attachments.map((att) => (
                        <div key={att.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          {att.type?.startsWith('image/') ? (
                            <img src={att.url} alt={att.name} className="w-full h-20 object-cover cursor-pointer" onClick={() => { setPreviewAttachment(att.url); setPreviewAttName(att.name); }} />
                          ) : (
                            <div className="flex items-center justify-center h-20 bg-surface-dim">
                              <FileText className="w-8 h-8 text-gray-500" />
                            </div>
                          )}
                          <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                            <p className="text-[11px] text-gray-900 truncate flex-1 min-w-0">{att.name}</p>
                            <div className="flex gap-1 shrink-0">
                              {att.type?.startsWith('image/') && (
                                <button onClick={() => { setPreviewAttachment(att.url); setPreviewAttName(att.name); }} className="p-1 bg-white rounded border border-gray-200 cursor-pointer hover:bg-white transition-colors" title="Vista previa">
                                  <Eye className="w-3 h-3 text-gray-900" />
                                </button>
                              )}
                              <button onClick={() => handleDownload(att.url, att.name)} className="p-1 bg-white rounded border border-gray-200 cursor-pointer hover:bg-white transition-colors" title="Descargar">
                                <Download className="w-3 h-3 text-gray-900" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links */}
                {detailTask.links && detailTask.links.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      <Link className="w-3.5 h-3.5 inline mr-1" /> Enlaces ({detailTask.links.length})
                    </h3>
                    <div className="space-y-1">
                      {detailTask.links.map((link) => (
                        <div key={link.id} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200">
                          <Link className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-body-sm text-black truncate hover:underline min-w-0">{link.title}</a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="pt-4 space-y-3 border-t border-gray-200">
                  <button className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors group cursor-pointer">
                    <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="font-label-md">Añade campos</span>
                  </button>
                  <button className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors group cursor-pointer">
                    <ChevronRight className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="font-label-md">Añadir subtarea</span>
                  </button>
                  <button className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors group cursor-pointer">
                    <Link className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="font-label-md">Relacionar elementos o añadir dependencias</span>
                  </button>
                </div>
              </div>

              {/* RIGHT: Activity Sidebar */}
              <div className="w-[400px] shrink-0 border-l border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
                <header className="px-4 py-3.5 border-b border-gray-200 flex items-center justify-between shrink-0">
                  <h2 className="font-headline-md text-headline-md">Actividad</h2>
                  <button className="p-2 text-gray-500 hover:bg-white rounded-full cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  {/* Comments List */}
                  {taskComments.length === 0 ? (
                    <p className="text-body-sm text-gray-500 italic">Sin comentarios aún.</p>
                  ) : (
                    taskComments.map(c => (
                      <div key={c.id} className="group">
                        <div className="flex items-start gap-3 mb-1">
                          <UserAvatar name={c.userName} avatar={c.userAvatar} size={28} className="shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-title-sm text-gray-900">{c.userName}</span>
                              <span className="text-[11px] text-gray-500">{new Date(c.timestamp).toLocaleString('es', { day: 'numeric', month: 'short' })}</span>
                            </div>
                            <SmartLinkRenderer text={c.text} className="mt-1 text-body-md text-gray-900 leading-relaxed block" />
                            <div className="mt-2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="flex items-center gap-1 text-gray-500 hover:text-black cursor-pointer">
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span className="text-[11px]">Responder</span>
                              </button>
                              {c.userId === activeUserId && (
                                <button onClick={() => onDeleteTaskComment(detailTask.id, c.id)} className="flex items-center gap-1 text-gray-500 hover:text-red-500 cursor-pointer">
                                  <span className="text-[11px]">Eliminar</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment Input */}
                <footer className="p-4 bg-white border-t border-gray-200 shrink-0">
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newCommentText.trim() || submittingComment) return;
                    setSubmittingComment(true);
                    try {
                      const created = await onAddTaskComment(detailTask.id, { text: newCommentText.trim() });
                      if (created) {
                        setTaskComments(prev => [...prev, created]);
                        setNewCommentText('');
                      }
                    } finally {
                      setSubmittingComment(false);
                    }
                  }}>
                    <div className="relative border border-gray-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-black/20 focus-within:border-black transition-all">
                      <textarea
                        value={newCommentText}
                        onChange={e => setNewCommentText(e.target.value)}
                        placeholder="Escribe un comentario..."
                        className="w-full bg-transparent border-none focus:ring-0 text-body-md resize-none h-16 placeholder:text-gray-400"
                      />
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1 text-gray-500">
                          <button type="button" className="p-1 hover:bg-gray-50-high rounded-lg transition-colors cursor-pointer">
                            <Plus className="w-4 h-4" />
                          </button>
                          <div className="h-4 w-px bg-gray-200"></div>
                          <button type="button" className="flex items-center gap-1 px-2 py-1 hover:bg-gray-50-high rounded-lg transition-colors text-label-md cursor-pointer">
                            <span>Comentario</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <button type="button" className="p-1 hover:bg-gray-50-high rounded-lg transition-colors cursor-pointer">
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button type="button" className="p-1 hover:bg-gray-50-high rounded-lg transition-colors cursor-pointer">
                            <Paperclip className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          type="submit"
                          disabled={!newCommentText.trim() || submittingComment}
                          className="p-2 bg-black text-white rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingComment ? (
                            <span className="text-[11px]">...</span>
                          ) : (
                            <MessageCircle className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </footer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4" onClick={() => setPreviewAttachment(null)}>
          <div className="relative max-w-3xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={previewAttachment} alt={previewAttName} className="max-w-full max-h-[85vh] rounded-lg shadow-xl" />
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={() => handleDownload(previewAttachment, previewAttName)}
                className="p-2 bg-white/90 rounded-lg hover:bg-white cursor-pointer transition-colors"
                title="Descargar"
              >
                <Download className="w-4 h-4 text-[#37352F]" />
              </button>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="p-2 bg-white/90 rounded-lg hover:bg-white cursor-pointer transition-colors"
                title="Cerrar"
              >
                <X className="w-4 h-4 text-[#37352F]" />
              </button>
            </div>
            {previewAttName && (
              <p className="text-white text-xs mt-2 text-center font-medium">{previewAttName}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
