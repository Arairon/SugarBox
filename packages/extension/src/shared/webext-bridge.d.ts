import { ProtocolWithReturn } from "webext-bridge"
import type { SugarBoxState } from "@/background/logic/state"
import type { CharObj, GameObj } from "./types"

declare module "webext-bridge" {
  export interface ProtocolMap {
    bg_ping: ProtocolWithReturn<undefined, "pong">
    bg_get_state: ProtocolWithReturn<undefined, SugarBoxState>
    bg_change_char: CharObj | null
    bg_is_page_a_game: ProtocolWithReturn<undefined, boolean>
    bg_game_edit: ProtocolWithReturn<GameObj, { ok: true, game: GameObj } | { ok: false, message: string }>
    bg_game_archive: ProtocolWithReturn<GameObj, { ok: true, affectedChars: number, affectedSaves: number } | { ok: false, message: string }>
    bg_char_edit: ProtocolWithReturn<CharObj, { ok: true, char: CharObj } | { ok: false, message: string }>
    bg_char_archive: ProtocolWithReturn<CharObj, { ok: true, affectedSaves: number } | { ok: false, message: string }>
  }
}
