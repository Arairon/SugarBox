import Home from "./Home.tsx"
import Error from "./Error.tsx"
import Debug from "./Debug.tsx"
import Games from "./Games.tsx"
import GameEditor from "./GameEditor.tsx"

export const pages = {
  home: Home,
  debug: Debug,
  error: Error,
  games: Games,
  gameEditor: GameEditor,
} as const
