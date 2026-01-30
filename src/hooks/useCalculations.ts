// ===== CALCULATIONS HOOK =====

import { useMemo } from 'react';
import { Character, EncumbranceInfo, LevelInfo, ContainerInfo } from '../types';
import { calcMod, normalizeItemEffects, ensureEquippedEffectShape, calculateWalletGP, calculateCoinCount } from '../utils';
import { ENCUMBRANCE, SPEED_PENALTIES } from '../utils/constants';

/**
 * Hook for all derived calculations from character data
 */
export const useCalculations = (char: Character | null) => {
  
  // Calculate attribute total (base + bonus + temp)
  const getAttributeTotal = useMemo(() => {
    return (attr: string): number => {
      if (!char?.attributes?.[attr]) return 10;
      const a = char.attributes[attr];
      return (a.base || 10) + (a.bonus || 0) + (a.tempMod || 0);
    };
  }, [char?.attributes]);
  
  // Memoized attribute totals
  const attributeTotals = useMemo(() => {
    if (!char) return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    return {
      str: getAttributeTotal('str'),
      dex: getAttributeTotal('dex'),
      con: getAttributeTotal('con'),
      int: getAttributeTotal('int'),
      wis: getAttributeTotal('wis'),
      cha: getAttributeTotal('cha')
    };
  }, [char, getAttributeTotal]);
  
  // Encumbrance calculation
  const encumbrance: EncumbranceInfo = useMemo(() => {
    if (!char) return { 
      rating: 0, totalEV: 0, totalWeight: 0, coinWeight: 0, coinEV: 0, 
      status: 'unburdened', speedPenalty: 0 
    };
    
    const strTotal = attributeTotals.str;
    const rating = strTotal; // EV rating = STR score
    
    // Calculate inventory weight and EV
    let inventoryWeight = 0;
    let inventoryEV = 0;
    
    for (const item of (char.inventory || [])) {
      // Skip items stored in magical containers
      if (item.storedInId) {
        const container = (char.inventory || []).find(c => c.id === item.storedInId);
        if (container?.isMagicalContainer) continue;
      }
      
      const qty = item.quantity || 1;
      const weight = (Number(item.weightPer) || 0) * qty;
      const ev = (Number(item.ev) || 0) * qty;
      
      inventoryWeight += weight;
      inventoryEV += ev;
    }
    
    // Calculate coin weight and EV
    const wallet = char.wallet || { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };
    const totalCoinCount = calculateCoinCount(wallet);
    
    // Coins in magical containers don't count
    const coinsGPInMagicalContainers = (char.inventory || [])
      .filter(it => it.isContainer && it.isMagicalContainer)
      .reduce((sum, container) => sum + (Number(container.storedCoinsGP) || 0), 0);
    
    const coinsInContainersCount = Math.ceil(coinsGPInMagicalContainers);
    const coinsNotInContainersCount = Math.max(0, totalCoinCount - coinsInContainersCount);
    
    const coinWeight = coinsNotInContainersCount / ENCUMBRANCE.COINS_PER_POUND;
    const coinEV = coinsNotInContainersCount / ENCUMBRANCE.COINS_PER_EV;
    
    // Include coin weight/EV only if setting is enabled
    const includeCoinWeight = char.includeCoinWeight ?? false;
    const totalEV = inventoryEV + (includeCoinWeight ? coinEV : 0);
    const totalWeight = inventoryWeight + (includeCoinWeight ? coinWeight : 0);
    
    // Determine encumbrance status
    const encumbranceEnabled = char.encumbranceEnabled ?? true;
    let status: 'unburdened' | 'burdened' | 'overburdened' = 'unburdened';
    let speedPenalty = 0;
    
    if (encumbranceEnabled && rating > 0) {
      if (totalEV > rating && totalEV <= (ENCUMBRANCE.OVERBURDENED_MULTIPLIER * rating)) {
        status = 'burdened';
        speedPenalty = SPEED_PENALTIES.BURDENED;
      } else if (totalEV > (ENCUMBRANCE.OVERBURDENED_MULTIPLIER * rating)) {
        status = 'overburdened';
        speedPenalty = SPEED_PENALTIES.OVERBURDENED;
      }
    }
    
    return { rating, totalEV, totalWeight, coinWeight, coinEV, status, speedPenalty };
  }, [char, attributeTotals.str]);
  
  // Max HP calculation (accounts for level drain)
  const maxHP: number = useMemo(() => {
    if (!char || !char.hpByLevel) return char?.maxHp || 0;
    const levelDrained = char.levelDrained || [];
    
    const levelHP = char.hpByLevel.reduce((sum, hp, idx) => {
      const isDrained = levelDrained[idx] === true;
      return sum + (isDrained ? 0 : hp);
    }, 0);
    
    const bonusHP = char.hpBonus || 0;
    return levelHP + bonusHP;
  }, [char?.hpByLevel, char?.hpBonus, char?.maxHp, char?.levelDrained]);
  
  // XP/Level calculation (accounts for level drain)
  const levelInfo: LevelInfo = useMemo(() => {
    const defaultInfo: LevelInfo = { 
      nextLevelXp: 0, progress: 0, canLevelUp: false, 
      currentLevel: 1, drainedLevels: 0, effectiveLevel: 1, xpEarnedLevel: 1 
    };
    
    if (!char) return defaultInfo;
    if (!Array.isArray(char.xpTable) || char.xpTable.length === 0) return defaultInfo;
    
    // Calculate level earned from XP
    let xpEarnedLevel = 1;
    for (let i = char.xpTable.length - 1; i >= 0; i--) {
      if (char.currentXp >= char.xpTable[i]) {
        xpEarnedLevel = i + 1;
        break;
      }
    }
    
    // Count drained levels
    const drainedLevels = (char.levelDrained || []).filter(d => d === true).length;
    
    // Effective level (XP-earned minus drained)
    const effectiveLevel = Math.max(1, xpEarnedLevel - drainedLevels);
    
    // XP progress calculation
    const currentLevelIndex = xpEarnedLevel - 1;
    const nextLevelIndex = Math.min(xpEarnedLevel, char.xpTable.length - 1);
    
    const currentLevelXp = char.xpTable[currentLevelIndex] || 0;
    const nextLevelXp = char.xpTable[nextLevelIndex] || char.xpTable[char.xpTable.length - 1];
    
    const xpIntoLevel = char.currentXp - currentLevelXp;
    const xpNeededForLevel = nextLevelXp - currentLevelXp;
    const progress = xpNeededForLevel > 0 
      ? Math.min(100, (xpIntoLevel / xpNeededForLevel) * 100) 
      : 100;
    
    // Can level up if there are unfilled HP slots
    const hpLevelsFilled = (char.hpByLevel || []).filter(hp => hp > 0).length;
    const canLevelUp = xpEarnedLevel > hpLevelsFilled;
    
    return {
      nextLevelXp,
      progress: Number(progress.toFixed(1)),
      canLevelUp,
      currentLevel: xpEarnedLevel,
      drainedLevels,
      effectiveLevel,
      xpEarnedLevel
    };
  }, [char?.xpTable, char?.currentXp, char?.levelDrained, char?.hpByLevel]);
  
  // AC calculation
  const ac: number = useMemo(() => {
    if (!char) return 10;
    const base = char.acBase || 10;
    
    // Shield (base + magic)
    let shield = 0;
    let shieldMagic = 0;
    if (char.equippedShieldId) {
      const sItem = (char.inventory || []).find(i => String(i.id) === String(char.equippedShieldId));
      shield = Number(sItem?.acBonus) || 0;
      shieldMagic = Number(sItem?.magicACBonus) || 0;
    }
    
    // Armor (base + magic)
    const armorIds = Array.isArray(char.equippedArmorIds) 
      ? char.equippedArmorIds 
      : (char.equippedArmorId ? [char.equippedArmorId] : []);
    
    let armor = 0;
    let armorMagic = 0;
    for (const aid of armorIds) {
      const aItem = (char.inventory || []).find(i => String(i.id) === String(aid));
      armor += Number(aItem?.acBonus) || 0;
      armorMagic += Number(aItem?.magicACBonus) || 0;
    }
    
    // Dex mod (removed if overburdened)
    let mod = (char.acModAuto !== false) 
      ? calcMod(attributeTotals.dex) 
      : (char.acMod || 0);
    if (encumbrance.status === 'overburdened' && char.acModAuto !== false) {
      mod = 0;
    }
    
    const magic = char.acMagic || 0;
    const misc = char.acMisc || 0;
    const bonus = char.acBonus || 0;
    
    // Effect AC from equipped items
    const equipped = ensureEquippedEffectShape(char);
    const activeIds = new Set((equipped.ac || []).map(x => String(x)));
    let effAC = 0;
    for (const item of (char.inventory || [])) {
      if (!activeIds.has(String(item.id))) continue;
      for (const e of normalizeItemEffects(item)) {
        if (e?.kind === 'ac') effAC += Number(e.ac) || 0;
      }
    }
    
    // Race AC bonus
    const raceACMatch = (char.raceAttributeMods || []).find(x => String(x.attr).toLowerCase() === 'ac');
    const raceAC = raceACMatch ? (Number(raceACMatch.value) || 0) : 0;
    
    return base + armor + armorMagic + shield + shieldMagic + mod + magic + misc + raceAC + bonus + effAC;
  }, [char, attributeTotals.dex, encumbrance.status]);
  
  // Speed calculation
  const speed: number = useMemo(() => {
    if (!char) return 30;
    
    const base = char.speed || 30;
    const bonus = char.speedBonus || 0;
    
    // Effect speed from equipped items
    const equipped = ensureEquippedEffectShape(char);
    const activeIds = new Set((equipped.speed || []).map(x => String(x)));
    let effSpeed = 0;
    for (const item of (char.inventory || [])) {
      if (!activeIds.has(String(item.id))) continue;
      for (const e of normalizeItemEffects(item)) {
        if (e?.kind === 'speed') effSpeed += Number(e.speed) || 0;
      }
    }
    
    // Legacy equipped speed items
    const legacySpeedIds = char.equippedSpeedItemIds || [];
    let legacySpeed = 0;
    for (const id of legacySpeedIds) {
      const item = (char.inventory || []).find(i => i.id === id);
      if (item?.effects) {
        for (const e of item.effects) {
          if (e?.kind === 'speed') legacySpeed += Number(e.speed) || 0;
        }
      }
    }
    
    const total = base + bonus + effSpeed + legacySpeed - encumbrance.speedPenalty;
    return Math.max(0, total);
  }, [char, encumbrance.speedPenalty]);
  
  // Container info helper
  const getContainerInfo = useMemo(() => {
    return (containerId: number): ContainerInfo => {
      if (!char) return {
        items: [], itemCount: 0, totalWeight: 0, capacity: 0,
        maxWeight: 0, isMagical: false, storedCoinsGP: 0, storedCoinsWeight: 0
      };
      
      const container = (char.inventory || []).find(i => i.id === containerId);
      if (!container || !container.isContainer) {
        return {
          items: [], itemCount: 0, totalWeight: 0, capacity: 0,
          maxWeight: 0, isMagical: false, storedCoinsGP: 0, storedCoinsWeight: 0
        };
      }
      
      const items = (char.inventory || []).filter(i => i.storedInId === containerId);
      const itemCount = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
      const itemsWeight = items.reduce((sum, i) => 
        sum + ((Number(i.weightPer) || 0) * (i.quantity || 1)), 0);
      
      const storedCoinsGP = Number(container.storedCoinsGP) || 0;
      const storedCoinsWeight = storedCoinsGP / ENCUMBRANCE.COINS_PER_POUND;
      const totalWeight = itemsWeight + storedCoinsWeight;
      
      return {
        items,
        itemCount,
        totalWeight,
        capacity: container.containerCapacity || 0,
        maxWeight: container.containerMaxWeight || Infinity,
        isMagical: !!container.isMagicalContainer,
        storedCoinsGP,
        storedCoinsWeight
      };
    };
  }, [char]);
  
  // Total level
  const totalLevel = useMemo(() => {
    if (!char) return 1;
    return (char.class1Level || 0) + (char.class2Level || 0) || 1;
  }, [char?.class1Level, char?.class2Level]);
  
  // Wallet GP value
  const walletGP = useMemo(() => {
    if (!char?.wallet) return char?.moneyGP || 0;
    return calculateWalletGP(char.wallet);
  }, [char?.wallet, char?.moneyGP]);
  
  return {
    getAttributeTotal,
    attributeTotals,
    encumbrance,
    maxHP,
    levelInfo,
    ac,
    speed,
    getContainerInfo,
    totalLevel,
    walletGP
  };
};

export default useCalculations;
