import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { validQuestion } from '../grading.js'

// This script cannot target a real project, even with production credentials present.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
initializeApp({ projectId: 'demo-vem-pro-ppgi' })
const db = getFirestore()
const auth = getAuth()
for (const [uid, email, admin] of [
  ['local-student', 'aluno@example.test', false],
  ['local-admin', 'admin@example.test', true]
]) {
  try { await auth.getUser(uid) }
  catch (err) {
    if (err.code !== 'auth/user-not-found') throw err
    await auth.createUser({ uid, email, password: 'TesteLocal123!', emailVerified: true })
  }
  await auth.setCustomUserClaims(uid, { admin })
}
const questions = [
  { id: 'local-1', category: 'Algoritmos', prompt: 'Qual é a complexidade da busca em uma árvore binária de busca balanceada com n elementos?',
    answers: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)'], correctAnswer: 'B',
    explanation: 'A busca compara a chave com o nó atual e segue apenas um dos seus filhos. Em uma árvore balanceada, a altura cresce proporcionalmente a log n. Como a busca visita no máximo um nó por nível, o número de comparações no pior caso é O(log n).' },
  { id: 'local-2', category: 'Banco de dados', prompt: 'Qual propriedade ACID garante que uma transação seja aplicada por inteiro ou não seja aplicada?',
    answers: ['Atomicidade', 'Consistência', 'Isolamento', 'Durabilidade', 'Redundância'], correctAnswer: 'A',
    explanation: 'A atomicidade trata a transação como uma unidade indivisível. Se todas as operações terminam com sucesso, a transação pode ser confirmada. Se ocorre uma falha, as alterações parciais são desfeitas. Durabilidade, por sua vez, trata da persistência das alterações já confirmadas.' },
  { id: 'local-3', category: 'Redes', prompt: 'Qual protocolo resolve nomes de domínio em endereços IP?',
    answers: ['DHCP', 'HTTP', 'DNS', 'FTP', 'SMTP'], correctAnswer: 'C',
    explanation: 'O DNS consulta registros de nomes em uma estrutura hierárquica. Registros A relacionam nomes a endereços IPv4 e registros AAAA a endereços IPv6. DHCP configura parâmetros de rede; HTTP transfere recursos web; FTP transfere arquivos; SMTP transporta e-mail.' },
  { id: 'local-4', category: 'Sistemas Operacionais', prompt: 'Qual condição é necessária para a ocorrência de deadlock segundo as condições de Coffman?',
    answers: ['Todos os recursos devem ser compartilháveis', 'Todos os processos devem ter a mesma prioridade', 'O sistema deve executar apenas um processo', 'Deve existir espera circular entre processos', 'Todos os recursos devem permitir preempção'], correctAnswer: 'D',
    explanation: 'As quatro condições necessárias são exclusão mútua, posse e espera, ausência de preempção e espera circular. Na espera circular, cada processo de um ciclo aguarda um recurso retido pelo próximo processo. Para ocorrer deadlock, as quatro condições precisam estar presentes; a espera circular, isoladamente, não basta em todos os modelos de recursos. Eliminar uma das condições é uma estratégia de prevenção.' },
  { id: 'local-5', category: 'Engenharia de Software', prompt: 'Qual tipo de teste verifica a interação entre módulos ou componentes de um sistema?',
    answers: ['Teste unitário', 'Teste de aceitação', 'Teste de usabilidade', 'Teste de carga', 'Teste de integração'], correctAnswer: 'E',
    explanation: 'O teste de integração verifica se componentes funcionam corretamente em conjunto, incluindo contratos de interfaces, troca de dados e tratamento de erros. Por exemplo, pode conferir se uma API grava e recupera dados no banco corretamente. Testes unitários focam unidades isoladas; testes de aceitação verificam critérios de negócio; testes de usabilidade avaliam o uso da interface; testes de carga avaliam o comportamento sob volume de trabalho.' }
]
for (const { id, answers, ...question } of questions) {
  const payload = { ...question, author: 'Ambiente local', published: true,
    options: answers.map((text, i) => ({ letter: 'ABCDE'[i], text })) }
  if (!validQuestion(payload)) throw new Error(`Questão de exemplo inválida: ${id}`)
  await db.doc(`questions/${id}`).set(payload)
}
await db.terminate()
console.log(`Emuladores preparados: ${questions.length} questões e contas locais de aluno e administrador.`)
