import { UserError } from '@/lib/errors';
/**
 * Shrinks a photo picked on a device to a square-ish avatar: longest side `max` px, JPEG.
 * Phone camera photos are often 3-10 MB; this brings them to ~50-150 KB so they fit the
 * 2 MB avatars bucket and load fast everywhere. EXIF rotation is applied by createImageBitmap.
 */
export async function resizeImage(file: File, max = 512, quality = 0.86): Promise<File> {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new UserError("This photo format isn't supported. Choose a JPG, PNG or WebP image."); }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale); const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);   // transparent PNGs would turn black as JPEG
  ctx.drawImage(bitmap, 0, 0, w, h); bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new UserError("Couldn't process this photo. Try another one.");
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}
