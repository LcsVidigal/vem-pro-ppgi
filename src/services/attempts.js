import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

export const startAttempt = async attemptId => (await httpsCallable(functions, 'startAttempt')({ attemptId })).data
export const submitAttempt = async (attemptId, answers) =>
  (await httpsCallable(functions, 'submitAttempt')({ attemptId, answers })).data

export function attemptError(error) {
  switch (error.code) {
    case 'functions/unauthenticated': return 'Sua sessão expirou. Entre novamente.'
    case 'functions/failed-precondition': return 'Ainda não há questões disponíveis com resolução.'
    case 'functions/resource-exhausted': return 'Limite de tentativas atingido. Tente novamente amanhã.'
    case 'functions/invalid-argument': return 'Não foi possível enviar essas respostas. Recarregue a tentativa.'
    case 'functions/permission-denied':
    case 'permission-denied': return 'Não foi possível acessar esta tentativa com sua conta.'
    default: return 'Não foi possível conectar ao serviço de correção. Tente novamente.'
  }
}
