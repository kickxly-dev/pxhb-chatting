import 'dotenv/config'

import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import session from 'express-session'
import { Server as SocketIOServer } from 'socket.io'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const app = express()
const httpServer = http.createServer(app)

const isProd = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT || 3000)

app.set('trust proxy', 1)

app.use(
  cors({
    origin: isProd ? true : ['http://localhost:5173'],
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))

const sessionMiddleware = session({
  name: 'pxhb.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24 * 14,
  },
})

app.use(sessionMiddleware)

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: isProd ? true : ['http://localhost:5173'],
    credentials: true,
  },
})

io.use((socket, next) => {
  // Attach the same express-session to Socket.IO requests so we can read req.session.userId
  sessionMiddleware(socket.request, {}, () => {
    const userId = socket.request?.session?.userId
    if (userId) socket.data.userId = userId
    next()
  })
})

io.on('connection', (socket) => {
  socket.emit('hello', { ok: true })

  socket.on('channel:join', async (payload) => {
    try {
      const { channelId } = payload || {}
      if (!channelId) return

      const userId = socket.data.userId
      if (!userId) {
        socket.emit('chat:error', { message: 'Not authenticated' })
        return
      }

      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { id: true, serverId: true },
      })

      if (!channel) return

      const membership = await prisma.membership.findUnique({
        where: { userId_serverId: { userId, serverId: channel.serverId } },
        select: { id: true },
      })

      if (!membership) {
        socket.emit('chat:error', { message: 'Not a member' })
        return
      }

      socket.join(`channel:${channelId}`)
    } catch {
      socket.emit('chat:error', { message: 'Failed to join channel' })
    }
  })

  socket.on('chat:send', async (payload) => {
    try {
      const { channelId, content } = payload || {}
      if (!channelId || typeof content !== 'string' || !content.trim()) return

      const userId = socket.data.userId
      if (!userId) {
        socket.emit('chat:error', { message: 'Not authenticated' })
        return
      }

      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { id: true, serverId: true },
      })

      if (!channel) return

      const membership = await prisma.membership.findUnique({
        where: { userId_serverId: { userId, serverId: channel.serverId } },
        select: { id: true },
      })

      if (!membership) {
        socket.emit('chat:error', { message: 'Not a member' })
        return
      }

      const message = await prisma.message.create({
        data: {
          channelId,
          authorId: userId,
          content: content.trim(),
        },
        include: {
          author: { select: { id: true, username: true } },
        },
      })

      io.to(`channel:${channelId}`).emit('chat:message', message)
    } catch {
      socket.emit('chat:error', { message: 'Failed to send message' })
    }
  })
})

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ ok: false, error: 'unauthorized' })
  next()
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body || {}
  if (typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ ok: false, error: 'invalid_username' })
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ ok: false, error: 'invalid_password' })
  }

  const uname = username.trim().toLowerCase()

  const existing = await prisma.user.findUnique({ where: { username: uname } })
  if (existing) return res.status(409).json({ ok: false, error: 'username_taken' })

  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      username: uname,
      passwordHash: hash,
    },
    select: { id: true, username: true },
  })

  req.session.userId = user.id
  res.json({ ok: true, user })
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'invalid_payload' })
  }

  const uname = username.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { username: uname } })
  if (!user) return res.status(401).json({ ok: false, error: 'invalid_credentials' })

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ ok: false, error: 'invalid_credentials' })

  req.session.userId = user.id
  res.json({ ok: true, user: { id: user.id, username: user.username } })
})

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true })
  })
})

app.get('/api/auth/me', async (req, res) => {
  const userId = req.session?.userId
  if (!userId) return res.json({ ok: true, user: null })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } })
  res.json({ ok: true, user })
})

app.get('/api/servers', requireAuth, async (req, res) => {
  const userId = req.session.userId
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      server: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  res.json({ ok: true, servers: memberships.map((m) => m.server) })
})

app.post('/api/servers', requireAuth, async (req, res) => {
  const userId = req.session.userId
  const { name } = req.body || {}
  if (typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ ok: false, error: 'invalid_name' })
  }

  const server = await prisma.server.create({
    data: {
      name: name.trim(),
      ownerId: userId,
      memberships: {
        create: {
          userId,
          role: 'OWNER',
        },
      },
      channels: {
        create: {
          name: 'general',
          type: 'TEXT',
        },
      },
    },
    include: {
      channels: { select: { id: true, name: true, type: true } },
    },
  })

  res.json({ ok: true, server })
})

app.get('/api/servers/:serverId/channels', requireAuth, async (req, res) => {
  const userId = req.session.userId
  const { serverId } = req.params

  const membership = await prisma.membership.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { id: true },
  })

  if (!membership) return res.status(403).json({ ok: false, error: 'forbidden' })

  const channels = await prisma.channel.findMany({
    where: { serverId },
    select: { id: true, name: true, type: true },
    orderBy: { createdAt: 'asc' },
  })

  res.json({ ok: true, channels })
})

app.get('/api/channels/:channelId/messages', requireAuth, async (req, res) => {
  const userId = req.session.userId
  const { channelId } = req.params
  const limit = Math.min(Number(req.query.limit || 50) || 50, 200)

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, serverId: true },
  })

  if (!channel) return res.status(404).json({ ok: false, error: 'not_found' })

  const membership = await prisma.membership.findUnique({
    where: { userId_serverId: { userId, serverId: channel.serverId } },
    select: { id: true },
  })

  if (!membership) return res.status(403).json({ ok: false, error: 'forbidden' })

  const messages = await prisma.message.findMany({
    where: { channelId },
    include: { author: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  res.json({ ok: true, messages: messages.reverse() })
})

if (isProd) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const distPath = path.resolve(__dirname, '../dist')

  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`PXHB Chatting server listening on :${port}`)
})
