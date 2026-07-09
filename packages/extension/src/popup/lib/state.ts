import {
  createEmptyUserObject,
  type CharObj,
  type GameObj,
  type UserObj,
} from "@/shared/types";
import { create } from "zustand";
import { nonActivityPages, pages } from "../pages/pagesIndex";
import { sendMessage } from "webext-bridge/popup";
import { getCurrentBrowserTab } from "@/shared/browser";

type Page = keyof typeof pages | keyof typeof nonActivityPages;

interface SugarBoxState {
  page: Page;
  user: UserObj;
  game: GameObj | null;
  char: CharObj | null;
  detectedGameName: string | null;

  setPage: (page: Page) => void;
  setUser: (user: UserObj) => void;
  setGame: (game: GameObj | null) => void;
  setChar: (char: CharObj | null) => void;
  setDetectedGameName: (name: string | null) => void;
  set: (
    user: UserObj,
    game: GameObj | null,
    char: CharObj | null,
    detectedGameName: string | null,
  ) => void;
}

export const useSugarBoxState = create<SugarBoxState>()((set) => ({
  page: "home",
  user: createEmptyUserObject(),
  game: null,
  char: null,
  detectedGameName: null,

  setPage: (page) => set({ page }),
  setUser: (user) => set({ user }),
  setGame: (game) => set({ game }),
  setChar: (char) => set({ char }),
  setDetectedGameName: (name) => set({ detectedGameName: name }),
  set: (user, game, char, detectedGameName) =>
    set({ user, game, char, detectedGameName }),
}));

export async function updateCurrentTabInBackground() {
  const tab = await getCurrentBrowserTab();
  if (tab.id) return sendMessage("bg_update_current_page", tab.id);
}

export async function loadBackgroundState() {
  const state = await sendMessage("bg_get_state", undefined, "background");
  useSugarBoxState.getState().set(state.user, state.game, state.char, null);
  if (!state.game) {
    const detectedGameName = await sendMessage(
      "bg_get_game_name",
      undefined,
      "background",
    );
    if (detectedGameName)
      useSugarBoxState.getState().setDetectedGameName(detectedGameName);
    console.log("Detected game name:", detectedGameName);
  }
  const editorState = useSugarBoxState.getState();
  if (editorState.game && editorState.game.id === state.game?.id) {
    editorState.setGame(state.game);
  }
  return state;
}

interface GameEditorState {
  game: GameObj | null;
  page: number;

  setGame: (game: GameObj | null) => void;
  setPage: (page: number) => void;
  open: (game: GameObj, opts?: { page?: number }) => void;
}

export const useGameEditorState = create<GameEditorState>()((set) => ({
  game: null,
  page: 1,

  setGame: (game) => set({ game }),
  setPage: (page) => set({ page }),
  open: (game, opts) => {
    useSugarBoxState.getState().setPage("gameEditor");
    set({
      game,
      page: opts?.page ?? 1,
    });
  },
}));
