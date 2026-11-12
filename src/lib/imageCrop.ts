// Prepares a prescription photo ON THE DEVICE before it is uploaded: optionally cuts it down to the
// region the user selected, shrinks it and re-encodes it as JPEG. That last step drops the EXIF
// metadata (GPS location, device) — and a crop that leaves out the patient's name and ID number
// means those never leave the phone at all, which is the one protection that does not depend on
// trusting whoever reads the photo.

// A region as fractions (0..1) of the image, so it does not depend on how big the preview is drawn.
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The server shrinks to 1024px anyway; 1600px keeps small print legible after the crop is blown up.
const MAX_SIDE = 1600;

export async function prepareImageForUpload(file: File, crop: CropRect | null): Promise<File> {
  // Without canvas support the original goes up unchanged (the server still re-encodes it).
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;

  let bitmap: ImageBitmap;
  try {
    // 'from-image' applies the camera's rotation, so a portrait photo isn't uploaded sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  try {
    const sx = Math.round((crop?.x ?? 0) * bitmap.width);
    const sy = Math.round((crop?.y ?? 0) * bitmap.height);
    const sw = Math.max(1, Math.round((crop?.width ?? 1) * bitmap.width));
    const sh = Math.max(1, Math.round((crop?.height ?? 1) * bitmap.height));

    const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    return blob ? new File([blob], 'formula.jpg', { type: 'image/jpeg' }) : file;
  } finally {
    bitmap.close();
  }
}
