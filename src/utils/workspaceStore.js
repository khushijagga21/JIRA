/** In-browser file system for the workSphere Coding workspace. */

const STORAGE_KEY = 'worksphere_coding_workspace_v1'

const LANGUAGE_BY_EXT = {
  js: 'javascript',
  mjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  md: 'markdown',
  markdown: 'markdown',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cxx: 'cpp',
  cs: 'csharp',
  php: 'php',
  sh: 'shell',
  bash: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
  svg: 'xml',
  sql: 'sql',
  txt: 'plaintext',
}

export function languageFromName(name) {
  const dot = name.lastIndexOf('.')
  if (dot === -1) return 'plaintext'
  return LANGUAGE_BY_EXT[name.slice(dot + 1).toLowerCase()] || 'plaintext'
}

const DEFAULT_FILES = {
  'README.md': {
    type: 'file',
    content: `# Welcome to workSphere Coding workspace

This is a fully in-browser code editor inspired by **VS Code**, powered by the same Monaco engine.

## What works

- 📁 **File explorer** (left) — right-click for *New file / New folder / Rename / Delete*
- 🗂️ **Tabs** at the top with close (\u00d7) and modified (\u2022) indicators
- ✍️ **Monaco editor** with syntax highlighting, IntelliSense, multi-cursor, find-replace
- ⌨️ **Shortcuts** — \`Ctrl + S\` save, \`Ctrl + B\` toggle sidebar, \`Ctrl + Shift + P\` command palette, \`Ctrl + \\\` toggle panel
- ▶️ **Run** — execute the current JavaScript file in a sandbox; open HTML files as a live preview
- 🔍 **Search across files** (\`Ctrl + Shift + F\`)
- 💾 Files are saved in your browser (\`localStorage\`) so they survive a refresh

Have fun! Start by editing \`src/index.html\` and clicking ▶ Run.
`,
  },
  'package.json': {
    type: 'file',
    content: `{
  "name": "my-workspace",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node src/app.js"
  }
}
`,
  },
  'src/index.html': {
    type: 'file',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Hello from workSphere</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
      h1 { background: linear-gradient(90deg,#0c66e4,#7c3aed,#22c55e); -webkit-background-clip: text; color: transparent; font-size: 48px; margin: 0 0 12px; }
      p { color: #94a3b8; max-width: 50ch; line-height: 1.5; }
    </style>
  </head>
  <body>
    <h1>Hello from workSphere \u2728</h1>
    <p>Open <code>src/app.js</code>, hit \u25b6 Run, then come back and edit this file \u2014 click \u25b6 Run again to see the live preview.</p>
  </body>
</html>
`,
  },
  'src/app.js': {
    type: 'file',
    content: `// Click \u25b6 Run (or press F5) to execute this file.
// Output appears in the bottom panel.

const team = ['Khushi', 'Aarav', 'Mira', 'Sam']

console.log('workSphere coding workspace is ready!')
console.log('Team members:', team.length)
team.forEach((name, i) => console.log(\`  \${i + 1}. \${name}\`))

function fibonacci(n) {
  if (n < 2) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

console.log('First 8 Fibonacci numbers:')
for (let i = 0; i < 8; i++) {
  console.log(\`  fib(\${i}) = \${fibonacci(i)}\`)
}
`,
  },
  'src/styles.css': {
    type: 'file',
    content: `:root {
  --brand: #0c66e4;
  --accent: #7c3aed;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: linear-gradient(135deg, var(--brand), var(--accent));
  color: #fff;
  margin: 0;
  padding: 40px;
}
`,
  },
}

function readRaw() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function writeRaw(files) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(files))
  } catch {
    /* ignore quota errors */
  }
}

export function loadWorkspace() {
  const data = readRaw()
  if (!data || Object.keys(data).length === 0) {
    writeRaw(DEFAULT_FILES)
    return { ...DEFAULT_FILES }
  }
  return data
}

export function persistWorkspace(files) {
  writeRaw(files)
}

export function resetWorkspace() {
  writeRaw(DEFAULT_FILES)
  return { ...DEFAULT_FILES }
}

/** Build a tree of folders/files from the flat file map. */
export function buildTree(files) {
  const root = { name: '', path: '', type: 'folder', children: [] }
  const folderIndex = new Map([['', root]])

  function ensureFolder(folderPath) {
    if (folderIndex.has(folderPath)) return folderIndex.get(folderPath)
    const parts = folderPath.split('/')
    const name = parts[parts.length - 1]
    const parentPath = parts.slice(0, -1).join('/')
    const parent = ensureFolder(parentPath)
    const node = { name, path: folderPath, type: 'folder', children: [] }
    parent.children.push(node)
    folderIndex.set(folderPath, node)
    return node
  }

  const paths = Object.keys(files).sort()
  for (const p of paths) {
    const entry = files[p]
    if (entry.type === 'folder') {
      ensureFolder(p)
      continue
    }
    const parts = p.split('/')
    const name = parts[parts.length - 1]
    const parentPath = parts.slice(0, -1).join('/')
    const parent = ensureFolder(parentPath)
    parent.children.push({ name, path: p, type: 'file' })
  }

  function sortNode(node) {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    node.children.forEach((c) => c.type === 'folder' && sortNode(c))
  }
  sortNode(root)
  return root
}

export function joinPath(parent, name) {
  return parent ? `${parent}/${name}` : name
}

export function dirname(p) {
  const i = p.lastIndexOf('/')
  return i === -1 ? '' : p.slice(0, i)
}

export function basename(p) {
  const i = p.lastIndexOf('/')
  return i === -1 ? p : p.slice(i + 1)
}

export function isPathUnder(child, ancestor) {
  if (!ancestor) return true
  return child === ancestor || child.startsWith(`${ancestor}/`)
}
