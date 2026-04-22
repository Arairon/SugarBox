import { useSugarBoxState } from "@/popup/lib/state";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { LockKeyholeIcon, PenIcon, User2Icon, UserCog2Icon } from "lucide-react";
import { toast } from "sonner";

export default function Account() {
  const { user, } = useSugarBoxState()
  const statusIcons = {
    user: <User2Icon />,
    admin: <UserCog2Icon />,
    limited: <LockKeyholeIcon />
  }
  return (
    <main className="flex flex-1 flex-col items-stretch">
      <div className="flex flex-row content-center items-center gap-2 border-b px-4 py-2">
        {statusIcons[user.role]}
        <div className="flex grow flex-col text-left">
          <span className="flex flex-row gap-2">
            <a>{user.displayname}</a>
            <a className="text-gray-400">({user.username})</a>
          </span>
          <a className="text-gray-200">Email: {user.email}</a>
        </div>
        <Button variant={"outline"} onClick={() => toast("Not implemented yet")}><PenIcon /></Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="divide-y divide-slate-600">
        {/* TODO: Session list */}
        </div>
      </ScrollArea>
    </main>
  )
}
