import React, { useState } from 'react';
import {
  Calendar as CalendarIcon, CheckSquare, Plus,
  Trash, ChevronLeft, ChevronRight, Check, AlertCircle, Pencil,
  Clock, User, X, Bell, Video, ExternalLink
} from 'lucide-react';
import { PersonalTodo, Task, Meeting } from '../types';
import type { User as DBUser } from '../types';

interface CalendarTodoViewProps {
  personalTodos: PersonalTodo[];
  meetings: Meeting[];
  tasks: Task[];
  users: DBUser[];
  activeUserId: string;
  onAddTodo: (todo: Partial<PersonalTodo>) => Promise<any>;
  onUpdateTodo: (id: string, todo: Partial<PersonalTodo>) => Promise<any>;
  onDeleteTodo: (id: string) => Promise<any>;
  onAddMeeting: (meeting: Partial<Meeting>) => Promise<any>;
  onUpdateMeeting: (id: string, meeting: Partial<Meeting>) => Promise<any>;
  onDeleteMeeting: (id: string) => Promise<any>;
}

export default function CalendarTodoView({
  personalTodos, meetings, tasks, users, activeUserId,
  onAddTodo, onUpdateTodo, onDeleteTodo,
  onAddMeeting, onUpdateMeeting, onDeleteMeeting
}: CalendarTodoViewProps) {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  // Meeting modal state
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [meetingForm, setMeetingForm] = useState({
    title: '', description: '', date: '', time: '12:00',
    link: '', attendees: '', assignedTo: [] as string[], reminderMinutes: 30
  });

  // Todo state
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Calendar engine
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const startOffset = new Date(currentYear, currentMonth, 1).getDay();

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = (day: number) => `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}`;

  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  // --- Meeting handlers ---
  const openNewMeeting = () => {
    setEditingMeetingId(null);
    setMeetingForm({
      title: '', description: '',
      date: today, time: '12:00',
      link: '', attendees: '', assignedTo: [], reminderMinutes: 30
    });
    setShowMeetingModal(true);
  };

  const openEditMeeting = (m: Meeting) => {
    setEditingMeetingId(m.id);
    setMeetingForm({
      title: m.title, description: m.description,
      date: m.date, time: m.time,
      link: m.link || '', attendees: m.attendees, assignedTo: m.assignedTo, reminderMinutes: m.reminderMinutes
    });
    setShowMeetingModal(true);
  };

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingForm.title.trim() || !meetingForm.date) return;
    if (editingMeetingId) {
      await onUpdateMeeting(editingMeetingId, meetingForm);
    } else {
      await onAddMeeting({
        title: meetingForm.title,
        description: meetingForm.description,
        date: meetingForm.date,
        time: meetingForm.time,
        link: meetingForm.link,
        attendees: meetingForm.attendees,
        assignedTo: meetingForm.assignedTo,
        reminderMinutes: meetingForm.reminderMinutes,
        userId: activeUserId
      });
    }
    setShowMeetingModal(false);
    setEditingMeetingId(null);
  };

  const handleCompleteMeeting = async (m: Meeting) => {
    await onUpdateMeeting(m.id, { status: 'completed' });
  };

  // --- Todo handlers ---
  const handleAddTodoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    await onAddTodo({ title: newTodoTitle.trim(), userId: activeUserId });
    setNewTodoTitle('');
  };

  const handleStartEdit = (todo: PersonalTodo) => {
    setEditingTodoId(todo.id);
    setEditingTitle(todo.title);
  };

  const handleSaveEdit = async () => {
    if (editingTodoId && editingTitle.trim()) {
      await onUpdateTodo(editingTodoId, { title: editingTitle.trim() });
    }
    setEditingTodoId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingTodoId(null);
    setEditingTitle('');
  };

  const userTodos = personalTodos.filter(t => t.userId === activeUserId);
  const userMeetings = meetings
    .filter(m => m.userId === activeUserId && m.status === 'scheduled')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="calendar-todolist-container">

      {/* COLUMN 1: CALENDARIO (2/3 Width) */}
      <div className="lg:col-span-2 border border-[#EDEDEB] bg-white rounded p-5 space-y-4 shadow-xs" id="calendar-view-pane">
        <div className="flex items-center justify-between border-b border-[#EDEDEB] pb-3">
          <div>
            <h2 className="text-xs font-semibold text-[#37352F] flex items-center gap-1.5 animate-fade-in">
              <CalendarIcon className="w-4 h-4 text-[#91918E]" /> Agenda & Entregas Programadas
            </h2>
            <p className="text-[10px] text-[#91918E] mt-0.5">Calendario de reuniones, entregas y tareas pendientes.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-[#F1F1EF] rounded border border-[#EDEDEB] text-[#5A5A57] hover:text-[#37352F] cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-[#37352F] font-mono min-w-[100px] text-center">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-[#F1F1EF] rounded border border-[#EDEDEB] text-[#5A5A57] hover:text-[#37352F] cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="space-y-1">
          <div className="grid grid-cols-7 text-center text-[9px] uppercase font-bold text-[#91918E] tracking-wider py-1 font-mono">
            <span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span>
          </div>
          <div className="grid grid-cols-7 gap-1 border border-[#EDEDEB] bg-[#F7F7F5] p-1 rounded" id="calendar-grid">
            {Array.from({ length: startOffset }).map((_, idx) => (
              <div key={`off-${idx}`} className="bg-white/30 min-h-[60px] sm:h-20 rounded" />
            ))}
            {daysArray.map((day) => {
              const ds = dateStr(day);
              const dayTasks = tasks.filter(t => t.dueDate === ds && t.status !== 'done');
              const dayMeetings = meetings.filter(m => m.date === ds && m.status === 'scheduled');
              const isToday = ds === today;
              return (
                <div
                  key={day}
                  className={`bg-white hover:bg-[#F7F7F5] p-1 min-h-[60px] sm:h-20 rounded border border-[#EDEDEB]/70 flex flex-col justify-between overflow-hidden transition-all ${isToday ? 'ring-1 ring-[#37352F] bg-[#F7F7F5]' : ''}`}
                  title={`Día ${day}`}
                >
                  <span className={`text-[9px] font-mono font-bold block ${isToday ? 'text-white bg-[#37352F] px-1 rounded-xs w-fit self-start' : 'text-[#91918E]'}`}>
                    {day}
                  </span>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayMeetings.map(m => (
                      <div
                        key={m.id}
                        className="text-[7px] font-medium px-1 py-0.5 rounded truncate leading-tight bg-[#D3E5EF] text-[#2383E2] flex items-center gap-0.5"
                        title={`${m.time} - ${m.title}`}
                      >
                        <Video className="w-2 h-2 shrink-0" />
                        <span className="truncate">{m.title}</span>
                      </div>
                    ))}
                    {dayTasks.map(task => (
                      <div
                        key={task.id}
                        className={`text-[7px] font-medium px-1 py-0.5 rounded truncate leading-tight ${task.priority === 'high' ? 'bg-[#FFE2DD] text-[#712D23]' : 'bg-[#F1F1EF] text-[#37352F]'}`}
                        title={`${task.title} - ${task.assignedTo.map(id => users.find(u => u.id === id)?.name).filter(Boolean).join(', ') || 'usuario'}`}
                      >
                        {task.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between text-[9px] text-[#91918E] font-mono">
          <span className="flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Usa Kanban para modificar fechas de entrega de tareas.
          </span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#D3E5EF] inline-block" /> Reunión</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#FFE2DD] inline-block" /> Tarea urgente</span>
          </span>
        </div>
      </div>

      {/* COLUMN 2: REUNIONES + TODO (1/3 Width) */}
      <div className="lg:col-span-1 flex flex-col gap-4">

        {/* --- REUNIONES --- */}
        <div className="border border-[#EDEDEB] bg-white rounded p-5 space-y-3 shadow-xs" id="meetings-pane">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-[#37352F] flex items-center gap-1.5">
                <Video className="w-4 h-4 text-[#91918E]" /> Próximas Reuniones
              </h2>
              <p className="text-[10px] text-[#91918E] mt-0.5">Reuniones programadas pendientes.</p>
            </div>
            <button
              onClick={openNewMeeting}
              className="p-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-95 cursor-pointer transition-colors"
              title="Nueva reunión"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1" id="meetings-scroller">
            {userMeetings.length === 0 && (
              <div className="text-center py-6 text-[#91918E] text-[11px] font-mono">No hay reuniones programadas.</div>
            )}
            {userMeetings.slice(0, 10).map(m => (
              <div
                key={m.id}
                className="group flex items-start gap-2 p-2.5 rounded border border-[#EDEDEB] bg-white hover:border-[#91918E] transition-colors cursor-pointer"
                onClick={() => openEditMeeting(m)}
              >
                <div className="w-9 h-9 rounded bg-[#D3E5EF] flex items-center justify-center shrink-0 mt-0.5">
                  <Video className="w-4 h-4 text-[#2383E2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-[#37352F] truncate">{m.title}</p>
                  <p className="text-[10px] text-[#91918E] flex items-center gap-1 mt-0.5">
                    <CalendarIcon className="w-3 h-3" /> {m.date}
                  </p>
                  <p className="text-[10px] text-[#91918E] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {m.time}
                  </p>
                  {m.attendees && (
                    <p className="text-[10px] text-[#91918E] flex items-center gap-1 truncate">
                      <User className="w-3 h-3" /> {m.attendees}
                    </p>
                  )}
                  {m.link && (
                    <p className="text-[10px] text-[#2383E2] flex items-center gap-1 truncate">
                      <ExternalLink className="w-3 h-3" /> {m.link}
                    </p>
                  )}
                  {m.reminderMinutes > 0 && (
                    <p className="text-[10px] text-[#91918E] flex items-center gap-1">
                      <Bell className="w-3 h-3" /> Recordatorio {m.reminderMinutes} min antes
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteMeeting(m.id); }}
                    className="p-1 text-[#91918E] hover:text-[#712D23] cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCompleteMeeting(m); }}
                    className="p-1 text-[#91918E] hover:text-[#2D4D2E] cursor-pointer"
                    title="Completar"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- TODO LIST --- */}
        <div className="border border-[#EDEDEB] bg-white rounded p-5 space-y-3 shadow-xs" id="todos-view-pane">
          <div>
            <h2 className="text-xs font-semibold text-[#37352F] flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-[#91918E]" /> Tu Todo List
            </h2>
            <p className="text-[10px] text-[#91918E] mt-0.5">Recordatorios rápidos.</p>
          </div>

          <form onSubmit={handleAddTodoSubmit} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Nuevo recordatorio..."
              value={newTodoTitle}
              onChange={e => setNewTodoTitle(e.target.value)}
              className="flex-1 bg-white border border-[#EDEDEB] rounded px-2.5 py-1.5 text-xs text-[#37352F] focus:outline-none focus:border-[#37352F]"
            />
            <button type="submit" className="px-3 py-1.5 bg-[#37352F] hover:bg-opacity-95 text-white font-semibold rounded text-xs transition-all cursor-pointer shadow-xs">
              Añadir
            </button>
          </form>

          <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1" id="personal-todos-scroller">
            {userTodos.map(todo => {
              const isDone = todo.status === 'done';
              return (
                <div
                  key={todo.id}
                  className={`group flex items-center justify-between p-2.5 rounded border text-xs transition-all ${isDone ? 'bg-[#F7F7F5] border-[#EDEDEB] text-[#91918E] line-through' : 'bg-white border-[#EDEDEB] text-[#37352F] hover:border-[#91918E]'}`}
                >
                  <div className="flex items-center gap-2 truncate max-w-[200px]">
                    <button
                      type="button"
                      onClick={() => onUpdateTodo(todo.id, { status: isDone ? 'todo' : 'done' })}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer ${isDone ? 'bg-[#37352F] border-[#37352F] text-white' : 'border-[#EDEDEB] hover:border-[#91918E]'}`}
                    >
                      {isDone && <Check className="w-2.5 h-2.5" />}
                    </button>
                    {editingTodoId === todo.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="flex-1 bg-transparent border border-[#37352F] rounded px-1 py-0.5 text-xs text-[#37352F] focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="truncate select-none font-medium text-xs leading-none mt-0.5 cursor-pointer flex items-center gap-1" onClick={() => handleStartEdit(todo)}>
                        {todo.title}
                        <Pencil className="w-2.5 h-2.5 text-[#91918E] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteTodo(todo.id)}
                    className="text-[#91918E] hover:text-[#712D23] p-1 h-fit transition-colors cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            {userTodos.length === 0 && (
              <div className="text-center py-6 text-[#91918E] text-[11px] font-mono">No tienes pendientes. ¡Buen trabajo!</div>
            )}
          </div>
        </div>
      </div>

      {/* --- MEETING MODAL --- */}
      {showMeetingModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4" onClick={() => setShowMeetingModal(false)}>
          <div className="bg-white border border-[#EDEDEB] rounded-lg w-full max-w-md shadow-lg text-[#37352F] text-xs overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDEDEB]">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Video className="w-4 h-4 text-[#91918E]" />
                {editingMeetingId ? 'Editar Reunión' : 'Nueva Reunión'}
              </h3>
              <button onClick={() => setShowMeetingModal(false)} className="p-1 text-[#91918E] hover:text-[#37352F] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveMeeting} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#91918E] uppercase tracking-wider mb-1">Título *</label>
                <input
                  type="text"
                  required
                  value={meetingForm.title}
                  onChange={e => setMeetingForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Nombre de la reunión"
                  className="w-full bg-white border border-[#EDEDEB] rounded px-2.5 py-1.5 text-xs text-[#37352F] focus:outline-none focus:border-[#37352F]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#91918E] uppercase tracking-wider mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={meetingForm.date}
                    onChange={e => setMeetingForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-white border border-[#EDEDEB] rounded px-2.5 py-1.5 text-xs text-[#37352F] focus:outline-none focus:border-[#37352F]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#91918E] uppercase tracking-wider mb-1">Hora</label>
                  <input
                    type="time"
                    value={meetingForm.time}
                    onChange={e => setMeetingForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full bg-white border border-[#EDEDEB] rounded px-2.5 py-1.5 text-xs text-[#37352F] focus:outline-none focus:border-[#37352F]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#91918E] uppercase tracking-wider mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={meetingForm.description}
                  onChange={e => setMeetingForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Agenda o notas de la reunión"
                  className="w-full bg-white border border-[#EDEDEB] rounded px-2.5 py-1.5 text-xs text-[#37352F] focus:outline-none focus:border-[#37352F] resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#91918E] uppercase tracking-wider mb-1">Enlace (Google Meet, Zoom, etc.)</label>
                <input
                  type="url"
                  value={meetingForm.link}
                  onChange={e => setMeetingForm(f => ({ ...f, link: e.target.value }))}
                  placeholder="https://meet.google.com/..."
                  className="w-full bg-white border border-[#EDEDEB] rounded px-2.5 py-1.5 text-xs text-[#37352F] focus:outline-none focus:border-[#37352F]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#91918E] uppercase tracking-wider mb-1">Asistentes (nombres / emails)</label>
                <input
                  type="text"
                  value={meetingForm.attendees}
                  onChange={e => setMeetingForm(f => ({ ...f, attendees: e.target.value }))}
                  placeholder="Nombres separados por coma"
                  className="w-full bg-white border border-[#EDEDEB] rounded px-2.5 py-1.5 text-xs text-[#37352F] focus:outline-none focus:border-[#37352F]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#91918E] uppercase tracking-wider mb-1">Asignar a (notificación por email)</label>
                <div className="max-h-28 overflow-y-auto border border-[#EDEDEB] rounded p-1.5 space-y-1">
                  {users.length === 0 && <p className="text-[10px] text-[#91918E] px-1">Cargando usuarios...</p>}
                  {users.filter(u => u.id !== activeUserId).map(u => {
                    const checked = meetingForm.assignedTo.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-[#F1F1EF] cursor-pointer text-xs text-[#37352F]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setMeetingForm(f => ({
                              ...f,
                              assignedTo: checked
                                ? f.assignedTo.filter(id => id !== u.id)
                                : [...f.assignedTo, u.id]
                            }));
                          }}
                          className="accent-[#37352F]"
                        />
                        {u.name} <span className="text-[#91918E]">({u.email})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#91918E] uppercase tracking-wider mb-1">Recordatorio</label>
                <select
                  value={meetingForm.reminderMinutes}
                  onChange={e => setMeetingForm(f => ({ ...f, reminderMinutes: Number(e.target.value) }))}
                  className="w-full bg-white border border-[#EDEDEB] rounded px-2.5 py-1.5 text-xs text-[#37352F] focus:outline-none focus:border-[#37352F]"
                >
                  <option value={0}>Sin recordatorio</option>
                  <option value={15}>15 minutos antes</option>
                  <option value={30}>30 minutos antes</option>
                  <option value={60}>1 hora antes</option>
                  <option value={1440}>1 día antes</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#EDEDEB]">
                <button
                  type="button"
                  onClick={() => setShowMeetingModal(false)}
                  className="px-3 py-1.5 border border-[#EDEDEB] text-[#5A5A57] rounded hover:bg-[#F1F1EF] cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-95 cursor-pointer font-medium transition-colors"
                >
                  {editingMeetingId ? 'Guardar Cambios' : 'Programar Reunión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
