// src/app/dashboard/projetos/page.js  →  rota: /dashboard/projetos
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
  db,
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDoc, setDoc, query, where, orderBy,
  onSnapshot, serverTimestamp, arrayUnion,
} from '@/lib/firebase';
import styles from './projetos.module.css';

// ── Constantes ────────────────────────────────────────────
const STATUS_LABEL = { andamento: 'Em andamento', concluida: 'Concluída', pendente: 'Pendente', atrasada: 'Atrasada' };
const STATUS_CLASS  = { andamento: 'badgeAndamento', concluida: 'badgeConcluida', pendente: 'badgePendente', atrasada: 'badgeAtrasada' };
const STATUS_CYCLE  = { pendente: 'andamento', andamento: 'concluida', concluida: 'pendente', atrasada: 'andamento' };
const PROJECT_ICONS = ['🚀', '📣', '⚙️', '🎨', '📊', '💡', '🛒', '🎯', '🔬', '📱'];

// Gera um código de acesso legível: ex. "ATIVUS-X4K2"
function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `ATIVUS-${code}`;
}

// ─────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────
export default function ProjetosPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // ── Estado ────────────────────────────────────────────
  const [projects,       setProjects]       = useState([]);
  const [dbLoading,      setDbLoading]      = useState(true);
  const [activeProject,  setActiveProject]  = useState(null); // projeto aberto
  const [projectTasks,   setProjectTasks]   = useState([]);
  const [tasksLoading,   setTasksLoading]   = useState(false);
  const [view,           setView]           = useState('list'); // 'list' | 'detail'
  const [modal,          setModal]          = useState(null);   // 'create' | 'join' | 'newTask' | 'taskDetail'
  const [selectedTask,   setSelectedTask]   = useState(null);
  const [toast,          setToast]          = useState({ visible: false, message: '', type: '' });

  // ── Auth guard ──────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  // ── Listener: projetos do usuário em tempo real ──────
  // Busca projetos onde o uid do usuário está no array "members"
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'projects'),
      where('members', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q,
      snap => {
        setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setDbLoading(false);
      },
      err => {
        console.error('[Ativus] Projetos:', err);
        setDbLoading(false);
        showToast('error', '❌ Erro ao carregar projetos.');
      }
    );
    return () => unsub();
  }, [user]);

  // ── Listener: tarefas do projeto aberto ─────────────
  useEffect(() => {
    if (!activeProject) { setProjectTasks([]); return; }
    setTasksLoading(true);
    const q = query(
      collection(db, 'projects', activeProject.id, 'tasks'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q,
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setProjectTasks(data);
        setTasksLoading(false);
        // Atualiza selectedTask em tempo real se estiver aberto
        setSelectedTask(prev => prev ? (data.find(t => t.id === prev.id) ?? null) : null);
        // Atualiza activeProject com dados frescos
        setActiveProject(prev => prev ? { ...prev } : null);
      },
      err => {
        console.error('[Ativus] Tarefas do projeto:', err);
        setTasksLoading(false);
      }
    );
    return () => unsub();
  }, [activeProject?.id]);

  // ── Helpers ──────────────────────────────────────────
  function showToast(type, message) {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500);
  }

  // ── Criar projeto ─────────────────────────────────────
  async function createProject(data) {
    if (!user) return;
    const accessCode = generateAccessCode();
    try {
      const ref = await addDoc(collection(db, 'projects'), {
        name:        data.name.trim(),
        description: data.description.trim(),
        icon:        data.icon || '🚀',
        ownerId:     user.uid,
        ownerName:   user.displayName || user.email,
        members:     [user.uid],  // criador já é membro
        accessCode,
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
      showToast('success', `✅ Projeto criado! Código: ${accessCode}`);
      return { id: ref.id, accessCode };
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Erro ao criar projeto.');
      return null;
    }
  }

  // ── Entrar em projeto pelo código ──────────────────────
  async function joinProject(code) {
    if (!user) return false;
    const normalizedCode = code.trim().toUpperCase();

    try {
      // Busca projeto pelo accessCode
      const q = query(
        collection(db, 'projects'),
        where('accessCode', '==', normalizedCode)
      );
      const snap = await new Promise((res, rej) => {
        const unsub = onSnapshot(q, s => { unsub(); res(s); }, rej);
      });

      if (snap.empty) {
        showToast('error', '❌ Código inválido. Verifique e tente novamente.');
        return false;
      }

      const projectDoc  = snap.docs[0];
      const projectData = projectDoc.data();

      // Já é membro?
      if (projectData.members?.includes(user.uid)) {
        showToast('error', '⚠️ Você já faz parte deste projeto.');
        return false;
      }

      // Adiciona uid ao array de membros
      await updateDoc(doc(db, 'projects', projectDoc.id), {
        members:   arrayUnion(user.uid),
        updatedAt: serverTimestamp(),
      });

      showToast('success', `✅ Você entrou em "${projectData.name}"!`);
      return true;
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Erro ao entrar no projeto.');
      return false;
    }
  }

  // ── Deletar projeto (só dono) ─────────────────────────
  async function deleteProject(projectId) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      if (activeProject?.id === projectId) { setActiveProject(null); setView('list'); }
      showToast('error', '🗑️ Projeto removido.');
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Erro ao remover projeto.');
    }
  }

  // ── Sair de um projeto ────────────────────────────────
  async function leaveProject(projectId) {
    if (!user) return;
    try {
      const projectRef  = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);
      const data        = projectSnap.data();
      const newMembers  = (data.members || []).filter(m => m !== user.uid);
      await updateDoc(projectRef, { members: newMembers, updatedAt: serverTimestamp() });
      if (activeProject?.id === projectId) { setActiveProject(null); setView('list'); }
      showToast('success', '👋 Você saiu do projeto.');
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Erro ao sair do projeto.');
    }
  }

  // ── CRUD de tarefas do projeto ─────────────────────────
  async function addProjectTask(data) {
    if (!user || !activeProject) return;
    try {
      await addDoc(collection(db, 'projects', activeProject.id, 'tasks'), {
        ...data,
        authorId:   user.uid,
        authorName: user.displayName || user.email,
        createdAt:  serverTimestamp(),
        updatedAt:  serverTimestamp(),
      });
      showToast('success', '✅ Tarefa criada!');
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Erro ao criar tarefa.');
    }
  }

  async function toggleProjectTask(taskId, currentStatus) {
    if (!user || !activeProject) return;
    const newStatus = STATUS_CYCLE[currentStatus] || 'pendente';
    try {
      await updateDoc(doc(db, 'projects', activeProject.id, 'tasks', taskId), {
        status:    newStatus,
        updatedAt: serverTimestamp(),
      });
      showToast('success', `✅ "${STATUS_LABEL[newStatus]}"`);
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Erro ao atualizar tarefa.');
    }
  }

  async function deleteProjectTask(taskId) {
    if (!user || !activeProject) return;
    try {
      await deleteDoc(doc(db, 'projects', activeProject.id, 'tasks', taskId));
      if (selectedTask?.id === taskId) setSelectedTask(null);
      showToast('error', '🗑️ Tarefa removida.');
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Erro ao remover tarefa.');
    }
  }

  // ── Abre um projeto (muda para view detail) ────────────
  function openProject(project) {
    setActiveProject(project);
    setView('detail');
  }

  function backToList() {
    setActiveProject(null);
    setView('list');
    setSelectedTask(null);
  }

  if (loading || !user) return (
    <div className={styles.centered}><div className={styles.spinner}/></div>
  );

  // Progresso do projeto aberto
  const total     = projectTasks.length;
  const concluded = projectTasks.filter(t => t.status === 'concluida').length;
  const progress  = total > 0 ? Math.round((concluded / total) * 100) : 0;

  // ─────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── LISTA DE PROJETOS ── */}
      {view === 'list' && (
        <div>
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Projetos</h1>
              <p className={styles.pageSub}>
                {projects.length > 0 ? `${projects.length} projeto${projects.length > 1 ? 's' : ''}` : 'Nenhum projeto ainda'}
              </p>
            </div>
            <div className={styles.headerActions}>
              <button className={styles.btnSecondary} onClick={() => setModal('join')}>
                🔑 Entrar com código
              </button>
              <button className={styles.btnPrimary} onClick={() => setModal('create')}>
                + Novo projeto
              </button>
            </div>
          </div>

          {dbLoading ? (
            <div className={styles.projectsGrid}>
              {[1, 2, 3].map(i => <div key={i} className={styles.cardSkeleton}/>)}
            </div>
          ) : projects.length === 0 ? (
            <EmptyProjects onCreate={() => setModal('create')} onJoin={() => setModal('join')} styles={styles}/>
          ) : (
            <div className={styles.projectsGrid}>
              {projects.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  userId={user.uid}
                  onOpen={() => openProject(p)}
                  onDelete={() => deleteProject(p.id)}
                  onLeave={() => leaveProject(p.id)}
                  styles={styles}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DETALHE DO PROJETO ── */}
      {view === 'detail' && activeProject && (
        <div>
          {/* Cabeçalho do projeto */}
          <div className={styles.detailHeader}>
            <button className={styles.backBtn} onClick={backToList}>
              ← Projetos
            </button>
            <div className={styles.detailTitleRow}>
              <div className={styles.projectIconLg}>{activeProject.icon}</div>
              <div>
                <h1 className={styles.pageTitle}>{activeProject.name}</h1>
                {activeProject.description && (
                  <p className={styles.pageSub}>{activeProject.description}</p>
                )}
              </div>
              <div className={styles.accessCodeBox}>
                <span className={styles.accessCodeLabel}>Código de acesso</span>
                <span className={styles.accessCode}>{activeProject.accessCode}</span>
                <button
                  className={styles.copyBtn}
                  onClick={() => {
                    navigator.clipboard.writeText(activeProject.accessCode);
                    showToast('success', '📋 Código copiado!');
                  }}
                  title="Copiar código"
                >
                  📋
                </button>
              </div>
            </div>

            {/* Barra de progresso */}
            <div className={styles.progressSection}>
              <div className={styles.progressInfo}>
                <span className={styles.progressLabel}>Progresso geral</span>
                <span className={styles.progressPct}>{progress}%</span>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }}/>
              </div>
              <div className={styles.progressStats}>
                <span>✅ {concluded} concluídas</span>
                <span>📋 {total} no total</span>
                <span>👥 {activeProject.members?.length || 1} membro{activeProject.members?.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Tarefas do projeto */}
          <div className={styles.tasksCard}>
            <div className={styles.tasksCardHeader}>
              <h3 className={styles.cardTitle}>Tarefas do projeto</h3>
              <button className={styles.btnPrimary} onClick={() => setModal('newTask')}>
                + Nova tarefa
              </button>
            </div>

            {tasksLoading ? (
              <div className={styles.taskList}>
                {[1, 2, 3].map(i => <div key={i} className={styles.taskSkeleton}/>)}
              </div>
            ) : projectTasks.length === 0 ? (
              <div className={styles.taskEmpty}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>📋</div>
                <p style={{ fontWeight: 600 }}>Nenhuma tarefa ainda.</p>
                <p style={{ fontSize: '.8rem', opacity: .7, marginTop: 4 }}>
                  Clique em &quot;+ Nova tarefa&quot; para começar.
                </p>
              </div>
            ) : (
              <div className={styles.taskList}>
                {projectTasks.map(task => (
                  <div key={task.id} className={styles.taskItem} onClick={() => setSelectedTask(task)}>
                    <button
                      className={`${styles.taskCheck} ${task.status === 'concluida' ? styles.checkDone : task.status === 'andamento' ? styles.checkProg : ''}`}
                      onClick={e => { e.stopPropagation(); toggleProjectTask(task.id, task.status); }}
                      title="Avançar status"
                    >
                      {task.status === 'concluida' ? '✓' : ''}
                    </button>
                    <div className={styles.taskMain}>
                      <p className={`${styles.taskName} ${task.status === 'concluida' ? styles.taskDone : ''}`}>
                        {task.title}
                      </p>
                      <p className={styles.taskMeta}>
                        👤 {task.authorName}
                        {task.due && ` · 📅 ${new Date(task.due + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                        {task.priority && task.priority !== 'normal' && ` · ${task.priority === 'urgente' ? '🔴' : '🟡'} ${task.priority}`}
                        {task.description && <span style={{ color: 'var(--text-3)' }}> · 📝</span>}
                      </p>
                    </div>
                    <span className={`${styles.taskBadge} ${styles[STATUS_CLASS[task.status]]}`}>
                      {STATUS_LABEL[task.status]}
                    </span>
                    <button
                      className={styles.taskDelete}
                      onClick={e => { e.stopPropagation(); deleteProjectTask(task.id); }}
                      title="Remover"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAIS ── */}
      {modal === 'create' && (
        <CreateProjectModal
          onClose={() => setModal(null)}
          onSave={async data => {
            const result = await createProject(data);
            if (result) setModal(null);
          }}
          styles={styles}
        />
      )}

      {modal === 'join' && (
        <JoinProjectModal
          onClose={() => setModal(null)}
          onJoin={async code => {
            const ok = await joinProject(code);
            if (ok) setModal(null);
          }}
          styles={styles}
        />
      )}

      {modal === 'newTask' && (
        <NewTaskModal
          onClose={() => setModal(null)}
          onSave={async data => { await addProjectTask(data); setModal(null); }}
          styles={styles}
        />
      )}

      {/* ── PAINEL DE DETALHE DA TAREFA ── */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onToggle={toggleProjectTask}
          onDelete={id => { deleteProjectTask(id); setSelectedTask(null); }}
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

function EmptyProjects({ onCreate, onJoin, styles }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>📁</div>
      <h3 className={styles.emptyTitle}>Nenhum projeto ainda</h3>
      <p className={styles.emptyDesc}>Crie um projeto novo ou entre em um existente com o código de acesso.</p>
      <div className={styles.emptyActions}>
        <button className={styles.btnPrimary} onClick={onCreate}>+ Criar projeto</button>
        <button className={styles.btnSecondary} onClick={onJoin}>🔑 Entrar com código</button>
      </div>
    </div>
  );
}

function ProjectCard({ project, userId, onOpen, onDelete, onLeave, styles }) {
  const isOwner = project.ownerId === userId;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.projectCard} onClick={onOpen}>
      <div className={styles.projectCardHeader}>
        <div className={styles.projectIcon}>{project.icon}</div>
        <div className={styles.projectCardMenu}>
          <button
            className={styles.menuTrigger}
            onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }}
            title="Opções"
          >
            ···
          </button>
          {menuOpen && (
            <div className={styles.menuDropdown} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setMenuOpen(false); navigator.clipboard.writeText(project.accessCode); }}>
                📋 Copiar código
              </button>
              {isOwner ? (
                <button className={styles.menuDanger} onClick={() => { setMenuOpen(false); onDelete(); }}>
                  🗑️ Deletar projeto
                </button>
              ) : (
                <button className={styles.menuDanger} onClick={() => { setMenuOpen(false); onLeave(); }}>
                  👋 Sair do projeto
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <h4 className={styles.projectCardName}>{project.name}</h4>
      {project.description && (
        <p className={styles.projectCardDesc}>{project.description}</p>
      )}

      <div className={styles.projectCardFooter}>
        <div className={styles.projectCardMeta}>
          <span>👥 {project.members?.length || 1}</span>
          <span className={styles.accessCodeChip}>{project.accessCode}</span>
        </div>
        {isOwner && <span className={styles.ownerBadge}>Dono</span>}
      </div>
    </div>
  );
}

function CreateProjectModal({ onClose, onSave, styles }) {
  const [saving,   setSaving]   = useState(false);
  const [icon,     setIcon]     = useState('🚀');
  const [showIcons, setShowIcons] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    setSaving(true);
    await onSave({ name: fd.get('name'), description: fd.get('description'), icon });
    setSaving(false);
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Novo projeto</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>

          {/* Seletor de ícone */}
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Ícone</label>
            <div className={styles.iconPickerRow}>
              <button type="button" className={styles.iconSelected} onClick={() => setShowIcons(v => !v)}>
                {icon} <span style={{ fontSize: '.75rem', marginLeft: 6 }}>▼</span>
              </button>
              {showIcons && (
                <div className={styles.iconGrid}>
                  {PROJECT_ICONS.map(ic => (
                    <button key={ic} type="button"
                      className={`${styles.iconOption} ${icon === ic ? styles.iconOptionActive : ''}`}
                      onClick={() => { setIcon(ic); setShowIcons(false); }}>
                      {ic}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Nome do projeto *</label>
            <input name="name" type="text" className={styles.mInput}
              placeholder="Ex: Lançamento do produto" required autoFocus/>
          </div>

          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Descrição <span className={styles.mLabelOptional}>(opcional)</span></label>
            <textarea name="description" className={`${styles.mInput} ${styles.mTextarea}`}
              placeholder="Objetivo e contexto do projeto..." rows={3}/>
          </div>

          <div className={styles.accessCodeInfo}>
            🔑 Um código de acesso será gerado automaticamente para compartilhar com sua equipe.
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? 'Criando...' : '+ Criar projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JoinProjectModal({ onClose, onJoin, styles }) {
  const [code,   setCode]   = useState('');
  const [joining, setJoining] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setJoining(true);
    await onJoin(code);
    setJoining(false);
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Entrar em um projeto</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.joinInfo}>
            <div className={styles.joinInfoIcon}>🔑</div>
            <p>Peça o código de acesso para o dono do projeto e cole abaixo para entrar e colaborar.</p>
          </div>
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Código de acesso *</label>
            <input
              type="text"
              className={`${styles.mInput} ${styles.codeInput}`}
              placeholder="Ex: ATIVUS-X4K2AB"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              required autoFocus
              maxLength={13}
            />
            <p className={styles.inputHint}>O código começa com ATIVUS- seguido de 6 caracteres.</p>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnSave} disabled={joining || !code.trim()}>
              {joining ? 'Entrando...' : '🔑 Entrar no projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewTaskModal({ onClose, onSave, styles }) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      title:       fd.get('title').trim(),
      description: fd.get('description').trim(),
      status:      fd.get('status'),
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
          <h3 className={styles.modalTitle}>Nova tarefa do projeto</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Título *</label>
            <input name="title" type="text" className={styles.mInput}
              placeholder="Ex: Criar landing page" required autoFocus/>
          </div>
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Descrição <span className={styles.mLabelOptional}>(opcional)</span></label>
            <textarea name="description" className={`${styles.mInput} ${styles.mTextarea}`}
              placeholder="Detalhes da tarefa..." rows={3}/>
          </div>
          <div className={styles.mFormRow}>
            <div className={styles.mFormGroup}>
              <label className={styles.mLabel}>Status</label>
              <select name="status" className={styles.mInput}>
                <option value="pendente">Pendente</option>
                <option value="andamento">Em andamento</option>
              </select>
            </div>
            <div className={styles.mFormGroup}>
              <label className={styles.mLabel}>Prioridade</label>
              <select name="priority" className={styles.mInput}>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Prazo</label>
            <input name="due" type="date" className={styles.mInput}/>
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

function TaskDetailPanel({ task, onClose, onToggle, onDelete, styles }) {
  const formattedDate = task.due
    ? new Date(task.due + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return (
    <>
      <div className={styles.detailBackdrop} onClick={onClose}/>
      <div className={styles.detailPanel}>
        <div className={styles.detailPanelHeader}>
          <span className={`${styles.taskBadge} ${styles[STATUS_CLASS[task.status]]}`}>
            {STATUS_LABEL[task.status]}
          </span>
          <button className={styles.detailClose} onClick={onClose}>✕</button>
        </div>
        <h2 className={`${styles.detailTitle} ${task.status === 'concluida' ? styles.taskDone : ''}`}>
          {task.title}
        </h2>
        <div className={styles.detailMeta}>
          {task.authorName && (
            <div className={styles.detailMetaItem}>
              <span className={styles.detailMetaIcon}>👤</span>
              <span>{task.authorName}</span>
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
        <div className={styles.detailSection}>
          <p className={styles.detailSectionLabel}>Descrição</p>
          {task.description
            ? <p className={styles.detailDescription}>{task.description}</p>
            : <p className={styles.detailDescriptionEmpty}>Nenhuma descrição adicionada.</p>
          }
        </div>
        <div className={styles.detailActions}>
          <button className={styles.detailBtnToggle} onClick={() => onToggle(task.id, task.status)}>
            {task.status === 'concluida' ? '↩ Reabrir' : '✓ Avançar status'}
          </button>
          <button className={styles.detailBtnDelete} onClick={() => onDelete(task.id)}>
            🗑️ Remover
          </button>
        </div>
      </div>
    </>
  );
}
