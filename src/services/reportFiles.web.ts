export async function saveReport(
  name: string,
  data: string | Uint8Array,
  mime: string,
) {
  const content = typeof data === "string" ? data : new Uint8Array(data).buffer;
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
