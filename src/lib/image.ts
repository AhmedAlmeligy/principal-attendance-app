/**
 * Downscale a picked image to a small square data URL (JPEG) so the profile
 * photo stays tiny in IndexedDB and in the Convex document (a few tens of KB).
 *
 * @param file image file chosen via <input type="file">
 * @param size target width/height in px (square, center-cropped)
 */
export async function fileToAvatarDataUrl(
  file: File,
  size = 256,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("NOT_AN_IMAGE");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("READ_FAILED"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("DECODE_FAILED"));
    el.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");

  // Center-crop the source to a square before downscaling.
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  return canvas.toDataURL("image/jpeg", 0.85);
}
