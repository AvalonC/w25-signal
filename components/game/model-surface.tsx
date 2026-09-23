'use client';
/* oxlint-disable next/no-img-element, react/react-compiler */
import { createElement, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
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
// Projection updates must never freeze the camera as the handoff capture does.
function readView(el: Viewer): CameraView | null {
  if (!el.loaded || typeof el.getCameraOrbit !== 'function' || typeof el.getCameraTarget !== 'function' ||
      typeof el.getFieldOfView !== 'function') return null;
  const rect = el.getBoundingClientRect(), camera = el.getCameraOrbit(), target = el.getCameraTarget();
  const view: CameraView = { ...camera, target: [target.x, target.y, target.z], fov: el.getFieldOfView(),
    left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  return view.width > 0 && view.height > 0 && viewValues(view).every(Number.isFinite) ? view : null;
}
function viewValues(view: CameraView) {
  return [view.theta, view.phi, view.radius, ...view.target, view.fov, view.left, view.top, view.width, view.height];
}
let registration: Promise<unknown> | undefined;
function registerViewer() {
  registration ??= import('@google/model-viewer').catch((error: unknown) => {
    registration = undefined; throw error;
  });
  return registration;
}
export function ModelSurface({ src, poster, label, orbit = '0deg 32deg 110%', target, onReady, onViewChange, children, viewerRef, interactive = true, frozen = false, interpolationDecay }: {
  src: string; poster: string; label: string; orbit?: string;
  onReady?: (ready: boolean) => void; onViewChange?: (view: CameraView | null) => void; children?: ReactNode;
  viewerRef?: Ref<ModelSurfaceHandle>; interactive?: boolean;
  frozen?: boolean; target?: string; interpolationDecay?: number;
}) {
  const element = useRef<HTMLElement | null>(null);
  const callback = useRef(onReady);
  callback.current = onReady;
  const viewCallback = useRef(onViewChange);
  viewCallback.current = onViewChange;
  const lastView = useRef<CameraView | null | undefined>(undefined);
  const observingView = !!onViewChange;
  const publishView = useCallback((view: CameraView | null) => {
    const previous = lastView.current, values = view ? viewValues(view) : null;
    if (previous === view || previous && values && viewValues(previous).every((value, index) => value === values[index])) return;
    lastView.current = view;
    viewCallback.current?.(view);
  }, []);
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
  }), []);
  useEffect(() => {
    let active = true;
    setStatus('loading'); callback.current?.(false); publishView(null);
    registerViewer().then(() => { if (active) setRegistered(true); })
      .catch(() => { if (active) setStatus('failed'); });
    const timer = setTimeout(() => { if (active) setStatus((s) => s === 'ready' ? s : 'failed'); }, 25000);
    return () => { active = false; clearTimeout(timer); };
  }, [attempt, src, publishView]);
  useEffect(() => { if (status === 'failed') publishView(null); }, [status, publishView]);
  useEffect(() => {
    const el = element.current as Viewer | null;
    if (!el || !registered) return;
    let active = true, usable = !!el.loaded;
    const changed = () => {
      if (active && viewCallback.current) publishView(usable ? readView(el) : null);
    };
    const resized = () => {
      changed();
      // The viewer adjusts its field of view during its own resize update.
      void el.updateComplete.then(changed);
    };
    const loaded = () => { usable = true; setStatus('ready'); callback.current?.(true); resized(); };
    const failed = () => { usable = false; setStatus('failed'); callback.current?.(false); publishView(null); };
    el.addEventListener('load', loaded); el.addEventListener('error', failed);
    el.addEventListener('webglcontextlost', failed);
    if (observingView) el.addEventListener('camera-change', changed);
    const observer = observingView && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resized) : null;
    observer?.observe(el);
    if (el.loaded) loaded(); else changed();
    return () => {
      active = false; observer?.disconnect();
      el.removeEventListener('load', loaded); el.removeEventListener('error', failed);
      el.removeEventListener('webglcontextlost', failed); el.removeEventListener('camera-change', changed);
    };
  }, [registered, attempt, src, observingView, publishView]);
  return <div className={'model-surface model-' + displayStatus}>
    {displayStatus !== 'ready' && <img className="model-fallback" src={poster} alt={label} draggable={false} />}
    {registered && createElement('model-viewer', {
      key: src + attempt, ref: element, src, alt: label,
      'camera-controls': interactive ? '' : undefined, 'disable-pan': '', 'disable-zoom': '',
      'camera-orbit': orbit, 'camera-target': target, 'interaction-prompt': 'none',
      'interpolation-decay': interpolationDecay ?? 50,
      'touch-action': 'pan-y', exposure: '1.15',
      'min-camera-orbit': 'auto 12deg auto', 'max-camera-orbit': 'auto 85deg auto',
      'environment-image': 'neutral', 'shadow-intensity': '0',
    }, status === 'ready' ? children : null)}
    {status === 'loading' && <output className="model-status">星光正在靠近…</output>}
    {status === 'failed' && <button className="model-status" onClick={() => setAttempt((n) => n + 1)}>暂用静态影像 · 轻触重新加载</button>}
  </div>;
}
