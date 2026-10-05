import { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import './AdminQuestions.css'

// Master list of academic questions expanded to exactly 5 options (A, B, C, D, E)
const INITIAL_QUESTIONS = [
  {
    id: 'Q-101',
    category: 'Estruturas de Dados e Algoritmos',
    prompt: 'Qual é a complexidade de tempo no pior caso para a busca e inserção de um elemento em uma Árvore Binária de Busca Balanceada (como uma Árvore AVL ou Rubro-Negra) contendo n elementos?',
    options: [
      { letter: 'A', text: 'O(1) - Tempo constante independente do tamanho da estrutura de dados.' },
      { letter: 'B', text: 'O(log n) - Tempo logarítmico proporcional à altura máxima balanceada da árvore.' },
      { letter: 'C', text: 'O(n) - Tempo linear equivalente ao pior caso de uma árvore totalmente degenerada.' },
      { letter: 'D', text: 'O(n log n) - Tempo linearitmo comumente associado ao limite inferior de ordenação por comparação.' },
      { letter: 'E', text: 'O(n²) - Tempo quadrático típico de algoritmos ineficientes como Bubble Sort ou Selection Sort.' }
    ],
    correctAnswer: 'B',
    author: 'Prof. Dr. Ricardo Silva',
    explanation: 'A complexidade O(log n) é garantida porque árvores de busca balanceadas (AVL, Rubro-Negra) mantêm sua altura mínima, proporcional ao logaritmo do número de nós. A cada passo da busca, metade da subárvore restante é descartada, resultando em um caminho de busca de tamanho logarítmico.'
  },
  {
    id: 'Q-102',
    category: 'Sistemas de Bancos de Dados',
    prompt: 'No contexto do controle de concorrência em sistemas transacionais de bancos de dados (SGBDs), qual das seguintes propriedades ACID garante que todas as operações de uma transação sejam executadas por completo ou nenhuma delas seja aplicada ao disco?',
    options: [
      { letter: 'A', text: 'Atomicidade - Princípio indivisível do "tudo ou nada" que previne estados parciais e inconsistentes.' },
      { letter: 'B', text: 'Consistência - Exigência de que a transação mova o banco de dados de um estado íntegro para outro.' },
      { letter: 'C', text: 'Isolamento - Proteção que impede transações simultâneas de interferirem entre si antes da conclusão.' },
      { letter: 'D', text: 'Durabilidade - Garantia de que modificações confirmadas persistam mesmo após colapsos elétricos ou do SO.' },
      { letter: 'E', text: 'Redundância - Capacidade estrutural de espelhar blocos de dados transacionados para tolerância de falhas físicas.' }
    ],
    correctAnswer: 'A',
    author: 'Profª. Dra. Marina Costa',
    explanation: 'A Atomicidade assegura que a transação é uma operação atômica, ou seja, "tudo ou nada". Se qualquer parte da transação falhar, o banco de dados reverte para o estado anterior ao início da transação, prevenindo a persistência de dados parciais e inconsistentes.'
  },
  {
    id: 'Q-103',
    category: 'Redes de Computadores',
    prompt: 'Qual dos seguintes protocolos da camada de aplicação do modelo TCP/IP utiliza o protocolo de transporte UDP (porta 53) por padrão para realizar a tradução de nomes de domínio amigáveis em addresses IP numéricos legíveis por roteadores?',
    options: [
      { letter: 'A', text: 'DHCP (Dynamic Host Configuration Protocol) - Utilizado para alocação automática de endereços de rede.' },
      { letter: 'B', text: 'HTTP (Hypertext Transfer Protocol) - Protocolo voltado à transferência de documentos hipermídia na Web.' },
      { letter: 'C', text: 'DNS (Domain Name System) - Sistema hierárquico distribuído responsável por resolução de hosts.' },
      { letter: 'D', text: 'FTP (File Transfer Protocol) - Mecanismo seguro voltado para transferência de arquivos em fluxo contínuo.' },
      { letter: 'E', text: 'SMTP (Simple Mail Transfer Protocol) - Protocolo padrão para transferência confiável de correio eletrônico.' }
    ],
    correctAnswer: 'C',
    author: 'Prof. Dr. Carlos Eduardo',
    explanation: 'O DNS (Domain Name System) é o protocolo responsável por traduzir nomes de domínio (ex: www.google.com) em endereços IP. Ele utiliza a porta 53 e, para consultas rápidas, opera sobre UDP. TCP é usado para transferências de zona, que exigem maior confiabilidade.'
  },
  {
    id: 'Q-104',
    category: 'Teoria da Computação',
    prompt: 'Qual afirmação descreve corretamente a capacidade computacional de uma Máquina de Turing determinística (MTD)?',
    options: [
      { letter: 'A', text: 'Uma MTD pode resolver apenas problemas decidíveis em tempo polinomial (classe P).' },
      { letter: 'B', text: 'Uma MTD é limitada a reconhecer linguagens regulares, assim como autômatos finitos.' },
      { letter: 'C', text: 'Uma MTD não pode simular uma Máquina de Turing não determinística (MTND) com eficiência.' },
      { letter: 'D', text: 'Uma MTD pode computar qualquer função que seja computável por um algoritmo, conforme a tese de Church-Turing.' },
      { letter: 'E', text: 'Uma MTD sempre para (halting problem) para qualquer entrada fornecida, garantindo decidibilidade.' }
    ],
    correctAnswer: 'D',
    author: 'Prof. Dr. Alan Turing',
    explanation: 'A tese de Church-Turing postula que qualquer função computável por um algoritmo pode ser computada por uma Máquina de Turing. Isso a estabelece como um modelo universal para a computação teórica, não se limitando a classes de complexidade específicas como P ou a linguagens regulares.'
  },
  {
    id: 'Q-105',
    category: 'Sistemas Operacionais',
    prompt: 'Quais são as quatro condições necessárias e suficientes para a ocorrência de um deadlock em um sistema computacional?',
    options: [
      { letter: 'A', text: 'Preempção, Espera Circular, Fome (Starvation) e Exclusão Mútua.' },
      { letter: 'B', text: 'Posse e Espera, Não Preempção, Fragmentação e Acesso Sequencial.' },
      { letter: 'C', text: 'Exclusão Mútua, Posse e Espera, Não Preempção e Espera Circular.' },
      { letter: 'D', text: 'Isolamento, Consistência, Atomicidade e Durabilidade (ACID).' },
      { letter: 'E', text: 'Inversão de Prioridade, Seção Crítica, Semáforo e Monitor.' }
    ],
    correctAnswer: 'C',
    author: 'Profª. Dra. Ana Dijkstra',
    explanation: 'As quatro condições de Coffman para um deadlock são: 1) Exclusão Mútua (recursos não compartilháveis), 2) Posse e Espera (um processo detém um recurso enquanto espera por outro), 3) Não Preempção (um recurso não pode ser tomado de um processo) e 4) Espera Circular (um ciclo de processos esperando por recursos detidos por outros).'
  },
  {
    id: 'Q-106',
    category: 'Engenharia de Software',
    prompt: 'Dentro da metodologia Scrum, qual evento é dedicado à revisão do trabalho concluído durante a Sprint e à adaptação do Product Backlog com base no feedback dos stakeholders?',
    options: [
      { letter: 'A', text: 'Daily Scrum (Reunião Diária) - Sincronização diária da equipe de desenvolvimento.' },
      { letter: 'B', text: 'Sprint Review (Revisão da Sprint) - Inspeção do incremento e adaptação do backlog.' },
      { letter: 'C', text: 'Sprint Retrospective (Retrospectiva da Sprint) - Focada em melhorias no processo da equipe.' },
      { letter: 'D', text: 'Sprint Planning (Planejamento da Sprint) - Definição do trabalho a ser realizado na Sprint.' },
      { letter: 'E', text: 'Backlog Refinement (Refinamento do Backlog) - Atividade contínua de detalhamento dos itens.' }
    ],
    correctAnswer: 'B',
    author: 'Prof. Dr. Ken Schwaber',
    explanation: 'A Sprint Review é o evento focado no produto, onde a equipe apresenta o "Incremento" de software funcional aos stakeholders para obter feedback. A Sprint Retrospective, por outro lado, é focada no processo, onde a equipe discute como melhorar sua forma de trabalhar.'
  },
  {
    id: 'Q-107',
    category: 'Inteligência Artificial',
    prompt: 'O algoritmo de busca A* é uma extensão do algoritmo de Dijkstra e encontra o caminho de menor custo entre nós. Sua eficiência se deve ao uso de uma função heurística f(n) = g(n) + h(n). O que g(n) e h(n) representam?',
    options: [
      { letter: 'A', text: 'g(n) é o custo do nó inicial, e h(n) é o custo do nó final.' },
      { letter: 'B', text: 'g(n) é o custo exato do caminho do nó inicial até n, e h(n) é o custo estimado de n até o objetivo.' },
      { letter: 'C', text: 'g(n) é uma estimativa do custo de n até o objetivo, e h(n) é o custo exato do início até n.' },
      { letter: 'D', text: 'g(n) é o número de vizinhos de n, e h(n) é a profundidade de n na árvore de busca.' },
      { letter: 'E', text: 'g(n) e h(n) são duas heurísticas diferentes para estimar o custo total do caminho.' }
    ],
    correctAnswer: 'B',
    author: 'Prof. Dr. Peter Hart',
    explanation: 'A função de avaliação do A* é f(n) = g(n) + h(n). g(n) é o custo real e conhecido do caminho desde o início até o nó n. h(n) é uma estimativa (heurística) do custo do caminho mais barato de n até o nó objetivo. A* busca minimizar f(n).'
  },
  {
    id: 'Q-108',
    category: 'Compiladores',
    prompt: 'Qual é a ordem correta das fases principais de um compilador tradicional?',
    options: [
      { letter: 'A', text: 'Análise Léxica, Geração de Código, Análise Semântica, Análise Sintática, Otimização.' },
      { letter: 'B', text: 'Análise Sintática, Análise Léxica, Análise Semântica, Geração de Código, Otimização.' },
      { letter: 'C', text: 'Análise Léxica, Análise Sintática, Análise Semântica, Geração de Código Intermediário, Otimização.' },
      { letter: 'D', text: 'Geração de Código, Otimização, Análise Léxica, Análise Sintática, Análise Semântica.' },
      { letter: 'E', text: 'Análise Léxica, Análise Semântica, Análise Sintática, Otimização, Geração de Código.' }
    ],
    correctAnswer: 'C',
    author: 'Prof. Dr. Alfred Aho',
    explanation: 'Um compilador clássico processa o código-fonte em uma sequência de fases: Análise Léxica (tokens), Análise Sintática (árvore sintática), Análise Semântica (verificação de tipos), Geração de Código Intermediário, Otimização desse código e, finalmente, Geração de Código de Máquina.'
  },
  {
    id: 'Q-109',
    category: 'Lógica para Computação',
    prompt: 'Na lógica proposicional, qual das seguintes expressões é logicamente equivalente à implicação P → Q?',
    options: [
      { letter: 'A', text: 'Q → P (A recíproca)' },
      { letter: 'B', text: '¬P → ¬Q (A inversa)' },
      { letter: 'C', text: 'P ∧ ¬Q (A negação da implicação)' },
      { letter: 'D', text: '¬Q → ¬P (A contrapositiva)' },
      { letter: 'E', text: 'P ∨ Q' }
    ],
    correctAnswer: 'D',
    author: 'Prof. Dr. George Boole',
    explanation: 'A implicação P → Q (se P, então Q) é falsa apenas quando P é verdadeiro e Q é falso. A contrapositiva ¬Q → ¬P (se não Q, então não P) também é falsa apenas quando ¬Q é verdadeiro (Q é falso) e ¬P é falso (P é verdadeiro). Portanto, elas são logicamente equivalentes.'
  },
  {
    id: 'Q-110',
    category: 'Arquitetura de Computadores',
    prompt: 'Considerando a hierarquia de memória de um computador moderno, qual alternativa ordena corretamente os componentes do mais rápido (menor tempo de acesso) para o mais lento (maior tempo de acesso)?',
    options: [
      { letter: 'A', text: 'Memória Principal (RAM), Cache L1, SSD, Registradores.' },
      { letter: 'B', text: 'Registradores, Cache L1, Cache L2, Memória Principal (RAM), SSD.' },
      { letter: 'C', text: 'SSD, Memória Principal (RAM), Cache L2, Cache L1, Registradores.' },
      { letter: 'D', text: 'Registradores, Memória Principal (RAM), Cache L1, Cache L2, SSD.' },
      { letter: 'E', text: 'Cache L1, Registradores, Cache L2, SSD, Memória Principal (RAM).' }
    ],
    correctAnswer: 'B',
    author: 'Prof. Dr. John von Neumann',
    explanation: 'A velocidade de acesso à memória é inversamente proporcional à sua distância da CPU. Os Registradores estão dentro da CPU (mais rápidos), seguidos pelos caches (L1, L2, L3), a Memória Principal (RAM) e, por fim, o armazenamento secundário como SSDs e HDs (mais lentos).'
  },
  {
    id: 'Q-111',
    category: 'Análise de Algoritmos',
    prompt: 'Um algoritmo tem uma complexidade de tempo de O(n log n). Se o algoritmo leva 1 segundo para processar uma entrada de 1.000 elementos, qual é o tempo de execução esperado para uma entrada de 2.000 elementos, assumindo que n é o fator dominante?',
    options: [
      { letter: 'A', text: 'Aproximadamente 2 segundos.' },
      { letter: 'B', text: 'Aproximadamente 4 segundos.' },
      { letter: 'C', text: 'Pouco mais de 2 segundos (aprox. 2 * (log 2000 / log 1000) segundos).' },
      { letter: 'D', text: 'Aproximadamente 1 segundo, pois a constante pode ser grande.' },
      { letter: 'E', text: 'Aproximadamente 8 segundos.' }
    ],
    correctAnswer: 'C',
    author: 'Prof. Dr. Donald Knuth',
    explanation: 'A relação é T(n) ≈ c * n * log(n). A razão T(2000)/T(1000) é (2000 * log 2000) / (1000 * log 1000) = 2 * log(2000)/log(1000). Usando log base 10, temos 2 * (3.3) / (3) ≈ 2.2. Portanto, o tempo será um pouco mais de 2 segundos. A opção C descreve essa relação matemática.'
  },
  {
    id: 'Q-112',
    category: 'Grafos',
    prompt: 'O algoritmo de Dijkstra é usado para encontrar o caminho mais curto de uma única fonte em um grafo ponderado. Qual é a principal restrição para que o algoritmo de Dijkstra funcione corretamente e garanta a otimalidade?',
    options: [
      { letter: 'A', text: 'O grafo não pode conter ciclos.' },
      { letter: 'B', text: 'O grafo deve ser totalmente conectado.' },
      { letter: 'C', text: 'Todas as arestas devem ter pesos negativos.' },
      { letter: 'D', text: 'O grafo não pode ter arestas com pesos negativos.' },
      { letter: 'E', text: 'O grafo deve ser não-direcionado.' }
    ],
    correctAnswer: 'D',
    author: 'Prof. Dr. Edsger Dijkstra',
    explanation: 'O algoritmo de Dijkstra funciona selecionando o nó não visitado com a menor distância conhecida (abordagem gulosa). Se houver arestas de peso negativo, essa escolha gulosa pode não ser ótima, pois um caminho futuro através de uma aresta negativa poderia resultar em um caminho total mais curto para um nó já visitado.'
  },
  {
    id: 'Q-113',
    category: 'Sistemas de Bancos de Dados',
    prompt: 'Uma relação está na Terceira Forma Normal (3FN) se, e somente se, ela está na Segunda Forma Normal (2FN) e...',
    options: [
      { letter: 'A', text: 'todos os seus atributos são atômicos.' },
      { letter: 'B', text: 'não existem dependências parciais de atributos não-chave em relação à chave primária.' },
      { letter: 'C', text: 'não existem dependências transitivas de atributos não-chave em relação à chave primária.' },
      { letter: 'D', text: 'para toda dependência multivalorada X ->> Y, X é uma superchave.' },
      { letter: 'E', text: 'todos os atributos dependem da chave, somente da chave e de nada mais que a chave, exceto para dependências funcionais.' }
    ],
    correctAnswer: 'C',
    author: 'Prof. Dr. Edgar F. Codd',
    explanation: 'Uma relação está em 2FN se não há dependências parciais. Para estar em 3FN, além de estar em 2FN, ela não pode ter dependências transitivas, ou seja, um atributo não-chave não pode depender de outro atributo não-chave.'
  },
  {
    id: 'Q-114',
    category: 'Redes de Computadores',
    prompt: 'Qual camada do modelo OSI (Open Systems Interconnection) corresponde funcionalmente à camada de Enlace (Link Layer) do modelo TCP/IP?',
    options: [
      { letter: 'A', text: 'Camada Física.' },
      { letter: 'B', text: 'Camada de Enlace de Dados (Data Link).' },
      { letter: 'C', text: 'Camada de Rede.' },
      { letter: 'D', text: 'Camada de Transporte.' },
      { letter: 'E', text: 'A camada de Enlace do TCP/IP combina as funcionalidades das camadas Física e de Enlace de Dados do OSI.' }
    ],
    correctAnswer: 'E',
    author: 'Prof. Dr. Vint Cerf',
    explanation: 'O modelo TCP/IP é mais prático e combina camadas. Sua camada de Enlace (ou Acesso à Rede) abrange as responsabilidades da camada Física (transmissão de bits) e da camada de Enlace de Dados (endereçamento MAC, controle de acesso ao meio) do modelo conceitual OSI.'
  },
  {
    id: 'Q-115',
    category: 'Engenharia de Software',
    prompt: 'O padrão de projeto (Design Pattern) "Singleton" tem como principal objetivo:',
    options: [
      { letter: 'A', text: 'Criar uma família de objetos relacionados sem especificar suas classes concretas.' },
      { letter: 'B', text: 'Garantir que uma classe tenha apenas uma instância e fornecer um ponto de acesso global a ela.' },
      { letter: 'C', text: 'Definir uma interface para criar um objeto, mas deixar as subclasses decidirem qual classe instanciar.' },
      { letter: 'D', text: 'Permitir que um objeto altere seu comportamento quando seu estado interno muda.' },
      { letter: 'E', text: 'Converter a interface de uma classe em outra interface que os clientes esperam.' }
    ],
    correctAnswer: 'B',
    author: 'Prof. Dr. Erich Gamma',
    explanation: 'O padrão Singleton restringe a instanciação de uma classe a um único objeto. Ele é útil quando exatamente um objeto é necessário para coordenar ações em todo o sistema, como um gerenciador de logs, um pool de conexões ou um driver de dispositivo.'
  },
  {
    id: 'Q-116',
    category: 'Sistemas Operacionais',
    prompt: 'Qual algoritmo de escalonamento de processos da CPU pode sofrer do problema de "fome" (starvation), onde um processo de baixa prioridade pode nunca ser executado?',
    options: [
      { letter: 'A', text: 'Round-Robin, pois garante uma fatia de tempo (quantum) para todos os processos.' },
      { letter: 'B', text: 'First-Come, First-Served (FCFS), pois não considera prioridades.' },
      { letter: 'C', text: 'Escalonamento por Prioridades (Priority Scheduling) sem envelhecimento (aging).' },
      { letter: 'D', text: 'Shortest Job First (SJF) não-preemptivo, pois um processo longo pode bloquear outros.' },
      { letter: 'E', text: 'Escalonamento de Múltiplas Filas com Feedback (Multilevel Feedback Queue).' }
    ],
    correctAnswer: 'C',
    author: 'Prof. Dr. Andrew Tanenbaum',
    explanation: 'Em um escalonamento por prioridades puro, se houver um fluxo contínuo de processos de alta prioridade, um processo de baixa prioridade pode nunca receber tempo de CPU, levando à "fome" (starvation). A técnica de "envelhecimento" (aging) aumenta gradualmente a prioridade de processos que esperam há muito tempo para evitar isso.'
  },
  {
    id: 'Q-117',
    category: 'Inteligência Artificial',
    prompt: 'Em uma rede neural artificial, qual é a função da "função de ativação" em um neurônio?',
    options: [
      { letter: 'A', text: 'Calcular a soma ponderada das entradas.' },
      { letter: 'B', text: 'Ajustar os pesos da rede durante o treinamento (backpropagation).' },
      { letter: 'C', text: 'Introduzir não-linearidade no modelo, permitindo que ele aprenda padrões complexos.' },
      { letter: 'D', text: 'Normalizar os dados de entrada para que tenham média zero e desvio padrão um.' },
      { letter: 'E', text: 'Definir a taxa de aprendizado (learning rate) da rede.' }
    ],
    correctAnswer: 'C',
    author: 'Prof. Dr. Geoffrey Hinton',
    explanation: 'A função de ativação determina a saída de um neurônio com base na soma ponderada de suas entradas. Funções não-lineares (como ReLU, Sigmoid, Tanh) são cruciais porque permitem que a rede neural aprenda e modele relações complexas e não-lineares presentes nos dados.'
  },
  {
    id: 'Q-118',
    category: 'Estruturas de Dados e Algoritmos',
    prompt: 'Qual é a principal propriedade de uma estrutura de dados do tipo Max-Heap?',
    options: [
      { letter: 'A', text: 'É uma árvore binária de busca onde todos os elementos à esquerda são menores e à direita são maiores.' },
      { letter: 'B', text: 'O valor de cada nó é maior ou igual ao valor de seus filhos.' },
      { letter: 'C', text: 'Os elementos são inseridos e removidos em uma ordem LIFO (Last-In, First-Out).' },
      { letter: 'D', text: 'A busca por um elemento tem complexidade de tempo O(1).' },
      { letter: 'E', text: 'O valor de cada nó é menor ou igual ao valor de seus filhos.' }
    ],
    correctAnswer: 'B',
    author: 'Prof. Dr. Thomas Cormen',
    explanation: 'A propriedade fundamental de um Max-Heap é que, para qualquer nó i diferente da raiz, o valor de A[pai(i)] é maior ou igual ao valor de A[i]. Isso garante que o maior elemento da estrutura de dados esteja sempre na raiz.'
  }
]

function AdminQuestions() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSeeding, setIsSeeding] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)

  // Search Filter State
  const [searchTerm, setSearchTerm] = useState('')

  // Edit/Add Question Modal States
  const [editingQuestion, setEditingQuestion] = useState(null) // Holds { id, isNew: boolean } or real question
  const [editPrompt, setEditPrompt] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editOptions, setEditOptions] = useState([])
  const [editCorrectAnswer, setEditCorrectAnswer] = useState('A')
  const [editExplanation, setEditExplanation] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // 1. Listen to Cloud Firestore real-time updates (onSnapshot)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "questions"), (snapshot) => {
      const questionsData = []
      snapshot.forEach((doc) => {
        questionsData.push({ id: doc.id, ...doc.data() })
      })

      // Sort questions alphabetically by ID to keep the listing aligned
      questionsData.sort((a, b) => a.id.localeCompare(b.id))

      setQuestions(questionsData)
      setLoading(false)
    }, (error) => {
      console.error("Firestore Loading Error (Check Security Rules):", error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Helper to trigger subtle toast notifications
  const showToast = (message) => {
    setToastMessage(message)
    setTimeout(() => {
      setToastMessage(null)
    }, 3500)
  }

  // 2. Open Add Modal (Auto-generates sequential ID Q-10X)
  const handleOpenAddModal = () => {
    let nextId = 'Q-101'
    if (questions.length > 0) {
      // Find the maximum numeric ID currently active in Firestore
      const idNumbers = questions.map((q) => {
        const num = parseInt(q.id.replace('Q-', ''), 10)
        return isNaN(num) ? 0 : num
      })
      const maxId = Math.max(...idNumbers)
      nextId = `Q-${maxId + 1}`
    }

    setEditingQuestion({ id: nextId, isNew: true })
    setEditPrompt('')
    setEditCategory('')
    setEditAuthor('')
    setEditOptions([
      { letter: 'A', text: '' },
      { letter: 'B', text: '' },
      { letter: 'C', text: '' },
      { letter: 'D', text: '' },
      { letter: 'E', text: '' }
    ])
    setEditCorrectAnswer('A')
    setEditExplanation('')
  }

  // 3. Open Edit Modal with selected question's current data
  const handleOpenEditModal = (q) => {
    setEditingQuestion({ id: q.id, isNew: false })
    setEditPrompt(q.prompt || '')
    setEditCategory(q.category || '')
    setEditAuthor(q.author || '')
    setEditOptions(q.options ? [...q.options] : [
      { letter: 'A', text: '' },
      { letter: 'B', text: '' },
      { letter: 'C', text: '' },
      { letter: 'D', text: '' },
      { letter: 'E', text: '' }
    ])
    setEditCorrectAnswer(q.correctAnswer || 'A')
    setEditExplanation(q.explanation || '')
  }

  // 4. Submit Add or Edit modifications directly to Firestore Database
  const handleSaveQuestion = async () => {
    if (!editPrompt.trim() || !editCategory.trim() || !editAuthor.trim() || !editExplanation.trim()) {
      alert("Por favor, preencha o enunciado, assunto, autor e o comentário/explicação da questão.")
      return
    }

    const hasEmptyOption = editOptions.some(o => !o.text.trim())
    if (hasEmptyOption) {
      alert("Todas as 5 alternativas de respostas precisam estar preenchidas.")
      return
    }

    setIsSaving(true)
    try {
      const docRef = doc(db, "questions", editingQuestion.id)
      const questionPayload = {
        category: editCategory,
        prompt: editPrompt,
        author: editAuthor,
        options: editOptions,
        correctAnswer: editCorrectAnswer,
        explanation: editExplanation
      }

      // Write directly to Cloud Firestore (Works for both creation and updates)
      await setDoc(docRef, questionPayload)

      const successMessage = editingQuestion.isNew
        ? `Questão ${editingQuestion.id} criada com sucesso no Firestore!`
        : `Questão ${editingQuestion.id} atualizada com sucesso no Firestore!`

      setEditingQuestion(null) // Close modal
      showToast(successMessage)
    } catch (err) {
      console.error("Error writing document to Firestore:", err)
      alert("Erro ao gravar no Firestore. Certifique-se de que suas regras de segurança permitem gravação.")
    } finally {
      setIsSaving(false)
    }
  }

  // 5. Delete Question directly from Cloud Firestore Database
  const handleDeleteQuestion = async (id) => {
    const confirmDelete = window.confirm(`⚠️ Tem certeza de que deseja excluir a questão ${id} permanentemente do Cloud Firestore?`)

    if (confirmDelete) {
      try {
        await deleteDoc(doc(db, "questions", id))
        showToast(`Questão ${id} excluída do Firestore com sucesso!`)
      } catch (err) {
        console.error("Error deleting document from Firestore:", err)
        alert("Erro ao excluir do Firestore. Certifique-se de que suas regras de segurança permitem exclusão.")
      }
    }
  }

  // 6. Seed Firestore Database with default questions
  const handleSeedDatabase = async () => {
    setIsSeeding(true)
    try {
      for (const q of INITIAL_QUESTIONS) {
        await setDoc(doc(db, "questions", q.id), q)
      }
      showToast("Banco de dados semeado com sucesso!")
    } catch (err) {
      console.error("Error writing default questions to Firestore:", err)
      alert("Erro ao semear banco de dados. Verifique a ativação do Cloud Firestore e as Regras de Segurança.")
    } finally {
      setIsSeeding(false)
    }
  }

  // 7. Perform Client-Side Reactive Question Filtering
  const filteredQuestions = questions.filter((q) => {
    const term = searchTerm.toLowerCase()
    return (
      q.id.toLowerCase().includes(term) ||
      (q.category && q.category.toLowerCase().includes(term)) ||
      (q.prompt && q.prompt.toLowerCase().includes(term)) ||
      (q.author && q.author.toLowerCase().includes(term))
    )
  })

  return (
    <div className="admin-container">
      {/* Toast alert indicator */}
      {toastMessage && (
        <div
          className="auth-alert success"
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 1000,
            boxShadow: 'var(--shadow)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <svg className="auth-alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Admin header */}
      <div className="admin-header-row">
        <div className="admin-header-info">
          <h1 className="admin-portal-title">Banco de Questões</h1>
          <p className="admin-portal-subtitle">Painel conectado em tempo real com o seu banco de dados Cloud Firestore do Firebase.</p>
        </div>

        <button onClick={handleOpenAddModal} className="admin-btn-add">
          {/* Plus Icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Adicionar Questão</span>
        </button>
      </div>

      {loading ? (
        /* Loader while listening to Firestore */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', borderTopColor: 'var(--accent)', borderWidth: '3px', borderColor: 'var(--border)' }}></div>
          <p style={{ marginTop: '16px', color: 'var(--text)', fontSize: '15px' }}>Carregando questões do Firestore...</p>
        </div>
      ) : questions.length === 0 ? (
        /* Empty State with Seed Action button */
        <div className="admin-empty-state">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="empty-state-title">Nenhuma questão no Firestore</h3>
          <p className="empty-state-description">
            A sua coleção "questions" no Cloud Firestore está vazia. Você pode semear o banco com as 3 questões acadêmicas padrão contendo 5 alternativas cada!
          </p>
          <button
            onClick={handleSeedDatabase}
            className="admin-btn-add"
            disabled={isSeeding}
            style={{ margin: '0 auto' }}
          >
            {isSeeding ? (
              <>
                <div className="spinner"></div>
                <span>Semeando...</span>
              </>
            ) : (
              <span>Semear Firestore com Questões de Teste</span>
            )}
          </button>
        </div>
      ) : (
        /* Render real database questions from Cloud Firestore */
        <>
          {/* Real-time Filter Search Bar */}
          <div className="admin-search-wrapper">
            <div className="search-input-icon">
              {/* Search Magnifying Glass Icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              className="admin-search-input"
              placeholder="Pesquisar questões por assunto, enunciado, ID ou autor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="search-clear-button"
                title="Limpar busca"
              >
                {/* Close/Clear Icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Search Result Fallback block */}
          {filteredQuestions.length === 0 ? (
            <div className="search-no-results">
              <svg style={{ color: 'var(--text)', opacity: 0.6, width: '48px', height: '48px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <h4 className="search-no-results-title">Nenhum resultado encontrado</h4>
              <p className="search-no-results-desc">
                Não encontramos nenhuma questão correspondente aos termos de busca: <strong>"{searchTerm}"</strong>.
              </p>
              <button onClick={() => setSearchTerm('')} className="nav-btn nav-btn-outline">
                Limpar Filtro de Busca
              </button>
            </div>
          ) : (
            /* Render list of filtered questions */
            <div className="questions-list">
              {filteredQuestions.map((q) => (
                <article key={q.id} className="question-card">
                  <div className="question-card-header">
                    <div className="question-meta">
                      <span className="question-id-badge">{q.id}</span>
                      <span className="question-category">{q.category}</span>
                    </div>
                  </div>

                  <h2 className="question-prompt">{q.prompt}</h2>

                  {/* Render the 5 options */}
                  <ul className="question-options-list">
                    {q.options?.map((opt) => {
                      const isCorrect = opt.letter === q.correctAnswer
                      return (
                        <li
                          key={opt.letter}
                          className={`question-option-item ${isCorrect ? 'correct' : ''}`}
                        >
                          <span className="option-letter">{opt.letter}</span>
                          <span>{opt.text}</span>
                          {isCorrect && (
                            <span className="option-correct-badge">
                              {/* Check Icon */}
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Gabarito
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>

                  {/* Action row */}
                  <div className="question-card-footer">
                    <span className="question-author-stamp">
                      Cadastrado por: <strong>{q.author}</strong>
                    </span>

                    <div className="question-actions-group">
                      <button
                        onClick={() => handleOpenEditModal(q)}
                        className="question-action-btn edit"
                        title="Editar Questão"
                      >
                        {/* Pencil Icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="question-action-btn delete"
                        title="Excluir Questão"
                      >
                        {/* Trash Icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Beautiful Add/Edit Question Modal Form */}
      {editingQuestion && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editingQuestion.isNew ? 'Adicionar Nova Questão' : `Editar Questão ${editingQuestion.id}`}
              </h2>
              <button onClick={() => setEditingQuestion(null)} className="admin-modal-close-btn" aria-label="Fechar">
                {/* Close Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="admin-modal-body">
              {/* Auto-generated ID Info (only for new questions) */}
              {editingQuestion.isNew && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  color: 'var(--text)',
                  background: 'var(--social-bg)',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)'
                }}>
                  <span>Identificador Gerado Automaticamente:</span>
                  <strong className="question-id-badge">{editingQuestion.id}</strong>
                </div>
              )}

              {/* Enunciado Form Group */}
              <div className="form-group">
                <label className="form-label">Enunciado da Questão</label>
                <textarea
                  className="auth-input"
                  style={{ minHeight: '80px', resize: 'vertical', fontFamily: 'var(--sans)', lineHeight: '1.4' }}
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  disabled={isSaving}
                  placeholder="Digite o enunciado completo..."
                />
              </div>

              {/* Explanation Form Group */}
              <div className="form-group">
                <label className="form-label">Comentário / Explicação da Resposta</label>
                <textarea
                  className="auth-input"
                  style={{ minHeight: '100px', resize: 'vertical', fontFamily: 'var(--sans)', lineHeight: '1.4' }}
                  value={editExplanation}
                  onChange={(e) => setEditExplanation(e.target.value)}
                  disabled={isSaving}
                  placeholder="Explique o porquê da alternativa correta e o erro das incorretas..."
                />
              </div>

              {/* Assunto e Autor Form Group */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Assunto / Matéria</label>
                  <input
                    type="text"
                    className="auth-input"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    disabled={isSaving}
                    placeholder="Ex: Teoria da Computação"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Professor Autor</label>
                  <input
                    type="text"
                    className="auth-input"
                    value={editAuthor}
                    onChange={(e) => setEditAuthor(e.target.value)}
                    disabled={isSaving}
                    placeholder="Nome do professor responsável"
                  />
                </div>
              </div>

              {/* As 5 Alternativas de Resposta */}
              <div className="form-group">
                <label className="form-label">As 5 Alternativas</label>
                <div className="options-edit-grid">
                  {editOptions.map((opt, index) => (
                    <div key={opt.letter} className="option-edit-row">
                      <span className="option-letter-badge">{opt.letter}</span>
                      <input
                        type="text"
                        className="auth-input"
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...editOptions]
                          updated[index] = { ...opt, text: e.target.value }
                          setEditOptions(updated)
                        }}
                        disabled={isSaving}
                        placeholder={`Digite a alternativa ${opt.letter}...`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Gabarito Selector */}
              <div className="form-group correct-select-wrapper">
                <label className="form-label">Gabarito Oficial (Alternativa Correta)</label>
                <select
                  className="auth-input"
                  value={editCorrectAnswer}
                  onChange={(e) => setEditCorrectAnswer(e.target.value)}
                  disabled={isSaving}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="A">Alternativa A</option>
                  <option value="B">Alternativa B</option>
                  <option value="C">Alternativa C</option>
                  <option value="D">Alternativa D</option>
                  <option value="E">Alternativa E</option>
                </select>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="admin-modal-footer">
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="nav-btn nav-btn-outline"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveQuestion}
                className="nav-btn nav-btn-primary"
                disabled={isSaving}
                style={{ background: 'var(--accent)' }}
              >
                {isSaving ? (
                  <>
                    <div className="spinner" style={{ width: '14px', height: '14px', marginRight: '6px' }}></div>
                    <span>Gravando...</span>
                  </>
                ) : (
                  <span>{editingQuestion.isNew ? 'Criar Questão' : 'Salvar Alterações'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminQuestions
