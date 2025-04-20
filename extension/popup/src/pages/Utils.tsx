import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectGroup,
  SelectValue, } from '@/components/ui/select'
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button, DoubleClickButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { download_db, elementCount as dbElementCount, upload_db, db, createDBBlob, clear_db } from "@/db";
import { toast } from "sonner";
import { globalCheck } from "@/logic/misc";
import { ZodError, ZodIssue } from "zod";
import { useContext, useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Check, CheckIcon, CloudDownload, CloudUpload, HardDriveDownload, RefreshCw, Trash } from "lucide-react";
import { UserContext } from "@/App";
import { formatByteSize, formatTime } from "@/lib/utils";
//import { CharObj, GameObj, SaveObj } from "@/types";
import { Save } from "@/logic/saves";
import { Game } from "@/logic/games";
import { Char } from "@/logic/chars";
import { useLiveQuery } from "dexie-react-hooks";
import { User } from "@/logic/user";
import { BaseURLSchema, config, saveConfig } from "@/config";
import { useNavigate } from "react-router";
import { downloadBlob } from "@/logic/browser";




export function Utils() {
  return (
  <ScrollArea className="w-full max-h-full px-2">
    <Table className="w-full">
      <TableHeader>
        <TableRow className="w-full">
          <TableHead className="text-center py-1">
            <div className="flex">
              <a className="grow text-lg text-center font-semibold align-middle py-1">Utilities</a>
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="hover:bg-muted/20">
          <DBactions/>
        </TableRow>
        <TableRow className="hover:bg-muted/20">
          <StorageInfo/>
        </TableRow>
        <TableRow className="hover:bg-muted/20">
          <StorageCleanup/>
        </TableRow>
        <TableRow className="hover:bg-muted/20">
          <CloudActions/>
        </TableRow>
        <TableRow className="hover:bg-muted/20">
          <BaseUrlSelector/>
        </TableRow>
      </TableBody>
    </Table>
  </ScrollArea>
  )
}

function CloudActions() {
  const {currentUser: user} = useContext(UserContext)!

  const isOnline = User.online(user);

  function handleSync() {
    toast.promise(User.sync(user, new Date(0)), {
      loading: "Logged in",
      description: "Syncing data...",
      duration: 1500,
      success: ({downloaded, uploaded})=>{
          return {
          message: "Complete",
          description: `Downloaded: ${downloaded}. Uploaded: ${uploaded}`,
          duration: 1500
        }}
    })
  }

  function handleSyncUp() {
    toast.promise(User.syncUp(user, new Date(0)), {
      loading: "Logged in",
      description: "Syncing data...",
      duration: 1500,
      success: (uploaded)=>{
          return {
          message: "Complete",
          description: `Uploaded: ${uploaded}`,
          duration: 1500
        }}
    })
  }

  function handleSyncDown() {
    toast.promise(User.syncDown(user, new Date(0)), {
      loading: "Logged in",
      description: "Syncing data...",
      duration: 1500,
      success: (downloaded)=>{
          return {
          message: "Complete",
          description: `Downloaded: ${downloaded}`,
          duration: 1500
        }}
    })
  }

  return (
  <div className="flex flex-col justify-center items-stretch gap-1">
    <div className="flex-row content-center py-2 px-4 flex items-center gap-2">
      <a className="text-left font-semibold w-20">Cloud </a>
      {isOnline ? 
      <CloudStorageInfo/>
      :
      <a className="text-gray-400 grow">[ Currently offline ]</a>
      }
    </div>
    {isOnline && 
    <div className="flex-row content-center py-2 px-4 flex items-center justify-start">
      <a className="text-left font-semibold grow">Sync</a>
      <Button variant={"outline"} className="flex-1 rounded-r-none" onClick={handleSync}><RefreshCw/></Button>
      <Button variant={"outline"} className="flex-1 rounded-none"   onClick={handleSyncUp}><CloudUpload/></Button>
      <Button variant={"outline"} className="flex-1 rounded-l-none" onClick={handleSyncDown}><CloudDownload/></Button>
    </div>
    }
  </div>
  )
}

function CloudStorageInfo() {
  const {currentUser} = useContext(UserContext)!;
  const [storageStatus, setStorageStatus] = useState({usage: 0, quota:0})

  useEffect(()=>{
    User.requestQuota(currentUser).then(setStorageStatus)
  }, [])

  return (
  <>
    <Progress className="grow" value={((storageStatus.usage ?? 0) / (storageStatus.quota ?? 1))}/>
    <a className="text-gray-300 text-xs text-center w-60 self-end">{formatByteSize(storageStatus.usage??0)} / {formatByteSize(storageStatus.quota ?? 0)}</a>
  </>
  )
}

function BaseUrlSelector() {
  const [currentUrl, setUrl] = useState(config.baseURL);
  const {currentUser, setCurrentUser} = useContext(UserContext)!;

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formElements = form.elements as typeof form.elements & {
      url: {value: string},
    }
    const url = formElements.url.value.trim();
    const {data, success, error} = BaseURLSchema.safeParse(url)
    if (!success) {
      toast.error("Invalid URL", {description: error.errors[0].message})
      return;
    }
    if (data === config.baseURL) return;
    try {
      const res = await fetch(data+"api/")
      const text = await res.text()
      if (text !== "Hello there!") {
        toast.error("Invalid URL", {description: "Server incorrectly responded to test query"})
        return
      }
    } catch {
      toast.error("Invalid URL", {description: "Server refused to respond to test query"})
      return
    }
    config.baseURL = data
    setUrl(data)
    saveConfig(config)
    User.init(currentUser).then(setCurrentUser)
    toast.success("Server URL updated")
  }

  return (
  <div className="flex-row content-center py-2 px-4 flex items-center gap-2">
    <a className="text-left font-semibold">Server</a>
    <form className="grow flex flex-row" onSubmit={handleSubmit}>
      <Input id="url" defaultValue={currentUrl} placeholder="https://sugarbox.arai.icu/" autoComplete="off" className="grow rounded-r-none"/>
      <Button variant="outline" type="submit" className="rounded-l-none"><Check/></Button>
    </form>
  </div>
  )
}


function StorageInfo() {
  const [storageEstimation, setStorageEstimation] = useState({} as StorageEstimate);
  const games = useLiveQuery(()=>db.games.toArray())
  const chars = useLiveQuery(()=>db.chars.toArray())
  const saves = useLiveQuery(()=>db.saves.toArray())

  useEffect(()=>{
    navigator.storage.estimate().then(setStorageEstimation)
  }, [])

  useEffect(()=>{
    setTimeout(()=>navigator.storage.estimate().then(setStorageEstimation), 250)
  }, [games,chars,saves])

  return (
  <div className="flex-row content-center py-2 px-4 flex items-center gap-2">
    <a className="font-semibold w-12">Storage</a>
    <Progress className="grow" value={((storageEstimation.usage ?? 0) / (storageEstimation.quota ?? 1))}/>
    <a className="text-gray-300 text-xs text-center w-70">{formatByteSize(storageEstimation.usage??0)} / {formatByteSize(storageEstimation.quota ?? 0)}</a>
  </div>
  )
}

function StorageCleanup() {
  const [cutoffDate, setCutoffDate] = useState(1)
  const {currentUser: user} = useContext(UserContext)!
  const games = useLiveQuery(() => db.games.where("archivedAt").between(1, cutoffDate).toArray(), [cutoffDate]) ?? []
  const chars = useLiveQuery(() => db.chars.where("archivedAt").between(1, cutoffDate).toArray(), [cutoffDate]) ?? []
  const saves = useLiveQuery(() => db.saves.where("archivedAt").between(1, cutoffDate).toArray(), [cutoffDate]) ?? []
  const totalCount = games.length + chars.length + saves.length

  return (
  <div className="flex-row content-center py-2 px-4 flex items-center gap-0">
    <div className="grow text-left flex flex-col flex-2 self-stretch">
      <a className="grow font-semibold">Cleanup</a>
      <a>Remove items older than:</a>
      <a className="text-gray-400 text-xs">
        {cutoffDate === 1 ? (
          <>(affects only archived items)</>
        ):(
          <>(will affect {totalCount} item{totalCount===1?'':'s'})</>
        )}
      </a>
    </div>
    <Select 
      //value={cutoffTime.toString()}
      onValueChange={async (value: any)=>{
        setCutoffDate(Date.now() - Number(value))
      }}>
      <SelectTrigger className="rounded-r-none w-30">
        <SelectValue placeholder="Select"/>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={"0"}>All</SelectItem>
          <SelectItem value={"31104000000"}>1 year</SelectItem>
          <SelectItem value={"15552000000"}>6 months</SelectItem>
          <SelectItem value={"7776000000"}>3 months</SelectItem>
          <SelectItem value={"2592000000"}>1 month</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
    <DoubleClickButton variant={"outline"} disabled={cutoffDate===1} className="rounded-l-none" onAccept={async ()=>{
      db.games.bulkDelete(games!.map(i=>i.id))
      db.chars.bulkDelete(chars!.map(i=>i.id))
      db.saves.bulkDelete(saves!.map(i=>i.id))
      toast.success(`Deleted ${games!.length} game${games!.length===1?'':'s'}, ${chars!.length} character${chars!.length===1?'':'s'} and ${saves!.length} save${saves!.length===1?'':'s'}`)
      User.sync(user, new Date(0))
    }}><Trash/></DoubleClickButton>
  </div>
  )
}


function DBactions() {
  const {currentUser: user} = useContext(UserContext)!

  async function handleDBImport(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formElements = form.elements as typeof form.elements & [
      {files: File[]}
    ]
    const file = formElements[0].files[0]
    if (!file.size) {
      toast.error("Please select a file", {duration:1000})
      return
    }

    if (await dbElementCount()) await download_db()
    try {
      await upload_db(file)
    } catch {
      toast.error("Import failed")
      return
    }

    const errors = await globalCheck()
    const errCount = Object.values(errors).map(i=>i.length).reduce((a,b)=>a+b, 0)
    if (errCount) {
      toast.error(`Found ${errCount} errors in the imported DB`, {
        description: "You can check them separately",
        duration: 2500
      })
    } else {
      toast.success("Successfully imported", {duration: 1000})
    }
    if (User.online(user)) User.sync(user, new Date(0))
  }

  async function handleDelete() {
    await download_db()
    await clear_db()
    toast.success("Databse deleted", {description: "A backup was downloaded"})
  }

  return (
  <div className="flex-row content-center py-2 px-4 flex items-center">
    <a className="grow text-left font-semibold">Database </a>
    <DBCheckDialog/>
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex-1 rounded-none" aria-label="Import to database"><CloudUpload/></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Database import</DialogTitle>
          <DialogDescription>A copy of the current DB will automatically be downloaded before import (unless it's empty)</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleDBImport}>
        <div className="flex flex-col gap-4 py-4 justify-center">
          <Input type="file"/>
          <Button type="submit" className="grow">Submit</Button>
        </div>
        </form>
      </DialogContent>
    </Dialog>
    <Button variant="outline" className="flex-1 rounded-none" onClick={download_db} aria-label="Download database export"><HardDriveDownload/></Button>
    <DoubleClickButton variant="outline" className="flex-1 rounded-l-none" onAccept={handleDelete} aria-label="Delete the database"><Trash/></DoubleClickButton>
  </div>
  )
}

function DBCheckDialog() {
  const [report, setReport] = useState({});
  const navigate = useNavigate()

  useEffect(()=>{
    globalCheck().then(setReport)
  }, [])

  function formatIssue(err: ZodIssue) {
    return <>{err.path}: {err.message}</>
  }

  async function autoFix() {
    const dbBackup = await createDBBlob()
    let gamesFixed=0, gamesDeleted=0;
    const games = await db.games.toArray()
    for (let rawgame of games) {
      if (Game.validate(rawgame).success) continue
      const game = Game.autofix(rawgame)
      if (Game.validate(game).success){
        db.games.put(game)
        gamesFixed++;
      }
      else{
        db.games.delete(game.id)
        gamesDeleted++;
      }
    } 
    let charsFixed=0, charsDeleted=0;
    const chars = await db.chars.toArray()
    for (let rawchar of chars) {
      if ((await Char.validateDB(rawchar)).success) continue
      const char = Char.autofix(rawchar)
      if ((await Char.validateDB(char)).success){
        db.chars.put(char)
        charsFixed++;
      }
      else{
        db.chars.delete(char.id)
        charsDeleted++;
      }
    } 
    let savesFixed=0, savesDeleted=0;
    const saves = await db.saves.toArray()
    for (let rawsave of saves) {
      if ((await Save.validateDB(rawsave)).success) continue
      const save = Save.autofix(rawsave)
      if ((await Save.validateDB(save)).success){
        db.saves.put(save)
        savesFixed++;
      }
      else{
        db.saves.delete(save.id)
        savesDeleted++;
      }
    }
    if (gamesFixed + gamesDeleted + charsFixed + charsDeleted + savesFixed + savesDeleted) {
      downloadBlob(dbBackup, `SugarBox-DB-export-${formatTime(Date.now(), true)}.json`)
      toast.success(`Autofix complete.`, {description:
        <div className="flex-col">
          <a className="block">Games: {gamesFixed} fixed. {gamesDeleted} deleted.</a>
          <a className="block">Chars: {charsFixed} fixed. {charsDeleted} deleted.</a>
          <a className="block">Saves: {savesFixed} fixed. {savesDeleted} deleted.</a>
        </div>
      })
      navigate("/utils")
    } else {
      toast.success("Nothing to fix")
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex-1 rounded-r-none"><CheckIcon/></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Database status</DialogTitle>
          <DialogDescription>
            <a className="text-gray-400 text-xs">
              (Auto fix might lead to loss of data. A backup of the db will automatically be downloaded)
            </a>
          </DialogDescription>
          <DialogDescription>
            <DoubleClickButton variant={"outline"}
            className="w-80 text-white dark:text-white"
            confirmClassName="dark:border-orange-400 dark:bg-orange-950 dark:hover:border-orange-600 dark:hover:bg-orange-950"
            onAccept={autoFix}>
              Auto fix
            </DoubleClickButton>
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-50">
        <ol className="text-pretty text-base list-inside">
          {Object.entries(report as {[key: string]: [any, ZodError][]}).map(([type, errors])=>(
            <>
            <li className="font-bold">{type} [{errors.length}]</li>
            {errors.length ? (
              <>
              {errors.map(([obj, err])=>(
                <>
                <li className="pl-2">{obj?.name ?? "unnamed object"} ({obj?.id ?? "-1"}): </li>
                {err.issues.map((issue)=>(
                  <li className="pl-4">{formatIssue(issue)}</li>
                ))}
                </>
              ))}
              </>
            ) : (
              <>
              <li>No errors found</li>
              </>
            )}
            </>
          ))}
        </ol>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// function dialogToast(text: string, description: string, dialogContent: ReactNode, contentTitle="", buttonText="Show") {
//   toast(text, {
//     description,
//     action: <>
//     <Dialog>
//       <DialogTrigger asChild>
//         <Button>{buttonText}</Button>
//       </DialogTrigger>
//     <DialogContent>
//       {contentTitle&&
//       <DialogHeader>
//         <DialogTitle>{contentTitle}</DialogTitle>
//       </DialogHeader>}
//       <ScrollArea className="max-h-50">
//       {dialogContent}
//       </ScrollArea>
//     </DialogContent>
//     </Dialog>
//     </>
//   })
// }
/*
<ol className="text-pretty text-base list-inside">
  {Object.entries(report).map(([type, errors])=>(
    <>
    <li className="font-bold">{type}</li>
    {errors.map(([obj, err])=>(
      <>
      <li className="pl-2">{obj?.name ?? "unnamed object"} ({obj?.id ?? "-1"}): </li>
      {err.issues.map((issue)=>(
        <li className="pl-4">{formatIssue(issue)}</li>
      ))}
      </>
    ))}
    </>
  ))}
</ol>
*/

/*
const [report, setReport] = useState<{ [key: string]: [any, ZodError][] }>({})
  function formatIssue(err: ZodIssue) {
    return <>{err.path}: {err.message}</>
  }
<Dialog>
      <DialogTrigger asChild>
        <Button onClick={()=>globalCheck().then(setReport)}>Global Check</Button>
      </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Quick start guide</DialogTitle>
      </DialogHeader>
      <ScrollArea className="max-h-50">
      <ol className="text-pretty text-base list-inside">
        {Object.entries(report).map(([type, errors])=>(
          <>
          <li className="font-bold">{type}</li>
          {errors.map(([obj, err])=>(
            <>
            <li className="pl-2">{obj?.name ?? "unnamed object"} ({obj?.id ?? "-1"}): </li>
            {err.issues.map((issue)=>(
              <li className="pl-4">{formatIssue(issue)}</li>
            ))}
            </>
          ))}
          </>
        ))}
      </ol>
      </ScrollArea>
    </DialogContent>
    </Dialog>
*/