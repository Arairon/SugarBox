import { createEmptyUserObject, UserSchema } from "@/shared/types";
import { state } from "./state";
import { onMessage } from "webext-bridge/background";

function save() {
  chrome.storage.local.set({ user: state.user })
}

async function load() {
  const { user: loadedUser } = await chrome.storage.local.get("user")
  if (!loadedUser) return;
  const { success, data, error } = UserSchema.safeParse(loadedUser)
  if (!success) {
    console.error(`Invalid user in localStorage; Error: ${error}`, loadedUser)
  }
  Object.assign(state.user, data)
}

function goOffline(reason = "") {
  state.user.offlineReason = reason
  state.user.online = false;
  save()
}

function reset() {
  Object.assign(state.user, createEmptyUserObject())
  save()
}

function isOnline() {
  const user = state.user
  return user.onlineMode && user.online
}

onMessage("bg_user_online_toggle", () => {
  state.user.onlineMode = !state.user.onlineMode
  save()
})

load()

export const User = {
  goOffline,
  save,
  load,
  reset,
  isOnline
}
