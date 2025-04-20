import { CharContext, GameContext, UserContext } from "@/App";
import { db } from "@/db";
import { CharObj, GameObj, SaveObj } from "@/types";
import { useLiveQuery } from "dexie-react-hooks";
import { useContext, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button, DoubleClickButton } from "@/components/ui/button";
import { ArchiveRestore, ChevronDown, Download, FileDownIcon, Globe, HardDrive, Plus, Trash, Upload } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { Save, pageSaveSchema, requestLoad, requestSave } from "@/logic/saves";
import { toast } from "sonner";
import { Char } from "@/logic/chars";
import { Switch } from "@/components/ui/switch";

function SavesPage() {
  const {selectedChar} = useContext(CharContext)!;
  const {selectedGame} = useContext(GameContext)!;

  if (!selectedGame) return (<>Something went wrong. No game is selected and yet you are here...</>)
  if (selectedChar && selectedChar.gameId !== selectedGame.uuid) return <WarningPage/>
  if (!selectedChar) return (<TotalList game={selectedGame}/>)
  return (<Slots game={selectedGame}/>)
}

function WarningPage() {
  return (
  <div className="flex flex-col justify-center content-center items-center grow gap-3 w-90 ">
    <div className="p-2 flex flex-col justify-center content-center items-center border-1 border-cyan-600 rounded-lg bg-slate-950">
      <p className="max-w-60">
        <h1 className="text-xl font-bold text-red-500">Warning!</h1>
      </p>
      <p className="text-base text-pretty">
        Switching games in an actual game tab may lead to <a className="font-extrabold">a lot</a> of problems!<br/>
        You should use this feature in your browser's "new&nbsp;tab" or somewhere like that to avoid messing up your saves.
      </p>
      <p className="text-lg">
        Once again <a className="font-bold">please</a> be careful!
      </p>
    </div>
  </div>
  )
}

function TotalList({game}: {game: GameObj}) {
  const [includeArchived, setIncludeArchived] = useState(false)
  const saves = useLiveQuery(()=>db.saves.where("gameId").equals(game.uuid).and(g=>includeArchived || !g.archived).reverse().sortBy("createdAt"), [includeArchived]) ?? []
  const chars = useLiveQuery(()=>db.chars.where("gameId").equals(game.uuid).and(c=>includeArchived || !c.archived).toArray(), [includeArchived]) ?? []

  return (
    <ScrollArea className="w-full max-h-full max-w-full flex flex-col justify-center items-center">
    <Table className="w-full max-w-full">
      <TableHeader>
        <TableRow>
          <TableHead className="text-center">
            <div className="flex flex-row justify-center items-center px-4">
              <div className="flex-1 font-normal text-gray-300 flex flex-row items-center gap-2 py-1"
              onClick={()=>setIncludeArchived(!includeArchived)}
              >Archived <Switch checked={includeArchived}/></div>
              <div className="grow py-1">All saves</div>
              <div className="flex-1 py-1"></div>
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {saves.map((save) => (
          <TotalListRow save={save} chars={chars}/>
        ))}
        {!saves.length ? <TotalListEmptyNote/> : (
          <TableRow key={"total-saves-note"}>
            <TableCell className="py-1 px-0">
              <div className="flex flex-col justify-center align-middle items-center gap-2 px-4 py-2 text-gray-400">
                You need to select a character to be able to save
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    </ScrollArea>
  )
}

function TotalListEmptyNote() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col text-center py-2 px-4 gap-2">
          <p className="text-center self-stretch text-lg font-bold">There are currently no saves</p>
          <p className="text-pretty self-stretch text-base">
            Please select a character in the top-right corner<br/>
            (you can create one when editing a game)
          </p>
          <p className="self-stretch">You cannot save without a character selected<br/>for organizational purposes</p>
        </div>
      </TableCell>
    </TableRow>
  )
}

function TotalListRow({save, chars}: {save: SaveObj, chars: CharObj[]}) {
  const [expanded, setExpanded] = useState(false);
  const saveTime = formatTime(save.createdAt).split(" ")
  const char = (chars.find((char)=>char.uuid===save.charId) ?? {name: "Unk #"+save.charId, archived: 0})
  const charName = (char.archived ? "*" : "") + char.name
  const { currentUser: user } = useContext(UserContext)!;

  async function handleLoad() {
    requestLoad(save)
    .then(()=>toast.success("Save loaded", {duration:1000}))
    .catch(()=>toast.success("Load failed", {description: "Try reloading the page", duration:1500}))
  }

  async function handleDelete() {
    Save.archive(save)
    Save.commit(save, user)
    //setUpdateNeeded(Date.now()%100)
    toast.success("Save archived", {position: "bottom-left", duration:1500, 
      cancel: {
        label: 'Undo',
        onClick: ()=>{
          Save.unarchive(save)
          Save.commit(save, user)
        }}
      })
  }

  function handleRestore() {
    Save.unarchive(save)
    Save.commit(save, user)
  }

  return (
    <>
    <TableRow key={save.id}>
      <TableCell className="py-1 px-0">
        <div className="flex flex-row justify-center align-middle items-center gap-2 px-4">
          <a className={(!save.archived ? "w-10 block truncate" : "w-10 text-gray-400 block truncate")}>
            {charName}
          </a>
          <Button variant="ghost" onClick={()=>{setExpanded(!expanded)}}
          className="font-normal text-pretty flex flex-row justify-start grow align-middle items-center gap-2">
            <ChevronDown className={(expanded ? "rotate-180" : "")} size={14}/>
            <div className="text-left grow w-24">
              <a className="block truncate max-w-full">{save.name}</a>
              <a className="block truncate max-w-full text-gray-400">{save.description}</a>
            </div>
            <div>
              <a>{saveTime[0]}</a><br/>
              <a>{saveTime[1]}</a>
            </div>
          </Button>
          <div className="self-end">
            <Button variant="outline" className="has-[>svg]:px-3 rounded-r-none" onClick={handleLoad}><Upload/></Button>
            {!save.archived ? (
              <DoubleClickButton variant="outline" className="has-[>svg]:px-2 rounded-l-none" onAccept={handleDelete}><Trash/></DoubleClickButton>
            ) : (
              <DoubleClickButton variant="outline" className="has-[>svg]:px-2 rounded-l-none"
              confirmClassName="dark:border-green-700 dark:bg-green-950 dark:hover:border-green-500 dark:hover:bg-green-950"
              onAccept={handleRestore}><ArchiveRestore/></DoubleClickButton>
            )}
          </div>
        </div> 
      </TableCell>
    </TableRow>
    {expanded &&
      <SaveRowDetails save={save} charName={charName}/>
    }
    </>
  )
}

function SaveRowDetails({save, charName=null}: {save: SaveObj, charName?:string|null}) {
  //const saveTime = formatTime(save.createdAt)

  let saveStatusIcon;
  let saveStatusDescription;
  if (save.remoteId) {
    saveStatusIcon=(<Globe/>)
    saveStatusDescription = "Saved remotely"
  } else {
    saveStatusIcon=(<HardDrive/>)
    saveStatusDescription = "Local only"
  }

  return (
    <TableRow key={save.id + "-details"}>
      <TableCell className="text-left">
        <div className="px-4">
          <div className="flex flex-row items-stretch">
            <div className="grow">
              <p>{save.name}</p>
              <p className="text-pretty text-gray-300">{save.description}</p>
              {charName && <p>Character: {charName}</p>}
            </div>
            <DoubleClickButton variant={"outline"} confirmClassName="dark:border-green-700 dark:bg-green-950 dark:hover:border-green-500 dark:hover:bg-green-950"
            onAccept={()=>{
              Save.exportDataToFile(save).then(()=>{
                toast.success("File downloaded", {duration: 1000})
              })
            }}><FileDownIcon/></DoubleClickButton>
          </div>
        <Separator className="my-1"/>
        <p className="text-gray-400 flex flex-row items-center justify-start">
          <p className="grow">
            <a className="block" onClick={()=>{
              navigator.clipboard.writeText(save.uuid)
              toast("Copied", {duration:1000})
            }}>UUID: {save.uuid}</a>
            <a className="block" onClick={()=>{
              navigator.clipboard.writeText(save.hash)
              toast("Copied", {duration:1000})
            }}>Hash: {save.hash}</a>
            <a className="block">Game version: {save.gameVersion ? (save.gameVersion) : (<>unknown</>)}</a>
          </p>
          <p className="mr-4">
            <TooltipProvider delayDuration={300} disableHoverableContent={true}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {saveStatusIcon}
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-1">
                  <p>{saveStatusDescription}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </p>
        </p>
        </div>
      </TableCell>
    </TableRow>
  )
}


function Slots({game}: {game: GameObj}) {
  const { currentUser: user } = useContext(UserContext)!;
  const { selectedChar } = useContext(CharContext)!;
  const [updateNeeded, setUpdateNeeded] = useState(0)
  if (!selectedChar) return;
  const rawsaves = useLiveQuery(()=>db.saves.where("uuid").anyOf(selectedChar.slots).and((save)=>!save.archived).toArray(), [selectedChar, updateNeeded]) ?? []
  const saves: (SaveObj|null)[] = []
  for (let saveId of selectedChar.slots) saves.push(rawsaves.find((obj)=>obj.uuid === saveId) ?? null)
  const latestSave = saves.reduce((prev, current) => ((prev?.createdAt??0) > (current?.createdAt??0)) ? prev : current, null)

  async function handleNewSave() {
    if (!selectedChar) return
    let rawSaveData;
    try {
      rawSaveData = await requestSave();
    } catch (err) {
      console.error("Failed to save: "+err)
      toast.error("Unable to contact page", {description: "Try reloading the page", duration:1500})
      return
    }
    if (!rawSaveData) {
      toast.error("Page did not return a valid response", {description: "Are you sure this tab is a valid game?"})
      return
    }
    if (!rawSaveData.data) {
      toast.error("Unable to save here", {description: "Game refused to provide save data"})
      return
    }
    const saveData = pageSaveSchema.safeParse(rawSaveData)
    if (saveData.error) {
      toast.error("Invalid save", {description: saveData.error.message})
      return;
    }
    const save = Save.createSaveFromPageData(saveData.data, selectedChar.uuid, game.uuid)
    Save.addNew(save, user).then(()=>{
      selectedChar.slots.push(save.uuid)
      Char.commit(selectedChar, user)
      setUpdateNeeded(Date.now()%100)
      toast.success("Saved successfully", {position: "bottom-left", duration:1500})
    })
  }

  async function handleNewSlot() {
    if (!selectedChar) return
    selectedChar.slots.push("")
    Char.commit(selectedChar, user)
    setUpdateNeeded(Date.now()%100)
  }

  return (
    <ScrollArea className="w-full max-h-full">
    <Table className="w-full">
      {/* <TableHeader>
        <TableRow>
          <TableHead className="text-center">Slots</TableHead>
        </TableRow>
      </TableHeader> */}
      <TableBody>
        {saves.map((save, index) => (
          <>
          {save ? (
            <SaveSlot game={game} save={save} char={selectedChar} index={index} setUpdateNeeded={setUpdateNeeded} isLatest={save.id === latestSave?.id}/>
          ) : (
            <SaveSlotEmpty game={game} char={selectedChar} index={index} setUpdateNeeded={setUpdateNeeded}/>
          )}
          </>
        ))}
        {saves.length === 0 && <SaveSlotsEmptyNote/>}
        <TableRow key="new">
          <TableCell className="py-1 px-0">
            <div className="flex flex-row justify-center align-middle items-center gap-2 pr-4 pl-2">
              <a className="w-4">N</a>
              <Button variant="ghost" onClick={handleNewSlot}
              className="font-normal flex flex-row justify-start grow align-middle items-center gap-2 has-[>svg]:px-2 px-2">
                <div className="text-center grow">
                  <a>New save slot</a>
                </div>
              </Button>
              <div className="self-end w-30 flex">
                <Button variant="outline" className="has-[>svg]:px-12 grow" onClick={handleNewSave}><Plus/></Button>
              </div>
            </div> 
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    </ScrollArea>
  )
}
function SaveSlotsEmptyNote() {
  return (
    <TableRow key="emptyNote">
      <TableCell className="py-1 px-0">
        <div className="flex flex-col justify-center align-middle items-center gap-2 pr-4 pl-2">
          <h1 className="text-lg font-semibold">No slots... <i>yet</i></h1>
          <a>Feel free to create as many as you would like</a>
        </div> 
      </TableCell>
    </TableRow>
  )
}

function SaveSlot({game, save, char, index, setUpdateNeeded, isLatest}: {game: GameObj, save: SaveObj, char: CharObj, index: number, isLatest:boolean, setUpdateNeeded: React.Dispatch<React.SetStateAction<number>>}) {
  const { currentUser: user } = useContext(UserContext)!;
  const [expanded, setExpanded] = useState(false);
  const saveTime = formatTime(save.createdAt).split(" ")

  async function handleSave() {
    let rawSaveData;
    try {
      rawSaveData = await requestSave();
    } catch (err) {
      console.error("Failed to save: "+err)
      toast.error("Unable to contact page", {description: "Try reloading the page", duration:1500})
      return
    }
    if (!rawSaveData) {
      toast.error("Page did not return a valid response", {description: "Are you sure this tab is a valid game?"})
      return
    }
    if (!rawSaveData.data) {
      toast.error("Unable to save here", {description: "Game refused to provide save data"})
      return
    }
    const saveData = pageSaveSchema.safeParse(rawSaveData)
    if (saveData.error) {
      toast.error("Invalid save", {description: saveData.error.message})
      return;
    }
    const save = Save.createSaveFromPageData(saveData.data, char.uuid, game.uuid)
    Save.addNew(save, user).then(()=>{
      db.saves.get({uuid: char.slots[index]}).then((oldsave)=>{
        if (!oldsave) return;
        Save.archive(oldsave)
        Save.commit(oldsave, user)
      })
      char.slots[index] = save.uuid
      Char.commit(char, user)
      setUpdateNeeded(Date.now()%100)
      toast.success("Saved successfully", {position: "bottom-left", duration:1500})
    })
  }

  async function handleLoad() {
    requestLoad(save)
    .then(()=>toast.success("Save loaded", {duration:1000}))
    .catch(()=>toast.success("Load failed", {description: "Try reloading the page", duration:1500}))
  }

  async function handleDelete() {
    Save.archive(save)
    Save.commit(save, user)
    char.slots[index]=""
    Char.commit(char, user)
    setUpdateNeeded(Date.now()%100)
    toast.success("Save archived", {position: "bottom-left", duration:1500, 
      cancel: {
        label: 'Undo',
        onClick: ()=>{
          Save.unarchive(save)
          Save.commit(save, user)
          char.slots[index]=save.uuid
          Char.commit(char, user)
          setUpdateNeeded(Date.now()%100)
        }}
      })
  }

  let recentColor="text-gray-300";
  if (isLatest) recentColor = "text-cyan-300"
  else if (Date.now() - save.createdAt < 3600000) recentColor = "text-cyan-500"

  return (
    <>
    <TableRow key={index}>
      <TableCell className="py-1 px-0">
        <div className="flex flex-row justify-center align-middle items-center gap-2 pr-4 pl-2">
          <a className="w-4">{index+1}</a>
          <Button variant="ghost" onClick={()=>{setExpanded(!expanded)}}
          className="font-normal flex flex-row justify-start grow align-middle items-center gap-2 has-[>svg]:px-2 px-2 text-pretty">
            <ChevronDown className={(expanded ? "rotate-180" : "")} size={14}/>
            <div className="text-left grow w-24">
              <a className="block truncate max-w-full">{save.name}</a>
              <a className="block truncate max-w-full text-gray-400">{save.description}</a>
            </div>
            <div className={recentColor}>
              <a>{saveTime[0]}</a><br/>
              <a>{saveTime[1]}</a>
            </div>
          </Button>
          <div className="self-end w-30 flex flex-row">
            <Button variant="outline" className="has-[>svg]:px-3 rounded-r-none flex-2" onClick={handleSave}><Download/></Button>
            <Button variant="outline" className="has-[>svg]:px-3 rounded-none flex-2" onClick={handleLoad}><Upload/></Button>
            <DoubleClickButton
              variant="outline"
              onAccept={handleDelete}
              className="has-[>svg]:px-2 rounded-l-none flex-1"
            ><Trash/></DoubleClickButton>
          </div>
        </div> 
      </TableCell>
    </TableRow>
    {expanded &&
      <SaveRowDetails save={save}/>
    }
    </>
  )
}

function SaveSlotEmpty({game, char, index, setUpdateNeeded}: {game: GameObj, char: CharObj, index: number, setUpdateNeeded: React.Dispatch<React.SetStateAction<number>>}) {
  const { currentUser: user } = useContext(UserContext)!;
  async function handleSave() {
    let rawSaveData;
    try {
      rawSaveData = await requestSave();
    } catch (err) {
      console.error("Failed to save: "+err)
      toast.error("Unable to contact page", {description: "Try reloading the page", duration:1500})
      return
    }
  
    if (!rawSaveData) {
      toast.error("Page did not return a valid response", {description: "Are you sure this tab is a valid game?"})
      return
    }
    if (!rawSaveData.data) {
      toast.error("Unable to save here", {description: "Game refused to provide save data"})
      return
    }
    const saveData = pageSaveSchema.safeParse(rawSaveData)
    if (saveData.error) {
      toast.error("Invalid save", {description: saveData.error.message})
      return;
    }
    const save = Save.createSaveFromPageData(saveData.data, char.uuid, game.uuid)
    Save.addNew(save, user).then(()=>{
      char.slots[index] = save.uuid
      Char.commit(char, user)
      setUpdateNeeded(Date.now()%100)
      toast.success("Saved successfully", {position: "bottom-left", duration:1500})
    })
  }

  async function handleDelete(index:number) {
    char.slots.splice(index, 1)
    Char.commit(char, user)
    setUpdateNeeded(Date.now()%100)
  }

  return (
    <>
    <TableRow key={index}>
      <TableCell className="py-1 px-0">
        <div className="flex flex-row justify-center align-middle items-center gap-2 pr-4 pl-2">
          <a className="w-4">{index+1}</a>
          <div className="font-normal flex flex-row justify-start grow align-middle items-center gap-2 has-[>svg]:px-2 px-2 text-center">
            <a className="text-gray-500 grow">[ Empty slot ]</a>
          </div>
          <div className="self-end w-30 flex flex-row">
            <Button variant="outline" className="flex-4 py-1 rounded-r-none" onClick={handleSave}><Download/></Button>
            <DoubleClickButton variant="outline" className="has-[>svg]:px-2 py-1 rounded-l-none flex-1" onAccept={()=>handleDelete(index)}><Trash/></DoubleClickButton>
          </div>
        </div> 
      </TableCell>
    </TableRow>
    </>
  )
}

export { SavesPage }