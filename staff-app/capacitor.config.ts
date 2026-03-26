import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blackbelt.staff',
  appName: 'Black Belt Staff',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
