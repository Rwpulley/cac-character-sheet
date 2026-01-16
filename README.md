# Castles & Crusades Character Sheet

A Progressive Web App (PWA) for managing your Castles & Crusades tabletop RPG characters.

## Features

- 📱 Works on phone, tablet, and desktop
- 💾 Auto-saves to device storage
- 📴 Works offline
- 📤 Export/Import character backups
- ⚔️ Track attacks, inventory, spells, companions
- 🎲 Built-in dice roller

## Installation

### On Your Phone (Android/iOS)
1. Open the app URL in Chrome (Android) or Safari (iOS)
2. Tap the menu (⋮ or share icon)
3. Select "Add to Home Screen"
4. The app icon will appear on your home screen

### Local Development
```bash
npm install
npm run dev
```

### Build for Production
```bash
npm run build
```

## Deployment

This app is configured for easy deployment to Vercel:

1. Push to GitHub
2. Connect your repo to Vercel
3. Deploy automatically

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Vite
- vite-plugin-pwa (offline support)
