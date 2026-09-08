'use client';
// Canvas and SVG are the image surfaces; replacing them with img would remove the interaction.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useEffect, useRef, useState } from 'react';
type Obj = {
  name: string;
  pink: boolean;
  vertices: number[][];
  edges: number[][];
};
export function WireBracelet({
  onGem,
  onScatter,
}: {
  onGem: () => void;
  onScatter: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    [objects, setObjects] = useState<Obj[]>([]),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [angle, setAngle] = useState(0),
    [hotspot, setHotspot] = useState({ x: 50, y: 50 });
  const rotation = useRef(0),
    start = useRef<number | null>(null);
  useEffect(() => {
    rotation.current = angle;
  }, [angle]);
  const [departing, setDeparting] = useState(false),
    scatterAt = useRef(0),
    onDone = useRef(onGem);
  useEffect(() => {
    onDone.current = onGem;
  }, [onGem]);
  useEffect(() => {
    const a = new AbortController();
    fetch('models/bracelet-wire.json', { signal: a.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        const data = d as { objects: Obj[] };
        if (!Array.isArray(data.objects) || !data.objects.length)
          throw Error('No geometry');
        setObjects(data.objects);
      })
      .catch(() => {
        if (!a.signal.aborted) setFailed(true);
      });
    return () => a.abort();
  }, [attempt]);
  useEffect(() => {
    if (!objects.length) return;
    const canvas = ref.current!,
      ctx = canvas.getContext('2d');
    if (!ctx) return;
    const verts = objects.flatMap((o) => o.vertices);
    const min = [0, 1, 2].map((i) =>
        verts.reduce((n, v) => Math.min(n, v[i]), Infinity),
      ),
      max = [0, 1, 2].map((i) =>
        verts.reduce((n, v) => Math.max(n, v[i]), -Infinity),
      );
    const center = min.map((n, i) => (n + max[i]) / 2),
      span = max[0] - min[0];
    let w = 0,
      h = 0,
      frame = 0,
      previous = 0;
    const t0 = performance.now();
    const pink =
      objects.find(
        (o) =>
          o.pink &&
          o.name.includes('four-point') &&
          o.name.includes('brilliant'),
      ) ?? objects.find((o) => o.pink)!;
    const gem = pink.vertices.reduce(
      (sum, v) => sum.map((n, i) => n + v[i] / pink.vertices.length),
      [0, 0, 0],
    );
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      const dpr = Math.min(devicePixelRatio, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    let lastX = -1,
      lastY = -1;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (t: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || t - previous < 40) return;
      previous = t;
      const vertical = w < 600;
      const scale = (vertical ? h * 0.85 : w * 0.9) / span;
      const r = rotation.current * 0.012;
      const project = (v: number[]) => {
        const x = (v[0] - center[0]) * scale,
          y =
            ((v[1] - center[1]) * Math.cos(r) -
              (v[2] - center[2]) * Math.sin(r)) *
            scale,
          z =
            ((v[1] - center[1]) * Math.sin(r) +
              (v[2] - center[2]) * Math.cos(r)) *
            scale;
        return vertical
          ? { x: w / 2 - y * 2, y: h / 2 + x, z }
          : { x: w / 2 + x, y: h / 2 + y * 2, z };
      };
      const loc = project(gem);
      if (Math.abs(loc.x - lastX) > 1 || Math.abs(loc.y - lastY) > 1) {
        lastX = loc.x;
        lastY = loc.y;
        setHotspot({ x: loc.x, y: loc.y });
      }
      ctx.clearRect(0, 0, w, h);
      const reveal = reduced ? 1 : Math.min(1, (t - t0) / 1800),
        scatter = scatterAt.current
          ? Math.min(1, (t - scatterAt.current) / (reduced ? 200 : 1100))
          : 0;
      if (scatter >= 1) {
        cancelAnimationFrame(frame);
        onDone.current();
        return;
      }
      for (const o of objects) {
        const ps = o.vertices.map((v, i) => {
          const p = project(v);
          return {
            x: p.x + (p.x - w / 2 + Math.sin(i * 17) * w * 0.45) * scatter * 2,
            y: p.y + (p.y - h / 2 + Math.cos(i * 13) * h * 0.45) * scatter * 2,
          };
        });
        ctx.strokeStyle = o.pink ? '#ffb3de' : '#a0bdd7';
        ctx.lineWidth = o.pink ? 0.75 : 0.35;
        ctx.globalAlpha = (o.pink ? 0.8 : 0.23) * reveal * (1 - scatter);
        ctx.beginPath();
        for (const [a, b] of o.edges) {
          ctx.moveTo(ps[a].x, ps[a].y);
          ctx.lineTo(ps[b].x, ps[b].y);
        }
        ctx.stroke();
        ctx.fillStyle = o.pink ? '#ffb3de' : '#f0eeed';
        ctx.globalAlpha = 0.7 * reveal;
        for (let i = 0; i < ps.length; i += 17) {
          const p = ps[i],
            scatter = (1 - reveal) * 35;
          ctx.beginPath();
          ctx.arc(
            p.x + Math.sin(i) * scatter,
            p.y + Math.cos(i) * scatter,
            0.75,
            0,
            7,
          );
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [objects]);
  return (
    <div className="wire-wrap">
      <div
        className="wire-touch"
        onPointerDown={(e) => {
          start.current = e.clientX;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (start.current !== null) {
            setAngle((a) => a + e.clientX - start.current!);
            start.current = e.clientX;
          }
        }}
        onPointerUp={() => (start.current = null)}
        onPointerCancel={() => (start.current = null)}
      >
        <canvas
          ref={ref}
          role="img"
          aria-label="从原始 Blender 手链提取的星光线框：四角星、中央粉色宝石、短圆镶座、长条镶座和延长链"
        />
      </div>
      {objects.length > 0 && !departing && (
        <button
          className="gem-hotspot"
          aria-label="触碰四角星中央的粉色蓝宝石"
          style={{ left: hotspot.x, top: hotspot.y }}
          onClick={() => {
            scatterAt.current = performance.now();
            setDeparting(true);
            onScatter();
          }}
        >
          <span>✦</span>
        </button>
      )}
      {!objects.length && (
        <div className="model-message">
          {failed ? (
            <>
              <p>这束光暂时没有接通。</p>
              <button
                onClick={() => {
                  setFailed(false);
                  setAttempt((a) => a + 1);
                }}
              >
                重新接通模型
              </button>
            </>
          ) : (
            <p>星星正在找到自己的位置…</p>
          )}
        </div>
      )}
      <div className="wire-controls">
        <button
          onClick={() => setAngle((a) => a - 20)}
          aria-label="向左转动手链"
        >
          ↶
        </button>
        <span>拖动查看 · 轻触粉色宝石</span>
        <button
          onClick={() => setAngle((a) => a + 20)}
          aria-label="向右转动手链"
        >
          ↷
        </button>
      </div>
    </div>
  );
}
export function Sapphire({ rotation = 0 }: { rotation?: number }) {
  const points = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 + rotation * 0.012;
    return { x: 150 + 86 * Math.cos(a), y: 125 + 48 * Math.sin(a), a };
  });
  const inner = points.map((p) => ({
    x: 150 + (p.x - 150) * 0.52,
    y: 91 + (p.y - 125) * 0.52,
  }));
  return (
    <svg
      className="sapphire"
      viewBox="0 0 300 280"
      role="img"
      aria-label="可旋转的粉色蓝宝石切面"
    >
      <defs>
        <radialGradient id="gem-light">
          <stop stopColor="#fff3fc" />
          <stop offset=".38" stopColor="#ffb3de" />
          <stop offset="1" stopColor="#532e63" />
        </radialGradient>
      </defs>
      {points.map((p, i) => {
        const q = points[(i + 1) % 8],
          a = inner[i],
          b = inner[(i + 1) % 8];
        return (
          <g key={i}>
            <path
              d={'M' + p.x + ',' + p.y + 'L' + q.x + ',' + q.y + 'L150,232Z'}
              fill={i % 2 ? '#ad639b' : '#f2b2d9'}
              fillOpacity={0.3 + (Math.sin(rotation * 0.012 + i) + 1) * 0.23}
              stroke="#ffd1eb"
              strokeWidth=".5"
            />
            <path
              d={
                'M' +
                p.x +
                ',' +
                p.y +
                'L' +
                q.x +
                ',' +
                q.y +
                'L' +
                b.x +
                ',' +
                b.y +
                'L' +
                a.x +
                ',' +
                a.y +
                'Z'
              }
              fill="url(#gem-light)"
              stroke="#ffd9ef"
              strokeWidth=".65"
            />
          </g>
        );
      })}
      <polygon
        points={inner.map((p) => p.x + ',' + p.y).join(' ')}
        fill="url(#gem-light)"
        stroke="#ffe2f2"
      />
      <path
        d="M150 77v28m-14-14h28"
        stroke="white"
        opacity={0.3 + (Math.sin(rotation * 0.06) + 1) * 0.35}
      />
    </svg>
  );
}
