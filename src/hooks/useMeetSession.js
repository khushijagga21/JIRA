import { useCallback, useEffect, useRef, useState } from 'react'
import { MeetBackgroundProcessor } from '../utils/meetBackgroundProcessor.js'
import { preloadMeetSegmenter } from '../utils/meetSegmenter.js'
import { meetBackgroundAllowedOnDevice } from '../utils/meetDevice.js'
import { acquireMeetMediaStream, loadMeetBackground, saveMeetBackground } from '../utils/meetVideo.js'
import { getMeetWsFallbackUrl, getMeetWsUrl } from '../utils/meetWs.js'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function getOrCreatePeerId() {
  const key = 'worksphere_meet_peer_id'
  try {
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function connectMeetSocket(urls) {
  return new Promise((resolve, reject) => {
    let i = 0
    function tryNext() {
      if (i >= urls.length) {
        reject(new Error('Could not connect to meeting server'))
        return
      }
      const ws = new WebSocket(urls[i])
      let settled = false
      const timer = window.setTimeout(() => {
        if (settled) return
        settled = true
        ws.close()
        i += 1
        tryNext()
      }, 5000)
      ws.onopen = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve(ws)
      }
      ws.onerror = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        i += 1
        tryNext()
      }
    }
    tryNext()
  })
}

function applyTrackEnabled(stream, kind, enabled) {
  const track = stream?.getTracks().find((t) => t.kind === kind)
  if (track) track.enabled = enabled
}

function replaceVideoTrackInPeers(pcs, newTrack, stream) {
  for (const [, entry] of pcs) {
    const sender = entry.pc.getSenders().find((s) => s.track?.kind === 'video')
    if (sender) void sender.replaceTrack(newTrack)
    else if (newTrack) entry.pc.addTrack(newTrack, stream)
  }
}

function effectiveMeetBackground(bgId) {
  if (!meetBackgroundAllowedOnDevice() && bgId && bgId !== 'none') return 'none'
  return bgId
}

export function useMeetSession({
  roomId,
  displayName,
  hostToken = '',
  initialMediaStream = null,
  active,
  initialMicOn = true,
  initialCamOn = true,
  initialBackground = loadMeetBackground(),
}) {
  const peerIdRef = useRef(getOrCreatePeerId())
  const wsRef = useRef(null)
  const pcsRef = useRef(new Map())
  const localStreamRef = useRef(null)
  const rawStreamRef = useRef(null)
  const processorRef = useRef(null)
  const cameraVideoTrackRef = useRef(null)
  const screenTrackRef = useRef(null)

  const [localStream, setLocalStream] = useState(null)
  const [remotePeers, setRemotePeers] = useState([])
  const [micOn, setMicOn] = useState(initialMicOn)
  const [camOn, setCamOn] = useState(initialCamOn)
  const [backgroundId, setBackgroundIdState] = useState(initialBackground)
  const [bgLoading, setBgLoading] = useState(false)
  const [effectsReady, setEffectsReady] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [remoteHands, setRemoteHands] = useState({})
  const [reactions, setReactions] = useState([])
  const [screenSharing, setScreenSharing] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [isHost, setIsHost] = useState(false)

  const buildCameraPublishStream = useCallback(async (raw, bgId) => {
    const bgEffective = effectiveMeetBackground(bgId)
    const audio = raw.getAudioTracks()[0]
    if (!processorRef.current) processorRef.current = new MeetBackgroundProcessor()
    const processor = processorRef.current

    if (!bgEffective || bgEffective === 'none') {
      processor.stop()
      const video = raw.getVideoTracks()[0]
      cameraVideoTrackRef.current = video
      return new MediaStream([audio, video].filter(Boolean))
    }

    setBgLoading(true)
    try {
      if (processor.isActive && processor.sourceStream === raw) {
        processor.setBackgroundId(bgEffective)
        const video = processor.outputStream?.getVideoTracks()[0]
        cameraVideoTrackRef.current = raw.getVideoTracks()[0]
        return new MediaStream([audio, video].filter(Boolean))
      }
      const processed = await processor.start(raw, bgEffective)
      const video = processed.getVideoTracks()[0]
      cameraVideoTrackRef.current = raw.getVideoTracks()[0]
      return new MediaStream([audio, video].filter(Boolean))
    } catch {
      processor.stop()
      const video = raw.getVideoTracks()[0]
      cameraVideoTrackRef.current = video
      return new MediaStream([audio, video].filter(Boolean))
    } finally {
      setBgLoading(false)
    }
  }, [])

  const syncPublishStream = useCallback(
    async (bgId = backgroundId) => {
      if (screenTrackRef.current || !rawStreamRef.current) return
      const publish = await buildCameraPublishStream(rawStreamRef.current, bgId)
      localStreamRef.current = publish
      setLocalStream(publish)
      const video = publish.getVideoTracks()[0]
      if (video) replaceVideoTrackInPeers(pcsRef.current, video, publish)
    },
    [backgroundId, buildCameraPublishStream],
  )

  const setBackgroundId = useCallback(
    (id) => {
      saveMeetBackground(id)
      setBackgroundIdState(id)
      if (!screenTrackRef.current) void syncPublishStream(id)
    },
    [syncPublishStream],
  )

  const syncRemotePeers = useCallback(() => {
    const list = []
    for (const [id, entry] of pcsRef.current) {
      list.push({
        peerId: id,
        name: entry.name,
        stream: entry.stream,
        isHost: Boolean(entry.isHost),
      })
    }
    setRemotePeers(list)
  }, [])

  const attachRemoteStream = useCallback(
    (peerId, stream, name) => {
      const pcEntry = pcsRef.current.get(peerId)
      if (pcEntry) {
        pcEntry.stream = stream
        if (name) pcEntry.name = name
      }
      syncRemotePeers()
    },
    [syncRemotePeers],
  )

  const removePeer = useCallback(
    (peerId) => {
      const entry = pcsRef.current.get(peerId)
      if (entry) {
        entry.pc.close()
        pcsRef.current.delete(peerId)
      }
      syncRemotePeers()
    },
    [syncRemotePeers],
  )

  const createPeerConnection = useCallback(
    (remotePeerId, remoteName, isInitiator, remoteIsHost = false) => {
      if (pcsRef.current.has(remotePeerId)) return pcsRef.current.get(remotePeerId).pc

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      pcsRef.current.set(remotePeerId, {
        pc,
        name: remoteName,
        stream: null,
        isHost: remoteIsHost,
      })

      const stream = localStreamRef.current
      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream)
        }
      }

      pc.ontrack = (ev) => {
        const [remoteStream] = ev.streams
        if (remoteStream) attachRemoteStream(remotePeerId, remoteStream, remoteName)
      }

      pc.onicecandidate = (ev) => {
        if (!ev.candidate || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        wsRef.current.send(
          JSON.stringify({
            type: 'signal',
            to: remotePeerId,
            data: { candidate: ev.candidate },
          }),
        )
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          removePeer(remotePeerId)
        }
      }

      if (isInitiator) {
        void pc
          .createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
            wsRef.current.send(
              JSON.stringify({
                type: 'signal',
                to: remotePeerId,
                data: { sdp: pc.localDescription },
              }),
            )
          })
          .catch(() => removePeer(remotePeerId))
      }

      return pc
    },
    [attachRemoteStream, removePeer],
  )

  const handleSignal = useCallback(
    async (fromPeerId, data) => {
      let entry = pcsRef.current.get(fromPeerId)
      if (!entry) {
        createPeerConnection(fromPeerId, 'Guest', false)
        entry = pcsRef.current.get(fromPeerId)
      }
      if (!entry) return
      const { pc } = entry

      try {
        if (data?.sdp) {
          await pc.setRemoteDescription(data.sdp)
          if (data.sdp.type === 'offer') {
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            wsRef.current?.send(
              JSON.stringify({
                type: 'signal',
                to: fromPeerId,
                data: { sdp: pc.localDescription },
              }),
            )
          }
        } else if (data?.candidate) {
          await pc.addIceCandidate(data.candidate)
        }
      } catch {
        removePeer(fromPeerId)
      }
    },
    [createPeerConnection, removePeer],
  )

  const stopScreenShare = useCallback(() => {
    const screenTrack = screenTrackRef.current
    if (screenTrack) {
      screenTrack.stop()
      screenTrackRef.current = null
    }
    setScreenSharing(false)
    void syncPublishStream()
    setCamOn(cameraVideoTrackRef.current?.enabled ?? true)
  }, [syncPublishStream])

  const leave = useCallback(() => {
    stopScreenShare()
    processorRef.current?.stop()
    for (const [, entry] of pcsRef.current) entry.pc.close()
    pcsRef.current.clear()
    syncRemotePeers()
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (rawStreamRef.current) {
      for (const t of rawStreamRef.current.getTracks()) t.stop()
      rawStreamRef.current = null
    }
    localStreamRef.current = null
    cameraVideoTrackRef.current = null
    setLocalStream(null)
    setHandRaised(false)
    setRemoteHands({})
    setReactions([])
    setIsHost(false)
    setStatus('idle')
  }, [stopScreenShare, syncRemotePeers])

  const leaveRef = useRef(leave)
  leaveRef.current = leave

  const toggleMic = useCallback(() => {
    const audio = rawStreamRef.current?.getAudioTracks()[0]
    if (audio) {
      audio.enabled = !audio.enabled
      setMicOn(audio.enabled)
    }
  }, [])

  const toggleCam = useCallback(() => {
    const video = cameraVideoTrackRef.current || rawStreamRef.current?.getVideoTracks()[0]
    if (video) {
      video.enabled = !video.enabled
      setCamOn(video.enabled)
    }
  }, [])

  const sendChat = useCallback((text) => {
    const trimmed = String(text ?? '').trim()
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'chat', text: trimmed }))
  }, [])

  const toggleHand = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    setHandRaised((prev) => {
      const next = !prev
      wsRef.current.send(JSON.stringify({ type: 'raise-hand', raised: next }))
      return next
    })
  }, [])

  const sendReaction = useCallback((emoji) => {
    const value = String(emoji ?? '').trim()
    if (!value || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'reaction', emoji: value }))
    const id = `${peerIdRef.current}-${Date.now()}`
    setReactions((prev) => [...prev, { id, peerId: peerIdRef.current, name: displayName || 'You', emoji: value }])
  }, [displayName])

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      stopScreenShare()
      return
    }
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const screenTrack = displayStream.getVideoTracks()[0]
      if (!screenTrack) {
        for (const t of displayStream.getTracks()) t.stop()
        return
      }
      screenTrackRef.current = screenTrack
      const raw = rawStreamRef.current
      const audio = raw?.getAudioTracks()[0]
      if (!raw || !audio) {
        screenTrack.stop()
        return
      }
      processorRef.current?.stop()
      const publish = new MediaStream([audio, screenTrack])
      localStreamRef.current = publish
      replaceVideoTrackInPeers(pcsRef.current, screenTrack, publish)
      setLocalStream(publish)
      setScreenSharing(true)
      setCamOn(true)
      screenTrack.onended = () => stopScreenShare()
    } catch {
      /* user cancelled picker */
    }
  }, [screenSharing, stopScreenShare])

  useEffect(() => {
    if (!active) return undefined
    let cancelled = false
    void preloadMeetSegmenter()
      .then(() => {
        if (!cancelled) setEffectsReady(true)
      })
      .catch(() => {
        if (!cancelled) setEffectsReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [active])

  useEffect(() => {
    if (!active || !roomId) return undefined

    let cancelled = false
    const peerConnections = pcsRef.current
    const wsCurrent = () => wsRef.current
    const local = () => localStreamRef.current

    async function start() {
      setStatus('connecting')
      setError(null)
      try {
        const raw = await acquireMeetMediaStream(initialMediaStream)
        if (cancelled) {
          for (const t of raw.getTracks()) t.stop()
          return
        }
        rawStreamRef.current = raw
        applyTrackEnabled(raw, 'audio', initialMicOn)
        applyTrackEnabled(raw, 'video', initialCamOn)
        const publish = await buildCameraPublishStream(raw, effectiveMeetBackground(initialBackground))
        if (cancelled) {
          for (const t of raw.getTracks()) t.stop()
          processorRef.current?.stop()
          return
        }
        localStreamRef.current = publish
        setLocalStream(publish)
        setMicOn(raw.getAudioTracks()[0]?.enabled ?? true)
        setCamOn(raw.getVideoTracks()[0]?.enabled ?? true)
      } catch (err) {
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera or microphone permission was denied. Allow access in your browser settings, then try again.'
            : err?.name === 'NotReadableError' || err?.name === 'TrackStartError'
              ? 'Your camera may be in use by another app. Close other apps using the camera, then refresh.'
              : 'Could not access camera or microphone.',
        )
        setStatus('error')
        return
      }

      try {
        const urls = [...new Set([getMeetWsUrl(), getMeetWsFallbackUrl()].filter(Boolean))]
        const ws = await connectMeetSocket(urls)
        if (cancelled) {
          ws.close()
          return
        }
        wsRef.current = ws

        ws.onmessage = (ev) => {
          let msg
          try {
            msg = JSON.parse(String(ev.data))
          } catch {
            return
          }

          if (msg.type === 'joined') {
            setStatus('connected')
            setIsHost(Boolean(msg.isHost))
            for (const p of msg.peers || []) {
              createPeerConnection(p.peerId, p.name, true, Boolean(p.isHost))
            }
            return
          }

          if (msg.type === 'peer-joined') {
            createPeerConnection(msg.peerId, msg.name, false, Boolean(msg.isHost))
            return
          }

          if (msg.type === 'force-mute') {
            const audio = rawStreamRef.current?.getAudioTracks()[0]
            if (audio) {
              audio.enabled = false
              setMicOn(false)
            }
            return
          }

          if (msg.type === 'removed') {
            setError('The meeting host removed you from the call.')
            leaveRef.current()
            return
          }

          if (msg.type === 'peer-left') {
            removePeer(msg.peerId)
            return
          }

          if (msg.type === 'signal') {
            void handleSignal(msg.from, msg.data)
            return
          }

          if (msg.type === 'chat') {
            setChatMessages((prev) => [
              ...prev,
              {
                id: `${msg.peerId}-${msg.ts}`,
                peerId: msg.peerId,
                name: msg.name,
                text: msg.text,
                ts: msg.ts,
              },
            ])
            return
          }

          if (msg.type === 'raise-hand') {
            setRemoteHands((prev) => {
              const next = { ...prev }
              if (msg.raised) next[msg.peerId] = msg.name || 'Guest'
              else delete next[msg.peerId]
              return next
            })
            return
          }

          if (msg.type === 'reaction') {
            const id = `${msg.peerId}-${msg.ts}`
            setReactions((prev) => [...prev, { id, peerId: msg.peerId, name: msg.name, emoji: msg.emoji }])
            return
          }

          if (msg.type === 'error') {
            setError('Could not join this meeting.')
            setStatus('error')
          }
        }

        ws.onclose = () => {
          if (!cancelled) setStatus('disconnected')
        }

        ws.send(
          JSON.stringify({
            type: 'join',
            room: roomId,
            peerId: peerIdRef.current,
            name: displayName || 'Guest',
            hostToken: hostToken || undefined,
          }),
        )
      } catch {
        setError('Could not connect to the meeting server. Make sure the workSphere API is running.')
        setStatus('error')
      }
    }

    void start()

    return () => {
      cancelled = true
      for (const [, entry] of peerConnections) entry.pc.close()
      peerConnections.clear()
      const ws = wsCurrent()
      if (ws) ws.close()
      wsRef.current = null
      processorRef.current?.stop()
      const raw = rawStreamRef.current
      if (raw) {
        for (const t of raw.getTracks()) t.stop()
        rawStreamRef.current = null
      }
      localStreamRef.current = null
      setLocalStream(null)
      setRemotePeers([])
      setStatus('idle')
    }
  }, [
    active,
    roomId,
    displayName,
    hostToken,
    initialMediaStream,
    initialMicOn,
    initialCamOn,
    initialBackground,
    buildCameraPublishStream,
    createPeerConnection,
    handleSignal,
    removePeer,
  ])

  useEffect(() => {
    if (!reactions.length) return undefined
    const timer = window.setTimeout(() => {
      setReactions((prev) => (prev.length <= 1 ? [] : prev.slice(1)))
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [reactions])

  const muteParticipant = useCallback((targetPeerId) => {
    if (!isHost || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'host-mute', to: targetPeerId }))
  }, [isHost])

  const removeParticipant = useCallback((targetPeerId) => {
    if (!isHost || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'host-remove', to: targetPeerId }))
  }, [isHost])

  return {
    localStream,
    remotePeers,
    micOn,
    camOn,
    handRaised,
    remoteHands,
    reactions,
    screenSharing,
    chatMessages,
    status,
    error,
    isHost,
    backgroundId,
    setBackgroundId,
    bgLoading,
    effectsReady,
    toggleMic,
    toggleCam,
    toggleHand,
    toggleScreenShare,
    sendReaction,
    sendChat,
    muteParticipant,
    removeParticipant,
    leave,
    peerId: peerIdRef.current,
  }
}
