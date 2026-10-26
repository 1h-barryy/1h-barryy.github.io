// Dependency-free lifecycle regression checks. WebGL is mocked; this does not
// replace browser shader compilation, visual review, or hardware profiling.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('assets/js/field-galaxy.js', 'utf8');
function target(extra = {}) {
  const events = new Map();
  return Object.assign({
    addEventListener(k, f) { if (!events.has(k)) events.set(k, new Set()); events.get(k).add(f); },
    removeEventListener(k, f) { events.get(k)?.delete(f); },
    fire(k, e = {}) { [...(events.get(k) || [])].forEach(f => f(e)); },
    listenerCount() { return [...events.values()].reduce((n, s) => n + s.size, 0); }
  }, extra);
}
function fixture({ calm = false, unavailable = false, compile = true, code = source } = {}) {
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
  const context = {window, document, console:{warn(){}}, Float32Array, Math,
    getComputedStyle: () => ({ getPropertyValue: () => '.4,.4,.4' }),
    requestAnimationFrame: f => { pending.set(++id, f); return id; },
    cancelAnimationFrame: i => pending.delete(i),
    IntersectionObserver: class {constructor(f) {intersection=f;} observe(){} disconnect(){}},
    ResizeObserver: class {observe(){} disconnect(){}}
  };
  vm.runInNewContext(code, context);
  function step(n=1) { for (let i=0; i<n; i++) { clock += 16.667; const callbacks=[...pending.values()]; pending.clear(); callbacks.forEach(f=>f(clock)); assert.ok(pending.size<=1); } }
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
  const tilt=draw.uTilt+draw.uParallax[1], roll=.4+draw.uParallax[0]+draw.uRoll;
  const ty=y*Math.cos(tilt)-z*Math.sin(tilt), tz=y*Math.sin(tilt)+z*Math.cos(tilt)-5.5;
  const tx=x*Math.cos(roll)-ty*Math.sin(roll)+1.4;
  const wy=x*Math.sin(roll)+ty*Math.cos(roll)+.2;
  const half=Math.tan(52*Math.PI/180/2)*(draw.uCamera-tz);
  return [((tx+draw.uParallax[0]/.12)/(half*width/height)+1)*width/2,
    (1-(wy+draw.uParallax[1]/.12)/half)*height/2];
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
assert.ok(f.draws.at(-1).uReveal > .95, 'Outer pointer position reopens the galaxy');
assert.ok(f.draws.at(-1).uCamera > 12, 'Reveal pulls back to expose surrounding space');
f.window.fire('pointermove', {isPrimary:true,clientX:640,clientY:350}); f.step(240);
assert.ok(f.draws.at(-1).uReveal < .01, 'Center gently restores original inclination');
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
