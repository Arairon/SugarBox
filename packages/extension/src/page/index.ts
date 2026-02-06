import type { SugarBoxPageRequest, SugarBoxPageResponse } from "@/shared/types";
import type { SugarCube as SugarCubeType } from "./types";

(() => {

  function delay(ms: number) {
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

  let SugarCube = null as typeof win.SugarCube | null;

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
    if (!SugarCube) return null;

    function save() {
      if (!SugarCube) return null;
      if (SugarCube.version.minor >= 37 && SugarCube.Save.base64) {
        return SugarCube.Save.base64.save();
      }
      return SugarCube.Save.serialize();
    }

    return {
      passage: SugarCube.State.passage,
      data: save(),
      description: SugarCube.Story.get(
        SugarCube.State.passage
      ).description(),
      version: getGameVersion(),
    };
  }

  function loadSave(save: string) {
    if (!SugarCube) {
      console.error("SugarBox: Attempted to load a save without SugarCube present")
      return
    };
    if (SugarCube.version.minor >= 37 && SugarCube.Save.base64) {
      SugarCube.Save.base64.load(save);
      SugarCube.Engine.show();
      return;
    }
    SugarCube.Save.deserialize(save);
  }

  async function processRequest(req: SugarBoxPageRequest) {
    const cmd = req.cmd
    if (cmd === "check_sugarcube")
      return isObject(SugarCube);
    if (!SugarCube) return null;
    if (cmd === "get_story_name") return SugarCube.Story.title;
    if (cmd === "get_passage") return SugarCube.State.passage;
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
        SugarCube = win.SugarCube
        break
      }
      window.dispatchEvent(new CustomEvent("SugarBox_Page_Init_Retrying"))
      await delay(300)
    }
    if (!SugarCube) {
      window.dispatchEvent(new CustomEvent("SugarBox_Page_Init_Failed"))
      console.debug(`SugarBox Pagescript Failed to attach to ${document.title}@${document.location.host}`)
      return;
    }

    window.addEventListener("SugarBox_To_Page", eventHandler as (ev: Event) => void);

    window.dispatchEvent(new CustomEvent("SugarBox_Page_Init_Success"))
    console.debug(`SugarBox Pagescript attached to ${document.title}@${document.location.host}`)
  }

  init()

})()
