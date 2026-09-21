import { useState } from 'react'
import './Auth.css'

function ForgotPassword({ onBackToLogin, onSignUpClick }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const validateEmail = () => {
    if (!email) {
      setError('O e-mail é obrigatório.')
      return false
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Insira um e-mail válido (ex: nome@ppgi.com).')
      return false
    }
    setError('')
    return true
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validateEmail()) return

    setIsLoading(true)

    // Simulate Firebase sendPasswordResetEmail call
    setTimeout(() => {
      setIsLoading(false)
      
      if (email === 'erro@ppgi.com') {
        setError('Erro ao enviar e-mail: Usuário não encontrado no sistema.')
      } else {
        setIsSuccess(true)
      }
    }, 1200)
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
          <h2 className="auth-title">Recuperar Senha</h2>
          <p className="auth-subtitle">
            Insira o seu e-mail cadastrado e enviaremos um link para você redefinir a sua senha.
          </p>
        </div>

        {/* Global Error message */}
        {error && (
          <div className="auth-alert error">
            <svg className="auth-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {isSuccess ? (
          /* Beautiful success feedback screen */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="auth-alert success" style={{ marginBottom: 0 }}>
              <svg className="auth-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>E-mail enviado com sucesso!</strong>
                Enviamos um link de redefinição para <strong>{email}</strong>. Verifique sua caixa de entrada e de spam.
              </div>
            </div>

            <button
              type="button"
              className="auth-btn"
              onClick={onBackToLogin}
            >
              Voltar para o Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* Email Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="recovery-email">E-mail Cadastrado</label>
              <input
                id="recovery-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`auth-input ${error ? 'error' : ''}`}
                placeholder="seu-nome@exemplo.com"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            {/* Submit Button */}
            <button type="submit" className="auth-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="spinner"></div>
                  <span>Enviando link...</span>
                </>
              ) : (
                <span>Enviar Link de Recuperação</span>
              )}
            </button>

            {/* Back to Login option */}
            <div style={{ textAlignment: 'center', marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="forgot-password-link"
                onClick={onBackToLogin}
                disabled={isLoading}
                style={{ fontSize: '15px' }}
              >
                Voltar para o login
              </button>
            </div>
          </form>
        )}

        <div className="auth-footer">
          <span>Ainda não tem cadastro?</span>
          <button
            type="button"
            className="auth-footer-btn"
            onClick={onSignUpClick}
            disabled={isLoading}
          >
            Cadastrar-se
          </button>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
