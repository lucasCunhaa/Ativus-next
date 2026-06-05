// src/app/dashboard/projetos/page.js
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
  db,
  collection, addDoc, updateDoc, deleteDoc,
  doc, setDoc, getDoc, query, where, orderBy,
  onSnapshot, getDocs, serverTimestamp, arrayUnion,
} from '@/lib/firebase';
import styles from './projetos.module.css';

const STATUS_LABEL = { andamento: 'Em andamento', concluida: 'Concluída', pendente: 'Pendente', atrasada: 'Atrasada' };
const STATUS_CLASS = { andamento: 'badgeAndamento', concluida: 'badgeConcluida', pendente: 'badgePendente', atrasada: 'badgeAtrasada' };
const STATUS_CYCLE = { pendente: 'andamento', andamento: 'concluida', concluida: 'pendente', atrasada: 'andamento' };
const PROJECT_ICONS = ['🚀', '📣', '⚙️', '🎨', '📊', '💡', '🛒', '🎯', '🔬', '📱'];

function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `ATIVUS-${code}`;
}

export default function ProjetosPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [projects, setProjects] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [activeProject, setActiveProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [view, setView] = useState('list');
  const [modal, setModal] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  // ── Carrega projetos — sem orderBy para não precisar de índice composto ──
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'projects'),
      where('members', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(q,
      snap => {
        // Ordena no cliente por createdAt decrescente
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt?.seconds ?? 0;
            const tb = b.createdAt?.seconds ?? 0;
            return tb - ta;
          });
        setProjects(data);
        setDbLoading(false);
      },
      err => {
        console.error('[Ativus] Projetos erro:', err.code, err.message);
        setDbLoading(false);
        if (err.code === 'permission-denied') {
          // permission-denied na query de projetos significa que o usuário
          // não tem projetos ainda — comportamento normal, não é um erro real
          setProjects([]);
        } else {
          showToast('error', '❌ Erro ao carregar projetos.');
        }
      }
    );
    return () => unsub();
  }, [user]);

  // ── Tarefas do projeto aberto ─────────────────────────
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
        setSelectedTask(prev => prev ? (data.find(t => t.id === prev.id) ?? null) : null);
      },
      err => {
        console.error('[Ativus] Tasks:', err);
        setTasksLoading(false);
      }
    );
    return () => unsub();
  }, [activeProject?.id]);

  function showToast(type, message) {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500);
  }

  // ── Criar projeto ─────────────────────────────────────
  async function createProject(data) {
    if (!user) return null;
    const accessCode = generateAccessCode();
    try {
      const projectRef = await addDoc(collection(db, 'projects'), {
        name: data.name.trim(),
        description: data.description?.trim() || '',
        icon: data.icon || '🚀',
        ownerId: user.uid,
        ownerName: user.displayName || user.email,
        members: [user.uid],
        accessCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Mapa público accessCodes/{CODE} → projectId (leitura pública, sem índice)
      await setDoc(doc(db, 'accessCodes', accessCode), {
        projectId: projectRef.id,
        projectName: data.name.trim(),
        createdAt: serverTimestamp(),
      });
      showToast('success', `✅ Projeto criado! Código: ${accessCode}`);
      return { accessCode };
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Erro ao criar projeto.');
      return null;
    }
  }

  // ── Entrar pelo código ─────────────────────────────────
  // Lê accessCodes/{CODE} (público) → projectId → entra no projeto
  async function joinProject(code) {
    if (!user) return false;
    const normalized = code.trim().toUpperCase();
    if (!normalized.startsWith('ATIVUS-') || normalized.length < 13) {
      showToast('error', '❌ Formato inválido. Ex: ATIVUS-AB12CD');
      return false;
    }
    try {
      // 1. Lê accessCodes (coleção pública para logados) → obtém projectId
      const codeSnap = await getDoc(doc(db, 'accessCodes', normalized));
      if (!codeSnap.exists()) {
        showToast('error', '❌ Código não encontrado. Verifique e tente novamente.');
        return false;
      }
      const { projectId, projectName } = codeSnap.data();

      // 2. Vai direto pro updateDoc — NÃO tenta ler o projeto antes
      //    (a rule bloqueia leitura para não-membros)
      //    arrayUnion é idempotente: se já for membro, não faz nada
      await updateDoc(doc(db, 'projects', projectId), {
        members: arrayUnion(user.uid),
        updatedAt: serverTimestamp(),
      });

      showToast('success', `✅ Você entrou em "${projectName}"!`);
      return true;
    } catch (err) {
      console.error('[Ativus] joinProject erro:', err.code, err.message);
      if (err.code === 'permission-denied') {
        showToast('error', '❌ Permissão negada. Verifique as regras do Firestore.');
      } else {
        showToast('error', '❌ Erro ao entrar no projeto. Tente novamente.');
      }
      return false;
    }
  }

  // ── Deletar projeto ────────────────────────────────────
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

  // ── Sair do projeto ────────────────────────────────────
  async function leaveProject(projectId) {
    if (!user) return;
    try {
      const ref = doc(db, 'projects', projectId);
      const snap = await getDoc(ref);
      const data = snap.data();
      const newMembers = (data.members || []).filter(m => m !== user.uid);
      await updateDoc(ref, { members: newMembers, updatedAt: serverTimestamp() });
      if (activeProject?.id === projectId) { setActiveProject(null); setView('list'); }
      showToast('success', '👋 Você saiu do projeto.');
    } catch (err) {
      console.error(err);
      showToast('error', '❌ Erro ao sair do projeto.');
    }
  }

  // ── CRUD tarefas do projeto ────────────────────────────
  async function addProjectTask(data) {
    if (!user || !activeProject) return;
    try {
      await addDoc(collection(db, 'projects', activeProject.id, 'tasks'), {
        ...data,
        authorId: user.uid,
        authorName: user.displayName || user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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
        status: newStatus, updatedAt: serverTimestamp(),
      });
    } catch (err) { console.error(err); }
  }

  async function deleteProjectTask(taskId) {
    if (!user || !activeProject) return;
    try {
      await deleteDoc(doc(db, 'projects', activeProject.id, 'tasks', taskId));
      if (selectedTask?.id === taskId) setSelectedTask(null);
      showToast('error', '🗑️ Tarefa removida.');
    } catch (err) { console.error(err); }
  }

  function openProject(project) { setActiveProject(project); setView('detail'); }
  function backToList() { setActiveProject(null); setView('list'); setSelectedTask(null); }

  if (loading || !user) return (
    <div className={styles.centered}><div className={styles.spinner} /></div>
  );

  const total = projectTasks.length;
  const concluded = projectTasks.filter(t => t.status === 'concluida').length;
  const progress = total > 0 ? Math.round((concluded / total) * 100) : 0;

  return (
    <div className={styles.page}>

      {/* ── LISTA DE PROJETOS ── */}
      {view === 'list' && (
        <div>
          <div className={styles.pageHero}>
            <div className={styles.pageHeroContent}>
              <div className={styles.pageHeroBadge}>
                <span className={styles.heroBadgeDot} />
                Seus espaços de trabalho
              </div>
              <h1 className={styles.pageTitle}>Projetos</h1>
              <p className={styles.pageSub}>
                Colabore em tempo real. Crie projetos e compartilhe o código de acesso.
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

          {!dbLoading && projects.length > 0 && (
            <div className={styles.statsBar}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{projects.length}</span>
                <span className={styles.statLabel}>Projeto{projects.length > 1 ? 's' : ''}</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.statItem}>
                <span className={styles.statValue}>{projects.filter(p => p.ownerId === user.uid).length}</span>
                <span className={styles.statLabel}>Como dono</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.statItem}>
                <span className={styles.statValue}>{projects.filter(p => p.ownerId !== user.uid).length}</span>
                <span className={styles.statLabel}>Participando</span>
              </div>
            </div>
          )}

          {dbLoading ? (
            <div className={styles.projectsGrid}>
              {[1, 2, 3].map(i => <div key={i} className={styles.cardSkeleton} />)}
            </div>
          ) : projects.length === 0 ? (
            <EmptyProjects onCreate={() => setModal('create')} onJoin={() => setModal('join')} styles={styles} />
          ) : (
            <div className={styles.projectsGrid}>
              {projects.map(p => (
                <ProjectCard key={p.id} project={p} userId={user.uid}
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
          <div className={styles.detailHero}>
            <button className={styles.backBtn} onClick={backToList}>← Projetos</button>
            <div className={styles.detailTitleRow}>
              <div className={styles.projectIconLg}>{activeProject.icon}</div>
              <div className={styles.detailTitleInfo}>
                <h1 className={styles.pageTitle}>{activeProject.name}</h1>
                {activeProject.description && <p className={styles.pageSub}>{activeProject.description}</p>}
                <div className={styles.detailOwner}>Criado por <strong>{activeProject.ownerName}</strong></div>
              </div>
            </div>

            <div className={styles.accessCodeCard}>
              <div className={styles.accessCodeCardLeft}>
                <span className={styles.accessCodeCardIcon}>🔑</span>
                <div>
                  <p className={styles.accessCodeCardLabel}>Código de acesso</p>
                  <p className={styles.accessCodeCardDesc}>Compartilhe com sua equipe para colaborar</p>
                </div>
              </div>
              <div className={styles.accessCodeCardRight}>
                <span className={styles.accessCodeValue}>{activeProject.accessCode}</span>
                <button className={styles.copyBtnFull}
                  onClick={() => { navigator.clipboard.writeText(activeProject.accessCode); showToast('success', '📋 Código copiado!'); }}>
                  Copiar
                </button>
              </div>
            </div>

            <div className={styles.detailStats}>
              {[
                ['Tarefas', total, 'var(--text)'],
                ['Concluídas', concluded, 'var(--green-dark)'],
                ['Em andamento', projectTasks.filter(t => t.status === 'andamento').length, 'var(--blue)'],
                ['Membros', activeProject.members?.length || 1, 'var(--text)'],
              ].map(([label, value, color]) => (
                <div key={label} className={styles.detailStatCard}>
                  <span className={styles.detailStatNum} style={{ color }}>{value}</span>
                  <span className={styles.detailStatLabel}>{label}</span>
                </div>
              ))}
              <div className={styles.detailStatCard}>
                <div className={styles.progressRing}>
                  <svg viewBox="0 0 36 36" className={styles.progressRingSvg}>
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--blue)"
                      strokeWidth="3"
                      strokeDasharray={`${progress} ${100 - progress}`}
                      strokeDashoffset="25" strokeLinecap="round" />
                  </svg>
                  <span className={styles.progressRingLabel}>{progress}%</span>
                </div>
                <span className={styles.detailStatLabel}>Progresso</span>
              </div>
            </div>
          </div>

          <div className={styles.tasksCard}>
            <div className={styles.tasksCardHeader}>
              <div>
                <h3 className={styles.cardTitle}>Tarefas do projeto</h3>
                {projectTasks.length > 0 && <p className={styles.cardSub}>{total} tarefa{total > 1 ? 's' : ''} · clique para detalhes</p>}
              </div>
              <button className={styles.btnPrimary} onClick={() => setModal('newTask')}>+ Nova tarefa</button>
            </div>

            {tasksLoading ? (
              <div className={styles.taskList}>{[1, 2, 3].map(i => <div key={i} className={styles.taskSkeleton} />)}</div>
            ) : projectTasks.length === 0 ? (
              <div className={styles.taskEmptyState}>
                <div className={styles.taskEmptyIcon}>📋</div>
                <h4 className={styles.taskEmptyTitle}>Nenhuma tarefa ainda</h4>
                <p className={styles.taskEmptyDesc}>Adicione a primeira tarefa e comece a colaborar.</p>
                <button className={styles.btnPrimary} onClick={() => setModal('newTask')}>+ Criar primeira tarefa</button>
              </div>
            ) : (
              <div className={styles.taskList}>
                {projectTasks.map(task => (
                  <div key={task.id} className={styles.taskItem} onClick={() => setSelectedTask(task)}>
                    <button
                      className={`${styles.taskCheck} ${task.status === 'concluida' ? styles.checkDone : task.status === 'andamento' ? styles.checkProg : ''}`}
                      onClick={e => { e.stopPropagation(); toggleProjectTask(task.id, task.status); }}
                    >{task.status === 'concluida' ? '✓' : ''}</button>
                    <div className={styles.taskMain}>
                      <p className={`${styles.taskName} ${task.status === 'concluida' ? styles.taskDone : ''}`}>{task.title}</p>
                      <p className={styles.taskMeta}>
                        👤 {task.authorName}
                        {task.due && ` · 📅 ${new Date(task.due + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                        {task.priority && task.priority !== 'normal' && ` · ${task.priority === 'urgente' ? '🔴' : '🟡'} ${task.priority}`}
                        {task.description && <span style={{ color: 'var(--text-3)' }}> · 📝</span>}
                      </p>
                    </div>
                    <span className={`${styles.taskBadge} ${styles[STATUS_CLASS[task.status]]}`}>{STATUS_LABEL[task.status]}</span>
                    <button className={styles.taskDelete} onClick={e => { e.stopPropagation(); deleteProjectTask(task.id); }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAIS ── */}
      {modal === 'create' && <CreateProjectModal onClose={() => setModal(null)} onSave={async d => { const r = await createProject(d); if (r) setModal(null); }} styles={styles} />}
      {modal === 'join' && <JoinProjectModal onClose={() => setModal(null)} onJoin={async c => { const ok = await joinProject(c); if (ok) setModal(null); }} styles={styles} />}
      {modal === 'newTask' && <NewTaskModal onClose={() => setModal(null)} onSave={async d => { await addProjectTask(d); setModal(null); }} styles={styles} />}

      {selectedTask && (
        <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)}
          onToggle={toggleProjectTask}
          onDelete={id => { deleteProjectTask(id); setSelectedTask(null); }}
          styles={styles}
        />
      )}

      {toast.visible && <div className={`${styles.toast} ${styles[toast.type]}`}>{toast.message}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  SUB-COMPONENTES
// ─────────────────────────────────────────────────────────

function EmptyProjects({ onCreate, onJoin, styles }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIllustration}>
        <div className={styles.emptyCard} style={{ transform: 'rotate(-6deg) translateY(8px)', opacity: .4 }}>
          <div className={styles.emptyCardDot} style={{ background: '#FACC15' }} />
          <div className={styles.emptyCardLines}><div /><div /></div>
        </div>
        <div className={styles.emptyCard} style={{ transform: 'rotate(3deg) translateY(4px)', opacity: .65 }}>
          <div className={styles.emptyCardDot} style={{ background: '#22C55E' }} />
          <div className={styles.emptyCardLines}><div /><div /></div>
        </div>
        <div className={styles.emptyCard}>
          <div className={styles.emptyCardDot} style={{ background: '#2563EB' }} />
          <div className={styles.emptyCardLines}><div /><div style={{ width: '60%' }} /></div>
        </div>
        <div className={styles.emptyPlusIcon}>+</div>
      </div>
      <h3 className={styles.emptyTitle}>Nenhum projeto ainda</h3>
      <p className={styles.emptyDesc}>Crie seu primeiro projeto e convide seu time com o código de acesso — ou entre em um projeto existente.</p>
      <div className={styles.emptyCards}>
        <button className={styles.emptyActionCard} onClick={onCreate}>
          <div className={styles.emptyActionIcon} style={{ background: '#EFF6FF' }}>🚀</div>
          <div className={styles.emptyActionInfo}><strong>Criar projeto</strong><span>Comece do zero e convide seu time</span></div>
          <span className={styles.emptyActionArrow}>→</span>
        </button>
        <button className={styles.emptyActionCard} onClick={onJoin}>
          <div className={styles.emptyActionIcon} style={{ background: '#F0FDF4' }}>🔑</div>
          <div className={styles.emptyActionInfo}><strong>Entrar com código</strong><span>Acesse um projeto que você foi convidado</span></div>
          <span className={styles.emptyActionArrow}>→</span>
        </button>
      </div>
    </div>
  );
}

function ProjectCard({ project, userId, onOpen, onDelete, onLeave, styles }) {
  const isOwner = project.ownerId === userId;
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={styles.projectCard} onClick={onOpen}>
      <div className={styles.projectCardAccent} />
      <div className={styles.projectCardHeader}>
        <div className={styles.projectIconWrap}><span className={styles.projectIcon}>{project.icon}</span></div>
        <div className={styles.projectCardMenu} onBlur={() => setTimeout(() => setMenuOpen(false), 150)}>
          <button className={styles.menuTrigger} onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }}>···</button>
          {menuOpen && (
            <div className={styles.menuDropdown} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setMenuOpen(false); navigator.clipboard.writeText(project.accessCode); }}>📋 Copiar código</button>
              {isOwner
                ? <button className={styles.menuDanger} onClick={() => { setMenuOpen(false); onDelete(); }}>🗑️ Deletar projeto</button>
                : <button className={styles.menuDanger} onClick={() => { setMenuOpen(false); onLeave(); }}>👋 Sair do projeto</button>
              }
            </div>
          )}
        </div>
      </div>
      <h4 className={styles.projectCardName}>{project.name}</h4>
      {project.description
        ? <p className={styles.projectCardDesc}>{project.description}</p>
        : <p className={styles.projectCardDescEmpty}>Sem descrição</p>
      }
      <div className={styles.projectCardFooter}>
        <div className={styles.projectCardMeta}>
          <span className={styles.metaChip}>👥 {project.members?.length || 1}</span>
          <span className={`${styles.metaChip} ${styles.codeChip}`}>{project.accessCode}</span>
        </div>
        {isOwner ? <span className={styles.ownerBadge}>Dono</span> : <span className={styles.memberBadge}>Membro</span>}
      </div>
    </div>
  );
}

function CreateProjectModal({ onClose, onSave, styles }) {
  const [saving, setSaving] = useState(false);
  const [icon, setIcon] = useState('🚀');
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
            <input name="name" type="text" className={styles.mInput} placeholder="Ex: Lançamento do produto" required autoFocus />
          </div>
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Descrição <span className={styles.mLabelOptional}>(opcional)</span></label>
            <textarea name="description" className={`${styles.mInput} ${styles.mTextarea}`} placeholder="Objetivo e contexto do projeto..." rows={3} />
          </div>
          <div className={styles.accessCodeInfo}>🔑 Um código de acesso será gerado automaticamente.</div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnSave} disabled={saving}>{saving ? 'Criando...' : '+ Criar projeto'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JoinProjectModal({ onClose, onJoin, styles }) {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const val = code.trim().toUpperCase();
    if (!val) return;
    // Validação visual antes de ir ao Firestore
    if (!val.startsWith('ATIVUS-') || val.length !== 13) {
      setError('Formato inválido. O código deve ser: ATIVUS-XXXXXX (6 caracteres após o hífen)');
      return;
    }
    setJoining(true);
    await onJoin(val);
    setJoining(false);
  }

  // Formata automaticamente enquanto digita
  function handleChange(e) {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    // Auto-adiciona "ATIVUS-" se o usuário começar a digitar sem ele
    if (val.length > 0 && !val.startsWith('A')) val = 'ATIVUS-' + val.replace(/^ATIVUS-?/, '');
    if (val.length > 13) val = val.slice(0, 13);
    setCode(val);
    setError('');
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
            <p>Peça o código de acesso ao dono do projeto e cole abaixo para entrar e colaborar em tempo real.</p>
          </div>
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Código de acesso *</label>
            <input
              type="text" className={`${styles.mInput} ${styles.codeInput} ${error ? styles.inputError : ''}`}
              placeholder="ATIVUS-XXXXXX"
              value={code} onChange={handleChange}
              required autoFocus maxLength={13}
            />
            {error
              ? <p className={styles.inputErrorMsg}>⚠️ {error}</p>
              : <p className={styles.inputHint}>Formato: ATIVUS- seguido de 6 caracteres (ex: ATIVUS-AB12CD)</p>
            }
          </div>
          {/* Preview do código formatado */}
          {code.length > 0 && (
            <div className={styles.codePreview}>
              <span className={styles.codePreviewLabel}>Código:</span>
              <span className={styles.codePreviewValue}>{code}</span>
              {code.length === 13 && <span className={styles.codePreviewOk}>✓</span>}
            </div>
          )}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnSave} disabled={joining || code.length !== 13}>
              {joining ? '🔍 Buscando...' : '🔑 Entrar no projeto'}
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
    const data = { title: fd.get('title').trim(), description: fd.get('description').trim(), status: fd.get('status'), priority: fd.get('priority'), due: fd.get('due') };
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
            <input name="title" type="text" className={styles.mInput} placeholder="Ex: Criar landing page" required autoFocus />
          </div>
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Descrição <span className={styles.mLabelOptional}>(opcional)</span></label>
            <textarea name="description" className={`${styles.mInput} ${styles.mTextarea}`} placeholder="Detalhes da tarefa..." rows={3} />
          </div>
          <div className={styles.mFormRow}>
            <div className={styles.mFormGroup}>
              <label className={styles.mLabel}>Status</label>
              <select name="status" className={styles.mInput}><option value="pendente">Pendente</option><option value="andamento">Em andamento</option></select>
            </div>
            <div className={styles.mFormGroup}>
              <label className={styles.mLabel}>Prioridade</label>
              <select name="priority" className={styles.mInput}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select>
            </div>
          </div>
          <div className={styles.mFormGroup}>
            <label className={styles.mLabel}>Prazo</label>
            <input name="due" type="date" className={styles.mInput} />
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnSave} disabled={saving}>{saving ? 'Salvando...' : '+ Criar tarefa'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskDetailPanel({ task, onClose, onToggle, onDelete, styles }) {
  const formattedDate = task.due ? new Date(task.due + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
  return (
    <>
      <div className={styles.detailBackdrop} onClick={onClose} />
      <div className={styles.detailPanel}>
        <div className={styles.detailPanelHeader}>
          <span className={`${styles.taskBadge} ${styles[STATUS_CLASS[task.status]]}`}>{STATUS_LABEL[task.status]}</span>
          <button className={styles.detailClose} onClick={onClose}>✕</button>
        </div>
        <h2 className={`${styles.detailTitle} ${task.status === 'concluida' ? styles.taskDone : ''}`}>{task.title}</h2>
        <div className={styles.detailMeta}>
          {task.authorName && <div className={styles.detailMetaItem}><span className={styles.detailMetaIcon}>👤</span><span>{task.authorName}</span></div>}
          {formattedDate && <div className={styles.detailMetaItem}><span className={styles.detailMetaIcon}>📅</span><span>{formattedDate}</span></div>}
          {task.priority && <div className={styles.detailMetaItem}><span className={styles.detailMetaIcon}>{task.priority === 'urgente' ? '🔴' : task.priority === 'alta' ? '🟡' : '🟢'}</span><span style={{ textTransform: 'capitalize' }}>{task.priority}</span></div>}
        </div>
        <div className={styles.detailSection}>
          <p className={styles.detailSectionLabel}>Descrição</p>
          {task.description ? <p className={styles.detailDescription}>{task.description}</p> : <p className={styles.detailDescriptionEmpty}>Nenhuma descrição adicionada.</p>}
        </div>
        <div className={styles.detailActions}>
          <button className={styles.detailBtnToggle} onClick={() => onToggle(task.id, task.status)}>{task.status === 'concluida' ? '↩ Reabrir' : '✓ Avançar status'}</button>
          <button className={styles.detailBtnDelete} onClick={() => onDelete(task.id)}>🗑️ Remover</button>
        </div>
      </div>
    </>
  );
}
