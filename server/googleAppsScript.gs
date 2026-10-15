/**
 * GOOGLE APPS SCRIPT - UPLOAD DE PROVAS PPGI UFAM NO GOOGLE DRIVE
 * 
 * Como usar:
 * 1. Acesse https://script.google.com com sua conta Google
 * 2. Clique em "Novo Projeto" (New Project)
 * 3. Cole todo este código no editor (substituindo o conteúdo existente)
 * 4. Clique em "Implantar" (Deploy) > "Nova implantação" (New deployment)
 * 5. Selecione o tipo: "App da Web" (Web app)
 *    - Executar como: "Eu" (Me - seu e-mail)
 *    - Quem tem acesso: "Qualquer pessoa" (Anyone)
 * 6. Clique em "Implantar" e copie a URL gerada (terminada em /exec)
 * 7. Cole a URL no arquivo .env ou no painel de administração da aplicação!
 */

const FOLDER_ID = "1jPA6xgQv1kn92HQLMmOkTbg5Qx2sbRfn";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Se for ação de exclusão
    if (data.action === "delete" && data.fileId) {
      const fileToDelete = DriveApp.getFileById(data.fileId);
      fileToDelete.setTrashed(true);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Arquivo movido para a lixeira."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Ação de upload
    const targetFolderId = data.folderId || FOLDER_ID;
    const folder = DriveApp.getFolderById(targetFolderId);

    // Decodificar Base64
    const decodedBytes = Utilities.base64Decode(data.fileBase64);
    const blob = Utilities.newBlob(decodedBytes, data.mimeType || "application/pdf", data.fileName);

    // Criar arquivo na pasta especificada
    const file = folder.createFile(blob);

    // Tornar o arquivo público para visualização e download de qualquer pessoa com o link
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();
    const webViewLink = file.getUrl();
    const directDownloadUrl = "https://drive.google.com/uc?export=download&id=" + fileId;

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileId: fileId,
      fileName: file.getName(),
      webViewLink: webViewLink,
      webContentLink: directDownloadUrl,
      directDownloadUrl: directDownloadUrl
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "Google Apps Script Web App para Upload de Provas PPGI UFAM está ativo!"
  })).setMimeType(ContentService.MimeType.JSON);
}

