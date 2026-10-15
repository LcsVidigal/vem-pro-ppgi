import { uploadPdfToDrive, deleteFileFromDrive } from './driveService.js'

async function run() {
  console.log('--- Testando Upload no Google Drive ---')
  const dummyPdfContent = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 300 144]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF', 'utf-8')

  try {
    const result = await uploadPdfToDrive({
      fileName: 'teste_conexao_ppgi.pdf',
      buffer: dummyPdfContent,
      mimeType: 'application/pdf'
    })

    console.log('✅ Upload realizado com sucesso!')
    console.log('ID do arquivo:', result.fileId)
    console.log('Nome:', result.fileName)
    console.log('Visualização no Drive:', result.webViewLink)
    console.log('Download Direto:', result.directDownloadUrl)

    // Agora testamos remoção
    console.log('\n--- Testando remoção do arquivo de teste ---')
    await deleteFileFromDrive(result.fileId)
    console.log('✅ Arquivo de teste removido do Google Drive com sucesso!')
  } catch (error) {
    console.error('❌ Falha no teste de upload:', error)
  }
}

run()

