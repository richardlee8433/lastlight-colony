// 資料文字的英文版（中文原文在 src/data/*.json）
type Node = [string, string];
interface B { name: string; desc: string; nodes?: Record<string, Node> }

const buildings: Record<string, B> = {
  escape_pod: { name: 'Escape Pod', desc: 'Where it all began. Three survivors crammed inside — it is barely livable.', nodes: {
    beacon: ['Distress Band', 'Birth rate +10%'] } },
  scrap_heap: { name: 'Scrap Heap', desc: 'Wreckage from the pod, scattered across the ground. Hold the Scrap button above it to collect.', nodes: {
    click_1: ['Magnetic Gloves', 'Click yield +1'], crit_1: ['Sharp Eyes', 'Crit chance +5%'], cap_1: ['Zoned Search', 'Worker cap +1'],
    critx: ['Treasure Instinct', 'Crit multiplier ×2'], buff_10: ['On-site Supervisor', 'Click buff lasts 10 s'] } },
  algae_tank: { name: 'Algae Vat', desc: 'Recycled water and algae spores in glass vats, slowly growing something edible.', nodes: {
    prod_20: ['Light Tuning', 'Output +20%'], cap_1: ['Extra Vat', 'Worker cap +1'], prod_30: ['Dense Strain', 'Output +30%'] } },
  emergency_camp: { name: 'Emergency Camp', desc: 'Command Lv1. Inflatable pressurized domes and radiant heaters — the survivors can finally take their helmets off indoors. Unlocks building upgrades and upgrade lines, and advances to Stage 2.' },
  hab_pod: { name: 'Hab Pod', desc: 'Houses 2 people per level. The population cap decides whether new colonists can keep arriving.', nodes: {
    cap_1: ['Bunk Beds', 'Capacity +1'], birth: ['Nursery Corner', 'Birth rate +10%'], cap_2: ['Extra Partitions', 'Capacity +2'] } },
  bio_harvester: { name: 'Bio Harvester', desc: 'Harvests edible surface life. More efficient than the Algae Vat, but only 2 workers per level.', nodes: {
    prod_25: ['Field Guide', 'Output +25%'], crit_1: ['Keen Eye', 'Crit chance +5%'] } },
  cargo: { name: 'Cargo Container', desc: 'Each level raises storage for every resource by 100.', nodes: {
    stack: ['Stacking Frames', '+50 more storage per level'] } },
  lounge: { name: 'Lounge Pod', desc: 'Morale +5 per level. Each stationed worker adds 10% food security.', nodes: {
    morale_5: ['Movie Night', 'Morale +5'], window_90: ['Shared Meals', 'Food security window becomes 90 s'] } },
  assembly: { name: 'Assembly Shop', desc: 'Breaks scrap down and rebuilds it into parts. Stops when scrap runs out.', nodes: {
    ratio_1: ['Sorting Line', 'Ratio 0.4 → 0.5'], ratio_2: ['Precision Jigs', 'Ratio 0.5 → 0.6'] } },
  rock_cutter: { name: 'Rock Cutter', desc: 'A laser cutter salvaged from the pod, refitted to slice building stone from the bedrock.', nodes: {
    prod_20: ['Blade Care', 'Output +20%'], cap_1: ['Night Shift', 'Worker cap +1'], click_1: ['Manual Trim', 'Click yield +1'] } },
  central_hub: { name: 'Central Hub', desc: 'Command Lv2. A real settlement center: housing for 4, +100 storage, and advances to Stage 3. Requires population 12.' },
  databank: { name: 'Databank', desc: 'Catalogs everything the colonists remember. Needs stationed workers to run colony-wide research.', nodes: {
    speed_50: ['Index System', 'Research speed +50%'] } },
  rail_line: { name: 'Rail Line', desc: 'All gathering buildings +10% output, and workers move faster.', nodes: {
    double: ['Double Track', 'Gathering output +5% more'] } },
  metal_mine: { name: 'Metal Mine', desc: 'Digs down to the metal veins. Output is low, but every step ahead needs it.', nodes: {
    prod_20: ['Shoring', 'Output +30%'], click_1: ['Vein Probe', 'Click yield +1'], crystal_sense: ['Crystal Sense', 'Clicks have a 10% chance to drop 1 xenocrystal shard'] } },
  forge: { name: 'Forge', desc: 'Forges metal into tools or weapons. From Stage 4 you can move workers onto weapons. Buildings need tools from Lv5 onward.', nodes: {
    tools_25: ['Standard Molds', 'Tool output +25%'], click_1: ['Master Smith', 'Click yield +1'], weapon_atk: ['Weapon Calibration', 'Weapon attack +1'] } },
  outpost: { name: 'Outpost', desc: 'Command Lv3. The watchtower sees farther — including what is coming closer. Advances to Stage 4. Requires population 22.' },
  hydro_farm: { name: 'Hydroponic Farm', desc: 'Grows vegetables in nutrient solution inside pressurized greenhouses — the most efficient food source.', nodes: {
    prod_25: ['Grow Lights', 'Output +25%'], cap_2: ['Vertical Racks', 'Worker cap +2'] } },
  memorial: { name: 'Memorial Hall', desc: 'For those who did not make it here. Morale +10 and birth rate +10% per level.', nodes: {
    morale_5: ['Eternal Lamp', 'Morale +5'] } },
  crystal_synth: { name: 'Crystal Synthesizer', desc: 'Dissolves underground crystal clusters and regrows them into energy-storing xenocrystal. Output is tiny, but all alien tech depends on it.', nodes: {
    prod_30: ['Resonance Tank', 'Output +30%'], cap_1: ['Second Reactor', 'Worker cap +1'] } },
  security: { name: 'Security Post', desc: 'Stationed workers are guards; each takes 1 population. Weapons in stock are issued automatically, raising attack from 2 to 5.', nodes: {
    hp_5: ['Armored Vests', 'Guard HP +5'], shift: ['Medic Rotation', 'Injury recovery −50%'], atk_2: ['Tactical Drills', 'Guard attack +2'] } },
  water_cycle: { name: 'Water Recycler', desc: 'Reclaims wastewater and condensation. Nutrient consumption −10%, and each Hab Pod level houses 1 more.' },
  colony_core: { name: 'Colony Core', desc: 'Command Lv4. A xenocrystal reactor — the colony is no longer just surviving. Requires population 40 and 2 raids repelled.' },
  admin: { name: 'Administration Hall', desc: 'The colony council chamber. Unlocks taxes and colony charters; taxes bring in credits, but every tax level costs 5 morale.', nodes: {
    council: ['Expanded Council', 'Charter slots +1'] } },
  trade_post: { name: 'Trading Post', desc: 'The colony market. Workers earn credits here, and you can trade with Helion Corp.', nodes: {
    prod_30: ['Night Market', 'Output +30%'], cap_2: ['More Stalls', 'Worker cap +2'] } },
  spaceport: { name: 'Spaceport', desc: 'Receives shuttles from other colonies. Opens Free Colonies Alliance trade; add a Xenology Institute to answer that mysterious signal.' },
  turret: { name: 'Defense Turret', desc: 'Fixed defense. One turret per level (ATK 8, HP 40); uses no population and repairs itself after battle.' },
  xeno_lab: { name: 'Xenology Institute', desc: 'A lab devoted to xenocrystal. Unlocks the xeno research line; stationed researchers also speed up all research.' },
  star_dome: { name: 'Star Dome', desc: 'Command Lv5. A glass dome over the whole colony — from this day on, it is a city. Requires population 80 and 5,000 credits earned.' },
};

const research: Record<string, [string, string]> = {
  gather_1: ['Gathering I', 'All gathering output +10%'],
  storage_1: ['Standard Shelving', 'All storage +25%'],
  crit_1: ['Precise Handling', 'All click crit chance +3%'],
  ration_1: ['Lean Recipes', 'Nutrient consumption −10%'],
  process_1: ['Process Tuning', 'Processing speed +20%'],
  gather_2: ['Gathering II', 'All gathering output +10%'],
  click_1: ['Reinforced Gloves', 'All click yield +1'],
  crystal_armor: ['Crystal Armor', 'Guard HP +5'],
  crystal_ration: ['Emergency Rations', 'Nutrient consumption −10%'],
  crystal_resonance: ['Crystal Resonance', 'All gathering output +10%'],
  warehouse: ['Warehouse Expansion', 'All storage +50%'],
  xeno_growth: ['Crystal Catalysis', 'Xenocrystal output +40%'],
  xeno_hab: ['Lattice Materials', 'Each Hab Pod level houses 1 more'],
  xeno_turret: ['Crystal Barrels', 'Turret attack +6'],
};

const charters: Record<string, [string, string, string]> = {
  rationing: ['Rationing', 'Nutrient consumption −20%', 'Morale −10'],
  double_shift: ['Double Shifts', 'All output +15%', 'Morale −10'],
  open_immigration: ['Open Immigration', 'Birth rate +30%', 'Morale −5'],
  rest_day: ['Rest Day', 'Morale +15', 'All output −10%'],
  corp_contract: ['Corporate Contract', 'Credit income +40%', 'Corp relation +1, morale −5'],
  alien_first: ['Xeno First', 'Xenocrystal output +25%', 'Metal output −15%'],
};

const chapters = [
  {
    title: 'The Fall', subtitle: 'Three survivors, first night',
    intro: [
      'The escape pod burned half away in the atmosphere and finally speared into a rust-red wasteland.',
      'You were contract laborers for Helion Corp — and now you are fugitives. Nobody knows you are here. That is good news, and bad news.',
      'The air outside is thin and cold; without a helmet you will not last minutes, and the pod’s life support will not have power forever. Salvage what you can and build somewhere pressurized to live.',
    ],
    goals: ['Hold the Scrap button above the Scrap Heap to collect 20 scrap', 'Build an Algae Vat to start producing nutrients', 'Assign colonists to work at a building', 'Build the Emergency Camp'],
  },
  {
    title: 'Taking Root', subtitle: 'This planet is livable',
    intro: [
      'The heaters glowed all night. Nothing walked out of the dark.',
      'The atmosphere analysis is in: oxygen is thin, but filtered and pressurized, it is breathable. This morning someone saw another pod glinting on the horizon — more people are heading this way.',
      'Build homes, stock up food, and give them a reason to stay.',
    ],
    goals: ['Build a Hab Pod to raise the population cap', 'Build an Assembly Shop to turn scrap into parts', 'Reach population 12', 'Complete the Central Hub'],
  },
  {
    title: 'Metal and Fire', subtitle: 'From scavenging to making',
    intro: [
      'The day the Central Hub lit up, everyone ate a dinner without rations for the first time.',
      'The old engineer at the databank says that if we can dig up metal, we can make our own tools.',
      'From scavenging to making — this is the step where the colony truly stands on its own.',
    ],
    goals: ['Build a Metal Mine', 'Build a Forge', 'Forge the first batch of tools (20)', 'Reach population 22', 'Complete the Outpost'],
  },
  {
    title: 'Xenocrystal', subtitle: 'This planet does not want them',
    intro: [
      'The first time the outpost searchlight swept the wasteland, it lit up a pack of things watching us.',
      'They are small, but there are many, and they learn fast. The crystal clusters glow violet at night — that is the light they follow.',
      'Build a security post, forge weapons, learn to use xenocrystal. This planet does not want you, but you have nowhere else to go.',
    ],
    goals: ['Build a Security Post and station guards', 'Build a Crystal Synthesizer', 'Repel 2 alien raids', 'Reach population 40', 'Complete the Colony Core'],
  },
  {
    title: 'The Corporation’s Shadow', subtitle: 'The price of freedom',
    intro: [
      'Three days after the Colony Core lit up, a transport ship that belonged to no one appeared in orbit.',
      'Helion Corp has found you. They did not open fire — they just sent a document: mining rights, debts, interest, every line spelled out.',
      'To be free, the colony has to pay its own way. Pass laws, collect taxes, trade — and then decide whether to say no to the corporation.',
    ],
    goals: ['Build the Administration Hall', 'Pass your first colony charter', 'Receive the corporate envoy and make a choice', 'Earn 5,000 credits in total', 'Reach population 80', 'Complete the Star Dome'],
  },
];

const events: Record<string, { title: string; text: string; options: string[] }> = {
  meteor: {
    title: 'Meteor Shower',
    text: 'A string of fire streaks across the sky — debris is falling toward the {building}.',
    options: ['Reinforce it for {cost} stone', 'Tough it out ({building} stops for 60 s)'],
  },
  rescue: {
    title: 'Distress Signal',
    text: 'The comm picks up a broken distress signal from the canyon nearby. It could be other survivors — or just a beacon still broadcasting.',
    options: ['Send 2 idle colonists (3 min)', 'Ignore it'],
  },
  envoy: {
    title: 'Corporate Envoy',
    text: 'A shuttle bearing the Helion logo lands in the plaza. The envoy is polite: mining rights on this planet belong to the corporation, but as long as you pay {demand} on time, the corporation is willing to “temporarily” overlook your breach of contract.',
    options: ['Pay {demand}', 'Refuse (refused {refusals} times)'],
  },
};

export default { buildings, research, charters, chapters, events };
