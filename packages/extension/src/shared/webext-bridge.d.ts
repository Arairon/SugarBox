import { ProtocolWithReturn } from "webext-bridge"
import type { SugarBoxState } from "@/background/logic/state"
import type { CharObj, GameObj, SaveObj, UserObj } from "./types"

type ReturnObject<T = unknown> = ({ ok: true } & T) | { ok: false, message: string }

declare module "webext-bridge" {
  export interface ProtocolMap {
    bg_ping: ProtocolWithReturn<undefined, "pong">
    bg_get_state: ProtocolWithReturn<undefined, SugarBoxState>
    bg_change_char: CharObj | null
    bg_is_page_a_game: ProtocolWithReturn<undefined, boolean>
    bg_game_edit: ProtocolWithReturn<GameObj, ReturnObject<{ game: GameObj }>>
    bg_game_archive: ProtocolWithReturn<GameObj, ReturnObject<{ affectedChars: number, affectedSaves: number }>>
    bg_char_edit: ProtocolWithReturn<CharObj, ReturnObject<{ char: CharObj }>>
    bg_char_archive: ProtocolWithReturn<CharObj, ReturnObject<{ affectedSaves: number }>>
    bg_save_edit: ProtocolWithReturn<SaveObj, ReturnObject<{ save: SaveObj }>>
    bg_save_archive: ProtocolWithReturn<SaveObj, ReturnObject>
    bg_save_new: ProtocolWithReturn<undefined | number, ReturnObject<{ save: SaveObj }>>
    bg_save_load: ProtocolWithReturn<SaveObj, ReturnObject>
    bg_user_refresh: ProtocolWithReturn<undefined, UserObj>
    bg_user_refresh_force: ProtocolWithReturn<undefined, UserObj>
    bg_user_register: ProtocolWithReturn<{ email: string, username: string, password: string }, ReturnObject<{ user: UserObj }>>
    bg_user_login: ProtocolWithReturn<{ username: string, password: string }, ReturnObject<{ user: UserObj }>>
    bg_user_logout: ProtocolWithReturn<undefined, ReturnObject>,
    bg_user_online_toggle: undefined
    bg_sync_now: ProtocolWithReturn<undefined, { ok: boolean, message: string, downloaded: number, uploaded: number }>
    bg_sync: ProtocolWithReturn<undefined, { ok: boolean, message: string, downloaded: number, uploaded: number }>
  }
}
