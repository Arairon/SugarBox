import { CharSchema, type CharObj } from "@/shared/types";
import { db } from "./db";
import { state } from "./state"
import { onMessage } from "webext-bridge/background";
import { Save } from "./save";

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

async function commit(char: CharObj) {
  char.updatedAt = Date.now()
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
  return char
}

async function archive(char: CharObj) {
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
  await Save.bulkCommit(saves)
  return {
    affectedSaves: saves,
  };
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
  commit,
  getSaves
}
