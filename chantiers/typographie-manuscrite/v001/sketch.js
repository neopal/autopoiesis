/* v001: no stored glyphs. Each token is only a sequence of passage zones. */
const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d');
const inputs = ['awareness','careless','slant','pressure'].reduce((a,id)=>({...a,[id]:document.querySelector('#'+id)}),{});
let nonce = 1;
function rng(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function point(x,y){return{x,y}}
function routeFor(word, r){
  const routes=[]; let x=100;
  for(let i=0;i<word.length;i++){
    const surprise=(word.charCodeAt(i)*17+i*23)%11/10;
    const w=74+surprise*34, y=365+(r()-.5)*20;
    // passages, never alphabetic templates; a loop is a four-zone topological demand
    const zones=[point(x,y+46),point(x+w*.22,y-54),point(x+w*.76,y-42),point(x+w,y+39)];
    if((i+word.charCodeAt(i))%3===0) zones.splice(2,0,point(x+w*.72,y+55),point(x+w*.23,y+54));
    routes.push({zones,surprise}); x+=w+18;
  } return routes;
}
function draw(){
  const r=rng(98413+nonce*7919); const a=+inputs.awareness.value,c=+inputs.careless.value,s=+inputs.slant.value,p=+inputs.pressure.value;
  Object.entries(inputs).forEach(([id,input])=>document.querySelector('#'+id+'Out').value=(+input.value).toFixed(2));
  ctx.fillStyle='#dbd2bd';ctx.fillRect(0,0,1280,720);
  // paper fibre
  for(let i=0;i<9000;i++){ctx.fillStyle=`rgba(69,51,29,${.015+r()*.025})`;ctx.fillRect(r()*1280,r()*720,1,1)}
  const routes=routeFor('AUTOP0IËSE',r);ctx.lineCap='round';ctx.lineJoin='round';
  routes.forEach(({zones,surprise},index)=>{
    const effort=.4+surprise*.55; const samples=Math.floor(34+effort*42*a); const fatigue=index/routes.length;
    ctx.beginPath(); let last=zones[0];ctx.moveTo(last.x+last.y*s,last.y);
    for(let k=1;k<zones.length;k++){
      const target=zones[k];
      for(let j=1;j<=samples/(zones.length-1);j++){
        const t=j/(samples/(zones.length-1)); const wobble=(1-a+c*1.8)*(r()-.5)*30*(1+fatigue);
        const x=last.x+(target.x-last.x)*t+wobble+(last.y+(target.y-last.y)*t)*s;
        const y=last.y+(target.y-last.y)*t+(r()-.5)*c*18;
        ctx.lineTo(x,y);
      } last=target;
    }
    ctx.strokeStyle=`rgba(30,26,23,${.52+p*.38})`;ctx.lineWidth=1.2+p*4+effort*1.3;ctx.stroke();
    // pressure ghosts: a hand occasionally returns to an unresolved place
    if(surprise>.65){ctx.globalAlpha=.13;ctx.lineWidth=.6;ctx.stroke();ctx.globalAlpha=1}
  });
  ctx.fillStyle='#b93c2e';ctx.font='15px monospace';ctx.fillText('PASSAGES / BOUCLES / FATIGUE',46,64);
  ctx.fillStyle='rgba(21,21,20,.45)';ctx.fillText('v001 — écrire sans connaître la lettre',46,678);
}
Object.values(inputs).forEach(x=>x.addEventListener('input',draw));document.querySelector('#rerun').addEventListener('click',()=>{nonce++;draw()});draw();
