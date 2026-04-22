import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { loadBackgroundState, useSugarBoxState } from "../lib/state";
import { getConfig, getQuota, requestSync, setConfig } from "../lib/user";
import { toast } from "sonner";
import { Button, DoubleClickButton } from "@/shared/components/ui/button";
import { CheckIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { formatBytes } from "@/shared/utils";
import { Progress } from "@/shared/components/ui/progress";
import { db } from "../lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import type { Config } from "@/background/logic/config";



export default function Utils() {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col items-stretch divide-y divide-slate-700">
        <div className="flex flex-col items-center justify-center border-b-2 border-cyan-700 p-2 pb-1 font-bold">
          Utilities
        </div>
        <StorageInfo />
        <CloudStorageInfo />
        <StorageCleanup />
        <BaseUrlSelector />
      </div>
    </ScrollArea>
  )
}


function BaseUrlSelector() {
  const [config, setCurrentConfig] = useState(null as null | Config)

  useEffect(() => {
    getConfig().then(setCurrentConfig)
  }, [])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!config) return
    const form = e.currentTarget
    const formElements = form.elements as typeof form.elements & {
      url: { value: string },
    }
    const url = formElements.url.value.trim();
    if (url === config.baseURL) {
      toast("Nothing changed", { duration: 1500 })
      return
    };
    const res = await setConfig(Object.assign({}, config, { baseURL: url }))
    if (!res.ok) {
      toast.error("Unable to save configuration", { description: res.message })
      return
    }
    if (!res.serverVersion) {
      toast("Nothing changed", { duration: 1500 })
      return
    }
    getConfig().then(setCurrentConfig)
    loadBackgroundState()
    const v = res.serverVersion
    toast.success("Config updated", { description: `Server v${v.major}.${v.minor}.${v.patch}` })
  }


  if (!config)
    return (
      <div className="flex flex-row content-center items-center gap-2 px-4 py-2">
        <a className="w-12 text-left font-semibold">Server</a>
        <div className="flex grow flex-row">
          <Input id="url" value="Loading..." readOnly autoComplete="off" className="grow rounded-r-none font-mono" />
          <Button variant="outline" className="rounded-l-none"><CheckIcon /></Button>
        </div>
      </div>
    )

  return (
    <div className="flex flex-row content-center items-center gap-2 px-4 py-2">
      <a className="flex-1 text-left font-semibold">Server</a>
      <form className="flex flex-6" onSubmit={handleSubmit}>
        <Input id="url" defaultValue={config.baseURL} placeholder="https://sugarbox.arai.icu/" autoComplete="off" className="grow rounded-r-none font-mono text-sm" />
        <Button variant="outline" type="submit" className="rounded-l-none"><CheckIcon /></Button>
      </form>
    </div>
  )
}


function StorageInfo() {
  const [storageStatus, setStorageStatus] = useState({} as StorageEstimate);
  const saves = useLiveQuery(() => db.saves.toArray())

  useEffect(() => {
    navigator.storage.estimate().then(setStorageStatus)
  }, [])

  useEffect(() => {
    setTimeout(() => navigator.storage.estimate().then(setStorageStatus), 250)
  }, [saves])

  return (
    <div className="flex flex-row items-center gap-2 px-4 py-2">
      <a className="flex-1 font-semibold">Storage</a>
      <Progress className="flex-4" value={((storageStatus.usage || 0) / (storageStatus.quota || 1)) * 100} />
      <a className="flex-2 text-center text-xs text-gray-300">{formatBytes(storageStatus.usage || 0)} / {formatBytes(storageStatus.quota || 0)}</a>
    </div>
  )
}

function CloudStorageInfo() {
  const { user } = useSugarBoxState()
  const isOnline = user.onlineMode && user.online
  const [storageStatus, setStorageStatus] = useState({ usage: 0, quota: 1 })

  useEffect(() => {
    if (!isOnline) return
    getQuota().then((res) => {
      if (res.ok) {
        setStorageStatus({ quota: res.quota, usage: res.usage })
      }
    })
  }, [isOnline])

  if (!isOnline) {
    return (
      <div className="flex flex-row items-center gap-2 px-4 py-2">
        <a className="flex-1 font-semibold">Cloud</a>
        <a className="flex-6 text-center font-mono text-sm text-gray-500"> [ currently offline ] </a>
      </div>
    )
  }

  return (
    <div className="flex flex-row items-center gap-2 px-4 py-2">
      <a className="flex-1 font-semibold">Cloud</a>
      <Progress className="flex-4" value={((storageStatus.usage || 0) / (storageStatus.quota || 1)) * 100} />
      <a className="flex-2 text-center text-xs text-gray-300">{formatBytes(storageStatus.usage || 0)} / {formatBytes(storageStatus.quota || 0)}</a>
    </div>
  )
}

function StorageCleanup() {
  // TODO: Remove when background can do auto cleanup
  const [cutoffDate, setCutoffDate] = useState(1)
  const games = useLiveQuery(() => db.games.where("archivedAt").between(1, cutoffDate).toArray(), [cutoffDate]) ?? []
  const chars = useLiveQuery(() => db.chars.where("archivedAt").between(1, cutoffDate).toArray(), [cutoffDate]) ?? []
  const saves = useLiveQuery(() => db.saves.where("archivedAt").between(1, cutoffDate).toArray(), [cutoffDate]) ?? []
  const totalCount = games.length + chars.length + saves.length

  return (
    <div className="flex flex-row items-center gap-0 px-4 py-2">
      <div className="flex flex-2 grow flex-col self-stretch text-left">
        <a className="grow font-semibold">Cleanup</a>
        <a>Remove items older than:</a>
        <a className="text-xs text-gray-400">
          {cutoffDate === 1 ? (
            <>(affects only archived items)</>
          ) : (
            <>(will affect {totalCount} item{totalCount === 1 ? '' : 's'})</>
          )}
        </a>
      </div>
      <Select
        //value={cutoffTime.toString()}
        onValueChange={async (value: string) => {
          setCutoffDate(Date.now() - Number(value))
        }}>
        <SelectTrigger className="w-30 rounded-r-none">
          <SelectValue placeholder="Select" />
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
      <DoubleClickButton variant={"outline"} disabled={cutoffDate === 1} className="rounded-l-none" onAccept={async () => {
        db.games.bulkDelete(games!.map(i => i.id))
        db.chars.bulkDelete(chars!.map(i => i.id))
        db.saves.bulkDelete(saves!.map(i => i.id))
        toast.success(`Deleted ${games!.length} game${games!.length === 1 ? '' : 's'}, ${chars!.length} character${chars!.length === 1 ? '' : 's'} and ${saves!.length} save${saves!.length === 1 ? '' : 's'}`)
        requestSync()
      }}><TrashIcon /></DoubleClickButton>
    </div>
  )
}


