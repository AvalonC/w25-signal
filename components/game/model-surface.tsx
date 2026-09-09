'use client';
/* oxlint-disable next/no-img-element */
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
let registration: Promise<unknown> | undefined;
function registerViewer() {
  registration ??= import('@google/model-viewer').catch((error: unknown) => {
    registration = undefined; throw error;
  });
  return registration;
}
export function ModelSurface({ src, poster, label, orbit = '0deg 32deg 110%', onReady, children }: {
  src: string; poster: string; label: string; orbit?: string;
  onReady?: (ready: boolean) => void; children?: ReactNode;
}) {
  const element = useRef<HTMLElement | null>(null);
  const callback = useRef(onReady);
  callback.current = onReady;
  const [registered, setRegistered] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setStatus('loading'); callback.current?.(false);
    registerViewer().then(() => { if (active) setRegistered(true); })
      .catch(() => { if (active) setStatus('failed'); });
    const timer = setTimeout(() => { if (active) setStatus((s) => s === 'ready' ? s : 'failed'); }, 25000);
    return () => { active = false; clearTimeout(timer); };
  }, [attempt, src]);
  useEffect(() => {
    const el = element.current;
    if (!el || !registered) return;
    const loaded = () => { setStatus('ready'); callback.current?.(true); };
    const failed = () => { setStatus('failed'); callback.current?.(false); };
    el.addEventListener('load', loaded); el.addEventListener('error', failed);
    el.addEventListener('webglcontextlost', failed);
    if ((el as HTMLElement & { loaded?: boolean }).loaded) loaded();
    return () => {
      el.removeEventListener('load', loaded); el.removeEventListener('error', failed);
      el.removeEventListener('webglcontextlost', failed);
    };
  }, [registered, attempt, src]);
  return <div className={'model-surface model-' + status}>
    {status !== 'ready' && <img className="model-fallback" src={poster} alt={label} draggable={false} />}
    {registered && createElement('model-viewer', {
      key: src + attempt, ref: element, src, alt: label,
      'camera-controls': '', 'disable-pan': '', 'disable-zoom': '',
      'camera-orbit': orbit, 'interaction-prompt': 'none',
      'touch-action': 'pan-y', exposure: '1.15',
      'environment-image': 'neutral', 'shadow-intensity': '0',
    }, status === 'ready' ? children : null)}
    {status === 'loading' && <span className="model-status" role="status">星光正在靠近…</span>}
    {status === 'failed' && <button className="model-status" onClick={() => setAttempt((n) => n + 1)}>暂用静态影像 · 轻触重新加载</button>}
  </div>;
}
