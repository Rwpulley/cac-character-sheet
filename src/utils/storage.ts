// ===== STORAGE UTILITIES =====

import { Character, StorageData } from '../types';
import { STORAGE_KEY, STORAGE_VERSION } from './constants';

/**
 * Load characters from local storage
 */
export const loadCharacters = (): Character[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const data: StorageData = JSON.parse(stored);
    
    // Handle version migrations if needed
    if (data.version < STORAGE_VERSION) {
      return migrateCharacters(data.characters, data.version);
    }
    
    return data.characters || [];
  } catch (error) {
    console.error('Error loading characters:', error);
    return [];
  }
};

/**
 * Save characters to local storage
 */
export const saveCharacters = (characters: Character[]): boolean => {
  try {
    const data: StorageData = {
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      characters
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error saving characters:', error);
    return false;
  }
};

/**
 * Export characters to JSON file
 */
export const exportCharacters = (characters: Character[]): void => {
  const data: StorageData = {
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    characters
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `cac-characters-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Import characters from JSON file
 */
export const importCharacters = (file: File): Promise<Character[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data: StorageData = JSON.parse(content);
        
        if (!data.characters || !Array.isArray(data.characters)) {
          reject(new Error('Invalid file format: no characters found'));
          return;
        }
        
        // Handle version migrations if needed
        let characters = data.characters;
        if (data.version < STORAGE_VERSION) {
          characters = migrateCharacters(characters, data.version);
        }
        
        resolve(characters);
      } catch (error) {
        reject(new Error('Failed to parse file'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

/**
 * Migrate characters from older versions
 */
const migrateCharacters = (characters: Character[], fromVersion: number): Character[] => {
  let migrated = [...characters];
  
  // Version 1 -> 2 migrations
  if (fromVersion < 2) {
    migrated = migrated.map(char => ({
      ...char,
      // Add wallet if missing
      wallet: char.wallet || {
        platinum: 0,
        gold: Math.floor(char.moneyGP || 0),
        electrum: 0,
        silver: 0,
        copper: 0
      },
      // Add levelDrained if missing
      levelDrained: char.levelDrained || [],
      // Ensure hpByLevel exists
      hpByLevel: char.hpByLevel || [0, 0, 0]
    }));
  }
  
  return migrated;
};

/**
 * Clear all stored data
 */
export const clearStorage = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

/**
 * Check if storage is available
 */
export const isStorageAvailable = (): boolean => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Get storage usage info
 */
export const getStorageInfo = (): { used: number; available: boolean } => {
  if (!isStorageAvailable()) {
    return { used: 0, available: false };
  }
  
  const stored = localStorage.getItem(STORAGE_KEY);
  const used = stored ? new Blob([stored]).size : 0;
  
  return { used, available: true };
};
