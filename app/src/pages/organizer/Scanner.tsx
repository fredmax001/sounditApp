import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine,
  Check,
  X,
  Ticket,
  User,
  Users,
  Calendar,
  Loader2,
  AlertCircle,
  Zap,
  ZapOff,
  Camera,
  FlipHorizontal,
  Keyboard,
  Volume2,
  VolumeX,
  QrCode,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import type { CameraDevice } from 'html5-qrcode';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ValidationResult {
  valid: boolean;
  status?: 'valid' | 'used' | 'invalid';
  ticket?: {
    id: string;
    ticket_number: string;
    attendee_name: string;
    is_used: boolean;
    used_at?: string;
    event?: {
      id: string;
      title: string;
      start_date: string;
      flyer_image: string;
    };
    ticket_tier?: {
      name: string;
      price: number;
    };
    checked_in_by?: string;
    checked_in_at?: string;
    seat_info?: string;
    table_name?: string;
    guest_count?: number;
  };
  message?: string;
}

interface RecentScan {
  id: string;
  ticket_number: string;
  attendee_name: string;
  event_title: string;
  scanned_at: string;
  status: 'valid' | 'invalid' | 'used';
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const isEventShareQr = (rawValue: string): boolean => {
  const v = rawValue.trim().toLowerCase();
  return v.includes('/events/') && !v.includes('/validate/');
};

const hapticFeedback = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'medium') => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate([30, 50, 30]);
        break;
      case 'success':
        navigator.vibrate([20, 60, 20]);
        break;
      case 'error':
        navigator.vibrate([50, 30, 50, 30, 50]);
        break;
    }
  }
};

const playBeep = (freq = 1200, duration = 150, type: OscillatorType = 'sine') => {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {
    // ignore audio errors
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Scanner = () => {
  const { t } = useTranslation();

  /* -- state -- */
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [scanning, setScanning] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  type ScannedTicket = Partial<ValidationResult['ticket']> & { qr_code?: string; message?: string };
  const [scannedTicket, setScannedTicket] = useState<ScannedTicket | null>(null);
  const [scanResult, setScanResult] = useState<'valid' | 'invalid' | 'used' | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  /* -- scanner refs -- */
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const camerasRef = useRef<CameraDevice[]>([]);
  const currentCameraIdx = useRef(0);
  const [torchOn, setTorchOn] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [showCameraSelect, setShowCameraSelect] = useState(false);

  /* -- manual input ref -- */
  const manualInputRef = useRef<HTMLInputElement>(null);

  /* ---------------------------------------------------------------- */
  /*  Load recent scans                                               */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('soundit_recent_scans');
      if (saved) setRecentScans(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('soundit_recent_scans', JSON.stringify(recentScans));
  }, [recentScans]);

  /* ---------------------------------------------------------------- */
  /*  Start / stop camera scanner                                     */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (mode !== 'camera' || !scanning || scannedTicket || processingRef.current) {
      return;
    }

    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    if (!window.isSecureContext && !isLocalhost) {
      setScannerError('Camera requires HTTPS. Please open via https://');
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          /* 1. enumerate cameras */
          const cameras = await Html5Qrcode.getCameras();
          if (cancelled) return;
          if (!cameras?.length) {
            setScannerError('No camera found. Use manual entry below.');
            return;
          }
          camerasRef.current = cameras;

          /* 2. prefer back camera */
          const backIdx = cameras.findIndex((c) => /rear|back|environment/i.test(c.label));
          currentCameraIdx.current = backIdx >= 0 ? backIdx : 0;

          /* 3. create scanner instance */
          const scanner = new Html5Qrcode('scanner-view', {
            verbose: false,
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          });
          scannerRef.current = scanner;

          /* 4. start with preferred camera */
          await startCamera(scanner, currentCameraIdx.current);
          if (cancelled) {
            await safeStop(scanner);
            return;
          }

          setCameraReady(true);
          setScannerError(null);
        } catch (err: any) {
          console.error('Scanner init error:', err);
          const msg = err?.message || String(err);
          if (msg.toLowerCase().includes('permission')) {
            setScannerError('Camera permission denied. Allow camera access in browser settings.');
          } else if (msg.toLowerCase().includes('notfound')) {
            setScannerError('No camera found. Use manual entry below.');
          } else {
            setScannerError(msg);
          }
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void safeStop(scannerRef.current);
      scannerRef.current = null;
      setCameraReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scanning, scannedTicket]);

  /* ---------------------------------------------------------------- */
  /*  Camera control helpers                                          */
  /* ---------------------------------------------------------------- */
  const startCamera = async (scanner: Html5Qrcode, cameraIdx: number) => {
    const cam = camerasRef.current[cameraIdx];
    if (!cam) return;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      disableFlip: false,
    };

    await scanner.start(
      cam.id,
      config,
      (decodedText) => {
        if (processingRef.current) return;
        void onQrDetected(decodedText);
      },
      () => {
        /* QR not found — normal, ignore */
      }
    );
  };

  const safeStop = async (scanner: Html5Qrcode | null) => {
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch {
      /* ignore */
    }
    try {
      await scanner.clear();
    } catch {
      /* ignore */
    }
  };

  const switchCamera = async () => {
    if (!scannerRef.current || camerasRef.current.length < 2) return;
    setCameraReady(false);
    await safeStop(scannerRef.current);
    currentCameraIdx.current = (currentCameraIdx.current + 1) % camerasRef.current.length;
    try {
      await startCamera(scannerRef.current, currentCameraIdx.current);
      setCameraReady(true);
      toast.success('Camera switched');
    } catch (err: any) {
      setScannerError(err?.message || 'Failed to switch camera');
    }
  };

  const toggleTorch = async () => {
    try {
      const scanner = scannerRef.current;
      if (!scanner) return;
      const track = (scanner as any)?.getRunningTrack?.();
      if (!track) return;
      const capabilities = track.getCapabilities?.();
      if (!capabilities?.torch) {
        toast.error('Flashlight not supported on this device');
        return;
      }
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as any],
      });
      setTorchOn((p) => !p);
    } catch {
      toast.error('Flashlight not available');
    }
  };

  /* ---------------------------------------------------------------- */
  /*  QR detected → validate                                          */
  /* ---------------------------------------------------------------- */
  const onQrDetected = useCallback(async (rawValue: string) => {
    if (!rawValue.trim() || processingRef.current) return;
    processingRef.current = true;

    const value = rawValue.trim();
    console.info('[Scanner] QR detected:', value);

    /* stop camera temporarily */
    await safeStop(scannerRef.current);
    scannerRef.current = null;
    setCameraReady(false);
    setScanning(false);
    setIsValidating(true);
    setValidationError(null);

    if (soundOn) playBeep(1400, 120, 'sine');
    hapticFeedback('success');

    try {
      if (isEventShareQr(value)) {
        setScanResult('invalid');
        setScannedTicket({ qr_code: value, message: 'This is an event share QR, not a ticket QR.' });
        toast.error('Invalid ticket. Use the attendee ticket QR from the Tickets page.');
        if (soundOn) playBeep(300, 300, 'sawtooth');
        hapticFeedback('error');
        addRecentScan(value, 'invalid');
        return;
      }

      const result = await validateTicketViaAPI(value);

      if (result.status === 'used') {
        setScanResult('used');
        setScannedTicket(result.ticket || { qr_code: value, message: result.message });
        toast.error(result.message || 'Already checked in');
        if (soundOn) playBeep(400, 200, 'sawtooth');
        hapticFeedback('error');
        addRecentScan(result.ticket?.ticket_number || value, 'used', result.ticket?.attendee_name, result.ticket?.event?.title);
        return;
      }

      if (!result.valid || !result.ticket) {
        setScanResult('invalid');
        setScannedTicket({ qr_code: value, message: result.message });
        toast.error(result.message || 'Invalid ticket');
        if (soundOn) playBeep(300, 300, 'sawtooth');
        hapticFeedback('error');
        addRecentScan(value, 'invalid');
        return;
      }

      /* VALID */
      setScannedTicket(result.ticket);
      setScanResult('valid');
      toast.success('Check-in successful!');
      if (soundOn) playBeep(1800, 100, 'sine');
      setTimeout(() => soundOn && playBeep(2200, 150, 'sine'), 120);
      hapticFeedback('success');
      addRecentScan(result.ticket.ticket_number, 'valid', result.ticket.attendee_name, result.ticket.event?.title);
    } catch (err: any) {
      console.error('Scan validation error:', err);
      setScanResult('invalid');
      const msg = err?.message || 'Validation failed';
      setValidationError(msg);
      setScannedTicket({ qr_code: value, message: msg });
      toast.error(msg);
      if (soundOn) playBeep(300, 300, 'sawtooth');
      hapticFeedback('error');
      addRecentScan(value, 'invalid');
    } finally {
      processingRef.current = false;
      setIsValidating(false);
    }
  }, [soundOn]);

  /* ---------------------------------------------------------------- */
  /*  API validation                                                  */
  /* ---------------------------------------------------------------- */
  const validateTicketViaAPI = async (qrData: string): Promise<ValidationResult> => {
    const token = localStorage.getItem('auth-token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!token) throw new Error('Authentication required');

    const res = await fetch(`${API_BASE_URL}/ticketing/organizer/validate-ticket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ ticket_code: qrData }),
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      /* ignore parse errors */
    }

    const message = data.detail || data.message || 'Invalid ticket';

    if (res.ok) {
      return {
        valid: true,
        status: 'valid',
        ticket: {
          id: String(data.ticket_id || Date.now()),
          ticket_number: data.ticket_code || qrData,
          attendee_name: data.user || 'Unknown',
          is_used: false,
          event: {
            id: String(data.event_id || ''),
            title: data.event || 'Unknown Event',
            start_date: data.used_at || new Date().toISOString(),
            flyer_image: data.flyer_image || '',
          },
          ticket_tier: {
            name: data.tier_name || 'General Admission',
            price: data.tier_price || 0,
          },
        },
      };
    }

    if (res.status === 409) {
      return {
        valid: false,
        status: 'used',
        message,
        ticket: {
          id: String(data.ticket_id || Date.now()),
          ticket_number: data.ticket_code || qrData,
          attendee_name: data.user || 'Unknown',
          is_used: true,
          used_at: data.used_at,
          event: {
            id: String(data.event_id || ''),
            title: data.event || 'Unknown Event',
            start_date: data.used_at || new Date().toISOString(),
            flyer_image: '',
          },
        },
      };
    }

    return { valid: false, status: 'invalid', message };
  };

  /* ---------------------------------------------------------------- */
  /*  Recent scans helper                                             */
  /* ---------------------------------------------------------------- */
  const addRecentScan = (
    ticketNumber: string,
    status: RecentScan['status'],
    attendeeName?: string,
    eventTitle?: string
  ) => {
    const scan: RecentScan = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      ticket_number: ticketNumber,
      attendee_name: attendeeName || 'Unknown',
      event_title: eventTitle || 'Unknown Event',
      scanned_at: new Date().toISOString(),
      status,
    };
    setRecentScans((prev) => [scan, ...prev.slice(0, 49)]);
  };

  /* ---------------------------------------------------------------- */
  /*  Reset / clear                                                   */
  /* ---------------------------------------------------------------- */
  const resetScanner = () => {
    processingRef.current = false;
    setScannedTicket(null);
    setScanResult(null);
    setValidationError(null);
    setScannerError(null);
    setScanning(true);
    setMode('camera');
    setTimeout(() => {
      if (manualInputRef.current) {
        manualInputRef.current.value = '';
      }
    }, 50);
  };

  const clearHistory = () => {
    setRecentScans([]);
    localStorage.removeItem('soundit_recent_scans');
    toast.success('History cleared');
  };

  /* ---------------------------------------------------------------- */
  /*  Manual validate                                                 */
  /* ---------------------------------------------------------------- */
  const handleManualValidate = () => {
    const val = manualInputRef.current?.value.trim();
    if (!val) return;
    void onQrDetected(val);
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Ticket Scanner</h1>
            <p className="text-xs text-gray-400 mt-0.5">Scan attendee QR codes at the door</p>
          </div>
          <button
            onClick={() => setSoundOn((p) => !p)}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            title={soundOn ? 'Mute sounds' : 'Enable sounds'}
          >
            {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Mode toggle */}
        <div className="flex rounded-xl bg-white/5 p-1 mb-6">
          <button
            onClick={() => {
              setMode('camera');
              setScanning(true);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === 'camera' ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Camera Scan
          </button>
          <button
            onClick={() => {
              setMode('manual');
              setScanning(false);
              setScannerError(null);
              void safeStop(scannerRef.current);
              scannerRef.current = null;
              setCameraReady(false);
              setTimeout(() => manualInputRef.current?.focus(), 100);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === 'manual' ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            Manual Entry
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!scannedTicket ? (
            <motion.div
              key="scanner-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {mode === 'camera' ? (
                <>
                  {/* Camera view */}
                  <div
                    ref={containerRef}
                    className="relative w-full rounded-2xl overflow-hidden bg-black mb-4"
                    style={{ aspectRatio: '3/4', maxHeight: '60vh' }}
                  >
                    {/* Html5Qrcode mounts here */}
                    <div id="scanner-view" className="w-full h-full" />

                    {/* Scan frame overlay */}
                    {cameraReady && !isValidating && (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Dark overlay with cutout */}
                        <div className="absolute inset-0 bg-black/30" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="relative w-64 h-64">
                            {/* Transparent center */}
                            <div className="absolute inset-0 bg-transparent" />
                            {/* Corner brackets */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-[#d3da0c] rounded-tl-lg" />
                            <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-[#d3da0c] rounded-tr-lg" />
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-[#d3da0c] rounded-bl-lg" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-[#d3da0c] rounded-br-lg" />
                            {/* Animated scan line */}
                            <motion.div
                              className="absolute left-0 right-0 h-0.5 bg-[#d3da0c]/80 shadow-[0_0_10px_#d3da0c]"
                              animate={{ top: ['0%', '100%', '0%'] }}
                              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                            />
                            {/* Label */}
                            <div className="absolute -bottom-8 left-0 right-0 text-center">
                              <span className="text-xs text-white/70 bg-black/50 px-3 py-1 rounded-full">
                                Align QR code within frame
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Starting spinner */}
                    {!cameraReady && !scannerError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                        <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin mb-3" />
                        <span className="text-sm text-gray-300">Starting camera…</span>
                        <span className="text-xs text-gray-500 mt-1">Allow camera access when prompted</span>
                      </div>
                    )}

                    {/* Validating overlay */}
                    {isValidating && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                        <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin mb-3" />
                        <span className="text-sm text-gray-300">Validating ticket…</span>
                      </div>
                    )}

                    {/* Camera controls */}
                    {cameraReady && !isValidating && (
                      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3 pointer-events-auto">
                        <button
                          onClick={switchCamera}
                          className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                          title="Switch camera"
                        >
                          <FlipHorizontal className="w-5 h-5" />
                        </button>
                        <button
                          onClick={toggleTorch}
                          className={`w-12 h-12 rounded-full backdrop-blur flex items-center justify-center transition-colors ${
                            torchOn ? 'bg-[#d3da0c] text-black' : 'bg-black/60 text-white hover:bg-black/80'
                          }`}
                          title="Toggle flashlight"
                        >
                          {torchOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Camera error */}
                  {scannerError && (
                    <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-yellow-400 text-sm font-medium">Camera unavailable</p>
                          <p className="text-yellow-400/70 text-sm mt-1">{scannerError}</p>
                          <button
                            onClick={() => {
                              setScannerError(null);
                              setScanning(false);
                              setTimeout(() => setScanning(true), 50);
                            }}
                            className="mt-2 text-xs bg-yellow-500/20 text-yellow-400 px-3 py-1.5 rounded-lg hover:bg-yellow-500/30 transition-colors"
                          >
                            Retry Camera
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Manual entry mode */
                <div className="glass rounded-2xl p-6 mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#d3da0c]/20 flex items-center justify-center">
                      <Keyboard className="w-5 h-5 text-[#d3da0c]" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">Manual Ticket Entry</h3>
                      <p className="text-gray-400 text-sm">Type the ticket code below</p>
                    </div>
                  </div>
                  <input
                    ref={manualInputRef}
                    type="text"
                    placeholder="Enter ticket code (e.g. TKT-42-7-ABC12345-1)"
                    disabled={isValidating}
                    onKeyDown={(e) => e.key === 'Enter' && !isValidating && handleManualValidate()}
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors text-center font-mono text-lg mb-3 disabled:opacity-50"
                  />
                  <button
                    onClick={handleManualValidate}
                    disabled={isValidating}
                    className="w-full py-3.5 bg-[#d3da0c] text-black font-semibold rounded-xl hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Validating…
                      </>
                    ) : (
                      <>
                        <ScanLine className="w-5 h-5" />
                        Validate Ticket
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Validation error */}
              {validationError && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-2 text-red-400">
                    <X className="w-5 h-5" />
                    <span className="text-sm">{validationError}</span>
                  </div>
                </div>
              )}

              {/* Tips */}
              <div className="text-center">
                <p className="text-gray-500 text-xs">
                  Point camera at the attendee&apos;s QR code on their Tickets page
                </p>
              </div>
            </motion.div>
          ) : (
            /* Result card */
            <motion.div
              key="result-panel"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="glass rounded-2xl p-6 md:p-8"
            >
              {/* Result icon */}
              <div className="text-center mb-6">
                <div
                  className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4 ${
                    scanResult === 'valid'
                      ? 'bg-green-500/20'
                      : scanResult === 'used'
                        ? 'bg-yellow-500/20'
                        : 'bg-red-500/20'
                  }`}
                >
                  {scanResult === 'valid' ? (
                    <Check className="w-12 h-12 text-green-500" />
                  ) : scanResult === 'used' ? (
                    <Ticket className="w-12 h-12 text-yellow-500" />
                  ) : (
                    <X className="w-12 h-12 text-red-500" />
                  )}
                </div>
                <h2
                  className={`text-2xl font-bold ${
                    scanResult === 'valid'
                      ? 'text-green-500'
                      : scanResult === 'used'
                        ? 'text-yellow-500'
                        : 'text-red-500'
                  }`}
                >
                  {scanResult === 'valid'
                    ? 'Valid Ticket'
                    : scanResult === 'used'
                      ? 'Already Used'
                      : 'Invalid Ticket'}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {scanResult === 'valid'
                    ? 'Check-in successful'
                    : scanResult === 'used'
                      ? 'This ticket was already scanned'
                      : scannedTicket.message || 'Ticket validation failed'}
                </p>
              </div>

              {/* Ticket details */}
              {(scanResult === 'valid' || scanResult === 'used') && scannedTicket.event && (
                <div className="bg-white/5 rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <img
                      src={scannedTicket.event.flyer_image || '/event_placeholder.jpg'}
                      alt={scannedTicket.event.title}
                      className="w-16 h-16 rounded-lg object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/event_placeholder.jpg';
                      }}
                    />
                    <div>
                      <p className="text-white font-semibold">{scannedTicket.event.title}</p>
                      <p className="text-gray-400 text-sm">
                        {scannedTicket.ticket_tier?.name || 'General Admission'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center gap-3 text-gray-300">
                      <Ticket className="w-4 h-4 text-[#d3da0c]" />
                      <span className="font-mono">{scannedTicket.ticket_number}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-300">
                      <User className="w-4 h-4 text-[#d3da0c]" />
                      <span>{scannedTicket.attendee_name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-300">
                      <Calendar className="w-4 h-4 text-[#d3da0c]" />
                      <span>
                        {scannedTicket.event.start_date
                          ? new Date(scannedTicket.event.start_date).toLocaleDateString()
                          : ''}
                      </span>
                    </div>
                    {scannedTicket.table_name && (
                      <div className="flex items-center gap-3 text-gray-300">
                        <InfoIcon className="w-4 h-4 text-[#d3da0c]" />
                        <span>Table: {scannedTicket.table_name}</span>
                      </div>
                    )}
                    {scannedTicket.guest_count ? (
                      <div className="flex items-center gap-3 text-gray-300">
                        <Users className="w-4 h-4 text-[#d3da0c]" />
                        <span>Guests: {scannedTicket.guest_count}</span>
                      </div>
                    ) : null}
                    {scannedTicket.is_used && scannedTicket.used_at && (
                      <div className="flex items-center gap-3 text-yellow-400">
                        <ClockIcon className="w-4 h-4" />
                        <span>Used: {new Date(scannedTicket.used_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Invalid detail */}
              {scanResult === 'invalid' && scannedTicket.qr_code && (
                <div className="bg-white/5 rounded-xl p-5 mb-6 text-center">
                  <p className="text-gray-400 text-sm mb-2">Scanned data:</p>
                  <code className="text-xs text-gray-500 font-mono break-all bg-black/30 px-3 py-2 rounded-lg block">
                    {scannedTicket.qr_code}
                  </code>
                </div>
              )}

              <button
                onClick={resetScanner}
                className="w-full py-3.5 bg-[#d3da0c] text-black font-semibold rounded-xl hover:bg-[#bbc10b] transition-colors flex items-center justify-center gap-2"
              >
                <ScanLine className="w-5 h-5" />
                Scan Another Ticket
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent scans */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-[#d3da0c]" />
              Recent Scans
            </h2>
            {recentScans.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {recentScans.length === 0 ? (
            <div className="text-center py-12 bg-white/5 rounded-2xl">
              <ScanLine className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No scans yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentScans.map((scan) => (
                <div
                  key={scan.id}
                  className={`p-4 rounded-xl border ${
                    scan.status === 'valid'
                      ? 'bg-green-500/5 border-green-500/20'
                      : scan.status === 'used'
                        ? 'bg-yellow-500/5 border-yellow-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        scan.status === 'valid'
                          ? 'text-green-400'
                          : scan.status === 'used'
                            ? 'text-yellow-400'
                            : 'text-red-400'
                      }`}
                    >
                      {scan.status}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(scan.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-white text-sm font-medium truncate">{scan.event_title}</p>
                  <p className="text-gray-500 text-xs font-mono truncate">{scan.ticket_number}</p>
                  {scan.attendee_name && scan.attendee_name !== 'Unknown' && (
                    <p className="text-gray-500 text-xs mt-0.5">{scan.attendee_name}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Tiny inline icons to avoid import bloat                            */
/* ------------------------------------------------------------------ */
const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
);
const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

export default Scanner;
