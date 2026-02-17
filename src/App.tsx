import React, { useEffect, useMemo, useRef, useState } from 'react'
import { io as ioClient, type Socket } from 'socket.io-client'
import { Copy, Hash, MessageCircle, MoreHorizontal, Plus, Reply, Settings, SmilePlus, Users } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  apiAcceptFriendRequest,
  apiCancelFriendRequest,
  apiCreateServer,
  apiCreateChannel,
  apiCreateInvite,
  apiDeclineFriendRequest,
  apiDeleteChannel,
  apiListFriends,
  apiListFriendRequests,
  apiListDmThreads,
  apiJoinInvite,
  apiListChannels,
  apiListMembers,
  apiListDmMessages,
  apiListMessages,
  apiListServers,
  apiLogin,
  apiLogout,
  apiMe,
  apiOpenDmWithUser,
  apiRenameChannel,
  apiRegister,
  apiSendDmMessage,
  apiSendFriendRequest,
  type Channel,
  type DmMessage,
  type DmThread,
  type DmThreadListItem,
  type Friend,
  type FriendRequest,
  type Member as ApiMember,
  type Message as ApiMessage,
  type ReactionSummary,
  type Server,
  type User,
} from '@/lib/api'

function App() {
  const [user, setUser] = useState<User | null>(null)

  const [navMode, setNavMode] = useState<'home' | 'server'>('server')

  const [servers, setServers] = useState<Server[]>([])
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ApiMessage[]>([])
  const [messageText, setMessageText] = useState('')
  const [replyingTo, setReplyingTo] = useState<{ id: string; who: string; preview: string } | null>(null)

  const [members, setMembers] = useState<ApiMember[]>([])

  const socketRef = useRef<Socket | null>(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [socketError, setSocketError] = useState<string | null>(null)
  const [apiHealth, setApiHealth] = useState<'unknown' | 'ok' | 'fail'>('unknown')
  const [socketTarget, setSocketTarget] = useState<string>('')

  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)

  const [createServerOpen, setCreateServerOpen] = useState(false)
  const [newServerName, setNewServerName] = useState('')
  const [createServerBusy, setCreateServerBusy] = useState(false)
  const [createServerError, setCreateServerError] = useState<string | null>(null)

  const [createChannelOpen, setCreateChannelOpen] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [createChannelBusy, setCreateChannelBusy] = useState(false)
  const [createChannelError, setCreateChannelError] = useState<string | null>(null)

  const [renameChannelOpen, setRenameChannelOpen] = useState(false)
  const [renameChannelName, setRenameChannelName] = useState('')
  const [renameChannelBusy, setRenameChannelBusy] = useState(false)
  const [renameChannelError, setRenameChannelError] = useState<string | null>(null)

  const [deleteChannelOpen, setDeleteChannelOpen] = useState(false)
  const [deleteChannelBusy, setDeleteChannelBusy] = useState(false)
  const [deleteChannelError, setDeleteChannelError] = useState<string | null>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string>('')
  const [joinCode, setJoinCode] = useState('')
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const [friendsOpen, setFriendsOpen] = useState(false)
  const [friendsBusy, setFriendsBusy] = useState(false)
  const [friendsError, setFriendsError] = useState<string | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([])
  const [friendUsername, setFriendUsername] = useState('')
  const [sendFriendBusy, setSendFriendBusy] = useState(false)
  const [sendFriendError, setSendFriendError] = useState<string | null>(null)

  const [dmOpen, setDmOpen] = useState(false)
  const [dmBusy, setDmBusy] = useState(false)
  const [dmError, setDmError] = useState<string | null>(null)
  const [dmThread, setDmThread] = useState<DmThread | null>(null)
  const [dmWith, setDmWith] = useState<Friend | null>(null)
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([])
  const [dmText, setDmText] = useState('')

  const [dmThreads, setDmThreads] = useState<DmThreadListItem[]>([])
  const [selectedDmThreadId, setSelectedDmThreadId] = useState<string | null>(null)
  const [dmUnread, setDmUnread] = useState<Record<string, number>>({})

  const initials = useMemo(() => {
    const u = user?.username?.trim()
    return u ? u.slice(0, 1).toUpperCase() : 'G'
  }, [user?.username])

  const formatShortTime = useMemo(() => {
    return (iso: string | null) => {
      if (!iso) return ''
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return ''
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }, [])

  async function refreshMeAndServers() {
    const me = await apiMe()
    setUser(me.user)
    if (me.user) {
      const list = await apiListServers()
      setServers(list.servers)
    } else {
      setServers([])
    }

  }

  async function refreshDmThreads() {
    if (!user) {
      setDmThreads([])
      return
    }
    try {
      const res = await apiListDmThreads()
      setDmThreads(res.threads)
    } catch {
      setDmThreads([])
    }
  }

  async function openDmThreadFromList(item: DmThreadListItem) {
    if (!user) return
    setNavMode('home')
    setSelectedDmThreadId(item.id)
    setDmWith({ id: item.otherUser.id, username: item.otherUser.username, friendshipId: '', createdAt: item.createdAt })
    setDmThread({ id: item.id, createdAt: item.createdAt, userAId: '', userBId: '' })

    setDmUnread((prev) => {
      if (!prev[item.id]) return prev
      const next = { ...prev }
      delete next[item.id]
      return next
    })

    if (socketRef.current?.connected) {
      socketRef.current.emit('dm:join', { threadId: item.id })
    }

    try {
      const m = await apiListDmMessages(item.id, 100)
      setDmMessages(m.messages)
    } catch {
      setDmMessages([])
    }
  }

  function applyReactionDelta(prev: ReactionSummary[] | undefined, emoji: string, added: boolean, viewerUserId: string | null, deltaUserId: string) {
    const list = prev ? [...prev] : []
    const idx = list.findIndex((r) => r.emoji === emoji)
    const viewer = viewerUserId && viewerUserId === deltaUserId
    if (idx === -1) {
      if (!added) return list
      return [...list, { emoji, count: 1, viewerHasReacted: !!viewer }]
    }

    const cur = list[idx]
    const nextCount = Math.max(0, cur.count + (added ? 1 : -1))
    const nextViewer = viewer ? added : cur.viewerHasReacted
    if (nextCount === 0) {
      list.splice(idx, 1)
      return list
    }
    list[idx] = { ...cur, count: nextCount, viewerHasReacted: nextViewer }
    return list
  }

  async function refreshFriendsData() {
    if (!user) {
      setFriends([])
      setIncomingRequests([])
      setOutgoingRequests([])
      return
    }

    setFriendsBusy(true)
    setFriendsError(null)
    try {
      const [f, r] = await Promise.all([apiListFriends(), apiListFriendRequests()])
      setFriends(f.friends)
      setIncomingRequests(r.incoming)
      setOutgoingRequests(r.outgoing)
    } catch (e) {
      setFriendsError(e instanceof Error ? e.message : 'friends_failed')
    } finally {
      setFriendsBusy(false)
    }
  }

  async function onSendFriendRequest() {
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return
    }

    setSendFriendBusy(true)
    setSendFriendError(null)
    try {
      const uname = friendUsername.trim()
      if (!uname) throw new Error('invalid_username')
      await apiSendFriendRequest(uname)
      setFriendUsername('')
      await refreshFriendsData()
    } catch (e) {
      setSendFriendError(e instanceof Error ? e.message : 'send_failed')
    } finally {
      setSendFriendBusy(false)
    }
  }

  async function onAcceptRequest(requestId: string) {
    try {
      await apiAcceptFriendRequest(requestId)
      await refreshFriendsData()
    } catch (e) {
      setFriendsError(e instanceof Error ? e.message : 'accept_failed')
    }
  }

  async function onDeclineRequest(requestId: string) {
    try {
      await apiDeclineFriendRequest(requestId)
      await refreshFriendsData()
    } catch (e) {
      setFriendsError(e instanceof Error ? e.message : 'decline_failed')
    }
  }

  async function onCancelRequest(requestId: string) {
    try {
      await apiCancelFriendRequest(requestId)
      await refreshFriendsData()
    } catch (e) {
      setFriendsError(e instanceof Error ? e.message : 'cancel_failed')
    }
  }

  async function openDm(friend: Friend) {
    if (!user) return
    setDmOpen(true)
    setDmBusy(true)
    setDmError(null)
    setDmWith(friend)
    setDmThread(null)
    setDmMessages([])
    setDmText('')

    try {
      const t = await apiOpenDmWithUser(friend.id)
      setDmThread(t.thread)
      if (socketRef.current?.connected) {
        socketRef.current.emit('dm:join', { threadId: t.thread.id })
      }
      const m = await apiListDmMessages(t.thread.id, 100)
      setDmMessages(m.messages)
    } catch (e) {
      setDmError(e instanceof Error ? e.message : 'dm_failed')
    } finally {
      setDmBusy(false)
    }
  }

  async function onSendDm() {
    if (!dmThread) return
    const content = dmText.trim()
    if (!content) return
    setDmText('')
    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit('dm:send', { threadId: dmThread.id, content })
        return
      }
      const res = await apiSendDmMessage(dmThread.id, content)
      setDmMessages((prev) => [...prev, res.message])
    } catch (e) {
      setDmError(e instanceof Error ? e.message : 'send_failed')
    }
  }

  useEffect(() => {
    refreshMeAndServers().catch(() => {
      setUser(null)
      setServers([])
    })

    fetch('/api/health', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setApiHealth(j?.ok === true ? 'ok' : 'fail')
      })
      .catch(() => setApiHealth('fail'))
  }, [])

  useEffect(() => {
    if (!user) {
      setSelectedServerId(null)
      setChannels([])
      setSelectedChannelId(null)
      setMessages([])
      setDmThreads([])
      setSelectedDmThreadId(null)
      setDmUnread({})
      setReplyingTo(null)
      return
    }

    if (!selectedServerId && servers.length) {
      setSelectedServerId(servers[0].id)
    }
  }, [user, servers, selectedServerId])

  useEffect(() => {
    if (!user) return
    if (navMode !== 'home') return
    refreshDmThreads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navMode])

  useEffect(() => {
    if (!user || !selectedServerId || navMode !== 'server') {
      setChannels([])
      setSelectedChannelId(null)
      setMembers([])
      return
    }

    apiListChannels(selectedServerId)
      .then((res) => {
        setChannels(res.channels)
        if (!selectedChannelId && res.channels.length) {
          setSelectedChannelId(res.channels[0].id)
        }
      })
      .catch(() => {
        setChannels([])
        setSelectedChannelId(null)
      })

    apiListMembers(selectedServerId)
      .then((res) => setMembers(res.members))
      .catch(() => setMembers([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedServerId, navMode])

  useEffect(() => {
    if (!user || !selectedChannelId || navMode !== 'server') {
      setMessages([])
      return
    }

    apiListMessages(selectedChannelId, 75)
      .then((res) => setMessages(res.messages))
      .catch(() => setMessages([]))
  }, [user, selectedChannelId, navMode])

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect()
      socketRef.current = null
      setSocketConnected(false)
      setSocketError(null)
      return
    }

    if (socketRef.current) return

    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '5173'
    const socketUrl = isDev ? 'http://localhost:3000' : undefined

    setSocketTarget(socketUrl || window.location.origin)

    const s = ioClient(socketUrl, {
      withCredentials: true,
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      timeout: 5000,
    })

    s.on('connect', () => {
      setSocketConnected(true)
      setSocketError(null)

      if (selectedChannelId) {
        s.emit('channel:join', { channelId: selectedChannelId })
      }

      if (dmThread?.id) {
        s.emit('dm:join', { threadId: dmThread.id })
      }
    })
    s.on('disconnect', () => setSocketConnected(false))
    s.on('connect_error', (err) => {
      setSocketConnected(false)
      setSocketError(err?.message || 'connect_error')
    })

    s.on('chat:message', (msg: ApiMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })

    s.on('chat:reaction', (payload: { messageId: string; emoji: string; userId: string; added: boolean }) => {
      const viewerUserId = user?.id || null
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== payload.messageId) return m
          const reactions = applyReactionDelta(m.reactions, payload.emoji, payload.added, viewerUserId, payload.userId)
          return { ...m, reactions }
        }),
      )
    })

    s.on('dm:message', (msg: DmMessage) => {
      setDmMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })

      setDmThreads((prev) => {
        const existing = prev.find((t) => t.id === msg.threadId)
        const updated = existing
          ? prev.map((t) => (t.id === msg.threadId ? { ...t, lastMessageAt: msg.createdAt } : t))
          : prev
        const score = (t: DmThreadListItem) => {
          const d = new Date(t.lastMessageAt || t.createdAt)
          return Number.isNaN(d.getTime()) ? 0 : d.getTime()
        }
        return [...updated].sort((a, b) => score(b) - score(a))
      })

      const isActive = navMode === 'home' && selectedDmThreadId === msg.threadId
      if (!isActive) {
        setDmUnread((prev) => ({ ...prev, [msg.threadId]: (prev[msg.threadId] || 0) + 1 }))
      }
    })

    s.on('dm:reaction', (payload: { threadId: string; messageId: string; emoji: string; userId: string; added: boolean }) => {
      const viewerUserId = user?.id || null
      setDmMessages((prev) =>
        prev.map((m) => {
          if (m.id !== payload.messageId) return m
          const reactions = applyReactionDelta(m.reactions, payload.emoji, payload.added, viewerUserId, payload.userId)
          return { ...m, reactions }
        }),
      )
    })

    s.on('chat:error', (payload: unknown) => {
      if (payload && typeof payload === 'object' && 'message' in payload) {
        const msg = (payload as { message?: unknown }).message
        setSocketError(typeof msg === 'string' && msg ? msg : 'chat_error')
        return
      }
      setSocketError('chat_error')
    })

    socketRef.current = s
    return () => {
      s.disconnect()
      if (socketRef.current === s) socketRef.current = null
      setSocketConnected(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedChannelId])

  useEffect(() => {
    if (!selectedChannelId) return
    if (!socketConnected) return
    if (navMode !== 'server') return
    socketRef.current?.emit('channel:join', { channelId: selectedChannelId })
  }, [selectedChannelId, socketConnected, navMode])

  useEffect(() => {
    if (!selectedDmThreadId) return
    if (!socketConnected) return
    if (navMode !== 'home') return
    socketRef.current?.emit('dm:join', { threadId: selectedDmThreadId })
  }, [selectedDmThreadId, socketConnected, navMode])

  useEffect(() => {
    if (!selectedDmThreadId) return
    setDmUnread((prev) => {
      if (!prev[selectedDmThreadId]) return prev
      const next = { ...prev }
      delete next[selectedDmThreadId]
      return next
    })
  }, [selectedDmThreadId])

  function onSendMessage() {
    const content = messageText.trim()
    if (!content) return
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return
    }

    if (!socketConnected || !socketRef.current) {
      setSocketError('socket_not_connected')
      return
    }

    const replyToId = replyingTo?.id || undefined

    if (navMode === 'server') {
      if (!selectedChannelId) return
      socketRef.current.emit('chat:send', { channelId: selectedChannelId, content, replyToId })
      setMessageText('')
      setReplyingTo(null)
      return
    }

    if (navMode === 'home') {
      if (!selectedDmThreadId) return
      socketRef.current.emit('dm:send', { threadId: selectedDmThreadId, content, replyToId })
      setMessageText('')
      setReplyingTo(null)
    }
  }

  function onToggleReaction(messageId: string, emoji: string) {
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return
    }
    if (!socketConnected || !socketRef.current) {
      setSocketError('socket_not_connected')
      return
    }
    if (navMode === 'server') {
      socketRef.current.emit('chat:react', { messageId, emoji })
      return
    }
    if (navMode === 'home') {
      socketRef.current.emit('dm:react', { messageId, emoji })
    }
  }

  async function onCreateChannel() {
    if (!user || !selectedServerId) return
    setCreateChannelBusy(true)
    setCreateChannelError(null)
    try {
      const name = newChannelName.trim()
      if (!name) throw new Error('invalid_name')
      const created = await apiCreateChannel(selectedServerId, name)
      setNewChannelName('')
      setCreateChannelOpen(false)
      const res = await apiListChannels(selectedServerId)
      setChannels(res.channels)
      setSelectedChannelId(created.channel.id)
    } catch (e) {
      setCreateChannelError(e instanceof Error ? e.message : 'create_failed')
    } finally {
      setCreateChannelBusy(false)
    }
  }

  async function onRenameChannel() {
    if (!user || !selectedChannelId) return
    setRenameChannelBusy(true)
    setRenameChannelError(null)
    try {
      const name = renameChannelName.trim()
      if (!name) throw new Error('invalid_name')
      const updated = await apiRenameChannel(selectedChannelId, name)
      setRenameChannelOpen(false)
      setChannels((prev) => prev.map((c) => (c.id === updated.channel.id ? updated.channel : c)))
    } catch (e) {
      setRenameChannelError(e instanceof Error ? e.message : 'rename_failed')
    } finally {
      setRenameChannelBusy(false)
    }
  }

  async function onDeleteChannel() {
    if (!user || !selectedServerId || !selectedChannelId) return
    setDeleteChannelBusy(true)
    setDeleteChannelError(null)
    try {
      const deletingId = selectedChannelId
      await apiDeleteChannel(deletingId)
      setDeleteChannelOpen(false)
      const res = await apiListChannels(selectedServerId)
      setChannels(res.channels)
      const nextId = res.channels[0]?.id || null
      setSelectedChannelId(nextId)
    } catch (e) {
      setDeleteChannelError(e instanceof Error ? e.message : 'delete_failed')
    } finally {
      setDeleteChannelBusy(false)
    }
  }

  async function onCreateInvite() {
    if (!user || !selectedServerId) return
    setInviteBusy(true)
    setInviteError(null)
    try {
      const res = await apiCreateInvite(selectedServerId)
      setInviteCode(res.invite.code)
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : 'invite_failed')
    } finally {
      setInviteBusy(false)
    }
  }

  async function onJoinInvite() {
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return
    }
    const code = joinCode.trim()
    if (!code) return
    setJoinBusy(true)
    setJoinError(null)
    try {
      const res = await apiJoinInvite(code)
      await refreshMeAndServers()
      setSelectedServerId(res.serverId)
      setInviteOpen(false)
      setJoinCode('')
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'join_failed')
    } finally {
      setJoinBusy(false)
    }
  }

  async function onSubmitAuth() {
    setAuthBusy(true)
    setAuthError(null)
    try {
      if (authMode === 'login') {
        const res = await apiLogin(authUsername, authPassword)
        setUser(res.user)
      } else {
        const res = await apiRegister(authUsername, authPassword)
        setUser(res.user)
      }
      setAuthOpen(false)
      setAuthPassword('')
      await refreshMeAndServers()
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'auth_failed')
    } finally {
      setAuthBusy(false)
    }
  }

  async function onLogout() {
    try {
      await apiLogout()
    } finally {
      setUser(null)
      setServers([])
    }
  }

  async function onCreateServer() {
    setCreateServerBusy(true)
    setCreateServerError(null)
    try {
      const name = newServerName.trim()
      if (!name) throw new Error('invalid_name')
      const created = await apiCreateServer(name)
      setNewServerName('')
      setCreateServerOpen(false)
      setSelectedServerId(created.server.id)
      const general = created.server.channels?.[0]
      setSelectedChannelId(general?.id || null)
      await refreshMeAndServers()
    } catch (e) {
      setCreateServerError(e instanceof Error ? e.message : 'create_failed')
    } finally {
      setCreateServerBusy(false)
    }
  }

  return (
    <div className="h-full w-full bg-px-bg">
      <div className="grid h-full w-full grid-cols-[72px_260px_1fr_280px]">
        <aside className="bg-px-rail border-r border-white/10 p-2">
          <div className="flex h-full flex-col items-center gap-2">
            <div className="h-12 w-12 rounded-2xl bg-px-brand/90 shadow-soft grid place-items-center font-black">PX</div>

            <button
              type="button"
              className={
                navMode === 'home'
                  ? 'h-12 w-12 rounded-2xl bg-white/20 grid place-items-center text-sm font-black transition-colors'
                  : 'h-12 w-12 rounded-2xl bg-white/10 grid place-items-center text-sm font-black transition-colors hover:bg-white/15'
              }
              title="Home"
              onClick={() => {
                setNavMode('home')
                refreshDmThreads()
              }}
            >
              <MessageCircle className="h-5 w-5 text-px-text" />
            </button>

            {servers.slice(0, 8).map((s) => (
              <button
                key={s.id}
                type="button"
                className={
                  navMode === 'server' && s.id === selectedServerId
                    ? 'h-12 w-12 rounded-2xl bg-white/20 grid place-items-center text-sm font-black transition-colors'
                    : 'h-12 w-12 rounded-2xl bg-white/10 grid place-items-center text-sm font-black transition-colors hover:bg-white/15'
                }
                title={s.name}
                onClick={() => {
                  setNavMode('server')
                  setSelectedServerId(s.id)
                }}
              >
                {s.name.slice(0, 1).toUpperCase()}
              </button>
            ))}

            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 rounded-2xl bg-white/10 text-px-text2 hover:bg-white/15"
              onClick={() => {
                if (!user) {
                  setAuthMode('login')
                  setAuthOpen(true)
                  return
                }
                setCreateServerOpen(true)
              }}
            >
              <Plus className="h-5 w-5" />
            </Button>
            <div className="mt-auto h-12 w-12 rounded-2xl bg-white/10 grid place-items-center text-sm text-px-text2">
              <Settings className="h-5 w-5" />
            </div>
          </div>
        </aside>

        <aside className="bg-px-panel border-r border-white/10 flex h-full flex-col">
          <div className="p-3">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-white/10" />
              <div className="min-w-0">
                <div className="truncate font-extrabold">PXHB Chatting</div>
                <div className="truncate text-xs text-px-text2">
                  {navMode === 'home'
                    ? 'Home'
                    : selectedServerId
                      ? servers.find((s) => s.id === selectedServerId)?.name || 'Server'
                      : 'No server'}
                </div>
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-extrabold tracking-wide text-px-text2">{navMode === 'home' ? 'DIRECT MESSAGES' : 'TEXT CHANNELS'}</div>
              {navMode === 'home' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-7 w-7 rounded-lg bg-white/5 text-px-text2 hover:bg-white/10">
                      ⋯
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        if (!user) {
                          setAuthMode('login')
                          setAuthOpen(true)
                          return
                        }
                        setFriendsOpen(true)
                        refreshFriendsData()
                      }}
                    >
                      Friends
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        refreshDmThreads()
                      }}
                    >
                      Refresh DMs
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7 rounded-lg bg-white/5 text-px-text2 hover:bg-white/10"
                  onClick={() => {
                    if (!user) {
                      setAuthMode('login')
                      setAuthOpen(true)
                      return
                    }
                    setCreateChannelOpen(true)
                  }}
                >
                  +
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 px-3">
            <nav className="space-y-1 pb-3">
              {navMode === 'home' ? (
                dmThreads.length ? (
                  dmThreads.map((t) => (
                    <ChannelButton
                      key={t.id}
                      active={t.id === selectedDmThreadId}
                      onClick={() => openDmThreadFromList(t)}
                      leading={
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px]">{t.otherUser.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      }
                      trailing={
                        <div className="flex items-center gap-2">
                          {dmUnread[t.id] ? (
                            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-px-brand px-1.5 text-[10px] font-extrabold text-white">
                              {dmUnread[t.id] > 99 ? '99+' : String(dmUnread[t.id])}
                            </span>
                          ) : null}
                          <span className="text-[10px] text-px-text2">{formatShortTime(t.lastMessageAt)}</span>
                        </div>
                      }
                      subtitle={t.lastMessageAt ? 'Active' : 'Say hi'}
                    >
                      {t.otherUser.username}
                    </ChannelButton>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-px-text2">
                    Start a DM from
                    {' '}
                    <span className="font-semibold text-px-text">Friends</span>
                    .
                  </div>
                )
              ) : channels.length ? (
                channels.map((c) => (
                  <ChannelButton
                    key={c.id}
                    active={c.id === selectedChannelId}
                    onClick={() => setSelectedChannelId(c.id)}
                    leading={<Hash className="h-4 w-4 text-px-text2" />}
                  >
                    {c.name}
                  </ChannelButton>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-px-text2">No channels</div>
              )}
            </nav>
          </ScrollArea>

          <div className="p-3">
            <Separator className="mb-3 bg-white/10" />
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-extrabold text-px-text2">ACCOUNT</div>
              <div className="mt-2 flex items-center gap-2">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-bold">{user ? user.username : 'Guest'}</div>
                  <div className="truncate text-xs text-px-text2">{user ? 'online' : 'offline'}</div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                {user ? (
                  <Button
                    variant="secondary"
                    className="h-9 w-full bg-white/5 text-px-text2 hover:bg-white/10"
                    onClick={onLogout}
                  >
                    Logout
                  </Button>
                ) : (
                  <Button
                    className="h-9 w-full bg-px-brand text-white hover:bg-px-brand/90"
                    onClick={() => {
                      setAuthMode('login')
                      setAuthOpen(true)
                    }}
                  >
                    Login
                  </Button>
                )}
              </div>
            </div>
          </div>
        </aside>

        <main className="bg-px-panel2 flex h-full flex-col">
          <header className="flex h-14 items-center justify-between border-b border-white/10 px-4">
            <div className="flex items-center gap-3">
              <div className="font-extrabold">
                {navMode === 'home'
                  ? `@ ${dmThreads.find((t) => t.id === selectedDmThreadId)?.otherUser.username || 'direct-messages'}`
                  : `# ${channels.find((c) => c.id === selectedChannelId)?.name || 'general'}`}
              </div>
              <div className="text-sm text-px-text2">
                API: {apiHealth}
                {' • '}
                Socket: {socketConnected ? 'connected' : 'connecting…'}
                {socketError ? ` (${socketError})` : ''}
                {socketTarget ? ` @ ${socketTarget}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
                onClick={() => {
                  if (!user) {
                    setAuthMode('login')
                    setAuthOpen(true)
                    return
                  }
                  setFriendsOpen(true)
                  setFriendsError(null)
                  setSendFriendError(null)
                  refreshFriendsData()
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                Friends
              </Button>
              <Button
                variant="secondary"
                className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
                onClick={() => {
                  setInviteError(null)
                  setInviteCode('')
                  setJoinError(null)
                  setInviteOpen(true)
                }}
              >
                Invite
              </Button>
              <Button
                variant="secondary"
                className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
                onClick={() => {
                  const cur = channels.find((c) => c.id === selectedChannelId)
                  setRenameChannelName(cur?.name || '')
                  setRenameChannelError(null)
                  setRenameChannelOpen(true)
                }}
                disabled={!user || !selectedChannelId}
              >
                Rename
              </Button>
              <Button
                variant="secondary"
                className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
                onClick={() => {
                  setDeleteChannelError(null)
                  setDeleteChannelOpen(true)
                }}
                disabled={!user || !selectedChannelId}
              >
                Delete
              </Button>
              {user ? (
                <Button variant="secondary" className="h-9 bg-white/5 text-px-text2 hover:bg-white/10" onClick={onLogout}>
                  Logout
                </Button>
              ) : (
                <Button
                  className="h-9 bg-px-brand text-white hover:bg-px-brand/90"
                  onClick={() => {
                    setAuthMode('login')
                    setAuthOpen(true)
                  }}
                >
                  Login
                </Button>
              )}
            </div>
          </header>

          <ScrollArea className="flex-1">
            <div className="p-4">
              <div className="mx-auto flex max-w-3xl flex-col gap-3">
                {!user ? (
                  <Message who="System" text="Login to load your servers and start chatting." tone="system" />
                ) : navMode === 'server' && servers.length === 0 ? (
                  <Message who="System" text="You have no servers yet. Click the + in the left rail to create one." tone="system" />
                ) : navMode === 'server' && !selectedChannelId ? (
                  <Message who="System" text="Select a channel to load messages." tone="system" />
                ) : navMode === 'home' && !selectedDmThreadId ? (
                  <Message who="System" text="Select a DM to start chatting." tone="system" />
                ) : null}
                {navMode === 'home'
                  ? dmMessages.map((m, idx) => {
                      const prev = dmMessages[idx - 1]
                      const sameAuthor = prev && prev.author.id === m.author.id
                      const showHeader = !sameAuthor
                      return (
                        <Message
                          key={m.id}
                          who={m.author.username}
                          text={m.content}
                          tone={m.author.id === user?.id ? 'me' : 'bot'}
                          createdAt={m.createdAt}
                          showHeader={showHeader}
                          replyPreview={m.replyTo ? { who: m.replyTo.author.username, text: m.replyTo.content } : null}
                          reactions={m.reactions}
                          onReact={(emoji) => onToggleReaction(m.id, emoji)}
                          onReply={() => {
                            setReplyingTo({ id: m.id, who: m.author.username, preview: m.content.slice(0, 80) })
                          }}
                        />
                      )
                    })
                  : messages.map((m, idx) => {
                      const prev = messages[idx - 1]
                      const sameAuthor = prev && prev.author.id === m.author.id
                      const showHeader = !sameAuthor
                      return (
                        <Message
                          key={m.id}
                          who={m.author.username}
                          text={m.content}
                          tone={m.author.id === user?.id ? 'me' : 'bot'}
                          createdAt={m.createdAt}
                          showHeader={showHeader}
                          replyPreview={m.replyTo ? { who: m.replyTo.author.username, text: m.replyTo.content } : null}
                          reactions={m.reactions}
                          onReact={(emoji) => onToggleReaction(m.id, emoji)}
                          onReply={() => {
                            setReplyingTo({ id: m.id, who: m.author.username, preview: m.content.slice(0, 80) })
                          }}
                        />
                      )
                    })}
              </div>
            </div>
          </ScrollArea>

          <footer className="border-t border-white/10 p-3">
            <div className="mx-auto flex max-w-3xl flex-col gap-2">
              {replyingTo ? (
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-extrabold text-px-text2">
                      Replying to <span className="text-px-text">{replyingTo.who}</span>
                    </div>
                    <div className="truncate text-xs text-px-text2">{replyingTo.preview}</div>
                  </div>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-xl bg-white/5 text-px-text2 hover:bg-white/10"
                    onClick={() => setReplyingTo(null)}
                  >
                    ×
                  </Button>
                </div>
              ) : null}

              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <Button variant="secondary" size="icon" className="h-9 w-9 rounded-xl bg-white/5 text-px-text2 hover:bg-white/10">
                +
              </Button>
              <Input
                className="h-10 flex-1 border-0 bg-transparent text-px-text placeholder:text-px-text2 focus-visible:ring-0"
                placeholder={
                  navMode === 'home'
                    ? selectedDmThreadId
                      ? 'Message this DM'
                      : 'Select a DM'
                    : selectedChannelId
                      ? 'Message this channel'
                      : 'Select a channel'
                }
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSendMessage()
                }}
                disabled={navMode === 'home' ? !selectedDmThreadId || !socketConnected : !selectedChannelId || !socketConnected}
              />
              <Button
                className="h-9 rounded-xl bg-px-brand px-4 font-extrabold text-white hover:bg-px-brand/90"
                onClick={onSendMessage}
                disabled={navMode === 'home' ? !selectedDmThreadId || !socketConnected : !selectedChannelId || !socketConnected}
              >
                Send
              </Button>
            </div>
            </div>
          </footer>
        </main>

        {navMode === 'server' ? (
          <aside className="bg-px-panel border-l border-white/10 flex h-full flex-col">
            <div className="p-3">
              <div className="mb-3 text-xs font-extrabold tracking-wide text-px-text2">MEMBERS</div>
            </div>
            <ScrollArea className="flex-1 px-3">
              <div className="space-y-2 pb-3">
                {members.length ? (
                  members.map((m) => <Member key={m.id} name={m.username} status="online" />)
                ) : (
                  <Member name="No members" status="offline" />
                )}
              </div>
            </ScrollArea>
          </aside>
        ) : (
          <aside className="bg-px-panel border-l border-white/10 flex h-full flex-col">
            <div className="p-3">
              <div className="mb-3 text-xs font-extrabold tracking-wide text-px-text2">HOME</div>
            </div>
            <ScrollArea className="flex-1 px-3">
              <div className="space-y-2 pb-3">
                <Member name={user ? user.username : 'Guest'} status={user ? 'online' : 'offline'} />
              </div>
            </ScrollArea>
          </aside>
        )}
      </div>

      <Dialog
        open={friendsOpen}
        onOpenChange={(o) => {
          setFriendsOpen(o)
          if (o) refreshFriendsData()
        }}
      >
        <DialogContent className="bg-px-panel border-white/10 text-px-text">
          <DialogHeader>
            <DialogTitle>Friends</DialogTitle>
            <DialogDescription>Send friend requests by username. Friends are required before DMs.</DialogDescription>
          </DialogHeader>

          {!user ? (
            <div className="text-sm text-px-text2">Login to manage friends.</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-extrabold tracking-wide text-px-text2">ADD FRIEND</div>
                <div className="flex gap-2">
                  <Input value={friendUsername} onChange={(e) => setFriendUsername(e.target.value)} placeholder="username" />
                  <Button onClick={onSendFriendRequest} disabled={sendFriendBusy} className="bg-px-brand text-white hover:bg-px-brand/90">
                    Send
                  </Button>
                </div>
                {sendFriendError ? <div className="text-sm text-red-400">{sendFriendError}</div> : null}
              </div>

              {friendsError ? <div className="text-sm text-red-400">{friendsError}</div> : null}
              {friendsBusy ? <div className="text-sm text-px-text2">Loading…</div> : null}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-extrabold tracking-wide text-px-text2">INCOMING</div>
                  <div className="space-y-2">
                    {incomingRequests.length ? (
                      incomingRequests.map((r) => (
                        <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-sm font-bold">{r.from?.username || 'unknown'}</div>
                          <div className="mt-2 flex gap-2">
                            <Button className="h-8 bg-px-brand text-white hover:bg-px-brand/90" onClick={() => onAcceptRequest(r.id)}>
                              Accept
                            </Button>
                            <Button
                              variant="secondary"
                              className="h-8 bg-white/5 text-px-text2 hover:bg-white/10"
                              onClick={() => onDeclineRequest(r.id)}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-px-text2">No incoming requests</div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-extrabold tracking-wide text-px-text2">OUTGOING</div>
                  <div className="space-y-2">
                    {outgoingRequests.length ? (
                      outgoingRequests.map((r) => (
                        <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-sm font-bold">{r.to?.username || 'unknown'}</div>
                          <div className="mt-2 flex gap-2">
                            <Button
                              variant="secondary"
                              className="h-8 bg-white/5 text-px-text2 hover:bg-white/10"
                              onClick={() => onCancelRequest(r.id)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-px-text2">No outgoing requests</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-extrabold tracking-wide text-px-text2">FRIENDS</div>
                <div className="space-y-2">
                  {friends.length ? (
                    friends.map((f) => (
                      <div key={f.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold">{f.username}</div>
                          <div className="truncate text-xs text-px-text2">{f.id}</div>
                        </div>
                        <Button className="h-8 bg-px-brand text-white hover:bg-px-brand/90" onClick={() => openDm(f)}>
                          DM
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-px-text2">No friends yet</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="secondary" className="bg-white/5 text-px-text2 hover:bg-white/10" onClick={() => setFriendsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dmOpen} onOpenChange={setDmOpen}>
        <DialogContent className="bg-px-panel border-white/10 text-px-text">
          <DialogHeader>
            <DialogTitle>DM {dmWith ? `with ${dmWith.username}` : ''}</DialogTitle>
            <DialogDescription>{dmThread ? `Thread ${dmThread.id}` : 'Loading thread…'}</DialogDescription>
          </DialogHeader>

          {dmError ? <div className="text-sm text-red-400">{dmError}</div> : null}
          {dmBusy ? <div className="text-sm text-px-text2">Loading…</div> : null}

          <div className="max-h-[50vh] overflow-auto rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="space-y-2">
              {dmMessages.length ? (
                dmMessages.map((m) => (
                  <div key={m.id} className="text-sm">
                    <span className="font-extrabold">{m.author.username}</span>
                    <span className="text-px-text2">: </span>
                    <span>{m.content}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-px-text2">No messages yet</div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={dmText}
              onChange={(e) => setDmText(e.target.value)}
              placeholder="Message"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSendDm()
              }}
            />
            <Button className="bg-px-brand text-white hover:bg-px-brand/90" onClick={onSendDm} disabled={!dmThread}>
              Send
            </Button>
          </div>

          <DialogFooter>
            <Button variant="secondary" className="bg-white/5 text-px-text2 hover:bg-white/10" onClick={() => setDmOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createChannelOpen}
        onOpenChange={(o) => {
          setCreateChannelOpen(o)
          if (!o) {
            setCreateChannelError(null)
            setNewChannelName('')
          }
        }}
      >
        <DialogContent className="border-white/10 bg-px-panel text-px-text">
          <DialogHeader>
            <DialogTitle>Create channel</DialogTitle>
            <DialogDescription className="text-px-text2">Create a new text channel.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="channel-name"
              className="border-white/10 bg-white/5 text-px-text placeholder:text-px-text2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCreateChannel()
              }}
            />
            {createChannelError ? <div className="text-sm font-semibold text-red-400">{createChannelError}</div> : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
              onClick={() => setCreateChannelOpen(false)}
              disabled={createChannelBusy}
            >
              Cancel
            </Button>
            <Button
              className="h-9 bg-px-brand text-white hover:bg-px-brand/90"
              onClick={onCreateChannel}
              disabled={createChannelBusy}
            >
              {createChannelBusy ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameChannelOpen}
        onOpenChange={(o) => {
          setRenameChannelOpen(o)
          if (!o) setRenameChannelError(null)
        }}
      >
        <DialogContent className="border-white/10 bg-px-panel text-px-text">
          <DialogHeader>
            <DialogTitle>Rename channel</DialogTitle>
            <DialogDescription className="text-px-text2">Change the channel name.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={renameChannelName}
              onChange={(e) => setRenameChannelName(e.target.value)}
              placeholder="channel-name"
              className="border-white/10 bg-white/5 text-px-text placeholder:text-px-text2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRenameChannel()
              }}
            />
            {renameChannelError ? <div className="text-sm font-semibold text-red-400">{renameChannelError}</div> : null}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
              onClick={() => setRenameChannelOpen(false)}
              disabled={renameChannelBusy}
            >
              Cancel
            </Button>
            <Button
              className="h-9 bg-px-brand text-white hover:bg-px-brand/90"
              onClick={onRenameChannel}
              disabled={renameChannelBusy}
            >
              {renameChannelBusy ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteChannelOpen}
        onOpenChange={(o) => {
          setDeleteChannelOpen(o)
          if (!o) setDeleteChannelError(null)
        }}
      >
        <DialogContent className="border-white/10 bg-px-panel text-px-text">
          <DialogHeader>
            <DialogTitle>Delete channel</DialogTitle>
            <DialogDescription className="text-px-text2">This deletes the channel and its messages.</DialogDescription>
          </DialogHeader>
          {deleteChannelError ? <div className="text-sm font-semibold text-red-400">{deleteChannelError}</div> : null}
          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
              onClick={() => setDeleteChannelOpen(false)}
              disabled={deleteChannelBusy}
            >
              Cancel
            </Button>
            <Button
              className="h-9 bg-red-500/80 text-white hover:bg-red-500"
              onClick={onDeleteChannel}
              disabled={deleteChannelBusy}
            >
              {deleteChannelBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          setInviteOpen(o)
          if (!o) {
            setInviteError(null)
            setInviteCode('')
            setJoinError(null)
          }
        }}
      >
        <DialogContent className="border-white/10 bg-px-panel text-px-text">
          <DialogHeader>
            <DialogTitle>Invites</DialogTitle>
            <DialogDescription className="text-px-text2">Create an invite link or join using a code.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <Button
                className="h-9 bg-px-brand text-white hover:bg-px-brand/90"
                onClick={onCreateInvite}
                disabled={!selectedServerId || inviteBusy}
              >
                {inviteBusy ? 'Creating…' : 'Create invite'}
              </Button>
              {inviteCode ? <div className="text-sm text-px-text2">Code: {inviteCode}</div> : null}
            </div>
            {inviteError ? <div className="text-sm font-semibold text-red-400">{inviteError}</div> : null}
            <Separator className="bg-white/10" />
            <div className="grid gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Invite code"
                className="border-white/10 bg-white/5 text-px-text placeholder:text-px-text2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onJoinInvite()
                }}
              />
              <Button className="h-9 bg-white/10 text-px-text hover:bg-white/15" onClick={onJoinInvite} disabled={joinBusy}>
                {joinBusy ? 'Joining…' : 'Join server'}
              </Button>
              {joinError ? <div className="text-sm font-semibold text-red-400">{joinError}</div> : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={authOpen}
        onOpenChange={(o) => {
          setAuthOpen(o)
          if (!o) {
            setAuthError(null)
            setAuthPassword('')
          }
        }}
      >
        <DialogContent className="border-white/10 bg-px-panel text-px-text">
          <DialogHeader>
            <DialogTitle>{authMode === 'login' ? 'Login' : 'Create account'}</DialogTitle>
            <DialogDescription className="text-px-text2">
              {authMode === 'login'
                ? 'Welcome back. Login to access servers and realtime chat.'
                : 'Pick a username and password. You can change this later.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              placeholder="Username"
              className="border-white/10 bg-white/5 text-px-text placeholder:text-px-text2"
              autoCapitalize="none"
              autoComplete="username"
            />
            <Input
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Password"
              type="password"
              className="border-white/10 bg-white/5 text-px-text placeholder:text-px-text2"
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmitAuth()
              }}
            />
            {authError ? <div className="text-sm font-semibold text-red-400">{authError}</div> : null}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
              onClick={() => {
                setAuthError(null)
                setAuthMode(authMode === 'login' ? 'register' : 'login')
              }}
              disabled={authBusy}
            >
              {authMode === 'login' ? 'Create account' : 'Have an account? Login'}
            </Button>
            <Button className="h-9 bg-px-brand text-white hover:bg-px-brand/90" onClick={onSubmitAuth} disabled={authBusy}>
              {authBusy ? 'Please wait…' : authMode === 'login' ? 'Login' : 'Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createServerOpen}
        onOpenChange={(o) => {
          setCreateServerOpen(o)
          if (!o) {
            setCreateServerError(null)
            setNewServerName('')
          }
        }}
      >
        <DialogContent className="border-white/10 bg-px-panel text-px-text">
          <DialogHeader>
            <DialogTitle>Create a server</DialogTitle>
            <DialogDescription className="text-px-text2">This will create a server and a #general channel.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              value={newServerName}
              onChange={(e) => setNewServerName(e.target.value)}
              placeholder="Server name"
              className="border-white/10 bg-white/5 text-px-text placeholder:text-px-text2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCreateServer()
              }}
            />
            {createServerError ? <div className="text-sm font-semibold text-red-400">{createServerError}</div> : null}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
              onClick={() => setCreateServerOpen(false)}
              disabled={createServerBusy}
            >
              Cancel
            </Button>
            <Button
              className="h-9 bg-px-brand text-white hover:bg-px-brand/90"
              onClick={onCreateServer}
              disabled={createServerBusy}
            >
              {createServerBusy ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Message({
  who,
  text,
  tone,
  createdAt,
  showHeader = true,
  onReply,
  replyPreview,
  reactions,
  onReact,
}: {
  who: string
  text: string
  tone: 'system' | 'bot' | 'me'
  createdAt?: string
  showHeader?: boolean
  onReply?: (who: string) => void
  replyPreview?: { who: string; text: string } | null
  reactions?: ReactionSummary[]
  onReact?: (emoji: string) => void
}) {
  const time = useMemo(() => {
    if (!createdAt) return 'just now'
    const d = new Date(createdAt)
    if (Number.isNaN(d.getTime())) return 'just now'
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [createdAt])

  const initial = who.slice(0, 1).toUpperCase()

  if (tone === 'system') {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-px-text2">
        {text}
      </div>
    )
  }

  const nameColor = tone === 'me' ? 'text-emerald-300' : 'text-px-text'

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
  }

  return (
    <div className={showHeader ? 'group relative -mx-2 rounded-lg px-2 py-2 hover:bg-white/5' : 'group relative -mx-2 rounded-lg px-2 py-1 hover:bg-white/5'}>
      <div className="flex gap-3">
        <div className="w-10 shrink-0">
          {showHeader ? (
            <Avatar className="h-10 w-10">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {showHeader ? (
            <div className="flex items-baseline gap-2">
              <div className={`truncate text-sm font-extrabold ${nameColor}`}>{who}</div>
              <div className="text-xs text-px-text2">{time}</div>
            </div>
          ) : null}
          {replyPreview ? (
            <div className={showHeader ? 'mt-0.5 flex items-center gap-2 text-xs text-px-text2' : 'flex items-center gap-2 text-xs text-px-text2'}>
              <span className="font-extrabold text-px-text">{replyPreview.who}</span>
              <span className="truncate">{replyPreview.text}</span>
            </div>
          ) : null}
          <div className={showHeader ? 'mt-0.5 text-sm leading-relaxed text-px-text' : 'text-sm leading-relaxed text-px-text'}>{text}</div>

          {reactions && reactions.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  className={
                    r.viewerHasReacted
                      ? 'flex items-center gap-1 rounded-full border border-white/10 bg-px-brand/20 px-2 py-1 text-xs font-extrabold text-white'
                      : 'flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-extrabold text-px-text2 hover:bg-white/10'
                  }
                  onClick={() => onReact?.(r.emoji)}
                >
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute right-2 top-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-px-panel text-px-text2 hover:bg-white/10"
          onClick={onCopy}
          title="Copy"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-px-panel text-px-text2 hover:bg-white/10"
          onClick={() => onReply?.(who)}
          title="Reply (placeholder)"
        >
          <Reply className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-px-panel text-px-text2 hover:bg-white/10"
          onClick={() => onReact?.('👍')}
          title="React 👍"
        >
          <SmilePlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-px-panel text-px-text2 hover:bg-white/10"
          title="More"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function Member({ name, status }: { name: string; status: 'online' | 'offline' }) {
  const dot = status === 'online' ? 'bg-px-success' : 'bg-white/20'
  return (
    <div className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-white/5">
      <div className="relative">
        <Avatar className="h-9 w-9">
          <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-px-panel ${dot}`} />
      </div>
      <div className="min-w-0">
        <div className="truncate font-bold">{name}</div>
        <div className="truncate text-xs text-px-text2">{status}</div>
      </div>
    </div>
  )
}

function ChannelButton({
  active,
  children,
  onClick,
  leading,
  trailing,
  subtitle,
}: {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
  leading?: React.ReactNode
  trailing?: React.ReactNode
  subtitle?: string
}) {
  return (
    <button
      className={
        active
          ? 'w-full rounded-xl bg-white/10 px-3 py-2 text-left transition-colors'
          : 'w-full rounded-xl px-3 py-2 text-left text-px-text2 transition-colors hover:bg-white/5'
      }
      type="button"
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className={active ? 'truncate text-sm font-semibold text-px-text' : 'truncate text-sm font-semibold'}>{children}</div>
          {subtitle ? <div className="truncate text-xs text-px-text2">{subtitle}</div> : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </button>
  )
}

export default App
