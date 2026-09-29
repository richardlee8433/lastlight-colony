// 資料文字的英文版（中文原文在 src/data/*.json）
type Node = [string, string];
interface B { name: string; desc: string; nodes?: Record<string, Node> }

const buildings: Record<string, B> = {
  escape_pod: { name: 'Escape Pod', desc: 'Where it all began. Three survivors crammed inside — it is barely livable.', nodes: {
    beacon: ['Distress Band', 'Birth rate +10%'] } },
  scrap_heap: { name: 'Scrap Heap', desc: 'Wreckage from the pod, scattered across the ground. Hold the Scrap button above it to collect.', nodes: {
    click_1: ['Magnetic Gloves', 'Click yield +1'], crit_1: ['Sharp Eyes', 'Crit chance +5%'], cap_1: ['Zoned Search', 'Worker cap +1'],
    critx: ['Treasure Instinct', 'Crit multiplier ×2'], buff_10: ['On-site Supervisor', 'Click buff lasts 10 s'] } },
  algae_tank: { name: 'Algae Vat', desc: 'The colony’s food supply. It starts as a few glass algae vats; from Stage 2 it can be rebuilt into a Bio Harvester, and from Stage 4 into a Hydroponic Farm, each producing more per worker. Rebuilding keeps its level and workers.', nodes: {
    prod_20: ['Light Tuning', 'Output +20%'], cap_1: ['Extra Vat', 'Worker cap +1'], prod_30: ['Dense Strain', 'Output +30%'],
    guide: ['Field Guide', 'Output +25%'], crit_1: ['Keen Eye', 'Crit chance +5%'], prod_25: ['Grow Lights', 'Output +25%'], cap_2: ['Vertical Racks', 'Worker cap +2'] } },
  'algae_tank:bio': { name: 'Bio Harvester', desc: 'Culture racks added beside the vats raise edible life gathered from the surface. More output per worker than the Algae Vat. Rebuilding keeps its level and workers.' },
  'algae_tank:hydro': { name: 'Hydroponic Farm', desc: 'The whole facility rebuilt as a pressurized greenhouse growing vegetables in nutrient solution — the most efficient food source. Rebuilding keeps its level and workers.' },
  o2_scrubber: { name: 'Oxygen Scrubber', desc: 'An oxygen scrubber cobbled together from escape pod wreckage, splitting carbon dioxide into air you can breathe. Teo calls it “Wheezy” — don’t mind the noise. Hold the button above it to pump by hand.', nodes: {
    filter: ['Fresh Filters', 'Output +25%'], cap_1: ['Extra Fan', 'Worker cap +1'], seal: ['Sealed Gaskets', 'Output +30%'] } },
  electrolyzer: { name: 'Electrolyzer', desc: 'Drills down into the ice layer, melts it and splits the water into oxygen. Ines’s design — each worker makes more than twice the oxygen of a scrubber.', nodes: {
    prod_30: ['Heating Coils', 'Output +30%'], cap_1: ['Second Well', 'Worker cap +1'] } },
  emergency_camp: { name: 'Emergency Camp', desc: 'Command Lv1. Inflatable pressurized domes and radiant heaters — the survivors can finally take their helmets off indoors. Unlocks building upgrades and upgrade lines, and advances to Stage 2.' },
  hab_pod: { name: 'Hab Pod', desc: 'Houses 2 people per level. The population cap decides whether new colonists can keep arriving.', nodes: {
    cap_1: ['Bunk Beds', 'Capacity +1'], birth: ['Nursery Corner', 'Birth rate +10%'], cap_2: ['Extra Partitions', 'Capacity +2'] } },
  cargo: { name: 'Supply Depot', desc: 'Each level raises storage for every resource by 100.', nodes: {
    stack: ['Stacking Frames', '+50 more storage per level'] } },
  lounge: { name: 'Lounge Pod', desc: 'Morale +5 per level. Each stationed worker adds 10% food security.', nodes: {
    morale_5: ['Movie Night', 'Morale +5'], window_90: ['Shared Meals', 'Food security window becomes 90 s'] } },
  assembly: { name: 'Assembly Shop', desc: 'Breaks scrap down and rebuilds it into parts. Stops when scrap runs out.', nodes: {
    ratio_1: ['Sorting Line', 'Ratio 0.4 → 0.5'], ratio_2: ['Precision Jigs', 'Ratio 0.5 → 0.6'] } },
  rock_cutter: { name: 'Rock Cutter', desc: 'A laser cutter salvaged from the pod, refitted to slice building stone from the bedrock.', nodes: {
    prod_20: ['Blade Care', 'Output +20%'], cap_1: ['Night Shift', 'Worker cap +1'], click_1: ['Manual Trim', 'Click yield +1'] } },
  central_hub: { name: 'Central Hub', desc: 'Command Lv2. A real settlement center: housing for 4, +100 storage, and advances to Stage 3. Requires population 12.' },
  databank: { name: 'Tech Institute', desc: 'Gathers everything the colonists remember and pushes the colony’s technology forward. Research only progresses with stationed researchers — more is faster; upgrades make room for more.', nodes: {
    speed_50: ['Index System', 'Research speed +50%'] } },
  rail_line: { name: 'Rail Line', desc: 'All gathering buildings +10% output, and workers move faster.', nodes: {
    double: ['Double Track', 'Gathering output +5% more'] } },
  metal_mine: { name: 'Metal Mine', desc: 'Digs down to the metal veins. Output is low, but every step ahead needs it.', nodes: {
    prod_20: ['Shoring', 'Output +30%'], click_1: ['Vein Probe', 'Click yield +1'], crystal_sense: ['Crystal Sense', 'Clicks have a 10% chance to drop 1 xenocrystal shard'] } },
  forge: { name: 'Forge', desc: 'Forges metal into tools or weapons. From Stage 4 you can move workers onto weapons. Buildings need tools from Lv5 onward.', nodes: {
    tools_25: ['Standard Molds', 'Tool output +25%'], click_1: ['Master Smith', 'Click yield +1'], weapon_atk: ['Weapon Calibration', 'Weapon attack +1'] } },
  outpost: { name: 'Outpost', desc: 'Command Lv3. The watchtower sees farther — including what is coming closer. Advances to Stage 4. Requires population 22.' },
  memorial: { name: 'Memorial Hall', desc: 'For those who did not make it here. Morale +10 and birth rate +10% per level.', nodes: {
    morale_5: ['Eternal Lamp', 'Morale +5'] } },
  crystal_synth: { name: 'Crystal Synthesizer', desc: 'Dissolves underground crystal clusters and regrows them into energy-storing xenocrystal. Output is tiny, but all alien tech depends on it.', nodes: {
    prod_30: ['Resonance Tank', 'Output +30%'], cap_1: ['Second Reactor', 'Worker cap +1'] } },
  security: { name: 'Marine Barracks', desc: 'Stationed workers are marines; each takes 1 population. Weapons in stock are issued automatically, raising attack from 2 to 5.', nodes: {
    hp_5: ['Armored Vests', 'Marine HP +5'], shift: ['Medic Rotation', 'Injury recovery −50%'], atk_2: ['Tactical Drills', 'Marine attack +2'] } },
  water_cycle: { name: 'Water Recycler', desc: 'Reclaims wastewater and condensation. Nutrient consumption −10%, and each Hab Pod level houses 1 more.' },
  med_bay: { name: 'Med Bay', desc: 'A pressurized medical module where injured marines are treated. 2 beds per level; stationed medics make patients in those beds recover faster.', nodes: {
    diag: ['Auto-Diagnostics', 'Healing speed +50%'], beds: ['Intensive Care Beds', '+1 bed per level'] } },
  colony_core: { name: 'Colony Core', desc: 'Command Lv4. A xenocrystal reactor — the colony is no longer just surviving. Requires population 40 and 2 raids repelled.' },
  admin: { name: 'Administration Hall', desc: 'The colony council chamber. Unlocks taxes and colony charters; taxes bring in credits, but every tax level costs 5 morale.', nodes: {
    council: ['Expanded Council', 'Charter slots +1'] } },
  trade_post: { name: 'Trading Post', desc: 'The colony market. Workers earn credits here, and you can trade with Helion Corp.', nodes: {
    prod_30: ['Night Market', 'Output +30%'], cap_2: ['More Stalls', 'Worker cap +2'] } },
  spaceport: { name: 'Spaceport', desc: 'Receives shuttles from other colonies. Opens Free Colonies Alliance trade; add a Xenology Institute to answer that mysterious signal.' },
  turret: { name: 'Defense Turret', desc: 'Fixed defense. One turret per level (ATK 8, HP 40); uses no population and repairs itself after battle.' },
  xeno_lab: { name: 'Xenology Institute', desc: 'A lab devoted to xenocrystal. Unlocks the xeno research line; stationed researchers also speed up all research.' },
  governor: { name: 'Governor’s Residence', desc: 'The administrative heart of the city, where the colony’s first elected governor works. Morale +15, charter slots +1.' },
  sky_residence: { name: 'Skyline Residence', desc: 'High-rise homes under the dome, with the stars right outside the window. +12 population cap and +5 morale per level.' },
  bioeng: { name: 'Bioengineering Lab', desc: 'Infuses crops and cultures with xenocrystal to boost the whole colony’s output for a short time. Each infusion costs xenocrystal; higher levels make it stronger and longer.' },
  orbital_beacon: { name: 'Orbital Beacon', desc: 'A beacon tower that broadcasts to the entire system. Built in five phases, each needing metal, tools, xenocrystal and credits; completing the fifth lights the beacon. Requires population 100.' },
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
  weapon_1: ['Weapon Tuning I', 'Weapon attack +2'],
  arms_line: ['Arms Line', 'Weapon output +30%'],
  weapon_2: ['Weapon Tuning II', 'Weapon attack +2'],
  crystal_armor: ['Crystal Armor', 'Marine HP +5'],
  crystal_ration: ['Emergency Rations', 'Nutrient consumption −10%'],
  crystal_resonance: ['Crystal Resonance', 'All gathering output +10%'],
  warehouse: ['Warehouse Expansion', 'All storage +50%'],
  xeno_growth: ['Crystal Catalysis', 'Xenocrystal output +40%'],
  xeno_hab: ['Lattice Materials', 'Each Hab Pod level houses 1 more'],
  xeno_turret: ['Crystal Barrels', 'Turret attack +6'],
  xeno_blade: ['Crystal Edge', 'Weapon attack +3'],
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
      'Good news: we’re alive. Bad news: twelve minutes of oxygen left in the pod. Everything else is just details of the bad news.',
      'The escape pod speared into a rust-red wasteland. The air outside is all carbon dioxide — without a helmet you won’t last minutes. Life support is still running, but its lights are ticking down one by one.',
      'We’re Helion’s runaway contract workers. Nobody is coming to save us. Strip the wreck, cobble together something that makes oxygen, then build a camp we can pressurize. — Mara',
    ],
    goals: ['Hold the Scrap button above the Scrap Heap to collect 20 scrap', 'Build an Oxygen Scrubber before life support runs out', 'Build an Algae Vat for nutrients (it makes a little oxygen too)', 'Assign colonists to work at a building', 'Complete the pressurized Emergency Camp'],
  },
  {
    title: 'Taking Root', subtitle: 'Enough air to go around',
    intro: [
      'The pressurized camp made it through the first night. In the morning, Juno spotted another escape pod glinting on the horizon.',
      'More people are coming — more mouths, and more lungs. The scrubber alone won’t be enough. The ice under our feet is this planet’s first gift.',
      'Build homes, make enough air to share, and give them a reason to stay.',
    ],
    goals: ['Build a Hab Pod to raise the population cap', 'Build an Electrolyzer to split oxygen from the ice', 'Keep air security above 60% for 1 minute', 'Build an Assembly Shop to turn scrap into parts', 'Reach population 12', 'Complete the Central Hub'],
  },
  {
    title: 'Metal and Fire', subtitle: 'From scavenging to making',
    intro: [
      'The day the Central Hub lit up, everyone ate a dinner without rations for the first time.',
      'The old engineer at the Tech Institute says that if we can dig up metal, we can make our own tools.',
      'From scavenging to making — this is the step where the colony truly stands on its own.',
    ],
    goals: ['Build a Metal Mine', 'Build a Forge', 'Forge the first batch of tools (20)', 'Reach population 22', 'Complete the Outpost'],
  },
  {
    title: 'Xenocrystal', subtitle: 'This planet does not want them',
    intro: [
      'The first time the outpost searchlight swept the wasteland, it lit up a pack of things watching us.',
      'They are small, but there are many, and they learn fast. The crystal clusters glow violet at night — that is the light they follow.',
      'Build marine barracks, forge weapons, learn to use xenocrystal. This planet does not want you, but you have nowhere else to go.',
    ],
    goals: ['Build the Marine Barracks and station marines', 'Build a Crystal Synthesizer', 'Build a Med Bay so the wounded can be treated', 'Repel 2 alien raids', 'Reach population 40', 'Complete the Colony Core'],
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
  {
    title: 'Beacon', subtitle: 'A message to the stars',
    intro: [
      'The first night after the dome closed, the colony’s lights could be seen from orbit.',
      'Helion’s transport is still up there, and more Alliance ships arrive every week. This planet is no longer a hiding place — it is a coordinate everyone knows.',
      'Build the Orbital Beacon and announce to the whole system: this is a free city.',
    ],
    goals: ['Build the Governor’s Residence', 'Build a Skyline Residence', 'Inject xenocrystal at the Bioengineering Lab once', 'Reach population 100', 'Complete all five phases of the Orbital Beacon'],
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
  rescue_ines: {
    title: 'A Broken Distress Call',
    text: 'A woman\'s voice crackles through the comm, over the clang of metal: "This is... Ines... my pod is wedged in an ice crevasse... I have tools, but no air. Please hurry."',
    options: ['Send 2 idle colonists (2 min)', 'Not enough hands right now, go later (the signal will repeat)'],
  },
  envoy: {
    title: 'Corporate Envoy',
    text: 'A shuttle bearing the Helion logo lands in the plaza. The envoy is polite: mining rights on this planet belong to the corporation, but as long as you pay {demand} on time, the corporation is willing to “temporarily” overlook your breach of contract.',
    options: ['Pay {demand}', 'Refuse (refused {refusals} times)'],
  },
};

export default { buildings, research, charters, chapters, events };
