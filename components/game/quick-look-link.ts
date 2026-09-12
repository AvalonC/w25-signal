'use client';
import { createElement } from 'react';
import { BRACELET_ASSETS } from '../../lib/model-assets.ts';

export function QuickLookLink({ onOpen }: { onOpen: () => void }) {
  // Safari's rel=ar contract: exactly one direct img/picture child. Safari
  // supplies the native AR badge over a plain light surface. No product
  // thumbnail or hand-drawn AR logo competes with the system badge.
  return createElement('div', { className: 'bracelet-ar-entry' },
    createElement('a', {
      className: 'bracelet-ar-link', rel: 'ar',
      href: BRACELET_ASSETS.ar,
      'aria-label': '在现实中查看手链（Apple AR Quick Look）', onClick: onOpen,
    }, createElement('img', {
      src: 'images/ar-quick-look-surface.svg', alt: '在现实中查看手链', width: 56, height: 56,
    })),
    createElement('span', { className: 'bracelet-ar-label', 'aria-hidden': true },
      '在现实中看一看'),
  );
}
