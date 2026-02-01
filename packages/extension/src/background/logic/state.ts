import type { UserObj, GameObj, CharObj } from "@/shared/types"
import {onMessage} from "webext-bridge/background"

export type SugarBoxState = {
  user: UserObj | null
  game: GameObj | null
  char: CharObj | null
  tabId: number
}

export const state: SugarBoxState = {
  user: null,
  game: null,
  char: null,
  tabId: 0
}

onMessage("bg_get_state", ()=>state)
