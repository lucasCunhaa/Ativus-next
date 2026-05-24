// src/app/dashboard/page.js  →  rota: /dashboard
// A sidebar e topbar estão em layout.js — aqui só o conteúdo da página.
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  andamento: 'Em andamento', concluida: 'Concluída',
  pendente: 'Pendente', atrasada: 'Atrasada',
};
const STATUS_CLASS = {
  andamento: 'badgeAndamento', concluida: 'badgeConcluida',
  pendente: 'badgePendente',   atrasada: 'badgeAtrasada',
};
const STATUS_CYCLE = {
  pendente: 'andamento', andamento: 'concluida',
  concluida: 'pendente', atrasada: 'andamento',
};

export default function DashboardPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const [page,         setPage]        = useState('dashboard');
  const [tasks,        setTasks]       = useState([]);
  const [dbLoading,    setDbLoading]   = useState(true);
  const [filter,       setFilter]      = useState('all');
  const [modalOpen,    setModalOpen]   = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [toast,        setToast]       = useState({ visible: false, message: '', type: '' });

  // Ouve navegação por evento (disparado pelo layout quando clica em item hash)
  useEffect(() => {
    function onNavigate(e) { setPage(e.detail); }
    window.addEventListener('ativus:navigate', onNavigate);
    return () => window.removeEventListener('ativus:navigate', onNavigate);
  }, []);

  // Lê ?page= da URL (quando vem de outra rota)
  useEffect(() => {
    const p = searchParams.get('page');
    if (p) setPage(p);
  }, [searchParams]);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  // Listener Firestore
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

  async function addTask(data) {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'tasks'), {
        ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      showToast('success', '✅ Tarefa criada!');
    } catch (err) { console.error(err); showToast('error', '❌ Erro ao criar tarefa.'); }
  }

  async function toggleTask(id, currentStatus) {
    if (!user) return;
    const newStatus = STATUS_CYCLE[currentStatus] || 'pendente';
    try {
      await updateDoc(doc(db, 'users', user.uid, 'tasks', id), {
        status: newStatus, updatedAt: serverTimestamp(),
      });
      showToast('success', `✅ Movida para "${STATUS_LABEL[newStatus]}"`);
    } catch (err) { console.error(err); showToast('error', '❌ Erro ao atualizar.'); }
  }

  async function deleteTask(id) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', id));
      if (selectedTask?.id === id) setSelectedTask(null);
      showToast('error', '🗑️ Tarefa removida.');
    } catch (err) { console.error(err); showToast('error', '❌ Erro ao remover.'); }
  }

  if (loading || !user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div className={styles.spinner}/>
    </div>
  );

  const kpi = { andamento: 0, concluida: 0, pendente: 0, atrasada: 0 };
  tasks.forEach(t => { if (kpi[t.status] !== undefined) kpi[t.status]++; });
  const pendingBadge = kpi.pendente + kpi.atrasada;
  const filtered     = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  const name         = user.displayName || user.email.split('@')[0];

  return (
    <div className={styles.page}>

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
                <span className={styles.kpiLabel}>{label}</span>
                <span className={styles.kpiValue}>{dbLoading ? '—' : value}</span>
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
              <p className={styles.pageSub}>{tasks.length > 0 ? `${tasks.length} tarefa${tasks.length > 1 ? 's' : ''} no total` : 'Nenhuma tarefa ainda'}</p>
            </div>
            <button className={styles.btnNew} onClick={() => setModalOpen(true)}>+ Nova tarefa</button>
          </div>
          <div className={styles.dashCard}>
            <div className={styles.cardHeader}>
              <div className={styles.filterTabs}>
                {['all','andamento','pendente','atrasada','concluida'].map(f => (
                  <button key={f}
                    className={`${styles.filterTab} ${filter === f ? styles.filterTabActive : ''}`}
                    onClick={() => setFilter(f)}>
                    {{ all:'Todas', andamento:'Em andamento', pendente:'Pendentes', atrasada:'Atrasadas', concluida:'Concluídas' }[f]}
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

      {/* ── PÁGINAS EM BREVE ── */}
      {['calendario','equipe','relatorios','notificacoes','configuracoes'].includes(page) && (
        <div style={{ textAlign:'center', paddingTop:80 }}>
          <div style={{ fontSize:'3rem', marginBottom:16 }}>🚧</div>
          <h1 className={styles.pageTitle} style={{ marginBottom:8 }}>
            {{ calendario:'Calendário', equipe:'Equipe', relatorios:'Relatórios', notificacoes:'Notificações', configuracoes:'Configurações' }[page]}
          </h1>
          <p className={styles.pageSub} style={{ textAlign:'center' }}>Em breve — estamos construindo algo incrível.</p>
        </div>
      )}

      {/* ── MODAL NOVA TAREFA ── */}
      {modalOpen && (
        <NewTaskModal
          onClose={() => setModalOpen(false)}
          onSave={async data => { await addTask(data); setModalOpen(false); }}
          styles={styles}
        />
      )}

      {/* ── PAINEL DE DETALHE ── */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onToggle={toggleTask}
          onDelete={id => { deleteTask(id); setSelectedTask(null); }}
          styles={styles}
        />
      )}

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
      {[1,2,3].map(i => <div key={i} className={styles.taskSkeleton}/>)}
    </div>
  );
}

function TaskList({ tasks, onToggle, onDelete, onSelect, styles }) {
  if (tasks.length === 0) return (
    <div className={styles.taskEmpty}>
      <div style={{ fontSize:'2.5rem', marginBottom:12 }}>✅</div>
      <p style={{ fontWeight:600, marginBottom:4 }}>Nenhuma tarefa aqui.</p>
      <p style={{ fontSize:'.8rem', opacity:.7 }}>Clique em &quot;+ Nova tarefa&quot; para começar.</p>
    </div>
  );
  return (
    <div className={styles.taskList}>
      {tasks.map(task => (
        <div key={task.id} className={styles.taskItem} onClick={() => onSelect(task)}>
          <button
            className={`${styles.taskCheck} ${task.status==='concluida'?styles.checkDone:task.status==='andamento'?styles.checkProg:''}`}
            onClick={e => { e.stopPropagation(); onToggle(task.id, task.status); }}
          >{task.status==='concluida'?'✓':''}</button>
          <div className={styles.taskMain}>
            <p className={`${styles.taskName} ${task.status==='concluida'?styles.taskDone:''}`}>{task.title}</p>
            <p className={styles.taskMeta}>
              {task.project && `📁 ${task.project}`}
              {task.due && ` · 📅 ${new Date(task.due+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}`}
              {task.priority && task.priority!=='normal' && ` · ${task.priority==='urgente'?'🔴':'🟡'} ${task.priority}`}
              {task.description && <span style={{color:'var(--text-3)'}}> · 📝</span>}
            </p>
          </div>
          <span className={`${styles.taskBadge} ${styles[STATUS_CLASS[task.status]]}`}>{STATUS_LABEL[task.status]}</span>
          <button className={styles.taskDelete} onClick={e => { e.stopPropagation(); onDelete(task.id); }}>✕</button>
        </div>
      ))}
    </div>
  );
}

function TaskDetailPanel({ task, onClose, onToggle, onDelete, styles }) {
  const formattedDate = task.due
    ? new Date(task.due+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})
    : null;
  return (
    <>
      <div className={styles.detailBackdrop} onClick={onClose}/>
      <div className={styles.detailPanel}>
        <div className={styles.detailPanelHeader}>
          <span className={`${styles.taskBadge} ${styles[STATUS_CLASS[task.status]]}`}>{STATUS_LABEL[task.status]}</span>
          <button className={styles.detailClose} onClick={onClose}>✕</button>
        </div>
        <h2 className={`${styles.detailTitle} ${task.status==='concluida'?styles.taskDone:''}`}>{task.title}</h2>
        <div className={styles.detailMeta}>
          {task.project && <div className={styles.detailMetaItem}><span className={styles.detailMetaIcon}>📁</span><span>{task.project}</span></div>}
          {formattedDate && <div className={styles.detailMetaItem}><span className={styles.detailMetaIcon}>📅</span><span>{formattedDate}</span></div>}
          {task.priority && <div className={styles.detailMetaItem}><span className={styles.detailMetaIcon}>{task.priority==='urgente'?'🔴':task.priority==='alta'?'🟡':'🟢'}</span><span style={{textTransform:'capitalize'}}>{task.priority}</span></div>}
        </div>
        <div className={styles.detailSection}>
          <p className={styles.detailSectionLabel}>Descrição</p>
          {task.description
            ? <p className={styles.detailDescription}>{task.description}</p>
            : <p className={styles.detailDescriptionEmpty}>Nenhuma descrição adicionada.</p>
          }
        </div>
        <div className={styles.detailActions}>
          <button className={styles.detailBtnToggle} onClick={() => onToggle(task.id, task.status)}>
            {task.status==='concluida'?'↩ Reabrir':'✓ Avançar status'}
          </button>
          <button className={styles.detailBtnDelete} onClick={() => onDelete(task.id)}>🗑️ Remover</button>
        </div>
      </div>
    </>
  );
}

function NewTaskModal({ onClose, onSave, styles }) {
  const [saving, setSaving] = useState(false);
  async function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      title: fd.get('title').trim(), description: fd.get('description').trim(),
      status: fd.get('status'), project: fd.get('project'),
      priority: fd.get('priority'), due: fd.get('due'),
    };
    if (!data.title) return;
    setSaving(true);
    await onSave(data);
    setSaving(false);
  }
  return (
    <div className={styles.modalOverlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Nova tarefa</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Título *</label>
            <input name="title" type="text" className={styles.mInput} placeholder="Ex: Revisar proposta" required autoFocus/>
          </div>
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Descrição <span className={styles.mLabelOptional}>(opcional)</span></label>
            <textarea name="description" className={`${styles.mInput} ${styles.mTextarea}`} placeholder="Detalhes da tarefa..." rows={3}/>
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
            <button type="submit" className={styles.btnSave} disabled={saving}>{saving?'Salvando...':'+ Criar tarefa'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
