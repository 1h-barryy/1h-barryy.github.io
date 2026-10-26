// Navigation state tests; no DOM/WebGL dependency. Real rendering checked separately.
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
function node() {
  const events = new Map(), classes = new Set();
  return {
    attrs: {},
    classList: { toggle(k,on) { if(on) classes.add(k); else classes.delete(k); }, contains: k=>classes.has(k) },
    setAttribute(k,v) { this.attrs[k]=v; },
    addEventListener(k,f) { if(!events.has(k)) events.set(k,new Set()); events.get(k).add(f); },
    removeEventListener(k,f) { events.get(k)?.delete(f); },
    fire(k,e={}) { [...(events.get(k)||[])].forEach(f=>f(e)); },
    dispatchEvent(e) { this.fire(e.type,e); },
    listeners() { return [...events.values()].reduce((n,s)=>n+s.size,0); }
  };
}
const links = [node(),node(),node()];
links.forEach(link=>link.closest=()=>link);
const root=node(), document=node(), window=node();
root.querySelectorAll=()=>links;
document.querySelector=()=>root;
const changes=[];
document.addEventListener('cosmoschange',e=>changes.push(e.detail.anchor));
vm.runInNewContext(fs.readFileSync('assets/js/cosmos-nav.js','utf8'),{
  document,window,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}}
});
const active=()=>links.filter(n=>n.classList.contains('is-active'));
function click(link,extra={}) {
  const e={target:link,button:0,detail:1,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra};
  root.fire('click',e); return e;
}
function touch(link) {
  document.fire('pointerdown',{pointerType:'touch',target:link});
  link.fire('focus'); // Browser's touch-focus happens before click.
  return click(link);
}
assert.equal(active().length,0);
links[0].fire('pointerenter',{pointerType:'mouse'});
assert.equal(active()[0],links[0]);
assert.equal(click(links[0]).defaultPrevented,false,'Mouse activates a native link');
links[1].fire('pointerenter',{pointerType:'mouse'});
assert.deepEqual(active(),[links[1]]);
assert.equal(links[0].classList.contains('is-superseded'),true);
links[0].fire('pointerleave'); assert.equal(active()[0],links[1]);
links[1].fire('pointerleave'); assert.equal(active().length,0);
document.fire('keydown',{key:'Tab'}); links[2].fire('focus');
assert.deepEqual(active(),[links[2]]);
assert.equal(click(links[2],{detail:0}).defaultPrevented,false,'Keyboard/AT activation navigates');
document.fire('keydown',{key:'Escape'}); assert.equal(active().length,0);
assert.equal(touch(links[0]).defaultPrevented,true,'First touch reveals, even after focus');
assert.equal(links[0].attrs['aria-expanded'],'true');
assert.equal(touch(links[1]).defaultPrevented,true,'A different body needs its own first tap');
assert.deepEqual(active(),[links[1]]);
assert.equal(touch(links[1]).defaultPrevented,false,'Second touch navigates');
document.fire('pointerdown',{pointerType:'touch',target:{closest:()=>null}});
assert.equal(active().length,0);
assert.equal(touch(links[1]).defaultPrevented,true,'Outside tap disarms navigation');
document.fire('pointercancel'); assert.equal(active().length,0);
assert.equal(click(links[1],{ctrlKey:true}).defaultPrevented,false,'Modifier-click keeps native behavior');
window.fire('pagehide',{persisted:true}); window.fire('pageshow');
assert.equal(active().length,0);
links[0].fire('pointerenter',{pointerType:'mouse'}); assert.equal(active()[0],links[0]);
document.fire('keydown',{key:'Tab'}); document.activeElement=links[2]; links[2].fire('focus');
window.fire('pagehide',{persisted:true}); window.fire('pageshow');
assert.deepEqual(active(),[links[2]],'BFCache restores keyboard-focused annotation');
window.fire('pagehide',{persisted:false});
assert.equal(root.listeners(),0); assert.equal(links[0].listeners(),0); assert.equal(window.listeners(),0);
assert.ok(changes.length>5);
console.log('Cosmos navigation passed: idle, exclusive hover/focus, exit, Escape, first/second touch, outside tap, cancellation, native links, BFCache and cleanup.');
