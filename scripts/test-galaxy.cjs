// Dependency-free lifecycle regression checks. WebGL is mocked; this does not
// replace browser shader compilation, visual review, or hardware profiling.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('assets/js/field-galaxy-approved.js', 'utf8');
const cinematicSource = fs.readFileSync('assets/js/field-galaxy.js', 'utf8');
function target(extra = {}) {
  const events = new Map();
  return Object.assign({
    addEventListener(k, f) { if (!events.has(k)) events.set(k, new Set()); events.get(k).add(f); },
    removeEventListener(k, f) { events.get(k)?.delete(f); },
    fire(k, e = {}) { [...(events.get(k) || [])].forEach(f => f(e)); },
    listenerCount() { return [...events.values()].reduce((n, s) => n + s.size, 0); }
  }, extra);
}
function fixture({ calm = false, unavailable = false, compile = true, code = source, search = '', hostname = 'localhost' } = {}) {
  const pending = new Map(), uniforms = {}, draws = [], deleted = [];
  const uploads = [];
  let id = 0, clock = 0;
  const gl = new Proxy({
    createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}),
    getShaderParameter: () => compile, getProgramParameter: () => true,
    getUniformLocation: (_, k) => k, getAttribLocation: () => 0,
    uniform1f: (k, v) => { uniforms[k] = v; },
    uniform2f: (k, x, y) => { uniforms[k] = [x, y]; },
    uniform3f: (k, x, y, z) => { uniforms[k] = [x, y, z]; },
    uniform4f: (k, x, y, z, w) => { uniforms[k] = [x, y, z, w]; },
    drawArrays: (_, __, n) => draws.push({ n, ...uniforms }),
    deleteBuffer: b => deleted.push(b),
    bufferData: (_, data) => uploads.push(data.slice())
  }, { get: (o, k) => k in o ? o[k] : () => {} });
  const canvas = target({ style: {}, clientWidth: 1280, clientHeight: 800,
    getContext: () => unavailable ? null : gl,
    getBoundingClientRect: () => ({left:0, top:0, width:canvas.clientWidth, height:canvas.clientHeight}) });
  const motion = target({matches:calm});
  const anchors = [0,1,2].map(i => target({
    style: {setProperty(k,v) {this[k]=v;}},
    querySelector: () => ({getBoundingClientRect: () => ({left:800+i*80,top:200+i*120,width:50,height:50})})
  }));
  const window = target({ matchMedia: () => motion, devicePixelRatio: 2 });
  const cosmosClasses = new Set();
  const cosmos = {classList:{add(name){cosmosClasses.add(name);},remove(name){cosmosClasses.delete(name);}}};
  let selectedAnchor = null;
  const document = target({ hidden:false, getElementById: () => canvas,
    querySelector: selector => selector === '.cosmos' ? cosmos : selectedAnchor,
    querySelectorAll: () => anchors,
    documentElement: {getAttribute: () => 'dark'} });
  let intersection;
  const context = {window, document, location:{hostname,search}, URLSearchParams, console:{warn(){}}, Float32Array, Math,
    getComputedStyle: () => ({ getPropertyValue: () => '.4,.4,.4' }),
    requestAnimationFrame: f => { pending.set(++id, f); return id; },
    cancelAnimationFrame: i => pending.delete(i),
    IntersectionObserver: class {constructor(f) {intersection=f;} observe(){} disconnect(){}},
    ResizeObserver: class {observe(){} disconnect(){}}
  };
  vm.runInNewContext(code, context);
  function step(n=1, ms=1000/60) { for (let i=0; i<n; i++) { clock += ms; const callbacks=[...pending.values()]; pending.clear(); callbacks.forEach(f=>f(clock)); assert.ok(pending.size<=1); } }
  return {canvas, motion, window, document, pending, draws, deleted, uploads, anchors, cosmosClasses, step,
    select: anchor => { selectedAnchor = anchor; document.fire('cosmoschange'); },
    intersect: visible => intersection([{isIntersecting:visible}])};
}
const f = fixture();
assert.ok(f.cosmosClasses.has('cosmos--particles'),'GPU renderer hides CSS fallback markers');
const prior = fixture({code:fs.readFileSync('assets/js/field-spatial.js','utf8')});
for (let i=0;i<576;i++) assert.equal(f.uploads[3][i],3+Math.floor(i/192),'Each navigation formation is tagged in the shared GPU buffer');
for (const values of f.uploads) assert.ok(values.every(Number.isFinite),'GPU buffers contain finite values');
for (let attribute=0; attribute<3; attribute++) {
  const size=attribute===2 ? 2 : 3;
  for (let i=0; i<12000; i++) {
    const destination=576+i+Math.floor(i/3);
    for(let component=0;component<size;component++) {
      assert.equal(f.uploads[attribute][destination*size+component],prior.uploads[attribute][i*size+component], 'Original 3D particle data preserved');
    }
  }
}
f.step(320);
function projectedNode(draw, index, width, height) {
  const [x,y,z]=draw['uNode'+index];
  const tilt=draw.uTilt+draw.uParallax[1], roll=.4+draw.uRoll, yaw=draw.uParallax[0];
  const ty=y*Math.cos(tilt)-z*Math.sin(tilt), rz=y*Math.sin(tilt)+z*Math.cos(tilt);
  const rx=x*Math.cos(roll)-ty*Math.sin(roll);
  const tx=rx*Math.cos(yaw)-rz*Math.sin(yaw)+1.4;
  const tz=rx*Math.sin(yaw)+rz*Math.cos(yaw)-5.5;
  const wy=x*Math.sin(roll)+ty*Math.cos(roll)+.2;
  const half=Math.tan(52*Math.PI/180/2)*(draw.uCamera-tz);
  return [(tx/(half*width/height)+1)*width/2,
    (1-wy/half)*height/2];
}
for(let i=0;i<3;i++) {
  const point=projectedNode(f.draws.at(-1),i,1280,800);
  assert.ok(Math.abs(point[0]-(825+i*80+parseFloat(f.anchors[i].style['--cosmos-x'])))<.01,'Hit target follows projected GPU center');
  assert.ok(Math.abs(point[1]-(225+i*120+parseFloat(f.anchors[i].style['--cosmos-y'])))<.01);
}
f.select(f.anchors[0]); f.step(60);
assert.ok(f.draws.at(-1).uBeaconOn > .9, 'Keyboard focus illuminates nearby stars');
const frozen = f.anchors[0].style['--cosmos-x'];
f.step(30); assert.equal(f.anchors[0].style['--cosmos-x'],frozen,'Focused targets do not drift');
f.select(null); f.step(60);
assert.ok(f.draws.at(-1).uBeaconOn < .01, 'Beacon settles after focus leaves');
assert.equal(f.draws.at(-1).uIntro, 1);
assert.equal(f.draws.at(-1).n, 16576);
f.step(60);
assert.ok(f.draws.at(-1).uReveal > .85, 'Formation opens into a reveal');
f.step(720);
assert.ok(f.draws.at(-1).uReveal < .01, 'One-time reveal returns to original view');
f.window.fire('pointermove', {isPrimary:true,clientX:1200,clientY:350}); f.step(180);
assert.equal(f.draws.at(-1).uReveal, 0, 'Pointer cannot replay the reveal');
assert.equal(f.draws.at(-1).uCamera, 9, 'Pointer does not move the camera');
assert.equal(f.draws.at(-1).uRoll, 0, 'Pointer does not twist the silhouette');
assert.ok(Math.abs(f.draws.at(-1).uParallax[0]) > .03 && Math.abs(f.draws.at(-1).uParallax[0]) <= .045);
f.window.fire('pointermove', {isPrimary:true,clientX:640,clientY:350}); f.step(240);
assert.ok(f.draws.at(-1).uReveal < .01, 'Center gently restores original inclination');
assert.ok(Math.abs(f.draws.at(-1).uParallax[0]) < .0001);
f.window.fire('pointermove', {isPrimary:true,clientX:900,clientY:350}); f.step(60);
assert.ok(f.draws.at(-1).uCursorOn > .9);
f.canvas.clientWidth=390; f.window.fire('resize'); f.step();
assert.equal(f.draws.at(-1).n, 6176);
assert.equal(f.canvas.width, Math.floor(390*1.75));
f.intersect(false); assert.equal(f.pending.size,0);
f.intersect(true); f.document.fire('visibilitychange'); f.document.fire('visibilitychange'); assert.equal(f.pending.size,1);
f.motion.matches=true; f.motion.fire('change'); assert.equal(f.pending.size,0);
f.document.hidden=true; f.document.fire('visibilitychange'); f.document.hidden=false; f.document.fire('visibilitychange'); assert.equal(f.pending.size,0);
f.document.fire('themechange'); assert.equal(f.draws.at(-1).uIntro,1);
f.motion.matches=false; f.motion.fire('change'); f.step(); assert.equal(f.draws.at(-1).uIntro,1);
f.window.fire('pagehide',{persisted:true}); assert.equal(f.pending.size,0);
f.window.fire('pageshow'); assert.equal(f.pending.size,1);
f.canvas.fire('webglcontextlost',{preventDefault(){}}); assert.equal(f.pending.size,0);
assert.ok(!f.cosmosClasses.has('cosmos--particles'),'Fallback markers return after context loss');
f.canvas.fire('webglcontextrestored'); f.step(); assert.equal(f.draws.at(-1).uIntro,1);
assert.ok(f.cosmosClasses.has('cosmos--particles'));
f.window.fire('pagehide',{persisted:false}); assert.equal(f.pending.size,0); assert.equal(f.window.listenerCount(),0); assert.equal(f.canvas.listenerCount(),0); assert.equal(f.deleted.length,4);
const still=fixture({calm:true}); assert.equal(still.pending.size,0); assert.equal(still.draws.at(-1).uIntro,1);
assert.equal(still.draws.at(-1).uReveal,.65);
still.select(still.anchors[1]); assert.equal(still.draws.at(-1).uBeaconOn,1); assert.equal(still.pending.size,0);
for (const opts of [{unavailable:true},{compile:false}]) {const failed=fixture(opts); assert.equal(failed.canvas.style.display,'none'); assert.equal(failed.pending.size,0); assert.ok(!failed.cosmosClasses.has('cosmos--particles'));}
console.log('Galaxy lifecycle checks passed: intro, pointer, resize, reduced motion, visibility, offscreen, BFCache, context restore, cleanup, fallback.');

const idle=fixture(), active=fixture();
active.window.fire('pointermove',{isPrimary:true,pointerType:'mouse',clientX:1280,clientY:0});
idle.step(769); active.step(769);
for(let i=0;i<769;i++) {
  assert.equal(active.draws[i].uReveal,idle.draws[i].uReveal,'Pointer never competes with opening');
  assert.equal(active.draws[i].uRoll,idle.draws[i].uRoll);
  assert.equal(active.draws[i].uParallax[0],0,'No steering until reveal settles');
  assert.equal(active.draws[i].uCursorOn,0,'No local force during intro');
}
active.step(180);
for(let i=0;i<3;i++) {
  const point=projectedNode(active.draws.at(-1),i,1280,800);
  assert.ok(Math.abs(point[0]-(825+i*80+parseFloat(active.anchors[i].style['--cosmos-x'])))<.01);
  assert.ok(Math.abs(point[1]-(225+i*120+parseFloat(active.anchors[i].style['--cosmos-y'])))<.01);
}
active.select(active.anchors[0]);
active.window.fire('pointermove',{isPrimary:true,clientX:0,clientY:800});
const pinned=projectedNode(active.draws.at(-1),0,1280,800);
active.step(120);
const after=projectedNode(active.draws.at(-1),0,1280,800);
assert.ok(Math.hypot(after[0]-pinned[0],after[1]-pinned[1])<.01,'Selected GPU center stays pinned during tilt');
active.window.fire('blur'); active.step(180);
assert.ok(active.draws.at(-1).uParallax.every(v=>Math.abs(v)<.00001),'Exit settles back to neutral');
active.window.fire('pointerdown',{isPrimary:true,pointerType:'touch',clientX:1280,clientY:0}); active.step(120);
assert.ok(active.draws.at(-1).uParallax.every(v=>Math.abs(v)<.00001),'Touch does not steer composition');
function responseAt(hz) {
  const sample=fixture(); sample.step(1); sample.step(hz*15,1000/hz);
  sample.window.fire('pointermove',{isPrimary:true,clientX:1280,clientY:0});
  sample.step(hz/2,1000/hz);
  return sample.draws.at(-1).uParallax;
}
const low=responseAt(30), high=responseAt(120);
assert.ok(low.every((v,i)=>Math.abs(v-high[i])<1e-10),'Damping is consistent at 30 and 120 Hz');
console.log('Motion checks passed: isolated intro, bounded tilt, stable camera, projected targets, touch, return and frame-rate independence.');

const cinema = fixture({code:cinematicSource});
for(let i=0;i<4;i++) assert.deepEqual(cinema.uploads[i],f.uploads[i],'All geometry, materials, seeds and nodes preserved');
cinema.window.fire('pointermove',{isPrimary:true,clientX:1280,clientY:0});
cinema.step(181);
for(const draw of cinema.draws) {
  assert.equal(draw.uIntro,1,'No radial burst underneath trace motion');
  assert.equal(draw.uTilt,.4,'No global intro tilt');
  assert.equal(draw.uRoll,0,'No global intro roll');
  assert.ok(draw.uParallax.every(v=>Math.abs(v)<1e-12),'Pointer waits for settle');
  assert.ok(draw.uCamera>=6.4 && draw.uCamera<=11.2);
  for(let i=0;i<3;i++) {
    const point=projectedNode(draw,i,1280,800);
    assert.ok(Math.hypot(point[0]-(825+i*80),point[1]-(225+i*120))<.01,'Navigation remains at home through camera travel');
  }
}
assert.ok(cinema.draws[30].uEntrance[0]<1e-6,'Trace beat is planar');
assert.ok(cinema.draws[78].uEntrance[0]>.999,'Flow establishes depth');
assert.ok(cinema.draws[132].uEntrance[1]>.5,'Spatial beat releases the galaxy');
cinema.step(90);
const settled=cinema.draws.at(-1);
assert.equal(settled.uEntrance[1],1); assert.equal(settled.uCamera,9); assert.equal(settled.uReveal,0);
assert.ok(Math.abs(settled.uParallax[0])>.04,'Interaction returns after handoff');
cinema.intersect(false); assert.equal(cinema.pending.size,0); cinema.intersect(true); assert.equal(cinema.pending.size,1);
cinema.motion.matches=true; cinema.motion.fire('change'); assert.equal(cinema.pending.size,0);
assert.equal(cinema.draws.at(-1).uEntrance[1],1); assert.equal(cinema.draws.at(-1).uCamera,9);
cinema.motion.matches=false; cinema.motion.fire('change'); cinema.step();
assert.equal(cinema.draws.at(-1).uEntrance[1],1,'Motion preference changes never replay entrance');
cinema.canvas.fire('webglcontextlost',{preventDefault(){}}); cinema.canvas.fire('webglcontextrestored'); cinema.step();
assert.equal(cinema.draws.at(-1).uEntrance[1],1,'Restored context starts settled');
cinema.window.fire('pagehide',{persisted:false}); assert.equal(cinema.pending.size,0); assert.equal(cinema.window.listenerCount(),0);
for (const opts of [{calm:true},{search:'?intro=final'}]) {
  const sample=fixture({code:cinematicSource,...opts}); sample.step();
  assert.equal(sample.draws.at(-1).uCamera,9); assert.equal(sample.draws.at(-1).uReveal,0); assert.equal(sample.draws.at(-1).uEntrance[1],1);
}
const stillBeat=fixture({code:cinematicSource,search:'?introAt=1.7'});
assert.equal(stillBeat.pending.size,0); assert.equal(stillBeat.draws.at(-1).uEntrance[3],1.7);
const publicHost=fixture({code:cinematicSource,search:'?intro=final&introAt=1.7',hostname:'example.com'});
publicHost.step(); assert.equal(publicHost.draws.at(-1).uEntrance[1],0,'Comparison parameters are loopback-only');
console.log('Cinematic checks passed: unchanged buffers, four beats, navigation projection, bounded camera, pointer handoff, reduced motion, context restoration and local-only comparisons.');

const discovery=fixture({code:cinematicSource});
discovery.select(discovery.anchors[0]); discovery.step(150);
assert.ok(discovery.cosmosClasses.has('cosmos--forming'),'Intro suppresses annotations');
assert.equal(discovery.draws.at(-1).uNodeReady,0,'Intro hides node grains even when selected');
assert.equal(discovery.draws.at(-1).uBeaconOn,0,'Intro suppresses navigation illumination');
assert.ok(discovery.draws.at(-1).uNodeWake.every(v=>v===0));
discovery.step(150);
assert.ok(!discovery.cosmosClasses.has('cosmos--forming'));
assert.equal(discovery.draws.at(-1).uNodeReady,1);
assert.ok(discovery.draws.at(-1).uNodeWake[0]>.99,'Focus reveals identity after formation');
discovery.select(null); discovery.step(120);
assert.ok(discovery.draws.at(-1).uNodeWake.every(v=>v<.001),'Exit fades nodes to dormant');
discovery.window.fire('pointermove',{isPrimary:true,pointerType:'mouse',clientX:825,clientY:225}); discovery.step(60);
assert.ok(discovery.draws.at(-1).uNodeWake[0]>.4,'Proximity reveals local grains before selection');
discovery.window.fire('blur'); discovery.step(120);
assert.ok(discovery.draws.at(-1).uNodeWake.every(v=>v<.001));
const accessible=fixture({code:cinematicSource,calm:true}); accessible.select(accessible.anchors[1]);
assert.equal(accessible.draws.at(-1).uNodeWake[1],1,'Reduced-motion keyboard selection paints without RAF');
console.log('Node discovery checks passed: intro dormancy, staged visibility, focus, proximity, exit, and reduced motion.');
