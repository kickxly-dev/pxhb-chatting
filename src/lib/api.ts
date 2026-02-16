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
    const msg = (data as any)?.error || `http_${res.status}`
    throw new Error(msg)
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
export type Message = {
  id: string
  content: string
  createdAt: string
  author: { id: string; username: string }
}

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
