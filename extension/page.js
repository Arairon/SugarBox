function incomingHandler(ev) {
  const request = ev.detail;
  processRequest(request.data).then((data) =>
    sendToExt({
      id: request.id,
      data,
    })
  );
}

let SugarCubeObject;

async function processRequest(request) {
  const { cmd, args } = request;
  if (cmd === "check_sugarcube")
    return typeof SugarCube === "object" && SugarCube !== null;
  if (!SugarCubeObject) return null;
  if (cmd === "get_passage") return SugarCube.State.passage;
  if (cmd === "save") return get_save();
  if (cmd === "load") loadSave(args[0]);
}

function loadSave(save) {
  if (SugarCubeObject?.version?.minor >= 37) {
    SugarCubeObject.Save.base64.load(save);
    location.reload();
    return;
  }
  SugarCubeObject.Save.deserialize(save);
}

function isObject(obj) {
  return typeof obj === "object" && obj !== null;
}

function sendToExt(data) {
  data.sender = "page";
  window.dispatchEvent(new CustomEvent("TwineSavesToExt", { detail: data }));
}

function get_version() {
  try {
    let version = "";
    if (typeof StartConfig !== "undefined") {
      version = StartConfig.version;
    }
    if (version) return version;
    if (typeof Config !== "undefined") {
      version = Config?.saves?.version;
    }
    if (version) return version;
  } catch {
    return "";
  }
  return "";
}

function get_save() {
  return {
    passage: SugarCubeObject.State.passage,
    data: SugarCubeObject.Save.serialize(),
    description: SugarCubeObject.Story.get(
      SugarCubeObject.State.passage
    ).description(),
    version: get_version(),
  };
}

function init() {
  if (typeof SugarCube === "undefined") {
    setTimeout(() => {
      sendToExt({ disable: true });
    }, 1000);
    return;
  }
  SugarCubeObject = SugarCube;
  window.addEventListener("TwineSavesToPage", incomingHandler);
  console.log("Connected to twine saves");
  if (SugarCube.Save.onSave.size) {
    console.warn(
      "This game uses onSave hooks which must be cleared to use twine saves manager. This may cause problems with default saves."
    );
    SugarCube.Save.onSave.clear();
  }
}
init();
