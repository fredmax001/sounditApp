/**
 * Ticket Scanner Page
 * Mobile-optimized ticket scanning using html5-qrcode
 * Works across all user roles (Admin, Business, Artist, Vendor)
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine,
  Flashlight,
  Keyboard,
  X,
  CheckCircle,
  AlertCircle,
  Ticket,
  User,
  Calendar,
  Loader2,
  Camera,
  RefreshCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { Html5Qrcode } from 'html5-qrcode';

interface ScanResult {
  success: boolean;
  ticket?: {
    id: string;
    ticket_number: string;
    event_title: string;
    event_date: string;
    user_name: string;
    status: string;
    tier_name?: string;
  };
  message: string;
}

const ScanPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session } = useAuthStore();

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Start camera scanner
  const startScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {
        // ignore
      }
      html5QrCodeRef.current = null;
    }

    setCameraError(null);
    setScanResult(null);

    try {
      const scanner = new Html5Qrcode('scan-video-container');
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          // QR code successfully decoded
          handleScan(decodedText);
        },
        () => {
          // No QR found in frame — ignore
        }
      );

      setIsScanning(true);
      setHasCamera(true);
    } catch (err) {
      console.error('Camera start failed:', err);
      setIsScanning(false);
      setHasCamera(false);
      setCameraError(
        t('scan.cameraDenied') || 'Unable to access camera. Please check permissions or use manual entry.'
      );
    }
  }, [t]);

  // Stop camera scanner
  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {
        // ignore
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    startScanner();

    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  // Validate ticket via API
  const handleScan = async (code: string) => {
    if (!code.trim() || isValidating) return;

    setIsValidating(true);
    setScanResult(null);

    // Pause scanner while validating
    await stopScanner();

    try {
      const token = session?.access_token || localStorage.getItem('auth-token') || '';
      if (!token) {
        setScanResult({
          success: false,
          message: t('scan.authRequired') || 'Please log in to validate tickets',
        });
        toast.error(t('scan.authRequired') || 'Please log in to validate tickets');
        setIsValidating(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/ticketing/organizer/validate-ticket`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ ticket_code: code.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setScanResult({
          success: true,
          ticket: {
            id: String(data.ticket_id || ''),
            ticket_number: data.ticket_code || code,
            event_title: data.event || t('scan.unknownEvent'),
            event_date: data.event_start_date
              ? new Date(data.event_start_date).toLocaleString()
              : '',
            user_name: data.user || t('scan.unknownUser'),
            status: data.status || 'validated',
            tier_name: data.tier_name,
          },
          message: data.message || t('scan.ticketValidatedSuccess'),
        });
        toast.success(data.message || t('scan.ticketValidated'));
      } else {
        setScanResult({
          success: false,
          message: data.detail || data.message || t('scan.invalidTicket'),
        });
        toast.error(data.detail || data.message || t('scan.invalidTicket'));
      }
    } catch {
      setScanResult({
        success: false,
        message: t('scan.networkError') || 'Network error. Please try again.',
      });
      toast.error(t('scan.validationFailed') || 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setManualCode('');
    setShowManualEntry(false);
    startScanner();
  };

  const toggleFlashlight = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as unknown as { torch?: boolean };

      if (capabilities.torch) {
        await track.applyConstraints({ advanced: [{ torch: !flashlightOn }] } as unknown);
        setFlashlightOn(!flashlightOn);
      } else {
        toast.error(t('scan.flashlightNotAvailable') || 'Flashlight not available');
      }
      // Stop the temporary stream
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      toast.error(t('scan.flashlightNotAvailable') || 'Flashlight not available');
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#0A0A0A] border-b border-white/10 z-10">
        <button
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate('/');
          }}
          className="p-2 text-white hover:bg-white/10 rounded-full"
        >
          <X className="w-6 h-6" />
        </button>
        <h1 className="text-white font-semibold">{t('scan.title') || 'Ticket Scanner'}</h1>
        <div className="w-10" />
      </div>

      {/* Scan Result Overlay */}
      <AnimatePresence>
        {scanResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#111111] rounded-2xl p-6 w-full max-w-sm border border-white/5"
            >
              {scanResult.success ? (
                <>
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <h2 className="text-white text-xl font-bold text-center mb-2">
                    {t('scan.validTicket') || 'Valid Ticket'}
                  </h2>

                  {scanResult.ticket && (
                    <div className="space-y-3 mb-6">
                      <div className="bg-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <Ticket className="w-5 h-5 text-[#d3da0c]" />
                          <div>
                            <p className="text-gray-500 text-xs">{t('scan.ticketNumber') || 'Ticket'}</p>
                            <p className="text-white text-sm font-mono">{scanResult.ticket.ticket_number}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-[#d3da0c]" />
                          <div>
                            <p className="text-gray-500 text-xs">{t('scan.event') || 'Event'}</p>
                            <p className="text-white text-sm">{scanResult.ticket.event_title}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5 text-[#d3da0c]" />
                          <div>
                            <p className="text-gray-500 text-xs">{t('scan.attendee') || 'Attendee'}</p>
                            <p className="text-white text-sm">{scanResult.ticket.user_name}</p>
                          </div>
                        </div>
                        {scanResult.ticket.tier_name && (
                          <div className="flex items-center gap-3">
                            <Ticket className="w-5 h-5 text-[#d3da0c]" />
                            <div>
                              <p className="text-gray-500 text-xs">{t('scan.tier') || 'Tier'}</p>
                              <p className="text-white text-sm">{scanResult.ticket.tier_name}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <h2 className="text-white text-xl font-bold text-center mb-2">
                    {t('scan.invalidTicketTitle') || 'Invalid Ticket'}
                  </h2>
                  <p className="text-gray-400 text-center mb-6">{scanResult.message}</p>
                </>
              )}

              <div className="flex gap-3">
                <button
                  onClick={resetScan}
                  className="flex-1 py-3 bg-white/10 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  {t('scan.scanAnother') || 'Scan Another'}
                </button>
                <button
                  onClick={() => {
                    if (window.history.length > 1) navigate(-1);
                    else navigate('/');
                  }}
                  className="flex-1 py-3 bg-[#d3da0c] text-black rounded-xl font-medium"
                >
                  {t('scan.done') || 'Done'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validating overlay */}
      {isValidating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#d3da0c] animate-spin mx-auto mb-3" />
            <p className="text-white">{t('scan.validating') || 'Validating...'}</p>
          </div>
        </div>
      )}

      {/* Camera / Manual Entry */}
      {!scanResult && !showManualEntry && (
        <div className="flex-1 relative flex flex-col">
          {hasCamera !== false ? (
            <>
              {/* Scanner Viewport */}
              <div className="flex-1 relative bg-black">
                <div
                  ref={videoContainerRef}
                  id="scan-video-container"
                  className="w-full h-full"
                />

                {/* Scan Frame Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-64 h-64">
                    {/* Corner markers */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-[#d3da0c]" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-[#d3da0c]" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-[#d3da0c]" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-[#d3da0c]" />

                    {/* Scan line animation */}
                    {isScanning && (
                      <motion.div
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="absolute left-0 right-0 h-0.5 bg-[#d3da0c] shadow-[0_0_10px_#d3da0c]"
                      />
                    )}
                  </div>
                </div>

                {/* Top hint */}
                <div className="absolute top-6 left-0 right-0 text-center pointer-events-none">
                  <p className="text-white/70 text-sm font-medium">
                    {t('scan.positionQR') || 'Point camera at ticket QR code'}
                  </p>
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="bg-[#0A0A0A] border-t border-white/10 p-4 pb-safe">
                {cameraError && (
                  <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400 text-sm text-center">{cameraError}</p>
                  </div>
                )}

                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={toggleFlashlight}
                    className={`p-4 rounded-full transition-colors ${
                      flashlightOn ? 'bg-[#d3da0c] text-black' : 'bg-white/10 text-white'
                    }`}
                  >
                    <Flashlight className="w-6 h-6" />
                  </button>

                  <button
                    onClick={() => {
                      stopScanner();
                      setShowManualEntry(true);
                    }}
                    className="p-4 rounded-full bg-white/10 text-white"
                  >
                    <Keyboard className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <Camera className="w-16 h-16 text-gray-600 mb-4" />
              <p className="text-gray-400 text-center mb-4">
                {cameraError || t('scan.cameraNotAvailable') || 'Camera not available'}
              </p>
              <button
                onClick={() => {
                  setCameraError(null);
                  startScanner();
                }}
                className="px-6 py-3 bg-[#d3da0c] text-black rounded-xl font-medium mb-4"
              >
                {t('scan.retryCamera') || 'Retry Camera'}
              </button>
              <button
                onClick={() => setShowManualEntry(true)}
                className="px-6 py-3 bg-white/10 text-white rounded-xl font-medium"
              >
                {t('scan.enterCodeManually') || 'Enter Code Manually'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual Entry */}
      {showManualEntry && !scanResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 p-4 flex flex-col"
        >
          <form onSubmit={handleManualSubmit} className="flex-1 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center">
              <label className="text-white text-lg font-medium mb-4">
                {t('scan.enterTicketCode') || 'Enter Ticket Code'}
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={t('scan.codePlaceholder') || 'TKT-XXX-XXX-XXXXXXX-X'}
                className="w-full max-w-xs px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-center text-xl tracking-wider focus:border-[#d3da0c] focus:outline-none font-mono"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowManualEntry(false);
                  startScanner();
                }}
                className="flex-1 py-4 bg-white/10 text-white rounded-xl font-medium"
              >
                {t('scan.back') || 'Back'}
              </button>
              <button
                type="submit"
                disabled={!manualCode.trim() || isValidating}
                className="flex-1 py-4 bg-[#d3da0c] text-black rounded-xl font-medium disabled:opacity-50"
              >
                {isValidating ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  t('scan.validate') || 'Validate'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
};

export default ScanPage;
