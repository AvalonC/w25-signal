export type GemVertex = [number,number,number];
export type GemPoint = {x:number;y:number;z:number};
// A regular round-cut stone sits inside the four-point setting. The setting
// supplies the star silhouette; the stone itself has a continuous girdle.
export const SAPPHIRE_VERTICES:GemVertex[]=[];
export const SAPPHIRE_EDGES:[number,number][]=[];
export const SAPPHIRE_FACES:number[][]=[];
for(let layer=0;layer<2;layer++)for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,radius=layer?.96:.48;
  SAPPHIRE_VERTICES.push([Math.cos(angle)*radius,layer?-.08:.4,Math.sin(angle)*radius]);
  SAPPHIRE_EDGES.push([layer*8+i,layer*8+(i+1)%8]);
  if(layer){SAPPHIRE_EDGES.push([i,8+i],[i,8+(i+1)%8]);
    SAPPHIRE_FACES.push([i,8+i,8+(i+1)%8],[i,8+(i+1)%8,(i+1)%8]);}
}
SAPPHIRE_VERTICES.push([0,-.9,0]);
for(let i=0;i<8;i++){SAPPHIRE_EDGES.push([8+i,16]);SAPPHIRE_FACES.push([8+i,16,8+(i+1)%8]);}
SAPPHIRE_FACES.push([0,1,2,3,4,5,6,7]);

export function projectSapphire(point:GemVertex,angle:number,width:number,height:number):GemPoint {
  const scale=Math.min(width*.3,height*.29);
  const x=point[0]*Math.cos(angle)-point[2]*Math.sin(angle),z=point[0]*Math.sin(angle)+point[2]*Math.cos(angle);
  const y=point[1]*.88-z*.48,depth=point[1]*.48+z*.88;
  return {x:width*.5+x*scale*(3/(3+depth)),y:height*.47-y*scale*(3/(3+depth)),z:depth};
}

export function gemstoneOutline(points:GemPoint[]):GemPoint[] {
  const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(a:GemPoint,b:GemPoint,c:GemPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half=(items:GemPoint[])=>{const result:GemPoint[]=[];for(const p of items){while(result.length>1&&cross(result[result.length-2],result[result.length-1],p)<=0)result.pop();result.push(p);}return result;};
  return [...half(sorted).slice(0,-1),...half(sorted.reverse()).slice(0,-1)];
}
