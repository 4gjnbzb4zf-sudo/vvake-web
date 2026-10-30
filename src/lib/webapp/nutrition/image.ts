/**
 * Meal photos on the web (VVFit ADR-0070): the photo is shrunk in the browser before it leaves it, to at most 1024
 * pixels on its long edge as a JPEG at about 0.7 quality (about a thousand image tokens for the model, a few hundred
 * kilobytes), and never over 1.5 MB. The original never leaves the device, and nothing is kept: the web never stores
 * meal photos (no IndexedDB, no cache), the API passes the photo to the model and forgets it.
 */

export const PHOTO_MAX_EDGE = 1024;
export const PHOTO_QUALITY = 0.7;
export const PHOTO_MAX_BYTES = 1_500_000;

/** The size to draw at: the long edge at most `max`, the ratio kept, never upscaled, at least 1×1. Pure. */
export function fitSize(w: number, h: number, max = PHOTO_MAX_EDGE): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 1, h: 1 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Bytes of a base64 string (without a data: prefix). Pure. */
export const base64Bytes = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);

/** The base64 part of a data URL, or null when it isn't one. Pure. */
export function dataUrlBase64(url: string): string | null {
  const m = /^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(url);
  return m ? m[1]! : null;
}

/** The qualities tried in order until the photo fits under the byte cap. */
export const QUALITY_STEPS = [PHOTO_QUALITY, 0.6, 0.5, 0.4] as const;

export type ShrunkPhoto = { mediaType: "image/jpeg"; data: string; bytes: number; w: number; h: number };

/**
 * A picked or taken photo, shrunk to send (EXIF orientation applied by the browser's decoder, metadata dropped by the
 * canvas re-encode, so no location tag leaves the device). Null when the browser can't read it.
 */
export async function shrinkPhoto(file: Blob): Promise<ShrunkPhoto | null> {
  let src: ImageBitmap | HTMLImageElement | null = null;
  let w = 0;
  let h = 0;
  let url: string | null = null;
  try {
    if (typeof createImageBitmap === "function") {
      const b = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      src = b;
      w = b.width;
      h = b.height;
    }
  } catch {
    src = null;
  }
  try {
    if (!src) {
      url = URL.createObjectURL(file);
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      src = img;
      w = img.naturalWidth;
      h = img.naturalHeight;
    }
    const size = fitSize(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(src, 0, 0, size.w, size.h);
    for (const q of QUALITY_STEPS) {
      const data = dataUrlBase64(canvas.toDataURL("image/jpeg", q));
      if (!data) return null;
      const bytes = base64Bytes(data);
      if (bytes <= PHOTO_MAX_BYTES) return { mediaType: "image/jpeg", data, bytes, w: size.w, h: size.h };
    }
    return null;
  } catch {
    return null;
  } finally {
    if (src && "close" in src) src.close();
    if (url) URL.revokeObjectURL(url);
  }
}
