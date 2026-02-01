import type { ChromeMessageRequest } from "@/shared/types";
import { state } from "./state";

chrome.runtime.onMessage.addListener((request: ChromeMessageRequest, _sender, sendResponse)=> {
  console.log(`[BG] Request `, request);

  if (!("cmd" in request && "target" in request)) {
    return;
  }

  if (request.target !== "background") return;

  switch (request.cmd) {
    case "ping": {
      sendResponse({ ok: true, message: "pong"})
      break
    }
    case "get_state": {
      sendResponse({ok: true, data: state})
      break
    }
    default: {
      console.warn("Invalid request", request)
    }
  }

})
