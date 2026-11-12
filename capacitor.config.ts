import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.benmaasaike.races',
  appName: 'Races',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
