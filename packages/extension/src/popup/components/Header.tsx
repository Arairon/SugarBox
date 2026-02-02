import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { db } from "../lib/db";
import { useGameEditorState, useSugarBoxState } from "../lib/state";
import { useLiveQuery } from "dexie-react-hooks";
import { sendMessage } from "webext-bridge/popup";


function CurrentGame() {
  const { game, page, setPage } = useSugarBoxState();
  return (
    <button className="flex max-w-60 min-w-40 grow cursor-pointer items-center justify-center border-r border-l-2
border-cyan-700 px-2 transition-colors hover:border-cyan-500 dark:hover:bg-background/30" onClick={() => {
        if (page === "games") {
          setPage("home")
        } else {
          setPage("games")
        }
      }}>
      <a>
        {game?.name ?? "No game found"}
      </a>
    </button>
  )
}

function CurrentChar() {
  const { game, char, setChar, setPage } = useSugarBoxState();
  const {open: openGameEditor} = useGameEditorState();
  const chars = useLiveQuery(() => db.chars.where("gameId").equals(game?.uuid ?? -1).and(c => !c.archived).toArray(), [game]) ?? [];

  return (
    <Select
      disabled={!game}
      value={char !== null ? char.id.toString() : "-1"}
      onValueChange={async (value) => {
        if (value == "-2") {
          if (game)
            openGameEditor(game, 2)
          return;
        }
        let char = await db.chars.get(Number(value)) ?? null
        if (char && ((char?.gameId !== game?.uuid) || char?.archived)) {
          char = null;
        }
        setChar(char)
        sendMessage("bg_change_char", char, "background")
        if (game) {
          setPage("home")
        }
      }}>

      <SelectTrigger className="max-w-60 min-w-40 cursor-pointer items-center justify-between rounded-none border-y-0 border-r-2
border-l border-cyan-700 px-2 transition-colors hover:border-cyan-500 dark:hover:bg-background/30" >
        <SelectValue />
      </SelectTrigger>

      <SelectContent position="popper">
        <SelectGroup>
          <SelectLabel>Character</SelectLabel>
          <SelectItem value="-1">Any</SelectItem>
          {chars.map((char) => (
            <SelectItem key={char.uuid} value={char.id.toString()}>{char.name}</SelectItem>
          ))}
          <SelectItem value="-2">New character</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function Header() {
  return (
    <header className='flex h-10 flex-row border-b-3 border-double border-header-border bg-header px-2 font-mono'>
      <CurrentGame />
      <CurrentChar />
    </header>
  );
}

