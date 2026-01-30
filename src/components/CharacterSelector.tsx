// ===== CHARACTER SELECTOR COMPONENT =====

import React, { useState } from 'react';
import { Trash2, Download, Upload, Info, X } from 'lucide-react';
import { useCharacter } from '../hooks';
import { useTheme } from '../hooks';
import { exportCharacters, importCharacters } from '../utils/storage';
import { Modal } from './ui/Modal';

export const CharacterSelector: React.FC = () => {
  const { 
    characters, 
    selectCharacter, 
    createCharacter, 
    deleteCharacter 
  } = useCharacter();
  const { isDarkTheme, toggleTheme } = useTheme();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showAppInfo, setShowAppInfo] = useState(false);
  const [hasSeenAppInfo, setHasSeenAppInfo] = useState(() => {
    return localStorage.getItem('cac-seen-app-info') === 'true';
  });
  const [importError, setImportError] = useState<string | null>(null);
  
  const handleExport = () => {
    if (characters.length === 0) return;
    exportCharacters(characters);
  };
  
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setImportError(null);
      const imported = await importCharacters(file);
      console.log('Imported characters:', imported);
      window.location.reload();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed');
    }
    
    e.target.value = '';
  };
  
  const handleDelete = (id: number) => {
    deleteCharacter(id);
    setShowDeleteConfirm(null);
  };
  
  const handleInfoClick = () => {
    setShowAppInfo(true);
    if (!hasSeenAppInfo) {
      setHasSeenAppInfo(true);
      localStorage.setItem('cac-seen-app-info', 'true');
    }
  };
  
  return (
    <div className={`max-w-2xl mx-auto bg-gray-800 rounded-lg p-8`}>
      {/* Title with info button */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <h1 className="text-4xl font-bold text-center">Castles & Crusades</h1>
        {hasSeenAppInfo && (
          <button
            onClick={handleInfoClick}
            className="p-2 bg-gray-700 rounded hover:bg-gray-600"
          >
            <Info size={20} />
          </button>
        )}
      </div>
      
      {/* Info Button - Prominent for first-time users */}
      {!hasSeenAppInfo && (
        <div className="flex justify-center mb-6">
          <button
            onClick={handleInfoClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 text-white font-semibold"
          >
            <Info size={18} />
            <span>Click Here Before Creating a Character</span>
          </button>
        </div>
      )}
      
      {/* Import Error */}
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
          className="flex-1 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
        >
          <Download size={14} />
          Export
        </button>
        <label className="flex-1 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600 flex items-center justify-center gap-1 cursor-pointer">
          <Upload size={14} />
          Import
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>
      
      {/* Create New Character Button */}
      <button
        onClick={createCharacter}
        className="w-full py-4 bg-green-600 rounded-lg text-xl font-bold mb-6 hover:bg-green-700 text-white"
      >
        + Create New Character
      </button>
      
      {/* Characters List */}
      <h2 className="text-2xl font-bold mb-4">Your Characters</h2>
      
      {characters.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <p>No characters yet.</p>
          <p className="text-sm mt-2">Create a new character or import a backup file.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {characters.map(char => (
            <div key={char.id} className="flex items-center gap-2">
              <button
                onClick={() => selectCharacter(char.id)}
                className="flex-1 p-4 bg-gray-700 rounded-lg text-left hover:bg-gray-600"
              >
                <div className="text-xl font-bold">{char.name || 'Unnamed'}</div>
                <div className="text-gray-400">
                  {char.race} {char.class1} {char.class1Level}
                  {char.class2 && ` / ${char.class2} ${char.class2Level}`}
                </div>
              </button>
              <button
                onClick={() => setShowDeleteConfirm(char.id)}
                className="p-4 bg-red-600 rounded-lg hover:bg-red-700 text-white"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Footer */}
      <div className="text-center text-sm mt-8 pt-4 border-t border-gray-700 text-gray-400">
        <button
          onClick={toggleTheme}
          className="mb-3 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center gap-2 mx-auto"
        >
          {isDarkTheme ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
        <div>C&C Character Sheet v1.0</div>
        <div>Created by Rwpull</div>
      </div>
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        title="Delete Character"
      >
        <p className="text-gray-300 mb-4">
          Are you sure you want to delete this character? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeleteConfirm(null)}
            className="flex-1 py-2 bg-gray-600 rounded hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            className="flex-1 py-2 bg-red-600 rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </Modal>
      
      {/* App Info Modal */}
      {showAppInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">About This App</h2>
              <button
                onClick={() => setShowAppInfo(false)}
                className="p-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="text-sm text-gray-300 space-y-4">
              <p>
                This character tracking app is designed to be used in conjunction with the{' '}
                <span className="font-semibold text-white">Castles & Crusades Players Handbook</span>,{' '}
                <span className="font-semibold text-white">Adventurers Backpack</span>, and{' '}
                <span className="font-semibold text-white">Castle Keepers Guide</span>. 
                It is not meant to replace the books, but to replace the printed paper character sheet.
              </p>
              
              <div>
                <div className="font-bold text-white mb-2">Features:</div>
                <ul className="list-disc list-inside space-y-1 text-gray-300">
                  <li>Roll attributes using your preferred method (3d6, 4d6 drop lowest, or best of 6)</li>
                  <li>Track your attribute modifiers as you increase in level</li>
                  <li>Track your HP with automatic CON modifier calculations</li>
                  <li>Track your experience and see when you reach your next level</li>
                  <li>Track AC based on Race abilities, Armor, and Shield modifiers</li>
                  <li>Track your inventory including weight and encumbrance</li>
                  <li>Add inventory items that give Attribute, Speed, HP, and AC bonuses</li>
                  <li>Perform money exchange using Gold as your base currency</li>
                  <li>Track ammo usage when used with a ranged weapon</li>
                  <li>Show attack rolls with all bonuses applied</li>
                  <li>Track what spells you know and have prepared</li>
                  <li>Track your magical inventory and daily spell uses</li>
                  <li>Track Checks and Saves with appropriate modifiers</li>
                  <li>Track companions including their details, attacks, and HP</li>
                  <li>Use a multitude of dice to roll for whatever you may need</li>
                  <li>Notes section with date and time to track your group's progress</li>
                </ul>
              </div>
              
              <div className="bg-gray-700 p-3 rounded">
                <p className="text-gray-300">
                  This app does not have everything. If there is anything you think should be included, please reach out:
                </p>
                <p className="font-semibold text-blue-400 mt-1">Rwpull@gmail.com</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowAppInfo(false)}
              className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 mt-4 font-semibold text-white"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterSelector;
