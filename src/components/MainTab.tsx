// ===== MAIN TAB COMPONENT =====

import React, { useState } from 'react';
import { Edit2, Info, Plus, Minus } from 'lucide-react';
import { useCharacter, useCalculations } from '../hooks';
import { calcMod, formatModifier } from '../utils';
import { ATTRIBUTES } from '../utils/constants';

export const MainTab: React.FC = () => {
  const { char, updateChar } = useCharacter();
  const { maxHP, ac, speed, levelInfo, attributeTotals, getAttributeTotal } = useCalculations(char);
  
  // Modal states - placeholders for now
  const [editModal, setEditModal] = useState<{ type: string; attr?: string } | null>(null);
  
  if (!char) return null;
  
  const handleHPChange = (delta: number) => {
    const newHP = Math.max(0, Math.min(maxHP, char.hp + delta));
    updateChar({ hp: newHP });
  };

  return (
    <div className="space-y-4">
      {/* Name and Info */}
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold">{char.name || 'Unnamed'}</h1>
        <button 
          onClick={() => setEditModal({ type: 'name' })}
          className="p-2 bg-gray-700 rounded hover:bg-gray-600"
        >
          <Edit2 size={16} />
        </button>
        <button 
          onClick={() => setEditModal({ type: 'mainTabInfo' })}
          className="p-2 bg-gray-700 rounded hover:bg-gray-600 ml-auto"
        >
          <Info size={16} />
        </button>
      </div>
      
      {/* Race, Class, Speed */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400">Race</label>
          <div className="flex items-center gap-2">
            <span className="text-lg">{char.race || "Not set"}</span>
            <button 
              onClick={() => setEditModal({ type: 'race' })}
              className="p-2 bg-gray-700 rounded hover:bg-gray-600"
            >
              <Edit2 size={14} />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400">Class & Level</label>
          <div className="flex items-center gap-2">
            <div className="text-lg">
              {char.class1 || 'Not set'} {levelInfo.currentLevel}
              {char.class2 && <div>{char.class2} {char.class2Level}</div>}
              {levelInfo.canLevelUp && <span className="text-green-400 ml-2">⬆ LEVEL UP!</span>}
            </div>
            <button 
              onClick={() => setEditModal({ type: 'class' })}
              className="p-2 bg-gray-700 rounded hover:bg-gray-600"
            >
              <Edit2 size={14} />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400">Speed</label>
          <div className="flex items-center gap-2">
            <span className="text-lg">{speed} ft</span>
            <button 
              onClick={() => setEditModal({ type: 'speed' })}
              className="p-2 bg-gray-700 rounded hover:bg-gray-600"
            >
              <Edit2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* HP and AC */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400">HP</label>
          <div className="flex items-center gap-2 mb-1">
            <button 
              onClick={() => handleHPChange(-1)} 
              className="p-1 bg-red-600 rounded hover:bg-red-700"
            >
              <Minus size={16} />
            </button>
            <span className="text-xl font-bold">{char.hp} / {maxHP}</span>
            <button 
              onClick={() => handleHPChange(1)} 
              className="p-1 bg-green-600 rounded hover:bg-green-700"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="flex gap-1">
            <button 
              onClick={() => setEditModal({ type: 'hp' })}
              className="flex-1 px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500"
            >
              Edit HP
            </button>
            <button 
              onClick={() => setEditModal({ type: 'hpTracking' })}
              className="flex-1 px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500"
            >
              HP Tracking
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400">AC</label>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-bold">{ac}</span>
          </div>
          <button 
            onClick={() => setEditModal({ type: 'acTracking' })}
            className="w-full px-2 py-1 bg-gray-600 rounded text-xs hover:bg-gray-500"
          >
            AC Tracking
          </button>
        </div>
      </div>

      {/* Experience */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-gray-400">Experience</label>
          <div className="flex gap-2">
            <button 
              onClick={() => setEditModal({ type: 'xpTable' })}
              className="px-4 py-2 bg-gray-600 rounded text-base hover:bg-gray-500"
            >
              Level XP
            </button>
            <button 
              onClick={() => setEditModal({ type: 'addXp' })}
              className="px-4 py-2 text-base bg-blue-600 rounded hover:bg-blue-700"
            >
              Add XP
            </button>
          </div>
        </div>
        <div className="text-lg">
          {(char.currentXp || 0).toLocaleString()} / {levelInfo.nextLevelXp.toLocaleString()} XP (Level {levelInfo.currentLevel})
        </div>
        <div className="w-full bg-gray-700 rounded-full h-4 mt-2">
          <div 
            className="bg-blue-600 h-4 rounded-full transition-all" 
            style={{ width: `${levelInfo.progress}%` }}
          />
        </div>
      </div>

      {/* Attributes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold">Attributes</h3>
          <button
            onClick={() => setEditModal({ type: 'attributeRoller' })}
            className="p-2 bg-gray-700 rounded hover:bg-gray-600"
            title="Roll Attributes"
          >
            🎲
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ATTRIBUTES.map((key) => {
            const total = getAttributeTotal(key);
            const mod = calcMod(total);
            const isPrime = char.attributes?.[key]?.isPrime;
            
            return (
              <div key={key} className="bg-gray-700 p-3 rounded">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`font-bold uppercase text-lg px-2 py-1 rounded ${
                      isPrime ? 'bg-white text-black' : ''
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
                  <div className="text-4xl font-bold leading-none">{total}</div>
                  <div className="text-base text-gray-300 mt-2">
                    Mod: {formatModifier(mod)}
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
            {(char.classAbilities?.length || 0) > 0 ? 'Edit' : 'Add'}
          </button>
        </div>
        {(!char.classAbilities || char.classAbilities.length === 0) ? (
          <div className="text-sm text-gray-400">No class abilities added.</div>
        ) : (
          <div className="space-y-2">
            {char.classAbilities.map((a, i) => (
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
            {(char.raceAbilities?.length || 0) > 0 ? 'Edit' : 'Add'}
          </button>
        </div>
        
        {/* Race Attribute Mods */}
        {(char.raceAttributeMods?.length || 0) > 0 && (() => {
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
        
        {(!char.raceAbilities || char.raceAbilities.length === 0) ? (
          <div className="text-sm text-gray-400">No race abilities added.</div>
        ) : (
          <div className="space-y-2">
            {char.raceAbilities.map((a, i) => (
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
            {(char.advantages?.length || 0) > 0 ? 'Edit' : 'Add'}
          </button>
        </div>
        {(!char.advantages || char.advantages.length === 0) ? (
          <div className="text-sm text-gray-400">No advantages added.</div>
        ) : (
          <div className="space-y-2">
            {char.advantages.map((a, i) => (
              <div key={i} className="bg-gray-700 p-2 rounded">
                {a}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Character Details Section */}
      <div className="mt-6 bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Details</h2>
          <button
            onClick={() => setEditModal({ type: 'characterDetails' })}
            className="p-2 bg-gray-600 rounded hover:bg-gray-500"
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

      {/* Alignment / Languages / Deity / Holy Symbol */}
      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Alignment</label>
            <input
              type="text"
              value={char.alignment || ''}
              onChange={(e) => updateChar({ alignment: e.target.value })}
              className="w-full p-2 bg-gray-700 rounded"
              placeholder="e.g., Lawful Good"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Languages</label>
            <input
              type="text"
              value={char.languages || ''}
              onChange={(e) => updateChar({ languages: e.target.value })}
              className="w-full p-2 bg-gray-700 rounded"
              placeholder="e.g., Common, Elvish"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Deity</label>
            <input
              type="text"
              value={char.deity || ''}
              onChange={(e) => updateChar({ deity: e.target.value })}
              className="w-full p-2 bg-gray-700 rounded"
              placeholder="e.g., Odin"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Holy Symbol</label>
            <input
              type="text"
              value={char.holySymbol || ''}
              onChange={(e) => updateChar({ holySymbol: e.target.value })}
              className="w-full p-2 bg-gray-700 rounded"
              placeholder="e.g., Silver hammer"
            />
          </div>
        </div>
      </div>

      {/* TODO: Add modals for editing */}
    </div>
  );
};

export default MainTab;
