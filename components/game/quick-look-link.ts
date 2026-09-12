'use client';
import { createElement } from 'react';

export function QuickLookLink({ onOpen }: { onOpen: () => void }) {
  // Safari's rel=ar contract: exactly one direct img/picture child. Safari
  // supplies the native Quick Look AR badge on this thumbnail; do not draw a
  // competing logo in the page UI.
  return createElement('div', { className: 'bracelet-ar-entry' },
    createElement('a', {
      className: 'bracelet-ar-link', rel: 'ar',
      href: 'models/bracelet-ring.usdz#allowsContentScaling=0',
      'aria-label': '在现实中查看手链（Apple AR Quick Look）', onClick: onOpen,
    }, createElement('img', {
      src: 'model-ring-preview.png', alt: '手链模型缩略图；Safari 会显示 Apple AR 标识', width: 80, height: 80,
    })),
    createElement('span', { className: 'bracelet-ar-label', 'aria-hidden': true },
      '在现实中看一看'),
  );
}
