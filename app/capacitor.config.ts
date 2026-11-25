import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.sounditent.com',
  appName: 'Sound It',
  webDir: 'dist',
  bundledWebRuntime: false,
  loggingBehavior: 'production',
  ios: {
    contentInset: 'never',
    allowsLinkPreview: false,
    scrollEnabled: true,
    backgroundColor: '#020b00',
  },
  android: {
    backgroundColor: '#020b00',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    SocialLogin: {
      google: {
        webClientId: '247782235504-cn5jtjv983t1i1isied107dlrgf1vifs.apps.googleusercontent.com',
      },
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#020b00',
      overlaysWebView: true,
    },
    PushNotifications: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
  },
};

export default config;
