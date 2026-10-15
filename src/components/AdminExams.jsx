import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import './AdminExams.css'

// Predefined academic years and semesters for PPGI UFAM exams
const SEMESTER_OPTIONS = [
  '2026/1',
  '2025/2',
  '2025/1',
  '2024/2',
  '2024/1',
  '2023/2',
  '2023/1',
  '2022/2',
  '2022/1',
  '2021/2',
  '2021/1',
  '2020/2',
  '2020/1'
]

// Document types (including Caderno de Prova + Gabarito)
const DOC_TYPES = [
  'Caderno de Prova',
  'Gabarito Oficial',
  'Caderno de Prova + Gabarito',
  'Edital / Manual'
]

// Helper to format bytes to human-readable size
const formatBytes = (bytes, decimals = 1) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

// Helper to convert File to base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      // Split off metadata prefix (e.g., "data:application/pdf;base64,")
      const result = reader.result
      const base64 = typeof result === 'string' ? result.split(',')[1] : ''
      resolve(base64)
    }
    reader.onerror = (error) => reject(error)
  })
}

function AdminExams({ onNavigate, user }) {
  // Upload Form States
  const [selectedFile, setSelectedFile] = useState(null)
  const [title, setTitle] = useState('')
  const [yearSemester, setYearSemester] = useState('2025/1')
  const [isCustomSemester, setIsCustomSemester] = useState(false)
  const [customSemester, setCustomSemester] = useState('')
  const [docType, setDocType] = useState('Caderno de Prova + Gabarito')

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  // Upload Progress & Feedback States
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [toastMessage, setToastMessage] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  // Google Drive Connection Health
  const [driveConnected, setDriveConnected] = useState(null)
  const [driveFolderName, setDriveFolderName] = useState('')

  // Exams List & Filter States
  const [exams, setExams] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState('all')

  // Helper to load files directly from Google Drive folder
  const fetchDriveFiles = async () => {
    try {
      const res = await fetch('/api/drive-files')
      const data = await res.json()
      if (data.success && Array.isArray(data.files)) {
        return data.files.map((f) => {
          const semMatch = f.name.match(/(20\d\d)[-_/](0?[12])/)
          const guessedSemester = semMatch ? `${semMatch[1]}/${semMatch[2].replace('0', '')}` : '2026/1'
          const isGabarito = /gabarito/i.test(f.name)
          const docType = isGabarito ? 'Gabarito Oficial' : 'Caderno de Prova'
          const cleanTitle = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ')
          return {
            id: `DRIVE-${f.id}`,
            driveFileId: f.id,
            title: cleanTitle,
            fileName: f.name,
            yearSemester: guessedSemester,
            docType,
            fileUrl: f.webContentLink || `https://drive.google.com/uc?export=download&id=${f.id}`,
            previewUrl: f.webViewLink,
            directDownloadUrl: `https://drive.google.com/uc?export=download&id=${f.id}`,
            fileSize: parseInt(f.size || '0', 10),
            fileSizeFormatted: formatBytes(parseInt(f.size || '0', 10)),
            uploadedAt: f.createdTime || new Date().toISOString(),
            storageType: 'google-drive'
          }
        })
      }
    } catch (e) {
      console.warn('Aviso ao consultar arquivos do Google Drive:', e)
    }
    return []
  }

  // 1. Verify Google Drive API connection on mount and sync drive files
  useEffect(() => {
    fetch('/api/test-drive')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.folder) {
          setDriveConnected(true)
          setDriveFolderName(data.folder.name || 'vem-pro-ppgi_files_uploaded')
        } else {
          setDriveConnected(false)
        }
      })
      .catch((err) => {
        console.warn('Não foi possível verificar status do Google Drive automaticamente:', err)
        setDriveConnected(false)
      })

    // Also fetch files already in Drive
    fetchDriveFiles().then((driveFiles) => {
      if (driveFiles.length > 0) {
        setExams((prev) => {
          const existingIds = new Set(prev.map((p) => p.driveFileId))
          const newOnes = driveFiles.filter((df) => !existingIds.has(df.driveFileId))
          return [...prev, ...newOnes]
        })
      }
    })
  }, [])

  // 2. Listen to exams collection in Firestore in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'exams'),
      (snapshot) => {
        const loaded = []
        snapshot.forEach((docSnap) => {
          loaded.push({ id: docSnap.id, ...docSnap.data() })
        })

        // Merge with local cached exams
        const cachedExams = JSON.parse(localStorage.getItem('cached_exams') || '[]')
        const all = [...loaded]
        cachedExams.forEach((c) => {
          if (!all.some((a) => a.id === c.id || (a.driveFileId && a.driveFileId === c.driveFileId))) {
            all.push(c)
          }
        })

        // Sort descending by semester, then by upload date
        all.sort(
          (a, b) =>
            (b.yearSemester || '').localeCompare(a.yearSemester || '') ||
            (b.uploadedAt || '').localeCompare(a.uploadedAt || '')
        )
        setExams(all)
      },
      (error) => {
        console.warn('Aviso ao carregar lista de provas do Firestore (usando cache local):', error.message)
        const cachedExams = JSON.parse(localStorage.getItem('cached_exams') || '[]')
        if (cachedExams.length > 0) {
          setExams(cachedExams)
        }
      }
    )

    return () => unsubscribe()
  }, [])

  const showToast = (message) => {
    setToastMessage(message)
    setTimeout(() => {
      setToastMessage(null)
    }, 4500)
  }

  // Handle Drag Events
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0])
    }
  }

  // Validate and assign selected file
  const handleFileSelected = (file) => {
    if (!file) return

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      alert('Por favor, selecione exclusivamente um arquivo no formato PDF (.pdf).')
      return
    }

    setSelectedFile(file)

    // Auto-suggest title if user hasn't typed one
    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ')
      setTitle(cleanName)
    }
  }

  // Handle PDF Upload to Google Drive and save reference in Firestore
  const handleUploadExam = async (e) => {
    e.preventDefault()

    if (!selectedFile) {
      alert('Por favor, selecione ou arraste um arquivo PDF para upload.')
      return
    }

    const effectiveSemester = isCustomSemester ? customSemester.trim() : yearSemester
    if (!effectiveSemester) {
      alert('Por favor, informe o ano e semestre da prova (ex: 2025/1).')
      return
    }

    if (!title.trim()) {
      alert('Por favor, insira o nome / título da prova.')
      return
    }

    setIsUploading(true)
    setUploadProgress(20)
    setErrorMessage(null)

    let driveUploadResult = null

    try {
      // 1. Convert file to Base64
      setUploadProgress(40)
      const base64Data = await fileToBase64(selectedFile)

      // 2. Upload file directly to Google Drive via backend endpoint
      setUploadProgress(70)
      const response = await fetch('/api/upload-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileBase64: base64Data,
          mimeType: selectedFile.type || 'application/pdf'
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Falha ao salvar arquivo no Google Drive')
      }

      driveUploadResult = data
    } catch (driveErr) {
      console.error('Falha no upload para o Google Drive:', driveErr)
      setIsUploading(false)
      setUploadProgress(0)
      setErrorMessage(`Erro ao enviar para o Google Drive: ${driveErr.message}`)
      return
    }

    setUploadProgress(90)

    // 3. Register document in Cloud Firestore & LocalStorage
    const examId = `EXAM-${Date.now()}`
    const examDocData = {
      id: examId,
      title: title.trim(),
      fileName: selectedFile.name,
      yearSemester: effectiveSemester,
      docType,
      driveFileId: driveUploadResult.fileId,
      fileUrl: driveUploadResult.directDownloadUrl || driveUploadResult.webContentLink,
      previewUrl: driveUploadResult.webViewLink,
      directDownloadUrl: driveUploadResult.directDownloadUrl,
      fileSize: selectedFile.size,
      fileSizeFormatted: formatBytes(selectedFile.size),
      uploadedAt: new Date().toISOString(),
      uploadedBy: user?.email || 'admin@ufam.edu.br',
      storageType: 'google-drive'
    }

    // Always update local cache so exam is immediately displayed
    const cachedExams = JSON.parse(localStorage.getItem('cached_exams') || '[]')
    const updatedCache = [examDocData, ...cachedExams.filter((c) => c.driveFileId !== driveUploadResult.fileId)]
    localStorage.setItem('cached_exams', JSON.stringify(updatedCache))
    setExams((prev) => [examDocData, ...prev.filter((p) => p.driveFileId !== driveUploadResult.fileId)])

    let firestoreWarningMessage = null

    try {
      await setDoc(doc(db, 'exams', examId), examDocData)
    } catch (firestoreErr) {
      console.warn('Aviso de gravação no Firestore:', firestoreErr)
      firestoreWarningMessage =
        'O arquivo foi salvo com sucesso no Google Drive! Aviso do Firestore: As Regras de Segurança do Firebase Console bloquearam a escrita em nuvem (Missing or insufficient permissions). Para que outros estudantes vejam este arquivo na nuvem, acesse o Firebase Console > Firestore Database > Rules e libere a coleção "exams".'
    }

    setUploadProgress(100)

    // Reset form
    setSelectedFile(null)
    setTitle('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsUploading(false)
    setUploadProgress(0)

    if (firestoreWarningMessage) {
      setErrorMessage(firestoreWarningMessage)
      showToast(`Prova salva no Google Drive com sucesso!`)
    } else {
      showToast(`Prova "${examDocData.title}" (${effectiveSemester}) salva com sucesso!`)
    }
  }

  // Handle Exam Deletion from Firestore and Google Drive
  const handleDeleteExam = async (exam) => {
    const confirmDelete = window.confirm(
      `Deseja realmente excluir a prova "${exam.title}" (${exam.yearSemester})?\nEssa ação removerá o registro do sistema e o arquivo do Google Drive.`
    )
    if (!confirmDelete) return

    try {
      // 1. Delete document from Firestore
      await deleteDoc(doc(db, 'exams', exam.id))

      // 2. Delete file from Google Drive if driveFileId exists
      if (exam.driveFileId) {
        try {
          await fetch('/api/delete-drive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: exam.driveFileId })
          })
        } catch (driveErr) {
          console.warn('Arquivo do Google Drive já removido ou inacessível:', driveErr)
        }
      }

      showToast(`Prova "${exam.title}" excluída com sucesso.`)
    } catch (err) {
      console.error('Erro ao excluir prova:', err)
      alert(`Erro ao excluir prova: ${err.message}`)
    }
  }

  // Filter exams by search term and semester
  const filteredExams = exams.filter((exam) => {
    const matchesSearch =
      (exam.title && exam.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (exam.fileName && exam.fileName.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesSemester =
      selectedSemesterFilter === 'all' || exam.yearSemester === selectedSemesterFilter

    return matchesSearch && matchesSemester
  })

  // Extract all unique semesters present in the exams list
  const existingSemesters = Array.from(new Set(exams.map((e) => e.yearSemester).filter(Boolean)))

  return (
    <div className="admin-exams-container">
      {/* Toast Alert Indicator */}
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

      {/* Admin Tab Navigation */}
      <nav className="admin-tab-nav">
        <button
          onClick={() => onNavigate && onNavigate('admin-questions')}
          className="admin-tab-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Banco de Questões
        </button>

        <button className="admin-tab-btn active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload de Provas (Google Drive)
        </button>
      </nav>

      {/* Page Header */}
      <header className="admin-header-row">
        <div className="admin-header-info">
          <h1 className="admin-portal-title">Gerenciador de Provas Anteriores</h1>
          <p className="admin-portal-subtitle">
            Cadernos de prova e gabaritos em PDF armazenados de forma gratuita no Google Drive via Service Account e catalogados no Firestore.
          </p>
        </div>

        {/* Google Drive Status Badge */}
        {driveConnected !== null && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '600',
              background: driveConnected ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: driveConnected ? '#22c55e' : '#ef4444',
              border: `1px solid ${driveConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: driveConnected ? '#22c55e' : '#ef4444'
              }}
            ></span>
            {driveConnected
              ? `Google Drive Conectado: ${driveFolderName}`
              : 'Google Drive Desconectado'}
          </div>
        )}
      </header>

      {/* ====================================================================
          UPLOAD CARD SECTION (Drag & Drop + Inputs)
          ==================================================================== */}
      <section className="upload-card">
        <div className="upload-card-header">
          <h2>Enviar Nova Prova (PDF) para o Google Drive</h2>
          <p>Selecione ou arraste o arquivo PDF e preencha as informações do edital.</p>
        </div>

        <form onSubmit={handleUploadExam}>
          {/* Caixa de Arrastar e Soltar (Drag and Drop) */}
          <div
            className={`dropzone-container ${isDragging ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelected(e.target.files[0])
                }
              }}
            />

            {selectedFile ? (
              <div className="file-selected-box" onClick={(e) => e.stopPropagation()}>
                <div className="file-selected-info">
                  <span className="pdf-icon-badge">PDF</span>
                  <div>
                    <div className="file-name-text">{selectedFile.name}</div>
                    <div className="file-size-text">{formatBytes(selectedFile.size)}</div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-remove-file"
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  title="Remover arquivo"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <div className="dropzone-icon-wrapper">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="dropzone-text-primary">
                  {isDragging ? 'Solte o arquivo PDF aqui...' : 'Arraste e solte o arquivo PDF aqui ou clique para selecionar'}
                </p>
                <p className="dropzone-text-secondary">
                  Suporta arquivos .PDF de provas e gabaritos (salvos diretamente no Google Drive)
                </p>
              </>
            )}
          </div>

          {/* Form Grid: Dropdown Ano/Semestre, Input Nome da Prova, Tipo */}
          <div className="upload-form-grid">
            {/* 1. Dropdown para Ano/Semestre */}
            <div className="form-field-group">
              <label className="form-label" htmlFor="exam-semester">
                Ano / Semestre *
              </label>
              {!isCustomSemester ? (
                <select
                  id="exam-semester"
                  className="form-select"
                  value={yearSemester}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomSemester(true)
                    } else {
                      setYearSemester(e.target.value)
                    }
                  }}
                >
                  {SEMESTER_OPTIONS.map((sem) => (
                    <option key={sem} value={sem}>
                      {sem}
                    </option>
                  ))}
                  <option value="custom">+ Outro Semestre...</option>
                </select>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: 2019/2"
                    value={customSemester}
                    onChange={(e) => setCustomSemester(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="nav-btn nav-btn-outline"
                    style={{ padding: '0 10px', fontSize: '12px' }}
                    onClick={() => setIsCustomSemester(false)}
                    title="Voltar para lista de semestres"
                  >
                    Lista
                  </button>
                </div>
              )}
            </div>

            {/* 2. Barra de Input para o Nome do Arquivo / Título */}
            <div className="form-field-group">
              <label className="form-label" htmlFor="exam-title">
                Nome / Título da Prova *
              </label>
              <input
                id="exam-title"
                type="text"
                className="form-input"
                placeholder="Ex: Prova Escrita - PPGI UFAM (2025/1)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* 3. Tipo de Documento */}
            <div className="form-field-group">
              <label className="form-label" htmlFor="exam-type">
                Tipo de Arquivo
              </label>
              <select
                id="exam-type"
                className="form-select"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {DOC_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="upload-progress-wrap">
              <div className="upload-progress-info">
                <span>Enviando para a pasta do Google Drive...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="upload-progress-track">
                <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#ef4444',
                fontSize: '14px',
                lineHeight: '1.55',
                marginBottom: '18px',
                textAlign: 'left'
              }}
            >
              ❌ <strong>Falha no Upload:</strong>
              <p style={{ margin: '6px 0 0 0' }}>{errorMessage}</p>
            </div>
          )}

          {/* Form Actions */}
          <div className="upload-card-actions">
            <button
              type="submit"
              className="btn-submit-upload"
              disabled={isUploading || !selectedFile || !title.trim()}
            >
              {isUploading ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                  Salvando no Google Drive ({uploadProgress}%)...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Fazer Upload no Google Drive
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* ====================================================================
          EXAMS LIST & MANAGEMENT SECTION
          ==================================================================== */}
      <section className="exams-section">
        <div className="exams-section-header">
          <div>
            <h3>Provas Cadastradas ({exams.length})</h3>
          </div>

          <div className="exams-filter-bar">
            {/* Semester Filter */}
            <select
              className="form-select"
              style={{ padding: '8px 12px', fontSize: '13px' }}
              value={selectedSemesterFilter}
              onChange={(e) => setSelectedSemesterFilter(e.target.value)}
            >
              <option value="all">Todos os Semestres</option>
              {existingSemesters.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por título ou arquivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Exams Grid */}
        {filteredExams.length === 0 ? (
          <div className="exams-empty-state">
            <h4>Nenhuma prova encontrada</h4>
            <p>
              {exams.length === 0
                ? 'Faça o upload do primeiro arquivo PDF utilizando o formulário acima.'
                : 'Nenhum resultado corresponde aos filtros de busca informados.'}
            </p>
          </div>
        ) : (
          <div className="exams-grid">
            {filteredExams.map((exam) => (
              <article key={exam.id} className="exam-card">
                <div className="exam-card-top">
                  <span className="year-semester-badge">{exam.yearSemester}</span>
                  <span className="doc-type-badge">{exam.docType || 'Caderno de Prova'}</span>
                </div>

                <h4 className="exam-card-title">{exam.title}</h4>

                <div className="exam-card-meta">
                  <span>📄 {exam.fileName}</span>
                  <span>⚖️ {exam.fileSizeFormatted || formatBytes(exam.fileSize)}</span>
                  <span>
                    📅 Enviado em {new Date(exam.uploadedAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <div className="exam-card-actions">
                  {/* Google Drive Preview Link */}
                  {exam.previewUrl && (
                    <a
                      href={exam.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="nav-btn nav-btn-outline"
                      style={{ fontSize: '13px', padding: '8px 12px', gap: '6px' }}
                      title="Visualizar PDF no Google Drive"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Ver no Drive
                    </a>
                  )}

                  {/* Direct Download Link */}
                  <a
                    href={exam.directDownloadUrl || exam.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-download-exam"
                    title="Baixar arquivo PDF"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Baixar PDF
                  </a>

                  <button
                    onClick={() => handleDeleteExam(exam)}
                    className="btn-delete-exam"
                    title="Excluir prova do sistema e do Google Drive"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default AdminExams
