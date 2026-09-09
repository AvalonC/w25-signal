'use client';
/* oxlint-disable next/no-img-element */
import { createElement, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import type { CameraView } from '@/lib/bracelet-transition';
export type ModelSurfaceHandle = { camera: () => CameraView | null };
type Viewer = HTMLElement & {
  loaded?: boolean;
  getCameraOrbit: () => { theta: number; phi: number; radius: number };
  getCameraTarget: () => { x: number; y: number; z: number };
  getFieldOfView: () => number;
  jumpCameraToGoal: () => void;
  updateComplete: Promise<unknown>;
};
let registration: Promise<unknown> | undefined;
function registerViewer() {
  registration ??= import('@google/model-viewer').catch((error: unknown) => {
    registration = undefined; throw error;
  });
  return registration;
}
export function ModelSurface({ src, poster, label, orbit = '0deg 32deg 110%', onReady, children, viewerRef, interactive = true, frozen = false }: {
  src: string; poster: string; label: string; orbit?: string;
  onReady?: (ready: boolean) => void; children?: ReactNode;
  viewerRef?: Ref<ModelSurfaceHandle>; interactive?: boolean;
  frozen?: boolean;
}) {
  const element = useRef<HTMLElement | null>(null);
  const callback = useRef(onReady);
  callback.current = onReady;
  const [registered, setRegistered] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const lastDisplay = useRef(status);
  if (!frozen) lastDisplay.current = status;
  const displayStatus = frozen ? lastDisplay.current : status;
  useImperativeHandle(viewerRef, () => ({
    camera: () => {
      const el = element.current as Viewer | null;
      if (!el?.loaded || typeof el.getCameraOrbit !== 'function') return null;
      const rect = el.getBoundingClientRect(), camera = el.getCameraOrbit(), target = el.getCameraTarget();
      // Stop residual orbit damping at the captured pose before fading away.
      el.setAttribute('camera-orbit', `${camera.theta}rad ${camera.phi}rad ${camera.radius}m`);
      void el.updateComplete.then(() => { if (el.isConnected) el.jumpCameraToGoal(); });
      return { ...camera, target: [target.x, target.y, target.z], fov: el.getFieldOfView(),
        left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    },
  }), [orbit]);
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
  return <div className={'model-surface model-' + displayStatus}>
    {displayStatus !== 'ready' && <img className="model-fallback" src={poster} alt={label} draggable={false} />}
    {registered && createElement('model-viewer', {
      key: src + attempt, ref: element, src, alt: label,
      'camera-controls': interactive ? '' : undefined, 'disable-pan': '', 'disable-zoom': '',
      'camera-orbit': orbit, 'interaction-prompt': 'none',
      'touch-action': 'pan-y', exposure: '1.15',
      'min-camera-orbit': 'auto 12deg auto', 'max-camera-orbit': 'auto 85deg auto',
      'environment-image': 'neutral', 'shadow-intensity': '0',
    }, status === 'ready' ? children : null)}
    {status === 'loading' && <span className="model-status" role="status">星光正在靠近…</span>}
    {status === 'failed' && <button className="model-status" onClick={() => setAttempt((n) => n + 1)}>暂用静态影像 · 轻触重新加载</button>}
  </div>;
}
