'use client';
/* oxlint-disable next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ModelSurface, type ModelSurfaceHandle } from './model-surface';
import { BraceletStardust } from './bracelet-stardust';
import { QuickLookLink } from './quick-look-link';
import { useVisibleClock } from './scene-clock';
import { braceletPhase, type CameraView, type StarArrival, type Vec3, type ViewPoint } from '@/lib/bracelet-transition';
import metadata from '../../public/models/jewelry-metadata.json';
import constellation from '../../public/models/bracelet-stars.json';
const points = constellation.points as Vec3[];

export function WireBracelet({ onGem, onScatter, paused = false }: {
  onGem: (arrival: StarArrival) => void; onScatter: () => void; paused?: boolean;
}) {
  const [departing, setDeparting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [view, setView] = useState<CameraView | null>(null);
  const [arSupport, setArSupport] = useState<boolean | null>(null);
  const [arRequested, setArRequested] = useState(false);
  const viewer = useRef<ModelSurfaceHandle>(null);
  const surface = useRef<HTMLDivElement>(null);
  const positions = useRef<ViewPoint[]>([]);
  const started = useRef(false), done = useRef(false);
  const clock = useVisibleClock(departing && !paused);
  const phase = braceletPhase(clock, reduced);
  useEffect(() => {
    setReduced(matchMedia('(prefers-reduced-motion: reduce)').matches);
    const link = document.createElement('a');
    setArSupport(!!link.relList.supports?.('ar'));
    const returned = () => { if (!document.hidden) setArRequested(false); };
    document.addEventListener('visibilitychange', returned);
    window.addEventListener('focus', returned);
    return () => { document.removeEventListener('visibilitychange', returned); window.removeEventListener('focus', returned); };
  }, []);
  useEffect(() => {
    if (!departing || paused || !phase.done || done.current) return;
    done.current = true;
    onGem({ id: Date.now(), points: positions.current });
  }, [departing, paused, phase.done, onGem]);
  const depart = () => {
    if (started.current || paused) return;
    started.current = true;
    const rect = surface.current!.getBoundingClientRect();
    const square = Math.min(rect.width, rect.height);
    setView(viewer.current?.camera() ?? {
      theta: 0, phi: metadata.poster.phi, radius: .145, fov: 30, orthographicSpan: metadata.poster.span,
      target: metadata.poster.target as Vec3, left: rect.left + (rect.width-square)/2,
      top: rect.top + (rect.height-square)/2, width: square, height: square,
    });
    setDeparting(true); onScatter();
  };
  return <section className={'bracelet-experience' + (departing ? ' is-departing' : '')} aria-label="星光手链">
    <div ref={surface} className="bracelet-viewport" style={{ '--solid-opacity': phase.solid } as CSSProperties}>
      <ModelSurface src="models/bracelet-ring.glb" poster="model-ring-preview.png"
        label="可旋转的完整手链：四角星镶座、粉色宝石、长短银链和自然垂落的尾饰"
        orbit="18deg 55deg 115%" onReady={setLoaded} viewerRef={viewer} interactive={!departing && !paused} frozen={departing}>
        {!departing && <button slot="hotspot-gem" className="bracelet-gem-target"
          data-position={metadata.hotspot.map((n) => n + 'm').join(' ')} data-normal="0 1 0"
          data-visibility-attribute="visible" aria-label="触碰粉色蓝宝石，让手链化作星光"
          disabled={paused} onClick={(e) => { e.stopPropagation(); depart(); }}><span aria-hidden="true">✧</span></button>}
      </ModelSurface>
    </div>
    <div className="bracelet-actions" inert={departing || paused} aria-hidden={departing}>
      <p className="bracelet-caption">{loaded ? '拖动看一看，让光经过每一面。' : '星光在这里，慢慢靠近。'}</p>
      <button className="bracelet-send" onClick={depart}>触碰宝石，让星光继续</button>
      <QuickLookLink onOpen={() => setArRequested(true)} />
      <p className="bracelet-ar-note" role="status">
        {arRequested ? '正在打开现实中的预览，请稍候。' : arSupport === false ? '在 iPhone Safari 中打开，可以把它放到眼前。' : '让这束光，在你眼前停一会。'}
      </p>
      {arRequested && <a className="bracelet-file-link" href="models/bracelet-ring.usdz">未打开？查看模型文件</a>}
    </div>
    {departing && view && <BraceletStardust elapsed={clock} reduced={reduced} points={points} view={view}
      onPositions={(value) => { positions.current = value; }} />}
    {departing && <p className="sr-only" role="status">手链正化作星光，请稍候。</p>}
  </section>;
}
