import type { CharObj, GameObj, UserObj } from "@/shared/types";
import { create } from "zustand";

interface SugarBoxState {
  user: UserObj | null
  game: GameObj | null
  char: CharObj | null

  setUser: (user: UserObj | null) => void
  setGame: (game: GameObj | null) => void
  setChar: (char: CharObj | null) => void
}

export const useSugarBoxState = create<SugarBoxState>()((set) => ({
  user: null,
  game: null,
  char: null,

  setUser: (user) => set({ user }),
  setGame: (game) => set({ game }),
  setChar: (char) => set({ char }),
}))
