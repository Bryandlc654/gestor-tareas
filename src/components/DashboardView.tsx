import React from 'react';
import { 
  TrendingUp, Users, DollarSign, Calendar, CheckSquare, 
  Clock, AlertCircle, Award, ShieldAlert, Sparkles 
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { Task, Client, Quote, Contract, User, SupportTicket } from '../types';

interface DashboardProps {
  tasks: Task[];
  clients: Client[];
  quotes: Quote[];
  contracts: Contract[];
  users: User[];
  tickets: SupportTicket[];
}

export default function DashboardView({ 
  tasks, clients, quotes, contracts, users, tickets 
}: DashboardProps) {

  // Processing Stats Data
  const totalClients = clients.length;
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const pendingQuotes = quotes.filter(q => q.status === 'sent').length;
  const openTickets = tickets.filter(t => t.status === 'open').length;

  const wonClients = clients.filter(c => c.status === 'won');
  const totalRevenue = wonClients.reduce((sum, cli) => sum + (cli.revenue || 0), 0) +
                       contracts.filter(c => c.status === 'active').reduce((sum, c) => sum + c.value, 0);

  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const pendingTasks = tasks.filter(t => t.status !== 'done').length;
  const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'done').length;

  // Pie chart: Project stage distribution (Notion Minimalist Tones)
  const clientStatusData = [
    { name: 'Prospectos (Leads)', value: clients.filter(c => c.status === 'lead').length, color: '#F1F1EF' },
    { name: 'Contactados', value: clients.filter(c => c.status === 'contacted').length, color: '#EBEBE9' },
    { name: 'Propuesta', value: clients.filter(c => c.status === 'proposal').length, color: '#EDEDEB' },
    { name: 'Negociación', value: clients.filter(c => c.status === 'negotiation').length, color: '#D3D3D3' },
    { name: 'Ganados (Clientes)', value: clients.filter(c => c.status === 'won').length, color: '#2383E2' }
  ].filter(item => item.value > 0);

  // Developer Performance Chart
  const developerPerformance = users
    .filter(u => u.roleId !== 'role-client')
    .map(u => {
      const assigned = tasks.filter(t => t.assignedTo.includes(u.id));
      const done = assigned.filter(t => t.status === 'done').length;
      return {
        name: u.name,
        'Tareas Totales': assigned.length,
        'Tareas Listas': done,
      };
    });

  // Contract billing forecast by month
  const billingHistory = [
    { mes: 'Ene', facturado: 8500, cotizado: 12000 },
    { mes: 'Feb', facturado: 10200, cotizado: 15500 },
    { mes: 'Mar', facturado: 9800, cotizado: 11000 },
    { mes: 'Abr', facturado: 14500, cotizado: 19000 },
    { mes: 'May', facturado: 18000, cotizado: 25000 },
    { mes: 'Jun', facturado: totalRevenue || 12000, cotizado: quotes.reduce((sum, q) => sum + q.amount, 0) || 17500 }
  ];

  return (
    <div className="space-y-6 animate-fade-in" id="dashboard-container">
      {/* Notion style header section */}
      <div className="border-b border-[#EDEDEB] pb-5" id="dashboard-header">
        <h1 className="text-lg font-semibold tracking-tight text-[#37352F] flex items-center gap-1.5">
          Dashboard <Sparkles className="w-4 h-4 text-[#91918E]" />
        </h1>
        <p className="text-xs text-[#91918E] mt-1">
          Visión panorámica de productividad, ingresos, pipeline y el estado de la agencia de desarrollo.
        </p>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="stats-grid">
        <div className="border border-[#EDEDEB] bg-white p-5 rounded-lg shadow-xs" id="stat-revenue">
          <div className="flex items-center justify-between text-[#91918E] text-[10px] font-bold uppercase tracking-wider">
            <span>Ingresos Totales (CRM)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-semibold text-[#37352F] mt-2">
            S/ {totalRevenue.toLocaleString()}
          </p>
          <p className="text-[10px] text-[#91918E] mt-1">Suma de contratos + ganados</p>
        </div>

        <div className="border border-[#EDEDEB] bg-white p-5 rounded-lg shadow-xs" id="stat-tasks">
          <div className="flex items-center justify-between text-[#91918E] text-[10px] font-bold uppercase tracking-wider">
            <span>Tareas Completadas</span>
            <CheckSquare className="w-4 h-4 text-[#91918E]" />
          </div>
          <p className="text-xl font-semibold text-[#37352F] mt-2">
            {completedTasks} / {tasks.length}
          </p>
          <p className="text-[10px] text-[#91918E] mt-1">
            {tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}% de satisfacción integral
          </p>
        </div>

        <div className="border border-[#EDEDEB] bg-white p-5 rounded-lg shadow-xs" id="stat-pipeline">
          <div className="flex items-center justify-between text-[#91918E] text-[10px] font-bold uppercase tracking-wider">
            <span>Pipeline Comercial</span>
            <TrendingUp className="w-4 h-4 text-[#91918E]" />
          </div>
          <p className="text-xl font-semibold text-[#37352F] mt-2">
            {totalClients} Leads
          </p>
          <p className="text-[10px] text-[#91918E] mt-1">
            {pendingQuotes} cotizaciones por revisar
          </p>
        </div>

        <div className="border border-[#EDEDEB] bg-white p-5 rounded-lg shadow-xs" id="stat-tickets">
          <div className="flex items-center justify-between text-[#91918E] text-[10px] font-bold uppercase tracking-wider">
            <span>Soporte al Cliente</span>
            <AlertCircle className={`w-4 h-4 ${openTickets > 0 ? 'text-amber-500 animate-pulse' : 'text-[#91918E]'}`} />
          </div>
          <p className="text-xl font-semibold text-[#37352F] mt-2">
            {openTickets} Abiertos
          </p>
          <p className="text-[10px] text-[#91918E] mt-1">
            {highPriorityTasks} tareas de alta prioridad
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="charts-grid-container">
        {/* Productivity & Progress KPI */}
        <div className="border border-[#EDEDEB] bg-white p-5 rounded-lg col-span-2 shadow-xs">
          <h3 className="text-xs font-semibold text-[#37352F] mb-4 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#5A5A57]" /> Rendimiento de Tareas del Equipo
          </h3>
          <div className="h-48 sm:h-56 lg:h-64" id="perf-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={developerPerformance}>
                <XAxis dataKey="name" fontSize={10} stroke="#91918E" />
                <YAxis fontSize={10} stroke="#91918E" />
                <Tooltip />
                <Bar dataKey="Tareas Totales" fill="#EBEBE9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Tareas Listas" fill="#37352F" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-[10px] mt-3 text-[#91918E]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#EBEBE9] rounded-xs"></span>
              <span>Tareas Pendientes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#37352F] rounded-xs"></span>
              <span>Tareas Listas</span>
            </div>
          </div>
        </div>

        {/* Sales Funnel State distribution */}
        <div className="border border-[#EDEDEB] bg-white p-5 rounded-lg shadow-xs">
          <h3 className="text-xs font-semibold text-[#37352F] mb-4 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#5A5A57]" /> Distribución de Embudo de Ventas
          </h3>
          <div className="h-40 sm:h-48 lg:h-52 flex items-center justify-center relative" id="crm-distribution-pie">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={73}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {clientStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} Leads`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-xl font-bold text-[#37352F]">{totalClients}</span>
              <span className="text-[9px] text-[#91918E] font-medium tracking-wider uppercase">Contactos</span>
            </div>
          </div>

          {/* Custom Legends */}
          <div className="space-y-1.5 mt-2" id="client-funnel-legends">
            {clientStatusData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-[11px] text-[#5A5A57]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="truncate max-w-[120px]">{item.name}</span>
                </div>
                <span className="font-semibold text-[#37352F]">{item.value} ({Math.round(item.value / totalClients * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="lower-dash-grid">
        {/* Project Billing & Forecast */}
        <div className="border border-[#EDEDEB] bg-white p-5 rounded-lg shadow-xs">
          <h3 className="text-xs font-semibold text-[#37352F] mb-4 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-[#5A5A57]" /> Histórico Financiero vs. Proyecciones
          </h3>
          <div className="h-48 sm:h-56 lg:h-60" id="billing-line-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={billingHistory}>
                <XAxis dataKey="mes" fontSize={10} stroke="#91918E" />
                <YAxis fontSize={10} stroke="#91918E" />
                <Tooltip formatter={(value) => [`S/ ${value}`, '']} />
                <Line type="monotone" dataKey="facturado" stroke="#37352F" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="cotizado" stroke="#91918E" strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-[10px] mt-3 text-[#91918E]">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 border-t-2 border-[#37352F] inline-block"></span>
              <span>Ingresos Cerrados</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-0.5 border-t-2 border-dashed border-[#91918E] inline-block"></span>
              <span>Monto Cotizado (Pipeline)</span>
            </div>
          </div>
        </div>

        {/* Task lists overview */}
        <div className="border border-[#EDEDEB] bg-white p-5 rounded-lg flex flex-col justify-between shadow-xs">
          <div>
            <h3 className="text-xs font-semibold text-[#37352F] mb-3 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#5A5A57]" /> Alertas Críticas & Próximas Entregas
            </h3>
            <div className="space-y-3" id="critical-tasks-box">
              {tasks.filter(t => t.status !== 'done' && t.priority === 'high').slice(0, 3).map(task => (
                <div key={task.id} className="p-3 bg-white border border-[#EDEDEB] rounded-md flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-medium text-[#37352F] line-clamp-1">{task.title}</h4>
                    <span className="text-[9px] text-[#91918E] mt-1 block">Vence o entrega: {task.dueDate}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-[#FFE2DD] text-[#712D23] text-[9px] font-semibold rounded">
                    Crítico
                  </span>
                </div>
              ))}
              {tasks.filter(t => t.status !== 'done' && t.priority === 'high').length === 0 && (
                <div className="text-center py-6 text-xs text-[#91918E]" id="no-critical-tasks">
                  No hay tareas críticas pendientes. ¡Sistemas estables!
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#EDEDEB] mt-4">
            <div className="flex items-center justify-between text-[11px] text-[#5A5A57]">
              <span>Eficiencia General del Equipo</span>
              <span className="font-semibold text-[#37352F]">
                {tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 100}%
              </span>
            </div>
            <div className="w-full bg-[#F1F1EF] h-2 rounded-full overflow-hidden mt-1.5">
              <div 
                className="bg-[#2383E2] h-full transition-all duration-500" 
                style={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.status === 'done').length / tasks.length) * 100 : 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
