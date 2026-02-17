import React, { useEffect, useMemo, useRef, useState } from 'react'
import { io as ioClient, type Socket } from 'socket.io-client'
import { Copy, Hash, MessageCircle, MoreHorizontal, Pencil, Pin, Plus, Reply, Settings, SmilePlus, Trash2, Users } from 'lucide-react'

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
  apiAdminAudit,
  apiAdminLogin,
  apiAdminMe,
  apiAdminOverview,
  apiAdminSecurity,
  apiAdminServers,
  apiAdminSite,
  apiAdminUnlock,
  apiAdminUpdateSite,
  apiAdminUsers,
  apiCancelFriendRequest,
  apiCreateServer,
  apiCreateChannel,
  apiCreateInvite,
  apiDeclineFriendRequest,
  apiDeleteChannel,
  apiDeleteDmMessage,
  apiDeleteMessage,
  apiEditDmMessage,
  apiEditMessage,
  apiListChannelPins,
  apiListFriends,
  apiListFriendRequests,
  apiListDmPins,
  apiListDmThreads,
  apiPinDmMessage,
  apiPinMessage,
  apiSearchChannel,
  apiSearchDm,
  apiUnpinDmMessage,
  apiUnpinMessage,
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
  apiSite,
  type AdminAuditLog,
  type AdminOverview,
  type AdminSecurity,
  type AdminServer,
  type AdminUser,
  type Channel,
  type DmMessage,
  type DmThread,
  type DmThreadListItem,
  type Friend,
  type FriendRequest,
  type Member as ApiMember,
  type Message as ApiMessage,
  type ReactionSummary,
  type SiteConfig,
  type Server,
  type User,
} from '@/lib/api'

function App() {
  const [user, setUser] = useState<User | null>(null)

  const [booting, setBooting] = useState(true)

  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null)

  const [toasts, setToasts] = useState<{ id: string; title: string; message?: string; tone: 'default' | 'success' | 'error' }[]>([])
  const toastTimersRef = useRef<Record<string, number>>({})

  const [navMode, setNavMode] = useState<'home' | 'server'>('server')

  const [servers, setServers] = useState<Server[]>([])
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ApiMessage[]>([])
  const [messageText, setMessageText] = useState('')
  const [replyingTo, setReplyingTo] = useState<{ id: string; who: string; preview: string } | null>(null)

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingMessageText, setEditingMessageText] = useState('')

  const [channelsLoading, setChannelsLoading] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [membersLoading, setMembersLoading] = useState(false)

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

  const [adminAuthed, setAdminAuthed] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminCode, setAdminCode] = useState('')
  const [adminBusy, setAdminBusy] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [adminStats, setAdminStats] = useState<AdminOverview | null>(null)
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [adminServers, setAdminServers] = useState<AdminServer[]>([])
  const [adminAudit, setAdminAudit] = useState<AdminAuditLog[]>([])
  const [adminSecurity, setAdminSecurity] = useState<AdminSecurity | null>(null)

  const [adminSiteBusy, setAdminSiteBusy] = useState(false)
  const [adminSiteMessage, setAdminSiteMessage] = useState('')
  const [adminSiteEnabled, setAdminSiteEnabled] = useState(false)

  const [pinsOpen, setPinsOpen] = useState(false)
  const [pinsBusy, setPinsBusy] = useState(false)
  const [pinsError, setPinsError] = useState<string | null>(null)
  const [pins, setPins] = useState<(ApiMessage | DmMessage)[]>([])

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<(ApiMessage | DmMessage)[]>([])

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

  const [channelTypers, setChannelTypers] = useState<Record<string, Record<string, { username: string; at: number }>>>({})
  const [dmTypers, setDmTypers] = useState<Record<string, Record<string, { username: string; at: number }>>>({})
  const typingStateRef = useRef<{ channelKey: string | null; dmKey: string | null; lastChannelEmitAt: number; lastDmEmitAt: number }>({
    channelKey: null,
    dmKey: null,
    lastChannelEmitAt: 0,
    lastDmEmitAt: 0,
  })

  const [dmThreads, setDmThreads] = useState<DmThreadListItem[]>([])
  const [selectedDmThreadId, setSelectedDmThreadId] = useState<string | null>(null)
  const [dmUnread, setDmUnread] = useState<Record<string, number>>({})
  const [dmThreadsLoading, setDmThreadsLoading] = useState(false)

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

  async function onAdminUnlockOnly() {
    setAdminBusy(true)
    setAdminError(null)
    try {
      const code = adminCode.trim()
      if (!code) throw new Error('invalid_code')
      const res = await apiAdminUnlock(code)
      setAdminAuthed(res.admin === true)
      pushToast('Admin', 'Admin access granted', 'success')
      await refreshAdminSite()
    } catch (e) {
      setAdminAuthed(false)
      setAdminError(e instanceof Error ? e.message : 'admin_failed')
      pushToast('Admin', e instanceof Error ? e.message : 'admin_failed', 'error')
    } finally {
      setAdminBusy(false)
    }
  }

  async function runSearch() {
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return
    }
    const q = searchQ.trim()
    if (!q) {
      setSearchResults([])
      return
    }
    setSearchBusy(true)
    setSearchError(null)
    try {
      if (navMode === 'server') {
        if (!selectedChannelId) throw new Error('no_channel')
        const res = await apiSearchChannel(selectedChannelId, q, 100)
        setSearchResults(res.results)
      } else {
        if (!selectedDmThreadId) throw new Error('no_dm')
        const res = await apiSearchDm(selectedDmThreadId, q, 100)
        setSearchResults(res.results)
      }
    } catch (e) {
      setSearchResults([])
      setSearchError(e instanceof Error ? e.message : 'search_failed')
    } finally {
      setSearchBusy(false)
    }
  }

  async function refreshAdminSite() {
    if (!user || !adminAuthed) return
    setAdminSiteBusy(true)
    try {
      const res = await apiAdminSite()
      setAdminSiteEnabled(res.config.lockdownEnabled)
      setAdminSiteMessage(res.config.lockdownMessage)
    } catch (e) {
      pushToast('Admin', e instanceof Error ? e.message : 'admin_site_failed', 'error')
    } finally {
      setAdminSiteBusy(false)
    }
  }

  async function onSaveAdminSite() {
    if (!user || !adminAuthed) return
    setAdminSiteBusy(true)
    try {
      const res = await apiAdminUpdateSite({ lockdownEnabled: adminSiteEnabled, lockdownMessage: adminSiteMessage })
      setSiteConfig(res.config)
      pushToast('Lockdown', res.config.lockdownEnabled ? 'Enabled' : 'Disabled', 'success')
    } catch (e) {
      pushToast('Lockdown', e instanceof Error ? e.message : 'save_failed', 'error')
    } finally {
      setAdminSiteBusy(false)
    }
  }

  useEffect(() => {
    const id = window.setInterval(() => {
      apiSite()
        .then((r: { config: SiteConfig }) => setSiteConfig(r.config))
        .catch(() => {
          // ignore
        })
    }, 5000)
    return () => window.clearInterval(id)
  }, [])

  async function onTogglePin(messageId: string, pinned: boolean) {
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return
    }

    try {
      if (navMode === 'server') {
        if (socketConnected && socketRef.current) {
          socketRef.current.emit(pinned ? 'chat:unpin' : 'chat:pin', { messageId })
        } else {
          if (pinned) await apiUnpinMessage(messageId)
          else await apiPinMessage(messageId)
          const res = await apiListMessages(selectedChannelId || '', 75)
          setMessages(res.messages)
        }
      }
      if (navMode === 'home') {
        if (socketConnected && socketRef.current) {
          socketRef.current.emit(pinned ? 'dm:unpin' : 'dm:pin', { messageId })
        } else {
          if (pinned) await apiUnpinDmMessage(messageId)
          else await apiPinDmMessage(messageId)
          const res = await apiListDmMessages(selectedDmThreadId || '', 100)
          setDmMessages(res.messages)
        }
      }
    } catch (e) {
      pushToast('Pins', e instanceof Error ? e.message : 'pin_failed', 'error')
    }
  }

  async function refreshPins() {
    if (!user) return
    setPinsBusy(true)
    setPinsError(null)
    try {
      if (navMode === 'server') {
        if (!selectedChannelId) throw new Error('no_channel')
        const res = await apiListChannelPins(selectedChannelId, 100)
        setPins(res.pins)
      } else {
        if (!selectedDmThreadId) throw new Error('no_dm')
        const res = await apiListDmPins(selectedDmThreadId, 100)
        setPins(res.pins)
      }
    } catch (e) {
      setPins([])
      setPinsError(e instanceof Error ? e.message : 'pins_failed')
    } finally {
      setPinsBusy(false)
    }
  }

  async function onBeginEdit(messageId: string, current: string) {
    setEditingMessageId(messageId)
    setEditingMessageText(current)
  }

  function onCancelEdit() {
    setEditingMessageId(null)
    setEditingMessageText('')
  }

  async function onSaveEdit(messageId: string) {
    const content = editingMessageText.trim()
    if (!content) return

    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return
    }

    try {
      if (navMode === 'server') {
        if (socketConnected && socketRef.current) {
          socketRef.current.emit('chat:edit', { messageId, content })
        } else {
          const res = await apiEditMessage(messageId, content)
          setMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)))
        }
      }
      if (navMode === 'home') {
        if (socketConnected && socketRef.current) {
          socketRef.current.emit('dm:edit', { messageId, content })
        } else {
          const res = await apiEditDmMessage(messageId, content)
          setDmMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)))
        }
      }
      onCancelEdit()
      pushToast('Message', 'Edited', 'success')
    } catch (e) {
      pushToast('Edit failed', e instanceof Error ? e.message : 'edit_failed', 'error')
    }
  }

  async function onDelete(messageId: string) {
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return
    }

    try {
      if (navMode === 'server') {
        if (socketConnected && socketRef.current) {
          socketRef.current.emit('chat:delete', { messageId })
        } else {
          const res = await apiDeleteMessage(messageId)
          setMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)))
        }
      }
      if (navMode === 'home') {
        if (socketConnected && socketRef.current) {
          socketRef.current.emit('dm:delete', { messageId })
        } else {
          const res = await apiDeleteDmMessage(messageId)
          setDmMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)))
        }
      }
      pushToast('Message', 'Deleted', 'success')
    } catch (e) {
      pushToast('Delete failed', e instanceof Error ? e.message : 'delete_failed', 'error')
    }
  }

  async function refreshAdminData() {
    if (!user || !adminAuthed) return
    setAdminBusy(true)
    setAdminError(null)
    try {
      const [overview, usersRes, serversRes, auditRes] = await Promise.all([
        apiAdminOverview(),
        apiAdminUsers(50),
        apiAdminServers(50),
        apiAdminAudit(50),
      ])
      setAdminStats(overview.stats)
      setAdminUsers(usersRes.users)
      setAdminServers(serversRes.servers)
      setAdminAudit(auditRes.logs)

      const sec = await apiAdminSecurity()
      setAdminSecurity(sec.security)
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : 'admin_refresh_failed')
    } finally {
      setAdminBusy(false)
    }
  }

  async function onAdminLogin() {
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return
    }
    setAdminBusy(true)
    setAdminError(null)
    try {
      const code = adminCode.trim()
      if (!code) throw new Error('invalid_code')
      const res = await apiAdminLogin(code)
      setAdminAuthed(res.admin === true)
      pushToast('Admin', 'Admin access granted', 'success')
      await refreshAdminData()
    } catch (e) {
      setAdminAuthed(false)
      setAdminError(e instanceof Error ? e.message : 'admin_failed')
      pushToast('Admin', e instanceof Error ? e.message : 'admin_failed', 'error')
    } finally {
      setAdminBusy(false)
    }
  }

  function pushToast(title: string, message: string | undefined, tone: 'default' | 'success' | 'error' = 'default') {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [...prev, { id, title, message, tone }])
    const t = window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
      delete toastTimersRef.current[id]
    }, 3500)
    toastTimersRef.current[id] = t
  }

  useEffect(() => {
    return () => {
      for (const id of Object.keys(toastTimersRef.current)) {
        window.clearTimeout(toastTimersRef.current[id])
      }
      toastTimersRef.current = {}
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

    if (me.user) {
      apiAdminMe()
        .then((r) => setAdminAuthed(r.admin === true))
        .catch(() => setAdminAuthed(false))
    } else {
      setAdminAuthed(false)
    }

  }

  async function refreshDmThreads() {
    if (!user) {
      setDmThreads([])
      return
    }
    setDmThreadsLoading(true)
    try {
      const res = await apiListDmThreads()
      setDmThreads(res.threads)
    } catch {
      setDmThreads([])
      pushToast('DMs', 'Failed to load DM threads', 'error')
    } finally {
      setDmThreadsLoading(false)
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
    let alive = true
    const start = Date.now()
    let t: number | null = null

    Promise.all([
      refreshMeAndServers().catch(() => {
        setUser(null)
        setServers([])
      }),
      apiSite()
        .then((r) => setSiteConfig(r.config))
        .catch(() => setSiteConfig({ lockdownEnabled: false, lockdownMessage: 'The site is temporarily locked down.' })),
      fetch('/api/health', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          setApiHealth(j?.ok === true ? 'ok' : 'fail')
        })
        .catch(() => setApiHealth('fail')),
    ])
      .finally(() => {
        if (!alive) return
        const elapsed = Date.now() - start
        const minMs = 4500
        const remaining = Math.max(0, minMs - elapsed)
        t = window.setTimeout(() => {
          if (!alive) return
          setBooting(false)
        }, remaining)
      })

    return () => {
      alive = false
      if (t) window.clearTimeout(t)
    }
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

    setChannelsLoading(true)
    setMembersLoading(true)

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
      .finally(() => setChannelsLoading(false))

    apiListMembers(selectedServerId)
      .then((res) => setMembers(res.members))
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedServerId, navMode])

  useEffect(() => {
    if (!user || !selectedChannelId || navMode !== 'server') {
      setMessages([])
      return
    }

    setMessagesLoading(true)

    apiListMessages(selectedChannelId, 75)
      .then((res) => setMessages(res.messages))
      .catch(() => setMessages([]))
      .finally(() => setMessagesLoading(false))
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

    s.on('channel:typing', (payload: { channelId: string; userId: string; username: string; typing: boolean }) => {
      if (!payload?.channelId || !payload?.userId) return
      if (payload.userId === user?.id) return
      const now = Date.now()
      setChannelTypers((prev) => {
        const room = prev[payload.channelId] ? { ...prev[payload.channelId] } : {}
        if (payload.typing) room[payload.userId] = { username: payload.username, at: now }
        else delete room[payload.userId]
        return { ...prev, [payload.channelId]: room }
      })
    })

    s.on('dm:typing', (payload: { threadId: string; userId: string; username: string; typing: boolean }) => {
      if (!payload?.threadId || !payload?.userId) return
      if (payload.userId === user?.id) return
      const now = Date.now()
      setDmTypers((prev) => {
        const room = prev[payload.threadId] ? { ...prev[payload.threadId] } : {}
        if (payload.typing) room[payload.userId] = { username: payload.username, at: now }
        else delete room[payload.userId]
        return { ...prev, [payload.threadId]: room }
      })
    })
    s.on('disconnect', () => setSocketConnected(false))
    s.on('connect_error', (err) => {
      setSocketConnected(false)
      setSocketError(err?.message || 'connect_error')
    })

    s.on('site:config', (cfg: { lockdownEnabled: boolean; lockdownMessage: string }) => {
      setSiteConfig(cfg)
      if (cfg.lockdownEnabled && !adminAuthed) {
        try {
          s.disconnect()
        } catch {
          // ignore
        }
      }
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

    s.on('chat:edited', (payload: { messageId: string; content: string; editedAt: string | null; deletedAt: string | null }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, content: payload.content, editedAt: payload.editedAt, deletedAt: payload.deletedAt } : m)),
      )
    })

    s.on('chat:deleted', (payload: { messageId: string; deletedAt: string | null }) => {
      setMessages((prev) => prev.map((m) => (m.id === payload.messageId ? { ...m, content: '', deletedAt: payload.deletedAt } : m)))
    })

    s.on('chat:pinned', (payload: { messageId: string; pinnedAt: string | null; pinnedById: string | null }) => {
      setMessages((prev) => prev.map((m) => (m.id === payload.messageId ? { ...m, pinnedAt: payload.pinnedAt, pinnedById: payload.pinnedById } : m)))
    })

    s.on('chat:unpinned', (payload: { messageId: string }) => {
      setMessages((prev) => prev.map((m) => (m.id === payload.messageId ? { ...m, pinnedAt: null, pinnedById: null } : m)))
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

    s.on('dm:edited', (payload: { threadId: string; messageId: string; content: string; editedAt: string | null; deletedAt: string | null }) => {
      setDmMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, content: payload.content, editedAt: payload.editedAt, deletedAt: payload.deletedAt } : m)),
      )
    })

    s.on('dm:deleted', (payload: { threadId: string; messageId: string; deletedAt: string | null }) => {
      setDmMessages((prev) => prev.map((m) => (m.id === payload.messageId ? { ...m, content: '', deletedAt: payload.deletedAt } : m)))
    })

    s.on('dm:pinned', (payload: { threadId: string; messageId: string; pinnedAt: string | null; pinnedById: string | null }) => {
      setDmMessages((prev) => prev.map((m) => (m.id === payload.messageId ? { ...m, pinnedAt: payload.pinnedAt, pinnedById: payload.pinnedById } : m)))
    })

    s.on('dm:unpinned', (payload: { threadId: string; messageId: string }) => {
      setDmMessages((prev) => prev.map((m) => (m.id === payload.messageId ? { ...m, pinnedAt: null, pinnedById: null } : m)))
    })

    s.on('chat:error', (payload: unknown) => {
      if (payload && typeof payload === 'object' && 'message' in payload) {
        const msg = (payload as { message?: unknown }).message
        setSocketError(typeof msg === 'string' && msg ? msg : 'chat_error')
        if (typeof msg === 'string' && msg) pushToast('Error', msg, 'error')
        return
      }
      setSocketError('chat_error')
      pushToast('Error', 'chat_error', 'error')
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
    const id = window.setInterval(() => {
      const cutoff = Date.now() - 3000
      setChannelTypers((prev) => {
        const next = { ...prev }
        for (const channelId of Object.keys(next)) {
          const room = { ...next[channelId] }
          for (const uid of Object.keys(room)) {
            if (room[uid].at < cutoff) delete room[uid]
          }
          next[channelId] = room
        }
        return next
      })
      setDmTypers((prev) => {
        const next = { ...prev }
        for (const threadId of Object.keys(next)) {
          const room = { ...next[threadId] }
          for (const uid of Object.keys(room)) {
            if (room[uid].at < cutoff) delete room[uid]
          }
          next[threadId] = room
        }
        return next
      })
    }, 750)
    return () => window.clearInterval(id)
  }, [])

  const typingLabel = useMemo(() => {
    if (navMode === 'server' && selectedChannelId) {
      const room = channelTypers[selectedChannelId] || {}
      const names = Object.values(room)
        .sort((a, b) => b.at - a.at)
        .map((x) => x.username)
        .slice(0, 3)
      if (!names.length) return ''
      if (names.length === 1) return `${names[0]} is typing…`
      if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
      return `${names[0]}, ${names[1]} and others are typing…`
    }
    if (navMode === 'home' && selectedDmThreadId) {
      const room = dmTypers[selectedDmThreadId] || {}
      const names = Object.values(room)
        .sort((a, b) => b.at - a.at)
        .map((x) => x.username)
        .slice(0, 3)
      if (!names.length) return ''
      if (names.length === 1) return `${names[0]} is typing…`
      if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
      return `${names[0]}, ${names[1]} and others are typing…`
    }
    return ''
  }, [navMode, selectedChannelId, selectedDmThreadId, channelTypers, dmTypers])

  function emitTyping(typing: boolean) {
    if (!socketConnected || !socketRef.current) return
    if (!user) return
    const now = Date.now()
    if (navMode === 'server') {
      const channelId = selectedChannelId
      if (!channelId) return
      if (!typing && typingStateRef.current.channelKey !== channelId) return
      if (typing && now - typingStateRef.current.lastChannelEmitAt < 600) return
      typingStateRef.current.channelKey = typing ? channelId : null
      typingStateRef.current.lastChannelEmitAt = now
      socketRef.current.emit('channel:typing', { channelId, typing })
      return
    }
    if (navMode === 'home') {
      const threadId = selectedDmThreadId
      if (!threadId) return
      if (!typing && typingStateRef.current.dmKey !== threadId) return
      if (typing && now - typingStateRef.current.lastDmEmitAt < 600) return
      typingStateRef.current.dmKey = typing ? threadId : null
      typingStateRef.current.lastDmEmitAt = now
      socketRef.current.emit('dm:typing', { threadId, typing })
    }
  }

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

  const authDialog = (
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
  )

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
      pushToast('Welcome', `Signed in as ${authUsername.trim().toLowerCase()}`, 'success')
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'auth_failed')
      pushToast('Auth failed', e instanceof Error ? e.message : 'auth_failed', 'error')
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
      pushToast('Server created', name, 'success')
    } catch (e) {
      setCreateServerError(e instanceof Error ? e.message : 'create_failed')
      pushToast('Create server failed', e instanceof Error ? e.message : 'create_failed', 'error')
    } finally {
      setCreateServerBusy(false)
    }
  }

  if (booting) {
    return (
      <div className="h-full w-full bg-px-bg">
        <div className="relative grid h-full w-full place-items-center overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,101,242,0.35),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(16,185,129,0.18),transparent_55%)]" />

          <div className="relative w-full max-w-md px-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-px-brand/90 shadow-soft grid place-items-center text-lg font-black text-white">
                  PX
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xl font-extrabold text-px-text">PXHB Chatting</div>
                  <div className="truncate text-sm text-px-text2">Protected by Equinox V1</div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-px-brand" />
                <div className="text-sm font-semibold text-px-text2">Loading secure session…</div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-px-text2">
                API: {apiHealth} • Socket: {socketConnected ? 'connected' : 'connecting…'}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (siteConfig?.lockdownEnabled && !adminAuthed) {
    return (
      <div className="h-full w-full bg-black">
        <div className="relative grid h-full w-full place-items-center overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.55),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_bottom,rgba(239,68,68,0.35),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-40 [background:repeating-linear-gradient(135deg,rgba(239,68,68,0.20)_0px,rgba(239,68,68,0.20)_12px,transparent_12px,transparent_28px)]" />

          <div className="relative w-full max-w-lg px-6">
            <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-8 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-extrabold tracking-[0.3em] text-red-200">LOCKDOWN</div>
                  <div className="mt-1 text-3xl font-black text-white">PXHB Chatting</div>
                </div>
                <div className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.9)] animate-pulse" />
              </div>

              <div className="mt-6 rounded-2xl border border-red-500/30 bg-black/30 px-4 py-3 text-sm text-red-100">
                {siteConfig.lockdownMessage}
              </div>

              <div className="mt-6 text-xs text-red-200/80">Protected by Equinox V1</div>

              <div className="mt-6 flex items-center gap-2">
                <Button
                  className="bg-white/10 text-white hover:bg-white/20"
                  onClick={() => {
                    setAuthMode('login')
                    setAuthOpen(true)
                  }}
                >
                  User Login
                </Button>
                <Button variant="secondary" className="bg-white/5 text-red-100 hover:bg-white/10" onClick={() => window.location.reload()}>
                  Reload
                </Button>
              </div>

              <div className="mt-6 rounded-2xl border border-red-500/30 bg-black/30 p-4">
                <div className="text-xs font-extrabold tracking-wide text-red-200">ADMIN UNLOCK (EQUINOX)</div>
                <div className="mt-2 flex gap-2">
                  <Input value={adminCode} onChange={(e) => setAdminCode(e.target.value)} placeholder="Admin code" className="border-red-500/20 bg-white/5" />
                  <Button className="bg-red-500/80 text-white hover:bg-red-500" onClick={onAdminUnlockOnly} disabled={adminBusy}>
                    Unlock
                  </Button>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="secondary"
                    className="h-9 bg-white/5 text-red-100 hover:bg-white/10"
                    onClick={async () => {
                      try {
                        if (!adminAuthed) await onAdminUnlockOnly()
                        await apiAdminUpdateSite({ lockdownEnabled: false, lockdownMessage: adminSiteMessage || 'The site is temporarily locked down.' })
                        await apiSite().then((r) => setSiteConfig(r.config)).catch(() => {})
                        pushToast('Lockdown', 'Disabled', 'success')
                      } catch (e) {
                        pushToast('Lockdown', e instanceof Error ? e.message : 'disable_failed', 'error')
                      }
                    }}
                    disabled={adminBusy}
                  >
                    Disable Lockdown
                  </Button>
                </div>
                {adminError ? <div className="mt-2 text-sm text-red-200">{adminError}</div> : null}
              </div>
            </div>
          </div>
        </div>
        {authDialog}
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-px-bg">
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              t.tone === 'success'
                ? 'pointer-events-auto rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 shadow-soft'
                : t.tone === 'error'
                  ? 'pointer-events-auto rounded-2xl border border-red-500/30 bg-red-500/10 p-3 shadow-soft'
                  : 'pointer-events-auto rounded-2xl border border-white/10 bg-white/5 p-3 shadow-soft'
            }
          >
            <div className="text-sm font-extrabold text-px-text">{t.title}</div>
            {t.message ? <div className="mt-1 text-sm text-px-text2">{t.message}</div> : null}
          </div>
        ))}
      </div>

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
            <div className="mt-auto grid w-full place-items-center gap-2 pb-1">
              <div className="h-12 w-12 rounded-2xl bg-white/10 grid place-items-center text-sm text-px-text2">
                <Settings className="h-5 w-5" />
              </div>
              <div className="text-[10px] font-extrabold tracking-wide text-px-text2">Protected by Equinox V1</div>
            </div>
          </div>
        </aside>

        <aside className="bg-px-panel border-r border-white/10 flex h-full flex-col animate-in fade-in duration-200">
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
                <div className="truncate text-[10px] font-extrabold tracking-wide text-px-text2">Protected by Equinox V1</div>
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
                dmThreadsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-11 w-full animate-pulse rounded-xl bg-white/5" />
                    ))}
                  </div>
                ) : dmThreads.length ? (
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
                channelsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-10 w-full animate-pulse rounded-xl bg-white/5" />
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-sm text-px-text2">No channels</div>
                )
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

        <main className="bg-px-panel2 flex h-full flex-col animate-in fade-in duration-200">
          <header className="flex h-14 items-center justify-between border-b border-white/10 px-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-white/10 grid place-items-center">
                  {navMode === 'home' ? <MessageCircle className="h-5 w-5 text-px-text2" /> : <Hash className="h-5 w-5 text-px-text2" />}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-px-text">
                    {navMode === 'home'
                      ? dmThreads.find((t) => t.id === selectedDmThreadId)?.otherUser.username || 'Home'
                      : servers.find((s) => s.id === selectedServerId)?.name || 'Server'}
                  </div>
                  <div className="truncate text-xs text-px-text2">
                    {navMode === 'home'
                      ? selectedDmThreadId
                        ? 'Direct Messages'
                        : 'Friends • DMs'
                      : `# ${channels.find((c) => c.id === selectedChannelId)?.name || 'general'}`}
                  </div>
                </div>
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
              <div className="hidden md:flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-extrabold tracking-wide text-px-text2">
                Protected by Equinox V1
              </div>
              <Button
                variant="secondary"
                className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
                onClick={() => {
                  setPinsOpen(true)
                  if (user) refreshPins()
                }}
                disabled={!user || (navMode === 'server' ? !selectedChannelId : !selectedDmThreadId)}
              >
                Pins
              </Button>
              <Button
                variant="secondary"
                className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
                onClick={() => {
                  setSearchOpen(true)
                  setSearchError(null)
                  setSearchResults([])
                }}
                disabled={!user || (navMode === 'server' ? !selectedChannelId : !selectedDmThreadId)}
              >
                Search
              </Button>
              <Button
                variant="secondary"
                className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
                onClick={() => {
                  setAdminOpen(true)
                  setAdminError(null)
                  if (user && adminAuthed) {
                    refreshAdminData()
                    refreshAdminSite()
                  }
                }}
                disabled={!user}
              >
                Admin
              </Button>
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
                  ? messagesLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-white/5" />
                        ))}
                      </div>
                    ) : dmMessages.map((m, idx) => {
                      const prev = dmMessages[idx - 1]
                      const sameAuthor = prev && prev.author.id === m.author.id
                      const showHeader = !sameAuthor
                      const isMine = m.author.id === user?.id
                      const isDeleted = !!m.deletedAt
                      const showText = isDeleted ? 'Message deleted' : m.content
                      return (
                        <div key={m.id}>
                          {editingMessageId === m.id && !isDeleted ? (
                            <div className="-mx-2 rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                              <div className="text-xs font-extrabold text-px-text2">Editing message</div>
                              <div className="mt-2 flex gap-2">
                                <Input value={editingMessageText} onChange={(e) => setEditingMessageText(e.target.value)} className="flex-1" />
                                <Button className="bg-px-brand text-white hover:bg-px-brand/90" onClick={() => onSaveEdit(m.id)}>
                                  Save
                                </Button>
                                <Button variant="secondary" className="bg-white/5 text-px-text2 hover:bg-white/10" onClick={onCancelEdit}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Message
                              who={m.author.username}
                              text={showText}
                              tone={isDeleted ? 'system' : m.author.id === user?.id ? 'me' : 'bot'}
                              createdAt={m.createdAt}
                              showHeader={showHeader}
                              replyPreview={m.replyTo ? { who: m.replyTo.author.username, text: m.replyTo.content } : null}
                              reactions={m.reactions}
                              editedAt={m.editedAt}
                              deletedAt={m.deletedAt}
                              canPin={!isDeleted}
                              isPinned={!!m.pinnedAt}
                              onTogglePin={() => onTogglePin(m.id, !!m.pinnedAt)}
                              canEdit={isMine && !isDeleted}
                              canDelete={isMine && !isDeleted}
                              onEdit={() => onBeginEdit(m.id, m.content)}
                              onDelete={() => onDelete(m.id)}
                              onReact={(emoji) => onToggleReaction(m.id, emoji)}
                              onReply={() => {
                                setReplyingTo({ id: m.id, who: m.author.username, preview: m.content.slice(0, 80) })
                              }}
                            />
                          )}
                        </div>
                      )
                    })
                  : messagesLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-white/5" />
                        ))}
                      </div>
                    ) : messages.map((m, idx) => {
                      const prev = messages[idx - 1]
                      const sameAuthor = prev && prev.author.id === m.author.id
                      const showHeader = !sameAuthor
                      const isMine = m.author.id === user?.id
                      const isDeleted = !!m.deletedAt
                      const showText = isDeleted ? 'Message deleted' : m.content
                      return (
                        <div key={m.id}>
                          {editingMessageId === m.id && !isDeleted ? (
                            <div className="-mx-2 rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                              <div className="text-xs font-extrabold text-px-text2">Editing message</div>
                              <div className="mt-2 flex gap-2">
                                <Input value={editingMessageText} onChange={(e) => setEditingMessageText(e.target.value)} className="flex-1" />
                                <Button className="bg-px-brand text-white hover:bg-px-brand/90" onClick={() => onSaveEdit(m.id)}>
                                  Save
                                </Button>
                                <Button variant="secondary" className="bg-white/5 text-px-text2 hover:bg-white/10" onClick={onCancelEdit}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Message
                              who={m.author.username}
                              text={showText}
                              tone={isDeleted ? 'system' : m.author.id === user?.id ? 'me' : 'bot'}
                              createdAt={m.createdAt}
                              showHeader={showHeader}
                              replyPreview={m.replyTo ? { who: m.replyTo.author.username, text: m.replyTo.content } : null}
                              reactions={m.reactions}
                              editedAt={m.editedAt}
                              deletedAt={m.deletedAt}
                              canPin={!isDeleted}
                              isPinned={!!m.pinnedAt}
                              onTogglePin={() => onTogglePin(m.id, !!m.pinnedAt)}
                              canEdit={isMine && !isDeleted}
                              canDelete={isMine && !isDeleted}
                              onEdit={() => onBeginEdit(m.id, m.content)}
                              onDelete={() => onDelete(m.id)}
                              onReact={(emoji) => onToggleReaction(m.id, emoji)}
                              onReply={() => {
                                setReplyingTo({ id: m.id, who: m.author.username, preview: m.content.slice(0, 80) })
                              }}
                            />
                          )}
                        </div>
                      )
                    })}
              </div>
            </div>
          </ScrollArea>

          <footer className="border-t border-white/10 p-3">
            <div className="mx-auto flex max-w-3xl flex-col gap-2">
              {typingLabel ? <div className="px-2 text-xs font-extrabold text-px-text2">{typingLabel}</div> : null}
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
                onChange={(e) => {
                  setMessageText(e.target.value)
                  emitTyping(true)
                }}
                onBlur={() => emitTyping(false)}
                value={messageText}
                placeholder={
                  navMode === 'home'
                    ? selectedDmThreadId
                      ? 'Message this DM'
                      : 'Select a DM'
                    : selectedChannelId
                      ? 'Message this channel'
                      : 'Select a channel'
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onSendMessage()
                    emitTyping(false)
                  }
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
                {membersLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-white/5" />
                    ))}
                  </div>
                ) : members.length ? (
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
        open={searchOpen}
        onOpenChange={(o) => {
          setSearchOpen(o)
          if (!o) {
            setSearchBusy(false)
            setSearchError(null)
            setSearchResults([])
          }
        }}
      >
        <DialogContent className="bg-px-panel border-white/10 text-px-text max-w-3xl">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>{navMode === 'server' ? 'Search this channel' : 'Search this DM'} • Protected by Equinox V1</DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search messages…" />
            <Button className="bg-px-brand text-white hover:bg-px-brand/90" onClick={runSearch} disabled={searchBusy}>
              Go
            </Button>
          </div>
          {searchError ? <div className="text-sm text-red-400">{searchError}</div> : null}
          {searchBusy ? <div className="text-sm text-px-text2">Searching…</div> : null}
          {!searchBusy && !searchError && searchQ.trim() && searchResults.length === 0 ? (
            <div className="text-sm text-px-text2">No results.</div>
          ) : null}

          <div className="max-h-[50vh] overflow-auto rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="space-y-2">
              {searchResults.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => setSearchOpen(false)}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="truncate text-sm font-extrabold">{m.author.username}</div>
                    <div className="shrink-0 text-xs text-px-text2">{new Date(m.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="mt-1 truncate text-sm text-px-text2">{m.deletedAt ? 'Message deleted' : m.content}</div>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pinsOpen}
        onOpenChange={(o) => {
          setPinsOpen(o)
          if (o && user) refreshPins()
        }}
      >
        <DialogContent className="bg-px-panel border-white/10 text-px-text max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pinned Messages</DialogTitle>
            <DialogDescription>{navMode === 'server' ? 'This channel' : 'This DM'} • Protected by Equinox V1</DialogDescription>
          </DialogHeader>

          {pinsError ? <div className="text-sm text-red-400">{pinsError}</div> : null}
          {pinsBusy ? <div className="text-sm text-px-text2">Loading…</div> : null}
          {!pinsBusy && !pins.length ? <div className="text-sm text-px-text2">No pinned messages.</div> : null}

          <div className="space-y-2">
            {pins.map((m) => (
              <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-sm font-bold">{m.author.username}</div>
                <div className="mt-1 text-sm text-px-text">{m.deletedAt ? 'Message deleted' : m.content}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adminOpen}
        onOpenChange={(o) => {
          setAdminOpen(o)
          if (o && user && adminAuthed) {
            refreshAdminData()
            refreshAdminSite()
          }
        }}
      >
        <DialogContent className="bg-px-panel border-white/10 text-px-text max-w-3xl">
          <DialogHeader>
            <DialogTitle>Admin Panel</DialogTitle>
            <DialogDescription>Site owner controls • Protected by Equinox V1</DialogDescription>
          </DialogHeader>

          {!user ? (
            <div className="text-sm text-px-text2">Login required.</div>
          ) : !adminAuthed ? (
            <div className="space-y-3">
              <div className="text-sm text-px-text2">Enter admin code to unlock global controls.</div>
              <div className="flex gap-2">
                <Input value={adminCode} onChange={(e) => setAdminCode(e.target.value)} placeholder="Admin code" />
                <Button className="bg-px-brand text-white hover:bg-px-brand/90" onClick={onAdminLogin} disabled={adminBusy}>
                  Unlock
                </Button>
              </div>
              {adminError ? <div className="text-sm text-red-400">{adminError}</div> : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-extrabold tracking-wide text-px-text2">EQUINOX SECURITY POSTURE</div>
                  <div className={adminSecurity?.isProd ? 'text-xs font-extrabold text-emerald-300' : 'text-xs font-extrabold text-amber-300'}>
                    {adminSecurity?.isProd ? 'PROD' : 'DEV'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs font-extrabold text-px-text2">CSP</div>
                    <div className={adminSecurity?.cspEnabled ? 'mt-1 text-sm font-extrabold text-emerald-300' : 'mt-1 text-sm font-extrabold text-amber-300'}>
                      {adminSecurity?.cspEnabled ? 'ENABLED' : 'DISABLED'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs font-extrabold text-px-text2">LOCKDOWN</div>
                    <div className={adminSecurity?.lockdown ? 'mt-1 text-sm font-extrabold text-red-300' : 'mt-1 text-sm font-extrabold text-emerald-300'}>
                      {adminSecurity?.lockdown ? 'ENABLED' : 'DISABLED'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-px-text2">ALLOWED ORIGINS</div>
                      <div className="mt-1 truncate font-mono text-xs text-px-text2">
                        {(adminSecurity?.allowedOrigins || []).join(', ') || '—'}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      className="h-8 bg-white/5 text-px-text2 hover:bg-white/10"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText((adminSecurity?.allowedOrigins || []).join(','))
                          pushToast('Copied', 'Allowed origins copied', 'success')
                        } catch {
                          pushToast('Copied', 'Copy failed', 'error')
                        }
                      }}
                      disabled={!adminSecurity}
                    >
                      Copy
                    </Button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-px-text2">RENDER ENV SNIPPET</div>
                      <div className="mt-1 truncate font-mono text-xs text-px-text2">ALLOWED_ORIGINS=&quot;https://yourdomain&quot;</div>
                    </div>
                    <Button
                      variant="secondary"
                      className="h-8 bg-white/5 text-px-text2 hover:bg-white/10"
                      onClick={async () => {
                        try {
                          const snippet = `ALLOWED_ORIGINS=\"https://yourdomain\"\nCSP_ENABLED=\"true\"\nADMIN_CODE=\"(secret)\"`
                          await navigator.clipboard.writeText(snippet)
                          pushToast('Copied', 'Env snippet copied', 'success')
                        } catch {
                          pushToast('Copied', 'Copy failed', 'error')
                        }
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-extrabold tracking-wide text-px-text2">SITE LOCKDOWN</div>
                  <div className={adminSiteEnabled ? 'text-xs font-extrabold text-red-300' : 'text-xs font-extrabold text-emerald-300'}>
                    {adminSiteEnabled ? 'ENABLED' : 'DISABLED'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className={adminSiteEnabled ? 'h-9 bg-red-500/20 text-red-100 hover:bg-red-500/30' : 'h-9 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'}
                    onClick={() => setAdminSiteEnabled((v) => !v)}
                    disabled={adminSiteBusy}
                  >
                    {adminSiteEnabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Input value={adminSiteMessage} onChange={(e) => setAdminSiteMessage(e.target.value)} placeholder="Lockdown message" />
                  <Button className="bg-px-brand text-white hover:bg-px-brand/90" onClick={onSaveAdminSite} disabled={adminSiteBusy}>
                    Save
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold tracking-wide text-px-text2">OVERVIEW</div>
                <Button variant="secondary" className="h-8 bg-white/5 text-px-text2 hover:bg-white/10" onClick={refreshAdminData} disabled={adminBusy}>
                  Refresh
                </Button>
              </div>

              {adminError ? <div className="text-sm text-red-400">{adminError}</div> : null}
              {adminBusy ? <div className="text-sm text-px-text2">Loading…</div> : null}

              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-extrabold text-px-text2">USERS</div>
                  <div className="mt-1 text-xl font-extrabold">{adminStats?.users ?? '—'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-extrabold text-px-text2">SERVERS</div>
                  <div className="mt-1 text-xl font-extrabold">{adminStats?.servers ?? '—'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-extrabold text-px-text2">MESSAGES</div>
                  <div className="mt-1 text-xl font-extrabold">{adminStats?.messages ?? '—'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-extrabold text-px-text2">DM MSGS</div>
                  <div className="mt-1 text-xl font-extrabold">{adminStats?.dmMessages ?? '—'}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-extrabold tracking-wide text-px-text2">LATEST USERS</div>
                  <div className="space-y-2">
                    {adminUsers.slice(0, 8).map((u) => (
                      <div key={u.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <div className="truncate text-sm font-bold">{u.username}</div>
                        <div className="truncate text-xs text-px-text2">{u.id}</div>
                      </div>
                    ))}
                    {!adminUsers.length ? <div className="text-sm text-px-text2">No users</div> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-extrabold tracking-wide text-px-text2">LATEST SERVERS</div>
                  <div className="space-y-2">
                    {adminServers.slice(0, 8).map((s) => (
                      <div key={s.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <div className="truncate text-sm font-bold">{s.name}</div>
                        <div className="truncate text-xs text-px-text2">owner: {s.owner.username}</div>
                      </div>
                    ))}
                    {!adminServers.length ? <div className="text-sm text-px-text2">No servers</div> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-extrabold tracking-wide text-px-text2">AUDIT LOG</div>
                  <div className="space-y-2">
                    {adminAudit.slice(0, 10).map((l) => (
                      <div key={l.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <div className="truncate text-sm font-bold">{l.action}</div>
                        <div className="truncate text-xs text-px-text2">{l.actor?.username || 'system'}</div>
                      </div>
                    ))}
                    {!adminAudit.length ? <div className="text-sm text-px-text2">No logs</div> : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

      {authDialog}

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
  editedAt,
  deletedAt,
  showHeader = true,
  onReply,
  replyPreview,
  reactions,
  onReact,
  canPin,
  isPinned,
  onTogglePin,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  who: string
  text: string
  tone: 'system' | 'bot' | 'me'
  createdAt?: string
  editedAt?: string | null
  deletedAt?: string | null
  showHeader?: boolean
  onReply?: (who: string) => void
  replyPreview?: { who: string; text: string } | null
  reactions?: ReactionSummary[]
  onReact?: (emoji: string) => void
  canPin?: boolean
  isPinned?: boolean
  onTogglePin?: () => void
  canEdit?: boolean
  canDelete?: boolean
  onEdit?: () => void
  onDelete?: () => void
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

  const isDeleted = !!deletedAt
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
          {!isDeleted && editedAt ? <div className="mt-1 text-[10px] font-extrabold text-px-text2">(edited)</div> : null}

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
        {canEdit ? (
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-px-panel text-px-text2 hover:bg-white/10"
            onClick={onEdit}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-px-panel text-px-text2 hover:bg-white/10"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
        {canPin ? (
          <button
            type="button"
            className={
              isPinned
                ? 'grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-px-brand/20 text-white hover:bg-px-brand/30'
                : 'grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-px-panel text-px-text2 hover:bg-white/10'
            }
            onClick={onTogglePin}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="h-4 w-4" />
          </button>
        ) : null}
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
