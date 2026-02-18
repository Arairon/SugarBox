import { createEmptyUserObject, type CharObj, type GameObj, type UserObj } from "@/shared/types";
import { create } from "zustand";
import { nonActivityPages, pages } from "../pages/pagesIndex";
import { sendMessage } from "webext-bridge/popup";
import { getCurrentBrowserTab } from "@/shared/browser";

type Page = (keyof typeof pages) | (keyof typeof nonActivityPages)

interface SugarBoxState {
  page: Page
  user: UserObj
  game: GameObj | null
  char: CharObj | null

  setPage: (page: Page) => void
  setUser: (user: UserObj) => void
  setGame: (game: GameObj | null) => void
  setChar: (char: CharObj | null) => void
  set: (user: UserObj, game: GameObj | null, char: CharObj | null) => void
}

export const useSugarBoxState = create<SugarBoxState>()((set) => ({
  page: "home",
  user: createEmptyUserObject(),
  game: null,
  char: null,
  detectedGameName: "",

  setPage: (page) => set({ page }),
  setUser: (user) => set({ user }),
  setGame: (game) => set({ game }),
  setChar: (char) => set({ char }),
  set: (user, game, char) => set({ user, game, char })
}))

export async function updateCurrentTabInBackground() {
  const tab = await getCurrentBrowserTab();
  if (tab.id)
    return sendMessage("bg_update_current_page", tab.id);
}

export async function loadBackgroundState() {
  const state = await sendMessage("bg_get_state", undefined, "background")
  useSugarBoxState.getState().set(state.user, state.game, state.char)
  const editorState = useSugarBoxState.getState()
  if (editorState.game && editorState.game.id === state.game?.id) {
    editorState.setGame(state.game)
  }
  return state
}

interface GameEditorState {
  game: GameObj | null
  page: number
  detectedGameName: string

  setGame: (game: GameObj | null) => void,
  setPage: (page: number) => void,
  setDetectedGameName: (name: string) => void
  open: (game: GameObj, page?: number) => void,
}

export const useGameEditorState = create<GameEditorState>()((set) => ({
  game: null,
  page: 1,
  detectedGameName: "",
  setGame: (game) => set({ game }),
  setPage: (page) => set({ page }),
  setDetectedGameName: (name) => set({ detectedGameName: name }),
  open: (game, page = 1) => {
    useSugarBoxState.getState().setPage("gameEditor")
    set({ game, page })
  }
}))
