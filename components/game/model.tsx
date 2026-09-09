'use client';
import { useEffect, useRef, useState } from 'react';
import { ModelSurface } from './model-surface';
import { useVisibleClock } from './scene-clock';
import metadata from '../../public/models/jewelry-metadata.json';
export function WireBracelet({ onGem, onScatter, paused = false }: {
  onGem: () => void; onScatter: () => void; paused?: boolean;
}) {
  const [departing, setDeparting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const clock = useVisibleClock(departing && !paused);
  const done = useRef(false);
  useEffect(() => {
    if (clock < 1800 || done.current) return;
    done.current = true; onGem();
  }, [clock, onGem]);
  const depart = () => {
    if (departing || paused) return;
    setDeparting(true); onScatter();
  };
  return <div className={'wire-wrap ring-model-wrap ' + (departing ? 'departing' : '')}>
    <div className="wire-touch ring-viewer">
      <ModelSurface src="models/bracelet-ring.glb" poster="model-ring-preview.png"
        label="四角星镶座、粉色宝石与长短银链组成的环形手链" onReady={setLoaded}>
        {!departing && <button slot="hotspot-gem" className="ring-jewel-hotspot"
          data-position={metadata.hotspot.map((n) => n + 'm').join(' ')} data-normal="0 1 0"
          data-visibility-attribute="visible" aria-label="触碰四角星中央的粉色蓝宝石" onClick={depart} />}
      </ModelSurface>
    </div>
    {!departing && <div className="wire-controls">
      <span>{loaded ? '拖动，让另一面星光经过' : '这份星光，也在你手边'}</span>
      <button className="soft-button" onClick={depart}>轻触宝石，送出这封信</button>
    </div>}
  </div>;
}
