/**
 * Device Detection Hook
 * Detects if user is on mobile browser or desktop
 * Used to switch between Mini Program style (mobile) and Full Dashboard (desktop)
 */
import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'desktop' | 'tablet';
export type PlatformType = 'web' | 'mini-program' | 'app';

interface DeviceInfo {
  deviceType: DeviceType;
  platform: PlatformType;
  isMobile: boolean;
  isDesktop: boolean;
  isTablet: boolean;
  isMiniProgram: boolean;
  isApp: boolean;
  screenWidth: number;
  screenHeight: number;
  isTouchDevice: boolean;
  userAgent: string;
}

export function useDeviceDetection(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    deviceType: 'desktop',
    platform: 'web',
    isMobile: false,
    isDesktop: true,
    isTablet: false,
    isMiniProgram: false,
    isApp: false,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    isTouchDevice: false,
    userAgent: navigator.userAgent,
  });

  useEffect(() => {
    const detectDevice = () => {
      const ua = navigator.userAgent.toLowerCase();
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      // Detect platform
      const isMiniProgram = /miniprogram|wechat|micromessenger/.test(ua) || 
                           (window as any).__wxjs_environment === 'miniprogram';
      const isApp = /soundit-app|cordova|capacitor|ionic/.test(ua);
      const isWeb = !isMiniProgram && !isApp;
      
      // Detect device type by screen size and user agent
      const isMobileUA = /mobile|android|iphone|ipad|ipod|windows phone/.test(ua);
      const isTabletUA = /ipad|tablet|android(?!.*mobile)/.test(ua);
      
      // Determine device type by screen width
      let deviceType: DeviceType = 'desktop';
      if (screenWidth < 768 || (isMobileUA && !isTabletUA)) {
        deviceType = 'mobile';
      } else if (screenWidth < 1024 || isTabletUA) {
        deviceType = 'tablet';
      }
      
      // Override for Mini Program - always use mobile layout
      if (isMiniProgram) {
        deviceType = 'mobile';
      }
      
      // Detect touch device
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      setDeviceInfo({
        deviceType,
        platform: isMiniProgram ? 'mini-program' : isApp ? 'app' : 'web',
        isMobile: deviceType === 'mobile',
        isDesktop: deviceType === 'desktop',
        isTablet: deviceType === 'tablet',
        isMiniProgram,
        isApp,
        screenWidth,
        screenHeight,
        isTouchDevice,
        userAgent: navigator.userAgent,
      });
    };

    // Initial detection
    detectDevice();

    // Throttled resize handler (max once per 200ms) to prevent layout thrashing
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const throttledDetect = () => {
      if (resizeTimeout) return;
      resizeTimeout = setTimeout(() => {
        resizeTimeout = null;
        detectDevice();
      }, 200);
    };

    // Listen for resize events
    window.addEventListener('resize', throttledDetect);
    
    // Listen for orientation change on mobile
    window.addEventListener('orientationchange', detectDevice);

    return () => {
      window.removeEventListener('resize', throttledDetect);
      window.removeEventListener('orientationchange', detectDevice);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, []);

  return deviceInfo;
}

/**
 * Hook to determine which layout to show
 */
export function useLayoutMode(): {
  isMobileLayout: boolean;
  isDesktopLayout: boolean;
  layoutMode: 'mobile' | 'desktop';
} {
  const { deviceType, isMiniProgram } = useDeviceDetection();
  
  // Mobile layout for: mobile devices, tablets in portrait, mini-programs
  const isMobileLayout = deviceType === 'mobile' || deviceType === 'tablet' || isMiniProgram;
  const isDesktopLayout = deviceType === 'desktop' && !isMiniProgram;
  
  return {
    isMobileLayout,
    isDesktopLayout,
    layoutMode: isMobileLayout ? 'mobile' : 'desktop',
  };
}

/**
 * Hook to determine layout considering user role
 * Admin users ALWAYS get desktop layout, even on mobile
 * Other roles (User, Artist, Vendor, Business) get mobile layout on mobile devices
 */
export function useRoleBasedLayout(userRole?: string | null): {
  isMobileLayout: boolean;
  isDesktopLayout: boolean;
  layoutMode: 'mobile' | 'desktop';
  isAdmin: boolean;
} {
  const { deviceType, isMiniProgram } = useDeviceDetection();
  
  // Check if user is admin
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  
  // Admin users ALWAYS get desktop layout (they need full dashboard access)
  // Non-admin users get mobile layout on mobile devices
  const shouldUseMobileLayout = !isAdmin && (deviceType === 'mobile' || deviceType === 'tablet' || isMiniProgram);
  
  return {
    isMobileLayout: shouldUseMobileLayout,
    isDesktopLayout: !shouldUseMobileLayout,
    layoutMode: shouldUseMobileLayout ? 'mobile' : 'desktop',
    isAdmin,
  };
}

export default useDeviceDetection;
