export function isMobileMeetDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
}

/** Virtual backgrounds are heavy on phones; use the raw camera feed instead. */
export function meetBackgroundAllowedOnDevice() {
  return !isMobileMeetDevice()
}
