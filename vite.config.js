import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { uploadPdfToDrive, deleteFileFromDrive, testDriveConnection, listDriveFiles } from './server/driveService.js'

function googleDriveDevMiddleware() {
  return {
    name: 'google-drive-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Test connectivity
        if (req.url === '/api/test-drive' && req.method === 'GET') {
          try {
            const folder = await testDriveConnection()
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, folder }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
          return
        }

        // List files in Google Drive folder
        if (req.url === '/api/drive-files' && req.method === 'GET') {
          try {
            const files = await listDriveFiles()
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, files }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
          return
        }

        // Upload file to Drive
        if (req.url === '/api/upload-drive' && req.method === 'POST') {
          const chunks = []
          req.on('data', (chunk) => chunks.push(chunk))
          req.on('end', async () => {
            try {
              const bodyText = Buffer.concat(chunks).toString('utf8')
              const { fileName, fileBase64, mimeType, appsScriptUrl } = JSON.parse(bodyText)

              if (!fileName || !fileBase64) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
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

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, ...result }))
            } catch (err) {
              console.error('Erro no upload para o Google Drive:', err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: err.message }))
            }
          })
          return
        }

        // Delete file from Drive
        if (req.url === '/api/delete-drive' && req.method === 'POST') {
          const chunks = []
          req.on('data', (chunk) => chunks.push(chunk))
          req.on('end', async () => {
            try {
              const bodyText = Buffer.concat(chunks).toString('utf8')
              const { fileId, appsScriptUrl } = JSON.parse(bodyText)

              if (!fileId) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'fileId é obrigatório.' }))
                return
              }

              await deleteFileFromDrive(fileId, appsScriptUrl)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true }))
            } catch (err) {
              console.error('Erro ao deletar arquivo do Drive:', err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: err.message }))
            }
          })
          return
        }

        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), googleDriveDevMiddleware()]
})
