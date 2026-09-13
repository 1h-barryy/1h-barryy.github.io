(() => {
  'use strict';
  const { Crossing, noise } = CrossingCore;
  const game = new Crossing();
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay'), play = document.getElementById('play');
  const pause = document.getElementById('pause'), score = document.getElementById('score');
  const bestEl = document.getElementById('best'), status = document.getElementById('status');
  const title = document.getElementById('dialog-title'), copy = document.getElementById('dialog-copy');
  const label = document.getElementById('dialog-label'), hint = document.getElementById('dialog-hint');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0, height = 0, unit = 45, camera = 0, previous = 0, lastState = '', lastScore = -1, best = 0;
  try { best = Math.max(0, Math.floor(Number(localStorage.getItem('parallel-crossy-best')) || 0)); } catch (_) { /* Storage is optional. */ }
  const digits = n => String(n).padStart(3, '0');
  bestEl.textContent = digits(best);

  function resize() {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    unit = Math.min(width / 16, height / 10.3);
  }
  new ResizeObserver(resize).observe(canvas);
  function project(x, y, z = 0) {
    return [width * .48 + (x * .92 + (y - camera) * .36) * unit,
      height * .73 + (x * .27 - (y - camera) * .65 - z * .91) * unit];
  }
  function polygon(points, color) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function tint(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, v + amount)).toString(16).padStart(2, '0')).join('');
  }
  function tile(x, y, w, d, color, z = 0) {
    polygon([project(x-w/2,y-d/2,z),project(x+w/2,y-d/2,z),project(x+w/2,y+d/2,z),project(x-w/2,y+d/2,z)],color);
  }
  function box(x, y, z, w, d, h, color) {
    const a=project(x-w/2,y-d/2,z),b=project(x+w/2,y-d/2,z),c=project(x+w/2,y+d/2,z);
    const A=project(x-w/2,y-d/2,z+h),B=project(x+w/2,y-d/2,z+h),C=project(x+w/2,y+d/2,z+h),D=project(x-w/2,y+d/2,z+h);
    polygon([a,b,B,A],tint(color,-24)); polygon([b,c,C,B],tint(color,-42)); polygon([A,B,C,D],color);
  }
  function shadow(x,y,w,d) { tile(x+.18,y-.13,w,d,'rgba(33,58,46,.15)',.014); }
  function tree(x,y,variant) {
    shadow(x+.15,y-.15,1.1,.9);
    box(x,y,0,.18,.18,.55,'#a18a60');
    const c = ['#789962','#a6b77b','#577f5b'][variant % 3];
    box(x,y,.4,.85,.78,.7,c); box(x-.08,y+.02,1.1,.62,.6,.45,tint(c,9));
  }
  function car(c) {
    const palette=['#e9ae55','#de795e','#9cbac8','#e9e6d3','#8fa998'];
    const color=palette[c.color],x=c.x,y=c.y,l=c.length;
    shadow(x,y,l+.15,.88);
    for (const offset of [-l*.3,l*.3]) box(x+offset,y-.32,.08,.3,.13,.25,'#354741');
    box(x,y,.18,l,.72,.4,color);
    box(x-c.direction*.13,y,.58,l*.52,.62,.33,tint(color,13));
    // Dark blue glazing on the cabin's visible side, plus lights and bumpers.
    box(x-c.direction*.13,y-.316,.63,l*.42,.012,.19,'#506f78');
    box(x+c.direction*l*.13,y,.62,.055,.55,.22,'#73919b');
    box(x+c.direction*(l/2+.012),y,.26,.045,.64,.12,'#e9e3cb');
    for (const offset of [-.24,.24]) box(x+c.direction*(l/2+.036),y+offset,.4,.055,.14,.09,'#fff6c8');
  }
  function traveler(p) {
    const z=reducedMotion ? 0 : p.lift;
    shadow(p.x,p.y,.68,.55);
    tile(p.x,p.y,.88,.88,'rgba(255,250,214,.5)',.018);
    const x=p.x,y=p.y;
    const facing=game.facing, faces=[];
    // Model-local +Y is the face; rotate every part with the accepted hop.
    // Quarter turns keep the cuboids axis-aligned in world coordinates.
    function part(lx,ly,lz,w,d,h,color) {
      const cx=x+lx*facing.y+ly*facing.x, cy=y-lx*facing.x+ly*facing.y;
      if(facing.x) [w,d]=[d,w];
      const lo=z+lz, hi=lo+h;
      const a=[cx-w/2,cy-d/2,lo], b=[cx+w/2,cy-d/2,lo], c=[cx+w/2,cy+d/2,lo];
      const A=[cx-w/2,cy-d/2,hi], B=[cx+w/2,cy-d/2,hi], C=[cx+w/2,cy+d/2,hi], D=[cx-w/2,cy+d/2,hi];
      function face(points,fill) {
        // Camera-facing depth (normal to the projection's screen axes).
        const depth=points.reduce((sum,v)=>sum+.3276*v[0]-.8372*v[1]+.6952*v[2],0)/points.length;
        faces.push({points,fill,depth});
      }
      face([a,b,B,A],tint(color,-24));face([b,c,C,B],tint(color,-42));face([A,B,C,D],color);
    }
    part(-.16,.04,.02,.18,.3,.16,'#946143');
    part(.16,.04,.02,.18,.3,.16,'#946143');
    part(0,0,.16,.48,.4,.4,'#e8ad58');
    part(0,0,.49,.51,.43,.07,'#ee855c');
    part(0,.035,.56,.6,.48,.46,'#f4c46f');
    part(-.21,.06,1.02,.17,.22,.23,'#eab65f');
    part(.21,.06,1.02,.17,.22,.23,'#eab65f');
    part(0,-.29,.22,.36,.19,.32,'#4d8e87');
    const drawFaces=()=>faces.sort((a,b)=>a.depth-b.depth).forEach(f=>polygon(f.points.map(v=>project(...v)),f.fill));
    drawFaces();faces.length=0;
    // Facial details sit on the head's front plane. Draw them after the head
    // only when that plane faces the camera (+X or -Y), avoiding bleed-through.
    if(facing.x>0 || facing.y<0) {
      for(const offset of [-.16,.16]) part(offset,.286,.79,.075,.024,.095,'#35453b');
      part(0,.31,.65,.11,.08,.08,'#aa6f47');
      drawFaces();
    }
    if(game.state !== 'over') {
      const a=project(x,y,z+1.63);
      polygon([[a[0]-5,a[1]-4],[a[0]+5,a[1]-4],[a[0],a[1]+2]],'#fff9e6');
    }
  }
  function draw() {
    ctx.clearRect(0,0,width,height);
    const gradient=ctx.createLinearGradient(0,0,width,height);
    gradient.addColorStop(0,'#e8eedc'); gradient.addColorStop(1,'#dbe8cf');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
    const center=Math.floor(camera),start=Math.max(-3,center-9),end=center+17;
    const objects=[];
    for(let row=end;row>=start;row--) {
      const lane=game.lane(row),grass=lane.type==='grass';
      // All ground is drawn before objects, so lane strips cannot cover feet.
      box(0,row,-.29,13,1.015,.29,grass ? '#9fbf7e' : '#748681');
      if(grass) {
        for(let x=-6;x<=6;x++) {
          const n=noise(game.seed,row*53+x);
          tile(x,row,1.01,1.012,['#a8c987','#a0c180','#accb8b','#a4c583'][Math.floor(n*4)],.002);
          if(n>.64 && (row!==0 || Math.abs(x)>1)) {
            tile(x+.2,row+.22,.13,.065,'#c3d999',.008);
            tile(x-.22,row-.2,.1,.09,'#c3d999',.008);
          }
        }
      } else {
        for(let x=-6;x<=6;x+=1.5) tile(x,row,.62,.035,'#b4bfaa',.012);
        tile(0,row-.45,13,.035,'#c4cbb8',.012);
        tile(0,row+.45,13,.035,'#c4cbb8',.012);
        game.cars(lane).filter(c=>Math.abs(c.x)<7.5).forEach(c=>objects.push({depth:project(c.x,c.y)[1],draw:()=>car(c)}));
      }
      // The playable columns are -5..5. Scenery is outside that boundary.
      for(const side of [-1,1]) {
        const n=noise(game.seed,row*73+side);
        if(grass && n>.35) {
          const x=side*5.95;
          objects.push({depth:project(x,row)[1],draw:()=>tree(x,row,Math.floor(n*9))});
        } else if(!grass) {
          const x=side*6.13;
          objects.push({depth:project(x,row)[1],draw:()=>{box(x,row,0,.1,.1,.33,'#e2dfbc');box(x,row,.22,.12,.12,.09,'#f2f1dd');}});
        }
      }
      if(row===0) {
        for(let x=-4;x<=4;x++) tile(x,row,.5,.52,'#bcd797',.012);
      }
    }
    const p=game.position(); objects.push({depth:project(p.x,p.y)[1]+.1,draw:()=>traveler(p)});
    objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
    if(game.state==='over') {
      const p2=project(p.x,p.y,.6);
      ctx.strokeStyle='#d56544';ctx.lineWidth=3;
      for(let i=0;i<8;i++) { const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(p2[0]+Math.cos(a)*unit*.8,p2[1]+Math.sin(a)*unit*.8);ctx.lineTo(p2[0]+Math.cos(a)*unit,p2[1]+Math.sin(a)*unit);ctx.stroke(); }
    }
  }
  function sync() {
    if(game.score!==lastScore) {
      score.textContent=digits(game.score); lastScore=game.score;
      if(game.score>best) {best=game.score;bestEl.textContent=digits(best);try{localStorage.setItem('parallel-crossy-best',String(best));}catch(_){} }
    }
    if(game.state===lastState) return;
    lastState=game.state; overlay.hidden=game.state==='playing';
    pause.disabled=game.state==='ready'||game.state==='over';
    pause.innerHTML=game.state==='paused'?'Resume <kbd>P</kbd>':'Pause <kbd>P</kbd>';
    if(game.state==='over') {
      label.textContent='A LITTLE BUMP IN THE ROAD';title.textContent='Oh, that was close.';
      copy.textContent=`Run over. You crossed ${game.score} ${game.score===1?'lane':'lanes'}. Take a breath, then take another chance.`;
      play.innerHTML='Try again <span>↗</span>';hint.textContent='Press R or Enter to start a fresh run';
      status.textContent=`Game over. Distance ${game.score}. Personal best ${best}.`;play.focus({preventScroll:true});
    } else if(game.state==='paused') {
      label.textContent='TAKE YOUR TIME';title.textContent='A little breather.';
      copy.textContent='Your traveler and the traffic are waiting right here.';
      play.innerHTML='Keep going <span>↗</span>';hint.textContent='Press P or Escape to resume';
      status.textContent='Game paused.';play.focus({preventScroll:true});
    } else if(game.state==='playing') { status.textContent='Run started. Arrow keys or WASD to hop.'; }
  }
  function start() {
    if(game.state==='paused') game.togglePause();
    else {game.reset();camera=0;game.start();}
    sync();canvas.focus({preventScroll:true});
  }
  function togglePause() {game.togglePause();sync();if(game.state==='playing')canvas.focus({preventScroll:true});}
  const directions={up:[0,1],down:[0,-1],left:[-1,0],right:[1,0]};
  function move(direction) {
    if(game.state==='ready') start();
    game.move(...directions[direction]);
  }
  const keys={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
  document.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(keys[key]) {event.preventDefault();if(!event.repeat)move(keys[key]);}
    else if(key==='p'||key==='Escape') {event.preventDefault();if(!event.repeat)togglePause();}
    else if(key==='r') {event.preventDefault();if(!event.repeat)start();}
    else if(key==='Enter' && event.target===canvas && game.state!=='playing') {event.preventDefault();start();}
  });
  play.addEventListener('click',start);pause.addEventListener('click',togglePause);
  document.querySelectorAll('[data-move]').forEach(button=>button.addEventListener('click',()=>move(button.dataset.move)));
  function autoPause(){if(game.state==='playing'){game.togglePause();sync();}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});
  window.addEventListener('blur',autoPause);
  function frame(now) {
    const dt=previous?Math.min((now-previous)/1000,.1):0;previous=now;
    game.update(dt);
    const target=game.position().y;
    camera=reducedMotion?target:camera+(target-camera)*(1-Math.exp(-dt*7));
    sync();draw();requestAnimationFrame(frame);
  }
  resize();sync();requestAnimationFrame(frame);
})();
