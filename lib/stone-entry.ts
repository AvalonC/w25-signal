export const STONE_LIGHT_ORIGIN = { x:50,y:10 } as const;

/** Project the centre of the sapphire's upper table, matching its canvas pose. */
export function stoneEntry(width:number,height:number) {
  const scale=Math.min(width*.3,height*.29);
  return {x:50,y:47-.330827*scale/Math.max(height,1)*100};
}

export function isStoneEntry(point:{x:number;y:number},width:number,height:number) {
  const entry=stoneEntry(width,height),radius=Math.max(28,Math.min(48,width*.12));
  return Math.hypot((point.x-entry.x)*width/100,(point.y-entry.y)*height/100)<=radius;
}
