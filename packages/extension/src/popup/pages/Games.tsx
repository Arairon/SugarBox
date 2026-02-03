import { useLiveQuery } from "dexie-react-hooks";
import { useGameEditorState, useSugarBoxState } from "../lib/state"
import { db } from "../lib/db";
import { createEmptyGameObject, type GameObj } from "@/shared/types";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon, EditIcon, PlusIcon, StepForwardIcon } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu"
import { toast } from "sonner";


function GameLaunchButton({ game }: { game: GameObj }) {
  if (game.paths.length === 1)
    return (
      <Button variant={"outline"} className="rounded-l-none" onClick={() => {
        chrome.tabs.create({ url: game.paths[0].url })
      }}>
        <StepForwardIcon />
      </Button>
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={"outline"} className="rounded-l-none">
          <StepForwardIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {game.paths.map((path) =>
          <DropdownMenuItem onClick={() => chrome.tabs.create({ url: path.url })}>
            {path.name ? (
              <>{path.name}</>
            ) : (
              <>{path.url.length > 30 ? path.url.slice(0, 27) + "..." : path.url}</>
            )}
          </DropdownMenuItem>
        )}
        {game.paths.length === 1 && (
          <DropdownMenuItem>
            No paths found
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GamesListElement({ game, isCurrentGame }: { game: GameObj, isCurrentGame?: boolean }) {
  const { open: openEditor } = useGameEditorState()
  return (
    <div className="flex items-center rounded-lg px-2 py-1 transition-colors hover:bg-foreground/10">
      {/*{game.shortname && <a className="mr-2 font-mono text-foreground/80">[{game.shortname}]</a>}*/}
      <a className="flex-1 font-mono">{game.name}</a>
      <Button variant="outline" className="rounded-r-none" onClick={() => openEditor(game)}>
        <EditIcon />
      </Button>
      {
        isCurrentGame ? (
          <Button variant={"outline"} className="rounded-l-none" onClick={() => {
            toast("You are already here!", {duration: 1500})
          }}>
            <StepForwardIcon />
          </Button>
        ) : (
          <GameLaunchButton game={game} />
        )
      }
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
  const pageSize = 4;
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
    <main className='flex max-h-80 min-h-0 flex-1 flex-col items-stretch justify-start overflow-y-hidden px-2'>
      <div className="flex items-stretch justify-center gap-4 py-2 text-lg">
        <Input className={"flex-1 " + (searchString ? " text-left" : " text-center")} placeholder="Search"
          value={searchString} onChange={(e) => setSearchString(e.target.value)} />
        <a className="flex items-center font-bold">
          Games
        </a>
        <Button className="flex-1" variant={"outline"}
          onClick={() => openEditor(createEmptyGameObject())}>
          Add <PlusIcon />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <ScrollArea className="flex h-full flex-col items-stretch gap-1 pb-2">
          {game && <GamesListElement game={game} isCurrentGame />}
          {games.filter(i => i.id !== game?.id).map(game => <GamesListElement game={game} key={game.id} />)}
          {games.length === 0 && <GamesListEmptyPlaceholder />}
          {((games.length === pageSize || pageNumber > 0) && gamesCount > pageSize) &&
            <div className="flex flex-row gap-2">
              <Button size="sm" className="flex-1" variant={"outline"}
                onClick={() => setPageNumber(Math.max(0, pageNumber - 1))} disabled={pageNumber === 0}><ArrowLeftIcon /></Button>
              <div className="flex flex-1 items-center justify-center">
                {pageNumber + 1} / {pageCount}
              </div>
              <Button size="sm" className="flex-1" variant={"outline"}
                onClick={() => setPageNumber(Math.min(pageCount - 1, pageNumber + 1))} disabled={pageNumber === pageCount - 1}><ArrowRightIcon /></Button>
            </div>
          }
        </ScrollArea>
      </div>
    </main>
  )

}
