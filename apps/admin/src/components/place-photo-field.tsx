'use client';

import { useRef, useState, type DragEvent } from 'react';
import { downscaleImage } from '@/lib/image';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

/** A place's photo: drop or choose an image, it is shrunk in the browser and uploaded; shows the result. */
export function PlacePhotoField({ value, onChange, onBusy }: {
  value: string;
  onChange: (url: string) => void;
  /** Lets the form block Save while a photo is on its way. */
  onBusy?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) { setError('Use a JPEG, PNG or WebP image.'); return; }
    setError('');
    setUploading(true);
    onBusy?.(true);
    try {
      const body = new FormData();
      body.append('file', await downscaleImage(file));
      const res = await fetch('/api/admin/places/upload', { method: 'POST', body });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) setError(data.error ?? 'Upload failed. Please try again.');
      else onChange(data.url);
    } catch {
      setError('Upload failed. Check the connection.');
    } finally {
      setUploading(false);
      onBusy?.(false);
      if (input.current) input.current.value = '';
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    if (!uploading) void upload(e.dataTransfer.files[0]);
  };

  return (
    <div>
      <input ref={input} type="file" accept={ACCEPT.join(',')} className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`relative overflow-hidden rounded-xl border ${value ? 'border-gray-200' : 'border-dashed border-gray-300'} ${over ? 'border-brand-500 bg-brand-50' : 'bg-gray-50'}`}
      >
        {value ? (
          <>
            <img src={value} alt="Photo of the place" className="h-40 w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/50 to-transparent p-2">
              <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="rounded-lg bg-white/95 px-2.5 py-1 text-xs font-medium text-gray-800 shadow-sm hover:bg-white disabled:opacity-60">Replace</button>
              <button type="button" onClick={() => onChange('')} disabled={uploading} className="rounded-lg bg-white/95 px-2.5 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-white disabled:opacity-60">Remove</button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="flex h-32 w-full flex-col items-center justify-center gap-1.5 text-center">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.16-5.16a2.25 2.25 0 0 1 3.18 0l5.16 5.16m-1.5-1.5 1.41-1.41a2.25 2.25 0 0 1 3.18 0l2.91 2.91M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Upload a photo</span>
            <span className="text-xs text-gray-500">Drop an image here or click to choose. JPEG, PNG or WebP.</span>
          </button>
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/75 text-sm font-medium text-gray-700">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
            Uploading…
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
