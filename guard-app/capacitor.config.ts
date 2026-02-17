import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blackbelt.guard',
  appName: 'Black Belt Guard',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
