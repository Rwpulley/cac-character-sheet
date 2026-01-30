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
  const { char, selectCharacter } = useCharacter();
  const { isDarkTheme } = useTheme();
  const { toasts, dismissToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('main');
  
  // If no character selected, show character select screen
  if (!char) {
    return (
      <div className={`min-h-screen ${isDarkTheme ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'} p-4`}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-6">C&C Character Sheet</h1>
          <CharacterSelector />
        </div>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }
  
  // Character is selected - show character sheet
  return (
    <div className={`min-h-screen ${isDarkTheme ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'} p-4`}>
      <div className="max-w-4xl mx-auto">
        {/* Tabs at top */}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        
        {/* Tab Content */}
        {activeTab === 'main' && (
          <div>
            <Header />
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
        
        {activeTab === 'attack' && (
          <div className="bg-gray-800 p-4 rounded">
            <h2 className="text-xl font-bold mb-4">Attack</h2>
            <p className="text-gray-400">Attack tab components coming soon...</p>
          </div>
        )}
        
        {activeTab === 'inventory' && (
          <div className="bg-gray-800 p-4 rounded">
            <h2 className="text-xl font-bold mb-4">Inventory</h2>
            <p className="text-gray-400">Inventory tab components coming soon...</p>
          </div>
        )}
        
        {activeTab === 'magic' && (
          <div className="bg-gray-800 p-4 rounded">
            <h2 className="text-xl font-bold mb-4">Magic</h2>
            <p className="text-gray-400">Magic tab components coming soon...</p>
          </div>
        )}
        
        {activeTab === 'saves' && (
          <div className="bg-gray-800 p-4 rounded">
            <h2 className="text-xl font-bold mb-4">Checks & Saves</h2>
            <p className="text-gray-400">Checks/Saves tab components coming soon...</p>
          </div>
        )}
        
        {activeTab === 'dice' && (
          <div className="bg-gray-800 p-4 rounded">
            <h2 className="text-xl font-bold mb-4">Dice Roller</h2>
            <p className="text-gray-400">Dice tab components coming soon...</p>
          </div>
        )}
        
        {activeTab === 'companion' && (
          <div className="bg-gray-800 p-4 rounded">
            <h2 className="text-xl font-bold mb-4">Companions</h2>
            <p className="text-gray-400">Companion tab components coming soon...</p>
          </div>
        )}
        
        {activeTab === 'notes' && (
          <div className="bg-gray-800 p-4 rounded">
            <h2 className="text-xl font-bold mb-4">Notes</h2>
            <p className="text-gray-400">Notes tab components coming soon...</p>
          </div>
        )}
        
        {/* Back to Characters button at bottom */}
        <button
          onClick={() => selectCharacter(null)}
          className="w-full mt-6 py-3 bg-gray-700 rounded hover:bg-gray-600 text-gray-300"
        >
          ← Back to Characters
        </button>
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
