import test from 'node:test'
import assert from 'node:assert/strict'
import { grade, publicQuestion, validQuestion } from '../grading.js'
const q = { id: 'Q1', prompt: 'Quanto é 2 + 2?', category: 'Matemática',
  options: ['3', '4', '5', '6', '7'].map((text, i) => ({ letter: 'ABCDE'[i], text })),
  correctAnswer: 'B', explanation: 'Somando duas unidades a duas unidades, obtemos quatro.' }
test('projection never exposes the answer key or explanation', () => {
  assert.deepEqual(Object.keys(publicQuestion(q)).sort(), ['category', 'id', 'options', 'prompt'])
})
test('correct, incorrect and blank answers include full explanations', () => {
  const result = grade([q, { ...q, id: 'Q2' }, { ...q, id: 'Q3' }], { Q1: 'B', Q2: 'A' })
  assert.equal(result.correct, 1)
  assert.equal(result.incorrect, 1)
  assert.equal(result.blank, 1)
  assert.equal(result.percentage, 33)
  assert.ok(result.items.every(item => item.explanation === q.explanation))
})
test('rejects forged IDs, invalid alternatives and malformed answers', () => {
  for (const answers of [null, [], { unknown: 'B' }, { Q1: 'Z' }, { Q1: '' }, { Q1: { answer: 'B' } }]) {
    assert.throws(() => grade([q], answers))
  }
})
test('incomplete questions cannot be offered', () => {
  assert.equal(validQuestion(q), true)
  assert.equal(validQuestion({ ...q, explanation: '' }), false)
  assert.equal(validQuestion({ ...q, correctAnswer: 'Z' }), false)
  assert.equal(validQuestion({ ...q, options: [] }), false)
  assert.equal(validQuestion({ ...q, options: [null, null, null, null, null] }), false)
  assert.equal(validQuestion(null), false)
})
