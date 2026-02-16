import 'dotenv/config'

import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import session from 'express-session'
import helmet from 'helmet'
import { createClient as createRedisClient } from 'redis'
import { RedisStore } from 'connect-redis'
import { Server as SocketIOServer } from 'socket.io'
import { z } from 'zod'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const app = express()
const httpServer = http.createServer(app)

const isProd = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT || 3000)

app.set('trust proxy', 1)

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
)

app.use(
  cors({
    origin: isProd ? true : ['http://localhost:5173'],
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api', apiLimiter)

let redisStore = undefined
if (process.env.REDIS_URL) {
  const redisClient = createRedisClient({ url: process.env.REDIS_URL })
  redisClient.on('error', () => {})
  await redisClient.connect()
  redisStore = new RedisStore({ client: redisClient, prefix: 'pxhb:' })
}

const sessionMiddleware = session({
  name: 'pxhb.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: redisStore,
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

  socket.on('dm:join', async (payload) => {
    try {
      const { threadId } = payload || {}
      if (!threadId) return

      const userId = socket.data.userId
      if (!userId) {
        socket.emit('chat:error', { message: 'Not authenticated' })
        return
      }

      const thread = await prisma.dmThread.findUnique({
        where: { id: threadId },
        select: { id: true, userAId: true, userBId: true },
      })
      if (!thread) return
      if (thread.userAId !== userId && thread.userBId !== userId) {
        socket.emit('chat:error', { message: 'Forbidden' })
        return
      }

      socket.join(`dm:${threadId}`)
    } catch {
      socket.emit('chat:error', { message: 'Failed to join dm' })
    }
  })

  socket.on('dm:send', async (payload) => {
    try {
      const { threadId, content } = payload || {}
      if (!threadId || typeof content !== 'string' || !content.trim()) return

      const userId = socket.data.userId
      if (!userId) {
        socket.emit('chat:error', { message: 'Not authenticated' })
        return
      }

      const thread = await prisma.dmThread.findUnique({
        where: { id: threadId },
        select: { id: true, userAId: true, userBId: true },
      })
      if (!thread) return
      if (thread.userAId !== userId && thread.userBId !== userId) {
        socket.emit('chat:error', { message: 'Forbidden' })
        return
      }

      const message = await prisma.dmMessage.create({
        data: { threadId, authorId: userId, content: content.trim() },
        include: { author: { select: { id: true, username: true } } },
      })

      io.to(`dm:${threadId}`).emit('dm:message', message)
    } catch {
      socket.emit('chat:error', { message: 'Failed to send dm' })
    }
  })
})

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ ok: false, error: 'unauthorized' })
  next()
}

async function requireMembership(req, res, serverId) {
  const userId = req.session.userId
  const membership = await prisma.membership.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { id: true, role: true },
  })
  if (!membership) {
    res.status(403).json({ ok: false, error: 'forbidden' })
    return null
  }
  return membership
}

function orderedPair(a, b) {
  return a < b ? [a, b] : [b, a]
}

function randomCode(len = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/register', async (req, res) => {
  const parsed = z
    .object({
      username: z.string().min(3),
      password: z.string().min(6),
    })
    .safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_payload' })

  const { username, password } = parsed.data

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

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const parsed = z
    .object({
      username: z.string().min(1),
      password: z.string().min(1),
    })
    .safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_payload' })

  const { username, password } = parsed.data

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

app.post('/api/friends/requests', requireAuth, async (req, res) => {
  const parsed = z
    .object({
      username: z.string().min(1),
    })
    .safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_payload' })

  const fromId = req.session.userId
  const uname = parsed.data.username.trim().toLowerCase()
  if (!uname) return res.status(400).json({ ok: false, error: 'invalid_payload' })

  const toUser = await prisma.user.findUnique({ where: { username: uname }, select: { id: true, username: true } })
  if (!toUser) return res.status(404).json({ ok: false, error: 'user_not_found' })
  if (toUser.id === fromId) return res.status(400).json({ ok: false, error: 'cannot_friend_self' })

  const [userAId, userBId] = orderedPair(fromId, toUser.id)
  const existingFriend = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    select: { id: true },
  })
  if (existingFriend) return res.status(409).json({ ok: false, error: 'already_friends' })

  const existing = await prisma.friendRequest.findUnique({
    where: { fromId_toId: { fromId, toId: toUser.id } },
    select: { id: true, status: true },
  })
  if (existing && existing.status === 'PENDING') {
    return res.status(409).json({ ok: false, error: 'request_already_sent' })
  }

  const inbound = await prisma.friendRequest.findUnique({
    where: { fromId_toId: { fromId: toUser.id, toId: fromId } },
    select: { id: true, status: true },
  })
  if (inbound && inbound.status === 'PENDING') {
    return res.status(409).json({ ok: false, error: 'request_already_received' })
  }

  const request = await prisma.friendRequest.upsert({
    where: { fromId_toId: { fromId, toId: toUser.id } },
    create: { fromId, toId: toUser.id, status: 'PENDING' },
    update: { status: 'PENDING' },
    select: { id: true, status: true, createdAt: true, to: { select: { id: true, username: true } } },
  })

  res.json({ ok: true, request })
})

app.get('/api/friends/requests', requireAuth, async (req, res) => {
  const userId = req.session.userId

  const incoming = await prisma.friendRequest.findMany({
    where: { toId: userId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, createdAt: true, from: { select: { id: true, username: true } } },
  })
  const outgoing = await prisma.friendRequest.findMany({
    where: { fromId: userId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, createdAt: true, to: { select: { id: true, username: true } } },
  })

  res.json({ ok: true, incoming, outgoing })
})

app.post('/api/friends/requests/:requestId/accept', requireAuth, async (req, res) => {
  const userId = req.session.userId
  const { requestId } = req.params

  const fr = await prisma.friendRequest.findUnique({ where: { id: requestId }, select: { id: true, status: true, fromId: true, toId: true } })
  if (!fr) return res.status(404).json({ ok: false, error: 'not_found' })
  if (fr.toId !== userId) return res.status(403).json({ ok: false, error: 'forbidden' })
  if (fr.status !== 'PENDING') return res.status(409).json({ ok: false, error: 'not_pending' })

  const [userAId, userBId] = orderedPair(fr.fromId, fr.toId)

  const friendship = await prisma.$transaction(async (tx) => {
    await tx.friendRequest.update({ where: { id: fr.id }, data: { status: 'ACCEPTED' } })
    return tx.friendship.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId },
      update: {},
      select: { id: true, createdAt: true, userAId: true, userBId: true },
    })
  })

  res.json({ ok: true, friendship })
})

app.post('/api/friends/requests/:requestId/decline', requireAuth, async (req, res) => {
  const userId = req.session.userId
  const { requestId } = req.params

  const fr = await prisma.friendRequest.findUnique({ where: { id: requestId }, select: { id: true, status: true, toId: true } })
  if (!fr) return res.status(404).json({ ok: false, error: 'not_found' })
  if (fr.toId !== userId) return res.status(403).json({ ok: false, error: 'forbidden' })
  if (fr.status !== 'PENDING') return res.status(409).json({ ok: false, error: 'not_pending' })

  await prisma.friendRequest.update({ where: { id: fr.id }, data: { status: 'DECLINED' } })
  res.json({ ok: true })
})

app.post('/api/friends/requests/:requestId/cancel', requireAuth, async (req, res) => {
  const userId = req.session.userId
  const { requestId } = req.params

  const fr = await prisma.friendRequest.findUnique({ where: { id: requestId }, select: { id: true, status: true, fromId: true } })
  if (!fr) return res.status(404).json({ ok: false, error: 'not_found' })
  if (fr.fromId !== userId) return res.status(403).json({ ok: false, error: 'forbidden' })
  if (fr.status !== 'PENDING') return res.status(409).json({ ok: false, error: 'not_pending' })

  await prisma.friendRequest.update({ where: { id: fr.id }, data: { status: 'CANCELED' } })
  res.json({ ok: true })
})

app.get('/api/friends', requireAuth, async (req, res) => {
  const userId = req.session.userId
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      userA: { select: { id: true, username: true } },
      userB: { select: { id: true, username: true } },
    },
  })

  const friends = friendships.map((f) => {
    const other = f.userA.id === userId ? f.userB : f.userA
    return { id: other.id, username: other.username, friendshipId: f.id, createdAt: f.createdAt }
  })

  res.json({ ok: true, friends })
})

app.post('/api/dms/with/:otherUserId', requireAuth, async (req, res) => {
  const userId = req.session.userId
  const { otherUserId } = req.params
  if (!otherUserId || otherUserId === userId) return res.status(400).json({ ok: false, error: 'invalid_user' })

  const [userAId, userBId] = orderedPair(userId, otherUserId)
  const friendship = await prisma.friendship.findUnique({ where: { userAId_userBId: { userAId, userBId } }, select: { id: true } })
  if (!friendship) return res.status(403).json({ ok: false, error: 'friends_required' })

  const thread = await prisma.dmThread.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId },
    update: {},
    select: { id: true, createdAt: true, userAId: true, userBId: true },
  })

  res.json({ ok: true, thread })
})

app.get('/api/dms/threads', requireAuth, async (req, res) => {
  const userId = req.session.userId

  const threads = await prisma.dmThread.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      userA: { select: { id: true, username: true } },
      userB: { select: { id: true, username: true } },
      messages: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  const out = threads.map((t) => {
    const other = t.userA.id === userId ? t.userB : t.userA
    const lastMessageAt = t.messages[0]?.createdAt || null
    return { id: t.id, createdAt: t.createdAt, otherUser: other, lastMessageAt }
  })

  res.json({ ok: true, threads: out })
})

app.get('/api/dms/:threadId/messages', requireAuth, async (req, res) => {
  const userId = req.session.userId
  const { threadId } = req.params
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200)

  const thread = await prisma.dmThread.findUnique({ where: { id: threadId }, select: { id: true, userAId: true, userBId: true } })
  if (!thread) return res.status(404).json({ ok: false, error: 'not_found' })
  if (thread.userAId !== userId && thread.userBId !== userId) return res.status(403).json({ ok: false, error: 'forbidden' })

  const messages = await prisma.dmMessage.findMany({
    where: { threadId },
    include: { author: { select: { id: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  res.json({ ok: true, messages: messages.reverse() })
})

app.post('/api/dms/:threadId/messages', requireAuth, async (req, res) => {
  const userId = req.session.userId
  const { threadId } = req.params
  const parsed = z
    .object({
      content: z.string().min(1).max(2000),
    })
    .safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_payload' })

  const thread = await prisma.dmThread.findUnique({ where: { id: threadId }, select: { id: true, userAId: true, userBId: true } })
  if (!thread) return res.status(404).json({ ok: false, error: 'not_found' })
  if (thread.userAId !== userId && thread.userBId !== userId) return res.status(403).json({ ok: false, error: 'forbidden' })

  const message = await prisma.dmMessage.create({
    data: { threadId, authorId: userId, content: parsed.data.content.trim() },
    include: { author: { select: { id: true, username: true } } },
  })

  res.json({ ok: true, message })
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
  const parsed = z
    .object({
      name: z.string().min(2),
    })
    .safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_payload' })

  const { name } = parsed.data

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

app.post('/api/servers/:serverId/channels', requireAuth, async (req, res) => {
  const { serverId } = req.params
  const parsed = z
    .object({
      name: z.string().min(1),
    })
    .safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_payload' })

  const { name } = parsed.data

  const membership = await requireMembership(req, res, serverId)
  if (!membership) return
  if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }

  try {
    const channel = await prisma.channel.create({
      data: { name: name.trim().toLowerCase().replace(/\s+/g, '-'), serverId, type: 'TEXT' },
      select: { id: true, name: true, type: true },
    })
    res.json({ ok: true, channel })
  } catch {
    res.status(409).json({ ok: false, error: 'channel_exists' })
  }
})

app.patch('/api/channels/:channelId', requireAuth, async (req, res) => {
  const { channelId } = req.params
  const parsed = z
    .object({
      name: z.string().min(1),
    })
    .safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_payload' })

  const { name } = parsed.data

  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, serverId: true } })
  if (!channel) return res.status(404).json({ ok: false, error: 'not_found' })

  const membership = await requireMembership(req, res, channel.serverId)
  if (!membership) return
  if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }

  try {
    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: { name: name.trim().toLowerCase().replace(/\s+/g, '-') },
      select: { id: true, name: true, type: true },
    })
    res.json({ ok: true, channel: updated })
  } catch {
    res.status(409).json({ ok: false, error: 'channel_exists' })
  }
})

app.delete('/api/channels/:channelId', requireAuth, async (req, res) => {
  const { channelId } = req.params

  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, serverId: true } })
  if (!channel) return res.status(404).json({ ok: false, error: 'not_found' })

  const membership = await requireMembership(req, res, channel.serverId)
  if (!membership) return
  if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }

  await prisma.channel.delete({ where: { id: channelId } })
  res.json({ ok: true })
})

app.post('/api/servers/:serverId/invites', requireAuth, async (req, res) => {
  const { serverId } = req.params

  const membership = await requireMembership(req, res, serverId)
  if (!membership) return
  if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }

  let invite = null
  for (let i = 0; i < 5; i++) {
    try {
      invite = await prisma.invite.create({
        data: { code: randomCode(10), serverId, creatorId: req.session.userId },
        select: { code: true },
      })
      break
    } catch {
      invite = null
    }
  }

  if (!invite) return res.status(500).json({ ok: false, error: 'invite_failed' })
  res.json({ ok: true, invite })
})

app.post('/api/invites/:code/join', requireAuth, async (req, res) => {
  const { code } = req.params
  const invite = await prisma.invite.findUnique({ where: { code }, select: { serverId: true } })
  if (!invite) return res.status(404).json({ ok: false, error: 'invalid_invite' })

  const userId = req.session.userId
  const existing = await prisma.membership.findUnique({
    where: { userId_serverId: { userId, serverId: invite.serverId } },
    select: { id: true },
  })
  if (!existing) {
    await prisma.membership.create({ data: { userId, serverId: invite.serverId, role: 'MEMBER' } })
  }

  res.json({ ok: true, serverId: invite.serverId })
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
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`PXHB Chatting server listening on :${port}`)
})
