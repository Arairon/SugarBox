import { ProtocolWithReturn } from "webext-bridge"
import type { SugarBoxState } from "@/background/logic/state"
import type { CharObj } from "./types"

declare module "webext-bridge" {
  export interface ProtocolMap {
    bg_ping: ProtocolWithReturn<undefined, "pong">
    bg_get_state: ProtocolWithReturn<undefined, SugarBoxState>
    bg_change_char: CharObj|null
  }
}
