import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import workSphereLogo from '../assets/worksphere-logo.png'
import { getBotReply, getBotReplyForImage, getQuickTopics } from '../utils/chatbot.js'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024

function createInitialMessages() {
  return [
    {
      id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
      role: 'bot',
      text: 'Hi! I’m the workSphere assistant. Ask me about workflows, tickets, reporting, or how to use this site.',
      ts: Date.now(),
    },
  ]
}

function appendChatExchange(setMessages, rawText, replyFn) {
  const trimmed = String(rawText ?? '').trim()
  if (!trimmed) return
  const now = Date.now()
  const userMsg = {
    id: globalThis.crypto?.randomUUID?.() ?? `u-${now}-${Math.random()}`,
    role: 'user',
    text: trimmed,
    ts: now,
  }
  const botMsg = {
    id: globalThis.crypto?.randomUUID?.() ?? `b-${now}-${Math.random()}`,
    role: 'bot',
    text: replyFn(trimmed),
    ts: now + 1,
  }
  setMessages((m) => [...m, userMsg, botMsg])
}

function appendImageExchange(setMessages, imageSrc, caption) {
  const trimmed = String(caption ?? '').trim()
  const now = Date.now()
  const userMsg = {
    id: globalThis.crypto?.randomUUID?.() ?? `u-${now}-${Math.random()}`,
    role: 'user',
    text: trimmed,
    imageSrc,
    ts: now,
  }
  const botMsg = {
    id: globalThis.crypto?.randomUUID?.() ?? `b-${now}-${Math.random()}`,
    role: 'bot',
    text: getBotReplyForImage(trimmed),
    ts: now + 1,
  }
  setMessages((m) => [...m, userMsg, botMsg])
}

function formatMarkdownLite(text) {
  // Minimal formatting: **bold** and newlines → <br/>
  const parts = String(text ?? '').split('\n')
  return parts.map((line, idx) => {
    const segments = []
    let rest = line
    while (rest.includes('**')) {
      const start = rest.indexOf('**')
      const end = rest.indexOf('**', start + 2)
      if (end === -1) break
      const before = rest.slice(0, start)
      const bold = rest.slice(start + 2, end)
      if (before) segments.push({ t: 'text', v: before })
      segments.push({ t: 'bold', v: bold })
      rest = rest.slice(end + 2)
    }
    if (rest) segments.push({ t: 'text', v: rest })

    return (
      <div key={idx} className="cb-line">
        {segments.map((s, i) =>
          s.t === 'bold' ? <strong key={i}>{s.v}</strong> : <span key={i}>{s.v}</span>,
        )}
      </div>
    )
  })
}

const INTRO_STORAGE_KEY = 'worksphere_chat_intro_dismissed'

export default function ChatbotWidget() {
  const { pathname } = useLocation()
  const isAuthPage = pathname === '/login' || pathname === '/signup'

  const [open, setOpen] = useState(false)
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return !window.localStorage.getItem(INTRO_STORAGE_KEY)
    } catch {
      return true
    }
  })
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(() => {
    try {
      const raw = window.localStorage.getItem('worksphere_chat_messages')
      const parsed = raw ? JSON.parse(raw) : null
      if (Array.isArray(parsed) && parsed.length) return parsed
    } catch {
      // ignore
    }
    return createInitialMessages()
  })

  const quickTopics = useMemo(() => getQuickTopics(), [])
  const listRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const slice = messages.slice(-60)
    try {
      window.localStorage.setItem('worksphere_chat_messages', JSON.stringify(slice))
    } catch {
      try {
        const withoutImages = slice.map((m) =>
          m.imageSrc
            ? { ...m, imageSrc: undefined, text: (m.text ?? '').trim() || '📷 Image (reload cleared attachment)' }
            : m,
        )
        window.localStorage.setItem('worksphere_chat_messages', JSON.stringify(withoutImages))
      } catch {
        // ignore
      }
    }
  }, [messages])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    }, 40)
    return () => clearTimeout(t)
  }, [open, messages.length])

  function send(text) {
    appendChatExchange(setMessages, text, getBotReply)
    setInput('')
  }

  function onSubmit(e) {
    e.preventDefault()
    send(input)
  }

  function dismissIntro() {
    setShowIntro(false)
    try {
      window.localStorage.setItem(INTRO_STORAGE_KEY, '1')
    } catch {
      // ignore
    }
  }

  function toggleChat() {
    setOpen((v) => {
      const next = !v
      if (next) dismissIntro()
      return next
    })
  }

  function startNewChat() {
    const next = createInitialMessages()
    setMessages(next)
    setInput('')
    try {
      window.localStorage.setItem('worksphere_chat_messages', JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  function onPickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert('Please choose an image under 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) return
      appendImageExchange(setMessages, dataUrl, input)
      setInput('')
    }
    reader.readAsDataURL(file)
  }

  const showIntroBubble = showIntro && !open && !isAuthPage

  const widget = (
    <div
      className={`cb-root${isAuthPage ? ' cb-root--auth' : ''}`}
      id="tour-chatbot"
      aria-live="polite"
    >
      {open ? (
        <section className="cb-panel" aria-label="workSphere chatbot">
          <header className="cb-header">
            <div className="cb-brand" aria-hidden="true">
              <img className="cb-logo" src={workSphereLogo} alt="" />
              <div className="cb-title">
                <div className="cb-title-main">workSphere assistant</div>
                <div className="cb-title-sub">Workflow & site help</div>
              </div>
            </div>
            <div className="cb-header-actions">
              <button className="cb-new-chat" type="button" onClick={startNewChat} aria-label="Start new chat">
                New chat
              </button>
              <button className="cb-icon" type="button" onClick={() => setOpen(false)} aria-label="Close chat">
                ×
              </button>
            </div>
          </header>

          <div className="cb-quick">
            {quickTopics.slice(0, 4).map((t) => (
              <button
                key={t.id}
                type="button"
                className="cb-chip"
                onClick={() => send(t.prompts[0])}
              >
                {t.title}
              </button>
            ))}
          </div>

          <div className="cb-list" ref={listRef}>
            {messages.map((m) => (
              <div key={m.id} className={`cb-msg ${m.role}`}>
                <div className="cb-bubble">
                  {m.imageSrc ? (
                    <img className="cb-msg-img" src={m.imageSrc} alt="Attachment shared in chat" />
                  ) : null}
                  {(m.text ?? '').trim() ? formatMarkdownLite(m.text) : null}
                </div>
              </div>
            ))}
          </div>

          <form className="cb-form" onSubmit={onSubmit}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="cb-file-input"
              aria-hidden="true"
              tabIndex={-1}
              onChange={onPickImage}
            />
            <button
              className="cb-attach"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload image"
              title="Upload image"
            >
              <span className="cb-attach-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M21 15v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3M17 8l-5-5-5 5M12 3v12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
            <input
              className="cb-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about workflow, tasks, reporting..."
              aria-label="Chat message"
            />
            <button className="cb-send" type="submit">
              Send
            </button>
          </form>
        </section>
      ) : null}

      <div className="cb-fab-stack">
        {showIntroBubble ? (
          <div
            className="cb-intro"
            role="dialog"
            aria-modal="false"
            aria-labelledby="cb-intro-heading"
          >
            <button
              type="button"
              className="cb-intro-close"
              onClick={dismissIntro}
              aria-label="Dismiss chatbot hint"
            >
              ×
            </button>
            <p id="cb-intro-heading" className="cb-intro-title">
              Your chatbot assistant
            </p>
            <p className="cb-intro-text">
              Tap this button anytime to open the <strong>workSphere assistant</strong>—ask about
              workflows, tickets, reporting, or how to use this site.
            </p>
            <div className="cb-intro-pointer" aria-hidden="true" />
          </div>
        ) : null}
        <button
          className="cb-fab"
          type="button"
          onClick={toggleChat}
          aria-label={open ? 'Close chatbot' : 'Open chatbot'}
          aria-describedby={showIntroBubble ? 'cb-intro-heading' : undefined}
        >
          <img className="cb-fab-logo" src={workSphereLogo} alt="" />
        </button>
      </div>
    </div>
  )

  return createPortal(widget, document.body)
}

