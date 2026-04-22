import sanitize from "sanitize-filename";

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = window.URL.createObjectURL(blob);
  a.download = sanitize(name);
  a.click();
  window.URL.revokeObjectURL(a.href);
}
