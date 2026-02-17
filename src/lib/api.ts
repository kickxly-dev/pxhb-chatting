export type ApiResponse<T> = { ok: true } & T
export type ApiErrorResponse = { ok: false; error: string }

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    credentials: 'include',
  })

  const data = (await res.json().catch(() => null)) as unknown

  if (!res.ok) {
    const err = (data as any)?.error || `http_${res.status}`
    const details = (data as any)?.message
    throw new Error(typeof details === 'string' && details ? `${err}:${details}` : err)
  }

  if (!data || typeof data !== 'object' || (data as any).ok !== true) {
    throw new Error('bad_response')
  }

  return data as ApiResponse<T>
}

export type User = { id: string; username: string }
export type Server = { id: string; name: string }
export type Channel = { id: string; name: string; type: string }
export type Member = { id: string; username: string; role: string }

export type ReactionSummary = { emoji: string; count: number; viewerHasReacted: boolean }

export type Message = {
  id: string
  content: string
  createdAt: string
  editedAt?: string | null
  deletedAt?: string | null
  pinnedAt?: string | null
  pinnedById?: string | null
  author: { id: string; username: string }
  replyTo?: { id: string; content: string; author: { id: string; username: string } } | null
  reactions?: ReactionSummary[]
}

export type FriendUser = { id: string; username: string }
export type Friend = { id: string; username: string; friendshipId: string; createdAt: string }
export type FriendRequest = {
  id: string
  status: string
  createdAt: string
  from?: FriendUser
  to?: FriendUser
}

export type DmThread = { id: string; createdAt: string; userAId: string; userBId: string }
export type DmThreadListItem = {
  id: string
  createdAt: string
  lastMessageAt: string | null
  otherUser: FriendUser
}
export type DmMessage = {
  id: string
  threadId: string
  content: string
  createdAt: string
  editedAt?: string | null
  deletedAt?: string | null
  pinnedAt?: string | null
  pinnedById?: string | null
  author: { id: string; username: string }
  replyTo?: { id: string; content: string; author: { id: string; username: string } } | null
  reactions?: ReactionSummary[]
}

export type SiteConfig = { lockdownEnabled: boolean; lockdownMessage: string }

export async function apiMe() {
  return apiFetch<{ user: User | null }>('/api/auth/me')
}

export async function apiLogin(username: string, password: string) {
  return apiFetch<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function apiRegister(username: string, password: string) {
  return apiFetch<{ user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function apiLogout() {
  return apiFetch<Record<string, never>>('/api/auth/logout', { method: 'POST' })
}

export async function apiSite() {
  return apiFetch<{ config: SiteConfig }>('/api/site')
}

export async function apiListServers() {
  return apiFetch<{ servers: Server[] }>('/api/servers')
}

export async function apiCreateServer(name: string) {
  return apiFetch<{ server: { id: string; name: string; channels: { id: string; name: string; type: string }[] } }>(
    '/api/servers',
    {
      method: 'POST',
      body: JSON.stringify({ name }),
    },
  )
}

export async function apiListChannels(serverId: string) {
  return apiFetch<{ channels: Channel[] }>(`/api/servers/${serverId}/channels`)
}

export async function apiCreateChannel(serverId: string, name: string) {
  return apiFetch<{ channel: Channel }>(`/api/servers/${serverId}/channels`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function apiRenameChannel(channelId: string, name: string) {
  return apiFetch<{ channel: Channel }>(`/api/channels/${channelId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export async function apiDeleteChannel(channelId: string) {
  return apiFetch<Record<string, never>>(`/api/channels/${channelId}`, { method: 'DELETE' })
}

export async function apiListMembers(serverId: string) {
  return apiFetch<{ members: Member[] }>(`/api/servers/${serverId}/members`)
}

export async function apiCreateInvite(serverId: string) {
  return apiFetch<{ invite: { code: string } }>(`/api/servers/${serverId}/invites`, { method: 'POST' })
}

export async function apiJoinInvite(code: string) {
  return apiFetch<{ serverId: string }>(`/api/invites/${encodeURIComponent(code)}/join`, { method: 'POST' })
}

export async function apiListMessages(channelId: string, limit = 50) {
  return apiFetch<{ messages: Message[] }>(`/api/channels/${channelId}/messages?limit=${encodeURIComponent(String(limit))}`)
}

export async function apiEditMessage(messageId: string, content: string) {
  return apiFetch<{ message: Message }>(`/api/messages/${encodeURIComponent(messageId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  })
}

export async function apiDeleteMessage(messageId: string) {
  return apiFetch<{ message: Message }>(`/api/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' })
}

export async function apiListChannelPins(channelId: string, limit = 50) {
  return apiFetch<{ pins: Message[] }>(`/api/channels/${encodeURIComponent(channelId)}/pins?limit=${encodeURIComponent(String(limit))}`)
}

export async function apiPinMessage(messageId: string) {
  return apiFetch<{ message: Message }>(`/api/messages/${encodeURIComponent(messageId)}/pin`, { method: 'POST' })
}

export async function apiUnpinMessage(messageId: string) {
  return apiFetch<{ message: Message }>(`/api/messages/${encodeURIComponent(messageId)}/unpin`, { method: 'POST' })
}

export async function apiSendFriendRequest(username: string) {
  return apiFetch<{ request: FriendRequest }>('/api/friends/requests', {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
}

export async function apiListFriendRequests() {
  return apiFetch<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>('/api/friends/requests')
}

export async function apiAcceptFriendRequest(requestId: string) {
  return apiFetch<{ friendship: { id: string; createdAt: string; userAId: string; userBId: string } }>(
    `/api/friends/requests/${encodeURIComponent(requestId)}/accept`,
    { method: 'POST' },
  )
}

export async function apiDeclineFriendRequest(requestId: string) {
  return apiFetch<Record<string, never>>(`/api/friends/requests/${encodeURIComponent(requestId)}/decline`, { method: 'POST' })
}

export async function apiCancelFriendRequest(requestId: string) {
  return apiFetch<Record<string, never>>(`/api/friends/requests/${encodeURIComponent(requestId)}/cancel`, { method: 'POST' })
}

export async function apiListFriends() {
  return apiFetch<{ friends: Friend[] }>('/api/friends')
}

export async function apiOpenDmWithUser(otherUserId: string) {
  return apiFetch<{ thread: DmThread }>(`/api/dms/with/${encodeURIComponent(otherUserId)}`, { method: 'POST' })
}

export async function apiListDmThreads() {
  return apiFetch<{ threads: DmThreadListItem[] }>('/api/dms/threads')
}

export async function apiListDmMessages(threadId: string, limit = 50) {
  return apiFetch<{ messages: DmMessage[] }>(`/api/dms/${encodeURIComponent(threadId)}/messages?limit=${encodeURIComponent(String(limit))}`)
}

export async function apiSendDmMessage(threadId: string, content: string) {
  return apiFetch<{ message: DmMessage }>(`/api/dms/${encodeURIComponent(threadId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export async function apiEditDmMessage(messageId: string, content: string) {
  return apiFetch<{ message: DmMessage }>(`/api/dm-messages/${encodeURIComponent(messageId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  })
}

export async function apiDeleteDmMessage(messageId: string) {
  return apiFetch<{ message: DmMessage }>(`/api/dm-messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' })
}

export async function apiListDmPins(threadId: string, limit = 50) {
  return apiFetch<{ pins: DmMessage[] }>(`/api/dms/${encodeURIComponent(threadId)}/pins?limit=${encodeURIComponent(String(limit))}`)
}

export async function apiPinDmMessage(messageId: string) {
  return apiFetch<{ message: DmMessage }>(`/api/dm-messages/${encodeURIComponent(messageId)}/pin`, { method: 'POST' })
}

export async function apiUnpinDmMessage(messageId: string) {
  return apiFetch<{ message: DmMessage }>(`/api/dm-messages/${encodeURIComponent(messageId)}/unpin`, { method: 'POST' })
}

export async function apiSearchChannel(channelId: string, q: string, limit = 50) {
  return apiFetch<{ results: Message[] }>(
    `/api/channels/${encodeURIComponent(channelId)}/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(String(limit))}`,
  )
}

export async function apiSearchDm(threadId: string, q: string, limit = 50) {
  return apiFetch<{ results: DmMessage[] }>(
    `/api/dms/${encodeURIComponent(threadId)}/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(String(limit))}`,
  )
}

export type AdminOverview = { users: number; servers: number; messages: number; dmMessages: number }
export type AdminUser = { id: string; username: string; createdAt: string; updatedAt: string }
export type AdminServer = { id: string; name: string; createdAt: string; owner: { id: string; username: string } }
export type AdminAuditLog = {
  id: string
  createdAt: string
  action: string
  meta: unknown
  actor: { id: string; username: string } | null
}

export async function apiAdminMe() {
  return apiFetch<{ admin: boolean }>('/api/admin/me')
}

export async function apiAdminLogin(code: string) {
  return apiFetch<{ admin: boolean }>('/api/admin/login', { method: 'POST', body: JSON.stringify({ code }) })
}

export async function apiAdminOverview() {
  return apiFetch<{ stats: AdminOverview }>('/api/admin/overview')
}

export async function apiAdminUsers(limit = 50) {
  return apiFetch<{ users: AdminUser[] }>(`/api/admin/users?limit=${encodeURIComponent(String(limit))}`)
}

export async function apiAdminServers(limit = 50) {
  return apiFetch<{ servers: AdminServer[] }>(`/api/admin/servers?limit=${encodeURIComponent(String(limit))}`)
}

export async function apiAdminAudit(limit = 50) {
  return apiFetch<{ logs: AdminAuditLog[] }>(`/api/admin/audit?limit=${encodeURIComponent(String(limit))}`)
}

export async function apiAdminSite() {
  return apiFetch<{ config: SiteConfig }>('/api/admin/site')
}

export async function apiAdminUpdateSite(payload: { lockdownEnabled: boolean; lockdownMessage: string }) {
  return apiFetch<{ config: SiteConfig }>('/api/admin/site', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
