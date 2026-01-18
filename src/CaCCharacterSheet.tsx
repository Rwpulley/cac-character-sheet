import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Minus, Edit2, X, Trash2, Download, Upload } from 'lucide-react';

// ===== LOCAL STORAGE PERSISTENCE =====
const STORAGE_KEY = 'cac-character-sheet-data';
const STORAGE_VERSION = 1;

const saveToLocalStorage = (characters) => {
  try {
    const data = {
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      characters
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
    return false;
  }
};

const loadFromLocalStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Handle version migrations here if needed in the future
    return data.characters || [];
  } catch (err) {
    console.error('Failed to load from localStorage:', err);
    return null;
  }
};

const exportToFile = (characters) => {
  const data = {
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    characters
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cac-characters-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const importFromFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result);
        if (Array.isArray(data.characters)) {
          resolve(data.characters);
        } else if (Array.isArray(data)) {
          // Handle legacy format (just an array of characters)
          resolve(data);
        } else {
          reject(new Error('Invalid file format'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// ===== END LOCAL STORAGE PERSISTENCE =====

// ===== UTILITY FUNCTIONS =====

// Debounce hook for text inputs
function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// Debounced input component for text fields
const DebouncedInput = React.memo(function DebouncedInput({ 
  value, 
  onChange, 
  debounceMs = 300,
  ...props 
}) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef(null);
  
  // Sync local value when external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  }, [onChange, debounceMs]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return <input {...props} value={localValue} onChange={handleChange} />;
});

// Debounced textarea component
const DebouncedTextarea = React.memo(function DebouncedTextarea({ 
  value, 
  onChange, 
  debounceMs = 300,
  ...props 
}) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  }, [onChange, debounceMs]);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return <textarea {...props} value={localValue} onChange={handleChange} />;
});

// Virtualized list component for long lists (inventory, spells, etc.)
const VirtualizedList = React.memo(function VirtualizedList({
  items,
  renderItem,
  itemHeight = 120,
  containerHeight = 500,
  overscan = 3,
  className = '',
  emptyMessage = 'No items'
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);
  
  const { visibleItems, startIndex, totalHeight, offsetY } = useMemo(() => {
    if (!items || items.length === 0) {
      return { visibleItems: [], startIndex: 0, totalHeight: 0, offsetY: 0 };
    }
    
    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + (overscan * 2);
    const endIndex = Math.min(items.length, startIndex + visibleCount);
    const visibleItems = items.slice(startIndex, endIndex);
    const offsetY = startIndex * itemHeight;
    
    return { visibleItems, startIndex, totalHeight, offsetY };
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);
  
  if (!items || items.length === 0) {
    return <div className="text-center text-gray-400 py-8">{emptyMessage}</div>;
  }
  
  // For small lists, render normally without virtualization
  if (items.length <= 15) {
    return (
      <div className={`space-y-3 ${className}`}>
        {items.map((item, index) => (
          <div key={item.id || index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`overflow-y-auto ${className}`}
      style={{ height: containerHeight, position: 'relative' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
          <div className="space-y-3">
            {visibleItems.map((item, index) => (
              <div key={item.id || (startIndex + index)}>
                {renderItem(item, startIndex + index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

// ===== END UTILITY FUNCTIONS =====

const calcMod = (value) => {
  if (value <= 1) return -4;
  if (value <= 3) return -3;
  if (value <= 5) return -2;
  if (value <= 8) return -1;
  if (value <= 12) return 0;
  if (value <= 15) return 1;
  if (value <= 17) return 2;
  if (value <= 19) return 3;
  if (value <= 21) return 4;
  if (value <= 23) return 5;
  if (value <= 25) return 6;
  if (value <= 27) return 7;
  if (value === 28) return 8;
  if (value === 29) return 9;
  return 10; // 30+
};

function clamp(n, min, max) {
  if (min != null && n < min) return min;
  if (max != null && n > max) return max;
  return n;
}

/**
 * Touch-friendly numeric control that supports both:
 * 1. Legacy mode: uses hidden input with id for document.getElementById access
 * 2. Controlled mode: uses value/onChange props like a standard React input
 */
const DomStepper = React.memo(function DomStepper({
  id,
  defaultValue = 0,
  value: controlledValue,
  onChange: onChangeCallback,
  step = 1,
  min = null,
  max = null,
  className = '',
  valuePrefix = '',
  valueSuffix = '',
  allowManual = false,
  resetToken = 0,
}) {
  // Use controlled mode if value prop is provided
  const isControlled = controlledValue !== undefined;
  const [internalVal, setInternalVal] = useState(Number(defaultValue) || 0);
  
  const val = isControlled ? controlledValue : internalVal;
  const setVal = isControlled 
    ? (newVal) => {
        const computed = typeof newVal === 'function' ? newVal(val) : newVal;
        onChangeCallback?.(computed);
      }
    : setInternalVal;

  useEffect(() => {
    if (!isControlled) {
      setInternalVal(Number(defaultValue) || 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue, id, resetToken, isControlled]);

  const dec = useCallback(() => setVal((v) => clamp((Number(v) || 0) - step, min, max)), [setVal, step, min, max]);
  const inc = useCallback(() => setVal((v) => clamp((Number(v) || 0) + step, min, max)), [setVal, step, min, max]);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={dec}
        className="h-11 w-11 min-w-[2.75rem] flex-shrink-0 rounded-lg bg-gray-700 hover:bg-gray-600 text-xl font-bold active:bg-gray-500"
        aria-label="Decrease"
      >
        −
      </button>

      {allowManual ? (

        <input
          type="text"
          inputMode="numeric"
          value={String(val)}
          onChange={(e) => {
            const raw = String(e.target.value || '');
            const cleaned = raw.replace(/(?!^)-/g, '').replace(/[^\d-]/g, '');
            const next = parseInt(cleaned, 10);
            setVal(Number.isFinite(next) ? next : 0);
          }}
          className="min-w-0 flex-1 text-center text-base font-semibold bg-gray-800 rounded-lg h-11 px-1"
        />

      ) : (

        <div className="min-w-0 flex-1 text-center text-base font-semibold bg-gray-800 rounded-lg h-11 flex items-center justify-center px-1">

          {valuePrefix}{val}{valueSuffix}

        </div>

      )}

      <button
        type="button"
        onClick={inc}
        className="h-11 w-11 min-w-[2.75rem] flex-shrink-0 rounded-lg bg-gray-700 hover:bg-gray-600 text-xl font-bold active:bg-gray-500"
        aria-label="Increase"
      >
        +
      </button>

      {/* Hidden input for legacy getElementById access - only rendered if id is provided */}
      {id && <input type="number" id={id} value={val} readOnly className="hidden" />}
    </div>
  );
});

const getUnarmedAttackName = (attacks) => {
  const count = (attacks || []).filter(a => (a?.name || '').startsWith('Unarmed Attack')).length;
  if (count === 0) return 'Unarmed Attack (Primary)';
  if (count === 1) return 'Unarmed Attack (Secondary)';
  if (count === 2) return 'Unarmed Attack (Tertiary)';
  return `Unarmed Attack (${count + 1}th)`;
};

const getWeaponModes = (item) => {
  const modes = [];
  const melee = item?.weaponMelee ?? ((item?.weaponType || 'melee') === 'melee');
  const ranged = item?.weaponRanged ?? ((item?.weaponType || 'melee') === 'ranged');
  if (melee) modes.push('melee');
  if (ranged) modes.push('ranged');
  return modes;
};

const getBoundAttackName = (attack, inventory) => {
  if (!attack?.weaponId) return attack?.name || '';
  const item = (inventory || []).find(it => String(it.id) === String(attack.weaponId));
  const baseName = item?.name || 'Weapon';
  const mode = (attack.weaponMode || attack.weaponType || item?.weaponType || 'melee');
  const modeLabel = mode === 'ranged' ? 'Ranged' : 'Melee';
  return `${baseName} (${modeLabel})`;
};

// ===== Inventory Item Effects (attack/AC boosters that remain attached to the item) =====
const ensureEquippedEffectShape = (char) => {
  const cur = (char && char.equippedEffectItemIds && typeof char.equippedEffectItemIds === 'object')
    ? char.equippedEffectItemIds
    : {};
  return {
    attack: Array.isArray(cur.attack) ? cur.attack.map(x => String(x)) : [],
    unarmed: Array.isArray(cur.unarmed) ? cur.unarmed.map(x => String(x)) : [],
    ac: Array.isArray(cur.ac) ? cur.ac.map(x => String(x)) : []
  };
};

const normalizeItemEffects = (item) => {
  // Effects are attached to the inventory item. An item can have multiple effects.
  // Supported shape (current):
  //   { id, kind: 'attack' | 'ac', miscToHit, miscDamage, magicToHit, magicDamage, ac }
  // Back-compat: earlier drafts used toHit/damage or booster-style fields.
  const raw = Array.isArray(item?.effects) ? item.effects : [];

  const normalized = raw.map((e, idx) => {
    if (!e) return null;

    const id = e.id ?? `${item?.id || 'item'}-eff-${idx}`;

    // Back-compat: toHit/damage => miscToHit/miscDamage
    const legacyToHit = (e.toHit !== undefined) ? (Number(e.toHit) || 0) : 0;
    const legacyDmg = (e.damage !== undefined) ? (Number(e.damage) || 0) : 0;

    const kind = e.kind === 'ac' ? 'ac' : 'attack';

    return {
      id: String(id),
      kind,
      miscToHit: Number(e.miscToHit ?? legacyToHit) || 0,
      miscDamage: Number(e.miscDamage ?? legacyDmg) || 0,
      magicToHit: Number(e.magicToHit) || 0,
      magicDamage: Number(e.magicDamage) || 0,
      ac: Number(e.ac) || 0
    };
  }).filter(Boolean);

  // Back-compat: older "isBooster/booster*" style
  if (!normalized.length && item?.isBooster) {
    return [{
      id: `legacy-${item.id}`,
      kind: 'attack',
      miscToHit: Number(item.boosterToHit) || 0,
      miscDamage: Number(item.boosterDamage) || 0,
      magicToHit: 0,
      magicDamage: 0,
      ac: Number(item.boosterAC) || 0
    }];
  }

  
  // If the item uses the Attribute Bonus system to grant AC, expose it as an AC effect
  // so it can be equipped via AC Tracking -> Defense Items.
  // Check the new attrBonuses array first, then fall back to legacy single fields
  if (item?.hasAttrBonus) {
    const bonusesArr = Array.isArray(item.attrBonuses) ? item.attrBonuses : [];
    const acBonus = bonusesArr.find(b => String(b?.attr || '').toLowerCase() === 'ac');
    if (acBonus && (Number(acBonus.value) || 0) !== 0) {
      normalized.push({
        id: `attrbonus-ac-${item?.id || 'item'}`,
        kind: 'ac',
        ac: Number(acBonus.value) || 0
      });
    } else if (!bonusesArr.length && String(item.attrBonusAttr || '').toLowerCase() === 'ac') {
      // Legacy fallback
      const v = Number(item.attrBonusValue) || 0;
      if (v !== 0) {
        normalized.push({
          id: `attrbonus-ac-${item?.id || 'item'}`,
          kind: 'ac',
          ac: v
        });
      }
    }
  }

return normalized;
};

const effectSummary = (item, section, inventory) => {
  const effects = normalizeItemEffects(item);
  if (!effects?.length) return '';

  const parts = [];
  for (const e of effects) {
    if (!e) continue;

    // Attack effects: show once (we no longer split unarmed vs weapon at the item level)
    if (e.kind === 'attack' && section === 'attack') {
      const bits = [];
      const mHit = Number(e.miscToHit) || 0;
      const mDmg = Number(e.miscDamage) || 0;
      const mgHit = Number(e.magicToHit) || 0;
      const mgDmg = Number(e.magicDamage) || 0;

      if (mHit) bits.push(`${mHit >= 0 ? '+' : ''}${mHit} misc hit`);
      if (mgHit) bits.push(`${mgHit >= 0 ? '+' : ''}${mgHit} magic hit`);
      if (mDmg) bits.push(`${mDmg >= 0 ? '+' : ''}${mDmg} misc dmg`);
      if (mgDmg) bits.push(`${mgDmg >= 0 ? '+' : ''}${mgDmg} magic dmg`);

      if (bits.length) parts.push(bits.join(', '));
    }

    if (e.kind === 'ac' && section === 'ac') {
      const ac = Number(e.ac) || 0;
      if (ac) parts.push(`${ac >= 0 ? '+' : ''}${ac} AC`);
    }
  }

  return parts.join(' | ');
};

const sumEffectBonusesForAttack = (char, attack) => {
  const inventory = char?.inventory || [];
  const selected = Array.isArray(attack?.appliedEffectItemIds)
    ? attack.appliedEffectItemIds.map(x => String(x))
    : [];
  const selectedSet = new Set(selected);

  let miscToHit = 0;
  let miscDamage = 0;
  let magicToHit = 0;
  let magicDamage = 0;

  for (const item of inventory) {
    if (!selectedSet.has(String(item.id))) continue;
    for (const e of normalizeItemEffects(item)) {
      if (!e || e.kind !== 'attack') continue;
      miscToHit += Number(e.miscToHit) || 0;
      miscDamage += Number(e.miscDamage) || 0;
      magicToHit += Number(e.magicToHit) || 0;
      magicDamage += Number(e.magicDamage) || 0;
    }
  }

  return { miscToHit, miscDamage, magicToHit, magicDamage };
};

const sumEffectAC = (char) => {
  const inventory = char?.inventory || [];
  const equipped = ensureEquippedEffectShape(char);
  const activeIds = new Set((equipped.ac || []).map(x => String(x)));

  let ac = 0;

  for (const item of inventory) {
    if (!activeIds.has(String(item.id))) continue;
    for (const e of normalizeItemEffects(item)) {
      if (!e || e.kind !== 'ac') continue;
      ac += Number(e.ac) || 0;
    }
  }

  return ac;
};

const createNewCharacter = () => ({
  id: Date.now(),
  name: "New Character",
  race: "", 
  raceDetails: "",
  class1: "", 
  class1Level: 1, 
  class1Details: "",
  class2: "", 
  class2Level: 0, 
  class2Details: "",
  classAbilities: [],
  advantages: [],
  raceAbilities: [],
  alignment: '',
  languages: '',
  deity: '',
  holySymbol: '',
  raceAttributeMods: [],
  speed: 30, 
  hp: 0, 
  maxHp: 0,
  acBase: 10, 
  // Notes tab
  notes: [],
  acShield: 0, 
  acMod: 0, 
  acMagic: 0, 
  acMisc: 0, 
  acBonus: 0,
  equippedArmorIds: [], 
  equippedShieldId: null,
  equippedAttrBonuses: { str: [], dex: [], con: [], int: [], wis: [], cha: [] },
  equippedEffectItemIds: { attack: [], unarmed: [], ac: [] },
  bth: 0, 
  currentXp: 0,
  attributes: {
    str: { rolledScore: 10, bonusMod: 0, isPrime: false, saveModifier: 0 },
    dex: { rolledScore: 10, bonusMod: 0, isPrime: false, saveModifier: 0 },
    con: { rolledScore: 10, bonusMod: 0, isPrime: false, saveModifier: 0 },
    int: { rolledScore: 10, bonusMod: 0, isPrime: false, saveModifier: 0 },
    wis: { rolledScore: 10, bonusMod: 0, isPrime: false, saveModifier: 0 },
    cha: { rolledScore: 10, bonusMod: 0, isPrime: false, saveModifier: 0 }
  },
  xpTable: [0, 2000, 4000, 8000, 16000, 32000, 64000, 120000, 240000, 360000, 480000, 600000, 720000, 840000, 960000, 1080000, 1200000, 1320000, 1440000, 1560000, 1680000, 1800000, 1920000, 2040000, 2160000],
  hpByLevel: [0, 0, 0],
  hpDie: 12,
  attacks: [], 
  inventory: [], 
  moneyGP: 0, 
  spells: [], 
  spellsStolen: [], 
  grimoires: [], 
  magicItems: [], 
  pets: [],
  initiativeMod: 0, 
  primeSaveBonus: 6, 
  attackBonus: 0,
  baseBth: 0, 
  damageBonus: 0, 
  saveBonus: 0,
  companions: [],
  spellSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  spellsLearned: [],
  spellsPrepared: [],
  spellSaveDC: 10,
  spellAttackBonus: 0
});

export default function CaCCharacterSheet() {
  const [characters, setCharacters] = useState([]);
  const [currentCharIndex, setCurrentCharIndex] = useState(null);
  const [activeTab, setActiveTab] = useState('main');
  const [editModal, setEditModal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Notes tab editor
  const [noteEditor, setNoteEditor] = useState({
    open: false,
    noteId: null,
    title: '',
    description: ''
  });
  
  const [walletReset, setWalletReset] = useState(0);
const [hpLevelsShown, setHpLevelsShown] = useState(3);
  const [hpDieDraft, setHpDieDraft] = useState(12);
  const [hpDraftRolls, setHpDraftRolls] = useState(['', '', '']);
  const [hpDraftLevels, setHpDraftLevels] = useState([0, 0, 0]);
  const [addAttackModalOpen, setAddAttackModalOpen] = useState(false);

  const [rollModal, setRollModal] = useState(null);
  const [rollResult, setRollResult] = useState(null);
  const [diceConfig, setDiceConfig] = useState({
    d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0
  });
  const [diceRolls, setDiceRolls] = useState(null);
  const [spellsLearnedView, setSpellsLearnedView] = useState(false);
  const [grimoireView, setGrimoireView] = useState(false);
  const [openGrimoireIds, setOpenGrimoireIds] = useState(() => ({}));
  const [magicInventoryView, setMagicInventoryView] = useState(false);
  const [openMagicItemIds, setOpenMagicItemIds] = useState(() => ({}));
  const [selectedMagicItemId, setSelectedMagicItemId] = useState(null);
  const [invSelectedSpellId, setInvSelectedSpellId] = useState("");
  const [invCopies, setInvCopies] = useState(1);
  const [invPermanent, setInvPermanent] = useState(false);

  // ===== CONSOLIDATED ITEM MODAL STATE =====
  // Groups all item form fields into a single state object for cleaner code
  const defaultItemModalState = {
    // Item type flags
    isArmor: false,
    isShield: false,
    hasAttrBonus: false,
    isMagicCasting: false,
    isGrimoire: false,
    hasEffects: false,
    isWeapon: false,
    // Magic casting
    magicCastingDescription: '',
    magicCastingCapacity: 0,
    magicCastingCapacityText: '',
    // Effects
    effects: [],
    // Stat bonuses
    attrBonusAttr: 'str',
    attrBonusValue: 0,
    attrBonusValueText: '0',
    statBonuses: [],
    // Weapon properties
    weaponType: 'melee',
    weaponMelee: true,
    weaponRanged: false,
    weaponToHitMagic: 0,
    weaponToHitMisc: 0,
    weaponDamageMagic: 0,
    weaponDamageMisc: 0,
    weaponDamageNumDice: 1,
    weaponDamageDieType: 8
  };
  
  const [itemModal, setItemModal] = useState(defaultItemModalState);
  
  // Helper to update specific item modal fields
  const updateItemModal = useCallback((updates) => {
    setItemModal(prev => ({ ...prev, ...updates }));
  }, []);
  
  // Reset item modal to defaults
  const resetItemModal = useCallback(() => {
    setItemModal(defaultItemModalState);
  }, []);

  // ===== CONSOLIDATED NEW EFFECT STATE =====
  const defaultNewEffectState = {
    kind: 'attack',
    miscToHit: 0,
    miscDamage: 0,
    magicToHit: 0,
    magicDamage: 0,
    ac: 0
  };
  
  const [newEffect, setNewEffect] = useState(defaultNewEffectState);
  
  const updateNewEffect = useCallback((updates) => {
    setNewEffect(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetNewEffect = useCallback(() => {
    setNewEffect(defaultNewEffectState);
  }, []);

  // ===== CONSOLIDATED EQUIPMENT STATE =====
  const [equipmentState, setEquipmentState] = useState({
    armorIds: [],
    shieldId: '',
    defenseItemIds: [],
    speedItemIds: [],
    attrEquippedIds: [],
    useDex: true
  });
  
  const updateEquipment = useCallback((updates) => {
    setEquipmentState(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleEquippedArmor = useCallback((id) => {
    setEquipmentState(prev => {
      const sid = String(id);
      const armorIds = prev.armorIds.includes(sid) 
        ? prev.armorIds.filter(x => x !== sid) 
        : [...prev.armorIds, sid];
      return { ...prev, armorIds };
    });
  }, []);

  // Legacy individual setters for backward compatibility during migration
  // These can be removed once all usages are updated
  const setEquippedArmorIds = useCallback((ids) => updateEquipment({ armorIds: ids }), [updateEquipment]);
  const setEquippedShieldId = useCallback((id) => updateEquipment({ shieldId: id }), [updateEquipment]);
  const setEquippedDefenseItemIds = useCallback((ids) => updateEquipment({ defenseItemIds: ids }), [updateEquipment]);
  const setEquippedSpeedItemIds = useCallback((ids) => updateEquipment({ speedItemIds: ids }), [updateEquipment]);
  const setAttrEquippedIds = useCallback((ids) => updateEquipment({ attrEquippedIds: ids }), [updateEquipment]);
  const setAcUseDex = useCallback((val) => updateEquipment({ useDex: val }), [updateEquipment]);
  
  // Legacy getters for backward compatibility
  const equippedArmorIds = equipmentState.armorIds;
  const equippedShieldId = equipmentState.shieldId;
  const equippedDefenseItemIds = equipmentState.defenseItemIds;
  const equippedSpeedItemIds = equipmentState.speedItemIds;
  const attrEquippedIds = equipmentState.attrEquippedIds;
  const acUseDex = equipmentState.useDex;

  // Legacy item modal setters for backward compatibility
  const itemIsArmor = itemModal.isArmor;
  const itemIsShield = itemModal.isShield;
  const itemHasAttrBonus = itemModal.hasAttrBonus;
  const itemIsMagicCasting = itemModal.isMagicCasting;
  const itemIsGrimoire = itemModal.isGrimoire;
  const itemMagicCastingDescription = itemModal.magicCastingDescription;
  const itemMagicCastingCapacity = itemModal.magicCastingCapacity;
  const itemMagicCastingCapacityText = itemModal.magicCastingCapacityText;
  const itemHasEffects = itemModal.hasEffects;
  const itemEffects = itemModal.effects;
  const itemAttrBonusAttr = itemModal.attrBonusAttr;
  const itemAttrBonusValue = itemModal.attrBonusValue;
  const itemAttrBonusValueText = itemModal.attrBonusValueText;
  const itemStatBonuses = itemModal.statBonuses;
  const itemIsWeapon = itemModal.isWeapon;
  const itemWeaponType = itemModal.weaponType;
  const itemWeaponMelee = itemModal.weaponMelee;
  const itemWeaponRanged = itemModal.weaponRanged;
  const itemWeaponToHitMagic = itemModal.weaponToHitMagic;
  const itemWeaponToHitMisc = itemModal.weaponToHitMisc;
  const itemWeaponDamageMagic = itemModal.weaponDamageMagic;
  const itemWeaponDamageMisc = itemModal.weaponDamageMisc;
  const itemWeaponDamageNumDice = itemModal.weaponDamageNumDice;
  const itemWeaponDamageDieType = itemModal.weaponDamageDieType;

  // Legacy item modal setters
  const setItemIsArmor = useCallback((v) => updateItemModal({ isArmor: v }), [updateItemModal]);
  const setItemIsShield = useCallback((v) => updateItemModal({ isShield: v }), [updateItemModal]);
  const setItemHasAttrBonus = useCallback((v) => updateItemModal({ hasAttrBonus: v }), [updateItemModal]);
  const setItemIsMagicCasting = useCallback((v) => updateItemModal({ isMagicCasting: v }), [updateItemModal]);
  const setItemIsGrimoire = useCallback((v) => updateItemModal({ isGrimoire: v }), [updateItemModal]);
  const setItemMagicCastingDescription = useCallback((v) => updateItemModal({ magicCastingDescription: v }), [updateItemModal]);
  const setItemMagicCastingCapacity = useCallback((v) => updateItemModal({ magicCastingCapacity: v }), [updateItemModal]);
  const setItemMagicCastingCapacityText = useCallback((v) => updateItemModal({ magicCastingCapacityText: v }), [updateItemModal]);
  const setItemHasEffects = useCallback((v) => updateItemModal({ hasEffects: v }), [updateItemModal]);
  const setItemEffects = useCallback((v) => updateItemModal({ effects: typeof v === 'function' ? v(itemModal.effects) : v }), [updateItemModal, itemModal.effects]);
  const setItemAttrBonusAttr = useCallback((v) => updateItemModal({ attrBonusAttr: v }), [updateItemModal]);
  const setItemAttrBonusValue = useCallback((v) => updateItemModal({ attrBonusValue: v }), [updateItemModal]);
  const setItemAttrBonusValueText = useCallback((v) => updateItemModal({ attrBonusValueText: v }), [updateItemModal]);
  const setItemStatBonuses = useCallback((v) => updateItemModal({ statBonuses: typeof v === 'function' ? v(itemModal.statBonuses) : v }), [updateItemModal, itemModal.statBonuses]);
  const setItemIsWeapon = useCallback((v) => updateItemModal({ isWeapon: v }), [updateItemModal]);
  const setItemWeaponType = useCallback((v) => updateItemModal({ weaponType: v }), [updateItemModal]);
  const setItemWeaponMelee = useCallback((v) => updateItemModal({ weaponMelee: v }), [updateItemModal]);
  const setItemWeaponRanged = useCallback((v) => updateItemModal({ weaponRanged: v }), [updateItemModal]);
  const setItemWeaponToHitMagic = useCallback((v) => updateItemModal({ weaponToHitMagic: v }), [updateItemModal]);
  const setItemWeaponToHitMisc = useCallback((v) => updateItemModal({ weaponToHitMisc: v }), [updateItemModal]);
  const setItemWeaponDamageMagic = useCallback((v) => updateItemModal({ weaponDamageMagic: v }), [updateItemModal]);
  const setItemWeaponDamageMisc = useCallback((v) => updateItemModal({ weaponDamageMisc: v }), [updateItemModal]);
  const setItemWeaponDamageNumDice = useCallback((v) => updateItemModal({ weaponDamageNumDice: v }), [updateItemModal]);
  const setItemWeaponDamageDieType = useCallback((v) => updateItemModal({ weaponDamageDieType: v }), [updateItemModal]);

  // Legacy new effect setters
  const newEffectKind = newEffect.kind;
  const newEffectMiscToHit = newEffect.miscToHit;
  const newEffectMiscDamage = newEffect.miscDamage;
  const newEffectMagicToHit = newEffect.magicToHit;
  const newEffectMagicDamage = newEffect.magicDamage;
  const newEffectAC = newEffect.ac;
  
  const setNewEffectKind = useCallback((v) => updateNewEffect({ kind: v }), [updateNewEffect]);
  const setNewEffectMiscToHit = useCallback((v) => updateNewEffect({ miscToHit: v }), [updateNewEffect]);
  const setNewEffectMiscDamage = useCallback((v) => updateNewEffect({ miscDamage: v }), [updateNewEffect]);
  const setNewEffectMagicToHit = useCallback((v) => updateNewEffect({ magicToHit: v }), [updateNewEffect]);
  const setNewEffectMagicDamage = useCallback((v) => updateNewEffect({ magicDamage: v }), [updateNewEffect]);
  const setNewEffectAC = useCallback((v) => updateNewEffect({ ac: v }), [updateNewEffect]);

  // ===== MODAL FORM STATES =====
  // These replace getElementById calls with controlled components
  
  // Simple text/number modal forms
  const [modalForms, setModalForms] = useState({
    // Race/Name/Class modals
    race: '',
    name: '',
    class: '',
    // Speed modal
    speedBase: 0,
    speedBonus: 0,
    // HP modal
    hpCurrent: 0,
    hpDelta: 0,
    hpBonus: 0,
    // AC Tracking modal
    acBase: 10,
    acMod: 0,
    acMagic: 0,
    acMisc: 0,
    acBonus: 0,
    // XP modal
    xpAdd: 0,
    // Attribute modal
    attrRolled: 10,
    attrBonus: 0,
    // Save modifier modal
    saveModInput: 0,
    // BTH modal
    bthBase: 0,
    // Bonus modifiers modal
    attackBonus: 0,
    damageBonus: 0,
    // Save bonus modal
    saveBonus: 0,
    // Spell stats modal
    spellDC: 10,
    spellAtk: 0,
    // Magic item modal
    magicItemName: '',
    magicItemCapacity: '5',
    // Magic item spell add modal
    magicItemSpellSelect: '',
    magicItemSpellCopies: 1,
    magicItemSpellPermanent: false,
    // Grimoire spell add modal
    grimoireSpellSelect: ''
  });
  
  const updateModalForm = useCallback((updates) => {
    setModalForms(prev => ({ ...prev, ...updates }));
  }, []);

  // Wallet modal form
  const [walletForm, setWalletForm] = useState({
    cp: 0, sp: 0, gp: 0, pp: 0
  });
  
  const updateWalletForm = useCallback((updates) => {
    setWalletForm(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetWalletForm = useCallback(() => {
    setWalletForm({ cp: 0, sp: 0, gp: 0, pp: 0 });
  }, []);

  // Spell form (for newSpell/editSpell modals)
  const [spellForm, setSpellForm] = useState({
    name: '',
    level: 0,
    description: '',
    prepTime: '',
    range: '',
    duration: '',
    aoe: '',
    savingThrow: '',
    spellResistance: false,
    hasDiceRoll: false,
    diceType: '',
    diceBonus: 0,
    verbal: false,
    somatic: false,
    material: false,
    materialDesc: ''
  });
  
  const updateSpellForm = useCallback((updates) => {
    setSpellForm(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetSpellForm = useCallback(() => {
    setSpellForm({
      name: '', level: 0, description: '', prepTime: '', range: '', duration: '',
      aoe: '', savingThrow: '', spellResistance: false, hasDiceRoll: false,
      diceType: '', diceBonus: 0, verbal: false, somatic: false, material: false, materialDesc: ''
    });
  }, []);

  // Companion form
  const [companionForm, setCompanionForm] = useState({
    name: '',
    species: '',
    description: '',
    hp: 10,
    maxHp: 10,
    ac: 10,
    groundSpeed: 30,
    flySpeed: 0,
    saveStr: 0,
    saveDex: 0,
    saveCon: 0,
    saveInt: 0,
    saveWis: 0,
    saveCha: 0
  });
  
  const updateCompanionForm = useCallback((updates) => {
    setCompanionForm(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetCompanionForm = useCallback(() => {
    setCompanionForm({
      name: '', species: '', description: '', hp: 10, maxHp: 10, ac: 10,
      groundSpeed: 30, flySpeed: 0, saveStr: 0, saveDex: 0, saveCon: 0,
      saveInt: 0, saveWis: 0, saveCha: 0
    });
  }, []);

  // Companion attack form
  const [compAttackForm, setCompAttackForm] = useState({
    name: '',
    numDice: 1,
    dieType: 6,
    bth: 0,
    mod: 0,
    toHitMagic: 0,
    toHitMisc: 0,
    damageBonus: 0,
    damageMagic: 0,
    damageMisc: 0
  });
  
  const updateCompAttackForm = useCallback((updates) => {
    setCompAttackForm(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetCompAttackForm = useCallback(() => {
    setCompAttackForm({
      name: '', numDice: 1, dieType: 6, bth: 0, mod: 0, toHitMagic: 0,
      toHitMisc: 0, damageBonus: 0, damageMagic: 0, damageMisc: 0
    });
  }, []);

  // Attack form
  const [attackForm, setAttackForm] = useState({
    name: '',
    useDamageDice: true,
    numDice: 1,
    dieType: 8,
    weaponMode: 'melee',
    bth: 0,
    attrMod: 0,
    magic: 0,
    misc: 0,
    damageMod: 0,
    damageMagic: 0,
    damageMisc: 0
  });
  
  const updateAttackForm = useCallback((updates) => {
    setAttackForm(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetAttackForm = useCallback(() => {
    setAttackForm({
      name: '', useDamageDice: true, numDice: 1, dieType: 8, weaponMode: 'melee',
      bth: 0, attrMod: 0, magic: 0, misc: 0, damageMod: 0, damageMagic: 0, damageMisc: 0
    });
  }, []);

  // Inventory item form (basic fields - flags handled by itemModal)
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    quantity: 1,
    weightPer: 0,
    ev: 0,
    worth: 0,
    worthUnit: 'gp',
    acBonus: 0
  });
  
  const updateItemForm = useCallback((updates) => {
    setItemForm(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetItemForm = useCallback(() => {
    setItemForm({
      name: '', description: '', quantity: 1, weightPer: 0, ev: 0,
      worth: 0, worthUnit: 'gp', acBonus: 0
    });
  }, []);

  // Magic item spell form
  const [miSpellForm, setMiSpellForm] = useState({
    selectedSpellId: '',
    copies: 1,
    permanent: false,
    name: '',
    level: 0,
    description: '',
    prepTime: '',
    duration: '',
    range: '',
    aoe: '',
    savingThrow: '',
    spellResistance: false,
    hasDiceRoll: false,
    diceType: ''
  });
  
  const updateMiSpellForm = useCallback((updates) => {
    setMiSpellForm(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetMiSpellForm = useCallback(() => {
    setMiSpellForm({
      selectedSpellId: '', copies: 1, permanent: false, name: '', level: 0,
      description: '', prepTime: '', duration: '', range: '', aoe: '',
      savingThrow: '', spellResistance: false, hasDiceRoll: false, diceType: ''
    });
  }, []);

  // State for import file input
  const [importError, setImportError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saving', 'saved', 'error'

  // ===== LOAD DATA ON MOUNT =====
  useEffect(() => {
    const loaded = loadFromLocalStorage();
    if (loaded && loaded.length > 0) {
      setCharacters(loaded);
    }
    setIsLoading(false);
  }, []);

  // ===== ANDROID BACK BUTTON HANDLER =====
  useEffect(() => {
    const handleBackButton = (e) => {
      // If a modal is open, close it instead of navigating back
      if (editModal) {
        e.preventDefault();
        setEditModal(null);
        return;
      }
      // If viewing a character, go back to character list
      if (currentCharIndex !== null) {
        e.preventDefault();
        setCurrentCharIndex(null);
        return;
      }
    };

    // Listen for popstate (browser/Android back button)
    window.addEventListener('popstate', handleBackButton);
    
    // Push initial state so we have something to pop
    if (window.history.state === null) {
      window.history.pushState({ app: 'cac' }, '');
    }

    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [editModal, currentCharIndex]);

  // Push history state when opening modals or selecting characters
  useEffect(() => {
    if (editModal || currentCharIndex !== null) {
      window.history.pushState({ app: 'cac', modal: !!editModal, char: currentCharIndex }, '');
    }
  }, [editModal, currentCharIndex]);

  // ===== AUTO-SAVE WHEN CHARACTERS CHANGE =====
  useEffect(() => {
    // Don't save on initial mount with empty array
    if (characters.length === 0 && !localStorage.getItem(STORAGE_KEY)) {
      return;
    }
    
    setSaveStatus('saving');
    const success = saveToLocalStorage(characters);
    setSaveStatus(success ? 'saved' : 'error');
    
    // Clear the "saved" indicator after 2 seconds
    if (success) {
      const timer = setTimeout(() => setSaveStatus(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [characters]);

  // ===== EXPORT/IMPORT HANDLERS =====
  const handleExport = useCallback(() => {
    exportToFile(characters);
  }, [characters]);

  const handleImportClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      try {
        setImportError(null);
        const imported = await importFromFile(file);
        if (imported.length > 0) {
          // Ask user if they want to replace or merge
          const replace = window.confirm(
            `Import ${imported.length} character(s)?\n\nOK = Replace all current characters\nCancel = Add to existing characters`
          );
          if (replace) {
            setCharacters(imported);
            setCurrentCharIndex(null);
          } else {
            setCharacters(prev => [...prev, ...imported]);
          }
        }
      } catch (err) {
        setImportError('Failed to import: ' + (err?.message || 'Invalid file'));
        setTimeout(() => setImportError(null), 5000);
      }
    };
    input.click();
  }, []);

  // ===== MEMOIZED MODAL HANDLERS =====
  // These prevent creating new function references on every render
  const openNameModal = useCallback(() => setEditModal({ type: 'name' }), []);
  const openRaceModal = useCallback(() => setEditModal({ type: 'race' }), []);
  const openClassModal = useCallback(() => setEditModal({ type: 'class' }), []);
  const openSpeedModal = useCallback(() => setEditModal({ type: 'speed' }), []);
  const openHpModal = useCallback(() => setEditModal({ type: 'hp' }), []);
  const openHpTrackingModal = useCallback(() => setEditModal({ type: 'hpTracking' }), []);
  const openAcTrackingModal = useCallback(() => setEditModal({ type: 'acTracking' }), []);
  const openXpTableModal = useCallback(() => setEditModal({ type: 'xpTable' }), []);
  const openAddXpModal = useCallback(() => setEditModal({ type: 'addXp' }), []);
  const openWalletModal = useCallback(() => setEditModal({ type: 'wallet' }), []);
  const openNewItemModal = useCallback(() => setEditModal({ type: 'newItem' }), []);
  const openNewAttackModal = useCallback(() => setEditModal({ type: 'newAttack' }), []);
  const openNewSpellModal = useCallback(() => setEditModal({ type: 'newSpell' }), []);
  const openNewCompanionModal = useCallback(() => setEditModal({ type: 'newCompanion' }), []);
  const openSpellStatsModal = useCallback(() => setEditModal({ type: 'spellStats' }), []);
  const openSpellSlotsModal = useCallback(() => setEditModal({ type: 'spellSlots' }), []);
  const openNewMagicItemModal = useCallback(() => setEditModal({ type: 'newMagicItem' }), []);
  const openBonusModifiersModal = useCallback(() => setEditModal({ type: 'bonusModifiers' }), []);
  const openSaveModifiersModal = useCallback(() => setEditModal({ type: 'saveModifiers' }), []);
  const closeModal = useCallback(() => setEditModal(null), []);

  
  const char = currentCharIndex !== null ? characters[currentCharIndex] : null;

  // ===== MEMOIZED CALCULATIONS =====
  // These values are cached and only recalculated when their dependencies change
  
  // Helper function for normalizing item stat bonuses (used in memoized calcs)
  const normalizeItemStatBonusesStatic = useCallback((it) => {
    const arr = Array.isArray(it?.attrBonuses)
      ? it.attrBonuses
          .filter(b => b && typeof b === 'object')
          .map(b => ({ attr: String(b.attr || '').toLowerCase(), value: Number(b.value) || 0 }))
          .filter(b => b.attr && b.value !== 0)
      : [];
    if (arr.length) return arr;
    const legacyAttr = String(it?.attrBonusAttr || '').toLowerCase();
    const legacyVal = Number(it?.attrBonusValue) || 0;
    return (legacyAttr && legacyVal !== 0) ? [{ attr: legacyAttr, value: legacyVal }] : [];
  }, []);

  // Memoized attribute totals - recalculated only when char data changes
  const memoizedAttributeTotals = useMemo(() => {
    if (!char) return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    
    const calcAttrTotal = (attrKey) => {
      const a = char.attributes?.[attrKey];
      const rolled = Number.isFinite(a?.rolledScore) ? a.rolledScore : 10;
      const bonusMod = Number.isFinite(a?.bonusMod) ? a.bonusMod : 0;
      
      // Race bonus
      const raceMatch = (char.raceAttributeMods || []).find(x => String(x.attr).toLowerCase() === attrKey);
      const raceBonus = raceMatch ? (Number(raceMatch.value) || 0) : 0;
      
      // Item bonus
      const equipped = (char.equippedAttrBonuses?.[attrKey] || []).map(x => String(x));
      let itemBonus = 0;
      if (equipped.length) {
        itemBonus = (char.inventory || []).reduce((sum, it) => {
          if (!it?.hasAttrBonus || !equipped.includes(String(it.id))) return sum;
          const qty = Number(it.quantity) || 1;
          const bonuses = normalizeItemStatBonusesStatic(it);
          const match = bonuses.find(b => b.attr === attrKey);
          return match ? sum + ((Number(match.value) || 0) * qty) : sum;
        }, 0);
      }
      
      return rolled + raceBonus + bonusMod + itemBonus;
    };
    
    return {
      str: calcAttrTotal('str'),
      dex: calcAttrTotal('dex'),
      con: calcAttrTotal('con'),
      int: calcAttrTotal('int'),
      wis: calcAttrTotal('wis'),
      cha: calcAttrTotal('cha')
    };
  }, [char?.attributes, char?.raceAttributeMods, char?.equippedAttrBonuses, char?.inventory, normalizeItemStatBonusesStatic]);

  // Memoized encumbrance calculations
  const memoizedEncumbrance = useMemo(() => {
    if (!char) return { rating: 0, totalEV: 0, status: 'unburdened', speedPenalty: 0 };
    
    const strScore = memoizedAttributeTotals.str;
    const strPrime = !!char.attributes?.str?.isPrime;
    const conPrime = !!char.attributes?.con?.isPrime;
    const rating = strScore + (strPrime ? 3 : 0) + (conPrime ? 3 : 0);
    
    const totalEV = (char.inventory || []).reduce((sum, it) => {
      const qty = Number(it.quantity) || 1;
      const ev = Number(it.ev) || 0;
      return sum + (ev * qty);
    }, 0);
    
    let status = 'unburdened';
    if (rating > 0) {
      if (totalEV > rating && totalEV <= (3 * rating)) status = 'burdened';
      else if (totalEV > (3 * rating)) status = 'overburdened';
    }
    
    // Calculate speed with encumbrance
    const baseSpeed = Number(char.speed) || 0;
    const speedBonus = Number(char.speedBonus) || 0;
    const equippedSpeedIds = (char.equippedSpeedItemIds || []).map(x => String(x));
    const itemSpeedBonus = (char.inventory || [])
      .filter(it => it?.hasAttrBonus && equippedSpeedIds.includes(String(it.id)))
      .reduce((sum, it) => {
        const bonuses = normalizeItemStatBonusesStatic(it);
        const match = bonuses.find(b => b.attr === 'speed');
        if (!match) return sum;
        const qty = Number(it.quantity) || 1;
        return sum + ((Number(match.value) || 0) * qty);
      }, 0);
    const preEncumbranceSpeed = baseSpeed + speedBonus + itemSpeedBonus;
    
    let speedPenalty = 0;
    if (status === 'burdened') speedPenalty = Math.min(10, Math.max(preEncumbranceSpeed - 5, 0));
    else if (status === 'overburdened') speedPenalty = Math.max(preEncumbranceSpeed - 5, 0);
    
    const finalSpeed = status === 'unburdened' ? preEncumbranceSpeed : Math.max(preEncumbranceSpeed - speedPenalty, 5);
    
    return { rating, totalEV, status, speedPenalty, preEncumbranceSpeed, finalSpeed };
  }, [char?.speed, char?.speedBonus, char?.equippedSpeedItemIds, char?.inventory, char?.attributes?.str?.isPrime, char?.attributes?.con?.isPrime, memoizedAttributeTotals.str, normalizeItemStatBonusesStatic]);

  // Memoized AC calculation
  const memoizedAC = useMemo(() => {
    if (!char) return 10;
    const base = char.acBase || 10;
    
    // Shield
    let shield = 0;
    if (char.equippedShieldId) {
      const sItem = (char.inventory || []).find(i => String(i.id) === String(char.equippedShieldId));
      shield = Number(sItem?.acBonus) || 0;
    }
    
    // Armor
    const armorIds = Array.isArray(char.equippedArmorIds) ? char.equippedArmorIds : (char.equippedArmorId ? [char.equippedArmorId] : []);
    const armor = armorIds.reduce((sum, aid) => {
      const aItem = (char.inventory || []).find(i => String(i.id) === String(aid));
      return sum + (Number(aItem?.acBonus) || 0);
    }, 0);
    
    // Dex mod (removed if overburdened)
    let mod = (char.acModAuto !== false) ? calcMod(memoizedAttributeTotals.dex) : (char.acMod || 0);
    if (memoizedEncumbrance.status === 'overburdened' && char.acModAuto !== false) mod = 0;
    
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
    
    return base + armor + shield + mod + magic + misc + raceAC + bonus + effAC;
  }, [char?.acBase, char?.equippedShieldId, char?.equippedArmorIds, char?.equippedArmorId, char?.inventory, char?.acModAuto, char?.acMod, char?.acMagic, char?.acMisc, char?.acBonus, char?.equippedEffectItemIds, char?.raceAttributeMods, memoizedAttributeTotals.dex, memoizedEncumbrance.status]);

  // Memoized XP/Level calculation
  const memoizedLevelInfo = useMemo(() => {
    if (!char) return { nextLevelXp: 0, progress: 0, canLevelUp: false, currentLevel: 1 };
    if (!Array.isArray(char.xpTable) || char.xpTable.length === 0) {
      return { nextLevelXp: 0, progress: 0, canLevelUp: false, currentLevel: (Number(char.class1Level) || 1) };
    }
    
    let currentLevel = 1;
    for (let i = char.xpTable.length - 1; i >= 0; i--) {
      if (char.currentXp >= char.xpTable[i]) {
        currentLevel = i + 1;
        break;
      }
    }
    
    const nextLevelXp = char.xpTable[currentLevel] || char.xpTable[char.xpTable.length - 1];
    const prevLevelXp = char.xpTable[currentLevel - 1] || 0;
    const xpIntoLevel = char.currentXp - prevLevelXp;
    const xpNeededForLevel = nextLevelXp - prevLevelXp;
    const progress = xpNeededForLevel > 0 ? ((xpIntoLevel / xpNeededForLevel) * 100).toFixed(1) : 0;
    
    return { 
      nextLevelXp, 
      progress: Math.min(100, progress), 
      canLevelUp: char.currentXp >= nextLevelXp,
      currentLevel
    };
  }, [char?.xpTable, char?.currentXp, char?.class1Level]);

  // Memoized max HP calculation
  const memoizedMaxHP = useMemo(() => {
    if (!char || !char.hpByLevel) return char?.maxHp || 0;
    const levelHP = char.hpByLevel.reduce((sum, hp) => sum + hp, 0);
    const bonusHP = char.hpBonus || 0;
    return levelHP + bonusHP;
  }, [char?.hpByLevel, char?.hpBonus, char?.maxHp]);

  // ===== MEMOIZED SORTED LISTS =====
  // These prevent re-sorting on every render
  
  const sortedInventory = useMemo(() => 
    (char?.inventory || []).slice().sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    ), [char?.inventory]);

  const sortedAttacks = useMemo(() => 
    (char?.attacks || []).slice().sort((a, b) => {
      const af = !!a.isFavorite;
      const bf = !!b.isFavorite;
      if (af !== bf) return af ? -1 : 1;
      const an = a.weaponId ? getBoundAttackName(a, char?.inventory) : (a.name || '');
      const bn = b.weaponId ? getBoundAttackName(b, char?.inventory) : (b.name || '');
      return String(an).localeCompare(String(bn));
    }), [char?.attacks, char?.inventory]);

  const sortedSpellsLearned = useMemo(() => 
    (char?.spellsLearned || []).slice().sort((a, b) => {
      const lvlA = Number(a?.level) || 0;
      const lvlB = Number(b?.level) || 0;
      if (lvlA !== lvlB) return lvlA - lvlB;
      return (a?.name || '').localeCompare(b?.name || '');
    }), [char?.spellsLearned]);

  const sortedGrimoires = useMemo(() => 
    (char?.grimoires || []).slice().sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    ), [char?.grimoires]);

  const sortedCompanions = useMemo(() => 
    (char?.companions || []).slice().sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    ), [char?.companions]);

  const sortedMagicItems = useMemo(() => 
    (char?.magicItems || []).slice().sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    ), [char?.magicItems]);

  // ===== END MEMOIZED SORTED LISTS =====

  // ===== END MEMOIZED CALCULATIONS =====

  // Attribute totals are computed from:
  // - Rolled Score (base)
  // - Bonus modifier (manual bless/curse/etc.)
  // - Item modifier (from inventory items with Attribute Bonus)
  const getEquippedAttrIds = (attrKey) => {
    const raw = (char?.equippedAttrBonuses && Array.isArray(char.equippedAttrBonuses[attrKey]))
      ? char.equippedAttrBonuses[attrKey]
      : [];
    return raw.map(x => String(x));
  };

  const getEquippedSpeedIds = () => {
    const raw = (char?.equippedSpeedItemIds && Array.isArray(char.equippedSpeedItemIds))
      ? char.equippedSpeedItemIds
      : [];
    return raw.map(x => String(x));
  };

  const normalizeItemStatBonuses = (it) => {
    // New format: it.attrBonuses = [{ attr: 'str'|'dex'|...|'ac'|'speed', value: number }, ...]
    const arr = Array.isArray(it?.attrBonuses)
      ? it.attrBonuses
          .filter(b => b && typeof b === 'object')
          .map(b => ({ attr: String(b.attr || '').toLowerCase(), value: Number(b.value) || 0 }))
          .filter(b => b.attr && b.value !== 0)
      : [];
    if (arr.length) return arr;
    // Legacy fallback
    const legacyAttr = String(it?.attrBonusAttr || '').toLowerCase();
    const legacyVal = Number(it?.attrBonusValue) || 0;
    return (legacyAttr && legacyVal !== 0) ? [{ attr: legacyAttr, value: legacyVal }] : [];
  };

  const getItemAttributeBonus = (attrKey) => {
    if (!char) return 0;
    const equipped = getEquippedAttrIds(attrKey);
    if (!equipped.length) return 0;
    return (char.inventory || []).reduce((sum, it) => {
      if (!it?.hasAttrBonus) return sum;
      const id = String(it.id);
      if (!equipped.includes(id)) return sum;
      const qty = Number(it.quantity) || 1;
      const bonuses = normalizeItemStatBonuses(it);
      const match = bonuses.find(b => b.attr === attrKey);
      if (!match) return sum;
      return sum + ((Number(match.value) || 0) * qty);
    }, 0);
  };

  const getRaceAttributeBonus = (attrKey) => {
    if (!char) return 0;
    const list = (char.raceAttributeMods || []);
    const match = list.find(x => String(x.attr).toLowerCase() === String(attrKey).toLowerCase());
    return match ? (Number(match.value) || 0) : 0;
  };

  const getRaceACBonus = () => {
    if (!char) return 0;
    const list = (char.raceAttributeMods || []);
    const match = list.find(x => String(x.attr).toLowerCase() === 'ac');
    return match ? (Number(match.value) || 0) : 0;
  };

  const getItemAttributeSources = (attrKey) => {
    if (!char) return [];
    const equipped = getEquippedAttrIds(attrKey);
    return (char.inventory || [])
      .filter(it => {
        if (!it?.hasAttrBonus) return false;
        if (!equipped.includes(String(it.id))) return false;
        const bonuses = normalizeItemStatBonuses(it);
        const match = bonuses.find(b => b.attr === attrKey);
        return !!match && (Number(match.value) || 0) !== 0;
      })
      .map(it => {
        const qty = Number(it.quantity) || 1;
        const bonuses = normalizeItemStatBonuses(it);
        const match = bonuses.find(b => b.attr === attrKey);
        const val = Number(match?.value) || 0;
        return { name: it.name || 'Item', qty, val, total: val * qty };
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  };

  const getItemAttributeCandidates = (attrKey) => {
    if (!char) return [];
    return (char.inventory || [])
      .filter(it => {
        if (!it?.hasAttrBonus) return false;
        const bonuses = normalizeItemStatBonuses(it);
        const match = bonuses.find(b => b.attr === attrKey);
        return !!match && (Number(match.value) || 0) !== 0;
      })
      .map(it => {
        const qty = Number(it.quantity) || 1;
        const bonuses = normalizeItemStatBonuses(it);
        const match = bonuses.find(b => b.attr === attrKey);
        const val = Number(match?.value) || 0;
        return { id: it.id, name: it.name || 'Item', qty, val, total: val * qty };
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  };

  const getAttributeRolled = (attrKey) => {
    const a = char?.attributes?.[attrKey];
    const v = a?.rolledScore;
    return Number.isFinite(v) ? v : (Number(a?.rolledScore) || 10);
  };

  const getAttributeBonusMod = (attrKey) => {
    const a = char?.attributes?.[attrKey];
    const v = a?.bonusMod;
    return Number.isFinite(v) ? v : (Number(a?.bonusMod) || 0);
  };

  // Use memoized attribute totals for performance
  const getAttributeTotal = (attrKey) => {
    return memoizedAttributeTotals[attrKey] ?? 10;
  };

  // Use memoized encumbrance values
  const getEncumbranceRating = () => memoizedEncumbrance.rating;
  const getInventoryTotalEV = () => memoizedEncumbrance.totalEV;
  const getEncumbranceStatus = () => memoizedEncumbrance.status;

  const getEncumbranceStatusLabel = () => {
    const s = memoizedEncumbrance.status;
    return s ? (s.charAt(0).toUpperCase() + s.slice(1)) : '';
  };

  const getSpeedPreEncumbrance = () => memoizedEncumbrance.preEncumbranceSpeed || 0;
  const getEncumbranceSpeedPenalty = () => memoizedEncumbrance.speedPenalty;
  const getSpeedTotal = () => memoizedEncumbrance.finalSpeed || 0;

  // Keep modal-specific state in sync when opening different modals
  useEffect(() => {
    if (!editModal) return;

    // Initialize simple text modals
    if (editModal.type === 'race' && char) {
      updateModalForm({ race: char.race || '' });
    }
    if (editModal.type === 'name' && char) {
      updateModalForm({ name: char.name || '' });
    }
    if (editModal.type === 'class' && char) {
      updateModalForm({ class: char.class1 || '' });
    }
    if (editModal.type === 'speed' && char) {
      updateModalForm({ 
        speedBase: Number(char.speed) || 0,
        speedBonus: Number(char.speedBonus) || 0
      });
    }
    if (editModal.type === 'hp' && char) {
      updateModalForm({
        hpCurrent: Number(char.hp) || 0,
        hpDelta: 0
      });
    }
    if (editModal.type === 'hpTracking' && char) {
      updateModalForm({
        hpBonus: Number(char.hpBonus) || 0
      });
    }
    if (editModal.type === 'acTracking' && char) {
      updateModalForm({
        acBase: Number(char.acBase) || 10,
        acMod: Number(char.acMod) || 0,
        acMagic: Number(char.acMagic) || 0,
        acMisc: Number(char.acMisc) || 0,
        acBonus: Number(char.acBonus) || 0
      });
    }
    if (editModal.type === 'addXp') {
      updateModalForm({ xpAdd: 0 });
    }
    if (editModal.type === 'attribute' && char) {
      const attr = char.attributes?.[editModal.attr];
      updateModalForm({
        attrRolled: Number(attr?.rolledScore) || 10,
        attrBonus: Number(attr?.bonusMod) || 0
      });
    }
    if (editModal.type === 'saveModifier' && char) {
      const attr = char.attributes?.[editModal.attr];
      updateModalForm({ saveModInput: Number(attr?.saveModifier) || 0 });
    }
    if (editModal.type === 'bthModal' && char) {
      updateModalForm({ bthBase: Number(char.baseBth) || 0 });
    }
    if (editModal.type === 'bonusModifiers' && char) {
      updateModalForm({
        attackBonus: Number(char.attackBonus) || 0,
        damageBonus: Number(char.damageBonus) || 0
      });
    }
    if (editModal.type === 'saveModifiers' && char) {
      updateModalForm({ saveBonus: Number(char.saveBonus) || 0 });
    }
    if (editModal.type === 'wallet') {
      resetWalletForm();
    }
    if (editModal.type === 'spellStats' && char) {
      updateModalForm({
        spellDC: Number(char.spellSaveDC) || 10,
        spellAtk: Number(char.spellAttackBonus) || 0
      });
    }
    if (editModal.type === 'newMagicItem') {
      updateModalForm({ magicItemName: '', magicItemCapacity: '5' });
    }
    
    if (editModal.type === 'newMagicItemSpell') {
      updateModalForm({ 
        magicItemSpellSelect: '', 
        magicItemSpellCopies: 1, 
        magicItemSpellPermanent: false 
      });
    }
    
    if (editModal.type === 'addGrimoireSpell') {
      updateModalForm({ grimoireSpellSelect: '' });
    }

    if (editModal.type === 'newItem') {
      resetItemForm();
      setItemIsArmor(false);
      setItemIsShield(false);
      setItemHasAttrBonus(false);
      setItemStatBonuses([]);
      setItemAttrBonusAttr('str');
      setItemAttrBonusValue(0);
                            setItemAttrBonusValueText('0');
      setItemAttrBonusValueText('0');
      setItemIsMagicCasting(false);
      setItemIsGrimoire(false);
      setItemMagicCastingDescription('');
      setItemMagicCastingCapacity(0);
      setItemMagicCastingCapacityText('');

      setItemIsWeapon(false);
      setItemWeaponType('melee');
      setItemWeaponMelee(true);
      setItemWeaponRanged(false);
      setItemWeaponToHitMagic(0);
      setItemWeaponToHitMisc(0);
      setItemWeaponDamageMagic(0);
      setItemWeaponDamageMisc(0);

      setItemHasEffects(false);
      setItemEffects([]);
      setNewEffectKind('attack');
setNewEffectMiscToHit(0);
      setNewEffectMiscDamage(0);
      setNewEffectMagicToHit(0);
      setNewEffectMagicDamage(0);
      
    }
    if (editModal.type === 'editItem') {
      // Initialize itemForm with item values
      setItemForm({
        name: editModal.item?.name || '',
        description: editModal.item?.description || '',
        quantity: Number(editModal.item?.quantity) || 1,
        weightPer: Number(editModal.item?.weightPer) || 0,
        ev: Number(editModal.item?.ev) || 0,
        worth: editModal.item?.worthAmount ?? (editModal.item?.worthGP != null ? editModal.item.worthGP : 0),
        worthUnit: editModal.item?.worthUnit || (editModal.item?.worthGP != null ? 'gp' : 'gp'),
        acBonus: Number(editModal.item?.acBonus) || 0
      });
      setItemIsArmor(!!editModal.item?.isArmor);
      setItemIsShield(!!editModal.item?.isShield);
      // Stat bonuses can include multiple bonuses (e.g., STR + DEX). Support both new array and legacy single fields.
      const legacyAttr = String(editModal.item?.attrBonusAttr || '').toLowerCase();
      const legacyVal = Number(editModal.item?.attrBonusValue) || 0;
      const loadedBonuses = Array.isArray(editModal.item?.attrBonuses)
        ? editModal.item.attrBonuses
            .filter(b => b && typeof b === 'object')
            .map(b => ({ attr: String(b.attr || '').toLowerCase(), value: Number(b.value) || 0 }))
            .filter(b => b.attr && b.value !== 0)
        : (legacyAttr && legacyVal !== 0 ? [{ attr: legacyAttr, value: legacyVal }] : []);

      setItemHasAttrBonus(!!editModal.item?.hasAttrBonus || loadedBonuses.length > 0);
      setItemStatBonuses(loadedBonuses);

      // Keep the "add bonus" controls initialized to something sensible
      setItemAttrBonusAttr(loadedBonuses[0]?.attr || 'str');
      setItemAttrBonusValue(loadedBonuses[0]?.value || 0);
      setItemAttrBonusValueText(String(loadedBonuses[0]?.value ?? 0));
      setItemIsMagicCasting(!!editModal.item?.isMagicCasting);
      setItemIsGrimoire(!!editModal.item?.isGrimoire);
      setItemMagicCastingDescription(String(editModal.item?.magicCastingDescription || ''));
      setItemMagicCastingCapacity(Number(editModal.item?.magicCastingCapacity) || 0);
      setItemMagicCastingCapacityText(String(Number(editModal.item?.magicCastingCapacity) || 0));

      setItemIsWeapon(!!editModal.item?.isWeapon);
      setItemWeaponType(editModal.item?.weaponType || 'melee');
      setItemWeaponMelee(!!(editModal.item?.weaponMelee ?? ((editModal.item?.weaponType || 'melee') === 'melee')));
      setItemWeaponRanged(!!(editModal.item?.weaponRanged ?? ((editModal.item?.weaponType || 'melee') === 'ranged')));
      setItemWeaponToHitMagic(Number(editModal.item?.weaponToHitMagic) || 0);
      setItemWeaponToHitMisc(Number(editModal.item?.weaponToHitMisc) || 0);
      setItemWeaponDamageMagic(Number(editModal.item?.weaponDamageMagic) || 0);
      setItemWeaponDamageMisc(Number(editModal.item?.weaponDamageMisc) || 0);
      setItemWeaponDamageNumDice(Number(editModal.item?.weaponDamageNumDice) || 1);
      setItemWeaponDamageDieType(Number(editModal.item?.weaponDamageDieType) || 8);

      // Load item effects (new format)
      const loadedEffects = Array.isArray(editModal.item?.effects) ? editModal.item.effects : [];
      setItemHasEffects(loadedEffects.length > 0);
      setItemEffects(loadedEffects);
      // Reset new effect editor defaults
      setNewEffectKind('attack');
setNewEffectMiscToHit(0);
      setNewEffectMiscDamage(0);
      setNewEffectMagicToHit(0);
      setNewEffectMagicDamage(0);
      
    }

    
    if (editModal.type === 'attribute' && char) {
      const k = editModal.attr;
      const raw = (char.equippedAttrBonuses && char.equippedAttrBonuses[k] && Array.isArray(char.equippedAttrBonuses[k]))
        ? char.equippedAttrBonuses[k]
        : [];
      setAttrEquippedIds(raw.map(x => String(x)));
    }

if (editModal.type === 'acTracking' && char) {
      const raw = (char.equippedArmorIds && Array.isArray(char.equippedArmorIds))
        ? char.equippedArmorIds
        : (char.equippedArmorId ? [char.equippedArmorId] : []);
      setEquippedArmorIds(raw.map(x => String(x)));
      setEquippedShieldId(char.equippedShieldId ? String(char.equippedShieldId) : '');
      const eff = ensureEquippedEffectShape(char);
      setEquippedDefenseItemIds(eff.ac);
      const rawSpeed = (char.equippedSpeedItemIds && Array.isArray(char.equippedSpeedItemIds)) ? char.equippedSpeedItemIds : [];
      setEquippedSpeedItemIds(rawSpeed.map(x => String(x)));

      setAcUseDex(char.acModAuto !== false);

    }
    
    // Companion form initialization
    if (editModal.type === 'newCompanion') {
      resetCompanionForm();
    }
    if (editModal.type === 'editCompanion' && editModal.companion) {
      setCompanionForm({
        name: editModal.companion.name || '',
        species: editModal.companion.species || '',
        description: editModal.companion.description || '',
        hp: Number(editModal.companion.hp) || 10,
        maxHp: Number(editModal.companion.maxHp) || 10,
        ac: Number(editModal.companion.ac) || 10,
        groundSpeed: Number(editModal.companion.groundSpeed) || 30,
        flySpeed: Number(editModal.companion.flySpeed) || 0,
        saveStr: Number(editModal.companion.saves?.str?.bonus) || 0,
        saveDex: Number(editModal.companion.saves?.dex?.bonus) || 0,
        saveCon: Number(editModal.companion.saves?.con?.bonus) || 0,
        saveInt: Number(editModal.companion.saves?.int?.bonus) || 0,
        saveWis: Number(editModal.companion.saves?.wis?.bonus) || 0,
        saveCha: Number(editModal.companion.saves?.cha?.bonus) || 0
      });
    }
    
    // Companion attack form initialization
    if (editModal.type === 'newCompanionAttack') {
      resetCompAttackForm();
    }
    if (editModal.type === 'editCompanionAttack' && editModal.attack) {
      setCompAttackForm({
        name: editModal.attack.name || '',
        numDice: Number(editModal.attack.numDice) || 1,
        dieType: Number(editModal.attack.dieType) || 6,
        bth: Number(editModal.attack.bth) || 0,
        mod: Number(editModal.attack.mod) || 0,
        toHitMagic: Number(editModal.attack.toHitMagic) || 0,
        toHitMisc: Number(editModal.attack.toHitMisc) || 0,
        damageBonus: Number(editModal.attack.damageBonus) || 0,
        damageMagic: Number(editModal.attack.damageMagic) || 0,
        damageMisc: Number(editModal.attack.damageMisc) || 0
      });
    }
    
    // Attack form initialization
    if (editModal.type === 'newAttack') {
      resetAttackForm();
    }
    if (editModal.type === 'editAttack' && editModal.attack) {
      const useDice = typeof editModal.attack.useDamageDice === 'boolean' 
        ? editModal.attack.useDamageDice 
        : (Number(editModal.attack.numDice ?? 1) > 0);
      setAttackForm({
        name: editModal.attack.name || '',
        useDamageDice: useDice,
        numDice: Math.max(1, Number(editModal.attack.numDice ?? 1)),
        dieType: Number(editModal.attack.dieType) || 8,
        weaponMode: editModal.attack.weaponMode || 'melee',
        bth: Number(editModal.attack.bth) || 0,
        attrMod: Number(editModal.attack.attrMod) || 0,
        magic: Number(editModal.attack.magic) || 0,
        misc: Number(editModal.attack.misc) || 0,
        damageMod: Number(editModal.attack.damageMod) || 0,
        damageMagic: Number(editModal.attack.damageMagic) || 0,
        damageMisc: Number(editModal.attack.damageMisc) || 0
      });
    }
    
    // Spell form initialization
    if (editModal.type === 'newSpell') {
      resetSpellForm();
    }
    if (editModal.type === 'editSpell' && editModal.spell) {
      setSpellForm({
        name: editModal.spell.name || '',
        level: Number(editModal.spell.level) || 0,
        description: editModal.spell.description || '',
        prepTime: editModal.spell.prepTime || '',
        range: editModal.spell.range || '',
        duration: editModal.spell.duration || '',
        aoe: editModal.spell.aoe || '',
        savingThrow: editModal.spell.savingThrow || '',
        spellResistance: !!editModal.spell.spellResistance,
        hasDiceRoll: !!editModal.spell.hasDiceRoll,
        diceType: editModal.spell.diceType || '',
        diceBonus: Number(editModal.spell.diceBonus) || 0,
        verbal: !!editModal.spell.verbal,
        somatic: !!editModal.spell.somatic,
        material: !!editModal.spell.material,
        materialDesc: editModal.spell.materialDesc || ''
      });
    }
    
    // Magic item spell form initialization
    if (editModal.type === 'editMagicItemSpell') {
      const spell = editModal.spell || {};
      setMiSpellForm({
        selectedSpellId: '',
        copies: Number(editModal.copies) || 1,
        permanent: !!editModal.permanent,
        name: spell.name || '',
        level: Number(spell.level) || 0,
        description: spell.description || '',
        prepTime: spell.prepTime || '',
        duration: spell.duration || '',
        range: spell.range || '',
        aoe: spell.aoe || '',
        savingThrow: spell.savingThrow || '',
        spellResistance: !!spell.spellResistance,
        hasDiceRoll: !!spell.hasDiceRoll,
        diceType: spell.diceType || ''
      });
    }
  }, [editModal, char]);

  // Permanent / used-today flags are tracked on grimoire *entries* (each entry is one "copy" of a spell).
  const hasAnyPermanent = !!char && (char.grimoires || []).some(g => (g.entries || []).some(e => !!e.permanent));
  const hasAnyUsedPermanentToday = !!char && (char.grimoires || []).some(g => (g.entries || []).some(e => !!e.permanent && !!e.usedToday));

  const rollDice = (sides) => Math.floor(Math.random() * sides) + 1;

  const sortSpellsLevelName = (a, b) => {
    const la = a?.level ?? 0;
    const lb = b?.level ?? 0;
    if (la !== lb) return la - lb;
    const na = (a?.name || '').toLowerCase();
    const nb = (b?.name || '').toLowerCase();
    if (na < nb) return -1;
    if (na > nb) return 1;
    // stable tie-breakers for duplicates
    return (a?.prepId || a?.instanceId || a?.id || 0) - (b?.prepId || b?.instanceId || b?.id || 0);
  };

  const spellPointCost = (level) => {
    const lv = parseInt(level, 10) || 0;
    if (lv <= 1) return 1;
    return lv;
  };

  const getGrimoireUsedPoints = (grimoire) => {
    if (!grimoire?.entries || !Array.isArray(grimoire.entries)) return 0;
    return grimoire.entries.reduce((sum, entry) => {
      const spell = (char?.spellsLearned || []).find(s => s.id === entry.spellId) || entry.spell;
      const lv = spell?.level ?? 0;
      return sum + spellPointCost(lv);
    }, 0);
  };

  const getGrimoirePointsLeft = (grimoire) => {
    const cap = grimoire?.capacity ?? 39;
    return cap - getGrimoireUsedPoints(grimoire);
  };
  // Arcane Thief: permanent spells per day are limited by character level (and still obey grimoire capacity).
  // Compute directly here to avoid any ordering/TDZ issues.
  const getPermanentSpellLimit = () => {
    // Arcane Thief: one retained spell per Arcane Thief level.
    // In this app, class1 level is tracked as XP-derived currentLevel (see calculateNextLevel()).
    const c1 = String(char?.class1 || char?.class1Name || '').toLowerCase();
    const c2 = String(char?.class2 || char?.class2Name || '').toLowerCase();
    const derivedLevel = (typeof calculateNextLevel === 'function' ? (calculateNextLevel().currentLevel || 1) : 1);
    const class2Level = parseInt(char?.class2Level ?? 0, 10) || 0;

    if (c1.includes('arcane thief')) return Math.max(0, derivedLevel);
    if (c2.includes('arcane thief')) return Math.max(0, class2Level);

    // Fallback: legacy behavior for non-Arcane Thief characters.
    return Math.max(1, derivedLevel);
  };

  const countPermanentSpells = (grimoireId) => {
    const g = (char?.grimoires || []).find(x => x.id === grimoireId);
    if (!g) return 0;
    return (g.entries || []).filter(e => !!e.permanent).length;
  };

  const showGameAlert = (title, message) => {
    setEditModal({ type: 'gameAlert', title, message });
  };

  const resetPermanentSpellsForNewDay = () => {
    // Reset Arcane Thief retained spells (grimoires)
    const newGrimoires = (char.grimoires || []).map((g) => ({
      ...g,
      entries: (g.entries || []).map((e) => (e.permanent ? { ...e, usedToday: false } : e)),
    }));

    // Reset permanent spell uses on magic items (wands, staves, etc.)
    const newMagicItems = (char.magicItems || []).map((it) => ({
      ...it,
      spells: (it.spells || []).map((e) => (e.permanent ? { ...e, usedToday: false } : e)),
    }));

    updateChar({ grimoires: newGrimoires, magicItems: newMagicItems });
  };

  const addSpellToGrimoire = (grimoireId, spell) => {
    const g = (char.grimoires || []).find(x => x.id === grimoireId);
    if (!g) return;
    const cost = spellPointCost(spell.level);
    const left = getGrimoirePointsLeft(g);
    if (cost > left) {
      alert(`Not enough space in ${g.name}. Need ${cost} points, only ${left} left.`);
      return;
    }
    const newEntry = {
      instanceId: Date.now(),
      spellId: spell.id,
      // store a copy so edits to learned don't have to propagate unless you want them to
      spell: spell,
      permanent: false,
      usedToday: false,
      concentrating: false,
      numDice: 1
    };
    const newGrimoires = (char.grimoires || []).map(x =>
      x.id === grimoireId ? { ...x, entries: [...(x.entries || []), newEntry] } : x
    );
    updateChar({ grimoires: newGrimoires });
  };

  const castFromGrimoire = (grimoireId, entry) => {
    const g = (char.grimoires || []).find(x => x.id === grimoireId);
    if (!g) return;

    // Permanent spells (Arcane Thief) can be cast once per day; they stay in the grimoire.
    if (entry.permanent) {
      if (entry.usedToday) return;
      const newEntries = (g.entries || []).map(e => {
        if (e.instanceId === entry.instanceId) {
          return { ...e, usedToday: true };
        }
        return e;
      });
      const newGrimoires = (char.grimoires || []).map(x => x.id === grimoireId ? { ...x, entries: newEntries } : x);
      updateChar({ grimoires: newGrimoires });
      return;
    }

    // Non-permanent: casting consumes one instance (like Prepared)
    const newEntries = (g.entries || []).filter(e => e.instanceId !== entry.instanceId);
    const newGrimoires = (char.grimoires || []).map(x => x.id === grimoireId ? { ...x, entries: newEntries } : x);
    updateChar({ grimoires: newGrimoires });
  };

  const deleteGrimoire = (grimoireId) => {
    const g = (char.grimoires || []).find(x => x.id === grimoireId);
    if (!g) return;
    if (window.confirm(`Delete grimoire "${g.name}"? This cannot be undone.`)) {
      updateChar({ grimoires: (char.grimoires || []).filter(x => x.id !== grimoireId) });
    
    }
  };

  // Magic Inventory (scrolls, wands, rods, etc.)
  const magicItems = char?.magicItems || [];

  const syncMagicItemForInventoryItem = (invItem, currentMagicItems) => {
    const list = Array.isArray(currentMagicItems) ? currentMagicItems.slice() : [];
    const linkedId = `linked-${String(invItem.id)}`;
    const isLinked = !!invItem?.isMagicCasting && !invItem?.isGrimoire;
    const idx = list.findIndex(mi => String(mi.id) === linkedId || String(mi.linkedInventoryItemId) === String(invItem.id));
    if (!isLinked) {
      if (idx !== -1) list.splice(idx, 1);
      return list;
    }
    const next = {
      id: linkedId,
      linkedInventoryItemId: invItem.id,
      name: invItem.name || 'Magic Item',
      description: String(invItem.magicCastingDescription || ''),
      capacity: Number(invItem.magicCastingCapacity) || 0,
      spells: (idx !== -1 && Array.isArray(list[idx].spells)) ? list[idx].spells : []
    };
    if (idx === -1) return [...list, next];
    list[idx] = { ...list[idx], ...next };
    return list;
  };

  const addMagicItem = () => {
    setEditModal({ type: 'newMagicItem' });
  };

  const deleteMagicItem = (itemId) => {
    setEditModal({ type: 'confirmDeleteMagicItem', itemId });
  };

  const addSpellEntriesToMagicItem = (itemId, spell, copies = 1, permanent = false) => {
    const item = magicItems.find((i) => i.id === itemId);
    if (!item || !spell) return;

    const remaining = Math.max(0, (item.capacity || 0) - (item.spells || []).length);
    const addCount = Math.max(0, Math.min(remaining, copies || 1));

    if (addCount <= 0) {
      window.alert("No room left in this item.");
      return;
    }

    const newEntries = Array.from({ length: addCount }).map(() => ({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      spell: { ...spell },
      permanent: !!permanent,
      usedToday: false,
    }));

    const updated = magicItems.map((i) =>
      i.id === itemId ? { ...i, spells: [...(i.spells || []), ...newEntries] } : i
    );
    updateChar({ magicItems: updated });
  };

  const updateMagicItemSpells = (itemId, updater) => {
    if (!char) return;
    const updated = (char.magicItems || []).map((it) => {
      if (it.id !== itemId) return it;
      const nextSpells = updater(Array.isArray(it.spells) ? it.spells.slice() : []);
      return { ...it, spells: nextSpells };
    });
    updateChar({ magicItems: updated });
  };

  const openEditMagicItemSpell = (itemId, spellName, permanent) => {
    const item = (char?.magicItems || []).find((x) => x.id === itemId);
    if (!item) return;

    const entries = (item.spells || []).filter(
      (e) => e?.spell?.name === spellName && !!e.permanent === !!permanent
    );
    const copies = Math.max(1, entries.length || 1);

    const learnedSpell =
      (char?.spellsLearned || []).find((s) => s?.id && entries?.[0]?.spell?.id && s.id === entries[0].spell.id) ||
      (char?.spellsLearned || []).find((s) => String(s?.name || '').toLowerCase() === String(spellName || '').toLowerCase()) ||
      entries?.[0]?.spell ||
      null;

    setEditModal({
      type: 'editMagicItemSpell',
      itemId,
      spellName,
      permanent: !!permanent,
      originalPermanent: !!permanent,
      copies,
      selectedSpellName: learnedSpell?.name || spellName,
      spell: learnedSpell,
    });
  };

  const castFromMagicItem = (itemId, spellName, permanent) => {
    const item = magicItems.find((i) => i.id === itemId);
    if (!item) return;

    const entries = (item.spells || []).map((e) => e);
    const idx = permanent
      ? entries.findIndex((e) => e?.spell?.name === spellName && !!e.permanent && !e.usedToday)
      : entries.findIndex((e) => e?.spell?.name === spellName && !e.permanent);

    if (idx === -1) return;

    if (permanent) {
      entries[idx] = { ...entries[idx], usedToday: true };
    } else {
      entries.splice(idx, 1);
    }

    const updated = magicItems.map((i) => (i.id === itemId ? { ...i, spells: entries } : i));
    updateChar({ magicItems: updated });
  };
  const setMagicItemSpellNumDice = (itemId, spellName, permanent, numDice) => {
    const n = Math.max(1, Math.min(99, Number(numDice) || 1));
    updateChar({
      magicItems: (char.magicItems || []).map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          spells: (it.spells || []).map((e) => {
            if (!e?.spell) return e;
            if (e.spell.name !== spellName) return e;
            if (!!e.permanent !== !!permanent) return e;
            return { ...e, numDice: n };
          }),
        };
      }),
    });
  };

  const buildSpellPropagationUpdates = (updatedSpell) => {
    if (!char || !updatedSpell) return {};

    const sameSpell = (s) =>
      (s?.id && updatedSpell?.id && s.id === updatedSpell.id) ||
      String(s?.name || '').toLowerCase() === String(updatedSpell?.name || '').toLowerCase();

    const updatedPrepared = (char.spellsPrepared || []).map((p) => {
      if (!p?.spell) return p;
      if (!sameSpell(p.spell)) return p;
      return { ...p, spell: { ...p.spell, ...updatedSpell } };
    });

    const updatedGrimoires = (char.grimoires || []).map((g) => ({
      ...g,
      entries: (g.entries || []).map((e) => {
        if (!e?.spell) return e;
        if (!sameSpell(e.spell)) return e;
        return { ...e, spell: { ...e.spell, ...updatedSpell } };
      }),
    }));

    const updatedMagicItems = (char.magicItems || []).map((it) => ({
      ...it,
      spells: (it.spells || []).map((e) => {
        if (!e?.spell) return e;
        if (!sameSpell(e.spell)) return e;
        return { ...e, spell: { ...e.spell, ...updatedSpell } };
      }),
    }));

    return {
      spellsPrepared: updatedPrepared,
      grimoires: updatedGrimoires,
      magicItems: updatedMagicItems,
    };
  };

  const resetMagicItemForNewDay = (itemId) => {
    const item = magicItems.find((i) => i.id === itemId);
    if (!item) return;

    const entries = (item.spells || []).map((e) => (e.permanent ? { ...e, usedToday: false } : e));
    const updated = magicItems.map((i) => (i.id === itemId ? { ...i, spells: entries } : i));
    updateChar({ magicItems: updated });
  };

  const updateChar = (updates) => {
    const newChars = [...characters];
    newChars[currentCharIndex] = { ...char, ...updates };

  const toggleEquippedEffectItem = (section, id) => {
    if (!char) return;
    const sid = String(id);
    const cur = ensureEquippedEffectShape(char);
    const next = cur[section].includes(sid) ? cur[section].filter(x => x !== sid) : [...cur[section], sid];
    updateChar({ equippedEffectItemIds: { ...cur, [section]: next } });
  };

    setCharacters(newChars);
  };

  // --------------------
  // Notes tab helpers
  // --------------------
  const getNotes = () => (Array.isArray(char?.notes) ? char.notes : []);

  const openNewNote = () => {
    setNoteEditor({ open: true, noteId: null, title: '', description: '' });
  };

  const openEditNote = (note) => {
    setNoteEditor({
      open: true,
      noteId: note?.id ?? null,
      title: String(note?.title || ''),
      description: String(note?.description || '')
    });
  };

  const cancelNoteEdit = () => {
    setNoteEditor({ open: false, noteId: null, title: '', description: '' });
  };

  const saveNote = () => {
    if (!char) return;
    const title = String(noteEditor.title || '').trim();
    const description = String(noteEditor.description || '').trim();
    if (!title && !description) return;

    const now = Date.now();
    const existing = getNotes();

    // Edit existing
    if (noteEditor.noteId != null) {
      const updated = existing.map((n) =>
        n.id === noteEditor.noteId ? { ...n, title, description, updatedAt: now } : n
      );
      updateChar({ notes: updated });
      cancelNoteEdit();
      return;
    }

    // Add new
    const newNote = {
      id: now,
      title,
      description,
      createdAt: now,
      updatedAt: now
    };
    updateChar({ notes: [newNote, ...existing] });
    cancelNoteEdit();
  };

  const deleteNote = (noteId) => {
    if (!char) return;
    const existing = getNotes();
    updateChar({ notes: existing.filter((n) => n.id !== noteId) });
    if (noteEditor.open && noteEditor.noteId === noteId) cancelNoteEdit();
  };

  const deleteCharacter = (index) => {
    setCharacters((prev) => prev.filter((_, i) => i !== index));

    setCurrentCharIndex((cur) => {
      if (cur === null) return null;
      if (cur === index) return null;
      if (cur > index) return cur - 1;
      return cur;
    });
  };

  // Use memoized level info
  const getTotalLevel = () => {
    if (!char) return 1;
    if (Array.isArray(char.xpTable) && typeof char.currentXp === 'number') {
      return memoizedLevelInfo.currentLevel;
    }
    return (Number(char.class1Level) || 0) + (Number(char.class2Level) || 0) || 1;
  };

  // Use memoized max HP
  const calculateMaxHP = () => memoizedMaxHP;

  // Use memoized AC
  const calculateAC = () => memoizedAC;

  // Use memoized level info
  const calculateNextLevel = () => memoizedLevelInfo;

  // XP-derived level helper (used on the character list screen so it always matches XP).
  // If xpTable/currentXp isn't present (older saves), fall back to stored class1Level.
  const getXpDerivedLevel = (ch) => {
    try {
      const table = Array.isArray(ch?.xpTable) ? ch.xpTable : null;
      const xp = Number(ch?.currentXp ?? ch?.xp ?? 0) || 0;
      if (!table || table.length === 0) return Number(ch?.class1Level) || 1;
      let lvl = 1;
      for (let i = table.length - 1; i >= 0; i--) {
        if (xp >= Number(table[i] || 0)) {
          lvl = i + 1;
          break;
        }
      }
      return lvl;
    } catch {
      return Number(ch?.class1Level) || 1;
    }
  };

  if (currentCharIndex === null) {
    // Show loading screen
    if (isLoading) {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl font-bold mb-4">Castles & Crusades</div>
            <div className="text-gray-400">Loading...</div>
          </div>
        </div>
      );
    }
    
    return (<>
      <div className="min-h-screen bg-gray-900 text-white p-4 overflow-x-hidden">
        <div className="max-w-2xl mx-auto bg-gray-800 rounded-lg p-8">
          <h1 className="text-4xl font-bold mb-4 text-center">Castles & Crusades</h1>
          
          {/* Save Status Indicator */}
          <div className="text-center mb-4 h-6">
            {saveStatus === 'saving' && <span className="text-yellow-400 text-sm">Saving...</span>}
            {saveStatus === 'saved' && <span className="text-green-400 text-sm">✓ Saved</span>}
            {saveStatus === 'error' && <span className="text-red-400 text-sm">⚠ Save failed</span>}
            {importError && <span className="text-red-400 text-sm">{importError}</span>}
          </div>

          {/* Export/Import Buttons */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={handleExport}
              disabled={characters.length === 0}
              className="flex-1 py-3 bg-blue-600 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Download size={20} />
              Export Backup
            </button>
            <button
              onClick={handleImportClick}
              className="flex-1 py-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 flex items-center justify-center gap-2"
            >
              <Upload size={20} />
              Import Backup
            </button>
          </div>

          <button
            onClick={() => {
              setCharacters([...characters, createNewCharacter()]);
              setCurrentCharIndex(characters.length);
            }}
            className="w-full py-4 bg-green-600 rounded-lg text-xl font-bold mb-6 hover:bg-green-700"
          >
            + Create New Character
          </button>
          <h2 className="text-2xl font-bold mb-4">Your Characters</h2>
          {characters.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p>No characters yet.</p>
              <p className="text-sm mt-2">Create a new character or import a backup file.</p>
            </div>
          )}
          {characters.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setCurrentCharIndex(i)}
                className="flex-1 p-4 bg-gray-700 rounded-lg text-left hover:bg-gray-600"
              >
                <div className="text-xl font-bold">{c.name}</div>
                <div className="text-gray-400">
                  {c.race} {c.class1} {getXpDerivedLevel(c)}{c.class2 && ` / ${c.class2} ${c.class2Level}`}
                </div>
              </button>
              <button 
                onClick={() => setEditModal({ type: 'confirmDeleteCharacter', index: i })} 
                className="p-4 bg-red-600 rounded-lg hover:bg-red-700"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {editModal?.type === 'confirmDeleteCharacter' && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Delete Character</h2>
              <button
                onClick={closeModal}
                className="p-2 bg-gray-700 rounded hover:bg-gray-600"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-200">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {characters?.[editModal.index]?.name || "this character"}
              </span>
              ? This cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-base bg-gray-700 rounded hover:bg-gray-600"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  const idx = editModal.index;
                  deleteCharacter(idx);
                  setEditModal(null);
                }}
                className="px-4 py-2 text-base bg-red-600 rounded hover:bg-red-700 font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>);
  }

  const { nextLevelXp, progress, canLevelUp, currentLevel } = calculateNextLevel();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 overflow-x-hidden">

      {/* Header with Save Status */}
      <div className="max-w-4xl mx-auto mb-2 flex items-center justify-end">
        <div className="text-sm">
          {saveStatus === 'saving' && <span className="text-yellow-400">Saving...</span>}
          {saveStatus === 'saved' && <span className="text-green-400">✓ Saved</span>}
          {saveStatus === 'error' && <span className="text-red-400">⚠ Save failed</span>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto mb-4">
        <div className="flex gap-2 overflow-x-auto bg-gray-800 rounded-lg p-2">
          {[
            { id: 'main', label: 'Main' },
            { id: 'attack', label: 'Attack' },
            { id: 'saves', label: 'Checks/Saves' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'magic', label: 'Magic' },
            { id: 'dice', label: 'Dice' },
            { id: 'companion', label: 'Companion' },
            { id: 'notes', label: 'Notes' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded whitespace-nowrap ${activeTab === id ? 'bg-blue-600' : 'bg-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg p-4 sm:p-6 overflow-hidden">
        {activeTab === 'main' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{char.name}</h1>
              <button onClick={openNameModal} className="p-2 bg-gray-700 rounded hover:bg-gray-600">
                <Edit2 size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400">Race</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{char.race || "Not set"}</span>
                  <button onClick={openRaceModal} className="p-2 bg-gray-700 rounded hover:bg-gray-600">
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400">Class & Level</label>
                <div className="flex items-center gap-2">
                  <div className="text-lg">
                    {char.class1} {currentLevel}
                    {char.class2 && <div>{char.class2} {char.class2Level}</div>}
                    {canLevelUp && <span className="text-green-400 ml-2">⬆ LEVEL UP!</span>}
                  </div>
                  <button onClick={openClassModal} className="p-2 bg-gray-700 rounded hover:bg-gray-600">
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400">Speed</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getSpeedTotal()} ft</span>
                  <button onClick={openSpeedModal} className="p-2 bg-gray-700 rounded hover:bg-gray-600">
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400">HP</label>
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => updateChar({ hp: Math.max(0, char.hp - 1) })} className="p-1 bg-red-600 rounded hover:bg-red-700">
                    <Minus size={16} />
                  </button>
                  <span className="text-xl font-bold">{char.hp} / {calculateMaxHP()}</span>
                  <button onClick={() => updateChar({ hp: Math.min(calculateMaxHP(), char.hp + 1) })} className="p-1 bg-green-600 rounded hover:bg-green-700">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex gap-1">
                  <button onClick={openHpModal} className="flex-1 px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500">
                    Edit HP
                  </button>
                  <button onClick={() => {
                      const levels = (char.hpByLevel && char.hpByLevel.length) ? char.hpByLevel : [0, 0, 0];
                      const padded = levels.slice();
                      while (padded.length < 3) padded.push(0);
                      setHpDraftLevels(padded);
                      const conMod = calcMod(getAttributeTotal('con'));
                      const rolls = padded.map((v) => {
                        const total = Number(v) || 0;
                        if (total <= 0) return '';
                        const raw = total - conMod;
                        return String(raw);
                      });
                      setHpDraftRolls(rolls);

                      let lastFilled = -1;
                      for (let i = 0; i < rolls.length; i++) { if ((parseInt(rolls[i] || '0', 10) || 0) > 0) lastFilled = i; }
                      const effectiveLen = Math.max(3, lastFilled + 1);
                      setHpLevelsShown(effectiveLen);
                      setHpDieDraft(char.hpDie || 12);
                      setEditModal({ type: 'hpTracking' });
                    }} className="flex-1 px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500">
                    HP Tracking
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400">AC</label>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl font-bold">{calculateAC()}</span>
                </div>
                <button onClick={openAcTrackingModal} className="w-full px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500">
                  AC Tracking
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">Experience</label>
                <div className="flex gap-2">
                  <button onClick={openXpTableModal} className="px-4 py-2 bg-gray-600 rounded text-base hover:bg-gray-500">
                    Level XP
                  </button>
                  <button onClick={openAddXpModal} className="px-4 py-2 text-base bg-blue-600 rounded text-sm hover:bg-blue-700">
                    Add XP
                  </button>
                </div>
              </div>
              <div className="text-lg">{char.currentXp} / {nextLevelXp} XP (Level {currentLevel})</div>
              <div className="w-full bg-gray-700 rounded-full h-4 mt-2">
                <div className="bg-blue-600 h-4 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-2">Attributes</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(char.attributes).map(([key, attr]) => {
                  const rolled = getAttributeRolled(key);
                  const raceMod = getRaceAttributeBonus(key);
                  const bonusMod = getAttributeBonusMod(key);
                  const itemMod = getItemAttributeBonus(key);
                  const totalScore = rolled + raceMod + bonusMod + itemMod;
                  const mod = calcMod(totalScore);
                  return (
                    <div key={key} className="bg-gray-700 p-3 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`font-bold uppercase text-lg px-2 py-1 rounded ${
                            char.attributes?.[key]?.isPrime
                              ? 'bg-white text-black'
                              : ''
                          }`}
                        >
                          {key}
                        </span>
                        <button
                          onClick={() => setEditModal({ type: 'attribute', attr: key })}
                          className="p-3 bg-gray-700 rounded hover:bg-gray-600"
                          aria-label={`Edit ${key}`}
                        >
                          <Edit2 size={18} />
                        </button>
                      </div>

                      <div className="text-center">
                        <div className="text-4xl font-bold leading-none">{totalScore}</div>
                        <div className="text-base text-gray-300 mt-2">
                          Mod: {mod >= 0 ? '+' : ''}{mod}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

{/* Class Abilities */}
<div>
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-xl font-bold">Class Abilities</h3>
    <button
      onClick={() => setEditModal({ type: 'classAbilities' })}
      className="px-4 py-2 bg-gray-600 rounded text-base hover:bg-gray-500"
    >
      {((char.classAbilities || []).length ? 'Edit' : 'Add')}
    </button>
  </div>
  {(char.classAbilities || []).length === 0 ? (
    <div className="text-sm text-gray-400">No class abilities added.</div>
  ) : (
    <div className="space-y-2">
      {(char.classAbilities || []).map((a, i) => (
        <div key={i} className="bg-gray-700 p-2 rounded">
          {a}
        </div>
      ))}
    </div>
  )}
</div>

{/* Race Abilities */}
<div>
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-xl font-bold">Race Abilities</h3>
    <button
      onClick={() => setEditModal({ type: 'raceAbilities' })}
      className="px-4 py-2 bg-gray-600 rounded text-base hover:bg-gray-500"
    >
      {((char.raceAbilities || []).length ? 'Edit' : 'Add')}
    </button>
  </div>
  {(char.raceAttributeMods || []).length > 0 && (() => {
    const mods = char.raceAttributeMods || [];
    const attrMods = mods.filter(m => String(m.attr).toLowerCase() !== 'ac');
    const acMods = mods.filter(m => String(m.attr).toLowerCase() === 'ac');

    return (
      <div className="space-y-2 mb-3 text-sm">
        {attrMods.length > 0 && (
          <div className="bg-gray-700 p-2 rounded">
            <span className="font-semibold">Attributes:</span>{" "}
            {attrMods.map((m, i) => (
              <span key={i}>
                {String(m.attr).toUpperCase()} {Number(m.value) >= 0 ? "+" : ""}{Number(m.value) || 0}
                {i < attrMods.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        )}

        {acMods.map((m, i) => (
          <div key={`ac-${i}`} className="bg-gray-700 p-2 rounded">
            <span className="font-semibold">AC:</span>{" "}
            {Number(m.value) >= 0 ? "+" : ""}{Number(m.value) || 0}
            {m.description ? (
              <span className="text-gray-300"> – {m.description}</span>
            ) : null}
          </div>
        ))}
      </div>
    );
  })()}
  {(char.raceAbilities || []).length === 0 ? (
    <div className="text-sm text-gray-400">No race abilities added.</div>
  ) : (
    <div className="space-y-2">
      {(char.raceAbilities || []).map((a, i) => (
        <div key={i} className="bg-gray-700 p-2 rounded">
          {a}
        </div>
      ))}
    </div>
  )}

</div>

{/* Advantages */}
<div className="mt-6">
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-xl font-bold">Advantages</h3>
    <button
      onClick={() => setEditModal({ type: 'advantages' })}
      className="px-4 py-2 bg-gray-600 rounded text-base hover:bg-gray-500"
    >
      {((char.advantages || []).length ? 'Edit' : 'Add')}
    </button>
  </div>
  {(char.advantages || []).length === 0 ? (
    <div className="text-sm text-gray-400">No advantages added.</div>
  ) : (
    <div className="space-y-2">
      {(char.advantages || []).map((a, i) => (
        <div key={i} className="bg-gray-700 p-2 rounded">
          {a}
        </div>
      ))}
    </div>
  )}
</div>

{/* Alignment / Languages / Deity */}
<div className="mt-6 space-y-4">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm text-gray-400 mb-1">Alignment</label>
      <DebouncedInput
        type="text"
        value={char.alignment || ''}
        onChange={(value) => updateChar({ alignment: value })}
        className="w-full p-2 bg-gray-700 rounded text-white"
        placeholder="e.g., Lawful Good"
      />
    </div>

    <div>
      <label className="block text-sm text-gray-400 mb-1">Languages</label>
      <DebouncedInput
        type="text"
        value={char.languages || ''}
        onChange={(value) => updateChar({ languages: value })}
        className="w-full p-2 bg-gray-700 rounded text-white"
        placeholder="e.g., Common, Elvish"
      />
    </div>

    <div>
      <label className="block text-sm text-gray-400 mb-1">Deity</label>
      <DebouncedInput
        type="text"
        value={char.deity || ''}
        onChange={(value) => updateChar({ deity: value })}
        className="w-full p-2 bg-gray-700 rounded text-white"
        placeholder="e.g., Odin"
      />
    </div>

    <div>
      <label className="block text-sm text-gray-400 mb-1">Holy Symbol</label>
      <DebouncedInput
        type="text"
        value={char.holySymbol || ''}
        onChange={(value) => updateChar({ holySymbol: value })}
        className="w-full p-2 bg-gray-700 rounded text-white"
        placeholder="e.g., Silver hammer"
      />
    </div>
  </div>
</div>

          </div>
        )}

        {activeTab === 'attack' && (
          <div className="space-y-4">
            
<div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Attacks</h2>
                <button onClick={() => setAddAttackModalOpen(true)} className="px-4 py-2 text-base bg-green-600 rounded hover:bg-green-700 whitespace-nowrap">
                  + New Attack
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setEditModal({ type: 'attackInfo' })}
                  className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm"
                >
                  Info
                </button>
                <button onClick={() => setEditModal({ type: 'bthBase' })} className="px-3 py-2 bg-purple-600 rounded hover:bg-purple-700 text-sm">
                  BTH
                </button>
                <button onClick={openBonusModifiersModal} className="px-3 py-2 bg-purple-600 rounded hover:bg-purple-700 text-sm">
                  Bonus Modifiers
                </button>
              </div>
            </div>

            {(char.attackBonus !== 0 || char.damageBonus !== 0) && (
              <div className="bg-purple-900 p-3 rounded text-sm">
                <div className="font-bold mb-1">Active Bonuses:</div>
                {char.attackBonus !== 0 && <div>Attack: {char.attackBonus >= 0 ? '+' : ''}{char.attackBonus}</div>}
                {char.damageBonus !== 0 && <div>Damage: {char.damageBonus >= 0 ? '+' : ''}{char.damageBonus}</div>}
              </div>
            )}

            {char.attacks.length === 0 && (
              <div className="text-center text-gray-400 py-8">No attacks added yet</div>
            )}

            {char.attacks.length > 0 && (
              <div 
                className="space-y-4 overflow-y-auto pr-2" 
                style={{ maxHeight: 'calc(100vh - 250px)' }}
              >
                {sortedAttacks.map(attack => {
              const weaponItem = (char.inventory || []).find((it) => String(it.id) === String(attack.weaponId || ''));

              const modeResolved = (attack.weaponMode || attack.weaponType || weaponItem?.weaponType || 'melee');
              const isRanged = modeResolved === 'ranged';

              // If autoMods is enabled (default for weapon-bound attacks and any attack with an explicit weaponMode),
              // ability modifiers are computed live from current STR/DEX so they stay up to date when stats change.
              const autoMods =
                (attack.autoMods ?? null) !== null
                  ? !!attack.autoMods
                  : (!!attack.weaponId || attack.weaponMode === 'melee' || attack.weaponMode === 'ranged' || String(attack.name || '').toLowerCase().includes('unarmed'));

              const strModNow = calcMod(getAttributeTotal('str'));
              const dexModNow = calcMod(getAttributeTotal('dex'));
              const abilityToHitMod = isRanged ? dexModNow : strModNow;

              // When autoMods is on, treat attack.attrMod as an *extra* modifier (not the base ability mod).
              const attrKeyUsed =
                attack.weaponMode === "melee"
                  ? "str"
                  : attack.weaponMode === "ranged"
                  ? "dex"
                  : null;

              const computedAttrMod = autoMods
                ? abilityToHitMod + (attack.attrMod || 0)
                : (attack.attrMod || 0);

              const weaponToHitMagic = weaponItem ? Number(weaponItem.weaponToHitMagic || 0) : 0;
              const weaponToHitMisc = weaponItem ? Number(weaponItem.weaponToHitMisc || 0) : 0;
              const weaponDmgMagic = weaponItem ? Number(weaponItem.weaponDamageMagic || 0) : 0;
              const weaponDmgMisc = weaponItem ? Number(weaponItem.weaponDamageMisc || 0) : 0;

              const attackBthBonus = (attack.bthBonus ?? attack.bth ?? 0);
              const eff = sumEffectBonusesForAttack(char, attack);
              const toHit = (char.baseBth || 0)
                + attackBthBonus
                + computedAttrMod
                + (attack.magic || 0)
                + (attack.misc || 0)
                + weaponToHitMagic
                + weaponToHitMisc
                + (char.attackBonus || 0)
                + (eff.miscToHit || 0) + (eff.magicToHit || 0);

              // Damage: melee attacks get live STR-to-damage when autoMods is on.
              // Ranged damage can vary (thrown vs. not), so we leave it to the per-attack fields for now.
              const abilityDamageMod = (!isRanged && autoMods) ? strModNow : 0;
              const dmgBonus =
                abilityDamageMod
                + (attack.damageMod || 0)
                + (attack.damageMagic || 0)
                + (attack.damageMisc || 0)
                + weaponDmgMagic
                + weaponDmgMisc
                + (char.damageBonus || 0)
                + (eff.miscDamage || 0)
                + (eff.magicDamage || 0);

              return (
                <div key={attack.id} className="bg-gray-700 p-4 rounded">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold">{attack.weaponId ? getBoundAttackName(attack, char.inventory) : attack.name}</h3>
                    <button
                      onClick={() => {
                        const updated = (char.attacks || []).map(a =>
                          a.id === attack.id ? { ...a, isFavorite: !a.isFavorite } : a
                        );
                        updateChar({ attacks: updated });
                      }}
                      className={`p-2 rounded ${attack.isFavorite ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-600 hover:bg-gray-500'}`}
                      title={attack.isFavorite ? 'Unfavorite' : 'Favorite'}
                    >
                      ★
                    </button>
                    <button onClick={() => setEditModal({ type: 'editAttack', attack })} className="p-2 bg-gray-600 rounded hover:bg-gray-500">
                      <Edit2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                    <div className="bg-gray-800 p-3 rounded">
                      <div className="font-bold text-blue-400 mb-2">TO HIT</div>
                      <div className="text-sm space-y-1 mb-2">                        <div>BTH (Base): {char.baseBth >= 0 ? '+' : ''}{char.baseBth || 0}</div>
                        <div>Mod: {computedAttrMod >= 0 ? '+' : ''}{computedAttrMod}{attrKeyUsed ? ` (${attrKeyUsed.toUpperCase()})` : ''}</div>
                        <div>Misc: +{(attack.misc || 0) + weaponToHitMisc + (eff.miscToHit || 0)}</div>
                        <div>Magic: +{(attack.magic || 0) + weaponToHitMagic + (eff.magicToHit || 0)}</div>
                        <div>Bonus Mod: {attackBthBonus >= 0 ? '+' : ''}{attackBthBonus}</div>
                        {char.attackBonus !== 0 && <div className="text-purple-400">Bonus: {char.attackBonus >= 0 ? '+' : ''}{char.attackBonus}</div>}
                        <div className="font-bold text-lg border-t border-gray-600 pt-1 mt-1">
                          Total: +{toHit}
                        </div>
                        {eff.appliedItemNames && eff.appliedItemNames.length > 0 && (
                          <div className="text-xs text-gray-300 mt-1">
                            Applied: {eff.appliedItemNames.join(', ')}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setRollModal({ type: 'attack', attack, toHit });
                          setRollResult(null);
                        }}
                        className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                      >
                        Roll Attack
                      </button>
                      {rollModal?.attack?.id === attack.id && rollModal.type === 'attack' && (
                        <div className="mt-2 p-2 bg-gray-600 rounded">
                          <button
                            onClick={() => {
                              const roll = rollDice(20);
                              setRollResult({ roll, total: roll + toHit });
                            }}
                            className="w-full py-1 bg-green-600 rounded text-sm mb-1"
                          >
                            Roll d20
                          </button>
                          <input
                            type="number"
                            placeholder="Or enter roll (1-20)"
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (val >= 1 && val <= 20) {
                                setRollResult({ roll: val, total: val + toHit });
                              }
                            }}
                            className="w-full p-1 bg-gray-800 rounded text-white text-sm"
                          />
                          {rollResult && (
                            <div className="mt-2 text-center text-sm">
                              <div>d20: {rollResult.roll} + {toHit}</div>
                              <div className="text-xl font-bold text-green-400">Total: {rollResult.total}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-800 p-3 rounded">
                      <div className="font-bold text-red-400 mb-2">DAMAGE</div>
                      <div className="text-sm space-y-1 mb-2">
                        <div>Dice: {attack.numDice}d{attack.dieType}</div>
                        <div>Mod: {((abilityDamageMod + (attack.damageMod || 0)) >= 0 ? "+" : "")}{abilityDamageMod + (attack.damageMod || 0)}{(!isRanged && autoMods) ? " (STR)" : ""}</div>
                        <div>Magic: +{(attack.damageMagic || 0) + weaponDmgMagic + (eff.magicDamage || 0)}</div>
                        <div>Misc: +{(attack.damageMisc || 0) + weaponDmgMisc + (eff.miscDamage || 0)}</div>
                        {char.damageBonus !== 0 && <div className="text-purple-400">Bonus: {char.damageBonus >= 0 ? '+' : ''}{char.damageBonus}</div>}
                        <div className="font-bold text-lg border-t border-gray-600 pt-1 mt-1">
                          Bonus: +{dmgBonus}
                        </div>
                      </div>
                      {(attack.useDamageDice ?? (Number(attack.numDice || 0) > 0)) && (Number(attack.numDice || 0) > 0) && (
                        <button
                          onClick={() => {
                            setRollModal({ type: 'damage', attack, dmgBonus, diceCount: attack.numDice });
                            setRollResult(null);
                          }}
                          className="w-full py-2 bg-red-600 rounded hover:bg-red-700"
                        >
                          Roll Damage
                        </button>
                      )}
                      {rollModal?.attack?.id === attack.id && rollModal.type === 'damage' && (
                        <div className="mt-2 p-2 bg-gray-600 rounded">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <label className="text-xs text-gray-300 whitespace-nowrap">Dice #</label>
                          <input
                            type="number"
                            value={rollModal.diceCount ?? attack.numDice}
                            onChange={(e) => {
                              const v = e.target.value === '' ? '' : (parseInt(e.target.value || '0', 10) || 0);
                              setRollModal({ ...rollModal, diceCount: typeof v === 'number' ? Math.max(0, v) : v });
                            }}
                            className="w-14 p-1 bg-gray-800 rounded text-white text-xs text-center"
                          />
                          <div className="text-xs text-gray-400">d{attack.dieType}</div>
                        </div>

                          <button
                            onClick={() => {
                              const rolls = [];
                              for (let i = 0; i < (rollModal.diceCount ?? attack.numDice); i++) {
                                rolls.push(rollDice(attack.dieType));
                              }
                              const diceTotal = rolls.reduce((a, b) => a + b, 0);
                              setRollResult({ rolls, diceTotal, total: diceTotal + dmgBonus });
                            }}
                            className="w-full py-1 bg-green-600 rounded text-sm mb-1"
                          >
                            Roll {rollModal.diceCount ?? attack.numDice}d{attack.dieType}
                          </button>
                          <div className="text-xs text-gray-300 mb-1">Or enter each die:</div>
                          <div className="grid grid-cols-4 gap-1 mb-1">
                            {Array.from({ length: (rollModal.diceCount ?? attack.numDice) }).map((_, i) => (
                              <input
                                key={i}
                                type="number"
                                placeholder={`d${attack.dieType}`}
                                className="p-1 bg-gray-800 rounded text-white text-xs text-center"
                                id={`dmg-${attack.id}-${i}`}
                              />
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              const rolls = Array.from({ length: (rollModal.diceCount ?? attack.numDice) }).map((_, i) => {
                                const val = parseInt(document.getElementById(`dmg-${attack.id}-${i}`).value);
                                return val || 0;
                              });
                              if (rolls.every(r => r > 0)) {
                                const diceTotal = rolls.reduce((a, b) => a + b, 0);
                                setRollResult({ rolls, diceTotal, total: diceTotal + dmgBonus });
                              }
                            }}
                            className="w-full py-1 bg-blue-600 rounded text-xs"
                          >
                            Calculate
                          </button>
                          {rollResult?.rolls && (
                            <div className="mt-2 text-center text-sm">
                              <div>Dice: {rollResult.rolls.join(' + ')} = {rollResult.diceTotal}</div>
                              <div>Bonus: +{dmgBonus}</div>
                              <div className="text-xl font-bold text-red-400">Total: {rollResult.total}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'saves' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Checks and Saving Throws</h2>

            <div className="space-y-3">

              {Object.entries(char.attributes).map(([key, attr]) => {
                const attrTotal = getAttributeTotal(key);
                const mod = calcMod(attrTotal);
                const level = getTotalLevel();
                const prime = attr.isPrime ? char.primeSaveBonus : 0;
                const saveModifier = char.attributes[key].saveModifier || 0;
                const encStatus = getEncumbranceStatus();
                const encDexPenalty = (key === 'dex' && encStatus === 'burdened') ? -2 : 0;
                const isDexOverburdened = (key === 'dex' && encStatus === 'overburdened');
                const total = level + mod + prime + saveModifier + encDexPenalty;
                
                return (
                  <div key={key} className="bg-gray-700 p-4 rounded">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="font-bold uppercase text-2xl">{key}</div>
                          <button onClick={() => setEditModal({ type: 'saveModifier', attr: key })} className="p-2 bg-gray-600 rounded hover:bg-gray-500">
                            <Edit2 size={16} />
                          </button>
                        </div>
                        <div className="text-base space-y-1">
                          <div>Level: +{level}</div>
                          <div>Mod: {mod >= 0 ? '+' : ''}{mod}</div>
                          <div>Prime: +{prime}</div>
                          {key === 'dex' && encStatus === 'burdened' && (
                            <div>Burdened: -2</div>
                          )}
                          {saveModifier !== 0 && <div className="text-purple-400">Modifier: {saveModifier >= 0 ? '+' : ''}{saveModifier}</div>}
                          <div className="font-bold text-xl border-t border-gray-600 pt-2 mt-2">
                            Save Bonus: {total >= 0 ? `+${total}` : String(total)}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1">
                        {isDexOverburdened ? (
                          <div className="w-full py-3 bg-gray-800 rounded text-lg font-bold mb-2 text-center text-gray-300 opacity-90">
                            Overburdened
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setRollModal({ type: 'save', attr: key, total });
                              setRollResult(null);
                            }}
                            className="w-full py-3 bg-green-600 rounded hover:bg-green-700 text-lg font-bold mb-2"
                          >
                            Roll Check/Save
                          </button>
                        )}
                        
                        {!isDexOverburdened && rollModal?.type === 'save' && rollModal.attr === key && (
                          <div className="p-3 bg-gray-600 rounded">
                            <button
                              onClick={() => {
                                const roll = rollDice(20);
                                setRollResult({ roll, total: roll + total });
                              }}
                              className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 text-base font-bold mb-2"
                            >
                              Roll d20
                            </button>
                            <input
                              type="number"
                              placeholder="Enter roll (1-20)"
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (val >= 1 && val <= 20) {
                                  setRollResult({ roll: val, total: val + total });
                                }
                              }}
                              className="w-full p-2 bg-gray-800 rounded text-white text-base mb-2"
                            />
                            {rollResult && (
                              <div className="text-center">
                                <div className="text-base mb-1">d20: {rollResult.roll} + {total}</div>
                                <div className="text-2xl font-bold text-green-400">Total: {rollResult.total}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'magic' && !spellsLearnedView && !grimoireView && !magicInventoryView && selectedMagicItemId === null && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Magic</h2>
  <div className="flex gap-2">
                <button
                  onClick={() => setEditModal({ type: 'magicInfo' })}
                  className="px-4 py-2 text-base bg-gray-600 rounded hover:bg-gray-500 font-semibold"
                  title="Magic Help"
                >
                  Info
                </button>
              <button
                onClick={() => { setSpellsLearnedView(false); setGrimoireView(false); setMagicInventoryView(true); setSelectedMagicItemId(null); }}
                className="px-4 py-2 text-base bg-gray-600 rounded hover:bg-gray-500 font-semibold"
              >
                Magic Inventory
              </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 bg-gray-700 p-4 rounded-lg">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Spell Save DC</label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{char.spellSaveDC}</span>
                  <button onClick={openSpellStatsModal} className="p-1 bg-gray-600 rounded hover:bg-gray-500">
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Spell Attack Bonus</label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">+{char.spellAttackBonus}</span>
                  <button onClick={openSpellStatsModal} className="p-1 bg-gray-600 rounded hover:bg-gray-500">
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold">Spell Slots per Level</h3>
                <button onClick={openSpellSlotsModal} className="px-4 py-2 text-base bg-blue-600 rounded hover:bg-blue-700 text-sm">
                  Edit Slots
                </button>
              </div>
              <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                {(char.spellSlots || [0,0,0,0,0,0,0,0,0,0]).map((slots, level) => (
                  <div key={level} className="bg-gray-800 p-2 rounded text-center">
                    <div className="text-xs text-gray-400">Lvl {level}</div>
                    <div className="text-lg font-bold">{slots}</div>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => setSpellsLearnedView(true)}
              className="w-full py-3 bg-purple-600 rounded-lg hover:bg-purple-700 text-xl font-bold"
            >
              View Spells Learned
            </button>

            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="text-xl font-bold mb-3">Spells Prepared</h3>

              {char.spellsPrepared.length === 0 && (
                <div className="text-center text-gray-400 py-4">No spells prepared</div>
              )}

              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                const spellsAtLevel = char.spellsPrepared.filter(s => s.level === level).slice().sort(sortSpellsLevelName);
                if (spellsAtLevel.length === 0) return null;
                
                // Group by spell ID to count duplicates
                const spellGroups = {};
                spellsAtLevel.forEach(spell => {
                  if (!spellGroups[spell.id]) {
                    spellGroups[spell.id] = { spell, count: 0, prepIds: [] };
                  }
                  spellGroups[spell.id].count++;
                  spellGroups[spell.id].prepIds.push(spell.prepId);
                });
                
                return (
                  <div key={level} className="mb-4">
                    <h4 className="font-bold text-lg mb-2 text-green-400">
                      Level {level} ({spellsAtLevel.length}/{char.spellSlots[level]})
                    </h4>
                    <div className="space-y-2">
                      {Object.values(spellGroups).map(({ spell, count, prepIds }) => (
                        <div key={spell.id} className="bg-gray-800 p-3 rounded">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="font-bold text-lg">
                                {spell.name} {count > 1 && <span className="text-blue-400">x{count}</span>}
                              </div>
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={spell.concentrating || false}
                                  onChange={() => {
                                    const newPrepared = char.spellsPrepared.map(s => ({
                                      ...s,
                                      concentrating: s.id === spell.id ? !s.concentrating : false
                                    }));
                                    updateChar({ spellsPrepared: newPrepared });
                                  }}
                                  className="w-4 h-4"
                                />
                                <span className="text-xs bg-purple-600 px-2 py-1 rounded">Concentrating</span>
                              </label>
                            </div>
                            <button
                              onClick={() => {
                                updateChar({ 
                                  spellsPrepared: char.spellsPrepared.filter(s => s.prepId !== prepIds[0])
                                });
                              }}
                              className="px-4 py-2 text-base bg-red-600 rounded hover:bg-red-700 font-bold"
                                >
                                  Cast
                            </button>
                          </div>
                          
                          <div className="text-sm text-gray-300 mb-2">{spell.description}</div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                            <div><span className="text-gray-400">Prep Time:</span> {spell.prepTime}</div>
                            <div><span className="text-gray-400">Range:</span> {spell.range}</div>
                            <div><span className="text-gray-400">Duration:</span> {spell.duration}</div>
                            <div><span className="text-gray-400">AoE:</span> {spell.aoe || 'None'}</div>
                            <div><span className="text-gray-400">Saving Throw:</span> {spell.savingThrow || 'None'}</div>
                          </div>
                          
                          <div className="text-sm mb-2">
                            <span className="text-gray-400">Components:</span> 
                            {spell.verbal && ' V'}
                            {spell.somatic && ' S'}
                            {spell.material && ` M (${spell.materialDesc})`}
                          </div>
                          
                          {spell.spellResistance && (
                            <div className="text-xs text-yellow-400 mb-2">Spell Resistance: Yes</div>
                          )}
                          
                          {spell.hasDiceRoll && (
                            <div className="bg-gray-700 p-3 rounded mt-2">
                              <div className="flex items-center gap-2 mb-2">
                                <label className="text-sm text-gray-400">Number of Dice:</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={char.spellsPrepared.find(s => s.prepId === prepIds[0])?.numDice || 1}
                                  onChange={(e) => {
                                    const newPrepared = char.spellsPrepared.map(s => 
                                      s.prepId === prepIds[0] ? { ...s, numDice: parseInt(e.target.value) || 1 } : s
                                    );
                                    updateChar({ spellsPrepared: newPrepared });
                                  }}
                                  className="w-20 p-1 bg-gray-800 rounded text-white text-center"
                                />
                                <span className="text-sm">{spell.diceType}</span>
                              </div>
                              
                              <button
                                onClick={() => {
                                  setRollModal({ type: 'spellDice', spell, prepId: prepIds[0] });
                                  setRollResult(null);
                                }}
                                className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 font-bold"
                              >
                                Roll Spell Dice
                              </button>
                              
                              {rollModal?.type === 'spellDice' && rollModal.prepId === prepIds[0] && (
                                <div className="mt-2 p-2 bg-gray-600 rounded">
                                  <button
                                    onClick={() => {
                                      const numDice = char.spellsPrepared.find(s => s.prepId === prepIds[0])?.numDice || 1;
                                      const diceValue = parseInt(spell.diceType.replace('d', ''));
                                      const rolls = [];
                                      for (let i = 0; i < numDice; i++) {
                                        rolls.push(rollDice(diceValue));
                                      }
                                      const total = rolls.reduce((a, b) => a + b, 0);
                                      setRollResult({ rolls, total });
                                    }}
                                    className="w-full py-1 bg-green-600 rounded text-sm mb-1"
                                  >
                                    Roll {char.spellsPrepared.find(s => s.prepId === prepIds[0])?.numDice || 1}{spell.diceType}
                                  </button>
                                  <div className="text-xs text-gray-300 mb-1">Or enter each die:</div>
                                  <div className="grid grid-cols-4 gap-1 mb-1">
                                    {Array.from({ length: char.spellsPrepared.find(s => s.prepId === prepIds[0])?.numDice || 1 }).map((_, i) => (
                                      <input
                                        key={i}
                                        type="number"
                                        placeholder={spell.diceType}
                                        className="p-1 bg-gray-800 rounded text-white text-xs text-center"
                                        id={`spell-dice-${prepIds[0]}-${i}`}
                                      />
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => {
                                      const numDice = char.spellsPrepared.find(s => s.prepId === prepIds[0])?.numDice || 1;
                                      const rolls = Array.from({ length: numDice }).map((_, i) => {
                                        const val = parseInt(document.getElementById(`spell-dice-${prepIds[0]}-${i}`).value);
                                        return val || 0;
                                      });
                                      if (rolls.every(r => r > 0)) {
                                        const total = rolls.reduce((a, b) => a + b, 0);
                                        setRollResult({ rolls, total });
                                      }
                                    }}
                                    className="w-full py-1 bg-blue-600 rounded text-xs mb-1"
                                  >
                                    Calculate
                                  </button>
                                  {rollResult?.rolls && (
                                    <div className="mt-1 text-center text-sm">
                                      <div>Dice: {rollResult.rolls.join(' + ')} = {rollResult.total}</div>
                                      <div className="text-xl font-bold text-green-400">Total: {rollResult.total}</div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={() => setGrimoireView(true)}
                className="w-full px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700 font-semibold"
              >
                Grimoires
              </button>
            </div>
          </div>
        )}

        
        {activeTab === 'magic' && grimoireView && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Grimoires</h2>
              <div className="flex gap-2">
                <button onClick={() => setGrimoireView(false)} className="px-4 py-2 bg-gray-600 rounded text-base hover:bg-gray-500">
                  ← Back to Magic
                </button>
                <button
                  onClick={resetPermanentSpellsForNewDay}
                  disabled={!hasAnyPermanent || !hasAnyUsedPermanentToday}
                  className={`px-4 py-2 rounded font-semibold ${
                    hasAnyPermanent && hasAnyUsedPermanentToday
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                  title={
                    !hasAnyPermanent
                      ? 'No permanent spells in any grimoire'
                      : hasAnyUsedPermanentToday
                        ? 'Reset permanent spells used today'
                        : 'No permanent spells used today'
                  }
                >
                  New Day
                </button>
</div>
            </div>

            {(char.grimoires || []).length === 0 && (
              <div className="text-center text-gray-400 py-8">No grimoires yet</div>
            )}

            {sortedGrimoires.map(grimoire => {
              const pointsLeft = getGrimoirePointsLeft(grimoire);
              const entries = (grimoire.entries || []).map(e => ({
                ...e,
                spell: e.spell || (char.spellsLearned || []).find(s => s.id === e.spellId)
              })).filter(e => !!e.spell);

              // const hasPermanent = entries.some(e => !!e.permanent);
              const hasUsedPermanentToday = entries.some(e => !!e.permanent && !!e.usedToday);

              // Group by spell + permanent. For permanent entries, also split by usedToday so
              // one used permanent doesn't grey-out every copy of that spell.
              const groups = {};
              entries.forEach(e => {
                const key = e.permanent
                  ? `${e.spellId}|p|${e.usedToday ? 1 : 0}`
                  : `${e.spellId}|c`;

                if (!groups[key]) {
                  groups[key] = {
                    spell: e.spell,
                    permanent: !!e.permanent,
                    usedToday: !!e.usedToday,
                    count: 0,
                    entryIds: [],
                    sampleEntry: e
                  };
                }

                groups[key].count++;
                groups[key].entryIds.push(e.instanceId);
              });

              // order groups by level then name
              const orderedGroups = Object.values(groups).slice().sort((g1, g2) => sortSpellsLevelName(g1.spell, g2.spell));

              return (
                <div key={grimoire.id} className="bg-gray-700 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xl font-bold">{grimoire.name}</div>
                      <div className="text-sm text-gray-300">
                        {pointsLeft} points left (Capacity {grimoire.capacity || 39})
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setOpenGrimoireIds((prev) => ({
                            ...prev,
                            [grimoire.id]: !prev?.[grimoire.id],
                          }))
                        }
                        className="px-3 py-2 bg-gray-600 rounded hover:bg-gray-500 text-sm font-semibold"
                      >
                        {openGrimoireIds?.[grimoire.id] ? 'Close' : 'Open'}
                      </button>
                      <button
                        onClick={() => setEditModal({ type: 'addSpellToGrimoire', grimoireId: grimoire.id })}
                        className="px-3 py-2 bg-blue-600 rounded hover:bg-blue-700 text-sm"
                      >
                        Add Spell
                      </button>
                      <button
                        onClick={() => deleteGrimoire(grimoire.id)}
                        className="px-3 py-2 bg-red-600 rounded hover:bg-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {openGrimoireIds?.[grimoire.id] && orderedGroups.length === 0 && (
                    <div className="text-sm text-gray-300">No spells in this grimoire</div>
                  )}

                  {openGrimoireIds?.[grimoire.id] && orderedGroups.length > 0 && (
                    <div className="space-y-2">
                      {orderedGroups.map(group => {
                        const spell = group.spell;
                        const cost = spellPointCost(spell.level);
                        return (
                          <div key={`${spell.id}-${group.permanent ? 'perm' : 'cons'}`} className="bg-gray-800 p-3 rounded">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-bold text-lg">
                                Lvl {spell.level} - {spell.name} {group.count > 1 && <span className="text-blue-400">x{group.count}</span>}
                                <span className="text-xs text-gray-400 ml-2">({cost} pt each)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={group.permanent}
                                    onChange={() => {
                                      const makePermanent = !group.permanent;

                                      // We only toggle ONE "copy" at a time. If the spell appears multiple times,
                                      // making one copy permanent will create a separate permanent group.
                                      const targetInstanceId = group.entryIds[0];
                                      if (!targetInstanceId) return;

                                      if (makePermanent) {
                                        const limit = getPermanentSpellLimit();
                                        const current = countPermanentSpells(grimoire.id);
                                        if (current >= limit) {
                                          showGameAlert('Retain Spell', `You have reached your retained spell limit (${limit}). You can retain ${limit} spell${limit === 1 ? '' : 's'} at your current Arcane Thief level.`);
                                          return;
                                        }
                                      }

                                      const newGrimoires = (char.grimoires || []).map(g => {
                                        if (g.id !== grimoire.id) return g;
                                        const newEntries = (g.entries || []).map(e => {
                                          if (e.instanceId !== targetInstanceId) return e;
                                          return {
                                            ...e,
                                            permanent: makePermanent,
                                            usedToday: makePermanent ? false : false
                                          };
                                        });
                                        return { ...g, entries: newEntries };
                                      });
                                      updateChar({ grimoires: newGrimoires });
                                    }}
                                    className="w-4 h-4"
                                  />
                                  Permanent
                                </label>
                                <button
                                  onClick={() => {
                                    // cast one instance
                                    const entryId = group.entryIds[0];
                                    const entry = (grimoire.entries || []).find(e => e.instanceId === entryId);
                                    if (entry) castFromGrimoire(grimoire.id, entry);
                                  }}
                                  className={`px-4 py-2 rounded font-bold ${
                                    group.permanent && group.usedToday
                                      ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                                      : 'bg-red-600 hover:bg-red-700'
                                  }`}
                                  disabled={false}
                                >
                                  Cast
                                </button>
                              </div>
                            </div>

                            <div className="text-sm text-gray-300 mb-2">{spell.description}</div>

                            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                              <div><span className="text-gray-400">Prep Time:</span> {spell.prepTime}</div>
                              <div><span className="text-gray-400">Range:</span> {spell.range}</div>
                              <div><span className="text-gray-400">Duration:</span> {spell.duration}</div>
                              <div><span className="text-gray-400">AoE:</span> {spell.aoe || 'None'}</div>
                              <div><span className="text-gray-400">Saving Throw:</span> {spell.savingThrow || 'None'}</div>
                            </div>

                            <div className="text-sm mb-2">
                              <span className="text-gray-400">Components:</span>
                              {spell.verbal && ' V'}
                              {spell.somatic && ' S'}
                              {spell.material && ` M (${spell.materialDesc})`}
                            </div>

                            {spell.spellResistance && (
                              <div className="text-xs text-yellow-400 mb-2">Spell Resistance: Yes</div>
                            )}

                            {spell.hasDiceRoll && (
                              <div className="bg-gray-700 p-3 rounded mt-2">
                                <div className="flex items-center gap-2 mb-2">
                                  <label className="text-sm text-gray-400">Number of Dice:</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={(grimoire.entries || []).find(e => e.instanceId === group.entryIds[0])?.numDice || 1}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 1;
                                      const newGrimoires = (char.grimoires || []).map(g => {
                                        if (g.id !== grimoire.id) return g;
                                        const newEntries = (g.entries || []).map(en => {
                                          if (group.entryIds.includes(en.instanceId)) return { ...en, numDice: val };
                                          return en;
                                        });
                                        return { ...g, entries: newEntries };
                                      });
                                      updateChar({ grimoires: newGrimoires });
                                    }}
                                    className="w-20 p-1 bg-gray-800 rounded text-white text-center"
                                  />
                                  <span className="text-sm">{spell.diceType}</span>
                                </div>

                                <button
                                  onClick={() => {
                                    setRollModal({ type: 'grimoireDice', spell, grimoireId: grimoire.id, instanceId: group.entryIds[0] });
                                    setRollResult(null);
                                  }}
                                  className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 font-bold"
                                >
                                  Roll Spell Dice
                                </button>

                                {rollModal?.type === 'grimoireDice' && rollModal.grimoireId === grimoire.id && rollModal.instanceId === group.entryIds[0] && (
                                  <div className="mt-2 p-2 bg-gray-600 rounded">
                                    <button
                                      onClick={() => {
                                        const entry = (grimoire.entries || []).find(en => en.instanceId === group.entryIds[0]);
                                        const numDice = entry?.numDice || 1;
                                        const diceValue = parseInt((spell.diceType || 'd6').replace('d', ''));
                                        const rolls = [];
                                        for (let i = 0; i < numDice; i++) rolls.push(rollDice(diceValue));
                                        const total = rolls.reduce((a, b) => a + b, 0);
                                        setRollResult({ rolls, total });
                                      }}
                                      className="w-full py-1 bg-green-600 rounded text-sm mb-1"
                                    >
                                      Roll {(grimoire.entries || []).find(en => en.instanceId === group.entryIds[0])?.numDice || 1}{spell.diceType}
                                    </button>
                                    <div className="text-xs text-gray-300 mb-1">Or enter each die:</div>
                                    <div className="grid grid-cols-4 gap-1 mb-1">
                                      {Array.from({ length: (grimoire.entries || []).find(en => en.instanceId === group.entryIds[0])?.numDice || 1 }).map((_, i) => (
                                        <input
                                          key={i}
                                          type="number"
                                          placeholder={spell.diceType}
                                          className="p-1 bg-gray-800 rounded text-white text-xs text-center"
                                          id={`grimoire-dice-${group.entryIds[0]}-${i}`}
                                        />
                                      ))}
                                    </div>
                                    <button
                                      onClick={() => {
                                        const entry = (grimoire.entries || []).find(en => en.instanceId === group.entryIds[0]);
                                        const numDice = entry?.numDice || 1;
                                        const rolls = Array.from({ length: numDice }).map((_, i) => {
                                          const val = parseInt(document.getElementById(`grimoire-dice-${group.entryIds[0]}-${i}`).value);
                                          return val || 0;
                                        });
                                        if (rolls.every(r => r > 0)) {
                                          const total = rolls.reduce((a, b) => a + b, 0);
                                          setRollResult({ rolls, total });
                                        }
                                      }}
                                      className="w-full py-1 bg-blue-600 rounded text-xs mb-1"
                                    >
                                      Calculate
                                    </button>
                                    {rollResult?.rolls && (
                                      <div className="mt-1 text-center text-sm">
                                        <div>Dice: {rollResult.rolls.join(' + ')} = {rollResult.total}</div>
                                        <div className="text-xl font-bold text-green-400">Total: {rollResult.total}</div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {activeTab === 'magic' && magicInventoryView && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Magic Inventory</h2>
              <button
                onClick={() => { setMagicInventoryView(false); setSelectedMagicItemId(null); }}
                className="px-3 py-2 bg-gray-600 rounded text-sm hover:bg-gray-500 whitespace-nowrap"
              >
                ← Back
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={resetPermanentSpellsForNewDay}
                className="px-3 py-2 text-sm bg-blue-600 rounded hover:bg-blue-700 font-semibold"
              >
                New Day
              </button>
              <button
                onClick={addMagicItem}
                className="px-3 py-2 text-sm bg-green-600 rounded hover:bg-green-700 font-semibold"
              >
                Add Item
              </button>
            </div>
          </div>

          {magicItems.length === 0 ? (
            <div className="bg-gray-800 p-4 rounded-lg text-gray-300">
              No magic items yet. Add one for scrolls, wands, rods, etc.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {magicItems.map((item) => {
                const used = (item.spells || []).length;
                const cap = item.capacity || 0;
                const remaining = Math.max(0, cap - used);
                return (
                  <div key={item.id} className="bg-gray-800 p-4 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-lg">{item.name}</div>
                        <div className="text-sm text-gray-300">
                          {remaining} slot{remaining === 1 ? "" : "s"} left ({used}/{cap})
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setOpenMagicItemIds((prev) => ({
                              ...prev,
                              [item.id]: !prev?.[item.id],
                            }))
                          }
                          className="px-3 py-2 bg-blue-600 rounded hover:bg-blue-700 font-semibold"
                        >
                          {openMagicItemIds?.[item.id] ? 'Close' : 'Open'}
                        </button>
                        <button
                          onClick={() => deleteMagicItem(item.id)}
                          className="px-3 py-2 bg-red-700 rounded hover:bg-red-800 font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {openMagicItemIds?.[item.id] && (
                      <div className="mt-4 border-t border-gray-700 pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-300">
                            {item.description ? item.description : ''}
                          </div>
                          <button
                            onClick={() => setEditModal({ type: 'newMagicItemSpell', itemId: item.id })}
                            className="px-3 py-2 bg-green-600 rounded hover:bg-green-700 font-semibold"
                          >
                            Add Spell
                          </button>
                        </div>

                        {(() => {
                          const entries = Array.isArray(item.spells) ? item.spells : [];
                          if (entries.length === 0) {
                            return (
                              <div className="bg-gray-900/40 p-3 rounded text-gray-300 text-sm">
                                No spells in this item yet.
                              </div>
                            );
                          }

                          const groups = {};
                          for (const e of entries) {
                            const key = `${e?.spell?.name || ''}::${e?.permanent ? 'p' : 't'}`;
                            if (!groups[key]) groups[key] = { spell: e.spell, permanent: !!e.permanent, entries: [] };
                            groups[key].entries.push(e);
                          }

                          const groupList = Object.values(groups).sort((a, b) => {
                            const la = a.spell?.level ?? 0;
                            const lb = b.spell?.level ?? 0;
                            if (la !== lb) return la - lb;
                            return String(a.spell?.name || '').localeCompare(String(b.spell?.name || ''));
                          });

                          return (
                            <div className="space-y-2">
                              {groupList.map((g, idx) => {
                                const s = g.spell || {};
                                const count = g.entries.length;
                                const usedToday = g.permanent ? g.entries.filter((e) => !!e.usedToday).length : 0;
                                const available = g.permanent ? Math.max(0, count - usedToday) : count;

                                return (
                                  <div key={`${item.id}-${idx}`} className="bg-gray-900/40 p-3 rounded">
                                    <div className="flex flex-col gap-3">
                                      {/* Spell Name and Status */}
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="font-bold break-words">
                                            L{s.level ?? 0} {s.name}{' '}
                                            {g.permanent ? (
                                              <span className="text-xs text-blue-300">(Permanent)</span>
                                            ) : (
                                              <span className="text-xs text-gray-400">(Consumable)</span>
                                            )}
                                          </div>
                                          <div className="text-sm text-gray-300">
                                            {g.permanent ? `${available} of ${count} cast${count === 1 ? '' : 's'} available today` : `${count} use${count === 1 ? '' : 's'}`}
                                          </div>
                                        </div>
                                        {/* Cast and Edit buttons */}
                                        <div className="flex gap-2 flex-shrink-0">
                                          <button
                                            onClick={() => castFromMagicItem(item.id, s.name, g.permanent)}
                                            disabled={available <= 0}
                                            className={`px-3 py-2 rounded font-semibold text-sm ${
                                              available > 0
                                                ? 'bg-red-600 hover:bg-red-700'
                                                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                            }`}
                                          >
                                            Cast
                                          </button>
                                          <button
                                            onClick={() => openEditMagicItemSpell(item.id, s.name, g.permanent)}
                                            className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 font-semibold text-sm"
                                          >
                                            Edit
                                          </button>
                                        </div>
                                      </div>

                                      {/* Spell Details */}
                                      <div className="text-sm text-gray-300 space-y-2">
                                        <div className="text-sm text-gray-300">{s.description}</div>

                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                          <div><span className="text-gray-400">Prep Time:</span> {s.prepTime}</div>
                                          <div><span className="text-gray-400">Range:</span> {s.range}</div>
                                          <div><span className="text-gray-400">Duration:</span> {s.duration}</div>
                                          <div><span className="text-gray-400">AoE:</span> {s.aoe || 'None'}</div>
                                          <div><span className="text-gray-400">Saving Throw:</span> {s.savingThrow || 'None'}</div>
                                          <div><span className="text-gray-400">Spell Resist:</span> {s.spellResistance ? 'Yes' : 'No'}</div>
                                        </div>
                                      </div>

                              

                                      {s.hasDiceRoll && (
                                        <div className="bg-gray-800 p-3 rounded">
                                          <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <label className="text-sm text-gray-400">Number of Dice:</label>
                                            <input
                                              type="number"
                                              min="1"
                                              value={Number(g.entries?.[0]?.numDice || 1)}
                                              onChange={(e) => setMagicItemSpellNumDice(item.id, s.name, g.permanent, e.target.value)}
                                              className="w-16 p-1 bg-gray-700 rounded text-white text-center"
                                            />
                                            <span className="text-sm">{s.diceType}</span>
                                          </div>

                                          <button
                                            onClick={() => {
                                              setRollModal({ type: 'magicItemSpellDice', itemId: item.id, spellName: s.name, permanent: !!g.permanent });
                                              setRollResult(null);
                                            }}
                                            className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 font-bold"
                                          >
                                            Roll Spell Dice
                                          </button>

                                          {rollModal?.type === 'magicItemSpellDice' &&
                                            rollModal.itemId === item.id &&
                                            rollModal.spellName === s.name &&
                                            !!rollModal.permanent === !!g.permanent && (
                                              <div className="mt-2 p-2 bg-gray-700 rounded">
                                                <button
                                                  onClick={() => {
                                                    const numDice = Math.max(1, Number(g.entries?.[0]?.numDice || 1));
                                                    const diceValue = parseInt(String(s.diceType || 'd0').replace('d', '')) || 0;
                                                    const rolls = [];
                                                    for (let i = 0; i < numDice; i++) {
                                                      rolls.push(rollDice(diceValue));
                                                    }
                                                    const total = rolls.reduce((a, b) => a + b, 0) + (Number(s.diceBonus) || 0);
                                                    setRollResult({ rolls, total });
                                                  }}
                                                  className="w-full py-1 bg-green-600 rounded text-sm mb-1"
                                                >
                                                  Roll {Number(g.entries?.[0]?.numDice || 1)}{s.diceType}
                                                </button>
                                                <div className="text-xs text-gray-300 mb-1">Or enter each die:</div>
                                                <div className="grid grid-cols-4 gap-1 mb-1">
                                                  {Array.from({ length: Math.max(1, Number(g.entries?.[0]?.numDice || 1)) }).map((_, i) => (
                                                    <input
                                                      key={i}
                                                      type="number"
                                                      placeholder={s.diceType}
                                                      className="p-1 bg-gray-800 rounded text-white text-xs text-center"
                                                      id={`mi-dice-${item.id}-${s.id || s.name}-${g.permanent ? 'p' : 't'}-${i}`}
                                                    />
                                                  ))}
                                                </div>
                                                <button
                                                  onClick={() => {
                                                    const numDice = Math.max(1, Number(g.entries?.[0]?.numDice || 1));
                                                    const rolls = Array.from({ length: numDice }).map((_, i) => {
                                                      const el = document.getElementById(`mi-dice-${item.id}-${s.id || s.name}-${g.permanent ? 'p' : 't'}-${i}`);
                                                      const val = parseInt(el?.value);
                                                      return val || 0;
                                                    });
                                                    if (rolls.every(r => r > 0)) {
                                                      const total = rolls.reduce((a, b) => a + b, 0) + (Number(s.diceBonus) || 0);
                                                      setRollResult({ rolls, total });
                                                    }
                                                  }}
                                                  className="w-full py-1 bg-blue-600 rounded text-xs mb-1"
                                                >
                                                  Calculate
                                                </button>
                                                {rollResult?.rolls && (
                                                  <div className="mt-1 text-center text-sm">
                                                    <div>Dice: {rollResult.rolls.join(' + ')} = {rollResult.total}</div>
                                                    <div className="text-xl font-bold text-green-400">Total: {rollResult.total}</div>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'magic' && selectedMagicItemId !== null && (
        <div className="space-y-4">
          {(() => {
            const item = (char?.magicItems || []).find((i) => i.id === selectedMagicItemId);
            if (!item) {
              return (
                <div className="bg-gray-800 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="font-bold">Item not found.</div>
                    <button
                      onClick={() => { setSelectedMagicItemId(null); setMagicInventoryView(true); }}
                      className="px-4 py-2 bg-gray-600 rounded text-base hover:bg-gray-500"
                    >
                      ← Back
                    </button>
                  </div>
                </div>
              );
            }

            const entries = (item.spells || []).filter((e) => !!e?.spell);
            const cap = item.capacity || 0;
            const remaining = Math.max(0, cap - entries.length);

            // group by spell name + level + permanent
            const groups = {};
            for (const e of entries) {
              const s = e.spell;
              const key = `${s.name}||${s.level ?? 0}||${e.permanent ? "P" : "C"}`;
              if (!groups[key]) groups[key] = { spell: s, permanent: !!e.permanent, entries: [] };
              groups[key].entries.push(e);
            }
            const groupList = Object.values(groups).sort((a, b) => {
              const la = a.spell.level ?? 0;
              const lb = b.spell.level ?? 0;
              if (la !== lb) return la - lb;
              return String(a.spell.name).localeCompare(String(b.spell.name));
            });

            const hasPermanent = groupList.some((g) => g.permanent);
            const hasUsedPermanentToday = groupList.some(
              (g) => g.permanent && g.entries.some((e) => !!e.usedToday)
            );

            const learnedSorted = sortedSpellsLearned;

            return (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{item.name}</h2>
                    <div className="text-sm text-gray-300">
                      {remaining} slot{remaining === 1 ? "" : "s"} left ({entries.length}/{cap})
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectedMagicItemId(null); setMagicInventoryView(true); }}
                      className="px-4 py-2 bg-gray-600 rounded text-base hover:bg-gray-500"
                    >
                      ← Back
                    </button>
                    {hasPermanent && (
                      <button
                        onClick={() => resetMagicItemForNewDay(item.id)}
                        disabled={!hasUsedPermanentToday}
                        className={`px-4 py-2 rounded font-semibold ${
                          hasUsedPermanentToday
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "bg-gray-700 text-gray-400 cursor-not-allowed"
                        }`}
                        title={hasUsedPermanentToday ? "Reset permanent charges for a new day" : "No permanent spells used today"}
                      >
                        New Day
                      </button>
                    )}
                    <button
                      onClick={() => deleteMagicItem(item.id)}
                      className="px-4 py-2 text-base bg-red-700 rounded hover:bg-red-800 font-semibold"
                    >
                      Delete Item
                    </button>
                  </div>
                </div>

                <div className="bg-gray-800 p-4 rounded-lg space-y-3">
                  <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-300 mb-1">Add from Spells Learned</label>
                      <select
                        value={invSelectedSpellId}
                        onChange={(e) => setInvSelectedSpellId(e.target.value)}
                        className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                        disabled={remaining <= 0 || learnedSorted.length === 0}
                      >
                        <option value="">
                          {learnedSorted.length === 0 ? "No learned spells" : "Select a spell..."}
                        </option>
                        {learnedSorted.map((s) => (
                          <option key={s.id} value={String(s.id)}>
                            L{s.level ?? 0} - {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-28">
                      <label className="block text-sm text-gray-300 mb-1">Copies</label>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, remaining)}
                        value={invCopies}
                        onChange={(e) => setInvCopies(parseInt(e.target.value || "1", 10) || 1)}
                        className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                        disabled={remaining <= 0}
                      />
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-200 pb-2">
                      <input
                        type="checkbox"
                        checked={invPermanent}
                        onChange={(e) => setInvPermanent(e.target.checked)}
                        disabled={remaining <= 0}
                      />
                      Permanent (daily charges)
                    </label>

                    <button
                      onClick={() => {
                        const spell = (char.spellsLearned || []).find((s) => String(s.id) === String(invSelectedSpellId));
                        if (!spell) {
                          window.alert('Could not find that spell in Spells Learned.');
                          return;
                        }
                        addSpellEntriesToMagicItem(item.id, spell, invCopies, invPermanent);
                      }}
                      disabled={!invSelectedSpellId || remaining <= 0}
                      className={`px-4 py-2 rounded font-semibold ${
                        invSelectedSpellId && remaining > 0
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-gray-700 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Add
                    </button>

                  <button
                    onClick={() => setEditModal({ type: 'newMagicItemSpell', itemId: item.id })}
                    disabled={remaining <= 0}
                    className={`px-4 py-2 rounded font-semibold ${remaining > 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                  >
                    Add New Spell
                  </button>
                  </div>

                  {groupList.length === 0 ? (
                    <div className="text-gray-300">No spells stored in this item yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {groupList.map((g, idx) => {
                        const s = g.spell;
                        const count = g.entries.length;
                        const usedToday = g.permanent ? g.entries.filter((e) => !!e.usedToday).length : 0;
                        const available = g.permanent ? Math.max(0, count - usedToday) : count;

                        return (
                          <div key={`${s.name}-${s.level}-${g.permanent}-${idx}`} className="bg-gray-900 p-3 rounded border border-gray-700">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-bold">
                                  L{s.level ?? 0} {s.name}{" "}
                                  {g.permanent ? (
                                    <span className="text-xs text-blue-300">(Permanent)</span>
                                  ) : (
                                    <span className="text-xs text-gray-400">(Consumable)</span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-300">
                                  {g.permanent ? `${available}/${count} cast available today` : `${count} use${count === 1 ? "" : "s"}`}
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <button
                                  onClick={() => castFromMagicItem(item.id, s.name, g.permanent)}
                                  disabled={available <= 0}
                                  className={`px-3 py-2 rounded font-semibold ${
                                    available > 0 ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 text-gray-400 cursor-not-allowed"
                                  }`}
                                >
                                  Cast
                                </button>

                                {s.hasDiceRoll && (
                                  <div className="mt-2 flex flex-col items-end gap-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        min={1}
                                        max={99}
                                        value={Number(g.entries?.[0]?.numDice || 1)}
                                        onChange={(e) =>
                                          setMagicItemSpellNumDice(item.id, s.name, g.permanent, e.target.value)
                                        }
                                        className="w-16 p-1 bg-gray-700 rounded text-white text-sm"
                                      />
                                      <button
                                        onClick={() => {
                                          setRollResult(null);
                                          setRollModal({
                                            type: "magicItemSpellDice",
                                            itemId: item.id,
                                            spellName: s.name,
                                            permanent: !!g.permanent,
                                          });
                                        }}
                                        className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 font-semibold"
                                      >
                                        Roll Spell Dice
                                      </button>
                                    </div>

                                    {rollModal?.type === "magicItemSpellDice" &&
                                      rollModal.itemId === item.id &&
                                      rollModal.spellName === s.name &&
                                      !!rollModal.permanent === !!g.permanent && (
                                        <div className="w-full bg-gray-900 rounded p-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm text-gray-300">
                                              {Number(g.entries?.[0]?.numDice || 1)}{s.diceType} {s.diceBonus ? `+ ${s.diceBonus}` : ""}
                                            </div>
                                            <button
                                              onClick={() => {
                                                const sides = Number(String(s.diceType || "d6").replace("d", "")) || 6;
                                                const n = Math.max(1, Number(g.entries?.[0]?.numDice || 1));
                                                // NOTE: rollDice takes a single argument (sides). Passing (1, sides)
                                                // would always roll a 1 because only the first arg is used.
                                                const rolls = Array.from({ length: n }, () => rollDice(sides));
                                                setRollResult(rolls.reduce((a, b) => a + b, 0) + (Number(s.diceBonus) || 0));
                                                // set values into inputs for visibility
                                                rolls.forEach((r, i) => {
                                                  const el = document.getElementById(
                                                    `mi-die-${item.id}-${s.id || s.name}-${g.permanent ? "p" : "t"}-${i}`
                                                  );
                                                  if (el) el.value = String(r);
                                                });
                                              }}
                                              className="px-3 py-2 bg-blue-600 rounded hover:bg-blue-700 font-semibold"
                                            >
                                              Roll {Number(g.entries?.[0]?.numDice || 1)}
                                              {s.diceType}
                                            </button>
                                          </div>

                                          <div className="mt-3 text-sm text-gray-300">Or enter each die:</div>
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {Array.from({ length: Math.max(1, Number(g.entries?.[0]?.numDice || 1)) }).map((_, i) => {
                                              const sides = Number(String(s.diceType || "d6").replace("d", "")) || 6;
                                              return (
                                                <input
                                                  key={i}
                                                  id={`mi-die-${item.id}-${s.id || s.name}-${g.permanent ? "p" : "t"}-${i}`}
                                                  type="number"
                                                  min={1}
                                                  max={sides}
                                                  placeholder={`1-${sides}`}
                                                  className="w-16 p-1 bg-gray-700 rounded text-white text-sm"
                                                />
                                              );
                                            })}
                                          </div>

                                          <div className="mt-3 flex items-center justify-between">
                                            <button
                                              onClick={() => {
                                                const sides = Number(String(s.diceType || "d6").replace("d", "")) || 6;
                                                const n = Math.max(1, Number(g.entries?.[0]?.numDice || 1));
                                                const rolls = [];
                                                let total = 0;
                                                for (let i = 0; i < n; i++) {
                                                  const el = document.getElementById(
                                                    `mi-die-${item.id}-${s.id || s.name}-${g.permanent ? "p" : "t"}-${i}`
                                                  );
                                                  const v = Math.max(1, Math.min(sides, Number(el?.value || 0)));
                                                  if (el) el.value = String(v);
                                                  rolls.push(v);
                                                  total += v;
                                                }
                                                total += Number(s.diceBonus) || 0;
                                                setRollResult({ rolls, total });
                                              }}
                                              className="px-3 py-2 bg-green-600 rounded hover:bg-green-700 font-semibold"
                                            >
                                              Calculate
                                            </button>

                                            <button
                                              onClick={() => setRollModal(null)}
                                              className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 font-semibold"
                                            >
                                              Close
                                            </button>
                                          </div>

                                          {rollResult?.rolls && (
                                            <div className="mt-3 text-center">
                                              <div className="text-xs">Rolls: {rollResult.rolls.join(', ')}</div>
                                              <div className="text-lg font-bold">Total: {rollResult.total}</div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                  </div>
                                )}

                                {g.permanent && available <= 0 && (
                                  <div className="text-xs text-gray-400">Used today</div>
                                )}
                              </div>
                            </div>

                            {s.description ? (
                              <div className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{s.description}</div>
                            ) : null}
<div className="grid grid-cols-2 gap-2 text-sm mt-2">
  <div><span className="text-gray-400">Prep Time:</span> {s.prepTime || '-'}</div>
  <div><span className="text-gray-400">Range:</span> {s.range || '-'}</div>
  <div><span className="text-gray-400">Duration:</span> {s.duration || '-'}</div>
  <div><span className="text-gray-400">AoE:</span> {s.aoe || 'None'}</div>
  <div><span className="text-gray-400">Saving Throw:</span> {s.savingThrow || 'None'}</div>
  {s.hasDiceRoll && (
    <div><span className="text-gray-400">Dice:</span> {s.diceType || '-'}</div>
  )}
</div>

<div className="text-sm mt-2">
  <span className="text-gray-400">Components:</span>
  {s.verbal && ' V'}
  {s.somatic && ' S'}
  {s.material && (s.materialDesc ? ` M (${s.materialDesc})` : ' M')}
</div>

{s.spellResistance && (
  <div className="text-xs text-yellow-400 mt-2">Spell Resistance: Yes</div>
)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

{activeTab === 'magic' && spellsLearnedView && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Spells Learned</h2>
              <div className="flex gap-2">
                <button onClick={() => { setSpellsLearnedView(false); setGrimoireView(false); }} className="px-4 py-2 bg-gray-600 rounded text-base hover:bg-gray-500">
                  ← Back to Magic
                </button>
                <button onClick={openNewSpellModal} className="px-4 py-2 text-base bg-green-600 rounded hover:bg-green-700">
                  + Add Spell
                </button>
              </div>
            </div>

            {char.spellsLearned.length === 0 && (
              <div className="text-center text-gray-400 py-8">No spells learned yet</div>
            )}

            {char.spellsLearned.length > 0 && (
              <div 
                className="space-y-4 overflow-y-auto pr-2" 
                style={{ maxHeight: 'calc(100vh - 200px)' }}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                  const spellsAtLevel = char.spellsLearned.filter(s => s.level === level).slice().sort(sortSpellsLevelName);
                  if (spellsAtLevel.length === 0) return null;
                  
                  return (
                    <div key={level} className="bg-gray-700 p-4 rounded-lg">
                      <h3 className="font-bold text-xl mb-3 text-blue-400">Level {level}</h3>
                      <div className="space-y-3">
                        {spellsAtLevel.map(spell => {
                          const preparedCount = char.spellsPrepared.filter(s => s.id === spell.id).length;
                          const canPrepare = preparedCount < char.spellSlots[level];
                          
                          return (
                            <div key={spell.id} className="bg-gray-800 p-3 rounded">
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="font-bold text-lg">{spell.name}</div>
                                    <button onClick={() => setEditModal({ type: 'editSpell', spell })} className="p-1 bg-gray-600 rounded hover:bg-gray-500">
                                      <Edit2 size={12} />
                                    </button>
                                  </div>
                                  <div className="text-sm text-gray-300 mb-2">{spell.description}</div>
                                  
                                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                                    <div><span className="text-gray-400">Prep Time:</span> {spell.prepTime}</div>
                                    <div><span className="text-gray-400">Range:</span> {spell.range}</div>
                                    <div><span className="text-gray-400">Duration:</span> {spell.duration}</div>
                                    <div><span className="text-gray-400">AoE:</span> {spell.aoe || 'None'}</div>
                                    <div><span className="text-gray-400">Saving Throw:</span> {spell.savingThrow || 'None'}</div>
                                    {spell.hasDiceRoll && (
                                      <div><span className="text-gray-400">Dice:</span> {spell.diceType}</div>
                                    )}
                                  </div>
                                  
                                  <div className="text-sm mb-1">
                                    <span className="text-gray-400">Components:</span> 
                                    {spell.verbal && ' V'}
                                    {spell.somatic && ' S'}
                                    {spell.material && ` M (${spell.materialDesc})`}
                                  </div>
                                  
                                  {spell.spellResistance && (
                                    <div className="text-xs text-yellow-400">Spell Resistance: Yes</div>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1 items-center">
                                  <button
                                    onClick={() => {
                                      if (canPrepare) {
                                        updateChar({ 
                                          spellsPrepared: [...char.spellsPrepared, { ...spell, prepId: Date.now(), concentrating: false, numDice: 1 }] 
                                        });
                                      }
                                    }}
                                    disabled={!canPrepare}
                                    className={`px-3 py-1 rounded text-sm ${canPrepare ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                                  >
                                    <Plus size={16} />
                                  </button>
                                  {preparedCount > 0 && (
                                    <>
                                      <button
                                        onClick={() => {
                                          const preparedSpells = char.spellsPrepared.filter(s => s.id === spell.id);
                                          if (preparedSpells.length > 0) {
                                            const toRemove = preparedSpells[0];
                                            updateChar({ 
                                              spellsPrepared: char.spellsPrepared.filter(s => s.prepId !== toRemove.prepId)
                                            });
                                          }
                                        }}
                                        className="px-4 py-2 text-base bg-red-600 rounded hover:bg-red-700 text-sm"
                                      >
                                        <Minus size={16} />
                                      </button>
                                      <div className="text-sm font-bold text-gray-400">{preparedCount}</div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-bold">Notes</h2>
              <button
                onClick={openNewNote}
                className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 font-semibold whitespace-nowrap"
              >
                + Add Note
              </button>
            </div>

            {noteEditor.open && (
              <div className="bg-gray-700 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold">
                    {noteEditor.noteId != null ? 'Edit Note' : 'New Note'}
                  </div>
                  <button
                    onClick={cancelNoteEdit}
                    className="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500 text-sm whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Title</label>
                  <input
                    value={noteEditor.title}
                    onChange={(e) => setNoteEditor((p) => ({ ...p, title: e.target.value }))}
                    className="w-full p-2 bg-gray-800 rounded text-white"
                    placeholder="Note title"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Description</label>
                  <textarea
                    value={noteEditor.description}
                    onChange={(e) => setNoteEditor((p) => ({ ...p, description: e.target.value }))}
                    className="w-full p-2 bg-gray-800 rounded text-white min-h-[120px]"
                    placeholder="Details..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={saveNote}
                    className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {getNotes().length === 0 ? (
              <div className="text-gray-300 bg-gray-700/40 p-4 rounded">
                No notes yet. Click <span className="font-semibold">+ Add Note</span> to create one.
              </div>
            ) : (
              <div
                className="space-y-3 max-h-[70vh] overflow-y-auto pr-2"
                style={{ scrollbarGutter: 'stable' }}
              >
                {getNotes().map((n) => (
                  <div key={n.id} className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-bold text-lg break-words min-w-0 flex-1">{n.title || '(Untitled)'}</div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => openEditNote(n)}
                          className="p-2.5 bg-gray-600 rounded hover:bg-gray-500 active:bg-gray-400"
                          aria-label="Edit note"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this note?')) deleteNote(n.id);
                          }}
                          className="p-2.5 bg-red-600 rounded hover:bg-red-700 active:bg-red-500"
                          aria-label="Delete note"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {n.updatedAt && n.updatedAt !== n.createdAt 
                        ? `Updated ${new Date(n.updatedAt).toLocaleDateString()} ${new Date(n.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                        : n.createdAt 
                          ? `Created ${new Date(n.createdAt).toLocaleDateString()} ${new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                          : ''}
                    </div>
                    {n.description ? (
                      <div className="text-sm text-gray-200 whitespace-pre-wrap break-words">{n.description}</div>
                    ) : (
                      <div className="text-sm text-gray-400">(No description)</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'dice' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Dice Roller</h2>
            
            <div className="space-y-3">
              {[2, 3, 4, 6, 8, 10, 12, 20, 100].map(sides => {
                const dieResult = diceRolls?.dice.find(d => d.sides === sides);
                const hasCount = diceConfig[`d${sides}`] > 0;
                
                return (
                  <div key={sides} className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <label className="block text-lg font-bold text-gray-300 mb-2">d{sides}</label>
                        <div className="flex items-center gap-2 mb-3">
                          <button
                            onClick={() => setDiceConfig({ ...diceConfig, [`d${sides}`]: Math.max(0, diceConfig[`d${sides}`] - 1) })}
                            className="p-2 bg-red-600 rounded hover:bg-red-700"
                          >
                            <Minus size={20} />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={diceConfig[`d${sides}`]}
                            onChange={(e) => setDiceConfig({ ...diceConfig, [`d${sides}`]: Math.max(0, e.target.value === '' ? '' : (parseInt(e.target.value) || 0)) })}
                            className="w-20 p-2 bg-gray-800 rounded text-white text-center text-xl font-bold"
                          />
                          <button
                            onClick={() => setDiceConfig({ ...diceConfig, [`d${sides}`]: diceConfig[`d${sides}`] + 1 })}
                            className="p-2 bg-green-600 rounded hover:bg-green-700"
                          >
                            <Plus size={20} />
                          </button>
                          <button
                            onClick={() => {
                              const count = diceConfig[`d${sides}`];
                              if (count > 0) {
                                const rolls = [];
                                for (let i = 0; i < count; i++) {
                                  rolls.push(rollDice(sides));
                                }
                                const total = rolls.reduce((a, b) => a + b, 0);
                                setDiceRolls({ 
                                  type: 'single',
                                  dice: [{ sides, count, rolls, subtotal: total }]
                                });
                              }
                            }}
                            disabled={diceConfig[`d${sides}`] === 0}
                            className={`px-6 py-2 rounded-lg text-base font-bold ${
                              diceConfig[`d${sides}`] === 0 
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            Roll
                          </button>
                        </div>
                        
                        {dieResult && (
                          <div>
                            <div className="flex flex-wrap gap-2">
                              {dieResult.rolls.map((roll, i) => (
                                <div key={i} className="bg-gray-800 px-3 py-2 rounded text-lg font-bold">
                                  {roll}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {dieResult && (
                        <div className="bg-gray-800 px-4 py-3 rounded-lg min-w-[100px] text-center">
                          <div className="text-xs text-gray-400 mb-1">Total</div>
                          <div className="text-3xl font-bold text-green-400">{dieResult.subtotal}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => {
                const allDice = [];
                let grandTotal = 0;
                
                [2, 3, 4, 6, 8, 10, 12, 20, 100].forEach(sides => {
                  const count = diceConfig[`d${sides}`];
                  if (count > 0) {
                    const rolls = [];
                    for (let i = 0; i < count; i++) {
                      rolls.push(rollDice(sides));
                    }
                    const subtotal = rolls.reduce((a, b) => a + b, 0);
                    grandTotal += subtotal;
                    allDice.push({ sides, count, rolls, subtotal });
                  }
                });
                
                if (allDice.length > 0) {
                  setDiceRolls({ type: 'all', dice: allDice });
                }
              }}
              className="w-full py-4 bg-purple-600 rounded-lg hover:bg-purple-700 text-xl font-bold"
            >
              Roll All Dice
            </button>

            {diceRolls?.type === 'all' && (
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="text-2xl font-bold mb-4">All Dice Results</div>
                
                {diceRolls.dice.map((die, idx) => (
                  <div key={idx} className="mb-4 pb-4 border-b border-gray-700 last:border-b-0">
                    <div className="text-lg font-bold text-blue-400 mb-2">
                      {die.count}d{die.sides}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {die.rolls.map((roll, i) => (
                        <div key={i} className="bg-gray-700 px-3 py-2 rounded text-lg font-bold">
                          {roll}
                        </div>
                      ))}
                    </div>
                    <div className="text-base text-gray-400">
                      Subtotal: <span className="font-bold text-white text-xl">{die.subtotal}</span>
                    </div>
                  </div>
                ))}
                
                <div className="border-t-2 border-green-500 pt-4 mt-4 text-center">
                  <div className="text-lg text-gray-400 mb-2">Grand Total</div>
                  <div className="text-5xl font-bold text-green-400">
                    {diceRolls.dice.reduce((sum, die) => sum + die.subtotal, 0)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'companion' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Companions</h2>
              <button onClick={openNewCompanionModal} className="px-4 py-2 text-base bg-green-600 rounded hover:bg-green-700">
                + Add Companion
              </button>
            </div>

            {(char.companions || []).length === 0 && (
              <div className="text-center text-gray-400 py-8">No companions yet</div>
            )}

            {char.companions.map(companion => (
              <div key={companion.id} className="bg-gray-700 p-4 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">{companion.name}</h3>
                  <button onClick={() => setEditModal({ type: 'editCompanion', companion })} className="p-2 bg-gray-600 rounded hover:bg-gray-500">
                    <Edit2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400">Species</label>
                    <div className="text-lg">{companion.species || "Not set"}</div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400">Movement</label>
                    <div className="text-lg">
                      Ground: {companion.groundSpeed} ft
                      {companion.flySpeed > 0 && <div>Flying: {companion.flySpeed} ft</div>}
                    </div>
                  </div>
                </div>

                {companion.description && (
                  <div>
                    <label className="block text-sm text-gray-400">Description</label>
                    <div className="text-base text-gray-200">{companion.description}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400">HP</label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => {
                        const newComps = char.companions.map(c => 
                          c.id === companion.id ? { ...c, hp: Math.max(0, c.hp - 1) } : c
                        );
                        updateChar({ companions: newComps });
                      }} className="p-1 bg-red-600 rounded hover:bg-red-700">
                        <Minus size={16} />
                      </button>
                      <span className="text-xl font-bold">{companion.hp} / {companion.maxHp}</span>
                      <button onClick={() => {
                        const newComps = char.companions.map(c => 
                          c.id === companion.id ? { ...c, hp: Math.min(c.maxHp, c.hp + 1) } : c
                        );
                        updateChar({ companions: newComps });
                      }} className="p-1 bg-green-600 rounded hover:bg-green-700">
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400">AC</label>
                    <div className="text-xl font-bold">{companion.ac}</div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-bold">Attacks</h4>
                    <button onClick={() => setEditModal({ type: 'newCompanionAttack', companion })} className="px-4 py-2 text-base bg-green-600 rounded hover:bg-green-700 text-sm">
                      + Attack
                    </button>
                  </div>
                  
                  {companion.attacks.length === 0 && (
                    <div className="text-sm text-gray-400">No attacks</div>
                  )}
                  
                  {companion.attacks.map(attack => {
                    const toHit = (Number(attack.bth) || 0)
                      + (Number(attack.mod) || 0)
                      + (Number(attack.toHitMagic) || 0)
                      + (Number(attack.toHitMisc) || 0);
                    const dmgBonus = (Number(attack.damageBonus) || 0)
                      + (Number(attack.damageMagic) || 0)
                      + (Number(attack.damageMisc) || 0);
                    
                    return (
                      <div key={attack.id} className="bg-gray-800 p-3 rounded mb-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold">{attack.name}</div>
                          <button onClick={() => setEditModal({ type: 'editCompanionAttack', companion, attack })} className="p-1 bg-gray-600 rounded hover:bg-gray-500">
                            <Edit2 size={14} />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-blue-400 font-bold">TO HIT: +{toHit}</div>
                            <button
                              onClick={() => {
                                setRollModal({ type: 'companionAttack', companion, attack, toHit });
                                setRollResult(null);
                              }}
                              className="w-full py-1 bg-blue-600 rounded hover:bg-blue-700 mt-1"
                            >
                              Roll Attack
                            </button>
                          </div>
                          <div>
                            <div className="text-red-400 font-bold">DAMAGE: {attack.numDice}d{attack.dieType}+{dmgBonus}</div>
                            <button
                              onClick={() => {
                                setRollModal({ type: 'companionDamage', companion, attack, dmgBonus });
                                setRollResult(null);
                              }}
                              className="w-full py-1 bg-red-600 rounded hover:bg-red-700 mt-1"
                            >
                              Roll Damage
                            </button>
                          </div>
                        </div>
                        
                        {rollModal?.type === 'companionAttack' && rollModal.attack?.id === attack.id && rollModal.companion?.id === companion.id && (
                          <div className="mt-2 p-2 bg-gray-700 rounded">
                            <button
                              onClick={() => {
                                const roll = rollDice(20);
                                setRollResult({ roll, total: roll + toHit });
                              }}
                              className="w-full py-1 bg-green-600 rounded text-sm mb-1"
                            >
                              Roll d20
                            </button>
                            <input
                              type="number"
                              placeholder="Or enter roll (1-20)"
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (val >= 1 && val <= 20) {
                                  setRollResult({ roll: val, total: val + toHit });
                                }
                              }}
                              className="w-full p-1 bg-gray-800 rounded text-white text-sm"
                            />
                            {rollResult && (
                              <div className="text-center text-sm mt-1">
                                <div>d20: {rollResult.roll} + {toHit}</div>
                                <div className="text-lg font-bold text-green-400">Total: {rollResult.total}</div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {rollModal?.type === 'companionDamage' && rollModal.attack?.id === attack.id && rollModal.companion?.id === companion.id && (
                          <div className="mt-2 p-2 bg-gray-700 rounded">
                            <button
                              onClick={() => {
                                const rolls = [];
                                for (let i = 0; i < (rollModal.diceCount ?? attack.numDice); i++) {
                                  rolls.push(rollDice(attack.dieType));
                                }
                                const diceTotal = rolls.reduce((a, b) => a + b, 0);
                                setRollResult({ rolls, diceTotal, total: diceTotal + dmgBonus });
                              }}
                              className="w-full py-1 bg-green-600 rounded text-sm mb-1"
                            >
                              Roll {rollModal.diceCount ?? attack.numDice}d{attack.dieType}
                            </button>
                            <div className="text-xs text-gray-300 mb-1">Or enter each die:</div>
                            <div className="grid grid-cols-3 gap-1 mb-1">
                              {Array.from({ length: (rollModal.diceCount ?? attack.numDice) }).map((_, i) => (
                                <input
                                  key={i}
                                  type="number"
                                  placeholder={`d${attack.dieType}`}
                                  className="p-1 bg-gray-800 rounded text-white text-xs text-center"
                                  id={`comp-dmg-${companion.id}-${attack.id}-${i}`}
                                />
                              ))}
                            </div>
                            <button
                              onClick={() => {
                                const rolls = Array.from({ length: (rollModal.diceCount ?? attack.numDice) }).map((_, i) => {
                                  const val = parseInt(document.getElementById(`comp-dmg-${companion.id}-${attack.id}-${i}`).value);
                                  return val || 0;
                                });
                                if (rolls.every(r => r > 0)) {
                                  const diceTotal = rolls.reduce((a, b) => a + b, 0);
                                  setRollResult({ rolls, diceTotal, total: diceTotal + dmgBonus });
                                }
                              }}
                              className="w-full py-1 bg-blue-600 rounded text-xs mb-1"
                            >
                              Calculate
                            </button>
                            {rollResult?.rolls && (
                              <div className="text-center text-sm mt-1">
                                <div>Dice: {rollResult.rolls.join(' + ')} = {rollResult.diceTotal}</div>
                                <div>Bonus: +{dmgBonus}</div>
                                <div className="text-lg font-bold text-red-400">Total: {rollResult.total}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div>
                  <h4 className="text-lg font-bold mb-2">Saves</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(companion.saves).map(([key, save]) => (
                      <div key={key} className="bg-gray-800 p-2 rounded">
                        <div className="font-bold uppercase text-sm">{key}</div>
                        <div className="text-lg">+{save.bonus}</div>
                        <button
                          onClick={() => {
                            setRollModal({ type: 'companionSave', companion, attr: key, total: save.bonus });
                            setRollResult(null);
                          }}
                          className="w-full py-1 bg-green-600 rounded hover:bg-green-700 text-xs mt-1"
                        >
                          Roll
                        </button>
                        {rollModal?.type === 'companionSave' && rollModal.attr === key && rollModal.companion?.id === companion.id && (
                          <div className="mt-1 p-1 bg-gray-700 rounded">
                            <button
                              onClick={() => {
                                const roll = rollDice(20);
                                setRollResult({ roll, total: roll + save.bonus });
                              }}
                              className="w-full py-1 bg-blue-600 rounded text-xs mb-1"
                            >
                              d20
                            </button>
                            {rollResult && (
                              <div className="text-center text-xs">
                                <div>d20: {rollResult.roll} + {save.bonus}</div>
                                <div className="font-bold text-green-400">Total: {rollResult.total}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="bg-gray-700 p-4 rounded">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold">Wallet</h3>
                <button onClick={openWalletModal} className="px-4 py-2 text-base bg-blue-600 rounded hover:bg-blue-700 text-sm">
                  Use Wallet
                </button>
              </div>
              <div className="text-2xl">{char.moneyGP.toFixed(2)} GP</div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Inventory</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditModal({ type: 'inventoryInfo' })}
                  className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-base"
                >
                  Info
                </button>
                <button onClick={openNewItemModal} className="px-4 py-2 text-base bg-green-600 rounded hover:bg-green-700">
                  + Add Item
                </button>
              </div>
            </div>
            
            {char.inventory.length === 0 && (
              <div className="text-center text-gray-400 py-8">No items yet</div>
            )}
            {char.inventory.length > 0 && (
              <VirtualizedList
                items={sortedInventory}
                itemHeight={180}
                containerHeight={Math.min(600, window.innerHeight - 300)}
                emptyMessage="No items yet"
                renderItem={(item) => {
                  const totalWeight = item.weightPer * item.quantity;
                  return (
                    <div className="bg-gray-700 p-4 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-lg">{item.name}</div>
                        <button onClick={() => setEditModal({ type: 'editItem', item })} className="p-2 bg-gray-600 rounded hover:bg-gray-500">
                          <Edit2 size={16} />
                        </button>
                      </div>
                      <div className="text-sm text-gray-300 mb-3">{item.description}</div>
                      {normalizeItemEffects(item).length > 0 && (
                        <div className="text-xs text-gray-200 mb-3">
                          <div className="text-gray-400">Effects:</div>
                          <div className="mt-1 space-y-1">
                            {normalizeItemEffects(item).map((e) => (
                              <div key={e.id || `${item.id}-${e.kind}-${e.appliesTo}-${e.targetId || ''}`}>
                                {e.kind === 'attack' && (
                                  <span>
                                    Attack: {e.appliesTo === 'unarmed' ? 'Unarmed' : 'Weapon'}
                                    {(Number(e.miscToHit) || 0) ? ` • Misc ${Number(e.miscToHit) >= 0 ? '+' : ''}${Number(e.miscToHit)} hit` : ''}
                                    {(Number(e.miscDamage) || 0) ? ` • Misc ${Number(e.miscDamage) >= 0 ? '+' : ''}${Number(e.miscDamage)} dmg` : ''}
                                    {(Number(e.magicToHit) || 0) ? ` • Magic ${Number(e.magicToHit) >= 0 ? '+' : ''}${Number(e.magicToHit)} hit` : ''}
                                    {(Number(e.magicDamage) || 0) ? ` • Magic ${Number(e.magicDamage) >= 0 ? '+' : ''}${Number(e.magicDamage)} dmg` : ''}
                                    {e.appliesTo === 'weapon' && e.targetId ? (() => {
                                      const w = (char.inventory || []).find(ii => String(ii.id) === String(e.targetId));
                                      return w ? ` (${w.name})` : '';
                                    })() : ''}
                                  </span>
                                )}
                                {e.kind === 'ac' && (
                                  <span>
                                    AC: {Number(e.ac) >= 0 ? '+' : ''}{Number(e.ac) || 0} ({e.appliesTo || 'ac'})
                                    {e.targetId ? (() => {
                                      const t = (char.inventory || []).find(ii => String(ii.id) === String(e.targetId));
                                      return t ? ` (${t.name})` : '';
                                    })() : ''}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Display Stat Bonuses (STR, DEX, AC, Speed, etc.) */}
                      {item.hasAttrBonus && (() => {
                        const bonuses = Array.isArray(item.attrBonuses) 
                          ? item.attrBonuses.filter(b => b && b.attr && (Number(b.value) || 0) !== 0)
                          : (item.attrBonusAttr && (Number(item.attrBonusValue) || 0) !== 0 
                              ? [{ attr: item.attrBonusAttr, value: item.attrBonusValue }] 
                              : []);
                        if (bonuses.length === 0) return null;
                        return (
                          <div className="text-xs text-gray-200 mb-3">
                            <div className="text-gray-400">Stat Bonuses:</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {bonuses.map((b, idx) => (
                                <span key={`${b.attr}-${idx}`} className="bg-gray-800 px-2 py-1 rounded">
                                  {String(b.attr).toUpperCase()}: {Number(b.value) >= 0 ? '+' : ''}{Number(b.value)}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Qty</span>
                            <button 
                              onClick={() => {
                                const nextInv = (char.inventory || [])
                                  .map(i =>
                                    i.id === item.id
                                      ? { ...i, quantity: Math.max(0, i.quantity - 1) }
                                      : i
                                  )
                                  .filter(i => (i.quantity || 0) > 0);

                                const updated = nextInv.find(i => String(i.id) === String(item.id));
                                let nextMagicItems = char.magicItems || [];
                                if (updated) {
                                  nextMagicItems = syncMagicItemForInventoryItem(updated, nextMagicItems);
                                } else {
                                  nextMagicItems = (nextMagicItems || []).filter(mi => String(mi?.id) !== `linked-${String(item.id)}`);
                                }

                                updateChar({ inventory: nextInv, magicItems: nextMagicItems });
                              }} 
                              className="p-1 bg-red-600 rounded hover:bg-red-700"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="text-lg font-bold w-12 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => {
                                const newInv = char.inventory.map(i =>
                                  i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
                                );
                                const updatedItem = newInv.find(i => String(i.id) === String(item.id)) || item;
                                const nextMagicItems = syncMagicItemForInventoryItem(updatedItem, char.magicItems || []);
                                updateChar({ inventory: newInv, magicItems: nextMagicItems });
                              }} 
                              className="p-1 bg-green-600 rounded hover:bg-green-700"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          <div className="text-sm text-gray-300">
                            <span className="text-xs text-gray-400 mr-1">Wt/ea</span>
                            <span className="font-semibold text-white">{item.weightPer}</span> lb
                            <span className="text-gray-500"> (Total: {totalWeight.toFixed(1)} lb)</span>
                          </div>
                        </div>

                        {(() => {
                          const amount = (item.worthAmount != null ? Number(item.worthAmount) : (item.worthGP != null ? Number(item.worthGP) : null));
                          const unit = String(item.worthUnit || (item.worthGP != null ? 'gp' : 'gp')).toLowerCase();
                          const worthAmount = amount != null && Number.isFinite(amount) ? amount : null;
                          const worthUnit = ['cp','sp','gp','pp'].includes(unit) ? unit : 'gp';
                          if (worthAmount == null || worthAmount <= 0) return null;

                          return (
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-gray-300">
                                Worth: <span className="font-semibold text-white">{worthAmount}</span> {worthUnit.toUpperCase()}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditModal({ type: 'confirmSellItem', itemId: item.id });
                                }}
                                className="px-4 py-2 text-base bg-yellow-600 rounded hover:bg-yellow-700 text-xs font-semibold"
                                title="Sell one"
                              >
                                Sell
                              </button>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="mt-2 text-sm text-gray-400">
                        EV: {item.ev}
                      </div>
                    </div>
                  );
                }}
              />
            )}
            
            <div className="bg-gray-800 p-4 rounded">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-lg">
                    Total Weight: {char.inventory.reduce((s, i) => s + (i.weightPer * i.quantity), 0).toFixed(2)} lb
                  </div>
                  <div className="font-bold text-lg">
                    Total EV: {getInventoryTotalEV()} ({getEncumbranceStatusLabel()})
                  </div>
                </div>

                <button
                  onClick={() => setEditModal({ type: 'encumbranceInfo' })}
                  className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm whitespace-nowrap"
                >
                  Encumbrance
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

            {addAttackModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Add Attack</h2>
              <button onClick={() => setAddAttackModalOpen(false)} className="p-2 bg-gray-700 rounded hover:bg-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const name = getUnarmedAttackName(char.attacks || []);
                  const newAttack = {
                    id: Date.now(),
                    name,
                    numDice: 1,
                    dieType: 4,
                    isFavorite: false,
                    bth: 0,
                    attrMod: 0,
                    magic: 0,
                    misc: 0,
                    damageMod: 0,
                    autoMods: true,
                    damageMagic: 0,
                    damageMisc: 0,
                    weaponId: '',
                    weaponMode: 'melee'
                  };
                  updateChar({ attacks: [...char.attacks, newAttack] });
                  setAddAttackModalOpen(false);
                }}
                className="w-full px-4 py-3 bg-blue-600 rounded hover:bg-blue-700 font-semibold"
              >
                Unarmed
              </button>

              <div className="border-t border-gray-700 pt-3">
                <div className="font-bold mb-2">From Item (Weapon)</div>
                {(() => {
                  const inventoryWeapons = sortedInventory.filter(it => !!it?.isWeapon);

                  const used = new Set(
                    (char.attacks || [])
                      .filter(a => a.weaponId)
                      .map(a => `${String(a.weaponId)}|${String(a.weaponMode || a.weaponType || 'melee')}`)
                  );

                  const options = [];
                  inventoryWeapons.forEach(it => {
                    getWeaponModes(it).forEach(mode => {
                      const key = `${String(it.id)}|${mode}`;
                      if (!used.has(key)) {
                        options.push({ item: it, mode });
                      }
                    });
                  });

                  if (options.length === 0) {
                    return <div className="text-sm text-gray-400">No available weapons to add (or all weapon modes are already added).</div>;
                  }

                  return (
                    <div className="space-y-2">
                      {options.map(({ item, mode }) => {
                        const modeLabel = mode === 'ranged' ? 'Ranged' : 'Melee';
                        return (
                          <button
                            key={`${item.id}-${mode}`}
                            onClick={() => {
                              const newAttack = {
                                id: Date.now(),
                                name: `${item.name} (${modeLabel})`,
                                numDice: Number(item.weaponDamageNumDice || 1) || 1,
                                dieType: Number(item.weaponDamageDieType || 8) || 8,
                                isFavorite: false,
                                bth: 0,
                                attrMod: 0,
                                magic: 0,
                                misc: 0,
                                damageMod: 0,
                                damageMagic: 0,
                                damageMisc: 0,
                                weaponId: item.id,
                                weaponMode: mode,
                                autoMods: true
                              };
                              updateChar({ attacks: [...char.attacks, newAttack] });
                              setAddAttackModalOpen(false);
                            }}
                            className="w-full px-4 py-3 bg-gray-700 rounded hover:bg-gray-600 text-left"
                          >
                            <div className="font-semibold">{item.name} <span className="text-gray-300">({modeLabel})</span></div>
                            <div className="text-xs text-gray-300">
                              +{Number(item.weaponToHitMagic || 0) + Number(item.weaponToHitMisc || 0)} hit, {Number(item.weaponDamageNumDice || 1)}d{Number(item.weaponDamageDieType || 8)} +{Number(item.weaponDamageMagic || 0) + Number(item.weaponDamageMisc || 0)} dmg
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="border-t border-gray-700 pt-3">
                <button
                  onClick={() => {
                    setAddAttackModalOpen(false);
                    setEditModal({ type: 'newAttack', attack: { name: '', weaponMode: 'melee', autoMods: true, attrMod: 0, damageMod: 0, usesDamageDice: true, numDice: 1, dieType: 8, magic: 0, misc: 0, damageMagic: 0, damageMisc: 0, bth: 0, isFavorite: false } });
                  }}
                  className="w-full px-4 py-3 bg-green-600 rounded hover:bg-green-700 font-semibold"
                >
                  Manual Attack
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'main' && (
        <div className="max-w-4xl mx-auto mt-10 mb-6 text-center">
          <button
            onClick={() => { setCurrentCharIndex(null); }}
            className="text-base px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
          >
            ← Back to Characters
          </button>
        </div>
      )}

{editModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-2 sm:p-4 z-50">
          <div
            className={`bg-gray-800 rounded-lg p-4 sm:p-6 sm:pr-10 w-full max-h-screen overflow-y-auto ${editModal?.type === 'hpTracking' ? 'max-w-2xl' : 'max-w-md'} `}
            // Helps prevent the scrollbar from overlapping right-edge text on supported browsers.
            style={{ scrollbarGutter: 'stable' }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editModal.type === 'race' && 'Edit Race'}
                {editModal.type === 'name' && 'Edit Name'}
                {editModal.type === 'class' && 'Edit Class'}
                {editModal.type === 'speed' && 'Edit Speed'}
                {editModal.type === 'hp' && 'Edit Current HP'}
                {editModal.type === 'hpTracking' && 'HP Tracking by Level'}
                {editModal.type === 'acTracking' && 'AC Tracking'}
                {editModal.type === 'addXp' && 'Add Experience'}
                {editModal.type === 'xpTable' && 'Edit Level XP Requirements'}
                {editModal.type === 'attribute' && `Edit ${editModal.attr?.toUpperCase()}`}
                {editModal.type === 'saveModifier' && `${editModal.attr?.toUpperCase()} Save Modifier`}
                {editModal.type === 'bonusModifiers' && 'Bonus Modifiers (Bless/Curse)'}
                {editModal.type === 'saveModifiers' && 'Save Modifiers (Bless/Curse)'}
                {editModal.type === 'wallet' && 'Wallet'}
                {editModal.type === 'newItem' && 'Add New Item'}
                {editModal.type === 'editItem' && 'Edit Item'}
                {editModal.type === 'newCompanion' && 'Add New Companion'}
                {editModal.type === 'editCompanion' && 'Edit Companion'}
                {editModal.type === 'newCompanionAttack' && 'Add Companion Attack'}
                {editModal.type === 'editCompanionAttack' && 'Edit Companion Attack'}
                {editModal.type === 'spellStats' && 'Spell Statistics'}
                {editModal.type === 'spellSlots' && 'Edit Spell Slots'}
                {editModal.type === 'newSpell' && 'Add New Spell'}
                {editModal.type === 'editSpell' && 'Edit Spell'}
                                {editModal.type === 'addSpellToGrimoire' && 'Add Spell to Grimoire'}
                {editModal.type === 'newMagicItem' && 'Add Magic Item'}
                {editModal.type === 'confirmDeleteMagicItem' && 'Delete Magic Item'}
                {editModal.type === 'confirmDeleteCharacter' && 'Delete Character'}
                {editModal.type === 'newMagicItemSpell' && 'Add Spell to Item'}
                {editModal.type === 'editMagicItemSpell' && 'Edit Item Spell'}
                {editModal.type === 'newAttack' && 'Add New Attack'}
                {editModal.type === 'editAttack' && 'Edit Attack'}
                {editModal.type === 'attackInfo' && 'Attack Info'}
                {editModal.type === 'inventoryInfo' && 'Inventory Info'}
                {editModal.type === 'encumbranceInfo' && 'Encumbrance'}
                {editModal.type === 'magicInfo' && 'Magic'}
                {editModal.type === 'gameAlert' && (editModal.title || 'Info')}
                {editModal.type === 'classAbilities' && 'Edit Class Abilities'}
                {editModal.type === 'raceAbilities' && 'Edit Race Abilities'}
                {editModal.type === 'advantages' && 'Edit Advantages'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3">

              {editModal.type === 'classAbilities' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm text-gray-400">Class Abilities</label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...(char.classAbilities || []), ""];
                        updateChar({ classAbilities: next });
                      }}
                      className="px-4 py-2 text-base bg-gray-600 rounded hover:bg-gray-500 text-sm"
                    >
                      Add More
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(char.classAbilities || []).length === 0 && (
                      <div className="text-sm text-gray-400">No class abilities yet. Click Add More to start.</div>
                    )}
                    {(char.classAbilities || []).map((val, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => {
                            const next = [...(char.classAbilities || [])];
                            next[idx] = e.target.value;
                            updateChar({ classAbilities: next });
                          }}
                          className="w-full p-2 bg-gray-700 rounded text-white text-sm"
                          placeholder={`Ability ${idx + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = (char.classAbilities || []).filter((_, i) => i !== idx);
                            updateChar({ classAbilities: next });
                          }}
                          className="px-2 py-2 bg-red-600 rounded hover:bg-red-700"
                          title="Remove"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      const list = (char.classAbilities || []).map(s => String(s).trim()).filter(Boolean);
                      updateChar({ classAbilities: list });
setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save
                  </button>
                </div>
              )}

              
              {editModal.type === 'advantages' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm text-gray-400">Advantages</label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...(char.advantages || []), ""];
                        updateChar({ advantages: next });
                      }}
                      className="px-4 py-2 text-base bg-gray-600 rounded hover:bg-gray-500 text-base"
                    >
                      Add More
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(char.advantages || []).length === 0 && (
                      <div className="text-sm text-gray-400">No advantages yet. Tap Add More to start.</div>
                    )}
                    {(char.advantages || []).map((val, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => {
                            const next = [...(char.advantages || [])];
                            next[idx] = e.target.value;
                            updateChar({ advantages: next });
                          }}
                          className="w-full p-3 bg-gray-700 rounded text-white text-base"
                          placeholder={`Advantage ${idx + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = (char.advantages || []).filter((_, i) => i !== idx);
                            updateChar({ advantages: next });
                          }}
                          className="px-3 py-3 bg-red-600 rounded hover:bg-red-700"
                          title="Remove"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      const list = (char.advantages || []).map(s => String(s).trim()).filter(Boolean);
                      updateChar({ advantages: list });
                      setEditModal(null);
                    }}
                    className="w-full py-3 bg-blue-600 rounded hover:bg-blue-700 mt-3 text-base"
                  >
                    Save
                  </button>
                </div>
              )}

{editModal.type === 'raceAbilities' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm text-gray-400">Race Abilities</label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...(char.raceAbilities || []), ""];
                        updateChar({ raceAbilities: next });
                      }}
                      className="px-4 py-2 text-base bg-gray-600 rounded hover:bg-gray-500 text-sm"
                    >
                      Add More
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(char.raceAbilities || []).length === 0 && (
                      <div className="text-sm text-gray-400">No race abilities yet. Click Add More to start.</div>
                    )}
                    {(char.raceAbilities || []).map((val, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => {
                            const next = [...(char.raceAbilities || [])];
                            next[idx] = e.target.value;
                            updateChar({ raceAbilities: next });
                          }}
                          className="w-full p-2 bg-gray-700 rounded text-white text-sm"
                          placeholder={`Ability ${idx + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = (char.raceAbilities || []).filter((_, i) => i !== idx);
                            updateChar({ raceAbilities: next });
                          }}
                          className="px-2 py-2 bg-red-600 rounded hover:bg-red-700"
                          title="Remove"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm text-gray-400">Race Modifiers</label>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...(char.raceAttributeMods || []), { attr: 'str', value: 0, valueText: '0', description: '' }];
                          updateChar({ raceAttributeMods: next });
                        }}
                        className="px-4 py-2 text-base bg-gray-600 rounded hover:bg-gray-500 text-sm"
                      >
                        Add More
                      </button>
                    </div>

                    {(char.raceAttributeMods || []).length === 0 ? (
                      <div className="text-sm text-gray-400">No race attribute modifiers added.</div>
                    ) : (
                      <div className="space-y-2">
                        {(char.raceAttributeMods || []).map((row, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <select
                              value={row.attr || 'str'}
                              onChange={(e) => {
                                const next = [...(char.raceAttributeMods || [])];
                                next[idx] = { ...next[idx], attr: e.target.value };
                                updateChar({ raceAttributeMods: next });
                              }}
                              className="p-2 bg-gray-700 rounded text-white text-sm"
                            >
                              <option value="str">STR</option>
                              <option value="dex">DEX</option>
                              <option value="con">CON</option>
                              <option value="int">INT</option>
                              <option value="wis">WIS</option>
                              <option value="cha">CHA</option>
                              <option value="ac">AC</option>
                            
                            </select>

                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.valueText ?? String(row.value ?? 0)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const next = [...(char.raceAttributeMods || [])];
                                const updated = { ...next[idx], valueText: raw };

                                // Update numeric value when parseable (supports negative).
                                const parsed = parseInt(raw, 10);
                                if (!Number.isNaN(parsed)) updated.value = parsed;

                                next[idx] = updated;
                                updateChar({ raceAttributeMods: next });
                              }}
                              className="w-24 p-2 bg-gray-700 rounded text-white text-sm"
                              placeholder="+/-"
                            />

                            
                            {row.attr === 'ac' && (
                              <input
                                type="text"
                                value={row.description || ''}
                                onChange={(e) => {
                                  const next = [...(char.raceAttributeMods || [])];
                                  next[idx] = { ...next[idx], description: e.target.value };
                                  updateChar({ raceAttributeMods: next });
                                }}
                                className="flex-1 p-2 bg-gray-700 rounded text-white text-sm"
                                placeholder="AC description (e.g., unarmored)"
                              />
                            )}
<button
                              type="button"
                              onClick={() => {
                                const next = (char.raceAttributeMods || []).filter((_, i) => i !== idx);
                                updateChar({ raceAttributeMods: next });
                              }}
                              className="px-2 py-2 bg-red-600 rounded hover:bg-red-700"
                              title="Remove"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      const list = (char.raceAbilities || []).map(s => String(s).trim()).filter(Boolean);

// Keep attribute mods compact (merge by attribute), but preserve AC descriptions.
						const mods = (char.raceAttributeMods || []);

						const parseModValue = (r) => {
							const raw = (r && (r.valueText ?? r.value ?? 0));
							const v = parseInt(String(raw), 10);
							return Number.isFinite(v) ? v : 0;
						};

						// Merge non-AC modifiers by attribute
						const mergedAttr = {};
						mods.forEach(r => {
							const k = String(r.attr || '').toLowerCase();
							if (!k || k === 'ac') return;
							mergedAttr[k] = (mergedAttr[k] || 0) + parseModValue(r);
						});

						// Keep AC modifiers as separate rows so descriptions survive
						const acRows = mods
							.filter(r => String(r.attr || '').toLowerCase() === 'ac')
							.map(r => ({
								attr: 'ac',
								value: parseModValue(r),
								description: String(r.description || '').trim(),
							}))
							.filter(r => r.value !== 0 || r.description);

						// Build cleaned list: merged attributes + AC rows
						const cleanedRaceMods = [
							...Object.entries(mergedAttr)
								.filter(([, v]) => (Number(v) || 0) !== 0)
								.map(([attr, value]) => ({ attr, value })),
							...acRows,
						];
updateChar({ raceAbilities: list, raceAttributeMods: cleanedRaceMods });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save
                  </button>
                </div>
              )}

              {editModal.type === 'attackInfo' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-300">
                    To add an attack, please add a weapon to Inventory and then choose that weapon here.
                  </p>
                  <p className="text-sm text-gray-300">
                    To manually add an attack (including an unarmed attack), press <span className="font-semibold text-white">New Attack</span> on this page.
                  </p>
                  <p className="text-sm text-gray-300">
                    Bonus modifiers can be added temporarily for the effects of a spell or curse.
                  </p>
                </div>
              )}

              {editModal.type === 'inventoryInfo' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-300">
                    To add an item, please click <span className="font-semibold text-white">+ Add Item</span>. If you add a number in Worth, you will be able to sell it from your inventory.
                  </p>
                  <p className="text-sm text-gray-300">
                    By clicking <span className="font-semibold text-white">Armor</span> or <span className="font-semibold text-white">Shield</span>, you can add it in AC Tracking for your AC.
                  </p>
                  <p className="text-sm text-gray-300">
                    By clicking <span className="font-semibold text-white">Weapon</span>, you can add it to your Attacks.
                  </p>
                  <p className="text-sm text-gray-300">
                    By clicking <span className="font-semibold text-white">Stat Bonus</span>, an item can boost any of your Attributes, AC, or Movement Speed.
                  </p>
                  <p className="text-sm text-gray-300">
                    By clicking <span className="font-semibold text-white">Magic Casting</span>, you can link this item to your Magic tab so it can cast spells. You can cast spells with the item in your Magic Inventory.
                  </p>
                  <p className="text-sm text-gray-300">
                    By clicking <span className="font-semibold text-white">Weapon Effects</span>, you can create an item that can be applied to a weapon to boost its To Hit or Damage.
                  </p>
                </div>
              )}

              {editModal.type === 'magicInfo' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-300">
                    In order to add spells to your Magic Inventory, Spells Prepared, or Grimoire, spells first need to be added to <span className="text-white font-semibold">Spells Learned</span>.
                  </p>

                  <div className="space-y-2">
                    <div className="text-sm text-white font-semibold">Spells Prepared</div>
                    <p className="text-sm text-gray-300">
                      Once a spell is added to Spells Learned, you can add it to Spells Prepared if you have a spell slot for that spell level. Click the <span className="text-white font-semibold">+</span> button to add it to Spells Prepared.
                    </p>
                    <p className="text-sm text-gray-300">
                      Clicking <span className="text-white font-semibold">Cast</span> will remove that spell from Spells Prepared. To add it back, go back into Spells Learned.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-white font-semibold">Magic Inventory</div>
                    <p className="text-sm text-gray-300">
                      The Magic Inventory is tied to your regular Inventory. Add the magic item (for example: Scroll, Rod, etc.) to Inventory and check <span className="text-white font-semibold">Magic Casting</span>. The item will then be sent to your Magic Inventory.
                    </p>
                    <p className="text-sm text-gray-300">
                      Open that magic item to add spells from Spells Learned. You can add as many copies of the spell as you have slots available for that spell level.
                    </p>
                    <p className="text-sm text-gray-300">
                      You can also make them <span className="text-white font-semibold">Permanent</span> so they replenish after a long rest. Once you cast permanent spells, click the <span className="text-white font-semibold">New Day</span> button at the top to restore your casts for that spell.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-white font-semibold">Grimoire</div>
                    <p className="text-sm text-gray-300">
                      Grimoires are also tied to Inventory. Add them in Inventory and check <span className="text-white font-semibold">Magic Casting</span>.
                    </p>
                    <p className="text-sm text-gray-300">
                      You cannot add spell slots to a Grimoire. Each Grimoire has <span className="text-white font-semibold">39 points</span>. Each spell level costs that many points, with level 0 spells costing 1 point each.
                    </p>
                    <p className="text-sm text-gray-300">
                      You can add spells to your Grimoires until you have no points left. Once you cast a spell, it is removed from your Grimoire.
                    </p>
                    <p className="text-sm text-gray-300">
                      If a spell is marked <span className="text-white font-semibold">Permanent</span>, you can cast it once per day. After casting, it must be replenished with a long rest (use <span className="text-white font-semibold">New Day</span>).
                    </p>
                    <p className="text-sm text-gray-300">
                      Arcane Thieves can make 1 spell permanent in their Grimoire per level.
                    </p>
                  </div>
                </div>
              )}

              {editModal.type === 'encumbranceInfo' && (
                <div className="space-y-3">
                  {(() => {
                    const er = getEncumbranceRating();
                    const total = getInventoryTotalEV();
                    const status = getEncumbranceStatus();
                    const burdenMax = 3 * er;
                    return (
                      <div className="space-y-2">
                        <div className="text-sm text-gray-300">
                          Encumbrance Rating (ER): <span className="text-white font-semibold">{er}</span>
                        </div>
                        <div className="text-sm text-gray-300">
                          Total EV Carried: <span className="text-white font-semibold">{total}</span> ({status})
                        </div>

                        <div className="mt-2 bg-gray-900/40 p-3 rounded space-y-1 text-sm text-gray-300">
                          <div>
                            <span className="text-white font-semibold">Unburdened:</span> {er} and less
                          </div>
                          <div>
                            <span className="text-white font-semibold">Burdened:</span> {er + 1} to {burdenMax}
                          </div>
                          <div>
                            <span className="text-white font-semibold">Overburdened:</span> {burdenMax + 1}+
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-gray-400">
                          Burdened: -10 ft speed (min 5 ft), -2 to Dex checks/saves.<br />
                          Overburdened: speed becomes 5 ft, Dex checks/saves fail, and Dex is removed from AC.
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {editModal.type === 'gameAlert' && (
                <div className="space-y-3">
                  <div className="text-sm text-gray-200 whitespace-pre-wrap">
                    {editModal.message}
                  </div>
                  <button
                    onClick={closeModal}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 font-semibold"
                  >
                    OK
                  </button>
                </div>
              )}

              {editModal.type === 'race' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Race Name</label>
                  <input
                    type="text"
                    value={modalForms.race}
                    onChange={(e) => updateModalForm({ race: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white"
                  />
                  <button
                    onClick={() => {
                      updateChar({ race: modalForms.race });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save
                  </button>
                </div>
              )}

              {editModal.type === 'name' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Character Name</label>
                  <input
                    type="text"
                    value={modalForms.name}
                    onChange={(e) => updateModalForm({ name: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white"
                  />
                  <button
                    onClick={() => {
                      updateChar({ name: modalForms.name });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save
                  </button>
                </div>
              )}

              {editModal.type === 'class' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Class Name</label>
                  <input
                    type="text"
                    value={modalForms.class}
                    onChange={(e) => updateModalForm({ class: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white"
                  />
                  <button
                    onClick={() => {
                      updateChar({ class1: modalForms.class });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save
                  </button>
                </div>

              )}

              {editModal.type === 'speed' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Base Speed (feet)</label>
                  <input
                    type="number"
                    value={modalForms.speedBase}
                    onChange={(e) => updateModalForm({ speedBase: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                    className="w-full p-2 bg-gray-700 rounded text-white"
                  />

                  <label className="block text-sm text-gray-400 mb-2 mt-3">Bonus (feet)</label>
                  <input
                    type="number"
                    value={modalForms.speedBonus}
                    onChange={(e) => updateModalForm({ speedBonus: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                    className="w-full p-2 bg-gray-700 rounded text-white"
                  />

                  <div className="mt-3 text-sm text-gray-400">
                    Total: <span className="text-gray-200 font-semibold">{getSpeedTotal()} ft</span>
                    {(() => {
                      const status = getEncumbranceStatus();
                      const pen = getEncumbranceSpeedPenalty();
                      if (status === 'unburdened' || !pen) return null;
                      return (
                        <div className="mt-1 text-sm text-gray-400">
                          Encumbrance: <span className="text-gray-200 font-semibold">-{pen} ft</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="mt-4 bg-gray-900/40 p-3 rounded">
                    <div className="font-bold text-gray-200 mb-2">Speed Items (equip to apply)</div>
                    {(() => {
                      const speedItems = getItemAttributeCandidates('speed');
                      if (!speedItems.length) {
                        return <div className="text-sm text-gray-400">No Speed bonus items found.</div>;
                      }
                      return (
                        <div className="space-y-2">
                          {speedItems.map((it) => {
                            const id = String(it.id);
                            const checked = equippedSpeedItemIds.includes(id);
                            const bonus = Number(it.total) || 0;
                            return (
                              <label key={id} className="flex items-center justify-between gap-3 bg-gray-800 rounded p-2">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? Array.from(new Set([...equippedSpeedItemIds, id]))
                                        : equippedSpeedItemIds.filter(x => x !== id);
                                      setEquippedSpeedItemIds(next);
                                    }}
                                    className="w-5 h-5"
                                  />
                                  <div className="text-sm text-gray-200">
                                    {it.name || 'Item'}{it.qty && it.qty > 1 ? ` (x${it.qty})` : ''}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-300 font-semibold whitespace-nowrap">
                                  {bonus >= 0 ? '+' : ''}{bonus} ft
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  <button
                    onClick={() => {
                      updateChar({ speed: modalForms.speedBase, speedBonus: modalForms.speedBonus, equippedSpeedItemIds });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save
                  </button>
                </div>
              )}

              {editModal.type === 'hp' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Current HP</label>
                    <input
                      type="number"
                      value={modalForms.hpCurrent}
                      onChange={(e) => updateModalForm({ hpCurrent: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                      className="w-full p-2 bg-gray-700 rounded text-white"
                      min={0}
                      max={calculateMaxHP()}
                      step={1}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Change (add or subtract)</label>
                    <input
                      type="number"
                      value={modalForms.hpDelta}
                      onChange={(e) => updateModalForm({ hpDelta: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                      className="w-full p-2 bg-gray-700 rounded text-white"
                      step={1}
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      Example: enter -5 for damage, or 8 for healing.
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const next = clamp(modalForms.hpCurrent + modalForms.hpDelta, 0, calculateMaxHP());
                      updateChar({ hp: next, currentHp: next });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              )}

{editModal.type === 'hpTracking' && (
                <div className="max-h-96 overflow-y-auto pr-6" style={{ scrollbarGutter: 'stable' }}>
                  <div className="text-sm text-gray-400 mb-3">
                    Enter HP gained at each level. Max HP is the sum of all levels + bonus. Total Max HP: <span className="font-bold text-white">{calculateMaxHP()}</span>
                  </div>
                  
                  <div className="mb-3 p-2 bg-gray-900 rounded">
                    <label className="block text-sm font-bold text-blue-400 mb-1">HP Hit Die</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={hpDieDraft}
                        onChange={(e) => setHpDieDraft(parseInt(e.target.value || '12', 10) || 12)}
                        className="w-28 p-2 bg-gray-700 rounded text-white"
                        min={4}
                        max={12}
                        step={2}
                      />
                      <div className="text-sm text-gray-300">
                        Roll will add CON mod: <span className="font-bold text-white">{calcMod(getAttributeTotal('con')) >= 0 ? '+' : ''}{calcMod(getAttributeTotal('con'))}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Typical: 4, 6, 8, 10, 12</div>
                  </div>

                  <div className="mb-3 p-2 bg-gray-900 rounded">
                    <label className="block text-sm font-bold text-green-400 mb-1">Bonus HP (from items, feats, etc.)</label>
                    <input
                      type="number"
                      value={modalForms.hpBonus}
                      onChange={(e) => updateModalForm({ hpBonus: e.target.value === '' ? '' : e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                      className="w-full p-2 bg-gray-700 rounded text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    {(() => {
                      const rolls = (Array.isArray(hpDraftRolls) && hpDraftRolls.length ? hpDraftRolls : ['', '', '']);
                      const levels = (Array.isArray(hpDraftLevels) && hpDraftLevels.length
                        ? hpDraftLevels
                        : Array.from({ length: rolls.length }, () => 0));
                      let lastFilled = -1;
                      for (let i = 0; i < rolls.length; i++) { if ((parseInt(rolls[i] || '0', 10) || 0) > 0) lastFilled = i; }
                      const effectiveLen = Math.max(3, lastFilled + 1);
                      const showCount = Math.min(rolls.length, Math.max(effectiveLen, hpLevelsShown));
                      const conMod = calcMod(getAttributeTotal('con'));
                      return rolls.slice(0, showCount).map((rawStr, i) => {
                        const prevOk = i === 0 || ((parseInt(rolls[i - 1] || '0', 10) || 0) > 0);
                        return (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <label className="w-20 text-sm font-bold">Level {i + 1}:</label>
                          <input
                            type="number"
                            value={rawStr ?? ''}
                            disabled={!prevOk}
                            onChange={(e) => {
                              if (!prevOk) return;
                              const val = parseInt(e.target.value || '0', 10) || 0;

                              // Update raw rolls (the textbox values)
                              const nextRolls = rolls.slice();
                              nextRolls[i] = val > 0 ? String(val) : '';
                              if (val > 0 && i === (hpLevelsShown - 1)) {
                                while (nextRolls.length < hpLevelsShown + 1) nextRolls.push('');
                                setHpLevelsShown(hpLevelsShown + 1);
                              }
                              setHpDraftRolls(nextRolls);

                              // Update totals (raw + CON), stored in hpDraftLevels
                              const nextLevels = levels.slice();
                              nextLevels[i] = val > 0 ? Math.max(1, val + conMod) : 0;
                              if (val > 0 && i === (hpLevelsShown - 1)) {
                                while (nextLevels.length < hpLevelsShown + 1) nextLevels.push(0);
                              }
                              setHpDraftLevels(nextLevels);
                            }}
                            className={`flex-1 p-2 rounded text-white ${prevOk ? "bg-gray-700" : "bg-gray-900 text-gray-500 cursor-not-allowed"}`}
                            id={`hp-level-${i}`}
                          />
                          <button
                            type="button"
                            disabled={!prevOk}
                            onClick={() => {
                              if (!prevOk) return;
                              const die = Number(hpDieDraft) || 12;
                              // Roll the hit die (raw), CON mod is applied on save
                              const rawRoll = rollDice(die);
                              const next = rolls.slice();
                              next[i] = String(rawRoll);
                              if (rawRoll > 0 && i === (hpLevelsShown - 1)) {
                                while (next.length < hpLevelsShown + 1) next.push('');
                                setHpLevelsShown(hpLevelsShown + 1);
                              }
                              setHpDraftRolls(next);
                            }}
                            className={`px-3 py-2 rounded text-sm font-semibold ${prevOk ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-900 text-gray-500 cursor-not-allowed"}`}
                            title={`Roll d${hpDieDraft || 12} + CON mod`}
                          >
                            Roll
                          </button>
                          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">(CON {conMod >= 0 ? '+' : ''}{conMod})</span>
                          <span className="text-xs text-gray-300 whitespace-nowrap flex-shrink-0">
                            Total: {
                              (() => {
                                const raw = parseInt((rawStr || '0'), 10) || 0;
                                if (raw <= 0) return 0;
                                return Math.max(1, raw + conMod);
                              })()
                            }
                          </span>
                          {!prevOk && <span className="text-xs text-gray-500">(fill previous level first)</span>}
                        </div>
                      );
                      });
                    })()}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const existing = (Array.isArray(hpDraftRolls) && hpDraftRolls.length ? hpDraftRolls.slice() : ['', '', '']);
                      const currentVisible = Math.max(3, hpLevelsShown);
                      const lastVisibleIdx = currentVisible - 1;
                      const lastEl = document.getElementById(`hp-level-${lastVisibleIdx}`);
                      const lastVal = lastEl ? (parseInt(lastEl.value) || 0) : (parseInt(existing[lastVisibleIdx] || '0', 10) || 0);
                      if (lastVal <= 0) return;

                      while (existing.length < currentVisible + 1) existing.push('');

                      const newMax = existing.reduce((sum, v) => sum + (Number(v) || 0), 0) + (Number(char.hpBonus) || 0);
                      setHpDraftRolls(existing);
                      // (Optional) update max HP preview immediately
                      const conMod2 = calcMod(getAttributeTotal('con'));
                      const previewMax = existing.reduce((sum, v) => {
                        const raw = parseInt(v || '0', 10) || 0;
                        if (raw <= 0) return sum;
                        return sum + Math.max(1, raw + conMod2);
                      }, 0) + (Number(char.hpBonus) || 0);
                      updateChar({ maxHp: previewMax, hp: Math.min(char.hp, previewMax) });
                      setHpLevelsShown(currentVisible + 1);
                    }}
                    className="w-full py-2 bg-gray-700 rounded hover:bg-gray-600 mt-2 font-semibold"
                  >
                    Add next level
                  </button>
                  <button
                    onClick={() => {
                      const conMod = calcMod(getAttributeTotal('con'));
                      const draftRolls = (Array.isArray(hpDraftRolls) && hpDraftRolls.length ? hpDraftRolls : ['', '', '']);
                      const draft = draftRolls.map((v) => {
                        const raw = parseInt(v || '0', 10) || 0;
                        if (raw <= 0) return 0;
                        return Math.max(1, raw + conMod);
                      });

                      // Trim trailing zero-levels so you don't "unlock" future levels by accident
                      let lastFilled = -1;
                      for (let i = 0; i < draft.length; i++) {
                        if ((Number(draft[i]) || 0) > 0) lastFilled = i;
                      }
                      const effectiveLen = Math.max(3, lastFilled + 1);
                      const trimmedHpByLevel = draft.slice(0, effectiveLen);

                      const newBonus = modalForms.hpBonus || 0;
                      const newDie = Number(hpDieDraft) || 12;
                      const newMaxHP = trimmedHpByLevel.reduce((sum, hp) => sum + (Number(hp) || 0), 0) + newBonus;
                      const newCurrentHP = Math.min(char.hp, newMaxHP);

                      updateChar({
                        hpByLevel: trimmedHpByLevel,
                        hpBonus: newBonus,
                        hpDie: newDie,
                        maxHp: newMaxHP,
                        hp: newCurrentHP
                      });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save HP Tracking
                  </button>
                </div>
              )}

              {editModal.type === 'acTracking' && (
                <div>
                  <div className="text-sm text-gray-400 mb-3">
                    Enter AC components. Total AC: <span className="font-bold text-white">{calculateAC()}</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-1">Base AC</label>
                      <input
                        type="number"
                        value={modalForms.acBase}
                        onChange={(e) => updateModalForm({ acBase: parseInt(e.target.value) || 10 })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    
                    
                    <div className="bg-gray-900 border border-gray-700 rounded p-3">
                      <div className="font-bold text-gray-200 mb-2">Equipment (from Inventory)</div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-bold text-gray-300">Armor</label>
                          <div className="text-xs text-gray-400">
                            Bonus: {(() => {
                              const armorIds = equippedArmorIds || [];
                              if (!armorIds.length) return 0;
                              return armorIds.reduce((sum, id) => {
                                const it = (char.inventory || []).find(i => String(i.id) === String(id));
                                return sum + (Number(it?.acBonus) || 0);
                              }, 0);
                            })()}
                          </div>
                        </div>

                        {(char.inventory || []).filter(i => i.isArmor).length === 0 ? (
                          <div className="text-sm text-gray-400">No armor items in inventory</div>
                        ) : (
                          <div className="bg-gray-700 rounded p-2 pr-4 max-h-48 overflow-y-auto space-y-1" style={{ scrollbarGutter: 'stable' }}>
                            {sortedInventory
                              .filter(i => i.isArmor)
                              .map((it) => {
                                const sid = String(it.id);
                                const checked = (equippedArmorIds || []).includes(sid);
                                return (
                                  <label key={it.id} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleEquippedArmor(it.id)}
                                      className="w-4 h-4"
                                    />
                                    <span>{it.name} ({Number(it.acBonus) || 0 >= 0 ? '+' : ''}{Number(it.acBonus) || 0})</span>
                                  </label>
                                );
                              })}
                          </div>
                        )}

                        {((char.inventory || []).filter(i => i.isArmor).length > 0) && (
                          <button
                            type="button"
                            onClick={() => setEquippedArmorIds([])}
                            className="mt-2 px-3 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500"
                          >
                            None
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-300 mb-1">Shield</label>
                        <select
                          value={equippedShieldId}
                          onChange={(e) => setEquippedShieldId(e.target.value)}
                          className="w-full p-2 bg-gray-700 rounded text-white"
                        >
                          <option value="">None</option>
                          {(char.inventory || []).filter(i => i.isShield).map((it) => (
                            <option key={it.id} value={String(it.id)}>
                              {it.name} (+{Number(it.acBonus) || 0})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(() => {
                      const raceAcRows = (char.raceAttributeMods || [])
                        .filter(r => String(r.attr || '').toLowerCase() === 'ac')
                        .map(r => ({
                          value: Number(r.value) || 0,
                          description: String(r.description || '').trim(),
                        }))
                        .filter(r => r.value !== 0 || r.description);

                      if (!raceAcRows.length) return null;

                      const total = raceAcRows.reduce((sum, r) => sum + (Number(r.value) || 0), 0);

                      return (
                        <div className="bg-gray-900 border border-gray-700 rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-bold text-gray-200">Race AC</div>
                            <div className="text-sm text-gray-300 font-semibold">
                              {total >= 0 ? '+' : ''}{total}
                            </div>
                          </div>

                          <div className="space-y-1 text-sm text-gray-300">
                            {raceAcRows.map((r, i) => (
                              <div key={i} className="flex items-start justify-between gap-3">
                                <div className="flex-1 text-gray-200">
                                  {r.description ? r.description : 'Race modifier'}
                                </div>
                                <div className="whitespace-nowrap text-gray-300">
                                  {r.value >= 0 ? '+' : ''}{r.value}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-2 text-xs text-gray-500">
                            Edit these under Main → Race Abilities.
                          </div>
                        </div>
                      );
                    })()}

                    <div className="bg-gray-900 border border-gray-700 rounded p-3">
                      <div className="font-bold text-gray-200 mb-2">Defense Items (equip to apply)</div>
                      {(() => {
                        const items = (char.inventory || []).filter(it => normalizeItemEffects(it).some(e => e?.kind === 'ac'));
                        if (!items.length) return <div className="text-sm text-gray-400">No defense items with AC effects in inventory.</div>;
                        return (
                          <div className="space-y-2">
                            {items.map(it => {
                              const checked = equippedDefenseItemIds.includes(String(it.id));
                              return (
                                <label key={it.id} className="flex items-start gap-2 text-sm text-gray-200">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const sid = String(it.id);
                                      setEquippedDefenseItemIds(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]);
                                    }}
                                    className="w-4 h-4 mt-0.5"
                                  />
                                  <div>
                                    <div className="text-gray-100">{it.name}</div>
                                    <div className="text-xs text-gray-400">{effectSummary(it, 'ac', char.inventory)}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

<div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="block text-sm font-bold text-gray-300">Mod (Dexterity/Attribute)</label>
                        <label className="flex items-center gap-2 text-sm text-gray-200">
                          <input
                            type="checkbox"
                            checked={acUseDex}
                            onChange={(e) => setAcUseDex(e.target.checked)}
                            className="w-5 h-5"
                          />
                          Use current DEX mod
                        </label>
                      </div>

                      {acUseDex ? (
                        <>
                        <input
                          type="number"
                          value={(getEncumbranceStatus() === 'overburdened') ? 0 : calcMod(getAttributeTotal('dex'))}
                          readOnly
                          className="w-full p-2 bg-gray-700 rounded text-white opacity-90"
                        />
                        {getEncumbranceStatus() === 'burdened' && (
                          <div className="mt-1 text-xs text-gray-400">
                            Encumbrance: <span className="text-gray-200 font-semibold">-2</span> to Dex checks/saves
                          </div>
                        )}
                        {getEncumbranceStatus() === 'overburdened' && (
                          <div className="mt-1 text-xs text-gray-400">
                            Encumbrance: <span className="text-gray-200 font-semibold">DEX removed</span> from AC
                          </div>
                        )}
                        </>
                      ) : (
                        <input
                          type="number"
                          value={modalForms.acMod}
                          onChange={(e) => updateModalForm({ acMod: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                          className="w-full p-2 bg-gray-700 rounded text-white"
                        />
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-1">Magic</label>
                      <input
                        type="number"
                        value={modalForms.acMagic}
                        onChange={(e) => updateModalForm({ acMagic: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-1">Misc</label>
                      <input
                        type="number"
                        value={modalForms.acMisc}
                        onChange={(e) => updateModalForm({ acMisc: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-green-400 mb-1">Bonus (temporary, use negative for penalties)</label>
                      <input
                        type="number"
                        value={modalForms.acBonus}
                        onChange={(e) => updateModalForm({ acBonus: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      const newAC = {
                        acBase: modalForms.acBase,
                        acModAuto: acUseDex,
                        acMod: acUseDex ? calcMod(getAttributeTotal('dex')) : modalForms.acMod,
                        acMagic: modalForms.acMagic,
                        acMisc: modalForms.acMisc,
                        acBonus: modalForms.acBonus,
                        equippedArmorIds: (equippedArmorIds || []).map(x => parseInt(x, 10)).filter(n => !isNaN(n)),
                        equippedArmorId: (equippedArmorIds && equippedArmorIds.length) ? parseInt(equippedArmorIds[0], 10) : null,
                        equippedShieldId: equippedShieldId ? parseInt(equippedShieldId, 10) : null,
                        equippedEffectItemIds: {
                          ...ensureEquippedEffectShape(char),
                          ac: (equippedDefenseItemIds || []).map(x => parseInt(x, 10)).filter(n => !isNaN(n))
                        },
                      };
                      updateChar(newAC);
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save AC Tracking
                  </button>
                </div>
              )}

              {editModal.type === 'addXp' && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-400">Add XP to the current character.</div>
                  <label className="block text-sm text-gray-400">XP to Add</label>
                  <DomStepper value={modalForms.xpAdd} onChange={(v) => updateModalForm({ xpAdd: v })} step={100} min={0} allowManual={true} />
                  <button
                    onClick={() => {
                      updateChar({ currentXp: (char.currentXp || 0) + modalForms.xpAdd });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                  >
                    Add XP
                  </button>
                </div>
              )}

{editModal.type === 'xpTable' && (
                <div className="max-h-96 overflow-y-auto pr-6" style={{ scrollbarGutter: 'stable' }}>
                  <div className="text-sm text-gray-400 mb-3">
                    Enter XP needed to reach each level (Levels 1-25). Level automatically updates based on current XP.
                  </div>
                  <div className="space-y-2">
                    {char.xpTable.map((xp, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <label className="w-20 text-sm font-bold">Level {i + 1}:</label>
                        <input
                          type="number"
                          defaultValue={xp}
                          className="flex-1 p-2 bg-gray-700 rounded text-white"
                          id={`xp-level-${i}`}
                        />
                        <span className="text-xs text-gray-400">XP</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const rawTable = char.xpTable.map((_, i) =>
                        parseInt(document.getElementById(`xp-level-${i}`).value) || 0
                      );

                      // Enforce strictly increasing XP per level
                      const newTable = [...rawTable];
                      for (let i = 1; i < newTable.length; i++) {
                        if (newTable[i] <= newTable[i - 1]) {
                          newTable[i] = newTable[i - 1] + 1;
                        }
                      }

                      updateChar({ xpTable: newTable });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save XP Table
                  </button>
                </div>
              )}

              {editModal.type === 'attribute' && (
                <div>
                  <div className="text-sm text-gray-400 mb-3">
                    Total {editModal.attr?.toUpperCase()} = Rolled + Race + Bonus + Item.
                    Item bonus is pulled from inventory items marked "Attribute Bonus".
                  </div>
                  <div className="mb-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!char.attributes?.[editModal.attr]?.isPrime}
                        onChange={() => {
                          const k = editModal.attr;
                          if (!k) return;
                          const newAttrs = { ...char.attributes };
                          newAttrs[k] = { ...newAttrs[k], isPrime: !newAttrs[k]?.isPrime };
                          updateChar({ attributes: newAttrs });
                        }}
                        className="w-5 h-5"
                      />
                      <span className="text-gray-200">Prime attribute</span>
                    </label>
                  </div>

                  <label className="block text-sm text-gray-400 mb-1">Rolled {editModal.attr?.toUpperCase()} Score</label>
                  <DomStepper value={modalForms.attrRolled} onChange={(v) => updateModalForm({ attrRolled: v })} step={1} min={1} max={30} className="mb-3" />

                  <label className="block text-sm text-gray-400 mb-1">Bonus Modifier</label>
                  <DomStepper value={modalForms.attrBonus} onChange={(v) => updateModalForm({ attrBonus: v })} step={1} min={-10} max={10} className="mb-3" />

                  <div className="bg-gray-700 p-3 rounded text-sm">
                    {(() => {
                      const attrKey = editModal.attr;
                      const candidates = getItemAttributeCandidates(attrKey);
                      const selectedIds = (attrEquippedIds || []).map(x => String(x));
                      const itemTotal = candidates
                        .filter(c => selectedIds.includes(String(c.id)))
                        .reduce((sum, c) => sum + (Number(c.total) || 0), 0);

                      const raceTotal = (char.raceAttributeMods || [])
                        .filter(m => String(m.attr).toLowerCase() === String(attrKey).toLowerCase())
                        .reduce((sum, m) => sum + (Number(m.value) || 0), 0);

                      return (
                        <>
                          <div className="mb-2">
                            <span className="text-gray-300 font-semibold">Race Modifier:</span>{' '}
                            <span>{raceTotal >= 0 ? '+' : ''}{raceTotal}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-gray-300 font-semibold">Item Modifier:</span>{' '}
                              <span>{itemTotal >= 0 ? '+' : ''}{itemTotal}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAttrEquippedIds([])}
                              className="px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500"
                            >
                              None
                            </button>
                          </div>

                          <div className="mt-2">
                            <div className="text-xs text-gray-400 mb-1">
                              Choose equipped items that affect {attrKey?.toUpperCase()}:
                            </div>

                            {candidates.length === 0 ? (
                              <div className="text-gray-400">No attribute-bonus items for this stat</div>
                            ) : (
                              <div className="bg-gray-800 rounded p-2 pr-4 max-h-40 overflow-y-auto space-y-1" style={{ scrollbarGutter: 'stable' }}>
                                {candidates.map((c) => {
                                  const sid = String(c.id);
                                  const checked = selectedIds.includes(sid);
                                  return (
                                    <label key={sid} className="flex items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          setAttrEquippedIds((prev) => {
                                            const p = (prev || []).map(x => String(x));
                                            return p.includes(sid) ? p.filter(x => x !== sid) : [...p, sid];
                                          });
                                        }}
                                        className="w-4 h-4"
                                      />
                                      <span>
                                        {c.name}: {c.val >= 0 ? '+' : ''}{c.val}
                                        {c.qty > 1 ? ` x${c.qty} = ${c.total >= 0 ? '+' : ''}${c.total}` : ''}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="font-bold mt-2">
                            Total: {modalForms.attrRolled + raceTotal + modalForms.attrBonus + itemTotal}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <button
                    onClick={() => {
                      const newAttrs = { ...char.attributes };

                      newAttrs[editModal.attr] = {
                        ...newAttrs[editModal.attr],
                        rolledScore: modalForms.attrRolled,
                        bonusMod: modalForms.attrBonus,
                      };

                      const newEquipped = { ...(char.equippedAttrBonuses || { str: [], dex: [], con: [], int: [], wis: [], cha: [] }) };
                      newEquipped[editModal.attr] = (attrEquippedIds || []).map(x => parseInt(x, 10)).filter(n => !isNaN(n));
                      updateChar({ attributes: newAttrs, equippedAttrBonuses: newEquipped });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save
                  </button>
                </div>
              )}

              {editModal.type === 'saveModifier' && (
                <div>
                  <div className="text-sm text-gray-400 mb-3">
                    Temporary modifier for {editModal.attr?.toUpperCase()} saves (bless, curse, magic items, etc.). 
                    Use negative numbers for penalties.
                  </div>
                  <label className="block text-sm text-gray-400 mb-2">{editModal.attr?.toUpperCase()} Save Modifier</label>
                  <DomStepper value={modalForms.saveModInput} onChange={(v) => updateModalForm({ saveModInput: v })} step={1} min={-10} max={10} className="mb-3" />
                  <button
                    onClick={() => {
                      const newAttrs = { ...char.attributes };
                      newAttrs[editModal.attr].saveModifier = modalForms.saveModInput;
                      const newEquipped = { ...(char.equippedAttrBonuses || { str: [], dex: [], con: [], int: [], wis: [], cha: [] }) };
                      newEquipped[editModal.attr] = (attrEquippedIds || []).map(x => parseInt(x, 10)).filter(n => !isNaN(n));
                      updateChar({ attributes: newAttrs, equippedAttrBonuses: newEquipped });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save
                  </button>
                </div>
              )}

              {editModal.type === 'bthBase' && (
                <div>
                  <div className="text-sm text-gray-400 mb-3">Set your character's Base To Hit (BTH). This is your class/level base before attack-specific modifiers.</div>
                  <label className="block text-sm text-gray-400 mb-1">BTH (Base)</label>
                  <DomStepper value={modalForms.bthBase} onChange={(v) => updateModalForm({ bthBase: v })} step={1} min={0} max={30} className="mb-3" />
                  <button
                    onClick={() => {
                      updateChar({ baseBth: modalForms.bthBase });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save
                  </button>
                </div>
              )}

              {editModal.type === 'bonusModifiers' && (
                <div>
                  <div className="text-sm text-gray-400 mb-3">Temporary bonuses from bless, curse, etc. Use negative numbers for penalties.</div>
                  <label className="block text-sm text-gray-400 mb-2">Attack Bonus</label>
                  <DomStepper value={modalForms.attackBonus} onChange={(v) => updateModalForm({ attackBonus: v })} step={1} min={-20} max={20} className="mb-3" />
                  <label className="block text-sm text-gray-400 mb-2">Damage Bonus</label>
                  <DomStepper value={modalForms.damageBonus} onChange={(v) => updateModalForm({ damageBonus: v })} step={1} min={-20} max={20} className="" />
                  <button
                    onClick={() => {
                      updateChar({
                        attackBonus: modalForms.attackBonus,
                        damageBonus: modalForms.damageBonus
                      });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save
                  </button>
                </div>
              )}

              {editModal.type === 'saveModifiers' && (
                <div>
                  <div className="text-sm text-gray-400 mb-3">Temporary bonuses/penalties from bless, curse, etc. Use negative numbers for penalties. This applies to ALL saving throws.</div>
                  <label className="block text-sm text-gray-400 mb-2">Save Bonus</label>
                  <input
                    type="number"
                    value={modalForms.saveBonus}
                    onChange={(e) => updateModalForm({ saveBonus: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                    className="w-full p-2 bg-gray-700 rounded text-white"
                  />
                  <button
                    onClick={() => {
                      updateChar({
                        saveBonus: modalForms.saveBonus
                      });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save
                  </button>
                </div>
              )}

              {editModal.type === 'wallet' && (
                <div>
                  <div className="text-sm text-gray-400 mb-3">
                    Current: <span className="font-bold text-white">{char.moneyGP.toFixed(2)} GP</span>
                    <div className="text-xs mt-1">Conversion: 10 CP = 1 SP, 10 SP = 1 GP, 10 GP = 1 PP</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Copper (CP)</label>
                      <DomStepper value={walletForm.cp} onChange={(v) => updateWalletForm({ cp: v })} step={1} min={0} allowManual />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Silver (SP)</label>
                      <DomStepper value={walletForm.sp} onChange={(v) => updateWalletForm({ sp: v })} step={1} min={0} allowManual />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Gold (GP)</label>
                      <DomStepper value={walletForm.gp} onChange={(v) => updateWalletForm({ gp: v })} step={1} min={0} allowManual />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Platinum (PP)</label>
                      <DomStepper value={walletForm.pp} onChange={(v) => updateWalletForm({ pp: v })} step={1} min={0} allowManual />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      onClick={() => {
                        const totalGP = (walletForm.cp / 100) + (walletForm.sp / 10) + walletForm.gp + (walletForm.pp * 10);

                        if (totalGP !== 0) {
                          updateChar({ moneyGP: char.moneyGP + totalGP });
                        }

                        resetWalletForm();
}}
                      className="py-3 bg-green-600 rounded hover:bg-green-700 font-semibold"
                    >
                      Add
                    </button>

                    <button
                      onClick={() => {
                        const totalGP = (walletForm.cp / 100) + (walletForm.sp / 10) + walletForm.gp + (walletForm.pp * 10);

                        if (totalGP > char.moneyGP) {
                          alert(`Insufficient funds! You need ${(totalGP - char.moneyGP).toFixed(2)} more GP.`);
                          return;
                        }

                        if (totalGP !== 0) {
                          updateChar({ moneyGP: char.moneyGP - totalGP });
                        }

                        resetWalletForm();
}}
                      className="py-3 bg-red-600 rounded hover:bg-red-700 font-semibold"
                    >
                      Spend
                    </button>
                  </div>

                  <button
                    onClick={closeModal}
                    className="w-full py-2 bg-gray-600 rounded hover:bg-gray-500 mt-3"
                  >
                    Close
                  </button>
                </div>
              )}

              {(editModal.type === 'newItem' || editModal.type === 'editItem') && (
                <div className="max-h-96 overflow-y-auto pr-6" style={{ scrollbarGutter: 'stable' }}>
                  <label className="block text-sm text-gray-400 mb-1">Item Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Rope, Health Potion"
                    value={itemForm.name}
                    onChange={(e) => updateItemForm({ name: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                  />
                  
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    placeholder="Item description..."
                    value={itemForm.description}
                    onChange={(e) => updateItemForm({ description: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3 h-20"
                  />
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                      <input
                        type="number"
                        value={itemForm.quantity}
                        onChange={(e) => updateItemForm({ quantity: parseInt(e.target.value) || 1 })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Weight Per Item (lb)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={itemForm.weightPer}
                        onChange={(e) => updateItemForm({ weightPer: parseFloat(e.target.value) || 0 })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
</div>
                  

                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">Worth</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={itemForm.worth}
                        onChange={(e) => updateItemForm({ worth: parseFloat(e.target.value) || 0 })}
                        className="flex-1 p-2 bg-gray-700 rounded text-white"
                        placeholder=""
                      />
                      <select
                        value={itemForm.worthUnit}
                        onChange={(e) => updateItemForm({ worthUnit: e.target.value })}
                        className="w-24 p-2 bg-gray-700 rounded text-white"
                      >
                        <option value="cp">CP</option>
                        <option value="sp">SP</option>
                        <option value="gp">GP</option>
                        <option value="pp">PP</option>
                      </select>
                    </div>
                  </div>

                  <label className="block text-sm text-gray-400 mb-1">Encumbrance Value (EV)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={itemForm.ev}
                    onChange={(e) => updateItemForm({ ev: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                  />

                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* Column 1 */}
                    <label className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={itemIsArmor}
                        onChange={(e) => setItemIsArmor(e.target.checked)}
                        className="w-4 h-4"
                      />
                      Armor
                    </label>

                    {/* Column 2 */}
                    <label className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={itemHasAttrBonus}
                        onChange={(e) => setItemHasAttrBonus(e.target.checked)}
                        className="w-4 h-4"
                      />
                      Stat Bonus
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={itemIsShield}
                        onChange={(e) => setItemIsShield(e.target.checked)}
                        className="w-4 h-4"
                      />
                      Shield
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={itemIsMagicCasting}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setItemIsMagicCasting(checked);
                          if (!checked) setItemIsGrimoire(false);
                        }}
                        className="w-4 h-4"
                      />
                      Magic Casting
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={itemIsWeapon}
                        onChange={(e) => setItemIsWeapon(e.target.checked)}
                        className="w-4 h-4"
                      />
                      Weapon
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={itemHasEffects}
                        onChange={(e) => setItemHasEffects(e.target.checked)}
                        className="w-4 h-4"
                      />
                      Weapon Effects
                    </label>
                  </div>

                    {itemIsMagicCasting && (
                      <div className="bg-gray-900 border border-gray-700 rounded p-3 mb-3">
                        <div className="font-bold text-gray-200 mb-2">Magic Casting</div>
                        <label className="block text-sm text-gray-400 mb-1">Ability Description</label>
                        <textarea
                          value={itemMagicCastingDescription}
                          onChange={(e) => setItemMagicCastingDescription(e.target.value)}
                          className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                          rows={3}
                        />
                        {!itemIsGrimoire && (
                          <>
                            <label className="block text-sm text-gray-400 mb-1">Number of Spells (capacity)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={itemMagicCastingCapacityText}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setItemMagicCastingCapacityText(raw);
                                const parsed = parseInt(raw, 10);
                                if (!Number.isNaN(parsed)) setItemMagicCastingCapacity(parsed);
                              }}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </>
                        )}

                        <label className="flex items-center gap-2 text-sm text-gray-200 mt-3">
                          <input
                            type="checkbox"
                            checked={itemIsGrimoire}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setItemIsGrimoire(checked);
                              if (checked) {
                                setItemMagicCastingCapacity(0);
                                setItemMagicCastingCapacityText('');
                              }
                            }}
                            className="w-5 h-5"
                          />
                          Grimoire
                        </label>
                        <div className="text-xs text-gray-400 mt-1">
                          If checked, this item will appear in the Grimoires section.
                        </div>
                      </div>
                    )}

                  {(itemIsArmor || itemIsShield) && (

                    <div className="mb-3">
                      <label className="block text-sm text-gray-400 mb-1">AC Bonus</label>
                      <input
                        type="number"
                        value={itemForm.acBonus}
                        onChange={(e) => updateItemForm({ acBonus: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                      <div className="text-xs text-gray-400 mt-1">
                        This is the AC bonus the armor/shield provides (for AC Tracking dropdowns).
                      </div>
                    </div>
                  )}
                  {itemIsWeapon && (
                    <div className="mb-3 bg-gray-900/40 p-3 rounded">
                      <div className="font-bold text-sm mb-2">Weapon Bonuses</div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Damage Dice #</label>
                          <input
                            type="number"
                            min="1"
                            value={itemWeaponDamageNumDice}
                            onChange={(e) => setItemWeaponDamageNumDice(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Damage Die</label>
                          <select
                            value={itemWeaponDamageDieType}
                            onChange={(e) => setItemWeaponDamageDieType(parseInt(e.target.value, 10) || 8)}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          >
                            {[2,3,4,6,8,10,12].map((d) => (
                              <option key={d} value={d}>d{d}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <label className="block text-sm text-gray-400 mb-1">Weapon Modes</label>
                      <div className="flex gap-4 mb-3">
                        <label className="flex items-center gap-2 text-sm text-gray-200">
                          <input type="checkbox" checked={itemWeaponMelee} onChange={(e) => setItemWeaponMelee(e.target.checked)} className="w-4 h-4" />
                          Melee (STR)
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-200">
                          <input type="checkbox" checked={itemWeaponRanged} onChange={(e) => setItemWeaponRanged(e.target.checked)} className="w-4 h-4" />
                          Ranged (DEX)
                        </label>
                      </div>
<div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">To Hit: Magic</label>
                          <input
                            type="number"
                            value={itemWeaponToHitMagic}
                            onChange={(e) => setItemWeaponToHitMagic(parseInt(e.target.value || '0', 10) || 0)}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                            id="item-wep-tohit-magic"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">To Hit: Misc</label>
                          <input
                            type="number"
                            value={itemWeaponToHitMisc}
                            onChange={(e) => setItemWeaponToHitMisc(parseInt(e.target.value || '0', 10) || 0)}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                            id="item-wep-tohit-misc"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Damage: Magic</label>
                          <input
                            type="number"
                            value={itemWeaponDamageMagic}
                            onChange={(e) => setItemWeaponDamageMagic(parseInt(e.target.value || '0', 10) || 0)}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                            id="item-wep-dmg-magic"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Damage: Misc</label>
                          <input
                            type="number"
                            value={itemWeaponDamageMisc}
                            onChange={(e) => setItemWeaponDamageMisc(parseInt(e.target.value || '0', 10) || 0)}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                            id="item-wep-dmg-misc"
                          />
                        </div>
                      </div>

                      <div className="text-xs text-gray-400 mt-2">
                        These bonuses are added to attacks when you choose this weapon in the Attack editor.
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
{itemHasAttrBonus && (
                      <div className="mt-2 space-y-2">
                        <div className="font-bold text-gray-200">Stat Bonuses</div>

                        {(itemStatBonuses || []).length === 0 ? (
                          <div className="text-sm text-gray-400">No stat bonuses added yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {(itemStatBonuses || []).map((b, idx) => (
                              <div key={`${b.attr}-${idx}`} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                                <div className="text-sm text-gray-200">
                                  <span className="font-semibold">{String(b.attr || '').toUpperCase()}</span>: {Number(b.value) || 0}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setItemStatBonuses((prev) => (prev || []).filter((_, i) => i !== idx));
                                  }}
                                  className="p-2 bg-red-700 rounded hover:bg-red-600"
                                  title="Remove bonus"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Add Bonus: Stat</label>
                            <select
                              value={itemAttrBonusAttr}
                              onChange={(e) => setItemAttrBonusAttr(e.target.value)}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            >
                              <option value="str">STR</option>
                              <option value="dex">DEX</option>
                              <option value="con">CON</option>
                              <option value="int">INT</option>
                              <option value="wis">WIS</option>
                              <option value="cha">CHA</option>
                              <option value="ac">AC</option>
                              <option value="speed">Speed</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Value</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={itemAttrBonusValueText}
                              onChange={(e) => {
                                const raw = e.target.value;
                                // allow blank while typing; keep digits and optional leading -
                                const cleaned = raw.replace(/[^0-9-]/g, '');
                                setItemAttrBonusValueText(cleaned);
                                const n = parseInt(cleaned || '0', 10);
                                setItemAttrBonusValue(Number.isFinite(n) ? n : 0);
                              }}
                              onBlur={() => {
                                const n = parseInt(itemAttrBonusValueText || '0', 10);
                                const norm = Number.isFinite(n) ? String(n) : '0';
                                setItemAttrBonusValueText(norm);
                                setItemAttrBonusValue(Number.isFinite(n) ? n : 0);
                              }}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const attr = String(itemAttrBonusAttr || '').toLowerCase();
                            const val = Number(itemAttrBonusValue) || 0;
                            if (!attr || val === 0) return;

                            setItemStatBonuses((prev) => {
                              const arr = Array.isArray(prev) ? [...prev] : [];
                              const existingIdx = arr.findIndex(x => String(x.attr || '').toLowerCase() === attr);
                              if (existingIdx >= 0) {
                                arr[existingIdx] = { ...arr[existingIdx], value: (Number(arr[existingIdx].value) || 0) + val };
                              } else {
                                arr.push({ attr, value: val });
                              }
                              return arr;
                            });

                            // reset value for quick entry
                            setItemAttrBonusValue(0);
                            setItemAttrBonusValueText('0');
                          }}
                          className="w-full py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm font-semibold"
                        >
                          + Add Stat Bonus
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    {itemHasEffects && (
                      <div className="bg-gray-900 border border-gray-700 rounded p-3 mt-2">
                    <div className="font-bold text-gray-200 mb-2">Weapon Effects (optional)</div>
                    <div className="text-xs text-gray-400 mb-3">
                      Weapon effects stay attached to the item. You can equip the item in Attack to apply it.
                    </div>

                    {itemEffects && itemEffects.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {itemEffects.map((e) => (
                          <div key={e.id} className="flex items-start justify-between gap-2 bg-gray-800 p-2 rounded">
                            <div className="text-sm text-gray-200">
                              {e.kind === 'attack' ? (
                                <div>
                                  <div className="font-semibold">Attack</div>
                                  <div className="text-xs text-gray-300 space-y-1">
                                    {(Number(e.miscToHit) || 0) !== 0 && (
                                      <div>• Misc {Number(e.miscToHit) >= 0 ? '+' : ''}{Number(e.miscToHit)} hit</div>
                                    )}
                                    {(Number(e.miscDamage) || 0) !== 0 && (
                                      <div>• Misc {Number(e.miscDamage) >= 0 ? '+' : ''}{Number(e.miscDamage)} dmg</div>
                                    )}
                                    {(Number(e.magicToHit) || 0) !== 0 && (
                                      <div>• Magic {Number(e.magicToHit) >= 0 ? '+' : ''}{Number(e.magicToHit)} hit</div>
                                    )}
                                    {(Number(e.magicDamage) || 0) !== 0 && (
                                      <div>• Magic {Number(e.magicDamage) >= 0 ? '+' : ''}{Number(e.magicDamage)} dmg</div>
                                    )}
                                    {(!(Number(e.miscToHit) || 0) && !(Number(e.miscDamage) || 0) && !(Number(e.magicToHit) || 0) && !(Number(e.magicDamage) || 0)) && (
                                      <div>• (no numeric bonuses)</div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="font-semibold">AC</div>
                                  <div className="text-xs text-gray-300">
                                    {Number(e.ac) >= 0 ? '+' : ''}{Number(e.ac) || 0} AC
                                  </div>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => setItemEffects((prev) => (prev || []).filter(x => x.id !== e.id))}
                              className="p-2 bg-red-700 rounded hover:bg-red-600"
                              title="Remove effect"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 mb-3">No effects on this item.</div>
                    )}

                    <div className="bg-gray-800 p-3 rounded">
                      <div className="font-semibold text-gray-200 mb-2">Add Effect</div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Type</label>                        </div>

                      </div>

                      {newEffectKind === 'attack' ? (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Misc To Hit</label>
                            <input
                              type="number"
                              value={newEffectMiscToHit}
                              onChange={(e) => setNewEffectMiscToHit(parseInt(e.target.value || '0', 10) || 0)}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Misc Damage</label>
                            <input
                              type="number"
                              value={newEffectMiscDamage}
                              onChange={(e) => setNewEffectMiscDamage(parseInt(e.target.value || '0', 10) || 0)}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Magic To Hit</label>
                            <input
                              type="number"
                              value={newEffectMagicToHit}
                              onChange={(e) => setNewEffectMagicToHit(parseInt(e.target.value || '0', 10) || 0)}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Magic Damage</label>
                            <input
                              type="number"
                              value={newEffectMagicDamage}
                              onChange={(e) => setNewEffectMagicDamage(parseInt(e.target.value || '0', 10) || 0)}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3">
                          <label className="block text-xs text-gray-400 mb-1">AC</label>
                          <input
                            type="number"
                            value={newEffectAC}
                            onChange={(e) => setNewEffectAC(parseInt(e.target.value || '0', 10) || 0)}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => {
                          const kind = 'attack';
                          const eff = {
                            id: String(Date.now()) + '-' + Math.random().toString(16).slice(2),
                            kind,
                            miscToHit: kind === 'attack' ? (Number(newEffectMiscToHit) || 0) : 0,
                            miscDamage: kind === 'attack' ? (Number(newEffectMiscDamage) || 0) : 0,
                            magicToHit: kind === 'attack' ? (Number(newEffectMagicToHit) || 0) : 0,
                            magicDamage: kind === 'attack' ? (Number(newEffectMagicDamage) || 0) : 0,
                            ac: kind === 'ac' ? (Number(newEffectAC) || 0) : 0
                          };
                          // prevent empty effects
                          const isEmptyAttack = kind === 'attack' && !(eff.miscToHit || eff.miscDamage || eff.magicToHit || eff.magicDamage);
                          const isEmptyAC = kind === 'ac' && !eff.ac;
                          if (isEmptyAttack || isEmptyAC) return;

                          setItemEffects((prev) => ([...(prev || []), eff]));
                          setItemHasEffects(true);
                          // reset values but keep kind/appliesTo
                          setNewEffectMiscToHit(0);
                          setNewEffectMiscDamage(0);
                          setNewEffectMagicToHit(0);
                          setNewEffectMagicDamage(0);
                          
                        }}
                        className="w-full py-2 bg-green-700 rounded hover:bg-green-600 text-sm font-semibold"
                      >
                        + Add Effect
                      </button>
                    </div>
                  </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      const newItem = {
                        id: editModal.item?.id || Date.now(),
                        name: itemForm.name,
                        description: itemForm.description,
                        quantity: itemForm.quantity,
                        weightPer: itemForm.weightPer,
                        ev: itemForm.ev,
                        worthAmount: itemForm.worth || null,
                        worthUnit: itemForm.worthUnit,
                        effects: itemHasEffects ? (Array.isArray(itemEffects) ? itemEffects : []) : [],
                        isArmor: !!itemIsArmor,
                        isShield: !!itemIsShield,
                        isWeapon: !!itemIsWeapon,
                        weaponType: itemIsWeapon ? ((itemWeaponRanged && !itemWeaponMelee) ? 'ranged' : 'melee') : undefined,
                        weaponMelee: itemIsWeapon ? !!itemWeaponMelee : false,
                        weaponRanged: itemIsWeapon ? !!itemWeaponRanged : false,
                        weaponToHitMagic: itemIsWeapon ? (Number(itemWeaponToHitMagic) || 0) : 0,
                        weaponToHitMisc: itemIsWeapon ? (Number(itemWeaponToHitMisc) || 0) : 0,
                        weaponDamageMagic: itemIsWeapon ? (Number(itemWeaponDamageMagic) || 0) : 0,
                        weaponDamageMisc: itemIsWeapon ? (Number(itemWeaponDamageMisc) || 0) : 0,
                        weaponDamageNumDice: itemIsWeapon ? (Number(itemWeaponDamageNumDice) || 1) : 1,
                        weaponDamageDieType: itemIsWeapon ? (Number(itemWeaponDamageDieType) || 8) : 8,
                        acBonus: (itemIsArmor || itemIsShield) ? itemForm.acBonus : 0,
                        hasAttrBonus: !!itemHasAttrBonus && (Array.isArray(itemStatBonuses) ? itemStatBonuses.length > 0 : false),
                        attrBonuses: (itemHasAttrBonus && Array.isArray(itemStatBonuses)) ? itemStatBonuses : [],
                        // Legacy single fields retained for backward compatibility (first bonus only)
                        attrBonusAttr: (itemHasAttrBonus && Array.isArray(itemStatBonuses) && itemStatBonuses[0]) ? itemStatBonuses[0].attr : null,
                        attrBonusValue: (itemHasAttrBonus && Array.isArray(itemStatBonuses) && itemStatBonuses[0]) ? (Number(itemStatBonuses[0].value) || 0) : 0,
                        isMagicCasting: !!itemIsMagicCasting,
                        isGrimoire: !!itemIsGrimoire,
                        magicCastingDescription: String(itemMagicCastingDescription || ''),
                        magicCastingCapacity: (itemIsMagicCasting && !itemIsGrimoire) ? (Number(itemMagicCastingCapacity) || 0) : 0
                      };
                      const newInv = editModal.type === 'newItem' ? 
                        [...char.inventory, newItem] :
                        char.inventory.map(i => i.id === newItem.id ? newItem : i);
                      const nextMagicItems = syncMagicItemForInventoryItem(newItem, char.magicItems || []);
                      // Sync grimoires to inventory items (a grimoire is just a magic-casting inventory item)
                      const linkedId = `inv-${String(newItem.id)}`;
                      const existing = (char.grimoires || []).find(g => String(g.linkedInventoryItemId) === String(newItem.id) || String(g.id) === linkedId);

                      let nextGrimoires = (char.grimoires || []);

                      if (newItem.isMagicCasting && newItem.isGrimoire) {
                        const keptEntries = existing?.entries || [];
                        const grimoireObj = {
                          id: existing?.id || linkedId,
                          name: String(newItem.name || 'Grimoire'),
                          capacity: 39,
                          entries: keptEntries,
                          linkedInventoryItemId: newItem.id
                        };
                        nextGrimoires = existing
                          ? nextGrimoires.map(g => (String(g.id) === String(existing.id) ? grimoireObj : g))
                          : [...nextGrimoires, grimoireObj];
                      } else {
                        // If the item is no longer a grimoire, remove any linked grimoire record
                        nextGrimoires = nextGrimoires.filter(g => String(g.linkedInventoryItemId) !== String(newItem.id) && String(g.id) !== linkedId);
                      }

                      updateChar({ inventory: newInv, magicItems: nextMagicItems, grimoires: nextGrimoires });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save Item
                  </button>

                  {editModal.type === 'editItem' && (
                    <button
                      onClick={() => {
                        const invFiltered = char.inventory.filter(i => i.id !== editModal.item.id);
                        const miFiltered = (char.magicItems || []).filter(mi => String(mi.linkedInventoryItemId) !== String(editModal.item.id) && String(mi.id) !== `linked-${String(editModal.item.id)}`);
                        const linkedId = `inv-${String(editModal.item.id)}`;
                        const grimFiltered = (char.grimoires || []).filter(g => String(g.linkedInventoryItemId) !== String(editModal.item.id) && String(g.id) !== linkedId);
                        const speedFiltered = (char.equippedSpeedItemIds && Array.isArray(char.equippedSpeedItemIds))
                          ? char.equippedSpeedItemIds.filter(x => String(x) !== String(editModal.item.id))
                          : [];
                        updateChar({ inventory: invFiltered, magicItems: miFiltered, grimoires: grimFiltered, equippedSpeedItemIds: speedFiltered });
                        setEditModal(null);
                      }}
                      className="w-full py-2 bg-red-600 rounded hover:bg-red-700 mt-2"
                    >
                      Delete Item
                    </button>
                  )}
                </div>
              )}

              {editModal.type === 'spellStats' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Spell Save DC</label>
                  <input
                    type="number"
                    value={modalForms.spellDC}
                    onChange={(e) => updateModalForm({ spellDC: parseInt(e.target.value) || 10 })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                  />
                  <label className="block text-sm text-gray-400 mb-2">Spell Attack Bonus</label>
                  <input
                    type="number"
                    value={modalForms.spellAtk}
                    onChange={(e) => updateModalForm({ spellAtk: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                    className="w-full p-2 bg-gray-700 rounded text-white"
                  />
                  <button
                    onClick={() => {
                      updateChar({
                        spellSaveDC: modalForms.spellDC,
                        spellAttackBonus: modalForms.spellAtk
                      });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save
                  </button>
                </div>
              )}

              {editModal.type === 'spellSlots' && (
                <div>
                  <div className="text-sm text-gray-400 mb-3">Set the number of spell slots available for each level.</div>
                  <div className="space-y-2">
                    {(char.spellSlots || [0,0,0,0,0,0,0,0,0,0]).map((slots, level) => (
                      <div key={level} className="flex items-center gap-2">
                        <label className="w-32 text-sm font-bold">{level === 0 ? 'Cantrips' : `Level ${level}`}:</label>
                        <input
                          type="number"
                          min="0"
                          defaultValue={slots}
                          className="flex-1 p-2 bg-gray-700 rounded text-white"
                          id={`spell-slot-${level}`}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const newSlots = (char.spellSlots || [0,0,0,0,0,0,0,0,0,0]).map((_, level) => 
                        parseInt(document.getElementById(`spell-slot-${level}`).value) || 0
                      );
                      updateChar({ spellSlots: newSlots });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save Spell Slots
                  </button>
                </div>
              )}

            {editModal.type === 'newMagicItem' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">Item name</label>
                  <input
                    value={modalForms.magicItemName}
                    onChange={(e) => updateModalForm({ magicItemName: e.target.value })}
                    className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded"
                    placeholder="e.g., Scroll Case, Wand of Fireballs"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Number of spells (capacity)</label>
                  <input
                    value={modalForms.magicItemCapacity}
                    onChange={(e) => updateModalForm({ magicItemCapacity: e.target.value })}
                    type="number"
                    min={1}
                    className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-base bg-gray-700 rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const name = modalForms.magicItemName || '';
                      const capacity = Math.max(1, parseInt(modalForms.magicItemCapacity || '5', 10) || 1);
                      if (!name.trim()) return;
                      const newItem = { id: String(Date.now()), name: name.trim(), capacity, spells: [] };
                      updateChar({ magicItems: [...magicItems, newItem] });
                      setEditModal(null);
                    }}
                    className="px-4 py-2 text-base bg-green-600 rounded hover:bg-green-700 font-semibold"
                  >
                    Add Item
                  </button>
                </div>
              </div>
            )}

            {editModal.type === 'confirmDeleteMagicItem' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-200">Are you sure you want to delete this magic item? This cannot be undone.</p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-base bg-gray-700 rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const id = editModal.itemId;
                      updateChar({ magicItems: magicItems.filter(mi => mi.id !== id) });
                      if (selectedMagicItemId === id) setSelectedMagicItemId(null);
                      setEditModal(null);
                    }}
                    className="px-4 py-2 text-base bg-red-600 rounded hover:bg-red-700 font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {editModal.type === 'confirmDeleteCharacter' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-200">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold">
                    {characters?.[editModal.index]?.name || "this character"}
                  </span>
                  ? This cannot be undone.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-base bg-gray-700 rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const idx = editModal.index;
                      deleteCharacter(idx);
                      setEditModal(null);
                    }}
                    className="px-4 py-2 text-base bg-red-600 rounded hover:bg-red-700 font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

              {editModal?.type === 'confirmSellItem' && (() => {
                const sellItem = (char.inventory || []).find(i => String(i.id) === String(editModal.itemId));
                if (!sellItem) return null;

                const amount = (sellItem.worthAmount != null ? Number(sellItem.worthAmount) : (sellItem.worthGP != null ? Number(sellItem.worthGP) : null));
                const unit = String(sellItem.worthUnit || (sellItem.worthGP != null ? 'gp' : 'gp')).toLowerCase();
                const worthAmount = amount != null && Number.isFinite(amount) ? amount : null;
                const worthUnit = ['cp','sp','gp','pp'].includes(unit) ? unit : 'gp';
                if (worthAmount == null || worthAmount <= 0) return null;

                const toGP = (amt, u) => {
                  if (u === 'cp') return amt / 100;
                  if (u === 'sp') return amt / 10;
                  if (u === 'pp') return amt * 10;
                  return amt; // gp
                };

                return (
                  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Sell Item</h2>
                        <button
                          onClick={closeModal}
                          className="p-2 bg-gray-700 rounded hover:bg-gray-600"
                          aria-label="Close"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <p className="text-sm text-gray-200">
                        Are you sure you want to sell{" "}
                        <span className="font-semibold">{sellItem.name}</span> for{" "}
                        <span className="font-semibold">{worthAmount} {worthUnit.toUpperCase()}</span>?
                      </p>

                      <div className="flex justify-end gap-2 pt-4">
                        <button
                          onClick={closeModal}
                          className="px-4 py-2 text-base bg-gray-700 rounded hover:bg-gray-600"
                        >
                          Cancel
                        </button>

                        <button
                          onClick={() => {
                            const worthGP = toGP(worthAmount, worthUnit);
                            const nextInv = (char.inventory || [])
                              .map(i =>
                                i.id === sellItem.id
                                  ? { ...i, quantity: Math.max(0, (i.quantity || 0) - 1) }
                                  : i
                              )
                              .filter(i => (i.quantity || 0) > 0);

                            const updated = nextInv.find(i => String(i.id) === String(sellItem.id));
                            let nextMagicItems = char.magicItems || [];
                            if (updated) {
                              nextMagicItems = syncMagicItemForInventoryItem(updated, nextMagicItems);
                            } else {
                              nextMagicItems = (nextMagicItems || []).filter(mi => String(mi?.id) !== `linked-${String(sellItem.id)}`);
                            }

                            updateChar({
                              inventory: nextInv,
                              magicItems: nextMagicItems,
                              moneyGP: (Number(char.moneyGP) || 0) + worthGP
                            });
                            setEditModal(null);
                          }}
                          className="px-4 py-2 text-base bg-yellow-600 rounded hover:bg-yellow-700 font-semibold"
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {(editModal.type === 'newSpell' || editModal.type === 'editSpell') && (
                <div className="max-h-96 overflow-y-auto pr-6" style={{ scrollbarGutter: 'stable' }}>
                  <label className="block text-sm text-gray-400 mb-1">Spell Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Fireball, Magic Missile"
                    value={spellForm.name}
                    onChange={(e) => updateSpellForm({ name: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                  />
                  
                  <label className="block text-sm text-gray-400 mb-1">Spell Level (0-9)</label>
                  <input
                    type="number"
                    min="0"
                    max="9"
                    value={spellForm.level}
                    onChange={(e) => updateSpellForm({ level: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                  />
                  
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    placeholder="Spell effect..."
                    value={spellForm.description}
                    onChange={(e) => updateSpellForm({ description: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3 h-20"
                  />
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Prep Time</label>
                      <input
                        type="text"
                        placeholder="e.g., 1 action"
                        value={spellForm.prepTime}
                        onChange={(e) => updateSpellForm({ prepTime: e.target.value })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Range</label>
                      <input
                        type="text"
                        placeholder="e.g., 60 ft"
                        value={spellForm.range}
                        onChange={(e) => updateSpellForm({ range: e.target.value })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                  </div>
                  
                  {editModal.type === 'newMagicItemSpell' && (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Copies</label>
                        <input
                          id="magic-item-spell-copies"
                          type="number"
                          min={1}
                          className="w-full p-2 bg-gray-700 rounded text-white"
                          defaultValue={1}
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input id="magic-item-spell-permanent" type="checkbox" className="w-4 h-4" />
                          <span>Permanent (once per day)</span>
                        </label>
                      </div>
                    </div>
                  )}

              

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Duration</label>
                      <input
                        type="text"
                        placeholder="e.g., Instantaneous"
                        value={spellForm.duration}
                        onChange={(e) => updateSpellForm({ duration: e.target.value })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Area of Effect (AoE)</label>
                      <input
                        type="text"
                        placeholder="e.g., 30 ft radius"
                        value={spellForm.aoe}
                        onChange={(e) => updateSpellForm({ aoe: e.target.value })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">Saving Throw</label>
                    <input
                      type="text"
                      placeholder="e.g., Dex half"
                      value={spellForm.savingThrow}
                      onChange={(e) => updateSpellForm({ savingThrow: e.target.value })}
                      className="w-full p-2 bg-gray-700 rounded text-white"
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={spellForm.spellResistance}
                        onChange={(e) => updateSpellForm({ spellResistance: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-bold">Spell Resistance</span>
                    </label>
                  </div>
                  
                  <div className="mb-3 p-3 bg-gray-900 rounded">
                    <div className="font-bold text-sm mb-2">Dice Roll</div>
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={spellForm.hasDiceRoll}
                        onChange={(e) => updateSpellForm({ hasDiceRoll: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Has Dice Roll</span>
                    </label>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Dice Type (e.g., d4, d6, d8)</label>
                      <input
                        type="text"
                        placeholder="e.g., d6"
                        value={spellForm.diceType}
                        onChange={(e) => updateSpellForm({ diceType: e.target.value })}
                        className="w-full p-2 bg-gray-700 rounded text-white text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="mb-3 p-3 bg-gray-900 rounded">
                    <div className="font-bold text-sm mb-2">Components</div>
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={spellForm.verbal}
                        onChange={(e) => updateSpellForm({ verbal: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Verbal</span>
                    </label>
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={spellForm.somatic}
                        onChange={(e) => updateSpellForm({ somatic: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Somatic</span>
                    </label>
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={spellForm.material}
                        onChange={(e) => updateSpellForm({ material: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Material</span>
                    </label>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Material Description</label>
                      <input
                        type="text"
                        placeholder="e.g., a bit of bat fur"
                        value={spellForm.materialDesc}
                        onChange={(e) => updateSpellForm({ materialDesc: e.target.value })}
                        className="w-full p-2 bg-gray-700 rounded text-white text-sm"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const newSpell = {
                        id: editModal.spell?.id || Date.now(),
                        name: spellForm.name,
                        level: spellForm.level,
                        description: spellForm.description,
                        prepTime: spellForm.prepTime,
                        range: spellForm.range,
                        duration: spellForm.duration,
                        aoe: spellForm.aoe,
                        savingThrow: spellForm.savingThrow,
                        spellResistance: spellForm.spellResistance,
                        hasDiceRoll: spellForm.hasDiceRoll,
                        diceType: spellForm.diceType,
                        verbal: spellForm.verbal,
                        somatic: spellForm.somatic,
                        material: spellForm.material,
                        materialDesc: spellForm.materialDesc
                      };

                      const newSpells = editModal.type === 'newSpell' ? 
                        [...char.spellsLearned, newSpell] :
                        char.spellsLearned.map(s => s.id === newSpell.id ? newSpell : s);
                      const prop = buildSpellPropagationUpdates(newSpell);
                              updateChar({ spellsLearned: newSpells, ...prop });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save Spell
                  </button>

                  {editModal.type === 'editSpell' && (
                    <button
                      onClick={() => {
                        updateChar({ 
                          spellsLearned: char.spellsLearned.filter(s => s.id !== editModal.spell.id),
                          spellsPrepared: char.spellsPrepared.filter(s => s.id !== editModal.spell.id)
                        });
                        setEditModal(null);
                      }}
                      className="w-full py-2 bg-red-600 rounded hover:bg-red-700 mt-2"
                    >
                      Delete Spell
                    </button>
                  )}
                </div>
              )}

                            

              {editModal.type === 'newMagicItemSpell' && (
                <div className="space-y-3">
                  <div className="text-sm text-gray-300">
                    Choose a spell from <span className="font-semibold">Spells Learned</span>, or add a new spell first.
                  </div>

                  <label className="block text-sm text-gray-400 mb-1">Choose Spell (from Spells Learned)</label>
                  <select 
                    value={modalForms.magicItemSpellSelect}
                    onChange={(e) => updateModalForm({ magicItemSpellSelect: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white"
                  >
                    <option value="">-- Select a spell --</option>
                    {sortedSpellsLearned.map((s) => (
                      <option key={s.id || s.name} value={s.name}>
                        L{s.level ?? 0} {s.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={openNewSpellModal}
                    className="w-full py-2 bg-gray-700 rounded hover:bg-gray-600 font-semibold"
                  >
                    + Add New Spell to Spells Learned
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Copies</label>
                      <input
                        type="number"
                        min={1}
                        value={modalForms.magicItemSpellCopies}
                        onChange={(e) => updateModalForm({ magicItemSpellCopies: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-200">
                        <input 
                          type="checkbox" 
                          checked={modalForms.magicItemSpellPermanent}
                          onChange={(e) => updateModalForm({ magicItemSpellPermanent: e.target.checked })}
                          className="w-4 h-4" 
                        />
                        <span>Permanent (once per day)</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        const sel = modalForms.magicItemSpellSelect.trim();
                        const spell = (char.spellsLearned || []).find((x) => x.name === sel);
                        if (!spell) {
                          showGameAlert('Add Spell', 'Please select a spell from Spells Learned (or add a new spell first).');
                          return;
                        }
                        addSpellEntriesToMagicItem(editModal.itemId, { ...spell }, modalForms.magicItemSpellCopies, modalForms.magicItemSpellPermanent);
                        setEditModal(null);
                      }}
                      className="flex-1 py-2 bg-blue-600 rounded hover:bg-blue-700 font-semibold"
                    >
                      Add Spell
                    </button>
                    <button
                      onClick={closeModal}
                      className="flex-1 py-2 bg-gray-700 rounded hover:bg-gray-600 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {editModal.type === 'editMagicItemSpell' && (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-6" style={{ scrollbarGutter: 'stable' }}>
                  {(() => {
                    const learnedSorted = sortedSpellsLearned;
                    const selectedName = String(editModal.selectedSpellName || editModal.spellName || '');
                    const selectedSpell =
                      learnedSorted.find((s) => String(s?.name || '') === selectedName) ||
                      editModal.spell ||
                      learnedSorted.find((s) => String(s?.name || '').toLowerCase() === selectedName.toLowerCase()) ||
                      null;

                    return (
                      <>
                        <label className="block text-sm text-gray-400 mb-1">Spell</label>
                        <select
                          value={selectedName}
                          disabled
                          className="w-full p-2 bg-gray-700 rounded text-white opacity-80 cursor-not-allowed"
                        >
                          {learnedSorted.map((s) => (
                            <option key={s.id || s.name} value={s.name}>
                              L{s.level ?? 0} {s.name}
                            </option>
                          ))}
                        </select>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Copies</label>
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={miSpellForm.copies}
                              onChange={(e) => updateMiSpellForm({ copies: e.target.value === '' ? '' : Math.max(1, Math.min(99, parseInt(e.target.value) || 1)) })}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                          <div className="flex items-end">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                              <input 
                                type="checkbox" 
                                checked={miSpellForm.permanent}
                                onChange={(e) => updateMiSpellForm({ permanent: e.target.checked })}
                                className="w-4 h-4" 
                              />
                              <span>Permanent (once per day)</span>
                            </label>
                          </div>
                        </div>

                        <div className="border-t border-gray-700 pt-3 mt-2" />

                        <div className="text-sm font-bold text-gray-200">Spell Details</div>

                        <label className="block text-sm text-gray-400 mb-1">Spell Name</label>
                        <input
                          type="text"
                          value={miSpellForm.name}
                          onChange={(e) => updateMiSpellForm({ name: e.target.value })}
                          className="w-full p-2 bg-gray-700 rounded text-white"
                        />

                        <label className="block text-sm text-gray-400 mb-1">Spell Level (0-9)</label>
                        <input
                          type="number"
                          min="0"
                          max="9"
                          value={miSpellForm.level}
                          onChange={(e) => updateMiSpellForm({ level: Math.max(0, Math.min(9, e.target.value === '' ? '' : (parseInt(e.target.value) || 0))) })}
                          className="w-full p-2 bg-gray-700 rounded text-white"
                        />

                        <label className="block text-sm text-gray-400 mb-1">Description</label>
                        <textarea
                          value={miSpellForm.description}
                          onChange={(e) => updateMiSpellForm({ description: e.target.value })}
                          className="w-full p-2 bg-gray-700 rounded text-white h-20"
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Prep Time</label>
                            <input
                              type="text"
                              value={miSpellForm.prepTime}
                              onChange={(e) => updateMiSpellForm({ prepTime: e.target.value })}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Duration</label>
                            <input
                              type="text"
                              value={miSpellForm.duration}
                              onChange={(e) => updateMiSpellForm({ duration: e.target.value })}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Range</label>
                            <input
                              type="text"
                              value={miSpellForm.range}
                              onChange={(e) => updateMiSpellForm({ range: e.target.value })}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">AoE</label>
                            <input
                              type="text"
                              value={miSpellForm.aoe}
                              onChange={(e) => updateMiSpellForm({ aoe: e.target.value })}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Saving Throw</label>
                            <input
                              type="text"
                              value={miSpellForm.savingThrow}
                              onChange={(e) => updateMiSpellForm({ savingThrow: e.target.value })}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                          <div className="flex items-end">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                              <input
                                type="checkbox"
                                checked={miSpellForm.spellResistance}
                                onChange={(e) => updateMiSpellForm({ spellResistance: e.target.checked })}
                                className="w-4 h-4"
                              />
                              <span>Spell Resistance</span>
                            </label>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-end">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                              <input
                                type="checkbox"
                                checked={miSpellForm.hasDiceRoll}
                                onChange={(e) => updateMiSpellForm({ hasDiceRoll: e.target.checked })}
                                className="w-4 h-4"
                              />
                              <span>Has Dice Roll</span>
                            </label>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Dice Type (e.g. d4, d6)</label>
                            <input
                              type="text"
                              value={miSpellForm.diceType}
                              onChange={(e) => updateMiSpellForm({ diceType: e.target.value })}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => {
                              const itemId2 = editModal.itemId;
                              const oldName = editModal.spellName;
                              const oldPermanent = !!editModal.originalPermanent;

                              const copies = miSpellForm.copies;
                              const newPermanent = miSpellForm.permanent;

                              const updatedSpell = {
                                ...(selectedSpell || {}),
                                name: miSpellForm.name || selectedSpell?.name || '',
                                level: miSpellForm.level,
                                description: miSpellForm.description,
                                prepTime: miSpellForm.prepTime,
                                duration: miSpellForm.duration,
                                range: miSpellForm.range,
                                aoe: miSpellForm.aoe,
                                savingThrow: miSpellForm.savingThrow,
                                spellResistance: miSpellForm.spellResistance,
                                hasDiceRoll: miSpellForm.hasDiceRoll,
                                diceType: miSpellForm.diceType,
                              };

                              // 1) update spellsLearned
                              const newSpellsLearned = (char.spellsLearned || []).map((s) => {
                                if (updatedSpell?.id && s?.id === updatedSpell.id) return { ...s, ...updatedSpell };
                                if (!updatedSpell?.id && String(s?.name || '').toLowerCase() === String(selectedName || '').toLowerCase())
                                  return { ...s, ...updatedSpell };
                                return s;
                              });

                              // 2) propagate updated spell details everywhere (prepared/grimoires/magic items)
                              const prop = buildSpellPropagationUpdates(updatedSpell);
                              const baseMagicItems = prop.magicItems || char.magicItems || [];

                              // 3) update the magic item spell group (copies/permanent) using the propagated magicItems as base
                              const updatedMagicItems = (baseMagicItems || []).map((it) => {
                                if (it.id !== itemId2) return it;
                                const filtered = (it.spells || []).filter(
                                  (e) => !(e?.spell?.name === oldName && !!e?.permanent === oldPermanent)
                                );
                                const newEntries = [];
                                for (let i = 0; i < copies; i++) {
                                  newEntries.push({
                                    spell: { ...updatedSpell },
                                    permanent: newPermanent,
                                    usedToday: false,
                                    numDice: 1,
                                  });
                                }
                                return { ...it, spells: [...filtered, ...newEntries] };
                              });

                              updateChar({
                                spellsLearned: newSpellsLearned,
                                ...(prop || {}),
                                magicItems: updatedMagicItems,
                              });

                              setEditModal(null);
                            }}
                            className="flex-1 py-2 bg-blue-600 rounded hover:bg-blue-700 font-semibold"
                          >
                            Save
                          </button>
                          <button
                            onClick={closeModal}
                            className="flex-1 py-2 bg-gray-700 rounded hover:bg-gray-600 font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
{editModal.type === 'addSpellToGrimoire' && (
                <div>
                  {(() => {
                    const grimoire = (char.grimoires || []).find(g => g.id === editModal.grimoireId);
                    if (!grimoire) return <div className="text-sm text-red-300">Grimoire not found.</div>;
                    const pointsLeft = getGrimoirePointsLeft(grimoire);

                    return (
                      <div>
                        <div className="text-sm text-gray-300 mb-2">
                          <span className="font-bold">{grimoire.name}</span>: {pointsLeft} points left
                        </div>

                        <label className="block text-sm text-gray-400 mb-1">Choose Spell (from Spells Learned)</label>
                        <select 
                          value={modalForms.grimoireSpellSelect}
                          onChange={(e) => updateModalForm({ grimoireSpellSelect: e.target.value })}
                          className="w-full p-2 bg-gray-700 rounded text-white mb-2"
                        >
                          <option value="">-- Select a spell --</option>
                          {sortedSpellsLearned.map(s => {
                            const cost = spellPointCost(s.level);
                            const disabled = cost > pointsLeft;
                            return (
                              <option key={s.id} value={s.id} disabled={disabled}>
                                {`Lvl ${s.level} - ${s.name} (${cost} pt)${disabled ? ' - Not enough space' : ''}`}
                              </option>
                            );
                          })}
                        </select>

                        <div className="text-xs text-gray-400 mb-3">
                          Point cost: Level 0-1 = 1 point, Level 2 = 2 points, Level 3 = 3 points, etc.
                        </div>

                        <button
                          onClick={() => {
                            const spellId = parseInt(modalForms.grimoireSpellSelect);
                            if (!spellId) { alert('Select a spell.'); return; }
                            const spell = (char.spellsLearned || []).find(s => s.id === spellId);
                            if (!spell) { alert('Spell not found.'); return; }
                            addSpellToGrimoire(grimoire.id, spell);
                            setEditModal(null);
                          }}
                          className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                        >
                          Add to Grimoire
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {(editModal.type === 'newCompanion' || editModal.type === 'editCompanion') && (
                <div className="max-h-96 overflow-y-auto pr-6" style={{ scrollbarGutter: 'stable' }}>
                  <label className="block text-sm text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Fluffy, Shadow"
                    value={companionForm.name}
                    onChange={(e) => updateCompanionForm({ name: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                  />
                  
                  <label className="block text-sm text-gray-400 mb-1">Species</label>
                  <input
                    type="text"
                    placeholder="e.g., Wolf, Hawk, Horse"
                    value={companionForm.species}
                    onChange={(e) => updateCompanionForm({ species: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                  />
                  
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    placeholder="Physical description, personality..."
                    value={companionForm.description}
                    onChange={(e) => updateCompanionForm({ description: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3 h-20"
                  />
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Current HP</label>
                      <input
                        type="number"
                        value={companionForm.hp}
                        onChange={(e) => updateCompanionForm({ hp: e.target.value === '' ? '' : (parseInt(e.target.value) || 10) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Max HP</label>
                      <input
                        type="number"
                        value={companionForm.maxHp}
                        onChange={(e) => updateCompanionForm({ maxHp: e.target.value === '' ? '' : (parseInt(e.target.value) || 10) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">AC</label>
                      <input
                        type="number"
                        value={companionForm.ac}
                        onChange={(e) => updateCompanionForm({ ac: e.target.value === '' ? '' : (parseInt(e.target.value) || 10) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Ground Speed (ft)</label>
                      <input
                        type="number"
                        value={companionForm.groundSpeed}
                        onChange={(e) => updateCompanionForm({ groundSpeed: e.target.value === '' ? '' : (parseInt(e.target.value) || 30) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                  </div>
                  
                  <label className="block text-sm text-gray-400 mb-1">Flying Speed (ft, 0 if none)</label>
                  <input
                    type="number"
                    value={companionForm.flySpeed}
                    onChange={(e) => updateCompanionForm({ flySpeed: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                  />
                  
                  <div className="mb-3">
                    <label className="block text-sm font-bold text-gray-300 mb-2">Save Bonuses</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'str', label: 'STR', field: 'saveStr' },
                        { key: 'dex', label: 'DEX', field: 'saveDex' },
                        { key: 'con', label: 'CON', field: 'saveCon' },
                        { key: 'int', label: 'INT', field: 'saveInt' },
                        { key: 'wis', label: 'WIS', field: 'saveWis' },
                        { key: 'cha', label: 'CHA', field: 'saveCha' }
                      ].map(({ key, label, field }) => (
                        <div key={key}>
                          <label className="block text-xs text-gray-400 mb-1">{label}</label>
                          <input
                            type="number"
                            value={companionForm[field]}
                            onChange={(e) => updateCompanionForm({ [field]: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const newComp = {
                        id: editModal.companion?.id || Date.now(),
                        name: companionForm.name,
                        species: companionForm.species,
                        description: companionForm.description,
                        hp: companionForm.hp,
                        maxHp: companionForm.maxHp,
                        ac: companionForm.ac,
                        groundSpeed: companionForm.groundSpeed,
                        flySpeed: companionForm.flySpeed,
                        saves: {
                          str: { bonus: companionForm.saveStr },
                          dex: { bonus: companionForm.saveDex },
                          con: { bonus: companionForm.saveCon },
                          int: { bonus: companionForm.saveInt },
                          wis: { bonus: companionForm.saveWis },
                          cha: { bonus: companionForm.saveCha }
                        },
                        attacks: editModal.companion?.attacks || []
                      };
                      const newComps = editModal.type === 'newCompanion' ? 
                        [...char.companions, newComp] :
                        char.companions.map(c => c.id === newComp.id ? newComp : c);
                      updateChar({ companions: newComps });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                  >
                    Save Companion
                  </button>

                  {editModal.type === 'editCompanion' && (
                    <button
                      onClick={() => {
                        updateChar({ companions: char.companions.filter(c => c.id !== editModal.companion.id) });
                        setEditModal(null);
                      }}
                      className="w-full py-2 bg-red-600 rounded hover:bg-red-700 mt-2"
                    >
                      Delete Companion
                    </button>
                  )}
                </div>
              )}

              {(editModal.type === 'newCompanionAttack' || editModal.type === 'editCompanionAttack') && (
                <div className="max-h-96 overflow-y-auto pr-6" style={{ scrollbarGutter: 'stable' }}>
                  
                  

                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-300">Favorite</div>
                    <button
                      onClick={() => {
                        const updated = { ...(editModal.attack || {}), isFavorite: !(editModal.attack?.isFavorite) };
                        setEditModal({ ...editModal, attack: updated });
                      }}
                      className={`px-3 py-1 rounded text-sm ${editModal.attack?.isFavorite ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                      type="button"
                    >
                      {editModal.attack?.isFavorite ? '★ Favorited' : '☆ Not Favorite'}
                    </button>
                  </div>

<label className="block text-sm text-gray-400 mb-1">Attack Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Bite, Claw"
                    value={compAttackForm.name}
                    onChange={(e) => updateCompAttackForm({ name: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                  />
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Number of Dice</label>
                      <input
                        type="number"
                        min={0}
                        value={compAttackForm.numDice}
                        onChange={(e) => updateCompAttackForm({ numDice: e.target.value === '' ? '' : (parseInt(e.target.value) || 1) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Dice Type</label>
                      <input
                        type="number"
                        value={compAttackForm.dieType}
                        onChange={(e) => updateCompAttackForm({ dieType: e.target.value === '' ? '' : (parseInt(e.target.value) || 6) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">BTH (Base To Hit)</label>
                      <input
                        type="number"
                        value={compAttackForm.bth}
                        onChange={(e) => updateCompAttackForm({ bth: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Modifier</label>
                      <input
                        type="number"
                        value={compAttackForm.mod}
                        onChange={(e) => updateCompAttackForm({ mod: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">To-Hit Magic</label>
                      <input
                        type="number"
                        value={compAttackForm.toHitMagic}
                        onChange={(e) => updateCompAttackForm({ toHitMagic: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">To-Hit Misc</label>
                      <input
                        type="number"
                        value={compAttackForm.toHitMisc}
                        onChange={(e) => updateCompAttackForm({ toHitMisc: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                  </div>

                    </div>
                  </div>
                  
                  <label className="block text-sm text-gray-400 mb-1">Damage Bonus</label>
                  <input
                    type="number"
                    value={compAttackForm.damageBonus}
                    onChange={(e) => updateCompAttackForm({ damageBonus: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                  />

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Damage Magic</label>
                      <input
                        type="number"
                        value={compAttackForm.damageMagic}
                        onChange={(e) => updateCompAttackForm({ damageMagic: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Damage Misc</label>
                      <input
                        type="number"
                        value={compAttackForm.damageMisc}
                        onChange={(e) => updateCompAttackForm({ damageMisc: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const newAttack = {
                        id: editModal.attack?.id || Date.now(),
                        isFavorite: !!editModal.attack?.isFavorite,
                        name: compAttackForm.name,
                        numDice: compAttackForm.numDice,
                        dieType: compAttackForm.dieType,
                        bth: compAttackForm.bth,
                        mod: compAttackForm.mod,
                        toHitMagic: compAttackForm.toHitMagic,
                        toHitMisc: compAttackForm.toHitMisc,
                        damageBonus: compAttackForm.damageBonus,
                        damageMagic: compAttackForm.damageMagic,
                        damageMisc: compAttackForm.damageMisc
                      };
                      
                      const updatedCompanion = { ...editModal.companion };
                      if (editModal.type === 'newCompanionAttack') {
                        updatedCompanion.attacks = [...(updatedCompanion.attacks || []), newAttack];
                      } else {
                        updatedCompanion.attacks = updatedCompanion.attacks.map(a => 
                          a.id === newAttack.id ? newAttack : a
                        );
                      }
                      
                      const newComps = char.companions.map(c => 
                        c.id === updatedCompanion.id ? updatedCompanion : c
                      );
                      updateChar({ companions: newComps });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                  >
                    Save Attack
                  </button>

                  {editModal.type === 'editCompanionAttack' && (
                    <button
                      onClick={() => {
                        const updatedCompanion = { ...editModal.companion };
                        updatedCompanion.attacks = updatedCompanion.attacks.filter(a => a.id !== editModal.attack.id);
                        const newComps = char.companions.map(c => 
                          c.id === updatedCompanion.id ? updatedCompanion : c
                        );
                        updateChar({ companions: newComps });
                        setEditModal(null);
                      }}
                      className="w-full py-2 bg-red-600 rounded hover:bg-red-700 mt-2"
                    >
                      Delete Attack
                    </button>
                  )}
                </div>
              )}

              {(editModal.type === 'newAttack' || editModal.type === 'editAttack') && (
                <div className="max-h-96 overflow-y-auto pr-6" style={{ scrollbarGutter: 'stable' }}>
                  <label className="block text-sm text-gray-400 mb-1">Attack Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Longsword, Compound Bow"
                    value={attackForm.name}
                    onChange={(e) => updateAttackForm({ name: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-2"
                  />

                  {/* Manual attacks: choose melee/ranged so we can default the correct attribute mod */}
                  {!editModal.attack?.weaponId && (
                    <div className="mb-3">
                      <label className="block text-sm text-gray-400 mb-1">Attack Type</label>
                      <select
                        value={attackForm.weaponMode}
                        onChange={(e) => {
                          const mode = e.target.value;
                          updateAttackForm({ weaponMode: mode });
                          setEditModal({
                            ...editModal,
                            attack: {
                              ...(editModal.attack || {}),
                              weaponMode: mode,
                              attrMod: attackForm.attrMod,
                              damageMod: attackForm.damageMod
                            }
                          });
                        }}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      >
                        <option value="melee">Melee (STR)</option>
                        <option value="ranged">Ranged (DEX)</option>
                      </select>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="col-span-2">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={attackForm.useDamageDice}
                          onChange={(e) => updateAttackForm({ useDamageDice: e.target.checked })}
                        />
                        Uses damage dice
                      </label>
                    </div>

                    {attackForm.useDamageDice && (
                      <>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Number of Dice</label>
                          <input
                            type="number"
                            min={1}
                            value={attackForm.numDice}
                            onChange={(e) => updateAttackForm({ numDice: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Dice Type</label>
                          <select
                            value={attackForm.dieType}
                            onChange={(e) => updateAttackForm({ dieType: parseInt(e.target.value) || 8 })}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          >
                            {[2,3,4,6,8,10,12].map(d => (
                              <option key={d} value={d}>d{d}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="border-t border-blue-500 pt-3 mb-3">
                    <div className="font-bold text-blue-400 mb-2">TO HIT BONUSES</div>
                    <label className="block text-xs text-gray-400 mb-1">BTH (Base To Hit)</label>
                    <input
                      type="number"
                      value={attackForm.bth}
                      onChange={(e) => updateAttackForm({ bth: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                      className="w-full p-2 bg-gray-700 rounded text-white mb-2"
                    />
                    <label className="block text-xs text-gray-400 mb-1">Mod (Attribute Modifier)</label>
                    <input
                      type="number"
                      value={attackForm.attrMod}
                      onChange={(e) => updateAttackForm({ attrMod: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                      className="w-full p-2 bg-gray-700 rounded text-white mb-2"
                    />
                    <label className="block text-xs text-gray-400 mb-1">Magic</label>
                    <input
                      type="number"
                      value={attackForm.magic}
                      onChange={(e) => updateAttackForm({ magic: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                      className="w-full p-2 bg-gray-700 rounded text-white mb-2"
                    />
                    <label className="block text-xs text-gray-400 mb-1">Misc</label>
                    <input
                      type="number"
                      value={attackForm.misc}
                      onChange={(e) => updateAttackForm({ misc: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                      className="w-full p-2 bg-gray-700 rounded text-white"
                    />
                  </div>

                  <div className="border-t border-red-500 pt-3">
                    <div className="font-bold text-red-400 mb-2">DAMAGE BONUSES</div>
                    <label className="block text-xs text-gray-400 mb-1">Mod (Attribute Modifier)</label>
                    <DomStepper value={attackForm.damageMod} onChange={(v) => updateAttackForm({ damageMod: v })} step={1} className="mb-2" />
                    <label className="block text-xs text-gray-400 mb-1">Magic</label>
                    <DomStepper value={attackForm.damageMagic} onChange={(v) => updateAttackForm({ damageMagic: v })} step={1} className="mb-2" />
                    <label className="block text-xs text-gray-400 mb-1">Misc</label>
                    <DomStepper value={attackForm.damageMisc} onChange={(v) => updateAttackForm({ damageMisc: v })} step={1} className="mb-2" />
                  </div>

                                    <div className="border-t border-gray-700 pt-3 mt-3">
                    <div className="font-bold mb-2">Apply Item Effects</div>
                    <div className="text-xs text-gray-400 mb-2">Select inventory items whose effects should apply to this attack. Effects remain attached to the item.</div>
                    {(() => {
                      const items = (char.inventory || [])
                        .filter(it => (normalizeItemEffects(it) || []).some(e => e?.kind === 'attack'));
                      if (!items.length) return <div className="text-sm text-gray-400">No attack-effect items in inventory.</div>;

                      const selected = Array.isArray(editModal.attack?.appliedEffectItemIds)
                        ? editModal.attack.appliedEffectItemIds.map(x => String(x))
                        : (Array.isArray(editModal.appliedEffectItemIds) ? editModal.appliedEffectItemIds.map(x => String(x)) : []);

                      const selectedSet = new Set(selected);

                      return (
                        <div className="space-y-2">
                          {items.map(it => {
                            const checked = selectedSet.has(String(it.id));
                            const summary = effectSummary(it, 'attack', char.inventory) || 'Attack effect';
                            return (
                              <label key={it.id} className="flex items-start gap-2 text-sm text-gray-200">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const next = new Set(selectedSet);
                                    if (checked) next.delete(String(it.id)); else next.add(String(it.id));
                                    const arr = Array.from(next);
                                    setEditModal({
                                      ...editModal,
                                      appliedEffectItemIds: arr,
                                      attack: { ...(editModal.attack || {}), appliedEffectItemIds: arr }
                                    });
                                  }}
                                />
                                <div>
                                  <div className="text-gray-200">{it.name || 'Item'}</div>
                                  <div className="text-xs text-gray-400">{summary}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

<button
                    onClick={() => {
                      const existing = (char.attacks || []).find(a => a.id === editModal.attack?.id) || (editModal.attack || {});
                      const appliedIdsRaw = Array.isArray(editModal.attack?.appliedEffectItemIds)
                        ? editModal.attack.appliedEffectItemIds
                        : (Array.isArray(editModal.appliedEffectItemIds) ? editModal.appliedEffectItemIds : []);
                      const appliedEffectItemIds = appliedIdsRaw.map(x => String(x));

                      const newAttack = {
                        // Preserve all existing fields (weapon binding, favorite, mode, etc.)
                        ...existing,
                        ...editModal.attack,
                        id: editModal.attack?.id || existing.id || Date.now(),
                        name: attackForm.name || existing.name || '',
                        numDice: attackForm.useDamageDice ? attackForm.numDice : 0,
                        dieType: attackForm.useDamageDice ? attackForm.dieType : 0,
                        useDamageDice: attackForm.useDamageDice,
                        weaponMode: attackForm.weaponMode || existing.weaponMode || editModal.attack?.weaponMode || 'melee',
                        autoMods: (editModal.attack?.autoMods ?? existing.autoMods ?? (!!(editModal.attack?.weaponId || existing.weaponId) || ['melee','ranged'].includes(attackForm.weaponMode || existing.weaponMode || editModal.attack?.weaponMode || 'melee'))),
                        bthBonus: attackForm.bth,
                        bth: attackForm.bth,
                        attrMod: attackForm.attrMod,
                        magic: attackForm.magic,
                        misc: attackForm.misc,
                        damageMod: attackForm.damageMod,
                        damageMagic: attackForm.damageMagic,
                        damageMisc: attackForm.damageMisc,
                        appliedEffectItemIds
                      };
                      const newAtks = editModal.type === 'newAttack' ? 
                        [...char.attacks, newAttack] :
                        char.attacks.map(a => a.id === newAttack.id ? newAttack : a);
                      updateChar({ attacks: newAtks });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save Attack
                  </button>

                  {editModal.type === 'editAttack' && (
                    <button
                      onClick={() => {
                        updateChar({ attacks: char.attacks.filter(a => a.id !== editModal.attack.id) });
                        setEditModal(null);
                      }}
                      className="w-full py-2 bg-red-600 rounded hover:bg-red-700 mt-2"
                    >
                      Delete Attack
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

}
