import { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { INITIAL_QUESTIONS } from '../data/initialQuestions'
import { PREDEFINED_AREAS } from '../data/predefinedAreas'
import StudentQuiz from './StudentQuiz'
import './StudentArea.css'

function StudentArea({ user }) {
  // Navigation views inside Student Area: 'dashboard' | 'select_area' | 'track' | 'track_study' | 'quiz'
  const [currentView, setCurrentView] = useState('dashboard')

  // Pool of all questions available (from Firestore or initialQuestions fallback)
  const [allQuestions, setAllQuestions] = useState(INITIAL_QUESTIONS)

  // Helper to read initial track from cache (CA04)
  const [studyTrack, setStudyTrack] = useState(() => {
    const userKey = user?.uid ? `study_track_${user.uid}` : 'study_track_guest'
    try {
      const cached = localStorage.getItem(userKey)
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })

  // Area Selection state (CA01)
  const [selectedAreaId, setSelectedAreaId] = useState(PREDEFINED_AREAS[0]?.id || '')

  // Track filter state (CA03) - 'all' | 'not_started' | 'in_progress' | 'completed'
  const [filterStatus, setFilterStatus] = useState('all')

  // Dedicated Track Response Page State (No popups!)
  const [activeTrackQuestionIndex, setActiveTrackQuestionIndex] = useState(0)
  const [selectedSolverOption, setSelectedSolverOption] = useState(null)

  // Past Exams (US Downloads)
  const [exams, setExams] = useState([])
  const [examFilterSemester, setExamFilterSemester] = useState('all')
  const [examSearch, setExamSearch] = useState('')

  // 1. Fetch available questions from Firestore real-time, falling back to INITIAL_QUESTIONS
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'questions'),
      (snapshot) => {
        const loaded = []
        snapshot.forEach((docSnap) => {
          loaded.push({ id: docSnap.id, ...docSnap.data() })
        })
        if (loaded.length > 0) {
          loaded.sort((a, b) => a.id.localeCompare(b.id))
          setAllQuestions(loaded)
        } else {
          setAllQuestions(INITIAL_QUESTIONS)
        }
      },
      (error) => {
        console.warn('Usando questões locais (aviso de Firestore):', error)
        setAllQuestions(INITIAL_QUESTIONS)
      }
    )

    return () => unsubscribe()
  }, [])

  // 1.1 Fetch available past exams from Firestore and Google Drive
  useEffect(() => {
    fetch('/api/drive-files')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.files)) {
          const driveExams = data.files.map((f) => {
            const semMatch = f.name.match(/(20\d\d)[-_/](0?[12])/)
            const guessedSemester = semMatch ? `${semMatch[1]}/${semMatch[2].replace('0', '')}` : '2026/1'
            const isGabarito = /gabarito/i.test(f.name)
            const docType = isGabarito ? 'Gabarito Oficial' : 'Caderno de Prova'
            const cleanTitle = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ')
            return {
              id: `DRIVE-${f.id}`,
              driveFileId: f.id,
              title: cleanTitle,
              fileName: f.name,
              yearSemester: guessedSemester,
              docType,
              fileUrl: f.webContentLink || `https://drive.google.com/uc?export=download&id=${f.id}`,
              previewUrl: f.webViewLink,
              directDownloadUrl: `https://drive.google.com/uc?export=download&id=${f.id}`,
              fileSize: parseInt(f.size || '0', 10),
              fileSizeFormatted: `${(parseInt(f.size || '0', 10) / (1024 * 1024)).toFixed(1)} MB`,
              uploadedAt: f.createdTime || new Date().toISOString(),
              storageType: 'google-drive'
            }
          })
          setExams((prev) => {
            const existingIds = new Set(prev.map((p) => p.driveFileId))
            const newOnes = driveExams.filter((df) => !existingIds.has(df.driveFileId))
            return [...prev, ...newOnes]
          })
        }
      })
      .catch((err) => {
        console.warn('Aviso ao buscar arquivos do Google Drive na Área do Aluno:', err)
      })

    const unsubscribe = onSnapshot(
      collection(db, 'exams'),
      (snapshot) => {
        const loaded = []
        snapshot.forEach((docSnap) => {
          loaded.push({ id: docSnap.id, ...docSnap.data() })
        })
        const cachedExams = JSON.parse(localStorage.getItem('cached_exams') || '[]')
        const all = [...loaded]
        cachedExams.forEach((c) => {
          if (!all.some((a) => a.id === c.id || (a.driveFileId && a.driveFileId === c.driveFileId))) {
            all.push(c)
          }
        })
        all.sort(
          (a, b) =>
            (b.yearSemester || '').localeCompare(a.yearSemester || '') ||
            (b.uploadedAt || '').localeCompare(a.uploadedAt || '')
        )
        setExams(all)
      },
      (error) => {
        console.warn('Aviso ao carregar provas anteriores do Firestore:', error)
        const cachedExams = JSON.parse(localStorage.getItem('cached_exams') || '[]')
        if (cachedExams.length > 0) {
          setExams(cachedExams)
        }
      }
    )

    return () => unsubscribe()
  }, [])

  // 2. CA04: Load persistent study track associated with the user profile
  useEffect(() => {
    if (!user?.uid) {
      return
    }

    const userKey = `study_track_${user.uid}`

    // Real-time Firestore sync for the authenticated user
    const trackDocRef = doc(db, 'study_tracks', user.uid)
    const unsubscribe = onSnapshot(
      trackDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const trackData = docSnap.data()
          setStudyTrack(trackData)
          localStorage.setItem(userKey, JSON.stringify(trackData))
        }
      },
      (error) => {
        console.error('Erro ao sincronizar trilha com o Firestore:', error)
      }
    )

    return () => unsubscribe()
  }, [user?.uid])

  // Helper to persist study track to Firestore and LocalStorage (CA04)
  const saveTrack = async (updatedTrack) => {
    setStudyTrack(updatedTrack)
    const userKey = user?.uid ? `study_track_${user.uid}` : 'study_track_guest'

    if (updatedTrack) {
      localStorage.setItem(userKey, JSON.stringify(updatedTrack))
    } else {
      localStorage.removeItem(userKey)
    }

    if (user?.uid) {
      try {
        const trackDocRef = doc(db, 'study_tracks', user.uid)
        if (updatedTrack) {
          await setDoc(trackDocRef, updatedTrack)
        } else {
          await deleteDoc(trackDocRef)
        }
      } catch (err) {
        console.error('Falha ao persistir trilha no Firestore:', err)
      }
    }
  }

  // CA02: Generate study track when user confirms selected area
  const handleGenerateTrack = async () => {
    const area = PREDEFINED_AREAS.find((a) => a.id === selectedAreaId)
    if (!area) return

    // Filter questions specifically for the selected area's topics (CA02)
    let filtered = allQuestions.filter((q) => area.topics.includes(q.category))

    // Fallback if specific category questions are empty
    if (filtered.length === 0) {
      filtered = allQuestions.slice(0, 5)
    }

    const newTrack = {
      areaId: area.id,
      areaTitle: area.title,
      areaDescription: area.description,
      topics: area.topics,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: filtered.map((q, idx) => ({
        id: q.id,
        prompt: q.prompt,
        category: q.category,
        options: q.options || [],
        correctAnswer: q.correctAnswer || 'A',
        explanation: q.explanation || '',
        author: q.author || 'Banca PPGI',
        status: 'not_started', // 'not_started' | 'in_progress' | 'completed' (CA03)
        userAnswer: null,
        isCorrect: null,
        order: idx + 1
      }))
    }

    await saveTrack(newTrack)
    setCurrentView('track')
  }

  // Start or Continue Track (Dedicated Page, No Popup!)
  const handleStartTrack = (targetIndex) => {
    if (!studyTrack || !studyTrack.questions || studyTrack.questions.length === 0) return

    let nextIndex = targetIndex
    if (typeof nextIndex !== 'number') {
      // Find first question not completed or in progress
      const firstPending = studyTrack.questions.findIndex((q) => q.status !== 'completed')
      nextIndex = firstPending !== -1 ? firstPending : 0
    }

    const targetQuestion = studyTrack.questions[nextIndex]
    if (targetQuestion && targetQuestion.status === 'not_started') {
      const updatedQuestions = studyTrack.questions.map((q, idx) => {
        if (idx === nextIndex) {
          return { ...q, status: 'in_progress' }
        }
        return q
      })
      const updatedTrack = {
        ...studyTrack,
        questions: updatedQuestions,
        updatedAt: new Date().toISOString()
      }
      saveTrack(updatedTrack)
    }

    setActiveTrackQuestionIndex(nextIndex)
    setSelectedSolverOption(targetQuestion?.userAnswer || null)
    setCurrentView('track_study')
  }

  // Switch to a specific question inside the dedicated track solver page
  const handleNavigateSolverQuestion = (newIndex) => {
    if (!studyTrack || !studyTrack.questions) return
    if (newIndex < 0 || newIndex >= studyTrack.questions.length) return

    const targetQuestion = studyTrack.questions[newIndex]
    if (targetQuestion && targetQuestion.status === 'not_started') {
      const updatedQuestions = studyTrack.questions.map((q, idx) => {
        if (idx === newIndex) {
          return { ...q, status: 'in_progress' }
        }
        return q
      })
      const updatedTrack = {
        ...studyTrack,
        questions: updatedQuestions,
        updatedAt: new Date().toISOString()
      }
      saveTrack(updatedTrack)
    }

    setActiveTrackQuestionIndex(newIndex)
    setSelectedSolverOption(targetQuestion?.userAnswer || null)
  }

  // Confirm answer inside dedicated page (CA03)
  const handleConfirmSolverAnswer = async () => {
    if (!studyTrack || !studyTrack.questions) return
    const currentQ = studyTrack.questions[activeTrackQuestionIndex]
    if (!currentQ || !selectedSolverOption) return

    const isCorrect = selectedSolverOption === currentQ.correctAnswer

    const updatedQuestions = studyTrack.questions.map((q, idx) => {
      if (idx === activeTrackQuestionIndex) {
        return {
          ...q,
          status: 'completed', // Moved to completed upon answering (CA03)
          userAnswer: selectedSolverOption,
          isCorrect
        }
      }
      return q
    })

    const updatedTrack = {
      ...studyTrack,
      questions: updatedQuestions,
      updatedAt: new Date().toISOString()
    }

    await saveTrack(updatedTrack)
  }

  // Retry or reset current question in track solver
  const handleRetrySolverQuestion = async () => {
    if (!studyTrack || !studyTrack.questions) return

    setSelectedSolverOption(null)

    const updatedQuestions = studyTrack.questions.map((q, idx) => {
      if (idx === activeTrackQuestionIndex) {
        return {
          ...q,
          status: 'in_progress',
          userAnswer: null,
          isCorrect: null
        }
      }
      return q
    })

    const updatedTrack = {
      ...studyTrack,
      questions: updatedQuestions,
      updatedAt: new Date().toISOString()
    }

    await saveTrack(updatedTrack)
  }

  // Calculate Progress Indicators (CA03)
  const trackQuestions = studyTrack?.questions || []
  const totalQuestions = trackQuestions.length
  const notStartedCount = trackQuestions.filter((q) => q.status === 'not_started').length
  const inProgressCount = trackQuestions.filter((q) => q.status === 'in_progress').length
  const completedCount = trackQuestions.filter((q) => q.status === 'completed').length
  const correctCount = trackQuestions.filter((q) => q.isCorrect === true).length

  const progressPercent = totalQuestions > 0 ? Math.round((completedCount / totalQuestions) * 100) : 0
  const accuracyPercent = completedCount > 0 ? Math.round((correctCount / completedCount) * 100) : 0

  // Filtered list of questions based on active tab
  const filteredQuestionsList = trackQuestions.filter((q) => {
    if (filterStatus === 'all') return true
    return q.status === filterStatus
  })

  // Render Modo Livre (US04)
  if (currentView === 'quiz') {
    return <StudentQuiz onFinish={() => setCurrentView('dashboard')} />
  }

  return (
    <div className="student-area-container">
      {/* Student Area Header & Welcome Banner */}
      <header className="student-area-header">
        <div className="student-header-badge">
          🎓 Painel Acadêmico PPGI UFAM
        </div>
        <h1>Área do Aluno</h1>
        <p>
          Bem-vindo(a), <strong>{user?.name || 'Estudante'}</strong>! Prepare-se com foco e método para o processo seletivo do Programa de Pós-Graduação em Informática.
        </p>
      </header>

      {/* Quick Summary Metrics Bar */}
      <section className="student-quick-stats">
        <div className="quick-stat-card">
          <div className="quick-stat-icon purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="quick-stat-info">
            <h4>Trilha Ativa</h4>
            <p className="value" style={{ fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
              {studyTrack ? studyTrack.areaTitle : 'Nenhuma definida'}
            </p>
          </div>
        </div>

        <div className="quick-stat-card">
          <div className="quick-stat-icon green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="quick-stat-info">
            <h4>Progresso da Trilha</h4>
            <p className="value">{progressPercent}% Concluído</p>
          </div>
        </div>

        <div className="quick-stat-card">
          <div className="quick-stat-icon amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="quick-stat-info">
            <h4>Em Andamento</h4>
            <p className="value">{inProgressCount} Questões</p>
          </div>
        </div>

        <div className="quick-stat-card">
          <div className="quick-stat-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="quick-stat-info">
            <h4>Assertividade</h4>
            <p className="value">{completedCount > 0 ? `${accuracyPercent}%` : '--'}</p>
          </div>
        </div>
      </section>

      {/* ====================================================================
          VIEW 1: DASHBOARD (CARDS HUB)
          ==================================================================== */}
      {currentView === 'dashboard' && (
        <main className="student-area-main">
          <div className="student-cards-grid">
            {/* CARD US12: Montar Trilha de Estudos (US12 - CA01 a CA04) */}
            <article className="student-dashboard-card featured">
              <div className="card-top-row">
                <div className="card-icon-wrapper">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                </div>
                <span className="card-tag">Trilha de Estudos</span>
              </div>

              <h2 className="card-title">
                {studyTrack ? `Minha Trilha: ${studyTrack.areaTitle}` : 'Montar Trilha de Estudos'}
              </h2>

              <p className="card-description">
                {studyTrack
                  ? studyTrack.areaDescription
                  : 'Selecione sua área de foco para a prova do PPGI da UFAM. O sistema gera uma lista estruturada de questões com acompanhamento visual de progresso e persistência de dados.'}
              </p>

              {/* Progress Summary inside Card if track exists (CA03 & CA04) */}
              {studyTrack && (
                <div className="card-mini-progress">
                  <div className="mini-progress-labels">
                    <span>Progresso de Estudos</span>
                    <span>{progressPercent}% ({completedCount}/{totalQuestions})</span>
                  </div>
                  <div className="mini-progress-track">
                    <div className="mini-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                  <div className="mini-indicators-row">
                    <span className="mini-badge not-started">⚪ {notStartedCount} não iniciadas</span>
                    <span className="mini-badge in-progress">🟡 {inProgressCount} em andamento</span>
                    <span className="mini-badge completed">🟢 {completedCount} concluídas</span>
                  </div>
                </div>
              )}

              <div className="card-actions">
                {studyTrack ? (
                  <>
                    <button onClick={() => setCurrentView('track')} className="nav-btn nav-btn-primary">
                      Acessar Trilha de Estudos
                    </button>
                    <button onClick={() => setCurrentView('select_area')} className="nav-btn nav-btn-outline">
                      Trocar Foco
                    </button>
                  </>
                ) : (
                  <button onClick={() => setCurrentView('select_area')} className="nav-btn nav-btn-primary">
                    Montar Minha Trilha
                  </button>
                )}
              </div>
            </article>

            {/* CARD US04: Modo Livre (Questões Aleatórias) */}
            <article className="student-dashboard-card">
              <div className="card-top-row">
                <div className="card-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 3 21 3 21 8" />
                    <line x1="4" y1="20" x2="21" y2="3" />
                    <polyline points="21 16 21 21 16 21" />
                    <line x1="15" y1="15" x2="21" y2="21" />
                    <line x1="4" y1="4" x2="9" y2="9" />
                  </svg>
                </div>
                <span className="card-tag quiz">Modo Livre</span>
              </div>

              <h2 className="card-title">Modo Livre</h2>
              <p className="card-description">
                Responda questões aleatórias do banco no seu próprio ritmo e sem pressão de cronômetro. Ideal para praticar e fixar conteúdos do edital a qualquer momento.
              </p>

              <div className="card-actions">
                <button onClick={() => setCurrentView('quiz')} className="nav-btn nav-btn-primary" style={{ background: '#3b82f6', borderColor: '#3b82f6' }}>
                  Iniciar Modo Livre
                </button>
              </div>
            </article>

            {/* CARD: Provas Anteriores em PDF (Google Drive) */}
            <article className="student-dashboard-card">
              <div className="card-top-row">
                <div className="card-icon-wrapper" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <span className="card-tag" style={{ color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)' }}>
                  {exams.length > 0 ? `${exams.length} Provas Disponíveis` : 'Provas Anteriores'}
                </span>
              </div>

              <h2 className="card-title">Provas Anteriores e Gabaritos</h2>
              <p className="card-description">
                Baixe ou visualize cadernos de prova oficiais e gabaritos dos processos seletivos do PPGI UFAM por semestre, salvos no Google Drive.
              </p>

              <div className="card-actions">
                <button
                  onClick={() => setCurrentView('exams')}
                  className="nav-btn nav-btn-primary"
                  style={{ background: '#22c55e', borderColor: '#22c55e' }}
                >
                  Acessar Provas Anteriores
                </button>
              </div>
            </article>
          </div>
        </main>
      )}

      {/* ====================================================================
          VIEW: PROVAS ANTERIORES E GABARITOS (DOWNLOADS)
          ==================================================================== */}
      {currentView === 'exams' && (
        <section className="track-overview-view">
          <div className="track-overview-header">
            <button onClick={() => setCurrentView('dashboard')} className="track-back-btn">
              ← Voltar ao Painel
            </button>
            <div className="track-header-meta">
              <div className="track-tag-badge" style={{ color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.4)' }}>
                📚 Acervo de Provas
              </div>
              <h2>Provas Anteriores e Gabaritos Oficiais</h2>
              <p>
                Consulte e baixe cadernos de prova e gabaritos oficiais de seleções anteriores do PPGI UFAM.
              </p>
            </div>
          </div>

          <div className="exams-section" style={{ marginTop: '24px' }}>
            <div className="exams-section-header" style={{ marginBottom: '20px' }}>
              <div className="exams-filter-bar" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <select
                  className="form-select"
                  style={{ maxWidth: '220px', padding: '8px 12px', fontSize: '13px' }}
                  value={examFilterSemester}
                  onChange={(e) => setExamFilterSemester(e.target.value)}
                >
                  <option value="all">Todos os Semestres</option>
                  {Array.from(new Set(exams.map((e) => e.yearSemester).filter(Boolean))).map((sem) => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>

                <input
                  type="text"
                  className="search-input"
                  placeholder="Pesquisar por título ou arquivo..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  style={{ maxWidth: '320px', flex: '1 1 250px' }}
                />
              </div>
            </div>

            {(() => {
              const filtered = exams.filter((exam) => {
                const matchSearch =
                  !examSearch.trim() ||
                  (exam.title && exam.title.toLowerCase().includes(examSearch.toLowerCase())) ||
                  (exam.fileName && exam.fileName.toLowerCase().includes(examSearch.toLowerCase()))
                const matchSemester = examFilterSemester === 'all' || exam.yearSemester === examFilterSemester
                return matchSearch && matchSemester
              })

              if (filtered.length === 0) {
                return (
                  <div className="exams-empty-state">
                    <h4>Nenhuma prova disponível no momento</h4>
                    <p>
                      {exams.length === 0
                        ? 'O administrador ainda não cadastrou cadernos de prova no sistema.'
                        : 'Nenhuma prova corresponde aos filtros pesquisados.'}
                    </p>
                  </div>
                )
              }

              return (
                <div className="exams-grid">
                  {filtered.map((exam) => (
                    <article key={exam.id} className="exam-card">
                      <div className="exam-card-top">
                        <span className="year-semester-badge">{exam.yearSemester}</span>
                        <span className="doc-type-badge">{exam.docType || 'Caderno de Prova'}</span>
                      </div>

                      <h4 className="exam-card-title">{exam.title}</h4>

                      <div className="exam-card-meta">
                        <span>📄 {exam.fileName}</span>
                        {exam.fileSizeFormatted && <span>⚖️ {exam.fileSizeFormatted}</span>}
                        {exam.uploadedAt && (
                          <span>📅 {new Date(exam.uploadedAt).toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>

                      <div className="exam-card-actions">
                        {exam.previewUrl && (
                          <a
                            href={exam.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="nav-btn nav-btn-outline"
                            style={{ fontSize: '13px', padding: '8px 14px', gap: '6px' }}
                            title="Visualizar no Google Drive"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            Ver no Drive
                          </a>
                        )}
                        <a
                          href={exam.directDownloadUrl || exam.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-download-exam"
                          title="Baixar arquivo PDF diretamente"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Baixar PDF
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )
            })()}
          </div>
        </section>
      )}

      {/* ====================================================================
          VIEW 2: SELEÇÃO DE ÁREA (CA01 - Seleção de Área)
          ==================================================================== */}
      {currentView === 'select_area' && (
        <section className="select-area-view">
          <div className="select-area-header">
            <h2>Selecione sua Área de Estudo ou Foco de Prova</h2>
            <p>
              Escolha uma das áreas predefinidas do edital de seleção do PPGI UFAM. Ao confirmar, o sistema montará automaticamente sua trilha de questões personalizada.
            </p>
          </div>

          <div className="areas-grid">
            {PREDEFINED_AREAS.map((area) => {
              const isSelected = selectedAreaId === area.id
              const matchingCount = allQuestions.filter((q) => area.topics.includes(q.category)).length

              return (
                <div
                  key={area.id}
                  className={`area-option-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedAreaId(area.id)}
                >
                  <div className="area-option-top">
                    <span className="area-badge-chip">{area.badge}</span>
                    <div className="area-radio-circle">
                      {isSelected && <div className="area-radio-dot" />}
                    </div>
                  </div>

                  <h3 className="area-option-title">{area.title}</h3>
                  <p className="area-option-desc">{area.description}</p>

                  <div className="area-option-footer">
                    <span>Tópicos: <strong>{area.topics.length}</strong></span>
                    <span className="area-questions-count">
                      {matchingCount} {matchingCount === 1 ? 'questão disponível' : 'questões disponíveis'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="select-area-actions">
            <button
              onClick={() => setCurrentView(studyTrack ? 'track' : 'dashboard')}
              className="nav-btn nav-btn-outline"
            >
              Cancelar
            </button>
            <button
              onClick={handleGenerateTrack}
              className="nav-btn nav-btn-primary"
              disabled={!selectedAreaId}
            >
              Confirmar e Gerar Trilha
            </button>
          </div>
        </section>
      )}

      {/* ====================================================================
          VIEW 3: TRILHA DE ESTUDOS (Visão Geral da Trilha)
          ==================================================================== */}
      {currentView === 'track' && studyTrack && (
        <section className="study-track-view">
          {/* Top navigation within track */}
          <div className="track-top-bar">
            <button onClick={() => setCurrentView('dashboard')} className="track-back-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              Voltar ao Painel Principal
            </button>
            <button onClick={() => setCurrentView('select_area')} className="track-back-btn" style={{ borderColor: 'var(--accent)' }}>
              Alterar Foco de Prova
            </button>
          </div>

          {/* CA03 - Visual Progress Panel & Botão "Iniciar Trilha" */}
          <div className="track-progress-panel">
            <div className="track-progress-header">
              <div className="track-title-block">
                <h2>{studyTrack.areaTitle}</h2>
                <p>{studyTrack.areaDescription}</p>
              </div>
              <div className="track-percent-pill">
                {progressPercent}% Concluído
              </div>
            </div>

            {/* Big Visual Progress Bar */}
            <div className="track-progress-bar-wrap">
              <div className="track-progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>

            {/* Visual Indicators Metrics (CA03) */}
            <div className="track-metrics-grid">
              <div
                className={`metric-indicator-box ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
                title="Filtrar todas as questões"
              >
                <div className="metric-dot blue"></div>
                <div className="metric-box-info">
                  <span className="metric-box-label">Total de Itens</span>
                  <span className="metric-box-val">{totalQuestions}</span>
                </div>
              </div>

              <div
                className={`metric-indicator-box ${filterStatus === 'not_started' ? 'active' : ''}`}
                onClick={() => setFilterStatus('not_started')}
                title="Filtrar itens não iniciados"
              >
                <div className="metric-dot gray"></div>
                <div className="metric-box-info">
                  <span className="metric-box-label">Não Iniciados</span>
                  <span className="metric-box-val">{notStartedCount}</span>
                </div>
              </div>

              <div
                className={`metric-indicator-box ${filterStatus === 'in_progress' ? 'active' : ''}`}
                onClick={() => setFilterStatus('in_progress')}
                title="Filtrar itens em andamento"
              >
                <div className="metric-dot amber"></div>
                <div className="metric-box-info">
                  <span className="metric-box-label">Em Andamento</span>
                  <span className="metric-box-val">{inProgressCount}</span>
                </div>
              </div>

              <div
                className={`metric-indicator-box ${filterStatus === 'completed' ? 'active' : ''}`}
                onClick={() => setFilterStatus('completed')}
                title="Filtrar itens concluídos"
              >
                <div className="metric-dot green"></div>
                <div className="metric-box-info">
                  <span className="metric-box-label">Concluídos</span>
                  <span className="metric-box-val">{completedCount}</span>
                </div>
              </div>
            </div>

            {/* Prominent Action Banner: Botão "Iniciar Trilha" */}
            <div className="track-action-banner">
              <div className="track-action-info">
                <h3>Modo de Resposta da Trilha</h3>
                <p>Navegue diretamente de questão em questão com foco e sem distrações.</p>
              </div>
              <button onClick={() => handleStartTrack()} className="track-start-hero-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {completedCount === 0 && inProgressCount === 0
                  ? 'Iniciar Trilha'
                  : completedCount === totalQuestions
                  ? 'Revisar Trilha Completa'
                  : 'Continuar Trilha'}
              </button>
            </div>
          </div>

          {/* Track Questions List Section (Clean summary of questions, clicking opens solver at that question) */}
          <div className="track-list-section">
            <div className="track-filter-tabs">
              <button
                className={`filter-tab-btn ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                Todas ({totalQuestions})
              </button>
              <button
                className={`filter-tab-btn ${filterStatus === 'not_started' ? 'active' : ''}`}
                onClick={() => setFilterStatus('not_started')}
              >
                Não iniciadas ({notStartedCount})
              </button>
              <button
                className={`filter-tab-btn ${filterStatus === 'in_progress' ? 'active' : ''}`}
                onClick={() => setFilterStatus('in_progress')}
              >
                Em andamento ({inProgressCount})
              </button>
              <button
                className={`filter-tab-btn ${filterStatus === 'completed' ? 'active' : ''}`}
                onClick={() => setFilterStatus('completed')}
              >
                Concluídas ({completedCount})
              </button>
            </div>

            {/* Questions items */}
            {filteredQuestionsList.length === 0 ? (
              <div className="empty-track-state">
                <h3>Nenhum item com o filtro selecionado</h3>
                <p>Altere a aba de filtro para visualizar outras questões da trilha.</p>
                <button onClick={() => setFilterStatus('all')} className="nav-btn nav-btn-outline">
                  Ver Todas as Questões
                </button>
              </div>
            ) : (
              <div className="track-questions-list">
                {filteredQuestionsList.map((question, index) => {
                  let statusBadgeClass = 'not-started'
                  let statusText = '⚪ Não iniciado'

                  if (question.status === 'in_progress') {
                    statusBadgeClass = 'in-progress'
                    statusText = '🟡 Em andamento'
                  } else if (question.status === 'completed') {
                    if (question.isCorrect === true) {
                      statusBadgeClass = 'completed-correct'
                      statusText = '🟢 Concluído (Acertou ✓)'
                    } else if (question.isCorrect === false) {
                      statusBadgeClass = 'completed-incorrect'
                      statusText = '🔴 Concluído (Errou ✗)'
                    } else {
                      statusBadgeClass = 'completed-correct'
                      statusText = '🟢 Concluído'
                    }
                  }

                  // Find original question index in full study track array
                  const originalIndex = studyTrack.questions.findIndex((q) => q.id === question.id)

                  return (
                    <article
                      key={question.id}
                      className={`track-question-item ${question.status}`}
                      onClick={() => handleStartTrack(originalIndex !== -1 ? originalIndex : index)}
                      title="Clique para responder ou revisar esta questão na trilha"
                    >
                      <div className="question-item-top">
                        <div className="question-meta-tags">
                          <span className="step-badge">Etapa #{question.order || index + 1}</span>
                          <span className="category-tag">{question.category}</span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text)' }}>
                            {question.id}
                          </span>
                        </div>

                        {/* Status visual indicator (CA03) */}
                        <span className={`status-badge ${statusBadgeClass}`}>
                          {statusText}
                        </span>
                      </div>

                      <p className="question-item-prompt">{question.prompt}</p>

                      <div className="question-item-bottom">
                        <span className="author-note">Elaborado por: {question.author}</span>
                        <span className="question-click-cue">
                          {question.status === 'completed' ? 'Revisar Questão →' : 'Responder na Trilha →'}
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ====================================================================
          VIEW 4: DEDICATED FULL-PAGE TRACK SOLVER (No Popups!)
          ==================================================================== */}
      {currentView === 'track_study' && studyTrack && studyTrack.questions[activeTrackQuestionIndex] && (
        <section className="track-study-page">
          {/* Topbar navigation */}
          <div className="track-study-topbar">
            <button onClick={() => setCurrentView('track')} className="track-back-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              Voltar para a Visão Geral da Trilha
            </button>

            <div className="track-study-breadcrumb">
              <span>Trilha: <strong>{studyTrack.areaTitle}</strong></span>
              <span>•</span>
              <span>Questão <strong>{activeTrackQuestionIndex + 1}</strong> de <strong>{totalQuestions}</strong></span>
            </div>

            <div className="track-percent-pill" style={{ fontSize: '15px', padding: '4px 14px' }}>
              {progressPercent}% Concluído ({completedCount}/{totalQuestions})
            </div>
          </div>

          {/* Main Solver Layout: Sidebar + Question Main Card */}
          <div className="track-study-layout">
            {/* Sidebar Navigator between all questions of this track */}
            <aside className="track-study-sidebar">
              <div className="sidebar-track-info">
                <h3>Navegação da Trilha</h3>
                <p>Selecione qualquer questão para responder ou revisar:</p>
                <div className="mini-progress-track">
                  <div className="mini-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>

              {/* Grid of question buttons */}
              <div className="track-study-nav-grid">
                {studyTrack.questions.map((q, idx) => {
                  const isActive = idx === activeTrackQuestionIndex
                  let statusClass = 'not-started'
                  let dotClass = 'gray'

                  if (q.status === 'in_progress') {
                    statusClass = 'in-progress'
                    dotClass = 'amber'
                  } else if (q.status === 'completed') {
                    if (q.isCorrect === true) {
                      statusClass = 'completed-correct'
                      dotClass = 'green'
                    } else if (q.isCorrect === false) {
                      statusClass = 'completed-incorrect'
                      dotClass = 'red'
                    } else {
                      statusClass = 'completed-correct'
                      dotClass = 'green'
                    }
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => handleNavigateSolverQuestion(idx)}
                      className={`track-nav-btn ${statusClass} ${isActive ? 'active' : ''}`}
                      title={`Questão #${idx + 1} (${q.id}) - ${q.status}`}
                    >
                      <span className={`nav-status-indicator ${dotClass}`}></span>
                      <span>{idx + 1}</span>
                    </button>
                  )
                })}
              </div>

              <div className="track-study-sidebar-footer">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>⚪ Não iniciadas:</span>
                  <strong>{notStartedCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b' }}>
                  <span>🟡 Em andamento:</span>
                  <strong>{inProgressCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                  <span>🟢 Concluídas:</span>
                  <strong>{completedCount}</strong>
                </div>
                {completedCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent)', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                    <span>🎯 Taxa de acerto:</span>
                    <strong>{accuracyPercent}%</strong>
                  </div>
                )}
                <button
                  onClick={() => setCurrentView('track')}
                  className="nav-btn nav-btn-outline"
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  Concluir e Voltar
                </button>
              </div>
            </aside>

            {/* Dedicated Question Content */}
            {(() => {
              const currentQuestion = studyTrack.questions[activeTrackQuestionIndex]
              const isSubmitted = currentQuestion.status === 'completed'
              const userAnswer = currentQuestion.userAnswer

              return (
                <main className="track-study-main">
                  <div className="question-solver-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="step-badge">Etapa #{activeTrackQuestionIndex + 1} de {totalQuestions}</span>
                      <span className="category-tag">{currentQuestion.category}</span>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text)' }}>
                        {currentQuestion.id}
                      </span>
                    </div>

                    <div>
                      {currentQuestion.status === 'in_progress' && (
                        <span className="status-badge in-progress">🟡 Em andamento</span>
                      )}
                      {currentQuestion.status === 'completed' && currentQuestion.isCorrect === true && (
                        <span className="status-badge completed-correct">🟢 Concluído (Acertou ✓)</span>
                      )}
                      {currentQuestion.status === 'completed' && currentQuestion.isCorrect === false && (
                        <span className="status-badge completed-incorrect">🔴 Concluído (Errou ✗)</span>
                      )}
                      {currentQuestion.status === 'not_started' && (
                        <span className="status-badge not-started">⚪ Não iniciado</span>
                      )}
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <p className="question-solver-prompt">{currentQuestion.prompt}</p>

                  {/* Options List */}
                  <div className="solver-options-list">
                    {currentQuestion.options.map((option) => {
                      let optionClass = ''
                      const isSelected = selectedSolverOption === option.letter

                      if (isSubmitted) {
                        if (option.letter === currentQuestion.correctAnswer) {
                          optionClass = 'correct'
                        } else if (userAnswer === option.letter && !currentQuestion.isCorrect) {
                          optionClass = 'incorrect'
                        }
                      } else if (isSelected) {
                        optionClass = 'selected'
                      }

                      return (
                        <button
                          key={option.letter}
                          className={`solver-option-btn ${optionClass}`}
                          onClick={() => !isSubmitted && setSelectedSolverOption(option.letter)}
                          disabled={isSubmitted}
                        >
                          <span className="solver-option-letter">{option.letter}</span>
                          <span>{option.text}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Feedback alert if submitted */}
                  {isSubmitted && (
                    <div className={`solver-feedback-alert ${currentQuestion.isCorrect ? 'correct' : 'incorrect'}`}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                        {currentQuestion.isCorrect ? (
                          <polyline points="20 6 9 17 4 12" />
                        ) : (
                          <>
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </>
                        )}
                      </svg>
                      <div>
                        <strong>{currentQuestion.isCorrect ? 'Parabéns, você acertou!' : 'Resposta incorreta.'}</strong>{' '}
                        {currentQuestion.isCorrect
                          ? 'Excelente raciocínio nesta questão do edital!'
                          : `A alternativa correta é a letra ${currentQuestion.correctAnswer}.`}
                      </div>
                    </div>
                  )}

                  {/* Teacher's Explanation Commentary */}
                  {isSubmitted && currentQuestion.explanation && (
                    <div className="solver-explanation-card">
                      <h4>Comentário do Professor ({currentQuestion.author})</h4>
                      <p>{currentQuestion.explanation}</p>
                    </div>
                  )}

                  {/* Solver Footer Navigation & Actions */}
                  <div className="solver-footer-actions">
                    <div className="solver-nav-buttons">
                      <button
                        onClick={() => handleNavigateSolverQuestion(activeTrackQuestionIndex - 1)}
                        className="track-back-btn"
                        disabled={activeTrackQuestionIndex === 0}
                      >
                        ← Anterior
                      </button>
                      <button
                        onClick={() => handleNavigateSolverQuestion(activeTrackQuestionIndex + 1)}
                        className="track-back-btn"
                        disabled={activeTrackQuestionIndex === totalQuestions - 1}
                      >
                        Próxima →
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      {isSubmitted ? (
                        <>
                          <button onClick={handleRetrySolverQuestion} className="nav-btn nav-btn-outline">
                            Tentar Novamente
                          </button>
                          {activeTrackQuestionIndex < totalQuestions - 1 ? (
                            <button
                              onClick={() => handleNavigateSolverQuestion(activeTrackQuestionIndex + 1)}
                              className="nav-btn nav-btn-primary"
                            >
                              Avançar para Próxima Questão →
                            </button>
                          ) : (
                            <button onClick={() => setCurrentView('track')} className="nav-btn nav-btn-primary">
                              Finalizar Estudo da Trilha
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={handleConfirmSolverAnswer}
                          className="nav-btn nav-btn-primary"
                          disabled={!selectedSolverOption}
                        >
                          Confirmar Resposta
                        </button>
                      )}
                    </div>
                  </div>
                </main>
              )
            })()}
          </div>
        </section>
      )}
    </div>
  )
}

export default StudentArea