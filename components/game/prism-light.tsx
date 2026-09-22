'use client';
// The continuous canvas reads current values from its RAF and exposes a two-dimensional gesture surface.
/* oxlint-disable react/react-compiler, jsx-a11y/prefer-tag-over-role */
import { useEffect, useRef } from 'react';
import { MOTION, softStep } from '@/lib/motion';

export function PrismLight({ value, bloom, paused, locked, onChange, entrance = 1 }: {
  value: number; bloom: number; paused: boolean; locked: boolean; onChange: (n: number) => void; entrance?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number } | null>(null);
  const current = useRef({ value, bloom, paused, entrance }); current.current = { value, bloom, paused, entrance };
  useEffect(() => { if (paused || locked) drag.current = null; }, [paused, locked]);
  useEffect(() => {
    const cancel = () => { drag.current = null; };
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    const c = canvas.current!, ctx = c.getContext('2d'); if (!ctx) return;
    let frame = 0, last = 0, time = 0, angle = current.current.value;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = media.matches;
    const motion = () => { reduced = media.matches; }; media.addEventListener('change', motion);
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || current.current.paused) { last = now; return; }
      if (now-last < 32) return;
      time += Math.min(60, now-last); last = now;
      const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (w <= 0 || h <= 0) return;
      if (c.width !== Math.round(w*dpr) || c.height !== Math.round(h*dpr)) { c.width = Math.round(w*dpr); c.height = Math.round(h*dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      angle += (current.current.value-angle)*(reduced ? 1 : .085);
      const spread = softStep(current.current.bloom/MOTION.prismBloom), close = Math.exp(-(((angle-68)/13)**2));
      const power = current.current.entrance, drift = reduced ? 0 : time*.00023;
      const cx = w*.44, cy = h*.49, size = Math.min(w*.2, h*.23), end = w*.98;
      ctx.globalCompositeOperation = 'lighter';
      const input = ctx.createLinearGradient(w*.18, h*.22, cx, cy);
      input.addColorStop(0, '#e6eeff00'); input.addColorStop(.72, `rgba(232,240,255,${power*.4})`); input.addColorStop(1, `rgba(255,247,253,${power*.7})`);
      ctx.strokeStyle = input; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(w*.18, h*.22); ctx.quadraticCurveTo(w*.29, h*.37, cx, cy); ctx.stroke();
      // Overlapping curved bands and sparse travelling points keep the light continuous.
      for (let i = 0; i < 84; i++) {
        const f = i/83, ribbon = reduced ? 0 : Math.sin(drift+f*7)*h*.014;
        const offset = (f-.5)*(h*.38+spread*h*.34), shift = (angle-50)*h*.0018;
        const ey = cy+offset+shift+ribbon;
        const band = ctx.createLinearGradient(cx, cy, end, ey);
        const hue = (266-f*236)*(1-close)+326*close;
        const alpha = (.014+Math.sin(f*Math.PI)*.021)*(1-spread*.25)*power;
        band.addColorStop(0, `hsla(${hue},85%,86%,${alpha*.5})`);
        band.addColorStop(.28, `hsla(${hue},92%,82%,${alpha})`);
        band.addColorStop(.72, `hsla(${hue},92%,82%,${alpha*.72})`);
        band.addColorStop(1, `hsla(${hue},90%,80%,0)`);
        ctx.strokeStyle = band; ctx.lineWidth = 3+spread*5;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.bezierCurveTo(cx+w*.18, cy+offset*.23+ribbon, end-w*.18, ey-ribbon, end, ey); ctx.stroke();
        if (!reduced && i%6 === 0) {
          const t = (time*.00008+f*.87)%1, u = 1-t;
          const x = u*u*u*cx+3*u*u*t*(cx+w*.18)+3*u*t*t*(end-w*.18)+t*t*t*end;
          const y = u*u*u*cy+3*u*u*t*(cy+offset*.23+ribbon)+3*u*t*t*(ey-ribbon)+t*t*t*ey;
          ctx.fillStyle = `hsla(${hue},80%,91%,${Math.sin(t*Math.PI)*.32*power})`;
          ctx.beginPath(); ctx.arc(x, y, .6+(i%3)*.2, 0, Math.PI*2); ctx.fill();
        }
      }
      const glow = ctx.createRadialGradient(cx+size*.4, cy, 0, cx+size*.4, cy, size*(2+spread*2.5));
      glow.addColorStop(0, `rgba(255,211,238,${(.025+close*.05+Math.sin(spread*Math.PI)*.07)*power})`);
      glow.addColorStop(.5, `rgba(216,213,255,${.012*power})`); glow.addColorStop(1, '#f3d6ed00');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((angle-50)*.009);
      const glass = ctx.createLinearGradient(-size, -size, size, size);
      glass.addColorStop(0, '#d7e4ff08'); glass.addColorStop(.6, '#c9dcff18'); glass.addColorStop(1, '#fff1fb05');
      ctx.globalAlpha = 1-spread*.38; ctx.fillStyle = glass; ctx.strokeStyle = '#dce7fa88'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(-size*.86, size*.65); ctx.lineTo(size*.86, size*.65); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#e4ddfa38'; ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size*.13, size*.35);
      ctx.lineTo(-size*.86, size*.65); ctx.moveTo(size*.13, size*.35); ctx.lineTo(size*.86, size*.65); ctx.stroke(); ctx.restore();
      ctx.globalAlpha = 1;
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); media.removeEventListener('change', motion); };
  }, []);
  return <div className="prism-light" role="slider" tabIndex={paused || locked ? -1 : 0} aria-label="左右拖动棱镜，观察光的变化"
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-disabled={paused || locked}
    onKeyDown={(e) => { if (paused || locked) return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); onChange(value+(e.key === 'ArrowRight' ? 2 : -2)); } }}
    onPointerDown={(e) => { if (paused || locked || document.hidden || drag.current || e.button > 0) return;
      drag.current = { id: e.pointerId, x: e.clientX }; e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerMove={(e) => { if (!drag.current || drag.current.id !== e.pointerId || paused || locked) return;
      onChange(value+(e.clientX-drag.current.x)*.32); drag.current.x = e.clientX; }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
    onLostPointerCapture={() => { drag.current = null; }} onBlur={() => { drag.current = null; }}>
    <canvas ref={canvas} aria-hidden="true" />
  </div>;
}
