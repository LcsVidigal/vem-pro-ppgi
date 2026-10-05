import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run through npm run test:firebase; never use production.')
process.env.GCLOUD_PROJECT = 'demo-vem-pro-ppgi'
const { startAttempt, submitAttempt } = await import('../functions/index.js')
const { db: adminDb } = await import('../functions/firebase.js')
let env
const q = { prompt: 'Quanto é 2 + 2?', category: 'Matemática', author: 'Teste', published: true,
  options: ['3', '4', '5', '6', '7'].map((text, i) => ({ letter: 'ABCDE'[i], text })),
  correctAnswer: 'B', explanation: 'Duas unidades somadas a duas unidades resultam em quatro.' }
const owner = { uid: 'owner', token: {} }
const other = { uid: 'other', token: {} }
const call = (fn, auth, data) => fn.run({ auth, data })
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-vem-pro-ppgi',
    firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') } })
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'questions', 'Q1'), q)
  })
})
after(async () => { await env?.cleanup(); await adminDb.terminate() })

test('students and anonymous users cannot read keys or write results and roles', async () => {
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext('owner')]) {
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'questions', 'Q1')))
    await assertFails(setDoc(doc(db, 'questions', 'Q1'), q))
    await assertFails(setDoc(doc(db, 'results', 'forged'), { ownerId: 'owner', result: { percentage: 100 } }))
    await assertFails(setDoc(doc(db, 'users', 'owner'), { admin: true }))
    await assertFails(getDoc(doc(db, 'attempts', 'private')))
  }
})
test('only admins can manage valid questions', async () => {
  const db = env.authenticatedContext('admin', { admin: true }).firestore()
  await assertSucceeds(getDoc(doc(db, 'questions', 'Q1')))
  await assertSucceeds(setDoc(doc(db, 'questions', 'draft'), { ...q, published: false }))
  await assertFails(setDoc(doc(db, 'questions', 'invalid'), { ...q, explanation: '' }))
  await assertFails(setDoc(doc(db, 'questions', 'invalid'), { ...q, correctAnswer: 'Z' }))
})
test('functions enforce authentication, ownership and valid alternatives', async () => {
  const attemptId = '11111111-1111-4111-8111-111111111111'
  await assert.rejects(call(startAttempt, null, { attemptId }), { code: 'unauthenticated' })
  await assert.rejects(call(startAttempt, owner, { attemptId: '../bad' }), { code: 'invalid-argument' })
  const started = await call(startAttempt, owner, { attemptId })
  assert.equal(started.questions.length, 1)
  assert.equal(JSON.stringify(started).includes('correctAnswer'), false)
  assert.equal(JSON.stringify(started).includes('explanation'), false)
  await assert.rejects(call(startAttempt, other, { attemptId }), { code: 'permission-denied' })
  await assert.rejects(call(submitAttempt, null, { attemptId, answers: {} }), { code: 'unauthenticated' })
  await assert.rejects(call(submitAttempt, other, { attemptId, answers: {} }), { code: 'permission-denied' })
  await assert.rejects(call(submitAttempt, owner, { attemptId, answers: { Q1: 'Z' } }), { code: 'invalid-argument' })
  await assert.rejects(call(submitAttempt, owner, { attemptId, answers: { unknown: 'B' } }), { code: 'invalid-argument' })
})
test('snapshot survives edits; concurrent submissions persist one immutable result', async () => {
  const attemptId = '22222222-2222-4222-8222-222222222222'
  await call(startAttempt, owner, { attemptId })
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'questions', 'Q1'), { ...q, correctAnswer: 'A' })
  })
  const [first, repeated] = await Promise.all([
    call(submitAttempt, owner, { attemptId, answers: { Q1: 'B' } }),
    call(submitAttempt, owner, { attemptId, answers: { Q1: 'B' } })
  ])
  assert.equal(first.percentage, 100)
  assert.deepEqual(first, repeated)
  assert.deepEqual(await call(submitAttempt, owner, { attemptId, answers: { Q1: 'A' } }), first)
  assert.deepEqual((await call(startAttempt, owner, { attemptId })).result, first)
  await assertSucceeds(getDoc(doc(env.authenticatedContext('owner').firestore(), 'results', attemptId)))
  await assertFails(getDoc(doc(env.authenticatedContext('other').firestore(), 'results', attemptId)))
})

test('blank answers are persisted and daily limits cannot be changed by clients', async () => {
  const attemptId = '33333333-3333-4333-8333-333333333333'
  await call(startAttempt, owner, { attemptId })
  const result = await call(submitAttempt, owner, { attemptId, answers: {} })
  assert.equal(result.blank, result.total)
  assert.equal(result.percentage, 0)
  await assertFails(setDoc(doc(env.authenticatedContext('owner').firestore(), 'attemptUsage', 'owner'), { count: 0 }))
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'attemptUsage', 'limited'), { day: new Date().toISOString().slice(0, 10), count: 30 })
  })
  await assert.rejects(call(startAttempt, { uid: 'limited', token: {} }, {
    attemptId: '44444444-4444-4444-8444-444444444444'
  }), { code: 'resource-exhausted' })
})
