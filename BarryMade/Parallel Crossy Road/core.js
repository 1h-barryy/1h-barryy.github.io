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
      this.state = 'ready'; this.lanes = new Map();
    }
    lane(row) {
      if (this.lanes.has(row)) return this.lanes.get(row);
      const r = noise(this.seed, row * 31);
      // Two safe starting rows, then groups of 1–3 roads separated by grass.
      const road = row >= 2 && mod(row, 5) >= 2 && !(mod(row, 5) === 4 && r < .45);
      const lane = { row, type: road ? 'road' : 'grass', direction: r < .5 ? -1 : 1,
        speed: 1.25 + noise(this.seed, row * 31 + 1) * .95 + Math.min(Math.max(0, row) * .012, 1),
        phase: noise(this.seed, row * 31 + 2) * PERIOD,
        length: r > .72 ? 2.05 : 1.5, color: Math.floor(r * 5) };
      this.lanes.set(row, lane);
      return lane;
    }
    cars(lane) {
      if (lane.type !== 'road') return [];
      return [0, 8, 16].map(offset => ({
        x: mod(lane.phase + offset + this.time * lane.speed * lane.direction, PERIOD) - PERIOD / 2,
        y: lane.row, length: lane.length, color: lane.color, direction: lane.direction
      }));
    }
    start() { if (this.state === 'ready') this.state = 'playing'; }
    togglePause() {
      if (this.state === 'playing') this.state = 'paused';
      else if (this.state === 'paused') this.state = 'playing';
    }
    move(dx, dy) {
      if (this.state !== 'playing' || this.hop || Math.abs(dx) + Math.abs(dy) !== 1) return false;
      const x = this.player.x + dx, y = this.player.y + dy;
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
      // Small collision steps prevent tunneling through a car during a hop.
      let remaining = Math.min(dt, .1);
      while (remaining > 1e-8 && this.state === 'playing') {
        const step = Math.min(remaining, 1 / 120); remaining -= step; this.time += step;
        if (this.hop) this.hop.elapsed += step;
        const p = this.position();
        for (let row = Math.floor(p.y) - 1; row <= Math.ceil(p.y) + 1; row++) {
          if (Math.abs(p.y - row) >= .55) continue;
          if (this.cars(this.lane(row)).some(car => Math.abs(p.x - car.x) < car.length / 2 + .23)) {
            this.state = 'over'; break;
          }
        }
        if (this.state === 'playing' && this.hop && this.hop.elapsed >= HOP) {
          this.player = { x: this.hop.x, y: this.hop.y }; this.hop = null;
          this.score = Math.max(this.score, this.player.y);
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
