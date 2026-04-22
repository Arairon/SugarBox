import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Button } from "@/shared/components/ui/button";
import { loadBackgroundState, useSugarBoxState } from "../lib/state";
import { CloudOffIcon, GlobeIcon, GlobeLockIcon, HardDriveIcon, LogInIcon, LogOutIcon, TrashIcon, User2Icon, UserPlus2Icon, WrenchIcon } from "lucide-react";
import { Switch } from "@/shared/components/ui/switch";
import { logout, toggleOnlineMode } from "../lib/user";
import { toast } from "sonner";

function UserMenu() {
  const { user, setPage, page } = useSugarBoxState()
  const username = user.id ? user.displayname : "Not logged in"
  let statusIcon;
  let statusDescription;
  let statusDescriptionExtra;
  if (user.id && user.onlineMode) {
    if (user.onlineMode && user.online) {
      if (user.role !== "limited") {
        statusIcon = <GlobeIcon />
        statusDescription = "Online"
      } else {
        statusIcon = <GlobeLockIcon />
        statusDescription = "Online (limited)"
        statusDescriptionExtra = "Your account is unable to use cloud functionality"
      }
    } else {
      statusIcon = <CloudOffIcon />
      statusDescription = "Offline (unable to connect)"
      statusDescriptionExtra = user.offlineReason
    }
  } else {
    statusIcon = <HardDriveIcon />
    statusDescription = user.onlineMode ? "Offline" : "Offline mode (manual)"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex flex-1 cursor-pointer flex-row items-center justify-center gap-2
border-x-2 border-cyan-700 px-4 font-mono hover:border-cyan-500 hover:bg-background/20" >
        <a className="max-w-32 grow truncate">{username}</a>
        <Tooltip>
          <TooltipTrigger asChild>
            {statusIcon}
          </TooltipTrigger>
          <TooltipContent className="border bg-slate-900 text-white">
            <p>{statusDescription}</p>
            {statusDescriptionExtra && <p className='text-xs text-gray-400'>{statusDescriptionExtra}</p>}
          </TooltipContent>
        </Tooltip>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={(e) => {
          e.preventDefault()
          toggleOnlineMode().then(() => {
            loadBackgroundState()
          })
        }}>
          <a className='grow'>Online</a> <Switch checked={user.onlineMode} />
        </DropdownMenuItem>

        {user.id ? (
          <>
            <DropdownMenuItem onClick={() => { setPage("account") }}>
              <User2Icon /> Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (page === "account") setPage("home")
              logout().then(res => {
                if (res.ok) {
                  toast("Goodbye!", { duration: 1500 })
                  loadBackgroundState()
                } else {
                  toast.error("Failed to logout", { description: res.message })
                }
              })
            }
            }>
              <LogOutIcon className='rotate-180' /> Log Out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onClick={() => setPage("login")}>
              <LogInIcon /> Log In
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPage("register")}>
              <UserPlus2Icon /> Register
            </DropdownMenuItem>
          </>
        )}

      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Footer() {
  const { setPage, page } = useSugarBoxState()

  return (
    <footer className='flex h-10 flex-row border-t-3 border-double border-header-border bg-header px-2'>
      <Button variant={"ghost"} onClick={() => setPage(page === "utils" ? "home" : "utils")}
        className="rounded-none border-r border-l-2 border-cyan-700 hover:border-cyan-500 hover:bg-background/30">
        <WrenchIcon />
      </Button>
      <Button variant={"ghost"} onClick={() => setPage(page === "trash" ? "home" : "trash")}
        className="rounded-none border-r-2 border-l border-cyan-700 hover:border-cyan-500 hover:bg-background/30">
        <TrashIcon />
      </Button>
      <div className="flex-1"></div>
      <UserMenu />
    </footer>
  );
}

