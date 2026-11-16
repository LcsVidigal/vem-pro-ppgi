import { useState, useEffect } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import './Auth.css'

export const EDUCATION_OPTIONS = [
  'Graduando(a) / Em andamento',
  'Graduação Completa (Bacharelado)',
  'Graduação Completa (Licenciatura)',
  'Graduação Completa (Tecnólogo)',
  'Especialização / Pós-Graduação (Lato Sensu)',
  'Mestrado / Pós-Graduação (Stricto Sensu)',
  'Doutorado'
]

function UserProfile({ user, onProfileUpdate, onBack }) {
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [course, setCourse] = useState(user?.course || '')
  const [education, setEducation] = useState(user?.education || EDUCATION_OPTIONS[0])
  const [institution, setInstitution] = useState(user?.institution || '')
  const [userType, setUserType] = useState(user?.userType || user?.role || 'aluno')

  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', message: string }

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '')
      setLastName(user.lastName || '')
      setCourse(user.course || '')
      setEducation(user.education || EDUCATION_OPTIONS[0])
      setInstitution(user.institution || '')
      setUserType(user.userType || user.role || 'aluno')
    }
  }, [user])

  const validate = () => {
    const newErrors = {}
    if (!firstName.trim()) {
      newErrors.firstName = 'Informe o seu nome.'
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'Informe o seu sobrenome.'
    }
    if (!course.trim()) {
      newErrors.course = 'Informe o seu curso (ex: Ciência da Computação).'
    }
    if (!education.trim()) {
      newErrors.education = 'Selecione ou informe a sua formação.'
    }
    if (!institution.trim()) {
      newErrors.institution = 'Informe a sua instituição de ensino (ex: UFAM).'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setFeedback(null)

    if (!validate()) return
    if (!user?.uid) {
      setFeedback({
        type: 'error',
        message: 'Nenhum usuário autenticado encontrado para salvar o perfil.'
      })
      return
    }

    setIsSaving(true)

    const cleanFirst = firstName.trim()
    const cleanLast = lastName.trim()
    const fullName = `${cleanFirst} ${cleanLast}`.trim()
    const normalizedRole = userType === 'administrador' ? 'administrador' : 'aluno'

    const updatedProfile = {
      uid: user.uid,
      email: user.email || '',
      firstName: cleanFirst,
      lastName: cleanLast,
      name: fullName,
      course: course.trim(),
      education: education.trim(),
      institution: institution.trim(),
      role: normalizedRole,
      userType: normalizedRole,
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Salva localmente imediatamente como cache seguro
    try {
      localStorage.setItem(`user_profile_${user.uid}`, JSON.stringify(updatedProfile))
    } catch {
      // ignore storage quota errors
    }

    try {
      const userDocRef = doc(db, 'users', user.uid)
      await setDoc(userDocRef, updatedProfile, { merge: true })

      if (onProfileUpdate) {
        onProfileUpdate(updatedProfile)
      }

      setFeedback({
        type: 'success',
        message: 'Perfil atualizado e sincronizado com sucesso no Firestore!'
      })
    } catch (err) {
      console.warn('Aviso ao gravar perfil no Firestore (salvo em cache local):', err)
      if (onProfileUpdate) {
        onProfileUpdate(updatedProfile)
      }
      setFeedback({
        type: 'success',
        message:
          'Perfil atualizado localmente! (Para sincronizar na nuvem, certifique-se de liberar a coleção "users" nas Rules do Firestore).'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const initials = `${(firstName || user?.name || 'U')[0] || 'U'}${
    (lastName || '')[0] || ''
  }`.toUpperCase()

  return (
    <div className="auth-container" style={{ padding: '32px 20px' }}>
      <div className="auth-card" style={{ maxWidth: '640px' }}>
        {/* Topo com botão voltar */}
        {onBack && (
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              onClick={onBack}
              className="nav-btn nav-btn-outline"
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              ← Voltar
            </button>
          </div>
        )}

        {/* Cabeçalho do Perfil */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            paddingBottom: '20px',
            marginBottom: '24px',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--accent-bg)',
              border: '2px solid var(--accent)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: '800',
              flexShrink: 0
            }}
          >
            {initials}
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 className="auth-title" style={{ margin: 0, fontSize: '24px' }}>
                Meu Perfil Acadêmico
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background:
                    userType === 'administrador'
                      ? 'rgba(245, 158, 11, 0.16)'
                      : 'rgba(59, 130, 246, 0.15)',
                  color: userType === 'administrador' ? '#f59e0b' : '#3b82f6'
                }}
              >
                {userType === 'administrador' ? '🛡️ Administrador' : '🎓 Aluno'}
              </span>
            </div>
            <p className="auth-subtitle" style={{ marginTop: '4px' }}>
              {user?.email || 'Atualize seus dados pessoais e acadêmicos no Vem Pro PPGI.'}
            </p>
          </div>
        </div>

        {/* Alerta de Sucesso ou Erro */}
        {feedback && (
          <div className={`auth-alert ${feedback.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: '20px' }}>
            <svg
              className="auth-alert-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {feedback.type === 'error' ? (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </>
              ) : (
                <>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </>
              )}
            </svg>
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="auth-form" noValidate>
          {/* Nome e Sobrenome lado a lado */}
          <div className="auth-form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="profile-firstName">
                Nome *
              </label>
              <input
                id="profile-firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`auth-input ${errors.firstName ? 'error' : ''}`}
                placeholder="Ex: João"
                disabled={isSaving}
              />
              {errors.firstName && <p className="form-error-msg">{errors.firstName}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-lastName">
                Sobrenome *
              </label>
              <input
                id="profile-lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={`auth-input ${errors.lastName ? 'error' : ''}`}
                placeholder="Ex: Silva"
                disabled={isSaving}
              />
              {errors.lastName && <p className="form-error-msg">{errors.lastName}</p>}
            </div>
          </div>

          {/* Curso e Formação */}
          <div className="auth-form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="profile-course">
                Curso *
              </label>
              <input
                id="profile-course"
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className={`auth-input ${errors.course ? 'error' : ''}`}
                placeholder="Ex: Ciência da Computação"
                disabled={isSaving}
              />
              {errors.course && <p className="form-error-msg">{errors.course}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-education">
                Formação Acadêmica *
              </label>
              <select
                id="profile-education"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                className={`auth-input ${errors.education ? 'error' : ''}`}
                disabled={isSaving}
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
            <label className="form-label" htmlFor="profile-institution">
              Instituição de Ensino *
            </label>
            <input
              id="profile-institution"
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className={`auth-input ${errors.institution ? 'error' : ''}`}
              placeholder="Ex: UFAM - Universidade Federal do Amazonas"
              disabled={isSaving}
            />
            {errors.institution && <p className="form-error-msg">{errors.institution}</p>}
          </div>

          {/* E-mail (Somente leitura) */}
          <div className="form-group">
            <label className="form-label" htmlFor="profile-email">
              E-mail Cadastrado
            </label>
            <input
              id="profile-email"
              type="email"
              value={user?.email || ''}
              className="auth-input"
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="nav-btn nav-btn-outline"
                style={{ padding: '12px 20px' }}
                disabled={isSaving}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="auth-btn"
              style={{ width: 'auto', minWidth: '200px', padding: '12px 24px' }}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="spinner"></div>
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar Alterações</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UserProfile

