import { FieldValue } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { validQuestion, publicQuestion, grade } from './grading.js'
import { db } from './firebase.js'

const options = { region: 'us-central1', maxInstances: 5 }
function uid(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.')
  return request.auth.uid
}
function attemptId(data) {
  if (typeof data?.attemptId !== 'string' || !/^[a-zA-Z0-9-]{20,64}$/.test(data.attemptId)) {
    throw new HttpsError('invalid-argument', 'Identificador de tentativa inválido.')
  }
  return data.attemptId
}

export const startAttempt = onCall(options, async request => {
  const ownerId = uid(request)
  const id = attemptId(request.data)
  const ref = db.collection('attempts').doc(id)
  return db.runTransaction(async tx => {
    const previous = await tx.get(ref)
    if (previous.exists) {
      const attempt = previous.data()
      if (attempt.ownerId !== ownerId) throw new HttpsError('permission-denied', 'Tentativa indisponível.')
      const result = attempt.status === 'submitted' ? (await tx.get(db.collection('results').doc(id))).data()?.result : null
      if (attempt.status === 'submitted' && !result) throw new HttpsError('internal', 'Resultado indisponível.')
      return { attemptId: id, questions: attempt.questions.map(publicQuestion), result: result || null }
    }
    const usageRef = db.collection('attemptUsage').doc(ownerId)
    const usage = (await tx.get(usageRef)).data()
    const day = new Date().toISOString().slice(0, 10)
    const count = usage?.day === day ? usage.count : 0
    if (count >= 30) throw new HttpsError('resource-exhausted', 'Limite diário de tentativas atingido.')
    // Bound both reads and the snapshot size. Only explicitly published questions participate.
    const snapshot = await tx.get(db.collection('questions').where('published', '==', true).limit(10))
    const questions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter(validQuestion)
      .map(q => ({ ...publicQuestion(q), correctAnswer: q.correctAnswer, explanation: q.explanation }))
    if (!questions.length) throw new HttpsError('failed-precondition', 'Ainda não há questões disponíveis com resolução.')
    if (Buffer.byteLength(JSON.stringify(questions), 'utf8') > 600000) {
      throw new HttpsError('failed-precondition', 'O conjunto de questões excede o tamanho permitido.')
    }
    tx.create(ref, { ownerId, status: 'open', questions, createdAt: FieldValue.serverTimestamp() })
    tx.set(usageRef, { day, count: count + 1 })
    return { attemptId: id, questions: questions.map(publicQuestion), result: null }
  })
})

export const submitAttempt = onCall(options, async request => {
  const ownerId = uid(request)
  const id = attemptId(request.data)
  const ref = db.collection('attempts').doc(id)
  const resultRef = db.collection('results').doc(id)
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists) throw new HttpsError('not-found', 'Tentativa não encontrada.')
    const attempt = snapshot.data()
    if (attempt.ownerId !== ownerId) throw new HttpsError('permission-denied', 'Tentativa indisponível.')
    if (attempt.status === 'submitted') {
      const saved = await tx.get(resultRef)
      if (!saved.exists) throw new HttpsError('internal', 'Resultado indisponível.')
      return saved.data().result
    }
    let result
    try { result = grade(attempt.questions, request.data.answers) }
    catch { throw new HttpsError('invalid-argument', 'Confira as alternativas enviadas.') }
    tx.create(resultRef, { ownerId, result, submittedAt: FieldValue.serverTimestamp() })
    tx.update(ref, { status: 'submitted', submittedAt: FieldValue.serverTimestamp() })
    return result
  })
})
