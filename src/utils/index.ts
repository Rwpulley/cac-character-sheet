// ===== UTILITY FUNCTIONS =====

import { InventoryItem, ItemEffect, Character } from '../types';

/**
 * Roll a single die of the given number of sides
 */
export const rollDice = (sides: number): number => {
  return Math.floor(Math.random() * sides) + 1;
};

/**
 * Roll multiple dice and return the total
 */
export const rollMultipleDice = (numDice: number, sides: number): number => {
  let total = 0;
  for (let i = 0; i < numDice; i++) {
    total += rollDice(sides);
  }
  return total;
};

/**
 * Calculate ability modifier from score
 */
export const calcMod = (score: number): number => {
  return Math.floor((score - 10) / 2);
};

/**
 * Clamp a value between min and max
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

/**
 * Generate a unique ID based on timestamp
 */
export const generateId = (): number => {
  return Date.now();
};

/**
 * Format a number with sign prefix (+/-)
 */
export const formatModifier = (value: number): string => {
  return value >= 0 ? `+${value}` : `${value}`;
};

/**
 * Normalize item effects to always be an array
 */
export const normalizeItemEffects = (item: InventoryItem): ItemEffect[] => {
  if (Array.isArray(item.effects)) return item.effects;
  
  // Handle legacy single-effect items
  if (item.isWeaponEffect) {
    const effects: ItemEffect[] = [];
    if (item.effectToHitBonus) {
      effects.push({ kind: 'toHit', toHit: item.effectToHitBonus });
    }
    if (item.effectDamageBonus) {
      effects.push({ kind: 'damage', damage: item.effectDamageBonus });
    }
    return effects;
  }
  
  return [];
};

/**
 * Ensure equipped effect IDs have the correct shape
 */
export const ensureEquippedEffectShape = (char: Character): {
  toHit: number[];
  damage: number[];
  speed: number[];
  ac: number[];
  save: number[];
} => {
  const e = char.equippedEffectItemIds;
  return {
    toHit: Array.isArray(e?.toHit) ? e.toHit : [],
    damage: Array.isArray(e?.damage) ? e.damage : [],
    speed: Array.isArray(e?.speed) ? e.speed : [],
    ac: Array.isArray(e?.ac) ? e.ac : [],
    save: Array.isArray(e?.save) ? e.save : []
  };
};

/**
 * Convert currency to GP value
 */
export const currencyToGP = (amount: number, unit: string): number => {
  const u = unit.toLowerCase();
  if (u === 'cp') return amount * 0.01;
  if (u === 'sp') return amount * 0.1;
  if (u === 'ep') return amount * 5;
  if (u === 'pp') return amount * 10;
  return amount; // gp
};

/**
 * Calculate total GP value from wallet
 */
export const calculateWalletGP = (wallet: {
  platinum?: number;
  gold?: number;
  electrum?: number;
  silver?: number;
  copper?: number;
}): number => {
  return (
    ((wallet.platinum || 0) * 10) +
    ((wallet.electrum || 0) * 5) +
    (wallet.gold || 0) +
    ((wallet.silver || 0) * 0.1) +
    ((wallet.copper || 0) * 0.01)
  );
};

/**
 * Calculate total coin count from wallet
 */
export const calculateCoinCount = (wallet: {
  platinum?: number;
  gold?: number;
  electrum?: number;
  silver?: number;
  copper?: number;
}): number => {
  return (
    (wallet.platinum || 0) +
    (wallet.gold || 0) +
    (wallet.electrum || 0) +
    (wallet.silver || 0) +
    (wallet.copper || 0)
  );
};

/**
 * Round to specified decimal places
 */
export const roundTo = (value: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

/**
 * Deep clone an object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Check if a value is empty (null, undefined, empty string, or empty array)
 */
export const isEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

/**
 * Safely parse a number, returning default if invalid
 */
export const safeParseInt = (value: string | number | undefined, defaultValue: number = 0): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
};

/**
 * Safely parse a float, returning default if invalid
 */
export const safeParseFloat = (value: string | number | undefined, defaultValue: number = 0): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
};

/**
 * Format weight display
 */
export const formatWeight = (weight: number): string => {
  return `${weight.toFixed(2)} lb`;
};

/**
 * Format currency display
 */
export const formatCurrency = (amount: number, unit: string = 'GP'): string => {
  return `${amount.toFixed(2)} ${unit.toUpperCase()}`;
};

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
export const getOrdinalSuffix = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Capitalize first letter of a string
 */
export const capitalize = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Truncate string to max length with ellipsis
 */
export const truncate = (str: string, maxLength: number): string => {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
};
