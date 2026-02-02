import ky from "ky"
import { state } from "./state"
import { saveUser } from "./user"
import { config } from "./config"

export const baseApi = ky.create({
  hooks: {
    beforeRequest: [
      (request)=> {
        request.headers.set("X-Refresh-Token", `${state.user.refreshToken}`)
        request.headers.set("X-Access-Token", `${state.user.accessToken}`)
        // request.headers.set("Authorization", `Bearer ${state.user.accessToken}`)
      }
    ],
    afterResponse: [
      (response) => {
        const refreshToken = response.headers.get("X-Refresh-Token")
        if (refreshToken) state.user.refreshToken = refreshToken;
        const accessToken = response.headers.get("X-Access-Token")
        if (accessToken) state.user.accessToken = accessToken;
        if (refreshToken || accessToken) saveUser()
      }
    ]
  }
})

export function getApi() {
  return baseApi.extend({prefixUrl: config.baseURL})
}
