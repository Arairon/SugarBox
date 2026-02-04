import type { SugarBoxPageRequest, SugarBoxPageResponse } from "@/shared/types";
import type { SugarCube as SugarCubeType } from "./types";

export function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

function isObject(obj: unknown) {
  return typeof obj === "object" && obj !== null;
}

const win = globalThis.window as Window & typeof globalThis &
{
  SugarCube?: SugarCubeType,
  StartConfig?: { // DoL Specific
    version?: string
  },
  Config?: { // CoT Specific
    saves?: {
      version?: string
    }
  }
}

let SugarCubeObject = null as typeof win.SugarCube | null;

function getGameVersion() {
  try {
    let version = "";
    if (typeof win.StartConfig !== "undefined") {
      version = win.StartConfig.version ?? "";
    }
    if (version) return version;
    if (typeof win.Config !== "undefined") {
      version = win.Config?.saves?.version ?? "";
    }
    if (version) return version;
  } catch {
    return "";
  }
  return "";
}

function getSave() {
  if (!SugarCubeObject) return null;

  function save() {
    if (!SugarCubeObject) return null;
    if (SugarCubeObject.version.minor >= 37 && SugarCubeObject.Save.base64) {
      return SugarCubeObject.Save.base64.save();
    }
    return SugarCubeObject.Save.serialize();
  }

  return {
    passage: SugarCubeObject.State.passage,
    data: save(),
    description: SugarCubeObject.Story.get(
      SugarCubeObject.State.passage
    ).description(),
    version: getGameVersion(),
  };
}

function loadSave(save: string) {
  if (!SugarCubeObject) {
    console.error("SugarBox: Attempted to load a save without SugarCube present")
    return
  };
  if (SugarCubeObject.version.minor >= 37 && SugarCubeObject.Save.base64) {
    SugarCubeObject.Save.base64.load(save);
    SugarCubeObject.Engine.show();
    return;
  }
  SugarCubeObject.Save.deserialize(save);
}

async function processRequest(req: SugarBoxPageRequest) {
  const cmd = req.cmd
  if (cmd === "check_sugarcube")
    return isObject(SugarCubeObject);
  if (!SugarCubeObject) return null;
  if (cmd === "get_story_name") return SugarCubeObject.Story.title;
  if (cmd === "get_passage") return SugarCubeObject.State.passage;
  if (cmd === "save") return getSave();
  if (cmd === "load") return loadSave(req.args[0]);
  console.error(`Invalid command: ${cmd satisfies never}`)

}


function eventHandler(ev: CustomEvent) {
  if (!isObject(ev.detail) || !("cmd" in ev.detail)) {
    console.error(`SugarBox Pagescript invalid command: ${JSON.stringify(ev.detail)}`)
    return
  }
  const request = ev.detail as SugarBoxPageRequest;
  console.debug(`SugarBox Pagescript for ${document.title}@${document.location.host} received ${request.cmd}`)

  processRequest(request).then(data => {
    if (request.id) {
      window.dispatchEvent(new CustomEvent("SugarBox_From_Page", {
        detail: {
          id: request.id,
          data
        } as SugarBoxPageResponse
      }))
    }
  })

}
async function init(retries = 3) {
  for (let i = 0; i < retries; i++) {
    if (isObject(win.SugarCube)) {
      SugarCubeObject = win.SugarCube
      break
    }
    window.dispatchEvent(new CustomEvent("SugarBox_Page_Init_Retrying"))
    await delay(300)
  }
  if (!SugarCubeObject) {
    window.dispatchEvent(new CustomEvent("SugarBox_Page_Init_Failed"))
    console.debug(`SugarBox Pagescript Failed to attach to ${document.title}@${document.location.host}`)
    return;
  }

  window.addEventListener("SugarBox_To_Page", eventHandler as (ev: Event) => void);

  window.dispatchEvent(new CustomEvent("SugarBox_Page_Init_Success"))
  console.debug(`SugarBox Pagescript attached to ${document.title}@${document.location.host}`)
}

init()

