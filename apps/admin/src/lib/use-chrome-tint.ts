'use client';

import { useEffect } from 'react';

const LIGHT = '#ffffff';
const DIMMED = '#999999'; // white under the 40 % black overlay

/**
 * iOS Safari tints its address bar and toolbar from the page. It samples the page when an
 * overlay (drawer, dialog) is open and keeps that grey after a client-side navigation until a
 * reload. Changing the theme-color meta makes Safari re-evaluate, so every overlay sets it to the
 * dimmed colour while open and back to white when it closes.
 */
export function useChromeTint(dimmed: boolean) {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', dimmed ? DIMMED : LIGHT);
    return () => { meta?.setAttribute('content', LIGHT); };
  }, [dimmed]);
}
