// ===== HEADER COMPONENT =====

import React from 'react';
import { useCharacter } from '../../hooks';
import { useTheme } from '../../hooks';

export const Header: React.FC = () => {
  const { char, updateChar } = useCharacter();
  const { isDarkTheme, toggleTheme } = useTheme();
  
  if (!char) return null;
  
  return (
    <div className="bg-gray-800 p-4 rounded-lg mb-4">
      <div className="flex items-center justify-between mb-3">
        <input
          type="text"
          value={char.name}
          onChange={(e) => updateChar({ name: e.target.value })}
          placeholder="Character Name"
          className="text-2xl font-bold bg-transparent border-b border-gray-600 focus:border-blue-400 outline-none w-full mr-4"
        />
        <button
          onClick={toggleTheme}
          className="p-2 bg-gray-700 rounded hover:bg-gray-600 text-sm"
        >
          {isDarkTheme ? '☀️' : '🌙'}
        </button>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Race</label>
          <input
            type="text"
            value={char.race}
            onChange={(e) => updateChar({ race: e.target.value })}
            placeholder="Race"
            className="w-full p-2 bg-gray-700 rounded text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Class</label>
          <input
            type="text"
            value={char.class1}
            onChange={(e) => updateChar({ class1: e.target.value })}
            placeholder="Class"
            className="w-full p-2 bg-gray-700 rounded text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Level</label>
          <input
            type="number"
            value={char.class1Level || ''}
            onChange={(e) => updateChar({ class1Level: parseInt(e.target.value) || 1 })}
            min={1}
            className="w-full p-2 bg-gray-700 rounded text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">2nd Class (optional)</label>
          <input
            type="text"
            value={char.class2 || ''}
            onChange={(e) => updateChar({ class2: e.target.value })}
            placeholder="None"
            className="w-full p-2 bg-gray-700 rounded text-white"
          />
        </div>
      </div>
    </div>
  );
};

export default Header;
