import { useState, useEffect, useRef, useCallback } from 'react'
import { INITIAL_QUESTIONS } from '../data/initialQuestions'
import './StudentQuiz.css'
import './StudentSimulado.css'

const SIMULADO_QUESTION_COUNT = 15
const SIMULADO_DURATION_SECONDS = 30 * 60 // 30 minutos = 1800 segundos

// Embaralha e seleciona N questões aleatórias
const pickRandomQuestions = (pool, count = SIMULADO_QUESTION_COUNT) => {
  const source = Array.isArray(pool) && pool.length > 0 ? pool : INITIAL_QUESTIONS
  const shuffled = [...source]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

// Formata segundos em MM:SS
const formatTimerClock = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// Formata duração em texto legível (ex: "18m 42s")
const formatDurationHuman = (totalSeconds) => {
  const safe = Math.max(0, Math.floor(totalSeconds || 0))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${String(secs).padStart(2, '0')}s`
}

// Formata data ISO para dd/mm/aaaa às HH:mm
const formatDateTimeBR = (isoString) => {
  if (!isoString) return '--'
  try {
    const d = new Date(isoString)
    const datePart = d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
    const timePart = d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
    return `${datePart} às ${timePart}`
  } catch {
    return isoString
  }
}

function StudentSimulado({
  questionsPool = INITIAL_QUESTIONS,
  initialTab = 'exam', // 'exam' | 'history'
  history = [],
  onSaveHistory,
  onClearHistory,
  onFinish
}) {
  // Aba/modo atual: 'intro' (instruções e regras) | 'exam' (prova ativa) | 'result' (resultado/revisão) | 'history' (histórico)
  const [mode, setMode] = useState(initialTab === 'history' ? 'history' : 'intro')

  // Questões sorteadas para o simulado atual
  const [questions, setQuestions] = useState(() =>
    pickRandomQuestions(questionsPool, SIMULADO_QUESTION_COUNT)
  )
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(SIMULADO_DURATION_SECONDS)

  // Tentativa exibida na tela de resultado (pode ser a recém-concluída ou uma escolhida do histórico)
  const [activeResult, setActiveResult] = useState(null)

  // Referências para garantir precisão do cronômetro mesmo com aba em segundo plano
  const startTimeRef = useRef(Date.now())
  const startIsoRef = useRef(new Date().toISOString())
  const isFinishedRef = useRef(false)
  const userAnswersRef = useRef(userAnswers)
  const questionsRef = useRef(questions)

  useEffect(() => {
    userAnswersRef.current = userAnswers
  }, [userAnswers])

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  // Finaliza o simulado (manualmente ou por tempo esgotado)
  const finalizeSimulado = useCallback(
    (endedByTimeout = false) => {
      if (isFinishedRef.current) return
      isFinishedRef.current = true

      const currentQuestions = questionsRef.current
      const currentAnswers = userAnswersRef.current
      const elapsedSeconds = endedByTimeout
        ? SIMULADO_DURATION_SECONDS
        : Math.min(
            SIMULADO_DURATION_SECONDS,
            Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))
          )

      let correctCount = 0
      let answeredCount = 0

      const detailedQuestions = currentQuestions.map((q, idx) => {
        const chosen = currentAnswers[q.id] || null
        if (chosen) answeredCount++
        const isCorrect = chosen === q.correctAnswer
        if (isCorrect) correctCount++

        return {
          order: idx + 1,
          id: q.id,
          category: q.category,
          prompt: q.prompt,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || '',
          userAnswer: chosen,
          isCorrect
        }
      })

      const totalQuestions = currentQuestions.length
      const unansweredCount = totalQuestions - answeredCount
      const wrongCount = answeredCount - correctCount
      const accuracyPercent =
        totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

      const attemptRecord = {
        id: `SIM-${Date.now()}`,
        startedAt: startIsoRef.current,
        completedAt: new Date().toISOString(),
        durationSeconds: elapsedSeconds,
        timeLimitSeconds: SIMULADO_DURATION_SECONDS,
        totalQuestions,
        correctCount,
        wrongCount,
        answeredCount,
        unansweredCount,
        accuracyPercent,
        endedByTimeout,
        questions: detailedQuestions
      }

      setActiveResult(attemptRecord)
      setMode('result')

      if (onSaveHistory) {
        onSaveHistory(attemptRecord)
      }
    },
    [onSaveHistory]
  )

  // Inicia um novo simulado do zero (sorteando 15 novas questões e reiniciando os 30 min)
  const handleStartNewSimulado = () => {
    const newQuestions = pickRandomQuestions(questionsPool, SIMULADO_QUESTION_COUNT)
    setQuestions(newQuestions)
    questionsRef.current = newQuestions
    setUserAnswers({})
    userAnswersRef.current = {}
    setCurrentQuestionIndex(0)
    setTimeLeft(SIMULADO_DURATION_SECONDS)
    startTimeRef.current = Date.now()
    startIsoRef.current = new Date().toISOString()
    isFinishedRef.current = false
    setActiveResult(null)
    setMode('exam')
  }

  // Cronômetro regressivo de 30 minutos (baseado em relógio real)
  useEffect(() => {
    if (mode !== 'exam') return

    const intervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const remaining = SIMULADO_DURATION_SECONDS - elapsed

      if (remaining <= 0) {
        setTimeLeft(0)
        clearInterval(intervalId)
        finalizeSimulado(true)
      } else {
        setTimeLeft(remaining)
      }
    }, 500)

    return () => clearInterval(intervalId)
  }, [mode, finalizeSimulado])

  const handleSelectOption = (questionId, optionLetter) => {
    if (mode !== 'exam' || isFinishedRef.current) return
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionLetter
    }))
  }

  const handleManualSubmit = () => {
    const answeredTotal = Object.keys(userAnswers).length
    const pendingTotal = questions.length - answeredTotal

    if (pendingTotal > 0) {
      const confirmSubmit = window.confirm(
        `Você ainda tem ${pendingTotal} questão(ões) sem resposta de ${questions.length}.\n\nDeseja realmente encerrar e entregar o simulado agora?`
      )
      if (!confirmSubmit) return
    }

    finalizeSimulado(false)
  }

  // ============================================================================
  // MODO 0: TELA DE INSTRUÇÕES E REGRAS (ANTES DE INICIAR O CRONÔMETRO)
  // ============================================================================
  if (mode === 'intro') {
    const availableCount = Array.isArray(questionsPool) && questionsPool.length > 0
      ? questionsPool.length
      : INITIAL_QUESTIONS.length

    return (
      <div className="simulado-wrapper">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            margin: '16px 0 8px 0'
          }}
        >
          <button onClick={onFinish} className="track-back-btn">
            ← Voltar ao Painel do Aluno
          </button>

          <button onClick={() => setMode('history')} className="nav-btn nav-btn-outline">
            📜 Ver Histórico de Simulados ({history.length})
          </button>
        </div>

        <section className="simulado-intro-card">
          <header className="simulado-intro-header">
            <div className="simulado-intro-badge">
              ⏱️ Simulado Cronometrado • PPGI UFAM
            </div>
            <h2>Instruções e Regras do Simulado</h2>
            <p>
              Leia atentamente as orientações abaixo antes de iniciar. O cronômetro de <strong>30 minutos</strong> só começará a contar a partir do momento em que você clicar no botão de início.
            </p>
          </header>

          {/* Cards de Regras Principais */}
          <div className="simulado-rules-grid">
            <div className="simulado-rule-box">
              <div className="simulado-rule-icon">🎲</div>
              <h4>15 Questões Aleatórias</h4>
              <p>
                A cada tentativa, o sistema sorteia automaticamente <strong>15 questões</strong> dentre as {availableCount} questões disponíveis no banco.
              </p>
            </div>

            <div className="simulado-rule-box">
              <div className="simulado-rule-icon">⏳</div>
              <h4>30 Minutos de Duração</h4>
              <p>
                Você terá exatamente <strong>30 minutos (1800 segundos)</strong> para responder às 15 questões, uma média de 2 minutos por questão.
              </p>
            </div>

            <div className="simulado-rule-box">
              <div className="simulado-rule-icon">🚨</div>
              <h4>Encerramento Automático</h4>
              <p>
                Ao atingir <strong>00:00</strong> no cronômetro, a prova é <strong>encerrada automaticamente</strong> e corrigida com as alternativas já marcadas.
              </p>
            </div>

            <div className="simulado-rule-box">
              <div className="simulado-rule-icon">📊</div>
              <h4>Histórico e Gabarito</h4>
              <p>
                Ao concluir, seu desempenho fica salvo no histórico com <strong>data, hora, tempo gasto, nota</strong> e o gabarito comentado.
              </p>
            </div>
          </div>

          {/* Lista de Orientações Detalhadas */}
          <div className="simulado-instructions-list">
            <h3>📌 Recomendações Importantes antes de começar:</h3>
            <ul>
              <li>
                <strong>Navegação livre durante a prova:</strong> Você pode avançar, voltar ou pular diretamente para qualquer questão (de 1 a 15) usando o painel lateral esquerdo antes de entregar a prova.
              </li>
              <li>
                <strong>Relógio em tempo real:</strong> O cronômetro utiliza o horário real do sistema. Mesmo que você minimize a janela ou troque de aba no navegador, o tempo continuará correndo normalmente.
              </li>
              <li>
                <strong>Questões em branco:</strong> Caso o tempo acabe antes de você responder todas as 15 questões, as questões não marcadas serão contabilizadas como <em>em branco</em> (sem pontuação).
              </li>
              <li>
                <strong>Ambiente tranquilo:</strong> Reserve os próximos 30 minutos sem interrupções para simular fielmente a experiência da prova oficial do PPGI.
              </li>
            </ul>
          </div>

          {/* Rodapé com Botão de Início */}
          <div className="simulado-intro-footer">
            <div style={{ fontSize: '13.5px', color: 'var(--text)' }}>
              Pronto(a) para começar? Clique no botão ao lado para sortear suas 15 questões e disparar o cronômetro.
            </div>

            <button onClick={handleStartNewSimulado} className="simulado-start-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Iniciar Simulado Agora (30:00)
            </button>
          </div>
        </section>
      </div>
    )
  }

  // ============================================================================
  // MODO 1: HISTÓRICO DE SIMULADOS
  // ============================================================================
  if (mode === 'history') {
    const totalAttempts = history.length
    const avgAccuracy =
      totalAttempts > 0
        ? Math.round(history.reduce((acc, h) => acc + (h.accuracyPercent || 0), 0) / totalAttempts)
        : 0
    const bestAttempt =
      totalAttempts > 0
        ? history.reduce((best, cur) =>
            (cur.correctCount || 0) > (best.correctCount || 0) ? cur : best
          , history[0])
        : null
    const avgDuration =
      totalAttempts > 0
        ? Math.round(history.reduce((acc, h) => acc + (h.durationSeconds || 0), 0) / totalAttempts)
        : 0

    return (
      <div className="simulado-wrapper">
        <div className="track-overview-header" style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <button onClick={onFinish} className="track-back-btn">
              ← Voltar ao Painel do Aluno
            </button>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {history.length > 0 && onClearHistory && (
                <button
                  onClick={() => {
                    if (window.confirm('Deseja limpar todo o seu histórico de simulados?')) {
                      onClearHistory()
                    }
                  }}
                  className="nav-btn nav-btn-outline"
                  style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.35)' }}
                >
                  Limpar Histórico
                </button>
              )}
              <button
                onClick={() => setMode('intro')}
                className="nav-btn nav-btn-primary"
                style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#fff' }}
              >
                ⏱️ Novo Simulado (30 min)
              </button>
            </div>
          </div>

          <div className="track-header-meta" style={{ marginTop: '16px' }}>
            <div className="track-tag-badge" style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
              📊 Desempenho Cronometrado
            </div>
            <h2>Histórico de Simulados</h2>
            <p>
              Acompanhe todos os simulados realizados com registro de data, horário, tempo gasto e taxa de acerto.
            </p>
          </div>
        </div>

        {/* Resumo Estatístico Geral */}
        {totalAttempts > 0 && (
          <div className="simulado-metrics-grid" style={{ marginBottom: '28px' }}>
            <div className="simulado-metric-box">
              <span className="metric-label">Simulados Realizados</span>
              <span className="metric-val">{totalAttempts}</span>
            </div>
            <div className="simulado-metric-box">
              <span className="metric-label">Média de Acertos</span>
              <span className="metric-val" style={{ color: '#3b82f6' }}>{avgAccuracy}%</span>
            </div>
            <div className="simulado-metric-box">
              <span className="metric-label">Melhor Resultado</span>
              <span className="metric-val" style={{ color: '#22c55e' }}>
                {bestAttempt ? `${bestAttempt.correctCount}/${bestAttempt.totalQuestions} (${bestAttempt.accuracyPercent}%)` : '--'}
              </span>
            </div>
            <div className="simulado-metric-box">
              <span className="metric-label">Tempo Médio de Prova</span>
              <span className="metric-val" style={{ color: '#f59e0b' }}>
                {formatDurationHuman(avgDuration)}
              </span>
            </div>
          </div>
        )}

        {/* Lista de Tentativas */}
        {totalAttempts === 0 ? (
          <div className="exams-empty-state" style={{ marginTop: '24px' }}>
            <h4>Nenhum simulado realizado ainda</h4>
            <p>
              Inicie seu primeiro simulado com 15 questões aleatórias e 30 minutos de duração para registrar seu histórico de evolução.
            </p>
            <button
              onClick={() => setMode('intro')}
              className="nav-btn nav-btn-primary"
              style={{ marginTop: '16px', background: '#f59e0b', borderColor: '#f59e0b' }}
            >
              Ver Instruções e Iniciar Simulado
            </button>
          </div>
        ) : (
          <div className="simulado-history-list">
            {history.map((item, idx) => {
              const scoreClass =
                item.accuracyPercent >= 70
                  ? 'score-high'
                  : item.accuracyPercent >= 50
                  ? 'score-mid'
                  : 'score-low'

              return (
                <article key={item.id || idx} className="simulado-history-card">
                  <div className="history-card-left">
                    <div className="history-card-badges">
                      <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-h)' }}>
                        Simulado #{totalAttempts - idx}
                      </span>
                      <span className={`history-badge ${scoreClass}`}>
                        🎯 {item.correctCount} de {item.totalQuestions} acertos ({item.accuracyPercent}%)
                      </span>
                      {item.endedByTimeout ? (
                        <span className="history-badge timeout">
                          ⏰ Encerrado por Tempo (30m)
                        </span>
                      ) : (
                        <span className="history-badge normal">
                          ✓ Entregue dentro do tempo
                        </span>
                      )}
                    </div>

                    <div className="history-meta-row">
                      <span>📅 <strong>Data e Hora:</strong> {formatDateTimeBR(item.completedAt)}</span>
                      <span>⏱️ <strong>Tempo gasto:</strong> {formatDurationHuman(item.durationSeconds)} / 30m 00s</span>
                      <span>📝 <strong>Respondidas:</strong> {item.answeredCount ?? item.totalQuestions}/{item.totalQuestions}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={() => {
                        setActiveResult(item)
                        setMode('result')
                      }}
                      className="nav-btn nav-btn-outline"
                    >
                      Ver Gabarito e Revisão →
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ============================================================================
  // MODO 2: TELA DE RESULTADO E CORREÇÃO DO SIMULADO
  // ============================================================================
  if (mode === 'result' && activeResult) {
    return (
      <div className="simulado-wrapper">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', margin: '16px 0 20px 0' }}>
          <button onClick={onFinish} className="track-back-btn">
            ← Voltar ao Painel do Aluno
          </button>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setMode('history')} className="nav-btn nav-btn-outline">
              📜 Ver Histórico ({history.length})
            </button>
            <button
              onClick={() => setMode('intro')}
              className="nav-btn nav-btn-primary"
              style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
            >
              🔄 Novo Simulado (15 Questões)
            </button>
          </div>
        </div>

        {/* Alerta caso a prova tenha sido encerrada automaticamente pelo fim dos 30 minutos */}
        {activeResult.endedByTimeout && (
          <div className="timeout-alert-banner">
            <span style={{ fontSize: '26px' }}>⏰</span>
            <div>
              <strong style={{ display: 'block', fontSize: '15px', marginBottom: '2px' }}>
                Tempo Esgotado! A prova foi encerrada automaticamente.
              </strong>
              <span style={{ fontSize: '13.5px', opacity: 0.9 }}>
                O limite de 30 minutos foi atingido. Suas respostas marcadas até o encerramento foram salvas e corrigidas abaixo.
              </span>
            </div>
          </div>
        )}

        <div className="simulado-result-header-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: '#f59e0b'
                }}
              >
                Relatório Oficial do Simulado
              </span>
              <h2 style={{ margin: '6px 0 4px 0', fontSize: '26px' }}>
                Você acertou {activeResult.correctCount} de {activeResult.totalQuestions} questões ({activeResult.accuracyPercent}%)
              </h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>
                Realizado em <strong>{formatDateTimeBR(activeResult.completedAt)}</strong>
              </p>
            </div>

            <span
              className={`history-badge ${
                activeResult.accuracyPercent >= 70
                  ? 'score-high'
                  : activeResult.accuracyPercent >= 50
                  ? 'score-mid'
                  : 'score-low'
              }`}
              style={{ fontSize: '14px', padding: '8px 14px' }}
            >
              Aproveitamento: {activeResult.accuracyPercent}%
            </span>
          </div>

          <div className="simulado-metrics-grid">
            <div className="simulado-metric-box">
              <span className="metric-label">Acertos</span>
              <span className="metric-val" style={{ color: '#22c55e' }}>
                {activeResult.correctCount} / {activeResult.totalQuestions}
              </span>
            </div>
            <div className="simulado-metric-box">
              <span className="metric-label">Erros / Em Branco</span>
              <span className="metric-val" style={{ color: '#ef4444' }}>
                {activeResult.wrongCount || 0} erros • {activeResult.unansweredCount || 0} em branco
              </span>
            </div>
            <div className="simulado-metric-box">
              <span className="metric-label">Tempo Utilizado</span>
              <span className="metric-val" style={{ color: '#f59e0b' }}>
                {formatDurationHuman(activeResult.durationSeconds)}
              </span>
            </div>
            <div className="simulado-metric-box">
              <span className="metric-label">Status de Encerramento</span>
              <span className="metric-val" style={{ fontSize: '16px', marginTop: '4px' }}>
                {activeResult.endedByTimeout ? '⏰ Tempo Esgotado (30m)' : '✅ Entregue pelo Aluno'}
              </span>
            </div>
          </div>
        </div>

        {/* Correção Questão por Questão */}
        <div className="results-summary">
          <h3 style={{ marginBottom: '16px' }}>Gabarito Comentado das 15 Questões:</h3>
          {(activeResult.questions || []).map((q, idx) => {
            const isCorrect = q.isCorrect
            const wasAnswered = Boolean(q.userAnswer)

            return (
              <div key={q.id || idx} className="result-item" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
                    Questão {idx + 1} ({q.id}) • {q.category}
                  </span>
                  <span
                    className={`history-badge ${isCorrect ? 'score-high' : 'score-low'}`}
                  >
                    {isCorrect ? '✓ Acertou' : wasAnswered ? '✕ Errou' : '⚪ Não Respondida'}
                  </span>
                </div>

                <p style={{ fontWeight: 600, color: 'var(--text-h)', marginBottom: '10px' }}>
                  {q.prompt}
                </p>

                <p className={isCorrect ? 'correct-answer' : 'incorrect-answer'}>
                  Sua resposta: <strong>{q.userAnswer || 'Não respondida (Em branco)'}</strong>
                </p>

                {!isCorrect && (
                  <p className="correct-answer">
                    Gabarito Oficial: <strong>Alternativa {q.correctAnswer}</strong>
                  </p>
                )}

                {q.explanation && (
                  <div className="result-explanation">
                    <p>
                      <strong>Comentário:</strong> {q.explanation}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ============================================================================
  // MODO 3: PROVA ATIVA DO SIMULADO (15 QUESTÕES + CRONÔMETRO DE 30 MINUTOS)
  // ============================================================================
  const currentQuestion = questions[currentQuestionIndex]
  const answeredCount = Object.keys(userAnswers).length

  // Estado visual de alerta do relógio:
  // <= 10 min (600s): warning (laranja)
  // <= 3 min (180s): danger pulsante (vermelho)
  const timerSeverityClass =
    timeLeft <= 180 ? 'danger' : timeLeft <= 600 ? 'warning' : ''

  return (
    <div className="quiz-layout">
      {/* Barra Lateral com Cronômetro e Mapa de 15 Questões */}
      <aside className="quiz-sidebar">
        <div className="sidebar-header" style={{ marginBottom: '12px', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                padding: '3px 8px',
                borderRadius: '6px'
              }}
            >
              Simulado Oficial
            </span>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'Deseja sair do simulado em andamento? O progresso atual não finalizado será descartado.'
                  )
                ) {
                  onFinish()
                }
              }}
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
              title="Abandonar e voltar ao painel"
            >
              ✕ Sair
            </button>
          </div>
          <h3>15 Questões Aleatórias</h3>
          <p>{answeredCount} de {questions.length} respondidas</p>
        </div>

        {/* Cronômetro Regressivo de 30 Minutos */}
        <div className={`simulado-timer-card ${timerSeverityClass}`}>
          <div className="timer-label-col">
            <span>Tempo Restante</span>
            <small style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.8 }}>
              {timeLeft <= 180 ? '⚠️ Reta final!' : 'Encerra automático em 00:00'}
            </small>
          </div>
          <div className="timer-clock-value">
            {formatTimerClock(timeLeft)}
          </div>
        </div>

        {/* Grade Compacta 1 a 15 */}
        <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
          Navegação Rápida (1 a {questions.length}):
        </div>
        <div className="simulado-question-grid">
          {questions.map((q, index) => {
            const isAnswered = Boolean(userAnswers[q.id])
            const isActive = index === currentQuestionIndex
            return (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`simulado-grid-btn ${isActive ? 'active' : ''} ${isAnswered ? 'answered' : ''}`}
                title={`Questão ${index + 1} (${q.id}) - ${isAnswered ? `Marcada: ${userAnswers[q.id]}` : 'Em branco'}`}
              >
                {index + 1}
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => {
              if (
                answeredCount === 0 ||
                window.confirm('Deseja abrir o histórico de simulados? O simulado atual será reiniciado.')
              ) {
                setMode('history')
              }
            }}
            className="quiz-btn"
            style={{ width: '100%', fontSize: '13px', padding: '10px' }}
          >
            📜 Histórico ({history.length})
          </button>

          <button
            onClick={handleManualSubmit}
            className="quiz-btn primary submit-btn"
            style={{ marginTop: 0, background: '#f59e0b' }}
          >
            Finalizar e Entregar Simulado
          </button>
        </div>
      </aside>

      {/* Área Principal da Questão */}
      <main className="quiz-main-content">
        <div className="quiz-header">
          <div>
            <span
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#f59e0b',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {currentQuestion.category} • Cód. {currentQuestion.id}
            </span>
            <h2 style={{ margin: '4px 0 0 0' }}>
              Questão {currentQuestionIndex + 1} de {questions.length}
            </h2>
          </div>

          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${(answeredCount / questions.length) * 100}%`,
                backgroundColor: '#f59e0b'
              }}
            ></div>
          </div>
        </div>

        <div className="question-body">
          <p className="question-prompt">{currentQuestion.prompt}</p>
          <div className="options-list">
            {(currentQuestion.options || []).map((option) => (
              <button
                key={option.letter}
                className={`option-btn ${
                  userAnswers[currentQuestion.id] === option.letter ? 'selected' : ''
                }`}
                onClick={() => handleSelectOption(currentQuestion.id, option.letter)}
              >
                <span className="option-letter">{option.letter}</span>
                {option.text}
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-navigation">
          <button
            onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))}
            className="quiz-btn"
            disabled={currentQuestionIndex === 0}
          >
            ← Anterior
          </button>

          {currentQuestionIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentQuestionIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="quiz-btn primary"
            >
              Próxima →
            </button>
          ) : (
            <button
              onClick={handleManualSubmit}
              className="quiz-btn primary"
              style={{ background: '#f59e0b' }}
            >
              Finalizar Simulado ✓
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

export default StudentSimulado

