import { CharSchema, type CharObj } from "@/shared/types";
import { db } from "./db";
import { state } from "./state"
import { onMessage } from "webext-bridge/background";
import { Save } from "./save";
import z from "zod";
import { Sync } from "./sync";
import { Game } from "./game";

const latestCharMap: Record<number, number> = {}; // GameID: CharID

function saveLatestCharMap() {
  chrome.storage.local.set({ latestCharMap })
}

async function loadLatestCharMap() {
  const { latestCharMap: loadedMap } = await chrome.storage.local.get("latestCharMap")
  if (loadedMap) Object.assign(latestCharMap, loadedMap)
}

loadLatestCharMap()

async function handleGameSwitch() {
  if (!state.game) {
    // No event, since char is null after game switch event
    return;
  }
  const latestCharId = latestCharMap[state.game.id];
  if (!latestCharId) return;
  const char = await db.chars.get(latestCharId) ?? null;
  if (char?.archived) {
    await switchTo(null)
    return
  }
  await switchTo(char)
}

async function switchTo(char: CharObj | null) {
  if (state.char === char) return;
  state.char = char;
  if (state.game) {
    if (char)
      latestCharMap[state.game.id] = char.id;
    else delete latestCharMap[state.game.id]

    saveLatestCharMap()
  }
  // TODO: Fire an event
  console.log(`Switched Char: `, char)
}

onMessage("bg_change_char", ({ data }) => switchTo(data as CharObj | null))


export const CharUploadSchema = z.object({
  uuid: z.uuid(),
  name: z.string(),
  gameId: z.uuid(),
  slots: z
    .array(z.union([z.uuid(), z.literal("")]))
    .transform((p) => JSON.stringify(p)),
  archived: z.coerce.boolean(),
  archivedAt: z.coerce.date().default(new Date(0)),
  updatedAt: z.coerce.date().default(() => new Date()),
  createdAt: z.coerce.date().default(() => new Date()),
});

export type CharUploadObject = z.infer<typeof CharUploadSchema>

export const CharDownloadSchema = z
  .object({
    id: z.number(),
    uuid: z.uuid(),
    remoteId: z.any().transform(() => -1),
    name: z.string(),
    gameId: z.uuid(),
    slots: z
      .string()
      .transform((slots) =>
        z
          .array(z.union([z.uuid(), z.literal("")]))
          .parse(JSON.parse(slots))
      ),
    archived: z.boolean().transform((v) => Number(v) as 0 | 1),
    archivedAt: z.coerce.date().transform((v) => v.getTime()),
    updatedAt: z.coerce.date().transform((v) => v.getTime()),
    createdAt: z.coerce.date().transform((v) => v.getTime()),
  })
  .transform((c) => {
    c.remoteId = c.id;
    c.id = -1
    return c
  });

export type CharDownloadObject = z.infer<typeof CharDownloadSchema>


function prepareForUpload(char: CharObj) {
  return CharUploadSchema.parse(char)
}

function parseDownloaded(char: unknown) {
  return CharDownloadSchema.parse(char)
}

function validateSlots(char: CharObj) {
  const encounteredUuids: string[] = []
  for (let i = 0; i < char.slots.length; i++) {
    const uuid = char.slots[i]
    if (encounteredUuids.includes(uuid)) {
      char.slots[i] = ""
    } else {
      encounteredUuids.push(uuid)
    }
  }
}

async function commit(char: CharObj) {
  char.updatedAt = Date.now()
  validateSlots(char)
  if (char.id === -1) {
    char.id = await db.chars.put(Object.assign(char, { id: undefined }))
  } else {
    char.id = await db.chars.put(char)
  }
  if (char.id === state.char?.id) {
    state.char = char
  }
  if (state.char?.archived) {
    await switchTo(null)
  }

  Sync.scheduleSync()
  return char
}

async function archive(char: CharObj) {
  if (char.archived) return { affectedSaves: [] };
  char.archived = 1;
  char.archivedAt = Date.now();
  const saves = await db.saves
    .where("charId")
    .equals(char.uuid)
    .and((s) => !s.archived)
    .toArray();
  saves.map((s) => {
    Save.archive(s);
  });
  char.slots.length = 0
  await Save.bulkCommit(saves)
  return {
    affectedSaves: saves,
  };
}

async function restore(char: CharObj) {
  const game = await db.games.get({ uuid: char.gameId })
  if (!game) return { ok: false as const, message: "Unable to restore related game" }

  if (game.archived) {
    await Game.restore(game);
  }

  char.archived = 0
  char.archivedAt = 0

  await Char.commit(char)
  return { ok: true as const }
}

onMessage("bg_char_archive", async (msg) => {
  const { success, data: char, error } = validate(msg.data);
  if (!success) {
    return {
      ok: false as const,
      message: error.message
    }
  }
  // TODO: Extra checks?
  const result = await archive(char);
  await commit(char);
  return { ok: true as const, affectedSaves: result.affectedSaves.length }
})

async function getSaves(char: CharObj) {
  const saves = await db.saves
    .where("charId")
    .equals(char.uuid)
    .and((s) => !s.archived)
    .toArray();
  return saves;
}

function validate(char: CharObj) {
  return CharSchema.safeParse(char)
}

onMessage("bg_char_edit", async (msg) => {
  const { success, data: char, error } = validate(msg.data);
  if (!success) {
    return {
      ok: false as const,
      message: error.message
    }
  }
  // TODO: Extra checks?

  const result = await commit(char)
  if (!result) {
    return { ok: false as const, message: "Failed for unknown reasons" }
  }
  return { ok: true as const, char: result }
})

export const Char = {
  handleGameSwitch,
  saveLatestCharMap,
  loadLatestCharMap,
  switchTo,
  archive,
  restore,
  commit,
  getSaves,
  prepareForUpload,
  parseDownloaded
}
