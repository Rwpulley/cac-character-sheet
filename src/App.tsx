// ===== MAIN APP COMPONENT =====

import React, { useState } from 'react';
import { CharacterProvider, useCharacter, useCalculations, useToast, useTheme } from './hooks';
import { 
  CharacterSelector, 
  TabBar, 
  Header, 
  AttributeDisplay, 
  CoreStats, 
  XPProgressBar,
  ToastContainer 
} from './components';
import { TabId } from './utils/constants';

// Main App Content (inside provider)
const AppContent: React.FC = () => {
  const { char } = useCharacter();
  const { isDarkTheme } = useTheme();
  const { toasts, showToast, dismissToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('main');
  const [showCharacterList, setShowCharacterList] = useState(false);
  
  return (
    <div className={`min-h-screen ${isDarkTheme ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'} p-4`}>
      <div className="max-w-4xl mx-auto">
        {/* Character Selector Toggle */}
        <button
          onClick={() => setShowCharacterList(!showCharacterList)}
          className="w-full mb-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-left px-4"
        >
          {showCharacterList ? '▼ Hide Characters' : '▶ Show Characters'} 
          {char && <span className="float-right text-gray-400">{char.name || 'Unnamed'}</span>}
        </button>
        
        {showCharacterList && <CharacterSelector />}
        
        {char ? (
          <>
            <Header />
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
            
            {activeTab === 'main' && (
              <div>
                <CoreStats />
                <XPProgressBar />
                <AttributeDisplay />
                
                {/* Placeholder for other main tab content */}
                <div className="bg-gray-800 p-4 rounded mt-4">
                  <p className="text-gray-400 text-center">
                    ✅ Basic structure working!<br/>
                    More components coming soon...
                  </p>
                </div>
              </div>
            )}
            
            {activeTab === 'combat' && (
              <div className="bg-gray-800 p-4 rounded">
                <h2 className="text-xl font-bold mb-4">Combat</h2>
                <p className="text-gray-400">Combat tab components coming soon...</p>
              </div>
            )}
            
            {activeTab === 'spells' && (
              <div className="bg-gray-800 p-4 rounded">
                <h2 className="text-xl font-bold mb-4">Spells</h2>
                <p className="text-gray-400">Spells tab components coming soon...</p>
              </div>
            )}
            
            {activeTab === 'inventory' && (
              <div className="bg-gray-800 p-4 rounded">
                <h2 className="text-xl font-bold mb-4">Inventory</h2>
                <p className="text-gray-400">Inventory tab components coming soon...</p>
              </div>
            )}
            
            {activeTab === 'notes' && (
              <div className="bg-gray-800 p-4 rounded">
                <h2 className="text-xl font-bold mb-4">Notes</h2>
                <p className="text-gray-400">Notes tab components coming soon...</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl text-gray-400 mb-4">No character selected</p>
            <p className="text-gray-500">Click "Show Characters" above to create or select a character</p>
          </div>
        )}
      </div>
      
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

// App wrapper with providers
const App: React.FC = () => {
  return (
    <CharacterProvider>
      <AppContent />
    </CharacterProvider>
  );
};

export default App;
