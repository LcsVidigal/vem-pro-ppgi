import { useEffect, useRef, useState } from 'react'
import { startAttempt, submitAttempt, attemptError } from '../services/attempts'
import './QuizResult.css'

const labels = { correct: '✓ Correta', incorrect: '✕ Incorreta', blank: '— Não respondida' }

export default function QuizResult({ onBack, user }) {
  const [answers, setAnswers] = useState({})
  const [attempt, setAttempt] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const heading = useRef(null)
  const pending = useRef(false)
  const storageKey = `ppgi-attempt:${user.uid}`
  const [savedId, setSavedId] = useState(() => localStorage.getItem(storageKey))
  const submitted = Boolean(result)

  async function openAttempt(fresh = false) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const id = fresh || !savedId ? crypto.randomUUID() : savedId
      localStorage.setItem(storageKey, id)
      setSavedId(id)
      const next = await startAttempt(id)
      setAttempt(next)
      setResult(next.result)
      setAnswers({})
      setFilter('all')
    } catch (err) { setError(attemptError(err)) }
    finally { setBusy(false); pending.current = false }
  }

  async function send(event) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      setResult(await submitAttempt(attempt.attemptId, answers))
      setFilter('all')
    } catch (err) { setError(attemptError(err)) }
    finally { setBusy(false); pending.current = false }
  }

  useEffect(() => { heading.current?.focus() }, [submitted])

  return (
    <main className="quiz-page">
      <button className="nav-btn nav-btn-outline" onClick={onBack}>← Voltar ao início</button>
      <header className="quiz-heading">
        <span className="quiz-eyebrow">Vem Pro PPGI</span>
        <h1 ref={heading} tabIndex={-1}>{submitted ? 'Seu resultado' : 'Questões'}</h1>
        {submitted && <p>Confira seu desempenho e a resolução de cada questão.</p>}
      </header>

      {error && <p role="alert" className="auth-alert error">{error}</p>}
      {busy && <p role="status">{attempt ? 'Processando...' : 'Carregando questões...'}</p>}
      {!attempt && <button disabled={busy} className="nav-btn nav-btn-primary" onClick={() => openAttempt()}>{savedId ? 'Retomar tentativa' : 'Iniciar questões'}</button>}

      {attempt && !submitted ? (
        <form onSubmit={send}>
          {attempt.questions.map((question, index) => (
            <fieldset className="quiz-card" key={question.id} disabled={busy}>
              <legend>Questão {index + 1} · {question.category}</legend>
              <p className="quiz-prompt">{question.prompt}</p>
              <div className="quiz-options">
                {question.options.map(option => {
                  const { letter, text } = option
                  return <label className="quiz-option" key={letter}><input type="radio" name={question.id} value={letter} checked={answers[question.id] === letter} onChange={() => setAnswers({ ...answers, [question.id]: letter })} /><span><strong>{letter}.</strong> {text}</span></label>
                })}
              </div>
              <button type="button" className="quiz-link" onClick={() => setAnswers({ ...answers, [question.id]: null })}>Limpar resposta</button>
            </fieldset>
          ))}
          <div className="quiz-actions"><p>Questões em branco não contam como acertos.</p><button disabled={busy} className="nav-btn nav-btn-primary" type="submit">Enviar respostas e ver resultado →</button></div>
        </form>
      ) : result ? (
        <>
          <section className="quiz-summary" aria-label="Resumo do resultado">
            <div className="quiz-score"><strong>{result.percentage}%</strong><span>de aproveitamento</span><p>{result.correct} de {result.total} questões corretas</p></div>
            <dl className="quiz-stats"><div><dt>Acertos</dt><dd>{result.correct}</dd></div><div><dt>Erros</dt><dd>{result.incorrect}</dd></div><div><dt>Em branco</dt><dd>{result.blank}</dd></div></dl>
          </section>
          <div className="quiz-review-heading"><h2>Gabarito comentado</h2><div className="quiz-filters" aria-label="Filtrar questões">{[['all', 'Todas'], ['correct', 'Corretas'], ['incorrect', 'Incorretas'], ['blank', 'Em branco']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
          <div aria-live="polite">
            {!result.items.some(item => filter === 'all' || item.status === filter) && <p className="quiz-card">Nenhuma questão nesta categoria.</p>}
            {result.items.map((question, index) => (filter === 'all' || question.status === filter) && (
              <article className="quiz-card" key={question.id}>
                <div className="quiz-card-heading"><span>Questão {index + 1} · {question.category}</span><strong className={`quiz-status ${question.status}`}>{labels[question.status]}</strong></div>
                <h3 className="quiz-prompt">{question.prompt}</h3>
                <p className="quiz-answer-summary">Sua resposta: <strong>{question.selected || 'Em branco'}</strong> · Gabarito: <strong>{question.correctAnswer}</strong></p>
                <ul className="quiz-options quiz-answer-list">{question.options.map(option => {
                  const { letter, text } = option
                  const isCorrect = letter === question.correctAnswer
                  const selected = letter === question.selected
                  return <li className={`quiz-option ${isCorrect ? 'correct' : selected ? 'incorrect' : ''}`} key={letter}><span><strong>{letter}.</strong> {text}</span><small>{isCorrect ? '✓ Gabarito' : ''}{selected ? ' · Sua resposta' : ''}</small></li>
                })}</ul>
                <div className="quiz-explanation"><h4>Entenda a resolução</h4><p>{question.explanation}</p></div>
              </article>
            ))}
          </div>
          <div className="quiz-actions"><button disabled={busy} className="nav-btn nav-btn-primary" onClick={() => openAttempt(true)}>Nova tentativa</button></div>
        </>
      ) : null}
    </main>
  )
}
