// @ts-nocheck
// Рисование города: изометрические здания на парящем острове (SVG-строки). Перенесено из согласованного макета.
const RM = (()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}})();
// ---------- цвет ----------
const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const toH=a=>'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const sh=(h,a)=>{const c=hx(h);return toH(c.map(v=>a<0?v*(1+a):v+(255-v)*a))};
// ---------- геометрия ----------
const pt=p=>p.map(a=>a[0].toFixed(1)+','+a[1].toFixed(1)).join(' ');
const L=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const up=(p,h)=>[p[0],p[1]-h];
const geo=(cx,gy,w,h)=>({top:[cx,gy-w/4],right:[cx+w/2,gy],bottom:[cx,gy+w/4],left:[cx-w/2,gy],h,cx,gy,w});
const poly=(p,f,st,sw=1)=>`<polygon points="${pt(p)}" fill="${f}" stroke="${st||'none'}" stroke-width="${sw}" stroke-linejoin="round"/>`;
function box(g,base,top=true){const{h}=g,s=sh(base,-.32);let o=poly([g.left,g.bottom,up(g.bottom,h),up(g.left,h)],base,s)+poly([g.bottom,g.right,up(g.right,h),up(g.bottom,h)],sh(base,-.13),s);
 if(top)o+=poly([up(g.top,h),up(g.right,h),up(g.bottom,h),up(g.left,h)],sh(base,.18),s);return o}
function slab(g,base,t=4,ext=6){const s=geo(g.cx,g.gy-g.h+0,g.w+ext,t);s.h=t;return box({...s,top:up(s.top,0),right:s.right,bottom:s.bottom,left:s.left,h:t},base)}
function win(g,f,u,v,du,dv,fill='#FFD27A',frame){const a=f==='L'?g.left:g.bottom,b=f==='L'?g.bottom:g.right;const p=(uu,vv)=>up(L(a,b,uu),vv);
 return `<polygon points="${pt([p(u,v),p(u+du,v),p(u+du,v+dv),p(u,v+dv)])}" fill="${fill}" stroke="${frame||'#C99A7E'}" stroke-width=".8"/>`}
function wins(g,f,cols,rows,v0,dv,gapv,du,lit=true){let s='';for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const u=(1-cols*du)/(cols+1)*(c+1)+du*c;const on=lit&&((r*3+c*5+(f==='L'?1:2))%4!==0);s+=win(g,f,u,v0+r*(dv+gapv),du,dv,on?'#FFD98A':'#E9CFC2')}return s}
function roof(g,rh,c){const apex=[g.cx,(g.top[1]+g.bottom[1])/2-g.h-rh],s=sh(c,-.3);return poly([up(g.left,g.h),up(g.bottom,g.h),apex],c,s)+poly([up(g.bottom,g.h),up(g.right,g.h),apex],sh(c,-.15),s)}
function dome(cx,y,r,c){return `<path d="M${cx-r} ${y} A${r} ${r*1.05} 0 0 1 ${cx+r} ${y} Z" fill="${c}" stroke="${sh(c,-.3)}" stroke-width="1"/><path d="M${cx-r*.55} ${y-r*.55} A${r*.6} ${r*.6} 0 0 1 ${cx-r*.05} ${y-r*.95}" stroke="${sh(c,.5)}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="${cx}" cy="${y-r*1.05-3}" r="2.6" fill="#F2C35B"/>`}
// ---------- декор ----------
const DEFS=`<defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
<linearGradient id="rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C79A86"/><stop offset=".6" stop-color="#A67E8C"/><stop offset="1" stop-color="#8E7398" stop-opacity=".2"/></linearGradient>
<linearGradient id="fall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE3EA"/><stop offset="1" stop-color="#BFE3EA" stop-opacity="0"/></linearGradient>
<linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#BFE0E6"/><stop offset="1" stop-color="#9DCBD8"/></linearGradient></defs>`;
const tree=(x,y,s=1,c1='#F2A33A',c2='#F7C25E')=>`<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="1" rx="9" ry="3.5" fill="#000" opacity=".08"/><rect x="-1.6" y="-8" width="3.2" height="9" rx="1.5" fill="#9A6A4E"/><circle cx="-4" cy="-13" r="7" fill="${sh(c1,-.08)}"/><circle cx="4" cy="-14" r="7.5" fill="${c1}"/><circle cx="0" cy="-20" r="7" fill="${c2}"/><circle cx="-2" cy="-22" r="2.4" fill="#FFE2A6" opacity=".8"/></g>`;
const lamp=(x,y)=>`<g><line x1="${x}" y1="${y}" x2="${x}" y2="${y-16}" stroke="#5B4A66" stroke-width="1.4"/><circle class="glowpulse" cx="${x}" cy="${y-17}" r="5" fill="#FFE3A0" opacity=".6" filter="url(#glow)"/><circle cx="${x}" cy="${y-17}" r="2.2" fill="#FFF1C6"/></g>`;
const bench=(x,y)=>`<g><polygon points="${x-6},${y} ${x+2},${y+4} ${x+2},${y+2} ${x-6},${y-2}" fill="#B07A58"/><line x1="${x-5}" y1="${y}" x2="${x-5}" y2="${y+3}" stroke="#7A5440"/><line x1="${x+1}" y1="${y+3}" x2="${x+1}" y2="${y+6}" stroke="#7A5440"/></g>`;
const bush=(x,y,c='#9FCF8A')=>`<g><circle cx="${x-3}" cy="${y}" r="4" fill="${sh(c,-.1)}"/><circle cx="${x+2}" cy="${y-1}" r="4.5" fill="${c}"/></g>`;
const cloud=(x,y,s,cls='')=>`<g class="cloud ${cls}" opacity=".92"><g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="40" ry="16" fill="#FFF3F2"/><ellipse cx="-18" cy="-10" rx="18" ry="14" fill="#FFF6F4"/><ellipse cx="12" cy="-14" rx="22" ry="17" fill="#FFF8F6"/><ellipse cx="0" cy="6" rx="38" ry="9" fill="#F1D3E2"/></g></g>`;
// ---------- здания (база в точке 100,155 внутри 200x200) ----------
const B={
 hall(){const g=geo(100,155,104,54);let s=box(g,'#F5C9AB')+wins(g,'L',4,2,8,14,8,.12)+wins(g,'R',4,2,8,14,8,.12);
  s+=win(g,'L',.42,0,.16,13,'#9B6B57','#7A5444');
  const c=geo(100,155-54,108,4);c.h=4;s+=box(c,'#FCE3D2');
  const t=geo(100,155-58,34,30);s+=box(t,'#F9DCC6');const cx=(t.bottom[0]+t.right[0])/2,cy=(t.bottom[1]+t.right[1])/2-16;
  s+=`<ellipse cx="${cx}" cy="${cy}" rx="5.5" ry="6.5" fill="#FFF7EC" stroke="#C99A7E"/><path d="M${cx} ${cy} v-4 M${cx} ${cy} l3 1.5" stroke="#5B4A66" stroke-width="1.2" stroke-linecap="round"/>`;
  s+=roof(t,22,'#9ED2BA');return s},
 agency(){const g=geo(100,155,78,98);let s=box(g,'#F3CFC6')+wins(g,'L',3,5,8,11,7,.18)+wins(g,'R',3,5,8,11,7,.18);
  const c=geo(100,155-98,82,4);c.h=4;s+=box(c,'#FADFD8');const r=geo(106,155-102,26,10);s+=box(r,'#E9BFB6');
  s+=`<rect x="74" y="${155-98-40}" width="40" height="12" rx="6" fill="#6C4E9E"/><rect x="80" y="${155-98-36}" width="28" height="4" rx="2" fill="#F2C35B"/>`;return s},
 clock(){const g=geo(100,155,46,104);let s=box(g,'#E8D0EA')+wins(g,'L',1,3,14,14,14,.36)+wins(g,'R',1,2,14,14,14,.36);
  const cx=(g.bottom[0]+g.left[0])/2,cy=(g.bottom[1]+g.left[1])/2-86;s+=`<circle cx="${cx}" cy="${cy}" r="8" fill="#FFF7EC" stroke="#B79BC0" stroke-width="1.2"/><path d="M${cx} ${cy} v-5.5 M${cx} ${cy} l4 2" stroke="#5B4A66" stroke-width="1.4" stroke-linecap="round"/>`;
  const c=geo(100,155-104,52,4);c.h=4;s+=box(c,'#F4E3F4');s+=roof(geo(100,155-108,52,0),34,'#C9A2DD');return s},
 monument(){const p=geo(100,155,72,14);let s=box(p,'#EEDFD3');const o=geo(100,155-14,24,76);s+=box(o,'#FBF1E8');s+=roof(geo(100,155-90,24,0),16,'#F2C35B');
  s+=bush(70,150)+bush(132,150,'#F2B85A');return s},
 arena(){const h=18,g=geo(100,155,132,h);let s=box(g,'#F4D7B6',false);const c=[100,155-h];const T=[up(g.top,h),up(g.right,h),up(g.bottom,h),up(g.left,h)];
  s+=poly(T,'#FBE6CF','#D7B596')+poly(T.map(p=>L(p,c,.2)),'#A8D68F','#86B872')+`<polygon points="${pt(T.map(p=>L(p,c,.58)))}" fill="none" stroke="#FFFBF4" stroke-width="1.4" stroke-dasharray="4 3"/>`;
  s+=`<circle cx="92" cy="${155-h-4}" r="2.4" fill="#6C4E9E"/><circle cx="110" cy="${155-h+2}" r="2.4" fill="#D04C55"/><circle cx="100" cy="${155-h-1}" r="1.8" fill="#FFF"/>`;return s},
 bank(){const g=geo(100,155,82,48);let s=box(g,'#F6E6C9');for(let i=0;i<4;i++)s+=win(g,'L',.1+i*.22,4,.07,36,'#FFF6E6','#D8C3A0');s+=win(g,'R',.36,0,.28,18,'#9B6B57','#7A5444')+wins(g,'R',2,1,24,10,0,.14);
  const c=geo(100,155-48,88,5);c.h=5;s+=box(c,'#FCF0DC');s+=dome(100,155-53-8,18,'#F2C35B');
  return s},
 brain(){const g=geo(100,155,74,40);let s=box(g,'#F7D3E0')+wins(g,'L',3,1,10,13,0,.16)+wins(g,'R',3,1,10,13,0,.16);
  const c=geo(100,155-40,80,4);c.h=4;s+=box(c,'#FCE6EE');
  s+=`<circle cx="100" cy="${155-46-26}" r="34" fill="#F7B7CF" opacity=".35" filter="url(#glow)"/>`+dome(100,155-46,30,'#F3A6C3');
  s+=`<g fill="none" stroke="#D97FA3" stroke-width="2" stroke-linecap="round"><path d="M82 ${155-60} q8 -10 16 0 q8 10 16 0"/><path d="M78 ${155-52} q6 -6 12 0"/><path d="M110 ${155-52} q6 -6 12 0"/><path d="M100 ${155-76} v20"/></g>`;
  return s},
 library(){const g=geo(100,155,92,66);let s=box(g,'#EFD9BE');
  const bk=['#C96B5E','#6C4E9E','#3FA592','#F2A93B','#D97FA3','#5B87B8'];
  for(let r=0;r<2;r++)for(let i=0;i<6;i++){s+=win(g,'L',.08+i*.145,8+r*26,.1,20,bk[(i+r*2)%6],'#B08F6E');s+=win(g,'R',.08+i*.145,8+r*26,.1,20,bk[(i+r*3+1)%6],'#B08F6E');}
  s+=roof(g,26,'#B9785C');return s},
 observatory(){const g=geo(100,155,62,52);let s=box(g,'#DDD5EF')+wins(g,'L',2,2,8,12,8,.2)+wins(g,'R',2,2,8,12,8,.2);
  const d=geo(100,155-52,54,12);s+=box(d,'#ECE6F7');
  s+=`<path d="M73 ${155-64} A27 28 0 0 1 127 ${155-64} Z" fill="#B9C3EA" stroke="#8C97C4"/><path d="M98 ${155-91} L104 ${155-91} L106 ${155-64} L96 ${155-64} Z" fill="#3A2E4A" opacity=".75"/>`;
  s+=`<rect x="98" y="${155-104}" width="34" height="8" rx="4" fill="#6C4E9E" transform="rotate(-28 100 ${155-92})"/><circle cx="140" cy="${155-118}" r="2" fill="#FFF1C6"/><circle cx="152" cy="${155-104}" r="1.4" fill="#FFF1C6"/>`;
  return s}
};
function building(kind,decay){const inner=B[kind]();let o=`<ellipse cx="100" cy="${158}" rx="56" ry="18" fill="#7A5A6A" opacity=".12"/>`;
 o+= decay?`<g style="filter:grayscale(.9) brightness(.92)">${inner}</g>`:inner;
 if(decay){o+=`<g stroke="#A27A5E" stroke-width="2.6" stroke-linecap="round" opacity=".95"><path d="M52 160 V58 M148 160 V58 M52 86 H148 M52 122 H148 M52 86 L148 122"/></g>`;
  o+=`<g fill="#A9A0B2"><circle class="smoke" cx="120" cy="34" r="10"/><circle class="smoke" cx="136" cy="18" r="13"/><circle class="smoke" cx="114" cy="8" r="8"/></g>`;}
 return o}
// мини-остров для экрана здания
function islet(kind,decay){let s=`<g class="float"><polygon points="30,160 100,198 170,160 128,226 100,262 74,228" fill="url(#rock)"/>`;
 s+=`<polygon points="100,124 172,160 100,196 28,160" fill="${decay?'#C9C49A':'#B9DE9E'}" stroke="#93BE7E"/><polygon points="28,160 100,196 100,204 28,168" fill="#E5B98F"/><polygon points="100,196 172,160 172,168 100,204" fill="#D2A47E"/>`;
 s+=tree(44,164,.8)+tree(156,166,.75,'#F7B24A','#FBD07A')+building(kind,decay)+`</g>`;return s}
const svgHero=(kind,decay)=>`<svg class="bld" viewBox="20 6 160 226" role="img" aria-label="Здание">${DEFS}${cloud(30,10,.5,'b')}${islet(kind,decay)}</svg>`;

// ---------- город: парящий остров ----------

// ---------- город: парящий остров ----------
// st: [{kind, decay, level, label}], people: сколько людей гуляет (растёт с закрытыми делами)
const POS={hall:[179,126,.72,0],clock:[70,162,.6,0],agency:[292,160,.62,0],monument:[110,192,.55,0],arena:[146,228,.5,0],bank:[216,228,.6,0],brain:[246,118,.5,22],library:[100,120,.48,-16],observatory:[179,262,.44,0]};
export function cityScene(st, people=8){
 const C=[179,170], T=[179,72], R=[350,170], Bt=[179,268], Lf=[8,170];
 const A=L(Lf,T,.5),Cc=L(T,R,.5),D=L(Lf,Bt,.5),E=L(R,Bt,.5);
 let s=DEFS;
 s+=cloud(60,40,.9)+cloud(300,30,.7,'b');
 s+=`<g class="float">`;
 s+=`<path d="M8 186 L179 284 L350 186 L300 250 L250 268 L214 316 L190 300 L179 364 L160 312 L128 300 L96 262 L52 246 Z" fill="url(#rock)"/>`;
 s+=`<g fill="#B48C8E" opacity=".7"><polygon points="70,330 84,322 92,338 78,350"/><polygon points="290,318 300,312 306,326 296,334"/></g>`;
 s+=`<rect x="300" y="196" width="10" height="110" rx="5" fill="url(#fall)"/>`;
 s+=poly([Lf,Bt,[Bt[0],Bt[1]+10],[Lf[0],Lf[1]+10]],'#E8BC92')+poly([Bt,R,[R[0],R[1]+10],[Bt[0],Bt[1]+10]],'#D6A57F');
 s+=poly([[Lf[0],Lf[1]+10],[Bt[0],Bt[1]+10],[Bt[0],Bt[1]+16],[Lf[0],Lf[1]+16]],'#C99376')+poly([[Bt[0],Bt[1]+10],[R[0],R[1]+10],[R[0],R[1]+16],[Bt[0],Bt[1]+16]],'#B47F6A');
 s+=poly([T,R,Bt,Lf],'#BFE2A3','#9CC985',1.2);
 const road=(a,b,o)=>poly([[a[0]+o[0],a[1]+o[1]],[b[0]+o[0],b[1]+o[1]],[b[0]-o[0],b[1]-o[1]],[a[0]-o[0],a[1]-o[1]]],'#EFD9C3','#E0C3A8');
 s+=road(A,E,[9,-4.5])+road(Cc,D,[9,4.5]);
 s+=`<line x1="${A[0]}" y1="${A[1]}" x2="${E[0]}" y2="${E[1]}" stroke="#E3C8AE" stroke-width="5" stroke-dasharray="2 5"/><line x1="${Cc[0]}" y1="${Cc[1]}" x2="${D[0]}" y2="${D[1]}" stroke="#E3C8AE" stroke-width="5" stroke-dasharray="2 5"/>`;
 s+=poly([[C[0],C[1]-18],[C[0]+36,C[1]],[C[0],C[1]+18],[C[0]-36,C[1]]],'#F3E1CD','#E0C3A8')+`<ellipse cx="${C[0]}" cy="${C[1]}" rx="12" ry="6" fill="url(#water)" stroke="#D9BFA6"/><ellipse cx="${C[0]}" cy="${C[1]-5}" rx="2.5" ry="6" fill="#DFF3F6" opacity=".9"/>`;
 s+=`<ellipse cx="274" cy="196" rx="30" ry="12" fill="url(#water)" stroke="#E0C3A8"/>`;
 s+=`<g><g>${RM?'':'<animateTransform attributeName="transform" type="translate" values="-12 2;12 -2;-12 2" dur="9s" repeatCount="indefinite"/>'}<path d="M266 196 h16 l-3 4 h-10 z" fill="#F7E3D4" stroke="#C99A7E"/><rect x="270" y="191" width="7" height="5" rx="1.5" fill="#F2A93B"/></g></g>`;
 s+=[tree(150,88,.8),tree(206,88,.75,'#F7B24A','#FBD07A'),tree(40,166,.9),tree(58,178,.75,'#F7B24A','#FBD07A'),tree(320,166,.85)].join('');
 const P=st.map(b=>[b.kind,b.decay,...POS[b.kind],b.label]).sort((a,b)=>a[3]-b[3]);
 const labels=[];
 for(const [k,d,x,y,sc,dx,l] of P){s+=`<g data-b="${k}" class="bhit" transform="translate(${x-100*sc} ${y-155*sc}) scale(${sc})">${building(k,d)}</g>`;labels.push([k,x+(dx||0),y+16,l,d]);}
 for(const t of [.18,.38,.62,.84]){const p=L(A,E,t);s+=lamp(p[0]+10,p[1]-6);}
 for(const t of [.2,.8]){const p=L(Cc,D,t);s+=lamp(p[0]-10,p[1]-6);}
 s+=bench(150,152)+bench(206,190)+bush(250,140)+bush(110,140,'#F2B85A')+tree(250,250,.7)+tree(96,236,.7,'#F7B24A','#FBD07A');
 const ppl=[['#6C4E9E',A,E,16,0],['#D04C55',E,A,19,3],['#3FA592',Cc,D,14,1],['#F2A93B',D,Cc,21,6],['#3A2E4A',A,E,23,9],['#E07A9A',Cc,D,17,4],['#4A9A5C',E,A,25,11],['#8A6BC2',D,Cc,15,8],['#5B87B8',A,E,18,5],['#C96B5E',Cc,D,22,2],['#7FA35B',E,A,20,7],['#B46FB0',D,Cc,24,10]];
 for(const [c,a,b,dur,beg] of ppl.slice(0,Math.max(1,Math.min(12,people)))){const path=`M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${a[0]} ${a[1]}`;
  s+=`<g><g transform="translate(0 -7) scale(1.45)"><ellipse cx="0" cy="6" rx="3" ry="1.2" fill="#000" opacity=".12"/><rect x="-2.2" y="-3" width="4.4" height="8" rx="2.2" fill="${c}"/><circle cx="0" cy="-5.5" r="2.4" fill="#F3C9A8"/></g>${RM?`<animateMotion dur="1s" fill="freeze" keyPoints="${(beg%10)/20}" keyTimes="0" calcMode="linear" path="${path}"/>`:`<animateMotion dur="${dur}s" begin="-${beg}s" repeatCount="indefinite" path="${path}"/>`}</g>`;}
 for(const [k,x,y,l,d] of labels){const w=l.length*6.4+14;s+=`<g data-b="${k}" class="bhit"><rect x="${x-w/2}" y="${y}" width="${w}" height="19" rx="9.5" fill="#FFF9F4" opacity=".95" stroke="${d?'#D04C55':'#F0D7C9'}" stroke-width="1.2"/><text x="${x}" y="${y+13.5}" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="11.5" fill="${d?'#D04C55':'#3A2E4A'}">${l}</text></g>`;}
 s+=`</g>`;
 return s;
}
export { svgHero, building, DEFS, cloud };

// Карта целей: парящие острова-месяцы. nodes: [{label, state:'done'|'now'|'lock'}] (до 5)
export function goalsMap(nodes){
 const XY=[[66,232],[178,186],[92,134],[238,90],[118,40]];
 const N=nodes.slice(0,5).map((n,i)=>[XY[i][0],XY[i][1],n.label,n.state]);
 let m=DEFS+`<rect x=".75" y=".75" width="356.5" height="276.5" rx="23" fill="#F9DCCB" stroke="#F0D7C9" stroke-width="1.5"/>`+cloud(300,250,.6)+cloud(50,60,.5,'b');
 if(N.length>1)m+=`<path d="M${N.map(n=>n[0]+' '+n[1]).join(' L')}" stroke="#7D6B82" stroke-width="2" stroke-dasharray="6 5" fill="none"/>`;
 for(const [x,y,l,s] of N){const c=s==='lock'?'#E9DDE3':'#BFE2A3';
  m+=`<polygon points="${x-40},${y+6} ${x},${y+26} ${x+40},${y+6} ${x+16},${y+30} ${x},${y+42} ${x-16},${y+30}" fill="url(#rock)" opacity=".9"/>`;
  m+=`<polygon points="${x},${y-18} ${x+40},${y+2} ${x},${y+22} ${x-40},${y+2}" fill="${c}" stroke="${s==='lock'?'#D6C6CF':'#9CC985'}" stroke-width="1.2"/>`;
  m+=`<circle cx="${x}" cy="${y}" r="${s==='now'?17:13}" fill="${s==='done'?'#4A9A5C':s==='now'?'#F2A93B':'#FFF9F4'}" stroke="${s==='lock'?'#C9B5C2':'#3A2E4A'}" stroke-width="1.5"/>`;
  if(s==='done')m+=`<path d="M${x-6} ${y} l4 4 l8 -8" stroke="#FFF9F4" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  if(s==='now')m+=`<path d="M${x-7} ${y+7} l14 -14 M${x-7} ${y-7} l14 14" stroke="#3A2E4A" stroke-width="2.4" stroke-linecap="round"/>`;
  if(s==='lock')m+=`<rect x="${x-5}" y="${y-1}" width="10" height="8" rx="2" fill="#9C8AA2"/><path d="M${x-3} ${y-1} v-3 a3 3 0 0 1 6 0 v3" stroke="#9C8AA2" stroke-width="1.8" fill="none"/>`;
  const right=x<179, lx=right?x+48:x-48, w=l.length*7.6+16, rx=right?lx:lx-w;
  m+=`<rect x="${rx}" y="${y-11}" width="${w}" height="22" rx="10" fill="#FFF9F4" stroke="${s==='now'?'#F2A93B':'#F0D7C9'}" stroke-width="1.4"/><text x="${rx+w/2}" y="${y+4.5}" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="13" fill="${s==='lock'?'#7D6B82':'#3A2E4A'}">${l}</text>`;}
 return m;
}
