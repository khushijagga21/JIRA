const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite'

let segmenterPromise = null
let segmenterInstance = null

async function createSegmenter(delegate) {
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
  return ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate,
    },
    runningMode: 'VIDEO',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  })
}

/** Preload ML model (call from lobby / meet page). */
export function preloadMeetSegmenter() {
  if (segmenterInstance) return Promise.resolve(segmenterInstance)
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      try {
        segmenterInstance = await createSegmenter('GPU')
      } catch {
        segmenterInstance = await createSegmenter('CPU')
      }
      return segmenterInstance
    })().catch((err) => {
      segmenterPromise = null
      throw err
    })
  }
  return segmenterPromise
}

export async function getMeetSegmenter() {
  return preloadMeetSegmenter()
}
