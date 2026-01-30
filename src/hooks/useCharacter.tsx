// ===== CHARACTER CONTEXT =====

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Character } from '../types';
import { DEFAULT_CHARACTER } from '../utils/constants';
import { loadCharacters, saveCharacters } from '../utils/storage';
import { generateId } from '../utils';

interface CharacterContextType {
  // Characters list
  characters: Character[];
  selectedCharacterId: number | null;
  
  // Current character
  char: Character | null;
  
  // Actions
  selectCharacter: (id: number | null) => void;
  createCharacter: () => void;
  deleteCharacter: (id: number) => void;
  updateChar: (updates: Partial<Character>) => void;
  duplicateCharacter: (id: number) => void;
  
  // Persistence
  saveAll: () => void;
  loadAll: () => void;
}

const CharacterContext = createContext<CharacterContextType | null>(null);

export const useCharacter = (): CharacterContextType => {
  const context = useContext(CharacterContext);
  if (!context) {
    throw new Error('useCharacter must be used within a CharacterProvider');
  }
  return context;
};

interface CharacterProviderProps {
  children: React.ReactNode;
}

export const CharacterProvider: React.FC<CharacterProviderProps> = ({ children }) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  
  // Load characters on mount
  useEffect(() => {
    const loaded = loadCharacters();
    setCharacters(loaded);
    
    // Auto-select first character if available
    if (loaded.length > 0 && !selectedCharacterId) {
      setSelectedCharacterId(loaded[0].id);
    }
  }, []);
  
  // Auto-save when characters change
  useEffect(() => {
    if (characters.length > 0) {
      saveCharacters(characters);
    }
  }, [characters]);
  
  // Current character
  const char = useMemo(() => {
    if (!selectedCharacterId) return null;
    return characters.find(c => c.id === selectedCharacterId) || null;
  }, [characters, selectedCharacterId]);
  
  // Select a character
  const selectCharacter = useCallback((id: number | null) => {
    setSelectedCharacterId(id);
  }, []);
  
  // Create a new character
  const createCharacter = useCallback(() => {
    const newChar: Character = {
      ...DEFAULT_CHARACTER,
      id: generateId(),
      name: 'New Character'
    };
    
    setCharacters(prev => [...prev, newChar]);
    setSelectedCharacterId(newChar.id);
  }, []);
  
  // Delete a character
  const deleteCharacter = useCallback((id: number) => {
    setCharacters(prev => prev.filter(c => c.id !== id));
    
    // If we deleted the selected character, select another
    if (selectedCharacterId === id) {
      setSelectedCharacterId(prev => {
        const remaining = characters.filter(c => c.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      });
    }
  }, [characters, selectedCharacterId]);
  
  // Update current character
  const updateChar = useCallback((updates: Partial<Character>) => {
    if (!selectedCharacterId) return;
    
    setCharacters(prev => prev.map(c => 
      c.id === selectedCharacterId ? { ...c, ...updates } : c
    ));
  }, [selectedCharacterId]);
  
  // Duplicate a character
  const duplicateCharacter = useCallback((id: number) => {
    const original = characters.find(c => c.id === id);
    if (!original) return;
    
    const duplicate: Character = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`
    };
    
    setCharacters(prev => [...prev, duplicate]);
  }, [characters]);
  
  // Manual save
  const saveAll = useCallback(() => {
    saveCharacters(characters);
  }, [characters]);
  
  // Manual load
  const loadAll = useCallback(() => {
    const loaded = loadCharacters();
    setCharacters(loaded);
  }, []);
  
  const value: CharacterContextType = {
    characters,
    selectedCharacterId,
    char,
    selectCharacter,
    createCharacter,
    deleteCharacter,
    updateChar,
    duplicateCharacter,
    saveAll,
    loadAll
  };
  
  return (
    <CharacterContext.Provider value={value}>
      {children}
    </CharacterContext.Provider>
  );
};

export default CharacterContext;
