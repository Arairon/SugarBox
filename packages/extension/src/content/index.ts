import type { SugarBoxPageRequest, SugarBoxPageResponse } from "@/shared/types";

function isObject(obj: unknown) {
  return typeof obj === "object" && obj !== null;
}

let reqId = 0;
let enabled = true;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pendingRequests = new Map<number, (response?: any) => void>();
const requestTimeout = 30_000;

console.debug(
  `SugarBox Connector Loaded in ${document.title}@${document.location.host}`
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function popupToPageHandler(msg: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
  if (!enabled) return;

  if (!isObject(msg) || !("cmd" in msg)) {
    console.error(`SugarBox Pagescript invalid command: ${JSON.stringify(msg)}`)
    return
  }

  const data = {
    id: ++reqId,
    cmd: msg.cmd,
    args: (msg as typeof msg & { args?: string[] }).args ?? undefined
  } as SugarBoxPageRequest;

  pendingRequests.set(reqId, sendResponse);
  setTimeout(() => {
    // Cleanup if request wasn't answered in time
    pendingRequests.delete(reqId)
  }, requestTimeout)

  window.dispatchEvent(new CustomEvent("SugarBox_To_Page", { detail: data }));

  return true; // Required.
}
chrome.runtime.onMessage.addListener(popupToPageHandler);

window.addEventListener("SugarBox_From_Page", (ev) => {
  const data = (ev as CustomEvent).detail as SugarBoxPageResponse;
  const respond = pendingRequests.get(data.id)
  if (respond) {
    respond(data.data);
    pendingRequests.delete(data.id)
  } else {
    console.error(`Response window missed by ${data}`)
  }
});

window.addEventListener("SugarBox_Page_Init_Failed", () => {
  if (enabled) {
    enabled = false;
    chrome.runtime.onMessage.removeListener(popupToPageHandler);
    console.debug(`SugarBox Connector shutting down for ${document.title}@${document.location.host}`)
    return;
  }
})
