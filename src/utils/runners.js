/** Language runners for the workSphere Coding workspace.
 *  - JavaScript: in-page eval with captured console (fast, local)
 *  - Python: Pyodide (CPython compiled to WebAssembly), loaded lazily from CDN
 *  - TypeScript: transpiled to JS via the official typescript compiler from CDN
 *  - JSON: parse + pretty-print, surface errors
 *  - Everything else (Java, C, C++, C#, Go, Rust, Ruby, PHP, Kotlin, Swift,
 *    Lua, Scala, Haskell, Elixir, Perl, R, Bash, Lisp, OCaml, Dart, Julia,
 *    Nim, Zig, Pascal, ...): executed remotely via the free Piston API
 *    (https://piston.readthedocs.io) — no API key, no signup.
 */

const PYODIDE_VERSION = 'v0.27.7'
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`
const TS_CDN = 'https://cdn.jsdelivr.net/npm/typescript@5.6.3/lib/typescript.js'

let pyodideLoadingPromise = null
let typescriptLoadingPromise = null

function formatArg(v) {
  if (typeof v === 'string') return v
  if (v instanceof Error) return v.message
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function injectScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-runner-src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve()
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      )
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.dataset.runnerSrc = src
    s.onload = () => {
      s.dataset.loaded = '1'
      resolve()
    }
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

/* ====== Pyodide loader ====== */
async function loadPyodideRuntime(onProgress) {
  if (typeof window === 'undefined') throw new Error('Pyodide requires a browser.')
  if (window.__wsPyodide) return window.__wsPyodide
  if (pyodideLoadingPromise) return pyodideLoadingPromise

  pyodideLoadingPromise = (async () => {
    onProgress?.('Loading Python runtime (Pyodide ~10MB, first time only)...')
    if (!window.loadPyodide) {
      await injectScript(`${PYODIDE_BASE}pyodide.js`)
    }
    onProgress?.('Initializing CPython interpreter...')
    const pyodide = await window.loadPyodide({ indexURL: PYODIDE_BASE })
    window.__wsPyodide = pyodide
    onProgress?.(`Python ${pyodide.version} ready.`)
    return pyodide
  })()

  try {
    return await pyodideLoadingPromise
  } catch (err) {
    pyodideLoadingPromise = null
    throw err
  }
}

/* ====== TypeScript loader ====== */
async function loadTypeScriptCompiler() {
  if (typeof window === 'undefined') throw new Error('TypeScript runtime requires a browser.')
  if (window.ts) return window.ts
  if (typescriptLoadingPromise) return typescriptLoadingPromise
  typescriptLoadingPromise = (async () => {
    await injectScript(TS_CDN)
    if (!window.ts) throw new Error('TypeScript compiler did not load.')
    return window.ts
  })()
  try {
    return await typescriptLoadingPromise
  } catch (err) {
    typescriptLoadingPromise = null
    throw err
  }
}

/* ====== JavaScript runner ====== */
export function runJavaScript(code, callbacks = {}) {
  const { onStdout, onStderr } = callbacks
  const captured = []
  const fakeConsole = {
    log: (...args) => captured.push({ kind: 'log', text: args.map(formatArg).join(' ') }),
    info: (...args) => captured.push({ kind: 'info', text: args.map(formatArg).join(' ') }),
    warn: (...args) => captured.push({ kind: 'warn', text: args.map(formatArg).join(' ') }),
    error: (...args) => captured.push({ kind: 'error', text: args.map(formatArg).join(' ') }),
    debug: (...args) => captured.push({ kind: 'log', text: args.map(formatArg).join(' ') }),
    table: (v) => captured.push({ kind: 'log', text: formatArg(v) }),
  }
  const start = performance.now()
  try {
    const fn = new Function('console', code)
    fn(fakeConsole)
    captured.forEach((l) => {
      if (l.kind === 'warn' || l.kind === 'error') onStderr?.(l.text, l.kind)
      else onStdout?.(l.text, l.kind)
    })
    return { ok: true, elapsed: (performance.now() - start).toFixed(1) }
  } catch (err) {
    captured.forEach((l) => {
      if (l.kind === 'warn' || l.kind === 'error') onStderr?.(l.text, l.kind)
      else onStdout?.(l.text, l.kind)
    })
    return { ok: false, error: err?.message || String(err) }
  }
}

/* ====== TypeScript runner ====== */
export async function runTypeScript(code, callbacks = {}) {
  const { onInfo } = callbacks
  onInfo?.('Transpiling TypeScript...')
  const ts = await loadTypeScriptCompiler()
  const out = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
      removeComments: false,
    },
  })
  if (out.diagnostics && out.diagnostics.length > 0) {
    for (const d of out.diagnostics) {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n')
      callbacks.onStderr?.(`TS: ${msg}`, 'error')
    }
  }
  return runJavaScript(out.outputText, callbacks)
}

/* ====== Python runner ====== */
export async function runPython(code, callbacks = {}) {
  const { onStdout, onStderr, onInfo } = callbacks
  try {
    const pyodide = await loadPyodideRuntime(onInfo)
    pyodide.setStdout({
      batched: (text) => {
        if (text == null) return
        onStdout?.(String(text), 'log')
      },
    })
    pyodide.setStderr({
      batched: (text) => {
        if (text == null) return
        onStderr?.(String(text), 'error')
      },
    })
    const start = performance.now()
    await pyodide.runPythonAsync(code)
    return { ok: true, elapsed: (performance.now() - start).toFixed(1) }
  } catch (err) {
    const msg = err?.message || String(err)
    return { ok: false, error: msg }
  }
}

/* ====== Install a Python package (best effort) ====== */
export async function pipInstall(pkgName, callbacks = {}) {
  const { onInfo, onStderr } = callbacks
  try {
    const pyodide = await loadPyodideRuntime(onInfo)
    onInfo?.(`Installing ${pkgName}...`)
    await pyodide.loadPackage('micropip')
    const micropip = pyodide.pyimport('micropip')
    await micropip.install(pkgName)
    onInfo?.(`✓ ${pkgName} installed.`)
    return { ok: true }
  } catch (err) {
    onStderr?.(`pip install failed: ${err?.message || err}`, 'error')
    return { ok: false, error: err?.message || String(err) }
  }
}

/* ====== JSON runner ====== */
export function runJson(code, callbacks = {}) {
  const { onStdout, onStderr } = callbacks
  try {
    const parsed = JSON.parse(code)
    onStdout?.(JSON.stringify(parsed, null, 2), 'info')
    return { ok: true }
  } catch (err) {
    onStderr?.(`JSON parse error: ${err?.message || err}`, 'error')
    return { ok: false, error: err?.message || String(err) }
  }
}

/* ====== Piston remote runner — supports 40+ languages ====== */
const PISTON_URL = 'https://emkc.org/api/v2/piston/execute'
const PISTON_RUNTIMES_URL = 'https://emkc.org/api/v2/piston/runtimes'

// File-extension → Piston language identifier(s). The first matching language
// from /runtimes will be used (we pick the latest available version).
const EXT_TO_PISTON_LANG = {
  java: ['java'],
  c: ['c', 'gcc'],
  cpp: ['c++', 'cpp'],
  cc: ['c++', 'cpp'],
  cxx: ['c++', 'cpp'],
  h: ['c'],
  hpp: ['c++', 'cpp'],
  cs: ['csharp', 'c#', 'dotnet'],
  go: ['go'],
  rs: ['rust'],
  rb: ['ruby'],
  php: ['php'],
  kt: ['kotlin'],
  swift: ['swift'],
  lua: ['lua'],
  scala: ['scala'],
  hs: ['haskell'],
  ex: ['elixir'],
  exs: ['elixir'],
  erl: ['erlang'],
  pl: ['perl'],
  r: ['rscript', 'r'],
  sh: ['bash'],
  bash: ['bash'],
  zsh: ['bash'],
  lisp: ['commonlisp', 'lisp'],
  cl: ['commonlisp', 'lisp'],
  ml: ['ocaml'],
  pas: ['pascal'],
  d: ['d'],
  zig: ['zig'],
  jl: ['julia'],
  nim: ['nim'],
  dart: ['dart'],
  raku: ['raku'],
  p6: ['raku'],
  rkt: ['racket'],
  f: ['fortran'],
  f90: ['fortran'],
  f95: ['fortran'],
  fs: ['fsharp', 'fsharp.net'],
  fsx: ['fsharp', 'fsharp.net'],
  vb: ['vbnet', 'basic.net'],
  cob: ['cobol'],
  clj: ['clojure'],
  groovy: ['groovy'],
  // Useful aliases for languages we also run locally — let user pick remote
  // by adding a comment hint if desired. Local runners take priority via
  // languageRunner() below.
}

const PISTON_LANG_LABELS = {
  java: 'Java',
  c: 'C',
  'c++': 'C++',
  cpp: 'C++',
  csharp: 'C#',
  'c#': 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  kotlin: 'Kotlin',
  swift: 'Swift',
  lua: 'Lua',
  scala: 'Scala',
  haskell: 'Haskell',
  elixir: 'Elixir',
  erlang: 'Erlang',
  perl: 'Perl',
  rscript: 'R',
  r: 'R',
  bash: 'Bash',
  commonlisp: 'Lisp',
  lisp: 'Lisp',
  ocaml: 'OCaml',
  pascal: 'Pascal',
  d: 'D',
  zig: 'Zig',
  julia: 'Julia',
  nim: 'Nim',
  dart: 'Dart',
  raku: 'Raku',
  racket: 'Racket',
  fortran: 'Fortran',
  fsharp: 'F#',
  'fsharp.net': 'F#',
  vbnet: 'VB.NET',
  'basic.net': 'VB.NET',
  cobol: 'COBOL',
  clojure: 'Clojure',
  groovy: 'Groovy',
}

let pistonRuntimesCache = null
let pistonRuntimesPromise = null

async function getPistonRuntimes() {
  if (pistonRuntimesCache) return pistonRuntimesCache
  if (pistonRuntimesPromise) return pistonRuntimesPromise
  pistonRuntimesPromise = (async () => {
    const res = await fetch(PISTON_RUNTIMES_URL, { mode: 'cors' })
    if (!res.ok) throw new Error(`Piston runtimes HTTP ${res.status}`)
    const data = await res.json()
    pistonRuntimesCache = data
    return data
  })()
  try {
    return await pistonRuntimesPromise
  } catch (err) {
    pistonRuntimesPromise = null
    throw err
  }
}

function pickRuntime(runtimes, candidates) {
  for (const cand of candidates) {
    const lower = cand.toLowerCase()
    const match = runtimes.find(
      (r) =>
        r.language?.toLowerCase() === lower ||
        (r.aliases || []).some((a) => a.toLowerCase() === lower),
    )
    if (match) return match
  }
  return null
}

export async function runRemote(ext, code, callbacks = {}) {
  const { onStdout, onStderr, onInfo } = callbacks
  const candidates = EXT_TO_PISTON_LANG[(ext || '').toLowerCase()]
  if (!candidates) {
    onStderr?.(`No remote runtime for .${ext}`, 'error')
    return { ok: false, error: `Unsupported language: .${ext}` }
  }
  try {
    onInfo?.('Connecting to remote runtime (Piston)...')
    const runtimes = await getPistonRuntimes()
    const runtime = pickRuntime(runtimes, candidates)
    if (!runtime) {
      onStderr?.(`Piston has no runtime for: ${candidates.join(', ')}`, 'error')
      return { ok: false, error: 'No matching runtime' }
    }
    onInfo?.(`Compiling on ${runtime.language}@${runtime.version}...`)
    const start = performance.now()
    const res = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ content: code }],
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    const data = await res.json()
    const elapsed = (performance.now() - start).toFixed(0)

    if (data.compile?.stderr) onStderr?.(`[compile] ${data.compile.stderr}`, 'error')
    if (data.compile?.stdout) onStdout?.(data.compile.stdout, 'log')
    if (data.run?.stdout) onStdout?.(data.run.stdout, 'log')
    if (data.run?.stderr) onStderr?.(data.run.stderr, 'error')
    if (data.run && data.run.code !== 0 && data.run.code !== null) {
      onStderr?.(`Process exited with code ${data.run.code}`, 'error')
    }
    return { ok: data.run?.code === 0, elapsed }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) }
  }
}

export function remoteLanguageLabel(ext) {
  const candidates = EXT_TO_PISTON_LANG[(ext || '').toLowerCase()]
  if (!candidates) return null
  for (const c of candidates) {
    if (PISTON_LANG_LABELS[c]) return PISTON_LANG_LABELS[c]
  }
  return candidates[0]
}

/* ====== Warm up Python in the background (non-blocking) ====== */
export function warmupPython() {
  // Fire-and-forget; safe to call repeatedly thanks to internal caching.
  loadPyodideRuntime(() => {}).catch(() => {})
}

/* ====== Dispatch by extension ====== */
export function languageRunner(ext) {
  const e = (ext || '').toLowerCase()
  if (e === 'js' || e === 'mjs' || e === 'jsx') return { kind: 'js', label: 'JavaScript' }
  if (e === 'ts' || e === 'tsx') return { kind: 'ts', label: 'TypeScript' }
  if (e === 'py' || e === 'pyw') return { kind: 'py', label: 'Python' }
  if (e === 'json') return { kind: 'json', label: 'JSON' }
  if (e === 'html' || e === 'htm') return { kind: 'html', label: 'HTML' }
  if (e === 'md' || e === 'markdown') return { kind: 'md', label: 'Markdown' }
  if (e === 'css' || e === 'scss') return { kind: 'css', label: 'CSS' }
  const remoteLabel = remoteLanguageLabel(e)
  if (remoteLabel) return { kind: 'remote', label: remoteLabel, ext: e }
  return { kind: 'unknown', label: e || 'plain text' }
}
