// ===== TAB BAR COMPONENT =====

import React from 'react';
import { TABS, TabId } from '../../utils/constants';

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex border-b border-gray-700 mb-4 overflow-x-auto">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 font-semibold whitespace-nowrap transition-colors ${
            activeTab === tab.id
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default TabBar;
