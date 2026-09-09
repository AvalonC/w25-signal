'use client';
import { useEffect, useRef, useState } from 'react';
/** Scene time stops in hidden tabs and while help covers the scene. */
export function useVisibleClock(active: boolean, identity: string | number = 0) {
  const [snapshot, setSnapshot] = useState({ identity, elapsed: 0 });
  const time = useRef(0);
  useEffect(() => { time.current = 0; setSnapshot({ identity, elapsed: 0 }); }, [identity]);
  useEffect(() => {
    if (!active) return;
    let frame = 0, last = performance.now(), painted = 0;
    const tick = (now: number) => {
      if (!document.hidden) time.current += Math.min(now - last, 80);
      last = now;
      if (now - painted > 32) { setSnapshot({ identity, elapsed: time.current }); painted = now; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, identity]);
  return snapshot.identity === identity ? snapshot.elapsed : 0;
}
