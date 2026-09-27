const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Crossing, LIMIT } = require('./core.js');
const advance = (game, seconds) => { for (let i=0; i<Math.round(seconds*120); i++) game.update(1/120); };
const started = () => { const g=new Crossing(123); g.start(); return g; };
const river = g => {
  Object.assign(g.lane(4), {type:'clearing'});
  return Object.assign(g.lane(5), {type:'river', length:3.2});
};
const cursed = g => {
  Object.assign(g.lane(7), {type:'clearing'});
  return Object.assign(g.lane(8), {type:'cursed'});
};

test('all four lane types, safe starts, and deterministic recreation', () => {
  const g=started();
  assert.equal(g.lane(0).type,'clearing'); assert.equal(g.lane(1).type,'clearing');
  assert.equal(new Set(Array.from({length:128},(_,i)=>g.lane(i).type)).size,4);
  const lane=g.lane(5), platforms=g.movers(lane);g.lanes.delete(5);
  assert.deepEqual(g.lane(5),lane);assert.deepEqual(g.movers(g.lane(5)),platforms);
});
test('one hop at a time, bounds, and no score farming by backtracking', () => {
  const g=started();assert.equal(g.move(0,-1),false);assert.equal(g.move(1,1),false);
  assert.equal(g.move(0,1),true);assert.equal(g.move(0,1),false);advance(g,.2);assert.equal(g.score,1);
  g.move(0,-1);advance(g,.2);g.move(0,1);advance(g,.2);assert.equal(g.score,1);
  g.player={x:LIMIT,y:0};assert.equal(g.move(1,0),false);
});
test('moving hazards collide during a hop', () => {
  const g=started(),lane=g.lane(2);lane.phase=12;lane.speed=0;
  g.player={x:0,y:1};g.move(0,1);advance(g,.2);
  assert.equal(g.state,'over');assert.equal(g.score,0);
});
test('landing on a river platform survives, drifts, and hops back onto the land grid', () => {
  const g=started(),lane=river(g);lane.phase=12;lane.direction=1;lane.speed=.75;
  g.player={x:0,y:4};g.move(0,1);advance(g,.2);
  assert.equal(g.state,'playing');assert.equal(g.score,5);
  const x=g.player.x;advance(g,.5);assert(g.player.x>x+.3);
  g.move(0,-1);advance(g,.2);assert.equal(g.player.y,4);assert.equal(g.player.x,0);
});
test('landing in water ends the run without awarding the failed lane', () => {
  const g=started(),lane=river(g);lane.phase=14.4;lane.speed=0;
  g.player={x:0,y:4};g.move(0,1);advance(g,.2);
  assert.equal(g.state,'over');assert.equal(g.score,0);assert.match(g.reason,/splash/);
});
test('platforms carry the traveler off the playable edge', () => {
  const g=started(),lane=river(g);lane.phase=17;lane.direction=1;lane.speed=1;
  g.player={x:5,y:5};advance(g,.4);assert.equal(g.state,'over');assert.match(g.reason,/drifted/);
});
test('curse has a safe window, one-second warning, thorns, and recovery', () => {
  const g=started(),lane=cursed(g);lane.phase=0;
  for(const [time,state] of [[0,'safe'],[3,'warning'],[4,'danger'],[6,'safe']]) {
    g.time=time;assert.equal(g.curse(lane).state,state);
  }
  g.time=3;g.player={x:0,y:8};advance(g,.5);assert.equal(g.state,'playing');
  advance(g,.6);assert.equal(g.state,'over');assert.match(g.reason,/thorns/);
});
test('dangerous cursed landing fails; quiet crossing survives', () => {
  for(const [phase,expected] of [[0,'playing'],[4,'over']]) {
    const g=started();cursed(g).phase=phase;g.player={x:0,y:7};g.move(0,1);advance(g,.2);
    assert.equal(g.state,expected);assert.equal(g.score,expected==='over'?0:8);
  }
});
test('pause freezes river drift, curse timers, and hops; restart resets', () => {
  const g=started();river(g).phase=12;g.player={x:0,y:5};g.togglePause();
  const before=JSON.stringify({time:g.time,player:g.player});advance(g,2);
  assert.equal(JSON.stringify({time:g.time,player:g.player}),before);assert.equal(g.move(0,1),false);
  g.togglePause();advance(g,.1);assert(g.time>0);
  g.reset(42);assert.equal(g.state,'ready');assert.equal(g.score,0);assert.equal(g.time,0);assert.equal(g.reason,'');
});
test('lane cache stays bounded over a long run', () => {
  const g=started();for(let row=0;row<1000;row+=10){g.player={x:0,y:row};g.lane(row).type='clearing';g.lane(row+17);g.update(.01);}
  assert(g.lanes.size<40);
});

test('random layouts have short challenges, protected curse lanes, and rare helpers', () => {
  let rivers=0,helpers=0;const kinds=new Set(),signatures=new Set();
  for(let seed=0;seed<100;seed++) {
    const g=new Crossing(seed);let streak=0;
    signatures.add(Array.from({length:64},(_,row)=>g.lane(row).type).join(','));
    for(let row=0;row<256;row++) {
      const lane=g.lane(row),prev=g.lane(row-1),next=g.lane(row+1);
      streak=lane.type==='clearing'?0:streak+1;assert(streak<=2);
      if(lane.type==='cursed') {assert.equal(prev.type,'clearing');assert.equal(next.type,'clearing');}
      if(prev.type!=='clearing' && lane.type!=='clearing') assert.equal(lane.type,prev.type);
      if(lane.type==='hazard') {kinds.add(lane.hazard);assert(lane.speed<3.3);assert(8-lane.length>6);}
      if(lane.type==='river') {
        rivers++;
        if(lane.variant===2) {helpers++;assert.equal(prev.type,'clearing');assert.notEqual(next.variant,2);}
      }
    }
  }
  assert.equal(kinds.size,3);assert(signatures.size>90);
  assert(helpers/rivers>.03 && helpers/rivers<.16,`helper frequency: ${helpers/rivers}`);
});
test('lane generation is independent of query order, pruning, and restarts', () => {
  const a=new Crossing(456),b=new Crossing(456);
  for(let row=200;row>=0;row--) b.lane(row);
  for(let row=0;row<=200;row++) assert.deepEqual(a.lane(row),b.lane(row));
  const original=a.lane(99);a.lanes.clear();assert.deepEqual(a.lane(99),original);
  a.reset(456);assert.deepEqual(a.lane(99),original);
});
test('each hazard variant collides during hops and identifies what hit the player', () => {
  for(const kind of ['boulder','bramble','boar']) {
    const g=started();Object.assign(g.lane(2),{type:'hazard',hazard:kind,phase:12,speed:0});
    g.player={x:0,y:1};g.move(0,1);advance(g,.2);assert.equal(g.state,'over');
    assert.match(g.reason,kind==='bramble'?/thorn wheel/:new RegExp(kind));
  }
});
test('giant mushrooms support a landing, carry the rider, and freeze their hop on pause', () => {
  const g=started(),lane=river(g);Object.assign(lane,{variant:2,phase:12,direction:1,speed:.75});
  g.player={x:0,y:4};g.move(0,1);advance(g,.2);assert.equal(g.state,'playing');assert.equal(g.score,5);
  const x=g.player.x;advance(g,.5);assert(g.player.x>x+.3);
  assert(g.platformLift(lane)>=0 && g.platformLift(lane)<=.32);
  const lift=g.platformLift(lane);g.togglePause();advance(g,2);assert.equal(g.platformLift(lane),lift);
  g.togglePause();g.move(0,-1);advance(g,.2);assert.equal(g.player.y,4);assert.equal(g.state,'playing');
});
