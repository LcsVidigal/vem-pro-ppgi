import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import './StudentQuiz.css'

function StudentQuiz({ onFinish }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState({}) // Ex: { 'Q-101': 'A', 'Q-102': 'C' }
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [score, setScore] = useState(0)

  // 1. Busca as questões do Firestore em tempo real
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "questions"), (snapshot) => {
      const questionsData = []
      snapshot.forEach((doc) => {
        questionsData.push({ id: doc.id, ...doc.data() })
      })

      // Ordena as questões por ID para uma ordem consistente
      questionsData.sort((a, b) => a.id.localeCompare(b.id))

      setQuestions(questionsData)
      setLoading(false)
    }, (error) => {
      console.error("Erro ao carregar questões do Firestore:", error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // 2. Salva a resposta selecionada pelo usuário
  const handleAnswerSelect = (questionId, selectedOptionLetter) => {
    setUserAnswers({
      ...userAnswers,
      [questionId]: selectedOptionLetter,
    })
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

  // 4. Finaliza o quiz e calcula a pontuação
  const handleSubmit = () => {
    let calculatedScore = 0
    questions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswer) {
        calculatedScore++
      }
    })
    setScore(calculatedScore)
    setQuizSubmitted(true)
  }

  // 5. Reinicia o quiz
  const handleRestartQuiz = () => {
    setUserAnswers({})
    setCurrentQuestionIndex(0)
    setScore(0)
    setQuizSubmitted(false)
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
        <p>Carregando questões do Firestore...</p>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="quiz-container" style={{ textAlign: 'center', padding: '40px' }}>
        <p>Nenhuma questão encontrada no momento.</p>
      </div>
    )
  }

  // Renderiza a tela de resultados
  if (quizSubmitted) {
    return (
      <div className="result-container">
        <h2>Quiz Finalizado!</h2>
        <p>Sua pontuação: <strong>{score} de {questions.length}</strong></p>

        <div className="results-summary">
          <h3>Resumo das suas respostas:</h3>
          {questions.map(q => (
            <div key={q.id} className="result-item">
              <p><strong>{q.id}: {q.prompt}</strong></p>
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
            Refazer Quiz
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]

  // Renderiza a nova tela do quiz com navegação lateral
  return (
    <div className="quiz-layout">
      {/* Barra Lateral de Navegação */}
      <aside className="quiz-sidebar">
        <div className="sidebar-header">
          <h3>Navegação</h3>
          <p>Selecione uma questão</p>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </button>
          ))}
        </div>
        <button onClick={handleSubmit} className="quiz-btn primary submit-btn">
          Enviar Respostas
        </button>
      </aside>

      {/* Conteúdo Principal da Questão */}
      <main className="quiz-main-content">
        <div className="quiz-header">
          <h2>Questão {currentQuestionIndex + 1} de {questions.length}</h2>
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
            {currentQuestion.options.map(option => (
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
          <button onClick={handlePrevious} className="quiz-btn" disabled={currentQuestionIndex === 0}>Anterior</button>
          <button onClick={handleNext} className="quiz-btn" disabled={currentQuestionIndex === questions.length - 1}>
            Próxima
          </button>
        </div>
      </main>
    </div>
  )
}

export default StudentQuiz