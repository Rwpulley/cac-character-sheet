# Code Architecture

## Overview

The Castles & Crusades Character Sheet is currently a single-file React component (`CaCCharacterSheet_with_persistence.tsx`) at approximately 10,000 lines. This monolithic structure is intentional during active development to make rapid iteration easier. Future refactoring into separate components/hooks is planned.

## File Structure

```
src/
├── CaCCharacterSheet_with_persistence.tsx  # Main application (this file)
├── App.tsx                                  # App wrapper
├── index.css                                # Global styles (Tailwind)
└── main.tsx                                 # Entry point
```

## Code Sections

The main file is organized into logical sections:

### Imports & Type Definitions (Lines 1-220)
- React imports and lucide-react icons
- **TypeScript Interfaces**: `Character`, `Attack`, `InventoryItem`, `Spell`, `Companion`, etc.
- **Error Boundary**: Class component that catches crashes and shows recovery UI

### Theme & Storage (Lines 220-350)
- `lightThemeStyles`: CSS overrides for light mode
- `saveToLocalStorage()` / `loadFromLocalStorage()`: Persistence functions
- `exportToFile()` / `importFromFile()`: Backup/restore functionality

### Utility Components (Lines 350-520)
- `DebouncedInput`: Text input with 300ms debounce to reduce re-renders
- `DomStepper`: Number input with +/- buttons, mobile-friendly

### Constants (Lines 520-920)
- `weaponEffectsList`: Predefined weapon enchantments (Flaming, Frost, etc.)
- `armorEffectsList`: Armor enchantments
- Default character template

### Main Component & State (Lines 920-1400)
All `useState` declarations, grouped by purpose:
- **Core State**: `characters`, `currentCharIndex`, `activeTab`
- **UI State**: `editModal`, `expandedAttackIds`, `toast`
- **Form State**: `modalForms`, `spellForm`, item modal states
- **View State**: `spellsLearnedView`, `grimoireView`, `magicInventoryView`

### Lifecycle & Effects (Lines 1400-1600)
- Data loading on mount
- Android back button handler
- Auto-save with 500ms throttle
- Modal initialization effects

### Memoized Calculations (Lines 1600-1850)
Performance-optimized calculations using `useMemo`:
- `memoizedAttributeTotals`: Cached attribute calculations
- `memoizedLevelInfo`: XP and level calculations
- `sortedSpellsLearned`, `sortedInventory`: Cached sorted lists

### Helper Functions (Lines 1850-2900)
Character manipulation functions:
- `updateChar()`: Update current character
- `getAttributeTotal()`, `calcMod()`: Attribute calculations
- `getEncumbranceStatus()`: Weight/carry capacity
- Attack and damage calculation helpers
- Spell slot management
- Companion CRUD operations

### Tab UI Sections

| Tab | Lines | Description |
|-----|-------|-------------|
| **Main** | 2900-3300 | Name, race, class, attributes, HP, AC, XP, abilities |
| **Attack** | 3300-3800 | Attack cards with to-hit/damage rolls, criticals, ammo |
| **Saves** | 3800-3900 | Attribute checks and saving throws |
| **Magic** | 3900-5200 | Spells learned, prepared, grimoires, magic inventory |
| **Notes** | 5200-5300 | Free-form notes textarea |
| **Dice** | 5300-5500 | General purpose dice roller |
| **Companion** | 5500-5750 | Animal companion management |
| **Inventory** | 5750-6100 | Items, equipment, wallet |

### Modals (Lines 6100-10100)
All modal dialogs in one section:
- Character editing modals (name, race, class, attributes)
- HP/AC tracking modals
- Item add/edit modals
- Spell add/edit modals
- Attack configuration modals
- Info/help modals

## Key Patterns

### State Management
- All state lives in the main component (no Redux/Context)
- `updateChar()` is the primary way to modify character data
- Changes trigger auto-save via `useEffect`

### Modal System
```typescript
// Open a modal
setEditModal({ type: 'editAttack', attack: attackData });

// Modal renders based on type
{editModal.type === 'editAttack' && (
  <div>...</div>
)}

// Close modal
setEditModal(null);
```

### Form State Pattern
Modal forms use a consolidated `modalForms` object:
```typescript
const [modalForms, setModalForms] = useState({});
const updateModalForm = (updates) => setModalForms(prev => ({ ...prev, ...updates }));
```

### Memoization Pattern
Expensive calculations are memoized:
```typescript
const sortedInventory = useMemo(() => {
  return [...(char?.inventory || [])].sort((a, b) => a.name.localeCompare(b.name));
}, [char?.inventory]);
```

## Adding New Features

### Adding a New Field to Character
1. Add to `Character` interface (line ~100)
2. Add default value in character creation (search for `const newChar`)
3. Add UI in appropriate tab section
4. Add edit modal if needed

### Adding a New Tab
1. Add tab to `tabOrder` array (line ~2680)
2. Add tab button in navigation (line ~2695)
3. Add `{activeTab === 'newtab' && (...)}` section
4. Add swipe dot indicator

### Adding a New Modal
1. Add modal type to title list (search for `editModal.type === 'name' && 'Edit Name'`)
2. Add modal initialization in useEffect (search for `if (editModal.type === 'name'`)
3. Add modal content (search for `{editModal.type === 'name' && (`)

## Performance Considerations

- **Debounced inputs**: Text fields use 300ms debounce
- **Throttled saves**: Auto-save waits 500ms after last change
- **Memoized sorts**: Lists are sorted in useMemo, not on every render
- **Lazy rendering**: Only active tab content renders

## Error Handling

The app is wrapped in an `ErrorBoundary` that:
- Catches React render errors
- Shows user-friendly error message
- Preserves data in localStorage
- Provides "Reload App" button

## Future Refactoring Plans

When ready to split the file:
1. Extract TypeScript interfaces to `types.ts`
2. Extract utility functions to `utils.ts`
3. Create custom hooks: `useCharacter.ts`, `useLocalStorage.ts`
4. Split tabs into components: `MainTab.tsx`, `AttackTab.tsx`, etc.
5. Extract modals to `modals/` directory
