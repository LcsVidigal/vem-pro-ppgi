import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { EDUCATION_OPTIONS } from './UserProfile'
import './Auth.css'

function SignUp({ onSignUpSuccess, onBackToLogin }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [course, setCourse] = useState('')
  const [education, setEducation] = useState(EDUCATION_OPTIONS[0])
  const [institution, setInstitution] = useState('')
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

    if (!firstName.trim()) {
      newErrors.firstName = 'O nome é obrigatório.'
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'O sobrenome é obrigatório.'
    }
    if (!course.trim()) {
      newErrors.course = 'O curso é obrigatório (ex: Ciência da Computação).'
    }
    if (!education.trim()) {
      newErrors.education = 'A formação acadêmica é obrigatória.'
    }
    if (!institution.trim()) {
      newErrors.institution = 'A instituição de ensino é obrigatória (ex: UFAM).'
    }

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
      // 1. Cria usuário no Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password)
      const userObject = userCredential.user

      const cleanFirst = firstName.trim()
      const cleanLast = lastName.trim()
      const fullName = `${cleanFirst} ${cleanLast}`.trim()

      // 2. Monta o objeto do usuário com tipo padrão 'aluno'
      const newUserProfile = {
        uid: userObject.uid,
        email: userObject.email,
        firstName: cleanFirst,
        lastName: cleanLast,
        name: fullName,
        course: course.trim(),
        education: education.trim(),
        institution: institution.trim(),
        role: 'aluno', // Tipo de usuário padrão ('aluno' | 'administrador')
        userType: 'aluno',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // Salva localmente no cache imediatamente
      try {
        localStorage.setItem(`user_profile_${userObject.uid}`, JSON.stringify(newUserProfile))
      } catch {
        // ignore
      }

      // 3. Persiste o perfil na coleção 'users' do Firestore
      try {
        await setDoc(doc(db, 'users', userObject.uid), newUserProfile)
      } catch (firestoreErr) {
        console.warn('Aviso ao gravar perfil inicial no Firestore (salvo em cache local):', firestoreErr)
      }

      onSignUpSuccess(newUserProfile)
    } catch (err) {
      console.error('Firebase Registration Error:', err)
      setServerError(translateFirebaseError(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '560px' }}>
        <div className="auth-header">
          <div className="auth-logo">
            <svg className="auth-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
            </svg>
            <span>Vem Pro PPGI</span>
          </div>
          <h2 className="auth-title">Criar Conta Acadêmica</h2>
          <p className="auth-subtitle">
            Preencha seus dados pessoais e acadêmicos para acessar a plataforma.
          </p>
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
          {/* Nome e Sobrenome */}
          <div className="auth-form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="signup-firstName">Nome *</label>
              <input
                id="signup-firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`auth-input ${errors.firstName ? 'error' : ''}`}
                placeholder="Seu nome"
                disabled={isLoading}
                autoComplete="given-name"
              />
              {errors.firstName && <p className="form-error-msg">{errors.firstName}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-lastName">Sobrenome *</label>
              <input
                id="signup-lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`auth-input ${errors.lastName ? 'error' : ''}`}
                placeholder="Seu sobrenome"
                disabled={isLoading}
                autoComplete="family-name"
              />
              {errors.lastName && <p className="form-error-msg">{errors.lastName}</p>}
            </div>
          </div>

          {/* Curso e Formação */}
          <div className="auth-form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="signup-course">Curso *</label>
              <input
                id="signup-course"
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className={`auth-input ${errors.course ? 'error' : ''}`}
                placeholder="Ex: Ciência da Computação"
                disabled={isLoading}
              />
              {errors.course && <p className="form-error-msg">{errors.course}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-education">Formação *</label>
              <select
                id="signup-education"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className={`auth-input ${errors.education ? 'error' : ''}`}
                disabled={isLoading}
              >
                {EDUCATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {errors.education && <p className="form-error-msg">{errors.education}</p>}
            </div>
          </div>

          {/* Instituição de Ensino */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-institution">Instituição de Ensino *</label>
            <input
              id="signup-institution"
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className={`auth-input ${errors.institution ? 'error' : ''}`}
              placeholder="Ex: UFAM - Universidade Federal do Amazonas"
              disabled={isLoading}
              autoComplete="organization"
            />
            {errors.institution && <p className="form-error-msg">{errors.institution}</p>}
          </div>

          {/* Email Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">E-mail Acadêmico *</label>
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

          {/* Password & Confirm Password */}
          <div className="auth-form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">Senha *</label>
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
                  aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.49 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="form-error-msg">{errors.password}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">Confirmar Senha *</label>
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
