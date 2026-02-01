import { useSugarBoxState } from "../lib/state";

export default function Home() {
  const { user, game, char } = useSugarBoxState();

  return (
    <main className="flex flex-1 flex-col items-center justify-center">
      Home

      <a>U:{user?.username}</a>
      <a>G:{game?.name}    </a>
      <a>C:{char?.name}    </a>
    </main>
  )
}
