import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rasem.vectorartist',
  appName: 'رسام فكتور بسيط',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#2563eb'
  }
};

export default config;
