import { UserSchema } from "@/shared/types";
import { state } from "./state";

export function saveUser() {
  chrome.storage.local.set({ user: state.user })
}

async function loadUser() {
  const { user: loadedUser } = await chrome.storage.local.get("user")
  if (!loadedUser) return;
  const { success, data, error } = UserSchema.safeParse(loadedUser)
  if (!success) {
    console.error(`Invalid user in localStorage; Error: ${error}`, loadedUser)
  }
  Object.assign(state.user, data)
}

loadUser()
