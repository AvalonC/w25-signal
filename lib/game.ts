export const WORDS = [
 ['勇气','COURAGE','愿你敢于走向，心里向往的方向。'],
 ['幸运','LUCK','愿生活偶尔偏心，把好事留给你。'],
 ['惊喜','WONDER','愿平常的日子，也有值得期待的光。'],
 ['平静','PEACE','愿你忙碌之后，仍有安静的港湾。'],
 ['爱','LOVE','愿你被温柔地爱着，也自在地去爱。'],
 ['好奇','CURIOSITY','愿世界很大，而你的好奇从未变小。'],
 ['归属','HOME','愿无论走多远，总有人等你回家。'],
 ['明天','TOMORROW','愿每一个明天，都有新的可能。'],
] as const;
export const MORSE = ['.--','..---','.....'] as const;
export const LETTERS = ['W','2','5'];
export const CHAPTERS = ['随身的愿望','光的颜色','星星的语言','记住你的石头','解开回声','让星光成形','最后一段距离'];
export interface GameState { version:1; chapter:number; unlocked:number; wishes:number[]; colorDone:boolean; stars:number; facets:number[]; decoded:number; assembled:number; delivery:'idle'|'waiting'|'ready'|'complete'; deadline:number; hints:number[]; }
export const initialState:GameState={version:1,chapter:0,unlocked:0,wishes:[],colorDone:false,stars:0,facets:[],decoded:0,assembled:0,delivery:'idle',deadline:0,hints:[0,0,0,0,0,0,0,0]};
export type Action={type:'restore';state:GameState}|{type:'wishes';values:number[]}|{type:'next'}|{type:'visit';chapter:number}|{type:'color'}|{type:'star';index:number}|{type:'facet';index:number}|{type:'decode';pattern:string}|{type:'assemble'}|{type:'delivery-start';deadline:number}|{type:'delivery-ready'}|{type:'receive'}|{type:'hint'}|{type:'reset'};
export function canContinue(s:GameState){return [true,s.wishes.length===4,s.colorDone,s.stars===13,s.facets.length===3,s.decoded===3,s.assembled===4,false][s.chapter]??false;}
export function transition(s:GameState,a:Action):GameState {
 switch(a.type){
 case 'restore':return restore(JSON.stringify(a.state));
 case 'reset':return {...initialState,hints:[...initialState.hints]};
 case 'wishes':return s.chapter===1&&a.values.length<=4&&a.values.every(n=>Number.isInteger(n)&&n>=0&&n<8)&&new Set(a.values).size===a.values.length?{...s,wishes:[...a.values]}:s;
 case 'next':return canContinue(s)?{...s,chapter:s.chapter+1,unlocked:Math.max(s.unlocked,s.chapter+1)}:s;
 case 'visit':return Number.isInteger(a.chapter)&&a.chapter>=0&&a.chapter<=s.unlocked?{...s,chapter:a.chapter}:s;
 case 'color':return s.chapter===2?{...s,colorDone:true}:s;
 case 'star':return s.chapter===3&&a.index===s.stars&&s.stars<13?{...s,stars:s.stars+1}:s;
 case 'facet':return s.chapter===4&&a.index>=0&&a.index<3&&!s.facets.includes(a.index)?{...s,facets:[...s.facets,a.index]}:s;
 case 'decode':return s.chapter===5&&a.pattern===MORSE[s.decoded]?{...s,decoded:s.decoded+1}:s;
 case 'assemble':return s.chapter===6&&s.assembled<4?{...s,assembled:s.assembled+1}:s;
 case 'delivery-start':return s.chapter===7&&s.delivery==='idle'&&Number.isFinite(a.deadline)?{...s,delivery:'waiting',deadline:a.deadline}:s;
 case 'delivery-ready':return s.chapter===7&&s.delivery==='waiting'?{...s,delivery:'ready'}:s;
 case 'receive':return s.chapter===7&&s.delivery==='ready'?{...s,delivery:'complete'}:s;
 case 'hint':{const hints=[...s.hints];hints[s.chapter]=Math.min(3,hints[s.chapter]+1);return {...s,hints};}
 }
}
export function restore(raw:string|null):GameState {
 if(!raw)return {...initialState};
 try{
 const s=JSON.parse(raw) as GameState;
 if(s.version!==1||!Number.isInteger(s.chapter)||s.chapter<0||s.chapter>7||!Number.isInteger(s.unlocked)||s.unlocked<s.chapter||s.unlocked>7)throw Error();
 if(!Array.isArray(s.wishes)||s.wishes.length>4||new Set(s.wishes).size!==s.wishes.length||!s.wishes.every(n=>Number.isInteger(n)&&n>=0&&n<8))throw Error();
 if(typeof s.colorDone!=='boolean'||!Number.isInteger(s.stars)||s.stars<0||s.stars>13||!Number.isInteger(s.decoded)||s.decoded<0||s.decoded>3||!Number.isInteger(s.assembled)||s.assembled<0||s.assembled>4)throw Error();
 if(!Array.isArray(s.facets)||s.facets.length>3||new Set(s.facets).size!==s.facets.length||!s.facets.every(n=>Number.isInteger(n)&&n>=0&&n<3))throw Error();
 if(!['idle','waiting','ready','complete'].includes(s.delivery)||!Number.isFinite(s.deadline)||!Array.isArray(s.hints)||s.hints.length!==8||!s.hints.every(n=>Number.isInteger(n)&&n>=0&&n<=3))throw Error();
 const requirements=[true,true,s.wishes.length===4,s.colorDone,s.stars===13,s.facets.length===3,s.decoded===3,s.assembled===4];
 for(let i=1;i<=s.unlocked;i++)if(!requirements[i])throw Error();
 return s;
 }catch{return {...initialState};}
}
export function signalTimings(pattern:string,unit=180){
 const values:number[]=[];
 for(const symbol of pattern){if(symbol===' ') {if(values.length)values[values.length-1]=unit*3;continue;}values.push(symbol==='.'?unit:unit*3,unit);}
 return values;
}
