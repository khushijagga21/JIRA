const sceneCache = new Map()

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function drawSkyScene(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#0284c7')
  g.addColorStop(0.55, '#38bdf8')
  g.addColorStop(1, '#bae6fd')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (let i = 0; i < 5; i += 1) {
    const x = (w * (0.12 + i * 0.18)) % w
    const y = h * (0.12 + (i % 3) * 0.08)
    ctx.beginPath()
    ctx.ellipse(x, y, w * 0.09, h * 0.04, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawOfficeScene(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#cbd5e1')
  g.addColorStop(1, '#64748b')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#94a3b8'
  ctx.fillRect(0, h * 0.72, w, h * 0.28)
  ctx.fillStyle = '#475569'
  for (let i = 0; i < 6; i += 1) {
    const x = w * (0.06 + i * 0.16)
    ctx.fillRect(x, h * 0.2, w * 0.1, h * 0.52)
    ctx.fillStyle = 'rgba(191,219,254,0.55)'
    ctx.fillRect(x + w * 0.015, h * 0.26, w * 0.07, h * 0.2)
    ctx.fillStyle = '#475569'
  }
}

function drawNatureScene(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#7dd3fc')
  g.addColorStop(0.45, '#86efac')
  g.addColorStop(1, '#166534')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#15803d'
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.92, w * 0.75, h * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 8; i += 1) {
    const x = w * (0.08 + i * 0.11)
    ctx.fillStyle = i % 2 ? '#166534' : '#14532d'
    ctx.beginPath()
    ctx.moveTo(x, h * 0.9)
    ctx.lineTo(x + w * 0.04, h * 0.45)
    ctx.lineTo(x + w * 0.08, h * 0.9)
    ctx.closePath()
    ctx.fill()
  }
}

function drawStudioScene(ctx, w, h) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.35, w * 0.05, w * 0.5, h * 0.5, w * 0.85)
  g.addColorStop(0, '#ddd6fe')
  g.addColorStop(0.45, '#8b5cf6')
  g.addColorStop(1, '#312e81')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(0, h * 0.78, w, h * 0.22)
}

const SCENE_DRAWERS = {
  sky: drawSkyScene,
  office: drawOfficeScene,
  nature: drawNatureScene,
  studio: drawStudioScene,
}

/** Scene images used as the *video* background (behind the person). */
export function getMeetSceneBackground(id, w = 1280, h = 720) {
  const key = `${id}-${w}x${h}`
  if (sceneCache.has(key)) return sceneCache.get(key)
  const drawer = SCENE_DRAWERS[id]
  if (!drawer) return null
  const canvas = makeCanvas(w, h)
  drawer(canvas.getContext('2d'), w, h)
  sceneCache.set(key, canvas)
  return canvas
}
