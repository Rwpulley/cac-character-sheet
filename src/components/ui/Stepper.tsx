// ===== STEPPER COMPONENT =====

import React, { useRef } from 'react';
import { Plus, Minus } from 'lucide-react';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  allowManual?: boolean;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  allowManual = false,
  className = ''
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const increment = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };
  
  const decrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };
  
  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
    } else if (e.target.value === '' || e.target.value === '-') {
      // Allow empty or just minus sign during typing
    }
  };
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={decrement}
        disabled={value <= min}
        className="p-2 bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Minus size={16} />
      </button>
      
      {allowManual ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={handleManualChange}
          className="w-16 text-center p-2 bg-gray-700 rounded text-white"
        />
      ) : (
        <span className="w-12 text-center font-bold">{value}</span>
      )}
      
      <button
        type="button"
        onClick={increment}
        disabled={value >= max}
        className="p-2 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus size={16} />
      </button>
    </div>
  );
};

export default Stepper;
