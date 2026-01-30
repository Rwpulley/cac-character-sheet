// ===== CONSTANTS =====

import { Character } from '../types';

/**
 * Default XP table for leveling
 */
export const DEFAULT_XP_TABLE = [
  0, 2000, 4000, 8000, 16000, 32000, 64000, 120000, 240000, 360000,
  480000, 600000, 720000, 840000, 960000, 1080000, 1200000, 1320000,
  1440000, 1560000, 1680000, 1800000, 1920000, 2040000, 2160000
];

/**
 * Standard die types
 */
export const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100];

/**
 * Hit die options
 */
export const HIT_DIE_OPTIONS = [4, 6, 8, 10, 12];

/**
 * Standard attributes
 */
export const ATTRIBUTES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/**
 * Attribute display names
 */
export const ATTRIBUTE_NAMES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
};

/**
 * Currency types in order of value (lowest to highest)
 */
export const CURRENCY_TYPES = ['cp', 'sp', 'gp', 'ep', 'pp'] as const;

/**
 * Currency display names
 */
export const CURRENCY_NAMES: Record<string, string> = {
  cp: 'Copper',
  sp: 'Silver',
  gp: 'Gold',
  ep: 'Electrum',
  pp: 'Platinum'
};

/**
 * Currency conversion rates to GP
 */
export const CURRENCY_TO_GP: Record<string, number> = {
  cp: 0.01,
  sp: 0.1,
  gp: 1,
  ep: 5,
  pp: 10
};

/**
 * Spell levels (0 = cantrip)
 */
export const SPELL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Encumbrance thresholds
 * - Unburdened: EV <= rating
 * - Burdened: EV > rating && EV <= 3x rating
 * - Overburdened: EV > 3x rating
 */
export const ENCUMBRANCE = {
  BURDENED_MULTIPLIER: 1,
  OVERBURDENED_MULTIPLIER: 3,
  COINS_PER_POUND: 16,
  COINS_PER_EV: 160
};

/**
 * Speed penalties for encumbrance
 */
export const SPEED_PENALTIES = {
  BURDENED: 5,
  OVERBURDENED: 15
};

/**
 * Local storage key for saving characters
 */
export const STORAGE_KEY = 'cac_characters_v2';

/**
 * Current storage version for migrations
 */
export const STORAGE_VERSION = 2;

/**
 * Default new character template
 */
export const DEFAULT_CHARACTER: Omit<Character, 'id'> = {
  name: '',
  race: '',
  class1: '',
  class1Level: 1,
  class2: '',
  class2Level: 0,
  hp: 10,
  maxHpBonus: 0,
  hpByLevel: [0, 0, 0],
  hpDie: 8,
  ac: 10,
  acDexBonus: 0,
  acBonus: 0,
  selectedArmorId: null,
  selectedShieldId: null,
  speed: 30,
  speedBonus: 0,
  baseBth: 0,
  currentXp: 0,
  xpTable: DEFAULT_XP_TABLE,
  primeSaveBonus: 0,
  attackBonus: 0,
  damageBonus: 0,
  attributes: {
    str: { base: 10, bonus: 0, tempMod: 0 },
    dex: { base: 10, bonus: 0, tempMod: 0 },
    con: { base: 10, bonus: 0, tempMod: 0 },
    int: { base: 10, bonus: 0, tempMod: 0 },
    wis: { base: 10, bonus: 0, tempMod: 0 },
    cha: { base: 10, bonus: 0, tempMod: 0 }
  },
  attacks: [],
  inventory: [],
  spellsLearned: [],
  spellSlots: {},
  spellsPrepared: [],
  magicItems: [],
  companions: [],
  notes: '',
  classAbilities: '',
  raceAbilities: '',
  advantages: '',
  holySymbol: '',
  moneyGP: 0,
  wallet: {
    platinum: 0,
    gold: 0,
    electrum: 0,
    silver: 0,
    copper: 0
  }
};

/**
 * Tab configuration
 */
export const TABS = [
  { id: 'main', label: 'Main' },
  { id: 'combat', label: 'Combat' },
  { id: 'spells', label: 'Spells' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'notes', label: 'Notes' }
] as const;

export type TabId = typeof TABS[number]['id'];

/**
 * Inventory categories
 */
export const INVENTORY_CATEGORIES = {
  weapons: { label: 'Weapons', icon: '⚔️' },
  armor: { label: 'Armor & Shields', icon: '🛡️' },
  magic: { label: 'Magic Items', icon: '✨' },
  consumables: { label: 'Consumables', icon: '🧪' },
  containers: { label: 'Containers', icon: '📦' },
  other: { label: 'Other', icon: '📦' }
} as const;

/**
 * Save types for Castles & Crusades
 */
export const SAVE_TYPES = [
  { id: 'str', name: 'Strength (Paralysis, Constriction)' },
  { id: 'dex', name: 'Dexterity (Breath Weapon, Traps)' },
  { id: 'con', name: 'Constitution (Disease, Energy Drain, Poison)' },
  { id: 'int', name: 'Intelligence (Arcane Magic, Illusion)' },
  { id: 'wis', name: 'Wisdom (Divine Magic, Confusion, Gaze Attack, Polymorph, Petrification)' },
  { id: 'cha', name: 'Charisma (Death Attack, Charm, Fear)' }
] as const;

/**
 * Base challenge rating for saves
 */
export const BASE_SAVE_CR = 12;

/**
 * Prime attribute save bonus
 */
export const PRIME_SAVE_BONUS = 6;

/**
 * Non-prime attribute save bonus
 */
export const NON_PRIME_SAVE_BONUS = 0;
