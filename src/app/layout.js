// src/app/dashboard/layout.js
// Este layout envolve TODAS as rotas dentro de /dashboard:
//   /dashboard          → page.js
//   /dashboard/projetos → projetos/page.js
// A sidebar e topbar ficam aqui, não em cada página.

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { auth, signOut } from '@/lib/firebase';
import styles from './layout.module.css';

const NAV_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',    icon: '⊞', href: '/dashboard' },
  { id: 'tarefas',       label: 'Tarefas',       icon: '✓', href: '/dashboard#tarefas' },
  { id: 'projetos',      label: 'Projetos',      icon: '📁', href: '/dashboard/projetos' },
  { id: 'calendario',    label: 'Calendário',    icon: '📅', href: '/dashboard#calendario' },
  { id: 'equipe',        label: 'Equipe',        icon: '👥', href: '/dashboard#equipe' },
  { id: 'relatorios',    label: 'Relatórios',    icon: '📊', href: '/dashboard#relatorios' },
  { id: 'notificacoes',  label: 'Notificações',  icon: '🔔', href: '/dashboard#notificacoes' },
  { id: 'configuracoes', label: 'Configurações', icon: '⚙️', href: '/dashboard#configuracoes' },
];

export default function DashboardLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const [sidebarOpen, setSidebar] = useState(false);

  // Auth guard — se não logado, redireciona
  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  async function handleLogout() {
    try { await signOut(auth); router.push('/'); } catch {}
  }

  if (loading || !user) return (
    <div className={styles.centered}><div className={styles.spinner}/></div>
  );

  const name     = user.displayName || user.email.split('@')[0];
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  // Detecta qual item está ativo pela rota atual
  function isActive(item) {
    if (item.href === '/dashboard/projetos') return pathname === '/dashboard/projetos';
    if (item.href === '/dashboard') return pathname === '/dashboard';
    return false;
  }

  function handleNavClick(item) {
    setSidebar(false);
    if (item.href.startsWith('/dashboard/')) {
      router.push(item.href);
    } else if (item.href.includes('#')) {
      // Para itens que ainda usam hash no dashboard principal
      const hash = item.href.split('#')[1];
      if (pathname !== '/dashboard') {
        router.push(`/dashboard?page=${hash}`);
      } else {
        // Dispara evento customizado para o dashboard page.js ouvir
        window.dispatchEvent(new CustomEvent('ativus:navigate', { detail: hash }));
      }
    } else {
      router.push(item.href);
    }
  }

  return (
    <div className={styles.layout}>
      {/* ── SIDEBAR ── */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <a href="/" className={styles.sidebarLogo}>
            <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="#1E3A8A"/>
              <path d="M18 7L9 24H13L18 14L23 24H27L18 7Z" fill="#fff"/>
              <path d="M12 20C12 20 15 22 18 22C21 22 24 20 24 20"
                    stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"/>
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
              className={`${styles.navItem} ${isActive(item) ? styles.navItemActive : ''}`}
              onClick={() => handleNavClick(item)}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div className={styles.navSectionLabel} style={{ marginTop: 12 }}>Time</div>
          {NAV_ITEMS.slice(4, 6).map(item => (
            <button key={item.id}
              className={`${styles.navItem} ${isActive(item) ? styles.navItemActive : ''}`}
              onClick={() => handleNavClick(item)}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div className={styles.navSectionLabel} style={{ marginTop: 12 }}>Sistema</div>
          {NAV_ITEMS.slice(6).map(item => (
            <button key={item.id}
              className={`${styles.navItem} ${isActive(item) ? styles.navItemActive : ''}`}
              onClick={() => handleNavClick(item)}>
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
      <div className={styles.mainWrapper}>
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

        {/* Conteúdo da página renderizado aqui */}
        <main className={styles.pageContent}>
          {children}
        </main>
      </div>
    </div>
  );
}
