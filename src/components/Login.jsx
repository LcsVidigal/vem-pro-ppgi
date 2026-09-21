import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import './Auth.css'

function Login({ onLoginSuccess, onForgotPasswordClick, onSignUpClick }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  
  // Validation and Feedback States
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const validateForm = () => {
    const newErrors = {}
    
    // Email Validation
    if (!email) {
      newErrors.email = 'O e-mail é obrigatório.'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Insira um e-mail válido (ex: nome@ppgi.com).'
    }

    // Password Validation
    if (!password) {
      newErrors.password = 'A senha é obrigatória.'
    } else if (password.length < 6) {
      newErrors.password = 'A senha deve conter pelo menos 6 caracteres.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const translateFirebaseError = (code) => {
    switch (idClean(code)) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.'
      case 'auth/user-disabled':
        return 'Esta conta acadêmica foi desativada no sistema.'
      case 'auth/too-many-requests':
        return 'Muitas tentativas de login com erro. Esta conta foi temporariamente bloqueada. Tente mais tarde.'
      case 'auth/network-request-failed':
        return 'Falha de conexão com a rede. Verifique seu acesso à internet.'
      case 'auth/configuration-not-found':
      case 'auth/operation-not-allowed':
        return 'O provedor de login por "E-mail e Senha" precisa ser ativado no Firebase Console. Acesse o menu "Authentication > Sign-in method" no console do Firebase para ativá-lo.'
      default:
        return 'Ocorreu um erro inesperado ao realizar o login. Tente novamente.'
    }
  }

  // Quick helper to sanitize codes
  const idClean = (err) => err?.code || err?.message || String(err)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    
    if (!validateForm()) return

    setIsLoading(true)

    try {
      // Direct Firebase Authentication Call
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      
      // Successfully authenticated
      const userObject = userCredential.user
      onLoginSuccess({
        email: userObject.email,
        name: userObject.email.split('@')[0].toUpperCase(),
        uid: userObject.uid,
        rememberMe
      })
    } catch (err) {
      console.error("Firebase Login Error:", err)
      setServerError(translateFirebaseError(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            {/* Elegant SVG Academic Cap Icon */}
            <svg className="auth-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
            </svg>
            <span>Vem Pro PPGI</span>
          </div>
          <h2 className="auth-title">Boas-vindas</h2>
          <p className="auth-subtitle">Entre com suas credenciais para acessar a plataforma de estudos.</p>
        </div>

        {/* Global Server Feedback Error */}
        {serverError && (
          <div className="auth-alert error">
            <svg className="auth-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* Email Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="email">E-mail Acadêmico</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`auth-input ${errors.email ? 'error' : ''}`}
              placeholder="seu-nome@exemplo.com"
              disabled={isLoading}
              autoComplete="email"
            />
            {errors.email && <p className="form-error-msg">{errors.email}</p>}
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="password">Senha</label>
            <div className="input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`auth-input ${errors.password ? 'error' : ''}`}
                placeholder="Insira sua senha"
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                disabled={isLoading}
              >
                {showPassword ? (
                  /* Eye Off Icon */
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.49 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  /* Eye Icon */
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <p className="form-error-msg">{errors.password}</p>}
          </div>

          {/* Remember & Forgot Options */}
          <div className="auth-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="remember-checkbox"
                disabled={isLoading}
              />
              Lembrar de mim
            </label>
            <button
              type="button"
              className="forgot-password-link"
              onClick={onForgotPasswordClick}
              disabled={isLoading}
            >
              Esqueceu a senha?
            </button>
          </div>

          {/* Submit Button */}
          <button type="submit" className="auth-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="spinner"></div>
                <span>Autenticando...</span>
              </>
            ) : (
              <span>Entrar na Plataforma</span>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <span>Novo por aqui?</span>
          <button
            type="button"
            className="auth-footer-btn"
            onClick={onSignUpClick}
            disabled={isLoading}
          >
            Criar conta acadêmica
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
