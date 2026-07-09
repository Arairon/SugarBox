import type { SugarBoxPageCommand } from "@/shared/types";
import { state } from "./state";
import { onMessage } from "webext-bridge/background";
import z from "zod";

export async function sendCommand(command: SugarBoxPageCommand) {
  const tab = await chrome.tabs.get(state.tabId);
  if (!tab.id) return;
  return new Promise(function (resolve, reject) {
    if (!tab.id) {
      reject("Invalid tab");
      return;
    }
    try {
      chrome.tabs
        .sendMessage(tab.id, Object.assign({ cmd: "", args: "" }, command))
        .then((res) => resolve(res))
        .catch((err) => reject(err));
    } catch {
      reject("Could not send message");
    }
  });
}

export async function isPageAGame() {
  try {
    const res = await sendCommand({ cmd: "check_sugarcube" });
    return !!res;
  } catch {
    return false;
  }
}

export async function getGameName() {
  return (await sendCommand({ cmd: "get_story_name" })) as string | null;
}

const pageSaveSchema = z.object({
  passage: z.string().nonempty(),
  data: z.string().nonempty().nullable(),
  description: z.string().nonempty().default("No description"),
  version: z.string().default("vUNK"),
});

export async function getSave(parse = true) {
  const res = (await sendCommand({ cmd: "save" })) as unknown | null;
  if (!res || !parse) return res as null;
  return pageSaveSchema.parse(res);
}

export function loadSave(save: string) {
  return sendCommand({ cmd: "load", args: [save] });
}

export async function getPassageName() {
  const res = (await sendCommand({ cmd: "get_passage" })) as string | null;
  return res;
}

onMessage("bg_is_page_a_game", async () => {
  return await isPageAGame();
});

onMessage("bg_get_game_name", async () => {
  return (await getGameName()) as null | string;
});

// (globalThis as any).sendCommand = sendCommand
