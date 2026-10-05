export function correctAnswers(questions, answers) {
  const items = questions.map(question => {
    const selected = answers[question.id] || null
    const status = !selected ? 'blank' : selected === question.correctAnswer ? 'correct' : 'incorrect'
    return { ...question, selected, status }
  })
  const correct = items.filter(item => item.status === 'correct').length
  const incorrect = items.filter(item => item.status === 'incorrect').length
  const blank = items.length - correct - incorrect
  return { items, total: items.length, correct, incorrect, blank, percentage: items.length ? Math.round(correct / items.length * 100) : 0 }
}
