export const demoQuestions = [
  {
    id: 'demo-1', category: 'Estruturas de dados',
    prompt: 'Qual é a complexidade de busca no pior caso em uma árvore binária de busca balanceada?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)'],
    correctAnswer: 'B',
    explanation: 'O balanceamento mantém a altura da árvore proporcional a log n. A cada comparação, a busca segue apenas uma das subárvores. Assim, percorre no máximo um caminho da raiz até uma folha, com O(log n) comparações.',
  },
  {
    id: 'demo-2', category: 'Banco de dados',
    prompt: 'Qual propriedade ACID garante que uma transação seja executada por completo ou não produza efeitos?',
    options: ['Atomicidade', 'Consistência', 'Isolamento', 'Durabilidade', 'Disponibilidade'],
    correctAnswer: 'A',
    explanation: 'Atomicidade trata a transação como uma unidade indivisível. Se uma operação falhar, as alterações da transação são desfeitas. Por exemplo, uma transferência não deve debitar uma conta sem creditar a outra. Durabilidade, por sua vez, garante a persistência após a confirmação.',
  },
  {
    id: 'demo-3', category: 'Redes de computadores',
    prompt: 'Qual serviço permite consultar o endereço IP associado a um nome de domínio?',
    options: ['DHCP', 'HTTP', 'DNS', 'FTP', 'SMTP'],
    correctAnswer: 'C',
    explanation: 'O DNS associa nomes de domínio a registros, como A (IPv4) e AAAA (IPv6). O cliente consulta um resolvedor para obter o endereço. DHCP fornece configuração de rede; HTTP transfere recursos web; FTP transfere arquivos; SMTP encaminha mensagens de e-mail.',
  },
]

export const demoAnswers = { 'demo-1': 'B', 'demo-2': 'D' }
