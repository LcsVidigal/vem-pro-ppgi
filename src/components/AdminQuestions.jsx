import { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import './AdminQuestions.css'

// Master list of academic questions expanded to exactly 5 options (A, B, C, D, E)
const INITIAL_QUESTIONS = [
  {
    id: 'Q-101',
    category: 'Estruturas de Dados e Algoritmos',
    prompt: 'Qual é a complexidade de tempo no pior caso para a busca e inserção de um elemento em uma Árvore Binária de Busca Balanceada (como uma Árvore AVL ou Rubro-Negra) contendo n elementos?',
    options: [
      { letter: 'A', text: 'O(1) - Tempo constante independente do tamanho da estrutura de dados.' },
      { letter: 'B', text: 'O(log n) - Tempo logarítmico proporcional à altura máxima balanceada da árvore.' },
      { letter: 'C', text: 'O(n) - Tempo linear equivalente ao pior caso de uma árvore totalmente degenerada.' },
      { letter: 'D', text: 'O(n log n) - Tempo linearitmo comumente associado ao limite inferior de ordenação por comparação.' },
      { letter: 'E', text: 'O(n²) - Tempo quadrático típico de algoritmos ineficientes como Bubble Sort ou Selection Sort.' }
    ],
    correctAnswer: 'B',
    author: 'Prof. Dr. Ricardo Silva'
  },
  {
    id: 'Q-102',
    category: 'Sistemas de Bancos de Dados',
    prompt: 'No contexto do controle de concorrência em sistemas transacionais de bancos de dados (SGBDs), qual das seguintes propriedades ACID garante que todas as operações de uma transação sejam executadas por completo ou nenhuma delas seja aplicada ao disco?',
    options: [
      { letter: 'A', text: 'Atomicidade - Princípio indivisível do "tudo ou nada" que previne estados parciais e inconsistentes.' },
      { letter: 'B', text: 'Consistência - Exigência de que a transação mova o banco de dados de um estado íntegro para outro.' },
      { letter: 'C', text: 'Isolamento - Proteção que impede transações simultâneas de interferirem entre si antes da conclusão.' },
      { letter: 'D', text: 'Durabilidade - Garantia de que modificações confirmadas persistam mesmo após colapsos elétricos ou do SO.' },
      { letter: 'E', text: 'Redundância - Capacidade estrutural de espelhar blocos de dados transacionados para tolerância de falhas físicas.' }
    ],
    correctAnswer: 'A',
    author: 'Profª. Dra. Marina Costa'
  },
  {
    id: 'Q-103',
    category: 'Redes de Computadores',
    prompt: 'Qual dos seguintes protocolos da camada de aplicação do modelo TCP/IP utiliza o protocolo de transporte UDP (porta 53) por padrão para realizar a tradução de nomes de domínio amigáveis em addresses IP numéricos legíveis por roteadores?',
    options: [
      { letter: 'A', text: 'DHCP (Dynamic Host Configuration Protocol) - Utilizado para alocação automática de endereços de rede.' },
      { letter: 'B', text: 'HTTP (Hypertext Transfer Protocol) - Protocolo voltado à transferência de documentos hipermídia na Web.' },
      { letter: 'C', text: 'DNS (Domain Name System) - Sistema hierárquico distribuído responsável por resolução de hosts.' },
      { letter: 'D', text: 'FTP (File Transfer Protocol) - Mecanismo seguro voltado para transferência de arquivos em fluxo contínuo.' },
      { letter: 'E', text: 'SMTP (Simple Mail Transfer Protocol) - Protocolo padrão para transferência confiável de correio eletrônico.' }
    ],
    correctAnswer: 'C',
    author: 'Prof. Dr. Carlos Eduardo'
  }
]

function AdminQuestions() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSeeding, setIsSeeding] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)

  // Search Filter State
  const [searchTerm, setSearchTerm] = useState('')

  // Edit/Add Question Modal States
  const [editingQuestion, setEditingQuestion] = useState(null) // Holds { id, isNew: boolean } or real question
  const [editPrompt, setEditPrompt] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editOptions, setEditOptions] = useState([])
  const [editCorrectAnswer, setEditCorrectAnswer] = useState('A')
  const [editExplanation, setEditExplanation] = useState('')
  const [editPublished, setEditPublished] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 1. Listen to Cloud Firestore real-time updates (onSnapshot)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "questions"), (snapshot) => {
      const questionsData = []
      snapshot.forEach((doc) => {
        questionsData.push({ id: doc.id, ...doc.data() })
      })
      
      // Sort questions alphabetically by ID to keep the listing aligned
      questionsData.sort((a, b) => a.id.localeCompare(b.id))
      
      setQuestions(questionsData)
      setLoading(false)
    }, (error) => {
      console.error("Firestore Loading Error (Check Security Rules):", error)
      setLoadError('Não foi possível carregar as questões. Verifique sua conexão e permissão de administrador.')
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Helper to trigger subtle toast notifications
  const showToast = (message) => {
    setToastMessage(message)
    setTimeout(() => {
      setToastMessage(null)
    }, 3500)
  }

  // Firestore IDs avoid collisions between administrators creating questions concurrently.
  const handleOpenAddModal = () => {
    setEditingQuestion({ id: doc(collection(db, 'questions')).id, isNew: true })
    setEditPrompt('')
    setEditCategory('')
    setEditAuthor('')
    setEditOptions([
      { letter: 'A', text: '' },
      { letter: 'B', text: '' },
      { letter: 'C', text: '' },
      { letter: 'D', text: '' },
      { letter: 'E', text: '' }
    ])
    setEditCorrectAnswer('A')
    setEditExplanation('')
    setEditPublished(false)
  }

  // 3. Open Edit Modal with selected question's current data
  const handleOpenEditModal = (q) => {
    setEditingQuestion({ id: q.id, isNew: false })
    setEditPrompt(q.prompt || '')
    setEditCategory(q.category || '')
    setEditAuthor(q.author || '')
    setEditOptions(q.options ? [...q.options] : [
      { letter: 'A', text: '' },
      { letter: 'B', text: '' },
      { letter: 'C', text: '' },
      { letter: 'D', text: '' },
      { letter: 'E', text: '' }
    ])
    setEditCorrectAnswer(q.correctAnswer || 'A')
    setEditExplanation(q.explanation || '')
    setEditPublished(q.published === true)
  }

  // 4. Submit Add or Edit modifications directly to Firestore Database
  const handleSaveQuestion = async () => {
    if (!editExplanation.trim()) {
      alert('Preencha a resolução detalhada da questão.')
      return
    }
    if (!editPrompt.trim() || !editCategory.trim() || !editAuthor.trim()) {
      alert("Por favor, preencha o enunciado, assunto e o autor da questão.")
      return
    }

    const hasEmptyOption = editOptions.some(o => !o.text.trim())
    if (hasEmptyOption) {
      alert("Todas as 5 alternativas de respostas precisam estar preenchidas.")
      return
    }

    setIsSaving(true)
    try {
      const docRef = doc(db, "questions", editingQuestion.id)
      const questionPayload = {
        category: editCategory.trim(),
        prompt: editPrompt.trim(),
        author: editAuthor.trim(),
        options: editOptions.map(({ letter, text }) => ({ letter, text: text.trim() })),
        correctAnswer: editCorrectAnswer,
        explanation: editExplanation.trim(),
        published: editPublished
      }

      // Write directly to Cloud Firestore (Works for both creation and updates)
      await setDoc(docRef, questionPayload)
      
      const successMessage = editingQuestion.isNew 
        ? `Questão ${editingQuestion.id} criada com sucesso no Firestore!`
        : `Questão ${editingQuestion.id} atualizada com sucesso no Firestore!`
      
      setEditingQuestion(null) // Close modal
      showToast(successMessage)
    } catch (err) {
      console.error("Error writing document to Firestore:", err)
      alert("Erro ao gravar no Firestore. Certifique-se de que suas regras de segurança permitem gravação.")
    } finally {
      setIsSaving(false)
    }
  }

  // 5. Delete Question directly from Cloud Firestore Database
  const handleDeleteQuestion = async (id) => {
    const confirmDelete = window.confirm(`⚠️ Tem certeza de que deseja excluir a questão ${id} permanentemente do Cloud Firestore?`)
    
    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, "questions", id))
        showToast(`Questão ${id} excluída do Firestore com sucesso!`)
      } catch (err) {
        console.error("Error deleting document from Firestore:", err)
        alert("Erro ao excluir do Firestore. Certifique-se de que suas regras de segurança permitem exclusão.")
      }
    }
  }

  // 6. Seed Firestore Database with default questions
  const handleSeedDatabase = async () => {
    setIsSeeding(true)
    try {
      for (const q of INITIAL_QUESTIONS) {
        const { id: _id, ...question } = q
        await setDoc(doc(collection(db, 'questions')), {
          ...question, published: false,
          explanation: q.options.find(option => option.letter === q.correctAnswer).text
        })
      }
      showToast("Banco de dados semeado com sucesso!")
    } catch (err) {
      console.error("Error writing default questions to Firestore:", err)
      alert("Erro ao semear banco de dados. Verifique a ativação do Cloud Firestore e as Regras de Segurança.")
    } finally {
      setIsSeeding(false)
    }
  }

  // 7. Perform Client-Side Reactive Question Filtering
  const filteredQuestions = questions.filter((q) => {
    const term = searchTerm.toLowerCase()
    return (
      q.id.toLowerCase().includes(term) ||
      (q.category && q.category.toLowerCase().includes(term)) ||
      (q.prompt && q.prompt.toLowerCase().includes(term)) ||
      (q.author && q.author.toLowerCase().includes(term))
    )
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

      {/* Admin header */}
      <div className="admin-header-row">
        <div className="admin-header-info">
          <h1 className="admin-portal-title">Banco de Questões</h1>
          <p className="admin-portal-subtitle">Painel conectado em tempo real com o seu banco de dados Cloud Firestore do Firebase.</p>
        </div>
        
        <button onClick={handleOpenAddModal} className="admin-btn-add">
          {/* Plus Icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Adicionar Questão</span>
        </button>
      </div>

      {loadError ? <p role="alert" className="auth-alert error">{loadError}</p> : loading ? (
        /* Loader while listening to Firestore */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', borderTopColor: 'var(--accent)', borderWidth: '3px', borderColor: 'var(--border)' }}></div>
          <p style={{ marginTop: '16px', color: 'var(--text)', fontSize: '15px' }}>Carregando questões do Firestore...</p>
        </div>
      ) : questions.length === 0 ? (
        /* Empty State with Seed Action button */
        <div className="admin-empty-state">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="empty-state-title">Nenhuma questão no Firestore</h3>
          <p className="empty-state-description">
            A sua coleção "questions" no Cloud Firestore está vazia. Você pode semear o banco com as 3 questões acadêmicas padrão contendo 5 alternativas cada!
          </p>
          <button 
            onClick={handleSeedDatabase} 
            className="admin-btn-add"
            disabled={isSeeding}
            style={{ margin: '0 auto' }}
          >
            {isSeeding ? (
              <>
                <div className="spinner"></div>
                <span>Semeando...</span>
              </>
            ) : (
              <span>Semear Firestore com Questões de Teste</span>
            )}
          </button>
        </div>
      ) : (
        /* Render real database questions from Cloud Firestore */
        <>
          {/* Real-time Filter Search Bar */}
          <div className="admin-search-wrapper">
            <div className="search-input-icon">
              {/* Search Magnifying Glass Icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              className="admin-search-input"
              placeholder="Pesquisar questões por assunto, enunciado, ID ou autor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="search-clear-button"
                title="Limpar busca"
              >
                {/* Close/Clear Icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Search Result Fallback block */}
          {filteredQuestions.length === 0 ? (
            <div className="search-no-results">
              <svg style={{ color: 'var(--text)', opacity: 0.6, width: '48px', height: '48px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <h4 className="search-no-results-title">Nenhum resultado encontrado</h4>
              <p className="search-no-results-desc">
                Não encontramos nenhuma questão correspondente aos termos de busca: <strong>"{searchTerm}"</strong>.
              </p>
              <button onClick={() => setSearchTerm('')} className="nav-btn nav-btn-outline">
                Limpar Filtro de Busca
              </button>
            </div>
          ) : (
            /* Render list of filtered questions */
            <div className="questions-list">
              {filteredQuestions.map((q) => (
                <article key={q.id} className="question-card">
                  <div className="question-card-header">
                    <div className="question-meta">
                      <span className="question-id-badge">{q.id}</span>
                      <span className="question-category">{q.category}</span>
                    </div>
                  </div>

                  <h2 className="question-prompt">{q.prompt}</h2>

                  {/* Render the 5 options */}
                  <ul className="question-options-list">
                    {q.options?.map((opt) => {
                      const isCorrect = opt.letter === q.correctAnswer
                      return (
                        <li 
                          key={opt.letter} 
                          className={`question-option-item ${isCorrect ? 'correct' : ''}`}
                        >
                          <span className="option-letter">{opt.letter}</span>
                          <span>{opt.text}</span>
                          {isCorrect && (
                            <span className="option-correct-badge">
                              {/* Check Icon */}
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Gabarito
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>

                  {/* Action row */}
                  <div className="question-card-footer">
                    <span className="question-author-stamp">
                      Cadastrado por: <strong>{q.author}</strong>
                    </span>

                    <div className="question-actions-group">
                      <button 
                        onClick={() => handleOpenEditModal(q)} 
                        className="question-action-btn edit"
                        title="Editar Questão"
                      >
                        {/* Pencil Icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <span>Editar</span>
                      </button>

                      <button 
                        onClick={() => handleDeleteQuestion(q.id)} 
                        className="question-action-btn delete"
                        title="Excluir Questão"
                      >
                        {/* Trash Icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Beautiful Add/Edit Question Modal Form */}
      {editingQuestion && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editingQuestion.isNew ? 'Adicionar Nova Questão' : `Editar Questão ${editingQuestion.id}`}
              </h2>
              <button onClick={() => setEditingQuestion(null)} className="admin-modal-close-btn" aria-label="Fechar">
                {/* Close Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="admin-modal-body">
              {/* Auto-generated ID Info (only for new questions) */}
              {editingQuestion.isNew && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontSize: '14px', 
                  color: 'var(--text)', 
                  background: 'var(--social-bg)', 
                  padding: '10px 16px', 
                  borderRadius: '8px',
                  border: '1px solid var(--border)'
                }}>
                  <span>Identificador Gerado Automaticamente:</span>
                  <strong className="question-id-badge">{editingQuestion.id}</strong>
                </div>
              )}

              {/* Enunciado Form Group */}
              <div className="form-group">
                <label className="form-label">Enunciado da Questão</label>
                <textarea
                  className="auth-input"
                  style={{ minHeight: '80px', resize: 'vertical', fontFamily: 'var(--sans)', lineHeight: '1.4' }}
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  disabled={isSaving}
                  placeholder="Digite o enunciado completo..."
                />
              </div>

              {/* Assunto e Autor Form Group */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Assunto / Matéria</label>
                  <input
                    type="text"
                    className="auth-input"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    disabled={isSaving}
                    placeholder="Ex: Teoria da Computação"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Professor Autor</label>
                  <input
                    type="text"
                    className="auth-input"
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                    disabled={isSaving}
                    placeholder="Nome do professor responsável"
                  />
                </div>
              </div>

              {/* As 5 Alternativas de Resposta */}
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

              {/* Gabarito Selector */}
              <div className="form-group">
                <label className="form-label" htmlFor="question-explanation">Resolução detalhada</label>
                <textarea id="question-explanation" className="auth-input" rows={6} maxLength={20000}
                  value={editExplanation} onChange={event => setEditExplanation(event.target.value)} disabled={isSaving} />
              </div>
              <label className="form-label">
                <input type="checkbox" checked={editPublished} onChange={event => setEditPublished(event.target.checked)} disabled={isSaving} /> Disponível para alunos
              </label>
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
            </div>

            {/* Modal Actions Footer */}
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
                {isSaving ? (
                  <>
                    <div className="spinner" style={{ width: '14px', height: '14px', marginRight: '6px' }}></div>
                    <span>Gravando...</span>
                  </>
                ) : (
                  <span>{editingQuestion.isNew ? 'Criar Questão' : 'Salvar Alterações'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminQuestions
