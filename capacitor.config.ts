import type { CapacitorConfig } from '@capacitor/cli';

// Owner-selected envolio.app, normalized to reverse-DNS for both platforms.
const appId = 'app.envolio';
if (process.env.ENVOLIO_APP_ID && process.env.ENVOLIO_APP_ID !== appId) {
  throw new Error('ENVOLIO_APP_ID must match app.envolio. Changing identity requires migrating both native projects; see docs/NATIVE-APP.md.');
}

const config: CapacitorConfig = {
  appId,
  appName: 'Envolio',
  webDir: 'dist-native',
  backgroundColor: '#111113',
  // Bundle the UI. Never use the temporary preview host as server.url.
};

export default config;
