import http from 'http'
import { uploadPdfToDrive, deleteFileFromDrive, testDriveConnection, listDriveFiles } from './driveService.js'
import { extractQuestionsFromPdf } from './geminiService.js'

const PORT = process.env.PORT || 3001

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  // Extract questions from PDF via Gemini AI
  if (req.url === '/api/extract-questions' && req.method === 'POST') {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', async () => {
      try {
        const bodyText = Buffer.concat(chunks).toString('utf8')
        const { examPdfBase64, answerKeyPdfBase64, yearSemester, author, apiKey } = JSON.parse(bodyText)

        if (!examPdfBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'O PDF da prova é obrigatório.' }))
          return
        }

        const result = await extractQuestionsFromPdf({
          examPdfBase64,
          answerKeyPdfBase64,
          yearSemester: yearSemester || '2025/1',
          author: author || 'Banca PPGI UFAM',
          apiKey
        })

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (err) {
        console.error('Erro na extração de questões com Gemini:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: err.message }))
      }
    })
    return
  }

  // Health / Test route
  if (req.url === '/api/test-drive' && req.method === 'GET') {
    try {
      const folder = await testDriveConnection()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, folder }))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // List files route
  if (req.url === '/api/drive-files' && req.method === 'GET') {
    try {
      const files = await listDriveFiles()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, files }))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
    return
  }

  // Upload route
  if (req.url === '/api/upload-drive' && req.method === 'POST') {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', async () => {
      try {
        const bodyText = Buffer.concat(chunks).toString('utf8')
        const { fileName, fileBase64, mimeType, appsScriptUrl } = JSON.parse(bodyText)

        if (!fileName || !fileBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Nome do arquivo e conteúdo são obrigatórios.' }))
          return
        }

        const buffer = Buffer.from(fileBase64, 'base64')
        const result = await uploadPdfToDrive({
          fileName,
          buffer,
          mimeType: mimeType || 'application/pdf',
          appsScriptUrl
        })

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, ...result }))
      } catch (err) {
        console.error('Erro ao processar upload:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: err.message }))
      }
    })
    return
  }

  // Delete route
  if (req.url === '/api/delete-drive' && req.method === 'POST') {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', async () => {
      try {
        const bodyText = Buffer.concat(chunks).toString('utf8')
        const { fileId, appsScriptUrl } = JSON.parse(bodyText)

        if (!fileId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'fileId é obrigatório.' }))
          return
        }

        await deleteFileFromDrive(fileId, appsScriptUrl)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (err) {
        console.error('Erro ao deletar arquivo:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: err.message }))
      }
    })
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Rota não encontrada' }))
})

server.listen(PORT, () => {
  console.log(`🚀 Servidor Google Drive API rodando em http://localhost:${PORT}`)
})
