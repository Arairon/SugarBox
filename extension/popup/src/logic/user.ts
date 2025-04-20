import { config } from "@/config";
import { UserObj } from "@/types";
import { z } from "zod";
import { Game, GameDownloadSchema, GameUploadSchema } from "./games";
import { Char, CharDownloadSchema, CharUploadSchema } from "./chars";
import { Save, SaveDownloadSchema, SaveUploadSchema } from "./saves";
import { db } from "@/db";

export const SessionSchema = z.object({
  accesstoken: z.string().default(""),
  refreshtoken: z.string().default(""),
  accessExpiresAt: z
    .date({ coerce: true })
    .default(new Date(0))
    .transform((t) => t.getTime()),
  refreshExpiresAt: z
    .date({ coerce: true })
    .default(new Date(0))
    .transform((t) => t.getTime()),
});

export const schema = z
  .object({
    id: z.number().int().nullable().default(null),
    username: z.string().default(""),
    displayname: z.string().default(""),
    email: z.string().default(""),
    emailConfirmed: z.boolean().default(false),
    session: SessionSchema.default({}),
    role: z.enum(["user", "admin", "limited"]).default("user"),
    online: z.boolean().default(false),
    offlineReason: z.string().default(""),
    onlineMode: z.boolean().default(true),
    syncPeriod: z.number().int().default(300), // sync period in seconds. 0 = live
  })
  .transform((user) => {
    if (Date.now() > user.session.refreshExpiresAt) {
      user.session.accesstoken = "";
      user.session.refreshtoken = "";
    }
    return user;
  });

function createEmptyUser(): UserObj {
  return schema.parse({});
}

async function loadUser(): Promise<UserObj> {
  const rawUser = (await chrome.storage.local.get("user")).user as UserObj;
  const { error, data, success } = schema.safeParse(rawUser);
  if (!success) {
    console.warn("Failed to restore user object, attempting migration", error);
    const user = createEmptyUser();
    Object.assign(user, rawUser);
    const { error: newErr, data, success } = schema.safeParse(rawUser);
    if (!success) {
      console.warn("Failed to migrate user object", newErr);
      const user = createEmptyUser();
      commit(user);
      return user;
    }
    commit(data);
    return data;
  }
  data.online = false;
  data.offlineReason = "";
  return data;
}

async function init(rawuser: UserObj) {
  let user = createEmptyUser();
  if (rawuser.session.accesstoken) {
    if (rawuser.session.accessExpiresAt > Date.now()) {
      user = (await updateSelf(rawuser)).user;
    } else if (rawuser.session.refreshExpiresAt > Date.now()) {
      user = (await refreshSession(rawuser)).user;
      user = (await updateSelf(rawuser)).user;
    } else {
      logout(user);
    }
  }
  if (online(user)) {
    sync(user, new Date((await User.getLastCommitTime()) ?? 0));
  }
  return copy(user);
}

function logout(user: UserObj) {
  try {
    fetch(config.baseURL + "api/auth/logout", {
      method: "POST",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
    });
  } catch {}
  const newuser = Object.assign(copy(user), createEmptyUser());
  commit(newuser);
  return newuser;
}

export function jsonHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export function authHeader(user: UserObj, useRefreshToken = false) {
  if (useRefreshToken)
    return { Authorization: `Bearer ${user.session.refreshtoken}` };
  return { Authorization: `Bearer ${user.session.accesstoken}` };
}

export type UserActionRes = {
  success: boolean;
  user: UserObj;
  message?: string;
};

async function checkSession(user: UserObj) {
  if (user.session.accessExpiresAt > Date.now()) return user;
  return (await refreshSession(user)).user;
}

async function refreshSession(user: UserObj): Promise<UserActionRes> {
  let res;
  try {
    res = await fetch(config.baseURL + "api/auth/refresh", {
      method: "GET",
      headers: Object.assign(jsonHeaders(), authHeader(user, true)),
    });
  } catch {}
  const data = {
    success: res?.ok ?? false,
    user,
  } as UserActionRes;
  if (data.success && res) {
    const {
      data: response,
      success,
      error,
    } = ServerResSchema.safeParse(await res.json());
    if (!success) {
      user.online = false;
      if (!user.offlineReason)
        user.offlineReason = "Refresh failed. Server sent incorrect data";
      data.message = "Server sent incorrect data, see console for details";
      console.warn(error);
      return data;
    }
    if (response.status !== "ok") {
      user.online = false;
      if (!user.offlineReason)
        user.offlineReason = `Refresh failed. ${data.message}`;
      data.message = "Server refused to refresh session";
      console.warn(response.message);
      return data;
    }
    Object.assign(user, response.data.user);
    user.session = SessionSchema.parse(response.data.session);
    user.online = true;
  } else {
    if (res?.status === 403 || res?.status === 404) {
      user.online = false;
      if (!user.offlineReason)
        user.offlineReason = "Refresh failed. Could not login";
      data.message = "Could not login";
      data.user = logout(user);
      return data;
    } else if (res?.status === 500) {
      user.offlineReason =
        "Refresh failed. Please check your internet connection and relogin";
    }
    user.online = false;
    data.message = "Server did not respond";
    if (!user.offlineReason)
      user.offlineReason = "Refresh failed. Server did not respond";
    console.warn("Refresh: Server did not respond");
    try {
      if (res) {
        const msg = await res?.json();
        data.message = msg?.message;
      }
    } catch {}
  }
  User.commit(data.user);
  return data;
}

async function sync(user: UserObj, cutoffPoint: Date) {
  user = await checkSession(user);
  const uploaded = await syncUp(user, cutoffPoint);
  const downloaded = await syncDown(user, cutoffPoint);
  updLastCommit(user);
  return {
    uploaded,
    downloaded:
      cutoffPoint.getTime() === 0
        ? downloaded
        : downloaded - (uploaded !== -1 ? uploaded : 0),
  };
}

async function syncUp(user: UserObj, cutoffPoint: Date) {
  if (!User.online(user, true)) return -1;
  user = await checkSession(user);

  const payload = {
    games: [] as z.infer<typeof GameUploadSchema>[],
    chars: [] as z.infer<typeof CharUploadSchema>[],
    saves: [] as z.infer<typeof SaveUploadSchema>[],
  };
  const games = await db.games
    .where("updatedAt")
    .aboveOrEqual(cutoffPoint.getTime())
    .toArray();
  for (const game of games) {
    const { success, data } = GameUploadSchema.safeParse(game);
    if (success) payload.games.push(data);
  }

  const chars = await db.chars
    .where("updatedAt")
    .aboveOrEqual(cutoffPoint.getTime())
    .toArray();
  for (const char of chars) {
    const { success, data } = CharUploadSchema.safeParse(char);
    if (success) payload.chars.push(data);
  }

  const saves = await db.saves
    .where("updatedAt")
    .aboveOrEqual(cutoffPoint.getTime())
    .toArray();
  for (const save of saves) {
    const { success, data } = SaveUploadSchema.safeParse(save);
    if (success) payload.saves.push(data);
  }
  const itemCount = Object.values(payload).reduce((a, b) => a + b.length, 0);

  if (itemCount === 0) {
    return 0;
  }
  let res;
  try {
    res = await fetch(config.baseURL + "api/sync/up", {
      method: "POST",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
      body: JSON.stringify(payload),
    });
  } catch {}
  if (!res) return -1;
  const { data, success, error } = ServerResSchema.safeParse(await res.json());
  if (!success) {
    console.error("Error syncing up (server sent wrong response)", error);
    return -1;
  }
  if (data.status !== "ok") {
    console.error("Error syncing up, server refused", data.message);
    return -1;
  }
  const errCount = data?.data?.errors?.length ?? 0;
  if (errCount)
    console.warn(`Failed to sync up ${errCount} items\n`, data.data.errors);
  return itemCount - errCount;
}

async function syncDown(user: UserObj, cutoffPoint: Date) {
  if (!User.online(user, true)) return -1;
  user = await checkSession(user);

  let res;
  try {
    res = await fetch(
      config.baseURL + `api/sync/down?cutoffPoint=${cutoffPoint.toJSON()}`,
      {
        method: "GET",
        headers: Object.assign(jsonHeaders(), authHeader(user)),
      }
    );
  } catch {}
  if (!res) return -1;
  let count = 0;
  const { data, success, error } = ServerResSchema.safeParse(await res.json());
  if (!success) {
    console.error("Error syncing down (server sent wrong response)", error);
    return -1;
  }
  if (data.status !== "ok") {
    console.error("Error syncing down, server refused", data.message);
    return -1;
  }
  const synced = data.data;
  for (const game of synced.games) {
    const { data, success, error } = GameDownloadSchema.safeParse(game);
    if (!success) {
      console.error("Invalid game synced", error, game);
      continue;
    }
    const existing = await db.games.get({ uuid: data.uuid });
    if (existing) data.id = existing.id;
    Game.commit(data);
    count++;
  }
  for (const char of synced.chars) {
    const { data, success, error } = CharDownloadSchema.safeParse(char);
    if (!success) {
      console.error("Invalid char synced", error, char);
      continue;
    }
    const existing = await db.chars.get({ uuid: data.uuid });
    if (existing) data.id = existing.id;
    Char.commit(data);
    count++;
  }
  for (const save of synced.saves) {
    const { data, success, error } = SaveDownloadSchema.safeParse(save);
    if (!success) {
      console.error("Invalid save synced", error, save);
      continue;
    }
    const existing = await db.saves.get({ uuid: data.uuid });
    if (existing) data.id = existing.id;
    Save.commit(data);
    count++;
  }
  return count;
}

export const ServerResSchema = z.object({
  status: z.enum(["ok", "error"]),
  message: z.any(),
  data: z.any().optional(),
});

const UserInfoSchema = z.object({
  id: z.number(),
  username: z.string(),
  displayname: z.string(),
  email: z.string().default(""),
  emailConfirmed: z.boolean(),
  role: z.string(),
});

async function updateSelf(user: UserObj): Promise<UserActionRes> {
  user = await checkSession(user);
  let res;
  try {
    res = await fetch(config.baseURL + "api/auth/self", {
      method: "get",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
    });
  } catch {}
  const data = {
    success: res?.ok ?? false,
    user: copy(user),
  } as UserActionRes;
  if (data.success && res) {
    const {
      data: userData,
      success,
      error,
    } = UserInfoSchema.safeParse(await res.json());
    if (!success) {
      data.user.online = false;
      if (!data.user.offlineReason)
        data.user.offlineReason =
          "Connection failed. Server sent incorrect data";
      data.message = "Server sent incorrect data, see console for details";
      console.error(error);
      return data;
    }
    Object.assign(data.user, userData);
    data.user.online = true;
  } else {
    if (res?.status === 403 || res?.status === 404) {
      user.online = false;
      if (!user.offlineReason)
        user.offlineReason = "Refresh failed. Could not login";
      data.message = "Could not login";
      data.user = logout(user);
      return data;
    }
    data.user.online = false;
    if (!data.user.offlineReason)
      data.user.offlineReason = "Connection failed. Server did not respond";
    data.message = "Server did not respond";
    try {
      if (res) {
        const msg = await res?.json();
        data.message = msg?.message;
      }
    } catch {}
  }
  return data;
}

async function login(
  user: UserObj,
  username: string,
  password: string
  //attemptRegister = false
): Promise<UserActionRes> {
  let res;
  try {
    res = await fetch(config.baseURL + "api/auth/login", {
      method: "post",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
      body: JSON.stringify({
        username,
        password,
      }),
    });
  } catch {}
  const data = {
    success: res?.ok ?? false,
    user: copy(user),
  } as UserActionRes;
  if (data.success && res) {
    const {
      data: response,
      success,
      error,
    } = ServerResSchema.safeParse(await res.json());
    if (!success) {
      data.user.online = false;
      if (!user.offlineReason)
        user.offlineReason = "Login failed. Server sent incorrect data";
      data.message = "Server sent incorrect data, see console for details";
      console.error(error);
      return data;
    }
    data.message = response.message;
    Object.assign(data.user, response.data.user);
    data.user.session = SessionSchema.parse(response.data.session);
    data.user.online = true;
  } else {
    // if (attemptRegister) {
    //   const res = await register(data.user, username, password);
    //   Object.assign(data, res);
    //   return data;
    // }
    if (!user.offlineReason)
      user.offlineReason = "Login failed. Server did not respond";
    data.user.online = false;
    data.message = "Server did not respond";
    try {
      if (res) {
        const msg = await res?.json();
        data.message = msg?.message;
      }
    } catch {}
  }
  return data;
}

async function register(
  user: UserObj,
  username: string,
  email: string,
  password: string
): Promise<UserActionRes> {
  let res;
  try {
    res = await fetch(config.baseURL + "api/auth/register", {
      method: "post",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
      body: JSON.stringify({
        username,
        email,
        password,
      }),
    });
  } catch {}
  const data = {
    success: res?.ok ?? false,
    user: copy(user),
  } as UserActionRes;
  if (data.success && res) {
    const {
      data: response,
      success,
      error,
    } = ServerResSchema.safeParse(await res.json());
    if (!success) {
      data.user.online = false;
      if (!user.offlineReason)
        user.offlineReason = "Registration failed. Server sent incorrect data";
      data.message = "Server sent incorrect data, see console for details";
      console.error(error);
      return data;
    }
    data.message = response.message;
    Object.assign(data.user, response.data.user);
    data.user.session = SessionSchema.parse(response.data.session);
    data.user.online = true;
  } else {
    data.user.online = false;
    if (!user.offlineReason)
      user.offlineReason = "Registration failed. Server did not respond";
    data.message = "Server did not respond";
    try {
      if (res) {
        const msg = await res?.json();
        data.message = msg?.message;
      }
    } catch {}
  }
  return data;
}

export const UserPatchSchema = z.object({
  displayname: z
    .string({ message: "Username must be a string" })
    .trim()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(64, { message: "Username cannot exceed 64 characters" })
    .optional(),
  username: z
    .string({ message: "Username must be a string" })
    .trim()
    .toLowerCase()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(32, { message: "Username cannot exceed 32 characters" })
    .optional(),
  email: z
    .string({ message: "Email must be a string" })
    .trim()
    .toLowerCase()
    .email({ message: "Email must be a valid email address" })
    .optional(),
  password: z
    .string({ message: "Password must be a string" })
    .trim()
    .min(3, { message: "Password must be at least 3 characters long" })
    .max(256, { message: "Username cannot exceed 256 characters" })
    .optional(),
});
type UserPatchObj = z.infer<typeof UserPatchSchema>;

async function updateAccount(
  user: UserObj,
  data: UserPatchObj
): Promise<UserActionRes> {
  if (!User.online(user)) return { success: false, user };
  user = await checkSession(user);

  data = UserPatchSchema.parse(data);

  try {
    const res = await fetch(config.baseURL + "api/user/self", {
      method: "PATCH",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const msg = await res.json();
      const newuser = copy(user);
      Object.assign(newuser, msg.data);
      return {
        success: true,
        user: newuser,
      };
    } else {
      const msg = await res.json();
      return {
        success: false,
        user,
        message: msg?.message,
      };
    }
  } catch {
    return { success: false, user, message: "Server refused connection" };
  }
}

export type SessionObj = {
  userId: number;
  id: number;
  createdAt: Date;
  active: boolean;
  name: string;
  description: string;
  tokens: {
    userId: number;
    sessionId: number;
    id: number;
    createdAt: Date;
    active: boolean;
    expiresAt: Date;
  }[];
};

async function fetchSessions(user: UserObj): Promise<SessionObj[]> {
  if (!User.online(user)) return [];
  user = await checkSession(user);

  try {
    const res = await fetch(config.baseURL + "api/user/sessions", {
      method: "GET",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {}
  return [];
}

async function dropSession(user: UserObj, sessionId: number) {
  if (!User.online(user)) return false;
  user = await checkSession(user);

  try {
    const res = await fetch(config.baseURL + "api/user/session/" + sessionId, {
      method: "DELETE",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
    });
    if (!res.ok) return false;
    return true;
  } catch {}
  return false;
}

async function requestQuota(user: UserObj) {
  if (!User.online(user)) return { usage: 0, quota: 0 };
  user = await checkSession(user);

  try {
    const res = await fetch(config.baseURL + "api/user/quota", {
      method: "GET",
      headers: Object.assign(jsonHeaders(), authHeader(user)),
    });
    if (!res.ok) return { usage: 0, quota: 0 };
    const {
      data: response,
      success,
      error,
    } = ServerResSchema.safeParse(await res.json());
    if (!success) {
      console.warn(error);
      return;
    }
    return response.data;
  } catch {}
}

function copy(obj: UserObj) {
  return Object.assign({}, obj);
}

function commit(user: UserObj) {
  chrome.storage.local.set({ user });
}

function updLastCommit(user: UserObj | null = null) {
  if (online(user)) chrome.storage.local.set({ lastCommit: Date.now() });
}

async function getLastCommitTime(): Promise<number | undefined> {
  return (await chrome.storage.local.get("lastCommit"))?.lastCommit;
}

function online(user: UserObj | null, checkLimited = false) {
  let online = user && user.id && user.onlineMode && user.online;
  if (online && checkLimited) online &&= user!.role !== "limited";
  return online;
}

function invalidateRemoteIds() {
  return Promise.all([
    Game.invalidateRemoteIds(),
    Char.invalidateRemoteIds(),
    Save.invalidateRemoteIds(),
  ]);
}

export const User = {
  createEmptyUser,
  init,
  loadUser,
  refreshSession,
  updateAccount,
  fetchSessions,
  checkSession,
  dropSession,
  updateSelf,
  login,
  register,
  logout,
  commit,
  copy,
  sync,
  syncDown,
  syncUp,
  online,
  invalidateRemoteIds,
  updLastCommit,
  getLastCommitTime,
  requestQuota,
};

const _global = window as any;
_global.User = User;
