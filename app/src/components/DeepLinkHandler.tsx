import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';

/**
 * Handles deep links and app URL opens for the Capacitor app.
 * When a user taps a https://sounditent.com/events/5 link,
 * this captures it and routes to the correct React Router path.
 */
export function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    // Only run inside Capacitor native app
    if (!(window as any).__capacitor?.isNativePlatform?.()) {
      return;
    }

    App.addListener('appUrlOpen', (data) => {
      const url = new URL(data.url);
      const path = url.pathname + url.search;

      // Route to the correct page
      if (path && path !== '/') {
        navigate(path);
      }
    });

    return () => {
      App.removeAllListeners();
    };
  }, [navigate]);

  return null;
}
