/**
 * Crewli problem catalog.
 *
 * Four sources of truth in this file:
 *   1. LANGUAGES  — onboarding grid.
 *   2. PROFESSIONS — onboarding profession → available skill keys.
 *   3. CATALOG    — customer Home categories → sub-problems → skillKey.
 *   4. ADD_ONS    — optional extras the customer can tack onto any job.
 *
 * Pricing model: base + (distanceKm * perKmRate) + sum(selected add-ons).
 */

export const LANGUAGES = [
  { code: 'en', label: 'English',   native: 'English' },
  { code: 'hi', label: 'Hindi',     native: 'हिन्दी' },
  { code: 'bn', label: 'Bengali',   native: 'বাংলা' },
  { code: 'ta', label: 'Tamil',     native: 'தமிழ்' },
  { code: 'te', label: 'Telugu',    native: 'తెలుగు' },
  { code: 'mr', label: 'Marathi',   native: 'मराठी' },
  { code: 'kn', label: 'Kannada',   native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', label: 'Punjabi',   native: 'ਪੰਜਾਬੀ' },
  { code: 'gu', label: 'Gujarati',  native: 'ગુજરાતી' },
];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

/**
 * Every skill key a worker can pick. Each carries its pricing + profession + category.
 * Skill keys map 1-1 to sub-problems so pricing can vary per problem.
 */
export const SKILLS = {
  // --- Electrical Management ---
  'electrical.sparking_switchboard': { label: 'Sparking switchboard',  profession: 'electrician',  category: 'electrical', basePrice: 249, perKmRate: 10 },
  'electrical.tripping_mcb':         { label: 'Tripping MCB',           profession: 'electrician',  category: 'electrical', basePrice: 299, perKmRate: 10 },
  'electrical.fan_issue':            { label: 'Fan speed / noise',      profession: 'electrician',  category: 'electrical', basePrice: 199, perKmRate: 10 },
  'electrical.inverter_backup':      { label: 'Inverter backup issues', profession: 'electrician',  category: 'electrical', basePrice: 399, perKmRate: 10 },
  'electrical.appliance_earthing':   { label: 'Appliance earthing',     profession: 'electrician',  category: 'electrical', basePrice: 349, perKmRate: 10 },

  // --- Water / Plumbing ---
  'plumbing.dripping_tap':       { label: 'Dripping tap',        profession: 'plumber', category: 'plumbing', basePrice: 199, perKmRate: 10 },
  'plumbing.flush_tank':         { label: 'Flush tank malfunction', profession: 'plumber', category: 'plumbing', basePrice: 299, perKmRate: 10 },
  'plumbing.clogged_drain':      { label: 'Clogged drain',       profession: 'plumber', category: 'plumbing', basePrice: 349, perKmRate: 12 },
  'plumbing.low_water_pressure': { label: 'Low water pressure',  profession: 'plumber', category: 'plumbing', basePrice: 299, perKmRate: 10 },
  'plumbing.motor_pumping':      { label: 'Motor pumping issue', profession: 'plumber', category: 'plumbing', basePrice: 499, perKmRate: 15 },

  // --- Carpentry / Furniture ---
  'carpentry.cabinet_hinges':    { label: 'Saggy cabinet hinges', profession: 'carpenter', category: 'carpentry', basePrice: 249, perKmRate: 12 },
  'carpentry.cracking_drawers':  { label: 'Cracking drawers',     profession: 'carpenter', category: 'carpentry', basePrice: 299, perKmRate: 12 },
  'carpentry.door_latches':      { label: 'Door latches',         profession: 'carpenter', category: 'carpentry', basePrice: 199, perKmRate: 10 },
  'carpentry.loose_sunmica':     { label: 'Loose sunmica',        profession: 'carpenter', category: 'carpentry', basePrice: 349, perKmRate: 12 },

  // --- Walls / Paint ---
  'paint.dampness':        { label: 'Dampness',         profession: 'painter', category: 'paint', basePrice: 399, perKmRate: 10 },
  'paint.flaking_paint':   { label: 'Flaking paint',    profession: 'painter', category: 'paint', basePrice: 349, perKmRate: 10 },
  'paint.drilling':        { label: 'Drilling',         profession: 'painter', category: 'paint', basePrice: 149, perKmRate: 10 },
  'paint.plaster_cracks':  { label: 'Cracks in plaster', profession: 'painter', category: 'paint', basePrice: 449, perKmRate: 10 },
  'paint.grouting':        { label: 'Grouting',         profession: 'painter', category: 'paint', basePrice: 299, perKmRate: 10 },

  // --- Pests ---
  'pest.termite':       { label: 'Termite treatment',  profession: 'pest_control', category: 'pest', basePrice: 599, perKmRate: 15 },
  'pest.pigeon_scout':  { label: 'Pigeon scout',       profession: 'pest_control', category: 'pest', basePrice: 349, perKmRate: 15 },
  'pest.ant_trails':    { label: 'Ant trails',         profession: 'pest_control', category: 'pest', basePrice: 249, perKmRate: 15 },
  'pest.cockroach':     { label: 'Cockroach attack',   profession: 'pest_control', category: 'pest', basePrice: 299, perKmRate: 15 },

  // --- Aluminium & Glass ---
  'glass.sliding_window': { label: 'Sliding window',   profession: 'glazier', category: 'glass', basePrice: 399, perKmRate: 12 },
  'glass.broken_glass':   { label: 'Broken glass',     profession: 'glazier', category: 'glass', basePrice: 499, perKmRate: 12 },
  'glass.foggy_panes':    { label: 'Foggy panes',      profession: 'glazier', category: 'glass', basePrice: 349, perKmRate: 12 },

  // --- General Handywork ---
  'handy.curtain_rod':  { label: 'Curtain rod installation', profession: 'handyman', category: 'handy', basePrice: 199, perKmRate: 10 },
  'handy.doorbell':     { label: 'Doorbell replacement',     profession: 'handyman', category: 'handy', basePrice: 249, perKmRate: 10 },
  'handy.gas_stove':    { label: 'Gas stove service',        profession: 'handyman', category: 'handy', basePrice: 349, perKmRate: 10 },
  'handy.mirror_mount': { label: 'Mirror / shelf mounting',  profession: 'handyman', category: 'handy', basePrice: 199, perKmRate: 10 },
  'handy.locksmith':    { label: 'Locksmith',                profession: 'handyman', category: 'handy', basePrice: 499, perKmRate: 12 },
};

export const ALL_SKILL_KEYS = Object.keys(SKILLS);

/**
 * Profession → label + list of skill keys available to that profession.
 * Used by the worker onboarding UI (Select Profession → Select Skills).
 */
export const PROFESSIONS = {
  electrician: {
    label: 'Electrician',
    skillKeys: [
      'electrical.sparking_switchboard',
      'electrical.tripping_mcb',
      'electrical.fan_issue',
      'electrical.inverter_backup',
      'electrical.appliance_earthing',
    ],
  },
  plumber: {
    label: 'Plumber',
    skillKeys: [
      'plumbing.dripping_tap',
      'plumbing.flush_tank',
      'plumbing.clogged_drain',
      'plumbing.low_water_pressure',
      'plumbing.motor_pumping',
    ],
  },
  carpenter: {
    label: 'Carpenter',
    skillKeys: [
      'carpentry.cabinet_hinges',
      'carpentry.cracking_drawers',
      'carpentry.door_latches',
      'carpentry.loose_sunmica',
    ],
  },
  painter: {
    label: 'Painter / Wall Expert',
    skillKeys: [
      'paint.dampness',
      'paint.flaking_paint',
      'paint.drilling',
      'paint.plaster_cracks',
      'paint.grouting',
    ],
  },
  pest_control: {
    label: 'Pest Control',
    skillKeys: [
      'pest.termite',
      'pest.pigeon_scout',
      'pest.ant_trails',
      'pest.cockroach',
    ],
  },
  glazier: {
    label: 'Aluminium & Glass',
    skillKeys: [
      'glass.sliding_window',
      'glass.broken_glass',
      'glass.foggy_panes',
    ],
  },
  handyman: {
    label: 'General Handyman',
    skillKeys: [
      'handy.curtain_rod',
      'handy.doorbell',
      'handy.gas_stove',
      'handy.mirror_mount',
      'handy.locksmith',
    ],
  },
};
export const PROFESSION_KEYS = Object.keys(PROFESSIONS);

/**
 * Customer Home-Screen cards. One entry per category;
 * each sub-problem maps 1-1 to a skillKey (per-problem pricing).
 */
export const CATALOG = [
  {
    id: 'electrical', title: 'Electrical Management', category: 'electrical',
    subProblems: [
      { id: 'sparking_switchboard', title: 'Sparking switchboard',  skillKey: 'electrical.sparking_switchboard' },
      { id: 'tripping_mcb',         title: 'Tripping MCB',           skillKey: 'electrical.tripping_mcb' },
      { id: 'fan_issue',            title: 'Fan speed / noise',      skillKey: 'electrical.fan_issue' },
      { id: 'inverter_backup',      title: 'Inverter backup issues', skillKey: 'electrical.inverter_backup' },
      { id: 'appliance_earthing',   title: 'Appliance earthing',     skillKey: 'electrical.appliance_earthing' },
    ],
  },
  {
    id: 'plumbing', title: 'Water / Plumbing', category: 'plumbing',
    subProblems: [
      { id: 'dripping_tap',       title: 'Dripping tap',           skillKey: 'plumbing.dripping_tap' },
      { id: 'flush_tank',         title: 'Flush tank malfunction', skillKey: 'plumbing.flush_tank' },
      { id: 'clogged_drain',      title: 'Clogged drain',          skillKey: 'plumbing.clogged_drain' },
      { id: 'low_water_pressure', title: 'Low water pressure',     skillKey: 'plumbing.low_water_pressure' },
      { id: 'motor_pumping',      title: 'Motor pumping issue',    skillKey: 'plumbing.motor_pumping' },
    ],
  },
  {
    id: 'carpentry', title: 'Carpentry / Furniture', category: 'carpentry',
    subProblems: [
      { id: 'cabinet_hinges',   title: 'Saggy cabinet hinges', skillKey: 'carpentry.cabinet_hinges' },
      { id: 'cracking_drawers', title: 'Cracking drawers',     skillKey: 'carpentry.cracking_drawers' },
      { id: 'door_latches',     title: 'Door latches',         skillKey: 'carpentry.door_latches' },
      { id: 'loose_sunmica',    title: 'Loose sunmica',        skillKey: 'carpentry.loose_sunmica' },
    ],
  },
  {
    id: 'paint', title: 'Walls / Paint', category: 'paint',
    subProblems: [
      { id: 'dampness',       title: 'Dampness',          skillKey: 'paint.dampness' },
      { id: 'flaking_paint',  title: 'Flaking paint',     skillKey: 'paint.flaking_paint' },
      { id: 'drilling',       title: 'Drilling',          skillKey: 'paint.drilling' },
      { id: 'plaster_cracks', title: 'Cracks in plaster', skillKey: 'paint.plaster_cracks' },
      { id: 'grouting',       title: 'Grouting',          skillKey: 'paint.grouting' },
    ],
  },
  {
    id: 'pest', title: 'Pests', category: 'pest',
    subProblems: [
      { id: 'termite',      title: 'Termite treatment', skillKey: 'pest.termite' },
      { id: 'pigeon_scout', title: 'Pigeon scout',      skillKey: 'pest.pigeon_scout' },
      { id: 'ant_trails',   title: 'Ant trails',        skillKey: 'pest.ant_trails' },
      { id: 'cockroach',    title: 'Cockroach attack',  skillKey: 'pest.cockroach' },
    ],
  },
  {
    id: 'glass', title: 'Aluminium & Glass', category: 'glass',
    subProblems: [
      { id: 'sliding_window', title: 'Sliding window', skillKey: 'glass.sliding_window' },
      { id: 'broken_glass',   title: 'Broken glass',   skillKey: 'glass.broken_glass' },
      { id: 'foggy_panes',    title: 'Foggy panes',    skillKey: 'glass.foggy_panes' },
    ],
  },
  {
    id: 'handy', title: 'General Handywork', category: 'handy',
    subProblems: [
      { id: 'curtain_rod',  title: 'Curtain rod installation', skillKey: 'handy.curtain_rod' },
      { id: 'doorbell',     title: 'Doorbell replacement',     skillKey: 'handy.doorbell' },
      { id: 'gas_stove',    title: 'Gas stove service',        skillKey: 'handy.gas_stove' },
      { id: 'mirror_mount', title: 'Mirror / shelf mounting',  skillKey: 'handy.mirror_mount' },
      { id: 'locksmith',    title: 'Locksmith',                skillKey: 'handy.locksmith' },
    ],
  },
];

/**
 * Optional add-ons the customer can attach to any job.
 * Each is a flat rupee amount added to the base price.
 */
export const ADD_ONS = [
  { id: 'cleaning', label: 'Post-work cleaning', price: 15 },
];
export const ADD_ON_IDS = ADD_ONS.map((a) => a.id);

export function getSkill(skillKey) {
  return SKILLS[skillKey] || null;
}

export function getSubProblem(subProblemId) {
  for (const p of CATALOG) {
    const s = p.subProblems.find((sp) => sp.id === subProblemId);
    if (s) return { ...s, problem: { id: p.id, title: p.title, category: p.category } };
  }
  return null;
}

export function getProfession(key) {
  return PROFESSIONS[key] || null;
}

/** Sum rupee amount of the selected add-on ids. Unknown ids are ignored. */
export function addOnsTotal(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  let sum = 0;
  for (const id of ids) {
    const a = ADD_ONS.find((x) => x.id === id);
    if (a) sum += a.price;
  }
  return sum;
}
