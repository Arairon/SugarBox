import { useLiveQuery } from "dexie-react-hooks";
import { useGameEditorState, useSugarBoxState } from "../lib/state"
import { db } from "../lib/db";
import { createEmptyGameObject, type GameObj } from "@/shared/types";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon, EditIcon, PlusIcon, StepForwardIcon } from "lucide-react";
import { useState } from "react";


function GamesListElement({ game }: { game: GameObj }) {
  const { open: openEditor } = useGameEditorState()
  return (
    <div className="flex items-center rounded-lg px-2 py-1 transition-colors hover:bg-foreground/10">
      {game.shortname && <a className="mr-2 font-mono text-foreground/80">[{game.shortname}]</a>}
      <a className="flex-1 font-mono">{game.name}</a>
      <Button variant="outline" className="rounded-r-none" onClick={() => openEditor(game)}>
        <EditIcon />
      </Button>
      <Button variant="outline" className="rounded-l-none">
        <StepForwardIcon />
      </Button>
    </div>
  )
}

function GamesListEmptyPlaceholder() {
  return (
    <div className="flex flex-col px-4 py-2 text-left">
      <p className="self-stretch text-center text-lg font-bold">There are currently no games</p>
      <p className="self-stretch text-center text-base">
        Feel free to add more!
      </p>
    </div>
  )
}

export default function Games() {
  const pageSize = 5;
  const { open: openEditor } = useGameEditorState()
  const [searchString, setSearchString] = useState("")
  const [pageNumber, setPageNumber] = useState(0)
  const { game } = useSugarBoxState();
  const gamesCount = useLiveQuery(() => db.games.where("archived").equals(0).count(), [game]) ?? 0
  const games = useLiveQuery(
    () => db.games
      .where("archived").equals(0)
      .filter(game => !searchString || game.name.toLowerCase().includes(searchString.toLowerCase()))
      .offset(pageNumber * pageSize).limit(pageSize).toArray(), [game, pageNumber, searchString]
  ) ?? []
  const pageCount = Math.ceil(gamesCount / pageSize)

  return (
    <main className='flex flex-1 flex-col items-stretch justify-start gap-2 px-2'>
      <div className="flex items-stretch justify-center gap-4 py-2 text-lg font-bold">
        <Input className={"flex-1 " + (searchString ? " text-left" : " text-center")} placeholder="Search"
          value={searchString} onChange={(e) => setSearchString(e.target.value)} />
        <a className="flex items-center">
          Games
        </a>
        <Button className="flex-1" variant={"outline"}
          onClick={() => openEditor(createEmptyGameObject())}>
          Add <PlusIcon />
        </Button>
      </div>

      {game && <GamesListElement game={game} />}
      {games.filter(i => i.id !== game?.id).map(game => <GamesListElement game={game} key={game.id} />)}
      {games.length === 0 && <GamesListEmptyPlaceholder />}
      {(games.length === pageSize && gamesCount > pageSize) &&
        <div className="flex flex-row gap-2">
          <Button size="sm" className="flex-1"
            onClick={() => setPageNumber(Math.max(0, pageNumber - 1))} disabled={pageNumber === 0}><ArrowLeftIcon /></Button>
          <div className="flex flex-1 items-center justify-center">
            {pageNumber + 1} / {pageCount}
          </div>
          <Button size="sm" className="flex-1"
            onClick={() => setPageNumber(Math.min(pageCount - 1, pageNumber + 1))} disabled={pageNumber === pageCount - 1}><ArrowRightIcon /></Button>
        </div>
      }
    </main>
  )

}
