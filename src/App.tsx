import React, { useEffect, useMemo, useRef, useState } from 'react'
import { io as ioClient, type Socket } from 'socket.io-client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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
  apiCreateServer,
  apiListChannels,
  apiListMessages,
  apiListServers,
  apiLogin,
  apiLogout,
  apiMe,
  apiRegister,
  type Channel,
  type Message as ApiMessage,
  type Server,
  type User,
} from '@/lib/api'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [servers, setServers] = useState<Server[]>([])
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ApiMessage[]>([])
  const [messageText, setMessageText] = useState('')

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

  const initials = useMemo(() => {
    const u = user?.username?.trim()
    return u ? u.slice(0, 1).toUpperCase() : 'G'
  }, [user?.username])

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
      return
    }

    if (!selectedServerId && servers.length) {
      setSelectedServerId(servers[0].id)
    }
  }, [user, servers, selectedServerId])

  useEffect(() => {
    if (!user || !selectedServerId) {
      setChannels([])
      setSelectedChannelId(null)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedServerId])

  useEffect(() => {
    if (!user || !selectedChannelId) {
      setMessages([])
      return
    }

    apiListMessages(selectedChannelId, 75)
      .then((res) => setMessages(res.messages))
      .catch(() => setMessages([]))
  }, [user, selectedChannelId])

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

    s.on('chat:error', () => {
      // no-op for now
    })

    socketRef.current = s
    return () => {
      s.disconnect()
      if (socketRef.current === s) socketRef.current = null
      setSocketConnected(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!selectedChannelId) return
    socketRef.current?.emit('channel:join', { channelId: selectedChannelId })
  }, [selectedChannelId])

  function onSendMessage() {
    const content = messageText.trim()
    if (!content || !selectedChannelId) return
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      return
    }

    socketRef.current?.emit('chat:send', { channelId: selectedChannelId, content })
    setMessageText('')
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
            {servers.slice(0, 8).map((s) => (
              <button
                key={s.id}
                type="button"
                className={
                  s.id === selectedServerId
                    ? 'h-12 w-12 rounded-2xl bg-white/20 grid place-items-center text-sm font-black'
                    : 'h-12 w-12 rounded-2xl bg-white/10 grid place-items-center text-sm font-black hover:bg-white/15'
                }
                title={s.name}
                onClick={() => setSelectedServerId(s.id)}
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
              +
            </Button>
            <div className="mt-auto h-12 w-12 rounded-2xl bg-white/10 grid place-items-center text-sm">⚙</div>
          </div>
        </aside>

        <aside className="bg-px-panel border-r border-white/10 flex h-full flex-col">
          <div className="p-3">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-white/10" />
              <div className="min-w-0">
                <div className="truncate font-extrabold">PXHB Chatting</div>
                <div className="truncate text-xs text-px-text2">
                  {selectedServerId ? servers.find((s) => s.id === selectedServerId)?.name || 'Server' : 'No server'}
                </div>
              </div>
            </div>

            <div className="mb-2 text-xs font-extrabold tracking-wide text-px-text2">TEXT CHANNELS</div>
          </div>

          <ScrollArea className="flex-1 px-3">
            <nav className="space-y-1 pb-3">
              {channels.length ? (
                channels.map((c) => (
                  <ChannelButton key={c.id} active={c.id === selectedChannelId} onClick={() => setSelectedChannelId(c.id)}>
                    # {c.name}
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
                # {channels.find((c) => c.id === selectedChannelId)?.name || 'general'}
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
              <Button variant="secondary" className="h-9 bg-white/5 text-px-text2 hover:bg-white/10">Invite</Button>
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
                ) : servers.length === 0 ? (
                  <Message who="System" text="You have no servers yet. Click the + in the left rail to create one." tone="system" />
                ) : !selectedChannelId ? (
                  <Message who="System" text="Select a channel to load messages." tone="system" />
                ) : null}
                {messages.map((m) => (
                  <Message
                    key={m.id}
                    who={m.author.username}
                    text={m.content}
                    tone={m.author.id === user?.id ? 'me' : 'bot'}
                  />
                ))}
              </div>
            </div>
          </ScrollArea>

          <footer className="border-t border-white/10 p-3">
            <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <Button variant="secondary" size="icon" className="h-9 w-9 rounded-xl bg-white/5 text-px-text2 hover:bg-white/10">
                +
              </Button>
              <Input
                className="h-10 flex-1 border-0 bg-transparent text-px-text placeholder:text-px-text2 focus-visible:ring-0"
                placeholder={selectedChannelId ? 'Message this channel' : 'Select a channel'}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSendMessage()
                }}
                disabled={!selectedChannelId}
              />
              <Button
                className="h-9 rounded-xl bg-px-brand px-4 font-extrabold text-white hover:bg-px-brand/90"
                onClick={onSendMessage}
                disabled={!selectedChannelId}
              >
                Send
              </Button>
            </div>
          </footer>
        </main>

        <aside className="bg-px-panel border-l border-white/10 flex h-full flex-col">
          <div className="p-3">
            <div className="mb-3 text-xs font-extrabold tracking-wide text-px-text2">MEMBERS</div>
          </div>
          <ScrollArea className="flex-1 px-3">
            <div className="space-y-2 pb-3">
              <Member name="Guest" status="offline" />
              <Member name="PXBot" status="online" />
            </div>
          </ScrollArea>
        </aside>
      </div>

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

function Message({ who, text, tone }: { who: string; text: string; tone: 'system' | 'bot' | 'me' }) {
  const pill =
    tone === 'system'
      ? 'bg-white/10 text-px-text2'
      : tone === 'bot'
        ? 'bg-px-brand/20 text-px-text'
        : 'bg-emerald-500/15 text-px-text'
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-1 text-xs font-extrabold ${pill}`}>{who}</span>
        <span className="text-xs text-px-text2">just now</span>
      </div>
      <div className="mt-2 text-sm leading-relaxed text-px-text">{text}</div>
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
}: {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      className={
        active
          ? 'w-full rounded-lg bg-white/10 px-3 py-2 text-left font-semibold'
          : 'w-full rounded-lg px-3 py-2 text-left font-semibold text-px-text2 hover:bg-white/5'
      }
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default App
