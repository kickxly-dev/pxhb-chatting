import React, { useEffect, useMemo, useRef, useState } from 'react'
import { io as ioClient, type Socket } from 'socket.io-client'
import { Building, Copy, Hash, MessageCircle, MoreHorizontal, Pencil, Pin, Plus, Reply, Settings, Shield, SmilePlus, Trash2, Users } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  apiAdminUpdateSecurity,
  apiAdminServers,
  apiAdminUsers,
  apiCancelFriendRequest,
  apiCreateServer,
  apiCreateChannel,
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
  apiPresence,
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
  apiUpdateServer,
  apiUpdateMe,
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
  type PresenceEntry,
  type PresenceStatus,
  type ReactionSummary,
  type Server,
  type User,
} from '@/lib/api'

function App() {
  const [user, setUser] = useState<User | null>(null)

  const [booting, setBooting] = useState(true)

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

  const [channelUnread, setChannelUnread] = useState<Record<string, number>>({})

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingMessageText, setEditingMessageText] = useState('')

  const [channelsLoading, setChannelsLoading] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [membersLoading, setMembersLoading] = useState(false)

  const [members, setMembers] = useState<ApiMember[]>([])

  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, { status: PresenceStatus; lastSeenAt: string | null }>>({})

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

  const [adminSecurityBusy, setAdminSecurityBusy] = useState(false)
  const [adminSecurityError, setAdminSecurityError] = useState<string | null>(null)
  const [adminAllowedOriginsText, setAdminAllowedOriginsText] = useState('')
  const [adminCspEnabled, setAdminCspEnabled] = useState<boolean>(true)

  // New Equinox vNext controls
  const [adminRateLimitEnabled, setAdminRateLimitEnabled] = useState(true)
  const [adminRateLimitWindowMs, setAdminRateLimitWindowMs] = useState(60000)
  const [adminRateLimitAuthMax, setAdminRateLimitAuthMax] = useState(20)
  const [adminRateLimitAdminMax, setAdminRateLimitAdminMax] = useState(6)
  const [adminRateLimitApiMax, setAdminRateLimitApiMax] = useState(240)
  const [adminSessionCookieSameSite, setAdminSessionCookieSameSite] = useState<'lax' | 'strict' | 'none'>('lax')
  const [adminSessionCookieSecure, setAdminSessionCookieSecure] = useState<'auto' | 'true' | 'false'>('auto')
  const [adminSessionCookieMaxAgeMs, setAdminSessionCookieMaxAgeMs] = useState(1209600000)
  const [adminLockdownEnabled, setAdminLockdownEnabled] = useState(false)

  const [pinsOpen, setPinsOpen] = useState(false)
  const [pinsBusy, setPinsBusy] = useState(false)
  const [pinsError, setPinsError] = useState<string | null>(null)
  const [pins, setPins] = useState<(ApiMessage | DmMessage)[]>([])
  const [pinViewMode, setPinViewMode] = useState<'list' | 'grid'>('list')

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<(ApiMessage | DmMessage)[]>([])
  const [searchFilters, setSearchFilters] = useState({ author: '', hasReactions: false, isPinned: false })

  const [createServerOpen, setCreateServerOpen] = useState(false)
  const [newServerName, setNewServerName] = useState('')
  const [createServerBusy, setCreateServerBusy] = useState(false)
  const [createServerError, setCreateServerError] = useState<string | null>(null)

  const [serverSettingsError, setServerSettingsError] = useState<string | null>(null)
  const [serverSettingsName, setServerSettingsName] = useState('')
  const [serverSettingsIconUrl, setServerSettingsIconUrl] = useState('')

  const [profileOpen, setProfileOpen] = useState(false)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileDisplayName, setProfileDisplayName] = useState('')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')

  const [createChannelOpen, setCreateChannelOpen] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [createChannelBusy, setCreateChannelBusy] = useState(false)
  const [createChannelError, setCreateChannelError] = useState<string | null>(null)

  const [renameChannelOpen, setRenameChannelOpen] = useState(false)
  const [renameChannelName, setRenameChannelName] = useState('')

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])

  // Roles and permissions state
  const [rolesOpen, setRolesOpen] = useState(false)
  const [roles, setRoles] = useState([
    { id: 'admin', name: 'Admin', permissions: ['manage_server', 'manage_channels', 'manage_members', 'moderate_messages'] },
    { id: 'moderator', name: 'Moderator', permissions: ['manage_channels', 'moderate_messages'] },
    { id: 'member', name: 'Member', permissions: [] }
  ])
  const [newRoleName, setNewRoleName] = useState('')
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([])
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({})

  // Moderation tools state
  const [moderationOpen, setModerationOpen] = useState(false)
  const [moderationTarget, setModerationTarget] = useState<{ type: 'message' | 'user'; id: string; data?: any } | null>(null)
  const [moderationAction, setModerationAction] = useState<'delete' | 'timeout' | 'warn' | 'ban'>('delete')
  const [moderationReason, setModerationReason] = useState('')
  const [moderationDuration, setModerationDuration] = useState(60) // minutes

  // Notification settings state
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState({
    enableDesktop: true,
    enableSound: true,
    enableEmail: false,
    mentionOnly: false,
    dmNotifications: true,
    channelNotifications: true,
    serverNotifications: false
  })

  // Emoji data
  const commonEmojis = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛',
    '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
    '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕',
    '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
    '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '❤️',
    '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '👍', '👎', '👌',
    '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪', '🙏', '🎉', '🎊'
  ]

  const insertEmoji = (emoji: string) => {
    setMessageText(prev => prev + emoji)
    setEmojiPickerOpen(false)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...files])
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearAllFiles = () => {
    setUploadedFiles([])
  }

  const addRole = () => {
    if (!newRoleName.trim()) return
    const newRole = {
      id: newRoleName.toLowerCase().replace(/\s+/g, '_'),
      name: newRoleName,
      permissions: newRolePermissions
    }
    setRoles(prev => [...prev, newRole])
    setNewRoleName('')
    setNewRolePermissions([])
  }

  const deleteRole = (roleId: string) => {
    if (roleId === 'admin' || roleId === 'member') return // Can't delete default roles
    setRoles(prev => prev.filter(r => r.id !== roleId))
    // Reset any members with this role to 'member'
    setMemberRoles(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(userId => {
        if (updated[userId] === roleId) {
          updated[userId] = 'member'
        }
      })
      return updated
    })
  }

  const updateMemberRole = (userId: string, roleId: string) => {
    setMemberRoles(prev => ({ ...prev, [userId]: roleId }))
  }

  const openModeration = (type: 'message' | 'user', id: string, data?: any) => {
    setModerationTarget({ type, id, data })
    setModerationOpen(true)
    setModerationAction('delete')
    setModerationReason('')
    setModerationDuration(60)
  }

  const executeModeration = () => {
    if (!moderationTarget || !user) return
    
    // In a real app, this would send to backend
    console.log('Moderation action:', {
      action: moderationAction,
      target: moderationTarget,
      reason: moderationReason,
      duration: moderationDuration,
      moderator: user.id
    })
    
    setModerationOpen(false)
    setModerationTarget(null)
  }

  const canModerate = () => {
    if (!user) return false
    const userRole = memberRoles[user.id] || 'member'
    const role = roles.find(r => r.id === userRole)
    return role ? role.permissions.includes('moderate_messages') : false
  }

  const updateNotificationSetting = (key: keyof typeof notificationSettings, value: boolean) => {
    setNotificationSettings(prev => ({ ...prev, [key]: value }))
  }

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const createInvite = () => {
    const code = generateInviteCode()
    const newInvite = {
      id: Date.now().toString(),
      code,
      createdBy: user?.username || 'unknown',
      uses: 0,
      maxUses: newInviteMaxUses,
      expiresAt: newInviteExpires ? new Date(Date.now() + newInviteDays * 24 * 60 * 60 * 1000).toISOString() : null,
      createdAt: new Date().toISOString()
    }
    setServerInvites(prev => [...prev, newInvite])
    setNewInviteCode(code)
    setNewInviteMaxUses(-1)
    setNewInviteExpires(false)
    setNewInviteDays(7)
  }

  const deleteInvite = (inviteId: string) => {
    setServerInvites(prev => prev.filter(invite => invite.id !== inviteId))
  }

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code)
  }

  const isInviteExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const getInviteStatus = (invite: any) => {
    if (isInviteExpired(invite.expiresAt)) return { text: 'Expired', color: 'text-red-400' }
    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) return { text: 'Used', color: 'text-amber-400' }
    return { text: 'Active', color: 'text-emerald-400' }
  }

  const updateServerSetting = (key: keyof typeof serverManageSettings, value: any) => {
    setServerManageSettings(prev => ({ ...prev, [key]: value }))
  }

  const saveServerSettings = () => {
    setServerManageBusy(true)
    // In a real app, this would save to backend
    setTimeout(() => {
      setServerManageBusy(false)
      setServerManageOpen(false)
    }, 1000)
  }
  const [renameChannelBusy, setRenameChannelBusy] = useState(false)
  const [renameChannelError, setRenameChannelError] = useState<string | null>(null)

  const [deleteChannelOpen, setDeleteChannelOpen] = useState(false)
  const [deleteChannelBusy, setDeleteChannelBusy] = useState(false)
  const [deleteChannelError, setDeleteChannelError] = useState<string | null>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  
  // Enhanced invite management
  const [serverInvites, setServerInvites] = useState([
    { id: '1', code: 'ABC123', createdBy: 'admin', uses: 5, maxUses: 10, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '2', code: 'XYZ789', createdBy: 'user1', uses: 2, maxUses: -1, expiresAt: null, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
  ])
  const [newInviteCode, setNewInviteCode] = useState('')
  const [newInviteMaxUses, setNewInviteMaxUses] = useState(-1)
  const [newInviteExpires, setNewInviteExpires] = useState(false)
  const [newInviteDays, setNewInviteDays] = useState(7)

  // Server management
  const [serverManageOpen, setServerManageOpen] = useState(false)
  const [serverManageSettings, setServerManageSettings] = useState({
    name: '',
    description: '',
    icon: '',
    isPublic: true,
    allowInvites: true,
    maxMembers: 100,
    defaultRole: 'member'
  })
  const [serverManageBusy, setServerManageBusy] = useState(false)

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
    const u = (user?.displayName || user?.username || '').trim()
    return u ? u.slice(0, 1).toUpperCase() : 'G'
  }, [user?.displayName, user?.username])

  const displayName = useMemo(() => {
    if (!user) return 'Guest'
    return (user.displayName || user.username).trim() || user.username
  }, [user])

  function displayNameFor(u: { username: string; displayName?: string | null } | null | undefined) {
    if (!u) return ''
    const d = (u.displayName || '').trim()
    return d || u.username
  }

  function friendlyError(e: unknown): string {
    const raw = e instanceof Error ? e.message : 'unknown_error'
    const code = raw.split(':')[0]
    if (code === 'invalid_credentials') return 'Invalid username or password.'
    if (code === 'username_taken') return 'That username is already taken.'
    if (code === 'invalid_payload') return 'Please check the form and try again.'
    if (code === 'unauthorized') return 'Please log in again.'
    if (code === 'origin_forbidden') return 'Request blocked by origin policy. Check Allowed Origins in Admin.'
    if (code === 'rate_limited' || code === 'http_429') return 'Too many attempts. Please wait a moment and try again.'
    if (code === 'bad_response') return 'Server returned an unexpected response.'
    if (code === 'fetch_failed') return 'Network error. Check your connection.'
    return raw
  }

  const formatShortTime = useMemo(() => {
    return (iso: string | null) => {
      if (!iso) return ''
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return ''
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }, [])

  async function onSaveProfile() {
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return
    }
    setProfileBusy(true)
    setProfileError(null)
    try {
      const nextDisplayName = profileDisplayName.trim()
      const nextAvatarUrl = profileAvatarUrl.trim()
      const res = await apiUpdateMe({ displayName: nextDisplayName || null, avatarUrl: nextAvatarUrl || null })
      setUser(res.user)

      setMessages((prev) =>
        prev.map((m) => (m.author.id === res.user.id ? { ...m, author: { ...m.author, displayName: res.user.displayName, avatarUrl: res.user.avatarUrl } } : m)),
      )
      setDmMessages((prev) =>
        prev.map((m) => (m.author.id === res.user.id ? { ...m, author: { ...m.author, displayName: res.user.displayName, avatarUrl: res.user.avatarUrl } } : m)),
      )
      setMembers((prev) => prev.map((m) => (m.id === res.user.id ? { ...m, displayName: res.user.displayName, avatarUrl: res.user.avatarUrl } : m)))
      setFriends((prev) => prev.map((f) => (f.id === res.user.id ? { ...f, displayName: res.user.displayName, avatarUrl: res.user.avatarUrl } : f)))
      pushToast('Profile', 'Updated', 'success')
      setProfileOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'profile_failed'
      setProfileError(msg)
      pushToast('Profile', msg, 'error')
    } finally {
      setProfileBusy(false)
    }
  }

  function applyPresence(entries: PresenceEntry[]) {
    setPresenceByUserId((prev) => {
      const next = { ...prev }
      for (const e of entries) next[e.userId] = { status: e.status, lastSeenAt: e.lastSeenAt }
      return next
    })
  }

  function getPresenceFor(userId: string): { status: 'online' | 'idle' | 'offline'; lastSeenAt: string | null } {
    const p = presenceByUserId[userId]
    const s = p?.status || 'OFFLINE'
    if (s === 'ONLINE') return { status: 'online', lastSeenAt: p?.lastSeenAt || null }
    if (s === 'IDLE') return { status: 'idle', lastSeenAt: p?.lastSeenAt || null }
    return { status: 'offline', lastSeenAt: p?.lastSeenAt || null }
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
      setAdminAllowedOriginsText((sec.security.allowedOrigins || []).join('\n'))
      setAdminCspEnabled(!!sec.security.cspEnabled)
      setAdminRateLimitEnabled(!!sec.security.rateLimitEnabled)
      setAdminRateLimitWindowMs(sec.security.rateLimitWindowMs)
      setAdminRateLimitAuthMax(sec.security.rateLimitAuthMax)
      setAdminRateLimitAdminMax(sec.security.rateLimitAdminMax)
      setAdminRateLimitApiMax(sec.security.rateLimitApiMax)
      setAdminSessionCookieSameSite(sec.security.sessionCookieSameSite)
      setAdminSessionCookieSecure(sec.security.sessionCookieSecure)
      setAdminSessionCookieMaxAgeMs(sec.security.sessionCookieMaxAgeMs)
      setAdminLockdownEnabled(!!sec.security.lockdownEnabled)
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : 'admin_refresh_failed')
    } finally {
      setAdminBusy(false)
    }
  }

  async function onSaveAdminSecurity() {
    if (!user || !adminAuthed) return
    setAdminSecurityBusy(true)
    setAdminSecurityError(null)
    try {
      const allowedOrigins = adminAllowedOriginsText
        .split(/\r?\n|,/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100)
      const res = await apiAdminUpdateSecurity({
        allowedOrigins,
        cspEnabled: adminCspEnabled,
        rateLimitEnabled: adminRateLimitEnabled,
        rateLimitWindowMs: adminRateLimitWindowMs,
        rateLimitAuthMax: adminRateLimitAuthMax,
        rateLimitAdminMax: adminRateLimitAdminMax,
        rateLimitApiMax: adminRateLimitApiMax,
        sessionCookieSameSite: adminSessionCookieSameSite,
        sessionCookieSecure: adminSessionCookieSecure,
        sessionCookieMaxAgeMs: adminSessionCookieMaxAgeMs,
        lockdownEnabled: adminLockdownEnabled,
      })
      setAdminSecurity(res.security)
      setAdminAllowedOriginsText((res.security.allowedOrigins || []).join('\n'))
      setAdminCspEnabled(!!res.security.cspEnabled)
      setAdminRateLimitEnabled(!!res.security.rateLimitEnabled)
      setAdminRateLimitWindowMs(res.security.rateLimitWindowMs)
      setAdminRateLimitAuthMax(res.security.rateLimitAuthMax)
      setAdminRateLimitAdminMax(res.security.rateLimitAdminMax)
      setAdminRateLimitApiMax(res.security.rateLimitApiMax)
      setAdminSessionCookieSameSite(res.security.sessionCookieSameSite)
      setAdminSessionCookieSecure(res.security.sessionCookieSecure)
      setAdminSessionCookieMaxAgeMs(res.security.sessionCookieMaxAgeMs)
      setAdminLockdownEnabled(!!res.security.lockdownEnabled)
      pushToast('Equinox', 'Security settings updated', 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'security_update_failed'
      setAdminSecurityError(msg)
      pushToast('Equinox', msg, 'error')
    } finally {
      setAdminSecurityBusy(false)
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
    try {
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
    } catch {
      setUser(null)
      setServers([])
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
        const minMs = 750
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
      setSocketError(err?.message || 'connect_error')
    })

    s.on('presence:changed', (payload: { userId: string; status: PresenceStatus; lastSeenAt: string | null }) => {
      applyPresence([{ userId: payload.userId, status: payload.status, lastSeenAt: payload.lastSeenAt }])
    })

    const onFocus = () => {
      try {
        s.emit('presence:update', { status: 'ONLINE' })
      } catch {
        // ignore
      }
    }

    const onBlur = () => {
      try {
        s.emit('presence:update', { status: 'IDLE' })
      } catch {
        // ignore
      }
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)

    s.on('chat:message', (msg: ApiMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })

      const active = navMode === 'server' && selectedChannelId === msg.channelId
      if (!active) {
        setChannelUnread((prev) => ({ ...prev, [msg.channelId]: (prev[msg.channelId] || 0) + 1 }))

        const uname = user?.username?.trim()
        if (uname) {
          const needle = `@${uname}`
          if (typeof msg.content === 'string' && msg.content.toLowerCase().includes(needle.toLowerCase())) {
            pushToast('Mention', `@${uname} in #${channels.find((c) => c.id === msg.channelId)?.name || 'channel'}`, 'default')
          }
        }
      }
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
    if (!user) return

    const ids = new Set<string>()
    for (const m of members) ids.add(m.id)
    for (const t of dmThreads) ids.add(t.otherUser.id)
    for (const f of friends) ids.add(f.id)
    ids.delete(user.id)

    const list = Array.from(ids)
    if (!list.length) return

    apiPresence(list)
      .then((r) => applyPresence(r.presence))
      .catch(() => {})
  }, [user, members, dmThreads, friends])

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
      const typing = Object.entries(channelTypers[selectedChannelId] || {})
        .filter(([_, v]) => v)
        .map(([username]) => username)
      if (typing.length === 0) return ''
      if (typing.length === 1) return `${typing[0]} is typing...`
      if (typing.length === 2) return `${typing[0]} and ${typing[1]} are typing...`
      return `${typing.slice(0, -1).join(', ')} and ${typing[typing.length - 1]} are typing...`
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
    if (!selectedChannelId) return
    if (navMode !== 'server') return
    setChannelUnread((prev) => {
      if (!prev[selectedChannelId]) return prev
      const next = { ...prev }
      delete next[selectedChannelId]
      return next
    })
  }, [selectedChannelId, navMode])

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
    if (!content && uploadedFiles.length === 0) return
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
      setUploadedFiles([])
      return
    }

    if (navMode === 'home') {
      if (!selectedDmThreadId) return
      socketRef.current.emit('dm:send', { threadId: selectedDmThreadId, content, replyToId })
      setMessageText('')
      setReplyingTo(null)
      setUploadedFiles([])
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
      <DialogContent className="border-white/10 bg-px-panel text-px-text max-w-md">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-[linear-gradient(180deg,rgba(239,68,68,0.95),rgba(239,68,68,0.65))] shadow-soft grid place-items-center font-black ring-1 ring-white/10">
            PX
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-extrabold">PXHB Chatting</div>
            <div className="truncate text-sm text-px-text2">Secure session • Protected by Equinox</div>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              className={authMode === 'login' ? 'h-9 bg-white/15 text-px-text hover:bg-white/20' : 'h-9 bg-white/5 text-px-text2 hover:bg-white/10'}
              onClick={() => {
                setAuthMode('login')
                setAuthError(null)
              }}
              disabled={authBusy}
            >
              Login
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={authMode === 'register' ? 'h-9 bg-white/15 text-px-text hover:bg-white/20' : 'h-9 bg-white/5 text-px-text2 hover:bg-white/10'}
              onClick={() => {
                setAuthMode('register')
                setAuthError(null)
              }}
              disabled={authBusy}
            >
              Register
            </Button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <DialogHeader>
              <DialogTitle>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</DialogTitle>
              <DialogDescription className="text-px-text2">
                {authMode === 'login'
                  ? 'Sign in to join servers and continue your conversations.'
                  : 'Choose a username and password to start chatting.'}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-3">
              <div className="grid gap-1">
                <div className="text-xs font-extrabold tracking-wide text-px-text2">USERNAME</div>
                <Input
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="yourname"
                  className="border-white/10 bg-black/20 text-px-text placeholder:text-px-text2"
                  autoCapitalize="none"
                  autoComplete="username"
                />
              </div>
              <div className="grid gap-1">
                <div className="text-xs font-extrabold tracking-wide text-px-text2">PASSWORD</div>
                <Input
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder={authMode === 'login' ? '••••••••' : 'min 6 characters'}
                  type="password"
                  className="border-white/10 bg-black/20 text-px-text placeholder:text-px-text2"
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSubmitAuth()
                  }}
                />
              </div>
              {authError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300">
                  {authError}
                </div>
              ) : null}
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="secondary"
                className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
                onClick={() => setAuthOpen(false)}
                disabled={authBusy}
              >
                Cancel
              </Button>
              <Button className="h-9 bg-px-brand text-white hover:bg-px-brand/90" onClick={onSubmitAuth} disabled={authBusy}>
                {authBusy ? 'Signing in…' : authMode === 'login' ? 'Login' : 'Create account'}
              </Button>
            </DialogFooter>
          </div>

          <div className="text-center text-xs text-px-text2">
            By continuing, you agree to the site security rules enforced by Equinox.
          </div>
        </div>
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
      const uname = authUsername.trim().toLowerCase()
      if (authMode === 'login') {
        const res = await apiLogin(uname, authPassword)
        setUser(res.user)
      } else {
        const res = await apiRegister(uname, authPassword)
        setUser(res.user)
      }
      setAuthOpen(false)
      setAuthPassword('')
      await refreshMeAndServers()
      pushToast('Welcome', `Signed in as ${uname}`, 'success')
    } catch (e) {
      const msg = friendlyError(e)
      setAuthError(msg)
      pushToast('Auth failed', msg, 'error')
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

  async function onSaveServerSettings() {
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return
    }
    if (!selectedServerId) return

    setServerManageBusy(true)
    setServerSettingsError(null)
    try {
      const name = serverSettingsName.trim()
      const iconUrl = serverSettingsIconUrl.trim()

      const payload: { name?: string; iconUrl?: string | null } = {}
      if (name) payload.name = name
      if (iconUrl) payload.iconUrl = iconUrl
      if (!iconUrl) payload.iconUrl = null

      const res = await apiUpdateServer(selectedServerId, payload)

      setServers((prev) => prev.map((s) => (s.id === res.server.id ? { ...s, ...res.server } : s)))
      pushToast('Server updated', res.server.name, 'success')
      setServerManageOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'update_failed'
      setServerSettingsError(msg)
      pushToast('Server update failed', msg, 'error')
    } finally {
      setServerManageBusy(false)
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

              <div className="mt-6">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-px-brand" />
                  <div className="text-sm font-semibold text-px-text2">Establishing session…</div>
                </div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-px-brand/60" />
                </div>
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

  return (
    <div className="relative h-full w-full bg-px-bg">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.22),transparent_62%)] blur-2xl" />
        <div className="absolute -bottom-64 right-[-180px] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.10),transparent_64%)] blur-2xl" />
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              t.tone === 'success'
                ? 'pointer-events-auto rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 shadow-soft'
              : t.tone === 'error'
                  ? 'pointer-events-auto rounded-2xl border border-red-500/30 bg-red-500/10 p-3 shadow-soft'
                  : 'pointer-events-auto rounded-2xl border border-white/10 bg-px-panel/80 p-3 shadow-soft backdrop-blur'
            }
          >
            <div className="text-sm font-extrabold text-px-text">{t.title}</div>
            {t.message ? <div className="mt-1 text-sm text-px-text2">{t.message}</div> : null}
          </div>
        ))}
      </div>

      <div className="relative grid h-full w-full grid-cols-[72px_280px_1fr_320px] max-lg:grid-cols-[72px_280px_1fr]">
        <aside className="bg-px-rail border-r border-white/5 p-2">
          <div className="flex h-full flex-col items-center gap-2">
            <div className="h-12 w-12 rounded-2xl bg-[linear-gradient(180deg,rgba(239,68,68,0.95),rgba(239,68,68,0.65))] shadow-soft grid place-items-center font-black ring-1 ring-white/10 transition-transform will-change-transform hover:scale-[1.03] active:scale-[0.98]">
              PX
            </div>

            <button
              type="button"
              className={
                navMode === 'home'
                  ? 'h-12 w-12 rounded-2xl bg-white/20 grid place-items-center text-sm font-black transition-all hover:bg-white/25 active:scale-[0.98]'
                  : 'h-12 w-12 rounded-2xl bg-white/10 grid place-items-center text-sm font-black transition-all hover:bg-white/15 active:scale-[0.98]'
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
                    ? 'h-12 w-12 rounded-2xl bg-white/20 grid place-items-center text-sm font-black transition-all hover:bg-white/25 active:scale-[0.98]'
                    : 'h-12 w-12 rounded-2xl bg-white/10 grid place-items-center text-sm font-black transition-all hover:bg-white/15 active:scale-[0.98]'
                }
                title={s.name}
                onClick={() => {
                  setNavMode('server')
                  setSelectedServerId(s.id)
                }}
              >
                {s.iconUrl ? (
                  <img src={s.iconUrl} alt={s.name} className="h-12 w-12 rounded-2xl object-cover" />
                ) : (
                  s.name.slice(0, 1).toUpperCase()
                )}
              </button>
            ))}

            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 rounded-2xl bg-white/10 text-px-text2 transition-all hover:bg-white/15 active:scale-[0.98]"
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
              <button
                type="button"
                className="h-12 w-12 rounded-2xl bg-white/5 ring-1 ring-white/10 grid place-items-center text-sm text-px-text2 hover:bg-white/10 transition-all active:scale-[0.98]"
                title={navMode === 'server' ? 'Server settings' : 'Settings'}
                onClick={() => {
                  if (navMode !== 'server' || !selectedServerId) return
                  const s = servers.find((x) => x.id === selectedServerId)
                  setServerSettingsName(s?.name || '')
                  setServerSettingsIconUrl(s?.iconUrl || '')
                  setServerSettingsError(null)
                  setServerManageOpen(true)
                }}
              >
                <Settings className="h-5 w-5" />
              </button>
              <div className="text-[10px] font-extrabold tracking-wide text-px-text2">Protected by Equinox V1</div>
            </div>
          </div>
        </aside>

        <aside className="bg-px-panel border-r border-white/5 flex h-full flex-col animate-in fade-in duration-200">
          <div className="p-3">
            <div className="mb-3 flex items-center gap-2">
              <Avatar className="h-9 w-9 rounded-xl">
                <AvatarImage
                  src={navMode === 'server' ? servers.find((s) => s.id === selectedServerId)?.iconUrl || '' : ''}
                  alt=""
                  className="object-cover"
                />
                <AvatarFallback className="rounded-xl bg-white/5 ring-1 ring-white/10 text-xs">
                  {navMode === 'server'
                    ? (servers.find((s) => s.id === selectedServerId)?.name || 'S').slice(0, 1).toUpperCase()
                    : 'PX'}
                </AvatarFallback>
              </Avatar>
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
                        (() => {
                          const p = getPresenceFor(t.otherUser.id)
                          const dot = p.status === 'online' ? 'bg-px-success' : p.status === 'idle' ? 'bg-amber-400' : 'bg-white/20'
                          return (
                            <div className="relative">
                              <Avatar className="h-7 w-7">
                                {t.otherUser.avatarUrl ? <AvatarImage src={t.otherUser.avatarUrl} alt="" className="object-cover" /> : null}
                                <AvatarFallback className="text-[10px]">{displayNameFor(t.otherUser).slice(0, 1).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-px-panel ${dot}`} />
                            </div>
                          )
                        })()
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
                      subtitle={(() => {
                        const p = getPresenceFor(t.otherUser.id)
                        if (p.status === 'online') return 'Online'
                        if (p.status === 'idle') return 'Idle'
                        return p.lastSeenAt ? `Last seen ${new Date(p.lastSeenAt).toLocaleString()}` : 'Offline'
                      })()}
                    >
                      {displayNameFor(t.otherUser)}
                    </ChannelButton>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-extrabold tracking-wide text-px-text2">DIRECT MESSAGES</div>
                    <div className="mt-2 text-sm font-semibold text-px-text">Start a conversation</div>
                    <div className="mt-1 text-sm text-px-text2">Open Friends and click DM to begin.</div>
                    <div className="mt-3">
                      <Button
                        variant="secondary"
                        className="h-9 w-full bg-white/5 text-px-text2 hover:bg-white/10"
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
                        Open Friends
                      </Button>
                    </div>
                  </div>
                )
              ) : channels.length ? (
                channels.map((c) => (
                  <ChannelButton
                    key={c.id}
                    active={c.id === selectedChannelId}
                    onClick={() => setSelectedChannelId(c.id)}
                    leading={<Hash className="h-4 w-4 text-px-text2" />}
                    trailing={
                      channelUnread[c.id] ? (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-px-brand px-1.5 text-[10px] font-extrabold text-white">
                          {channelUnread[c.id] > 99 ? '99+' : String(channelUnread[c.id])}
                        </span>
                      ) : null
                    }
                  >
                    {c.name}
                  </ChannelButton>
                ))
              ) : (
                channelsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-11 w-full animate-pulse rounded-xl bg-white/4 border border-white/8"></div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/8 bg-white/4 p-6 text-center">
                    <div className="mx-auto h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                      <Hash className="h-6 w-6 text-px-text2/40" />
                    </div>
                    <div className="text-sm font-semibold text-px-text mb-2">No channels yet</div>
                    <div className="text-xs text-px-text2/70 mb-4">Create your first channel to start chatting</div>
                    <Button
                      variant="secondary"
                      className="h-9 bg-white/6 border border-white/8 text-px-text hover:bg-white/10 hover:border-white/12 transition-all"
                      onClick={() => {
                        if (!user) {
                          setAuthMode('login')
                          setAuthOpen(true)
                          return
                        }
                        setCreateChannelOpen(true)
                      }}
                    >
                      Create Channel
                    </Button>
                  </div>
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
                  {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" className="object-cover" /> : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-bold">{displayName}</div>
                  <div className="truncate text-xs text-px-text2">{user ? 'online' : 'offline'}</div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                {user ? (
                  <>
                    <Button
                      variant="secondary"
                      className="h-9 w-full bg-white/5 text-px-text2 hover:bg-white/10"
                      onClick={() => {
                        setProfileDisplayName(user.displayName || '')
                        setProfileAvatarUrl(user.avatarUrl || '')
                        setProfileError(null)
                        setProfileOpen(true)
                      }}
                    >
                      Profile
                    </Button>
                    <Button variant="secondary" className="h-9 w-full bg-white/5 text-px-text2 hover:bg-white/10" onClick={onLogout}>
                      Logout
                    </Button>
                  </>
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
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/8 bg-gradient-to-b from-px-panel2/95 to-px-panel2/80 px-3 lg:px-6 backdrop-blur-xl supports-[backdrop-filter]:bg-px-panel2/70 shadow-lg">
            <div className="flex items-center gap-3 lg:gap-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="relative h-9 lg:h-10 w-9 lg:w-10 rounded-xl bg-gradient-to-br from-white/12 to-white/4 grid place-items-center shadow-sm border border-white/8 transition-all hover:scale-105">
                  {navMode === 'home' ? <MessageCircle className="h-4 lg:h-5 w-4 lg:w-5 text-px-text" /> : <Hash className="h-4 lg:h-5 w-4 lg:w-5 text-px-text" />}
                  <div className="absolute -bottom-0.5 -right-0.5 h-2.5 lg:h-3 w-2.5 lg:w-3 rounded-full bg-px-success shadow-lg shadow-px-success/50 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm lg:text-base font-semibold tracking-tight text-px-text">
                    {navMode === 'home'
                      ? dmThreads.find((t) => t.id === selectedDmThreadId)?.otherUser.username || 'Home'
                      : servers.find((s) => s.id === selectedServerId)?.name || 'Server'}
                  </div>
                  <div className="truncate text-xs lg:text-xs font-medium text-px-text2/70 hidden sm:block">
                    {navMode === 'home'
                      ? selectedDmThreadId
                        ? 'Direct Messages'
                        : 'Friends • DMs'
                      : `# ${channels.find((c) => c.id === selectedChannelId)?.name || 'general'}`}
                  </div>
                </div>
              </div>
              <div className="hidden lg:flex items-center gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-1.5 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${apiHealth === 'ok' ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-red-400 shadow-red-400/50'} animate-pulse`} />
                  <span className="text-[10px] font-medium text-px-text2">API</span>
                </div>
                <span className="text-white/15 text-xs">|</span>
                <div className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${socketConnected ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-amber-400 shadow-amber-400/50'} ${socketConnected ? '' : 'animate-pulse'}`} />
                  <span className="text-[10px] font-medium text-px-text2">Socket</span>
                </div>
                {socketError ? <span className="text-xs font-medium text-red-300 ml-1">({socketError})</span> : null}
                {socketTarget ? <span className="text-[9px] font-medium text-px-text2/60 ml-1">@ {socketTarget}</span> : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center rounded-lg border border-white/8 bg-white/4 px-2.5 py-1 text-[9px] font-semibold text-px-text2/80">
                <span className="hidden lg:inline">Equinox V1</span>
                <span className="lg:hidden">E1</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  className="h-8 lg:h-9 rounded-lg bg-white/4 border border-white/8 text-px-text2 transition-all hover:bg-white/8 hover:border-white/12 active:scale-[0.97] text-xs lg:text-sm px-2.5 lg:px-3.5 shadow-sm"
                  onClick={() => {
                    setPinsOpen(true)
                    if (user) refreshPins()
                  }}
                  disabled={!user || (navMode === 'server' ? !selectedChannelId : !selectedDmThreadId)}
                >
                  <Pin className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                  <span className="hidden lg:inline ml-1.5">Pins</span>
                </Button>
                <Button
                  variant="secondary"
                  className="h-8 lg:h-9 rounded-lg bg-white/4 border border-white/8 text-px-text2 transition-all hover:bg-white/8 hover:border-white/12 active:scale-[0.97] text-xs lg:text-sm px-2.5 lg:px-3.5 shadow-sm"
                  onClick={() => {
                    setSearchOpen(true)
                    setSearchError(null)
                    setSearchResults([])
                  }}
                  disabled={!user || (navMode === 'server' ? !selectedChannelId : !selectedDmThreadId)}
                >
                  <Hash className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                  <span className="hidden lg:inline ml-1.5">Search</span>
                </Button>
                <Button
                  variant="secondary"
                  className="h-8 lg:h-9 rounded-lg bg-white/4 border border-white/8 text-px-text2 transition-all hover:bg-white/8 hover:border-white/12 active:scale-[0.97] text-xs lg:text-sm px-2.5 lg:px-3.5 shadow-sm"
                  onClick={() => {
                    setAdminOpen(true)
                    setAdminError(null)
                    if (user && adminAuthed) {
                      refreshAdminData()
                    }
                  }}
                  disabled={!user}
                >
                  <Settings className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                  <span className="hidden lg:inline ml-1.5">Admin</span>
                </Button>
                {navMode === 'server' && selectedServerId && (
                  <Button
                    variant="secondary"
                    className="h-8 lg:h-9 rounded-lg bg-white/4 border border-white/8 text-px-text2 transition-all hover:bg-white/8 hover:border-white/12 active:scale-[0.97] text-xs lg:text-sm px-2.5 lg:px-3.5 shadow-sm"
                    onClick={() => setServerManageOpen(true)}
                    disabled={!user}
                  >
                    <Building className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    <span className="hidden lg:inline ml-1.5">Server</span>
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="h-8 lg:h-9 rounded-lg bg-white/4 border border-white/8 text-px-text2 transition-all hover:bg-white/8 hover:border-white/12 active:scale-[0.97] text-xs lg:text-sm px-2.5 lg:px-3.5 shadow-sm"
                  onClick={() => setNotificationsOpen(true)}
                  disabled={!user}
                >
                  <MessageCircle className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                  <span className="hidden lg:inline ml-1.5">Alerts</span>
                </Button>
              </div>
              <Button
                variant="secondary"
                className="h-9 bg-white/5 text-px-text2 transition-all hover:bg-white/10 active:scale-[0.98]"
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
                className="h-9 bg-white/5 text-px-text2 transition-all hover:bg-white/10 active:scale-[0.98]"
                onClick={() => {
                  setJoinError(null)
                  setInviteOpen(true)
                }}
              >
                Invite
              </Button>
              <Button
                variant="secondary"
                className="h-9 bg-white/5 text-px-text2 transition-all hover:bg-white/10 active:scale-[0.98]"
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
                className="h-9 bg-white/5 text-px-text2 transition-all hover:bg-white/10 active:scale-[0.98]"
                onClick={() => {
                  setDeleteChannelError(null)
                  setDeleteChannelOpen(true)
                }}
                disabled={!user || !selectedChannelId}
              >
                Delete
              </Button>
              {user ? (
                <Button variant="secondary" className="h-9 bg-white/5 text-px-text2 transition-all hover:bg-white/10 active:scale-[0.98]" onClick={onLogout}>
                  Logout
                </Button>
              ) : (
                <Button
                  className="h-9 bg-px-brand text-white transition-all hover:bg-px-brand/90 active:scale-[0.98]"
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
            <div className="p-6">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                {!user ? (
                  <div className="rounded-3xl border border-white/10 bg-px-panel/60 p-8 shadow-soft backdrop-blur">
                    <div className="text-xs font-extrabold tracking-[0.25em] text-px-text2">WELCOME</div>
                    <div className="mt-2 text-2xl font-black text-px-text">Sign in to start chatting</div>
                    <div className="mt-2 text-sm text-px-text2">Your messages, servers, and friends will load after you login.</div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        className="h-9 bg-px-brand text-white hover:bg-px-brand/90"
                        onClick={() => {
                          setAuthMode('login')
                          setAuthOpen(true)
                        }}
                      >
                        Login
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
                        onClick={() => {
                          setAuthMode('register')
                          setAuthOpen(true)
                        }}
                      >
                        Create account
                      </Button>
                    </div>
                  </div>
                ) : navMode === 'server' && servers.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-px-panel/60 p-8 shadow-soft backdrop-blur">
                    <div className="text-xs font-extrabold tracking-[0.25em] text-px-text2">NO SERVERS</div>
                    <div className="mt-2 text-2xl font-black text-px-text">Create your first server</div>
                    <div className="mt-2 text-sm text-px-text2">Use the + button in the left rail to create a server and invite friends.</div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        className="h-9 bg-px-brand text-white hover:bg-px-brand/90"
                        onClick={() => {
                          if (!user) {
                            setAuthMode('login')
                            setAuthOpen(true)
                            return
                          }
                          setCreateServerOpen(true)
                        }}
                      >
                        Create server
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
                        onClick={() => {
                          setJoinError(null)
                          setInviteOpen(true)
                        }}
                        disabled={!user}
                      >
                        Join with invite
                      </Button>
                    </div>
                  </div>
                ) : navMode === 'server' && !selectedChannelId ? (
                  <div className="rounded-3xl border border-white/10 bg-px-panel/60 p-8 shadow-soft backdrop-blur">
                    <div className="text-xs font-extrabold tracking-[0.25em] text-px-text2">READY</div>
                    <div className="mt-2 text-2xl font-black text-px-text">Pick a channel</div>
                    <div className="mt-2 text-sm text-px-text2">Choose a text channel in the left sidebar to load messages.</div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        className="h-9 bg-px-brand text-white hover:bg-px-brand/90"
                        onClick={() => {
                          if (!user) {
                            setAuthMode('login')
                            setAuthOpen(true)
                            return
                          }
                          setCreateChannelOpen(true)
                        }}
                      >
                        New channel
                      </Button>
                    </div>
                  </div>
                ) : navMode === 'home' && !selectedDmThreadId ? (
                  <div className="rounded-3xl border border-white/10 bg-px-panel/60 p-8 shadow-soft backdrop-blur">
                    <div className="text-xs font-extrabold tracking-[0.25em] text-px-text2">DIRECT MESSAGES</div>
                    <div className="mt-2 text-2xl font-black text-px-text">Select a DM</div>
                    <div className="mt-2 text-sm text-px-text2">Open a conversation from the left to start chatting.</div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        className="h-9 bg-px-brand text-white hover:bg-px-brand/90"
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
                        Find friends
                      </Button>
                    </div>
                  </div>
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
                        <div key={m.id} className="rounded-2xl px-2 py-1 hover:bg-white/[0.03] transition-colors">
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
                              who={displayNameFor(m.author)}
                              avatarUrl={m.author.avatarUrl || null}
                              text={showText}
                              tone={isDeleted ? 'system' : m.author.id === user?.id ? 'me' : 'bot'}
                              createdAt={m.createdAt}
                              showHeader={showHeader}
                              replyPreview={m.replyTo ? { who: displayNameFor(m.replyTo.author), text: m.replyTo.content } : null}
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
                              canModerate={canModerate() && !isMine && !isDeleted}
                              onModerate={() => openModeration('message', m.id, m)}
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
                    ) : messages.length ? (
                      messages.map((m, idx) => {
                        const prev = messages[idx - 1]
                        const sameAuthor = prev && prev.author.id === m.author.id
                        const showHeader = !sameAuthor
                        const isMine = m.author.id === user?.id
                        const isDeleted = !!m.deletedAt
                        const showText = isDeleted ? 'Message deleted' : m.content
                        return (
                          <div key={m.id} className="rounded-2xl px-2 py-1 hover:bg-white/[0.03] transition-colors">
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
                                who={displayNameFor(m.author)}
                                avatarUrl={m.author.avatarUrl || null}
                                text={showText}
                                tone={isDeleted ? 'system' : m.author.id === user?.id ? 'me' : 'bot'}
                                createdAt={m.createdAt}
                                showHeader={showHeader}
                                replyPreview={m.replyTo ? { who: displayNameFor(m.replyTo.author), text: m.replyTo.content } : null}
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
                                canModerate={canModerate() && !isMine && !isDeleted}
                                onModerate={() => openModeration('message', m.id, m)}
                              />
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                        <div className="h-16 w-16 rounded-2xl bg-white/4 flex items-center justify-center mb-6 border border-white/8">
                          <MessageCircle className="h-8 w-8 text-px-text2/30" />
                        </div>
                        <div className="text-lg font-semibold text-px-text mb-2">No messages in this channel</div>
                        <div className="text-sm text-px-text2/70 max-w-md">Be the first to say something! Start a conversation with your team.</div>
                      </div>
                    )}
              </div>
            </div>
          </ScrollArea>

          <footer className="border-t border-white/8 bg-gradient-to-t from-px-panel2/95 to-px-panel2/80 p-4 backdrop-blur-xl">
            <div className="mx-auto flex max-w-4xl flex-col gap-3">
              {typingLabel ? <div className="px-3 py-1.5 text-xs font-medium text-px-text2/80 bg-white/4 rounded-lg w-fit">{typingLabel}</div> : null}
              {replyingTo ? (
                <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-px-text">Replying to {replyingTo.who}</div>
                    <div className="truncate text-xs text-px-text2/70">{replyingTo.preview}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg bg-white/5 text-px-text2 hover:bg-white/10 transition-all"
                    onClick={() => setReplyingTo(null)}
                  >
                    ×
                  </Button>
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/8 bg-px-panel/70 p-3.5 shadow-lg backdrop-blur-sm">
                {/* File Preview */}
                {uploadedFiles.length > 0 && (
                  <div className="mb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-px-text/90">Attachments ({uploadedFiles.length})</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-px-text2/80 hover:bg-white/10 rounded-lg transition-all"
                        onClick={clearAllFiles}
                      >
                        Clear All
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 p-2 transition-all hover:bg-white/6">
                          <div className="h-7 w-7 rounded-md bg-px-brand/15 flex items-center justify-center text-px-brand text-sm">
                            📎
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-px-text">{file.name}</div>
                            <div className="text-xs text-px-text2/60">{(file.size / 1024).toFixed(1)} KB</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-md text-px-text2/70 hover:bg-white/10 transition-all"
                            onClick={() => removeFile(index)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex items-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-px-text2/80 hover:bg-white/8 hover:text-px-text transition-all"
                    onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                    disabled={navMode === 'home' ? !selectedDmThreadId || !socketConnected : !selectedChannelId || !socketConnected}
                  >
                    😊
                  </Button>
                  
                  <div className="relative">
                    <input
                      type="file"
                      multiple
                      className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                      onChange={handleFileUpload}
                      disabled={navMode === 'home' ? !selectedDmThreadId || !socketConnected : !selectedChannelId || !socketConnected}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl text-px-text2/80 hover:bg-white/8 hover:text-px-text transition-all"
                      disabled={navMode === 'home' ? !selectedDmThreadId || !socketConnected : !selectedChannelId || !socketConnected}
                    >
                      📎
                    </Button>
                  </div>
                  
                  <div className="flex-1">
                    <Input
                      className="border-white/10 bg-white/6 text-px-text placeholder:text-px-text2/50 rounded-xl px-4 py-2.5 transition-all focus:border-px-brand/30 focus:bg-white/8 focus:shadow-lg"
                      onFocus={() => emitTyping(true)}
                      onBlur={() => emitTyping(false)}
                      value={messageText}
                      placeholder={
                        navMode === 'home'
                          ? selectedDmThreadId
                            ? 'Type a message...'
                            : 'Select a conversation'
                          : selectedChannelId
                            ? 'Message #' + (channels.find((c) => c.id === selectedChannelId)?.name || 'general')
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
                  </div>
                  <Button
                    className="h-9 rounded-xl bg-gradient-to-r from-px-brand to-px-brand/80 px-5 font-semibold text-white shadow-lg shadow-px-brand/25 transition-all hover:scale-105 hover:shadow-px-brand/35 active:scale-[0.97] disabled:opacity-40 disabled:scale-100"
                    onClick={onSendMessage}
                    disabled={navMode === 'home' ? !selectedDmThreadId || !socketConnected : !selectedChannelId || !socketConnected}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </footer>
        </main>

        {/* Emoji Picker Dialog */}
        {emojiPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEmojiPickerOpen(false)}>
            <div className="mx-4 max-w-md w-full rounded-3xl border border-white/10 bg-px-panel p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-px-text">Emoji Picker</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-px-text2 hover:bg-white/10"
                  onClick={() => setEmojiPickerOpen(false)}
                >
                  ×
                </Button>
              </div>
              <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto">
                {commonEmojis.map((emoji, index) => (
                  <button
                    key={index}
                    className="h-10 w-10 rounded-xl hover:bg-white/10 transition-all text-lg flex items-center justify-center text-px-text hover:scale-110"
                    onClick={() => insertEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {navMode === 'server' ? (
          <aside className="bg-px-panel border-l border-white/5 hidden h-full flex-col lg:flex">
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
                  members.map((m) => {
                    const p = getPresenceFor(m.id)
                    return <Member key={m.id} name={displayNameFor(m)} username={m.username} avatarUrl={m.avatarUrl || null} status={p.status} lastSeenAt={p.lastSeenAt} />
                  })
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-px-text">No members</div>
                    <div className="mt-1 text-sm text-px-text2">Invite people to this server.</div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>
        ) : (
          <aside className="bg-px-panel border-l border-white/5 hidden h-full flex-col lg:flex">
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
        <DialogContent className="bg-px-panel border-white/10 text-px-text max-w-4xl">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>{navMode === 'server' ? 'Search this channel' : 'Search this DM'} • Protected by Equinox V1</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search messages (Ctrl+K)"
                className="flex-1 border-white/12 bg-white/8 text-px-text placeholder:text-px-text2/60 transition-all focus:border-px-brand/40 focus:bg-white/10"
                autoFocus
              />
              <Button className="bg-gradient-to-r from-px-brand to-px-brand/90 text-white hover:from-px-brand/90 hover:to-px-brand shadow-lg shadow-px-brand/30 transition-all hover:scale-105" onClick={runSearch} disabled={searchBusy}>
                {searchBusy ? 'Searching…' : 'Search'}
              </Button>
            </div>

            <div className="flex gap-2">
              <select
                value={searchFilters.author}
                onChange={(e) => setSearchFilters((f) => ({ ...f, author: e.target.value }))}
                className="h-9 rounded-xl border border-white/10 bg-white/8 px-3 text-sm text-px-text transition-all focus:border-px-brand/40 focus:bg-white/10"
              >
                <option value="">All authors</option>
                {navMode === 'server' ? members.map((m) => <option key={m.id}>{displayNameFor(m)}</option>) : dmThreads.map((t) => <option key={t.id}>{t.otherUser.username}</option>)}
              </select>
              <Button
                variant={searchFilters.hasReactions ? 'default' : 'secondary'}
                size="sm"
                className="h-9 px-3 rounded-xl border border-white/10 bg-white/8 text-px-text transition-all hover:border-px-brand/40 hover:bg-white/10"
                onClick={() => setSearchFilters((f) => ({ ...f, hasReactions: !f.hasReactions }))}
              >
                <span className={searchFilters.hasReactions ? 'text-px-brand' : ''}>Reactions</span>
              </Button>
              <Button
                variant={searchFilters.isPinned ? 'default' : 'secondary'}
                size="sm"
                className="h-9 px-3 rounded-xl border border-white/10 bg-white/8 text-px-text transition-all hover:border-px-brand/40 hover:bg-white/10"
                onClick={() => setSearchFilters((f) => ({ ...f, isPinned: !f.isPinned }))}
              >
                <span className={searchFilters.isPinned ? 'text-px-brand' : ''}>Pinned</span>
              </Button>
            </div>
          </div>

          {searchError ? <div className="text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{searchError}</div> : null}
          {searchBusy ? <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-px-brand border-t-transparent animate-spin"></div></div> : null}
          {!searchBusy && !searchError && searchQ.trim() && searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-sm font-semibold text-px-text">No results</div>
              <div className="mt-1 text-sm text-px-text2">Try adjusting your search or filters</div>
            </div>
          ) : null}

          <div className="max-h-[50vh] overflow-auto rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="space-y-2">
              {searchResults.map((m) => {
                  const isDm = 'threadId' in m
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-left transition-all hover:border-px-brand/20 hover:bg-white/8 hover:shadow-sm group"
                      onClick={() => {
                        setSearchOpen(false)
                        if (isDm && m.threadId !== selectedDmThreadId) {
                          openDmThreadFromList(dmThreads.find((t) => t.id === m.threadId)!)
                        } else if (!isDm && m.channelId !== selectedChannelId) {
                          setSelectedChannelId(m.channelId)
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 rounded-lg border border-white/10 shadow-sm">
                          {m.author.avatarUrl ? <AvatarImage src={m.author.avatarUrl} alt="" className="object-cover" /> : null}
                          <AvatarFallback className="text-xs font-bold">{displayNameFor(m.author).slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-px-text group-hover:text-px-text transition-colors">{m.author.username}</div>
                          <div className="truncate text-xs text-px-text2 mt-1">{m.deletedAt ? 'Message deleted' : m.content}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-px-text2">{new Date(m.createdAt).toLocaleString()}</span>
                            {m.reactions && Object.keys(m.reactions).length > 0 && (
                              <div className="flex gap-1">
                                {Object.entries(m.reactions).map(([emoji, users]) => (
                                  <span key={emoji} className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs">{emoji} {Array.isArray(users) ? users.length : 0}</span>
                                ))}
                              </div>
                            )}
                            {m.pinnedAt && <span className="text-[10px] text-px-brand">📌</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
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
        <DialogContent className="bg-px-panel border-white/10 text-px-text max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Pinned Messages</DialogTitle>
                <DialogDescription>{navMode === 'server' ? 'This channel' : 'This DM'} • Protected by Equinox V1</DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 px-3 ${pinViewMode === 'list' ? 'bg-px-brand/20 text-px-brand' : 'bg-white/5 text-px-text2'}`}
                  onClick={() => setPinViewMode('list')}
                >
                  List
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 px-3 ${pinViewMode === 'grid' ? 'bg-px-brand/20 text-px-brand' : 'bg-white/5 text-px-text2'}`}
                  onClick={() => setPinViewMode('grid')}
                >
                  Grid
                </Button>
              </div>
            </div>
          </DialogHeader>

          {pinsError ? <div className="text-sm text-red-400">{pinsError}</div> : null}
          
          {pinsBusy ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse">
                  <div className="h-4 w-24 rounded bg-white/20 mb-2"></div>
                  <div className="h-3 w-full rounded bg-white/20"></div>
                </div>
              ))}
            </div>
          ) : !pins.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in duration-300">
              <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Pin className="h-8 w-8 text-px-text2/50" />
              </div>
              <div className="text-lg font-semibold text-px-text mb-2">No pinned messages</div>
              <div className="text-sm text-px-text2/70">Pin important messages to find them easily</div>
            </div>
          ) : (
            <div className={pinViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto' : 'space-y-3 max-h-[60vh] overflow-y-auto'}>
              {pins.map((m, index) => (
                <div 
                  key={m.id} 
                  className={`rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-all hover:scale-[1.02] animate-in fade-in duration-300`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 rounded-lg">
                        {m.author.avatarUrl ? <AvatarImage src={m.author.avatarUrl} alt="" className="object-cover" /> : null}
                        <AvatarFallback className="text-xs font-bold">{m.author.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="text-sm font-bold text-px-text">{m.author.username}</div>
                    </div>
                    <Pin className="h-4 w-4 text-px-brand" />
                  </div>
                  <div className="text-sm text-px-text">{m.deletedAt ? 'Message deleted' : m.content}</div>
                  <div className="mt-2 text-xs text-px-text2/50">
                    {new Date(m.createdAt).toLocaleDateString()} • {new Date(m.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={adminOpen}
        onOpenChange={(o) => {
          setAdminOpen(o)
          if (o && user && adminAuthed) {
            refreshAdminData()
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
                    <div className="text-xs font-extrabold text-px-text2">ORIGIN GATE</div>
                    <div className="mt-1 text-sm font-extrabold text-emerald-300">ENABLED</div>
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

                  <div className="mt-3 grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs font-extrabold text-px-text2">CSP TOGGLE</div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className={adminCspEnabled ? 'text-sm font-extrabold text-emerald-300' : 'text-sm font-extrabold text-amber-300'}>
                            {adminCspEnabled ? 'ON' : 'OFF'}
                          </div>
                          <Button
                            variant="secondary"
                            className="h-8 bg-white/5 text-px-text2 hover:bg-white/10"
                            onClick={() => setAdminCspEnabled((v) => !v)}
                          >
                            Toggle
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs font-extrabold text-px-text2">NOTES</div>
                        <div className="mt-1 text-xs text-px-text2">
                          Origins apply immediately. CSP header applies immediately.
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-extrabold text-px-text2">EDIT ORIGINS (one per line)</div>
                      <textarea
                        value={adminAllowedOriginsText}
                        onChange={(e) => setAdminAllowedOriginsText(e.target.value)}
                        rows={4}
                        className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-px-text placeholder:text-px-text2 outline-none focus:ring-2 focus:ring-px-brand/40"
                        placeholder="https://yourdomain.com\nhttps://www.yourdomain.com"
                      />
                    </div>

                    {adminSecurityError ? <div className="text-sm font-semibold text-red-400">{adminSecurityError}</div> : null}

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="h-8 bg-white/5 text-px-text2 hover:bg-white/10"
                        onClick={() => {
                          setAdminAllowedOriginsText((adminSecurity?.allowedOrigins || []).join('\n'))
                          setAdminCspEnabled(!!adminSecurity?.cspEnabled)
                          setAdminSecurityError(null)
                        }}
                        disabled={!adminSecurity || adminSecurityBusy}
                      >
                        Reset
                      </Button>
                      <Button
                        className="h-8 bg-px-brand text-white hover:bg-px-brand/90"
                        onClick={onSaveAdminSecurity}
                        disabled={!adminSecurity || adminSecurityBusy}
                      >
                        {adminSecurityBusy ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs font-extrabold text-px-text2">RATE LIMITS & SESSION POLICY</div>
                  <div className="mt-3 grid gap-3">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs font-extrabold text-px-text2">Rate Limiting</div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className={adminRateLimitEnabled ? 'text-sm font-extrabold text-emerald-300' : 'text-sm font-extrabold text-amber-300'}>
                            {adminRateLimitEnabled ? 'ON' : 'OFF'}
                          </div>
                          <Button variant="secondary" className="h-8 bg-white/5 text-px-text2 hover:bg-white/10" onClick={() => setAdminRateLimitEnabled((v) => !v)}>
                            Toggle
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-xs font-extrabold text-px-text2">Window (ms)</div>
                          <input
                            type="number"
                            min={1000}
                            max={600000}
                            value={adminRateLimitWindowMs}
                            onChange={(e) => setAdminRateLimitWindowMs(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-px-text outline-none focus:ring-2 focus:ring-px-brand/40"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-px-text2">Auth Max</div>
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            value={adminRateLimitAuthMax}
                            onChange={(e) => setAdminRateLimitAuthMax(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-px-text outline-none focus:ring-2 focus:ring-px-brand/40"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-px-text2">Admin Max</div>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={adminRateLimitAdminMax}
                            onChange={(e) => setAdminRateLimitAdminMax(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-px-text outline-none focus:ring-2 focus:ring-px-brand/40"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-px-text2">API Max</div>
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          value={adminRateLimitApiMax}
                          onChange={(e) => setAdminRateLimitApiMax(Number(e.target.value))}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-px-text outline-none focus:ring-2 focus:ring-px-brand/40"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs font-extrabold text-px-text2">Session Cookie</div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <div>
                            <div className="text-xs font-extrabold text-px-text2">SameSite</div>
                            <select
                              value={adminSessionCookieSameSite}
                              onChange={(e) => setAdminSessionCookieSameSite(e.target.value as 'lax' | 'strict' | 'none')}
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-px-text outline-none focus:ring-2 focus:ring-px-brand/40"
                            >
                              <option value="lax">Lax</option>
                              <option value="strict">Strict</option>
                              <option value="none">None</option>
                            </select>
                          </div>
                          <div>
                            <div className="text-xs font-extrabold text-px-text2">Secure</div>
                            <select
                              value={adminSessionCookieSecure}
                              onChange={(e) => setAdminSessionCookieSecure(e.target.value as 'auto' | 'true' | 'false')}
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-px-text outline-none focus:ring-2 focus:ring-px-brand/40"
                            >
                              <option value="auto">Auto</option>
                              <option value="true">True</option>
                              <option value="false">False</option>
                            </select>
                          </div>
                          <div>
                            <div className="text-xs font-extrabold text-px-text2">Max Age (ms)</div>
                            <input
                              type="number"
                              min={1000}
                              max={1209600000}
                              value={adminSessionCookieMaxAgeMs}
                              onChange={(e) => setAdminSessionCookieMaxAgeMs(Number(e.target.value))}
                              className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-px-text outline-none focus:ring-2 focus:ring-px-brand/40"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs font-extrabold text-px-text2">LOCKDOWN MODE</div>
                      <div className="mt-2 text-xs text-px-text2">Blocks all non-admin traffic (except health/admin unlock/login).</div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className={adminLockdownEnabled ? 'text-sm font-extrabold text-red-400' : 'text-sm font-extrabold text-emerald-300'}>
                          {adminLockdownEnabled ? 'LOCKED' : 'UNLOCKED'}
                        </div>
                        <Button
                          variant="secondary"
                          className={adminLockdownEnabled ? 'h-8 bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'h-8 bg-white/5 text-px-text2 hover:bg-white/10'}
                          onClick={() => setAdminLockdownEnabled((v) => !v)}
                        >
                          {adminLockdownEnabled ? 'Unlock' : 'Lock'}
                        </Button>
                      </div>
                    </div>
                  </div>
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

                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-extrabold tracking-wide text-px-text2">ROLES & PERMISSIONS</div>
                    <Button
                      variant="secondary"
                      className="h-8 bg-white/5 text-px-text2 hover:bg-white/10"
                      onClick={() => setRolesOpen(true)}
                    >
                      Manage Roles
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {roles.slice(0, 3).map((role) => (
                      <div key={role.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <div>
                          <div className="text-sm font-bold text-px-text">{role.name}</div>
                          <div className="text-xs text-px-text2">{role.permissions.length} permissions</div>
                        </div>
                        <div className="text-xs text-px-text2/70">{role.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Roles Management Dialog */}
      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent className="bg-px-panel border-white/10 text-px-text max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Roles & Permissions</DialogTitle>
            <DialogDescription>Manage server roles and member permissions</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Create New Role */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 text-xs font-extrabold tracking-wide text-px-text2">CREATE NEW ROLE</div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Role name..."
                    className="flex-1 border-white/12 bg-white/8 text-px-text placeholder:text-px-text2/60"
                  />
                  <Button
                    className="bg-px-brand text-white hover:bg-px-brand/90"
                    onClick={addRole}
                    disabled={!newRoleName.trim()}
                  >
                    Create
                  </Button>
                </div>
                
                <div>
                  <div className="mb-2 text-xs font-extrabold text-px-text2">Permissions</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'manage_server', label: 'Manage Server' },
                      { id: 'manage_channels', label: 'Manage Channels' },
                      { id: 'manage_members', label: 'Manage Members' },
                      { id: 'moderate_messages', label: 'Moderate Messages' }
                    ].map((permission) => (
                      <label key={permission.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 cursor-pointer hover:bg-white/10">
                        <input
                          type="checkbox"
                          checked={newRolePermissions.includes(permission.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewRolePermissions(prev => [...prev, permission.id])
                            } else {
                              setNewRolePermissions(prev => prev.filter(p => p !== permission.id))
                            }
                          }}
                          className="rounded border-white/20 bg-white/10 text-px-brand focus:ring-px-brand/40"
                        />
                        <span className="text-sm text-px-text">{permission.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Existing Roles */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 text-xs font-extrabold tracking-wide text-px-text2">EXISTING ROLES</div>
              <div className="space-y-3">
                {roles.map((role) => (
                  <div key={role.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-bold text-px-text">{role.name}</div>
                        <div className="text-xs text-px-text2/70">{role.id}</div>
                      </div>
                      {role.id !== 'admin' && role.id !== 'member' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-red-400 hover:bg-red-400/10"
                          onClick={() => deleteRole(role.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.map((permission) => (
                        <span key={permission} className="rounded-lg bg-px-brand/20 px-2 py-1 text-xs text-px-brand">
                          {permission.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      ))}
                      {role.permissions.length === 0 && (
                        <span className="text-xs text-px-text2/50">No permissions</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Member Role Assignment */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 text-xs font-extrabold tracking-wide text-px-text2">MEMBER ROLES</div>
              <div className="space-y-3">
                {members.slice(0, 10).map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 rounded-lg">
                        {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" className="object-cover" /> : null}
                        <AvatarFallback className="text-xs font-bold">{member.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-px-text">{member.username}</div>
                        <div className="text-xs text-px-text2/70">{member.id}</div>
                      </div>
                    </div>
                    <select
                      value={memberRoles[member.id] || 'member'}
                      onChange={(e) => updateMemberRole(member.id, e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/8 px-2 py-1 text-sm text-px-text outline-none focus:ring-2 focus:ring-px-brand/40"
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Moderation Dialog */}
      <Dialog open={moderationOpen} onOpenChange={setModerationOpen}>
        <DialogContent className="bg-px-panel border-white/10 text-px-text max-w-md">
          <DialogHeader>
            <DialogTitle>Moderation Actions</DialogTitle>
            <DialogDescription>
              {moderationTarget?.type === 'message' ? 'Moderate message' : 'Moderate user'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-extrabold text-px-text2">Action</label>
              <select
                value={moderationAction}
                onChange={(e) => setModerationAction(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-sm text-px-text outline-none focus:ring-2 focus:ring-px-brand/40"
              >
                <option value="delete">Delete Message</option>
                <option value="timeout">Timeout User</option>
                <option value="warn">Warn User</option>
                <option value="ban">Ban User</option>
              </select>
            </div>

            {(moderationAction === 'timeout' || moderationAction === 'warn' || moderationAction === 'ban') && (
              <div>
                <label className="text-xs font-extrabold text-px-text2">Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="10080"
                  value={moderationDuration}
                  onChange={(e) => setModerationDuration(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-sm text-px-text outline-none focus:ring-2 focus:ring-px-brand/40"
                />
                <div className="mt-1 text-xs text-px-text2/50">
                  {moderationDuration < 60 ? `${moderationDuration} minutes` :
                   moderationDuration < 1440 ? `${Math.floor(moderationDuration / 60)} hours` :
                   `${Math.floor(moderationDuration / 1440)} days`}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-extrabold text-px-text2">Reason</label>
              <textarea
                value={moderationReason}
                onChange={(e) => setModerationReason(e.target.value)}
                placeholder="Reason for moderation action..."
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-sm text-px-text outline-none focus:ring-2 focus:ring-px-brand/40 resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1 bg-white/5 text-px-text2 hover:bg-white/10"
                onClick={() => setModerationOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-500 text-white hover:bg-red-600"
                onClick={executeModeration}
                disabled={!moderationReason.trim()}
              >
                Execute Action
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notification Settings Dialog */}
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="bg-px-panel border-white/10 text-px-text max-w-md">
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
            <DialogDescription>Manage your notification preferences</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-extrabold tracking-wide text-px-text2">GENERAL</div>
              
              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/10">
                <div>
                  <div className="text-sm font-medium text-px-text">Desktop Notifications</div>
                  <div className="text-xs text-px-text2/70">Show notifications on your desktop</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.enableDesktop}
                  onChange={(e) => updateNotificationSetting('enableDesktop', e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-px-brand focus:ring-px-brand/40"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/10">
                <div>
                  <div className="text-sm font-medium text-px-text">Sound Effects</div>
                  <div className="text-xs text-px-text2/70">Play sounds for notifications</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.enableSound}
                  onChange={(e) => updateNotificationSetting('enableSound', e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-px-brand focus:ring-px-brand/40"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/10">
                <div>
                  <div className="text-sm font-medium text-px-text">Email Notifications</div>
                  <div className="text-xs text-px-text2/70">Receive email summaries</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.enableEmail}
                  onChange={(e) => updateNotificationSetting('enableEmail', e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-px-brand focus:ring-px-brand/40"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/10">
                <div>
                  <div className="text-sm font-medium text-px-text">Mentions Only</div>
                  <div className="text-xs text-px-text2/70">Only notify for @mentions</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.mentionOnly}
                  onChange={(e) => updateNotificationSetting('mentionOnly', e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-px-brand focus:ring-px-brand/40"
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-extrabold tracking-wide text-px-text2">MESSAGE TYPES</div>
              
              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/10">
                <div>
                  <div className="text-sm font-medium text-px-text">Direct Messages</div>
                  <div className="text-xs text-px-text2/70">Notifications for DMs</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.dmNotifications}
                  onChange={(e) => updateNotificationSetting('dmNotifications', e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-px-brand focus:ring-px-brand/40"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/10">
                <div>
                  <div className="text-sm font-medium text-px-text">Channel Messages</div>
                  <div className="text-xs text-px-text2/70">Notifications for channel activity</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.channelNotifications}
                  onChange={(e) => updateNotificationSetting('channelNotifications', e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-px-brand focus:ring-px-brand/40"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/10">
                <div>
                  <div className="text-sm font-medium text-px-text">Server Events</div>
                  <div className="text-xs text-px-text2/70">Notifications for server updates</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.serverNotifications}
                  onChange={(e) => updateNotificationSetting('serverNotifications', e.target.checked)}
                  className="rounded border-white/20 bg-white/10 text-px-brand focus:ring-px-brand/40"
                />
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Server Management Dialog */}
      <Dialog open={serverManageOpen} onOpenChange={setServerManageOpen}>
        <DialogContent className="bg-px-panel border-white/10 text-px-text max-w-2xl">
          <DialogHeader>
            <DialogTitle>Server Settings</DialogTitle>
            <DialogDescription>Manage server configuration and preferences</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Settings */}
            <div className="space-y-4">
              <div className="text-xs font-extrabold tracking-wide text-px-text2">BASIC SETTINGS</div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-px-text2/80 block mb-1">Server Name</label>
                  <Input
                    value={serverManageSettings.name}
                    onChange={(e) => updateServerSetting('name', e.target.value)}
                    placeholder="Enter server name..."
                    className="border-white/10 bg-white/6 text-px-text placeholder:text-px-text2/50"
                  />
                </div>
                
                <div>
                  <label className="text-xs font-medium text-px-text2/80 block mb-1">Description</label>
                  <textarea
                    value={serverManageSettings.description}
                    onChange={(e) => updateServerSetting('description', e.target.value)}
                    placeholder="Describe your server..."
                    className="w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-px-text placeholder:text-px-text2/50 min-h-[80px]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-px-text2/80 block mb-1">Server Icon URL</label>
                  <Input
                    value={serverManageSettings.icon}
                    onChange={(e) => updateServerSetting('icon', e.target.value)}
                    placeholder="https://example.com/icon.png"
                    className="border-white/10 bg-white/6 text-px-text placeholder:text-px-text2/50"
                  />
                </div>
              </div>
            </div>

            {/* Access Settings */}
            <div className="space-y-4">
              <div className="text-xs font-extrabold tracking-wide text-px-text2">ACCESS SETTINGS</div>
              
              <div className="space-y-3">
                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/10">
                  <div>
                    <div className="text-sm font-medium text-px-text">Public Server</div>
                    <div className="text-xs text-px-text2/70">Allow anyone to discover and join</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={serverManageSettings.isPublic}
                    onChange={(e) => updateServerSetting('isPublic', e.target.checked)}
                    className="rounded border-white/20 bg-white/10 text-px-brand focus:ring-px-brand/40"
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/10">
                  <div>
                    <div className="text-sm font-medium text-px-text">Allow Invites</div>
                    <div className="text-xs text-px-text2/70">Members can create invite codes</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={serverManageSettings.allowInvites}
                    onChange={(e) => updateServerSetting('allowInvites', e.target.checked)}
                    className="rounded border-white/20 bg-white/10 text-px-brand focus:ring-px-brand/40"
                  />
                </label>

                <div>
                  <label className="text-xs font-medium text-px-text2/80 block mb-1">Maximum Members</label>
                  <select
                    value={serverManageSettings.maxMembers}
                    onChange={(e) => updateServerSetting('maxMembers', Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-px-text"
                  >
                    <option value={50}>50 members</option>
                    <option value={100}>100 members</option>
                    <option value={250}>250 members</option>
                    <option value={500}>500 members</option>
                    <option value={1000}>1000 members</option>
                    <option value={-1}>Unlimited</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-px-text2/80 block mb-1">Default Role</label>
                  <select
                    value={serverManageSettings.defaultRole}
                    onChange={(e) => updateServerSetting('defaultRole', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-px-text"
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                className="bg-px-brand text-white hover:bg-px-brand/90"
                onClick={saveServerSettings}
                disabled={serverManageBusy}
              >
                {serverManageBusy ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="secondary"
                className="bg-white/10 text-px-text hover:bg-white/15"
                onClick={() => setServerManageOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
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
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-sm font-semibold text-px-text">No messages yet</div>
                  <div className="mt-1 text-sm text-px-text2">Start the conversation!</div>
                </div>
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
            setJoinError(null)
          }
        }}
      >
        <DialogContent className="border-white/10 bg-px-panel text-px-text max-w-4xl">
          <DialogHeader>
            <DialogTitle>Server Invites</DialogTitle>
            <DialogDescription className="text-px-text2">Manage invite codes and server access</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Create New Invite */}
            <div className="rounded-xl border border-white/8 bg-white/4 p-4">
              <div className="text-sm font-semibold text-px-text mb-4">Create New Invite</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-px-text2/80 block mb-1">Max Uses</label>
                  <select
                    value={newInviteMaxUses}
                    onChange={(e) => setNewInviteMaxUses(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-px-text"
                  >
                    <option value="-1">Unlimited</option>
                    <option value="1">1 use</option>
                    <option value="5">5 uses</option>
                    <option value="10">10 uses</option>
                    <option value="25">25 uses</option>
                    <option value="50">50 uses</option>
                    <option value="100">100 uses</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-px-text2/80 block mb-1">Expires</label>
                  <select
                    value={newInviteExpires ? newInviteDays : 0}
                    onChange={(e) => {
                      const days = Number(e.target.value)
                      setNewInviteExpires(days > 0)
                      setNewInviteDays(days)
                    }}
                    className="w-full rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-px-text"
                  >
                    <option value="0">Never</option>
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Button
                    className="h-10 bg-px-brand text-white hover:bg-px-brand/90"
                    onClick={createInvite}
                    disabled={!user}
                  >
                    Generate Invite Code
                  </Button>
                </div>
              </div>
              {newInviteCode && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-px-text2/80 mb-1">Generated Code</div>
                      <div className="font-mono text-lg font-bold text-px-text">{newInviteCode}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-px-brand hover:bg-px-brand/10"
                      onClick={() => copyInviteCode(newInviteCode)}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Active Invites */}
            <div>
              <div className="text-sm font-semibold text-px-text mb-3">Active Invites</div>
              {serverInvites.length === 0 ? (
                <div className="rounded-lg border border-white/8 bg-white/4 p-6 text-center">
                  <div className="text-px-text2/70">No active invites</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {serverInvites.map((invite) => {
                    const status = getInviteStatus(invite)
                    return (
                      <div key={invite.id} className="rounded-lg border border-white/8 bg-white/4 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-mono text-sm font-bold text-px-text">{invite.code}</div>
                                <div className={`text-xs font-medium ${status.color}`}>
                                  {status.text}
                                </div>
                              </div>
                              <div className="text-xs text-px-text2/60">
                                Created by {invite.createdBy} • {new Date(invite.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-xs text-px-text2/60">
                              {invite.maxUses === -1 ? 'Unlimited uses' : `${invite.uses}/${invite.maxUses} uses`}
                              {invite.expiresAt && ` • Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-px-brand hover:bg-px-brand/10"
                              onClick={() => copyInviteCode(invite.code)}
                            >
                              Copy
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:bg-red-400/10"
                              onClick={() => deleteInvite(invite.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Join Server */}
            <div className="rounded-xl border border-white/8 bg-white/4 p-4">
              <div className="text-sm font-semibold text-px-text mb-4">Join Server</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Enter invite code..."
                    className="border-white/10 bg-white/6 text-px-text placeholder:text-px-text2/50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onJoinInvite()
                    }}
                  />
                </div>
                <Button
                  className="h-10 bg-px-brand text-white hover:bg-px-brand/90"
                  onClick={onJoinInvite}
                  disabled={joinBusy || !joinCode.trim()}
                >
                  {joinBusy ? 'Joining…' : 'Join Server'}
                </Button>
              </div>
              {joinError && <div className="text-sm font-medium text-red-400 mt-3">{joinError}</div>}
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

      <Dialog
        open={serverManageOpen}
        onOpenChange={(o) => {
          setServerManageOpen(o)
          if (!o) {
            setServerManageBusy(false)
            setServerSettingsError(null)
          }
        }}
      >
        <DialogContent className="border-white/10 bg-px-panel text-px-text">
          <DialogHeader>
            <DialogTitle>Server Settings</DialogTitle>
            <DialogDescription className="text-px-text2">Rename your server and set an icon URL.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              value={serverSettingsName}
              onChange={(e) => setServerSettingsName(e.target.value)}
              placeholder="Server name"
              className="border-white/10 bg-white/5 text-px-text placeholder:text-px-text2"
            />
            <Input
              value={serverSettingsIconUrl}
              onChange={(e) => setServerSettingsIconUrl(e.target.value)}
              placeholder="Icon URL (https://…)"
              className="border-white/10 bg-white/5 text-px-text placeholder:text-px-text2"
            />
            {serverSettingsError ? <div className="text-sm font-semibold text-red-400">{serverSettingsError}</div> : null}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
              onClick={() => setServerManageOpen(false)}
              disabled={serverManageBusy}
            >
              Cancel
            </Button>
            <Button
              className="h-9 bg-px-brand text-white hover:bg-px-brand/90"
              onClick={onSaveServerSettings}
              disabled={serverManageBusy}
            >
              {serverManageBusy ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={profileOpen}
        onOpenChange={(o) => {
          setProfileOpen(o)
          if (!o) {
            setProfileBusy(false)
            setProfileError(null)
          }
        }}
      >
        <DialogContent className="border-white/10 bg-px-panel text-px-text">
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
            <DialogDescription className="text-px-text2">Customize your display name and avatar URL.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              value={profileDisplayName}
              onChange={(e) => setProfileDisplayName(e.target.value)}
              placeholder="Display name (optional)"
              className="border-white/10 bg-white/5 text-px-text placeholder:text-px-text2"
            />
            <Input
              value={profileAvatarUrl}
              onChange={(e) => setProfileAvatarUrl(e.target.value)}
              placeholder="Avatar URL (https://…)"
              className="border-white/10 bg-white/5 text-px-text placeholder:text-px-text2"
            />
            {profileError ? <div className="text-sm font-semibold text-red-400">{profileError}</div> : null}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              className="h-9 bg-white/5 text-px-text2 hover:bg-white/10"
              onClick={() => setProfileOpen(false)}
              disabled={profileBusy}
            >
              Cancel
            </Button>
            <Button className="h-9 bg-px-brand text-white hover:bg-px-brand/90" onClick={onSaveProfile} disabled={profileBusy}>
              {profileBusy ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Message({
  who,
  avatarUrl,
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
  canModerate,
  onModerate,
}: {
  who: string
  avatarUrl?: string | null
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
  canModerate?: boolean
  onModerate?: () => void
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
    <div
      className={
        showHeader
          ? 'group relative -mx-2 mt-4 rounded-2xl px-2 py-3 hover:bg-white/[0.04]'
          : 'group relative -mx-2 rounded-2xl px-2 py-1 hover:bg-white/[0.04]'
      }
    >
      {showHeader ? <div className="pointer-events-none absolute inset-x-2 -top-2 h-px bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.10),transparent)]" /> : null}
      <div className="flex gap-3">
        <div className="w-10 shrink-0">
          {showHeader ? (
            <Avatar className="h-10 w-10">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" className="object-cover" /> : null}
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {showHeader ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <div className={`truncate text-[15px] font-black tracking-tight ${nameColor}`}>{who}</div>
              <div className="text-[11px] font-semibold text-px-text2">{time}</div>
            </div>
          ) : null}
          {replyPreview ? (
            <div className={showHeader ? 'mt-0.5 flex items-center gap-2 text-xs text-px-text2' : 'flex items-center gap-2 text-xs text-px-text2'}>
              <span className="font-extrabold text-px-text">{replyPreview.who}</span>
              <span className="truncate">{replyPreview.text}</span>
            </div>
          ) : null}
          <div className={showHeader ? 'mt-1 text-[15px] leading-relaxed text-px-text' : 'text-[15px] leading-relaxed text-px-text'}>{text}</div>
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
        {canModerate ? (
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-red-500/20 text-red-400 hover:bg-red-500/30"
            onClick={onModerate}
            title="Moderate"
          >
            <Shield className="h-4 w-4" />
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

function Member({
  name,
  username,
  avatarUrl,
  status,
  lastSeenAt,
}: {
  name: string
  username?: string
  avatarUrl?: string | null
  status: 'online' | 'idle' | 'offline'
  lastSeenAt?: string | null
}) {
  const dot = status === 'online' ? 'bg-px-success' : status === 'idle' ? 'bg-amber-400' : 'bg-white/20'
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:bg-white/8 hover:shadow-md group">
      <div className="relative">
        <Avatar className="h-10 w-10 rounded-xl border border-white/10 shadow-sm transition-transform group-hover:scale-105 cursor-pointer">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" className="object-cover" /> : null}
          <AvatarFallback className="font-bold">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-px-panel ${dot} transition-all group-hover:scale-110`} />
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold text-px-text group-hover:text-px-text transition-colors cursor-pointer">{name}</div>
        <div className="truncate text-xs text-px-text2/70">
          {username && username !== name ? `@${username} • ` : ''}
          {status === 'offline' && lastSeenAt ? `last seen ${new Date(lastSeenAt).toLocaleString()}` : status}
        </div>
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
          ? 'group relative w-full rounded-xl border border-px-brand/30 bg-gradient-to-r from-white/10 to-white/5 px-3 py-2.5 text-left shadow-lg shadow-px-brand/10 transition-all hover:scale-[1.02]'
          : 'group relative w-full rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-left text-px-text2/80 transition-all hover:border-white/12 hover:bg-white/8 hover:text-px-text hover:shadow-md'
      }
      type="button"
      onClick={onClick}
    >
      <div
        className={
          active
            ? 'absolute left-2 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-px-brand to-px-brand/80 shadow-px-brand/30'
            : 'absolute left-2 top-1/2 h-2 w-1 -translate-y-1/2 rounded-full bg-white/10 opacity-0 transition-opacity group-hover:opacity-60'
        }
      />
      <div className="flex items-center gap-3">
        {leading ? <div className="shrink-0 transition-transform group-hover:scale-110">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className={active ? 'truncate text-sm font-bold tracking-wide text-px-text drop-shadow-sm' : 'truncate text-sm font-semibold text-px-text/90'}>{children}</div>
          {subtitle ? <div className={active ? 'truncate text-xs font-medium text-px-text2/80' : 'truncate text-xs font-medium text-px-text2/60'}>{subtitle}</div> : null}
        </div>
        {trailing ? <div className="shrink-0 transition-transform group-hover:scale-110">{trailing}</div> : null}
      </div>
    </button>
  )
}

export default App
