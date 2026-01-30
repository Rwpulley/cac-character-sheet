// ===== ATTRIBUTE DISPLAY COMPONENT =====

import React, { useState } from 'react';
import { Edit2 } from 'lucide-react';
import { useCharacter } from '../../hooks';
import { useCalculations } from '../../hooks';
import { calcMod, formatModifier } from '../../utils';
import { ATTRIBUTES, ATTRIBUTE_NAMES } from '../../utils/constants';
import { Modal } from '../ui';

export const AttributeDisplay: React.FC = () => {
  const { char, updateChar } = useCharacter();
  const { getAttributeTotal } = useCalculations(char);
  const [editingAttr, setEditingAttr] = useState<string | null>(null);
  
  if (!char) return null;
  
  const handleSaveAttribute = (attr: string, base: number, bonus: number, tempMod: number) => {
    updateChar({
      attributes: {
        ...char.attributes,
        [attr]: { base, bonus, tempMod }
      }
    });
    setEditingAttr(null);
  };
  
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-bold">Attributes</h3>
      </div>
      
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {ATTRIBUTES.map(attr => {
          const total = getAttributeTotal(attr);
          const mod = calcMod(total);
          
          return (
            <div
              key={attr}
              onClick={() => setEditingAttr(attr)}
              className="bg-gray-700 p-3 rounded text-center cursor-pointer hover:bg-gray-600"
            >
              <div className="text-xs text-gray-400 uppercase">{attr}</div>
              <div className="text-2xl font-bold">{total}</div>
              <div className={`text-sm ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatModifier(mod)}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Edit Attribute Modal */}
      <Modal
        isOpen={editingAttr !== null}
        onClose={() => setEditingAttr(null)}
        title={`Edit ${editingAttr ? ATTRIBUTE_NAMES[editingAttr] : ''}`}
      >
        {editingAttr && (
          <AttributeEditor
            attr={editingAttr}
            current={char.attributes[editingAttr] || { base: 10, bonus: 0, tempMod: 0 }}
            onSave={(base, bonus, tempMod) => handleSaveAttribute(editingAttr, base, bonus, tempMod)}
            onCancel={() => setEditingAttr(null)}
          />
        )}
      </Modal>
    </div>
  );
};

interface AttributeEditorProps {
  attr: string;
  current: { base: number; bonus: number; tempMod?: number };
  onSave: (base: number, bonus: number, tempMod: number) => void;
  onCancel: () => void;
}

const AttributeEditor: React.FC<AttributeEditorProps> = ({ attr, current, onSave, onCancel }) => {
  const [base, setBase] = useState(current.base || 10);
  const [bonus, setBonus] = useState(current.bonus || 0);
  const [tempMod, setTempMod] = useState(current.tempMod || 0);
  
  const total = base + bonus + tempMod;
  const mod = calcMod(total);
  
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="text-3xl font-bold">{total}</div>
        <div className={`text-lg ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          Modifier: {formatModifier(mod)}
        </div>
      </div>
      
      <div>
        <label className="block text-sm text-gray-400 mb-1">Base Score</label>
        <input
          type="number"
          value={base}
          onChange={(e) => setBase(parseInt(e.target.value) || 0)}
          className="w-full p-2 bg-gray-700 rounded text-white"
        />
      </div>
      
      <div>
        <label className="block text-sm text-gray-400 mb-1">Permanent Bonus (items, feats)</label>
        <input
          type="number"
          value={bonus}
          onChange={(e) => setBonus(parseInt(e.target.value) || 0)}
          className="w-full p-2 bg-gray-700 rounded text-white"
        />
      </div>
      
      <div>
        <label className="block text-sm text-gray-400 mb-1">Temporary Modifier (spells, conditions)</label>
        <input
          type="number"
          value={tempMod}
          onChange={(e) => setTempMod(parseInt(e.target.value) || 0)}
          className="w-full p-2 bg-gray-700 rounded text-white"
        />
      </div>
      
      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 bg-gray-600 rounded hover:bg-gray-500"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(base, bonus, tempMod)}
          className="flex-1 py-2 bg-blue-600 rounded hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default AttributeDisplay;
