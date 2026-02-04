import ky from "ky"
import { config } from "./config"
import { state } from "./state"
import { User } from "./user"
import z from "zod"
import { onMessage } from "webext-bridge/background"
import type { GameUploadObject } from "./game"
import type { CharUploadObject } from "./char"
import type { SaveUploadObject } from "./save"

export const baseApi = ky.create({
  throwHttpErrors: false,
  credentials: "include",
})

function getApi() {
  return baseApi.extend({ prefixUrl: config.baseURL + "api/", })
}

const ServerResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
  data: z.unknown().optional()
})
type ServerResponse = z.infer<typeof ServerResponseSchema>

const UserInfoSchema = z.object({
  id: z.number(),
  username: z.string(),
  displayname: z.string(),
  email: z.string().default(""),
  emailConfirmed: z.boolean(),
  role: z.string(),
});


async function refresh() {
  const api = getApi()
  const res = await api.get("auth")
  console.log(res)
}

async function register({ email, username, password }: { email: string, username: string, password: string }) {
  const api = getApi()
  let data: ServerResponse;
  try {
    const res = await api.post("user/register", {
      json: { email, username, password }
    })
    data = await res.json()
  } catch {
    User.goOffline("Fatal error during 'register' request")
    return { ok: false as const, message: "Unable to contact server" }
  }
  if (!data.ok || !data.data) {
    return { ok: false as const, message: data.message || "Unknown error" }
  }
  const userInfo = UserInfoSchema.parse((data.data as { user: unknown })?.user)
  state.user.online = true
  Object.assign(state.user, userInfo)
  User.save()
  return { ok: true as const, user: state.user }
}

async function login({ username, password }: { username: string, password: string }) {
  const api = getApi()
  let data: ServerResponse;
  try {
    const res = await api.post("user/login", {
      json: { username, password }
    })
    data = await res.json()
  } catch {
    User.goOffline("Fatal error during 'login' request")
    return { ok: false as const, message: "Unable to contact server" }
  }
  if (!data.ok || !data.data) {
    return { ok: false as const, message: data.message || "Unknown error" }
  }
  const userInfo = UserInfoSchema.parse((data.data as { user: unknown })?.user)
  state.user.online = true
  Object.assign(state.user, userInfo)
  User.save()
  return { ok: true as const, user: state.user }
}

const UserCredentialsSchema = z.object({
  username: z
    .string({ message: "Username must be a string" })
    .trim()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(32, { message: "Username cannot exceed 32 characters" }),
  email: z.email({ message: "Email must be a valid email address" }).trim(),
  password: z
    .string({ message: "Password must be a string" })
    .trim()
    .min(3, { message: "Password must be at least 3 characters long" })
    .max(256, { message: "Username cannot exceed 256 characters" }),
});

onMessage("bg_user_register", async ({ data }) => {
  const { success, data: creds, error } = UserCredentialsSchema.safeParse(data)
  if (!success) return {
    ok: false as const,
    message: error.message
  }
  return await register(creds)
})

onMessage("bg_user_login", async ({ data }) => {
  const { success, data: creds, error } = UserCredentialsSchema.omit({ email: true }).safeParse(data)
  if (!success) return {
    ok: false as const,
    message: error.message
  }
  return await login(creds)
})

onMessage("bg_user_logout", async () => {
  if (!state.user.onlineMode) {
    // In manual offline mode - force reset on logout
    const res = await logout()
    if (!res.ok)
      User.reset()
    return res;
  }
  return await logout()
})

async function logout() {
  const api = getApi()
  try {
    const res = await api.post("user/logout")
    await res.json()
  } catch {
    User.goOffline("Fatal error during 'logout' request")
    return { ok: false as const, message: "Unable to contact server" }
  }
  // Whatever the server responded, the session is either over or didn't exist in the first place
  User.reset()
  return { ok: true as const }
}


async function refreshUser() {
  if (!User.isOnline()) return
  const api = getApi()
  try {
    const req = await api.get("user")
    const res = ServerResponseSchema.parse(await req.json())
    if (req.ok) {
      const { success, data } = UserInfoSchema.safeParse(res.data)
      if (success) {
        state.user.online = true
        Object.assign(state.user, data)
        User.save()
      } else {
        User.goOffline("Refresh failed. Server sent invalid response")
      }
    } else {
      if (req.status === 401) {
        User.reset()
      } else {
        User.goOffline(`Server refused: ${res.message || req.statusText}`)
      }
    }
  } catch {
    User.goOffline("Unable to contact server")
  }
}

let lastRefreshTime = Date.now()
onMessage("bg_user_refresh", async () => {
  if (Date.now() - lastRefreshTime > 10_000) {
    lastRefreshTime = Date.now()
    await refreshUser()
  }
  return state.user
})

onMessage("bg_user_refresh_force", async () => {
  lastRefreshTime = Date.now()
  await refreshUser()
  return state.user
})


type SyncUpPayload = {
  games: GameUploadObject[]
  chars: CharUploadObject[]
  saves: SaveUploadObject[]
}

const SyncUpResponseSchema = z.object({
  errors: z.array(z.any()).default([]),
  games: z.record(z.string(), z.number()),
  chars: z.record(z.string(), z.number()),
  saves: z.record(z.string(), z.number()),
})

async function syncUp(payload: SyncUpPayload) {
  const api = getApi()
  let data: ServerResponse;
  try {
    const res = await api.post("sync", {
      json: payload
    })
    data = await res.json()
  } catch {
    User.goOffline("Fatal error during 'sync/up' request")
    return { ok: false as const, message: "Unable to contact server" }
  }
  if (!data.ok) {
    return { ok: false as const, message: data.message || "Unknown error" }
  }
  const { success, data: response, error } = SyncUpResponseSchema.safeParse(data.data)
  if (!success) {
    console.log("SyncUp Error:", error)
    return { ok: false as const, message: "Server responded incorrectly" }
  }
  return { ok: true as const, ...response }
}

async function syncDown(cutoffPoint: number) {
  const api = getApi()
  let data: ServerResponse;
  try {
    const params = new URLSearchParams({
      cutoffPoint: cutoffPoint.toString(),
      games: "true",
      chars: "true",
      saves: "true"
    })
    const res = await api.get("sync", {
      searchParams: params
    })
    data = await res.json()
  } catch {
    User.goOffline("Fatal error during 'sync/down' request")
    return { ok: false as const, message: "Unable to contact server" }
  }
  if (!data.ok || !data.data) {
    return { ok: false as const, message: data.message || "Unknown error" }
  }

  return { ok: true as const, data: data.data }
}

const QuotaResponseSchema = z.object({
  quota: z.number(),
  usage: z.number()
})

async function getQuota() {
  const api = getApi()
  let data: ServerResponse;
  try {
    const res = await api.get("user/quota")
    data = await res.json()
  } catch {
    User.goOffline("Fatal error during 'user/quota' request")
    return { ok: false as const, message: "Unable to contact server" }
  }
  if (!data.ok || !data.data) {
    return { ok: false as const, message: data.message || "Unknown error" }
  }
  const { success, data: res } = QuotaResponseSchema.safeParse(data.data)
  if (!success) {
    return { ok: false as const, message: "Invalid response from server" }
  }

  return { ok: true as const, ...res }
}

onMessage("bg_user_get_quota", async () => {
  return await getQuota()
})

const ServerVersionResponseSchema = z.object({
  major: z.number(),
  minor: z.number(),
  patch: z.number(),
  mod: z.string().optional()
})

async function getServerVersion(baseURL = undefined as undefined | string) {
  const api = getApi().extend({ prefixUrl: (baseURL ?? config.baseURL) + "api/" })
  let data: ServerResponse;
  try {
    const res = await api.get("version")
    data = await res.json()
  } catch {
    User.goOffline("Fatal error during 'version' request")
    return { ok: false as const, message: "Unable to contact server" }
  }
  const { success, data: res } = ServerVersionResponseSchema.safeParse(data.data)
  if (!success) {
    return { ok: false as const, message: "Invalid response from server" }
  }

  return { ok: true as const, ...res }
}

export const Api = {
  getApi,
  refresh,
  login,
  logout,
  refreshUser,
  syncUp,
  syncDown,
  getServerVersion
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _global = globalThis as any;
_global.Api = Api

