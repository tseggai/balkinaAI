'use client';

import { useState, useRef } from 'react';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export function ImageUpload({ value, onChange, label = 'Image' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Upload failed');
      } else {
        onChange(json.url);
      }
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleRemove() {
    onChange('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}

      {value ? (
        <div className="relative">
          <img
            src={value}
            alt="Preview"
            className="w-full max-h-48 rounded-lg border border-gray-200 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow hover:bg-red-600"
          >
            &times;
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
            dragOver
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          }`}
        >
          {uploading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="h-5 w-5 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Uploading...
            </div>
          ) : (
            <>
              <svg className="mb-1 h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm text-gray-500">
                Click or drag an image to upload
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                JPEG, PNG, WebP, GIF (max 5MB)
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        onChange={handleInputChange}
        className="hidden"
      />

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
