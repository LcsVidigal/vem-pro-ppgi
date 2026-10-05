import { useState } from 'react'
import StudentQuiz from './StudentQuiz'
import './StudentArea.css'

function StudentArea({ user }) {
  const [quizActive, setQuizActive] = useState(false)

  // Se o quiz estiver ativo, renderiza o componente do quiz
  if (quizActive) {
    // Passamos uma função para que o quiz possa sinalizar quando terminar
    return <StudentQuiz onFinish={() => setQuizActive(false)} />
  }

  // Caso contrário, exibe a página inicial da área do aluno com o card
  return (
    <div className="student-area-container">
      <header className="student-area-header">
        <h1>Área do Aluno</h1>
        <p>Bem-vindo(a) de volta, <strong>{user?.name || 'estudante'}</strong>! Aqui você pode praticar com nossas questões.</p>
      </header>
      <main className="student-area-main">
        <article className="start-quiz-card" onClick={() => setQuizActive(true)}>
          <div className="start-quiz-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div className="start-quiz-info">
            <h2>Iniciar Simulado</h2>
            <p>Teste seus conhecimentos com questões de múltipla escolha baseadas em editais anteriores.</p>
          </div>
          <div className="start-quiz-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </div>
        </article>
      </main>
    </div>
  )
}

export default StudentArea