import { WebSocketServer } from 'ws'

const MAX_ROOM_ID_LEN = 64
const MAX_NAME_LEN = 80
const MAX_CHAT_LEN = 2000
const MAX_HOST_TOKEN_LEN = 128

function sanitizeRoomId(raw) {
  const id = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, MAX_ROOM_ID_LEN)
  return id || null
}

function sanitizeName(raw) {
  const name = String(raw ?? '')
    .trim()
    .slice(0, MAX_NAME_LEN)
  return name || 'Guest'
}

function sanitizeHostToken(raw) {
  const token = String(raw ?? '')
    .trim()
    .slice(0, MAX_HOST_TOKEN_LEN)
  return token || null
}

function peerIsHost(roomState, peerId) {
  return Boolean(roomState?.hostPeerId && roomState.hostPeerId === peerId)
}

function peerPayload(roomState, peerId, name) {
  return {
    peerId,
    name,
    isHost: peerIsHost(roomState, peerId),
  }
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

function broadcast(room, payload, exceptPeerId) {
  for (const [peerId, peer] of room) {
    if (peerId !== exceptPeerId) send(peer.ws, payload)
  }
}

/**
 * WebSocket signaling for workSphere Meet (WebRTC mesh).
 * Path: /meet-ws
 */
export function attachMeetSignaling(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/meet-ws' })
  /** @type {Map<string, { peers: Map<string, { ws: import('ws').WebSocket, name: string }>, hostToken: string|null, hostPeerId: string|null }>} */
  const rooms = new Map()

  function getRoom(roomId) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { peers: new Map(), hostToken: null, hostPeerId: null })
    }
    return rooms.get(roomId)
  }

  function leaveRoom(roomId, peerId) {
    const roomState = rooms.get(roomId)
    if (!roomState) return
    roomState.peers.delete(peerId)
    if (roomState.hostPeerId === peerId) roomState.hostPeerId = null
    if (roomState.peers.size === 0) rooms.delete(roomId)
    else broadcast(roomState.peers, { type: 'peer-left', peerId })
  }

  wss.on('connection', (ws) => {
    let roomId = null
    let peerId = null

    ws.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(String(raw))
      } catch {
        return
      }

      if (msg.type === 'join') {
        const nextRoom = sanitizeRoomId(msg.room)
        const nextPeer = String(msg.peerId ?? '').trim().slice(0, 64)
        const name = sanitizeName(msg.name)
        if (!nextRoom || !nextPeer) {
          send(ws, { type: 'error', reason: 'invalid_join' })
          return
        }

        if (roomId && peerId) leaveRoom(roomId, peerId)

        roomId = nextRoom
        peerId = nextPeer

        const roomState = getRoom(roomId)
        const hostToken = sanitizeHostToken(msg.hostToken)
        let isHost = false

        if (hostToken) {
          if (!roomState.hostToken && roomState.peers.size === 0) {
            roomState.hostToken = hostToken
            isHost = true
          } else if (roomState.hostToken === hostToken) {
            isHost = true
          }
        }

        if (isHost) roomState.hostPeerId = peerId

        const peers = [...roomState.peers.entries()].map(([id, p]) => peerPayload(roomState, id, p.name))
        roomState.peers.set(peerId, { ws, name })
        send(ws, {
          type: 'joined',
          peerId,
          room: roomId,
          peers,
          isHost,
          hostPeerId: roomState.hostPeerId,
        })
        broadcast(
          roomState.peers,
          {
            type: 'peer-joined',
            peerId,
            name,
            isHost: peerIsHost(roomState, peerId),
          },
          peerId,
        )
        return
      }

      if (!roomId || !peerId) return
      const roomState = rooms.get(roomId)
      const room = roomState?.peers
      if (!room?.has(peerId)) return

      if (msg.type === 'host-mute' || msg.type === 'host-remove') {
        if (!peerIsHost(roomState, peerId)) return
        const to = String(msg.to ?? '').trim()
        const target = room.get(to)
        if (!target || to === peerId) return
        if (msg.type === 'host-mute') {
          send(target.ws, { type: 'force-mute', from: peerId })
          return
        }
        send(target.ws, { type: 'removed', from: peerId })
        target.ws.close()
        return
      }

      if (msg.type === 'signal') {
        const to = String(msg.to ?? '').trim()
        const target = room.get(to)
        if (!target) return
        send(target.ws, {
          type: 'signal',
          from: peerId,
          data: msg.data,
        })
        return
      }

      if (msg.type === 'chat') {
        const text = String(msg.text ?? '').trim().slice(0, MAX_CHAT_LEN)
        if (!text) return
        const fromName = room.get(peerId)?.name || 'Guest'
        broadcast(room, {
          type: 'chat',
          peerId,
          name: fromName,
          text,
          ts: Date.now(),
        })
        return
      }

      if (msg.type === 'raise-hand') {
        const fromName = room.get(peerId)?.name || 'Guest'
        broadcast(room, {
          type: 'raise-hand',
          peerId,
          name: fromName,
          raised: Boolean(msg.raised),
          ts: Date.now(),
        })
        return
      }

      if (msg.type === 'reaction') {
        const emoji = String(msg.emoji ?? '').trim().slice(0, 8)
        if (!emoji) return
        const fromName = room.get(peerId)?.name || 'Guest'
        broadcast(room, {
          type: 'reaction',
          peerId,
          name: fromName,
          emoji,
          ts: Date.now(),
        })
      }
    })

    ws.on('close', () => {
      if (roomId && peerId) leaveRoom(roomId, peerId)
    })
  })

  console.log('[workSphere] Meet signaling on /meet-ws (WebRTC)')
}
