// src/app/dashboard/page.js  →  rota: /dashboard
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
  auth, db, signOut,
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, onSnapshot,
  serverTimestamp,
} from '@/lib/firebase';
import styles from './dashboard.module.css';

// ── Constantes ────────────────────────────────────────────
const STATUS_LABEL = {
  andamento: 'Em andamento',
  concluida: 'Concluída',
  pendente:  'Pendente',
  atrasada:  'Atrasada',
};
const STATUS_CLASS = {
  andamento: 'badgeAndamento',
  concluida: 'badgeConcluida',
  pendente:  'badgePendente',
  atrasada:  'badgeAtrasada',
};
const STATUS_CYCLE = {
  pendente:  'andamento',
  andamento: 'concluida',
  concluida: 'pendente',
  atrasada:  'andamento',
};
const NAV_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',    icon: '⊞' },
  { id: 'tarefas',       label: 'Tarefas',       icon: '✓' },
  { id: 'projetos',      label: 'Projetos',      icon: '📁' },
  { id: 'calendario',    label: 'Calendário',    icon: '📅' },
  { id: 'equipe',        label: 'Equipe',        icon: '👥' },
  { id: 'relatorios',    label: 'Relatórios',    icon: '📊' },
  { id: 'notificacoes',  label: 'Notificações',  icon: '🔔' },
  { id: 'configuracoes', label: 'Configurações', icon: '⚙️' },
];

// ─────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [page,         setPage]        = useState('dashboard');
  const [tasks,        setTasks]       = useState([]);
  const [dbLoading,    setDbLoading]   = useState(true);
  const [filter,       setFilter]      = useState('all');
  const [modalOpen,    setModalOpen]   = useState(false);
  const [selectedTask, setSelectedTask] = useState(null); // tarefa aberta no painel de detalhe
  const [sidebarOpen,  setSidebar]     = useState(false);
  const [toast,        setToast]       = useState({ visible: false, message: '', type: '' });

  // ── Auth guard ─────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  // ── Listener Firestore em tempo real ───────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'tasks'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q,
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTasks(data);
        setDbLoading(false);
        // Atualiza selectedTask se estiver aberto (reflete edições em tempo real)
        setSelectedTask(prev => prev ? (data.find(t => t.id === prev.id) ?? null) : null);
      },
      err => {
        console.error('[Ativus]', err);
        setDbLoading(false);
        showToast('error', '❌ Erro ao carregar tarefas.');
      }
    );
    return () => unsub();
  }, [user]);

  function showToast(type, message) {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500);
  }

  async function handleLogout() {
    try { await signOut(auth); router.push('/'); }
    catch { showToast('error', '❌ Erro ao sair.'); }
  }

  // ── CRUD ───────────────────────────────────────────────
  async function addTask(data) {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'tasks'), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast('success', '✅ Tarefa criada!');
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Erro ao criar tarefa.');
    }
  }

  async function toggleTask(id, currentStatus) {
    if (!user) return;
    const newStatus = STATUS_CYCLE[currentStatus] || 'pendente';
    try {
      await updateDoc(doc(db, 'users', user.uid, 'tasks', id), {
        status: newStatus, updatedAt: serverTimestamp(),
      });
      showToast('success', `✅ Movida para "${STATUS_LABEL[newStatus]}"`);
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Erro ao atualizar tarefa.');
    }
  }

  async function deleteTask(id) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', id));
      if (selectedTask?.id === id) setSelectedTask(null); // fecha detalhe se era essa
      showToast('error', '🗑️ Tarefa removida.');
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Erro ao remover tarefa.');
    }
  }

  // ── Loading ────────────────────────────────────────────
  if (loading || !user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className={styles.spinner}/>
    </div>
  );

  const name     = user.displayName || user.email.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const kpi      = { andamento: 0, concluida: 0, pendente: 0, atrasada: 0 };
  tasks.forEach(t => { if (kpi[t.status] !== undefined) kpi[t.status]++; });
  const pendingBadge = kpi.pendente + kpi.atrasada;
  const filtered     = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  // ── Render ─────────────────────────────────────────────
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
              onClick={() => { if (item.id === 'projetos') { router.push('/dashboard/projetos'); setSidebar(false); } else { setPage(item.id); setSidebar(false); } }}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
              {item.id === 'tarefas' && pendingBadge > 0 && (
                <span className={styles.navBadge}>{pendingBadge}</span>
              )}
            </button>
          ))}
          <div className={styles.navSectionLabel} style={{ marginTop: 12 }}>Time</div>
          {NAV_ITEMS.slice(4, 6).map(item => (
            <button key={item.id}
              className={`${styles.navItem} ${page === item.id ? styles.navItemActive : ''}`}
              onClick={() => { if (item.id === 'projetos') { router.push('/dashboard/projetos'); setSidebar(false); } else { setPage(item.id); setSidebar(false); } }}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div className={styles.navSectionLabel} style={{ marginTop: 12 }}>Sistema</div>
          {NAV_ITEMS.slice(6).map(item => (
            <button key={item.id}
              className={`${styles.navItem} ${page === item.id ? styles.navItemActive : ''}`}
              onClick={() => { if (item.id === 'projetos') { router.push('/dashboard/projetos'); setSidebar(false); } else { setPage(item.id); setSidebar(false); } }}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
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
              {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
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

              <div className={styles.kpiGrid}>
                {[
                  ['Em andamento', kpi.andamento, 'kpiBlue'],
                  ['Concluídas',   kpi.concluida, 'kpiGreen'],
                  ['Pendentes',    kpi.pendente,  'kpiYellow'],
                  ['Atrasadas',    kpi.atrasada,  'kpiRed'],
                ].map(([label, value, cls]) => (
                  <div key={label} className={`${styles.kpiCard} ${styles[cls]}`}>
                    <div className={styles.kpiInfo}>
                      <span className={styles.kpiLabel}>{label}</span>
                      <span className={styles.kpiValue}>{dbLoading ? '—' : value}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.dashCard}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>Tarefas recentes</h3>
                  <button className={styles.cardLink} onClick={() => setPage('tarefas')}>Ver todas →</button>
                </div>
                {dbLoading
                  ? <LoadingTasks styles={styles}/>
                  : <TaskList tasks={tasks.slice(0, 6)} onToggle={toggleTask} onDelete={deleteTask} onSelect={setSelectedTask} styles={styles}/>
                }
              </div>
            </div>
          )}

          {/* ── TAREFAS ── */}
          {page === 'tarefas' && (
            <div>
              <div className={styles.welcomeRow}>
                <div>
                  <h1 className={styles.pageTitle}>Tarefas</h1>
                  <p className={styles.pageSub}>
                    {tasks.length > 0 ? `${tasks.length} tarefa${tasks.length > 1 ? 's' : ''} no total` : 'Nenhuma tarefa criada ainda'}
                  </p>
                </div>
                <button className={styles.btnNew} onClick={() => setModalOpen(true)}>+ Nova tarefa</button>
              </div>
              <div className={styles.dashCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.filterTabs}>
                    {['all', 'andamento', 'pendente', 'atrasada', 'concluida'].map(f => (
                      <button key={f}
                        className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ''}`}
                        onClick={() => setFilter(f)}>
                        {{ all: 'Todas', andamento: 'Em andamento', pendente: 'Pendentes', atrasada: 'Atrasadas', concluida: 'Concluídas' }[f]}
                        {f !== 'all' && !dbLoading && (
                          <span className={styles.filterCount}>{tasks.filter(t => t.status === f).length}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                {dbLoading
                  ? <LoadingTasks styles={styles}/>
                  : <TaskList tasks={filtered} onToggle={toggleTask} onDelete={deleteTask} onSelect={setSelectedTask} styles={styles}/>
                }
              </div>
            </div>
          )}

          {/* ── PROJETOS ── */}
          {page === 'projetos' && (
            <div>
              <div className={styles.welcomeRow}>
                <div><h1 className={styles.pageTitle}>Projetos</h1><p className={styles.pageSub}>Organize seu trabalho em projetos.</p></div>
                <button className={styles.btnNew}>+ Novo projeto</button>
              </div>
              <ComingSoon icon="📁" label="Projetos com Firestore" styles={styles}/>
            </div>
          )}

          {/* ── PÁGINAS EM BREVE ── */}
          {['calendario', 'equipe', 'relatorios', 'notificacoes', 'configuracoes'].includes(page) && (
            <div>
              <h1 className={styles.pageTitle} style={{ marginBottom: 8 }}>
                {{ calendario: 'Calendário', equipe: 'Equipe', relatorios: 'Relatórios', notificacoes: 'Notificações', configuracoes: 'Configurações' }[page]}
              </h1>
              <ComingSoon icon="🚧" label="Em breve" styles={styles}/>
            </div>
          )}

        </div>
      </main>

      {/* ── MODAL NOVA TAREFA ── */}
      {modalOpen && (
        <NewTaskModal
          onClose={() => setModalOpen(false)}
          onSave={async data => { await addTask(data); setModalOpen(false); }}
          styles={styles}
        />
      )}

      {/* ── PAINEL DE DETALHE DA TAREFA ── */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onToggle={toggleTask}
          onDelete={id => { deleteTask(id); setSelectedTask(null); }}
          styles={styles}
        />
      )}

      {/* ── TOAST ── */}
      {toast.visible && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.message}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  SUB-COMPONENTES
// ─────────────────────────────────────────────────────────

function LoadingTasks({ styles }) {
  return (
    <div className={styles.taskList}>
      {[1, 2, 3].map(i => <div key={i} className={styles.taskSkeleton}/>)}
    </div>
  );
}

// ── Lista de tarefas — clicar no corpo abre o detalhe ────
function TaskList({ tasks, onToggle, onDelete, onSelect, styles }) {
  if (tasks.length === 0) return (
    <div className={styles.taskEmpty}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>Nenhuma tarefa aqui.</p>
      <p style={{ fontSize: '.8rem', opacity: .7 }}>Clique em &quot;+ Nova tarefa&quot; para começar.</p>
    </div>
  );

  return (
    <div className={styles.taskList}>
      {tasks.map(task => (
        <div key={task.id} className={styles.taskItem} onClick={() => onSelect(task)}>

          {/* Checkbox — clique NÃO abre o detalhe */}
          <button
            className={`${styles.taskCheck} ${task.status === 'concluida' ? styles.checkDone : task.status === 'andamento' ? styles.checkProg : ''}`}
            onClick={e => { e.stopPropagation(); onToggle(task.id, task.status); }}
            title="Avançar status"
          >
            {task.status === 'concluida' ? '✓' : ''}
          </button>

          <div className={styles.taskMain}>
            <p className={`${styles.taskName} ${task.status === 'concluida' ? styles.taskDone : ''}`}>
              {task.title}
            </p>
            <p className={styles.taskMeta}>
              {task.project && `📁 ${task.project}`}
              {task.due && ` · 📅 ${new Date(task.due + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
              {task.priority && task.priority !== 'normal' && ` · ${task.priority === 'urgente' ? '🔴' : '🟡'} ${task.priority}`}
              {/* Indicador visual de que há descrição */}
              {task.description && <span className={styles.hasDesc} title="Tem descrição"> · 📝</span>}
            </p>
          </div>

          <span className={`${styles.taskBadge} ${styles[STATUS_CLASS[task.status]]}`}>
            {STATUS_LABEL[task.status]}
          </span>

          {/* Delete — clique NÃO abre o detalhe */}
          <button
            className={styles.taskDelete}
            onClick={e => { e.stopPropagation(); onDelete(task.id); }}
            title="Remover"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Painel lateral de detalhe da tarefa ──────────────────
function TaskDetailPanel({ task, onClose, onToggle, onDelete, styles }) {
  const formattedDate = task.due
    ? new Date(task.due + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return (
    <>
      {/* Backdrop escuro atrás do painel */}
      <div className={styles.detailBackdrop} onClick={onClose}/>

      <div className={styles.detailPanel}>
        {/* Header */}
        <div className={styles.detailHeader}>
          <span className={`${styles.taskBadge} ${styles[STATUS_CLASS[task.status]]}`}>
            {STATUS_LABEL[task.status]}
          </span>
          <button className={styles.detailClose} onClick={onClose} title="Fechar">✕</button>
        </div>

        {/* Título */}
        <h2 className={`${styles.detailTitle} ${task.status === 'concluida' ? styles.taskDone : ''}`}>
          {task.title}
        </h2>

        {/* Metadados */}
        <div className={styles.detailMeta}>
          {task.project && (
            <div className={styles.detailMetaItem}>
              <span className={styles.detailMetaIcon}>📁</span>
              <span>{task.project}</span>
            </div>
          )}
          {formattedDate && (
            <div className={styles.detailMetaItem}>
              <span className={styles.detailMetaIcon}>📅</span>
              <span>{formattedDate}</span>
            </div>
          )}
          {task.priority && (
            <div className={styles.detailMetaItem}>
              <span className={styles.detailMetaIcon}>
                {task.priority === 'urgente' ? '🔴' : task.priority === 'alta' ? '🟡' : '🟢'}
              </span>
              <span style={{ textTransform: 'capitalize' }}>{task.priority}</span>
            </div>
          )}
        </div>

        {/* Descrição */}
        <div className={styles.detailSection}>
          <p className={styles.detailSectionLabel}>Descrição</p>
          {task.description ? (
            <p className={styles.detailDescription}>{task.description}</p>
          ) : (
            <p className={styles.detailDescriptionEmpty}>Nenhuma descrição adicionada.</p>
          )}
        </div>

        {/* Ações */}
        <div className={styles.detailActions}>
          <button
            className={styles.detailBtnToggle}
            onClick={() => onToggle(task.id, task.status)}
          >
            {task.status === 'concluida' ? '↩ Reabrir tarefa' : '✓ Avançar status'}
          </button>
          <button
            className={styles.detailBtnDelete}
            onClick={() => onDelete(task.id)}
          >
            🗑️ Remover
          </button>
        </div>
      </div>
    </>
  );
}

function ComingSoon({ icon, label, styles }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 60 }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>{icon}</div>
      <p className={styles.pageSub} style={{ textAlign: 'center' }}>{label} — em desenvolvimento. 🚀</p>
    </div>
  );
}

// ── Modal de criar nova tarefa — com campo de descrição ──
function NewTaskModal({ onClose, onSave, styles }) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      title:       fd.get('title').trim(),
      description: fd.get('description').trim(), // ← novo campo
      status:      fd.get('status'),
      project:     fd.get('project'),
      priority:    fd.get('priority'),
      due:         fd.get('due'),
    };
    if (!data.title) return;
    setSaving(true);
    await onSave(data);
    setSaving(false);
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Nova tarefa</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalBody}>
          {/* Título */}
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Título *</label>
            <input name="title" type="text" className={styles.mInput}
              placeholder="Ex: Revisar proposta do cliente" required autoFocus/>
          </div>

          {/* Descrição — novo campo */}
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Descrição <span className={styles.mLabelOptional}>(opcional)</span></label>
            <textarea
              name="description"
              className={`${styles.mInput} ${styles.mTextarea}`}
              placeholder="Detalhes, contexto ou observações sobre a tarefa..."
              rows={3}
            />
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
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? 'Salvando...' : '+ Criar tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
