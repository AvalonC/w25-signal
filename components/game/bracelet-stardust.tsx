'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { braceletPhase, projectPoint, scatteredPoint, type CameraView, type Vec3, type ViewPoint } from '@/lib/bracelet-transition';

export function BraceletStardust({ elapsed, reduced, points, view, onPositions }: {
  elapsed: number; reduced: boolean; points: Vec3[]; view: CameraView;
  onPositions: (points: ViewPoint[]) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const callback = useRef(onPositions); callback.current = onPositions;
  useEffect(() => {
    const c = ref.current, g = c?.getContext('2d');
    if (!c || !g) return;
    const width = innerWidth, height = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (c.width !== Math.round(width * dpr) || c.height !== Math.round(height * dpr)) {
      c.width = Math.round(width * dpr); c.height = Math.round(height * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, width, height);
    const phase = braceletPhase(elapsed, reduced);
    const positions = points.map((point, i) => scatteredPoint(projectPoint(point, view), i, phase.spread, width, height));
    callback.current(positions);
    positions.forEach((point, i) => {
      const shimmer = reduced ? .8 : .72 + .28 * Math.sin(i * 2.1 + elapsed * .002) ** 2;
      g.globalAlpha = phase.stars * shimmer * (1 - phase.spread * .22);
      g.fillStyle = i % 11 === 0 ? '#ffb3de' : '#fff0fa';
      const r = i % 29 === 0 ? 1.45 : .68 + (i % 5) * .12;
      g.beginPath(); g.arc(point.x, point.y, r, 0, Math.PI * 2); g.fill();
      if (i % 43 === 0 && !reduced) {
        g.globalAlpha *= .4; const ray = 3 + 2 * shimmer;
        g.fillRect(point.x - ray, point.y - .3, ray * 2, .6);
        g.fillRect(point.x - .3, point.y - ray, .6, ray * 2);
      }
    });
  }, [elapsed, reduced, points, view]);
  return createPortal(<canvas ref={ref} className="bracelet-stardust" aria-hidden="true" />, document.body);
}
