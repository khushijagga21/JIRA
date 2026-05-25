import { useEffect, useMemo, useRef, useState } from 'react'

import { createPortal } from 'react-dom'

import { useLocation } from 'react-router-dom'

import workSphereLogo from '../assets/worksphere-logo.png'

import { assistantErrorMessage, requestAssistantReply } from '../utils/assistantApi.js'

import { getBotReply, getQuickTopics } from '../utils/chatbot.js'

import {

  CHAT_STORAGE_KEY,

  createInitialMessages,

  normalizeStoredMessages,

  toApiMessages,

} from '../utils/chatMessages.js'

import ChatMessageContent from './ChatMessageContent.jsx'



const MAX_IMAGE_BYTES = 2 * 1024 * 1024

const INTRO_STORAGE_KEY = 'worksphere_chat_intro_dismissed'



function loadStoredMessages() {

  try {

    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY)

    const parsed = raw ? JSON.parse(raw) : null

    const normalized = normalizeStoredMessages(parsed)

    if (normalized?.length) return normalized

  } catch {

    // ignore

  }

  try {

    const legacy = window.localStorage.getItem('worksphere_chat_messages')

    const normalized = normalizeStoredMessages(legacy ? JSON.parse(legacy) : null)

    if (normalized?.length) return normalized

  } catch {

    // ignore

  }

  return createInitialMessages()

}



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

  const [loading, setLoading] = useState(false)

  const [messages, setMessages] = useState(loadStoredMessages)



  const quickTopics = useMemo(() => getQuickTopics(), [])

  const listRef = useRef(null)

  const fileInputRef = useRef(null)

  const sendingRef = useRef(false)



  useEffect(() => {

    const slice = messages.slice(-40)

    try {

      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(slice))

    } catch {

      try {

        const withoutImages = slice.map((m) =>

          m.imageSrc

            ? { ...m, imageSrc: undefined, text: (m.text ?? '').trim() || '📷 Image (attachment cleared on save)' }

            : m,

        )

        window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(withoutImages))

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

  }, [open, messages.length, loading])



  async function requestReply(nextMessages, lastUserText) {

    const apiMessages = toApiMessages(nextMessages)

    if (!apiMessages.length) {

      return 'I didn’t catch your message—please type a question and press Send.'

    }



    setLoading(true)

    try {

      return await requestAssistantReply(apiMessages)

    } catch (err) {

      const apiErr = assistantErrorMessage(err)

      if (lastUserText) {

        const local = getBotReply(lastUserText)

        if (local && !/try asking one of these/i.test(local)) {

          return `${apiErr}\n\n---\n\n**Meanwhile, here’s guidance from workSphere:**\n\n${local}`

        }

      }

      return apiErr

    } finally {

      setLoading(false)

    }

  }



  async function send(text) {

    const trimmed = String(text ?? '').trim()

    if (!trimmed || loading || sendingRef.current) return



    sendingRef.current = true

    const now = Date.now()

    const userMsg = {

      id: globalThis.crypto?.randomUUID?.() ?? `u-${now}`,

      role: 'user',

      text: trimmed,

      ts: now,

    }



    const historyWithUser = [...messages, userMsg]

    setMessages(historyWithUser)

    setInput('')



    try {

      const reply = await requestReply(historyWithUser, trimmed)

      const botMsg = {

        id: globalThis.crypto?.randomUUID?.() ?? `b-${now}`,

        role: 'bot',

        text: reply,

        ts: Date.now(),

      }

      setMessages((m) => [...m, botMsg])

    } finally {

      sendingRef.current = false

    }

  }



  function onSubmit(e) {

    e.preventDefault()

    void send(input)

  }



  function onInputKeyDown(e) {

    if (e.key !== 'Enter' || e.shiftKey) return

    e.preventDefault()

    if (!input.trim() || loading) return

    void send(input)

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

    setLoading(false)

    sendingRef.current = false

    try {

      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next))

      window.localStorage.removeItem('worksphere_chat_messages')

    } catch {

      // ignore

    }

  }



  async function onPickImage(e) {

    const file = e.target.files?.[0]

    e.target.value = ''

    if (!file || !file.type.startsWith('image/') || loading || sendingRef.current) return

    if (file.size > MAX_IMAGE_BYTES) {

      window.alert('Please choose an image under 2 MB.')

      return

    }



    sendingRef.current = true

    const reader = new FileReader()

    reader.onload = () => {

      void (async () => {

        const dataUrl = typeof reader.result === 'string' ? reader.result : ''

        if (!dataUrl) {

          sendingRef.current = false

          return

        }

        const caption = input.trim()

        const now = Date.now()

        const userMsg = {

          id: globalThis.crypto?.randomUUID?.() ?? `u-${now}`,

          role: 'user',

          text: caption || 'What is in this image?',

          imageSrc: dataUrl,

          ts: now,

        }

        const historyWithUser = [...messages, userMsg]

        setMessages(historyWithUser)

        setInput('')



        try {

          const reply = await requestReply(historyWithUser, userMsg.text)

          const botMsg = {

            id: globalThis.crypto?.randomUUID?.() ?? `b-${now}`,

            role: 'bot',

            text: reply,

            ts: Date.now(),

          }

          setMessages((m) => [...m, botMsg])

        } finally {

          sendingRef.current = false

        }

      })()

    }

    reader.readAsDataURL(file)

  }



  const visibleMessages = messages.filter(

    (m) => m.isWelcome || (m.text ?? '').trim() || m.imageSrc,

  )



  const showIntroBubble = showIntro && !open && !isAuthPage



  const widget = (
    <div
      className={`cb-root${open ? ' cb-root--open' : ''}${isAuthPage ? ' cb-root--auth' : ''}`}
      id="tour-chatbot"
      aria-live="polite"
    >
      {open ? (
        <section className="cb-panel" aria-label="workSphere AI assistant">
          <header className="cb-header">
            <div className="cb-brand" aria-hidden="true">
              <img className="cb-logo" src={workSphereLogo} alt="" />
              <div className="cb-title">
                <div className="cb-title-main">workSphere assistant</div>
                <div className="cb-title-sub">Project management · workSphere · ask anything</div>
              </div>
            </div>
            <div className="cb-header-actions">
              <button
                className="cb-new-chat"
                type="button"
                onClick={startNewChat}
                disabled={loading}
                aria-label="Start new chat"
              >
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
                disabled={loading}
                onClick={() => void send(t.prompts[0])}
              >
                {t.title}
              </button>
            ))}
          </div>

          <div className="cb-list" ref={listRef}>
            {visibleMessages.map((m) => (
              <div key={m.id} className={`cb-msg ${m.role}`}>
                <div className="cb-bubble">
                  {m.imageSrc ? (
                    <img className="cb-msg-img" src={m.imageSrc} alt="Attachment shared in chat" />
                  ) : null}
                  {(m.text ?? '').trim() ? <ChatMessageContent text={m.text} /> : null}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="cb-msg bot">
                <div className="cb-bubble cb-bubble--typing" aria-live="polite">
                  <span className="cb-typing-dot" />
                  <span className="cb-typing-dot" />
                  <span className="cb-typing-dot" />
                  <span className="cb-typing-label">Thinking…</span>
                </div>
              </div>
            ) : null}
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
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload image"
              title="Upload image (AI vision)"
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
            <textarea
              className="cb-input cb-textarea"
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKeyDown}
              disabled={loading}
              placeholder="Ask about project management, workSphere, or anything…"
              aria-label="Chat message"
            />
            <button className="cb-send" type="submit" disabled={loading || !input.trim()}>
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
              AI assistant
            </p>
            <p className="cb-intro-text">
              Ask about <strong>project management</strong>, <strong>workSphere</strong>, or{' '}
              <strong>anything</strong>—powered by OpenAI.
            </p>
            <div className="cb-intro-pointer" aria-hidden="true" />
          </div>
        ) : null}
        <button
          className="cb-fab"
          type="button"
          onClick={toggleChat}
          aria-label={open ? 'Close assistant' : 'Open AI assistant'}
          aria-describedby={showIntroBubble ? 'cb-intro-heading' : undefined}
        >
          <img className="cb-fab-logo" src={workSphereLogo} alt="" />
        </button>
      </div>
    </div>
  )

  return createPortal(widget, document.body)
}
