import { useSugarBoxState } from "../lib/state";
import SaveList from "./Home/SaveList";
import SaveSlots from "./Home/SaveSlots";

export default function Home() {
  const { user, game, char } = useSugarBoxState();

  if (game) {
    if (char) {
      return <SaveSlots />
    } else {
      return <SaveList />
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center">
      Home

      <a>U:{user?.username}</a>
    </main>
  )
}
