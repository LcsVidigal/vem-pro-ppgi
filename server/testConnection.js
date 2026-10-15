import { testDriveConnection, DRIVE_FOLDER_ID } from './driveService.js'

console.log('Testando conexão com o Google Drive...')
console.log('Folder ID:', DRIVE_FOLDER_ID)

try {
  const folder = await testDriveConnection()
  console.log('✅ Conexão bem sucedida com o Google Drive!')
  console.log('Pasta encontrada:', folder.name)
  console.log('ID:', folder.id)
  console.log('Permissões da Service Account:', folder.capabilities)
} catch (error) {
  console.error('❌ Erro ao conectar ao Google Drive:', error.message)
  if (error.errors) {
    console.error('Detalhes do erro:', JSON.stringify(error.errors, null, 2))
  }
}

