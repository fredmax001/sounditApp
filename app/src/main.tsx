/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import './index.css'
import './i18n'
import App from './App.tsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""

function CapacitorInit() {
  useEffect(() => {
    // Initialize native plugins when running inside Capacitor
    if ((window as any).__capacitor?.isNativePlatform?.()) {
      StatusBar.setStyle({ style: StatusBarStyle.Dark })
      StatusBar.setBackgroundColor({ color: '#000000' })
      StatusBar.setOverlaysWebView({ overlay: false })
      SplashScreen.hide()
    }
  }, [])
  return null
}

function Root() {
  return (
    <StrictMode>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <CapacitorInit />
        <App />
      </GoogleOAuthProvider>
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
