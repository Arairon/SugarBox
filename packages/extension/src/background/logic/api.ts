import ky from "ky"
import { config } from "./config"

export const baseApi = ky.create({
  throwHttpErrors: false,
  credentials: "include",
})


function getApi() {
  return baseApi.extend({ prefixUrl: config.baseURL + "api/", })
}

async function refresh() {
  const api = getApi()
  const res = await api.get("auth")
  console.log(res)
}

async function login({ username, password }: { username: string, password: string }) {
  const api = getApi()
  const res = await api.post("auth/login", {
    json: { username, password }
  })
  return res
}

async function logout() {
  const api = getApi()
  await api.post("auth/logout")
}

export const Api = {
  getApi,
  refresh,
  login,
  logout
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _global = globalThis as any;
_global.Api = Api

