import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import crypto from 'crypto'
import fs from 'fs'
import multer from 'multer'
import nodemailer from 'nodemailer'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, 'worksphere.db')
const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  );
`)

function ensurePasswordHashColumn() {
  const cols = db.prepare('PRAGMA table_info(users)').all()
  if (!cols.some((c) => c.name === 'password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT')
  }
}
ensurePasswordHashColumn()

db.pragma('foreign_keys = ON')
db.exec(`
  CREATE TABLE IF NOT EXISTS collab_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS collab_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    UNIQUE(room_id, email),
    FOREIGN KEY (room_id) REFERENCES collab_rooms(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS collab_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    author_email TEXT NOT NULL,
    author_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES collab_rooms(id) ON DELETE CASCADE
  );
`)

function ensureCollabInviteTokenColumn() {
  const cols = db.prepare('PRAGMA table_info(collab_rooms)').all()
  if (!cols.some((c) => c.name === 'invite_token')) {
    // SQLite does not allow UNIQUE on ADD COLUMN; enforce with an index instead.
    db.exec('ALTER TABLE collab_rooms ADD COLUMN invite_token TEXT')
    const rows = db.prepare('SELECT id FROM collab_rooms WHERE invite_token IS NULL').all()
    for (const r of rows) {
      const token = crypto.randomUUID()
      db.prepare('UPDATE collab_rooms SET invite_token = ? WHERE id = ?').run(token, r.id)
    }
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS collab_rooms_invite_token_uq ON collab_rooms(invite_token)',
    )
  }
}
ensureCollabInviteTokenColumn()

db.exec(`
  CREATE TABLE IF NOT EXISTS collab_email_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    invitee_email TEXT NOT NULL,
    inviter_email TEXT NOT NULL,
    inviter_name TEXT NOT NULL,
    accept_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES collab_rooms(id) ON DELETE CASCADE
  );
`)
try {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS collab_email_invite_unique_pending
    ON collab_email_invites(room_id, invitee_email)
    WHERE status = 'pending';
  `)
} catch {
  // ignore duplicate index name on older DBs
}

function ensureCollabMessageAttachments() {
  const cols = db.prepare('PRAGMA table_info(collab_messages)').all()
  const names = new Set(cols.map((c) => c.name))
  if (!names.has('attachment_stored')) {
    db.exec('ALTER TABLE collab_messages ADD COLUMN attachment_stored TEXT')
  }
  if (!names.has('attachment_original')) {
    db.exec('ALTER TABLE collab_messages ADD COLUMN attachment_original TEXT')
  }
  if (!names.has('attachment_mime')) {
    db.exec('ALTER TABLE collab_messages ADD COLUMN attachment_mime TEXT')
  }
}
ensureCollabMessageAttachments()

const COLLAB_MAX_MEMBERS = 200

function collabMemberCount(roomId) {
  const row = db.prepare('SELECT COUNT(*) AS c FROM collab_members WHERE room_id = ?').get(roomId)
  return Number(row?.c ?? 0)
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

const BCRYPT_ROUNDS = 10
const MIN_PASSWORD_LEN = 8

function hashPassword(plain) {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS)
}

function verifyPassword(plain, hash) {
  if (!plain || !hash) return false
  return bcrypt.compareSync(plain, hash)
}

const app = express()
app.use(cors())
app.use(express.json())

const uploadsCollabDir = path.join(__dirname, 'uploads', 'collab')
fs.mkdirSync(uploadsCollabDir, { recursive: true })

const APP_PUBLIC_URL = (
  process.env.PUBLIC_APP_URL ||
  process.env.VITE_PUBLIC_APP_URL ||
  'http://localhost:5173'
).replace(/\/$/, '')
const MAIL_FROM = process.env.SMTP_FROM || 'workSphere <noreply@worksphere.local>'

function createMailer() {
  const host = process.env.SMTP_HOST
  if (!host) return null
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  })
}
const mailer = createMailer()

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function sendWorksphereInviteEmail({ to, inviterName, roomName, acceptUrl, declineUrl }) {
  const subject = `${inviterName} invited you to workSphere — ${roomName}`
  const text = `workSphere invitation\n\n${inviterName} invited you to join the room "${roomName}".\n\nAccept (you will only join after you accept):\n${acceptUrl}\n\nDecline:\n${declineUrl}\n\nIf you do nothing, you will not be added to the room.`
  const html = `<p><strong>${escapeHtml(inviterName)}</strong> invited you to <strong>${escapeHtml(roomName)}</strong> on workSphere.</p>
<p><a href="${acceptUrl}">Accept invitation</a> &nbsp;·&nbsp; <a href="${declineUrl}">Decline</a></p>
<p style="color:#64748b;font-size:13px">You are only added after you accept. Ignoring this email means you stay out of the room.</p>`
  if (!mailer) {
    console.log('[workSphere] SMTP_HOST not set — invite not emailed. Accept URL:', acceptUrl)
    return { sent: false }
  }
  await mailer.sendMail({ from: MAIL_FROM, to, subject, text, html })
  return { sent: true }
}

const uploadCollab = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsCollabDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 16) || ''
      cb(null, `${crypto.randomUUID()}${ext}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const m = file.mimetype || ''
    if (
      m.startsWith('image/') ||
      m === 'application/pdf' ||
      m === 'application/msword' ||
      m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      cb(null, true)
      return
    }
    cb(new Error('unsupported_file_type'))
  },
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/signup', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password ?? '')

  if (!name || !email) {
    res.status(400).json({ ok: false, reason: 'missing_fields' })
    return
  }

  if (password.length < MIN_PASSWORD_LEN) {
    res.status(400).json({ ok: false, reason: 'weak_password' })
    return
  }

  const passwordHash = hashPassword(password)

  try {
    const stmt = db.prepare(
      'INSERT INTO users (name, email, created_at, password_hash) VALUES (?, ?, ?, ?)',
    )
    stmt.run(name, email, Date.now(), passwordHash)
    res.json({ ok: true, user: { name, email } })
  } catch (e) {
    if (String(e?.message ?? '').includes('UNIQUE')) {
      const existing = db
        .prepare('SELECT id, password_hash FROM users WHERE email = ?')
        .get(email)
      if (existing && !existing.password_hash) {
        db.prepare('UPDATE users SET name = ?, password_hash = ? WHERE id = ?').run(
          name,
          passwordHash,
          existing.id,
        )
        res.json({ ok: true, user: { name, email } })
        return
      }
      res.status(409).json({ ok: false, reason: 'exists' })
      return
    }
    res.status(500).json({ ok: false, reason: 'server_error' })
  }
})

app.post('/api/login', (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password ?? '')

  if (!email || !password) {
    res.status(400).json({ ok: false, reason: 'missing_fields' })
    return
  }

  const row = db
    .prepare('SELECT name, email, password_hash FROM users WHERE email = ?')
    .get(email)

  if (!row) {
    res.status(401).json({ ok: false, reason: 'invalid_credentials' })
    return
  }

  if (!row.password_hash) {
    res.status(401).json({ ok: false, reason: 'password_not_set' })
    return
  }

  if (!verifyPassword(password, row.password_hash)) {
    res.status(401).json({ ok: false, reason: 'invalid_credentials' })
    return
  }

  res.json({ ok: true, user: { name: row.name, email: row.email } })
})

function collabRoomIdParam(req) {
  const id = Number.parseInt(String(req.params.roomId ?? ''), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

function collabMessageIdParam(req) {
  const id = Number.parseInt(String(req.params.messageId ?? ''), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

function uploadCollabSafe(req, res, next) {
  uploadCollab.single('file')(req, res, (err) => {
    if (err) {
      let reason = 'upload_error'
      if (err.code === 'LIMIT_FILE_SIZE') reason = 'file_too_large'
      else if (String(err.message || '').includes('unsupported_file_type')) reason = 'unsupported_file_type'
      res.status(400).json({ ok: false, reason })
      return
    }
    next()
  })
}

app.get('/api/collab/email-invite/:token', (req, res) => {
  const token = String(req.params.token ?? '').trim()
  if (!token) {
    res.status(400).json({ ok: false, reason: 'bad_token' })
    return
  }
  const row = db
    .prepare(
      `SELECT i.id, i.room_id, i.invitee_email, i.inviter_name, i.status, i.created_at, r.name AS room_name
       FROM collab_email_invites i
       JOIN collab_rooms r ON r.id = i.room_id
       WHERE i.accept_token = ?`,
    )
    .get(token)
  if (!row) {
    res.status(404).json({ ok: false, reason: 'invalid_invite' })
    return
  }
  const count = collabMemberCount(row.room_id)
  res.json({
    ok: true,
    roomName: row.room_name,
    inviteeEmail: row.invitee_email,
    inviterName: row.inviter_name,
    status: row.status,
    roomFull: count >= COLLAB_MAX_MEMBERS,
    roomId: row.room_id,
  })
})

app.post('/api/collab/email-invite/:token/accept', (req, res) => {
  const token = String(req.params.token ?? '').trim()
  const displayName = String(req.body?.displayName ?? '').trim().slice(0, 80)
  if (!token || !displayName) {
    res.status(400).json({ ok: false, reason: 'missing_fields' })
    return
  }
  const row = db.prepare('SELECT * FROM collab_email_invites WHERE accept_token = ?').get(token)
  if (!row) {
    res.status(404).json({ ok: false, reason: 'invalid_invite' })
    return
  }
  if (row.status !== 'pending') {
    res.status(400).json({ ok: false, reason: 'invite_closed' })
    return
  }
  if (collabMemberCount(row.room_id) >= COLLAB_MAX_MEMBERS) {
    res.status(403).json({ ok: false, reason: 'room_full' })
    return
  }
  const email = normalizeEmail(row.invitee_email)
  const now = Date.now()
  db.prepare(
    'INSERT OR IGNORE INTO collab_members (room_id, email, name, joined_at) VALUES (?, ?, ?, ?)',
  ).run(row.room_id, email, displayName, now)
  db.prepare("UPDATE collab_email_invites SET status = 'accepted' WHERE id = ?").run(row.id)
  res.json({ ok: true, roomId: row.room_id, joinedAsEmail: email })
})

app.post('/api/collab/email-invite/:token/decline', (req, res) => {
  const token = String(req.params.token ?? '').trim()
  if (!token) {
    res.status(400).json({ ok: false, reason: 'bad_token' })
    return
  }
  const row = db.prepare('SELECT * FROM collab_email_invites WHERE accept_token = ?').get(token)
  if (!row) {
    res.status(404).json({ ok: false, reason: 'invalid_invite' })
    return
  }
  if (row.status !== 'pending') {
    res.json({ ok: true, already: true })
    return
  }
  db.prepare("UPDATE collab_email_invites SET status = 'declined' WHERE id = ?").run(row.id)
  res.json({ ok: true })
})

app.post('/api/collab/rooms/:roomId/email-invite', async (req, res) => {
  const roomId = collabRoomIdParam(req)
  const inviterEmail = normalizeEmail(req.body?.inviterEmail)
  const inviterName = String(req.body?.inviterName ?? '').trim().slice(0, 80)
  const inviteeEmail = normalizeEmail(req.body?.inviteeEmail)
  if (!roomId || !inviterEmail || !inviterName || !inviteeEmail) {
    res.status(400).json({ ok: false, reason: 'missing_fields' })
    return
  }
  const inviterOk = db
    .prepare('SELECT 1 AS x FROM collab_members WHERE room_id = ? AND email = ?')
    .get(roomId, inviterEmail)
  if (!inviterOk) {
    res.status(403).json({ ok: false, reason: 'not_a_member' })
    return
  }
  if (collabMemberCount(roomId) >= COLLAB_MAX_MEMBERS) {
    res.status(403).json({ ok: false, reason: 'room_full' })
    return
  }
  const alreadyMember = db
    .prepare('SELECT 1 AS x FROM collab_members WHERE room_id = ? AND email = ?')
    .get(roomId, inviteeEmail)
  if (alreadyMember) {
    res.status(400).json({ ok: false, reason: 'already_member' })
    return
  }
  const room = db.prepare('SELECT name FROM collab_rooms WHERE id = ?').get(roomId)
  if (!room) {
    res.status(404).json({ ok: false, reason: 'not_found' })
    return
  }
  const now = Date.now()
  let acceptToken
  const pending = db
    .prepare(
      `SELECT id, accept_token FROM collab_email_invites
       WHERE room_id = ? AND invitee_email = ? AND status = 'pending'`,
    )
    .get(roomId, inviteeEmail)
  if (pending) {
    acceptToken = pending.accept_token
    db.prepare('UPDATE collab_email_invites SET inviter_email = ?, inviter_name = ?, created_at = ? WHERE id = ?').run(
      inviterEmail,
      inviterName,
      now,
      pending.id,
    )
  } else {
    acceptToken = crypto.randomUUID()
    db.prepare(
      `INSERT INTO collab_email_invites (room_id, invitee_email, inviter_email, inviter_name, accept_token, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(roomId, inviteeEmail, inviterEmail, inviterName, acceptToken, now)
  }
  const acceptUrl = `${APP_PUBLIC_URL}/invite/email/${acceptToken}`
  const declineUrl = `${APP_PUBLIC_URL}/invite/email/${acceptToken}?decline=1`
  try {
    const { sent } = await sendWorksphereInviteEmail({
      to: inviteeEmail,
      inviterName,
      roomName: room.name,
      acceptUrl,
      declineUrl,
    })
    res.json({
      ok: true,
      emailSent: sent,
      acceptUrl: sent ? undefined : acceptUrl,
      message: sent
        ? 'Invitation email sent.'
        : 'Email not configured — copy the link below for your teammate.',
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({
      ok: false,
      reason: 'email_failed',
      acceptUrl,
      message: 'Email failed to send — share the link manually.',
    })
  }
})

app.post('/api/collab/rooms/:roomId/upload', uploadCollabSafe, (req, res) => {
  const roomId = collabRoomIdParam(req)
  if (!roomId) {
    res.status(400).json({ ok: false, reason: 'bad_id' })
    return
  }
  if (!req.file) {
    res.status(400).json({ ok: false, reason: 'missing_file' })
    return
  }
  const authorEmail = normalizeEmail(req.body?.authorEmail)
  const authorName = String(req.body?.authorName ?? '').trim().slice(0, 80)
  if (!authorEmail || !authorName) {
    try {
      fs.unlinkSync(req.file.path)
    } catch {
      // ignore
    }
    res.status(400).json({ ok: false, reason: 'missing_fields' })
    return
  }
  const isMember = db
    .prepare('SELECT 1 AS x FROM collab_members WHERE room_id = ? AND email = ?')
    .get(roomId, authorEmail)
  if (!isMember) {
    try {
      fs.unlinkSync(req.file.path)
    } catch {
      // ignore
    }
    res.status(403).json({ ok: false, reason: 'not_a_member' })
    return
  }
  if (collabMemberCount(roomId) >= COLLAB_MAX_MEMBERS) {
    try {
      fs.unlinkSync(req.file.path)
    } catch {
      // ignore
    }
    res.status(403).json({ ok: false, reason: 'room_full' })
    return
  }
  const caption = String(req.body?.caption ?? '').trim().slice(0, 8000)
  const mime = req.file.mimetype || 'application/octet-stream'
  const body =
    caption ||
    (mime.startsWith('image/') ? '📷 Shared an image' : `📎 ${req.file.originalname || 'Attachment'}`)
  const now = Date.now()
  const info = db
    .prepare(
      `INSERT INTO collab_messages (room_id, author_email, author_name, body, created_at, attachment_stored, attachment_original, attachment_mime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      roomId,
      authorEmail,
      authorName,
      body,
      now,
      req.file.filename,
      (req.file.originalname || 'file').slice(0, 200),
      mime,
    )
  const id = Number(info.lastInsertRowid)
  res.json({
    ok: true,
    message: {
      id,
      author_email: authorEmail,
      author_name: authorName,
      body,
      created_at: now,
      attachment_stored: req.file.filename,
      attachment_original: req.file.originalname,
      attachment_mime: mime,
    },
  })
})

app.get('/api/collab/rooms/:roomId/messages/:messageId/file', (req, res) => {
  const roomId = collabRoomIdParam(req)
  const messageId = collabMessageIdParam(req)
  const viewer = normalizeEmail(req.query.email)
  if (!roomId || !messageId || !viewer) {
    res.status(400).json({ ok: false, reason: 'missing_fields' })
    return
  }
  const isMember = db
    .prepare('SELECT 1 AS x FROM collab_members WHERE room_id = ? AND email = ?')
    .get(roomId, viewer)
  if (!isMember) {
    res.status(403).json({ ok: false, reason: 'not_a_member' })
    return
  }
  const msg = db
    .prepare(
      'SELECT attachment_stored, attachment_original, attachment_mime FROM collab_messages WHERE id = ? AND room_id = ?',
    )
    .get(messageId, roomId)
  if (!msg?.attachment_stored) {
    res.status(404).end()
    return
  }
  const resolved = path.resolve(uploadsCollabDir, msg.attachment_stored)
  if (!resolved.startsWith(path.resolve(uploadsCollabDir))) {
    res.status(400).end()
    return
  }
  if (!fs.existsSync(resolved)) {
    res.status(404).end()
    return
  }
  const mime = msg.attachment_mime || 'application/octet-stream'
  const orig = msg.attachment_original || 'download'
  const inline = mime.startsWith('image/')
  res.setHeader('Content-Type', mime)
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(orig)}"`,
  )
  res.sendFile(resolved)
})

app.get('/api/collab/rooms/mine', (req, res) => {
  const email = normalizeEmail(req.query.email)
  if (!email) {
    res.status(400).json({ ok: false, reason: 'missing_email' })
    return
  }
  const rows = db
    .prepare(
      `SELECT r.id, r.name, r.created_at,
        (SELECT COUNT(*) FROM collab_members m WHERE m.room_id = r.id) AS member_count
       FROM collab_rooms r
       INNER JOIN collab_members mem ON mem.room_id = r.id AND mem.email = ?
       ORDER BY r.id DESC`,
    )
    .all(email)
  const previewStmt = db.prepare(
    `SELECT name, email FROM collab_members WHERE room_id = ? ORDER BY joined_at ASC LIMIT 4`,
  )
  const rooms = rows.map((r) => ({
    ...r,
    preview_members: previewStmt.all(r.id),
  }))
  res.json({ ok: true, rooms })
})

app.get('/api/collab/invite/:token', (req, res) => {
  const token = String(req.params.token ?? '').trim()
  if (!token) {
    res.status(400).json({ ok: false, reason: 'bad_token' })
    return
  }
  const room = db.prepare('SELECT id, name FROM collab_rooms WHERE invite_token = ?').get(token)
  if (!room) {
    res.status(404).json({ ok: false, reason: 'invalid_invite' })
    return
  }
  const count = collabMemberCount(room.id)
  res.json({
    ok: true,
    roomId: room.id,
    name: room.name,
    memberCount: count,
    full: count >= COLLAB_MAX_MEMBERS,
  })
})

app.post('/api/collab/join', (req, res) => {
  const token = String(req.body?.token ?? '').trim()
  const email = normalizeEmail(req.body?.email)
  const name = String(req.body?.name ?? '').trim().slice(0, 80)
  if (!token || !email || !name) {
    res.status(400).json({ ok: false, reason: 'missing_fields' })
    return
  }
  const room = db.prepare('SELECT id FROM collab_rooms WHERE invite_token = ?').get(token)
  if (!room) {
    res.status(404).json({ ok: false, reason: 'invalid_invite' })
    return
  }
  if (collabMemberCount(room.id) >= COLLAB_MAX_MEMBERS) {
    res.status(403).json({ ok: false, reason: 'room_full' })
    return
  }
  const now = Date.now()
  db.prepare(
    'INSERT OR IGNORE INTO collab_members (room_id, email, name, joined_at) VALUES (?, ?, ?, ?)',
  ).run(room.id, email, name, now)
  res.json({ ok: true, roomId: room.id })
})

app.post('/api/collab/rooms', (req, res) => {
  const name = String(req.body?.name ?? '').trim().slice(0, 80)
  const creatorEmail = String(req.body?.creatorEmail ?? '').trim().toLowerCase().slice(0, 120)
  const creatorName = String(req.body?.creatorName ?? '').trim().slice(0, 80)
  if (!name || !creatorEmail || !creatorName) {
    res.status(400).json({ ok: false, reason: 'missing_fields' })
    return
  }
  const now = Date.now()
  const inviteToken = crypto.randomUUID()
  const insertRoom = db.prepare(
    'INSERT INTO collab_rooms (name, created_at, invite_token) VALUES (?, ?, ?)',
  )
  const insertMember = db.prepare(
    'INSERT OR IGNORE INTO collab_members (room_id, email, name, joined_at) VALUES (?, ?, ?, ?)',
  )
  const tx = db.transaction(() => {
    const info = insertRoom.run(name, now, inviteToken)
    const roomId = Number(info.lastInsertRowid)
    insertMember.run(roomId, creatorEmail, creatorName, now)
    return roomId
  })
  try {
    const roomId = tx()
    res.json({
      ok: true,
      room: { id: roomId, name, created_at: now, invite_token: inviteToken },
    })
  } catch {
    res.status(500).json({ ok: false, reason: 'server_error' })
  }
})

app.get('/api/collab/rooms/:roomId', (req, res) => {
  const roomId = collabRoomIdParam(req)
  if (!roomId) {
    res.status(400).json({ ok: false, reason: 'bad_id' })
    return
  }
  const viewer = normalizeEmail(req.query.email)
  if (!viewer) {
    res.status(400).json({ ok: false, reason: 'missing_email' })
    return
  }
  const isMember = db
    .prepare('SELECT 1 AS x FROM collab_members WHERE room_id = ? AND email = ?')
    .get(roomId, viewer)
  if (!isMember) {
    res.status(403).json({ ok: false, reason: 'not_a_member' })
    return
  }
  const room = db
    .prepare('SELECT id, name, created_at, invite_token FROM collab_rooms WHERE id = ?')
    .get(roomId)
  if (!room) {
    res.status(404).json({ ok: false, reason: 'not_found' })
    return
  }
  const members = db
    .prepare(
      'SELECT email, name, joined_at FROM collab_members WHERE room_id = ? ORDER BY joined_at ASC',
    )
    .all(roomId)
  const messages = db
    .prepare(
      `SELECT id, author_email, author_name, body, created_at,
        attachment_stored, attachment_original, attachment_mime
       FROM collab_messages WHERE room_id = ?
       ORDER BY created_at ASC LIMIT 300`,
    )
    .all(roomId)
  res.json({ ok: true, room, members, messages })
})

app.post('/api/collab/rooms/:roomId/members', (req, res) => {
  const roomId = collabRoomIdParam(req)
  if (!roomId) {
    res.status(400).json({ ok: false, reason: 'bad_id' })
    return
  }
  const exists = db.prepare('SELECT id FROM collab_rooms WHERE id = ?').get(roomId)
  if (!exists) {
    res.status(404).json({ ok: false, reason: 'not_found' })
    return
  }
  const email = String(req.body?.email ?? '').trim().toLowerCase().slice(0, 120)
  const name = String(req.body?.name ?? '').trim().slice(0, 80)
  if (!email || !name) {
    res.status(400).json({ ok: false, reason: 'missing_fields' })
    return
  }
  const already = db
    .prepare('SELECT 1 AS x FROM collab_members WHERE room_id = ? AND email = ?')
    .get(roomId, email)
  if (!already && collabMemberCount(roomId) >= COLLAB_MAX_MEMBERS) {
    res.status(403).json({ ok: false, reason: 'room_full' })
    return
  }
  const now = Date.now()
  db.prepare(
    'INSERT OR IGNORE INTO collab_members (room_id, email, name, joined_at) VALUES (?, ?, ?, ?)',
  ).run(roomId, email, name, now)
  res.json({ ok: true })
})

app.post('/api/collab/rooms/:roomId/messages', (req, res) => {
  const roomId = collabRoomIdParam(req)
  if (!roomId) {
    res.status(400).json({ ok: false, reason: 'bad_id' })
    return
  }
  const exists = db.prepare('SELECT id FROM collab_rooms WHERE id = ?').get(roomId)
  if (!exists) {
    res.status(404).json({ ok: false, reason: 'not_found' })
    return
  }
  const authorEmail = String(req.body?.authorEmail ?? '').trim().toLowerCase().slice(0, 120)
  const authorName = String(req.body?.authorName ?? '').trim().slice(0, 80)
  const body = String(req.body?.body ?? '').trim().slice(0, 8000)
  if (!authorEmail || !authorName || !body) {
    res.status(400).json({ ok: false, reason: 'missing_fields' })
    return
  }
  const isMember = db
    .prepare('SELECT 1 AS x FROM collab_members WHERE room_id = ? AND email = ?')
    .get(roomId, authorEmail)
  if (!isMember) {
    res.status(403).json({ ok: false, reason: 'not_a_member' })
    return
  }
  const now = Date.now()
  const info = db
    .prepare(
      'INSERT INTO collab_messages (room_id, author_email, author_name, body, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(roomId, authorEmail, authorName, body, now)
  res.json({
    ok: true,
    message: {
      id: Number(info.lastInsertRowid),
      author_email: authorEmail,
      author_name: authorName,
      body,
      created_at: now,
    },
  })
})

const port = Number(process.env.PORT ?? 8787)
const listenHost = process.env.API_LISTEN_HOST || '0.0.0.0'
app.listen(port, listenHost, () => {
  console.log(
    `[workSphere] API on port ${port} (reachable on your LAN for phone testing). Vite proxies /api from the dev server.`,
  )
})
