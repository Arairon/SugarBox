import sanitize from "sanitize-filename";

export async function getCurrentBrowserTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab;
}

type pageCommand = {
  cmd: string;
  args: any[];
};

export function pageRequestRaw(data: pageCommand) {
  return new Promise(async function (resolve, reject) {
    const tab = await getCurrentBrowserTab();
    if (!tab.id) {
      reject("Invalid tab");
      return;
    }
    try {
      chrome.tabs
        .sendMessage(tab.id, data)
        .then((res) => resolve(res))
        .catch((err) => reject(err));
    } catch {
      reject("Could not send message");
    }
  });
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = window.URL.createObjectURL(blob);
  a.download = sanitize(name);
  a.click();
  window.URL.revokeObjectURL(a.href);
}

export function pageRequest(cmd: string, ...args: any) {
  return pageRequestRaw({
    cmd,
    args,
  });
}

export function checkSugarCube() {
  return pageRequest("check_sugarcube") as Promise<boolean>;
}

const _global = window as any;
_global.pageRequest = pageRequest;
