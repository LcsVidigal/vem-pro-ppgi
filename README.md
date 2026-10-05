# Vem Pro PPGI

## Demonstracao da US06 em outro computador

O repositorio inclui cinco questoes de exemplo e contas locais de aluno e administrador.
Requer Git, Node.js 22 com npm e Java 21+ no PATH. A primeira execucao precisa de internet
para baixar dependencias e emuladores. Nao e necessario acessar o projeto Firebase real.

1. Clone o repositorio e entre na pasta que contem `package.json`.
2. Execute `npm ci` e `npm ci --prefix functions`.
3. Execute em um unico terminal:

```powershell
npm run demo
```

O comando verifica Node e Java, inicia Authentication/Firestore/Functions, confirma que as duas
funcoes estao disponiveis, carrega as cinco questoes e abre o navegador. Se a porta do Vite estiver
ocupada, ele escolhe outra e informa a URL. Mantenha o terminal aberto; Ctrl+C encerra os processos
iniciados pelo comando. Se houver emuladores antigos ocupando as portas, encerre-os primeiro.

Entre com `aluno@example.test` e senha `TesteLocal123!`. Para o painel administrativo,
use `admin@example.test` com a mesma senha. As contas sao exclusivamente locais.

## Inicializacao manual (alternativa)

No primeiro terminal PowerShell:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
npm run emulators
```

Aguarde os emuladores iniciarem e as funcoes `startAttempt` e `submitAttempt` serem carregadas.
Em outro terminal, na mesma pasta:

```powershell
npm run seed:emulators
npm run dev:emulators
```

Abra a URL exibida pelo Vite. Entre com `aluno@example.test` e senha `TesteLocal123!`.
   Para testar o painel administrativo, use `admin@example.test` com a mesma senha local.
Acesse Correcao e inicie uma tentativa. Se houver um resultado antigo com tres questoes,
   clique em Nova tentativa para carregar as cinco questoes atuais.

Em macOS/Linux, o inicio manual dos emuladores pode ser executado com
`FUNCTIONS_DISCOVERY_TIMEOUT=60 npm run emulators`.

Mantenha os dois terminais abertos durante a demonstracao. Os dados locais nao vao para o Git:
o script seed os recria em cada computador. Apos reiniciar os emuladores, execute o seed novamente
e entre de novo se a sessao anterior tiver expirado. Nao rode `npm run dev` para essa demonstracao,
pois o modo normal usa o projeto Firebase real.

Inclua no commit os arquivos novos, as configuracoes, `.env.emulator` e os dois arquivos
`package-lock.json`. Nao inclua `node_modules`, `dist`, logs ou credenciais privadas.
O Git distribui o codigo; nao publica o site nem transfere os dados dos emuladores.

Detalhes de arquitetura, testes e pendencias de producao: [guia da US06](docs/US06.md).

## Template React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
