// ===== MAIN APP COMPONENT =====

import React, { useState } from 'react';
import { CharacterProvider, useCharacter, useToast, useTheme } from './hooks';
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
      <div className={`min-h-screen bg-gray-900 text-white p-4 ${!isDarkTheme ? 'light-theme' : ''}`}>
        <CharacterSelector />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }
  
  // Character is selected - show character sheet
  return (
    <div className={`min-h-screen bg-gray-900 text-white p-4 ${!isDarkTheme ? 'light-theme' : ''}`}>
      <div className="max-w-4xl mx-auto">
        {/* Tabs at top */}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        
        {/* Tab Content */}
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
          {activeTab === 'main' && (
            <div className="space-y-4">
              <Header />
              <CoreStats />
              <XPProgressBar />
              <AttributeDisplay />
              
              {/* Placeholder for other main tab content */}
              <div className="bg-gray-700 p-4 rounded mt-4">
                <p className="text-gray-400 text-center">
                  ✅ Basic structure working!<br/>
                  Class Abilities, Race Abilities, Advantages, Details sections coming soon...
                </p>
              </div>
            </div>
          )}
          
          {activeTab === 'attack' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Attack</h2>
              <p className="text-gray-400">Attack tab components coming soon...</p>
            </div>
          )}
          
          {activeTab === 'inventory' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Inventory</h2>
              <p className="text-gray-400">Inventory tab components coming soon...</p>
            </div>
          )}
          
          {activeTab === 'magic' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Magic</h2>
              <p className="text-gray-400">Magic tab components coming soon...</p>
            </div>
          )}
          
          {activeTab === 'saves' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Checks & Saves</h2>
              <p className="text-gray-400">Checks/Saves tab components coming soon...</p>
            </div>
          )}
          
          {activeTab === 'dice' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Dice Roller</h2>
              <p className="text-gray-400">Dice tab components coming soon...</p>
            </div>
          )}
          
          {activeTab === 'companion' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Companions</h2>
              <p className="text-gray-400">Companion tab components coming soon...</p>
            </div>
          )}
          
          {activeTab === 'notes' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Notes</h2>
              <p className="text-gray-400">Notes tab components coming soon...</p>
            </div>
          )}
        </div>
        
        {/* Back to Characters button - only on main tab */}
        {activeTab === 'main' && (
          <div className="mt-10 mb-6 text-center">
            <button
              onClick={() => selectCharacter(null)}
              className="text-base px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
            >
              ← Back to Characters
            </button>
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
