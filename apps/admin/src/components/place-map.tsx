'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';

const TILE = 256;
const EQUATOR_M_PER_PX = 156543.03392; // metres per pixel at zoom 0 on the equator

const worldSize = (zoom: number): number => TILE * 2 ** zoom;

function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const size = worldSize(zoom);
  const sin = Math.min(0.9999, Math.max(-0.9999, Math.sin((lat * Math.PI) / 180)));
  return { x: ((lng + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
}

function unproject(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const size = worldSize(zoom);
  const n = Math.PI - (2 * Math.PI * y) / size;
  return { lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng: (x / size) * 360 - 180 };
}

/**
 * A place's boundary on a map: the centre and the radius drawn to scale over OpenStreetMap tiles.
 * With `onPick`, a click moves the centre. The zoom follows the radius so the circle always fits.
 */
export function PlaceMap({ lat, lng, radiusKm, onPick, className = 'h-52' }: {
  lat: number;
  lng: number;
  radiusKm: number;
  onPick?: (lat: number, lng: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const radiusM = Math.max(50, radiusKm * 1000);
  const cos = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  // The circle takes two thirds of the shorter side: whole zoom levels for the tiles, and the
  // tiles stretched by up to 2x in between, so the picture does not jump as the radius changes.
  const targetPx = Math.max(40, Math.min(box.w, box.h) * 0.33);
  const exact = Math.log2((EQUATOR_M_PER_PX * cos * targetPx) / radiusM);
  const zoom = Math.min(18, Math.max(2, Math.floor(exact)));
  const scale = Math.min(2, Math.max(1, 2 ** (exact - zoom)));
  const size = TILE * scale;
  const radiusPx = (radiusM / ((EQUATOR_M_PER_PX * cos) / 2 ** zoom)) * scale;
  const centre = project(lat, lng, zoom);
  const left = centre.x * scale - box.w / 2;
  const top = centre.y * scale - box.h / 2;

  const tiles: { key: string; src: string; x: number; y: number }[] = [];
  if (box.w > 0 && box.h > 0) {
    const count = 2 ** zoom;
    for (let tx = Math.floor(left / size); tx <= Math.floor((left + box.w) / size); tx++) {
      for (let ty = Math.floor(top / size); ty <= Math.floor((top + box.h) / size); ty++) {
        if (ty < 0 || ty >= count) continue;
        const wrapped = ((tx % count) + count) % count;
        tiles.push({ key: `${zoom}/${tx}/${ty}`, src: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`, x: tx * size - left, y: ty * size - top });
      }
    }
  }

  const pick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onPick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const at = unproject((left + (e.clientX - rect.left)) / scale, (top + (e.clientY - rect.top)) / scale, zoom);
    onPick(Number(at.lat.toFixed(5)), Number(at.lng.toFixed(5)));
  };

  return (
    <div
      ref={ref}
      onClick={pick}
      className={`relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 ${onPick ? 'cursor-crosshair' : ''} ${className}`}
      role={onPick ? 'button' : 'img'}
      aria-label={onPick ? 'Map: click to move the centre' : 'Map of the place'}
    >
      {tiles.map((t) => (
        <img key={t.key} src={t.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ left: t.x, top: t.y, width: size + 0.5, height: size + 0.5 }} />
      ))}
      <div
        className="pointer-events-none absolute rounded-full border-2 border-brand-600 bg-brand-500/15"
        style={{ left: box.w / 2 - radiusPx, top: box.h / 2 - radiusPx, width: radiusPx * 2, height: radiusPx * 2 }}
      />
      <div className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-600 shadow" style={{ left: box.w / 2, top: box.h / 2 }} />
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 right-0 rounded-tl-md bg-white/80 px-1.5 py-0.5 text-[10px] text-gray-600 hover:underline"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
