import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import './AdminQuestions.css'
import { INITIAL_QUESTIONS } from '../data/initialQuestions'

const PPGI_CATEGORIES = [
  'Algoritmos e Estrutura de Dados',
  'Banco de Dados',
  'Engenharia de Software',
  'Redes de Computadores',
  'Sistemas Operacionais',
  'Inteligência Artificial',
  'Teoria da Computação e Compiladores',
  'Arquitetura e Organização de Computadores',
  'Edital Geral / Matemática Discreta'
]

const SEMESTER_OPTIONS = [
  '2026/1',
  '2025/2',
  '2025/1',
  '2024/2',
  '2024/1',
  '2023/2',
  '2023/1',
  '2022/2',
  '2022/1'
]

// Helper to convert File to Base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result
      const base64 = typeof result === 'string' ? result.split(',')[1] : ''
      resolve(base64)
    }
    reader.onerror = (err) => reject(err)
  })
}

// Helper to format bytes
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function AdminQuestions({ onNavigate }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSeeding, setIsSeeding] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)

  // Search Filter State
  const [searchTerm, setSearchTerm] = useState('')

  // Edit/Add Question Modal States (Manual)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editOptions, setEditOptions] = useState([])
  const [editCorrectAnswer, setEditCorrectAnswer] = useState('A')
  const [editExplanation, setEditExplanation] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // AI Question Importer States
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [aiStep, setAiStep] = useState('upload') // 'upload' | 'extracting' | 'review'
  const [aiExamFile, setAiExamFile] = useState(null)
  const [aiAnswerKeyFile, setAiAnswerKeyFile] = useState(null)
  const [aiYearSemester, setAiYearSemester] = useState('2025/1')
  const [aiAuthor, setAiAuthor] = useState('Banca PPGI UFAM')
  const [extractedQuestions, setExtractedQuestions] = useState([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSavingBatch, setIsSavingBatch] = useState(false)
  const [aiErrorMessage, setAiErrorMessage] = useState(null)
  const [reviewCategoryFilter, setReviewCategoryFilter] = useState('all')
  const [reviewSearch, setReviewSearch] = useState('')

  const examInputRef = useRef(null)
  const answerKeyInputRef = useRef(null)

  // 1. Listen to Cloud Firestore real-time updates (onSnapshot)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'questions'),
      (snapshot) => {
        const questionsData = []
        snapshot.forEach((d) => {
          questionsData.push({ id: d.id, ...d.data() })
        })

        // Sort questions alphabetically by ID
        questionsData.sort((a, b) => a.id.localeCompare(b.id))

        setQuestions(questionsData)
        setLoading(false)
      },
      (error) => {
        console.error('Firestore Loading Error (Check Security Rules):', error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // Helper to trigger subtle toast notifications
  const showToast = (message) => {
    setToastMessage(message)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  // 2. Open Add Modal Manual
  const handleOpenAddModal = () => {
    let nextId = 'Q-101'
    if (questions.length > 0) {
      const idNumbers = questions.map((q) => {
        const num = parseInt(q.id.replace('Q-', ''), 10)
        return isNaN(num) ? 0 : num
      })
      const maxId = Math.max(...idNumbers)
      nextId = `Q-${maxId + 1}`
    }

    setEditingQuestion({ id: nextId, isNew: true })
    setEditPrompt('')
    setEditCategory('Algoritmos e Estrutura de Dados')
    setEditAuthor('Banca PPGI UFAM')
    setEditOptions([
      { letter: 'A', text: '' },
      { letter: 'B', text: '' },
      { letter: 'C', text: '' },
      { letter: 'D', text: '' },
      { letter: 'E', text: '' }
    ])
    setEditCorrectAnswer('A')
    setEditExplanation('')
  }

  // 3. Open Edit Modal Manual
  const handleOpenEditModal = (q) => {
    setEditingQuestion({ id: q.id, isNew: false })
    setEditPrompt(q.prompt || '')
    setEditCategory(q.category || '')
    setEditAuthor(q.author || '')
    setEditOptions(
      q.options
        ? [...q.options]
        : [
            { letter: 'A', text: '' },
            { letter: 'B', text: '' },
            { letter: 'C', text: '' },
            { letter: 'D', text: '' },
            { letter: 'E', text: '' }
          ]
    )
    setEditCorrectAnswer(q.correctAnswer || 'A')
    setEditExplanation(q.explanation || '')
  }

  // 4. Save Single Question
  const handleSaveQuestion = async () => {
    if (!editPrompt.trim() || !editCategory.trim() || !editAuthor.trim()) {
      alert('Por favor, preencha o enunciado, assunto e o autor da questão.')
      return
    }

    const hasEmptyOption = editOptions.some((o) => !o.text.trim())
    if (hasEmptyOption) {
      alert('Todas as 5 alternativas de respostas precisam estar preenchidas.')
      return
    }

    setIsSaving(true)
    try {
      const docRef = doc(db, 'questions', editingQuestion.id)
      const questionPayload = {
        category: editCategory,
        prompt: editPrompt,
        author: editAuthor,
        options: editOptions,
        correctAnswer: editCorrectAnswer,
        explanation: editExplanation
      }

      await setDoc(docRef, questionPayload)

      const successMessage = editingQuestion.isNew
        ? `Questão ${editingQuestion.id} criada com sucesso no Firestore!`
        : `Questão ${editingQuestion.id} atualizada com sucesso no Firestore!`

      setEditingQuestion(null)
      showToast(successMessage)
    } catch (err) {
      console.error('Error writing document to Firestore:', err)
      alert('Erro ao gravar no Firestore. Certifique-se de que suas regras de segurança permitem gravação.')
    } finally {
      setIsSaving(false)
    }
  }

  // 5. Delete Question
  const handleDeleteQuestion = async (qId) => {
    const confirmDelete = window.confirm(`Deseja realmente excluir a questão ${qId}?`)
    if (!confirmDelete) return

    try {
      await deleteDoc(doc(db, 'questions', qId))
      showToast(`Questão ${qId} excluída com sucesso.`)
    } catch (err) {
      console.error('Erro ao deletar documento:', err)
      alert('Falha ao excluir documento do Firestore.')
    }
  }

  // 6. Seed Database
  const handleSeedDatabase = async () => {
    setIsSeeding(true)
    try {
      for (const question of INITIAL_QUESTIONS) {
        const docRef = doc(db, 'questions', question.id)
        await setDoc(docRef, question)
      }
      showToast('Banco semeado com 18 questões acadêmicas do PPGI!')
    } catch (err) {
      console.error('Erro ao semear banco de questões:', err)
      alert('Erro ao semear banco de questões. Verifique as regras do Firestore.')
    } finally {
      setIsSeeding(false)
    }
  }

  // =========================================================================
  // AI QUESTION IMPORTER HANDLERS (Gemini 2.0 Flash)
  // =========================================================================

  // Helper para extrair chave de qualquer formato de documento salvo no Firestore
  const pickKeyFromData = (dataObj) => {
    if (!dataObj || typeof dataObj !== 'object') return null
    const candidates = [
      dataObj.apiKey,
      dataObj.GEMINI_API_KEY,
      dataObj.geminiApiKey,
      dataObj.api_key,
      dataObj.token,
      dataObj.key,
      dataObj.value,
      dataObj.gemini
    ]
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 10) {
        return c.trim()
      }
    }
    for (const [k, v] of Object.entries(dataObj)) {
      if (k === 'updatedAt' || k === 'createdAt') continue
      if (typeof v === 'string' && v.trim().length > 10) {
        return v.trim()
      }
    }
    return null
  }

  const fetchGeminiKeyFromClientFirestore = async () => {
    // 1. Tenta settings/gemini diretamente
    try {
      const directSnap = await getDoc(doc(db, 'settings', 'gemini'))
      if (directSnap.exists()) {
        const found = pickKeyFromData(directSnap.data())
        if (found) return found
      }
    } catch {
      // ignore
    }

    // 2. Tenta qualquer documento dentro das coleções settings, gemini, config ou tokens
    for (const colName of ['settings', 'gemini', 'config', 'tokens']) {
      try {
        const colSnap = await getDocs(collection(db, colName))
        for (const d of colSnap.docs) {
          const found = pickKeyFromData(d.data())
          if (found) return found
        }
      } catch {
        // ignore
      }
    }

    return null
  }

  const handleExtractWithGemini = async () => {
    if (!aiExamFile) {
      alert('Por favor, selecione ou arraste o arquivo PDF do caderno de questões.')
      return
    }

    setIsExtracting(true)
    setAiErrorMessage(null)
    setAiStep('extracting')

    try {
      const examPdfBase64 = await fileToBase64(aiExamFile)
      let answerKeyPdfBase64 = null
      if (aiAnswerKeyFile) {
        answerKeyPdfBase64 = await fileToBase64(aiAnswerKeyFile)
      }

      // Busca o token do Gemini direto do Firestore pelo SDK autenticado do cliente (se existir)
      const firestoreApiKey = await fetchGeminiKeyFromClientFirestore()

      const response = await fetch('/api/extract-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examPdfBase64,
          answerKeyPdfBase64,
          yearSemester: aiYearSemester,
          author: aiAuthor,
          apiKey: firestoreApiKey
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Falha ao processar PDF com Gemini.')
      }

      if (!data.questions || data.questions.length === 0) {
        throw new Error('Nenhuma questão de múltipla escolha pôde ser identificada no arquivo.')
      }

      setExtractedQuestions(data.questions)
      setAiStep('review')
    } catch (err) {
      console.error('Erro na extração IA:', err)
      setAiErrorMessage(err.message)
      setAiStep('upload')
    } finally {
      setIsExtracting(false)
    }
  }

  // Save Batch of Extracted Questions to Cloud Firestore
  const handleSaveExtractedQuestions = async () => {
    if (extractedQuestions.length === 0) return

    const confirmSave = window.confirm(
      `Deseja importar todas as ${extractedQuestions.length} questões revisadas para o banco de dados do Firestore?`
    )
    if (!confirmSave) return

    setIsSavingBatch(true)
    try {
      // Find maximum numeric ID currently active
      let currentMaxNum = 100
      questions.forEach((q) => {
        const num = parseInt(q.id.replace('Q-', ''), 10)
        if (!isNaN(num) && num > currentMaxNum) {
          currentMaxNum = num
        }
      })

      let addedCount = 0
      for (const q of extractedQuestions) {
        currentMaxNum++
        const newId = `Q-${currentMaxNum}`
        const payload = {
          category: q.category,
          prompt: q.prompt,
          author: q.author || `${aiAuthor} (${aiYearSemester})`,
          options: q.options,
          correctAnswer: q.correctAnswer || 'A',
          explanation: q.explanation || ''
        }
        await setDoc(doc(db, 'questions', newId), payload)
        addedCount++
      }

      showToast(`🎉 ${addedCount} questões importadas com sucesso para o banco de dados!`)
      setIsAiModalOpen(false)
      setExtractedQuestions([])
      setAiExamFile(null)
      setAiAnswerKeyFile(null)
      setAiStep('upload')
    } catch (err) {
      console.error('Erro ao salvar lote no Firestore:', err)
      alert(`Erro ao salvar questões no Firestore: ${err.message}`)
    } finally {
      setIsSavingBatch(false)
    }
  }

  const handleUpdateExtractedQuestion = (idx, field, value) => {
    setExtractedQuestions((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: value }
      return copy
    })
  }

  const handleUpdateOption = (qIdx, optIdx, text) => {
    setExtractedQuestions((prev) => {
      const copy = [...prev]
      const opts = [...copy[qIdx].options]
      opts[optIdx] = { ...opts[optIdx], text }
      copy[qIdx] = { ...copy[qIdx], options: opts }
      return copy
    })
  }

  const handleRemoveExtractedQuestion = (idx) => {
    setExtractedQuestions((prev) => prev.filter((_, i) => i !== idx))
  }

  // Filter questions for general listing
  const filteredQuestions = questions.filter((q) => {
    const term = searchTerm.toLowerCase()
    return (
      (q.id && q.id.toLowerCase().includes(term)) ||
      (q.category && q.category.toLowerCase().includes(term)) ||
      (q.prompt && q.prompt.toLowerCase().includes(term)) ||
      (q.author && q.author.toLowerCase().includes(term))
    )
  })

  // Filter for review modal
  const filteredReviewQuestions = extractedQuestions.filter((q) => {
    const matchCat = reviewCategoryFilter === 'all' || q.category === reviewCategoryFilter
    const matchSearch =
      !reviewSearch.trim() ||
      q.prompt.toLowerCase().includes(reviewSearch.toLowerCase()) ||
      q.category.toLowerCase().includes(reviewSearch.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="admin-container">
      {/* Toast alert indicator */}
      {toastMessage && (
        <div
          className="auth-alert success"
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 1000,
            boxShadow: 'var(--shadow)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <svg className="auth-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Admin Tab Navigation */}
      <nav style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1.5px solid var(--border)', paddingBottom: '12px' }}>
        <button
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: '1px solid var(--accent)',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(170, 59, 255, 0.3)'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Banco de Questões
        </button>

        <button
          onClick={() => onNavigate && onNavigate('admin-exams')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text)',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload de Provas (Google Drive)
        </button>
      </nav>

      {/* Admin header */}
      <div className="admin-header-row">
        <div className="admin-header-info">
          <h1 className="admin-portal-title">Banco de Questões</h1>
          <p className="admin-portal-subtitle">
            Gerencie o acervo de questões do PPGI UFAM ou importe provas completas em PDF via Inteligência Artificial.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* AI Question Importer Trigger Button */}
          <button
            onClick={() => {
              setIsAiModalOpen(true)
              setAiStep('upload')
              setAiErrorMessage(null)
            }}
            className="admin-btn-ai"
            title="Importar prova e gabarito em PDF automaticamente via IA Gemini"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span>✨ Importar Prova com IA (PDF)</span>
          </button>

          {/* Add Manual Button */}
          <button onClick={handleOpenAddModal} className="admin-btn-add">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Adicionar Manualmente</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', borderTopColor: 'var(--accent)', borderWidth: '3px', borderColor: 'var(--border)' }}></div>
          <p style={{ marginTop: '16px', color: 'var(--text)', fontSize: '15px' }}>Carregando questões do Firestore...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="admin-empty-state">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="empty-state-title">Nenhuma questão cadastrada</h3>
          <p className="empty-state-description">
            O banco de dados está vazio. Você pode semear com 18 questões padrão ou clicar em <strong>"Importar Prova com IA (PDF)"</strong> para extrair questões de provas anteriores automaticamente!
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
            <button
              onClick={() => {
                setIsAiModalOpen(true)
                setAiStep('upload')
              }}
              className="admin-btn-ai"
            >
              ✨ Importar via PDF (IA)
            </button>
            <button
              onClick={handleSeedDatabase}
              className="admin-btn-add"
              disabled={isSeeding}
            >
              {isSeeding ? 'Semeando...' : 'Semear 18 Questões Padrão'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Real-time Filter Search Bar */}
          <div className="admin-search-wrapper">
            <div className="search-input-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              className="admin-search-input"
              placeholder="Buscar por ID (ex: Q-101), disciplina, enunciado ou autor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="search-clear-button"
                onClick={() => setSearchTerm('')}
                title="Limpar busca"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="search-no-results">
              <h4 className="search-no-results-title">Nenhuma questão encontrada</h4>
              <p className="search-no-results-desc">Nenhum resultado corresponde ao termo "{searchTerm}".</p>
            </div>
          ) : (
            <div className="questions-list">
              {filteredQuestions.map((q) => (
                <div key={q.id} className="question-card">
                  <div className="question-card-header">
                    <div className="question-meta-chips">
                      <span className="question-id-chip">{q.id}</span>
                      <span className="question-category-chip">{q.category}</span>
                      <span className="question-author-chip">{q.author}</span>
                    </div>

                    <div className="question-actions">
                      <button
                        onClick={() => handleOpenEditModal(q)}
                        className="btn-action edit"
                        title="Editar questão"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="btn-action delete"
                        title="Excluir questão"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <p className="question-prompt">{q.prompt}</p>

                  <div className="options-grid">
                    {q.options &&
                      q.options.map((opt) => {
                        const isCorrect = opt.letter === q.correctAnswer
                        return (
                          <div
                            key={opt.letter}
                            className={`option-item ${isCorrect ? 'correct' : ''}`}
                          >
                            <span className="option-badge">{opt.letter}</span>
                            <span className="option-text">{opt.text}</span>
                            {isCorrect && (
                              <span className="correct-tag" style={{ marginLeft: 'auto' }}>
                                Gabarito
                              </span>
                            )}
                          </div>
                        )
                      })}
                  </div>

                  {q.explanation && (
                    <div
                      style={{
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '13px',
                        color: 'var(--text)',
                        lineHeight: '1.5'
                      }}
                    >
                      <strong style={{ color: 'var(--text-h)' }}>Comentário da Banca: </strong>
                      {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          AI QUESTION IMPORTER MODAL (GEMINI 2.0 FLASH)
          ===================================================================== */}
      {isAiModalOpen && (
        <div className="ai-modal-overlay">
          <div className="ai-modal-container">
            {/* Modal Header */}
            <header className="ai-modal-header">
              <div>
                <h2>
                  <span>✨ Importador Inteligente de Provas</span>
                  <span style={{ fontSize: '12px', background: 'var(--accent)', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>
                    Gemini 3.8 Flash
                  </span>
                </h2>
                <p>
                  {aiStep === 'upload' &&
                    'Envie o caderno de provas em PDF (e opcionalmente o gabarito). A IA do Gemini detecta enunciados, alternativas e vincula as respostas automaticamente.'}
                  {aiStep === 'extracting' && 'Processando o documento com Inteligência Artificial multimodal...'}
                  {aiStep === 'review' &&
                    `Revise e edite as ${extractedQuestions.length} questões detectadas antes de salvar definitivamente no Firestore.`}
                </p>
              </div>

              <button
                onClick={() => {
                  if (isExtracting || isSavingBatch) return
                  setIsAiModalOpen(false)
                }}
                className="ai-btn-close"
                title="Fechar modal"
              >
                ✕
              </button>
            </header>

            {/* Modal Body: STEP 1 - UPLOAD */}
            {aiStep === 'upload' && (
              <div className="ai-modal-body">
                {aiErrorMessage && (
                  <div
                    style={{
                      padding: '14px 18px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      fontSize: '14px'
                    }}
                  >
                    ❌ <strong>Erro no processamento:</strong> {aiErrorMessage}
                  </div>
                )}

                <div className="ai-dropzone-grid">
                  {/* Slot 1: Caderno de Provas (Obrigatório) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-h)', marginBottom: '8px' }}>
                      1. Caderno de Questões (PDF) *
                    </label>
                    <div
                      className="ai-dropzone"
                      onClick={() => examInputRef.current && examInputRef.current.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          setAiExamFile(e.dataTransfer.files[0])
                        }
                      }}
                    >
                      <input
                        type="file"
                        ref={examInputRef}
                        accept=".pdf,application/pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => e.target.files && setAiExamFile(e.target.files[0])}
                      />
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                      <div className="ai-dropzone-title">
                        {aiExamFile ? 'Substituir Prova (PDF)' : 'Selecionar ou Arrastar Prova (PDF)'}
                      </div>
                      <div className="ai-dropzone-subtitle">Contendo as questões do exame</div>

                      {aiExamFile && (
                        <div className="ai-file-badge" onClick={(e) => e.stopPropagation()}>
                          <span className="ai-file-name">📄 {aiExamFile.name}</span>
                          <span style={{ fontSize: '11px', opacity: 0.8 }}>{formatBytes(aiExamFile.size)}</span>
                          <button
                            type="button"
                            className="ai-btn-remove-file"
                            onClick={() => setAiExamFile(null)}
                            title="Remover arquivo"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Slot 2: Gabarito Oficial Separado (Opcional) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: 'var(--text-h)', marginBottom: '8px' }}>
                      2. Gabarito Oficial (PDF) <span style={{ fontWeight: 'normal', opacity: 0.7 }}>(Opcional)</span>
                    </label>
                    <div
                      className="ai-dropzone"
                      onClick={() => answerKeyInputRef.current && answerKeyInputRef.current.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          setAiAnswerKeyFile(e.dataTransfer.files[0])
                        }
                      }}
                    >
                      <input
                        type="file"
                        ref={answerKeyInputRef}
                        accept=".pdf,application/pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => e.target.files && setAiAnswerKeyFile(e.target.files[0])}
                      />
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 11 12 14 22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      <div className="ai-dropzone-title">
                        {aiAnswerKeyFile ? 'Substituir Gabarito' : 'Gabarito Separado (Se houver)'}
                      </div>
                      <div className="ai-dropzone-subtitle">Deixe vazio se o gabarito estiver no final da prova</div>

                      {aiAnswerKeyFile && (
                        <div className="ai-file-badge" onClick={(e) => e.stopPropagation()}>
                          <span className="ai-file-name">✅ {aiAnswerKeyFile.name}</span>
                          <span style={{ fontSize: '11px', opacity: 0.8 }}>{formatBytes(aiAnswerKeyFile.size)}</span>
                          <button
                            type="button"
                            className="ai-btn-remove-file"
                            onClick={() => setAiAnswerKeyFile(null)}
                            title="Remover arquivo"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edital Metadata Form Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Ano / Semestre do Edital</label>
                    <select
                      className="auth-input"
                      value={aiYearSemester}
                      onChange={(e) => setAiYearSemester(e.target.value)}
                    >
                      {SEMESTER_OPTIONS.map((sem) => (
                        <option key={sem} value={sem}>
                          {sem}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Banca / Autor</label>
                    <input
                      type="text"
                      className="auth-input"
                      value={aiAuthor}
                      onChange={(e) => setAiAuthor(e.target.value)}
                      placeholder="Ex: Banca PPGI UFAM"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Modal Body: STEP 2 - EXTRACTING LOADER */}
            {aiStep === 'extracting' && (
              <div className="ai-modal-body">
                <div className="ai-extracting-box">
                  <div className="ai-pulse-spinner">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '20px', color: 'var(--text-h)', margin: 0 }}>
                    Analisando Prova com Google Gemini 3.8 Flash...
                  </h3>
                  <p style={{ color: 'var(--text)', maxWidth: '480px', margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                    A IA está processando o PDF, separando os enunciados, tabelas e trechos de código, identificando as 5 alternativas e correlacionando o gabarito oficial.
                  </p>
                </div>
              </div>
            )}

            {/* Modal Body: STEP 3 - REVIEW EXTRACTED QUESTIONS */}
            {aiStep === 'review' && (
              <div className="ai-modal-body">
                {/* Review Header Filters */}
                <div className="ai-review-header-bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#22c55e' }}>
                      ✅ {extractedQuestions.length} Questões Encontradas
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                    <select
                      className="auth-input"
                      style={{ maxWidth: '240px', padding: '8px 12px', fontSize: '13px' }}
                      value={reviewCategoryFilter}
                      onChange={(e) => setReviewCategoryFilter(e.target.value)}
                    >
                      <option value="all">Todas as Disciplinas</option>
                      {PPGI_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      className="auth-input"
                      style={{ maxWidth: '240px', padding: '8px 12px', fontSize: '13px' }}
                      placeholder="Filtrar por texto..."
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Review Cards List */}
                <div className="ai-extracted-cards-list">
                  {filteredReviewQuestions.map((q, qIndex) => {
                    const originalIndex = extractedQuestions.findIndex((orig) => orig.tempId === q.tempId)
                    return (
                      <article key={q.tempId || qIndex} className="ai-extracted-card">
                        <div className="ai-extracted-card-top">
                          <span className="ai-question-num-badge">Questão {qIndex + 1}</span>

                          {/* Category selector */}
                          <select
                            className="auth-input"
                            style={{ maxWidth: '300px', padding: '6px 10px', fontSize: '13px' }}
                            value={q.category}
                            onChange={(e) => handleUpdateExtractedQuestion(originalIndex, 'category', e.target.value)}
                          >
                            {PPGI_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>

                          {/* Discard / Delete button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveExtractedQuestion(originalIndex)}
                            className="btn-action delete"
                            title="Descartar esta questão (ex: anulada)"
                            style={{ marginLeft: 'auto' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>

                        {/* Enunciado (Textarea) */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Enunciado da Questão</label>
                          <textarea
                            className="auth-textarea"
                            rows={4}
                            value={q.prompt}
                            onChange={(e) => handleUpdateExtractedQuestion(originalIndex, 'prompt', e.target.value)}
                          />
                        </div>

                        {/* 5 Alternativas */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label className="form-label" style={{ margin: 0 }}>
                            Alternativas (Clique na letra para marcar o gabarito oficial)
                          </label>
                          {q.options.map((opt, optIdx) => {
                            const isCorrect = opt.letter === q.correctAnswer
                            return (
                              <div key={opt.letter} className="ai-extracted-option-row">
                                <button
                                  type="button"
                                  className={`ai-option-letter-btn ${isCorrect ? 'is-correct' : ''}`}
                                  onClick={() => handleUpdateExtractedQuestion(originalIndex, 'correctAnswer', opt.letter)}
                                  title={`Marcar ${opt.letter} como alternativa correta`}
                                >
                                  {opt.letter}
                                </button>
                                <input
                                  type="text"
                                  className="auth-input"
                                  style={{ padding: '8px 12px', fontSize: '13px' }}
                                  value={opt.text}
                                  onChange={(e) => handleUpdateOption(originalIndex, optIdx, e.target.value)}
                                />
                                {isCorrect && (
                                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#22c55e', whiteSpace: 'nowrap' }}>
                                    ✓ Correta
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Justificativa / Comentário */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Comentário / Justificativa da Banca</label>
                          <input
                            type="text"
                            className="auth-input"
                            style={{ padding: '8px 12px', fontSize: '13px' }}
                            value={q.explanation || ''}
                            onChange={(e) => handleUpdateExtractedQuestion(originalIndex, 'explanation', e.target.value)}
                            placeholder="Comentário sobre a resolução da questão..."
                          />
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Modal Footer Actions */}
            <footer className="ai-modal-footer">
              {aiStep === 'upload' && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsAiModalOpen(false)}
                    className="nav-btn nav-btn-outline"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExtractWithGemini}
                    className="admin-btn-ai"
                    disabled={!aiExamFile}
                    style={{ opacity: !aiExamFile ? 0.5 : 1 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>Iniciar Extração com Gemini</span>
                  </button>
                </>
              )}

              {aiStep === 'extracting' && (
                <div style={{ width: '100%', textAlign: 'center', color: 'var(--text)', fontSize: '13px' }}>
                  Aguarde, este processo pode levar entre 10 a 20 segundos dependendo do tamanho da prova...
                </div>
              )}

              {aiStep === 'review' && (
                <>
                  <button
                    type="button"
                    onClick={() => setAiStep('upload')}
                    className="nav-btn nav-btn-outline"
                    disabled={isSavingBatch}
                  >
                    ← Enviar Outro PDF
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveExtractedQuestions}
                    className="nav-btn nav-btn-primary"
                    disabled={isSavingBatch || extractedQuestions.length === 0}
                    style={{ background: '#22c55e', borderColor: '#22c55e' }}
                  >
                    {isSavingBatch ? (
                      <>
                        <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                        <span>Salvando no Firestore...</span>
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" />
                          <polyline points="7 3 7 8 15 8" />
                        </svg>
                        <span>Salvar {extractedQuestions.length} Questões no Banco</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      )}

      {/* =====================================================================
          MANUAL ADD/EDIT MODAL
          ===================================================================== */}
      {editingQuestion && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editingQuestion.isNew ? 'Adicionar Nova Questão' : `Editar Questão ${editingQuestion.id}`}
              </h2>
              <button
                onClick={() => setEditingQuestion(null)}
                className="admin-modal-close"
                disabled={isSaving}
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="form-group">
                <label className="form-label">Identificador da Questão (ID)</label>
                <input
                  type="text"
                  className="auth-input"
                  value={editingQuestion.id}
                  disabled
                  style={{ background: 'var(--border)', cursor: 'not-allowed', opacity: 0.8 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Enunciado da Questão</label>
                <textarea
                  className="auth-textarea"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  disabled={isSaving}
                  placeholder="Digite aqui o texto / problema da questão..."
                  rows={4}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Assunto / Matéria</label>
                  <select
                    className="auth-input"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    disabled={isSaving}
                  >
                    {PPGI_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Professor / Banca Autora</label>
                  <input
                    type="text"
                    className="auth-input"
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                    disabled={isSaving}
                    placeholder="Ex: Banca PPGI UFAM"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">As 5 Alternativas</label>
                <div className="options-edit-grid">
                  {editOptions.map((opt, index) => (
                    <div key={opt.letter} className="option-edit-row">
                      <span className="option-letter-badge">{opt.letter}</span>
                      <input
                        type="text"
                        className="auth-input"
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...editOptions]
                          updated[index] = { ...opt, text: e.target.value }
                          setEditOptions(updated)
                        }}
                        disabled={isSaving}
                        placeholder={`Digite a alternativa ${opt.letter}...`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group correct-select-wrapper">
                <label className="form-label">Gabarito Oficial (Alternativa Correta)</label>
                <select
                  className="auth-input"
                  value={editCorrectAnswer}
                  onChange={(e) => setEditCorrectAnswer(e.target.value)}
                  disabled={isSaving}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="A">Alternativa A</option>
                  <option value="B">Alternativa B</option>
                  <option value="C">Alternativa C</option>
                  <option value="D">Alternativa D</option>
                  <option value="E">Alternativa E</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Comentário / Explicação da Banca</label>
                <textarea
                  className="auth-textarea"
                  value={editExplanation}
                  onChange={(e) => setEditExplanation(e.target.value)}
                  disabled={isSaving}
                  placeholder="Justificativa da alternativa correta..."
                  rows={3}
                />
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="nav-btn nav-btn-outline"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveQuestion}
                className="nav-btn nav-btn-primary"
                disabled={isSaving}
                style={{ background: 'var(--accent)' }}
              >
                {isSaving ? 'Gravando...' : editingQuestion.isNew ? 'Criar Questão' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminQuestions
