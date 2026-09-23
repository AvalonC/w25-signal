export type LibraPoint = readonly [number, number];
type LibraStroke = readonly [LibraPoint, ...LibraPoint[]];
type LibraCurve = readonly [LibraPoint, LibraPoint, LibraPoint];

export const LIBRA_GEOMETRY = {
  beam: [[-.78, -.75], [.78, -.75]],
  axis: [[0, -.9], [0, .76]],
  crown: [[-.075, -.825], [0, -.9], [.075, -.825]],
  hangers: [
    [[-.78, -.75], [-1.045, .21]],
    [[-.78, -.75], [-.515, .21]],
    [[.78, -.75], [.515, .21]],
    [[.78, -.75], [1.045, .21]],
  ],
  panRims: [
    [[-1.045, .21], [-.515, .21]],
    [[.515, .21], [1.045, .21]],
  ],
  panBowls: [
    [[-1.045, .21], [-.78, .535], [-.515, .21]],
    [[.515, .21], [.78, .535], [1.045, .21]],
  ],
  stem: [[0, .76], [-.052, .815], [-.145, .89], [.145, .89], [.052, .815], [0, .76]],
  upperStep: [[-.235, .89], [.235, .89], [.32, .99], [-.32, .99], [-.235, .89]],
  lowerStep: [[-.32, .99], [.32, .99], [.435, 1.1], [-.435, 1.1], [-.32, .99]],
  baseFoot: [[-.435, 1.1], [0, 1.16], [.435, 1.1]],
  stars: [[-.78, -.75], [0, -.75], [.78, -.75], [-.78, .3725], [.78, .3725]],
} as const satisfies {
  beam: LibraStroke; axis: LibraStroke; crown: LibraStroke;
  hangers: readonly LibraStroke[]; panRims: readonly LibraStroke[]; panBowls: readonly LibraCurve[];
  stem: LibraStroke; upperStep: LibraStroke; lowerStep: LibraStroke; baseFoot: LibraCurve;
  stars: readonly LibraPoint[];
};

export function projectLibraPoint(point: LibraPoint, cx: number, cy: number, scale: number, rotation = 0) {
  const cosine = Math.cos(rotation), sine = Math.sin(rotation);
  return {
    x: cx + (point[0] * cosine - point[1] * sine) * scale,
    y: cy + (point[0] * sine + point[1] * cosine) * scale,
  };
}

type LibraDiscoveryOptions = {
  cx: number;
  cy: number;
  scale: number;
  angle: number;
  targetAngle: number;
  alignment: number;
  found: boolean;
  time: number;
  reduced: boolean;
  opacity: number;
};

export function drawLibraDiscovery(ctx: CanvasRenderingContext2D, options: LibraDiscoveryOptions) {
  const { cx, cy, scale, angle, targetAngle, found, time, reduced } = options;
  if (scale <= 0 || options.opacity <= 0) return;
  const strength = Math.max(0, Math.min(1, options.alignment));
  const close = strength * strength * (3 - 2 * strength);
  const opacity = Math.max(0, Math.min(1, options.opacity));
  const offset = Math.atan2(Math.sin(angle - targetAngle), Math.cos(angle - targetAngle));
  const unit = Math.max(.8, Math.min(1.15, scale / 112));
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const paint = (rotation: number, alpha: number, colour: string, reference: boolean) => {
    if (alpha < .001) return;
    const project = (point: LibraPoint) => projectLibraPoint(point, cx, cy, scale, rotation);
    ctx.setLineDash(reference ? [1.4 * unit, 4.8 * unit] : []);
    const line = (points: LibraStroke, weight = 1, fade = 1) => {
      ctx.strokeStyle = `rgba(${colour},${alpha * fade})`;
      ctx.lineWidth = (reference ? .7 : weight) * unit;
      ctx.beginPath();
      points.forEach((point, index) => {
        const p = project(point);
        if (index) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
      });
      ctx.stroke();
    };
    const curve = (points: LibraCurve, weight = 1, fade = 1) => {
      const [start, control, end] = points.map(project);
      ctx.strokeStyle = `rgba(${colour},${alpha * fade})`;
      ctx.lineWidth = (reference ? .7 : weight) * unit;
      ctx.beginPath(); ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo(control.x, control.y, end.x, end.y); ctx.stroke();
    };
    line(LIBRA_GEOMETRY.axis, .85, .54);
    line(LIBRA_GEOMETRY.crown, .85, .85);
    line(LIBRA_GEOMETRY.beam, 1.25);
    LIBRA_GEOMETRY.hangers.forEach((hanger) => line(hanger, .85, .72));
    LIBRA_GEOMETRY.panRims.forEach((rim) => line(rim, 1, .92));
    LIBRA_GEOMETRY.panBowls.forEach((bowl) => curve(bowl, 1.15));
    line(LIBRA_GEOMETRY.stem, .85, .78);
    line(LIBRA_GEOMETRY.upperStep, .95, .93);
    line(LIBRA_GEOMETRY.lowerStep, 1.05);
    curve(LIBRA_GEOMETRY.baseFoot, .8, .48);

    if (reference) return;
    ctx.setLineDash([]);
    const breath = reduced || found ? 1 : .88 + Math.sin(time * .0011) ** 2 * .12;
    LIBRA_GEOMETRY.stars.forEach((point, index) => {
      const p = project(point),radius = (index === 1 ? 1.7 : 1.15) * unit;
      ctx.fillStyle = `rgba(${colour},${Math.min(1, alpha * 1.6) * breath})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
      if (found || close < .55 || index > 2) return;
      const span = (index === 1 ? 5.2 : 3.4) * unit;
      ctx.strokeStyle = `rgba(255,239,248,${alpha * (close - .55) * .8})`;
      ctx.lineWidth = .65 * unit;
      ctx.beginPath(); ctx.moveTo(p.x - span, p.y); ctx.lineTo(p.x + span, p.y);
      ctx.moveTo(p.x, p.y - span); ctx.lineTo(p.x, p.y + span); ctx.stroke();
    });
  };

  if (found) {
    paint(0, opacity * .2, '215,226,246', false);
  } else {
    paint(0, opacity * .19 * (1 - close * .9), '182,203,234', true);
    paint(offset, opacity * close * .78, '248,219,238', false);
  }
  ctx.restore();
}
