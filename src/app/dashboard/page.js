// src/app/dashboard/page.js  →  rota: /dashboard
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { auth, signOut } from '@/lib/firebase';
import styles from './dashboard.module.css';

// ── Dados de exemplo ──────────────────────────────────────
const SAMPLE_TASKS = [
  { id: 't1', title: 'Reunião com cliente — Proposta Q3',  status: 'concluida', project: 'Ativus',    due: '2026-05-01' },
  { id: 't2', title: 'Atualizar API de autenticação',      status: 'andamento', project: 'Backend',   due: '2026-05-08' },
  { id: 't3', title: 'Enviar relatório mensal ao time',    status: 'pendente',  project: 'Marketing', due: '2026-05-10' },
  { id: 't4', title: 'Aprovação de conteúdo — LinkedIn',  status: 'atrasada',  project: 'Marketing', due: '2026-04-30' },
  { id: 't5', title: 'Revisar design do dashboard',       status: 'andamento', project: 'Ativus',    due: '2026-05-06' },
  { id: 't6', title: 'Configurar ambiente de staging',    status: 'pendente',  project: 'Backend',   due: '2026-05-12' },
];

const SAMPLE_PROJECTS = [
  { id: 'p1', name: 'Projeto Ativus',  pct: 75, color: '#2563EB', icon: '🚀' },
  { id: 'p2', name: 'Marketing Q2',    pct: 45, color: '#FACC15', icon: '📣' },
  { id: 'p3', name: 'Backend API v2',  pct: 90, color: '#22C55E', icon: '⚙️' },
];

const STATUS_LABEL = { andamento: 'Em andamento', concluida: 'Concluída', pendente: 'Pendente', atrasada: 'Atrasada' };
const STATUS_CLASS = { andamento: 'badgeAndamento', concluida: 'badgeConcluida', pendente: 'badgePendente', atrasada: 'badgeAtrasada' };
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',     icon: '⊞' },
  { id: 'tarefas',   label: 'Tarefas',       icon: '✓', badge: 4 },
  { id: 'projetos',  label: 'Projetos',      icon: '📁' },
  { id: 'calendario',label: 'Calendário',    icon: '📅' },
  { id: 'equipe',    label: 'Equipe',        icon: '👥' },
  { id: 'relatorios',label: 'Relatórios',    icon: '📊' },
  { id: 'notificacoes',label:'Notificações', icon: '🔔', badge: 2, badgeRed: true },
  { id: 'configuracoes',label:'Configurações',icon:'⚙️' },
];

// ── Componente principal ──────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [page,       setPage]      = useState('dashboard');
  const [tasks,      setTasks]     = useState(SAMPLE_TASKS);
  const [filter,     setFilter]    = useState('all');
  const [modalOpen,  setModalOpen] = useState(false);
  const [sidebarOpen,setSidebar]   = useState(false);
  const [toast,      setToast]     = useState({ visible: false, message: '', type: '' });

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  function showToast(type, message) {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500);
  }

  async function handleLogout() {
    try { await signOut(auth); router.push('/'); }
    catch { showToast('error', '❌ Erro ao sair.'); }
  }

  function toggleTask(id) {
    const cycle = { pendente: 'andamento', andamento: 'concluida', concluida: 'pendente', atrasada: 'andamento' };
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: cycle[t.status] || 'pendente' } : t));
    showToast('success', '✅ Status atualizado!');
  }

  function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
    showToast('error', '🗑️ Tarefa removida');
  }

  function addTask(data) {
    setTasks(prev => [{ id: 'task_' + Date.now(), ...data }, ...prev]);
    showToast('success', '✅ Tarefa criada!');
  }

  if (loading || !user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className={styles.spinner}/>
    </div>
  );

  const name     = user.displayName || user.email.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const kpi      = { andamento: 0, concluida: 0, pendente: 0, atrasada: 0 };
  tasks.forEach(t => { if (kpi[t.status] !== undefined) kpi[t.status]++; });

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  return (
    <div className={styles.layout}>

      {/* ── SIDEBAR ── */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <a href="/" className={styles.sidebarLogo}>
            <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="#1E3A8A"/>
              <path d="M18 7L9 24H13L18 14L23 24H27L18 7Z" fill="#fff"/>
              <path d="M12 20C12 20 15 22 18 22C21 22 24 20 24 20" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="11" cy="26" r="2.5" fill="#22C55E"/>
            </svg>
            <span className={styles.sidebarLogoText}>ativus</span>
          </a>
          <button className={styles.sidebarClose} onClick={() => setSidebar(false)}>✕</button>
        </div>

        <nav className={styles.sidebarNav}>
          <div className={styles.navSectionLabel}>Principal</div>
          {NAV_ITEMS.slice(0, 4).map(item => (
            <button key={item.id}
              className={`${styles.navItem} ${page === item.id ? styles.navItemActive : ''}`}
              onClick={() => { setPage(item.id); setSidebar(false); }}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
              {item.badge && <span className={`${styles.navBadge} ${item.badgeRed ? styles.navBadgeRed : ''}`}>{item.badge}</span>}
            </button>
          ))}
          <div className={styles.navSectionLabel} style={{marginTop:12}}>Time</div>
          {NAV_ITEMS.slice(4, 6).map(item => (
            <button key={item.id}
              className={`${styles.navItem} ${page === item.id ? styles.navItemActive : ''}`}
              onClick={() => { setPage(item.id); setSidebar(false); }}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div className={styles.navSectionLabel} style={{marginTop:12}}>Sistema</div>
          {NAV_ITEMS.slice(6).map(item => (
            <button key={item.id}
              className={`${styles.navItem} ${page === item.id ? styles.navItemActive : ''}`}
              onClick={() => { setPage(item.id); setSidebar(false); }}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
              {item.badge && <span className={`${styles.navBadge} ${item.badgeRed ? styles.navBadgeRed : ''}`}>{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarUser}>
          <div className={styles.userAvatar}>{initials}</div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{name}</p>
            <p className={styles.userPlan}>Plano Gratuito</p>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Sair">⇥</button>
        </div>
      </aside>

      {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebar(false)}/>}

      {/* ── MAIN ── */}
      <main className={styles.main}>

        {/* Topbar */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.menuBtn} onClick={() => setSidebar(true)}>☰</button>
            <div className={styles.searchBox}>
              <span>🔍</span>
              <input type="text" placeholder="Buscar tarefas, projetos..."/>
            </div>
          </div>
          <div className={styles.topbarRight}>
            <div className={styles.dateChip}>
              {new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })}
            </div>
            <div className={styles.topbarAvatar}>{initials}</div>
          </div>
        </header>

        <div className={styles.pageContent}>

          {/* ── DASHBOARD ── */}
          {page === 'dashboard' && (
            <div>
              <div className={styles.welcomeRow}>
                <div>
                  <h1 className={styles.pageTitle}>Olá, {name.split(' ')[0]}! 👋</h1>
                  <p className={styles.pageSub}>Aqui está o resumo das suas atividades de hoje.</p>
                </div>
                <button className={styles.btnNew} onClick={() => setModalOpen(true)}>+ Nova tarefa</button>
              </div>

              {/* KPIs */}
              <div className={styles.kpiGrid}>
                {[
                  ['Em andamento', kpi.andamento, 'kpiBlue',   '+3 hoje',   'up'],
                  ['Concluídas',   kpi.concluida, 'kpiGreen',  '+12 semana','up'],
                  ['Pendentes',    kpi.pendente,  'kpiYellow', 'atenção',   'neutral'],
                  ['Atrasadas',    kpi.atrasada,  'kpiRed',    'urgente',   'down'],
                ].map(([label, value, cls, trend, trendCls]) => (
                  <div key={label} className={`${styles.kpiCard} ${styles[cls]}`}>
                    <div className={styles.kpiInfo}>
                      <span className={styles.kpiLabel}>{label}</span>
                      <span className={styles.kpiValue}>{value}</span>
                    </div>
                    <span className={`${styles.kpiTrend} ${styles[trendCls]}`}>{trend}</span>
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className={styles.dashGrid}>
                <div className={styles.dashCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Tarefas recentes</h3>
                    <button className={styles.cardLink} onClick={() => setPage('tarefas')}>Ver todas →</button>
                  </div>
                  <TaskList tasks={tasks.slice(0, 6)} filter="all" onToggle={toggleTask} onDelete={deleteTask} styles={styles}/>
                </div>

                <div className={styles.dashCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>Projetos</h3>
                    <button className={styles.cardLink} onClick={() => setPage('projetos')}>Ver todos →</button>
                  </div>
                  <div className={styles.projectList}>
                    {SAMPLE_PROJECTS.map(p => (
                      <div key={p.id} className={styles.projectItem}>
                        <div className={styles.projectInfo}>
                          <span>{p.icon} {p.name}</span>
                          <span style={{fontFamily:'var(--font-poppins)',fontWeight:700,fontSize:'.8rem',color:'var(--blue)'}}>{p.pct}%</span>
                        </div>
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width:`${p.pct}%`, background: p.color }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAREFAS ── */}
          {page === 'tarefas' && (
            <div>
              <div className={styles.welcomeRow}>
                <div><h1 className={styles.pageTitle}>Tarefas</h1><p className={styles.pageSub}>Gerencie todas as suas tarefas.</p></div>
                <button className={styles.btnNew} onClick={() => setModalOpen(true)}>+ Nova tarefa</button>
              </div>
              <div className={styles.dashCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.filterTabs}>
                    {['all','andamento','pendente','atrasada','concluida'].map(f => (
                      <button key={f} className={`${styles.filterTab} ${filter===f?styles.filterTabActive:''}`} onClick={() => setFilter(f)}>
                        {{ all:'Todas', andamento:'Em andamento', pendente:'Pendentes', atrasada:'Atrasadas', concluida:'Concluídas' }[f]}
                      </button>
                    ))}
                  </div>
                </div>
                <TaskList tasks={filtered} filter={filter} onToggle={toggleTask} onDelete={deleteTask} styles={styles}/>
              </div>
            </div>
          )}

          {/* ── PROJETOS ── */}
          {page === 'projetos' && (
            <div>
              <div className={styles.welcomeRow}>
                <div><h1 className={styles.pageTitle}>Projetos</h1><p className={styles.pageSub}>Acompanhe todos os seus projetos.</p></div>
                <button className={styles.btnNew}>+ Novo projeto</button>
              </div>
              <div className={styles.projectsGrid}>
                {SAMPLE_PROJECTS.map(p => (
                  <div key={p.id} className={styles.projectCard}>
                    <div style={{fontSize:'2rem',marginBottom:12}}>{p.icon}</div>
                    <h4 style={{fontFamily:'var(--font-poppins)',fontWeight:700,marginBottom:8}}>{p.name}</h4>
                    <div className={styles.progressBar} style={{marginBottom:12}}>
                      <div className={styles.progressFill} style={{ width:`${p.pct}%`, background: p.color }}/>
                    </div>
                    <p style={{fontSize:'.78rem',color:'var(--text-2)',fontWeight:700,textAlign:'right'}}>{p.pct}% concluído</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PÁGINAS EM BREVE ── */}
          {['calendario','equipe','relatorios','notificacoes','configuracoes'].includes(page) && (
            <div style={{textAlign:'center',paddingTop:80}}>
              <div style={{fontSize:'3rem',marginBottom:16}}>🚧</div>
              <h1 className={styles.pageTitle} style={{marginBottom:8}}>{{ calendario:'Calendário', equipe:'Equipe', relatorios:'Relatórios', notificacoes:'Notificações', configuracoes:'Configurações' }[page]}</h1>
              <p className={styles.pageSub} style={{display:'block',textAlign:'center'}}>Em breve — estamos construindo algo incrível.</p>
            </div>
          )}

        </div>
      </main>

      {/* ── MODAL ── */}
      {modalOpen && <NewTaskModal onClose={() => setModalOpen(false)} onSave={data => { addTask(data); setModalOpen(false); }} styles={styles}/>}

      {/* ── TOAST ── */}
      {toast.visible && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.message}</div>
      )}
    </div>
  );
}

// ── TaskList ──────────────────────────────────────────────
function TaskList({ tasks, onToggle, onDelete, styles }) {
  if (tasks.length === 0) return (
    <div className={styles.taskEmpty}>Nenhuma tarefa encontrada.</div>
  );
  return (
    <div className={styles.taskList}>
      {tasks.map(task => (
        <div key={task.id} className={styles.taskItem}>
          <button className={`${styles.taskCheck} ${task.status === 'concluida' ? styles.checkDone : task.status === 'andamento' ? styles.checkProg : ''}`}
            onClick={() => onToggle(task.id)}>
            {task.status === 'concluida' ? '✓' : ''}
          </button>
          <div className={styles.taskMain}>
            <p className={`${styles.taskName} ${task.status === 'concluida' ? styles.taskDone : ''}`}>{task.title}</p>
            <p className={styles.taskMeta}>{task.project && `📁 ${task.project}`}{task.due && ` · 📅 ${new Date(task.due+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}`}</p>
          </div>
          <span className={`${styles.taskBadge} ${styles[STATUS_CLASS[task.status]]}`}>{STATUS_LABEL[task.status]}</span>
          <button className={styles.taskDelete} onClick={() => onDelete(task.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── NewTaskModal ──────────────────────────────────────────
function NewTaskModal({ onClose, onSave, styles }) {
  function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    onSave({
      title:    fd.get('title'),
      status:   fd.get('status'),
      project:  fd.get('project'),
      priority: fd.get('priority'),
      due:      fd.get('due'),
    });
  }
  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Nova tarefa</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Título *</label>
            <input name="title" type="text" className={styles.mInput} placeholder="Ex: Revisar proposta" required/>
          </div>
          <div className={styles.mFormRow}>
            <div className={styles.mFormGroup}>
              <label className={styles.mLabel}>Projeto</label>
              <select name="project" className={styles.mInput}>
                <option value="">Sem projeto</option>
                <option value="Ativus">Projeto Ativus</option>
                <option value="Marketing">Marketing</option>
                <option value="Backend">Backend</option>
              </select>
            </div>
            <div className={styles.mFormGroup}>
              <label className={styles.mLabel}>Status</label>
              <select name="status" className={styles.mInput}>
                <option value="pendente">Pendente</option>
                <option value="andamento">Em andamento</option>
              </select>
            </div>
          </div>
          <div className={styles.mFormRow}>
            <div className={styles.mFormGroup}>
              <label className={styles.mLabel}>Prioridade</label>
              <select name="priority" className={styles.mInput}>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div className={styles.mFormGroup}>
              <label className={styles.mLabel}>Prazo</label>
              <input name="due" type="date" className={styles.mInput}/>
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnSave}>+ Criar tarefa</button>
          </div>
        </form>
      </div>
    </div>
  );
}
