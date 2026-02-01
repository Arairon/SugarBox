import Home from "./Home.tsx"
import Error from "./Error.tsx"
import Debug from "./Debug.tsx"

export const pages = {
  home: Home,
  debug: Debug,
  error: Error
} as const
