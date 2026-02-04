import { sendMessage } from "webext-bridge/popup"
import { useSugarBoxState } from "./state"
import type { Config } from "@/background/logic/config"

export async function refreshUser() {
  const user = await sendMessage("bg_user_refresh", undefined, "background")
  useSugarBoxState.getState().setUser(user)
}

export async function toggleOnlineMode() {
  const result = await sendMessage("bg_user_online_toggle", undefined, "background")
  return result
}

export async function register(credentials: { email: string, username: string, password: string }) {
  const result = await sendMessage("bg_user_register", credentials, "background")
  return result
}

export async function login(credentials: { username: string, password: string }) {
  const result = await sendMessage("bg_user_login", credentials, "background")
  return result
}

export async function logout() {
  const result = sendMessage("bg_user_logout", undefined, "background")
  return result
}

export async function requestSync() {
  const result = await sendMessage("bg_sync", undefined, "background")
  return result
}

export async function requestSyncNow() {
  const result = await sendMessage("bg_sync_now", undefined, "background")
  return result
}

export async function getQuota() {
  return await sendMessage("bg_user_get_quota", undefined, "background")
}

export async function getConfig() {
  return await sendMessage("bg_config_get", undefined, "background")
}

export async function setConfig(config: Config) {
  return await sendMessage("bg_config_set", config, "background")
}

