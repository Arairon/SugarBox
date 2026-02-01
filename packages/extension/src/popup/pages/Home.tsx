import { useSugarBoxState } from "../lib/state";

export default function Home() {
  const { user, game, char } = useSugarBoxState();

  return (
    <>
      Home

      <a>U:{user?.username}</a>
      <a>G:{game?.name}    </a>
      <a>C:{char?.name}    </a>
    </>
  )
}
