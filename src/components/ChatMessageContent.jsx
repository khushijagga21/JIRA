/** Lightweight markdown for assistant replies (ChatGPT-style). */
export default function ChatMessageContent({ text }) {
  const raw = String(text ?? '')
  if (!raw.trim()) return null

  const blocks = raw.split(/```/)
  return blocks.map((block, i) => {
    const isCode = i % 2 === 1
    if (isCode) {
      const firstLineBreak = block.indexOf('\n')
      const lang = firstLineBreak > 0 ? block.slice(0, firstLineBreak).trim() : ''
      const code = firstLineBreak > 0 ? block.slice(firstLineBreak + 1) : block
      return (
        <pre key={i} className="cb-code">
          {lang ? <span className="cb-code-lang">{lang}</span> : null}
          <code>{code.replace(/\n$/, '')}</code>
        </pre>
      )
    }
    return (
      <div key={i} className="cb-prose">
        {block.split('\n').map((line, j) => {
          const trimmed = line.trim()
          if (!trimmed) return <br key={j} />
          if (/^[-*•]\s+/.test(trimmed)) {
            return (
              <div key={j} className="cb-li">
                {formatInline(trimmed.replace(/^[-*•]\s+/, ''))}
              </div>
            )
          }
          if (/^\d+\.\s+/.test(trimmed)) {
            return (
              <div key={j} className="cb-li cb-li--num">
                {formatInline(trimmed.replace(/^\d+\.\s+/, ''))}
              </div>
            )
          }
          return (
            <p key={j} className="cb-p">
              {formatInline(line)}
            </p>
          )
        })}
      </div>
    )
  })
}

function formatInline(line) {
  const segments = []
  let rest = line
  while (rest.includes('**')) {
    const start = rest.indexOf('**')
    const end = rest.indexOf('**', start + 2)
    if (end === -1) break
    if (rest.slice(0, start)) segments.push(rest.slice(0, start))
    segments.push({ bold: true, t: rest.slice(start + 2, end) })
    rest = rest.slice(end + 2)
  }
  if (rest) segments.push(rest)

  return segments.map((s, i) =>
    typeof s === 'string' ? <span key={i}>{s}</span> : <strong key={i}>{s.t}</strong>,
  )
}
