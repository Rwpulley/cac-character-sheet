// ===== CHARACTER SELECTOR COMPONENT =====

import React, { useState } from 'react';
import { Plus, Trash2, Download, Upload, Edit2 } from 'lucide-react';
import { useCharacter } from '../hooks';
import { exportCharacters, importCharacters } from '../utils/storage';
import { Modal } from '../ui';

export const CharacterSelector: React.FC = () => {
  const { 
    characters, 
    selectedCharacterId, 
    selectCharacter, 
    createCharacter, 
    deleteCharacter,
    duplicateCharacter 
  } = useCharacter();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  
  const handleExport = () => {
    exportCharacters(characters);
  };
  
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setImportError(null);
      const imported = await importCharacters(file);
      // For now, just log - in full implementation would merge/replace
      console.log('Imported characters:', imported);
      window.location.reload(); // Reload to pick up changes
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed');
    }
    
    // Reset input
    e.target.value = '';
  };
  
  const handleDelete = (id: number) => {
    deleteCharacter(id);
    setShowDeleteConfirm(null);
  };
  
  return (
    <div className="bg-gray-800 p-4 rounded-lg mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Characters</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="p-2 bg-gray-700 rounded hover:bg-gray-600"
            title="Export Characters"
          >
            <Download size={18} />
          </button>
          <label className="p-2 bg-gray-700 rounded hover:bg-gray-600 cursor-pointer" title="Import Characters">
            <Upload size={18} />
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button
            onClick={createCharacter}
            className="p-2 bg-green-600 rounded hover:bg-green-700"
            title="New Character"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
      
      {importError && (
        <div className="text-red-400 text-sm mb-2">{importError}</div>
      )}
      
      {characters.length === 0 ? (
        <div className="text-gray-400 text-center py-4">
          No characters yet. Click + to create one!
        </div>
      ) : (
        <div className="space-y-2">
          {characters.map(char => (
            <div
              key={char.id}
              className={`flex items-center justify-between p-3 rounded cursor-pointer ${
                selectedCharacterId === char.id 
                  ? 'bg-blue-600' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              onClick={() => selectCharacter(char.id)}
            >
              <div>
                <div className="font-bold">{char.name || 'Unnamed'}</div>
                <div className="text-sm text-gray-300">
                  {char.race} {char.class1} {char.class1Level}
                  {char.class2 && ` / ${char.class2} ${char.class2Level}`}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateCharacter(char.id);
                  }}
                  className="p-2 bg-gray-600 rounded hover:bg-gray-500"
                  title="Duplicate"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(char.id);
                  }}
                  className="p-2 bg-red-600 rounded hover:bg-red-700"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
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
    </div>
  );
};

export default CharacterSelector;
