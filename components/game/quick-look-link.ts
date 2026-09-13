'use client';
import { createElement } from 'react';
import { BRACELET_ASSETS } from '../../lib/model-assets.ts';

export function QuickLookLink({ onOpen }: { onOpen: () => void }) {
  // Keep a real, transparent raster image for Safari's native AR badge.
  // Do not put a background, clipping, filter or decoration on the image:
  // its pixels and the browser-owned badge must remain unobstructed.
  return createElement('div', { className: 'bracelet-ar-entry' },
    createElement('a', {
      className: 'bracelet-ar-link', rel: 'ar',
      href: BRACELET_ASSETS.ar,
      'aria-label': '在现实中查看手链（Apple AR Quick Look）', onClick: onOpen,
    }, createElement('img', {
      src: 'images/ar-native-transparent.png', alt: '', width: 64, height: 64,
    })),
    createElement('span', { className: 'bracelet-ar-label', 'aria-hidden': true },
      '在现实中看一看'),
  );
}
