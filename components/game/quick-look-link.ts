'use client';
import { createElement } from 'react';

export function QuickLookLink({ onOpen }: { onOpen: () => void }) {
  // Safari's rel=ar contract: exactly one direct img/picture child. The native
  // anchor fills the touch target; its decorative label cannot intercept taps.
  return createElement('div', { className: 'bracelet-ar-entry' },
    createElement('a', {
      className: 'bracelet-ar-link', rel: 'ar',
      href: 'models/bracelet-ring.usdz#allowsContentScaling=0',
      'aria-label': 'AR 预览：把手链放到现实中', onClick: onOpen,
    }, createElement('img', {
      src: 'model-ring-preview.png', alt: '在现实中查看手链', width: 56, height: 56,
    })),
    createElement('span', { className: 'bracelet-ar-label', 'aria-hidden': true },
      '在现实中看一看 ', createElement('small', null, 'AR 预览 ↗')),
  );
}
