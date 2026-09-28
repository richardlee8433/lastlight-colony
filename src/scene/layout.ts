// 建築位置固定（GDD §5）：指揮艙在中央，階段 1 內圈、階段 2 中圈、階段 3 外圈。
export const MW = 780, MH = 520;
export const CENTER = { x: 390, y: 250 };
export interface Site { id: string; x: number; y: number; r?: number; hub?: boolean }
export const SITES: Site[] = [
  { id: 'command', x: 390, y: 272, r: 34, hub: true },
  { id: 'escape_pod', x: 311, y: 254 },
  { id: 'scrap_heap', x: 469, y: 254 },
  { id: 'algae_tank', x: 390, y: 326 },
  { id: 'hab_pod', x: 222, y: 272 },
  { id: 'bio_harvester', x: 306, y: 364 },
  { id: 'cargo', x: 306, y: 184 },
  { id: 'lounge', x: 474, y: 184 },
  { id: 'assembly', x: 558, y: 272 },
  { id: 'rock_cutter', x: 474, y: 364 },
  { id: 'databank', x: 212, y: 166 },
  { id: 'metal_mine', x: 568, y: 166 },
  { id: 'forge', x: 568, y: 388 },
  { id: 'rail_line', x: 212, y: 390 },
  // 階段 4：最外圈
  { id: 'memorial', x: 390, y: 126 },
  { id: 'hydro_farm', x: 130, y: 282 },
  { id: 'security', x: 654, y: 276 },
  { id: 'water_cycle', x: 390, y: 448 },
  { id: 'crystal_synth', x: 660, y: 452 },
  // 階段 5：四個角落與上緣
  { id: 'admin', x: 560, y: 74 },
  { id: 'trade_post', x: 220, y: 74 },
  { id: 'xeno_lab', x: 86, y: 152 },
  { id: 'turret', x: 712, y: 150 },
  { id: 'spaceport', x: 132, y: 474 },
];
/** 襲擊時異星生物從哪一側出現（依 incoming.side） */
export const RAID_SPAWN = [{ x: -30, y: 250 }, { x: 810, y: 240 }, { x: 390, y: -30 }, { x: 400, y: 550 }];
/** 預警結束時異星生物停下的位置：地圖邊緣內側（殖民地外圍），不會提早闖進建築群 */
export const RAID_RALLY = [{ x: 34, y: 230 }, { x: 746, y: 220 }, { x: 390, y: 28 }, { x: 440, y: 508 }];
export const HOME = { x: CENTER.x, y: CENTER.y + 30 };
