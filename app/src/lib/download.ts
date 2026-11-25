/** Saves text the browser built as a file, with no request. */
export function download(name: string, text: string, type: string) {
  const href = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  URL.revokeObjectURL(href);
}
