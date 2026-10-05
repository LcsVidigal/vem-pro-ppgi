export function validQuestion(q) {
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
  return Boolean(q && text(q.prompt, 10000) && text(q.category, 200) && text(q.explanation, 20000)
    && Array.isArray(q.options) && q.options.length === 5
    && q.options.every((o, i) => o && o.letter === 'ABCDE'[i] && text(o.text, 3000))
    && typeof q.correctAnswer === 'string' && /^[A-E]$/.test(q.correctAnswer))
}

export function publicQuestion(q) {
  return { id: q.id, category: q.category, prompt: q.prompt,
    options: q.options.map(({ letter, text }) => ({ letter, text })) }
}

export function grade(questions, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)
    || Object.keys(answers).some(id => !questions.some(q => q.id === id))) {
    throw new Error('Respostas inválidas.')
  }
  const items = questions.map(q => {
    const selected = Object.hasOwn(answers, q.id) ? answers[q.id] : null
    if (selected !== null && !q.options.some(o => o.letter === selected)) {
      throw new Error('Alternativa inválida.')
    }
    return { ...publicQuestion(q), correctAnswer: q.correctAnswer, explanation: q.explanation,
      selected, status: selected === null ? 'blank' : selected === q.correctAnswer ? 'correct' : 'incorrect' }
  })
  const correct = items.filter(q => q.status === 'correct').length
  const blank = items.filter(q => q.status === 'blank').length
  return { items, total: items.length, correct, blank, incorrect: items.length - correct - blank,
    percentage: items.length ? Math.round(correct * 100 / items.length) : 0 }
}
