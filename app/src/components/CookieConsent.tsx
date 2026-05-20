import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X, Shield, Settings, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

const STORAGE_KEY = "soundit_cookie_consent";
const PREFERENCES_KEY = "soundit_cookie_preferences";

function getConsent(): ConsentPreferences | null {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (raw) return JSON.parse(raw);
    // Legacy fallback
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy === "accepted") {
      return { necessary: true, analytics: true, marketing: false, timestamp: new Date().toISOString() };
    }
  } catch {
    // ignore
  }
  return null;
}

function setConsent(prefs: ConsentPreferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  localStorage.setItem(STORAGE_KEY, "accepted");
}

export function hasAnalyticsConsent(): boolean {
  const consent = getConsent();
  return consent?.analytics === true;
}

export function hasMarketingConsent(): boolean {
  const consent = getConsent();
  return consent?.marketing === true;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const consent = getConsent();
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    setConsent({
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    });
    setVisible(false);
    setShowSettings(false);
  };

  const handleAcceptSelected = () => {
    setConsent({
      necessary: true,
      analytics,
      marketing,
      timestamp: new Date().toISOString(),
    });
    setVisible(false);
    setShowSettings(false);
  };

  const handleRejectAll = () => {
    setConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    });
    setVisible(false);
    setShowSettings(false);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4"
        >
          <div className="max-w-4xl mx-auto bg-[#111111] border border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center flex-shrink-0">
                <Cookie className="w-6 h-6 text-[#d3da0c]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">Cookie Consent</h3>
                  <button
                    onClick={handleRejectAll}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {!showSettings ? (
                  <>
                    <p className="text-sm text-gray-400 leading-relaxed mb-4">
                      We process your personal information to measure and improve our sites and service,
                      to assist our marketing campaigns and to provide personalised content and advertising.
                      By clicking the button on the right, you can exercise your privacy rights.
                      <span className="block mt-1 text-xs text-gray-500">
                        For more information see our{" "}
                        <button
                          onClick={() => { setVisible(false); navigate("/privacy"); }}
                          className="underline hover:text-[#d3da0c] transition-colors"
                        >
                          privacy notice
                        </button>{" "}
                        and{" "}
                        <button
                          onClick={() => { setVisible(false); navigate("/privacy"); }}
                          className="underline hover:text-[#d3da0c] transition-colors"
                        >
                          Cookies Policy
                        </button>.
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleAcceptAll}
                        className="px-5 py-2.5 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors text-sm"
                      >
                        Accept All
                      </button>
                      <button
                        onClick={handleRejectAll}
                        className="px-5 py-2.5 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors text-sm"
                      >
                        Reject Non-Essential
                      </button>
                      <button
                        onClick={() => setShowSettings(true)}
                        className="px-5 py-2.5 flex items-center gap-2 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors text-sm"
                      >
                        <Settings className="w-4 h-4" />
                        Preferences
                      </button>
                      <button
                        onClick={() => { setVisible(false); navigate("/privacy"); }}
                        className="px-5 py-2.5 flex items-center gap-2 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors text-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Exercise Privacy Rights
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-green-400" />
                          <div>
                            <p className="text-sm font-medium text-white">Necessary</p>
                            <p className="text-xs text-gray-500">Required for the site to function</p>
                          </div>
                        </div>
                        <span className="text-xs text-green-400 font-medium">Always On</span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div className="flex items-center gap-3">
                          <BarChartIcon />
                          <div>
                            <p className="text-sm font-medium text-white">Analytics</p>
                            <p className="text-xs text-gray-500">Helps us improve our platform</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={analytics}
                            onChange={(e) => setAnalytics(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d3da0c]" />
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div className="flex items-center gap-3">
                          <TargetIcon />
                          <div>
                            <p className="text-sm font-medium text-white">Marketing</p>
                            <p className="text-xs text-gray-500">Personalized ads and promotions</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={marketing}
                            onChange={(e) => setMarketing(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d3da0c]" />
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleAcceptSelected}
                        className="px-5 py-2.5 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors text-sm"
                      >
                        Save Preferences
                      </button>
                      <button
                        onClick={() => setShowSettings(false)}
                        className="px-5 py-2.5 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors text-sm"
                      >
                        Back
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BarChartIcon() {
  return (
    <svg className="w-5 h-5 text-[#d3da0c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg className="w-5 h-5 text-[#d3da0c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
