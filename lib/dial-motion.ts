// Keep a running angle: December -> January is one tick, never a full rewind.
export function advanceDialRotation(
  rotation: number,
  previous: number,
  next: number,
  max: number,
): number {
  const forwards = ((next - previous) % max + max) % max;
  const ticks = forwards > max / 2 ? forwards - max : forwards;
  return rotation - (ticks * 360) / max;
}
