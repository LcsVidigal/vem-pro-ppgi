import { spawn, spawnSync } from 'node:child_process'
import { access } from 'node:fs/promises'
import net from 'node:net'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
process.chdir(root)
process.env.FUNCTIONS_DISCOVERY_TIMEOUT = '60'
process.env.VITE_USE_FIREBASE_EMULATORS = 'true'
const children = new Set()
let stopping = false

function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.pid) continue
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    } else {
      try { process.kill(-child.pid, 'SIGTERM') } catch { /* Already exited. */ }
    }
  }
  process.exit(code)
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: root, env: process.env, stdio: 'inherit', windowsHide: true,
      detached: process.platform !== 'win32'
    })
    children.add(child)
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      children.delete(child)
      if (code === 0) resolve()
      else reject(new Error(`Processo encerrado (${signal || code}): ${script}`))
    })
  })
}
async function requireFile(path, instruction) {
  try { await access(path) }
  catch { throw new Error(`Dependencias ausentes. Execute: ${instruction}`) }
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', () => reject(new Error(`Porta ${port} ocupada ou indisponivel. Encerre o emulador anterior e execute npm run demo novamente.`)))
    server.listen(port, '127.0.0.1', () => server.close(resolve))
  })
}
async function verifyFunctions() {
  for (const name of ['startAttempt', 'submitAttempt']) {
    const response = await fetch(`http://127.0.0.1:5001/demo-vem-pro-ppgi/us-central1/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }), signal: AbortSignal.timeout(60000)
    })
    const body = await response.json().catch(() => null)
    // A registered callable must reject an anonymous request before touching any data.
    if (response.status !== 401 || body?.error?.status !== 'UNAUTHENTICATED') {
      throw new Error(`A funcao ${name} nao carregou corretamente. Confira os erros do emulador acima.`)
    }
  }
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Instale Node.js 22 ou superior.')
  await requireFile('node_modules/firebase-tools/lib/bin/firebase.js', 'npm ci')
  await requireFile('node_modules/vite/bin/vite.js', 'npm ci')
  await requireFile('functions/node_modules/firebase-admin/package.json', 'npm ci --prefix functions')
  await requireFile('functions/node_modules/firebase-functions/package.json', 'npm ci --prefix functions')

  if (process.argv.includes('--app')) {
    console.log('\nVerificando as funcoes de correcao...')
    await verifyFunctions()
    await run('functions/scripts/seed-emulator.js')
    if (process.argv.includes('--smoke')) return
    console.log('\nDemo local pronta. Aluno: aluno@example.test | Senha: TesteLocal123!')
    console.log('Use Correcao > Iniciar questoes (ou Nova tentativa). Ctrl+C encerra a demonstracao.\n')
    await run('node_modules/vite/bin/vite.js', ['--mode', 'emulator', '--host', '127.0.0.1', '--port', '5173', '--open'])
    return
  }

  const java = spawnSync('java', ['-version'], { encoding: 'utf8', windowsHide: true })
  const version = `${java.stderr || ''}${java.stdout || ''}`.match(/version\s+"?(\d+)/i)
  if (java.error || java.status !== 0 || !version || Number(version[1]) < 21) {
    throw new Error('Instale Java 21 ou superior e confira java -version no terminal.')
  }
  for (const port of [8080, 9099, 5001, 4000, 4400, 4500, 9150]) await freePort(port)
  console.log('\nIniciando Firebase local. O primeiro uso pode baixar os emuladores.')
  console.log('Aguarde a verificacao das funcoes e a abertura do navegador.\n')
  const command = `node scripts/demo.js --app${process.argv.includes('--smoke') ? ' --smoke' : ''}`
  await run('node_modules/firebase-tools/lib/bin/firebase.js', [
    'emulators:exec', '--project', 'demo-vem-pro-ppgi', '--only', 'auth,firestore,functions', command
  ])
}

main().catch(error => {
  console.error(`\nNao foi possivel iniciar a demo: ${error.message}`)
  console.error('A demo exige Node.js 22+, Java 21+ e as dependencias nas duas pastas. Nenhum deploy e necessario.')
  stop(1)
})
