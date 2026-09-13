/* Simulation is independent of drawing so movement and collision can be tested. */
(function (root) {
  'use strict';
  const LIMIT = 5, HOP = 0.16, PERIOD = 24;
  const mod = (n, m) => ((n % m) + m) % m;
  function noise(seed, n) {
    let x = Math.imul((n + seed) | 0, 1597334677);
    x = Math.imul(x ^ (x >>> 16), 2246822507);
    return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
  }
  class Crossing {
    constructor(seed = Math.floor(Math.random() * 1000000)) { this.reset(seed); }
    reset(seed = Math.floor(Math.random() * 1000000)) {
      this.seed = seed; this.time = 0; this.score = 0;
      this.player = { x: 0, y: 0 }; this.hop = null;
      this.facing = { x: 0, y: 1 };
      this.state = 'ready'; this.reason = ''; this.lanes = new Map();
    }
    laneType(row) {
      if (row < 2) return 'clearing';
      // Seeded, variable-length encounters and rests. Rebuild a small block
      // independently so backtracking and out-of-order rendering stay stable.
      const block = Math.floor(row / 32), local = mod(row, 32);
      let cursor = block === 0 ? 2 : 0, encounter = 0;
      while (cursor < 31) {
        const key = block * 1009 + encounter * 17 + 700001;
        const roll = noise(this.seed, key);
        const type = block === 0 && encounter === 0 ? 'hazard' : roll < .52 ? 'hazard' : roll < .86 ? 'river' : 'cursed';
        const length = type === 'cursed' ? 1 : noise(this.seed, key + 1) < .55 ? 1 : 2;
        if (local >= cursor && local < Math.min(cursor + length, 31)) return type;
        cursor += length + (noise(this.seed, key + 2) < .72 ? 1 : 2);
        encounter++;
      }
      return 'clearing';
    }
    lane(row) {
      if (this.lanes.has(row)) return this.lanes.get(row);
      const r = noise(this.seed, row * 31);
      const type = this.laneType(row);
      const lane = { row, type, direction: r < .5 ? -1 : 1,
        speed: 1.25 + noise(this.seed, row * 31 + 1) * .95 + Math.min(Math.max(0, row) * .012, 1),
        phase: noise(this.seed, row * 31 + 2) * PERIOD,
        length: r > .72 ? 1.8 : 1.35, color: Math.floor(r * 5),
        variant: Math.floor(noise(this.seed, row * 31 + 3) * 3) === 1 ? 1 : 0,
        hazard: ['boulder', 'bramble', 'boar'][Math.floor(noise(this.seed, row * 67 + 90001) * 3)] };
      if (type === 'river') {
        lane.speed = .65 + r * .35; lane.length = 3.2;
        // Rare helpers only at the start of a river, with no consecutive rows.
        if (this.laneType(row - 1) === 'clearing' && noise(this.seed, row * 97 + 60001) < .16) lane.variant = 2;
      }
      this.lanes.set(row, lane);
      return lane;
    }
    movers(lane) {
      if (lane.type !== 'hazard' && lane.type !== 'river') return [];
      const offsets = lane.type === 'river' ? [0, 4.8, 9.6, 14.4, 19.2] : [0, 8, 16];
      return offsets.map(offset => ({
        x: mod(lane.phase + offset + this.time * lane.speed * lane.direction, PERIOD) - PERIOD / 2,
        y: lane.row, length: lane.length, color: lane.color, direction: lane.direction, variant: lane.variant, hazard: lane.hazard
      }));
    }
    platformLift(lane) {
      if (lane.type !== 'river' || lane.variant !== 2) return 0;
      return Math.max(0, Math.sin((this.time + lane.phase) * Math.PI * 2 / 3.4)) * .32;
    }
    curse(lane) {
      const phase = mod(this.time + lane.phase, 6);
      return { state: phase < 3 ? 'safe' : phase < 4 ? 'warning' : 'danger',
        remaining: phase < 3 ? 3 - phase : phase < 4 ? 4 - phase : 6 - phase };
    }
    support(lane, x) {
      return this.movers(lane).find(platform => Math.abs(x - platform.x) <= platform.length / 2 - .18);
    }
    end(reason) { this.state = 'over'; this.reason = reason; }
    start() { if (this.state === 'ready') this.state = 'playing'; }
    togglePause() {
      if (this.state === 'playing') this.state = 'paused';
      else if (this.state === 'paused') this.state = 'playing';
    }
    move(dx, dy) {
      if (this.state !== 'playing' || this.hop || Math.abs(dx) + Math.abs(dy) !== 1) return false;
      const y = this.player.y + dy;
      // Keep hops on the land grid; on water, preserve the platform's drift.
      const x = (dy && this.lane(y).type !== 'river' ? Math.round(this.player.x) : this.player.x) + dx;
      if (Math.abs(x) > LIMIT || y < 0) return false;
      this.facing = { x: dx, y: dy };
      this.hop = { fromX: this.player.x, fromY: this.player.y, x, y, elapsed: 0 };
      return true;
    }
    position() {
      if (!this.hop) return { ...this.player, lift: 0 };
      const h = this.hop, t = Math.min(h.elapsed / HOP, 1);
      return { x: h.fromX + (h.x - h.fromX) * t, y: h.fromY + (h.y - h.fromY) * t,
        lift: Math.sin(t * Math.PI) * .42 };
    }
    update(dt) {
      if (this.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
      // Small collision steps prevent tunneling through a moving hazard during a hop.
      let remaining = Math.min(dt, .1);
      while (remaining > 1e-8 && this.state === 'playing') {
        const step = Math.min(remaining, 1 / 120); remaining -= step;
        const currentLane = this.lane(this.player.y);
        if (!this.hop && currentLane.type === 'river') {
          if (!this.support(currentLane, this.player.x)) { this.end('The river carried you away. Land on a log or mushroom raft.'); break; }
          this.player.x += currentLane.speed * currentLane.direction * step;
        }
        this.time += step;
        if (this.hop) this.hop.elapsed += step;
        const p = this.position();
        for (let row = Math.floor(p.y) - 1; row <= Math.ceil(p.y) + 1; row++) {
          if (Math.abs(p.y - row) >= .55) continue;
          const lane = this.lane(row);
          if (lane.type === 'hazard' && this.movers(lane).some(mover => Math.abs(p.x - mover.x) < mover.length / 2 + .23)) {
            const name = { boulder: 'A rolling boulder', bramble: 'A thorn wheel', boar: 'A charging spirit boar' }[lane.hazard];
            this.end(`${name} crossed your path. Watch for a gap.`); break;
          }
        }
        if (this.state === 'playing' && this.hop && this.hop.elapsed >= HOP) {
          this.player = { x: this.hop.x, y: this.hop.y }; this.hop = null;
        }
        if (this.state === 'playing' && !this.hop) {
          const landed = this.lane(this.player.y);
          if (Math.abs(this.player.x) > LIMIT + .2) this.end('You drifted beyond the trail. Hop back toward the middle.');
          else if (landed.type === 'river' && !this.support(landed, this.player.x)) this.end('A splash in the moonlight. Land on a log or mushroom raft.');
          else if (landed.type === 'cursed' && this.curse(landed).state === 'danger') this.end('The thorns awoke. Cross while the runes are quiet.');
          else this.score = Math.max(this.score, this.player.y);
        }
      }
      // Recreated lanes retain their pattern and traffic phase when revisited.
      for (const row of this.lanes.keys()) if (Math.abs(row - this.player.y) > 25) this.lanes.delete(row);
    }
  }
  const api = { Crossing, noise, LIMIT, HOP };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrossingCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
