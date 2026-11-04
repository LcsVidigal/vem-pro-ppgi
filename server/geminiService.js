import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Predefined PPGI UFAM categories for consistent classification
export const PPGI_CATEGORIES = [
  'Algoritmos e Estrutura de Dados',
  'Banco de Dados',
  'Engenharia de Software',
  'Redes de Computadores',
  'Sistemas Operacionais',
  'Inteligência Artificial',
  'Teoria da Computação e Compiladores',
  'Arquitetura e Organização de Computadores',
  'Edital Geral / Matemática Discreta'
]

const FIREBASE_PROJECT_ID = 'vem-pro-ppgi-511721'
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`
const FIRESTORE_GEMINI_DOC_URL = `${FIRESTORE_BASE_URL}/settings/gemini`

// Trava para evitar múltiplas requisições simultâneas acidentais
let isExtractionInProgress = false

// Extrai o valor do token de qualquer nome de campo que o usuário tenha criado no documento do Firestore
function extractKeyFromFirestoreFields(fields) {
  if (!fields || typeof fields !== 'object') return null

  const priorityKeys = [
    'apiKey',
    'GEMINI_API_KEY',
    'geminiApiKey',
    'api_key',
    'token',
    'key',
    'value',
    'gemini'
  ]
  for (const k of priorityKeys) {
    const val = fields[k]?.stringValue?.trim()
    if (val) return val
  }

  for (const [k, v] of Object.entries(fields)) {
    if (k === 'updatedAt' || k === 'createdAt') continue
    const val = v?.stringValue?.trim()
    if (val && val.length > 10) {
      return val
    }
  }

  return null
}

// Salva automaticamente a chave local no Firestore (coleção "settings", documento "gemini")
async function syncApiKeyToFirestore(apiKey) {
  if (!apiKey) return
  try {
    await fetch(
      `${FIRESTORE_GEMINI_DOC_URL}?updateMask.fieldPaths=apiKey&updateMask.fieldPaths=GEMINI_API_KEY&updateMask.fieldPaths=updatedAt`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            apiKey: { stringValue: apiKey },
            GEMINI_API_KEY: { stringValue: apiKey },
            updatedAt: { stringValue: new Date().toISOString() }
          }
        })
      }
    )
  } catch {
    // Ignora silenciosamente se offline ou sem permissão
  }
}

// Busca a chave do Gemini salva no Firestore caso o colega não tenha o arquivo .env local
async function fetchApiKeyFromFirestore() {
  const candidateUrls = [
    `${FIRESTORE_BASE_URL}/settings/gemini`,
    `${FIRESTORE_BASE_URL}/settings`,
    `${FIRESTORE_BASE_URL}/gemini`,
    `${FIRESTORE_BASE_URL}/config`,
    `${FIRESTORE_BASE_URL}/tokens`
  ]

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()

      if (data?.fields) {
        const found = extractKeyFromFirestoreFields(data.fields)
        if (found) {
          process.env.GEMINI_API_KEY = found
          return found
        }
      }

      if (Array.isArray(data?.documents)) {
        for (const docItem of data.documents) {
          const found = extractKeyFromFirestoreFields(docItem?.fields)
          if (found) {
            process.env.GEMINI_API_KEY = found
            return found
          }
        }
      }
    } catch {
      // Continua tentando o próximo caminho
    }
  }

  return null
}

// Helper to safely load GEMINI_API_KEY from environment, .env file, or Firebase Firestore
export async function getGeminiApiKey(overrideApiKey = null) {
  if (overrideApiKey && typeof overrideApiKey === 'string' && overrideApiKey.trim()) {
    const clean = overrideApiKey.trim()
    process.env.GEMINI_API_KEY = clean
    return clean
  }

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim()
  }

  const candidateEnvPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../.env')
  ]

  for (const envPath of candidateEnvPaths) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
      for (const line of lines) {
        const [key, ...vals] = line.split('=')
        if (key && key.trim() === 'GEMINI_API_KEY') {
          const val = vals.join('=').trim().replace(/^["']|["']$/g, '')
          if (val) {
            process.env.GEMINI_API_KEY = val
            syncApiKeyToFirestore(val)
            return val
          }
        }
      }
    }
  }

  const firestoreKey = await fetchApiKeyFromFirestore()
  if (firestoreKey) {
    return firestoreKey
  }

  return null
}

// Ao iniciar o servidor, se houver chave no .env local, já sincroniza com o Firestore automaticamente
getGeminiApiKey().catch(() => {})

// Limpa blocos markdown ```json ... ``` caso o modelo retorne cercado por crases
function extractCleanJson(rawText) {
  if (!rawText) return ''
  let text = rawText.trim()
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim()
  }
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1)
  }
  return text
}

// Consulta rápida na API para listar modelos realmente ativos na conta (sem gastar cota de geração)
async function discoverAvailableModels(apiKey) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    )
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data?.models)) return []

    const usable = data.models
      .filter(
        (m) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          !m.name.includes('tts') &&
          !m.name.includes('image') &&
          !m.name.includes('embedding') &&
          !m.name.includes('lyria') &&
          !m.name.includes('veo') &&
          !m.name.includes('imagen') &&
          !m.name.includes('robotics') &&
          !m.name.includes('aqa')
      )
      .map((m) => m.name.replace(/^models\//, ''))

    if (usable.length > 0) {
      console.log(`[Gemini] Modelos ativos descobertos na sua conta:`, usable.join(', '))
    }
    return usable
  } catch {
    return []
  }
}

/**
 * Extracts multiple choice questions from exam PDF (and optional answer key PDF)
 * using Google Gemini Interactions API & GenerateContent without SDK retry storms.
 */
export async function extractQuestionsFromPdf({
  examPdfBase64,
  answerKeyPdfBase64 = null,
  yearSemester = '2025/1',
  author = 'Banca PPGI UFAM',
  apiKey: clientApiKey = null
}) {
  if (isExtractionInProgress) {
    throw new Error(
      'Já existe uma extração de PDF em andamento. Aguarde a conclusão antes de clicar novamente.'
    )
  }

  const apiKey = await getGeminiApiKey(clientApiKey)
  if (!apiKey) {
    throw new Error(
      'Chave da API do Gemini (GEMINI_API_KEY) não encontrada nem no arquivo .env local nem no Firestore (coleção "settings" > documento "gemini").'
    )
  }

  isExtractionInProgress = true

  try {
    // IMPORTANTE: No @google/genai v2.30.0, o SDK faz 5 tentativas automáticas internas por padrão (attempts: 5).
    // Desativamos o retry interno (attempts: 1) para evitar estouro de requisições (25 chamadas seguidas)!
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        retryOptions: {
          attempts: 1
        }
      }
    })

    const promptText = `
Você é um especialista em bancas examinadoras e processos seletivos de Pós-Graduação em Informática, especialmente do PPGI da UFAM (Universidade Federal do Amazonas).

Analise atentamente o(s) arquivo(s) PDF anexado(s):
${
  answerKeyPdfBase64
    ? '- O PRIMEIRO arquivo PDF é o Caderno de Provas com as questões.\n- O SEGUNDO arquivo PDF é o Gabarito Oficial com as respostas corretas.'
    : '- O arquivo PDF contém a prova completa. Verifique se o gabarito oficial está embutido no final do arquivo (tabela ou lista de respostas) ou ao longo das questões.'
}

SUA TAREFA:
1. Extraia todas as questões de múltipla escolha encontradas no caderno de prova.
2. Cada questão do PPGI possui 5 alternativas de resposta: A, B, C, D e E.
3. Para cada questão, informe a resposta correta indicada no gabarito oficial ("A", "B", "C", "D" ou "E"). Se não constar gabarito, infira a alternativa correta.
4. Classifique a disciplina/categoria de cada questão em uma destas opções:
   - "Algoritmos e Estrutura de Dados"
   - "Banco de Dados"
   - "Engenharia de Software"
   - "Redes de Computadores"
   - "Sistemas Operacionais"
   - "Inteligência Artificial"
   - "Teoria da Computação e Compiladores"
   - "Arquitetura e Organização de Computadores"
   - "Edital Geral / Matemática Discreta"
5. Mantenha no enunciado (prompt) qualquer trecho de código, tabela ou texto técnico.
6. Forneça uma breve explicação objetiva (explanation) de 1 a 2 frases para a alternativa correta.

Retorne EXCLUSIVAMENTE um objeto JSON válido com o formato:
{
  "questions": [
    {
      "prompt": "Texto completo do enunciado da questão...",
      "category": "Uma das categorias listadas acima",
      "author": "${author} (${yearSemester})",
      "options": [
        { "letter": "A", "text": "Texto da alternativa A" },
        { "letter": "B", "text": "Texto da alternativa B" },
        { "letter": "C", "text": "Texto da alternativa C" },
        { "letter": "D", "text": "Texto da alternativa D" },
        { "letter": "E", "text": "Texto da alternativa E" }
      ],
      "correctAnswer": "A",
      "explanation": "Breve comentário sobre a resposta correta."
    }
  ]
}
`

    // Lista oficial de modelos do @google/genai v2.30.0 (priorizando modelos rápidos e com menor fila)
    const DEFAULT_MODELS_ORDER = [
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-pro-latest',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite'
    ]

    const discovered = await discoverAvailableModels(apiKey)

    // Monta fila única de modelos sem duplicatas (e sem repetir gemini-flash-latest se gemini-3.8-flash já estiver na lista)
    const modelQueue = []
    const addModel = (m) => {
      if (!m) return
      if (m === 'gemini-flash-latest' && modelQueue.includes('gemini-3.8-flash')) return
      if (!modelQueue.includes(m)) modelQueue.push(m)
    }

    // Se a API listou os modelos disponíveis na conta, prioriza os que realmente existem lá
    if (discovered.length > 0) {
      for (const preferred of DEFAULT_MODELS_ORDER) {
        if (discovered.includes(preferred)) {
          addModel(preferred)
        }
      }
      for (const d of discovered) {
        if (!d.includes('2.0')) {
          addModel(d)
        }
      }
    } else {
      DEFAULT_MODELS_ORDER.forEach(addModel)
    }

    let rawText = null
    let lastError = null

    // 1ª Estratégia: Tenta a nova Interactions API recomendada pelo Google (ai.interactions.create) com tentativa única
    try {
      const primaryModel = modelQueue.includes('gemini-3.8-flash')
        ? 'gemini-3.8-flash'
        : modelQueue[0] || 'gemini-3.8-flash'

      console.log(`[Gemini] Tentando Interactions API com ${primaryModel} (requisição única)...`)

      const interactionInputs = [
        {
          type: 'document',
          mime_type: 'application/pdf',
          data: examPdfBase64
        }
      ]
      if (answerKeyPdfBase64) {
        interactionInputs.push({
          type: 'document',
          mime_type: 'application/pdf',
          data: answerKeyPdfBase64
        })
      }
      interactionInputs.push({
        type: 'text',
        text: promptText
      })

      const interaction = await ai.interactions.create(
        {
          model: primaryModel,
          input: interactionInputs,
          response_mime_type: 'application/json',
          generation_config: {
            thinking_level: 'minimal'
          }
        },
        {
          retries: { strategy: 'none' }
        }
      )

      if (interaction && interaction.output_text) {
        console.log(`[Gemini] ✅ Sucesso via Interactions API (${primaryModel})!`)
        rawText = interaction.output_text
      }
    } catch (interErr) {
      const interMsg = interErr.message || JSON.stringify(interErr)
      console.warn(`[Gemini] Interactions API indisponível no momento (${interMsg.slice(0, 120)}). Alternando para modelos disponíveis...`)
      lastError = interErr
    }

    // 2ª Estratégia: Percorre os modelos disponíveis (apenas 1 requisição por modelo, sem loop de repetição!)
    if (!rawText) {
      const parts = [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: examPdfBase64
          }
        }
      ]

      if (answerKeyPdfBase64) {
        parts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: answerKeyPdfBase64
          }
        })
      }

      parts.push({ text: promptText })

      for (const modelName of modelQueue) {
        try {
          console.log(`[Gemini] Processando com ${modelName} (chamada única, sem retry interno)...`)
          const response = await ai.models.generateContent({
            model: modelName,
            contents: parts,
            config: {
              responseMimeType: 'application/json',
              automaticContinuation: false,
              httpOptions: {
                retryOptions: {
                  attempts: 1
                }
              }
            }
          })

          if (response && response.text) {
            console.log(`[Gemini] ✅ Sucesso com o modelo ${modelName}!`)
            rawText = response.text
            break
          }
        } catch (err) {
          lastError = err
          const msg = err.message || JSON.stringify(err)
          console.warn(`[Gemini] Modelo ${modelName} recusou: ${msg.slice(0, 140)}`)
          // Passa imediatamente para o próximo modelo diferente sem insistir no mesmo modelo!
        }
      }
    }

    if (!rawText) {
      throw new Error(
        lastError?.message ||
          'Todos os modelos do Gemini estão com alta demanda no momento (503). Aguarde alguns instantes e tente novamente.'
      )
    }

    const cleanJsonText = extractCleanJson(rawText)

    let parsed = null
    try {
      parsed = JSON.parse(cleanJsonText)
    } catch (parseError) {
      console.error('Falha ao parsear JSON retornado pelo Gemini:', rawText.slice(0, 500))
      throw new Error(`Erro ao decodificar resposta JSON do Gemini: ${parseError.message}`)
    }

    const rawQuestions = Array.isArray(parsed) ? parsed : parsed.questions || []

    const normalizedQuestions = rawQuestions.map((q, index) => {
      const validCategory = PPGI_CATEGORIES.includes(q.category)
        ? q.category
        : PPGI_CATEGORIES[0]

      const letters = ['A', 'B', 'C', 'D', 'E']
      const rawOptions = Array.isArray(q.options) ? q.options : []
      const normalizedOptions = letters.map((letter, idx) => {
        const found = rawOptions.find(
          (o) => o && String(o.letter).toUpperCase().trim() === letter
        )
        if (found && found.text) {
          return { letter, text: String(found.text).trim() }
        }
        if (rawOptions[idx] && rawOptions[idx].text) {
          return { letter, text: String(rawOptions[idx].text).trim() }
        }
        return { letter, text: `Alternativa ${letter}` }
      })

      const rawCorrect = String(q.correctAnswer || 'A')
        .toUpperCase()
        .trim()
      const validCorrect = letters.includes(rawCorrect) ? rawCorrect : 'A'

      return {
        tempId: `TEMP-${Date.now()}-${index + 1}`,
        order: index + 1,
        prompt: String(q.prompt || '').trim(),
        category: validCategory,
        author: q.author || `${author} (${yearSemester})`,
        options: normalizedOptions,
        correctAnswer: validCorrect,
        explanation: String(
          q.explanation ||
            `Gabarito oficial da prova ${yearSemester}: Alternativa ${validCorrect}.`
        ).trim()
      }
    })

    return {
      success: true,
      count: normalizedQuestions.length,
      questions: normalizedQuestions
    }
  } finally {
    isExtractionInProgress = false
  }
}
