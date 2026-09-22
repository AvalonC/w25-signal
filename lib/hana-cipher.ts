export const HANA_KEY = [8,1,14,1] as const;
export const CIPHER_TITLE = 'Project N7A-3914';
export const CIPHER_CARRIER = 'ProjectN7A3914';
export const CIPHER_MORSE = '.--..---.....';
// The original pink-dot rule: scan rows left to right, k for a dot,
// k+1 for a dash, and k+2 for the final decoy. Indices wrap per glyph.
export const DOT_GLYPHS:Record<string,string[]> = {
  P:['11110','10001','10001','11110','10000','10000','10000'],
  r:['00000','00000','11100','10010','10000','10000','10000'],
  o:['00000','00000','01110','10001','10001','10001','01110'],
  j:['00100','00000','00100','00100','00100','10100','01000'],
  e:['00000','00000','01110','10001','11111','10000','01110'],
  c:['00000','00000','01110','10000','10000','10000','01110'],
  t:['01000','01000','11110','01000','01000','01001','01100'],
  N:['10001','11001','11001','10101','10011','10011','10001'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],
  A:['01110','10001','10001','11111','10001','10001','10001'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '9':['01110','10001','10001','01111','00001','00001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','11111'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
};
export function glyphDots(char:string){return (DOT_GLYPHS[char]??[]).flatMap((row,y)=>row.split('').flatMap((v,x)=>v==='1'?[{x,y}]:[]));}
export function cipherMarks(){return CIPHER_CARRIER.split('').map((char,i)=>{
  const dots=glyphDots(char),key=HANA_KEY[i%4],symbol=CIPHER_MORSE[i]??null;
  const offset=symbol==='.'?0:symbol==='-'?1:2;
  return {char,dots,key,symbol,index:(key-1+offset)%dots.length};
});}
export function decodeMarks(marks= cipherMarks()){
  return marks.map(m=>{const delta=(m.index-(m.key-1)%m.dots.length+m.dots.length)%m.dots.length;
    return delta===0?'.':delta===1?'-':'';}).join('');
}
