import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { INITIAL_QUESTIONS } from '../data/initialQuestions'
import './StudentQuiz.css'

// Helper to shuffle questions randomly for Modo Livre
const shuffleQuestions = (items) => {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function StudentQuiz({ onFinish }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState({}) // Ex: { 'Q-101': 'A', 'Q-102': 'C' }
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [score, setScore] = useState(0)

  // 1. Busca as questões do Firestore em tempo real e embaralha para o Modo Livre
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'questions'),
      (snapshot) => {
        const questionsData = []
        snapshot.forEach((docSnap) => {
          questionsData.push({ id: docSnap.id, ...docSnap.data() })
        })

        const pool = questionsData.length > 0 ? questionsData : INITIAL_QUESTIONS
        // Embaralha as questões para o Modo Livre
        setQuestions(shuffleQuestions(pool))
        setLoading(false)
      },
      (error) => {
        console.warn('Erro ao carregar questões do Firestore, usando locais:', error)
        setQuestions(shuffleQuestions(INITIAL_QUESTIONS))
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // 2. Salva a resposta selecionada pelo usuário
  const handleAnswerSelect = (questionId, selectedOptionLetter) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: selectedOptionLetter
    }))
  }

  // 3. Funções de navegação entre as questões
  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  // 4. Finaliza e calcula a pontuação
  const handleSubmit = () => {
    let calculatedScore = 0
    questions.forEach((q) => {
      if (userAnswers[q.id] === q.correctAnswer) {
        calculatedScore++
      }
    })
    setScore(calculatedScore)
    setQuizSubmitted(true)
  }

  // 5. Reinicia e sorteia novamente as questões
  const handleRestartQuiz = () => {
    setUserAnswers({})
    setCurrentQuestionIndex(0)
    setScore(0)
    setQuizSubmitted(false)
    setQuestions((prev) => shuffleQuestions(prev))
  }

  // 6. Volta para a tela anterior
  const handleExitQuiz = () => {
    if (onFinish) {
      onFinish()
    }
  }

  if (loading) {
    return (
      <div className="quiz-loading-container">
        <div className="spinner"></div>
        <p>Carregando questões do Modo Livre...</p>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="quiz-container" style={{ textAlign: 'center', padding: '40px' }}>
        <p>Nenhuma questão encontrada no momento.</p>
        <button onClick={handleExitQuiz} className="quiz-btn" style={{ marginTop: '16px' }}>
          Voltar para a Área do Aluno
        </button>
      </div>
    )
  }

  // Renderiza a tela de resultados
  if (quizSubmitted) {
    return (
      <div className="result-container">
        <h2>Treino no Modo Livre Finalizado!</h2>
        <p>
          Sua pontuação: <strong>{score} de {questions.length}</strong> ({Math.round((score / questions.length) * 100)}% de acertos)
        </p>

        <div className="results-summary">
          <h3>Resumo das suas respostas:</h3>
          {questions.map((q) => (
            <div key={q.id} className="result-item">
              <p>
                <strong>{q.id}: {q.prompt}</strong>
              </p>
              <p className={userAnswers[q.id] === q.correctAnswer ? 'correct-answer' : 'incorrect-answer'}>
                Sua resposta: {userAnswers[q.id] || 'Não respondida'}
              </p>
              {userAnswers[q.id] !== q.correctAnswer && (
                <p className="correct-answer">
                  Resposta correta: {q.correctAnswer}
                </p>
              )}
              {q.explanation && (
                <div className="result-explanation">
                  <p><strong>Comentário:</strong> {q.explanation}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="result-actions">
          <button onClick={handleExitQuiz} className="quiz-btn">
            Voltar para a Área do Aluno
          </button>
          <button onClick={handleRestartQuiz} className="quiz-btn primary">
            Sortear Novas Questões
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]

  // Renderiza a tela do modo livre com navegação lateral
  return (
    <div className="quiz-layout">
      {/* Barra Lateral de Navegação */}
      <aside className="quiz-sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              background: 'var(--accent-bg)',
              color: 'var(--accent)',
              padding: '3px 8px',
              borderRadius: '6px'
            }}>
              Modo Livre
            </span>
            <button
              onClick={handleExitQuiz}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
              title="Voltar para a Área do Aluno"
            >
              ✕ Sair
            </button>
          </div>
          <h3>Questões Aleatórias</h3>
          <p>Treine livremente no seu próprio ritmo</p>
        </div>

        <div className="quiz-sidebar-nav">
          {questions.map((q, index) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`sidebar-nav-btn ${index === currentQuestionIndex ? 'active' : ''} ${userAnswers[q.id] ? 'answered' : ''}`}
              title={userAnswers[q.id] ? `Respondida: ${userAnswers[q.id]}` : 'Não respondida'}
            >
              <span>{q.id}</span>
              {userAnswers[q.id] && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <button onClick={handleSubmit} className="quiz-btn primary submit-btn">
          Finalizar e Corrigir
        </button>
      </aside>

      {/* Conteúdo Principal da Questão */}
      <main className="quiz-main-content">
        <div className="quiz-header">
          <div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {currentQuestion.category}
            </span>
            <h2 style={{ margin: '4px 0 0 0' }}>Questão {currentQuestionIndex + 1} de {questions.length}</h2>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="question-body">
          <p className="question-prompt">{currentQuestion.prompt}</p>
          <div className="options-list">
            {currentQuestion.options.map((option) => (
              <button
                key={option.letter}
                className={`option-btn ${userAnswers[currentQuestion.id] === option.letter ? 'selected' : ''}`}
                onClick={() => handleAnswerSelect(currentQuestion.id, option.letter)}
              >
                <span className="option-letter">{option.letter}</span>
                {option.text}
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-navigation">
          <button onClick={handlePrevious} className="quiz-btn" disabled={currentQuestionIndex === 0}>
            Anterior
          </button>
          <button onClick={handleNext} className="quiz-btn" disabled={currentQuestionIndex === questions.length - 1}>
            Próxima
          </button>
        </div>
      </main>
    </div>
  )
}

export default StudentQuiz