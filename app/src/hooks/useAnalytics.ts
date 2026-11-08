import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Analytics } from "../lib/analytics";

export function useAnalytics() {
  const location = useLocation();
  const lastPath = useRef<string>("");
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Initialize comprehensive tracking once
    if (!cleanupRef.current) {
      cleanupRef.current = Analytics.initAnalytics();
    }
  }, []);

  useEffect(() => {
    const path = location.pathname + location.search;
    if (path === lastPath.current) return;
    lastPath.current = path;

    // Track page view
    Analytics.trackPageView(path, document.referrer);
  }, [location]);
}

export default useAnalytics;
