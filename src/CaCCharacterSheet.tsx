import React, { useEffect, useState, useCallback, useMemo, useRef, Component, ErrorInfo, ReactNode, ChangeEvent } from 'react';
import { Plus, Minus, Edit2, X, Trash2, Download, Upload, Info, ChevronRight, ChevronDown } from 'lucide-react';

// ===== CONSTANTS =====
const STORAGE_KEY = 'cac-character-sheet-data';
const STORAGE_VERSION = 1;
const AUTO_SAVE_DELAY_MS = 500;
const TOAST_DURATION_MS = 3000;
const VIRTUALIZED_LIST_THRESHOLD = 15;
const DEFAULT_ITEM_HEIGHT = 120;
const DEFAULT_CONTAINER_HEIGHT = 500;
const DEFAULT_OVERSCAN = 3;
const MIN_SWIPE_DISTANCE = 50;

// ===== ID GENERATION =====
/** Generate a unique ID using crypto API with fallback */
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/** Generate a numeric ID (for compatibility with existing data) */
const generateNumericId = (): number => Date.now();

// ===== TYPESCRIPT INTERFACES =====
interface Attribute {
  rolledScore: number;
  raceBonus: number;
  bonusMod: number;
  isPrime: boolean;
  saveModifier: number;
}

interface Attack {
  id: number;
  name: string;
  weaponMode: 'melee' | 'ranged' | 'finesse';
  autoMods: boolean;
  attrMod: number;
  damageMod: number;
  usesDamageDice: boolean;
  numDice: number;
  dieType: number;
  magic: number;
  misc: number;
  damageMagic: number;
  damageMisc: number;
  bth: number;
  isFavorite: boolean;
  weaponId?: number;
  effectIds?: number[];
  appliedEffectItemIds?: (string | number)[];
}

interface InventoryItem {
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
  isGem: boolean;
  hasAttrBonus: boolean;
  attrBonuses: { attr: string; value: number }[];
  effects?: ItemEffect[];
  weaponDamage?: string;
  weaponType?: string;
  weaponExtraDice?: { numDice: number; dieType: number; label?: string }[];  // Extra damage dice (e.g., on failed save)
  acBonus?: number;
  magicACBonus?: number;  // Magic bonus to AC for armor/shields
  magicCastingDescription?: string;
  capacity?: number;
  isWeaponEffect?: boolean;
  effectToHitBonus?: number;
  effectDamageBonus?: number;
  effectDescription?: string;
  // Container fields
  isContainer?: boolean;
  containerCapacity?: number;  // Max number of items (for normal containers)
  isMagicalContainer?: boolean;
  containerMaxWeight?: number;  // Max weight it can hold (for magical containers)
  storedInId?: number;  // ID of container this item is stored in
  storedCoinsGP?: number;  // DEPRECATED - GP value of coins stored (kept for migration)
  storedCoins?: {  // Individual coin counts stored in this container
    platinum: number;
    gold: number;
    electrum: number;
    silver: number;
    copper: number;
  };
}

interface ItemEffect {
  id?: string;
  kind?: 'attack' | 'ac';
  miscToHit?: number;
  miscDamage?: number;
  magicToHit?: number;
  magicDamage?: number;
  ac?: number;
}

interface Spell {
  id: number | string;
  name: string;
  level: number;
  description: string;
  prepTime: string;
  range: string;
  duration: string;
  aoe?: string;
  savingThrow?: string;
  spellResistance?: boolean;
  hasDiceRoll?: boolean;
  diceType?: string;
  perLevelBonus?: number;  // Bonus per caster level (e.g., 1 = +1 per level, 2 = +2 per level)
  verbal?: boolean;
  somatic?: boolean;
  material?: boolean;
  materialDesc?: string;
  isItemOnly?: boolean;
}

interface SpellSlot {
  total: number;
  used: number;
}

interface Companion {
  id: number;
  name: string;
  type: string;
  hp: number;
  maxHp: number;
  ac: number;
  speed: string;
  abilities: string;
  attacks: CompanionAttack[];
}

interface CompanionAttack {
  id: number;
  name: string;
  toHit: number;
  damage: string;
  notes: string;
}

interface MagicItem {
  id: number;
  itemId: number;
  name: string;
  capacity: number;
  isGrimoire: boolean;
  spells: MagicItemSpellEntry[];
}

interface MagicItemSpellEntry {
  id: string;
  spell: Spell;
  permanent: boolean;
  usedToday?: boolean;
}

interface Character {
  id: number;
  name: string;
  race: string;
  class1: string;
  class1Level: number;
  class2?: string;
  class2Level?: number;
  class3?: string;  // For 3-class multiclass
  hp: number;
  maxHpBonus: number;
  hpByLevel: number[];
  hpRollsByLevel?: number[];  // Stores just the base roll for each level (without CON mod)
  levelDrained?: boolean[];  // Track which levels are drained (unchecked = drained)
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
  // Multiclass XP tables - each class has its own XP requirements
  xpTableClass1?: number[];
  xpTableClass2?: number[];
  xpTableClass3?: number[];
  classType?: 'single' | 'multi' | 'classAndHalf';  // Type of class setup
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
  classAttributeMods?: { attr: string; value: number; valueText?: string; description?: string }[];
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
  encumbranceEnabled?: boolean;  // defaults to true
  wallet?: {
    platinum: number;
    gold: number;
    electrum: number;
    silver: number;
    copper: number;
  };
  counters?: { id: number; description: string; maxUses: number; currentUses: number }[];
}

interface StorageData {
  version: number;
  savedAt: string;
  characters: Character[];
}

// ===== ERROR BOUNDARY =====
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Character Sheet Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h2>
            <p className="text-gray-300 mb-4">
              The app encountered an error. Your data is safe in local storage.
            </p>
            <p className="text-sm text-gray-500 mb-4 font-mono bg-gray-900 p-2 rounded overflow-auto max-h-32">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 font-semibold"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
// ===== END ERROR BOUNDARY =====

// ===== MODAL ERROR BOUNDARY =====
interface ModalErrorBoundaryProps {
  children: ReactNode;
  onClose?: () => void;
  fallbackTitle?: string;
}

interface ModalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for modals.
 * When a modal crashes, it shows an error message and allows closing
 * without crashing the entire app.
 */
class ModalErrorBoundary extends Component<ModalErrorBoundaryProps, ModalErrorBoundaryState> {
  constructor(props: ModalErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ModalErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Modal Error:', error, errorInfo);
  }

  handleClose = () => {
    this.setState({ hasError: false, error: null });
    this.props.onClose?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-red-400 mb-3">
              {this.props.fallbackTitle || 'Modal Error'}
            </h2>
            <p className="text-gray-300 mb-3">
              Something went wrong displaying this content.
            </p>
            <p className="text-sm text-gray-500 mb-4 font-mono bg-gray-900 p-2 rounded overflow-auto max-h-24">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={this.handleClose}
              className="w-full px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
// ===== END MODAL ERROR BOUNDARY =====

// ===== LOADING SPINNER COMPONENT =====
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };
  
  return (
    <div 
      className={`${sizeClasses[size]} border-gray-600 border-t-blue-500 rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
};
// ===== END LOADING SPINNER =====

// Light theme CSS overrides
const lightThemeStyles = `
  .light-theme {
    --bg-primary: #f3f4f6;
    --bg-card: #ffffff;
    --bg-card-2: #e5e7eb;
    --bg-card-3: #d1d5db;
    --bg-input: #ffffff;
    --text-primary: #111827;
    --text-muted: #6b7280;
    --border-color: #d1d5db;
  }
  .light-theme .bg-gray-900 { background-color: var(--bg-primary) !important; }
  .light-theme .bg-gray-800 { background-color: var(--bg-card) !important; border: 1px solid var(--border-color); }
  .light-theme .bg-gray-700 { background-color: var(--bg-card-2) !important; }
  .light-theme .bg-gray-600 { background-color: var(--bg-card-3) !important; }
  .light-theme .text-white { color: var(--text-primary) !important; }
  .light-theme .text-gray-400 { color: var(--text-muted) !important; }
  .light-theme .text-gray-300 { color: #374151 !important; }
  .light-theme .text-gray-200 { color: #1f2937 !important; }
  .light-theme .border-gray-600 { border-color: var(--border-color) !important; }
  .light-theme .border-gray-700 { border-color: #e5e7eb !important; }
  .light-theme input, .light-theme textarea, .light-theme select {
    background-color: var(--bg-input) !important;
    color: var(--text-primary) !important;
    border: 1px solid var(--border-color) !important;
  }
  .light-theme .hover\\:bg-gray-600:hover { background-color: #d1d5db !important; }
  .light-theme .hover\\:bg-gray-500:hover { background-color: #9ca3af !important; }
  
  /* Lighten colored buttons for better black text contrast */
  .light-theme .bg-blue-600 { background-color: #93c5fd !important; }
  .light-theme .bg-blue-700 { background-color: #60a5fa !important; }
  .light-theme .hover\\:bg-blue-700:hover { background-color: #60a5fa !important; }
  .light-theme .hover\\:bg-blue-500:hover { background-color: #93c5fd !important; }
  
  .light-theme .bg-purple-600 { background-color: #c4b5fd !important; }
  .light-theme .bg-purple-700 { background-color: #a78bfa !important; }
  .light-theme .hover\\:bg-purple-700:hover { background-color: #a78bfa !important; }
  
  .light-theme .bg-green-600 { background-color: #86efac !important; }
  .light-theme .bg-green-700 { background-color: #4ade80 !important; }
  .light-theme .hover\\:bg-green-700:hover { background-color: #4ade80 !important; }
  
  .light-theme .bg-red-600 { background-color: #fca5a5 !important; }
  .light-theme .bg-red-700 { background-color: #f87171 !important; }
  .light-theme .hover\\:bg-red-700:hover { background-color: #f87171 !important; }
  
  .light-theme .bg-yellow-600 { background-color: #fde047 !important; }
  .light-theme .bg-yellow-700 { background-color: #facc15 !important; }
  .light-theme .hover\\:bg-yellow-700:hover { background-color: #facc15 !important; }
  
  .light-theme .bg-orange-600 { background-color: #fdba74 !important; }
  .light-theme .bg-orange-700 { background-color: #fb923c !important; }
  .light-theme .hover\\:bg-orange-700:hover { background-color: #fb923c !important; }
  
  /* Critical hit text - use darker gold/orange in light mode */
  .light-theme .text-yellow-400 { color: #b45309 !important; }
  .light-theme .text-yellow-500 { color: #a16207 !important; }
  .light-theme .text-yellow-200 { color: #92400e !important; }
  
  /* Yellow backgrounds for critical sections */
  .light-theme .bg-yellow-900 { background-color: #fef3c7 !important; border-color: #f59e0b !important; }
  .light-theme .border-yellow-600 { border-color: #d97706 !important; }
`;

// ===== LOCAL STORAGE PERSISTENCE =====

const saveToLocalStorage = (characters: Character[]): boolean => {
  try {
    const data: StorageData = {
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

const loadFromLocalStorage = (): Character[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: StorageData = JSON.parse(raw);
    // Handle version migrations here if needed in the future
    return data.characters || [];
  } catch (err) {
    console.error('Failed to load from localStorage:', err);
    return null;
  }
};

const exportToFile = (characters: Character[]): void => {
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

const importFromFile = (file: File): Promise<Character[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = JSON.parse(e.target?.result as string);
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

interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}

/** Debounced input component for text fields */
const DebouncedInput = React.memo(function DebouncedInput({ 
  value, 
  onChange, 
  debounceMs = 300,
  ...props 
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sync local value when external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
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

interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}

/** Debounced textarea component */
const DebouncedTextarea = React.memo(function DebouncedTextarea({ 
  value, 
  onChange, 
  debounceMs = 300,
  ...props 
}: DebouncedTextareaProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
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

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
  className?: string;
  emptyMessage?: string;
}

/** Virtualized list component for long lists (inventory, spells, etc.) */
const VirtualizedList = React.memo(function VirtualizedList<T extends { id?: number | string }>({
  items,
  renderItem,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  containerHeight = DEFAULT_CONTAINER_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
  className = '',
  emptyMessage = 'No items'
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  const { visibleItems, startIndex, totalHeight, offsetY } = useMemo(() => {
    if (!items || items.length === 0) {
      return { visibleItems: [] as T[], startIndex: 0, totalHeight: 0, offsetY: 0 };
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
  if (items.length <= VIRTUALIZED_LIST_THRESHOLD) {
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
}) as <T extends { id?: number | string }>(props: VirtualizedListProps<T>) => React.ReactElement;

// ===== END UTILITY FUNCTIONS =====

/** Calculate attribute modifier based on score */
const calcMod = (value: number): number => {
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

/** Clamp a number between min and max bounds */
function clamp(n: number, min: number | null, max: number | null): number {
  if (min != null && n < min) return min;
  if (max != null && n > max) return max;
  return n;
}

interface DomStepperProps {
  id?: string;
  defaultValue?: number;
  value?: number;
  onChange?: (value: number) => void;
  step?: number;
  min?: number | null;
  max?: number | null;
  className?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  allowManual?: boolean;
  resetToken?: number;
  label?: string; // For accessibility
}

/**
 * Touch-friendly numeric control that supports both:
 * 1. Legacy mode: uses hidden input with id for document.getElementById access
 * 2. Controlled mode: uses value/onChange props like a standard React input
 * 
 * Accessibility features:
 * - Keyboard navigation (Arrow keys, Home, End)
 * - ARIA labels and live regions
 * - Focus management
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
  label,
}: DomStepperProps) {
  // Use controlled mode if value prop is provided
  const isControlled = controlledValue !== undefined;
  const [internalVal, setInternalVal] = useState(Number(defaultValue) || 0);
  
  const val = isControlled ? controlledValue : internalVal;
  const setVal = isControlled 
    ? (newVal: number | ((prev: number) => number)) => {
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

  const dec = useCallback(() => setVal((v: number) => clamp((Number(v) || 0) - step, min, max)), [setVal, step, min, max]);
  const inc = useCallback(() => setVal((v: number) => clamp((Number(v) || 0) + step, min, max)), [setVal, step, min, max]);

  // Keyboard handler for the container
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault();
        inc();
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault();
        dec();
        break;
      case 'Home':
        if (min !== null) {
          e.preventDefault();
          setVal(min);
        }
        break;
      case 'End':
        if (max !== null) {
          e.preventDefault();
          setVal(max);
        }
        break;
    }
  }, [inc, dec, min, max, setVal]);

  const ariaLabel = label || 'Numeric value';
  const ariaValueText = `${valuePrefix}${val}${valueSuffix}`;

  return (
    <div 
      className={`flex items-center gap-1 ${className}`}
      role="spinbutton"
      aria-label={ariaLabel}
      aria-valuenow={val}
      aria-valuemin={min ?? undefined}
      aria-valuemax={max ?? undefined}
      aria-valuetext={ariaValueText}
      tabIndex={allowManual ? -1 : 0}
      onKeyDown={allowManual ? undefined : handleKeyDown}
    >
      <button
        type="button"
        onClick={dec}
        className="h-11 w-11 min-w-[2.75rem] flex-shrink-0 rounded-lg bg-gray-700 hover:bg-gray-600 text-xl font-bold active:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Decrease ${ariaLabel}`}
        tabIndex={-1}
      >
        −
      </button>

      {allowManual ? (

        <input
          type="text"
          inputMode="numeric"
          value={val === 0 ? '' : String(val)}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const raw = String(e.target.value || '');
            if (raw === '' || raw === '-') {
              setVal(0);
              return;
            }
            const cleaned = raw.replace(/(?!^)-/g, '').replace(/[^\d-]/g, '');
            const next = parseInt(cleaned, 10);
            setVal(Number.isFinite(next) ? clamp(next, min, max) : 0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="0"
          aria-label={ariaLabel}
          className="min-w-0 flex-1 text-center text-base font-semibold bg-gray-800 rounded-lg h-11 px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

      ) : (

        <div 
          className="min-w-0 flex-1 text-center text-base font-semibold bg-gray-800 rounded-lg h-11 flex items-center justify-center px-1"
          aria-hidden="true"
        >
          {valuePrefix}{val}{valueSuffix}
        </div>

      )}

      <button
        type="button"
        onClick={inc}
        className="h-11 w-11 min-w-[2.75rem] flex-shrink-0 rounded-lg bg-gray-700 hover:bg-gray-600 text-xl font-bold active:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Increase ${ariaLabel}`}
        tabIndex={-1}
      >
        +
      </button>

      {/* Hidden input for legacy getElementById access - only rendered if id is provided */}
      {id && <input type="text" inputMode="numeric" id={id} value={val} readOnly className="hidden" aria-hidden="true" />}
    </div>
  );
});

/** Generate name for unarmed attacks */
const getUnarmedAttackName = (attacks: Attack[] | null | undefined): string => {
  const count = (attacks || []).filter(a => (a?.name || '').startsWith('Unarmed Attack')).length;
  if (count === 0) return 'Unarmed Attack (Primary)';
  if (count === 1) return 'Unarmed Attack (Secondary)';
  if (count === 2) return 'Unarmed Attack (Tertiary)';
  return `Unarmed Attack (${count + 1}th)`;
};

/** Get available weapon modes for an inventory item */
const getWeaponModes = (item: InventoryItem | null | undefined): ('melee' | 'ranged')[] => {
  const modes: ('melee' | 'ranged')[] = [];
  const melee = item?.weaponMelee ?? ((item?.weaponType || 'melee') === 'melee');
  const ranged = item?.weaponRanged ?? ((item?.weaponType || 'melee') === 'ranged');
  if (melee) modes.push('melee');
  if (ranged) modes.push('ranged');
  return modes;
};

/** Get display name for a weapon-bound attack */
const getBoundAttackName = (attack: Attack | null | undefined, inventory: InventoryItem[] | null | undefined): string => {
  if (!attack?.weaponId) return attack?.name || '';
  const item = (inventory || []).find(it => String(it.id) === String(attack.weaponId));
  const baseName = item?.name || 'Weapon';
  const mode = (attack.weaponMode || item?.weaponType || 'melee');
  const modeLabel = mode === 'ranged' ? 'Ranged' : 'Melee';
  return `${baseName} (${modeLabel})`;
};

// ===== Inventory Item Effects (attack/AC boosters that remain attached to the item) =====

interface EquippedEffectShape {
  attack: string[];
  unarmed: string[];
  ac: string[];
}

interface NormalizedEffect {
  id: string;
  kind: 'attack' | 'ac';
  miscToHit?: number;
  miscDamage?: number;
  magicToHit?: number;
  magicDamage?: number;
  ac?: number;
}

/** Ensure equipped effect IDs have the correct shape */
const ensureEquippedEffectShape = (char: Character | null | undefined): EquippedEffectShape => {
  const cur = (char && char.equippedEffectItemIds && typeof char.equippedEffectItemIds === 'object')
    ? char.equippedEffectItemIds
    : {};
  return {
    attack: Array.isArray(cur.attack) ? cur.attack.map(x => String(x)) : [],
    unarmed: Array.isArray(cur.unarmed) ? cur.unarmed.map(x => String(x)) : [],
    ac: Array.isArray(cur.ac) ? cur.ac.map(x => String(x)) : []
  };
};

/** Normalize item effects to a consistent format */
const normalizeItemEffects = (item: InventoryItem | null | undefined): NormalizedEffect[] => {
  // Effects are attached to the inventory item. An item can have multiple effects.
  // Shape: { id, kind: 'attack' | 'ac', miscToHit, miscDamage, magicToHit, magicDamage, ac }
  const raw = Array.isArray(item?.effects) ? item.effects : [];

  const normalized: NormalizedEffect[] = raw.map((e, idx: number) => {
    if (!e) return null;

    const id = e.id ?? `${item?.id || 'item'}-eff-${idx}`;
    const kind: 'attack' | 'ac' = e.kind === 'ac' ? 'ac' : 'attack';

    return {
      id: String(id),
      kind,
      miscToHit: Number(e.miscToHit) || 0,
      miscDamage: Number(e.miscDamage) || 0,
      magicToHit: Number(e.magicToHit) || 0,
      magicDamage: Number(e.magicDamage) || 0,
      ac: Number(e.ac) || 0
    };
  }).filter(Boolean) as NormalizedEffect[];

  // If the item uses the Attribute Bonus system to grant AC, expose it as an AC effect
  // so it can be equipped via AC Tracking -> Defense Items.
  if (item?.hasAttrBonus) {
    const bonusesArr = Array.isArray(item.attrBonuses) ? item.attrBonuses : [];
    const acBonus = bonusesArr.find(b => String(b?.attr || '').toLowerCase() === 'ac');
    if (acBonus && (Number(acBonus.value) || 0) !== 0) {
      normalized.push({
        id: `attrbonus-ac-${item?.id || 'item'}`,
        kind: 'ac',
        ac: Number(acBonus.value) || 0
      });
    }
  }

return normalized;
};

/** Generate a summary string for item effects */
const effectSummary = (item: InventoryItem | null | undefined, section: 'attack' | 'ac', inventory: InventoryItem[] | null | undefined): string => {
  const effects = normalizeItemEffects(item);
  if (!effects?.length) return '';

  const parts: string[] = [];
  for (const e of effects) {
    if (!e) continue;

    // Attack effects: show once (we no longer split unarmed vs weapon at the item level)
    if (e.kind === 'attack' && section === 'attack') {
      const bits: string[] = [];
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

interface EffectBonuses {
  miscToHit: number;
  miscDamage: number;
  magicToHit: number;
  magicDamage: number;
}

/** Sum up all effect bonuses for a given attack */
const sumEffectBonusesForAttack = (char: Character | null | undefined, attack: Attack | null | undefined): EffectBonuses => {
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

/** Sum up AC bonuses from equipped effect items */
const sumEffectAC = (char: Character | null | undefined): number => {
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

/** Create a new character with default values */
const createNewCharacter = (): Character => ({
  id: generateNumericId(),
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
  classAttributeMods: [],
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
    str: { rolledScore: 10, raceBonus: 0, bonusMod: 0, isPrime: false, saveModifier: 0 },
    dex: { rolledScore: 10, raceBonus: 0, bonusMod: 0, isPrime: false, saveModifier: 0 },
    con: { rolledScore: 10, raceBonus: 0, bonusMod: 0, isPrime: false, saveModifier: 0 },
    int: { rolledScore: 10, raceBonus: 0, bonusMod: 0, isPrime: false, saveModifier: 0 },
    wis: { rolledScore: 10, raceBonus: 0, bonusMod: 0, isPrime: false, saveModifier: 0 },
    cha: { rolledScore: 10, raceBonus: 0, bonusMod: 0, isPrime: false, saveModifier: 0 }
  },
  xpTable: [0, 2000, 4000, 8000, 16000, 32000, 64000, 120000, 240000, 360000, 480000, 600000, 720000, 840000, 960000, 1080000, 1200000, 1320000, 1440000, 1560000, 1680000, 1800000, 1920000, 2040000, 2160000],
  hpByLevel: [0, 0, 0],
  hpRollsByLevel: [0, 0, 0],
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
  initiativeBonuses: [],
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
  return (
    <ErrorBoundary>
      <CaCCharacterSheetInner />
    </ErrorBoundary>
  );
}

function CaCCharacterSheetInner() {
  const [characters, setCharacters] = useState([]);
  const [currentCharIndex, setCurrentCharIndex] = useState(null);
  const [activeTab, setActiveTab] = useState('main');
  const [editModal, setEditModal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Move to container modal state
  const [moveToContainerModal, setMoveToContainerModal] = useState<{
    sourceItemId: number;
    containerId: number;
    maxQty: number;
    qty: string;
    itemName: string;
  } | null>(null);
  
  // Counter modal state
  const [counterModal, setCounterModal] = useState<{
    type: 'add' | 'edit';
    counter?: { id: number; description: string; maxUses: number; currentUses: number };
    description: string;
    uses: string;
  } | null>(null);
  const [countersExpanded, setCountersExpanded] = useState(true);
  const [diceRollerExpanded, setDiceRollerExpanded] = useState(true);
  
  // Class modal state - tracks step in class setup wizard
  const [classModalStep, setClassModalStep] = useState<'choose' | 'setup'>('setup');
  const [classModalForm, setClassModalForm] = useState({
    classType: 'single' as 'single' | 'multi' | 'classAndHalf',
    class1: '',
    class2: '',
    class3: '',
    showClass3: false
  });
  
  // Attribute roller state
  const [attributeRollerOpen, setAttributeRollerOpen] = useState(false);
  const [attributeRolls, setAttributeRolls] = useState([]); // Array of 6 rolls
  const [showRolledAttributes, setShowRolledAttributes] = useState(false);
  const [attributeRollMethod, setAttributeRollMethod] = useState(2); // 1, 2, or 3
  
  // Track if user has seen app info - persisted to localStorage
  const [hasSeenAppInfo, setHasSeenAppInfo] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cac-seen-app-info') === 'true';
    }
    return false;
  });
  
  // Theme state - persisted to localStorage
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cac-theme');
      return saved !== 'light'; // Default to dark
    }
    return true;
  });
  
  // Toggle theme and persist
  const toggleTheme = useCallback(() => {
    setIsDarkTheme(prev => {
      const newTheme = !prev;
      localStorage.setItem('cac-theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  }, []);

  // Theme classes helper
  const theme = {
    bg: isDarkTheme ? 'bg-gray-900' : 'bg-gray-100',
    bgCard: isDarkTheme ? 'bg-gray-800' : 'bg-white',
    bgCard2: isDarkTheme ? 'bg-gray-700' : 'bg-gray-200',
    bgCard3: isDarkTheme ? 'bg-gray-600' : 'bg-gray-300',
    bgInput: isDarkTheme ? 'bg-gray-700' : 'bg-white border border-gray-300',
    bgInput2: isDarkTheme ? 'bg-gray-800' : 'bg-gray-100 border border-gray-300',
    text: isDarkTheme ? 'text-white' : 'text-gray-900',
    textMuted: isDarkTheme ? 'text-gray-400' : 'text-gray-600',
    textMuted2: isDarkTheme ? 'text-gray-300' : 'text-gray-700',
    border: isDarkTheme ? 'border-gray-600' : 'border-gray-300',
    border2: isDarkTheme ? 'border-gray-700' : 'border-gray-200',
    hover: isDarkTheme ? 'hover:bg-gray-600' : 'hover:bg-gray-300',
    hover2: isDarkTheme ? 'hover:bg-gray-500' : 'hover:bg-gray-400',
  };
  
  // In-app confirmation modal (replaces browser confirm())
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm?: () => void;
    confirmText?: string;
    danger?: boolean;
  } | null>(null);
  // Usage: setConfirmModal({ message: 'Delete?', onConfirm: () => doSomething() })

  // Toast notification system
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  // Usage: showToast('Message', 'error') or showToast('Success!', 'success')
  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration: number = TOAST_DURATION_MS) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), duration);
  }, []);

  // Collapsible list states
  const [expandedInventoryIds, setExpandedInventoryIds] = useState({});
  const [expandedSpellLevels, setExpandedSpellLevels] = useState({});
  // Inventory category expansion state - all expanded by default
  const [expandedInventoryCategories, setExpandedInventoryCategories] = useState<Record<string, boolean>>({
    armorShield: true,
    weaponsAmmo: true,
    weaponEffects: true,
    statBoosting: true,
    magicPotions: true,
    uncategorized: true
  });

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
  const [expandedAttackIds, setExpandedAttackIds] = useState({}); // Track which attacks are expanded
  const [selectedAmmoIds, setSelectedAmmoIds] = useState({}); // Track selected ammo per attack { [attackId]: inventoryItemId }

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
  
  // State for collapsible spell descriptions
  const [expandedPreparedSpells, setExpandedPreparedSpells] = useState(() => ({}));
  const [expandedGrimoireSpells, setExpandedGrimoireSpells] = useState(() => ({}));
  const [expandedMagicItemSpells, setExpandedMagicItemSpells] = useState(() => ({}));
  const [expandedLearnedSpells, setExpandedLearnedSpells] = useState(() => ({}));

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
    isAmmo: false,
    isPotion: false,
    isGem: false,
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
    weaponToHitMagic: '',
    weaponToHitMisc: '',
    weaponDamageMagic: '',
    weaponDamageMisc: '',
    weaponDamageNumDice: '',
    weaponDamageDieType: 8,
    weaponExtraDice: [] as { numDice: number; dieType: number; label: string }[],
    // Container properties
    isContainer: false,
    containerCapacity: '',
    isMagicalContainer: false,
    containerMaxWeight: '',
    storedInId: null as number | null
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
  // Using strings for numeric inputs to allow empty field while typing
  const defaultNewEffectState = {
    kind: 'attack' as 'attack' | 'ac',
    miscToHit: '',
    miscDamage: '',
    magicToHit: '',
    magicDamage: '',
    ac: ''
  };
  
  const [newEffect, setNewEffect] = useState(defaultNewEffectState);
  
  const updateNewEffect = useCallback((updates: Partial<typeof defaultNewEffectState>) => {
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
  const setEquippedArmorIds = useCallback((idsOrFn: string[] | ((prev: string[]) => string[])) => {
    if (typeof idsOrFn === 'function') {
      setEquipmentState(prev => ({ ...prev, armorIds: idsOrFn(prev.armorIds) }));
    } else {
      updateEquipment({ armorIds: idsOrFn });
    }
  }, [updateEquipment]);
  
  const setEquippedShieldId = useCallback((id: string) => updateEquipment({ shieldId: id }), [updateEquipment]);
  
  const setEquippedDefenseItemIds = useCallback((idsOrFn: string[] | ((prev: string[]) => string[])) => {
    if (typeof idsOrFn === 'function') {
      setEquipmentState(prev => ({ ...prev, defenseItemIds: idsOrFn(prev.defenseItemIds) }));
    } else {
      updateEquipment({ defenseItemIds: idsOrFn });
    }
  }, [updateEquipment]);
  
  const setEquippedSpeedItemIds = useCallback((idsOrFn: string[] | ((prev: string[]) => string[])) => {
    if (typeof idsOrFn === 'function') {
      setEquipmentState(prev => ({ ...prev, speedItemIds: idsOrFn(prev.speedItemIds) }));
    } else {
      updateEquipment({ speedItemIds: idsOrFn });
    }
  }, [updateEquipment]);
  
  const setAttrEquippedIds = useCallback((idsOrFn: string[] | ((prev: string[]) => string[])) => {
    if (typeof idsOrFn === 'function') {
      setEquipmentState(prev => ({ ...prev, attrEquippedIds: idsOrFn(prev.attrEquippedIds) }));
    } else {
      updateEquipment({ attrEquippedIds: idsOrFn });
    }
  }, [updateEquipment]);
  
  const setAcUseDex = useCallback((val: boolean) => updateEquipment({ useDex: val }), [updateEquipment]);
  
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
  const itemIsAmmo = itemModal.isAmmo;
  const itemIsPotion = itemModal.isPotion;
  const itemIsGem = itemModal.isGem;
  const itemWeaponType = itemModal.weaponType;
  const itemWeaponMelee = itemModal.weaponMelee;
  const itemWeaponRanged = itemModal.weaponRanged;
  const itemWeaponToHitMagic = itemModal.weaponToHitMagic;
  const itemWeaponToHitMisc = itemModal.weaponToHitMisc;
  const itemWeaponDamageMagic = itemModal.weaponDamageMagic;
  const itemWeaponDamageMisc = itemModal.weaponDamageMisc;
  const itemWeaponDamageNumDice = itemModal.weaponDamageNumDice;
  const itemWeaponDamageDieType = itemModal.weaponDamageDieType;
  const itemWeaponExtraDice = itemModal.weaponExtraDice;

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
  const setItemIsAmmo = useCallback((v) => updateItemModal({ isAmmo: v }), [updateItemModal]);
  const setItemIsPotion = useCallback((v) => updateItemModal({ isPotion: v }), [updateItemModal]);
  const setItemIsGem = useCallback((v) => updateItemModal({ isGem: v }), [updateItemModal]);
  const setItemWeaponType = useCallback((v) => updateItemModal({ weaponType: v }), [updateItemModal]);
  const setItemWeaponMelee = useCallback((v) => updateItemModal({ weaponMelee: v }), [updateItemModal]);
  const setItemWeaponRanged = useCallback((v) => updateItemModal({ weaponRanged: v }), [updateItemModal]);
  const setItemWeaponToHitMagic = useCallback((v) => updateItemModal({ weaponToHitMagic: v }), [updateItemModal]);
  const setItemWeaponToHitMisc = useCallback((v) => updateItemModal({ weaponToHitMisc: v }), [updateItemModal]);
  const setItemWeaponDamageMagic = useCallback((v) => updateItemModal({ weaponDamageMagic: v }), [updateItemModal]);

  const setItemWeaponDamageMisc = useCallback((v) => updateItemModal({ weaponDamageMisc: v }), [updateItemModal]);
  const setItemWeaponDamageNumDice = useCallback((v) => updateItemModal({ weaponDamageNumDice: v }), [updateItemModal]);
  const setItemWeaponDamageDieType = useCallback((v) => updateItemModal({ weaponDamageDieType: v }), [updateItemModal]);
  const setItemWeaponExtraDice = useCallback((v) => updateItemModal({ weaponExtraDice: typeof v === 'function' ? v(itemModal.weaponExtraDice) : v }), [updateItemModal, itemModal.weaponExtraDice]);

  // Container getters
  const itemIsContainer = itemModal.isContainer;
  const itemContainerCapacity = itemModal.containerCapacity;
  const itemIsMagicalContainer = itemModal.isMagicalContainer;
  const itemContainerMaxWeight = itemModal.containerMaxWeight;
  const itemStoredInId = itemModal.storedInId;

  // Container setters
  const setItemIsContainer = useCallback((v) => updateItemModal({ isContainer: v }), [updateItemModal]);
  const setItemContainerCapacity = useCallback((v) => updateItemModal({ containerCapacity: v }), [updateItemModal]);
  const setItemIsMagicalContainer = useCallback((v) => updateItemModal({ isMagicalContainer: v }), [updateItemModal]);
  const setItemContainerMaxWeight = useCallback((v) => updateItemModal({ containerMaxWeight: v }), [updateItemModal]);
  const setItemStoredInId = useCallback((v) => updateItemModal({ storedInId: v }), [updateItemModal]);

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
    cp: 0, sp: 0, ep: 0, gp: 0, pp: 0,
    selectedCoinContainer: null as number | null,
    // Checkboxes for which coins to move to/from container (default unchecked)
    moveCoins: { copper: false, silver: false, gold: false, electrum: false, platinum: false } as Record<string, boolean>
  });
  
  const updateWalletForm = useCallback((updates) => {
    setWalletForm(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetWalletForm = useCallback(() => {
    // Don't reset selectedCoinContainer or moveCoins - only reset coin amounts
    setWalletForm(prev => ({ ...prev, cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }));
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
    perLevelBonus: 0,
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
      diceType: '', perLevelBonus: 0, diceBonus: 0, verbal: false, somatic: false, material: false, materialDesc: ''
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

  // ===== CONTROLLED INPUTS FOR DICE/XP/SPELL SLOTS =====
  // These replace document.getElementById calls with proper React state
  
  // Generic dice inputs state - keyed by a unique identifier
  // Used for spell dice, grimoire dice, companion damage dice, magic item dice
  const [diceInputs, setDiceInputs] = useState<Record<string, number[]>>({});
  
  const getDiceInputs = useCallback((key: string, count: number): number[] => {
    return diceInputs[key] || Array(count).fill(0);
  }, [diceInputs]);
  
  const setDiceInput = useCallback((key: string, index: number, value: number) => {
    setDiceInputs(prev => {
      const current = prev[key] || [];
      const updated = [...current];
      updated[index] = value;
      return { ...prev, [key]: updated };
    });
  }, []);
  
  const clearDiceInputs = useCallback((key: string) => {
    setDiceInputs(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);
  
  // XP Table form state
  const [xpTableForm, setXpTableForm] = useState<number[]>([]);
  
  const initXpTableForm = useCallback((xpTable: number[]) => {
    setXpTableForm([...xpTable]);
  }, []);
  
  const updateXpTableForm = useCallback((index: number, value: number) => {
    setXpTableForm(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);
  
  // Multi-class XP table form states
  const [xpTableClass1Form, setXpTableClass1Form] = useState<number[]>([]);
  const [xpTableClass2Form, setXpTableClass2Form] = useState<number[]>([]);
  const [xpTableClass3Form, setXpTableClass3Form] = useState<number[]>([]);
  
  const initMultiXpTableForms = useCallback((class1: number[], class2: number[], class3?: number[]) => {
    setXpTableClass1Form([...class1]);
    setXpTableClass2Form([...class2]);
    if (class3) setXpTableClass3Form([...class3]);
  }, []);
  
  // Spell Slots form state
  const [spellSlotsForm, setSpellSlotsForm] = useState<number[]>([]);
  
  const initSpellSlotsForm = useCallback((slots: number[]) => {
    setSpellSlotsForm([...slots]);
  }, []);
  
  const updateSpellSlotsForm = useCallback((index: number, value: number) => {
    setSpellSlotsForm(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  // Inventory item form (basic fields - flags handled by itemModal)
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    quantity: '',  // Store as string so it can be empty (defaults to 1 when saving)
    weightPer: '',  // Store as string for decimal/negative input
    ev: '',         // Store as string for decimal/negative input
    worth: 0,
    worthUnit: 'gp',
    acBonus: 0,
    magicACBonus: 0
  });
  
  const updateItemForm = useCallback((updates) => {
    setItemForm(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetItemForm = useCallback(() => {
    setItemForm({
      name: '', description: '', quantity: '', weightPer: '', ev: '',
      worth: 0, worthUnit: 'gp', acBonus: 0, magicACBonus: 0
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
    diceType: '',
    verbal: false,
    somatic: false,
    material: false,
    materialDesc: ''
  });
  
  const updateMiSpellForm = useCallback((updates) => {
    setMiSpellForm(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetMiSpellForm = useCallback(() => {
    setMiSpellForm({
      selectedSpellId: '', copies: 1, permanent: false, name: '', level: 0,
      description: '', prepTime: '', duration: '', range: '', aoe: '',
      savingThrow: '', spellResistance: false, hasDiceRoll: false, diceType: '',
      verbal: false, somatic: false, material: false, materialDesc: ''
    });
  }, []);

  // State for import file input
  const [importError, setImportError] = useState(null);

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
  // Throttled auto-save - saves at most every 500ms to prevent UI freezes
  const saveTimeoutRef = useRef(null);
  const pendingSaveRef = useRef(null);
  
  useEffect(() => {
    // Don't save on initial mount with empty array
    if (characters.length === 0 && !localStorage.getItem(STORAGE_KEY)) {
      return;
    }
    
    // Store the pending data
    pendingSaveRef.current = characters;
    
    // If we're already waiting to save, don't schedule another
    if (saveTimeoutRef.current) {
      return;
    }
    
    // Schedule the save after delay (throttled/debounced)
    saveTimeoutRef.current = setTimeout(() => {
      const dataToSave = pendingSaveRef.current;
      saveToLocalStorage(dataToSave);
      saveTimeoutRef.current = null;
    }, AUTO_SAVE_DELAY_MS);
    
    return () => {
      // Don't clear the timeout on cleanup - let the save complete
    };
  }, [characters]);

  // ===== EXPORT/IMPORT HANDLERS =====
  const handleExport = useCallback(() => {
    exportToFile(characters);
  }, [characters]);

  // Pending import state for the import confirmation modal
  const [pendingImport, setPendingImport] = useState<Character[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target?.files?.[0];
      if (!file) return;
      
      setIsImporting(true);
      try {
        setImportError(null);
        const imported = await importFromFile(file);
        if (imported.length > 0) {
          // Show import confirmation modal instead of window.confirm
          setPendingImport(imported);
          setEditModal({ type: 'importConfirm' });
        }
      } catch (err: any) {
        setImportError('Failed to import: ' + (err?.message || 'Invalid file'));
        setTimeout(() => setImportError(null), 5000);
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  }, []);

  // Handle import confirmation
  const handleImportReplace = useCallback(() => {
    if (pendingImport) {
      setCharacters(pendingImport);
      setCurrentCharIndex(null);
      showToast(`Imported ${pendingImport.length} character(s)`, 'success');
    }
    setPendingImport(null);
    setEditModal(null);
  }, [pendingImport, showToast]);

  const handleImportMerge = useCallback(() => {
    if (pendingImport) {
      setCharacters(prev => [...prev, ...pendingImport]);
      showToast(`Added ${pendingImport.length} character(s)`, 'success');
    }
    setPendingImport(null);
    setEditModal(null);
  }, [pendingImport, showToast]);

  const handleImportCancel = useCallback(() => {
    setPendingImport(null);
    setEditModal(null);
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
  const normalizeItemStatBonusesStatic = useCallback((it: InventoryItem | null | undefined): { attr: string; value: number }[] => {
    if (!it?.attrBonuses) return [];
    return Array.isArray(it.attrBonuses)
      ? it.attrBonuses
          .filter(b => b && typeof b === 'object')
          .map(b => ({ attr: String(b.attr || '').toLowerCase(), value: Number(b.value) || 0 }))
          .filter(b => b.attr && b.value !== 0)
      : [];
  }, []);

  // Memoized attribute totals - recalculated only when char data changes
  const memoizedAttributeTotals = useMemo(() => {
    if (!char) return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    
    const calcAttrTotal = (attrKey) => {
      const a = char.attributes?.[attrKey];
      const rolled = Number.isFinite(a?.rolledScore) ? a.rolledScore : 10;
      const bonusMod = Number.isFinite(a?.bonusMod) ? a.bonusMod : 0;
      
      // Race bonus (sum all matching)
      const raceBonus = (char.raceAttributeMods || [])
        .filter(x => String(x.attr).toLowerCase() === attrKey)
        .reduce((sum, x) => sum + (Number(x.value) || 0), 0);
      
      // Class bonus (sum all matching)
      const classBonus = (char.classAttributeMods || [])
        .filter(x => String(x.attr).toLowerCase() === attrKey)
        .reduce((sum, x) => sum + (Number(x.value) || 0), 0);
      
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
      
      return rolled + raceBonus + classBonus + bonusMod + itemBonus;
    };
    
    return {
      str: calcAttrTotal('str'),
      dex: calcAttrTotal('dex'),
      con: calcAttrTotal('con'),
      int: calcAttrTotal('int'),
      wis: calcAttrTotal('wis'),
      cha: calcAttrTotal('cha')
    };
  }, [char?.attributes, char?.raceAttributeMods, char?.classAttributeMods, char?.equippedAttrBonuses, char?.inventory, normalizeItemStatBonusesStatic]);

  // Memoized attribute modifiers (derived from totals)
  const memoizedAttributeMods = useMemo(() => ({
    str: calcMod(memoizedAttributeTotals.str),
    dex: calcMod(memoizedAttributeTotals.dex),
    con: calcMod(memoizedAttributeTotals.con),
    int: calcMod(memoizedAttributeTotals.int),
    wis: calcMod(memoizedAttributeTotals.wis),
    cha: calcMod(memoizedAttributeTotals.cha)
  }), [memoizedAttributeTotals]);

  // Memoized encumbrance calculations
  const memoizedEncumbrance = useMemo(() => {
    if (!char) return { rating: 0, totalEV: 0, totalWeight: 0, coinEV: 0, coinWeight: 0, status: 'unburdened', speedPenalty: 0 };
    
    const strScore = memoizedAttributeTotals.str;
    const strPrime = !!char.attributes?.str?.isPrime;
    const conPrime = !!char.attributes?.con?.isPrime;
    const rating = strScore + (strPrime ? 3 : 0) + (conPrime ? 3 : 0);
    
    // Build a set of magical container IDs for quick lookup
    const magicalContainerIds = new Set(
      (char.inventory || [])
        .filter(it => it.isContainer && it.isMagicalContainer)
        .map(it => it.id)
    );
    
    let inventoryEV = 0;
    let inventoryWeight = 0;
    let zeroEVItemCount = 0;  // Track zero-EV items for 10:1 EV calculation
    
    (char.inventory || []).forEach(it => {
      const qty = Number(it.quantity) || 1;
      const ev = Number(it.ev) || 0;
      const weight = Number(it.weightPer) || 0;
      
      // Check if item is stored in a container
      const storedInId = it.storedInId;
      const isStoredInContainer = storedInId != null && (char.inventory || []).some(c => c.id === storedInId && c.isContainer);
      const isStoredInMagicalContainer = storedInId != null && magicalContainerIds.has(storedInId);
      
      // EV: Don't count if stored in ANY container
      if (!isStoredInContainer) {
        if (ev > 0) {
          // Normal items: EV per item × quantity
          inventoryEV += ev * qty;
        } else {
          // Zero-EV items: accumulate count, will calculate at end
          zeroEVItemCount += qty;
        }
      }
      
      // Weight: Don't count if stored in MAGICAL container, otherwise count
      if (!isStoredInMagicalContainer) {
        inventoryWeight += weight * qty;
      }
    });
    
    // Zero-EV items: 10 items = 1 EV
    inventoryEV += Math.floor(zeroEVItemCount / 10);
    
    // Calculate coin weight and EV by denomination
    // Weight: 16 coins = 1 lb for all coins
    // But PP is worth 10x GP, so 16 PP = 160 GP worth but only 1 lb
    // CP: 16 coins = 1 lb, worth 0.16 GP
    // SP: 16 coins = 1 lb, worth 1.6 GP  
    // GP: 16 coins = 1 lb, worth 16 GP
    // PP: 16 coins = 1 lb, worth 160 GP
    
    const wallet = char.wallet || { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };
    const totalCoinCount = (wallet.platinum || 0) + (wallet.gold || 0) + (wallet.electrum || 0) + (wallet.silver || 0) + (wallet.copper || 0);
    
    // Calculate coins stored in magical containers (now stored as individual coin counts)
    const coinsInMagicalContainersCount = (char.inventory || [])
      .filter(it => it.isContainer && it.isMagicalContainer)
      .reduce((sum, container) => {
        if (container.storedCoins) {
          return sum + (container.storedCoins.platinum || 0) + (container.storedCoins.gold || 0) + 
                 (container.storedCoins.electrum || 0) + (container.storedCoins.silver || 0) + 
                 (container.storedCoins.copper || 0);
        }
        // Legacy migration: treat storedCoinsGP as gold coin count
        return sum + Math.floor(Number(container.storedCoinsGP) || 0);
      }, 0);
    
    // Wallet coins are always in your pocket, not in containers - they always count
    // Coins in magical containers don't count toward weight
    const coinWeight = totalCoinCount / 16; // 16 coins = 1 lb
    const coinEV = totalCoinCount / 160; // 160 coins = 1 EV
    
    // Include coin weight/EV only if setting is enabled
    const includeCoinWeight = char.includeCoinWeight ?? false;
    const totalEV = inventoryEV + (includeCoinWeight ? coinEV : 0);
    const totalWeight = inventoryWeight + (includeCoinWeight ? coinWeight : 0);
    
    // Check if encumbrance effects are enabled (defaults to true)
    const encumbranceEnabled = char.encumbranceEnabled ?? true;
    
    let status = 'unburdened';
    if (encumbranceEnabled && rating > 0) {
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
    if (encumbranceEnabled) {
      if (status === 'burdened') speedPenalty = Math.min(10, Math.max(preEncumbranceSpeed - 5, 0));
      else if (status === 'overburdened') speedPenalty = Math.max(preEncumbranceSpeed - 5, 0);
    }
    
    const finalSpeed = status === 'unburdened' ? preEncumbranceSpeed : Math.max(preEncumbranceSpeed - speedPenalty, 5);
    
    return { rating, totalEV, totalWeight, inventoryEV, inventoryWeight, coinEV, coinWeight, status, speedPenalty, preEncumbranceSpeed, finalSpeed, encumbranceEnabled };
  }, [char?.speed, char?.speedBonus, char?.equippedSpeedItemIds, char?.inventory, char?.attributes?.str?.isPrime, char?.attributes?.con?.isPrime, char?.moneyGP, char?.includeCoinWeight, char?.encumbranceEnabled, memoizedAttributeTotals.str, normalizeItemStatBonusesStatic]);

  // Memoized AC calculation
  const memoizedAC = useMemo(() => {
    if (!char) return 10;
    const base = char.acBase || 10;
    
    // Shield (base + magic bonus)
    let shield = 0;
    let shieldMagic = 0;
    if (char.equippedShieldId) {
      const sItem = (char.inventory || []).find(i => String(i.id) === String(char.equippedShieldId));
      shield = Number(sItem?.acBonus) || 0;
      shieldMagic = Number(sItem?.magicACBonus) || 0;
    }
    
    // Armor (base + magic bonus)
    const armorIds = Array.isArray(char.equippedArmorIds) ? char.equippedArmorIds : (char.equippedArmorId ? [char.equippedArmorId] : []);
    let armor = 0;
    let armorMagic = 0;
    for (const aid of armorIds) {
      const aItem = (char.inventory || []).find(i => String(i.id) === String(aid));
      armor += Number(aItem?.acBonus) || 0;
      armorMagic += Number(aItem?.magicACBonus) || 0;
    }
    
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
    
    return base + armor + armorMagic + shield + shieldMagic + mod + magic + misc + raceAC + bonus + effAC;
  }, [char?.acBase, char?.equippedShieldId, char?.equippedArmorIds, char?.equippedArmorId, char?.inventory, char?.acModAuto, char?.acMod, char?.acMagic, char?.acMisc, char?.acBonus, char?.equippedEffectItemIds, char?.raceAttributeMods, memoizedAttributeTotals.dex, memoizedEncumbrance.status]);

  // Memoized XP/Level calculation (accounts for level drain)
  const memoizedLevelInfo = useMemo(() => {
    if (!char) return { nextLevelXp: 0, progress: 0, canLevelUp: false, currentLevel: 1, drainedLevels: 0, effectiveLevel: 1, xpEarnedLevel: 1 };
    if (!Array.isArray(char.xpTable) || char.xpTable.length === 0) {
      return { nextLevelXp: 0, progress: 0, canLevelUp: false, currentLevel: 1, drainedLevels: 0, effectiveLevel: 1, xpEarnedLevel: 1 };
    }
    
    // Calculate level earned from XP
    // xpTable[0] = 0 (level 1), xpTable[1] = 2000 (level 2), xpTable[2] = 4000 (level 3), etc.
    let xpEarnedLevel = 1;
    for (let i = char.xpTable.length - 1; i >= 0; i--) {
      if (char.currentXp >= char.xpTable[i]) {
        xpEarnedLevel = i + 1; // Index 0 = level 1, index 1 = level 2, etc.
        break;
      }
    }
    
    // Count drained levels
    const drainedLevels = (char.levelDrained || []).filter(d => d === true).length;
    
    // Effective level (XP-earned level minus drained)
    const effectiveLevel = Math.max(1, xpEarnedLevel - drainedLevels);
    
    // For XP progress bar: show progress toward NEXT level after current XP-earned level
    // Current level index = xpEarnedLevel - 1 (since level 1 = index 0)
    // Next level index = xpEarnedLevel (level 2 = index 1, etc.)
    const currentLevelIndex = xpEarnedLevel - 1;
    const nextLevelIndex = Math.min(xpEarnedLevel, char.xpTable.length - 1);
    
    const currentLevelXp = char.xpTable[currentLevelIndex] || 0;
    const nextLevelXp = char.xpTable[nextLevelIndex] || char.xpTable[char.xpTable.length - 1];
    
    // Progress within current level toward next
    const xpIntoLevel = char.currentXp - currentLevelXp;
    const xpNeededForLevel = nextLevelXp - currentLevelXp;
    const progress = xpNeededForLevel > 0 ? Math.min(100, ((xpIntoLevel / xpNeededForLevel) * 100)) : 100;
    
    // Can level up if you have unfilled HP slots for levels you've earned
    const hpLevelsFilled = (char.hpByLevel || []).filter(hp => hp > 0).length;
    const canLevelUp = xpEarnedLevel > hpLevelsFilled;
    
    return { 
      nextLevelXp, 
      progress: Number(progress.toFixed(1)), 
      canLevelUp,
      currentLevel: xpEarnedLevel,  // Level based on XP
      drainedLevels,
      effectiveLevel,
      xpEarnedLevel
    };
  }, [char?.xpTable, char?.currentXp, char?.levelDrained, char?.hpByLevel]);

  // Memoized max HP calculation (accounts for level drain and dynamically applies CON mod)
  const memoizedMaxHP = useMemo(() => {
    if (!char) return char?.maxHp || 0;
    
    // Calculate current CON modifier
    const conAttr = char.attributes?.con;
    if (!conAttr) return char?.maxHp || 0;
    
    const conTotal = (conAttr.rolledScore || 10) + (conAttr.raceBonus || 0) + (conAttr.bonusMod || 0);
    const conMod = Math.floor((conTotal - 10) / 2);
    
    // Use hpRollsByLevel if available (new system), otherwise fall back to hpByLevel (old system)
    const rolls = char.hpRollsByLevel || char.hpByLevel || [];
    const levelDrained = char.levelDrained || [];
    
    // Sum HP from non-drained levels: base roll + CON mod per level
    const levelHP = rolls.reduce((sum, roll, idx) => {
      const isDrained = levelDrained[idx] === true;
      if (isDrained) return sum;
      
      const baseRoll = Number(roll) || 0;
      if (baseRoll <= 0) return sum;
      
      // Apply CON mod to each level's roll (minimum 1 HP per level)
      return sum + Math.max(1, baseRoll + conMod);
    }, 0);
    
    const bonusHP = char.hpBonus || 0;
    return levelHP + bonusHP;
  }, [char?.hpRollsByLevel, char?.hpByLevel, char?.hpBonus, char?.levelDrained, char?.attributes?.con]);
  
  // Calculate effective level (actual level minus drained levels)
  const effectiveLevel = useMemo(() => {
    if (!char) return 0;
    const totalLevel = (char.class1Level || 0) + (char.class2Level || 0);
    const drainedCount = (char.levelDrained || []).filter(d => d === true).length;
    return Math.max(1, totalLevel - drainedCount);
  }, [char?.class1Level, char?.class2Level, char?.levelDrained]);

  // ===== MEMOIZED SORTED LISTS =====
  // These prevent re-sorting on every render
  
  const sortedInventory = useMemo(() => 
    (char?.inventory || []).slice().sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    ), [char?.inventory]);

  // Categorized inventory for organized display
  const categorizedInventory = useMemo(() => {
    const inventory = char?.inventory || [];
    const sorted = inventory.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    // Define category predicates
    const isArmorShield = (item: InventoryItem) => item.isArmor || item.isShield;
    const isWeaponAmmo = (item: InventoryItem) => item.isWeapon || item.isAmmo;
    const isWeaponEffect = (item: InventoryItem) => (item.effects?.length || 0) > 0;
    const isStatBoosting = (item: InventoryItem) => item.hasAttrBonus && (item.attrBonuses?.length || 0) > 0;
    const isMagicPotion = (item: InventoryItem) => item.isMagicCasting || item.isGrimoire || item.isPotion;
    const isContainer = (item: InventoryItem) => !!item.isContainer;
    
    // Categorize items - items can appear in multiple categories
    const categories = {
      armorShield: { name: 'Armor & Shields', items: [] as InventoryItem[], icon: '🛡️' },
      weaponsAmmo: { name: 'Weapons & Ammo', items: [] as InventoryItem[], icon: '⚔️' },
      containers: { name: 'Backpacks & Pouches', items: [] as InventoryItem[], icon: '🎒' },
      weaponEffects: { name: 'Weapon Effects', items: [] as InventoryItem[], icon: '✨' },
      statBoosting: { name: 'Stat Boosting', items: [] as InventoryItem[], icon: '📈' },
      magicPotions: { name: 'Magical Items & Potions', items: [] as InventoryItem[], icon: '🧪' },
      uncategorized: { name: 'Other Items', items: [] as InventoryItem[], icon: '📦' }
    };
    
    // Track which items belong to which categories for cross-reference display
    const itemCategories = new Map<number, string[]>();
    
    for (const item of sorted) {
      const cats: string[] = [];
      
      if (isArmorShield(item)) {
        categories.armorShield.items.push(item);
        cats.push('Armor & Shields');
      }
      if (isWeaponAmmo(item)) {
        categories.weaponsAmmo.items.push(item);
        cats.push('Weapons & Ammo');
      }
      if (isContainer(item)) {
        categories.containers.items.push(item);
        cats.push('Backpacks & Pouches');
      }
      if (isWeaponEffect(item)) {
        categories.weaponEffects.items.push(item);
        cats.push('Weapon Effects');
      }
      if (isStatBoosting(item)) {
        categories.statBoosting.items.push(item);
        cats.push('Stat Boosting');
      }
      if (isMagicPotion(item)) {
        categories.magicPotions.items.push(item);
        cats.push('Magical Items & Potions');
      }
      
      // If no category, put in uncategorized
      if (cats.length === 0) {
        categories.uncategorized.items.push(item);
      }
      
      itemCategories.set(item.id, cats);
    }
    
    return { categories, itemCategories };
  }, [char?.inventory]);

  // Helper to get container info (contents, capacity used, etc.)
  const getContainerInfo = useCallback((containerId: number) => {
    if (!char) return { items: [], itemCount: 0, slotCount: 0, totalWeight: 0, capacity: 0, maxWeight: 0, isMagical: false };
    
    const container = (char.inventory || []).find(it => it.id === containerId);
    if (!container || !container.isContainer) return { items: [], itemCount: 0, slotCount: 0, totalWeight: 0, capacity: 0, maxWeight: 0, isMagical: false, storedCoinsGP: 0, storedCoinsWeight: 0, storedCoinCount: 0, storedCoins: { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 } };
    
    const containedItems = (char.inventory || []).filter(it => it.storedInId === containerId);
    
    // Calculate item count (raw quantity total)
    const itemCount = containedItems.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
    
    // Calculate slot count: normal items use qty slots, zero-EV items use ceil(qty/10) slots
    let zeroEVCount = 0;
    let normalSlots = 0;
    containedItems.forEach(it => {
      const qty = Number(it.quantity) || 1;
      const ev = Number(it.ev) || 0;
      if (ev > 0) {
        // Normal items: each item takes 1 slot
        normalSlots += qty;
      } else {
        // Zero-EV items: accumulate, will calculate slots at end
        zeroEVCount += qty;
      }
    });
    // Zero-EV items: 10 = 1 slot (ceiling so 1-10 = 1, 11-20 = 2, etc.)
    const zeroEVSlots = Math.ceil(zeroEVCount / 10);
    const slotCount = normalSlots + zeroEVSlots;
    
    const itemsWeight = containedItems.reduce((sum, it) => sum + ((Number(it.weightPer) || 0) * (Number(it.quantity) || 1)), 0);
    
    // Get stored coins - migrate from legacy storedCoinsGP if needed
    let storedCoins = container.storedCoins || { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };
    if (!container.storedCoins && container.storedCoinsGP) {
      // Legacy migration: convert GP value to gold coins
      storedCoins = { platinum: 0, gold: Math.floor(container.storedCoinsGP), electrum: 0, silver: 0, copper: 0 };
    }
    
    // Calculate stored coins GP value and weight
    const storedCoinsGP = (storedCoins.platinum * 10) + (storedCoins.electrum * 5) + storedCoins.gold + (storedCoins.silver * 0.1) + (storedCoins.copper * 0.01);
    const storedCoinCount = storedCoins.platinum + storedCoins.gold + storedCoins.electrum + storedCoins.silver + storedCoins.copper;
    const storedCoinsWeight = storedCoinCount / 16;
    const totalWeight = itemsWeight + storedCoinsWeight;
    
    return {
      items: containedItems,
      itemCount,
      slotCount,  // New: slots used (zero-EV items: 10 = 1 slot)
      totalWeight,
      capacity: Number(container.containerCapacity) || 0,
      maxWeight: Number(container.containerMaxWeight) || 0,
      isMagical: !!container.isMagicalContainer,
      storedCoinsGP,
      storedCoinsWeight,
      storedCoinCount,
      storedCoins
    };
  }, [char]);

  // Helper to get available containers for an item
  const getAvailableContainers = useCallback((item: InventoryItem | null) => {
    if (!char || !item) return [];
    
    const itemEV = Number(item.ev) || 0;
    const singleItemWeight = Number(item.weightPer) || 0;
    
    return (char.inventory || [])
      .filter(container => {
        if (!container.isContainer) return false;
        if (container.id === item.id) return false; // Can't store in itself
        
        const info = getContainerInfo(container.id);
        
        if (container.isMagicalContainer) {
          // Magical container: check if at least one item fits by weight
          const maxWeight = Number(container.containerMaxWeight) || 0;
          const remainingWeight = maxWeight - info.totalWeight;
          return singleItemWeight <= remainingWeight;
        } else {
          // Normal container: check capacity and EV rule
          const capacity = Number(container.containerCapacity) || 0;
          
          // Item EV must be less than capacity (unless it's zero-EV)
          if (itemEV > 0 && itemEV >= capacity) return false;
          
          // Must have room for at least 1 slot
          // Zero-EV items only take a slot if we'd hit the next 10 threshold
          if (itemEV > 0) {
            // Normal item needs 1 slot
            if (info.slotCount >= capacity) return false;
          } else {
            // Zero-EV item: check if adding more would create a new slot
            // Count current zero-EV items in this container
            const zeroEVInContainer = info.items
              .filter(it => (Number(it.ev) || 0) === 0)
              .reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
            const currentZeroEVSlots = Math.ceil(zeroEVInContainer / 10);
            const newZeroEVSlots = Math.ceil((zeroEVInContainer + 1) / 10);
            const additionalSlots = newZeroEVSlots - currentZeroEVSlots;
            if (info.slotCount + additionalSlots > capacity) return false;
          }
          
          return true;
        }
      })
      .map(container => ({
        id: container.id,
        name: container.name,
        isMagical: !!container.isMagicalContainer,
        info: getContainerInfo(container.id)
      }));
  }, [char, getContainerInfo]);

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

  const normalizeItemStatBonuses = (it: InventoryItem | null | undefined): { attr: string; value: number }[] => {
    // Format: it.attrBonuses = [{ attr: 'str'|'dex'|...|'ac'|'speed', value: number }, ...]
    if (!it?.attrBonuses) return [];
    return Array.isArray(it.attrBonuses)
      ? it.attrBonuses
          .filter(b => b && typeof b === 'object')
          .map(b => ({ attr: String(b.attr || '').toLowerCase(), value: Number(b.value) || 0 }))
          .filter(b => b.attr && b.value !== 0)
      : [];
  };

  const getItemAttributeBonus = (attrKey: string): number => {
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
    return list
      .filter(x => String(x.attr).toLowerCase() === String(attrKey).toLowerCase())
      .reduce((sum, x) => sum + (Number(x.value) || 0), 0);
  };

  const getClassAttributeBonus = (attrKey) => {
    if (!char) return 0;
    const list = (char.classAttributeMods || []);
    return list
      .filter(x => String(x.attr).toLowerCase() === String(attrKey).toLowerCase())
      .reduce((sum, x) => sum + (Number(x.value) || 0), 0);
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
  const getTotalWeight = () => memoizedEncumbrance.totalWeight;
  const getEncumbranceStatus = () => memoizedEncumbrance.status;

  const getEncumbranceStatusLabel = () => {
    const s = memoizedEncumbrance.status;
    return s ? (s.charAt(0).toUpperCase() + s.slice(1)) : '';
  };

  const getSpeedPreEncumbrance = () => memoizedEncumbrance.preEncumbranceSpeed || 0;
  const getEncumbranceSpeedPenalty = () => memoizedEncumbrance.speedPenalty;
  const getSpeedTotal = () => memoizedEncumbrance.finalSpeed || 0;

  // Modal focus management ref
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus management for modals - trap focus and restore on close
  useEffect(() => {
    if (editModal) {
      // Store the previously focused element
      previousActiveElementRef.current = document.activeElement as HTMLElement;
      
      // Focus the modal after a short delay to allow rendering
      setTimeout(() => {
        if (modalRef.current) {
          const firstFocusable = modalRef.current.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          firstFocusable?.focus();
        }
      }, 50);
    } else {
      // Restore focus when modal closes
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
        previousActiveElementRef.current = null;
      }
    }
  }, [editModal]);

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
    if (editModal.type === 'characterDetails' && char) {
      updateModalForm({
        charAge: char.age || '',
        charHeight: char.height || '',
        charWeight: char.weight || '',
        charDescription: char.description || '',
        charBackstory: char.backstory || '',
      });
    }
    if (editModal.type === 'class' && char) {
      updateModalForm({ class: char.class1 || '' });
      // Initialize class modal form
      const hasClassType = char.classType && char.classType !== 'single';
      setClassModalStep(char.classType ? 'setup' : 'choose');
      setClassModalForm({
        classType: char.classType || 'single',
        class1: char.class1 || '',
        class2: char.class2 || '',
        class3: char.class3 || '',
        showClass3: !!(char.class3)
      });
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
    if (editModal.type === 'xpTable' && char) {
      // Initialize XP table form with current values
      const defaultTable = [0, 2000, 4000, 8000, 16000, 32000, 64000, 120000, 240000, 360000, 480000, 600000, 720000, 840000, 960000, 1080000, 1200000, 1320000, 1440000, 1560000, 1680000, 1800000, 1920000, 2040000, 2160000];
      initXpTableForm(char.xpTable || defaultTable);
      // Also initialize multi-class tables
      initMultiXpTableForms(
        char.xpTableClass1 || defaultTable,
        char.xpTableClass2 || defaultTable,
        char.xpTableClass3 || defaultTable
      );
    }
    if (editModal.type === 'spellSlots' && char) {
      // Initialize spell slots form with current values
      initSpellSlotsForm(char.spellSlots || [0,0,0,0,0,0,0,0,0,0]);
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
        magicItemSpellPermanent: false,
        magicItemSpellMode: 'learned', // 'learned' or 'itemOnly'
        // Item-only spell fields (same as regular spell form)
        itemOnlySpellName: '',
        itemOnlySpellLevel: 0,
        itemOnlySpellDescription: '',
        itemOnlySpellPrepTime: '1 action',
        itemOnlySpellRange: 'Touch',
        itemOnlySpellDuration: 'Instant',
        itemOnlySpellAoe: '',
        itemOnlySpellSavingThrow: '',
        itemOnlySpellResistance: false,
        itemOnlySpellHasDice: false,
        itemOnlySpellDiceType: '',
        itemOnlySpellVerbal: false,
        itemOnlySpellSomatic: false,
        itemOnlySpellMaterial: false,
        itemOnlySpellMaterialDesc: '',
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
      // If coming from Magic Inventory, keep magic casting enabled
      if (!editModal.fromMagicInventory) {
        setItemIsMagicCasting(false);
      }
      setItemIsGrimoire(false);
      setItemMagicCastingDescription('');
      setItemMagicCastingCapacity(0);
      setItemMagicCastingCapacityText('');

      setItemIsWeapon(false);
      setItemIsAmmo(false);
      setItemIsPotion(false);
      
      // Reset container fields
      setItemIsContainer(false);
      setItemContainerCapacity('');
      setItemIsMagicalContainer(false);
      setItemContainerMaxWeight('');
      setItemStoredInId(null);
      
      setItemWeaponType('melee');
      setItemWeaponMelee(true);
      setItemWeaponRanged(false);
      setItemWeaponToHitMagic('');
      setItemWeaponToHitMisc('');
      setItemWeaponDamageMagic('');
      setItemWeaponDamageMisc('');
      setItemWeaponDamageNumDice('');

      setItemHasEffects(false);
      setItemEffects([]);
      setNewEffectKind('attack');
      setNewEffectMiscToHit('');
      setNewEffectMiscDamage('');
      setNewEffectMagicToHit('');
      setNewEffectMagicDamage('');
      
    }
    if (editModal.type === 'editItem') {
      // Initialize itemForm with item values
      const qty = Number(editModal.item?.quantity) || 1;
      setItemForm({
        name: editModal.item?.name || '',
        description: editModal.item?.description || '',
        quantity: String(qty),  // Store as string for editing
        weightPer: editModal.item?.weightPer != null ? String(editModal.item.weightPer) : '',
        ev: editModal.item?.ev != null ? String(editModal.item.ev) : '',
        worth: editModal.item?.worthAmount ?? (editModal.item?.worthGP != null ? editModal.item.worthGP : 0),
        worthUnit: editModal.item?.worthUnit || (editModal.item?.worthGP != null ? 'gp' : 'gp'),
        acBonus: Number(editModal.item?.acBonus) || 0,
        magicACBonus: Number(editModal.item?.magicACBonus) || 0
      });
      setItemIsArmor(!!editModal.item?.isArmor);
      setItemIsShield(!!editModal.item?.isShield);
      // Load stat bonuses from attrBonuses array
      const loadedBonuses = Array.isArray(editModal.item?.attrBonuses)
        ? editModal.item.attrBonuses
            .filter(b => b && typeof b === 'object')
            .map(b => ({ attr: String(b.attr || '').toLowerCase(), value: Number(b.value) || 0 }))
            .filter(b => b.attr && b.value !== 0)
        : [];

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
      setItemIsAmmo(!!editModal.item?.isAmmo);
      setItemIsPotion(!!editModal.item?.isPotion);
      setItemIsGem(!!editModal.item?.isGem);
      
      // Load container fields
      setItemIsContainer(!!editModal.item?.isContainer);
      const containerCap = Number(editModal.item?.containerCapacity) || 0;
      setItemContainerCapacity(containerCap === 0 ? '' : String(containerCap));
      setItemIsMagicalContainer(!!editModal.item?.isMagicalContainer);
      const containerMaxWt = Number(editModal.item?.containerMaxWeight) || 0;
      setItemContainerMaxWeight(containerMaxWt === 0 ? '' : String(containerMaxWt));
      setItemStoredInId(editModal.item?.storedInId || null);
      
      setItemWeaponType(editModal.item?.weaponType || 'melee');
      setItemWeaponMelee(!!(editModal.item?.weaponMelee ?? ((editModal.item?.weaponType || 'melee') === 'melee')));
      setItemWeaponRanged(!!(editModal.item?.weaponRanged ?? ((editModal.item?.weaponType || 'melee') === 'ranged')));
      // Load weapon values as strings for better input UX (show empty for 0)
      const toHitMagic = Number(editModal.item?.weaponToHitMagic) || 0;
      const toHitMisc = Number(editModal.item?.weaponToHitMisc) || 0;
      const dmgMagic = Number(editModal.item?.weaponDamageMagic) || 0;
      const dmgMisc = Number(editModal.item?.weaponDamageMisc) || 0;
      const numDice = Number(editModal.item?.weaponDamageNumDice) || 1;
      setItemWeaponToHitMagic(toHitMagic === 0 ? '' : String(toHitMagic));
      setItemWeaponToHitMisc(toHitMisc === 0 ? '' : String(toHitMisc));
      setItemWeaponDamageMagic(dmgMagic === 0 ? '' : String(dmgMagic));
      setItemWeaponDamageMisc(dmgMisc === 0 ? '' : String(dmgMisc));
      setItemWeaponDamageNumDice(numDice === 1 ? '' : String(numDice));
      setItemWeaponDamageDieType(Number(editModal.item?.weaponDamageDieType) || 8);
      
      // Load extra damage dice
      const loadedExtraDice = Array.isArray(editModal.item?.weaponExtraDice) ? editModal.item.weaponExtraDice : [];
      setItemWeaponExtraDice(loadedExtraDice);

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
        perLevelBonus: Number(editModal.spell.perLevelBonus) || 0,
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
        diceType: spell.diceType || '',
        perLevelBonus: Number(spell.perLevelBonus) || 0,
        verbal: !!spell.verbal,
        somatic: !!spell.somatic,
        material: !!spell.material,
        materialDesc: spell.materialDesc || ''
      });
    }
  }, [editModal, char]);

  // Permanent / used-today flags are tracked on grimoire *entries* (each entry is one "copy" of a spell).
  const hasAnyPermanent = !!char && (char.grimoires || []).some(g => (g.entries || []).some(e => !!e.permanent));
  const hasAnyUsedPermanentToday = !!char && (char.grimoires || []).some(g => (g.entries || []).some(e => !!e.permanent && !!e.usedToday));

  const rollDice = (sides) => Math.floor(Math.random() * sides) + 1;

  // Roll attributes based on selected method
  const rollAttributeSet = () => {
    const newRolls = [];
    
    if (attributeRollMethod === 1) {
      // Method 1: Roll 3d6, take total
      for (let i = 0; i < 6; i++) {
        const dice = [rollDice(6), rollDice(6), rollDice(6)];
        const total = dice.reduce((sum, d) => sum + d, 0);
        newRolls.push({ dice, droppedIndex: -1, total });
      }
    } else if (attributeRollMethod === 2) {
      // Method 2: Roll 4d6, drop lowest
      for (let i = 0; i < 6; i++) {
        const dice = [rollDice(6), rollDice(6), rollDice(6), rollDice(6)];
        // Find the index of the lowest die (first occurrence only)
        let minVal = dice[0];
        let droppedIndex = 0;
        for (let j = 1; j < 4; j++) {
          if (dice[j] < minVal) {
            minVal = dice[j];
            droppedIndex = j;
          }
        }
        // Sum all dice except the dropped one
        const total = dice.reduce((sum, d, idx) => idx === droppedIndex ? sum : sum + d, 0);
        newRolls.push({ dice, droppedIndex, total });
      }
    } else if (attributeRollMethod === 3) {
      // Method 3: Roll 3d6 six times per attribute, take highest total
      const attrNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
      for (let i = 0; i < 6; i++) {
        let bestRoll = null;
        let bestTotal = 0;
        const allSixRolls = [];
        for (let r = 0; r < 6; r++) {
          const dice = [rollDice(6), rollDice(6), rollDice(6)];
          const total = dice.reduce((sum, d) => sum + d, 0);
          allSixRolls.push({ dice, total });
          if (total > bestTotal) {
            bestTotal = total;
            bestRoll = { dice, total, rollIndex: r };
          }
        }
        newRolls.push({ 
          dice: bestRoll.dice, 
          droppedIndex: -1, 
          total: bestTotal, 
          attrName: attrNames[i],
          allRolls: allSixRolls,
          bestRollIndex: bestRoll.rollIndex
        });
      }
    }
    
    setAttributeRolls(newRolls);
  };
  
  // Insert Method 3 rolls into attributes
  const insertMethod3Rolls = () => {
    if (attributeRollMethod !== 3 || attributeRolls.length !== 6) return;
    const attrKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const newAttributes = { ...char.attributes };
    attrKeys.forEach((key, idx) => {
      newAttributes[key] = {
        ...newAttributes[key],
        rolledScore: attributeRolls[idx].total
      };
    });
    updateChar({ attributes: newAttributes });
    setAttributeRolls([]);
    setAttributeRollerOpen(false);
  };

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
    // Retained spells: one per character level (regardless of class)
    // Use XP-derived level from calculateNextLevel
    const derivedLevel = (typeof calculateNextLevel === 'function' ? (calculateNextLevel().currentLevel || 1) : 1);
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
      showToast(`Not enough space in ${g.name}. Need ${cost} points, only ${left} left.`, 'warning');
      return;
    }
    const newEntry = {
      instanceId: generateNumericId(),
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
    setConfirmModal({
      message: `Delete grimoire "${g.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
      onConfirm: () => updateChar({ grimoires: (char.grimoires || []).filter(x => x.id !== grimoireId) })
    });
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
      showToast("No room left in this item.", 'warning');
      return;
    }

    const newEntries = Array.from({ length: addCount }).map(() => ({
      id: generateId(),
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
  const setMagicItemSpellNumDice = (itemId, spellName, permanent, numDice, shouldClamp = false) => {
    const n = shouldClamp ? Math.max(1, Math.min(99, parseInt(numDice) || 1)) : (numDice === '' ? '' : (parseInt(numDice) || 1));
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

  const updateChar = useCallback((updates: Partial<Character>) => {
    setCharacters(prevChars => {
      const newChars = [...prevChars];
      if (currentCharIndex !== null && newChars[currentCharIndex]) {
        newChars[currentCharIndex] = { ...newChars[currentCharIndex], ...updates };
      }
      return newChars;
    });
  }, [currentCharIndex]);

  // Helper to move items to a container (with merging of same items)
  const moveItemToContainer = useCallback((sourceItemId: number, containerId: number, quantity: number) => {
    if (!char) return;
    
    const sourceItem = char.inventory.find(i => i.id === sourceItemId);
    const container = char.inventory.find(i => i.id === containerId);
    if (!sourceItem || !container) return;
    
    const sourceQty = Number(sourceItem.quantity) || 1;
    const moveQty = Math.min(quantity, sourceQty);
    
    if (moveQty <= 0) return;
    
    // Check if there's already an item of the same name in the container to merge with
    const existingInContainer = char.inventory.find(i => 
      i.storedInId === containerId && 
      i.name === sourceItem.name && 
      i.id !== sourceItemId &&
      // Only merge if they have the same basic properties
      i.ev === sourceItem.ev &&
      i.weightPer === sourceItem.weightPer
    );
    
    let newInventory = [...char.inventory];
    
    if (existingInContainer) {
      // Merge into existing item in container
      newInventory = newInventory.map(i => {
        if (i.id === existingInContainer.id) {
          return { ...i, quantity: (Number(i.quantity) || 1) + moveQty };
        }
        if (i.id === sourceItemId) {
          if (sourceQty - moveQty <= 0) {
            return null; // Will be filtered out
          }
          return { ...i, quantity: sourceQty - moveQty };
        }
        return i;
      }).filter(Boolean);
    } else {
      // No existing item to merge with
      if (moveQty === sourceQty) {
        // Move entire stack
        newInventory = newInventory.map(i => 
          i.id === sourceItemId ? { ...i, storedInId: containerId } : i
        );
      } else {
        // Split: create new item in container, reduce source
        const newItem = {
          ...sourceItem,
          id: Date.now(),
          quantity: moveQty,
          storedInId: containerId
        };
        newInventory = newInventory.map(i => 
          i.id === sourceItemId ? { ...i, quantity: sourceQty - moveQty } : i
        );
        newInventory.push(newItem);
      }
    }
    
    updateChar({ inventory: newInventory });
  }, [char, updateChar]);

  const toggleEquippedEffectItem = useCallback((section: 'attack' | 'unarmed' | 'ac', id: number | string) => {
    if (!char) return;
    const sid = String(id);
    const cur = ensureEquippedEffectShape(char);
    const next = cur[section].includes(sid) ? cur[section].filter(x => x !== sid) : [...cur[section], sid];
    updateChar({ equippedEffectItemIds: { ...cur, [section]: next } });
  }, [char, updateChar]);

  // ===== EXTRACTED HANDLER FUNCTIONS =====
  // These replace complex inline onClick handlers for better readability and testability

  /** Handler for saving an attack (new or edit) */
  const handleSaveAttack = useCallback(() => {
    if (!char || !editModal) return;
    
    const existing = (char.attacks || []).find(a => a.id === editModal.attack?.id) || (editModal.attack || {});
    const appliedIdsRaw = Array.isArray(editModal.attack?.appliedEffectItemIds)
      ? editModal.attack.appliedEffectItemIds
      : (Array.isArray(editModal.appliedEffectItemIds) ? editModal.appliedEffectItemIds : []);
    const appliedEffectItemIds = appliedIdsRaw.map((x: string | number) => String(x));

    const newAttack = {
      ...existing,
      ...editModal.attack,
      id: editModal.attack?.id || existing.id || generateNumericId(),
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
    
    const newAtks = editModal.type === 'newAttack' 
      ? [...char.attacks, newAttack]
      : char.attacks.map(a => a.id === newAttack.id ? newAttack : a);
    
    updateChar({ attacks: newAtks });
    setEditModal(null);
  }, [char, editModal, attackForm, updateChar]);

  /** Handler for deleting an attack */
  const handleDeleteAttack = useCallback(() => {
    if (!char || !editModal?.attack) return;
    updateChar({ attacks: char.attacks.filter(a => a.id !== editModal.attack.id) });
    setEditModal(null);
  }, [char, editModal, updateChar]);

  /** Handler for saving a companion */
  const handleSaveCompanion = useCallback(() => {
    if (!char) return;
    
    const companionData = {
      id: editModal?.companion?.id || generateNumericId(),
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
      attacks: editModal?.companion?.attacks || []
    };

    if (editModal?.type === 'newCompanion') {
      updateChar({ companions: [...(char.companions || []), companionData] });
    } else {
      updateChar({
        companions: (char.companions || []).map(c => 
          c.id === companionData.id ? companionData : c
        )
      });
    }
    setEditModal(null);
  }, [char, editModal, companionForm, updateChar]);

  /** Handler for deleting a companion */
  const handleDeleteCompanion = useCallback(() => {
    if (!char || !editModal?.companion) return;
    updateChar({ 
      companions: (char.companions || []).filter(c => c.id !== editModal.companion.id) 
    });
    setEditModal(null);
  }, [char, editModal, updateChar]);

  /** Handler for saving a companion attack */
  const handleSaveCompanionAttack = useCallback(() => {
    if (!char || !editModal?.companion) return;
    
    const attackData = {
      id: editModal?.attack?.id || generateNumericId(),
      isFavorite: !!editModal?.attack?.isFavorite,
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

    const updatedCompanions = (char.companions || []).map(c => {
      if (c.id !== editModal.companion.id) return c;
      
      const attacks = editModal.type === 'newCompanionAttack'
        ? [...(c.attacks || []), attackData]
        : (c.attacks || []).map(a => a.id === attackData.id ? attackData : a);
      
      return { ...c, attacks };
    });

    updateChar({ companions: updatedCompanions });
    setEditModal(null);
  }, [char, editModal, compAttackForm, updateChar]);

  /** Handler for deleting a companion attack */
  const handleDeleteCompanionAttack = useCallback(() => {
    if (!char || !editModal?.companion || !editModal?.attack) return;
    
    const updatedCompanions = (char.companions || []).map(c => {
      if (c.id !== editModal.companion.id) return c;
      return {
        ...c,
        attacks: (c.attacks || []).filter(a => a.id !== editModal.attack.id)
      };
    });

    updateChar({ companions: updatedCompanions });
    setEditModal(null);
  }, [char, editModal, updateChar]);

  /** Handler for toggling attack effect item selection */
  const handleToggleAttackEffectItem = useCallback((itemId: number | string) => {
    if (!editModal) return;
    
    const selected = Array.isArray(editModal.attack?.appliedEffectItemIds)
      ? editModal.attack.appliedEffectItemIds.map((x: string | number) => String(x))
      : (Array.isArray(editModal.appliedEffectItemIds) ? editModal.appliedEffectItemIds.map((x: string | number) => String(x)) : []);
    
    const selectedSet = new Set(selected);
    const sid = String(itemId);
    
    if (selectedSet.has(sid)) {
      selectedSet.delete(sid);
    } else {
      selectedSet.add(sid);
    }
    
    const arr = Array.from(selectedSet);
    setEditModal({
      ...editModal,
      appliedEffectItemIds: arr,
      attack: { ...(editModal.attack || {}), appliedEffectItemIds: arr }
    });
  }, [editModal]);

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

  // Swipe navigation handlers (must be before conditional returns to follow hooks rules)
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchEndRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const touchStartedInTabBar = useRef<boolean>(false);
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchEndRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    // Check if touch started in the tab bar
    touchStartedInTabBar.current = tabBarRef.current?.contains(e.target as Node) || false;
  }, []);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  
  const handleTouchEnd = useCallback(() => {
    // Skip swipe navigation if touch started in tab bar (let user scroll tabs)
    if (touchStartedInTabBar.current) {
      touchStartedInTabBar.current = false;
      return;
    }
    
    const tabs = ['main', 'attack', 'inventory', 'magic', 'saves', 'dice', 'companion', 'notes'];
    const deltaX = touchEndRef.current.x - touchStartRef.current.x;
    const deltaY = touchEndRef.current.y - touchStartRef.current.y;
    
    // Only trigger if horizontal swipe is greater than vertical (to not interfere with scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > MIN_SWIPE_DISTANCE) {
      const currentIndex = tabs.indexOf(activeTab);
      let newTab: string | null = null;
      if (deltaX < 0 && currentIndex < tabs.length - 1) {
        // Swipe left - go to next tab
        newTab = tabs[currentIndex + 1];
      } else if (deltaX > 0 && currentIndex > 0) {
        // Swipe right - go to previous tab
        newTab = tabs[currentIndex - 1];
      }
      if (newTab) {
        setActiveTab(newTab);
        // Scroll the tab button into view
        setTimeout(() => {
          tabButtonRefs.current[newTab as string]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 10);
      }
    }
  }, [activeTab]);

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
        <>
          <style>{lightThemeStyles}</style>
          <div className={`min-h-screen ${theme.bg} ${theme.text} flex items-center justify-center ${!isDarkTheme ? 'light-theme' : ''}`}>
            <div className="text-center">
              <div className="text-4xl font-bold mb-4">Castles & Crusades</div>
              <div className={theme.textMuted}>Loading...</div>
            </div>
          </div>
        </>
      );
    }
    
    return (<>
      <style>{lightThemeStyles}</style>
      <div className={`min-h-screen ${theme.bg} ${theme.text} p-4 overflow-x-hidden ${!isDarkTheme ? 'light-theme' : ''}`}>
        <div className={`max-w-2xl mx-auto ${theme.bgCard} rounded-lg p-8`}>
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-4xl font-bold text-center">Castles & Crusades</h1>
            {hasSeenAppInfo && (
              <button
                onClick={() => setEditModal({ type: 'appInfo' })}
                className={`p-2 ${theme.bgCard2} rounded ${theme.hover}`}
              >
                <Info size={20} />
              </button>
            )}
          </div>
          
          {/* Info Button - Prominent for first-time users */}
          {!hasSeenAppInfo && (
            <div className="flex justify-center mb-6">
              <button
                onClick={() => {
                  setEditModal({ type: 'appInfo' });
                  setHasSeenAppInfo(true);
                  localStorage.setItem('cac-seen-app-info', 'true');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 text-white font-semibold"
              >
                <Info size={18} />
                <span>Click Here Before Creating a Character</span>
              </button>
            </div>
          )}
          
          {/* Import Error Only */}
          {importError && (
            <div className="text-center mb-4">
              <span className="text-red-400 text-sm">{importError}</span>
            </div>
          )}

          {/* Export/Import Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleExport}
              disabled={characters.length === 0}
              className={`flex-1 py-2 ${theme.bgCard2} rounded text-sm ${theme.hover} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1`}
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className={`flex-1 py-2 ${theme.bgCard2} rounded text-sm ${theme.hover} flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isImporting ? (
                <>
                  <LoadingSpinner size="sm" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Import
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => {
              setCharacters([...characters, createNewCharacter()]);
              setCurrentCharIndex(characters.length);
              // Reset attribute roller state for new character
              setAttributeRolls([]);
              setShowRolledAttributes(false);
              setAttributeRollerOpen(false);
            }}
            className="w-full py-4 bg-green-600 rounded-lg text-xl font-bold mb-6 hover:bg-green-700 text-white"
          >
            + Create New Character
          </button>
          <h2 className="text-2xl font-bold mb-4">Your Characters</h2>
          {characters.length === 0 && (
            <div className={`text-center ${theme.textMuted} py-8`}>
              <p>No characters yet.</p>
              <p className="text-sm mt-2">Create a new character or import a backup file.</p>
            </div>
          )}
          {characters.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 mb-3">
              <button
                onClick={() => {
                  setCurrentCharIndex(i);
                  // Reset attribute roller state when switching characters
                  setAttributeRolls([]);
                  setShowRolledAttributes(false);
                  setAttributeRollerOpen(false);
                }}
                className={`flex-1 p-4 ${theme.bgCard2} rounded-lg text-left ${theme.hover}`}
              >
                <div className="text-xl font-bold">{c.name}</div>
                <div className={theme.textMuted}>
                  {c.race} {c.class1} {getXpDerivedLevel(c)}
                  {c.classType === 'multi' && c.class2 && ` / ${c.class2} ${getXpDerivedLevel(c)}`}
                  {c.classType === 'multi' && c.class3 && ` / ${c.class3} ${getXpDerivedLevel(c)}`}
                  {c.classType === 'classAndHalf' && c.class2 && ` / ${c.class2} ${Math.floor(getXpDerivedLevel(c) / 2)}`}
                  {!c.classType && c.class2 && ` / ${c.class2} ${c.class2Level || 0}`}
                </div>
              </button>
              <button 
                onClick={() => setEditModal({ type: 'confirmDeleteCharacter', index: i })} 
                className="p-4 bg-red-600 rounded-lg hover:bg-red-700 text-white"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}

          {/* App Info */}
          <div className={`text-center text-sm mt-8 pt-4 border-t ${theme.border2} ${theme.textMuted}`}>
            <button
              onClick={toggleTheme}
              className={`mb-3 px-4 py-2 rounded-lg ${theme.bgCard2} ${theme.hover} ${theme.text} flex items-center gap-2 mx-auto`}
            >
              {isDarkTheme ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
            <div>C&C Character Sheet v1.0</div>
            <div>Created by Rwpull</div>
          </div>
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

      {/* Import Confirmation Modal */}
      {editModal?.type === 'importConfirm' && pendingImport && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className={`${theme.bgCard} rounded-lg p-6 w-full max-w-md`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${theme.text}`}>Import Characters</h2>
              <button
                onClick={handleImportCancel}
                className={`p-2 ${theme.bgCard2} rounded ${theme.hover}`}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className={`text-sm ${theme.textMuted2} mb-6`}>
              Found <span className="font-semibold">{pendingImport.length}</span> character(s) to import. 
              How would you like to proceed?
            </p>

            <div className="space-y-3">
              <button
                onClick={handleImportReplace}
                className="w-full py-3 bg-red-600 rounded-lg hover:bg-red-700 font-semibold text-white"
              >
                Replace All ({characters.length} current → {pendingImport.length} new)
              </button>
              
              <button
                onClick={handleImportMerge}
                className="w-full py-3 bg-blue-600 rounded-lg hover:bg-blue-700 font-semibold text-white"
              >
                Add to Existing ({characters.length} + {pendingImport.length} = {characters.length + pendingImport.length})
              </button>
              
              <button
                onClick={handleImportCancel}
                className={`w-full py-3 ${theme.bgCard2} rounded-lg ${theme.hover} font-semibold`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal?.type === 'appInfo' && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className={`${theme.bgCard} rounded-lg p-6 w-full max-w-lg`} style={{ maxHeight: 'calc(100dvh - 2rem)', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${theme.text}`}>About This App</h2>
              <button
                onClick={closeModal}
                className={`p-2 ${theme.bgCard2} rounded ${theme.hover}`}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className={`text-sm ${theme.textMuted2} space-y-4`}>
              <p>
                This character tracking app is designed to be used in conjunction with the <span className={`font-semibold ${theme.text}`}>Castles & Crusades Players Handbook</span>, <span className={`font-semibold ${theme.text}`}>Adventurers Backpack</span>, and <span className={`font-semibold ${theme.text}`}>Castle Keepers Guide</span>. It is not meant to replace the books, but to replace the printed paper character sheet.
              </p>

              <div>
                <div className={`font-bold ${theme.text} mb-2`}>Getting Started:</div>
                <p className={theme.textMuted2}>
                  Using the Player's Handbook or Adventurer's Backpack, enter the XP needed for each level in "Level XP". As you gain XP throughout the campaign, the app will track your progress automatically.
                </p>
              </div>

              <div>
                <div className={`font-bold ${theme.text} mb-2`}>Class Types:</div>
                <p className={`${theme.textMuted2} mb-2`}>
                  Click "Edit Class" on the Main tab to choose your class configuration:
                </p>
                <ul className={`list-disc list-inside space-y-2 ${theme.textMuted2}`}>
                  <li><span className="text-blue-400 font-semibold">Single Class:</span> One class with standard XP progression. Enter your class's XP requirements in Level XP.</li>
                  <li><span className="text-green-400 font-semibold">Multi-Class:</span> 2-3 classes that level together. Enter each class's XP requirements separately - the app combines them plus the multi-class bonus (+200 XP/level for 2 classes, +300 XP/level for 3 classes).</li>
                  <li><span className="text-purple-400 font-semibold">Class and a Half:</span> Primary class at full XP, supporting class at half speed. The supporting class XP is split across 2 primary levels (first half at levels 2,4,6... second half at 3,5,7...).</li>
                </ul>
              </div>

              <div>
                <div className={`font-bold ${theme.text} mb-2`}>Features:</div>
                <ul className={`list-disc list-inside space-y-1 ${theme.textMuted2}`}>
                  <li>Roll attributes using your preferred method (3d6, 4d6 drop lowest, or best of 6)</li>
                  <li>Track your attribute modifiers as you increase in level</li>
                  <li>Track your HP with automatic CON modifier calculations</li>
                  <li>Track your experience and see when you reach your next level</li>
                  <li>Track AC based on Race abilities, Armor, and Shield modifiers</li>
                  <li>Track your inventory including weight and encumbrance</li>
                  <li>Store items and coins in containers (bags, pouches, etc.)</li>
                  <li>Add inventory items that give Attribute, Speed, HP, and AC bonuses, as well as items that give bonuses to weapons</li>
                  <li>Perform money exchange using Gold as your base currency</li>
                  <li>Track ammo usage when used with a ranged weapon</li>
                  <li>Show attack rolls with all bonuses applied</li>
                  <li>Track what spells you know and have prepared</li>
                  <li>Track your magical inventory and daily spell uses</li>
                  <li>Track Checks and Saves with appropriate modifiers, including +6 for Prime Attributes</li>
                  <li>Track companions including their details, attacks, and HP</li>
                  <li>Use counters to track limited-use abilities (stuns, rages, etc.)</li>
                  <li>Use a multitude of dice to roll for whatever you may need</li>
                  <li>Notes section with date and time to track your group's progress</li>
                </ul>
              </div>

              <div className={`${theme.bgCard2} p-3 rounded`}>
                <p className={theme.textMuted2}>
                  This app does not have everything. If there is anything you think should be included, please reach out:
                </p>
                <p className="font-semibold text-blue-400 mt-1">Rwpull@gmail.com</p>
              </div>
            </div>

            <button
              onClick={closeModal}
              className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-4 font-semibold text-white"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>);
  }

  const { nextLevelXp, progress, canLevelUp, currentLevel } = calculateNextLevel();

  return (
    <>
    <style>{lightThemeStyles}</style>
    <div 
      className={`min-h-screen ${theme.bg} ${theme.text} p-4 overflow-x-hidden ${!isDarkTheme ? 'light-theme' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >

      <div className="max-w-4xl mx-auto mb-4">
        <div ref={tabBarRef} className={`flex gap-2 overflow-x-auto ${theme.bgCard} rounded-lg p-2`}>
          {[
            { id: 'main', label: 'Main' },
            { id: 'attack', label: 'Attack' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'magic', label: 'Magic' },
            { id: 'saves', label: 'Checks/Saves' },
            { id: 'dice', label: 'Dice/Counter' },
            { id: 'companion', label: 'Companion' },
            { id: 'notes', label: 'Notes' }
          ].map(({ id, label }) => (
            <button
              key={id}
              ref={(el) => { tabButtonRefs.current[id] = el; }}
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
              <button 
                onClick={() => setEditModal({ type: 'mainTabInfo' })}
                className="p-2 bg-gray-700 rounded hover:bg-gray-600 ml-auto"
              >
                <Info size={16} />
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
                    {/* Single class or no class type set */}
                    {(!char.classType || char.classType === 'single') && (
                      <>
                        {char.class1} {currentLevel}
                        {memoizedLevelInfo.drainedLevels > 0 && (
                          <span className="text-red-400 text-sm ml-1">(Eff: {memoizedLevelInfo.effectiveLevel})</span>
                        )}
                        {/* Legacy class2 display for non-typed characters */}
                        {!char.classType && char.class2 && <div>{char.class2} {char.class2Level}</div>}
                      </>
                    )}
                    {/* Multi-class: show each class on its own line with level */}
                    {char.classType === 'multi' && (
                      <div className="space-y-0.5">
                        <div>{char.class1} {currentLevel}</div>
                        {char.class2 && <div>{char.class2} {currentLevel}</div>}
                        {char.class3 && <div>{char.class3} {currentLevel}</div>}
                        {memoizedLevelInfo.drainedLevels > 0 && (
                          <span className="text-red-400 text-sm">(Eff: {memoizedLevelInfo.effectiveLevel})</span>
                        )}
                      </div>
                    )}
                    {/* Class and a half: primary at current level, supporting at half */}
                    {char.classType === 'classAndHalf' && (
                      <div className="space-y-0.5">
                        <div>{char.class1} {currentLevel}</div>
                        {char.class2 && <div>{char.class2} {Math.floor(currentLevel / 2)}</div>}
                        {memoizedLevelInfo.drainedLevels > 0 && (
                          <span className="text-red-400 text-sm">(Eff: {memoizedLevelInfo.effectiveLevel})</span>
                        )}
                      </div>
                    )}
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
                {/* Level drain indicator */}
                {memoizedLevelInfo.drainedLevels > 0 && (
                  <div className="text-xs text-red-400 mb-1">
                    ⚠️ {memoizedLevelInfo.drainedLevels} level{memoizedLevelInfo.drainedLevels !== 1 ? 's' : ''} drained
                  </div>
                )}
                <div className="flex gap-1">
                  <button onClick={openHpModal} className="flex-1 px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500">
                    Edit HP
                  </button>
                  <button onClick={() => {
                      // Use hpRollsByLevel if available (new system)
                      // If using old hpByLevel data, subtract CON mod to get base rolls
                      const conMod = calcMod(getAttributeTotal('con'));
                      let rolls;
                      
                      if (char.hpRollsByLevel && char.hpRollsByLevel.length > 0) {
                        // New system - already has base rolls
                        rolls = char.hpRollsByLevel;
                      } else if (char.hpByLevel && char.hpByLevel.length > 0) {
                        // Old system - subtract CON mod to get base rolls
                        rolls = char.hpByLevel.map(total => {
                          if (total <= 0) return 0;
                          // Subtract CON mod to get the original roll (minimum 1)
                          return Math.max(1, total - conMod);
                        });
                      } else {
                        rolls = [0, 0, 0];
                      }
                      
                      const padded = rolls.slice();
                      while (padded.length < 3) padded.push(0);
                      
                      // Convert to strings for the draft state
                      const rollStrings = padded.map((v) => {
                        const roll = Number(v) || 0;
                        return roll > 0 ? String(roll) : '';
                      });
                      setHpDraftRolls(rollStrings);

                      let lastFilled = -1;
                      for (let i = 0; i < rollStrings.length; i++) { 
                        if ((parseInt(rollStrings[i] || '0', 10) || 0) > 0) lastFilled = i; 
                      }
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
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold">Attributes</h3>
                <button
                  onClick={() => setAttributeRollerOpen(true)}
                  className="p-2 bg-gray-700 rounded hover:bg-gray-600"
                  title="Roll Attributes"
                >
                  🎲
                </button>
              </div>
              
              {/* Display rolled attribute totals */}
              {showRolledAttributes && attributeRolls.length === 6 && (
                <div className="bg-yellow-900/50 border border-yellow-600 rounded p-3 mb-3">
                  <div className="text-sm text-yellow-300 mb-2">Rolled Attributes:</div>
                  <div className="grid grid-cols-3 gap-2 justify-items-center max-w-xs mx-auto">
                    {attributeRolls.map((roll, idx) => (
                      <span key={idx} className="bg-yellow-700 px-4 py-1 rounded font-bold text-lg text-center">
                        {roll.total}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(char.attributes).map(([key, attr]) => {
                  const rolled = getAttributeRolled(key);
                  const raceMod = getRaceAttributeBonus(key);
                  const classMod = getClassAttributeBonus(key);
                  const bonusMod = getAttributeBonusMod(key);
                  const itemMod = getItemAttributeBonus(key);
                  const totalScore = rolled + raceMod + classMod + bonusMod + itemMod;
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
      {((char.classAbilities || []).length || (char.classAttributeMods || []).length ? 'Edit' : 'Add')}
    </button>
  </div>
  {/* Class Attribute Modifiers */}
  {(char.classAttributeMods || []).length > 0 && (() => {
    const mods = char.classAttributeMods || [];
    return (
      <div className="space-y-2 mb-3 text-sm">
        <div className="bg-gray-700 p-2 rounded">
          <span className="font-semibold">Attributes:</span>{" "}
          {mods.map((m, i) => (
            <span key={i}>
              {String(m.attr).toUpperCase()} {Number(m.value) >= 0 ? "+" : ""}{Number(m.value) || 0}
              {i < mods.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      </div>
    );
  })()}
  {(char.classAbilities || []).length === 0 && (char.classAttributeMods || []).length === 0 ? (
    <div className="text-sm text-gray-400">No class abilities added.</div>
  ) : (char.classAbilities || []).length > 0 && (
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

{/* Character Details Section */}
<div className="mt-6 bg-gray-800 rounded-lg p-4">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-xl font-bold">Details</h2>
    <button
      onClick={() => setEditModal({ type: 'characterDetails' })}
      className="p-2 bg-gray-700 rounded hover:bg-gray-600"
    >
      <Edit2 size={16} />
    </button>
  </div>
  
  <div className="space-y-3">
    {/* Age, Height, Weight on same line */}
    <div className="flex gap-4 text-sm">
      <div>
        <span className="text-gray-400">Age:</span>{' '}
        <span>{char.age || '—'}</span>
      </div>
      <div>
        <span className="text-gray-400">Height:</span>{' '}
        <span>{char.height || '—'}</span>
      </div>
      <div>
        <span className="text-gray-400">Weight:</span>{' '}
        <span>{char.weight || '—'}</span>
      </div>
    </div>
    
    {/* Description */}
    {char.description && (
      <div>
        <div className="text-sm text-gray-400 mb-1">Description</div>
        <div className="text-sm whitespace-pre-wrap">{char.description}</div>
      </div>
    )}
    
    {/* Backstory */}
    {char.backstory && (
      <div>
        <div className="text-sm text-gray-400 mb-1">Backstory</div>
        <div className="text-sm whitespace-pre-wrap">{char.backstory}</div>
      </div>
    )}
    
    {/* Show placeholder if nothing filled in */}
    {!char.age && !char.height && !char.weight && !char.description && !char.backstory && (
      <div className="text-gray-500 text-sm italic">No details added yet. Click edit to add.</div>
    )}
  </div>
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
                  className="p-2 bg-gray-700 rounded hover:bg-gray-600"
                >
                  <Info size={16} />
                </button>
                <button onClick={() => setEditModal({ type: 'bthBase' })} className="px-3 py-2 bg-purple-600 rounded hover:bg-purple-700 text-sm">
                  BTH
                </button>
                <button onClick={openBonusModifiersModal} className="px-3 py-2 bg-purple-600 rounded hover:bg-purple-700 text-sm">
                  Bonus Modifiers
                </button>
              </div>
            </div>

            {/* Initiative Roller */}
            <div className="bg-gray-700 p-3 rounded">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">🎲 Init</span>
                  {char.initiativeRoll != null && (() => {
                    const totalBonus = (char.initiativeBonuses || []).reduce((sum, b) => sum + (Number(b.value) || 0), 0);
                    const total = char.initiativeRoll + totalBonus;
                    return (
                      <span className="text-xl font-bold text-yellow-400">
                        {total}
                        {totalBonus !== 0 && (
                          <span className="text-sm text-gray-400 ml-1">
                            ({char.initiativeRoll}{totalBonus >= 0 ? '+' : ''}{totalBonus})
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setEditModal({ type: 'initiativeBonus' })}
                    className="px-2 py-1 bg-gray-600 rounded hover:bg-gray-500 text-xs"
                  >
                    Bonus{(char.initiativeBonuses || []).length > 0 && ` (${(char.initiativeBonuses || []).reduce((sum, b) => sum + (Number(b.value) || 0), 0) >= 0 ? '+' : ''}${(char.initiativeBonuses || []).reduce((sum, b) => sum + (Number(b.value) || 0), 0)})`}
                  </button>
                  <button
                    onClick={() => {
                      const roll = rollDice(10);
                      updateChar({ initiativeRoll: roll });
                    }}
                    className="px-2 py-1 bg-blue-600 rounded hover:bg-blue-700 text-xs font-bold"
                  >
                    Roll
                  </button>
                  {char.initiativeRoll != null && (
                    <button
                      onClick={() => updateChar({ initiativeRoll: null })}
                      className="px-2 py-1 bg-gray-600 rounded hover:bg-gray-500 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {/* Show bonus sources */}
              {(char.initiativeBonuses || []).length > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  {(char.initiativeBonuses || []).map((b, i) => (
                    <span key={i}>
                      {i > 0 && ', '}
                      {b.description || 'Bonus'}: {(Number(b.value) || 0) >= 0 ? '+' : ''}{Number(b.value) || 0}
                    </span>
                  ))}
                </div>
              )}
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

              // Use memoized attribute mods instead of recalculating
              const strModNow = memoizedAttributeMods.str;
              const dexModNow = memoizedAttributeMods.dex;
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

              // Get available ammo items for ranged attacks
              const availableAmmo = isRanged 
                ? (char.inventory || []).filter(it => it.isAmmo && it.quantity > 0)
                : [];
              const selectedAmmoId = selectedAmmoIds[attack.id] || '';
              const selectedAmmoItem = availableAmmo.find(it => String(it.id) === selectedAmmoId);

              // Function to consume one ammo
              const consumeAmmo = () => {
                if (!selectedAmmoId || !selectedAmmoItem) return;
                const newInv = (char.inventory || [])
                  .map(i => i.id === selectedAmmoItem.id 
                    ? { ...i, quantity: Math.max(0, i.quantity - 1) } 
                    : i
                  )
                  .filter(i => i.quantity > 0);
                updateChar({ inventory: newInv });
                
                // If ammo ran out, clear selection
                const remaining = newInv.find(i => String(i.id) === selectedAmmoId);
                if (!remaining) {
                  setSelectedAmmoIds(prev => ({ ...prev, [attack.id]: '' }));
                  showToast(`Out of ${selectedAmmoItem.name}!`, 'warning');
                }
              };

              return (
                <div key={attack.id} className="bg-gray-700 rounded overflow-hidden">
                  {/* Collapsed Header - Always visible */}
                  <div 
                    className="p-3 cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => setExpandedAttackIds(prev => ({ ...prev, [attack.id]: !prev[attack.id] }))}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{expandedAttackIds[attack.id] ? '▼' : '▶'}</span>
                          <h3 className="text-lg font-bold">{attack.weaponId ? getBoundAttackName(attack, char.inventory) : attack.name}</h3>
                        </div>
                        <div className="text-sm ml-6 mt-1">
                          <span className="text-blue-400">To Hit: <span className="font-semibold">{toHit >= 0 ? '+' : ''}{toHit}</span></span>
                          <span className="text-gray-500 mx-2">/</span>
                          <span className="text-red-400">Damage: <span className="font-semibold">{attack.numDice}d{attack.dieType}{dmgBonus >= 0 ? '+' : ''}{dmgBonus}</span></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = (char.attacks || []).map(a =>
                              a.id === attack.id ? { ...a, isFavorite: !a.isFavorite } : a
                            );
                            updateChar({ attacks: updated });
                          }}
                          className={`p-2 rounded hover:bg-gray-500 ${attack.isFavorite ? 'text-yellow-400' : 'text-gray-500'}`}
                          title={attack.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <span className="text-xl">{attack.isFavorite ? '★' : '☆'}</span>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'editAttack', attack }); }} 
                          className="p-2 bg-gray-600 rounded hover:bg-gray-500"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedAttackIds[attack.id] && (
                    <div className="px-3 pb-3 border-t border-gray-600">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                        <div className="bg-gray-800 p-3 rounded">
                          <div className="font-bold text-blue-400 mb-2">TO HIT</div>
                          <div className="text-sm space-y-1 mb-2">
                            <div>BTH (Base): {char.baseBth >= 0 ? '+' : ''}{char.baseBth || 0}</div>
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

                          {/* Ammo selector for ranged attacks */}
                          {isRanged && (
                            <div className="mb-2 p-2 bg-gray-900 rounded">
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-400 whitespace-nowrap">Ammo:</label>
                                <select
                                  value={selectedAmmoId}
                                  onChange={(e) => setSelectedAmmoIds(prev => ({ ...prev, [attack.id]: e.target.value }))}
                                  className="flex-1 p-1 bg-gray-700 rounded text-white text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="">N/A</option>
                                  {availableAmmo.map(ammo => (
                                    <option key={ammo.id} value={String(ammo.id)}>
                                      {ammo.name} ({ammo.quantity})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {selectedAmmoItem && (
                                <div className="text-xs text-gray-400 mt-1">
                                  {selectedAmmoItem.quantity} remaining
                                </div>
                              )}
                            </div>
                          )}

                          <button
                            onClick={() => {
                              setRollModal({ type: 'attack', attack, toHit, manualRoll: '' });
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
                                  setRollResult({ roll, total: roll + toHit, isCrit: roll === 20, isCritFail: roll === 1 });
                                  if (isRanged && selectedAmmoId) consumeAmmo();
                                }}
                                className="w-full py-1 bg-green-600 rounded text-sm mb-1"
                              >
                                Roll d20{isRanged && selectedAmmoId ? ' (uses ammo)' : ''}
                              </button>
                              <div className="flex gap-1 mt-1">
                                <input
                                  type="text" inputMode="numeric"
                                  placeholder="1-20"
                                  value={rollModal.manualRoll || ''}
                                  onChange={(e) => setRollModal({ ...rollModal, manualRoll: e.target.value })}
                                  className="w-16 p-1 bg-gray-800 rounded text-white text-sm text-center"
                                />
                                <button
                                  onClick={() => {
                                    const val = parseInt(rollModal.manualRoll);
                                    if (val >= 1 && val <= 20) {
                                      setRollResult({ roll: val, total: val + toHit, isCrit: val === 20, isCritFail: val === 1 });
                                      if (isRanged && selectedAmmoId) consumeAmmo();
                                      setRollModal({ ...rollModal, manualRoll: '' });
                                    } else {
                                      showToast('Enter a number between 1-20', 'error');
                                    }
                                  }}
                                  className="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700"
                                >
                                  Calc
                                </button>
                              </div>
                              {rollResult && (
                                <div className="mt-2 text-center text-sm">
                                  {rollResult.isCrit && (
                                    <div className="text-xl font-bold text-yellow-400 underline mb-1">Critical!</div>
                                  )}
                                  {rollResult.isCritFail && (
                                    <div className="text-xl font-bold text-red-500 underline mb-1">Critical Fail!</div>
                                  )}
                                  <div>d20: {rollResult.roll} + {toHit}</div>
                                  <div className={`text-xl font-bold ${rollResult.isCritFail ? 'text-red-400' : 'text-green-400'}`}>
                                    Total: {rollResult.total}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="bg-gray-800 p-3 rounded">
                          <div className="font-bold text-red-400 mb-2">DAMAGE</div>
                          
                          {/* Check if we have a critical hit from attack roll */}
                          {rollResult?.isCrit && rollModal?.type !== 'damage' && (
                            <div className="bg-yellow-900 border border-yellow-600 rounded p-2 mb-2 text-center">
                              <div className="text-yellow-400 font-bold text-sm">Critical Hit!</div>
                              <div className="text-xs text-yellow-200">
                                Max dice ({attack.numDice}×{attack.dieType} = {attack.numDice * attack.dieType}) + bonus + d4
                              </div>
                            </div>
                          )}
                          
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
                            <>
                              {/* Normal damage button */}
                              <button
                                onClick={() => {
                                  setRollModal({ type: 'damage', attack, dmgBonus, diceCount: attack.numDice, isCritDamage: false });
                                }}
                                className="w-full py-2 bg-red-600 rounded hover:bg-red-700 mb-1"
                              >
                                Roll Damage
                              </button>
                              
                              {/* Critical damage button - only show if attack was a crit */}
                              {rollResult?.isCrit && rollModal?.type !== 'damage' && (
                                <button
                                  onClick={() => {
                                    setRollModal({ type: 'damage', attack, dmgBonus, diceCount: attack.numDice, isCritDamage: true, critD4: '', critD4Result: null });
                                  }}
                                  className="w-full py-2 bg-yellow-600 rounded hover:bg-yellow-700 font-bold"
                                >
                                  Roll Critical Damage
                                </button>
                              )}
                            </>
                          )}
                          {rollModal?.attack?.id === attack.id && rollModal.type === 'damage' && (
                            <div className="mt-2 p-2 bg-gray-600 rounded">
                              {/* Critical damage mode */}
                              {rollModal.isCritDamage ? (
                                <>
                                  <div className="bg-yellow-900 border border-yellow-600 rounded p-2 mb-2 text-center">
                                    <div className="text-yellow-400 font-bold">Critical Damage</div>
                                    <div className="text-sm text-yellow-200">
                                      Max dice: {attack.numDice * attack.dieType} + Bonus: {dmgBonus} = {attack.numDice * attack.dieType + dmgBonus}
                                    </div>
                                  </div>
                                  
                                  <div className="text-xs text-gray-300 mb-1">Roll or enter d4 for extra damage:</div>
                                  <button
                                    onClick={() => {
                                      const d4Roll = rollDice(4);
                                      const maxDice = attack.numDice * attack.dieType;
                                      const critTotal = maxDice + dmgBonus + d4Roll;
                                      setRollResult({ 
                                        isCritDamage: true,
                                        maxDice,
                                        d4Roll,
                                        bonus: dmgBonus,
                                        total: critTotal
                                      });
                                    }}
                                    className="w-full py-1 bg-green-600 rounded text-sm mb-1"
                                  >
                                    Roll d4
                                  </button>
                                  <div className="flex gap-1 mt-1">
                                    <input
                                      type="text" inputMode="numeric"
                                      placeholder="1-4"
                                      value={rollModal.critD4 || ''}
                                      onChange={(e) => setRollModal({ ...rollModal, critD4: e.target.value })}
                                      className="w-16 p-1 bg-gray-800 rounded text-white text-sm text-center"
                                    />
                                    <button
                                      onClick={() => {
                                        const val = parseInt(rollModal.critD4);
                                        if (val >= 1 && val <= 4) {
                                          const maxDice = attack.numDice * attack.dieType;
                                          const critTotal = maxDice + dmgBonus + val;
                                          setRollResult({ 
                                            isCritDamage: true,
                                            maxDice,
                                            d4Roll: val,
                                            bonus: dmgBonus,
                                            total: critTotal
                                          });
                                          setRollModal({ ...rollModal, critD4: '' });
                                        } else {
                                          showToast('Enter a number between 1-4', 'error');
                                        }
                                      }}
                                      className="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700"
                                    >
                                      Calc
                                    </button>
                                  </div>
                                  {rollResult?.isCritDamage && (
                                    <div className="mt-2 text-center text-sm">
                                      <div>Max Dice: {rollResult.maxDice} + Bonus: {rollResult.bonus} + d4: {rollResult.d4Roll}</div>
                                      <div className="text-2xl font-bold text-yellow-400">Total: {rollResult.total}</div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                /* Normal damage mode */
                                <>
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <label className="text-xs text-gray-300 whitespace-nowrap">Dice #</label>
                                    <input
                                      type="text" inputMode="numeric"
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
                                  <div className="flex gap-1 mt-1">
                                    <input
                                      type="text" inputMode="numeric"
                                      placeholder="Dice total"
                                      value={rollModal.manualDamage || ''}
                                      onChange={(e) => setRollModal({ ...rollModal, manualDamage: e.target.value })}
                                      className="w-20 p-1 bg-gray-800 rounded text-white text-sm text-center"
                                    />
                                    <button
                                      onClick={() => {
                                        const val = parseInt(rollModal.manualDamage);
                                        if (val > 0) {
                                          setRollResult({ rolls: [val], diceTotal: val, total: val + dmgBonus });
                                          setRollModal({ ...rollModal, manualDamage: '' });
                                        } else {
                                          showToast('Enter a valid damage roll', 'error');
                                        }
                                      }}
                                      className="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700"
                                    >
                                      Calc
                                    </button>
                                  </div>
                                  {rollResult?.rolls && (
                                    <div className="mt-2 text-center text-sm">
                                      <div>Dice: {rollResult.diceTotal} + {dmgBonus}</div>
                                      <div className="text-xl font-bold text-red-400">Total: {rollResult.total}</div>
                                    </div>
                                  )}
                                  
                                  {/* Extra Damage Dice (from weapon) */}
                                  {weaponItem?.weaponExtraDice && weaponItem.weaponExtraDice.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-500">
                                      <div className="text-xs text-gray-300 mb-2 font-semibold">Extra Damage Dice</div>
                                      {weaponItem.weaponExtraDice.map((extra, idx) => {
                                        const extraKey = `extra-${attack.id}-${idx}`;
                                        const extraDiceCount = rollModal[`extraDiceCount_${idx}`] ?? extra.numDice;
                                        return (
                                          <div key={idx} className="mb-2 p-2 bg-gray-700 rounded">
                                            <div className="text-xs text-purple-300 mb-1">{extra.label || `Extra ${extra.numDice}d${extra.dieType}`}</div>
                                            <div className="flex items-center gap-2 mb-1">
                                              <label className="text-xs text-gray-400">Dice #</label>
                                              <input
                                                type="text" inputMode="numeric"
                                                value={extraDiceCount}
                                                onChange={(e) => {
                                                  const v = parseInt(e.target.value) || extra.numDice;
                                                  setRollModal({ ...rollModal, [`extraDiceCount_${idx}`]: Math.max(1, v) });
                                                }}
                                                className="w-12 p-1 bg-gray-800 rounded text-white text-xs text-center"
                                              />
                                              <span className="text-xs text-gray-400">d{extra.dieType}</span>
                                            </div>
                                            <button
                                              onClick={() => {
                                                const rolls = [];
                                                for (let i = 0; i < extraDiceCount; i++) {
                                                  rolls.push(rollDice(extra.dieType));
                                                }
                                                const extraTotal = rolls.reduce((a, b) => a + b, 0);
                                                setRollModal({ 
                                                  ...rollModal, 
                                                  [`extraResult_${idx}`]: { rolls, total: extraTotal }
                                                });
                                                // Update total damage if we have a base damage result
                                                if (rollResult?.total) {
                                                  setRollResult({
                                                    ...rollResult,
                                                    extraDamage: (rollResult.extraDamage || 0) - (rollModal[`extraResult_${idx}`]?.total || 0) + extraTotal,
                                                    grandTotal: rollResult.total + (rollResult.extraDamage || 0) - (rollModal[`extraResult_${idx}`]?.total || 0) + extraTotal
                                                  });
                                                }
                                              }}
                                              className="w-full py-1 bg-purple-600 rounded text-xs hover:bg-purple-700"
                                            >
                                              Roll {extraDiceCount}d{extra.dieType}
                                            </button>
                                            {rollModal[`extraResult_${idx}`] && (
                                              <div className="text-center text-xs mt-1">
                                                <div>Rolls: {rollModal[`extraResult_${idx}`].rolls.join(' + ')}</div>
                                                <div className="font-bold text-purple-400">Extra: {rollModal[`extraResult_${idx}`].total}</div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                      
                                      {/* Grand Total if we have extra damage */}
                                      {rollResult?.total && weaponItem.weaponExtraDice.some((_, idx) => rollModal[`extraResult_${idx}`]) && (
                                        <div className="mt-2 pt-2 border-t border-gray-500 text-center">
                                          <div className="text-xs text-gray-400">
                                            Base: {rollResult.total} + Extra: {weaponItem.weaponExtraDice.reduce((sum, _, idx) => sum + (rollModal[`extraResult_${idx}`]?.total || 0), 0)}
                                          </div>
                                          <div className="text-xl font-bold text-green-400">
                                            Grand Total: {rollResult.total + weaponItem.weaponExtraDice.reduce((sum, _, idx) => sum + (rollModal[`extraResult_${idx}`]?.total || 0), 0)}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Favorite and other actions */}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => {
                            const updated = (char.attacks || []).map(a =>
                              a.id === attack.id ? { ...a, isFavorite: !a.isFavorite } : a
                            );
                            updateChar({ attacks: updated });
                          }}
                          className={`px-3 py-1 rounded text-sm ${attack.isFavorite ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-600 hover:bg-gray-500'}`}
                        >
                          {attack.isFavorite ? '★ Favorited' : '☆ Favorite'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'saves' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Checks and Saving Throws</h2>
              <button 
                onClick={() => setEditModal({ type: 'savesTabInfo' })}
                className="p-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                <Info size={16} />
              </button>
            </div>

            <div className="space-y-3">

              {(() => {
                const saveDescriptions = {
                  str: 'Paralysis, Constriction',
                  int: 'Arcane Magic, Illusion',
                  wis: 'Divine Magic, Confusion, Gaze Attack, Polymorph, Petrification',
                  dex: 'Breath Weapons, Traps',
                  con: 'Disease, Energy Drain, Poison',
                  cha: 'Death Attack, Charm, Fear'
                };
                
                return Object.entries(char.attributes).map(([key, attr]) => {
                  const attrTotal = getAttributeTotal(key);
                  const mod = calcMod(attrTotal);
                  const level = getTotalLevel();
                  const prime = attr.isPrime ? char.primeSaveBonus : 0;
                  const saveModifier = char.attributes[key].saveModifier || 0;
                  const encStatus = getEncumbranceStatus();
                  const encDexPenalty = (key === 'dex' && encStatus === 'burdened') ? -2 : 0;
                  const isDexOverburdened = (key === 'dex' && encStatus === 'overburdened');
                  // Save = Level + Mod + Prime + Save Modifier + Encumbrance Penalty
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
                                type="text" inputMode="numeric"
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
                          
                          {/* Save description */}
                          <div className="text-xs text-gray-400 mt-2 text-right">
                            {saveDescriptions[key]}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {activeTab === 'magic' && !spellsLearnedView && !grimoireView && !magicInventoryView && selectedMagicItemId === null && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-2xl font-bold">Magic</h2>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <button
                  onClick={() => setEditModal({ type: 'magicInfo' })}
                  className="p-2 bg-gray-700 rounded hover:bg-gray-600"
                  title="Magic Help"
                >
                  <Info size={16} />
                </button>
                <button
                  onClick={() => { setSpellsLearnedView(false); setGrimoireView(false); setMagicInventoryView(true); setSelectedMagicItemId(null); }}
                  className="px-4 py-2 text-base bg-gray-600 rounded hover:bg-gray-500 font-semibold flex-1 sm:flex-none whitespace-nowrap"
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
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="font-bold text-lg">
                              Level {spell.level} - {spell.name} {count > 1 && <span className="text-blue-400">x{count}</span>}
                            </div>
                            <div className="flex items-center gap-2">
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
                                <span className="text-xs bg-purple-600 px-2 py-1 rounded">Conc</span>
                              </label>
                              <button
                                onClick={() => {
                                  updateChar({ 
                                    spellsPrepared: char.spellsPrepared.filter(s => s.prepId !== prepIds[0])
                                  });
                                }}
                                className="px-3 py-1 text-sm bg-red-600 rounded hover:bg-red-700 font-bold"
                              >
                                Cast
                              </button>
                            </div>
                          </div>
                          
                          {/* Collapsible Description */}
                          <button
                            onClick={() => setExpandedPreparedSpells(prev => ({ ...prev, [spell.id]: !prev[spell.id] }))}
                            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mb-2"
                          >
                            {expandedPreparedSpells[spell.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            Description
                          </button>
                          
                          {expandedPreparedSpells[spell.id] && (
                            <>
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
                            </>
                          )}
                          
                          {spell.hasDiceRoll && (
                            <div className="bg-gray-700 p-3 rounded mt-2">
                              <div className="flex items-center gap-2 mb-2">
                                <label className="text-sm text-gray-400">Number of Dice:</label>
                                <input
                                  type="text" inputMode="numeric"
                                  min="1"
                                  value={char.spellsPrepared.find(s => s.prepId === prepIds[0])?.numDice ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const newPrepared = char.spellsPrepared.map(s => 
                                      s.prepId === prepIds[0] ? { ...s, numDice: val === '' ? '' : (parseInt(val) || 1) } : s
                                    );
                                    updateChar({ spellsPrepared: newPrepared });
                                  }}
                                  onBlur={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    const newPrepared = char.spellsPrepared.map(s => 
                                      s.prepId === prepIds[0] ? { ...s, numDice: Math.max(1, val) } : s
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
                                      const perLevelBonus = Number(spell.perLevelBonus) || 0;
                                      const currentLevel = calculateNextLevel().currentLevel || 1;
                                      const levelBonus = perLevelBonus * currentLevel;
                                      
                                      const rolls = [];
                                      for (let i = 0; i < numDice; i++) {
                                        rolls.push(rollDice(diceValue));
                                      }
                                      const diceTotal = rolls.reduce((a, b) => a + b, 0);
                                      const total = diceTotal + levelBonus;
                                      setRollResult({ rolls, total, levelBonus });
                                    }}
                                    className="w-full py-1 bg-green-600 rounded text-sm mb-1"
                                  >
                                    Roll {char.spellsPrepared.find(s => s.prepId === prepIds[0])?.numDice || 1}{spell.diceType}{spell.perLevelBonus ? ` +${spell.perLevelBonus}/lvl` : ''}
                                  </button>
                                  <div className="text-xs text-gray-300 mb-1">Or enter each die:</div>
                                  {(() => {
                                    const diceKey = `spell-dice-${prepIds[0]}`;
                                    const numDice = char.spellsPrepared.find(s => s.prepId === prepIds[0])?.numDice || 1;
                                    const diceValues = getDiceInputs(diceKey, numDice);
                                    return (
                                      <>
                                        <div className="grid grid-cols-4 gap-1 mb-1">
                                          {Array.from({ length: numDice }).map((_, i) => (
                                            <input
                                              key={i}
                                              type="text" inputMode="numeric"
                                              placeholder={spell.diceType}
                                              value={diceValues[i] || ''}
                                              onChange={(e) => setDiceInput(diceKey, i, parseInt(e.target.value) || 0)}
                                              className="p-1 bg-gray-800 rounded text-white text-xs text-center"
                                            />
                                          ))}
                                        </div>
                                        <button
                                          onClick={() => {
                                            const rolls = diceValues.slice(0, numDice);
                                            if (rolls.every(r => r > 0)) {
                                              const perLevelBonus = Number(spell.perLevelBonus) || 0;
                                              const currentLevel = calculateNextLevel().currentLevel || 1;
                                              const levelBonus = perLevelBonus * currentLevel;
                                              const diceTotal = rolls.reduce((a, b) => a + b, 0);
                                              const total = diceTotal + levelBonus;
                                              setRollResult({ rolls, total, levelBonus });
                                            }
                                          }}
                                          className="w-full py-1 bg-blue-600 rounded text-xs mb-1"
                                        >
                                          Calculate
                                        </button>
                                      </>
                                    );
                                  })()}
                                  {rollResult?.rolls && (
                                    <div className="mt-1 text-center text-sm">
                                      <div>
                                        Dice: {rollResult.rolls.join(' + ')} = {rollResult.rolls.reduce((a, b) => a + b, 0)}
                                        {rollResult.levelBonus !== undefined && rollResult.levelBonus !== null && ` + ${rollResult.levelBonus} (level bonus)`}
                                      </div>
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-2xl font-bold">Grimoires</h2>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <button onClick={() => setGrimoireView(false)} className="px-4 py-2 bg-gray-600 rounded text-base hover:bg-gray-500 flex-1 sm:flex-none whitespace-nowrap">
                  ← Back to Magic
                </button>
                <button
                  onClick={resetPermanentSpellsForNewDay}
                  disabled={!hasAnyPermanent || !hasAnyUsedPermanentToday}
                  className={`px-4 py-2 rounded font-semibold flex-1 sm:flex-none whitespace-nowrap ${
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="order-1 sm:order-1">
                      <div className="text-xl font-bold">{grimoire.name}</div>
                      <div className="text-sm text-gray-300">
                        {pointsLeft} points left (Capacity {grimoire.capacity || 39})
                      </div>
                    </div>
                    <div className="flex gap-2 order-2 sm:order-2 flex-wrap sm:flex-nowrap">
                      <button
                        onClick={() =>
                          setOpenGrimoireIds((prev) => ({
                            ...prev,
                            [grimoire.id]: !prev?.[grimoire.id],
                          }))
                        }
                        className="px-3 py-2 bg-gray-600 rounded hover:bg-gray-500 text-sm font-semibold flex-1 sm:flex-none"
                      >
                        {openGrimoireIds?.[grimoire.id] ? 'Close' : 'Open'}
                      </button>
                      <button
                        onClick={() => setEditModal({ type: 'addSpellToGrimoire', grimoireId: grimoire.id })}
                        className="px-3 py-2 bg-blue-600 rounded hover:bg-blue-700 text-sm flex-1 sm:flex-none"
                      >
                        Add Spell
                      </button>
                      <button
                        onClick={() => deleteGrimoire(grimoire.id)}
                        className="px-3 py-2 bg-red-600 rounded hover:bg-red-700 text-sm flex-1 sm:flex-none"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {openGrimoireIds?.[grimoire.id] && orderedGroups.length === 0 && (
                    <div className="text-sm text-gray-300">No spells in this grimoire</div>
                  )}

                  {openGrimoireIds?.[grimoire.id] && orderedGroups.length > 0 && (
                    <div className="space-y-4">
                      {/* Group spells by level */}
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                        const groupsAtLevel = orderedGroups.filter(g => g.spell?.level === level);
                        if (groupsAtLevel.length === 0) return null;
                        
                        return (
                          <div key={level}>
                            <h4 className="font-bold text-lg mb-2 text-blue-400">
                              Level {level}
                            </h4>
                            <div className="space-y-2">
                              {groupsAtLevel.map(group => {
                                const spell = group.spell;
                                const cost = spellPointCost(spell.level);
                                return (
                                  <div key={`${spell.id}-${group.permanent ? 'perm' : 'cons'}`} className="bg-gray-800 p-3 rounded">
                                    <div className="flex items-start justify-between mb-2 gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="font-bold text-lg">
                                          {spell.name} {group.count > 1 && <span className="text-blue-400">x{group.count}</span>}
                                        </div>
                                        <div className="text-xs text-gray-400">({cost} pt each)</div>
                                      </div>
                                      <button
                                        onClick={() => {
                                          // cast one instance
                                          const entryId = group.entryIds[0];
                                          const entry = (grimoire.entries || []).find(e => e.instanceId === entryId);
                                          if (entry) castFromGrimoire(grimoire.id, entry);
                                        }}
                                        className={`px-4 py-2 rounded font-bold flex-shrink-0 whitespace-nowrap ${
                                          group.permanent && group.usedToday
                                            ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                                            : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                        disabled={false}
                                      >
                                        Cast
                                      </button>
                                    </div>

                            {/* Collapsible Description */}
                            <button
                              onClick={() => setExpandedGrimoireSpells(prev => ({ ...prev, [`${grimoire.id}-${spell.id}-${group.permanent ? 'p' : 'c'}`]: !prev[`${grimoire.id}-${spell.id}-${group.permanent ? 'p' : 'c'}`] }))}
                              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mb-2"
                            >
                              {expandedGrimoireSpells[`${grimoire.id}-${spell.id}-${group.permanent ? 'p' : 'c'}`] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              Description
                            </button>

                            {expandedGrimoireSpells[`${grimoire.id}-${spell.id}-${group.permanent ? 'p' : 'c'}`] && (
                              <>
                                {/* Permanent checkbox at top of expanded section */}
                                <div className="mb-3 pb-3 border-b border-gray-700">
                                  <label className="flex items-center gap-2 text-sm">
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
                                            showGameAlert('Retain Spell', `You have reached your retained spell limit (${limit}). You can retain ${limit} spell${limit === 1 ? '' : 's'} at your current level.`);
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
                                    <span className="font-semibold">Permanent</span>
                                  </label>
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
                              </>
                            )}

                            {spell.hasDiceRoll && (
                              <div className="bg-gray-700 p-3 rounded mt-2">
                                <div className="flex items-center gap-2 mb-2">
                                  <label className="text-sm text-gray-400">Number of Dice:</label>
                                  <input
                                    type="text" inputMode="numeric"
                                    min="1"
                                    value={(grimoire.entries || []).find(e => e.instanceId === group.entryIds[0])?.numDice ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const newGrimoires = (char.grimoires || []).map(g => {
                                        if (g.id !== grimoire.id) return g;
                                        const newEntries = (g.entries || []).map(en => {
                                          if (group.entryIds.includes(en.instanceId)) return { ...en, numDice: val === '' ? '' : (parseInt(val) || 1) };
                                          return en;
                                        });
                                        return { ...g, entries: newEntries };
                                      });
                                      updateChar({ grimoires: newGrimoires });
                                    }}
                                    onBlur={(e) => {
                                      const val = Math.max(1, parseInt(e.target.value) || 1);
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
                                        const perLevelBonus = Number(spell.perLevelBonus) || 0;
                                        const currentLevel = calculateNextLevel().currentLevel || 1;
                                        const levelBonus = perLevelBonus * currentLevel;
                                        
                                        const rolls = [];
                                        for (let i = 0; i < numDice; i++) rolls.push(rollDice(diceValue));
                                        const diceTotal = rolls.reduce((a, b) => a + b, 0);
                                        const total = diceTotal + levelBonus;
                                        setRollResult({ rolls, total, levelBonus });
                                      }}
                                      className="w-full py-1 bg-green-600 rounded text-sm mb-1"
                                    >
                                      Roll {(grimoire.entries || []).find(en => en.instanceId === group.entryIds[0])?.numDice || 1}{spell.diceType}{spell.perLevelBonus ? ` +${spell.perLevelBonus}/lvl` : ''}
                                    </button>
                                    <div className="text-xs text-gray-300 mb-1">Or enter each die:</div>
                                    {(() => {
                                      const diceKey = `grimoire-dice-${group.entryIds[0]}`;
                                      const entry = (grimoire.entries || []).find(en => en.instanceId === group.entryIds[0]);
                                      const numDice = entry?.numDice || 1;
                                      const diceValues = getDiceInputs(diceKey, numDice);
                                      return (
                                        <>
                                          <div className="grid grid-cols-4 gap-1 mb-1">
                                            {Array.from({ length: numDice }).map((_, i) => (
                                              <input
                                                key={i}
                                                type="text" inputMode="numeric"
                                                placeholder={spell.diceType}
                                                value={diceValues[i] || ''}
                                                onChange={(e) => setDiceInput(diceKey, i, parseInt(e.target.value) || 0)}
                                                className="p-1 bg-gray-800 rounded text-white text-xs text-center"
                                              />
                                            ))}
                                          </div>
                                          <button
                                            onClick={() => {
                                              const rolls = diceValues.slice(0, numDice);
                                              if (rolls.every(r => r > 0)) {
                                                const perLevelBonus = Number(spell.perLevelBonus) || 0;
                                                const currentLevel = calculateNextLevel().currentLevel || 1;
                                                const levelBonus = perLevelBonus * currentLevel;
                                                const diceTotal = rolls.reduce((a, b) => a + b, 0);
                                                const total = diceTotal + levelBonus;
                                                setRollResult({ rolls, total, levelBonus });
                                              }
                                            }}
                                            className="w-full py-1 bg-blue-600 rounded text-xs mb-1"
                                          >
                                            Calculate
                                          </button>
                                        </>
                                      );
                                    })()}
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                className="px-3 py-2 text-sm bg-blue-600 rounded hover:bg-blue-700 font-semibold flex-1 sm:flex-none"
              >
                New Day
              </button>
              <button
                onClick={() => {
                  // Reset form and pre-select magic casting
                  resetItemForm();
                  resetItemModal();
                  updateItemModal({ isMagicCasting: true });
                  setEditModal({ type: 'newItem', fromMagicInventory: true });
                }}
                className="px-3 py-2 text-sm bg-green-600 rounded hover:bg-green-700 font-semibold flex-1 sm:flex-none"
              >
                + Add Magic Item
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

                                      {/* Collapsible Spell Details */}
                                      <button
                                        onClick={() => setExpandedMagicItemSpells(prev => ({ ...prev, [`${item.id}-${s.name}-${g.permanent ? 'p' : 'c'}`]: !prev[`${item.id}-${s.name}-${g.permanent ? 'p' : 'c'}`] }))}
                                        className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                                      >
                                        {expandedMagicItemSpells[`${item.id}-${s.name}-${g.permanent ? 'p' : 'c'}`] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        Description
                                      </button>

                                      {expandedMagicItemSpells[`${item.id}-${s.name}-${g.permanent ? 'p' : 'c'}`] && (
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
                                      )}

                              

                                      {s.hasDiceRoll && (
                                        <div className="bg-gray-800 p-3 rounded">
                                          <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <label className="text-sm text-gray-400">Number of Dice:</label>
                                            <input
                                              type="text" inputMode="numeric"
                                              min="1"
                                              value={g.entries?.[0]?.numDice ?? ''}
                                              onChange={(e) => setMagicItemSpellNumDice(item.id, s.name, g.permanent, e.target.value, false)}
                                              onBlur={(e) => setMagicItemSpellNumDice(item.id, s.name, g.permanent, e.target.value, true)}
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
                                                    const perLevelBonus = Number(s.perLevelBonus) || 0;
                                                    const currentLevel = calculateNextLevel().currentLevel || 1;
                                                    const levelBonus = perLevelBonus * currentLevel;
                                                    
                                                    const rolls = [];
                                                    for (let i = 0; i < numDice; i++) {
                                                      rolls.push(rollDice(diceValue));
                                                    }
                                                    const diceTotal = rolls.reduce((a, b) => a + b, 0);
                                                    const total = diceTotal + (Number(s.diceBonus) || 0) + levelBonus;
                                                    setRollResult({ rolls, total, levelBonus });
                                                  }}
                                                  className="w-full py-1 bg-green-600 rounded text-sm mb-1"
                                                >
                                                  Roll {Number(g.entries?.[0]?.numDice || 1)}{s.diceType}{s.perLevelBonus ? ` +${s.perLevelBonus}/lvl` : ''}
                                                </button>
                                                <div className="text-xs text-gray-300 mb-1">Or enter each die:</div>
                                                {(() => {
                                                  const diceKey = `mi-dice-${item.id}-${s.id || s.name}-${g.permanent ? 'p' : 't'}`;
                                                  const numDice = Math.max(1, Number(g.entries?.[0]?.numDice || 1));
                                                  const diceValues = getDiceInputs(diceKey, numDice);
                                                  return (
                                                    <>
                                                      <div className="grid grid-cols-4 gap-1 mb-1">
                                                        {Array.from({ length: numDice }).map((_, i) => (
                                                          <input
                                                            key={i}
                                                            type="text" inputMode="numeric"
                                                            placeholder={s.diceType}
                                                            value={diceValues[i] || ''}
                                                            onChange={(e) => setDiceInput(diceKey, i, parseInt(e.target.value) || 0)}
                                                            className="p-1 bg-gray-800 rounded text-white text-xs text-center"
                                                          />
                                                        ))}
                                                      </div>
                                                      <button
                                                        onClick={() => {
                                                          const rolls = diceValues.slice(0, numDice);
                                                          if (rolls.every(r => r > 0)) {
                                                            const perLevelBonus = Number(s.perLevelBonus) || 0;
                                                            const currentLevel = calculateNextLevel().currentLevel || 1;
                                                            const levelBonus = perLevelBonus * currentLevel;
                                                            const diceTotal = rolls.reduce((a, b) => a + b, 0);
                                                            const total = diceTotal + (Number(s.diceBonus) || 0) + levelBonus;
                                                            setRollResult({ rolls, total, levelBonus });
                                                          }
                                                        }}
                                                        className="w-full py-1 bg-blue-600 rounded text-xs mb-1"
                                                      >
                                                        Calculate
                                                      </button>
                                                    </>
                                                  );
                                                })()}
                                                {rollResult?.rolls && (
                                                  <div className="mt-1 text-center text-sm">
                                                    <div>
                                                      Dice: {rollResult.rolls.join(' + ')} = {rollResult.rolls.reduce((a, b) => a + b, 0)}
                                                      {rollResult.levelBonus > 0 && ` + ${rollResult.levelBonus} (level bonus)`}
                                                    </div>
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
                        type="text" inputMode="numeric"
                        min={1}
                        max={Math.max(1, remaining)}
                        value={invCopies === 1 ? '' : invCopies}
                        onChange={(e) => setInvCopies(e.target.value === '' ? 1 : Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full p-2 rounded bg-gray-900 border border-gray-700"
                        disabled={remaining <= 0}
                        placeholder="1"
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
                          showToast('Could not find that spell in Spells Learned.', 'error');
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
                                        type="text" inputMode="numeric"
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
                                            {(() => {
                                              const diceKey = `mi-die-${item.id}-${s.id || s.name}-${g.permanent ? "p" : "t"}`;
                                              const numDice = Math.max(1, Number(g.entries?.[0]?.numDice || 1));
                                              const diceValues = getDiceInputs(diceKey, numDice);
                                              const sides = Number(String(s.diceType || "d6").replace("d", "")) || 6;
                                              
                                              return (
                                                <>
                                                  <button
                                                    onClick={() => {
                                                      const rolls = Array.from({ length: numDice }, () => rollDice(sides));
                                                      const total = rolls.reduce((a, b) => a + b, 0) + (Number(s.diceBonus) || 0);
                                                      // Update dice inputs state with rolled values
                                                      rolls.forEach((r, i) => setDiceInput(diceKey, i, r));
                                                      setRollResult({ rolls, total });
                                                    }}
                                                    className="px-3 py-2 bg-blue-600 rounded hover:bg-blue-700 font-semibold"
                                                  >
                                                    Roll {numDice}{s.diceType}
                                                  </button>
                                                  
                                                  <div className="mt-3 text-sm text-gray-300">Or enter each die:</div>
                                                  <div className="mt-2 flex flex-wrap gap-2">
                                                    {Array.from({ length: numDice }).map((_, i) => (
                                                      <input
                                                        key={i}
                                                        type="text" inputMode="numeric"
                                                        min={1}
                                                        max={sides}
                                                        placeholder={`1-${sides}`}
                                                        value={diceValues[i] || ''}
                                                        onChange={(e) => setDiceInput(diceKey, i, parseInt(e.target.value) || 0)}
                                                        className="w-16 p-1 bg-gray-700 rounded text-white text-sm"
                                                      />
                                                    ))}
                                                  </div>

                                                  <div className="mt-3 flex items-center justify-between">
                                                    <button
                                                      onClick={() => {
                                                        const rolls = diceValues.slice(0, numDice).map(v => 
                                                          Math.max(1, Math.min(sides, v || 0))
                                                        );
                                                        const total = rolls.reduce((a, b) => a + b, 0) + (Number(s.diceBonus) || 0);
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
                                                </>
                                              );
                                            })()}
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-2xl font-bold">Spells Learned</h2>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <button onClick={() => { setSpellsLearnedView(false); setGrimoireView(false); }} className="px-4 py-2 bg-gray-600 rounded text-base hover:bg-gray-500 flex-1 sm:flex-none whitespace-nowrap">
                  ← Back to Magic
                </button>
                <button onClick={openNewSpellModal} className="px-4 py-2 text-base bg-green-600 rounded hover:bg-green-700 flex-1 sm:flex-none whitespace-nowrap">
                  + Add Spell
                </button>
              </div>
            </div>

            {char.spellsLearned.length === 0 && (
              <div className="text-center text-gray-400 py-8">No spells learned yet</div>
            )}

            {char.spellsLearned.length > 0 && (
              <div 
                className="space-y-2 overflow-y-auto pr-2" 
                style={{ maxHeight: 'calc(100vh - 200px)' }}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                  const spellsAtLevel = char.spellsLearned.filter(s => s.level === level).slice().sort(sortSpellsLevelName);
                  if (spellsAtLevel.length === 0) return null;
                  const isLevelExpanded = expandedSpellLevels[level] !== false; // Default to expanded
                  
                  return (
                    <div key={level} className="bg-gray-700 rounded-lg overflow-hidden">
                      {/* Level Header - Collapsible */}
                      <div 
                        className="p-3 cursor-pointer hover:bg-gray-600 transition-colors flex items-center justify-between"
                        onClick={() => setExpandedSpellLevels(prev => ({ ...prev, [level]: !isLevelExpanded }))}
                      >
                        <div className="flex items-center gap-2">
                          <span>{isLevelExpanded ? '▼' : '▶'}</span>
                          <h3 className="font-bold text-lg text-blue-400">Level {level}</h3>
                          <span className="text-gray-400 text-sm">({spellsAtLevel.length} spell{spellsAtLevel.length !== 1 ? 's' : ''})</span>
                        </div>
                      </div>

                      {/* Spells in this level */}
                      {isLevelExpanded && (
                        <div className="px-3 pb-3 space-y-2">
                          {spellsAtLevel.map(spell => {
                            const preparedCount = char.spellsPrepared.filter(s => s.id === spell.id).length;
                            const canPrepare = preparedCount < char.spellSlots[level];
                            
                            return (
                              <div key={spell.id} className="bg-gray-800 p-3 rounded">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="font-bold text-lg flex-1 min-w-0">{spell.name}</div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
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
                                          className="p-1 bg-red-600 rounded hover:bg-red-700"
                                          title="Remove from Spells Prepared"
                                        >
                                          <Minus size={14} />
                                        </button>
                                        <span className="text-sm font-bold w-6 text-center">{preparedCount}</span>
                                      </>
                                    )}
                                    <button
                                      onClick={() => {
                                        if (canPrepare) {
                                          updateChar({ 
                                            spellsPrepared: [...char.spellsPrepared, { ...spell, prepId: Date.now(), concentrating: false, numDice: 1 }] 
                                          });
                                        }
                                      }}
                                      disabled={!canPrepare}
                                      className={`p-1 rounded ${canPrepare ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                                      title="Add to Spells Prepared"
                                    >
                                      <Plus size={14} />
                                    </button>
                                    <button 
                                      onClick={() => setEditModal({ type: 'editSpell', spell })} 
                                      className="p-1 bg-gray-600 rounded hover:bg-gray-500"
                                      title="Edit Spell"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Collapsible Description */}
                                <button
                                  onClick={() => setExpandedLearnedSpells(prev => ({ ...prev, [spell.id]: !prev[spell.id] }))}
                                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mb-2"
                                >
                                  {expandedLearnedSpells[spell.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  Description
                                </button>
                                
                                {expandedLearnedSpells[spell.id] && (
                                  <>
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
                                      <div className="text-xs text-yellow-400">Spell Resistance: Yes</div>
                                    )}
                                  </>
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
                            setConfirmModal({
                              message: 'Delete this note?',
                              confirmText: 'Delete',
                              danger: true,
                              onConfirm: () => deleteNote(n.id)
                            });
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
            {/* Counters Section */}
            <div className="bg-gray-700 rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-600"
                onClick={() => setCountersExpanded(!countersExpanded)}
              >
                <div className="flex items-center gap-2">
                  <span>{countersExpanded ? '▼' : '▶'}</span>
                  <h2 className="text-xl font-bold">Counters</h2>
                  {(char.counters || []).length > 0 && (
                    <span className="text-gray-400 text-sm">({char.counters.length})</span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCounterModal({ type: 'add', description: '', uses: '' });
                  }}
                  className="px-3 py-1 bg-green-600 rounded hover:bg-green-700 text-sm"
                >
                  + Add Counter
                </button>
              </div>
              
              {countersExpanded && (
                <div className="p-4 pt-0 space-y-3">
                  {(char.counters || []).length === 0 ? (
                    <div className="text-gray-400 text-center py-4">
                      No counters yet. Add one to track abilities with limited uses.
                    </div>
                  ) : (
                    (char.counters || []).map(counter => (
                      <div key={counter.id} className="bg-gray-800 p-3 rounded-lg">
                        {/* Description at top with edit button */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="font-bold text-white">{counter.description}</div>
                          <button
                            onClick={() => {
                              setCounterModal({
                                type: 'edit',
                                counter,
                                description: counter.description,
                                uses: String(counter.maxUses)
                              });
                            }}
                            className="p-1 bg-gray-600 rounded hover:bg-gray-500"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                        {/* Counter and buttons below */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-2xl font-bold">
                            <span className={counter.currentUses === 0 ? 'text-red-400' : 'text-green-400'}>
                              {counter.currentUses}
                            </span>
                            <span className="text-gray-400"> / {counter.maxUses}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (counter.currentUses > 0) {
                                  updateChar({
                                    counters: (char.counters || []).map(c =>
                                      c.id === counter.id ? { ...c, currentUses: c.currentUses - 1 } : c
                                    )
                                  });
                                }
                              }}
                              disabled={counter.currentUses === 0}
                              className={`px-4 py-2 rounded font-bold ${
                                counter.currentUses === 0
                                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              Use
                            </button>
                            <button
                              onClick={() => {
                                updateChar({
                                  counters: (char.counters || []).map(c =>
                                    c.id === counter.id ? { ...c, currentUses: c.maxUses } : c
                                  )
                                });
                              }}
                              className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700 font-bold"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Dice Roller Section */}
            <div className="bg-gray-700 rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-600"
                onClick={() => setDiceRollerExpanded(!diceRollerExpanded)}
              >
                <div className="flex items-center gap-2">
                  <span>{diceRollerExpanded ? '▼' : '▶'}</span>
                  <h2 className="text-xl font-bold">Dice Roller</h2>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDiceConfig({ d2: 0, d3: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0 });
                    setDiceRolls(null);
                  }}
                  className="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500 text-sm"
                >
                  Clear All
                </button>
              </div>
              
              {diceRollerExpanded && (
                <div className="p-4 pt-0 space-y-3">
                  {[2, 3, 4, 6, 8, 10, 12, 20, 100].map(sides => {
                    const dieResult = diceRolls?.dice.find(d => d.sides === sides);
                    
                    return (
                      <div key={sides} className="bg-gray-800 p-3 rounded-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <label className="text-lg font-bold text-gray-300 w-12 flex-shrink-0">d{sides}</label>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => setDiceConfig({ ...diceConfig, [`d${sides}`]: Math.max(0, diceConfig[`d${sides}`] - 1) })}
                              className="p-2 bg-red-600 rounded hover:bg-red-700 flex-shrink-0"
                            >
                              <Minus size={18} />
                            </button>
                            <input
                              type="text" inputMode="numeric"
                              min="0"
                              value={diceConfig[`d${sides}`]}
                              onChange={(e) => setDiceConfig({ ...diceConfig, [`d${sides}`]: Math.max(0, e.target.value === '' ? '' : (parseInt(e.target.value) || 0)) })}
                              className="w-14 p-2 bg-gray-700 rounded text-white text-center text-lg font-bold"
                            />
                            <button
                              onClick={() => setDiceConfig({ ...diceConfig, [`d${sides}`]: diceConfig[`d${sides}`] + 1 })}
                              className="p-2 bg-green-600 rounded hover:bg-green-700 flex-shrink-0"
                            >
                              <Plus size={18} />
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
                              className={`px-4 py-2 rounded font-bold flex-shrink-0 ${
                                diceConfig[`d${sides}`] === 0 
                                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              Roll
                            </button>
                            {dieResult && (
                              <div className="bg-gray-700 px-3 py-1 rounded flex-shrink-0">
                                <span className="text-gray-400 text-sm">Total: </span>
                                <span className="text-xl font-bold text-green-400">{dieResult.subtotal}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {dieResult && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {dieResult.rolls.map((roll, i) => (
                              <div key={i} className="bg-gray-700 px-2 py-1 rounded text-sm font-bold">
                                {roll}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
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
                    className="w-full py-3 bg-purple-600 rounded-lg hover:bg-purple-700 text-lg font-bold"
                  >
                    Roll All Dice
                  </button>

                  {diceRolls?.type === 'all' && (
                    <div className="bg-gray-800 p-4 rounded-lg">
                      <div className="text-xl font-bold mb-3">All Dice Results</div>
                      
                      {diceRolls.dice.map((die, idx) => (
                        <div key={idx} className="mb-3 pb-3 border-b border-gray-700 last:border-b-0">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="font-bold text-blue-400">
                              {die.count}d{die.sides}
                            </div>
                            <div className="text-gray-400">
                              Subtotal: <span className="font-bold text-white">{die.subtotal}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {die.rolls.map((roll, i) => (
                              <div key={i} className="bg-gray-700 px-2 py-1 rounded text-sm font-bold">
                                {roll}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      
                      <div className="border-t-2 border-green-500 pt-3 mt-3 text-center">
                        <div className="text-sm text-gray-400 mb-1">Grand Total</div>
                        <div className="text-4xl font-bold text-green-400">
                          {diceRolls.dice.reduce((sum, die) => sum + die.subtotal, 0)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
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
                              type="text" inputMode="numeric"
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
                            {(() => {
                              const diceKey = `comp-dmg-${companion.id}-${attack.id}`;
                              const numDice = rollModal.diceCount ?? attack.numDice;
                              const diceValues = getDiceInputs(diceKey, numDice);
                              return (
                                <>
                                  <div className="grid grid-cols-3 gap-1 mb-1">
                                    {Array.from({ length: numDice }).map((_, i) => (
                                      <input
                                        key={i}
                                        type="text" inputMode="numeric"
                                        placeholder={`d${attack.dieType}`}
                                        value={diceValues[i] || ''}
                                        onChange={(e) => setDiceInput(diceKey, i, parseInt(e.target.value) || 0)}
                                        className="p-1 bg-gray-800 rounded text-white text-xs text-center"
                                      />
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => {
                                      const rolls = diceValues.slice(0, numDice);
                                      if (rolls.every(r => r > 0)) {
                                        const diceTotal = rolls.reduce((a, b) => a + b, 0);
                                        setRollResult({ rolls, diceTotal, total: diceTotal + dmgBonus });
                                      }
                                    }}
                                    className="w-full py-1 bg-blue-600 rounded text-xs mb-1"
                                  >
                                    Calculate
                                  </button>
                                </>
                              );
                            })()}
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
              
              {/* Wallet breakdown with gem worth */}
              {(() => {
                const wallet = char.wallet || { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };
                
                // Calculate coins in all magical containers
                const magicalContainers = (char.inventory || []).filter(c => c.isContainer && c.isMagicalContainer);
                const bagsCoins = magicalContainers.reduce((acc, c) => {
                  if (c.storedCoins) {
                    acc.copper += Math.round(c.storedCoins.copper || 0);
                    acc.silver += Math.round(c.storedCoins.silver || 0);
                    acc.gold += Math.round(c.storedCoins.gold || 0);
                    acc.electrum += Math.round(c.storedCoins.electrum || 0);
                    acc.platinum += Math.round(c.storedCoins.platinum || 0);
                  } else if (c.storedCoinsGP) {
                    acc.gold += Math.floor(c.storedCoinsGP);
                  }
                  return acc;
                }, { copper: 0, silver: 0, gold: 0, electrum: 0, platinum: 0 });
                
                // Total coins = wallet + bags
                const totalPP = Math.round(wallet.platinum || 0) + bagsCoins.platinum;
                const totalGP = Math.round(wallet.gold || 0) + bagsCoins.gold;
                const totalEP = Math.round(wallet.electrum || 0) + bagsCoins.electrum;
                const totalSP = Math.round(wallet.silver || 0) + bagsCoins.silver;
                const totalCP = Math.round(wallet.copper || 0) + bagsCoins.copper;
                
                const totalGPValue = (totalPP * 10) + (totalEP * 5) + totalGP + (totalSP * 0.1) + (totalCP * 0.01);
                
                // Calculate gem worth (only items marked as gems with worth)
                const gemsWithWorth = (char.inventory || []).filter(item => {
                  const worthAmount = Number(item.worthAmount) || 0;
                  return worthAmount > 0 && !!item.isGem;
                });
                
                const totalGemWorthGP = gemsWithWorth.reduce((sum, item) => {
                  const worthAmount = Number(item.worthAmount) || 0;
                  const worthUnit = String(item.worthUnit || 'gp').toLowerCase();
                  const qty = Number(item.quantity) || 1;
                  let gpValue = 0;
                  if (worthUnit === 'cp') gpValue = worthAmount * 0.01;
                  else if (worthUnit === 'sp') gpValue = worthAmount * 0.1;
                  else if (worthUnit === 'ep') gpValue = worthAmount * 5;
                  else if (worthUnit === 'pp') gpValue = worthAmount * 10;
                  else gpValue = worthAmount; // gp
                  return sum + (gpValue * qty);
                }, 0);
                
                const totalNetWorth = totalGPValue + totalGemWorthGP;
                const totalCoinsInBags = bagsCoins.copper + bagsCoins.silver + bagsCoins.gold + bagsCoins.electrum + bagsCoins.platinum;
                
                return (
                  <>
                    <div className="text-2xl font-bold text-yellow-400">{totalGPValue.toFixed(2)} GP</div>
                    {totalCoinsInBags > 0 && (
                      <div className="text-xs text-gray-500">
                        ({totalCoinsInBags.toLocaleString()} coins in bags)
                      </div>
                    )}
                    
                    {/* Coin weight/EV display - only show when included in totals */}
                    {char.includeCoinWeight && (
                      <div className="text-sm text-gray-400 mt-1">
                        <span>Coin Weight: {memoizedEncumbrance.coinWeight.toFixed(2)} lb</span>
                        <span className="mx-2">•</span>
                        <span>Coin EV: {memoizedEncumbrance.coinEV.toFixed(1)}</span>
                      </div>
                    )}
                    
                    {/* Gem Worth */}
                    {gemsWithWorth.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <button
                          onClick={() => setExpandedInventoryCategories(prev => ({ ...prev, _gemWorth: !prev._gemWorth }))}
                          className="w-full flex items-center justify-between text-left hover:bg-gray-600 rounded p-1 -m-1"
                        >
                          <span className="text-sm text-gray-400">
                            Gem Worth: <span className="text-white font-semibold">{totalGemWorthGP.toFixed(2)} GP</span>
                            <span className="text-gray-500 ml-2">({gemsWithWorth.length} gem{gemsWithWorth.length !== 1 ? 's' : ''})</span>
                          </span>
                          {expandedInventoryCategories._gemWorth ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                        </button>
                        
                        {expandedInventoryCategories._gemWorth && (
                          <div className="mt-2 space-y-1 text-sm">
                            {gemsWithWorth.map(item => {
                              const worthAmount = Number(item.worthAmount) || 0;
                              const worthUnit = String(item.worthUnit || 'gp').toUpperCase();
                              const qty = Number(item.quantity) || 1;
                              return (
                                <div key={item.id} className="flex justify-between text-gray-300 pl-2">
                                  <span>{item.name} {qty > 1 ? `×${qty}` : ''}</span>
                                  <span className="text-yellow-400">{worthAmount * qty} {worthUnit}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Total Net Worth */}
                    {gemsWithWorth.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Total Net Worth:</span>
                          <span className="text-xl font-bold text-green-400">{totalNetWorth.toFixed(2)} GP</span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Inventory</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditModal({ type: 'inventoryInfo' })}
                  className="p-2 bg-gray-700 rounded hover:bg-gray-600"
                >
                  <Info size={16} />
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
              <div className="space-y-3">
                {/* Render each category */}
                {Object.entries(categorizedInventory.categories).map(([catKey, category]) => {
                  if (category.items.length === 0) return null;
                  const isExpanded = expandedInventoryCategories[catKey];
                  
                  // Calculate category totals (only count weight once even if item appears in multiple categories)
                  const seenIds = new Set<number>();
                  let categoryWeight = 0;
                  for (const item of category.items) {
                    if (!seenIds.has(item.id)) {
                      // Only count weight if this is the item's primary category (first one it appears in)
                      const itemCats = categorizedInventory.itemCategories.get(item.id) || [];
                      const primaryCat = Object.entries(categorizedInventory.categories).find(
                        ([, c]) => c.items.some(i => i.id === item.id)
                      )?.[0];
                      if (primaryCat === catKey) {
                        categoryWeight += (item.weightPer || 0) * (item.quantity || 1);
                      }
                      seenIds.add(item.id);
                    }
                  }
                  
                  return (
                    <div key={catKey} className="bg-gray-800 rounded overflow-hidden">
                      {/* Category Header */}
                      <div
                        className="p-3 cursor-pointer hover:bg-gray-700 transition-colors flex items-center justify-between"
                        onClick={() => setExpandedInventoryCategories(prev => ({ ...prev, [catKey]: !prev[catKey] }))}
                      >
                        <div className="flex items-center gap-2">
                          <span>{isExpanded ? '▼' : '▶'}</span>
                          <span className="text-lg">{category.icon}</span>
                          <span className="font-bold text-lg">{category.name}</span>
                          <span className="text-gray-400 text-sm">({category.items.length})</span>
                        </div>
                        {categoryWeight > 0 && (
                          <span className="text-sm text-gray-400">{categoryWeight.toFixed(2)} lb</span>
                        )}
                      </div>
                      
                      {/* Category Items */}
                      {isExpanded && (
                        <div className="border-t border-gray-700">
                          {category.items.map((item) => {
                            const totalWeight = (item.weightPer || 0) * (item.quantity || 1);
                            const isItemExpanded = expandedInventoryIds[item.id];
                            const itemCats = categorizedInventory.itemCategories.get(item.id) || [];
                            const otherCats = itemCats.filter(c => c !== category.name);
                            
                            return (
                              <div key={item.id} className="bg-gray-700 mx-2 my-2 rounded overflow-hidden">
                                {/* Item Header */}
                                <div 
                                  className="p-3 cursor-pointer hover:bg-gray-600 transition-colors"
                                  onClick={() => setExpandedInventoryIds(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span>{isItemExpanded ? '▼' : '▶'}</span>
                                        <span className="font-bold">{item.name}</span>
                                        <span className="text-gray-400">×{item.quantity}</span>
                                      </div>
                                      <div className="text-sm text-gray-400 ml-5">
                                        {totalWeight.toFixed(2)} lb • EV: {(() => {
                                          const ev = Number(item.ev || 0);
                                          const qty = Number(item.quantity || 1);
                                          if (ev > 0) {
                                            const totalEV = ev * qty;
                                            return qty > 1 ? `${totalEV.toFixed(1)} (${ev}/ea)` : totalEV.toFixed(1);
                                          } else {
                                            // Zero-EV: 10 items = 1 EV
                                            const totalEV = Math.floor(qty / 10);
                                            return totalEV > 0 ? `${totalEV} (10:1)` : '0 (10:1)';
                                          }
                                        })()}
                                        {(item.worthAmount || 0) > 0 && ` • ${item.worthAmount} ${(item.worthUnit || 'gp').toUpperCase()}`}
                                      </div>
                                      {otherCats.length > 0 && (
                                        <div className="text-xs text-blue-400 ml-5 mt-1">
                                          Also in: {otherCats.join(', ')}
                                        </div>
                                      )}
                                    </div>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setEditModal({ type: 'editItem', item }); }} 
                                      className="p-2 bg-gray-600 rounded hover:bg-gray-500 flex-shrink-0"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded Item Content */}
                                {isItemExpanded && (
                                  <div className="px-3 pb-3 border-t border-gray-600">
                                    {item.description && (
                                      <div className="text-sm text-gray-300 mt-2 mb-3">{item.description}</div>
                                    )}
                                    
                                    {normalizeItemEffects(item).length > 0 && (
                                      <div className="text-xs text-gray-200 mb-3">
                                        <div className="text-gray-400">Effects:</div>
                                        <div className="mt-1 space-y-1">
                                          {normalizeItemEffects(item).map((e) => (
                                            <div key={e.id || `${item.id}-${e.kind}`}>
                                              {e.kind === 'attack' && (
                                                <span>
                                                  Attack
                                                  {(Number(e.miscToHit) || 0) ? ` • Misc ${Number(e.miscToHit) >= 0 ? '+' : ''}${Number(e.miscToHit)} hit` : ''}
                                                  {(Number(e.miscDamage) || 0) ? ` • Misc ${Number(e.miscDamage) >= 0 ? '+' : ''}${Number(e.miscDamage)} dmg` : ''}
                                                  {(Number(e.magicToHit) || 0) ? ` • Magic ${Number(e.magicToHit) >= 0 ? '+' : ''}${Number(e.magicToHit)} hit` : ''}
                                                  {(Number(e.magicDamage) || 0) ? ` • Magic ${Number(e.magicDamage) >= 0 ? '+' : ''}${Number(e.magicDamage)} dmg` : ''}
                                                </span>
                                              )}
                                              {e.kind === 'ac' && (
                                                <span>AC: {Number(e.ac) >= 0 ? '+' : ''}{Number(e.ac) || 0}</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Container Contents */}
                                    {item.isContainer && (() => {
                                      const info = getContainerInfo(item.id);
                                      
                                      // Get items that could be added to this container
                                      const availableItems = (char.inventory || []).filter(invItem => {
                                        if (invItem.isContainer) return false; // Can't put containers in containers
                                        if (invItem.storedInId) return false; // Already in a container
                                        if (invItem.id === item.id) return false;
                                        
                                        const itemEV = Number(invItem.ev) || 0;
                                        const singleItemWeight = Number(invItem.weightPer) || 0;
                                        
                                        if (item.isMagicalContainer) {
                                          // Check weight limit - can we fit at least one?
                                          const maxWeight = Number(item.containerMaxWeight) || Infinity;
                                          return (info.totalWeight + singleItemWeight) <= maxWeight;
                                        } else {
                                          // Check capacity and EV rule - can we fit at least one?
                                          const capacity = Number(item.containerCapacity) || 0;
                                          if (capacity === 0) return true; // Unlimited
                                          if (itemEV > 0 && itemEV >= capacity) return false;
                                          
                                          // Check if there's room for at least 1 more slot
                                          if (itemEV > 0) {
                                            return info.slotCount < capacity;
                                          } else {
                                            // Zero-EV: check if adding would exceed capacity
                                            const zeroEVInContainer = info.items
                                              .filter(it => (Number(it.ev) || 0) === 0)
                                              .reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
                                            const currentZeroEVSlots = Math.ceil(zeroEVInContainer / 10);
                                            const newZeroEVSlots = Math.ceil((zeroEVInContainer + 1) / 10);
                                            const additionalSlots = newZeroEVSlots - currentZeroEVSlots;
                                            return (info.slotCount + additionalSlots) <= capacity;
                                          }
                                        }
                                      });
                                      
                                      return (
                                        <div className="text-xs text-gray-200 mb-3 bg-gray-800 p-2 rounded">
                                          <div className="text-gray-400 font-semibold mb-1">
                                            📦 Container {item.isMagicalContainer ? '(Magical)' : ''}
                                          </div>
                                          <div className="text-gray-300 mb-2">
                                            {item.isMagicalContainer 
                                              ? `${info.totalWeight.toFixed(1)} / ${info.maxWeight || '∞'} lbs used`
                                              : `${info.slotCount} / ${info.capacity || '∞'} slots`
                                            }
                                            {!item.isMagicalContainer && info.itemCount !== info.slotCount && (
                                              <span className="text-gray-500 ml-1">({info.itemCount} items)</span>
                                            )}
                                          </div>
                                          
                                          {/* Coin display for magical containers (no button, managed from wallet) */}
                                          {item.isMagicalContainer && info.storedCoinCount > 0 && (
                                            <div className="mb-2 text-yellow-400">
                                              💰 {info.storedCoinsGP.toFixed(2)} GP ({info.storedCoinCount.toLocaleString()} coins, {info.storedCoinsWeight.toFixed(2)} lb)
                                              <div className="text-xs text-gray-400 mt-1">
                                                {info.storedCoins.copper > 0 && <span className="mr-2 text-orange-400">{info.storedCoins.copper} CP</span>}
                                                {info.storedCoins.silver > 0 && <span className="mr-2">{info.storedCoins.silver} SP</span>}
                                                {info.storedCoins.gold > 0 && <span className="mr-2 text-yellow-400">{info.storedCoins.gold} GP</span>}
                                                {info.storedCoins.electrum > 0 && <span className="mr-2 text-blue-300">{info.storedCoins.electrum} EP</span>}
                                                {info.storedCoins.platinum > 0 && <span className="text-gray-300">{info.storedCoins.platinum} PP</span>}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {/* Add item dropdown - shows quantity modal if qty > 1 */}
                                          {availableItems.length > 0 && (
                                            <div className="mb-2">
                                              <select
                                                className="w-full p-1 bg-gray-700 rounded text-white text-xs"
                                                value=""
                                                onChange={(e) => {
                                                  e.stopPropagation();
                                                  const itemId = Number(e.target.value);
                                                  if (!itemId) return;
                                                  
                                                  const sourceItem = char.inventory.find(i => i.id === itemId);
                                                  if (!sourceItem) return;
                                                  
                                                  const sourceQty = Number(sourceItem.quantity) || 1;
                                                  const sourceEV = Number(sourceItem.ev) || 0;
                                                  
                                                  // Calculate max that can fit
                                                  let maxCanFit = sourceQty;
                                                  if (!item.isMagicalContainer) {
                                                    const capacity = Number(item.containerCapacity) || 0;
                                                    const slotsLeft = capacity - info.slotCount;
                                                    
                                                    if (sourceEV > 0) {
                                                      maxCanFit = Math.min(sourceQty, slotsLeft);
                                                    } else {
                                                      // Zero-EV: calculate based on 10:1 rule
                                                      const zeroEVInContainer = info.items
                                                        .filter(it => (Number(it.ev) || 0) === 0)
                                                        .reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
                                                      const currentZeroEVSlots = Math.ceil(zeroEVInContainer / 10);
                                                      const maxZeroEVSlots = capacity - (info.slotCount - currentZeroEVSlots);
                                                      const maxZeroEVItems = maxZeroEVSlots * 10 - zeroEVInContainer;
                                                      maxCanFit = Math.min(sourceQty, Math.max(0, maxZeroEVItems));
                                                    }
                                                  }
                                                  
                                                  if (sourceQty === 1) {
                                                    // Only 1 item, just move it directly
                                                    moveItemToContainer(itemId, item.id, 1);
                                                  } else {
                                                    // Show modal to ask how many
                                                    setMoveToContainerModal({
                                                      sourceItemId: itemId,
                                                      containerId: item.id,
                                                      maxQty: maxCanFit,
                                                      qty: String(maxCanFit),
                                                      itemName: sourceItem.name
                                                    });
                                                  }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <option value="">+ Add item to container...</option>
                                                {availableItems.map(ai => (
                                                  <option key={ai.id} value={ai.id}>
                                                    {ai.name} {ai.quantity > 1 ? `×${ai.quantity}` : ''} ({((Number(ai.weightPer) || 0) * (ai.quantity || 1)).toFixed(1)} lb)
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          )}
                                          
                                          {info.items.length > 0 ? (
                                            <div className="space-y-1">
                                              <div className="text-gray-400">Contains:</div>
                                              {info.items.map(ci => (
                                                <div key={ci.id} className="ml-2 flex items-center justify-between gap-2">
                                                  <span className="text-gray-300">
                                                    • {ci.name} {ci.quantity > 1 ? `×${ci.quantity}` : ''} 
                                                    <span className="text-gray-500 ml-1">
                                                      ({((Number(ci.weightPer) || 0) * (ci.quantity || 1)).toFixed(1)} lb)
                                                    </span>
                                                  </span>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (ci.quantity > 1) {
                                                        // Split: create new item with qty 1 outside container, reduce original by 1
                                                        const newItem = {
                                                          ...ci,
                                                          id: Date.now(),
                                                          quantity: 1,
                                                          storedInId: undefined
                                                        };
                                                        updateChar({
                                                          inventory: [
                                                            ...char.inventory.map(i => 
                                                              i.id === ci.id ? { ...i, quantity: i.quantity - 1 } : i
                                                            ),
                                                            newItem
                                                          ]
                                                        });
                                                      } else {
                                                        // Just remove from container
                                                        updateChar({
                                                          inventory: char.inventory.map(i => 
                                                            i.id === ci.id ? { ...i, storedInId: undefined } : i
                                                          )
                                                        });
                                                      }
                                                    }}
                                                    className="p-0.5 bg-red-600 rounded hover:bg-red-700 flex-shrink-0"
                                                    title="Remove one from container"
                                                  >
                                                    <Minus size={12} />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            !item.isMagicalContainer && <div className="text-gray-500 italic">Empty</div>
                                          )}
                                          {item.isMagicalContainer && info.items.length === 0 && info.storedCoinCount === 0 && (
                                            <div className="text-gray-500 italic">Empty</div>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {/* Stored In indicator */}
                                    {item.storedInId && (() => {
                                      const container = (char.inventory || []).find(c => c.id === item.storedInId);
                                      if (!container) return null;
                                      return (
                                        <div className="text-xs text-blue-400 mb-3">
                                          📦 Stored in: {container.name}
                                          {container.isMagicalContainer && ' (magical - weight not counted)'}
                                        </div>
                                      );
                                    })()}

                                    {/* Stat Bonuses */}
                                    {item.hasAttrBonus && (() => {
                                      const bonuses = Array.isArray(item.attrBonuses) 
                                        ? item.attrBonuses.filter(b => b && b.attr && (Number(b.value) || 0) !== 0)
                                        : [];
                                      if (!bonuses.length) return null;
                                      return (
                                        <div className="text-xs text-gray-200 mb-3">
                                          <div className="text-gray-400">Stat Bonuses:</div>
                                          <div className="mt-1">
                                            {bonuses.map((b, idx) => (
                                              <span key={idx}>
                                                {idx > 0 && ', '}
                                                {b.attr.toUpperCase()} {Number(b.value) >= 0 ? '+' : ''}{b.value}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* Quantity Controls - hide stepper for containers */}
                                    <div className="flex items-center justify-between gap-4 pt-2">
                                      {item.isContainer ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                          <span>Qty: {item.quantity}</span>
                                          <span className="text-xs">(use edit to remove)</span>
                                        </div>
                                      ) : (
                                      <div className="flex items-center gap-2">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const nextInv = char.inventory
                                              .map(i => i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i)
                                              .filter(i => (i.quantity || 0) > 0);
                                            const updated = nextInv.find(i => String(i.id) === String(item.id));
                                            let nextMagicItems = char.magicItems || [];
                                            if (updated) {
                                              nextMagicItems = syncMagicItemForInventoryItem(updated, nextMagicItems);
                                            } else {
                                              nextMagicItems = nextMagicItems.filter(mi => String(mi?.id) !== `linked-${String(item.id)}`);
                                            }
                                            updateChar({ inventory: nextInv, magicItems: nextMagicItems });
                                          }} 
                                          className="p-1 bg-red-600 rounded hover:bg-red-700"
                                        >
                                          <Minus size={14} />
                                        </button>
                                        <span className="text-lg font-bold w-12 text-center">{item.quantity}</span>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
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
                                      )}
                                      <div className="text-sm text-gray-300">
                                        <span className="text-xs text-gray-400 mr-1">Wt/ea</span>
                                        <span className="font-semibold text-white">{Number(item.weightPer || 0).toFixed(2)}</span> lb
                                      </div>
                                    </div>

                                    {/* Sell Button */}
                                    {(() => {
                                      const worthAmount = Number(item.worthAmount) || 0;
                                      const worthUnit = String(item.worthUnit || 'gp').toLowerCase();
                                      if (worthAmount <= 0) return null;
                                      return (
                                        <div className="flex items-center justify-between gap-2 mt-2">
                                          <div className="text-xs text-gray-300">
                                            Worth: <span className="font-semibold text-white">{worthAmount}</span> {worthUnit.toUpperCase()}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
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
            
            <div className="bg-gray-800 p-4 rounded">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-lg">
                    Total Weight: {getTotalWeight().toFixed(2)} lb
                  </div>
                  <div className="font-bold text-lg">
                    Total EV: {getInventoryTotalEV().toFixed(1)} ({getEncumbranceStatusLabel()})
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

      {/* Attribute Roller Modal */}
      {attributeRollerOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md" style={{ maxHeight: 'calc(100dvh - 2rem)', overflowY: 'auto' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Roll Attributes</h3>
              <button
                onClick={() => setAttributeRollerOpen(false)}
                className="p-2 hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Method Selection */}
            <div className="space-y-2 mb-4 bg-gray-900 p-3 rounded">
              <div className="text-sm font-bold text-gray-300 mb-2">Rolling Method:</div>
              
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rollMethod"
                  checked={attributeRollMethod === 1}
                  onChange={() => { setAttributeRollMethod(1); setAttributeRolls([]); }}
                  className="w-4 h-4 mt-0.5"
                />
                <div>
                  <div className="text-sm font-semibold">Method 1: 3d6</div>
                  <div className="text-xs text-gray-400">Roll 3d6 six times, take the total of each roll. Arrange as desired.</div>
                </div>
              </label>
              
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rollMethod"
                  checked={attributeRollMethod === 2}
                  onChange={() => { setAttributeRollMethod(2); setAttributeRolls([]); }}
                  className="w-4 h-4 mt-0.5"
                />
                <div>
                  <div className="text-sm font-semibold">Method 2: 4d6 Drop Lowest</div>
                  <div className="text-xs text-gray-400">Roll 4d6 six times, drop the lowest die from each roll. Arrange as desired.</div>
                </div>
              </label>
              
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="rollMethod"
                  checked={attributeRollMethod === 3}
                  onChange={() => { setAttributeRollMethod(3); setAttributeRolls([]); }}
                  className="w-4 h-4 mt-0.5"
                />
                <div>
                  <div className="text-sm font-semibold">Method 3: Best of 6 Rolls (Fixed Order)</div>
                  <div className="text-xs text-gray-400">Roll 3d6 six times per attribute, keep the highest total. Scores go in order: STR, DEX, CON, INT, WIS, CHA.</div>
                </div>
              </label>
            </div>
            
            {/* Roll Results */}
            <div className="space-y-2 mb-4">
              {attributeRolls.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  Select a method and click "Roll Attributes"
                </div>
              ) : attributeRollMethod === 3 ? (
                // Method 3 display - show attribute name and best roll
                attributeRolls.map((roll, idx) => (
                  <div key={idx} className="bg-gray-700 p-2 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-yellow-400">{roll.attrName}</span>
                      <span className="font-bold text-xl text-green-400">{roll.total}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Best of 6 rolls: [{roll.dice.join(', ')}] = {roll.total}
                    </div>
                  </div>
                ))
              ) : (
                // Method 1 & 2 display
                attributeRolls.map((roll, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-gray-700 p-2 rounded">
                    <span className="text-gray-400 w-16">Roll {idx + 1}:</span>
                    <div className="flex gap-1">
                      {roll.dice.map((d, dIdx) => (
                        <span
                          key={dIdx}
                          className={`w-8 h-8 flex items-center justify-center rounded ${
                            dIdx === roll.droppedIndex ? 'bg-red-900 text-red-400 line-through' : 'bg-gray-600'
                          }`}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                    <span className="text-gray-400">=</span>
                    <span className="font-bold text-xl text-green-400 w-8">{roll.total}</span>
                  </div>
                ))
              )}
            </div>
            
            {/* Totals for Method 1 & 2 */}
            {attributeRolls.length === 6 && attributeRollMethod !== 3 && (
              <div className="bg-gray-900 p-3 rounded mb-4">
                <div className="text-sm text-gray-400 mb-1">Totals:</div>
                <div className="flex flex-wrap gap-2">
                  {attributeRolls.map((roll, idx) => (
                    <span key={idx} className="bg-green-700 px-3 py-1 rounded font-bold text-lg">
                      {roll.total}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={rollAttributeSet}
                className="flex-1 py-2 bg-blue-600 rounded hover:bg-blue-700 font-semibold"
              >
                Roll Attributes
              </button>
              
              {attributeRollMethod === 3 ? (
                // Method 3: Insert button
                <button
                  onClick={insertMethod3Rolls}
                  disabled={attributeRolls.length !== 6}
                  className={`flex-1 py-2 rounded font-semibold ${
                    attributeRolls.length === 6 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Insert
                </button>
              ) : (
                // Method 1 & 2: Show button
                <button
                  onClick={() => {
                    if (attributeRolls.length === 6) {
                      setShowRolledAttributes(true);
                      setAttributeRollerOpen(false);
                    }
                  }}
                  disabled={attributeRolls.length !== 6}
                  className={`flex-1 py-2 rounded font-semibold ${
                    attributeRolls.length === 6 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Show
                </button>
              )}
              
              <button
                onClick={() => {
                  setAttributeRolls([]);
                  setShowRolledAttributes(false);
                }}
                className="flex-1 py-2 bg-gray-600 rounded hover:bg-gray-500 font-semibold"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Container Modal */}
      {moveToContainerModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setMoveToContainerModal(null)}
        >
          <div 
            className="bg-gray-800 rounded-lg p-6 w-full max-w-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">Move to Container</h3>
            <p className="text-gray-300 mb-4">
              How many <span className="text-white font-semibold">{moveToContainerModal.itemName}</span> do you want to move?
            </p>
            <div className="mb-4">
              <input
                type="text"
                inputMode="numeric"
                value={moveToContainerModal.qty}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) {
                    setMoveToContainerModal({ ...moveToContainerModal, qty: val });
                  }
                }}
                className="w-full p-2 bg-gray-700 rounded text-white text-center text-lg"
                autoFocus
              />
              <div className="text-xs text-gray-500 text-center mt-1">
                Max: {moveToContainerModal.maxQty}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMoveToContainerModal(null)}
                className="py-2 bg-gray-600 rounded hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const qty = parseInt(moveToContainerModal.qty) || 0;
                  if (qty > 0 && qty <= moveToContainerModal.maxQty) {
                    moveItemToContainer(
                      moveToContainerModal.sourceItemId,
                      moveToContainerModal.containerId,
                      qty
                    );
                    setMoveToContainerModal(null);
                  } else if (qty > moveToContainerModal.maxQty) {
                    showToast(`Maximum is ${moveToContainerModal.maxQty}`, 'warning');
                  }
                }}
                className="py-2 bg-blue-600 rounded hover:bg-blue-700"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Counter Modal */}
      {counterModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setCounterModal(null)}
        >
          <div 
            className="bg-gray-800 rounded-lg p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4">
              {counterModal.type === 'add' ? 'Add Counter' : 'Edit Counter'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <input
                  type="text"
                  value={counterModal.description}
                  onChange={(e) => setCounterModal({ ...counterModal, description: e.target.value })}
                  placeholder="e.g., Stun Attack"
                  className="w-full p-2 bg-gray-700 rounded text-white"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Uses (max per day/rest)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={counterModal.uses}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) {
                      setCounterModal({ ...counterModal, uses: val });
                    }
                  }}
                  placeholder="e.g., 7"
                  className="w-full p-2 bg-gray-700 rounded text-white"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-6">
              {counterModal.type === 'edit' && (
                <button
                  onClick={() => {
                    if (counterModal.counter) {
                      updateChar({
                        counters: (char.counters || []).filter(c => c.id !== counterModal.counter.id)
                      });
                      setCounterModal(null);
                    }
                  }}
                  className="py-2 bg-red-600 rounded hover:bg-red-700 col-span-2 mb-2"
                >
                  Delete Counter
                </button>
              )}
              <button
                onClick={() => setCounterModal(null)}
                className="py-2 bg-gray-600 rounded hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const uses = parseInt(counterModal.uses) || 0;
                  if (!counterModal.description.trim()) {
                    showToast('Please enter a description', 'warning');
                    return;
                  }
                  if (uses <= 0) {
                    showToast('Please enter a valid number of uses', 'warning');
                    return;
                  }
                  
                  if (counterModal.type === 'add') {
                    const newCounter = {
                      id: Date.now(),
                      description: counterModal.description.trim(),
                      maxUses: uses,
                      currentUses: uses
                    };
                    updateChar({
                      counters: [...(char.counters || []), newCounter]
                    });
                  } else if (counterModal.counter) {
                    updateChar({
                      counters: (char.counters || []).map(c =>
                        c.id === counterModal.counter.id
                          ? { 
                              ...c, 
                              description: counterModal.description.trim(),
                              maxUses: uses,
                              currentUses: Math.min(c.currentUses, uses)
                            }
                          : c
                      )
                    });
                  }
                  setCounterModal(null);
                }}
                className="py-2 bg-blue-600 rounded hover:bg-blue-700"
              >
                {counterModal.type === 'add' ? 'Add' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

{editModal && (
        <ModalErrorBoundary onClose={closeModal} fallbackTitle="Modal Error">
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-2 sm:p-4 z-50"
          role="dialog"
          aria-modal="true"
          ref={modalRef}
        >
          <div
            className={`bg-gray-800 rounded-lg p-4 sm:p-6 sm:pr-10 w-full overflow-y-auto ${editModal?.type === 'hpTracking' ? 'max-w-2xl' : 'max-w-md'} `}
            // Helps prevent the scrollbar from overlapping right-edge text on supported browsers.
            style={{ scrollbarGutter: 'stable', maxHeight: 'calc(100vh - 2rem)', maxHeight: 'calc(100dvh - 2rem)' }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editModal.type === 'mainTabInfo' && 'Main Tab Info'}
                {editModal.type === 'savesTabInfo' && 'Checks & Saves Info'}
                {editModal.type === 'race' && 'Edit Race'}
                {editModal.type === 'name' && 'Edit Name'}
                {editModal.type === 'characterDetails' && 'Edit Details'}
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
                {editModal.type === 'initiativeBonus' && 'Initiative Bonuses'}
                {editModal.type === 'saveModifiers' && 'Save Modifiers (Bless/Curse)'}
                {editModal.type === 'wallet' && 'Wallet'}
                {editModal.type === 'newItem' && (editModal.fromMagicInventory ? 'Add Magic Item' : 'Add New Item')}
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
              <button 
                onClick={closeModal} 
                className="text-gray-400 hover:text-white"
                aria-label="Close modal"
              >
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

                  {/* Class Modifiers */}
                  <div className="mt-4 pt-3 border-t border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm text-gray-400">Class Modifiers</label>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...(char.classAttributeMods || []), { attr: 'str', value: 0, valueText: '0', description: '' }];
                          updateChar({ classAttributeMods: next });
                        }}
                        className="px-4 py-2 text-base bg-gray-600 rounded hover:bg-gray-500 text-sm"
                      >
                        Add More
                      </button>
                    </div>

                    {(char.classAttributeMods || []).length === 0 ? (
                      <div className="text-sm text-gray-400">No class attribute modifiers added.</div>
                    ) : (
                      <div className="space-y-2">
                        {(char.classAttributeMods || []).map((row, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <select
                              value={row.attr || 'str'}
                              onChange={(e) => {
                                const next = [...(char.classAttributeMods || [])];
                                next[idx] = { ...next[idx], attr: e.target.value };
                                updateChar({ classAttributeMods: next });
                              }}
                              className="p-2 bg-gray-700 rounded text-white text-sm"
                            >
                              <option value="str">STR</option>
                              <option value="dex">DEX</option>
                              <option value="con">CON</option>
                              <option value="int">INT</option>
                              <option value="wis">WIS</option>
                              <option value="cha">CHA</option>
                            </select>

                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.valueText ?? String(row.value ?? 0)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const next = [...(char.classAttributeMods || [])];
                                const updated = { ...next[idx], valueText: raw };

                                // Update numeric value when parseable (supports negative).
                                const parsed = parseInt(raw, 10);
                                if (!Number.isNaN(parsed)) updated.value = parsed;

                                next[idx] = updated;
                                updateChar({ classAttributeMods: next });
                              }}
                              className="w-24 p-2 bg-gray-700 rounded text-white text-sm"
                              placeholder="+/-"
                            />

                            <button
                              type="button"
                              onClick={() => {
                                const next = (char.classAttributeMods || []).filter((_, i) => i !== idx);
                                updateChar({ classAttributeMods: next });
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
                  <div className="mt-2 p-3 bg-gray-900 rounded">
                    <p className="text-sm text-gray-300">
                      <span className="font-semibold text-yellow-400">Tip: No-Damage Attacks</span> — If you need to add an attack that does no damage, such as Trip or Grapple, click <span className="font-semibold text-white">Manual Attack</span> and uncheck the <span className="font-semibold text-white">Uses Damage Dice</span> checkbox.
                    </p>
                  </div>
                </div>
              )}

              {editModal.type === 'inventoryInfo' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-300">
                    The <span className="font-semibold text-white">Wallet</span> will track how many coins you have and subtract based on Gold Coins being the default. If you subtract 10 silver coins it will remove 1 gold coin etc. If you play with coins included in weight and EV, then make sure you check the box in your wallet.
                  </p>
                  <p className="text-sm text-gray-300">
                    To add an item, please click <span className="font-semibold text-white">+ Add Item</span>. If you add a number in Worth, you will be able to sell it from your inventory.
                  </p>
                  <div className="mt-2 p-3 bg-gray-900 rounded">
                    <p className="text-sm text-gray-300">
                      <span className="font-semibold text-yellow-400">Tip: Worn Items</span> — If you're wearing an item (armor, shield, weapons, rings, etc.), consider leaving the EV field at 0 since worn items don't count toward encumbrance.
                    </p>
                  </div>
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
                  <p className="text-sm text-gray-300">
                    By clicking <span className="font-semibold text-white">Ammo</span>, this item can be linked to a ranged weapon in your Attack section. When you roll to attack with a ranged weapon and a specific ammo chosen, that ammo will decrease by 1.
                  </p>
                  <p className="text-sm text-gray-300">
                    By clicking <span className="font-semibold text-white">Potion</span>, this item will be categorized with Magical Items & Potions for easy organization.
                  </p>
                  <p className="text-sm text-gray-300">
                    By clicking <span className="font-semibold text-white">Gem</span>, this item's worth will be counted towards your wallet total wealth.
                  </p>
                  <p className="text-sm text-gray-300">
                    By clicking <span className="font-semibold text-white">Container (Backpack/Pouch)</span>, this item can hold other items. Items inside a container don't count toward your EV encumbrance—only the container's EV counts. For normal containers, set a capacity (max items) and items with EV less than the capacity can be stored. For magical containers, set a max weight—the contents' weight won't count toward your total either. You can also store coins in magical containers via your Wallet.
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
                  {/* Encumbrance enabled checkbox */}
                  <div className="flex justify-end">
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={char.encumbranceEnabled ?? true}
                        onChange={(e) => updateChar({ encumbranceEnabled: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Use Encumbrance Rules
                    </label>
                  </div>
                  
                  {!(char.encumbranceEnabled ?? true) && (
                    <div className="bg-yellow-900/30 border border-yellow-600/50 rounded p-2 text-sm text-yellow-300">
                      Encumbrance is disabled. Burdened/Overburdened penalties will not apply.
                    </div>
                  )}
                  
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
                          Total EV Carried: <span className="text-white font-semibold">{total.toFixed(1)}</span> ({status})
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

              {editModal.type === 'mainTabInfo' && (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  <p className="text-gray-300">
                    This is your <span className="font-bold text-white">Main Character Screen</span>. Here you can add your name, race, class, and everything else that describes your character.
                  </p>
                  
                  <div>
                    <h4 className="font-bold text-blue-400 mb-1">Class & Level</h4>
                    <p className="text-sm text-gray-300 mb-2">
                      Click Edit Class to choose your class configuration:
                    </p>
                    <ul className="text-sm text-gray-300 space-y-2 ml-4 list-disc">
                      <li><span className="font-semibold text-white">Single Class:</span> One class with standard XP progression.</li>
                      <li><span className="font-semibold text-white">Multi-Class:</span> 2-3 classes that level together. XP requirements are combined plus a multi-class bonus (+200 XP per level for 2 classes, +300 XP per level for 3 classes).</li>
                      <li><span className="font-semibold text-white">Class and a Half:</span> Primary class at full XP progression, supporting class at half speed. The supporting class XP is split: first half added at primary levels 2,4,6... and second half at 3,5,7...</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-blue-400 mb-1">Experience Tracking</h4>
                    <p className="text-sm text-gray-300">
                      Using the Player's Handbook or Adventurer's Backpack, enter the XP needed for each level in "Level XP". For Single Class, enter one XP value per level. For Multi-Class or Class and a Half, enter each class's XP separately and the app will calculate the combined totals. As you gain XP throughout the campaign, the app will track your progress automatically.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-blue-400 mb-1">HP Tracking</h4>
                    <p className="text-sm text-gray-300">
                      Track your HP for each level. You can manually enter what you rolled on physical dice, or choose the correct die type and let the app roll and add your CON modifier automatically.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-blue-400 mb-1">AC Tracking</h4>
                    <p className="text-sm text-gray-300">
                      Edit your base AC as well as add your DEX modifier and any other abilities or items that boost it. To add armor or a shield to your AC, first add those items to your Inventory, then return here to select them in AC Tracking.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-blue-400 mb-1">Attributes</h4>
                    <p className="text-sm text-gray-300 mb-2">
                      Enter your rolled attribute scores manually, or click the 🎲 button near the Attributes title to roll them automatically. Three rolling methods are available:
                    </p>
                    <ul className="text-sm text-gray-300 space-y-1 ml-4 list-disc">
                      <li><span className="font-semibold text-white">Method 1 (3d6):</span> Roll 3d6 six times. Arrange scores as desired.</li>
                      <li><span className="font-semibold text-white">Method 2 (4d6 Drop Lowest):</span> Roll 4d6 six times, drop the lowest die each time. Arrange scores as desired.</li>
                      <li><span className="font-semibold text-white">Method 3 (Best of 6, Fixed):</span> Roll 3d6 six times per attribute, keep the highest. Scores are assigned in order (STR, DEX, CON, INT, WIS, CHA).</li>
                    </ul>
                    <p className="text-sm text-gray-300 mt-2">
                      You can also designate an attribute as a Prime, which provides bonuses to related checks and saves.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-blue-400 mb-1">Class Abilities</h4>
                    <p className="text-sm text-gray-300">
                      Notes you can add to track what your class can do—special abilities, features, and class-specific rules.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-blue-400 mb-1">Race Abilities</h4>
                    <p className="text-sm text-gray-300">
                      Similar to Class Abilities, but for racial traits. Here you can also add or subtract bonuses to your Attributes or AC based on your race.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-blue-400 mb-1">Advantages</h4>
                    <p className="text-sm text-gray-300">
                      Track Advantages from the Castle Keeper's Guide, such as Fleet of Foot, Sacrificing Riposte, or other special abilities your character has gained.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-blue-400 mb-1">Details</h4>
                    <p className="text-sm text-gray-300">
                      Your character's age, height, weight, physical description, and backstory.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-blue-400 mb-1">Alignment, Languages, Deity & Holy Symbol</h4>
                    <p className="text-sm text-gray-300">
                      Additional character information at the bottom of the Main tab.
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setEditModal(null)}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-2"
                  >
                    Got It
                  </button>
                </div>
              )}

              {editModal.type === 'savesTabInfo' && (
                <div className="space-y-4">
                  <p className="text-gray-300">
                    This app uses the <span className="font-bold text-white">Prime as a +6</span> bonus to an attribute instead of the 12/18 rule found in the Castle Keeper's Guide.
                  </p>
                  <p className="text-gray-300 text-sm">
                    When you designate an attribute as a Prime (on the Main tab), it will automatically add +6 to your checks and saving throws for that attribute.
                  </p>
                  <button
                    onClick={() => setEditModal(null)}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-2"
                  >
                    Got It
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

              {editModal.type === 'characterDetails' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Age</label>
                      <input
                        type="text"
                        value={modalForms.charAge || ''}
                        onChange={(e) => updateModalForm({ charAge: e.target.value })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                        placeholder="e.g., 25"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Height</label>
                      <input
                        type="text"
                        value={modalForms.charHeight || ''}
                        onChange={(e) => updateModalForm({ charHeight: e.target.value })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                        placeholder="e.g., 5ft 10in"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Weight</label>
                      <input
                        type="text"
                        value={modalForms.charWeight || ''}
                        onChange={(e) => updateModalForm({ charWeight: e.target.value })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                        placeholder="e.g., 180 lbs"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Description</label>
                    <textarea
                      value={modalForms.charDescription || ''}
                      onChange={(e) => updateModalForm({ charDescription: e.target.value })}
                      className="w-full p-2 bg-gray-700 rounded text-white h-24"
                      placeholder="Physical appearance, mannerisms, etc."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Backstory</label>
                    <textarea
                      value={modalForms.charBackstory || ''}
                      onChange={(e) => updateModalForm({ charBackstory: e.target.value })}
                      className="w-full p-2 bg-gray-700 rounded text-white h-32"
                      placeholder="Character history, motivations, goals..."
                    />
                  </div>
                  
                  <button
                    onClick={() => {
                      updateChar({
                        age: modalForms.charAge,
                        height: modalForms.charHeight,
                        weight: modalForms.charWeight,
                        description: modalForms.charDescription,
                        backstory: modalForms.charBackstory,
                      });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              )}

              {editModal.type === 'class' && (
                <div>
                  {/* Step 1: Choose class type */}
                  {classModalStep === 'choose' && (
                    <div>
                      <div className="text-sm text-gray-400 mb-4">Choose your class configuration:</div>
                      
                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            setClassModalForm(prev => ({ ...prev, classType: 'single', showClass3: false }));
                            setClassModalStep('setup');
                          }}
                          className="w-full p-4 bg-gray-700 rounded-lg hover:bg-gray-600 text-left"
                        >
                          <div className="font-bold text-white">Single Class</div>
                          <div className="text-sm text-gray-400">One class with standard XP progression</div>
                        </button>
                        
                        <button
                          onClick={() => {
                            setClassModalForm(prev => ({ ...prev, classType: 'multi', showClass3: false }));
                            setClassModalStep('setup');
                          }}
                          className="w-full p-4 bg-gray-700 rounded-lg hover:bg-gray-600 text-left"
                        >
                          <div className="font-bold text-white">Multi-Class</div>
                          <div className="text-sm text-gray-400">2-3 classes with combined XP requirements (+200/level per extra class)</div>
                        </button>
                        
                        <button
                          onClick={() => {
                            setClassModalForm(prev => ({ ...prev, classType: 'classAndHalf', showClass3: false }));
                            setClassModalStep('setup');
                          }}
                          className="w-full p-4 bg-gray-700 rounded-lg hover:bg-gray-600 text-left"
                        >
                          <div className="font-bold text-white">Class and a Half</div>
                          <div className="text-sm text-gray-400">Primary class + half XP from supporting class spread over 2 levels</div>
                        </button>
                      </div>
                      
                      <button
                        onClick={() => setEditModal(null)}
                        className="w-full py-2 bg-gray-600 rounded hover:bg-gray-500 mt-4"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  
                  {/* Step 2: Setup classes based on type */}
                  {classModalStep === 'setup' && (
                    <div>
                      {/* Back button to change class type */}
                      <button
                        onClick={() => setClassModalStep('choose')}
                        className="text-sm text-blue-400 hover:text-blue-300 mb-3 flex items-center gap-1"
                      >
                        ← Change class type
                      </button>
                      
                      {/* Class type indicator */}
                      <div className="text-xs text-gray-500 mb-3">
                        Type: <span className="text-gray-300 font-semibold">
                          {classModalForm.classType === 'single' && 'Single Class'}
                          {classModalForm.classType === 'multi' && 'Multi-Class'}
                          {classModalForm.classType === 'classAndHalf' && 'Class and a Half'}
                        </span>
                      </div>
                      
                      {/* Single Class Setup */}
                      {classModalForm.classType === 'single' && (
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Class Name</label>
                          <input
                            type="text"
                            value={classModalForm.class1}
                            onChange={(e) => setClassModalForm(prev => ({ ...prev, class1: e.target.value }))}
                            placeholder="e.g., Fighter, Wizard, Rogue"
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          />
                        </div>
                      )}
                      
                      {/* Multi-Class Setup */}
                      {classModalForm.classType === 'multi' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Class 1</label>
                            <input
                              type="text"
                              value={classModalForm.class1}
                              onChange={(e) => setClassModalForm(prev => ({ ...prev, class1: e.target.value }))}
                              placeholder="e.g., Fighter"
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Class 2</label>
                            <input
                              type="text"
                              value={classModalForm.class2}
                              onChange={(e) => setClassModalForm(prev => ({ ...prev, class2: e.target.value }))}
                              placeholder="e.g., Wizard"
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                          </div>
                          
                          {classModalForm.showClass3 ? (
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">Class 3</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={classModalForm.class3}
                                  onChange={(e) => setClassModalForm(prev => ({ ...prev, class3: e.target.value }))}
                                  placeholder="e.g., Rogue"
                                  className="flex-1 p-2 bg-gray-700 rounded text-white"
                                />
                                <button
                                  onClick={() => setClassModalForm(prev => ({ ...prev, class3: '', showClass3: false }))}
                                  className="px-3 py-2 bg-red-600 rounded hover:bg-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setClassModalForm(prev => ({ ...prev, showClass3: true }))}
                              className="text-sm text-blue-400 hover:text-blue-300"
                            >
                              + Add 3rd Class
                            </button>
                          )}
                          
                          <div className="text-xs text-gray-500 bg-gray-800 p-2 rounded">
                            <div className="font-semibold text-gray-400 mb-1">Multi-Class XP Bonus:</div>
                            {classModalForm.showClass3 ? (
                              <div>+300 XP per level (Level 2 = +300, Level 3 = +600, etc.)</div>
                            ) : (
                              <div>+200 XP per level (Level 2 = +200, Level 3 = +400, etc.)</div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Class and a Half Setup */}
                      {classModalForm.classType === 'classAndHalf' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Primary Class</label>
                            <input
                              type="text"
                              value={classModalForm.class1}
                              onChange={(e) => setClassModalForm(prev => ({ ...prev, class1: e.target.value }))}
                              placeholder="e.g., Fighter"
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                            <div className="text-xs text-gray-500 mt-1">Full XP requirements</div>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Supporting Class</label>
                            <input
                              type="text"
                              value={classModalForm.class2}
                              onChange={(e) => setClassModalForm(prev => ({ ...prev, class2: e.target.value }))}
                              placeholder="e.g., Wizard"
                              className="w-full p-2 bg-gray-700 rounded text-white"
                            />
                            <div className="text-xs text-gray-500 mt-1">Half XP spread over 2 levels</div>
                          </div>
                          
                          <div className="text-xs text-gray-500 bg-gray-800 p-2 rounded">
                            <div className="font-semibold text-gray-400 mb-1">Class and a Half XP:</div>
                            <div>Primary Level 2 = Primary L2 + ½ Supporting L1</div>
                            <div>Primary Level 3 = Primary L3 + other ½ of Supporting L1</div>
                            <div>Primary Level 4 = Primary L4 + ½ Supporting L2</div>
                            <div>...and so on</div>
                          </div>
                        </div>
                      )}
                      
                      <button
                        onClick={() => {
                          // Save class configuration
                          const updates: Partial<Character> = {
                            classType: classModalForm.classType,
                            class1: classModalForm.class1,
                            class2: classModalForm.classType !== 'single' ? classModalForm.class2 : undefined,
                            class3: classModalForm.classType === 'multi' && classModalForm.showClass3 ? classModalForm.class3 : undefined
                          };
                          
                          // Initialize XP tables if switching to multi-class types
                          if (classModalForm.classType === 'multi' || classModalForm.classType === 'classAndHalf') {
                            if (!char.xpTableClass1 || char.xpTableClass1.length === 0) {
                              updates.xpTableClass1 = [0, 2000, 4000, 8000, 16000, 32000, 64000, 120000, 240000, 360000, 480000, 600000, 720000, 840000, 960000, 1080000, 1200000, 1320000, 1440000, 1560000, 1680000, 1800000, 1920000, 2040000, 2160000];
                            }
                            if (!char.xpTableClass2 || char.xpTableClass2.length === 0) {
                              updates.xpTableClass2 = [0, 2000, 4000, 8000, 16000, 32000, 64000, 120000, 240000, 360000, 480000, 600000, 720000, 840000, 960000, 1080000, 1200000, 1320000, 1440000, 1560000, 1680000, 1800000, 1920000, 2040000, 2160000];
                            }
                            if (classModalForm.classType === 'multi' && classModalForm.showClass3) {
                              if (!char.xpTableClass3 || char.xpTableClass3.length === 0) {
                                updates.xpTableClass3 = [0, 2000, 4000, 8000, 16000, 32000, 64000, 120000, 240000, 360000, 480000, 600000, 720000, 840000, 960000, 1080000, 1200000, 1320000, 1440000, 1560000, 1680000, 1800000, 1920000, 2040000, 2160000];
                              }
                            }
                          }
                          
                          updateChar(updates);
                          setEditModal(null);
                        }}
                        className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-4"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              )}

              {editModal.type === 'speed' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Base Speed (feet)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={modalForms.speedBase === 0 ? '' : modalForms.speedBase}
                    onChange={(e) => updateModalForm({ speedBase: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                    placeholder="30"
                    className="w-full p-2 bg-gray-700 rounded text-white"
                  />

                  <label className="block text-sm text-gray-400 mb-2 mt-3">Bonus (feet)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={modalForms.speedBonus === 0 ? '' : modalForms.speedBonus}
                    onChange={(e) => updateModalForm({ speedBonus: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                    placeholder="0"
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
                      type="text"
                      inputMode="numeric"
                      value={modalForms.hpCurrent === 0 ? '' : modalForms.hpCurrent}
                      onChange={(e) => updateModalForm({ hpCurrent: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                      placeholder="0"
                      className="w-full p-2 bg-gray-700 rounded text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Change (add or subtract)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={modalForms.hpDelta === 0 ? '' : modalForms.hpDelta}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || val === '-') {
                          updateModalForm({ hpDelta: val === '-' ? val : 0 });
                        } else {
                          updateModalForm({ hpDelta: parseInt(val) || 0 });
                        }
                      }}
                      placeholder="0"
                      className="w-full p-2 bg-gray-700 rounded text-white"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      Example: enter -5 for damage, or 8 for healing.
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const delta = typeof modalForms.hpDelta === 'string' ? 0 : modalForms.hpDelta;
                      const next = clamp(modalForms.hpCurrent + delta, 0, calculateMaxHP());
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
                    HP levels unlock as you gain XP. Roll or enter HP for each level you've earned. Total Max HP: <span className="font-bold text-white">{calculateMaxHP()}</span>
                  </div>
                  
                  {/* Level drain explanation */}
                  <div className="mb-3 p-2 bg-gray-900 rounded text-xs text-gray-400">
                    <div className="mb-1"><span className="text-blue-400 font-semibold">🔒 Locked Levels:</span> Levels you haven't reached via XP are locked. Gain more XP to unlock them.</div>
                    <div><span className="text-yellow-400 font-semibold">☐ Level Drain:</span> Uncheck the box to mark a level as drained (from spells/curses). Drained levels lose their HP and shift XP requirements. Re-check to restore.</div>
                  </div>
                  
                  <div className="mb-3 p-2 bg-gray-900 rounded">
                    <label className="block text-sm font-bold text-blue-400 mb-1">HP Hit Die</label>
                    <div className="flex items-center gap-3">
                      <select
                        value={hpDieDraft}
                        onChange={(e) => setHpDieDraft(parseInt(e.target.value, 10) || 8)}
                        className="w-28 p-2 bg-gray-700 rounded text-white"
                      >
                        <option value={4}>d4</option>
                        <option value={6}>d6</option>
                        <option value={8}>d8</option>
                        <option value={10}>d10</option>
                        <option value={12}>d12</option>
                      </select>
                      <div className="text-sm text-gray-300">
                        Roll will add CON mod: <span className="font-bold text-white">{calcMod(getAttributeTotal('con')) >= 0 ? '+' : ''}{calcMod(getAttributeTotal('con'))}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3 p-2 bg-gray-900 rounded">
                    <label className="block text-sm font-bold text-green-400 mb-1">Bonus HP (from items, feats, etc.)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={modalForms.hpBonus === 0 ? '' : modalForms.hpBonus}
                      onChange={(e) => updateModalForm({ hpBonus: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                      placeholder="0"
                      className="w-full p-2 bg-gray-700 rounded text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    {(() => {
                      const rolls = (Array.isArray(hpDraftRolls) && hpDraftRolls.length ? hpDraftRolls : ['', '', '']);
                      const levels = (Array.isArray(hpDraftLevels) && hpDraftLevels.length
                        ? hpDraftLevels
                        : Array.from({ length: rolls.length }, () => 0));
                      const levelDrained = char.levelDrained || [];
                      
                      // Calculate max level earned via XP
                      let xpEarnedLevel = 1;
                      if (Array.isArray(char.xpTable) && char.xpTable.length > 0) {
                        for (let lvl = char.xpTable.length - 1; lvl >= 0; lvl--) {
                          if (char.currentXp >= char.xpTable[lvl]) {
                            xpEarnedLevel = lvl + 1;
                            break;
                          }
                        }
                      }
                      
                      // Show up to XP-earned level + 1 (so they can see the next locked level)
                      const showCount = Math.max(3, xpEarnedLevel + 1, hpLevelsShown);
                      const conMod = calcMod(getAttributeTotal('con'));
                      
                      // Ensure rolls array is long enough
                      while (rolls.length < showCount) rolls.push('');
                      
                      return rolls.slice(0, showCount).map((rawStr, i) => {
                        const levelNum = i + 1;
                        const prevOk = i === 0 || ((parseInt(rolls[i - 1] || '0', 10) || 0) > 0);
                        const hasHP = (parseInt(rawStr || '0', 10) || 0) > 0;
                        const isDrained = levelDrained[i] === true;
                        
                        // Level is locked if player hasn't earned it via XP
                        const isLocked = levelNum > xpEarnedLevel;
                        const canEdit = prevOk && !isLocked;
                        
                        return (
                        <div key={i} className={`flex flex-wrap items-center gap-2 ${isLocked ? 'opacity-50' : ''}`}>
                          {/* Level drain checkbox - only show if level has HP and is not locked */}
                          {hasHP && !isLocked ? (
                            <label className="flex items-center justify-center w-8 h-8 flex-shrink-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!isDrained}
                                onChange={(e) => {
                                  const newDrained = [...(char.levelDrained || [])];
                                  // Ensure array is long enough
                                  while (newDrained.length <= i) newDrained.push(false);
                                  const willBeDrained = !e.target.checked;
                                  newDrained[i] = willBeDrained;
                                  
                                  // Calculate new max HP
                                  const newMaxHP = char.hpByLevel.reduce((sum, hp, idx) => {
                                    const drained = newDrained[idx] === true;
                                    return sum + (drained ? 0 : hp);
                                  }, 0) + (char.hpBonus || 0);
                                  
                                  // Adjust current HP if it exceeds new max
                                  const newCurrentHP = Math.min(char.hp, newMaxHP);
                                  
                                  updateChar({ 
                                    levelDrained: newDrained,
                                    hp: newCurrentHP
                                  });
                                }}
                                className="w-5 h-5"
                                title={isDrained ? "Level drained - check to restore" : "Uncheck to drain this level"}
                              />
                            </label>
                          ) : (
                            <div className="w-8 h-8 flex-shrink-0" /> 
                          )}
                          <label className={`w-16 text-sm font-bold ${isDrained ? 'text-red-400 line-through' : ''} ${isLocked ? 'text-gray-500' : ''}`}>
                            Level {levelNum}:
                          </label>
                          <input
                            type="text" inputMode="numeric"
                            value={rawStr ?? ''}
                            disabled={!canEdit}
                            onChange={(e) => {
                              if (!canEdit) return;
                              const val = parseInt(e.target.value || '0', 10) || 0;

                              // Update raw rolls (just the base roll, no CON mod added here)
                              const nextRolls = rolls.slice();
                              nextRolls[i] = val > 0 ? String(val) : '';
                              setHpDraftRolls(nextRolls);
                            }}
                            className={`flex-1 p-2 rounded text-white ${canEdit ? "bg-gray-700" : "bg-gray-900 text-gray-500 cursor-not-allowed"} ${isDrained ? 'opacity-50' : ''}`}
                            id={`hp-level-${i}`}
                          />
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => {
                              if (!canEdit) return;
                              const die = Number(hpDieDraft) || 12;
                              // Roll the hit die (raw), CON mod is applied on save
                              const rawRoll = rollDice(die);
                              const next = rolls.slice();
                              next[i] = String(rawRoll);
                              setHpDraftRolls(next);
                            }}
                            className={`px-3 py-2 rounded text-sm font-semibold ${canEdit ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-900 text-gray-500 cursor-not-allowed"}`}
                            title={isLocked ? `Reach level ${levelNum} to unlock` : `Roll d${hpDieDraft || 12} + CON mod`}
                          >
                            Roll
                          </button>
                          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">(CON {conMod >= 0 ? '+' : ''}{conMod})</span>
                          <span className={`text-xs whitespace-nowrap flex-shrink-0 ${isDrained ? 'text-red-400 line-through' : 'text-gray-300'}`}>
                            Total: {
                              (() => {
                                const raw = parseInt((rawStr || '0'), 10) || 0;
                                if (raw <= 0) return 0;
                                return Math.max(1, raw + conMod);
                              })()
                            }
                          </span>
                          {isDrained && <span className="text-xs text-red-400">(DRAINED)</span>}
                          {isLocked && <span className="text-xs text-yellow-400">🔒 Locked (need {char.xpTable?.[i] || '?'} XP)</span>}
                          {!canEdit && !isLocked && <span className="text-xs text-gray-500">(fill previous level first)</span>}
                        </div>
                      );
                      });
                    })()}
                  </div>

                  <button
                    onClick={() => {
                      const conMod = calcMod(getAttributeTotal('con'));
                      const draftRolls = (Array.isArray(hpDraftRolls) && hpDraftRolls.length ? hpDraftRolls : ['', '', '']);
                      
                      // Store base rolls only (no CON mod)
                      const baseRolls = draftRolls.map((v) => {
                        const raw = parseInt(v || '0', 10) || 0;
                        return raw; // Just the roll, no CON mod
                      });

                      // Trim trailing zero-rolls so you don't "unlock" future levels by accident
                      let lastFilled = -1;
                      for (let i = 0; i < baseRolls.length; i++) {
                        if ((Number(baseRolls[i]) || 0) > 0) lastFilled = i;
                      }
                      const effectiveLen = Math.max(3, lastFilled + 1);
                      const trimmedRolls = baseRolls.slice(0, effectiveLen);
                      
                      // Calculate total HP with current CON mod for display purposes
                      const calculatedHP = trimmedRolls.reduce((sum, roll) => {
                        const baseRoll = Number(roll) || 0;
                        if (baseRoll <= 0) return sum;
                        return sum + Math.max(1, baseRoll + conMod);
                      }, 0);

                      const newBonus = modalForms.hpBonus || 0;
                      const newDie = Number(hpDieDraft) || 12;
                      const newMaxHP = calculatedHP + newBonus;
                      const newCurrentHP = Math.min(char.hp, newMaxHP);

                      updateChar({
                        hpRollsByLevel: trimmedRolls,  // Store base rolls
                        hpByLevel: trimmedRolls,  // Keep for backwards compat
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
                        type="text"
                        inputMode="numeric"
                        value={modalForms.acBase === 10 ? '' : modalForms.acBase}
                        onChange={(e) => updateModalForm({ acBase: e.target.value === '' ? 10 : (parseInt(e.target.value) || 10) })}
                        placeholder="10"
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
                              let base = 0;
                              let magic = 0;
                              for (const id of armorIds) {
                                const it = (char.inventory || []).find(i => String(i.id) === String(id));
                                base += Number(it?.acBonus) || 0;
                                magic += Number(it?.magicACBonus) || 0;
                              }
                              return magic > 0 ? `${base} +${magic} magic` : base;
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
                                    <span>{it.name} (+{Number(it.acBonus) || 0}{(Number(it.magicACBonus) || 0) > 0 ? ` +${it.magicACBonus} magic` : ''})</span>
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
                              {it.name} (+{Number(it.acBonus) || 0}{(Number(it.magicACBonus) || 0) > 0 ? ` +${it.magicACBonus} magic` : ''})
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
                          type="text" inputMode="numeric"
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
                          type="text"
                          inputMode="numeric"
                          value={modalForms.acMod === 0 ? '' : modalForms.acMod}
                          onChange={(e) => updateModalForm({ acMod: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                          placeholder="0"
                          className="w-full p-2 bg-gray-700 rounded text-white"
                        />
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-1">Magic</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={modalForms.acMagic === 0 ? '' : modalForms.acMagic}
                        onChange={(e) => updateModalForm({ acMagic: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                        placeholder="0"
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-1">Misc</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={modalForms.acMisc === 0 ? '' : modalForms.acMisc}
                        onChange={(e) => updateModalForm({ acMisc: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                        placeholder="0"
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-green-400 mb-1">Bonus (temporary, use negative for penalties)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={modalForms.acBonus === 0 ? '' : modalForms.acBonus}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || val === '-') {
                            updateModalForm({ acBonus: val === '-' ? val : 0 });
                          } else {
                            updateModalForm({ acBonus: parseInt(val) || 0 });
                          }
                        }}
                        placeholder="0"
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
                  <div className="text-sm text-gray-400">Add or remove XP from the current character. Use negative numbers to remove XP.</div>
                  <label className="block text-sm text-gray-400">XP to Add/Remove</label>
                  <DomStepper value={modalForms.xpAdd} onChange={(v) => updateModalForm({ xpAdd: v })} step={100} min={-999999} allowManual={true} />
                  <button
                    onClick={() => {
                      const newXp = Math.max(0, (char.currentXp || 0) + modalForms.xpAdd);
                      updateChar({ currentXp: newXp });
                      setEditModal(null);
                    }}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                  >
                    {modalForms.xpAdd >= 0 ? 'Add XP' : 'Remove XP'}
                  </button>
                </div>
              )}

{editModal.type === 'xpTable' && (
                <div className="max-h-96 overflow-y-auto pr-6" style={{ scrollbarGutter: 'stable' }}>
                  {/* Single Class XP Table */}
                  {(!char.classType || char.classType === 'single') && (
                    <>
                      <div className="text-sm text-gray-400 mb-3">
                        {char.class1 && <span className="text-white font-semibold">{char.class1}</span>}
                        {!char.class1 && 'Single Class'} - Enter XP needed to reach each level.
                      </div>
                      <div className="space-y-2">
                        {xpTableForm.map((xp, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-2">
                            <label className="w-20 text-sm font-bold">Level {i + 1}:</label>
                            <input
                              type="text" inputMode="numeric"
                              value={xp === 0 ? '' : xp}
                              onChange={(e) => updateXpTableForm(i, parseInt(e.target.value) || 0)}
                              className="flex-1 p-2 bg-gray-700 rounded text-white"
                            />
                            <span className="text-xs text-gray-400">XP</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          const newTable = [...xpTableForm];
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
                    </>
                  )}
                  
                  {/* Multi-Class XP Table */}
                  {char.classType === 'multi' && (
                    <>
                      <div className="text-sm text-gray-400 mb-3">
                        Enter XP needed for each class. Combined total + multi-class bonus shown.
                      </div>
                      
                      <div className="text-xs text-gray-500 mb-2">
                        Multi-class bonus: +{char.class3 ? '300' : '200'} XP per level
                      </div>
                      
                      <div className="space-y-3">
                        {xpTableClass1Form.map((_, i) => {
                          const c1 = xpTableClass1Form[i] || 0;
                          const c2 = xpTableClass2Form[i] || 0;
                          const c3 = char.class3 ? (xpTableClass3Form[i] || 0) : 0;
                          const numClasses = char.class3 ? 3 : 2;
                          const multiBonus = i * (numClasses === 3 ? 300 : 200);
                          const total = c1 + c2 + c3 + multiBonus;
                          
                          return (
                            <div key={i} className="bg-gray-800 p-3 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-white">Level {i + 1}</span>
                                <span className="text-yellow-400 font-semibold">
                                  Total: {total.toLocaleString()}
                                  {multiBonus > 0 && <span className="text-xs text-gray-500 ml-1">(+{multiBonus})</span>}
                                </span>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-blue-400 w-24 flex-shrink-0">{char.class1 || 'Class 1'}</label>
                                  <input
                                    type="text" inputMode="numeric"
                                    value={c1 === 0 ? '' : c1}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 0;
                                      setXpTableClass1Form(prev => {
                                        const next = [...prev];
                                        next[i] = val;
                                        return next;
                                      });
                                    }}
                                    className="flex-1 p-2 bg-gray-700 rounded text-white text-sm"
                                    placeholder="0"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-green-400 w-24 flex-shrink-0">{char.class2 || 'Class 2'}</label>
                                  <input
                                    type="text" inputMode="numeric"
                                    value={c2 === 0 ? '' : c2}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 0;
                                      setXpTableClass2Form(prev => {
                                        const next = [...prev];
                                        next[i] = val;
                                        return next;
                                      });
                                    }}
                                    className="flex-1 p-2 bg-gray-700 rounded text-white text-sm"
                                    placeholder="0"
                                  />
                                </div>
                                {char.class3 && (
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs text-purple-400 w-24 flex-shrink-0">{char.class3}</label>
                                    <input
                                      type="text" inputMode="numeric"
                                      value={c3 === 0 ? '' : c3}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setXpTableClass3Form(prev => {
                                          const next = [...prev];
                                          next[i] = val;
                                          return next;
                                        });
                                      }}
                                      className="flex-1 p-2 bg-gray-700 rounded text-white text-sm"
                                      placeholder="0"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-2">
                        Multi-class bonus: +{char.class3 ? '300' : '200'} XP per level
                      </div>
                      
                      <button
                        onClick={() => {
                          // Calculate combined xpTable
                          const numClasses = char.class3 ? 3 : 2;
                          const combinedTable = xpTableClass1Form.map((c1, i) => {
                            const c2 = xpTableClass2Form[i] || 0;
                            const c3 = char.class3 ? (xpTableClass3Form[i] || 0) : 0;
                            const multiBonus = i * (numClasses === 3 ? 300 : 200);
                            return c1 + c2 + c3 + multiBonus;
                          });
                          
                          updateChar({
                            xpTable: combinedTable,
                            xpTableClass1: xpTableClass1Form,
                            xpTableClass2: xpTableClass2Form,
                            xpTableClass3: char.class3 ? xpTableClass3Form : undefined
                          });
                          setEditModal(null);
                        }}
                        className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                      >
                        Save XP Tables
                      </button>
                    </>
                  )}
                  
                  {/* Class and a Half XP Table */}
                  {char.classType === 'classAndHalf' && (
                    <>
                      <div className="text-sm text-gray-400 mb-3">
                        Enter XP for primary class (full) and supporting class (half, spread over 2 levels).
                      </div>
                      
                      <div className="text-xs text-gray-500 mb-2 bg-gray-800 p-2 rounded">
                        Supporting class XP is split: first half added at odd primary levels (2,4,6...), second half at even (3,5,7...).
                      </div>
                      
                      <div className="space-y-3">
                        {xpTableClass1Form.map((_, i) => {
                          const primaryXP = xpTableClass1Form[i] || 0;
                          const supportingLevelIndex = Math.floor((i) / 2);
                          const supportingXP = xpTableClass2Form[supportingLevelIndex] || 0;
                          const halfSupporting = Math.floor(supportingXP / 2);
                          const supportCost = i === 0 ? 0 : halfSupporting;
                          const total = primaryXP + supportCost;
                          const isFirstHalf = i % 2 === 1;
                          const supportLevelForDisplay = Math.ceil(i / 2);
                          
                          return (
                            <div key={i} className="bg-gray-800 p-3 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-white">Level {i + 1}</span>
                                <span className="text-yellow-400 font-semibold">
                                  Total: {total.toLocaleString()}
                                  {supportCost > 0 && <span className="text-xs text-gray-500 ml-1">(+{supportCost})</span>}
                                </span>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-blue-400 w-24 flex-shrink-0">{char.class1 || 'Primary'}</label>
                                  <input
                                    type="text" inputMode="numeric"
                                    value={primaryXP === 0 ? '' : primaryXP}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 0;
                                      setXpTableClass1Form(prev => {
                                        const next = [...prev];
                                        next[i] = val;
                                        return next;
                                      });
                                    }}
                                    className="flex-1 p-2 bg-gray-700 rounded text-white text-sm"
                                    placeholder="0"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-green-400 w-24 flex-shrink-0">
                                    {char.class2 || 'Support'} L{supportLevelForDisplay}
                                  </label>
                                  {i > 0 && i % 2 === 1 ? (
                                    <input
                                      type="text" inputMode="numeric"
                                      value={supportingXP === 0 ? '' : supportingXP}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setXpTableClass2Form(prev => {
                                          const next = [...prev];
                                          next[supportingLevelIndex] = val;
                                          return next;
                                        });
                                      }}
                                      className="flex-1 p-2 bg-gray-700 rounded text-white text-sm"
                                      placeholder="Full XP for this level"
                                    />
                                  ) : (
                                    <div className="flex-1 text-xs text-gray-500 p-2 bg-gray-700 rounded">
                                      {i === 0 ? '— (none at L1)' : `½ of ${supportingXP.toLocaleString()} = ${halfSupporting.toLocaleString()}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <button
                        onClick={() => {
                          // Calculate combined xpTable for class and a half
                          const combinedTable = xpTableClass1Form.map((primaryXP, i) => {
                            if (i === 0) return primaryXP;
                            const supportingLevelIndex = Math.floor(i / 2);
                            const supportingXP = xpTableClass2Form[supportingLevelIndex] || 0;
                            const halfSupporting = Math.floor(supportingXP / 2);
                            return primaryXP + halfSupporting;
                          });
                          
                          updateChar({
                            xpTable: combinedTable,
                            xpTableClass1: xpTableClass1Form,
                            xpTableClass2: xpTableClass2Form
                          });
                          setEditModal(null);
                        }}
                        className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                      >
                        Save XP Tables
                      </button>
                    </>
                  )}
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

                      const classTotal = (char.classAttributeMods || [])
                        .filter(m => String(m.attr).toLowerCase() === String(attrKey).toLowerCase())
                        .reduce((sum, m) => sum + (Number(m.value) || 0), 0);

                      return (
                        <>
                          <div className="mb-2">
                            <span className="text-gray-300 font-semibold">Race Modifier:</span>{' '}
                            <span>{raceTotal >= 0 ? '+' : ''}{raceTotal}</span>
                          </div>

                          <div className="mb-2">
                            <span className="text-gray-300 font-semibold">Class Modifier:</span>{' '}
                            <span>{classTotal >= 0 ? '+' : ''}{classTotal}</span>
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
                            Total: {modalForms.attrRolled + raceTotal + classTotal + modalForms.attrBonus + itemTotal}
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

              {editModal.type === 'initiativeBonus' && (
                <div>
                  <div className="text-sm text-gray-400 mb-3">Add bonuses to initiative from items, abilities, etc.</div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm text-gray-400">Initiative Bonuses</label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...(char.initiativeBonuses || []), { description: '', value: 0, valueText: '0' }];
                        updateChar({ initiativeBonuses: next });
                      }}
                      className="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500 text-sm"
                    >
                      + Add Bonus
                    </button>
                  </div>

                  {(char.initiativeBonuses || []).length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-4">No initiative bonuses. Click "Add Bonus" to add one.</div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {(char.initiativeBonuses || []).map((bonus, idx) => (
                        <div key={idx} className="bg-gray-800 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={bonus.description || ''}
                              onChange={(e) => {
                                const next = [...(char.initiativeBonuses || [])];
                                next[idx] = { ...next[idx], description: e.target.value };
                                updateChar({ initiativeBonuses: next });
                              }}
                              className="flex-1 min-w-0 p-2 bg-gray-700 rounded text-white text-sm"
                              placeholder="Description"
                            />
                            <input
                              type="text"
                              inputMode="numeric"
                              value={bonus.valueText ?? String(bonus.value ?? 0)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const next = [...(char.initiativeBonuses || [])];
                                const updated = { ...next[idx], valueText: raw };
                                const parsed = parseInt(raw, 10);
                                if (!isNaN(parsed)) updated.value = parsed;
                                next[idx] = updated;
                                updateChar({ initiativeBonuses: next });
                              }}
                              className="w-14 flex-shrink-0 p-2 bg-gray-700 rounded text-white text-sm text-center"
                              placeholder="+/-"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = (char.initiativeBonuses || []).filter((_, i) => i !== idx);
                                updateChar({ initiativeBonuses: next });
                              }}
                              className="p-2 bg-red-600 rounded hover:bg-red-700 flex-shrink-0"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-600 text-sm">
                    <span className="text-gray-400">Total Bonus: </span>
                    <span className="font-bold text-yellow-400">
                      {(char.initiativeBonuses || []).reduce((sum, b) => sum + (Number(b.value) || 0), 0) >= 0 ? '+' : ''}
                      {(char.initiativeBonuses || []).reduce((sum, b) => sum + (Number(b.value) || 0), 0)}
                    </span>
                  </div>

                  <button
                    onClick={() => setEditModal(null)}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Done
                  </button>
                </div>
              )}

              {editModal.type === 'saveModifiers' && (
                <div>
                  <div className="text-sm text-gray-400 mb-3">Temporary bonuses/penalties from bless, curse, etc. Use negative numbers for penalties. This applies to ALL saving throws.</div>
                  <label className="block text-sm text-gray-400 mb-2">Save Bonus</label>
                  <input
                    type="text" inputMode="numeric"
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
                  {/* Include in total checkbox - upper right */}
                  <div className="flex justify-end mb-3">
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={char.includeCoinWeight ?? false}
                        onChange={(e) => updateChar({ includeCoinWeight: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Include in Total Weight/EV
                    </label>
                  </div>

                  {/* Current Coin Breakdown - includes coins in bags */}
                  {(() => {
                    const wallet = char.wallet || { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };
                    
                    // Calculate coins in all magical containers
                    const magicalContainers = (char.inventory || []).filter(c => c.isContainer && c.isMagicalContainer);
                    const bagsCoins = magicalContainers.reduce((acc, c) => {
                      if (c.storedCoins) {
                        acc.copper += Math.round(c.storedCoins.copper || 0);
                        acc.silver += Math.round(c.storedCoins.silver || 0);
                        acc.gold += Math.round(c.storedCoins.gold || 0);
                        acc.electrum += Math.round(c.storedCoins.electrum || 0);
                        acc.platinum += Math.round(c.storedCoins.platinum || 0);
                      } else if (c.storedCoinsGP) {
                        // Legacy: treat as gold
                        acc.gold += Math.floor(c.storedCoinsGP);
                      }
                      return acc;
                    }, { copper: 0, silver: 0, gold: 0, electrum: 0, platinum: 0 });
                    
                    // Total coins = wallet + bags
                    const pp = Math.round(wallet.platinum || 0) + bagsCoins.platinum;
                    const gp = Math.round(wallet.gold || 0) + bagsCoins.gold;
                    const ep = Math.round(wallet.electrum || 0) + bagsCoins.electrum;
                    const sp = Math.round(wallet.silver || 0) + bagsCoins.silver;
                    const cp = Math.round(wallet.copper || 0) + bagsCoins.copper;
                    
                    // Coins on person (not in bags) - for weight calculation
                    const ppOnPerson = Math.round(wallet.platinum || 0);
                    const gpOnPerson = Math.round(wallet.gold || 0);
                    const epOnPerson = Math.round(wallet.electrum || 0);
                    const spOnPerson = Math.round(wallet.silver || 0);
                    const cpOnPerson = Math.round(wallet.copper || 0);
                    const coinsOnPerson = ppOnPerson + gpOnPerson + epOnPerson + spOnPerson + cpOnPerson;
                    
                    const totalCoins = pp + gp + ep + sp + cp;
                    const totalGPValue = (pp * 10) + gp + (ep * 5) + (sp * 0.1) + (cp * 0.01);
                    const coinWeight = coinsOnPerson / 16; // Only coins on person count for weight
                    const coinEV = coinsOnPerson / 160;
                    
                    const coinsInBags = totalCoins - coinsOnPerson;
                    
                    return (
                      <div className="bg-gray-900 rounded p-3 mb-4">
                        <div className="text-center mb-3">
                          <div className="text-2xl font-bold text-yellow-400">{totalGPValue.toFixed(2)} GP</div>
                          <div className="text-xs text-gray-500">Total Wealth</div>
                        </div>
                        
                        <div className="flex flex-wrap justify-center gap-1 mb-3">
                          <div className="bg-gray-800 rounded p-2 min-w-[60px]">
                            <div className="text-base sm:text-lg font-bold text-orange-400 text-center">{cp.toLocaleString()}</div>
                            <div className="text-xs text-gray-500 text-center">CP</div>
                          </div>
                          <div className="bg-gray-800 rounded p-2 min-w-[60px]">
                            <div className="text-base sm:text-lg font-bold text-gray-400 text-center">{sp.toLocaleString()}</div>
                            <div className="text-xs text-gray-500 text-center">SP</div>
                          </div>
                          <div className="bg-gray-800 rounded p-2 min-w-[60px]">
                            <div className="text-base sm:text-lg font-bold text-yellow-400 text-center">{gp.toLocaleString()}</div>
                            <div className="text-xs text-gray-500 text-center">GP</div>
                          </div>
                          <div className="bg-gray-800 rounded p-2 min-w-[60px]">
                            <div className="text-base sm:text-lg font-bold text-blue-300 text-center">{ep.toLocaleString()}</div>
                            <div className="text-xs text-gray-500 text-center">EP</div>
                          </div>
                          <div className="bg-gray-800 rounded p-2 min-w-[60px]">
                            <div className="text-base sm:text-lg font-bold text-gray-300 text-center">{pp.toLocaleString()}</div>
                            <div className="text-xs text-gray-500 text-center">PP</div>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-400 text-center">
                          {totalCoins.toLocaleString()} total coins
                          {coinsInBags > 0 && <span className="text-gray-500"> ({coinsInBags.toLocaleString()} in bags)</span>}
                        </div>
                        <div className="text-xs text-gray-400 text-center mt-1">
                          On person: {coinsOnPerson.toLocaleString()} coins • {coinWeight.toFixed(2)} lb • {coinEV.toFixed(2)} EV
                        </div>
                        <div className="text-xs text-gray-500 text-center mt-1">
                          16 coins = 1 lb • 160 coins = 1 EV
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Coins stored in magical containers */}
                  {(() => {
                    const magicalContainers = (char.inventory || []).filter(c => c.isContainer && c.isMagicalContainer);
                    if (magicalContainers.length === 0) return null;
                    
                    // Calculate total stored coins across all containers
                    const totalStoredCoinsGP = magicalContainers.reduce((sum, c) => {
                      if (c.storedCoins) {
                        return sum + (c.storedCoins.platinum * 10) + (c.storedCoins.electrum * 5) + 
                               c.storedCoins.gold + (c.storedCoins.silver * 0.1) + (c.storedCoins.copper * 0.01);
                      }
                      return sum + (Number(c.storedCoinsGP) || 0);
                    }, 0);
                    const totalStoredCoinCount = magicalContainers.reduce((sum, c) => {
                      if (c.storedCoins) {
                        return sum + Math.round(c.storedCoins.platinum || 0) + Math.round(c.storedCoins.gold || 0) + 
                               Math.round(c.storedCoins.electrum || 0) + Math.round(c.storedCoins.silver || 0) + 
                               Math.round(c.storedCoins.copper || 0);
                      }
                      return sum + Math.floor(Number(c.storedCoinsGP) || 0);
                    }, 0);
                    
                    const selectedContainerId = walletForm.selectedCoinContainer;
                    const selectedContainer = selectedContainerId ? magicalContainers.find(c => c.id === selectedContainerId) : null;
                    const wallet = char.wallet || { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };
                    
                    // Get current coins in selected container (ensure whole numbers)
                    let containerCoins = selectedContainer?.storedCoins 
                      ? { 
                          platinum: Math.round(selectedContainer.storedCoins.platinum || 0),
                          gold: Math.round(selectedContainer.storedCoins.gold || 0),
                          electrum: Math.round(selectedContainer.storedCoins.electrum || 0),
                          silver: Math.round(selectedContainer.storedCoins.silver || 0),
                          copper: Math.round(selectedContainer.storedCoins.copper || 0)
                        } 
                      : { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };
                    // Migrate legacy storedCoinsGP to gold
                    if (selectedContainer && !selectedContainer.storedCoins && selectedContainer.storedCoinsGP) {
                      containerCoins.gold = Math.floor(selectedContainer.storedCoinsGP);
                    }
                    
                    const containerInfo = selectedContainer ? getContainerInfo(selectedContainer.id) : null;
                    const maxWeight = selectedContainer ? (Number(selectedContainer.containerMaxWeight) || Infinity) : 0;
                    const weightUsedByItems = containerInfo ? (containerInfo.totalWeight - containerInfo.storedCoinsWeight) : 0;
                    const availableWeightForCoins = maxWeight === Infinity ? Infinity : Math.max(0, maxWeight - weightUsedByItems);
                    const maxCoinsByWeight = maxWeight === Infinity ? Infinity : Math.floor(availableWeightForCoins * 16);
                    
                    const currentCoinCount = containerCoins.platinum + containerCoins.gold + containerCoins.electrum + 
                                            containerCoins.silver + containerCoins.copper;
                    
                    // Get which coins are selected for moving
                    const moveCoinsSelection = walletForm.moveCoins || { copper: false, silver: false, gold: false, electrum: false, platinum: false };
                    
                    // Ensure wallet values are whole numbers
                    const walletRounded = {
                      copper: Math.round(wallet.copper || 0),
                      silver: Math.round(wallet.silver || 0),
                      gold: Math.round(wallet.gold || 0),
                      electrum: Math.round(wallet.electrum || 0),
                      platinum: Math.round(wallet.platinum || 0)
                    };
                    
                    // Calculate totals for selected coin types only (coins NOT in this container)
                    const selectedWalletTotal = 
                      (moveCoinsSelection.copper ? walletRounded.copper : 0) +
                      (moveCoinsSelection.silver ? walletRounded.silver : 0) +
                      (moveCoinsSelection.gold ? walletRounded.gold : 0) +
                      (moveCoinsSelection.electrum ? walletRounded.electrum : 0) +
                      (moveCoinsSelection.platinum ? walletRounded.platinum : 0);
                    
                    const selectedContainerTotal = 
                      (moveCoinsSelection.copper ? containerCoins.copper : 0) +
                      (moveCoinsSelection.silver ? containerCoins.silver : 0) +
                      (moveCoinsSelection.gold ? containerCoins.gold : 0) +
                      (moveCoinsSelection.electrum ? containerCoins.electrum : 0) +
                      (moveCoinsSelection.platinum ? containerCoins.platinum : 0);
                    
                    const totalSelectedCoins = selectedWalletTotal + selectedContainerTotal;
                    const sliderMax = selectedContainer ? (maxCoinsByWeight === Infinity ? totalSelectedCoins : Math.min(maxCoinsByWeight, totalSelectedCoins)) : 0;
                    
                    const containerGPValue = (containerCoins.platinum * 10) + (containerCoins.electrum * 5) + 
                                            containerCoins.gold + (containerCoins.silver * 0.1) + (containerCoins.copper * 0.01);
                    
                    return (
                      <div className="mb-4 p-3 bg-gray-900 rounded">
                        <div className="text-sm text-gray-400 mb-2">💰 Store Coins in Magical Container</div>
                        <div className="text-xs text-gray-500 mb-2">
                          Moving coins to a bag reduces your carried weight/EV. Your total wealth stays the same.
                        </div>
                        
                        {/* Container dropdown */}
                        <select
                          value={selectedContainerId || ''}
                          onChange={(e) => {
                            const newId = e.target.value ? Number(e.target.value) : null;
                            updateWalletForm({ selectedCoinContainer: newId });
                          }}
                          className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                        >
                          <option value="">Select a magical container...</option>
                          {magicalContainers.map(c => {
                            const info = getContainerInfo(c.id);
                            return (
                              <option key={c.id} value={c.id}>
                                {c.name} ({info.storedCoinCount} coins in bag)
                              </option>
                            );
                          })}
                        </select>
                        
                        {/* Coin transfer controls when container selected */}
                        {selectedContainer && (
                          <div className="space-y-3">
                            {/* Coin type checkboxes - which coins to move */}
                            <div className="text-xs text-gray-400 mb-1">Select coins to move:</div>
                            <div className="flex flex-wrap gap-3 mb-3">
                              {[
                                { key: 'copper', label: 'CP', color: 'text-orange-400' },
                                { key: 'silver', label: 'SP', color: 'text-gray-400' },
                                { key: 'gold', label: 'GP', color: 'text-yellow-400' },
                                { key: 'electrum', label: 'EP', color: 'text-blue-300' },
                                { key: 'platinum', label: 'PP', color: 'text-gray-300' }
                              ].map(coin => (
                                <label key={coin.key} className="flex items-center gap-1 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={moveCoinsSelection[coin.key]}
                                    onChange={(e) => {
                                      updateWalletForm({ 
                                        moveCoins: { ...moveCoinsSelection, [coin.key]: e.target.checked }
                                      });
                                    }}
                                    className="w-3 h-3"
                                  />
                                  <span className={coin.color}>{coin.label}</span>
                                  <span className="text-gray-500">({walletRounded[coin.key]}/{containerCoins[coin.key]})</span>
                                </label>
                              ))}
                            </div>
                            
                            {/* Current status */}
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>On person: {selectedWalletTotal} coins</span>
                              <span>In bag: {selectedContainerTotal} coins</span>
                            </div>
                            
                            {/* Slider - moves coins based on slider position */}
                            <input
                              type="range"
                              min={0}
                              max={sliderMax}
                              step={1}
                              value={selectedContainerTotal}
                              onChange={(e) => {
                                const targetInBag = parseInt(e.target.value) || 0;
                                const diff = targetInBag - selectedContainerTotal;
                                
                                if (diff === 0) return;
                                
                                const newWallet = { ...walletRounded };
                                const newContainerCoins = { ...containerCoins };
                                
                                // Order for moving TO bag (least valuable first): CP, SP, GP, EP, PP
                                // Order for moving FROM bag (most valuable first): PP, EP, GP, SP, CP
                                const coinOrder = diff > 0 
                                  ? ['copper', 'silver', 'gold', 'electrum', 'platinum']
                                  : ['platinum', 'electrum', 'gold', 'silver', 'copper'];
                                
                                let remaining = Math.abs(diff);
                                
                                for (const coinKey of coinOrder) {
                                  if (!moveCoinsSelection[coinKey] || remaining <= 0) continue;
                                  
                                  if (diff > 0) {
                                    // Moving TO bag
                                    const available = newWallet[coinKey] || 0;
                                    const toMove = Math.min(remaining, available);
                                    newWallet[coinKey] = available - toMove;
                                    newContainerCoins[coinKey] = (newContainerCoins[coinKey] || 0) + toMove;
                                    remaining -= toMove;
                                  } else {
                                    // Moving FROM bag
                                    const available = newContainerCoins[coinKey] || 0;
                                    const toMove = Math.min(remaining, available);
                                    newContainerCoins[coinKey] = available - toMove;
                                    newWallet[coinKey] = (newWallet[coinKey] || 0) + toMove;
                                    remaining -= toMove;
                                  }
                                }
                                
                                const newMoneyGP = (newWallet.platinum * 10) + (newWallet.electrum * 5) + newWallet.gold + 
                                                  (newWallet.silver * 0.1) + (newWallet.copper * 0.01);
                                
                                updateChar({
                                  wallet: newWallet,
                                  moneyGP: Math.round(newMoneyGP * 100) / 100,
                                  inventory: char.inventory.map(i => 
                                    i.id === selectedContainerId ? { ...i, storedCoins: newContainerCoins, storedCoinsGP: undefined } : i
                                  )
                                });
                              }}
                              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                              style={{ accentColor: '#eab308' }}
                            />
                            
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">0 in bag</span>
                              <span className="text-yellow-400 font-semibold">{selectedContainerTotal} coins in bag</span>
                              <span className="text-gray-500">{sliderMax} max</span>
                            </div>
                            
                            {/* Detailed breakdown */}
                            <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                              <div className="font-semibold mb-1">In {selectedContainer.name}:</div>
                              <div className="flex flex-wrap gap-x-3">
                                <span className="text-orange-400">{containerCoins.copper} CP</span>
                                <span className="text-gray-400">{containerCoins.silver} SP</span>
                                <span className="text-yellow-400">{containerCoins.gold} GP</span>
                                <span className="text-blue-300">{containerCoins.electrum} EP</span>
                                <span className="text-gray-300">{containerCoins.platinum} PP</span>
                              </div>
                              <div className="mt-1">
                                Value: {containerGPValue.toFixed(2)} GP • Weight: {(currentCoinCount / 16).toFixed(2)} lb (not counted)
                              </div>
                              {maxWeight !== Infinity && (
                                <div className="mt-1">Capacity: {currentCoinCount}/{maxCoinsByWeight} coins by weight</div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {totalStoredCoinCount > 0 && (
                          <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-700">
                            Total in all bags: {totalStoredCoinCount.toLocaleString()} coins ({(totalStoredCoinCount / 16).toFixed(2)} lb saved)
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Add/Spend Section */}
                  <div className="border-t border-gray-700 pt-4">
                    <div className="text-sm text-gray-400 mb-2">Add or Spend Coins</div>
                    <div className="grid grid-cols-5 gap-2 mb-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">CP</label>
                        <input
                          type="number"
                          min={0}
                          value={walletForm.cp || ''}
                          onChange={(e) => updateWalletForm({ cp: parseInt(e.target.value) || 0 })}
                          className="w-full p-2 bg-gray-700 rounded text-white text-center"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">SP</label>
                        <input
                          type="number"
                          min={0}
                          value={walletForm.sp || ''}
                          onChange={(e) => updateWalletForm({ sp: parseInt(e.target.value) || 0 })}
                          className="w-full p-2 bg-gray-700 rounded text-white text-center"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">GP</label>
                        <input
                          type="number"
                          min={0}
                          value={walletForm.gp || ''}
                          onChange={(e) => updateWalletForm({ gp: parseInt(e.target.value) || 0 })}
                          className="w-full p-2 bg-gray-700 rounded text-white text-center"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">EP</label>
                        <input
                          type="number"
                          min={0}
                          value={walletForm.ep || ''}
                          onChange={(e) => updateWalletForm({ ep: parseInt(e.target.value) || 0 })}
                          className="w-full p-2 bg-gray-700 rounded text-white text-center"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">PP</label>
                        <input
                          type="number"
                          min={0}
                          value={walletForm.pp || ''}
                          onChange={(e) => updateWalletForm({ pp: parseInt(e.target.value) || 0 })}
                          className="w-full p-2 bg-gray-700 rounded text-white text-center"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          const wallet = char.wallet || { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };
                          const newWallet = {
                            platinum: (wallet.platinum || 0) + (walletForm.pp || 0),
                            gold: (wallet.gold || 0) + (walletForm.gp || 0),
                            electrum: (wallet.electrum || 0) + (walletForm.ep || 0),
                            silver: (wallet.silver || 0) + (walletForm.sp || 0),
                            copper: (wallet.copper || 0) + (walletForm.cp || 0)
                          };
                          const newMoneyGP = (newWallet.platinum * 10) + newWallet.gold + (newWallet.electrum * 5) + (newWallet.silver * 0.1) + (newWallet.copper * 0.01);
                          
                          const addedGP = ((walletForm.pp || 0) * 10) + (walletForm.gp || 0) + ((walletForm.ep || 0) * 5) + ((walletForm.sp || 0) * 0.1) + ((walletForm.cp || 0) * 0.01);
                          if (addedGP > 0) {
                            updateChar({ wallet: newWallet, moneyGP: Math.round(newMoneyGP * 100) / 100 });
                            showToast(`Added ${addedGP.toFixed(2)} GP worth`, 'success');
                          }
                          resetWalletForm();
                        }}
                        className="py-3 bg-green-600 rounded hover:bg-green-700 font-semibold"
                      >
                        Add
                      </button>

                      <button
                        onClick={() => {
                          const wallet = char.wallet || { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };
                          const spendPP = walletForm.pp || 0;
                          const spendGP = walletForm.gp || 0;
                          const spendEP = walletForm.ep || 0;
                          const spendSP = walletForm.sp || 0;
                          const spendCP = walletForm.cp || 0;
                          
                          // Calculate total cost in copper (smallest unit) for precision
                          const costInCopper = (spendPP * 1000) + (spendEP * 500) + (spendGP * 100) + (spendSP * 10) + spendCP;
                          
                          // Calculate total wallet value in copper
                          const walletInCopper = ((wallet.platinum || 0) * 1000) + ((wallet.electrum || 0) * 500) + 
                                                ((wallet.gold || 0) * 100) + ((wallet.silver || 0) * 10) + (wallet.copper || 0);
                          
                          if (costInCopper > walletInCopper) {
                            showToast('Not enough money!', 'error');
                            return;
                          }
                          
                          if (costInCopper === 0) {
                            return;
                          }
                          
                          // Start with current wallet and deduct, giving change as needed
                          let newWallet = { ...wallet };
                          let remainingCost = costInCopper;
                          
                          // Try to pay with exact coins first, then break larger coins
                          // Pay with copper
                          const cpToPay = Math.min(newWallet.copper || 0, Math.ceil(remainingCost));
                          newWallet.copper = (newWallet.copper || 0) - cpToPay;
                          remainingCost -= cpToPay;
                          
                          // Pay with silver (1 SP = 10 CP)
                          if (remainingCost > 0) {
                            const spNeeded = Math.ceil(remainingCost / 10);
                            const spToPay = Math.min(newWallet.silver || 0, spNeeded);
                            newWallet.silver = (newWallet.silver || 0) - spToPay;
                            const spValue = spToPay * 10;
                            if (spValue > remainingCost) {
                              // Give change in copper
                              newWallet.copper = (newWallet.copper || 0) + (spValue - remainingCost);
                              remainingCost = 0;
                            } else {
                              remainingCost -= spValue;
                            }
                          }
                          
                          // Pay with gold (1 GP = 100 CP)
                          if (remainingCost > 0) {
                            const gpNeeded = Math.ceil(remainingCost / 100);
                            const gpToPay = Math.min(newWallet.gold || 0, gpNeeded);
                            newWallet.gold = (newWallet.gold || 0) - gpToPay;
                            const gpValue = gpToPay * 100;
                            if (gpValue > remainingCost) {
                              // Give change - prefer silver over copper
                              let change = gpValue - remainingCost;
                              const changeInSP = Math.floor(change / 10);
                              newWallet.silver = (newWallet.silver || 0) + changeInSP;
                              change -= changeInSP * 10;
                              newWallet.copper = (newWallet.copper || 0) + change;
                              remainingCost = 0;
                            } else {
                              remainingCost -= gpValue;
                            }
                          }
                          
                          // Pay with electrum (1 EP = 500 CP = 5 GP)
                          if (remainingCost > 0) {
                            const epNeeded = Math.ceil(remainingCost / 500);
                            const epToPay = Math.min(newWallet.electrum || 0, epNeeded);
                            newWallet.electrum = (newWallet.electrum || 0) - epToPay;
                            const epValue = epToPay * 500;
                            if (epValue > remainingCost) {
                              // Give change - prefer gold, then silver, then copper
                              let change = epValue - remainingCost;
                              const changeInGP = Math.floor(change / 100);
                              newWallet.gold = (newWallet.gold || 0) + changeInGP;
                              change -= changeInGP * 100;
                              const changeInSP = Math.floor(change / 10);
                              newWallet.silver = (newWallet.silver || 0) + changeInSP;
                              change -= changeInSP * 10;
                              newWallet.copper = (newWallet.copper || 0) + change;
                              remainingCost = 0;
                            } else {
                              remainingCost -= epValue;
                            }
                          }
                          
                          // Pay with platinum (1 PP = 1000 CP = 10 GP)
                          if (remainingCost > 0) {
                            const ppNeeded = Math.ceil(remainingCost / 1000);
                            const ppToPay = Math.min(newWallet.platinum || 0, ppNeeded);
                            newWallet.platinum = (newWallet.platinum || 0) - ppToPay;
                            const ppValue = ppToPay * 1000;
                            if (ppValue > remainingCost) {
                              // Give change - prefer gold, then silver, then copper
                              let change = ppValue - remainingCost;
                              const changeInGP = Math.floor(change / 100);
                              newWallet.gold = (newWallet.gold || 0) + changeInGP;
                              change -= changeInGP * 100;
                              const changeInSP = Math.floor(change / 10);
                              newWallet.silver = (newWallet.silver || 0) + changeInSP;
                              change -= changeInSP * 10;
                              newWallet.copper = (newWallet.copper || 0) + change;
                              remainingCost = 0;
                            } else {
                              remainingCost -= ppValue;
                            }
                          }
                          
                          const newMoneyGP = (newWallet.platinum * 10) + (newWallet.electrum * 5) + newWallet.gold + (newWallet.silver * 0.1) + (newWallet.copper * 0.01);
                          
                          const spentGP = costInCopper / 100;
                          updateChar({ wallet: newWallet, moneyGP: Math.round(newMoneyGP * 100) / 100 });
                          showToast(`Spent ${spentGP.toFixed(2)} GP worth`, 'success');
                          resetWalletForm();
                        }}
                        className="py-3 bg-red-600 rounded hover:bg-red-700 font-semibold"
                      >
                        Spend
                      </button>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-2 text-center">
                      Conversion: 100 CP = 10 SP = 1 GP • 5 GP = 1 EP • 2 EP = 1 PP (10 GP)
                    </div>
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
                        type="text"
                        inputMode="numeric"
                        value={itemForm.quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Allow empty or any positive integer digits
                          if (val === '' || /^\d+$/.test(val)) {
                            updateItemForm({ quantity: val });
                          }
                        }}
                        placeholder="1"
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Weight Per Item (lb)</label>
                      <input
                        type="text"
                        inputMode="text"
                        value={itemForm.weightPer}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Allow empty, negative sign, digits, and decimal point
                          if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) {
                            updateItemForm({ weightPer: val });
                          }
                        }}
                        placeholder="0"
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
</div>
                  

                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">Worth</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={itemForm.worth === 0 ? '' : itemForm.worth}
                        onChange={(e) => updateItemForm({ worth: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                        className="flex-1 p-2 bg-gray-700 rounded text-white"
                        placeholder="0"
                      />
                      <select
                        value={itemForm.worthUnit}
                        onChange={(e) => updateItemForm({ worthUnit: e.target.value })}
                        className="w-24 p-2 bg-gray-700 rounded text-white"
                      >
                        <option value="cp">CP</option>
                        <option value="sp">SP</option>
                        <option value="gp">GP</option>
                        <option value="ep">EP</option>
                        <option value="pp">PP</option>
                      </select>
                    </div>
                  </div>

                  <label className="block text-sm text-gray-400 mb-1">Encumbrance Value (EV)</label>
                  <input
                    type="text"
                    inputMode="text"
                    value={itemForm.ev}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow empty, negative sign, digits, and decimal point
                      if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) {
                        updateItemForm({ ev: val });
                      }
                    }}
                    placeholder="0"
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                  />

                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* Show all options normally, but only Magic Casting when from Magic Inventory */}
                    {!editModal.fromMagicInventory && (
                      <>
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
                      </>
                    )}

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
                        disabled={editModal.fromMagicInventory}
                      />
                      Magic Casting {editModal.fromMagicInventory && <span className="text-gray-500">(required)</span>}
                    </label>

                    {!editModal.fromMagicInventory && (
                      <>
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

                        <label className="flex items-center gap-2 text-sm text-gray-200">
                          <input
                            type="checkbox"
                            checked={itemIsAmmo}
                            onChange={(e) => setItemIsAmmo(e.target.checked)}
                            className="w-4 h-4"
                          />
                          Ammo
                        </label>

                        <label className="flex items-center gap-2 text-sm text-gray-200">
                          <input
                            type="checkbox"
                            checked={itemIsPotion}
                            onChange={(e) => setItemIsPotion(e.target.checked)}
                            className="w-4 h-4"
                          />
                          Potion
                        </label>

                        <label className="flex items-center gap-2 text-sm text-gray-200">
                          <input
                            type="checkbox"
                            checked={itemIsGem}
                            onChange={(e) => setItemIsGem(e.target.checked)}
                            className="w-4 h-4"
                          />
                          Gem
                        </label>

                        <label className="flex items-center gap-2 text-sm text-gray-200">
                          <input
                            type="checkbox"
                            checked={itemIsContainer}
                            onChange={(e) => setItemIsContainer(e.target.checked)}
                            className="w-4 h-4"
                          />
                          Container (Backpack/Pouch)
                        </label>
                      </>
                    )}
                  </div>

                  {/* Container Settings */}
                  {itemIsContainer && (
                    <div className="bg-gray-900 border border-gray-700 rounded p-3 mb-3">
                      <div className="font-bold text-gray-200 mb-2">Container Settings</div>
                      
                      <label className="flex items-center gap-2 text-sm text-gray-200 mb-3">
                        <input
                          type="checkbox"
                          checked={itemIsMagicalContainer}
                          onChange={(e) => setItemIsMagicalContainer(e.target.checked)}
                          className="w-4 h-4"
                        />
                        Magical Container (contents weight doesn't count)
                      </label>

                      {!itemIsMagicalContainer ? (
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Capacity (max items)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={itemContainerCapacity}
                            onChange={(e) => setItemContainerCapacity(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="8"
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            Items with EV less than capacity can be stored. E.g., capacity 8 holds items with EV ≤ 7.
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Max Weight (lbs)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={itemContainerMaxWeight}
                            onChange={(e) => setItemContainerMaxWeight(e.target.value.replace(/[^0-9.]/g, ''))}
                            placeholder="140"
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            Items can be stored if their weight fits. Use common sense for physical size.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stored In Container dropdown - always show for non-containers */}
                  {!itemIsContainer && (() => {
                    const currentItem = editModal.item || { 
                      id: 0, 
                      ev: parseFloat(itemForm.ev) || 0, 
                      weightPer: parseFloat(itemForm.weightPer) || 0,
                      quantity: parseInt(itemForm.quantity) || 1
                    };
                    const availableContainers = getAvailableContainers(currentItem as InventoryItem);
                    const currentContainer = (char?.inventory || []).find(c => c.id === itemStoredInId);
                    const allContainers = (char?.inventory || []).filter(c => c.isContainer && c.id !== currentItem.id);
                    
                    return (
                      <div className="mb-3">
                        <label className="block text-sm text-gray-400 mb-1">Stored In</label>
                        <select
                          value={itemStoredInId || ''}
                          onChange={(e) => setItemStoredInId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full p-2 bg-gray-700 rounded text-white"
                        >
                          <option value="">Not in a container</option>
                          {availableContainers.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.isMagical 
                                ? `(${c.info.totalWeight.toFixed(1)}/${c.info.maxWeight || '∞'} lbs)`
                                : `(${c.info.slotCount}/${c.info.capacity} slots)`
                              }
                            </option>
                          ))}
                          {/* Show current container even if it wouldn't normally be available (e.g., now full) */}
                          {currentContainer && !availableContainers.some(c => c.id === currentContainer.id) && (
                            <option key={currentContainer.id} value={currentContainer.id}>
                              {currentContainer.name} (current)
                            </option>
                          )}
                        </select>
                        <div className="text-xs text-gray-500 mt-1">
                          {allContainers.length === 0 
                            ? "No containers in inventory. Create a container item first."
                            : availableContainers.length === 0 && !currentContainer
                              ? "No containers can hold this item (too heavy or high EV)."
                              : `Items in containers don't count toward EV.${itemStoredInId && currentContainer?.isMagicalContainer ? " Weight also doesn't count (magical)." : ""}`
                          }
                        </div>
                      </div>
                    );
                  })()}

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
                        type="text" inputMode="numeric"
                        value={itemForm.acBonus === 0 ? '' : itemForm.acBonus}
                        onChange={(e) => updateItemForm({ acBonus: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                        placeholder="0"
                      />
                      <div className="text-xs text-gray-400 mt-1">
                        Base AC bonus from the armor/shield.
                      </div>
                    </div>
                  )}
                  
                  {(itemIsArmor || itemIsShield) && (
                    <div className="mb-3">
                      <label className="block text-sm text-gray-400 mb-1">Magic AC Bonus</label>
                      <input
                        type="text" inputMode="numeric"
                        value={itemForm.magicACBonus === 0 ? '' : itemForm.magicACBonus}
                        onChange={(e) => updateItemForm({ magicACBonus: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                        placeholder="0"
                      />
                      <div className="text-xs text-gray-400 mt-1">
                        Magic enhancement bonus (e.g., +1, +2, +3 for magical armor/shields).
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
                            type="text" inputMode="numeric"
                            min="1"
                            value={itemWeaponDamageNumDice}
                            onChange={(e) => setItemWeaponDamageNumDice(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                            placeholder="1"
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
                      
                      {/* Extra Damage Dice (e.g., on failed save) */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-gray-400">Extra Damage Dice</label>
                          <button
                            type="button"
                            onClick={() => {
                              setItemWeaponExtraDice([...itemWeaponExtraDice, { numDice: 1, dieType: 4, label: 'On failed save' }]);
                            }}
                            className="px-2 py-1 text-xs bg-green-600 rounded hover:bg-green-700"
                          >
                            + Add Extra Dice
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">For conditional damage (e.g., poison on failed save)</div>
                        
                        {itemWeaponExtraDice.length > 0 && (
                          <div className="space-y-2">
                            {itemWeaponExtraDice.map((extra, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-gray-800 p-2 rounded">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={extra.numDice}
                                  onChange={(e) => {
                                    const updated = [...itemWeaponExtraDice];
                                    updated[idx] = { ...updated[idx], numDice: parseInt(e.target.value) || 1 };
                                    setItemWeaponExtraDice(updated);
                                  }}
                                  className="w-12 p-1 bg-gray-700 rounded text-white text-center text-sm"
                                  placeholder="1"
                                />
                                <select
                                  value={extra.dieType}
                                  onChange={(e) => {
                                    const updated = [...itemWeaponExtraDice];
                                    updated[idx] = { ...updated[idx], dieType: parseInt(e.target.value) || 4 };
                                    setItemWeaponExtraDice(updated);
                                  }}
                                  className="w-16 p-1 bg-gray-700 rounded text-white text-sm"
                                >
                                  {[2,3,4,6,8,10,12].map((d) => (
                                    <option key={d} value={d}>d{d}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={extra.label || ''}
                                  onChange={(e) => {
                                    const updated = [...itemWeaponExtraDice];
                                    updated[idx] = { ...updated[idx], label: e.target.value };
                                    setItemWeaponExtraDice(updated);
                                  }}
                                  className="flex-1 p-1 bg-gray-700 rounded text-white text-sm"
                                  placeholder="Label (e.g., On failed save)"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setItemWeaponExtraDice(itemWeaponExtraDice.filter((_, i) => i !== idx));
                                  }}
                                  className="p-1 bg-red-600 rounded hover:bg-red-700"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
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
                            type="text" inputMode="numeric"
                            value={itemWeaponToHitMagic}
                            onChange={(e) => setItemWeaponToHitMagic(e.target.value.replace(/[^0-9-]/g, ''))}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">To Hit: Misc</label>
                          <input
                            type="text" inputMode="numeric"
                            value={itemWeaponToHitMisc}
                            onChange={(e) => setItemWeaponToHitMisc(e.target.value.replace(/[^0-9-]/g, ''))}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Damage: Magic</label>
                          <input
                            type="text" inputMode="numeric"
                            value={itemWeaponDamageMagic}
                            onChange={(e) => setItemWeaponDamageMagic(e.target.value.replace(/[^0-9-]/g, ''))}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Damage: Misc</label>
                          <input
                            type="text" inputMode="numeric"
                            value={itemWeaponDamageMisc}
                            onChange={(e) => setItemWeaponDamageMisc(e.target.value.replace(/[^0-9-]/g, ''))}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                            placeholder="0"
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
                              type="text" inputMode="numeric"
                              value={newEffectMiscToHit}
                              onChange={(e) => setNewEffectMiscToHit(e.target.value.replace(/[^0-9-]/g, ''))}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Misc Damage</label>
                            <input
                              type="text" inputMode="numeric"
                              value={newEffectMiscDamage}
                              onChange={(e) => setNewEffectMiscDamage(e.target.value.replace(/[^0-9-]/g, ''))}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Magic To Hit</label>
                            <input
                              type="text" inputMode="numeric"
                              value={newEffectMagicToHit}
                              onChange={(e) => setNewEffectMagicToHit(e.target.value.replace(/[^0-9-]/g, ''))}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Magic Damage</label>
                            <input
                              type="text" inputMode="numeric"
                              value={newEffectMagicDamage}
                              onChange={(e) => setNewEffectMagicDamage(e.target.value.replace(/[^0-9-]/g, ''))}
                              className="w-full p-2 bg-gray-700 rounded text-white"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3">
                          <label className="block text-xs text-gray-400 mb-1">AC</label>
                          <input
                            type="text" inputMode="numeric"
                            value={newEffectAC}
                            onChange={(e) => setNewEffectAC(e.target.value.replace(/[^0-9-]/g, ''))}
                            className="w-full p-2 bg-gray-700 rounded text-white"
                            placeholder="0"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => {
                          const kind = 'attack';
                          const eff = {
                            id: String(Date.now()) + '-' + Math.random().toString(16).slice(2),
                            kind,
                            miscToHit: kind === 'attack' ? (parseInt(newEffectMiscToHit, 10) || 0) : 0,
                            miscDamage: kind === 'attack' ? (parseInt(newEffectMiscDamage, 10) || 0) : 0,
                            magicToHit: kind === 'attack' ? (parseInt(newEffectMagicToHit, 10) || 0) : 0,
                            magicDamage: kind === 'attack' ? (parseInt(newEffectMagicDamage, 10) || 0) : 0,
                            ac: kind === 'ac' ? (parseInt(newEffectAC, 10) || 0) : 0
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
                        quantity: parseInt(itemForm.quantity) || 1,  // Parse string to number, default 1
                        weightPer: parseFloat(itemForm.weightPer) || 0,
                        ev: parseFloat(itemForm.ev) || 0,
                        worthAmount: itemForm.worth || null,
                        worthUnit: itemForm.worthUnit,
                        effects: itemHasEffects ? (Array.isArray(itemEffects) ? itemEffects : []) : [],
                        isArmor: !!itemIsArmor,
                        isShield: !!itemIsShield,
                        isWeapon: !!itemIsWeapon,
                        isAmmo: !!itemIsAmmo,
                        isPotion: !!itemIsPotion,
                        isGem: !!itemIsGem,
                        // Container fields
                        isContainer: !!itemIsContainer,
                        containerCapacity: itemIsContainer && !itemIsMagicalContainer ? (Number(itemContainerCapacity) || 0) : 0,
                        isMagicalContainer: itemIsContainer ? !!itemIsMagicalContainer : false,
                        containerMaxWeight: itemIsContainer && itemIsMagicalContainer ? (Number(itemContainerMaxWeight) || 0) : 0,
                        storedInId: null as number | null,  // Will be set below after capacity check
                        weaponType: itemIsWeapon ? ((itemWeaponRanged && !itemWeaponMelee) ? 'ranged' : 'melee') : undefined,
                        weaponMelee: itemIsWeapon ? !!itemWeaponMelee : false,
                        weaponRanged: itemIsWeapon ? !!itemWeaponRanged : false,
                        weaponToHitMagic: itemIsWeapon ? (Number(itemWeaponToHitMagic) || 0) : 0,
                        weaponToHitMisc: itemIsWeapon ? (Number(itemWeaponToHitMisc) || 0) : 0,
                        weaponDamageMagic: itemIsWeapon ? (Number(itemWeaponDamageMagic) || 0) : 0,
                        weaponDamageMisc: itemIsWeapon ? (Number(itemWeaponDamageMisc) || 0) : 0,
                        weaponDamageNumDice: itemIsWeapon ? (Number(itemWeaponDamageNumDice) || 1) : 1,
                        weaponDamageDieType: itemIsWeapon ? (Number(itemWeaponDamageDieType) || 8) : 8,
                        weaponExtraDice: itemIsWeapon ? (Array.isArray(itemWeaponExtraDice) ? itemWeaponExtraDice : []) : [],
                        acBonus: (itemIsArmor || itemIsShield) ? itemForm.acBonus : 0,
                        magicACBonus: (itemIsArmor || itemIsShield) ? itemForm.magicACBonus : 0,
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
                      
                      // Handle container capacity enforcement
                      let splitItem = null;
                      if (!itemIsContainer && itemStoredInId) {
                        const targetContainer = char.inventory.find(c => c.id === itemStoredInId);
                        if (targetContainer && targetContainer.isContainer && !targetContainer.isMagicalContainer) {
                          const capacity = Number(targetContainer.containerCapacity) || 0;
                          if (capacity > 0) {
                            // Get container info (excluding this item if editing)
                            const otherItems = (char.inventory || []).filter(it => 
                              it.storedInId === itemStoredInId && it.id !== newItem.id
                            );
                            
                            // Calculate current slots used by other items
                            let otherNormalSlots = 0;
                            let otherZeroEVCount = 0;
                            otherItems.forEach(it => {
                              const qty = Number(it.quantity) || 1;
                              const ev = Number(it.ev) || 0;
                              if (ev > 0) {
                                otherNormalSlots += qty;
                              } else {
                                otherZeroEVCount += qty;
                              }
                            });
                            const otherZeroEVSlots = Math.ceil(otherZeroEVCount / 10);
                            const currentSlots = otherNormalSlots + otherZeroEVSlots;
                            const slotsAvailable = Math.max(0, capacity - currentSlots);
                            
                            const newItemEV = Number(newItem.ev) || 0;
                            const newItemQty = Number(newItem.quantity) || 1;
                            
                            if (newItemEV > 0) {
                              // Normal item: each takes 1 slot
                              if (newItemQty > slotsAvailable) {
                                if (slotsAvailable > 0) {
                                  // Split: put slotsAvailable in container, rest stays out
                                  splitItem = { ...newItem, id: Date.now(), quantity: newItemQty - slotsAvailable, storedInId: null };
                                  newItem.quantity = slotsAvailable;
                                  newItem.storedInId = itemStoredInId;
                                } else {
                                  // No room at all
                                  showToast(`Container is full (${currentSlots}/${capacity} slots)`, 'warning');
                                  newItem.storedInId = null;
                                }
                              } else {
                                newItem.storedInId = itemStoredInId;
                              }
                            } else {
                              // Zero-EV item: 10 = 1 slot
                              const maxZeroEVSlots = slotsAvailable;
                              const maxZeroEVItems = maxZeroEVSlots * 10 + (10 - (otherZeroEVCount % 10)) % 10;
                              
                              if (newItemQty > maxZeroEVItems && maxZeroEVItems > 0) {
                                // Split
                                splitItem = { ...newItem, id: Date.now(), quantity: newItemQty - maxZeroEVItems, storedInId: null };
                                newItem.quantity = maxZeroEVItems;
                                newItem.storedInId = itemStoredInId;
                              } else if (maxZeroEVItems === 0) {
                                showToast(`Container is full (${currentSlots}/${capacity} slots)`, 'warning');
                                newItem.storedInId = null;
                              } else {
                                newItem.storedInId = itemStoredInId;
                              }
                            }
                          } else {
                            newItem.storedInId = itemStoredInId;
                          }
                        } else if (targetContainer && targetContainer.isMagicalContainer) {
                          // Magical container: check weight
                          const maxWeight = Number(targetContainer.containerMaxWeight) || Infinity;
                          const info = getContainerInfo(itemStoredInId);
                          const itemWeight = (Number(newItem.weightPer) || 0) * (Number(newItem.quantity) || 1);
                          const weightUsedByOthers = info.totalWeight - ((editModal.item?.storedInId === itemStoredInId) 
                            ? (Number(editModal.item.weightPer) || 0) * (Number(editModal.item.quantity) || 1) : 0);
                          
                          if (weightUsedByOthers + itemWeight <= maxWeight) {
                            newItem.storedInId = itemStoredInId;
                          } else {
                            showToast(`Container weight limit exceeded`, 'warning');
                            newItem.storedInId = null;
                          }
                        } else {
                          newItem.storedInId = itemStoredInId;
                        }
                      }
                      
                      // If this item was a container and is being deleted/changed, clear storedInId from items inside
                      let newInv = editModal.type === 'newItem' ? 
                        [...char.inventory, newItem] :
                        char.inventory.map(i => i.id === newItem.id ? newItem : i);
                      
                      // Add split item if we had to split
                      if (splitItem) {
                        newInv = [...newInv, splitItem];
                        showToast(`Split: ${newItem.quantity} in container, ${splitItem.quantity} outside`, 'info');
                      }
                      
                      // If container was removed, clear items that were stored in it
                      if (editModal.type === 'editItem' && editModal.item?.isContainer && !newItem.isContainer) {
                        newInv = newInv.map(i => i.storedInId === newItem.id ? { ...i, storedInId: null } : i);
                      }
                      
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
                        const deletedItem = editModal.item;
                        
                        // If deleting a container, clear storedInId from items inside
                        let invFiltered = char.inventory.filter(i => i.id !== deletedItem.id);
                        if (deletedItem.isContainer) {
                          invFiltered = invFiltered.map(i => i.storedInId === deletedItem.id ? { ...i, storedInId: undefined } : i);
                        }
                        
                        // If deleting a magical container with coins, return coins to wallet
                        let newMoneyGP = char.moneyGP;
                        let newWallet = char.wallet || { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };
                        if (deletedItem.isContainer && deletedItem.isMagicalContainer) {
                          if (deletedItem.storedCoins) {
                            // Return individual coins
                            newWallet = {
                              platinum: (newWallet.platinum || 0) + (deletedItem.storedCoins.platinum || 0),
                              gold: (newWallet.gold || 0) + (deletedItem.storedCoins.gold || 0),
                              electrum: (newWallet.electrum || 0) + (deletedItem.storedCoins.electrum || 0),
                              silver: (newWallet.silver || 0) + (deletedItem.storedCoins.silver || 0),
                              copper: (newWallet.copper || 0) + (deletedItem.storedCoins.copper || 0)
                            };
                            newMoneyGP = (newWallet.platinum * 10) + (newWallet.electrum * 5) + newWallet.gold + 
                                        (newWallet.silver * 0.1) + (newWallet.copper * 0.01);
                          } else if (deletedItem.storedCoinsGP) {
                            // Legacy: return as gold
                            newWallet = { ...newWallet, gold: (newWallet.gold || 0) + Math.floor(Number(deletedItem.storedCoinsGP) || 0) };
                            newMoneyGP = char.moneyGP + (Number(deletedItem.storedCoinsGP) || 0);
                          }
                        }
                        
                        const miFiltered = (char.magicItems || []).filter(mi => String(mi.linkedInventoryItemId) !== String(deletedItem.id) && String(mi.id) !== `linked-${String(deletedItem.id)}`);
                        const linkedId = `inv-${String(deletedItem.id)}`;
                        const grimFiltered = (char.grimoires || []).filter(g => String(g.linkedInventoryItemId) !== String(deletedItem.id) && String(g.id) !== linkedId);
                        const speedFiltered = (char.equippedSpeedItemIds && Array.isArray(char.equippedSpeedItemIds))
                          ? char.equippedSpeedItemIds.filter(x => String(x) !== String(deletedItem.id))
                          : [];
                        updateChar({ inventory: invFiltered, magicItems: miFiltered, grimoires: grimFiltered, equippedSpeedItemIds: speedFiltered, moneyGP: newMoneyGP, wallet: newWallet });
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
                    type="text" inputMode="numeric"
                    value={modalForms.spellDC === 10 ? '' : modalForms.spellDC}
                    onChange={(e) => updateModalForm({ spellDC: e.target.value === '' ? 10 : (parseInt(e.target.value) || 10) })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                    placeholder="10"
                  />
                  <label className="block text-sm text-gray-400 mb-2">Spell Attack Bonus</label>
                  <input
                    type="text" inputMode="numeric"
                    value={modalForms.spellAtk === 0 ? '' : modalForms.spellAtk}
                    onChange={(e) => updateModalForm({ spellAtk: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                    className="w-full p-2 bg-gray-700 rounded text-white"
                    placeholder="0"
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
                    {spellSlotsForm.map((slots, level) => (
                      <div key={level} className="flex items-center gap-2">
                        <label className="w-32 text-sm font-bold">{level === 0 ? 'Cantrips' : `Level ${level}`}:</label>
                        <input
                          type="text" inputMode="numeric"
                          min="0"
                          value={slots === 0 ? '' : slots}
                          onChange={(e) => updateSpellSlotsForm(level, parseInt(e.target.value) || 0)}
                          className="flex-1 p-2 bg-gray-700 rounded text-white"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      updateChar({ spellSlots: spellSlotsForm });
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
                    type="text" inputMode="numeric"
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
                            let nextInv = (char.inventory || [])
                              .map(i =>
                                i.id === sellItem.id
                                  ? { ...i, quantity: Math.max(0, (i.quantity || 0) - 1) }
                                  : i
                              )
                              .filter(i => (i.quantity || 0) > 0);
                            
                            // If selling a container, clear storedInId from items inside
                            const itemDeleted = !nextInv.some(i => i.id === sellItem.id);
                            if (itemDeleted && sellItem.isContainer) {
                              nextInv = nextInv.map(i => i.storedInId === sellItem.id ? { ...i, storedInId: undefined } : i);
                            }
                            
                            // If selling a magical container with coins, return coins to wallet
                            let coinsReturned = 0;
                            let newWallet = char.wallet || { platinum: 0, gold: 0, electrum: 0, silver: 0, copper: 0 };
                            if (itemDeleted && sellItem.isContainer && sellItem.isMagicalContainer) {
                              if (sellItem.storedCoins) {
                                // Return individual coins
                                newWallet = {
                                  platinum: (newWallet.platinum || 0) + (sellItem.storedCoins.platinum || 0),
                                  gold: (newWallet.gold || 0) + (sellItem.storedCoins.gold || 0),
                                  electrum: (newWallet.electrum || 0) + (sellItem.storedCoins.electrum || 0),
                                  silver: (newWallet.silver || 0) + (sellItem.storedCoins.silver || 0),
                                  copper: (newWallet.copper || 0) + (sellItem.storedCoins.copper || 0)
                                };
                                coinsReturned = (sellItem.storedCoins.platinum * 10) + (sellItem.storedCoins.electrum * 5) + 
                                               sellItem.storedCoins.gold + (sellItem.storedCoins.silver * 0.1) + 
                                               (sellItem.storedCoins.copper * 0.01);
                              } else if (sellItem.storedCoinsGP) {
                                // Legacy: return as gold
                                newWallet = { ...newWallet, gold: (newWallet.gold || 0) + Math.floor(Number(sellItem.storedCoinsGP) || 0) };
                                coinsReturned = Number(sellItem.storedCoinsGP) || 0;
                              }
                            }

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
                              moneyGP: (Number(char.moneyGP) || 0) + worthGP + coinsReturned,
                              wallet: newWallet
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
                    type="text"
                    inputMode="numeric"
                    value={spellForm.level === 0 ? '' : spellForm.level}
                    onChange={(e) => updateSpellForm({ level: e.target.value === '' ? 0 : Math.min(9, Math.max(0, parseInt(e.target.value) || 0)) })}
                    placeholder="0"
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
                          type="text" inputMode="numeric"
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
                    {spellForm.hasDiceRoll && (
                      <>
                        <label className="block text-xs text-gray-400 mb-1">Dice Type</label>
                        <select
                          value={spellForm.diceType}
                          onChange={(e) => updateSpellForm({ diceType: e.target.value })}
                          className="w-full p-2 bg-gray-700 rounded text-white text-sm mb-2"
                        >
                          <option value="">Select dice...</option>
                          <option value="d2">d2</option>
                          <option value="d3">d3</option>
                          <option value="d4">d4</option>
                          <option value="d6">d6</option>
                          <option value="d8">d8</option>
                          <option value="d10">d10</option>
                          <option value="d12">d12</option>
                        </select>
                        
                        <label className="block text-xs text-gray-400 mb-1">Bonus Per Caster Level</label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-300">+</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={spellForm.perLevelBonus === 0 ? '' : spellForm.perLevelBonus}
                            onChange={(e) => updateSpellForm({ perLevelBonus: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0) })}
                            placeholder="0"
                            className="w-20 p-2 bg-gray-700 rounded text-white text-sm text-center"
                          />
                          <span className="text-sm text-gray-300">per level</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Example: 1 = +1 per level, so at level 5 you'd get +5 to the roll
                        </div>
                      </>
                    )}
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
                        perLevelBonus: spellForm.perLevelBonus,
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
                  {/* Mode Selection */}
                  <div className="flex gap-4 p-3 bg-gray-900 rounded">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="spellMode"
                        checked={modalForms.magicItemSpellMode === 'learned'}
                        onChange={() => updateModalForm({ magicItemSpellMode: 'learned' })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">From Spells Learned</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="spellMode"
                        checked={modalForms.magicItemSpellMode === 'itemOnly'}
                        onChange={() => updateModalForm({ magicItemSpellMode: 'itemOnly' })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Item Only (not learned)</span>
                    </label>
                  </div>

                  {/* From Spells Learned Mode */}
                  {modalForms.magicItemSpellMode === 'learned' && (
                    <>
                      <div className="text-sm text-gray-300">
                        Choose a spell from <span className="font-semibold">Spells Learned</span>, or add a new spell first.
                      </div>

                      <label className="block text-sm text-gray-400 mb-1">Choose Spell</label>
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
                    </>
                  )}

                  {/* Item Only Mode */}
                  {modalForms.magicItemSpellMode === 'itemOnly' && (
                    <div className="max-h-80 overflow-y-auto pr-2 space-y-3">
                      <div className="text-sm text-gray-300 bg-gray-900 p-2 rounded">
                        This spell will only exist in this item and won't be added to Spells Learned.
                      </div>

                      <label className="block text-sm text-gray-400 mb-1">Spell Name *</label>
                      <input
                        type="text"
                        value={modalForms.itemOnlySpellName}
                        onChange={(e) => updateModalForm({ itemOnlySpellName: e.target.value })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                        placeholder="e.g. Fireball"
                      />

                      <label className="block text-sm text-gray-400 mb-1">Spell Level (0-9)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={modalForms.itemOnlySpellLevel === 0 ? '' : modalForms.itemOnlySpellLevel}
                        onChange={(e) => updateModalForm({ itemOnlySpellLevel: e.target.value === '' ? 0 : Math.min(9, Math.max(0, parseInt(e.target.value) || 0)) })}
                        placeholder="0"
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />

                      <label className="block text-sm text-gray-400 mb-1">Description</label>
                      <textarea
                        value={modalForms.itemOnlySpellDescription}
                        onChange={(e) => updateModalForm({ itemOnlySpellDescription: e.target.value })}
                        className="w-full p-2 bg-gray-700 rounded text-white h-16"
                        placeholder="Spell effect..."
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Prep Time</label>
                          <input
                            type="text"
                            value={modalForms.itemOnlySpellPrepTime}
                            onChange={(e) => updateModalForm({ itemOnlySpellPrepTime: e.target.value })}
                            placeholder="e.g., 1 action"
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Range</label>
                          <input
                            type="text"
                            value={modalForms.itemOnlySpellRange}
                            onChange={(e) => updateModalForm({ itemOnlySpellRange: e.target.value })}
                            placeholder="e.g., 60 ft"
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Duration</label>
                          <input
                            type="text"
                            value={modalForms.itemOnlySpellDuration}
                            onChange={(e) => updateModalForm({ itemOnlySpellDuration: e.target.value })}
                            placeholder="e.g., Instantaneous"
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Area of Effect</label>
                          <input
                            type="text"
                            value={modalForms.itemOnlySpellAoe}
                            onChange={(e) => updateModalForm({ itemOnlySpellAoe: e.target.value })}
                            placeholder="e.g., 30 ft radius"
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Saving Throw</label>
                        <input
                          type="text"
                          value={modalForms.itemOnlySpellSavingThrow}
                          onChange={(e) => updateModalForm({ itemOnlySpellSavingThrow: e.target.value })}
                          placeholder="e.g., Dex half"
                          className="w-full p-2 bg-gray-700 rounded text-white"
                        />
                      </div>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={modalForms.itemOnlySpellResistance}
                          onChange={(e) => updateModalForm({ itemOnlySpellResistance: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-bold">Spell Resistance</span>
                      </label>

                      <div className="p-3 bg-gray-900 rounded space-y-2">
                        <div className="font-bold text-sm">Dice Roll</div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={modalForms.itemOnlySpellHasDice}
                            onChange={(e) => updateModalForm({ itemOnlySpellHasDice: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Has Dice Roll</span>
                        </label>
                        {modalForms.itemOnlySpellHasDice && (
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Dice Type</label>
                            <select
                              value={modalForms.itemOnlySpellDiceType}
                              onChange={(e) => updateModalForm({ itemOnlySpellDiceType: e.target.value })}
                              className="w-full p-2 bg-gray-700 rounded text-white text-sm"
                            >
                              <option value="">Select dice...</option>
                              <option value="d3">d3</option>
                              <option value="d4">d4</option>
                              <option value="d6">d6</option>
                              <option value="d8">d8</option>
                              <option value="d10">d10</option>
                              <option value="d12">d12</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-gray-900 rounded space-y-2">
                        <div className="font-bold text-sm">Components</div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={modalForms.itemOnlySpellVerbal}
                            onChange={(e) => updateModalForm({ itemOnlySpellVerbal: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Verbal (V)</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={modalForms.itemOnlySpellSomatic}
                            onChange={(e) => updateModalForm({ itemOnlySpellSomatic: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Somatic (S)</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={modalForms.itemOnlySpellMaterial}
                            onChange={(e) => updateModalForm({ itemOnlySpellMaterial: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">Material (M)</span>
                        </label>
                        {modalForms.itemOnlySpellMaterial && (
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Material Description</label>
                            <input
                              type="text"
                              value={modalForms.itemOnlySpellMaterialDesc}
                              onChange={(e) => updateModalForm({ itemOnlySpellMaterialDesc: e.target.value })}
                              placeholder="e.g., a bit of bat fur"
                              className="w-full p-2 bg-gray-700 rounded text-white text-sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Common fields: Copies and Permanent */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Copies</label>
                      <input
                        type="text" inputMode="numeric"
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
                        if (modalForms.magicItemSpellMode === 'learned') {
                          // Add from Spells Learned
                          const sel = modalForms.magicItemSpellSelect.trim();
                          const spell = (char.spellsLearned || []).find((x) => x.name === sel);
                          if (!spell) {
                            showToast('Please select a spell from Spells Learned', 'error');
                            return;
                          }
                          addSpellEntriesToMagicItem(editModal.itemId, { ...spell }, modalForms.magicItemSpellCopies, modalForms.magicItemSpellPermanent);
                        } else {
                          // Add item-only spell with full details
                          const name = modalForms.itemOnlySpellName.trim();
                          if (!name) {
                            showToast('Please enter a spell name', 'error');
                            return;
                          }
                          const itemOnlySpell = {
                            id: `itemonly-${Date.now()}`,
                            name,
                            level: modalForms.itemOnlySpellLevel,
                            description: modalForms.itemOnlySpellDescription,
                            prepTime: modalForms.itemOnlySpellPrepTime,
                            range: modalForms.itemOnlySpellRange,
                            duration: modalForms.itemOnlySpellDuration,
                            aoe: modalForms.itemOnlySpellAoe,
                            savingThrow: modalForms.itemOnlySpellSavingThrow,
                            spellResistance: modalForms.itemOnlySpellResistance,
                            hasDiceRoll: modalForms.itemOnlySpellHasDice,
                            diceType: modalForms.itemOnlySpellDiceType,
                            verbal: modalForms.itemOnlySpellVerbal,
                            somatic: modalForms.itemOnlySpellSomatic,
                            material: modalForms.itemOnlySpellMaterial,
                            materialDesc: modalForms.itemOnlySpellMaterialDesc,
                            isItemOnly: true, // Mark as item-only
                          };
                          addSpellEntriesToMagicItem(editModal.itemId, itemOnlySpell, modalForms.magicItemSpellCopies, modalForms.magicItemSpellPermanent);
                        }
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
                              type="text" inputMode="numeric"
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
                          type="text" inputMode="numeric"
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
                          {miSpellForm.hasDiceRoll && (
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">Dice Type</label>
                              <select
                                value={miSpellForm.diceType}
                                onChange={(e) => updateMiSpellForm({ diceType: e.target.value })}
                                className="w-full p-2 bg-gray-700 rounded text-white"
                              >
                                <option value="">Select dice...</option>
                                <option value="d3">d3</option>
                                <option value="d4">d4</option>
                                <option value="d6">d6</option>
                                <option value="d8">d8</option>
                                <option value="d10">d10</option>
                                <option value="d12">d12</option>
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="p-3 bg-gray-900 rounded space-y-2">
                          <div className="font-bold text-sm">Components</div>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={miSpellForm.verbal}
                              onChange={(e) => updateMiSpellForm({ verbal: e.target.checked })}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Verbal (V)</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={miSpellForm.somatic}
                              onChange={(e) => updateMiSpellForm({ somatic: e.target.checked })}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Somatic (S)</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={miSpellForm.material}
                              onChange={(e) => updateMiSpellForm({ material: e.target.checked })}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">Material (M)</span>
                          </label>
                          {miSpellForm.material && (
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Material Description</label>
                              <input
                                type="text"
                                value={miSpellForm.materialDesc}
                                onChange={(e) => updateMiSpellForm({ materialDesc: e.target.value })}
                                placeholder="e.g., a bit of bat fur"
                                className="w-full p-2 bg-gray-700 rounded text-white text-sm"
                              />
                            </div>
                          )}
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
                                verbal: miSpellForm.verbal,
                                somatic: miSpellForm.somatic,
                                material: miSpellForm.material,
                                materialDesc: miSpellForm.materialDesc,
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
                            if (!spellId) { showToast('Select a spell.', 'warning'); return; }
                            const spell = (char.spellsLearned || []).find(s => s.id === spellId);
                            if (!spell) { showToast('Spell not found.', 'error'); return; }
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
                        type="text"
                        inputMode="numeric"
                        value={companionForm.hp === 0 ? '' : companionForm.hp}
                        onChange={(e) => updateCompanionForm({ hp: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                        placeholder="10"
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Max HP</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={companionForm.maxHp === 0 ? '' : companionForm.maxHp}
                        onChange={(e) => updateCompanionForm({ maxHp: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                        placeholder="10"
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">AC</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={companionForm.ac === 0 ? '' : companionForm.ac}
                        onChange={(e) => updateCompanionForm({ ac: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                        placeholder="10"
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Ground Speed (ft)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={companionForm.groundSpeed === 0 ? '' : companionForm.groundSpeed}
                        onChange={(e) => updateCompanionForm({ groundSpeed: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                        placeholder="30"
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                  </div>
                  
                  <label className="block text-sm text-gray-400 mb-1">Flying Speed (ft, 0 if none)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={companionForm.flySpeed === 0 ? '' : companionForm.flySpeed}
                    onChange={(e) => updateCompanionForm({ flySpeed: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                    placeholder="0"
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
                            type="text"
                            inputMode="numeric"
                            value={companionForm[field] === 0 ? '' : companionForm[field]}
                            onChange={(e) => updateCompanionForm({ [field]: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                            placeholder="0"
                            className="w-full p-2 bg-gray-700 rounded text-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleSaveCompanion}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                  >
                    Save Companion
                  </button>

                  {editModal.type === 'editCompanion' && (
                    <button
                      onClick={handleDeleteCompanion}
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
                        type="text" inputMode="numeric"
                        min={0}
                        value={compAttackForm.numDice}
                        onChange={(e) => updateCompAttackForm({ numDice: e.target.value === '' ? '' : (parseInt(e.target.value) || 1) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Dice Type</label>
                      <select
                        value={compAttackForm.dieType}
                        onChange={(e) => updateCompAttackForm({ dieType: parseInt(e.target.value) || 6 })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      >
                        {[2, 3, 4, 6, 8, 10, 12].map(d => (
                          <option key={d} value={d}>d{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">BTH (Base To Hit)</label>
                      <input
                        type="text" inputMode="numeric"
                        value={compAttackForm.bth}
                        onChange={(e) => updateCompAttackForm({ bth: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Modifier</label>
                      <input
                        type="text" inputMode="numeric"
                        value={compAttackForm.mod}
                        onChange={(e) => updateCompAttackForm({ mod: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">To-Hit Magic</label>
                      <input
                        type="text" inputMode="numeric"
                        value={compAttackForm.toHitMagic}
                        onChange={(e) => updateCompAttackForm({ toHitMagic: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">To-Hit Misc</label>
                      <input
                        type="text" inputMode="numeric"
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
                    type="text" inputMode="numeric"
                    value={compAttackForm.damageBonus}
                    onChange={(e) => updateCompAttackForm({ damageBonus: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                    className="w-full p-2 bg-gray-700 rounded text-white mb-3"
                  />

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Damage Magic</label>
                      <input
                        type="text" inputMode="numeric"
                        value={compAttackForm.damageMagic}
                        onChange={(e) => updateCompAttackForm({ damageMagic: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Damage Misc</label>
                      <input
                        type="text" inputMode="numeric"
                        value={compAttackForm.damageMisc}
                        onChange={(e) => updateCompAttackForm({ damageMisc: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
                        className="w-full p-2 bg-gray-700 rounded text-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveCompanionAttack}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                  >
                    Save Attack
                  </button>

                  {editModal.type === 'editCompanionAttack' && (
                    <button
                      onClick={handleDeleteCompanionAttack}
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
                            type="text"
                            inputMode="numeric"
                            value={attackForm.numDice === 0 ? '' : attackForm.numDice}
                            onChange={(e) => updateAttackForm({ numDice: e.target.value === '' ? 1 : Math.max(1, parseInt(e.target.value) || 1) })}
                            placeholder="1"
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
                      type="text"
                      inputMode="numeric"
                      value={attackForm.bth === 0 ? '' : attackForm.bth}
                      onChange={(e) => updateAttackForm({ bth: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                      placeholder="0"
                      className="w-full p-2 bg-gray-700 rounded text-white mb-2"
                    />
                    <label className="block text-xs text-gray-400 mb-1">Mod (Attribute Modifier)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={attackForm.attrMod === 0 ? '' : attackForm.attrMod}
                      onChange={(e) => updateAttackForm({ attrMod: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                      placeholder="0"
                      className="w-full p-2 bg-gray-700 rounded text-white mb-2"
                    />
                    <label className="block text-xs text-gray-400 mb-1">Magic</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={attackForm.magic === 0 ? '' : attackForm.magic}
                      onChange={(e) => updateAttackForm({ magic: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                      placeholder="0"
                      className="w-full p-2 bg-gray-700 rounded text-white mb-2"
                    />
                    <label className="block text-xs text-gray-400 mb-1">Misc</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={attackForm.misc === 0 ? '' : attackForm.misc}
                      onChange={(e) => updateAttackForm({ misc: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                      placeholder="0"
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
                                  onChange={() => handleToggleAttackEffectItem(it.id)}
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
                    onClick={handleSaveAttack}
                    className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-3"
                  >
                    Save Attack
                  </button>

                  {editModal.type === 'editAttack' && (
                    <button
                      onClick={handleDeleteAttack}
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
        </ModalErrorBoundary>
      )}

      {/* In-app Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm">
            <div className="text-lg mb-4">{confirmModal.message}</div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 bg-gray-600 rounded-lg font-semibold hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm?.();
                  setConfirmModal(null);
                }}
                className={`flex-1 py-3 rounded-lg font-semibold ${confirmModal.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {confirmModal.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 z-[70] flex justify-center pointer-events-none">
          <div className={`px-4 py-3 rounded-lg shadow-lg max-w-sm text-center pointer-events-auto ${
            toast.type === 'error' ? 'bg-red-600 text-white' :
            toast.type === 'success' ? 'bg-green-600 text-white' :
            toast.type === 'warning' ? 'bg-yellow-600 text-white' :
            'bg-blue-600 text-white'
          }`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
    </>
  );

}
