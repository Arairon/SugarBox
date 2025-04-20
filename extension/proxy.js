let reqId = 0;
let enabled = true;
const pendingRequests = {};

function popupToPageHandler(msg, sender, sendResponse) {
  if (!enabled) return;
  const data = {
    id: reqId,
    data: msg,
  };
  pendingRequests[reqId++] = sendResponse;
  window.dispatchEvent(new CustomEvent("TwineSavesToPage", { detail: data }));
}
chrome.runtime.onMessage.addListener(popupToPageHandler);

window.addEventListener("TwineSavesToExt", (ev) => {
  const data = ev.detail;
  if (enabled) {
    if (data?.disable) {
      chrome.runtime.onMessage.removeListener(popupToPageHandler);
      return;
    }
  }
  pendingRequests[data.id](data.data);
  delete pendingRequests[data.id];
});
