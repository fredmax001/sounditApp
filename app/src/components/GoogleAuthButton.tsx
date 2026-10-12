import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '247782235504-cn5jtjv983t1i1isied107dlrgf1vifs.apps.googleusercontent.com';
let nativeGoogleInitialization: Promise<void> | undefined;

const initializeNativeGoogle = () => {
  if (!GOOGLE_CLIENT_ID) {
    return Promise.reject(new Error('Google sign-in is not configured.'));
  }

  nativeGoogleInitialization ??= SocialLogin.initialize({
    google: { webClientId: GOOGLE_CLIENT_ID },
  }).catch((error: unknown) => {
    nativeGoogleInitialization = undefined;
    throw error;
  });

  return nativeGoogleInitialization;
};

interface GoogleAuthButtonProps {
  text: 'signin_with' | 'signup_with';
  buttonLabel: string;
  onToken: (token: string) => void | Promise<void>;
  onError: (error?: unknown) => void;
}

const GoogleAuthButton = ({ text, buttonLabel, onToken, onError }: GoogleAuthButtonProps) => {
  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const [nativeReady, setNativeReady] = useState(!isAndroidNative);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAndroidNative) return;

    let isMounted = true;
    initializeNativeGoogle()
      .then(() => {
        if (isMounted) setNativeReady(true);
      })
      .catch((error: unknown) => {
        console.error('Native Google sign-in initialization failed', error);
        if (isMounted) setNativeReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, [isAndroidNative]);

  const handleWebSuccess = (response: CredentialResponse) => {
    if (!response.credential) {
      onError(new Error('Google did not return an ID token.'));
      return;
    }
    void onToken(response.credential);
  };

  const handleNativeLogin = async () => {
    setIsLoading(true);
    try {
      await initializeNativeGoogle();
      const { result } = await SocialLogin.login({
        provider: 'google',
        options: {
          filterByAuthorizedAccounts: false,
        },
      });
      if (result.responseType !== 'online' || !result.idToken) {
        throw new Error('Google did not return an ID token.');
      }
      await onToken(result.idToken);
    } catch (error) {
      console.error('Native Google sign-in failed:', error);
      onError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAndroidNative) {
    return (
      <GoogleLogin
        onSuccess={handleWebSuccess}
        onError={() => onError()}
        useOneTap
        theme="filled_black"
        shape="pill"
        text={text}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleNativeLogin()}
      disabled={isLoading || !nativeReady}
      className="flex min-h-10 items-center justify-center gap-3 rounded-full border border-white/20 bg-white px-5 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span aria-hidden="true" className="text-lg font-bold text-[#4285F4]">G</span>
      {isLoading ? 'Connecting to Google...' : buttonLabel}
    </button>
  );
};

export default GoogleAuthButton;
