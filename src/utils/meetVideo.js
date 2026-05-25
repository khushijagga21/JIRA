import { isMobileMeetDevice } from './meetDevice.js'

export const MEET_OUTPUT_WIDTH = 1280
export const MEET_OUTPUT_HEIGHT = 720

export const MEET_CAMERA_AUDIO = true

/**
 * Prefer the camera’s native field of view — no aspectRatio (that crops/zooms on many laptops).
 */
export const MEET_CAMERA_VIDEO = {
  facingMode: 'user',
  width: { ideal: 640, max: 1280 },
  height: { ideal: 480, max: 720 },
}

export async function getMeetUserMedia() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera and microphone are not supported in this browser.')
  }

  const attempts = isMobileMeetDevice()
    ? [
        { audio: true, video: { facingMode: 'user' } },
        { audio: true, video: true },
        { audio: true, video: false },
        { audio: false, video: { facingMode: 'user' } },
      ]
    : [
        { audio: MEET_CAMERA_AUDIO, video: MEET_CAMERA_VIDEO },
        { audio: true, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } },
        { audio: true, video: true },
        { audio: false, video: MEET_CAMERA_VIDEO },
        { audio: true, video: false },
      ]

  let lastError
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('Could not access camera or microphone.')
}

function streamHasLiveTracks(stream) {
  return Boolean(stream?.getTracks?.().some((t) => t.readyState === 'live'))
}

/** Delays between getUserMedia attempts (device busy after tab switch / another app / strict-mode remount). */
const MEET_MEDIA_RETRY_DELAYS_MS = [0, 120, 350, 700, 1200]

/** Prefer an existing stream; otherwise open camera/mic with retries (device may still be releasing). */
export async function acquireMeetMediaStream(existingStream) {
  if (streamHasLiveTracks(existingStream)) return existingStream

  let lastError
  for (const ms of MEET_MEDIA_RETRY_DELAYS_MS) {
    if (ms > 0) await new Promise((r) => window.setTimeout(r, ms))
    try {
      return await getMeetUserMedia()
    } catch (err) {
      lastError = err
      if (err?.name === 'NotAllowedError') throw err
    }
  }
  throw lastError ?? new Error('Could not access camera or microphone.')
}

export const MEET_BACKGROUNDS = [
  { id: 'none', label: 'None', swatch: 'linear-gradient(135deg,#334155,#1e293b)' },
  { id: 'blur', label: 'Blur', swatch: 'linear-gradient(135deg,#64748b,#94a3b8)' },
  { id: 'sky', label: 'Sky', gradient: ['#0369a1', '#7dd3fc'] },
  { id: 'office', label: 'Office', gradient: ['#1e293b', '#94a3b8'] },
  { id: 'nature', label: 'Nature', gradient: ['#14532d', '#86efac'] },
  { id: 'studio', label: 'Studio', gradient: ['#4c1d95', '#c4b5fd'] },
]

const BG_STORAGE_KEY = 'worksphere_meet_background'

export function loadMeetBackground() {
  try {
    const id = localStorage.getItem(BG_STORAGE_KEY)
    if (MEET_BACKGROUNDS.some((b) => b.id === id)) return id
  } catch {
    /* ignore */
  }
  return 'none'
}

export function saveMeetBackground(id) {
  try {
    localStorage.setItem(BG_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}
