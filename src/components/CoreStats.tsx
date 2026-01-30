// ===== CORE STATS COMPONENT =====

import React from 'react';
import { Plus, Minus, Edit2 } from 'lucide-react';
import { useCharacter, useCalculations } from '../../hooks';

interface CoreStatsProps {
  onEditHP?: () => void;
  onEditAC?: () => void;
  onEditSpeed?: () => void;
  onEditXP?: () => void;
}

export const CoreStats: React.FC<CoreStatsProps> = ({
  onEditHP,
  onEditAC,
  onEditSpeed,
  onEditXP
}) => {
  const { char, updateChar } = useCharacter();
  const { maxHP, ac, speed, levelInfo, encumbrance } = useCalculations(char);
  
  if (!char) return null;
  
  const handleHPChange = (delta: number) => {
    const newHP = Math.max(0, Math.min(maxHP, char.hp + delta));
    updateChar({ hp: newHP });
  };
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
      {/* HP */}
      <div className="bg-gray-700 p-3 rounded">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm text-gray-400">HP</label>
          {onEditHP && (
            <button onClick={onEditHP} className="p-1 bg-gray-600 rounded hover:bg-gray-500">
              <Edit2 size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center justify-center gap-2">
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
        {levelInfo.drainedLevels > 0 && (
          <div className="text-xs text-red-400 text-center mt-1">
            ⚠️ {levelInfo.drainedLevels} level{levelInfo.drainedLevels !== 1 ? 's' : ''} drained
          </div>
        )}
      </div>
      
      {/* AC */}
      <div className="bg-gray-700 p-3 rounded">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm text-gray-400">AC</label>
          {onEditAC && (
            <button onClick={onEditAC} className="p-1 bg-gray-600 rounded hover:bg-gray-500">
              <Edit2 size={12} />
            </button>
          )}
        </div>
        <div className="text-2xl font-bold text-center">{ac}</div>
      </div>
      
      {/* Speed */}
      <div className="bg-gray-700 p-3 rounded">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm text-gray-400">Speed</label>
          {onEditSpeed && (
            <button onClick={onEditSpeed} className="p-1 bg-gray-600 rounded hover:bg-gray-500">
              <Edit2 size={12} />
            </button>
          )}
        </div>
        <div className="text-2xl font-bold text-center">{speed} ft</div>
        {encumbrance.speedPenalty > 0 && (
          <div className="text-xs text-yellow-400 text-center">
            -{encumbrance.speedPenalty} ({encumbrance.status})
          </div>
        )}
      </div>
      
      {/* XP / Level */}
      <div className="bg-gray-700 p-3 rounded">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm text-gray-400">Level</label>
          {onEditXP && (
            <button onClick={onEditXP} className="p-1 bg-gray-600 rounded hover:bg-gray-500">
              <Edit2 size={12} />
            </button>
          )}
        </div>
        <div className="text-2xl font-bold text-center">
          {levelInfo.currentLevel}
          {levelInfo.drainedLevels > 0 && (
            <span className="text-sm text-red-400 ml-1">(Eff: {levelInfo.effectiveLevel})</span>
          )}
        </div>
        {levelInfo.canLevelUp && (
          <div className="text-xs text-green-400 text-center">⬆ Level Up!</div>
        )}
      </div>
    </div>
  );
};

// XP Progress Bar Component
export const XPProgressBar: React.FC<{ onAddXP?: () => void }> = ({ onAddXP }) => {
  const { char } = useCharacter();
  const { levelInfo } = useCalculations(char);
  
  if (!char) return null;
  
  return (
    <div className="bg-gray-700 p-3 rounded mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm text-gray-400">Experience</label>
        {onAddXP && (
          <button 
            onClick={onAddXP}
            className="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700"
          >
            Add XP
          </button>
        )}
      </div>
      <div className="text-lg mb-1">
        {char.currentXp.toLocaleString()} / {levelInfo.nextLevelXp.toLocaleString()} XP
      </div>
      <div className="w-full bg-gray-600 rounded-full h-3">
        <div 
          className="bg-blue-600 h-3 rounded-full transition-all"
          style={{ width: `${levelInfo.progress}%` }}
        />
      </div>
    </div>
  );
};

export default CoreStats;
