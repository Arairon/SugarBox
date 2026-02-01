import Home from "./Home.tsx"
import Error from "./Error.tsx"
import Debug from "./Debug.tsx"
import Games from "./Games.tsx"

export const pages = {
  home: Home,
  debug: Debug,
  error: Error,
  games: Games,
} as const
