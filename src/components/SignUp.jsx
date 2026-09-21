import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import './Auth.css'

function SignUp({ onSignUpSuccess, onBackToLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
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

    // Confirm Password Validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'A confirmação de senha é obrigatória.'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const translateFirebaseError = (err) => {
    const code = err?.code || err?.message || String(err)
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Este e-mail já está em uso por outra conta acadêmica.'
      case 'auth/invalid-email':
        return 'O formato do e-mail inserido é inválido.'
      case 'auth/weak-password':
        return 'Senha fraca. Escolha uma senha mais forte com pelo menos 6 caracteres.'
      case 'auth/operation-not-allowed':
      case 'auth/configuration-not-found':
        return 'O provedor de login por "E-mail e Senha" precisa ser ativado no Firebase Console. Acesse o menu "Authentication > Sign-in method" no console do Firebase para ativá-lo.'
      case 'auth/network-request-failed':
        return 'Falha na rede. Verifique sua conexão com a internet.'
      default:
        return 'Ocorreu um erro ao criar a conta. Tente novamente mais tarde.'
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    
    if (!validateForm()) return

    setIsLoading(true)

    try {
      // Create user directly in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      
      // Successfully registered and logged in
      const userObject = userCredential.user
      onSignUpSuccess({
        email: userObject.email,
        name: userObject.email.split('@')[0].toUpperCase(),
        uid: userObject.uid
      })
    } catch (err) {
      console.error("Firebase Registration Error:", err)
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
          <h2 className="auth-title">Criar Conta</h2>
          <p className="auth-subtitle">Cadastre-se para ter acesso completo à nossa plataforma acadêmica.</p>
        </div>

        {/* Global Server Error Alert */}
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
            <label className="form-label" htmlFor="signup-email">E-mail Acadêmico</label>
            <input
              id="signup-email"
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
            <label className="form-label" htmlFor="signup-password">Senha</label>
            <div className="input-wrapper">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`auth-input ${errors.password ? 'error' : ''}`}
                placeholder="Mínimo de 6 caracteres"
                disabled={isLoading}
                autoComplete="new-password"
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

          {/* Confirm Password Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">Confirmar Senha</label>
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`auth-input ${errors.confirmPassword ? 'error' : ''}`}
              placeholder="Repita sua senha"
              disabled={isLoading}
              autoComplete="new-password"
            />
            {errors.confirmPassword && <p className="form-error-msg">{errors.confirmPassword}</p>}
          </div>

          {/* Submit Register Button */}
          <button type="submit" className="auth-btn" style={{ marginTop: '10px' }} disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="spinner"></div>
                <span>Criando conta...</span>
              </>
            ) : (
              <span>Criar Minha Conta</span>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <span>Já possui uma conta?</span>
          <button
            type="button"
            className="auth-footer-btn"
            onClick={onBackToLogin}
            disabled={isLoading}
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  )
}

export default SignUp
