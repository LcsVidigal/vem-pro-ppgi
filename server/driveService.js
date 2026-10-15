import { google } from 'googleapis'
import { Readable } from 'stream'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Google Drive Folder ID created by user (Shared Drive)
export const DRIVE_FOLDER_ID = '1UMJ7F3SMbxbyuMUuTyTJKj8azCoCO7MN'

// Load service account credentials
const credentialsPath = path.resolve(__dirname, '../serviceAccountKey.json')

let driveClient = null

export function getDriveClient() {
  if (driveClient) return driveClient

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Arquivo de credenciais não encontrado em: ${credentialsPath}. Certifique-se de que serviceAccountKey.json está na raiz do projeto.`
    )
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive']
  })

  driveClient = google.drive({ version: 'v3', auth })
  return driveClient
}

/**
 * Test connectivity with Google Drive and folder access
 */
export async function testDriveConnection() {
  const drive = getDriveClient()
  const folder = await drive.files.get({
    fileId: DRIVE_FOLDER_ID,
    supportsAllDrives: true,
    fields: 'id, name, capabilities, mimeType, driveId'
  })
  return folder.data
}

/**
 * List all files inside the Google Drive folder
 */
export async function listDriveFiles() {
  const drive = getDriveClient()
  const response = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and trashed = false`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields: 'files(id, name, webViewLink, webContentLink, size, createdTime, mimeType)'
  })
  return response.data.files || []
}

/**
 * Upload a PDF buffer to the designated Google Drive folder.
 * Supports:
 * 1. Google Apps Script Web App (recommended for personal @gmail.com accounts - uses personal 15GB quota)
 * 2. Google Workspace Shared Drive via Service Account
 */
export async function uploadPdfToDrive({
  fileName,
  buffer,
  mimeType = 'application/pdf',
  appsScriptUrl
}) {
  const webhookUrl = appsScriptUrl || process.env.GOOGLE_APPS_SCRIPT_URL

  // Method 1: Google Apps Script Web App (uses owner's storage quota directly)
  if (webhookUrl) {
    const base64Data = buffer.toString('base64')
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        fileName,
        fileBase64: base64Data,
        mimeType,
        folderId: DRIVE_FOLDER_ID
      })
    })

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || 'Erro ao processar envio pelo Google Apps Script.')
    }

    return {
      fileId: data.fileId,
      fileName: data.fileName || fileName,
      webViewLink: data.webViewLink,
      webContentLink: data.directDownloadUrl || data.webContentLink,
      directDownloadUrl: data.directDownloadUrl,
      size: buffer.length
    }
  }

  // Method 2: Google Cloud Service Account
  const drive = getDriveClient()

  const fileMetadata = {
    name: fileName,
    parents: [DRIVE_FOLDER_ID]
  }

  const media = {
    mimeType,
    body: Readable.from(buffer)
  }

  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: fileMetadata,
    media,
    fields: 'id, name, webViewLink, webContentLink, size'
  })

  const uploadedFile = response.data

  try {
    await drive.permissions.create({
      fileId: uploadedFile.id,
      supportsAllDrives: true,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    })
  } catch (permError) {
    console.warn('Aviso ao definir permissão pública do arquivo:', permError.message)
  }

  const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${uploadedFile.id}`
  const previewUrl = uploadedFile.webViewLink || `https://drive.google.com/file/d/${uploadedFile.id}/view?usp=sharing`

  return {
    fileId: uploadedFile.id,
    fileName: uploadedFile.name,
    webViewLink: previewUrl,
    webContentLink: uploadedFile.webContentLink || directDownloadUrl,
    directDownloadUrl,
    size: uploadedFile.size || buffer.length
  }
}

/**
 * Delete a file from Google Drive
 */
export async function deleteFileFromDrive(fileId) {
  const drive = getDriveClient()
  try {
    // In Shared Drives, Content Managers can move files to trash
    await drive.files.update({
      fileId,
      supportsAllDrives: true,
      requestBody: {
        trashed: true
      }
    })
    return { success: true }
  } catch (trashErr) {
    console.warn('Tentativa de mover para a lixeira falhou, tentando deleção permanente:', trashErr.message)
    await drive.files.delete({
      fileId,
      supportsAllDrives: true
    })
    return { success: true }
  }
}

