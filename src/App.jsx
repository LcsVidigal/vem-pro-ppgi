import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import Login from './components/Login.jsx'
import ForgotPassword from './components/ForgotPassword.jsx'
import SignUp from './components/SignUp.jsx'
import AdminQuestions from './components/AdminQuestions.jsx'
import StudentArea from './components/StudentArea.jsx'
import './components/LandingPage.css'
import './App.css'

// Helper to determine initial theme
const getInitialTheme = () => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) return savedTheme

  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return systemPrefersDark ? 'dark' : 'light'
}

function App() {
  // Theme state
  const [theme, setTheme] = useState(getInitialTheme)

  // Navigation & User Session States
  const [view, setView] = useState('landing') // 'landing' | 'login' | 'forgot-password' | 'signup' | 'admin-questions' | 'student-area'
  const [user, setUser] = useState(null) // null | { email, name, uid }
  const [authLoading, setAuthLoading] = useState(true)

  // Sync theme with localStorage and document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  // Listen to Firebase Authentication State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({
          email: currentUser.email,
          name: currentUser.email.split('@')[0].toUpperCase(),
          uid: currentUser.uid
        })
      } else {
        setUser(null)
      }
      setAuthLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleLoginSuccess = () => {
    setView('landing')
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setView('landing')
    } catch (err) {
      console.error("Erro ao realizar logout do Firebase:", err)
    }
  }

  // Display clean full-screen loader while checking session persistence
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100svh',
        background: 'var(--bg)',
        color: 'var(--text-h)',
        fontFamily: 'var(--sans)'
      }}>
        {/* Spinner utilizing Auth styles */}
        <div className="spinner" style={{
          width: '32px',
          height: '32px',
          borderTopColor: 'var(--accent)',
          borderWidth: '3px',
          borderColor: 'var(--border)'
        }}></div>
        <p style={{ fontSize: '15px', fontWeight: '500', opacity: 0.8, margin: 0 }}>
          Sincronizando ambiente acadêmico...
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className="nav-bar">
        <button onClick={() => setView('landing')} className="nav-brand" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {/* Academic Cap SVG Icon */}
          <svg className="nav-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
          </svg>
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Vem Pro PPGI</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="nav-btn nav-btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              minWidth: '38px',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)'
            }}
            aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            title={theme === 'dark' ? 'Ativar Tema Claro' : 'Ativar Tema Escuro'}
          >
            {theme === 'dark' ? (
              /* Sun Icon for switching to light theme */
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              /* Moon Icon for switching to dark theme */
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Admin Questions Link */}
          <button
            onClick={() => setView(view === 'admin-questions' ? 'landing' : 'admin-questions')}
            className="nav-btn nav-btn-outline"
            style={{ fontWeight: view === 'admin-questions' ? '700' : '600' }}
          >
            {view === 'admin-questions' ? 'Ver Site' : 'Questões (Admin)'}
          </button>

          {view !== 'landing' && view !== 'admin-questions' ? (
            <button onClick={() => setView('landing')} className="nav-btn nav-btn-outline">
              Voltar ao Início
            </button>
          ) : user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-h)', fontWeight: '500' }}>
                Olá, <strong>{user.name}</strong>!
              </span>
              <button onClick={handleLogout} className="nav-btn nav-btn-outline">
                Sair
              </button>
            </div>
          ) : (
            view !== 'login' && view !== 'signup' && (
              <button onClick={() => setView('login')} className="nav-btn nav-btn-primary">
                Entrar
              </button>
            )
          )}
        </div>
      </nav>

      {/* Conditional View Rendering */}
      {view === 'login' ? (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onForgotPasswordClick={() => setView('forgot-password')}
          onSignUpClick={() => setView('signup')}
        />
      ) : view === 'forgot-password' ? (
        <ForgotPassword
          onBackToLogin={() => setView('login')}
          onSignUpClick={() => setView('signup')}
        />
      ) : view === 'signup' ? (
        <SignUp
          onSignUpSuccess={handleLoginSuccess}
          onBackToLogin={() => setView('login')}
        />
      ) : view === 'admin-questions' ? (
        <AdminQuestions />
      ) : view === 'student-area' ? (
        <StudentArea user={user} />
      ) : (
        /* Customized Academic Landing Page View */
        <div className="landing-container">
          {/* User Session Banner Feedback */}
          {user && (
            <div className="welcome-banner">
              <span>
                🎓 Você está conectado com sucesso no <strong>Vem Pro PPGI</strong>! (Sessão Ativa no Firebase)
              </span>
              <button onClick={handleLogout} className="welcome-banner-btn">
                Desconectar
              </button>
            </div>
          )}

          {/* 1. Hero Section */}
          <header className="hero-section">
            <div className="hero-badge">
              <span role="img" aria-label="sparkles">✨</span> Preparação Acadêmica Focada
            </div>
            <h1 className="hero-title">
              Sua aprovação no <span>PPGI</span> começa aqui.
            </h1>
            <p className="hero-description">
              A plataforma definitiva de estudos para candidatos ao Programa de Pós-Graduação em Informática.
              Acesse cronogramas, materiais de estudo estruturados, simulados de provas anteriores e mentorias dedicadas.
            </p>
            <div className="hero-actions">
              {user ? (
                <button onClick={() => setView('student-area')} className="nav-btn nav-btn-primary" style={{ padding: '12px 24px', fontSize: '16px' }}>
                  Ir para a Área do Aluno
                </button>
              ) : (
                <>
                  <button onClick={() => setView('login')} className="nav-btn nav-btn-primary" style={{ padding: '12px 24px', fontSize: '16px' }}>
                    Começar a Estudar
                  </button>
                  <button className="nav-btn nav-btn-outline" style={{ padding: '12px 24px', fontSize: '16px' }} onClick={() => setView('signup')}>
                    Conhecer o Programa
                  </button>
                </>
              )}
            </div>
          </header>

          {/* 2. Features/Benefits Grid */}
          <section className="features-section">
            <div className="section-header">
              <h2 className="section-title">Trilhas de Estudo Estruturadas</h2>
              <p className="section-subtitle">Tudo o que você precisa para se preparar com consistência e alcançar o alto desempenho acadêmico.</p>
            </div>

            <div className="features-grid">
              {/* Feature 1 */}
              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <svg className="feature-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
                <h3>Banco de Questões</h3>
                <p>Acesse e resolva um banco completo de questões focadas no edital, com respostas comentadas e gabarito integrado.</p>
              </div>

              {/* Feature 2 */}
              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <svg className="feature-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h3>Cronogramas</h3>
                <p>Trilhas de aprendizagem personalizadas criadas especificamente para cobrir todo o edital do PPGI.</p>
              </div>

              {/* Feature 3 */}
              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <svg className="feature-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h3>Simulados Práticos</h3>
                <p>Exercícios e provas anteriores corrigidas e comentadas para testar seus conhecimentos e tempo de prova.</p>
              </div>

              {/* Feature 4 */}
              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <svg className="feature-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <h3>Download de Provas Anteriores</h3>
                <p>Baixe os cadernos de provas completos das edições anteriores do PPGI para simular o exame em tempo real.</p>
              </div>
            </div>
          </section>

          {/* 3. CTA Banner Section */}
          <section className="cta-banner-section">
            <div className="cta-banner-card">
              <h2>Eleve o Nível dos seus Estudos</h2>
              <p>Junte-se a centenas de estudantes e comece a se preparar hoje mesmo de maneira estruturada e focada.</p>
              {user ? (
                <button onClick={() => setView('student-area')} className="nav-btn nav-btn-primary" style={{ padding: '12px 24px', fontSize: '16px' }}>
                  Acessar Painel do Aluno
                </button>
              ) : (
                <button onClick={() => setView('login')} className="nav-btn nav-btn-primary" style={{ padding: '12px 24px', fontSize: '16px' }}>
                  Acessar Minha Conta Acadêmica
                </button>
              )}
            </div>
          </section>

          {/* 5. Institutional Footer */}
          <footer className="footer-section">
            <p className="footer-text">
              © {new Date().getFullYear()} Vem Pro PPGI — Plataforma de Estudos Acadêmicos. Desenvolvido com foco em excelência e pesquisa científica.
            </p>
          </footer>
        </div>
      )}
    </>
  )
}

export default App
