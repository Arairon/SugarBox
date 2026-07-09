import { CharacterList } from "@/popup/components/CharacterList";
import { useSugarBoxState } from "@/popup/lib/state";
import { LoaderCircleIcon } from "lucide-react";

export default function CharacterSelection() {
  const { game } = useSugarBoxState();

  if (!game) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center">
        <a className="animate-spin text-cyan-950">
          <LoaderCircleIcon size={72} />
        </a>
      </main >
    )
  }

  return (
    <main className="flex flex-1 flex-col items-stretch">
      <div className="flex flex-col items-center justify-center border-b-2 border-cyan-700 p-2 pb-1">
        Character Selection
      </div>
      <CharacterList game={game} availableAction="select" basePageSize={4} allowCreation />
    </main >
  )
}
