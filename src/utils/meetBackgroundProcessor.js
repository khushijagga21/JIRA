import { getMeetSceneBackground } from './meetBackgroundArt.js'
import { MEET_BACKGROUNDS, MEET_OUTPUT_HEIGHT, MEET_OUTPUT_WIDTH } from './meetVideo.js'
import { getMeetSegmenter } from './meetSegmenter.js'

const PERSON_THRESHOLD = 0.42
const MASK_SCALE = 0.25

function getBackgroundSpec(id) {
  return MEET_BACKGROUNDS.find((b) => b.id === id) || MEET_BACKGROUNDS[0]
}

function drawImageCover(ctx, source, dw, dh) {
  const sw = source.videoWidth || source.width || dw
  const sh = source.videoHeight || source.height || dh
  if (!sw || !sh) return
  const scale = Math.max(dw / sw, dh / sh)
  const nw = sw * scale
  const nh = sh * scale
  ctx.drawImage(source, (dw - nw) / 2, (dh - nh) / 2, nw, nh)
}

function getContainRect(vw, vh, outW, outH) {
  const scale = Math.min(outW / vw, outH / vh)
  const w = vw * scale
  const h = vh * scale
  return {
    x: (outW - w) / 2,
    y: (outH - h) / 2,
    w,
    h,
    vw,
    vh,
  }
}

function drawGradientBackground(ctx, w, h, colors) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, colors[0])
  g.addColorStop(1, colors[1] ?? colors[0])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function featherAlpha(data, w, h) {
  const out = new Uint8ClampedArray(data.length)
  out.set(data)
  const passes = 2
  for (let p = 0; p < passes; p += 1) {
    const src = new Uint8ClampedArray(out)
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        let sum = 0
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            sum += src[((y + dy) * w + (x + dx)) * 4 + 3]
          }
        }
        out[(y * w + x) * 4 + 3] = sum / 9
      }
    }
  }
  return out
}

/**
 * Google Meet–style virtual backgrounds: segmented person over blur/scene.
 */
export class MeetBackgroundProcessor {
  constructor() {
    this.bgId = 'none'
    this.running = false
    this.segmenter = null
    this.segmenterFailed = false
    this.video = null
    this.canvas = null
    this.ctx = null
    this.outputStream = null
    this.sourceStream = null
    this.rafId = 0
    this.frameTs = 0
    this.bgCanvas = null
    this.bgCtx = null
    this.personCanvas = null
    this.personCtx = null
    this.maskCanvas = null
    this.maskCtx = null
    this._lowMask = null
  }

  get isActive() {
    return this.running
  }

  async ensureSegmenter() {
    if (this.segmenter || this.segmenterFailed) return
    try {
      this.segmenter = await getMeetSegmenter()
    } catch {
      this.segmenterFailed = true
    }
  }

  ensureBuffers(outW, outH) {
    if (!this.bgCanvas) {
      this.bgCanvas = document.createElement('canvas')
      this.bgCtx = this.bgCanvas.getContext('2d')
      this.personCanvas = document.createElement('canvas')
      this.personCtx = this.personCanvas.getContext('2d')
      this.maskCanvas = document.createElement('canvas')
      this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true })
    }
    if (this.canvas.width !== outW || this.canvas.height !== outH) {
      this.canvas.width = outW
      this.canvas.height = outH
      this.bgCanvas.width = outW
      this.bgCanvas.height = outH
      this.personCanvas.width = outW
      this.personCanvas.height = outH
    }
  }

  setBackgroundId(backgroundId) {
    this.bgId = backgroundId || 'none'
  }

  async start(sourceStream, backgroundId) {
    this.stop()
    this.sourceStream = sourceStream
    this.bgId = backgroundId || 'none'
    this.frameTs = 0

    if (!sourceStream || this.bgId === 'none') {
      this.outputStream = sourceStream
      return sourceStream
    }

    await this.ensureSegmenter()

    const video = document.createElement('video')
    video.playsInline = true
    video.muted = true
    video.srcObject = sourceStream
    await video.play()
    this.video = video

    this.canvas = document.createElement('canvas')
    this.canvas.width = MEET_OUTPUT_WIDTH
    this.canvas.height = MEET_OUTPUT_HEIGHT
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    this.ensureBuffers(MEET_OUTPUT_WIDTH, MEET_OUTPUT_HEIGHT)

    this.outputStream = this.canvas.captureStream(30)
    this.running = true
    this.tick()
    return this.outputStream
  }

  stop() {
    this.running = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
    if (this.outputStream && this.outputStream !== this.sourceStream) {
      for (const t of this.outputStream.getTracks()) t.stop()
    }
    this.outputStream = null
    if (this.video) {
      this.video.srcObject = null
      this.video = null
    }
    this.canvas = null
    this.ctx = null
    this.frameTs = 0
  }

  drawVideoBackground(video, spec, outW, outH) {
    const { bgCtx } = this
    bgCtx.clearRect(0, 0, outW, outH)

    if (spec.id === 'blur') {
      bgCtx.filter = 'blur(28px) saturate(1.05)'
      drawImageCover(bgCtx, video, outW, outH)
      bgCtx.filter = 'none'
      return
    }

    const scene = getMeetSceneBackground(spec.id, outW, outH)
    if (scene) {
      drawImageCover(bgCtx, scene, outW, outH)
      return
    }

    if (spec.gradient) {
      drawGradientBackground(bgCtx, outW, outH, spec.gradient)
    }
  }

  buildPersonMask(mask, rect, outW, outH) {
    const mw = mask.width
    const mh = mask.height
    const sw = Math.max(8, Math.floor(rect.w * MASK_SCALE))
    const sh = Math.max(8, Math.floor(rect.h * MASK_SCALE))
    if (!this._lowMask || this._lowMask.length < sw * sh * 4) {
      this._lowMask = new Uint8ClampedArray(sw * sh * 4)
    }
    const low = this._lowMask

    const floats =
      typeof mask.getAsFloat32Array === 'function' ? mask.getAsFloat32Array() : null
    const bytes = !floats && typeof mask.getAsUint8Array === 'function' ? mask.getAsUint8Array() : null

    for (let ly = 0; ly < sh; ly += 1) {
      for (let lx = 0; lx < sw; lx += 1) {
        const px = rect.x + (lx / sw) * rect.w
        const py = rect.y + (ly / sh) * rect.h
        const vx = Math.min(rect.vw - 1, Math.max(0, ((px - rect.x) / rect.w) * rect.vw))
        const vy = Math.min(rect.vh - 1, Math.max(0, ((py - rect.y) / rect.h) * rect.vh))
        const mx = Math.min(mw - 1, Math.floor((vx / rect.vw) * mw))
        const my = Math.min(mh - 1, Math.floor((vy / rect.vh) * mh))
        let alpha = 0
        if (floats) {
          alpha = floats[my * mw + mx] >= PERSON_THRESHOLD ? 255 : 0
        } else if (bytes) {
          alpha = bytes[my * mw + mx] > 0 ? 255 : 0
        }
        const j = (ly * sw + lx) * 4
        low[j] = 255
        low[j + 1] = 255
        low[j + 2] = 255
        low[j + 3] = alpha
      }
    }

    const feathered = featherAlpha(low, sw, sh)
    this.maskCanvas.width = sw
    this.maskCanvas.height = sh
    const img = this.maskCtx.createImageData(sw, sh)
    img.data.set(feathered)
    this.maskCtx.putImageData(img, 0, 0)
    return { sw, sh }
  }

  drawSegmentedPerson(video, mask, outW, outH) {
    const vw = video.videoWidth
    const vh = video.videoHeight
    const rect = getContainRect(vw, vh, outW, outH)
    const { personCtx } = this

    personCtx.clearRect(0, 0, outW, outH)
    personCtx.drawImage(video, rect.x, rect.y, rect.w, rect.h)

    const { sw, sh } = this.buildPersonMask(mask, rect, outW, outH)
    personCtx.globalCompositeOperation = 'destination-in'
    personCtx.imageSmoothingEnabled = true
    personCtx.drawImage(this.maskCanvas, 0, 0, sw, sh, rect.x, rect.y, rect.w, rect.h)
    personCtx.globalCompositeOperation = 'source-over'
  }

  drawFrame(video, spec, outW, outH) {
    const { ctx } = this
    this.drawVideoBackground(video, spec, outW, outH)
    ctx.clearRect(0, 0, outW, outH)
    ctx.drawImage(this.bgCanvas, 0, 0, outW, outH)

    if (this.segmenter && !this.segmenterFailed) {
      this.frameTs += 33
      const result = this.segmenter.segmentForVideo(video, this.frameTs)
      const mask = result?.confidenceMasks?.[0]
      if (mask) {
        this.drawSegmentedPerson(video, mask, outW, outH)
        ctx.drawImage(this.personCanvas, 0, 0, outW, outH)
        mask.close?.()
        return
      }
    }

    this.drawSoftPortrait(video, spec, outW, outH)
  }

  drawSoftPortrait(video, spec, outW, outH) {
    const { ctx } = this
    const vw = video.videoWidth
    const vh = video.videoHeight
    const rect = getContainRect(vw, vh, outW, outH)
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h * 0.42
    const radius = Math.min(rect.w, rect.h) * 0.48

    this.drawVideoBackground(video, spec, outW, outH)
    ctx.drawImage(this.bgCanvas, 0, 0, outW, outH)

    ctx.save()
    const vignette = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius)
    vignette.addColorStop(0, 'rgba(255,255,255,1)')
    vignette.addColorStop(0.7, 'rgba(255,255,255,0.88)')
    vignette.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = vignette
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    ctx.globalCompositeOperation = 'source-in'
    ctx.drawImage(video, rect.x, rect.y, rect.w, rect.h)
    ctx.restore()
  }

  tick = () => {
    if (!this.running || !this.video || !this.ctx) return
    const { video, ctx, canvas } = this
    if (video.readyState < 2) {
      this.rafId = requestAnimationFrame(this.tick)
      return
    }

    const outW = MEET_OUTPUT_WIDTH
    const outH = MEET_OUTPUT_HEIGHT
    this.ensureBuffers(outW, outH)

    const spec = getBackgroundSpec(this.bgId)
    const videoTrack = this.sourceStream?.getVideoTracks()[0]
    if (videoTrack && !videoTrack.enabled) {
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, outW, outH)
      this.rafId = requestAnimationFrame(this.tick)
      return
    }

    this.drawFrame(video, spec, outW, outH)
    this.rafId = requestAnimationFrame(this.tick)
  }
}
