// ===== CORE TYPES =====

export interface ItemEffect {
  kind: 'toHit' | 'damage' | 'speed' | 'ac' | 'save' | 'attribute';
  toHit?: number;
  damage?: number;
  speed?: number;
  ac?: number;
  save?: number;
  attribute?: string;
  attributeValue?: number;
  description?: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  weight: number;
  worth: number;
  description: string;
  isWeapon: boolean;
  isArmor: boolean;
  isShield: boolean;
  isMagicCasting: boolean;
  isGrimoire: boolean;
  isAmmo: boolean;
  isPotion: boolean;
  hasAttrBonus: boolean;
  attrBonuses: { attr: string; value: number }[];
  effects?: ItemEffect[];
  weaponDamage?: string;
  weaponType?: string;
  acBonus?: number;
  magicACBonus?: number;
  magicCastingDescription?: string;
  capacity?: number;
  isWeaponEffect?: boolean;
  effectToHitBonus?: number;
  effectDamageBonus?: number;
  effectDescription?: string;
  // Container fields
  isContainer?: boolean;
  containerCapacity?: number;
  isMagicalContainer?: boolean;
  containerMaxWeight?: number;
  storedInId?: number;
  storedCoinsGP?: number;
  // Extended fields
  weightPer?: number;
  ev?: number;
  worthGP?: number;
  worthAmount?: number;
  worthUnit?: string;
  weaponToHitMagic?: number;
  weaponToHitMisc?: number;
  weaponDamageMagic?: number;
  weaponDamageMisc?: number;
  weaponDamageNumDice?: number;
  weaponDamageDieType?: number;
  magicCastingCapacity?: number;
}

export interface Attribute {
  base: number;
  bonus: number;
  tempMod?: number;
}

export interface Attack {
  id: number;
  name: string;
  bth: number;
  mod: number;
  toHitMagic: number;
  toHitMisc: number;
  numDice: number;
  dieType: number;
  damageBonus: number;
  damageMagic: number;
  damageMisc: number;
  notes?: string;
  linkedInventoryItemId?: number;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  description: string;
}

export interface SpellSlot {
  max: number;
  used: number;
}

export interface MagicItemSpell {
  id: string;
  name: string;
  level: number;
  description: string;
  copies: number;
  permanent: boolean;
  usedToday?: boolean;
}

export interface MagicItem {
  id: string;
  name: string;
  description: string;
  charges?: number;
  maxCharges?: number;
  spells?: MagicItemSpell[];
  linkedInventoryItemId?: number;
}

export interface CompanionAttack {
  id: number;
  name: string;
  bth: number;
  mod: number;
  toHitMagic: number;
  toHitMisc: number;
  numDice: number;
  dieType: number;
  damageBonus: number;
  damageMagic: number;
  damageMisc: number;
}

export interface Companion {
  id: number;
  name: string;
  type: string;
  hp: number;
  maxHp: number;
  ac: number;
  attacks: CompanionAttack[];
  notes: string;
}

export interface GrimoireEntry {
  id: string;
  spellId?: string;
  name: string;
  level: number;
  description: string;
}

export interface Grimoire {
  id: string;
  name: string;
  capacity: number;
  entries: GrimoireEntry[];
  linkedInventoryItemId?: number;
}

export interface Wallet {
  platinum: number;
  gold: number;
  electrum: number;
  silver: number;
  copper: number;
}

export interface RaceAttributeMod {
  attr: string;
  value: number;
  description?: string;
}

export interface Character {
  id: number;
  name: string;
  race: string;
  class1: string;
  class1Level: number;
  class2?: string;
  class2Level?: number;
  hp: number;
  maxHpBonus: number;
  hpByLevel: number[];
  levelDrained?: boolean[];
  hpDie: number;
  ac: number;
  acDexBonus: number;
  acBonus: number;
  selectedArmorId: number | null;
  selectedShieldId: number | null;
  speed: number;
  speedBonus: number;
  baseBth: number;
  currentXp: number;
  xpTable: number[];
  primeSaveBonus: number;
  attackBonus: number;
  damageBonus: number;
  attributes: Record<string, Attribute>;
  attacks: Attack[];
  inventory: InventoryItem[];
  spellsLearned: Spell[];
  spellSlots: Record<number, SpellSlot>;
  spellsPrepared: { id: string; spell: Spell }[];
  magicItems: MagicItem[];
  companions: Companion[];
  notes: string;
  classAbilities: string;
  raceAbilities: string;
  advantages: string;
  holySymbol: string;
  age?: string;
  height?: string;
  weight?: string;
  description?: string;
  backstory?: string;
  moneyGP: number;
  includeCoinWeight?: boolean;
  encumbranceEnabled?: boolean;
  wallet?: Wallet;
  // Extended fields
  hpBonus?: number;
  maxHp?: number;
  currentHp?: number;
  acBase?: number;
  acModAuto?: boolean;
  acMod?: number;
  acMagic?: number;
  acMisc?: number;
  equippedArmorId?: number;
  equippedArmorIds?: string[];
  equippedShieldId?: string;
  equippedEffectItemIds?: {
    toHit?: number[];
    damage?: number[];
    speed?: number[];
    ac?: number[];
    save?: number[];
  };
  equippedSpeedItemIds?: number[];
  raceAttributeMods?: RaceAttributeMod[];
  grimoires?: Grimoire[];
  siegeBonus?: number;
  primeAttributes?: string[];
}

export interface StorageData {
  version: number;
  savedAt: string;
  characters: Character[];
}

// ===== UI STATE TYPES =====

export interface ModalForms {
  hpCurrent: number;
  hpDelta: number | string;
  acBase: number;
  acMod: number;
  acModAuto: boolean;
  acMagic: number;
  acMisc: number;
  acBonus: number;
  speedBase: number;
  speedBonus: number;
  xpToAdd: number | string;
  spellDC: number;
  spellAtk: number;
  hpBonus: number;
}

export interface WalletForm {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
  selectedCoinContainer: number | null;
}

export interface ItemForm {
  name: string;
  description: string;
  quantity: number;
  weightPer: string;
  ev: string;
  worth: number;
  worthUnit: string;
  acBonus: number;
  magicACBonus: number;
}

export interface SpellForm {
  name: string;
  level: number;
  description: string;
}

export interface AttackForm {
  name: string;
  bth: number;
  mod: number;
  toHitMagic: number;
  toHitMisc: number;
  numDice: number;
  dieType: number;
  damageBonus: number;
  damageMagic: number;
  damageMisc: number;
  notes: string;
}

export interface CompanionForm {
  name: string;
  type: string;
  hp: number;
  maxHp: number;
  ac: number;
  notes: string;
}

export interface EncumbranceInfo {
  rating: number;
  totalEV: number;
  totalWeight: number;
  coinWeight: number;
  coinEV: number;
  status: 'unburdened' | 'burdened' | 'overburdened';
  speedPenalty: number;
}

export interface LevelInfo {
  nextLevelXp: number;
  progress: number;
  canLevelUp: boolean;
  currentLevel: number;
  drainedLevels: number;
  effectiveLevel: number;
  xpEarnedLevel: number;
}

export interface ContainerInfo {
  items: InventoryItem[];
  itemCount: number;
  totalWeight: number;
  capacity: number;
  maxWeight: number;
  isMagical: boolean;
  storedCoinsGP: number;
  storedCoinsWeight: number;
}

// ===== THEME TYPES =====

export interface Theme {
  bg: string;
  text: string;
  card: string;
  cardBorder: string;
  input: string;
  inputBorder: string;
  button: string;
  buttonHover: string;
  accent: string;
}

export const darkTheme: Theme = {
  bg: 'bg-gray-900',
  text: 'text-white',
  card: 'bg-gray-800',
  cardBorder: 'border-gray-700',
  input: 'bg-gray-700',
  inputBorder: 'border-gray-600',
  button: 'bg-gray-700',
  buttonHover: 'hover:bg-gray-600',
  accent: 'text-blue-400'
};

export const lightTheme: Theme = {
  bg: 'bg-gray-100',
  text: 'text-gray-900',
  card: 'bg-white',
  cardBorder: 'border-gray-300',
  input: 'bg-gray-50',
  inputBorder: 'border-gray-300',
  button: 'bg-gray-200',
  buttonHover: 'hover:bg-gray-300',
  accent: 'text-blue-600'
};
