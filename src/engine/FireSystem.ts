/**
 * Клиентский порт Python FireSystem — симуляция распространения огня.
 *
 * Сетка (grid): height × width.
 *   > 0  — температура (горит)
 *   == 0 — пустая клетка
 *   < 0  — стена (|value| = прочность, разрушается от огня)
 */

export interface FireTruckState {
  id: string;
  x: number;
  y: number;
  water: number;
  max_water: number;
  nozzle_x: number | null;
  nozzle_y: number | null;
  hose_open: boolean;
  hydrant_connected: boolean;
}

export interface FireSimSnapshot {
  ticks: number;
  width: number;
  height: number;
  grid: number[][];
  sources: Array<{ x: number; y: number; intensity: number }>;
  active_water: Array<{ x: number; y: number }>;
  trucks: Array<{
    id: string;
    x: number;
    y: number;
    water: number;
    max_water: number;
    hose_open: boolean;
    hydrant_connected: boolean;
    hose_end: { x: number; y: number } | null;
  }>;
}

export class FireSystem {
  width: number;
  height: number;
  speedN: number;
  ticks = 0;

  grid: number[][];
  sources: Map<string, number> = new Map(); // "x,y" -> intensity
  activeWater: Set<string> = new Set();     // "x,y"
  trucks: Map<string, FireTruckState> = new Map();

  constructor(width: number, height: number, speedN = 1) {
    this.width = width;
    this.height = height;
    this.speedN = speedN;
    this.grid = Array.from({ length: height }, () => new Array(width).fill(0));
  }

  // ── Setup ──────────────────────────────────────────────

  setWall(x: number, y: number, hp = -30): void {
    this.grid[y][x] = hp !== 0 ? -Math.abs(hp) : -30;
  }

  setSource(x: number, y: number, intensity = 1000): void {
    this.sources.set(`${x},${y}`, intensity);
    this.grid[y][x] = intensity;
  }

  setFiretruck(id: string, x: number, y: number, water = 2400): void {
    const existing = this.trucks.get(id);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.water = water;
      existing.max_water = water;
    } else {
      this.trucks.set(id, {
        id, x, y, water, max_water: water,
        nozzle_x: null, nozzle_y: null, hose_open: false,
        hydrant_connected: false,
      });
    }
  }

  setHoseNozzle(truckId: string, nozzleX: number, nozzleY: number, isOpen: boolean): void {
    const truck = this.trucks.get(truckId);
    if (!truck) return;
    truck.nozzle_x = nozzleX;
    truck.nozzle_y = nozzleY;
    truck.hose_open = isOpen;
  }

  setHydrantConnected(truckId: string, connected: boolean): void {
    const truck = this.trucks.get(truckId);
    if (!truck) return;
    truck.hydrant_connected = connected;
  }

  // ── Ray-cast для воды ──────────────────────────────────

  private isPathBlocked(sx: number, sy: number, ex: number, ey: number): boolean {
    const steps = Math.max(Math.abs(ex - sx), Math.abs(ey - sy));
    if (steps === 0) return false;
    for (let i = 1; i < steps; i++) {
      const tx = Math.floor(sx + (ex - sx) * i / steps);
      const ty = Math.floor(sy + (ey - sy) * i / steps);
      if (tx >= 0 && tx < this.width && ty >= 0 && ty < this.height) {
        if (this.grid[ty][tx] < 0) return true;
      }
    }
    return false;
  }

  // ── Тушение ────────────────────────────────────────────

  private applyWater(truck: FireTruckState, radius = 8, amount = 100, spreadDeg = 45): void {
    if (truck.nozzle_x == null || truck.nozzle_y == null) return;
    if (truck.water <= 0) return;

    const nx = truck.nozzle_x;
    const ny = truck.nozzle_y;

    // Ближайший огонь
    let nearX = 0, nearY = 0, nearDist = Infinity;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] > 0) {
          const d = Math.hypot(x - nx, y - ny);
          if (d < nearDist) { nearDist = d; nearX = x; nearY = y; }
        }
      }
    }
    if (nearDist === Infinity) return;

    const mainAngle = Math.atan2(nearY - ny, nearX - nx);
    const halfSpread = (Math.min(spreadDeg, 45) / 2) * Math.PI / 180;
    let waterUsed = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (truck.water - waterUsed <= 0) break;

        const dx = x - nx, dy = y - ny;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) continue;

        const cellAngle = Math.atan2(dy, dx);
        let diff = (cellAngle - mainAngle + Math.PI) % (2 * Math.PI) - Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        if (Math.abs(diff) > halfSpread) continue;

        if (this.grid[y][x] < 0) continue;
        if (this.isPathBlocked(nx, ny, x, y)) continue;

        this.activeWater.add(`${x},${y}`);

        if (this.grid[y][x] > 0) {
          const reduction = Math.min(amount, this.grid[y][x]);
          this.grid[y][x] = Math.max(0, Math.round((this.grid[y][x] - amount) * 100) / 100);
          waterUsed += reduction;
        }

        const key = `${x},${y}`;
        if (this.sources.has(key)) {
          this.sources.set(key, Math.max(0, this.sources.get(key)! - amount * 0.5));
        }
      }
    }

    truck.water = Math.max(0, truck.water - waterUsed);
  }

  // ── Основной тик ───────────────────────────────────────

  update(): boolean {
    this.ticks++;
    if (this.ticks % this.speedN !== 0) return false;

    // Фаза 0: пополнение бака от гидранта
    const HYDRANT_REFILL_RATE = 200;
    for (const truck of this.trucks.values()) {
      if (truck.hydrant_connected && !truck.hose_open) {
        truck.water = Math.min(truck.max_water, truck.water + HYDRANT_REFILL_RATE);
      }
    }

    // Фаза 1: тушение
    this.activeWater.clear();
    for (const truck of this.trucks.values()) {
      if (truck.hose_open) {
        if (truck.water <= 0) {
          truck.hose_open = false;
          continue;
        }
        this.applyWater(truck);
      }
    }

    // Фаза 2: распространение огня
    const newGrid: number[][] = this.grid.map(row => [...row]);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const current = this.grid[y][x];
        const key = `${x},${y}`;

        // Источник
        if (this.sources.has(key)) {
          const intensity = this.sources.get(key)!;
          if (intensity > 0) {
            this.sources.set(key, intensity + 1);
            newGrid[y][x] = intensity + 1;
          }
          continue;
        }

        // Стена — разрушается от огня
        if (current < 0) {
          let hasFireNeighbor = false;
          for (let dy = -1; dy <= 1 && !hasFireNeighbor; dy++) {
            for (let dx = -1; dx <= 1 && !hasFireNeighbor; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                if (this.grid[ny][nx] > 0) hasFireNeighbor = true;
              }
            }
          }
          newGrid[y][x] = hasFireNeighbor ? current + 1 : current;
          continue;
        }

        // Обычная клетка
        if (current >= 0) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                if (!this.activeWater.has(`${nx},${ny}`)) {
                  const val = this.grid[ny][nx];
                  if (val > 0) {
                    // Диагональное распространение блокируется стеной
                    if (dx !== 0 && dy !== 0) {
                      if (this.grid[y][nx] < 0 || this.grid[ny][x] < 0) continue;
                    }
                    sum += val;
                  }
                }
              }
            }
          }
          const mean = Math.round((sum / 8) * 100) / 100;
          let newTemp = Math.max(current, mean);
          if (newTemp > 0) newTemp += 1;
          newGrid[y][x] = Math.round(newTemp * 100) / 100;
        }
      }
    }

    this.grid = newGrid;

    // Очистка потухших источников
    for (const [key, val] of this.sources) {
      if (val <= 0) this.sources.delete(key);
    }

    return true;
  }

  // ── Сериализация ───────────────────────────────────────

  toSnapshot(): FireSimSnapshot {
    const sources: FireSimSnapshot['sources'] = [];
    for (const [key, intensity] of this.sources) {
      const [x, y] = key.split(',').map(Number);
      sources.push({ x, y, intensity });
    }

    const active_water: FireSimSnapshot['active_water'] = [];
    for (const key of this.activeWater) {
      const [x, y] = key.split(',').map(Number);
      active_water.push({ x, y });
    }

    const trucks: FireSimSnapshot['trucks'] = [];
    for (const t of this.trucks.values()) {
      trucks.push({
        id: t.id, x: t.x, y: t.y, water: t.water, max_water: t.max_water,
        hose_open: t.hose_open, hydrant_connected: t.hydrant_connected,
        hose_end: t.nozzle_x != null && t.nozzle_y != null
          ? { x: t.nozzle_x, y: t.nozzle_y } : null,
      });
    }

    return {
      ticks: this.ticks,
      width: this.width,
      height: this.height,
      grid: this.grid,
      sources,
      active_water,
      trucks,
    };
  }
}
