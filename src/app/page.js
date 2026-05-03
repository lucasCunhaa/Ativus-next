// src/app/page.js  →  rota: /
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
  auth, db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup,
  googleProvider,
  githubProvider,
  doc, setDoc, serverTimestamp,
} from '@/lib/firebase';
import styles from './page.module.css';

// ── Logo SVG ──────────────────────────────────────────────
function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="10" fill="#1E3A8A"/>
      <path d="M18 7L9 24H13L18 14L23 24H27L18 7Z" fill="#FFFFFF"/>
      <path d="M12 20C12 20 15 22 18 22C21 22 24 20 24 20"
            stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="11" cy="26" r="2.5" fill="#22C55E"/>
    </svg>
  );
}

// ── Toast ─────────────────────────────────────────────────
function Toast({ message, type, visible }) {
  if (!visible) return null;
  const bg = type === 'success' ? '#16A34A' : type === 'error' ? '#DC2626' : '#0F172A';
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 999,
      background: bg, color: '#fff',
      padding: '12px 20px', borderRadius: 12,
      fontSize: '.875rem', fontWeight: 500,
      boxShadow: '0 8px 30px rgba(0,0,0,.2)',
      animation: 'slideUp .35s ease',
      maxWidth: 340,
    }}>
      {message}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────
export default function HomePage() {
  const router        = useRouter();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState('login');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const [busy, setBusy]   = useState(false);

  // Se já logado, vai pro dashboard
  useEffect(() => {
    if (!loading && user) router.push('/dashboard');
  }, [user, loading, router]);

  function showToast(type, message) {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 4000);
  }

  function getErrorMsg(code) {
    const msgs = {
      'auth/email-already-in-use':   'Este email já está cadastrado.',
      'auth/weak-password':          'Senha muito fraca. Use ao menos 6 caracteres.',
      'auth/invalid-email':          'Email inválido.',
      'auth/user-not-found':         'Email não encontrado.',
      'auth/wrong-password':         'Senha incorreta.',
      'auth/invalid-credential':     'Email ou senha incorretos.',
      'auth/too-many-requests':      'Muitas tentativas. Aguarde.',
      'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
    };
    return msgs[code] || 'Erro inesperado. Tente novamente.';
  }

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    const email = e.target.email.value;
    const senha = e.target.senha.value;
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      router.push('/dashboard');
    } catch (err) {
      showToast('error', '❌ ' + getErrorMsg(err.code));
    } finally {
      setBusy(false);
    }
  }

  async function handleCadastro(e) {
    e.preventDefault();
    setBusy(true);
    const nome  = e.target.nome.value.trim();
    const sobrenome = e.target.sobrenome.value.trim();
    const email = e.target.email.value.trim();
    const senha = e.target.senha.value;
    const fullName = `${nome} ${sobrenome}`.trim();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      await updateProfile(cred.user, { displayName: fullName });
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid, name: fullName, email,
        plan: 'free', createdAt: serverTimestamp(),
      });
      router.push('/dashboard');
    } catch (err) {
      showToast('error', '❌ ' + getErrorMsg(err.code));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('login-email')?.value?.trim();
    if (!email) return showToast('error', '📧 Digite seu email primeiro.');
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('success', '📬 Email de recuperação enviado!');
    } catch (err) {
      showToast('error', '❌ ' + getErrorMsg(err.code));
    }
  }

  async function handleSocial(provider) {
    try {
      await signInWithPopup(auth, provider);
      router.push('/dashboard');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user')
        showToast('error', '❌ ' + getErrorMsg(err.code));
    }
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ width:32, height:32, border:'3px solid #DBEAFE', borderTopColor:'#2563EB', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
    </div>
  );

  return (
    <div className={styles.page}>

      {/* ── NAVBAR ── */}
      <nav className={styles.nav}>
        <a href="/" className={styles.navLogo}>
          <Logo size={34}/>
          <span className={styles.navLogoText}>ativus</span>
        </a>
        <ul className={styles.navLinks}>
          <li><a href="#features">Recursos</a></li>
          <li><a href="#how">Como funciona</a></li>
          <li><a href="#pricing">Planos</a></li>
        </ul>
        <div className={styles.navCta}>
          <button className={styles.btnOutline} onClick={() => { setTab('login'); document.getElementById('auth')?.scrollIntoView({ behavior:'smooth' }); }}>Entrar</button>
          <button className={styles.btnPrimary} onClick={() => { setTab('cadastro'); document.getElementById('auth')?.scrollIntoView({ behavior:'smooth' }); }}>Começar grátis</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}><span className={styles.heroDot}/> Novo: Projetos colaborativos em tempo real</div>
          <h1 className={styles.heroTitle}>
            Organize suas tarefas.<br/>
            <span className={styles.accentBlue}>Planeje</span> seus projetos.<br/>
            <span className={styles.accentGreen}>Realize</span> seus objetivos.
          </h1>
          <p className={styles.heroSub}>O Ativus é a plataforma completa de gestão de tarefas e projetos que transforma sua rotina em resultados. Simples, inteligente e feita para quem quer crescer.</p>
          <div className={styles.heroActions}>
            <button className={`${styles.btnPrimary} ${styles.btnLg}`} onClick={() => { setTab('cadastro'); document.getElementById('auth')?.scrollIntoView({ behavior:'smooth' }); }}>Criar conta grátis</button>
            <a href="#how" className={`${styles.btnOutline} ${styles.btnLg}`}>Ver como funciona</a>
          </div>
          <div className={styles.heroStats}>
            {[['+ 12k','Usuários ativos'],['98%','Satisfação'],['3x','Mais produtividade']].map(([n,l]) => (
              <div key={l}><div className={styles.statNum}>{n}</div><div className={styles.statLabel}>{l}</div></div>
            ))}
          </div>
        </div>

        {/* Mockup */}
        <div className={styles.heroVisual}>
          <div className={styles.mockupWindow}>
            <div className={styles.mockupBar}>
              <span style={{width:12,height:12,borderRadius:'50%',background:'#FF5F57',display:'block'}}/>
              <span style={{width:12,height:12,borderRadius:'50%',background:'#FEBC2E',display:'block'}}/>
              <span style={{width:12,height:12,borderRadius:'50%',background:'#28C840',display:'block'}}/>
              <span style={{marginLeft:'auto',fontSize:'.72rem',color:'rgba(255,255,255,.6)'}}>ativus.app/dashboard</span>
            </div>
            <div className={styles.mockupBody}>
              <p style={{fontFamily:'var(--font-poppins)',fontWeight:700,fontSize:'.9rem',marginBottom:12}}>Olá, João! 👋</p>
              <div className={styles.mockStats}>
                {[['18','Em andamento','var(--blue)'],['32','Concluídas','var(--green)'],['5','Pendentes','var(--yellow)'],['2','Atrasadas','var(--red)']].map(([n,l,c])=>(
                  <div key={l} className={styles.mockStat}><span style={{color:c,fontFamily:'var(--font-poppins)',fontWeight:800,fontSize:'1.2rem'}}>{n}</span><span style={{fontSize:'.65rem',color:'var(--text-2)',marginTop:2}}>{l}</span></div>
                ))}
              </div>
              {[['Reunião com cliente','concluida'],['Atualizar API Backend','andamento'],['Enviar relatório mensal','pendente'],['Aprovação Marketing','atrasada']].map(([t,s])=>(
                <div key={t} className={styles.mockTask}>
                  <div className={`${styles.mockCheck} ${styles['s_'+s]}`}>{s==='concluida'?'✓':''}</div>
                  <span style={{flex:1,fontSize:'.78rem',fontWeight:500,textDecoration:s==='concluida'?'line-through':'none',color:s==='concluida'?'var(--text-3)':'var(--text)'}}>{t}</span>
                  <span className={`${styles.tag} ${styles['tag_'+s]}`}>{{'concluida':'Concluída','andamento':'Em andamento','pendente':'Pendente','atrasada':'Atrasada'}[s]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className={styles.section} id="features">
        <div className={styles.sectionTag}>Recursos</div>
        <h2 className={styles.sectionTitle}>Tudo que você precisa<br/>em um só lugar</h2>
        <p className={styles.sectionSub}>Ferramentas poderosas e intuitivas para você e seu time organizarem, priorizarem e entregarem mais.</p>
        <div className={styles.featuresGrid}>
          {[
            ['✅','fi-blue','Checklist Inteligente','Crie e organize tarefas com subtarefas, prioridades e prazos.'],
            ['📁','fi-green','Gestão de Projetos','Organize projetos em kanban, lista ou calendário.'],
            ['👥','fi-purple','Trabalho em Equipe','Convide colaboradores e acompanhe o time em tempo real.'],
            ['📅','fi-yellow','Calendário Integrado','Sincronize com Google Calendar e Outlook.'],
            ['📊','fi-teal','Relatórios e Analytics','Métricas de produtividade com gráficos exportáveis.'],
            ['🔔','fi-red','Notificações Inteligentes','Alertas por email, push e Slack configuráveis.'],
          ].map(([icon, cls, title, desc]) => (
            <div key={title} className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles[cls]}`}>{icon}</div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className={styles.howBg} id="how">
        <div className={styles.sectionTag} style={{background:'rgba(255,255,255,.15)',color:'#fff'}}>Como funciona</div>
        <h2 className={styles.sectionTitle} style={{color:'#fff'}}>Comece a produzir em menos de 5 minutos</h2>
        <p className={styles.sectionSub} style={{color:'rgba(255,255,255,.7)'}}>Sem curva de aprendizado.</p>
        <div className={styles.steps}>
          {[['1','Crie sua conta','Cadastre-se gratuitamente em segundos. Sem cartão de crédito.'],['2','Monte seu projeto','Crie projetos e convide seu time.'],['3','Organize com checklists','Defina prioridades, prazos e responsáveis.'],['4','Acompanhe e realize','Monitore o progresso em tempo real.']].map(([n,t,d])=>(
            <div key={n} className={styles.step}>
              <div className={styles.stepNum}>{n}</div>
              <h3>{t}</h3><p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className={styles.section} id="pricing" style={{textAlign:'center'}}>
        <div className={styles.sectionTag}>Planos</div>
        <h2 className={styles.sectionTitle}>Comece grátis, cresça no seu ritmo</h2>
        <div className={styles.pricingGrid}>
          <div className={styles.pricingCard}>
            <div className={styles.pricingTier}>Gratuito</div>
            <div className={styles.pricingPrice}>R$0<small>/mês</small></div>
            <ul className={styles.pricingFeatures}>{['Até 3 projetos','100 tarefas por projeto','1 usuário','Checklists e subtarefas'].map(f=><li key={f}><span className={styles.check}>✓</span>{f}</li>)}</ul>
            <button className={`${styles.btnOutline} ${styles.btnFull}`} onClick={()=>{setTab('cadastro');document.getElementById('auth')?.scrollIntoView({behavior:'smooth'})}}>Criar conta grátis</button>
          </div>
          <div className={`${styles.pricingCard} ${styles.featured}`}>
            <div className={styles.pricingBadge}>⭐ Mais popular</div>
            <div className={styles.pricingTier}>Pro</div>
            <div className={styles.pricingPrice}><sup>R$</sup>39<small>/mês</small></div>
            <ul className={styles.pricingFeatures}>{['Projetos ilimitados','Tarefas ilimitadas','Até 5 colaboradores','Relatórios avançados','Suporte prioritário'].map(f=><li key={f}><span className={styles.check}>✓</span>{f}</li>)}</ul>
            <button className={`${styles.btnPrimary} ${styles.btnFull}`} onClick={()=>{setTab('cadastro');document.getElementById('auth')?.scrollIntoView({behavior:'smooth'})}}>Começar Pro</button>
          </div>
          <div className={styles.pricingCard}>
            <div className={styles.pricingTier}>Times</div>
            <div className={styles.pricingPrice}><sup>R$</sup>99<small>/mês</small></div>
            <ul className={styles.pricingFeatures}>{['Tudo do Pro','Colaboradores ilimitados','Permissões avançadas','API de integração','SLA garantido'].map(f=><li key={f}><span className={styles.check}>✓</span>{f}</li>)}</ul>
            <button className={`${styles.btnOutline} ${styles.btnFull}`}>Falar com vendas</button>
          </div>
        </div>
      </section>

      {/* ── AUTH ── */}
      <section className={styles.authSection} id="auth">
        <div className={styles.authWrapper}>
          <div className={styles.authInfo}>
            <div className={styles.sectionTag} style={{background:'rgba(255,255,255,.15)',color:'#fff'}}>Acesso</div>
            <h2 className={styles.sectionTitle} style={{color:'#fff'}}>Entre ou crie<br/>sua conta grátis</h2>
            <ul className={styles.authPerks}>
              {[['✅','Conta grátis para sempre — sem cartão'],['🔒','Dados criptografados e seguros com Firebase'],['📱','Acesso em qualquer dispositivo'],['🚀','Configure em menos de 2 minutos']].map(([i,t])=>(
                <li key={t}><div className={styles.perkIcon}>{i}</div>{t}</li>
              ))}
            </ul>
          </div>

          <div className={styles.authCard}>
            {/* Tabs */}
            <div className={styles.authTabs}>
              <button className={`${styles.authTab} ${tab==='login'?styles.authTabActive:''}`} onClick={()=>setTab('login')}>Entrar</button>
              <button className={`${styles.authTab} ${tab==='cadastro'?styles.authTabActive:''}`} onClick={()=>setTab('cadastro')}>Cadastrar</button>
            </div>

            {/* Login */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className={styles.authForm}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Email</label>
                  <input id="login-email" name="email" type="email" className={styles.formInput} placeholder="seu@email.com" required/>
                </div>
                <div className={styles.formGroup}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                    <label className={styles.formLabel} style={{margin:0}}>Senha</label>
                    <button type="button" className={styles.forgotLink} onClick={handleForgotPassword}>Esqueceu a senha?</button>
                  </div>
                  <input name="senha" type="password" className={styles.formInput} placeholder="Sua senha" required/>
                </div>
                <button type="submit" className={`${styles.btnPrimary} ${styles.btnFull}`} disabled={busy}>
                  {busy ? 'Entrando...' : 'Entrar na minha conta'}
                </button>
                <div className={styles.divider}>ou continue com</div>
                <div className={styles.socialBtns}>
                  <button type="button" className={styles.btnSocial} onClick={()=>handleSocial(googleProvider)}>
                    <GoogleIcon/> Google
                  </button>
                  <button type="button" className={styles.btnSocial} onClick={()=>handleSocial(githubProvider)}>
                    <GithubIcon/> GitHub
                  </button>
                </div>
                <p className={styles.authFooterTxt}>Não tem conta? <button type="button" className={styles.linkBtn} onClick={()=>setTab('cadastro')}>Criar agora — é grátis</button></p>
              </form>
            )}

            {/* Cadastro */}
            {tab === 'cadastro' && (
              <form onSubmit={handleCadastro} className={styles.authForm}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nome</label>
                    <input name="nome" type="text" className={styles.formInput} placeholder="João" required/>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Sobrenome</label>
                    <input name="sobrenome" type="text" className={styles.formInput} placeholder="Silva"/>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Email</label>
                  <input name="email" type="email" className={styles.formInput} placeholder="seu@email.com" required/>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Senha</label>
                  <input name="senha" type="password" className={styles.formInput} placeholder="Mínimo 8 caracteres" required minLength={8}/>
                </div>
                <div className={styles.formCheck}>
                  <input type="checkbox" id="terms" required/>
                  <label htmlFor="terms">Concordo com os <a href="#" className={styles.link}>Termos de Uso</a></label>
                </div>
                <button type="submit" className={`${styles.btnGreen} ${styles.btnFull}`} disabled={busy}>
                  {busy ? 'Criando conta...' : '🚀 Criar minha conta grátis'}
                </button>
                <div className={styles.divider}>ou cadastre com</div>
                <div className={styles.socialBtns}>
                  <button type="button" className={styles.btnSocial} onClick={()=>handleSocial(googleProvider)}><GoogleIcon/> Google</button>
                  <button type="button" className={styles.btnSocial} onClick={()=>handleSocial(githubProvider)}><GithubIcon/> GitHub</button>
                </div>
                <p className={styles.authFooterTxt}>Já tem conta? <button type="button" className={styles.linkBtn} onClick={()=>setTab('login')}>Fazer login</button></p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div>
            <div className={styles.footerLogo}><Logo size={30}/><span className={styles.footerLogoText}>ativus</span></div>
            <p style={{fontSize:'.875rem',lineHeight:1.7}}>Organize. Planeje. Realize.<br/>A plataforma que transforma intenção em resultado.</p>
          </div>
          {[['Produto',['Recursos','Planos','Changelog','Roadmap']],['Empresa',['Sobre nós','Blog','Carreiras','Contato']],['Legal',['Termos de Uso','Privacidade','Cookies','LGPD']]].map(([title,links])=>(
            <div key={title}>
              <h4 className={styles.footerColTitle}>{title}</h4>
              <ul className={styles.footerLinks}>{links.map(l=><li key={l}><a href="#">{l}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 <strong style={{color:'var(--green)'}}>Ativus</strong>. Todos os direitos reservados.</span>
          <span>Feito com ❤️ no Brasil 🇧🇷</span>
        </div>
      </footer>

      <Toast {...toast}/>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}

// ── Social icons ─────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}
