/** Clipboard helpers shared by node copy buttons. */

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/** Write a PNG/image blob to the clipboard as an actual image. */
export async function copyImageBlob(blob: Blob): Promise<void> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("image clipboard unsupported");
  }
  const type = blob.type === "image/png" ? "image/png" : blob.type;
  await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
}

async function transcodeToPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!out) throw new Error("toBlob failed");
  return out;
}

/**
 * Best-effort copy of a remote image: fetch it, normalize to PNG if needed, and
 * place it on the clipboard. Falls back to copying the URL as text when the
 * image can't be fetched (CORS) or the browser lacks image-clipboard support.
 */
export async function copyImageFromUrl(url: string): Promise<"image" | "url"> {
  try {
    const res = await fetch(url, { mode: "cors" });
    let blob = await res.blob();
    if (blob.type !== "image/png") blob = await transcodeToPng(blob);
    await copyImageBlob(blob);
    return "image";
  } catch {
    await navigator.clipboard.writeText(url);
    return "url";
  }
}
