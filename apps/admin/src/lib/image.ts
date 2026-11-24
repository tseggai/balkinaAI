/**
 * Shrink a photo in the browser before it is uploaded: longest side at most `maxSide`, saved as JPEG.
 * A phone photo of several megabytes becomes a few hundred kilobytes, which is what the app and the
 * web page should load. Returns the original file when the browser cannot decode or encode it.
 */
export async function downscaleImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === 'image/jpeg' && file.size < 600 * 1024) { bitmap.close(); return file; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return file; }
    ctx.fillStyle = '#ffffff'; // transparent PNGs become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`;
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
