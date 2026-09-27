(() => {
  'use strict';
  const { Crossing, noise, HOP } = CrossingCore;
  const game = new Crossing();
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay'), play = document.getElementById('play');
  const pause = document.getElementById('pause'), score = document.getElementById('score');
  const bestEl = document.getElementById('best'), status = document.getElementById('status');
  const title = document.getElementById('dialog-title'), copy = document.getElementById('dialog-copy');
  const label = document.getElementById('dialog-label'), hint = document.getElementById('dialog-hint');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0, height = 0, unit = 45, camera = 0, previous = 0, lastState = '', lastScore = -1, best = 0;
  try { best = Math.max(0, Math.floor(Number(localStorage.getItem('parallel-forest-best')) || 0)); } catch (_) { /* Storage is optional. */ }
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
    box(x,y,0,.24,.24,.7,'#755a72');
    const c = ['#377f78','#608e68','#6977a5'][variant % 3];
    box(x,y,.5,1.05,.92,.65,c); box(x-.08,y+.02,1.15,.78,.73,.55,tint(c,12));
    box(x-.13,y+.05,1.7,.48,.46,.3,tint(c,24));
    glow(x+.15,y-.1,.7,'#f4d79a',.55);
  }
  function glow(x,y,z,color,size=.7) {
    const p=project(x,y,z), r=unit*size;
    const light=ctx.createRadialGradient(...p,0,...p,r);
    light.addColorStop(0,color+'66');light.addColorStop(1,color+'00');
    ctx.fillStyle=light;ctx.fillRect(p[0]-r,p[1]-r,r*2,r*2);
  }
  function mushroom(x,y,size=1,color='#c68eda') {
    box(x,y,0,.12*size,.12*size,.32*size,'#d3dfb0');
    box(x,y,.26*size,.52*size,.48*size,.15*size,color);
    box(x,y,.41*size,.32*size,.3*size,.1*size,tint(color,18));
    tile(x-.09*size,y-.06*size,.08*size,.08*size,'#fff0c2',.516*size);
  }
  function fern(x,y) {
    for(const side of [-1,1]) for(let i=0;i<3;i++) {
      polygon([project(x,y,.02),project(x+side*(.25+i*.13),y+i*.1,.1),project(x+side*.2,y+i*.09,.35+i*.08)],i%2?'#69aa91':'#478979');
    }
  }
  function rabbit(x,y) {
    shadow(x,y,.65,.46);
    box(x,y,.06,.5,.38,.32,'#c8c9d0');
    box(x+.2,y-.02,.31,.29,.28,.29,'#e0dfd7');
    for(const dx of [.1,.29]) box(x+dx,y,.59,.08,.12,.31,'#d8d7df');
    box(x+.35,y-.13,.45,.045,.025,.055,'#485166');
    box(x-.29,y,.2,.16,.17,.17,'#eee6dc');
  }
  function hazard(c) {
    if(c.hazard==='bramble') { bramble(c); return; }
    if(c.hazard==='boar') { boar(c); return; }
    const x=c.x,y=c.y,r=c.length/2;
    shadow(x,y,c.length+.15,.9);
    // Two chipped octagonal rings form a solid boulder. Rotate the actual
    // facets around the lane axis; no wheels, cabin, legs, or animal silhouette.
    const angle=reducedMotion?0:-game.time*game.lane(y).speed*c.direction/r;
    const vertices=[];
    for(const side of [-1,1]) for(let i=0;i<8;i++) {
      const a=i*Math.PI/4+angle, radius=r*(i%3===0?.91:1);
      vertices.push([x+Math.cos(a)*radius,y+side*.34,r+.04+Math.sin(a)*radius]);
    }
    const faces=[], palette=['#8996a1','#a4acb2','#748592','#b9bdba','#657e86','#93a49b','#778890','#aeb4bd'];
    function face(points,color) {
      const depth=points.reduce((sum,p)=>sum+.3276*p[0]-.8372*p[1]+.6952*p[2],0)/points.length;
      faces.push({points,color,depth});
    }
    for(let i=0;i<8;i++) {
      const next=(i+1)%8;
      face([vertices[i],vertices[next],vertices[next+8],vertices[i+8]],palette[i]);
      face([[x,y-.45,r+.04],vertices[i],vertices[next]],tint(palette[(i+3)%8],-12));
      face([[x,y+.45,r+.04],vertices[i+8],vertices[next+8]],palette[(i+2)%8]);
    }
    faces.sort((a,b)=>a.depth-b.depth).forEach(f=>polygon(f.points.map(p=>project(...p)),f.color));
    // A small mineral seam turns with the rock and ties it to the forest palette.
    const seam=vertices[2],mid=[x,y-.46,r+.04];
    ctx.beginPath();ctx.moveTo(...project(...mid));ctx.lineTo(...project(seam[0],y-.37,seam[2]));
    ctx.strokeStyle='#b7dbc5';ctx.lineWidth=Math.max(1,unit*.035);ctx.stroke();
  }
  function bramble(c) {
    const r=c.length/2,spin=reducedMotion?0:-game.time*game.lane(c.y).speed*c.direction/r;
    shadow(c.x,c.y,c.length+.12,.85);
    const point=(a,radius,side)=>project(c.x+Math.cos(a)*radius,c.y+side,r+.03+Math.sin(a)*radius);
    // A hollow, tangled wheel with an unmistakable thorn silhouette.
    for(const side of [.24,-.24]) for(let i=0;i<10;i++) {
      const a=i*Math.PI/5+spin,b=a+Math.PI/5;
      polygon([point(a,r*.79,side),point(b,r*.79,side),point(b,r*.47,side),point(a,r*.47,side)],side>0?'#574b53':i%2?'#977852':'#75946a');
      polygon([point(a,r*.74,side),point(a+.18,r,side),point(a+.3,r*.75,side)],side>0?'#7a5a5a':'#d5b488');
    }
    ctx.strokeStyle='#ac9e6b';ctx.lineWidth=Math.max(1,unit*.055);
    for(let i=0;i<3;i++) {
      const a=spin+i*Math.PI/3;
      ctx.beginPath();ctx.moveTo(...point(a,r*.58,-.25));ctx.lineTo(...point(a+Math.PI,r*.58,-.25));ctx.stroke();
    }
  }
  function boar(c) {
    const x=c.x,y=c.y,l=c.length,d=c.direction;
    const gait=reducedMotion?0:Math.sin(game.time*12)*.07;
    shadow(x,y,l+.15,.9);
    for(const dx of [-l*.25,l*.25]) for(const dy of [-.25,.25]) {
      box(x+dx+(dy<0?gait:-gait),y+dy,.04,.18,.17,.35,'#526c7b');
    }
    box(x-d*l*.08,y,.33,l*.74,.7,.52,'#819bab');
    box(x-d*l*.12,y,.85,l*.5,.55,.15,'#b0b5d1');
    box(x+d*l*.3,y,.4,l*.35,.57,.52,'#a7c2c4');
    box(x+d*l*.43,y,.43,l*.14,.44,.24,'#b8d8cc');
    // Upright ears, a blunt snout, four legs, and large ivory tusks.
    for(const side of [-1,1]) {
      polygon([project(x+d*l*.12,y+side*.2,.87),project(x+d*l*.29,y+side*.22,.88),project(x+d*l*.1,y+side*.25,1.2)],'#b2a6d1');
      polygon([project(x+d*l*.4,y+side*.24,.46),project(x+d*l*.49,y+side*.27,.55),project(x+d*l*.49,y+side*.26,.81),project(x+d*l*.43,y+side*.26,.64)],'#fff0cc');
    }
    box(x+d*l*.32,y-.292,.75,.09,.025,.08,'#efffdc');
    for(let i=0;i<3;i++) box(x-d*l*(.12+i*.13),y,1,.06,.2,.1,'#bbe8cf');
  }
  // These are the uppermost visible surfaces, including the moss / cap spots.
  const PLATFORM_TOP = { log: .24, mushroom: .195, giant: .55 };
  function surfaceHeight(row) {
    const lane=game.lane(row);
    if(lane.type!=='river') return 0;
    if(lane.variant===2) return PLATFORM_TOP.giant+(reducedMotion?0:game.platformLift(lane));
    return lane.variant===1?PLATFORM_TOP.mushroom:PLATFORM_TOP.log;
  }
  function platform(c) {
    const x=c.x,y=c.y,l=c.length;
    tile(x,y,l+.25,.9,c.variant===2?'rgba(143,217,206,.23)':'#8fd9ce',-.025);
    if(c.variant===2) {
      const lift=reducedMotion?0:game.platformLift(game.lane(c.y));
      // A broad, continuous cap is safe across the same footprint as a log.
      box(x,y,lift-.06,.46,.4,.43,'#e1d6b4');
      const rim=[[-.5,0],[-.35,-.46],[0,-.56],[.35,-.46],[.5,0],[.35,.46],[0,.56],[-.35,.46]];
      const ring=z=>rim.map(([dx,dy])=>project(x+dx*l,y+dy,lift+z));
      const lower=ring(.29),upper=ring(.54);
      // Broad beveled cap, with a visible stalk underneath instead of a raft silhouette.
      for(let i=0;i<4;i++) polygon([lower[i],lower[i+1],upper[i+1],upper[i]],i%2?'#b87e76':'#d19675');
      polygon(upper,'#efbf86');
      for(const dx of [-1,-.35,.4,1.05]) tile(x+dx,y,.22,.2,'#ffefba',lift+PLATFORM_TOP.giant);
      glow(x,y,lift+.4,'#f5dba1',.8);
    } else if(c.variant===1) {
      box(x,y,-.08,l,.78,.2,'#ab83b2');
      box(x,y,.12,l*.94,.72,.07,'#d6b2d6');
      for(const dx of [-.9,0,.9]) tile(x+dx,y,.19,.18,'#fff1c5',PLATFORM_TOP.mushroom);
    } else {
      box(x,y,-.08,l,.72,.24,'#826857');
      box(x,y,.16,l*.96,.56,.07,'#ad9770');
      for(const dx of [-l*.43,l*.43]) tile(x+dx,y,.035,.58,'#5e6658',.235);
      tile(x+.35,y,.6,.3,'#86ad7b',PLATFORM_TOP.log);
    }
  }
  function traveler(p) {
    const h=game.hop,t=h?Math.min(h.elapsed/HOP,1):0;
    const surface=h ? surfaceHeight(h.fromY)*(1-t)+surfaceHeight(h.y)*t : surfaceHeight(game.player.y);
    const z=surface+(reducedMotion ? 0 : p.lift);
    // Feet begin .02 above the deck. Shadows and selection light belong on
    // that same surface, not down on the water. Lane Y remains unchanged.
    tile(p.x+.08,p.y-.04,.68,.55,'rgba(33,58,46,.24)',surface+.005);
    tile(p.x,p.y,.88,.88,'rgba(255,250,214,.32)',surface+.008);
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
    part(0,0,.16,.48,.4,.4,'#7ca995');
    part(0,0,.49,.51,.43,.07,'#b28ed1');
    part(0,.035,.56,.6,.48,.46,'#f4c46f');
    part(-.21,.06,1.02,.17,.22,.23,'#eab65f');
    part(.21,.06,1.02,.17,.22,.23,'#eab65f');
    part(0,-.29,.22,.36,.19,.32,'#8d73ac');
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
    gradient.addColorStop(0,'#233e4b'); gradient.addColorStop(.5,'#326862'); gradient.addColorStop(1,'#55617e');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
    const center=Math.floor(camera),start=center-12,end=center+17;
    const objects=[],platforms=[];
    for(let row=end;row>=start;row--) {
      // Forest floor and small groves fill the camera margins. All new scenery
      // stays beyond the playable columns, or well behind the starting row.
      for(const side of [-1,1]) {
        tile(side*12.5,row,12,1.02,row%2?'#3d6c61':'#406f64',-.04);
        for(let band=0;band<4;band++) {
          const n=noise(game.seed,row*179+band*23+side*7);
          const x=side*(7.6+band*2.3+n*.6),y=row+(n-.5)*.6;
          const at=project(x,y);
          if(at[0]<-unit*2||at[0]>width+unit*2||at[1]<-unit||at[1]>height+unit*3) continue;
          if(n>.44 && row%2===0) objects.push({depth:at[1],draw:()=>tree(x,y,Math.floor(n*9))});
          else if(n>.23) objects.push({depth:at[1],draw:()=>fern(x,y)});
          else if(n>.08) objects.push({depth:at[1],draw:()=>{
            mushroom(x,y,1+n*2,'#ae8cba');mushroom(x+.43,y+.18,.7,'#dfb783');
          }});
          else if(band===0) objects.push({depth:at[1],draw:()=>rabbit(x,y)});
        }
      }
      const lane=game.lane(row),grass=lane.type==='clearing';
      const curse=lane.type==='cursed'?game.curse(lane):null;
      // All ground is drawn before objects, so lane strips cannot cover feet.
      const ground={clearing:'#689d80',hazard:'#867b93',river:'#277e86',cursed:'#72648d'};
      box(0,row,-.29,13,1.015,.29,ground[lane.type]);
      if(grass) {
        for(let x=-6;x<=6;x++) {
          const n=noise(game.seed,row*53+x);
          tile(x,row,1.01,1.012,['#76a889','#6b9e7f','#82ae8d','#72a18a'][Math.floor(n*4)],.002);
          if(n>.64 && (row!==0 || Math.abs(x)>1)) {
            tile(x+.2,row+.22,.13,.065,'#c3d999',.008);
            tile(x-.22,row-.2,.1,.09,'#c3d999',.008);
          }
        }
      } else if(lane.type==='river') {
        for(let x=-6;x<=6;x++) {
          const drift=reducedMotion?0:Math.sin(game.time+x+row)*.18;
          tile(x+drift,row+.2,.48,.025,'#65b7b3',.01);
          tile(x-drift,row-.21,.21,.025,'#499eaa',.01);
        }
        game.movers(lane).filter(c=>Math.abs(c.x)<7.5).forEach(c=>platforms.push(c));
      } else if(lane.type==='hazard') {
        for(let x=-6;x<=6;x++) {
          tile(x,row,.7,.63,x%2?'#8f849c':'#93849a',.008);
          // Small directional chevrons indicate the flow of the lane.
          if(x%3===0) polygon([project(x-lane.direction*.14,row+.1,.012),project(x+lane.direction*.14,row,.012),project(x-lane.direction*.14,row-.1,.012)],'#dfc69f');
        }
        game.movers(lane).filter(c=>Math.abs(c.x)<7.5).forEach(c=>objects.push({depth:project(c.x,c.y)[1],draw:()=>hazard(c)}));
      } else if(curse) {
        const color=curse.state==='danger'?'#f29ab7':curse.state==='warning'?'#ffda8c':'#aaa8d9';
        for(let x=-6;x<=6;x++) {
          tile(x,row,.78,.76,curse.state==='danger'?'#864f7e':'#7e7198',.01);
          tile(x,row,.24,.24,color,.018);
          if(curse.state==='warning') {
            tile(x,row-.28,.5,.07,color,.02);
            glow(x,row,.05,'#ffda8c',.5);
          }
          if(curse.state==='danger') objects.push({depth:project(x,row)[1],draw:()=>{
            for(const dx of [-.25,.25]) {
              polygon([project(x+dx-.11,row-.12),project(x+dx+.11,row-.12),project(x+dx,row-.12,.55)],'#efacd1');
              polygon([project(x+dx+.11,row-.12),project(x+dx,row+.09),project(x+dx,row-.12,.55)],'#b661ab');
            }
          }});
        }
        // A word and a countdown keep the timed state readable without color alone.
        objects.push({depth:Infinity,draw:()=>{
          const at=project(-5.3,row,.16);
          const text=curse.state==='danger'?'THORNS':curse.state==='warning'?'WAKING':'QUIET';
          ctx.font=`bold ${Math.max(9,unit*.2)}px monospace`;
          ctx.fillStyle='#29233ddd';ctx.fillRect(at[0]-6,at[1]-13,86,20);
          ctx.fillStyle=color;ctx.fillText(`${text} ${Math.ceil(curse.remaining)}s`,at[0],at[1]+1);
        }});
      }
      // The playable columns are -5..5. Scenery is outside that boundary.
      for(const side of [-1,1]) {
        const n=noise(game.seed,row*73+side);
        if(grass && n>.35) {
          const x=side*5.95;
          objects.push({depth:project(x,row)[1],draw:()=>tree(x,row,Math.floor(n*9))});
        } else {
          const x=side*6.05;
          objects.push({depth:project(x,row)[1],draw:()=>{
            mushroom(x,row,1.2,side>0?'#c191d2':'#dfb783');
            glow(x,row,.55,side>0?'#dca4f5':'#ffe1a1',.85);
            box(x+.3,row+.15,.02,.07,.07,.48,'#9fe4c6');
          }});
        }
      }
      if(row===0) {
        for(let x=-4;x<=4;x++) tile(x,row,.5,.52,'#b1c69a',.012);
      }
      if(row < -3) for(let x=-5;x<=5;x+=2) {
        const n=noise(game.seed,row*83+x);
        objects.push({depth:project(x,row)[1],draw:()=>n>.5?tree(x,row,Math.floor(n*9)):fern(x,row)});
      }
    }
    // Low river decks form the floor beneath every actor. Sorting a long log
    // by its center could previously paint it over a rider on its left end.
    platforms.sort((a,b)=>project(a.x,a.y)[1]-project(b.x,b.y)[1]).forEach(platform);
    const p=game.position(); objects.push({depth:project(p.x,p.y)[1]+.1,draw:()=>traveler(p)});
    objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
    // Sparse fireflies stay outside the playable corridor.
    for(let i=0;i<12;i++) {
      const x=(i%2?1:-1)*(5.6+noise(game.seed,i)*.7),y=center-2+noise(game.seed,i+90)*13;
      glow(x,y,1+(reducedMotion?0:Math.sin(game.time*.8+i)*.16),'#ffe4a4',.22);
    }
    if(game.state==='over') {
      const p2=project(p.x,p.y,.6);
      ctx.strokeStyle='#d56544';ctx.lineWidth=3;
      for(let i=0;i<8;i++) { const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(p2[0]+Math.cos(a)*unit*.8,p2[1]+Math.sin(a)*unit*.8);ctx.lineTo(p2[0]+Math.cos(a)*unit,p2[1]+Math.sin(a)*unit);ctx.stroke(); }
    }
  }
  function sync() {
    if(game.score!==lastScore) {
      score.textContent=digits(game.score); lastScore=game.score;
      if(game.score>best) {best=game.score;bestEl.textContent=digits(best);try{localStorage.setItem('parallel-forest-best',String(best));}catch(_){} }
    }
    if(game.state===lastState) return;
    lastState=game.state; overlay.hidden=game.state==='playing';
    pause.disabled=game.state==='ready'||game.state==='over';
    pause.innerHTML=game.state==='paused'?'Resume <kbd>P</kbd>':'Pause <kbd>P</kbd>';
    if(game.state==='over') {
      label.textContent='THE FOREST KEEPS ITS SECRETS';title.textContent='One more little hop?';
      copy.textContent=`${game.reason} You crossed ${game.score} ${game.score===1?'lane':'lanes'}.`;
      play.innerHTML='Try again <span>↗</span>';hint.textContent='Press R or Enter to start a fresh run';
      status.textContent=`Game over. Distance ${game.score}. Personal best ${best}.`;play.focus({preventScroll:true});
    } else if(game.state==='paused') {
      label.textContent='TAKE YOUR TIME';title.textContent='A little breather.';
      copy.textContent='The forest crossings, river, and runes are waiting right here.';
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
