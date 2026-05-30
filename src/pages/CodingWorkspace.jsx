import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Editor, { loader } from '@monaco-editor/react'
import {
  basename,
  buildTree,
  dirname,
  isPathUnder,
  joinPath,
  languageFromName,
  loadWorkspace,
  persistWorkspace,
  resetWorkspace,
} from '../utils/workspaceStore.js'
import {
  languageRunner,
  runJavaScript,
  runJson,
  runPython,
  runRemote,
  runTypeScript,
  warmupPython,
} from '../utils/runners.js'
import {
  EXTENSION_CATEGORIES,
  EXTENSIONS,
  extensionColor,
  formatDownloads,
} from '../utils/extensions.js'

loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs',
  },
})

/* ====== VS Code-style SVG icons ====== */
function Icon({ name, size = 24 }) {
  const p = ICON_PATHS[name]
  if (!p) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      {p}
    </svg>
  )
}

const ICON_PATHS = {
  explorer: (
    <g fill="currentColor">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 3.5L18.5 8H14V3.5zM6 20V4h7v5h5v11H6z" />
      <path d="M8 11h8v1.5H8V11zm0 3h8v1.5H8V14zm0 3h5v1.5H8V17z" opacity=".7" />
    </g>
  ),
  search: (
    <path
      fill="currentColor"
      d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"
    />
  ),
  scm: (
    <g fill="currentColor">
      <circle cx="6" cy="5" r="2.4" />
      <circle cx="6" cy="19" r="2.4" />
      <circle cx="18" cy="5" r="2.4" />
      <path
        d="M6 7.4v9.2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M18 7.4v2.1a4 4 0 0 1-4 4H8.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  ),
  debug: (
    <g fill="currentColor">
      <path d="M12 4.5a2.5 2.5 0 0 0-2.5 2.5h5A2.5 2.5 0 0 0 12 4.5zM19 9h-3a4 4 0 0 0-.32-1.55l1.78-1.78-1.42-1.42L13.86 6.5A4 4 0 0 0 12 6c-.66 0-1.28.16-1.86.5L9.04 4.25 7.62 5.67 9.4 7.45A4 4 0 0 0 9 9H6v2h3v1H6v2h3v1H6v2h3.04A4 4 0 0 0 12 19a4 4 0 0 0 2.96-2H18v-2h-3v-1h3v-2h-3v-1h3V9zm-6 8h-2v-6h2v6z" />
    </g>
  ),
  extensions: (
    <g fill="currentColor">
      <rect x="2.5" y="2.5" width="8" height="8" rx="0.6" />
      <rect x="13.5" y="2.5" width="8" height="8" rx="0.6" />
      <rect x="2.5" y="13.5" width="8" height="8" rx="0.6" />
      <path
        d="M17.5 13.5v2.5H15v3h2.5v2.5h3V19H23v-3h-2.5v-2.5h-3z"
        opacity=".95"
      />
    </g>
  ),
  account: (
    <path
      fill="currentColor"
      d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0-6a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm0 7c-3.31 0-9 1.67-9 5v3h18v-3c0-3.33-5.69-5-9-5zm7 6H5v-1c0-1.18 3.74-3 7-3s7 1.82 7 3v1z"
    />
  ),
  settings: (
    <path
      fill="currentColor"
      d="M19.43 12.98a7.61 7.61 0 0 0 0-1.96l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.32 7.32 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.42l-.38 2.65a7.65 7.65 0 0 0-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.49.49 0 0 0 .12.64l2.11 1.65a7.93 7.93 0 0 0 0 1.96l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1c.52.4 1.08.74 1.69.98l.38 2.65A.5.5 0 0 0 10 22h4a.5.5 0 0 0 .5-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1a.5.5 0 0 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.12-1.65zM12 15.5a3.5 3.5 0 1 1 3.5-3.5 3.5 3.5 0 0 1-3.5 3.5z"
    />
  ),
  file: <path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />,
  folder: <path fill="currentColor" d="M10 4H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />,
  newFile: (
    <g fill="currentColor">
      <path d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8l-6-6zm3 4.41V7h-2.59L13 5.59V3h.59L17 6.41zM6 20V4h5v5h5v11H6z" />
      <path d="M11 11h2v3h3v2h-3v3h-2v-3H8v-2h3z" />
    </g>
  ),
  newFolder: (
    <g fill="currentColor">
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
      <path d="M11 10v3H8v2h3v3h2v-3h3v-2h-3v-3z" fill="#1e1e1e" />
    </g>
  ),
  refresh: (
    <path
      fill="currentColor"
      d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 0 0 0 16 7.99 7.99 0 0 0 7.74-6h-2.08a6 6 0 1 1-5.66-8 5.95 5.95 0 0 1 4.23 1.77L13 11h7V4l-2.35 2.35z"
    />
  ),
  collapse: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16M4 19h16" />
      <path d="M9 9l3 3 3-3M9 15l3-3 3 3" />
    </g>
  ),
  close: <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />,
  caretDown: <path fill="currentColor" d="M7 10l5 5 5-5H7z" />,
  caretRight: <path fill="currentColor" d="M10 17l5-5-5-5v10z" />,
  run: <path fill="currentColor" d="M8 5v14l11-7L8 5z" />,
  split: <path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 16H5V5h7v14z" />,
  layout: <path fill="currentColor" d="M3 5v14h18V5H3zm6 12H5V7h4v10zm10 0h-8V7h8v10z" />,
  more: <path fill="currentColor" d="M12 8a2 2 0 1 0-2-2 2 2 0 0 0 2 2zm0 2a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm0 6a2 2 0 1 0 2 2 2 2 0 0 0-2-2z" />,
  branch: (
    <path
      fill="currentColor"
      d="M11.75 2.5a1.75 1.75 0 1 0 1.75 1.75A1.75 1.75 0 0 0 11.75 2.5zM5 3.75a1.75 1.75 0 1 1-1.75 1.75A1.75 1.75 0 0 1 5 3.75zM10 12.25v6h2v-6a3.5 3.5 0 0 0 3.5-3.5V7.5h-1V8.75A2.5 2.5 0 0 1 12 11.25H8a2.5 2.5 0 0 1-2.5-2.5V7.5h-1v1.25A3.5 3.5 0 0 0 8 12.25h2zM5 18.5a1.75 1.75 0 1 1-1.75 1.75A1.75 1.75 0 0 1 5 18.5z"
    />
  ),
  error: <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />,
  warning: <path fill="currentColor" d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v5h2v-5z" />,
  feedback: (
    <path
      fill="currentColor"
      d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm0 14H6l-2 2V4h16v12z"
    />
  ),
  notifications: <path fill="currentColor" d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 0 0-5-5.91V4a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z" />,
  goLive: <path fill="currentColor" d="M5 12.55a8 8 0 0 1 14 0M1.42 9a12 12 0 0 1 21.16 0M8.53 16.11a4 4 0 0 1 6.95 0M12 20h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
}

const MOBILE_BREAK = 768

function useIsMobile(breakpoint = MOBILE_BREAK) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [breakpoint])
  return isMobile
}

const ACTIVITY_VIEWS = [
  { id: 'explorer', icon: 'explorer', label: 'Explorer (Ctrl+Shift+E)' },
  { id: 'search', icon: 'search', label: 'Search (Ctrl+Shift+F)' },
  { id: 'scm', icon: 'scm', label: 'Source Control (Ctrl+Shift+G)' },
  { id: 'debug', icon: 'debug', label: 'Run and Debug (Ctrl+Shift+D)' },
  { id: 'extensions', icon: 'extensions', label: 'Extensions (Ctrl+Shift+X)' },
]

const ACTIVITY_VIEWS_BOTTOM = [
  { id: 'account', icon: 'account', label: 'Accounts' },
  { id: 'settings', icon: 'settings', label: 'Manage' },
]

/* ====== File icon (by extension) ====== */
function fileEmoji(name) {
  const ext = name.toLowerCase().split('.').pop()
  switch (ext) {
    case 'js':
    case 'mjs':
    case 'jsx':
      return { glyph: 'JS', color: '#cbcb41' }
    case 'ts':
    case 'tsx':
      return { glyph: 'TS', color: '#3178c6' }
    case 'json':
      return { glyph: '{ }', color: '#cbcb41' }
    case 'css':
    case 'scss':
      return { glyph: '#', color: '#42a5f5' }
    case 'html':
    case 'htm':
      return { glyph: '<>', color: '#e44d26' }
    case 'md':
    case 'markdown':
      return { glyph: 'M↓', color: '#519aba' }
    case 'py':
      return { glyph: 'Py', color: '#3776ab' }
    default:
      return { glyph: '▦', color: '#cccccc' }
  }
}

function FileGlyph({ name }) {
  const { glyph, color } = fileEmoji(name)
  return (
    <span className="cw-file-glyph" style={{ color }} aria-hidden>
      {glyph}
    </span>
  )
}

/* ====== File tree node ====== */
function TreeNode({
  node,
  depth,
  activeFile,
  expanded,
  onToggle,
  onSelect,
  onContextMenu,
  renamingPath,
  renameDraft,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
}) {
  if (node.type === 'folder') {
    const isOpen = expanded[node.path] !== false
    return (
      <div className="cw-tree-folder">
        <div
          className="cw-tree-row cw-tree-row--folder"
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => onToggle(node.path)}
          onContextMenu={(e) => onContextMenu(e, node)}
        >
          <span className="cw-tree-caret" aria-hidden>
            <Icon name={isOpen ? 'caretDown' : 'caretRight'} size={14} />
          </span>
          <span className="cw-tree-icon" aria-hidden>
            <Icon name="folder" size={16} />
          </span>
          <span className="cw-tree-name">{node.name || 'workspace'}</span>
        </div>
        {isOpen && node.children.length > 0 ? (
          <div className="cw-tree-children">
            {node.children.map((c) => (
              <TreeNode
                key={c.path}
                node={c}
                depth={depth + 1}
                activeFile={activeFile}
                expanded={expanded}
                onToggle={onToggle}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                renamingPath={renamingPath}
                renameDraft={renameDraft}
                onRenameChange={onRenameChange}
                onRenameCommit={onRenameCommit}
                onRenameCancel={onRenameCancel}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const isActive = node.path === activeFile
  const isRenaming = node.path === renamingPath
  return (
    <div
      className={`cw-tree-row cw-tree-row--file${isActive ? ' is-active' : ''}`}
      style={{ paddingLeft: 8 + depth * 12 + 12 }}
      onClick={() => onSelect(node.path)}
      onContextMenu={(e) => onContextMenu(e, node)}
    >
      <FileGlyph name={node.name} />
      {isRenaming ? (
        <input
          className="cw-tree-rename"
          value={renameDraft}
          autoFocus
          onChange={(e) => onRenameChange(e.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onRenameCommit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onRenameCancel()
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="cw-tree-name">{node.name}</span>
      )}
    </div>
  )
}

/* ====== Welcome page ====== */
function WelcomePage({ onNewFile, onOpenFile, onReset, recents = [], onOpenRecent }) {
  return (
    <div className="cw-welcome">
      <div className="cw-welcome-inner">
        <div className="cw-welcome-head">
          <h1 className="cw-welcome-title">workSphere Code</h1>
          <p className="cw-welcome-sub">Editing evolved · in your browser</p>
        </div>
        <div className="cw-welcome-grid">
          <section className="cw-welcome-col">
            <h2>Start</h2>
            <ul className="cw-welcome-list">
              <li>
                <button type="button" onClick={onNewFile}>
                  <Icon name="newFile" size={16} />
                  New File...
                </button>
              </li>
              <li>
                <button type="button" onClick={onOpenFile}>
                  <Icon name="file" size={16} />
                  Open File...
                </button>
              </li>
              <li>
                <button type="button" onClick={onOpenFile}>
                  <Icon name="folder" size={16} />
                  Open Folder...
                </button>
              </li>
              <li>
                <button type="button" onClick={onReset}>
                  <Icon name="refresh" size={16} />
                  Reset workspace to defaults
                </button>
              </li>
            </ul>

            <h2 className="cw-welcome-sub-h">Recent</h2>
            <ul className="cw-welcome-list cw-welcome-list--recent">
              {recents.length === 0 ? (
                <li className="cw-welcome-empty">No recent files. Create a file to get started.</li>
              ) : (
                recents.slice(0, 6).map((p) => (
                  <li key={p}>
                    <button type="button" onClick={() => onOpenRecent(p)} className="cw-welcome-recent">
                      <span className="cw-welcome-recent-name">{basename(p)}</span>
                      <span className="cw-welcome-recent-path">{dirname(p) || '/'}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="cw-welcome-col">
            <h2>Walkthroughs</h2>
            <ul className="cw-walkthroughs">
              <li className="cw-walkthrough">
                <div className="cw-walkthrough-icon cw-walkthrough-icon--blue">
                  <Icon name="explorer" size={20} />
                </div>
                <div className="cw-walkthrough-body">
                  <strong>Get started with workSphere Code</strong>
                  <span>Customize your editor, learn the basics, and start coding.</span>
                </div>
              </li>
              <li className="cw-walkthrough">
                <div className="cw-walkthrough-icon cw-walkthrough-icon--green">
                  <Icon name="run" size={20} />
                </div>
                <div className="cw-walkthrough-body">
                  <strong>Run your first script</strong>
                  <span>Open <code>src/app.js</code> and press F5 to run it in the sandbox.</span>
                </div>
              </li>
              <li className="cw-walkthrough">
                <div className="cw-walkthrough-icon cw-walkthrough-icon--violet">
                  <Icon name="search" size={20} />
                </div>
                <div className="cw-walkthrough-body">
                  <strong>Master keyboard shortcuts</strong>
                  <span>Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> to discover every command.</span>
                </div>
              </li>
              <li className="cw-walkthrough">
                <div className="cw-walkthrough-icon cw-walkthrough-icon--orange">
                  <Icon name="extensions" size={20} />
                </div>
                <div className="cw-walkthrough-body">
                  <strong>Browse Extensions</strong>
                  <span>Find tools that supercharge your workflow (mock — coming soon).</span>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function Stars({ rating }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span className="cw-stars" aria-label={`${rating} out of 5`}>
      {'★'.repeat(full)}
      {half ? '⯨' : ''}
      <span className="cw-stars-empty">{'★'.repeat(empty)}</span>
    </span>
  )
}

function VerifiedBadge() {
  return (
    <span className="cw-verified" title="Verified publisher" aria-label="Verified">
      <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M8 0l2 2 2.83-.83L13 4l2.83.83L13 8l2.83 3.17L13 12l-.17 2.83L10 14l-2 2-2-2-2.83.83L3 12 .17 11.17 3 8 .17 4.83 3 4l.17-2.83L6 2 8 0zm-1.4 11.6l5.5-5.5-1.4-1.4-4.1 4.1-2.1-2.1-1.4 1.4 3.5 3.5z"
        />
      </svg>
    </span>
  )
}

/* ====== Main component ====== */
export default function CodingWorkspace() {
  const [files, setFiles] = useState(() => loadWorkspace())
  const [openTabs, setOpenTabs] = useState([])
  const [activeFile, setActiveFile] = useState('')
  const [recents, setRecents] = useState([])
  const [dirty, setDirty] = useState({})
  const [drafts, setDrafts] = useState({})
  const [expanded, setExpanded] = useState({ '': true, src: true })
  const [activeView, setActiveView] = useState('explorer')
  const [sidebarVisible, setSidebarVisible] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > MOBILE_BREAK : true,
  )
  const isMobile = useIsMobile()
  const [panelVisible, setPanelVisible] = useState(false)
  const [panelTab, setPanelTab] = useState('output')
  const [searchQuery, setSearchQuery] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [renamingPath, setRenamingPath] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [output, setOutput] = useState([])
  const [previewSrc, setPreviewSrc] = useState('')
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [editorTheme, setEditorTheme] = useState('vs-dark')
  const [fontSize, setFontSize] = useState(14)
  const [wordWrap, setWordWrap] = useState('off')
  const [openMenu, setOpenMenu] = useState(null)
  const [extInstalled, setExtInstalled] = useState(() =>
    Object.fromEntries(EXTENSIONS.map((e) => [e.id, !!e.installed])),
  )
  const [extQuery, setExtQuery] = useState('')
  const [extCategory, setExtCategory] = useState('all')
  const [isRunning, setIsRunning] = useState(false)
  const [runLanguage, setRunLanguage] = useState('')
  const [splitView, setSplitView] = useState(false)
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const navigate = useNavigate()
  const [isMaximized, setIsMaximized] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)

  function handleMinimize() {
    setIsMinimized(true)
    window.setTimeout(() => {
      setIsMinimized(false)
    }, 1100)
  }

  function handleToggleMaximize() {
    setIsMaximized((v) => !v)
  }

  function handleClose() {
    navigate('/')
  }

  useEffect(() => {
    persistWorkspace(files)
  }, [files])

  // Preload Pyodide in the background as soon as the user touches any .py
  // file in this session — so the first Run is near-instant.
  useEffect(() => {
    if (!activeFile) return
    const ext = activeFile.toLowerCase().split('.').pop()
    if (ext === 'py' || ext === 'pyw') {
      warmupPython()
    }
  }, [activeFile])

  const tree = useMemo(() => buildTree(files), [files])

  const currentEntry = activeFile ? files[activeFile] : null
  const currentValue =
    activeFile && drafts[activeFile] != null
      ? drafts[activeFile]
      : currentEntry?.content ?? ''
  const currentLanguage = activeFile ? languageFromName(basename(activeFile)) : 'plaintext'

  function pushRecent(path) {
    setRecents((prev) => [path, ...prev.filter((p) => p !== path)].slice(0, 10))
  }

  function openFile(path) {
    if (!files[path] || files[path].type !== 'file') return
    setActiveFile(path)
    setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]))
    pushRecent(path)
    if (isMobile) setSidebarVisible(false)
  }

  function closeTab(path, e) {
    e?.stopPropagation()
    if (dirty[path]) {
      const ok = window.confirm(`Close ${basename(path)} without saving changes?`)
      if (!ok) return
    }
    setOpenTabs((prev) => {
      const next = prev.filter((p) => p !== path)
      if (activeFile === path) {
        const idx = prev.indexOf(path)
        const fallback = next[idx] ?? next[idx - 1] ?? next[0] ?? ''
        setActiveFile(fallback || '')
      }
      return next
    })
    setDirty((d) => {
      const next = { ...d }
      delete next[path]
      return next
    })
    setDrafts((d) => {
      const next = { ...d }
      delete next[path]
      return next
    })
  }

  function updateDraft(value) {
    if (!activeFile) return
    setDrafts((d) => ({ ...d, [activeFile]: value ?? '' }))
    setDirty((d) => ({ ...d, [activeFile]: true }))
  }

  const saveCurrent = useCallback(() => {
    if (!activeFile) return
    const value = drafts[activeFile]
    if (value == null) return
    setFiles((prev) => ({
      ...prev,
      [activeFile]: { ...(prev[activeFile] || { type: 'file' }), content: value },
    }))
    setDirty((d) => {
      const next = { ...d }
      delete next[activeFile]
      return next
    })
    setDrafts((d) => {
      const next = { ...d }
      delete next[activeFile]
      return next
    })
  }, [activeFile, drafts])

  const saveAll = useCallback(() => {
    const updates = {}
    for (const [path, value] of Object.entries(drafts)) {
      if (files[path]) updates[path] = { ...files[path], content: value }
    }
    if (Object.keys(updates).length === 0) return
    setFiles((prev) => ({ ...prev, ...updates }))
    setDirty({})
    setDrafts({})
  }, [drafts, files])

  function createFile(parentFolder = '') {
    const name = window.prompt('New file name', 'untitled.txt')
    if (!name || !name.trim()) return
    const cleaned = name.trim().replace(/[\\:*?"<>|]/g, '-')
    const fullPath = joinPath(parentFolder, cleaned)
    if (files[fullPath]) {
      window.alert('A file with that name already exists.')
      return
    }
    setFiles((prev) => ({ ...prev, [fullPath]: { type: 'file', content: '' } }))
    setExpanded((e) => ({ ...e, [parentFolder]: true }))
    setActiveFile(fullPath)
    setOpenTabs((prev) => (prev.includes(fullPath) ? prev : [...prev, fullPath]))
    pushRecent(fullPath)
  }

  function createFolder(parentFolder = '') {
    const name = window.prompt('New folder name', 'new-folder')
    if (!name || !name.trim()) return
    const cleaned = name.trim().replace(/[\\/:*?"<>|]/g, '-')
    const fullPath = joinPath(parentFolder, cleaned)
    if (files[fullPath]) {
      window.alert('Already exists.')
      return
    }
    setFiles((prev) => ({ ...prev, [fullPath]: { type: 'folder' } }))
    setExpanded((e) => ({ ...e, [parentFolder]: true, [fullPath]: true }))
  }

  function deletePath(path, isFolder) {
    const ok = window.confirm(
      isFolder
        ? `Delete folder "${path}" and everything inside it?`
        : `Delete file "${path}"?`,
    )
    if (!ok) return
    setFiles((prev) => {
      const next = {}
      for (const [k, v] of Object.entries(prev)) {
        if (!isPathUnder(k, path)) next[k] = v
      }
      return next
    })
    setOpenTabs((prev) => prev.filter((p) => !isPathUnder(p, path)))
    if (isPathUnder(activeFile, path)) setActiveFile('')
  }

  function startRename(path) {
    setRenamingPath(path)
    setRenameDraft(basename(path))
    setContextMenu(null)
  }

  function commitRename() {
    if (!renamingPath) return
    const next = renameDraft.trim().replace(/[\\/:*?"<>|]/g, '-')
    setRenamingPath(null)
    setRenameDraft('')
    if (!next || next === basename(renamingPath)) return
    const newPath = joinPath(dirname(renamingPath), next)
    if (files[newPath]) {
      window.alert('Name already exists.')
      return
    }
    setFiles((prev) => {
      const updated = {}
      for (const [k, v] of Object.entries(prev)) {
        if (k === renamingPath) updated[newPath] = v
        else if (isPathUnder(k, renamingPath)) {
          const tail = k.slice(renamingPath.length)
          updated[`${newPath}${tail}`] = v
        } else updated[k] = v
      }
      return updated
    })
    setOpenTabs((prev) =>
      prev.map((p) =>
        p === renamingPath
          ? newPath
          : isPathUnder(p, renamingPath)
            ? `${newPath}${p.slice(renamingPath.length)}`
            : p,
      ),
    )
    if (activeFile === renamingPath) setActiveFile(newPath)
    else if (isPathUnder(activeFile, renamingPath))
      setActiveFile(`${newPath}${activeFile.slice(renamingPath.length)}`)
  }

  function cancelRename() {
    setRenamingPath(null)
    setRenameDraft('')
  }

  function handleContextMenu(e, node) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  function appendOutput(line, kind = 'log') {
    setOutput((prev) => [...prev, { id: Date.now() + Math.random(), kind, line }])
  }

  async function runCurrent() {
    if (!activeFile || isRunning) return
    saveCurrent()
    const ext = activeFile.toLowerCase().split('.').pop()
    const runner = languageRunner(ext)
    setOutput([])
    setPanelVisible(true)
    setRunLanguage(runner.label)

    const onStdout = (text, kind = 'log') => appendOutput(text, kind)
    const onStderr = (text, kind = 'error') => appendOutput(text, kind)
    const onInfo = (text) => appendOutput(text, 'info')

    if (runner.kind === 'html') {
      const content = drafts[activeFile] ?? files[activeFile]?.content ?? ''
      const blob = new Blob([content], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      setPreviewSrc(url)
      setPanelTab('preview')
      appendOutput(`Live preview rendered for ${activeFile}`, 'info')
      return
    }

    if (runner.kind === 'md') {
      const content = drafts[activeFile] ?? files[activeFile]?.content ?? ''
      const html = renderMarkdown(content)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      setPreviewSrc(url)
      setPanelTab('preview')
      appendOutput(`Rendered markdown preview for ${activeFile}`, 'info')
      return
    }

    if (runner.kind === 'css') {
      const css = drafts[activeFile] ?? files[activeFile]?.content ?? ''
      const html = `<!doctype html><meta charset="utf-8"><title>CSS preview</title><style>${css}</style><body><div class="demo"><h1>Heading</h1><p>This is a paragraph styled by your CSS.</p><button>Button</button></div></body>`
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      setPreviewSrc(url)
      setPanelTab('preview')
      appendOutput(`CSS preview rendered for ${activeFile}`, 'info')
      return
    }

    if (runner.kind === 'unknown') {
      setPanelTab('output')
      appendOutput(`Cannot run .${ext} in the browser yet. Supported: .py .js .ts .json .html .md .css`, 'warn')
      return
    }

    setPanelTab('output')
    setIsRunning(true)
    appendOutput(`> Running ${runner.label} — ${basename(activeFile)}`, 'info')
    const code = drafts[activeFile] ?? files[activeFile]?.content ?? ''

    try {
      let result
      if (runner.kind === 'js') {
        result = runJavaScript(code, { onStdout, onStderr, onInfo })
      } else if (runner.kind === 'ts') {
        result = await runTypeScript(code, { onStdout, onStderr, onInfo })
      } else if (runner.kind === 'py') {
        result = await runPython(code, { onStdout, onStderr, onInfo })
      } else if (runner.kind === 'json') {
        result = runJson(code, { onStdout, onStderr, onInfo })
      } else if (runner.kind === 'remote') {
        result = await runRemote(ext, code, { onStdout, onStderr, onInfo })
      }
      if (result?.ok) {
        appendOutput(`✓ done${result.elapsed ? ` in ${result.elapsed} ms` : ''}`, 'info')
      } else if (result) {
        appendOutput(`✗ ${result.error}`, 'error')
      }
    } catch (err) {
      appendOutput(`✗ ${err?.message || err}`, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  // Lightweight markdown -> HTML renderer (no external deps). Handles
  // headings, bold/italic/code, links, lists, code blocks, paragraphs.
  function renderMarkdown(md) {
    const escape = (s) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const lines = md.split('\n')
    let html = ''
    let inCode = false
    let inList = false
    for (let line of lines) {
      if (/^```/.test(line)) {
        if (inCode) {
          html += '</code></pre>'
          inCode = false
        } else {
          html += '<pre><code>'
          inCode = true
        }
        continue
      }
      if (inCode) {
        html += `${escape(line)}\n`
        continue
      }
      if (/^\s*[-*]\s+/.test(line)) {
        if (!inList) {
          html += '<ul>'
          inList = true
        }
        html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`
        continue
      }
      if (inList) {
        html += '</ul>'
        inList = false
      }
      const h = line.match(/^(#{1,6})\s+(.*)$/)
      if (h) {
        const lvl = h[1].length
        html += `<h${lvl}>${inline(h[2])}</h${lvl}>`
        continue
      }
      if (line.trim() === '') {
        html += ''
        continue
      }
      html += `<p>${inline(line)}</p>`
    }
    if (inList) html += '</ul>'
    if (inCode) html += '</code></pre>'

    function inline(s) {
      return escape(s)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    }

    return `<!doctype html><html><head><meta charset="utf-8"><title>Preview</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.65;color:#1f2937;max-width:780px;margin:0 auto;padding:36px 28px}
  h1,h2,h3,h4,h5,h6{color:#0f172a;margin-top:1.6em;margin-bottom:.6em;line-height:1.25}
  h1{font-size:2em;border-bottom:1px solid #e5e7eb;padding-bottom:.3em}
  h2{font-size:1.5em;border-bottom:1px solid #e5e7eb;padding-bottom:.3em}
  code{background:#f1f5f9;padding:.15em .4em;border-radius:4px;font-size:.92em}
  pre{background:#0f172a;color:#e2e8f0;padding:14px 18px;border-radius:8px;overflow:auto}
  pre code{background:transparent;padding:0;color:inherit}
  a{color:#2563eb}
  ul{padding-left:1.4em}
  blockquote{border-left:4px solid #e5e7eb;color:#475569;padding:4px 14px;margin:1em 0}
</style></head><body>${html}</body></html>`
  }

  function handleEditorMount(editor, monaco) {
    editorRef.current = editor
    monacoRef.current = monaco
    editor.onDidChangeCursorPosition((e) => {
      setCursor({ line: e.position.lineNumber, column: e.position.column })
    })
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveCurrent())
  }

  useEffect(() => {
    function onKey(e) {
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (e.shiftKey) saveAll()
        else saveCurrent()
      } else if (ctrl && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSidebarVisible((v) => !v)
      } else if (ctrl && e.key === '`') {
        e.preventDefault()
        setPanelVisible((v) => !v)
      } else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPaletteOpen(true)
      } else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setActiveView('search')
        setSidebarVisible(true)
      } else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setActiveView('explorer')
        setSidebarVisible(true)
      } else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        setActiveView('extensions')
        setSidebarVisible(true)
      } else if (ctrl && e.key === '\\') {
        e.preventDefault()
        if (activeFile) setSplitView((v) => !v)
      } else if (ctrl && e.key.toLowerCase() === 'q') {
        e.preventDefault()
        navigate('/')
      } else if (e.key === 'F5') {
        e.preventDefault()
        runCurrent()
      } else if (e.key === 'Escape') {
        setPaletteOpen(false)
        setContextMenu(null)
        setOpenMenu(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveCurrent, saveAll, activeFile])

  useEffect(() => {
    function close() {
      setContextMenu(null)
    }
    if (!contextMenu) return undefined
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  useEffect(() => {
    function close(e) {
      if (!openMenu) return
      if (e.target.closest?.('.cw-menubar-item')) return
      setOpenMenu(null)
    }
    if (!openMenu) return undefined
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openMenu])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return []
    const out = []
    const lower = q.toLowerCase()
    for (const [path, entry] of Object.entries(files)) {
      if (entry.type !== 'file') continue
      const text = drafts[path] ?? entry.content ?? ''
      const lines = text.split('\n')
      lines.forEach((line, i) => {
        const idx = line.toLowerCase().indexOf(lower)
        if (idx !== -1) {
          out.push({ path, line: i + 1, text: line.trim().slice(0, 140) })
        }
      })
    }
    return out.slice(0, 200)
  }, [searchQuery, files, drafts])

  const dirtyCount = Object.values(dirty).filter(Boolean).length

  const paletteCommands = useMemo(() => {
    const cmds = [
      { id: 'save', label: 'File: Save', shortcut: 'Ctrl+S', run: saveCurrent },
      { id: 'saveAll', label: 'File: Save All', shortcut: 'Ctrl+Shift+S', run: saveAll },
      { id: 'newFile', label: 'File: New File', run: () => createFile(dirname(activeFile)) },
      { id: 'newFolder', label: 'File: New Folder', run: () => createFolder(dirname(activeFile)) },
      { id: 'run', label: 'Run: Run current file', shortcut: 'F5', run: runCurrent },
      { id: 'toggleSidebar', label: 'View: Toggle Primary Sidebar', shortcut: 'Ctrl+B', run: () => setSidebarVisible((v) => !v) },
      { id: 'togglePanel', label: 'View: Toggle Panel', shortcut: 'Ctrl+`', run: () => setPanelVisible((v) => !v) },
      { id: 'splitEditor', label: 'View: Split Editor Right', shortcut: 'Ctrl+\\', run: () => activeFile && setSplitView((v) => !v) },
      { id: 'gotoExplorer', label: 'View: Show Explorer', shortcut: 'Ctrl+Shift+E', run: () => { setActiveView('explorer'); setSidebarVisible(true) } },
      { id: 'gotoSearch', label: 'View: Show Search', shortcut: 'Ctrl+Shift+F', run: () => { setActiveView('search'); setSidebarVisible(true) } },
      { id: 'gotoSCM', label: 'View: Show Source Control', shortcut: 'Ctrl+Shift+G', run: () => { setActiveView('scm'); setSidebarVisible(true) } },
      { id: 'gotoDebug', label: 'View: Show Run and Debug', shortcut: 'Ctrl+Shift+D', run: () => { setActiveView('debug'); setSidebarVisible(true) } },
      { id: 'gotoExt', label: 'View: Show Extensions', shortcut: 'Ctrl+Shift+X', run: () => { setActiveView('extensions'); setSidebarVisible(true) } },
      { id: 'themeDark', label: 'Preferences: Color Theme — Dark+ (default)', run: () => setEditorTheme('vs-dark') },
      { id: 'themeLight', label: 'Preferences: Color Theme — Light', run: () => setEditorTheme('light') },
      { id: 'themeHC', label: 'Preferences: Color Theme — High Contrast', run: () => setEditorTheme('hc-black') },
      { id: 'wrap', label: 'View: Toggle Word Wrap', run: () => setWordWrap((w) => (w === 'on' ? 'off' : 'on')) },
      { id: 'reset', label: 'Workspace: Reset to defaults', run: () => {
        if (window.confirm('Reset workspace? This deletes all your changes.')) {
          const next = resetWorkspace()
          setFiles(next)
          setOpenTabs([])
          setActiveFile('')
          setDrafts({})
          setDirty({})
        }
      } },
    ]
    if (!paletteQuery.trim()) return cmds
    const q = paletteQuery.toLowerCase()
    return cmds.filter((c) => c.label.toLowerCase().includes(q))
  }, [paletteQuery, saveCurrent, saveAll, activeFile])

  /* ====== Menu bar definitions ====== */
  function runMenu(id) {
    setOpenMenu(null)
    const map = {
      newFile: () => createFile(dirname(activeFile)),
      newFolder: () => createFolder(dirname(activeFile)),
      openFile: () => {
        setActiveView('explorer')
        setSidebarVisible(true)
      },
      save: () => saveCurrent(),
      saveAll: () => saveAll(),
      closeEditor: () => activeFile && closeTab(activeFile),
      exit: () => navigate('/'),
      undo: () => editorRef.current?.trigger?.('keyboard', 'undo', null),
      redo: () => editorRef.current?.trigger?.('keyboard', 'redo', null),
      cut: () => document.execCommand('cut'),
      copy: () => document.execCommand('copy'),
      paste: () => document.execCommand('paste'),
      findInFile: () => editorRef.current?.trigger?.('keyboard', 'actions.find', null),
      findInFiles: () => {
        setActiveView('search')
        setSidebarVisible(true)
      },
      selectAll: () => editorRef.current?.trigger?.('keyboard', 'editor.action.selectAll', null),
      sidebar: () => setSidebarVisible((v) => !v),
      panel: () => setPanelVisible((v) => !v),
      split: () => activeFile && setSplitView((v) => !v),
      palette: () => setPaletteOpen(true),
      explorer: () => { setActiveView('explorer'); setSidebarVisible(true) },
      search: () => { setActiveView('search'); setSidebarVisible(true) },
      scm: () => { setActiveView('scm'); setSidebarVisible(true) },
      debug: () => { setActiveView('debug'); setSidebarVisible(true) },
      extensions: () => { setActiveView('extensions'); setSidebarVisible(true) },
      run: () => runCurrent(),
      runWithoutDebug: () => runCurrent(),
      terminal: () => { setPanelVisible(true); setPanelTab('terminal') },
      output: () => { setPanelVisible(true); setPanelTab('output') },
      preview: () => { setPanelVisible(true); setPanelTab('preview') },
      welcome: () => setActiveFile(''),
      reset: () => {
        if (window.confirm('Reset workspace? This deletes all your changes.')) {
          const next = resetWorkspace()
          setFiles(next)
          setOpenTabs([])
          setActiveFile('')
          setDrafts({})
          setDirty({})
        }
      },
    }
    map[id]?.()
  }

  const MENUS = {
    file: [
      { id: 'newFile', label: 'New File...', shortcut: 'Ctrl+N' },
      { id: 'newFolder', label: 'New Folder' },
      { id: 'openFile', label: 'Open File...', shortcut: 'Ctrl+O' },
      { sep: true },
      { id: 'save', label: 'Save', shortcut: 'Ctrl+S' },
      { id: 'saveAll', label: 'Save All', shortcut: 'Ctrl+K S' },
      { sep: true },
      { id: 'closeEditor', label: 'Close Editor', shortcut: 'Ctrl+W' },
      { sep: true },
      { id: 'exit', label: 'Back to workSphere', shortcut: 'Ctrl+Q' },
    ],
    edit: [
      { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
      { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y' },
      { sep: true },
      { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X' },
      { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C' },
      { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
      { sep: true },
      { id: 'findInFile', label: 'Find', shortcut: 'Ctrl+F' },
      { id: 'findInFiles', label: 'Find in Files', shortcut: 'Ctrl+Shift+F' },
    ],
    selection: [
      { id: 'selectAll', label: 'Select All', shortcut: 'Ctrl+A' },
    ],
    view: [
      { id: 'palette', label: 'Command Palette...', shortcut: 'Ctrl+Shift+P' },
      { sep: true },
      { id: 'explorer', label: 'Explorer', shortcut: 'Ctrl+Shift+E' },
      { id: 'search', label: 'Search', shortcut: 'Ctrl+Shift+F' },
      { id: 'scm', label: 'Source Control', shortcut: 'Ctrl+Shift+G' },
      { id: 'debug', label: 'Run', shortcut: 'Ctrl+Shift+D' },
      { id: 'extensions', label: 'Extensions', shortcut: 'Ctrl+Shift+X' },
      { sep: true },
      { id: 'sidebar', label: 'Toggle Primary Side Bar', shortcut: 'Ctrl+B' },
      { id: 'panel', label: 'Toggle Panel', shortcut: 'Ctrl+`' },
      { id: 'split', label: 'Split Editor', shortcut: 'Ctrl+\\' },
    ],
    go: [
      { id: 'palette', label: 'Go to File...', shortcut: 'Ctrl+P' },
    ],
    run: [
      { id: 'run', label: 'Start Debugging', shortcut: 'F5' },
      { id: 'runWithoutDebug', label: 'Run Without Debugging', shortcut: 'Ctrl+F5' },
    ],
    terminal: [
      { id: 'terminal', label: 'New Terminal', shortcut: 'Ctrl+Shift+`' },
      { id: 'output', label: 'Output' },
      { id: 'preview', label: 'Preview Panel' },
    ],
    help: [
      { id: 'welcome', label: 'Welcome' },
      { id: 'palette', label: 'Show All Commands', shortcut: 'Ctrl+Shift+P' },
      { sep: true },
      { id: 'reset', label: 'Reset Workspace' },
    ],
  }

  const MENU_NAMES = [
    { id: 'file', label: 'File' },
    { id: 'edit', label: 'Edit' },
    { id: 'selection', label: 'Selection' },
    { id: 'view', label: 'View' },
    { id: 'go', label: 'Go' },
    { id: 'run', label: 'Run' },
    { id: 'terminal', label: 'Terminal' },
    { id: 'help', label: 'Help' },
  ]

  // Mock source control diffs: files in `dirty` count as "modified"
  const scmChanges = Object.keys(dirty).filter((p) => dirty[p])

  // Breadcrumb segments
  const breadcrumb = activeFile ? activeFile.split('/') : []

  return (
    <main
      className={`cw-page${isMaximized ? '' : ' is-windowed'}${isMinimized ? ' is-minimized' : ''}`}
      aria-label="workSphere Coding workspace"
    >
      {/* Menu bar (title bar) */}
      <header className="cw-menubar" onDoubleClick={handleToggleMaximize}>
        <Link
          className="cw-menubar-back"
          to="/"
          title="Back to workSphere home"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="cw-menubar-brand">wS</span>
          <span className="cw-menubar-back-label">workSphere</span>
        </Link>
        <nav
          className="cw-menubar-items"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {MENU_NAMES.map((m) => (
            <div key={m.id} className="cw-menubar-item-wrap">
              <button
                type="button"
                className={`cw-menubar-item${openMenu === m.id ? ' is-on' : ''}`}
                onClick={() => setOpenMenu((cur) => (cur === m.id ? null : m.id))}
                onMouseEnter={() => openMenu && openMenu !== m.id && setOpenMenu(m.id)}
              >
                {m.label}
              </button>
              {openMenu === m.id ? (
                <div className="cw-menubar-dropdown" role="menu">
                  {MENUS[m.id].map((entry, i) =>
                    entry.sep ? (
                      <hr key={`sep-${i}`} />
                    ) : (
                      <button
                        key={entry.id + i}
                        type="button"
                        role="menuitem"
                        className="cw-menubar-dropdown-item"
                        onClick={() => runMenu(entry.id)}
                      >
                        <span>{entry.label}</span>
                        {entry.shortcut ? <kbd>{entry.shortcut}</kbd> : null}
                      </button>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="cw-menubar-title">
          {activeFile ? `${dirty[activeFile] ? '● ' : ''}${basename(activeFile)} — ` : ''}
          workSphere Code
        </div>
        <button
          type="button"
          className="cw-menubar-window-btn"
          onClick={(e) => {
            e.stopPropagation()
            setPaletteOpen(true)
          }}
          title="Command Palette (Ctrl+Shift+P)"
        >
          <Icon name="search" size={14} />
          <span>{activeFile ? basename(activeFile) : 'workSphere Code'}</span>
        </button>

        {/* Window controls (Windows-style: minimize, maximize/restore, close) */}
        <div
          className="cw-winctrls"
          role="group"
          aria-label="Window controls"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="cw-winctrl cw-winctrl--min"
            title="Minimize"
            aria-label="Minimize"
            onClick={(e) => {
              e.stopPropagation()
              handleMinimize()
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
              <rect width="10" height="1" y="4.5" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="cw-winctrl cw-winctrl--max"
            title={isMaximized ? 'Restore' : 'Maximize'}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            onClick={(e) => {
              e.stopPropagation()
              handleToggleMaximize()
            }}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
                <path
                  d="M2.1 0v2H0v8h8V8h2V0H2.1zM7 9H1V3h6v6zm2-2H8V2H3V1h6v6z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
                <path d="M0 0v10h10V0H0zm9 9H1V1h8v8z" fill="currentColor" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="cw-winctrl cw-winctrl--close"
            title="Close"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation()
              handleClose()
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
              <path
                d="M5 4.293L1.354.646.646 1.354 4.293 5 .646 8.646l.708.708L5 5.707l3.646 3.647.708-.708L5.707 5l3.647-3.646-.708-.708L5 4.293z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="cw-body">
        {isMobile && sidebarVisible ? (
          <button
            type="button"
            className="cw-sidebar-backdrop"
            aria-label="Close sidebar"
            onClick={() => setSidebarVisible(false)}
          />
        ) : null}
        {/* Activity bar */}
        <nav className="cw-activity" aria-label="Activity bar">
          <div className="cw-activity-top">
            {ACTIVITY_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`cw-activity-btn${activeView === v.id && sidebarVisible ? ' is-on' : ''}`}
                onClick={() => {
                  if (activeView === v.id && sidebarVisible) setSidebarVisible(false)
                  else {
                    setActiveView(v.id)
                    setSidebarVisible(true)
                  }
                }}
                title={v.label}
                aria-label={v.label}
              >
                <Icon name={v.icon} />
              </button>
            ))}
          </div>
          <div className="cw-activity-bottom">
            {ACTIVITY_VIEWS_BOTTOM.map((v) => (
              <button
                key={v.id}
                type="button"
                className="cw-activity-btn"
                title={v.label}
                aria-label={v.label}
                onClick={() => {
                  if (v.id === 'settings') setPaletteOpen(true)
                }}
              >
                <Icon name={v.icon} />
              </button>
            ))}
          </div>
        </nav>

        {/* Sidebar */}
        {sidebarVisible ? (
          <aside className={`cw-sidebar${isMobile ? ' cw-sidebar--drawer' : ''}`}>
            {activeView === 'explorer' ? (
              <>
                <div className="cw-sidebar-head">
                  <span>Explorer</span>
                  <div className="cw-sidebar-actions">
                    <button
                      type="button"
                      title="New File... (Ctrl+N)"
                      aria-label="New file"
                      onClick={() => createFile('')}
                    >
                      <Icon name="newFile" size={18} />
                    </button>
                    <button
                      type="button"
                      title="New Folder..."
                      aria-label="New folder"
                      onClick={() => createFolder('')}
                    >
                      <Icon name="newFolder" size={18} />
                    </button>
                    <button
                      type="button"
                      title="Refresh Explorer"
                      aria-label="Refresh"
                      onClick={() => setFiles({ ...files })}
                    >
                      <Icon name="refresh" size={18} />
                    </button>
                    <button
                      type="button"
                      title="Collapse Folders in Explorer"
                      aria-label="Collapse all"
                      onClick={() => setExpanded({})}
                    >
                      <Icon name="collapse" size={18} />
                    </button>
                  </div>
                </div>
                <div className="cw-explorer-folder">
                  <span className="cw-explorer-folder-name">WORKSPHERE-CODE</span>
                </div>
                <div className="cw-tree">
                  {tree.children.map((node) => (
                    <TreeNode
                      key={node.path}
                      node={node}
                      depth={0}
                      activeFile={activeFile}
                      expanded={expanded}
                      onToggle={(p) => setExpanded((e) => ({ ...e, [p]: !(e[p] !== false) }))}
                      onSelect={openFile}
                      onContextMenu={handleContextMenu}
                      renamingPath={renamingPath}
                      renameDraft={renameDraft}
                      onRenameChange={setRenameDraft}
                      onRenameCommit={commitRename}
                      onRenameCancel={cancelRename}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {activeView === 'search' ? (
              <>
                <div className="cw-sidebar-head"><span>Search</span></div>
                <div className="cw-search-pane">
                  <input
                    className="cw-search-input"
                    placeholder="Search across files"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <p className="cw-search-meta">
                    {searchQuery.trim()
                      ? `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`
                      : 'Type to search'}
                  </p>
                  <ul className="cw-search-list">
                    {searchResults.map((r, i) => (
                      <li key={`${r.path}-${r.line}-${i}`}>
                        <button
                          type="button"
                          className="cw-search-hit"
                          onClick={() => openFile(r.path)}
                        >
                          <span className="cw-search-hit-path">
                            {r.path}
                            <span className="cw-search-hit-line">:{r.line}</span>
                          </span>
                          <span className="cw-search-hit-text">{r.text}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}

            {activeView === 'scm' ? (
              <>
                <div className="cw-sidebar-head">
                  <span>Source Control</span>
                  <div className="cw-sidebar-actions">
                    <button
                      type="button"
                      title="Refresh"
                      aria-label="Refresh"
                      onClick={() => setFiles({ ...files })}
                    >
                      <Icon name="refresh" size={18} />
                    </button>
                    <button
                      type="button"
                      title="More Actions..."
                      aria-label="More actions"
                      onClick={() => window.alert('Local-only workspace — commits are stored in localStorage.')}
                    >
                      <Icon name="more" size={18} />
                    </button>
                  </div>
                </div>
                <div className="cw-scm-pane">
                  <div className="cw-scm-input-wrap">
                    <input
                      className="cw-scm-input"
                      placeholder='Message (Ctrl+Enter to commit on "main")'
                    />
                    <button type="button" className="cw-scm-commit" disabled>
                      ✓ Commit
                    </button>
                  </div>
                  <div className="cw-scm-section">
                    <div className="cw-scm-section-head">
                      <Icon name="caretDown" size={12} />
                      <span>Changes</span>
                      <span className="cw-scm-count">{scmChanges.length}</span>
                    </div>
                    {scmChanges.length === 0 ? (
                      <p className="cw-scm-empty">No changes detected. Edit a file to see it here.</p>
                    ) : (
                      <ul className="cw-scm-list">
                        {scmChanges.map((p) => (
                          <li key={p}>
                            <button type="button" className="cw-scm-row" onClick={() => openFile(p)}>
                              <FileGlyph name={basename(p)} />
                              <span className="cw-scm-row-name">{basename(p)}</span>
                              <span className="cw-scm-row-path">{dirname(p) || '/'}</span>
                              <span className="cw-scm-row-tag">M</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            ) : null}

            {activeView === 'debug' ? (
              <>
                <div className="cw-sidebar-head"><span>Run and Debug</span></div>
                <div className="cw-run-pane">
                  <button
                    type="button"
                    className="cw-run-btn"
                    onClick={runCurrent}
                    disabled={!activeFile || isRunning}
                  >
                    {isRunning ? (
                      <>
                        <span className="cw-spinner" aria-hidden /> Running {runLanguage}...
                      </>
                    ) : (
                      <>
                        <Icon name="run" size={14} /> Run current file
                      </>
                    )}
                  </button>
                  <p className="cw-run-hint">
                    Runs in-browser: <code>.js</code> / <code>.ts</code> (sandboxed eval),{' '}
                    <code>.py</code> (Pyodide / WebAssembly CPython),{' '}
                    <code>.html</code> / <code>.md</code> / <code>.css</code> (live preview),{' '}
                    <code>.json</code> (validate &amp; pretty-print).
                  </p>
                  <div className="cw-run-section">
                    <span className="cw-run-section-title">Variables</span>
                    <p className="cw-run-section-empty">Not running.</p>
                  </div>
                  <div className="cw-run-section">
                    <span className="cw-run-section-title">Breakpoints</span>
                    <p className="cw-run-section-empty">No breakpoints.</p>
                  </div>
                </div>
              </>
            ) : null}

            {activeView === 'extensions' ? (
              <>
                <div className="cw-sidebar-head">
                  <span>Extensions</span>
                  <div className="cw-sidebar-actions">
                    <button
                      type="button"
                      title="Refresh"
                      aria-label="Refresh"
                      onClick={() => setExtQuery('')}
                    >
                      <Icon name="refresh" size={18} />
                    </button>
                    <button
                      type="button"
                      title="Views and More Actions..."
                      aria-label="More actions"
                      onClick={() => setPaletteOpen(true)}
                    >
                      <Icon name="more" size={18} />
                    </button>
                  </div>
                </div>
                <div className="cw-ext-pane">
                  <div className="cw-ext-searchwrap">
                    <input
                      className="cw-ext-search"
                      placeholder="Search Extensions in Marketplace"
                      value={extQuery}
                      onChange={(e) => setExtQuery(e.target.value)}
                    />
                  </div>

                  <div className="cw-ext-filters" role="tablist" aria-label="Extension filters">
                    {EXTENSION_CATEGORIES.map((c) => {
                      const count =
                        c.id === 'installed'
                          ? Object.values(extInstalled).filter(Boolean).length
                          : c.id === 'all'
                            ? EXTENSIONS.length
                            : EXTENSIONS.filter((e) =>
                                c.id === 'popular'
                                  ? e.popular
                                  : c.id === 'recommended'
                                    ? e.recommended
                                    : e.category === c.id,
                              ).length
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="tab"
                          aria-selected={extCategory === c.id}
                          className={`cw-ext-filter${extCategory === c.id ? ' is-on' : ''}`}
                          onClick={() => setExtCategory(c.id)}
                          title={c.label}
                        >
                          <span>{c.label}</span>
                          <span className="cw-ext-filter-count">{count}</span>
                        </button>
                      )
                    })}
                  </div>

                  {(() => {
                    const q = extQuery.trim().toLowerCase()
                    let list = EXTENSIONS.filter((e) => {
                      if (q && !`${e.name} ${e.publisher} ${e.desc}`.toLowerCase().includes(q))
                        return false
                      if (extCategory === 'all') return true
                      if (extCategory === 'installed') return !!extInstalled[e.id]
                      if (extCategory === 'popular') return !!e.popular
                      if (extCategory === 'recommended') return !!e.recommended
                      return e.category === extCategory
                    })
                    list = [...list].sort((a, b) => b.downloads - a.downloads)
                    if (list.length === 0) {
                      return (
                        <p className="cw-ext-empty">
                          No extensions match your search.{' '}
                          <button type="button" className="cw-ext-link" onClick={() => { setExtQuery(''); setExtCategory('all') }}>
                            Clear filters
                          </button>
                        </p>
                      )
                    }
                    const installedCount = list.filter((e) => extInstalled[e.id]).length
                    const showSplit = extCategory === 'all' && !q && installedCount > 0
                    const installed = showSplit ? list.filter((e) => extInstalled[e.id]) : []
                    const others = showSplit ? list.filter((e) => !extInstalled[e.id]) : list
                    const renderRow = (x) => (
                      <li key={x.id} className="cw-ext-row">
                        <div
                          className="cw-ext-icon"
                          style={{ background: extensionColor(x.category) }}
                        >
                          {x.short || x.name[0]}
                        </div>
                        <div className="cw-ext-body">
                          <div className="cw-ext-line">
                            <strong>{x.name}</strong>
                            {x.popular ? <span className="cw-ext-tag" title="Popular">★</span> : null}
                          </div>
                          <div className="cw-ext-meta">
                            <span className="cw-ext-publisher">
                              {x.publisher}
                              {x.verified ? <VerifiedBadge /> : null}
                            </span>
                            <Stars rating={x.rating} />
                            <span className="cw-ext-downloads" title="Downloads">
                              ↓ {formatDownloads(x.downloads)}
                            </span>
                          </div>
                          {x.desc ? <p className="cw-ext-desc">{x.desc}</p> : null}
                        </div>
                        <button
                          type="button"
                          className={`cw-ext-btn${extInstalled[x.id] ? ' is-installed' : ''}`}
                          onClick={() => setExtInstalled((p) => ({ ...p, [x.id]: !p[x.id] }))}
                          title={extInstalled[x.id] ? 'Uninstall' : 'Install'}
                        >
                          {extInstalled[x.id] ? 'Uninstall' : 'Install'}
                        </button>
                      </li>
                    )
                    return (
                      <ul className="cw-ext-list">
                        {showSplit ? (
                          <>
                            <li className="cw-ext-section-head">
                              INSTALLED — {installed.length}
                            </li>
                            {installed.map(renderRow)}
                            <li className="cw-ext-section-head">
                              POPULAR — {others.filter((e) => e.popular).length}
                            </li>
                            {others.map(renderRow)}
                          </>
                        ) : (
                          list.map(renderRow)
                        )}
                      </ul>
                    )
                  })()}
                </div>
              </>
            ) : null}
          </aside>
        ) : null}

        {/* Editor area */}
        <section className="cw-editor-area">
          {openTabs.length > 0 ? (
            <div className="cw-tabs" role="tablist" aria-label="Open files">
              {openTabs.map((path) => (
                <div
                  key={path}
                  className={`cw-tab${activeFile === path ? ' is-active' : ''}`}
                  onClick={() => setActiveFile(path)}
                  role="tab"
                  aria-selected={activeFile === path}
                >
                  <FileGlyph name={basename(path)} />
                  <span className="cw-tab-name">{basename(path)}</span>
                  <button
                    type="button"
                    className={`cw-tab-close${dirty[path] ? ' is-dirty' : ''}`}
                    onClick={(e) => closeTab(path, e)}
                    aria-label={`Close ${path}`}
                    title={dirty[path] ? 'Unsaved changes' : 'Close (Ctrl+W)'}
                  >
                    {dirty[path] ? <span className="cw-tab-dot" /> : <Icon name="close" size={14} />}
                  </button>
                </div>
              ))}
              <div className="cw-tabs-actions">
                <button
                  type="button"
                  className={`cw-tabs-btn cw-tabs-btn--run${isRunning ? ' is-running' : ''}`}
                  onClick={runCurrent}
                  title={isRunning ? `Running ${runLanguage}...` : 'Run (F5)'}
                  disabled={!activeFile || isRunning}
                >
                  {isRunning ? <span className="cw-spinner" aria-hidden /> : <Icon name="run" size={14} />}
                </button>
                <button
                  type="button"
                  className={`cw-tabs-btn${splitView ? ' is-on' : ''}`}
                  title={splitView ? 'Unsplit Editor' : 'Split Editor Right (Ctrl+\\)'}
                  aria-label={splitView ? 'Unsplit editor' : 'Split editor'}
                  onClick={() => setSplitView((v) => !v)}
                  disabled={!activeFile}
                >
                  <Icon name="split" size={14} />
                </button>
                <button
                  type="button"
                  className="cw-tabs-btn"
                  title="More Actions..."
                  aria-label="More actions"
                  onClick={() => setPaletteOpen(true)}
                >
                  <Icon name="more" size={14} />
                </button>
              </div>
            </div>
          ) : null}

          {activeFile ? (
            <div className="cw-breadcrumbs" aria-label="Breadcrumbs">
              {breadcrumb.map((seg, i) => (
                <span key={i} className="cw-breadcrumb">
                  {i > 0 ? <span className="cw-breadcrumb-sep" aria-hidden>›</span> : null}
                  <span className="cw-breadcrumb-name">{seg}</span>
                </span>
              ))}
            </div>
          ) : null}

          <div className={`cw-editor-wrap${splitView && activeFile ? ' is-split' : ''}`}>
            {activeFile ? (
              <>
                <div className="cw-editor-pane">
                  <Editor
                    key={activeFile}
                    height="100%"
                    language={currentLanguage}
                    value={currentValue}
                    theme={editorTheme}
                    onMount={handleEditorMount}
                    onChange={updateDraft}
                    options={{
                      fontSize,
                      minimap: { enabled: true },
                      wordWrap,
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      cursorBlinking: 'smooth',
                      bracketPairColorization: { enabled: true },
                      formatOnPaste: true,
                      formatOnType: true,
                      automaticLayout: true,
                      fontLigatures: true,
                      guides: { bracketPairs: true, indentation: true },
                      renderLineHighlight: 'all',
                    }}
                  />
                </div>
                {splitView ? (
                  <div className="cw-editor-pane cw-editor-pane--split">
                    <div className="cw-editor-pane-head">
                      <FileGlyph name={basename(activeFile)} />
                      <span className="cw-editor-pane-name">{basename(activeFile)}</span>
                      <button
                        type="button"
                        className="cw-editor-pane-close"
                        onClick={() => setSplitView(false)}
                        title="Close split"
                        aria-label="Close split editor"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                    <div className="cw-editor-pane-body">
                      <Editor
                        key={`split-${activeFile}`}
                        height="100%"
                        language={currentLanguage}
                        value={currentValue}
                        theme={editorTheme}
                        onChange={updateDraft}
                        options={{
                          fontSize,
                          minimap: { enabled: false },
                          wordWrap,
                          scrollBeyondLastLine: false,
                          smoothScrolling: true,
                          cursorBlinking: 'smooth',
                          bracketPairColorization: { enabled: true },
                          automaticLayout: true,
                          fontLigatures: true,
                          guides: { bracketPairs: true, indentation: true },
                          renderLineHighlight: 'all',
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <WelcomePage
                onNewFile={() => createFile('')}
                onOpenFile={() => {
                  setActiveView('explorer')
                  setSidebarVisible(true)
                }}
                onReset={() => {
                  if (window.confirm('Reset workspace? This deletes all your changes.')) {
                    const next = resetWorkspace()
                    setFiles(next)
                    setOpenTabs([])
                    setActiveFile('')
                    setDrafts({})
                    setDirty({})
                  }
                }}
                recents={recents}
                onOpenRecent={openFile}
              />
            )}
          </div>

          {/* Bottom panel */}
          {panelVisible ? (
            <div className="cw-panel">
              <div className="cw-panel-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  className={`cw-panel-tab${panelTab === 'problems' ? ' is-on' : ''}`}
                  onClick={() => setPanelTab('problems')}
                >
                  PROBLEMS
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`cw-panel-tab${panelTab === 'output' ? ' is-on' : ''}`}
                  onClick={() => setPanelTab('output')}
                >
                  OUTPUT
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`cw-panel-tab${panelTab === 'terminal' ? ' is-on' : ''}`}
                  onClick={() => setPanelTab('terminal')}
                >
                  TERMINAL
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`cw-panel-tab${panelTab === 'preview' ? ' is-on' : ''}`}
                  onClick={() => setPanelTab('preview')}
                >
                  PREVIEW
                </button>
                <div className="cw-panel-spacer" />
                <button
                  type="button"
                  className="cw-panel-clear"
                  onClick={() => {
                    if (panelTab === 'output') setOutput([])
                    if (panelTab === 'preview') setPreviewSrc('')
                  }}
                  title="Clear"
                >
                  <Icon name="close" size={12} />
                </button>
                <button
                  type="button"
                  className="cw-panel-clear"
                  onClick={() => setPanelVisible(false)}
                  title="Close Panel"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
              <div className="cw-panel-body">
                {panelTab === 'output' ? (
                  output.length === 0 ? (
                    <p className="cw-panel-empty">Run a file to see output here.</p>
                  ) : (
                    output.map((o) => (
                      <pre key={o.id} className={`cw-log cw-log--${o.kind}`}>
                        {o.line}
                      </pre>
                    ))
                  )
                ) : null}
                {panelTab === 'terminal' ? (
                  <pre className="cw-terminal">
{`workSphere Code Terminal — sandboxed in your browser.

khushi@worksphere:~/workspace$ ls
${tree.children.map((c) => (c.type === 'folder' ? `${c.name}/` : c.name)).join('   ')}
khushi@worksphere:~/workspace$ █`}
                  </pre>
                ) : null}
                {panelTab === 'preview' ? (
                  previewSrc ? (
                    <iframe
                      key={previewSrc}
                      className="cw-preview-frame"
                      title="Preview"
                      src={previewSrc}
                      sandbox="allow-scripts allow-forms allow-pointer-lock allow-popups allow-modals"
                    />
                  ) : (
                    <p className="cw-panel-empty">Run an HTML file to preview it here.</p>
                  )
                ) : null}
                {panelTab === 'problems' ? (
                  <p className="cw-panel-empty">No problems have been detected in the workspace.</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {/* Status bar */}
      <footer className="cw-statusbar" aria-label="Status bar">
        <div className="cw-status-left">
          <button type="button" className="cw-status-item cw-status-item--branch" title="main (Git not synced — local only)">
            <Icon name="branch" size={14} />
            <span>main*</span>
          </button>
          <button type="button" className="cw-status-item" title="Errors">
            <Icon name="error" size={14} />
            <span>0</span>
          </button>
          <button type="button" className="cw-status-item" title="Warnings">
            <Icon name="warning" size={14} />
            <span>0</span>
          </button>
          {dirtyCount > 0 ? (
            <span className="cw-status-item cw-status-item--dirty">
              {dirtyCount} unsaved
            </span>
          ) : null}
        </div>
        <div className="cw-status-spacer" />
        {activeFile ? (
          <div className="cw-status-right">
            <button type="button" className="cw-status-item" title="Go to Line">
              Ln {cursor.line}, Col {cursor.column}
            </button>
            <button type="button" className="cw-status-item" title="Indentation">
              Spaces: 2
            </button>
            <button type="button" className="cw-status-item" title="Encoding">UTF-8</button>
            <button type="button" className="cw-status-item" title="End of Line">LF</button>
            <button type="button" className="cw-status-item cw-status-item--lang" title="Select Language Mode">
              {currentLanguage}
            </button>
            <button type="button" className="cw-status-item" title="Notifications">
              <Icon name="feedback" size={14} />
            </button>
            <button
              type="button"
              className="cw-status-item cw-status-item--live"
              onClick={runCurrent}
              title="Go Live"
            >
              <Icon name="goLive" size={14} />
              <span>Go Live</span>
            </button>
          </div>
        ) : null}
      </footer>

      {/* Context menu */}
      {contextMenu ? (
        <div
          className="cw-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.type === 'folder' ? (
            <>
              <button onClick={() => { createFile(contextMenu.node.path); setContextMenu(null) }}>
                <Icon name="newFile" size={14} /> New File
              </button>
              <button onClick={() => { createFolder(contextMenu.node.path); setContextMenu(null) }}>
                <Icon name="newFolder" size={14} /> New Folder
              </button>
              {contextMenu.node.path ? (
                <>
                  <hr />
                  <button onClick={() => startRename(contextMenu.node.path)}>Rename</button>
                  <button
                    className="is-danger"
                    onClick={() => { deletePath(contextMenu.node.path, true); setContextMenu(null) }}
                  >
                    Delete
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <>
              <button onClick={() => { openFile(contextMenu.node.path); setContextMenu(null) }}>Open</button>
              <button onClick={() => startRename(contextMenu.node.path)}>Rename</button>
              <hr />
              <button
                className="is-danger"
                onClick={() => { deletePath(contextMenu.node.path, false); setContextMenu(null) }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      ) : null}

      {/* Command Palette */}
      {paletteOpen ? (
        <div className="cw-palette-overlay" onClick={() => setPaletteOpen(false)}>
          <div className="cw-palette" onClick={(e) => e.stopPropagation()}>
            <input
              className="cw-palette-input"
              placeholder="> Type a command..."
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && paletteCommands[0]) {
                  paletteCommands[0].run()
                  setPaletteOpen(false)
                  setPaletteQuery('')
                }
              }}
            />
            <ul className="cw-palette-list">
              {paletteCommands.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="cw-palette-item"
                    onClick={() => {
                      c.run()
                      setPaletteOpen(false)
                      setPaletteQuery('')
                    }}
                  >
                    <span>{c.label}</span>
                    {c.shortcut ? <kbd>{c.shortcut}</kbd> : null}
                  </button>
                </li>
              ))}
              {paletteCommands.length === 0 ? (
                <li className="cw-palette-empty">No commands match.</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </main>
  )
}
