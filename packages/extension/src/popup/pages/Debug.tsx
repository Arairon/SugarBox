import { Button } from "@/shared/components/ui/button"
import { loadBackgroundState } from "../lib/state";
import { sendMessage } from "webext-bridge/popup";

export default function Debug() {
  return (
    <>
      Debug
      <Button onClick={() => sendMessage("bg_ping", undefined, "background")}>ping bg</Button>
      <Button onClick={() => loadBackgroundState()}>get_state</Button>
    </>
  )
}
