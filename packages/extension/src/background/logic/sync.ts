import { onMessage } from "webext-bridge/background";
import { User } from "./user";
import { Game } from "./game";
import { Char } from "./char";
import { Save } from "./save";
import { db } from "./db";
import { state } from "./state";
import { Api } from "./api";
import z from "zod";
import { config } from "./config";

async function upload() {
  if (!User.isOnline()) {
    return {
      ok: false as const,
      message: "Sync is unavailable when offline",
      itemCount: 0
    }
  }

  const payload = {
    games: [] as ReturnType<typeof Game.prepareForUpload>[],
    chars: [] as ReturnType<typeof Char.prepareForUpload>[],
    saves: [] as ReturnType<typeof Save.prepareForUpload>[],
  }

  const games = await db.games
    .where("updatedAt")
    .aboveOrEqual(state.user.lastSyncedAt)
    .or("remoteId").equals(-1)
    .toArray()
  for (const game of games) {
    payload.games.push(Game.prepareForUpload(game))
  }

  const chars = await db.chars
    .where("updatedAt")
    .aboveOrEqual(state.user.lastSyncedAt)
    .or("remoteId").equals(-1)
    .toArray()
  for (const char of chars) {
    payload.chars.push(Char.prepareForUpload(char))
  }

  const saves = await db.saves
    .where("updatedAt")
    .aboveOrEqual(state.user.lastSyncedAt)
    .or("remoteId").equals(-1)
    .toArray()
  for (const save of saves) {
    payload.saves.push(Save.prepareForUpload(save))
  }

  const itemCount = Object.values(payload).reduce((a, b) => a + b.length, 0);

  if (itemCount === 0) {
    return { ok: true as const, itemCount: 0, errorCount: 0 }
  }

  const res = await Api.syncUp(payload)

  if (res.ok) {
    for (const [uuid, remoteId] of Object.entries(res.games)) {
      const game = await db.games.get({ uuid })
      if (!game) continue
      await db.games.update(game.id, { remoteId })
    }
    for (const [uuid, remoteId] of Object.entries(res.chars)) {
      const char = await db.chars.get({ uuid })
      if (!char) continue
      await db.chars.update(char.id, { remoteId })
    }
    for (const [uuid, remoteId] of Object.entries(res.saves)) {
      const save = await db.saves.get({ uuid })
      if (!save) continue
      await db.saves.update(save.id, { remoteId })
    }
  }

  return {
    ok: res.ok,
    itemCount,
    message: res.message || "Uploaded successfully",
    errorCount: (!res.ok) ? -1 : res.errors.length
  }
}

async function download() {
  if (!User.isOnline()) {
    return {
      ok: false as const,
      message: "Sync is unavailable when offline",
      itemCount: 0
    }
  }
  const res = await Api.syncDown(state.user.lastSyncedAt)
  if (!res.ok) {
    return {
      ...res,
      itemCount: 0
    }
  }
  const { success, data, error } = z.object({
    games: z.array(z.unknown()),
    chars: z.array(z.unknown()),
    saves: z.array(z.unknown()),
  }).safeParse(res.data)

  if (!success) {
    console.error(error)
    return { ok: false as const, message: "Server sent malformed response" }
  }

  const itemCount = Object.values(data).reduce((a, b) => a + b.length, 0);
  let errorCount = 0;
  const { games, chars, saves } = data

  for (const rawgame of games) {
    try {
      const game = Game.parseDownloaded(rawgame)
      const existing = await db.games.get({ uuid: game.uuid });
      if (existing) {
        if (existing.updatedAt > game.updatedAt) {
          // Skip received update, if local version is newer
          continue
        }
        game.id = existing.id;
      }
      Game.commit(game);
    } catch {
      console.error("Invalid game synced", error, rawgame);
      errorCount++
      continue;
    }
  }
  for (const rawchar of chars) {
    try {
      const char = Char.parseDownloaded(rawchar)
      const existing = await db.chars.get({ uuid: char.uuid });
      if (existing) {
        if (existing.updatedAt > char.updatedAt) {
          // Skip received update, if local version is newer
          continue
        }
        char.id = existing.id;
      }
      Char.commit(char);
    } catch {
      console.error("Invalid char synced", error, rawchar);
      errorCount++
      continue;
    }
  }
  for (const rawsave of saves) {
    try {
      const save = Save.parseDownloaded(rawsave)
      const existing = await db.saves.get({ uuid: save.uuid });
      if (existing) {
        if (existing.updatedAt > save.updatedAt) {
          // Skip received update, if local version is newer
          continue
        }
        save.id = existing.id;
      }
      Save.commit(save);
    } catch {
      console.error("Invalid save synced", error, rawsave);
      errorCount++
      continue;
    }
  }

  return {
    ok: true,
    message: "Downloaded successfully",
    itemCount,
    errorCount
  }
}

async function sync() {
  const down = await download()
  if (!down.ok) return { ok: false, message: down.message, uploaded: -1, downloaded: -1 }
  const up = await upload()
  if (up.ok) {
    state.user.lastSyncedAt = Date.now()
    User.save()
  }
  return {
    ok: up.ok,
    message: up.ok ? "Synced successfully" : up.message || "Unknown error",
    uploaded: up.itemCount === -1 ? -1 : ((up.itemCount || 0) - (up.errorCount || 0)),
    downloaded: down.itemCount === -1 ? -1 : ((down.itemCount || 0) - (down.errorCount || 0))
  }
}

let scheduledSyncTimeout: number = 0;
const scheduledSyncPromises: ((result: Awaited<ReturnType<typeof sync>>) => void)[] = []

function scheduleSync() {
  return new Promise<Awaited<ReturnType<typeof sync>>>((resolve) => {
    scheduledSyncPromises.push(resolve)
    if (scheduledSyncTimeout) {
      clearTimeout(scheduledSyncTimeout)
    }
    scheduledSyncTimeout = setTimeout(() => {
      sync()
        .then(res => {
          scheduledSyncPromises.forEach(resolve => resolve(res))
          scheduledSyncPromises.length = 0
        })
        .catch(() => {
          scheduledSyncPromises.forEach(resolve => resolve({ ok: false, message: "Sync promise failed", uploaded: -1, downloaded: -1 }))
          scheduledSyncPromises.length = 0
        })
    }, config.syncDelay)
  })
}

onMessage("bg_sync_now", async () => {
  return await sync()
})

onMessage("bg_sync", async () => {
  return await scheduleSync()
})

export const Sync = {
  upload,
  download,
  sync,
  scheduleSync
}


