import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Check, X, Ticket, User, Users, Calendar, Loader2, AlertCircle, Smartphone, Clock, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { Html5Qrcode } from 'html5-qrcode';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeTicketPayload = (rawValue: string): string => {
  const value = rawValue.trim();
  if (!value) return value;

  // Some legacy QR formats include prefixes (e.g. SOUNDIT:TKT-...).
  if (value.startsWith('SOUNDIT:')) {
    const parts = value.split(':');
    if (parts.length > 1 && parts[1]) {
      return parts[1].trim();
    }
  }

  try {
    const url = new URL(value);

    // Token QR format: https://domain/validate/{uuid}
    const validateMatch = url.pathname.match(/\/validate\/([^/?#]+)/i);
    if (validateMatch?.[1] && UUID_REGEX.test(validateMatch[1])) {
      return validateMatch[1];
    }

    // Manual fallback query params
    const ticketCodeFromQuery = url.searchParams.get('ticket_code') || url.searchParams.get('ticket');
    if (ticketCodeFromQuery) {
      return ticketCodeFromQuery.trim();
    }
  } catch {
    // Not a URL; use raw payload.
  }

  return value;
};

const isEventShareQr = (rawValue: string): boolean => {
  const value = rawValue.trim();
  if (!value) return false;
  if (!value.includes('/events/')) return false;
  return !value.includes('/validate/');
};

interface ValidationResult {
  valid: boolean;
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

const Scanner = () => {
  type ScannedTicket = Partial<ValidationResult['ticket']> & { qr_code?: string; message?: string };

  const { t } = useTranslation();
  const { isMobile, isTablet, isTouchDevice } = useDeviceDetection();
  const isAllowedDevice = isMobile || isTablet || isTouchDevice;

  const [scanning, setScanning] = useState(true);
  const [scannedTicket, setScannedTicket] = useState<ScannedTicket | null>(null);
  const [scanResult, setScanResult] = useState<'valid' | 'invalid' | 'used' | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Load recent scans from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('recent_scans');
    if (saved) {
      try {
        setRecentScans(JSON.parse(saved));
      } catch {
        console.error('Failed to parse recent scans');
      }
    }
  }, []);

  // Save recent scans to localStorage
  useEffect(() => {
    localStorage.setItem('recent_scans', JSON.stringify(recentScans));
  }, [recentScans]);

  // Initialize camera scanner when scanning mode is active
  useEffect(() => {
    if (!scanning || scannedTicket || !isAllowedDevice) return;

    const timer = setTimeout(() => {
      const scanner = new Html5Qrcode('scanner-video');
      html5QrCodeRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => {
            // Success
            handleScan(decodedText);
            try {
              scanner.stop();
            } catch {
              // ignore
            }
          },
          () => {
            // Failure/No QR found - ignore continuous errors
          }
        )
        .then(() => {
          setCameraReady(true);
          setScannerError(null);
        })
        .catch((err) => {
          console.error('Camera start failed:', err);
          setCameraReady(false);
          setScannerError(t('organizer.scanner.cameraError') || 'Unable to access camera. Please use manual entry.');
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .catch(() => {
            // ignore
          })
          .finally(() => {
            html5QrCodeRef.current = null;
            setCameraReady(false);
          });
      }
    };
  }, [scanning, scannedTicket, isAllowedDevice, t]);

  // Focus input when scanning (for manual fallback)
  useEffect(() => {
    if (scanning && inputRef.current) {
      inputRef.current.focus();
    }
  }, [scanning]);

  const validateTicketViaAPI = async (qrData: string): Promise<ValidationResult> => {
    const token = localStorage.getItem('auth-token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!token) {
      throw new Error(t('organizer.scanner.authRequiredError'));
    }

    // Primary: ticketing organizer validate-ticket (handles both TicketOrder and Ticket)
    try {
      const response = await fetch(`${API_BASE_URL}/ticketing/organizer/validate-ticket`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ ticket_code: qrData }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          valid: true,
          ticket: {
            id: String(Date.now()),
            ticket_number: data.ticket_code || qrData,
            attendee_name: data.user || 'Unknown',
            is_used: false,
            event: {
              id: String(Date.now()),
              title: data.event || 'Unknown Event',
              start_date: data.used_at || new Date().toISOString(),
              flyer_image: '',
            },
            ticket_tier: {
              name: 'General Admission',
              price: 0,
            },
          },
        };
      }

      return {
        valid: false,
        message: data.detail || data.message || t('organizer.scanner.invalidTicket'),
      };
    } catch (e) {
      return {
        valid: false,
        message: e instanceof Error ? e.message : t('organizer.scanner.validateError'),
      };
    }
  };

  const handleScan = useCallback(async (qrData: string) => {
    if (!qrData.trim()) return;
    const normalizedData = normalizeTicketPayload(qrData);

    // Clear any running scanner
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {
        // ignore
      }
      html5QrCodeRef.current = null;
    }

    setScanning(false);
    setIsValidating(true);
    setValidationError(null);
    setScannerError(null);
    setCameraReady(false);

    try {
      if (isEventShareQr(qrData)) {
        const message = t('organizer.scanner.invalidTicket') || 'Invalid ticket';
        setScanResult('invalid');
        setScannedTicket({
          qr_code: qrData,
          message: `${message}. This is an event share QR, not a ticket QR.`,
        });
        toast.error(`${message}. Use the attendee ticket QR from the Tickets page.`);

        const newScan: RecentScan = {
          id: Date.now().toString(),
          ticket_number: normalizedData,
          attendee_name: t('organizer.scanner.unknownAttendee'),
          event_title: t('organizer.scanner.unknownEvent'),
          scanned_at: new Date().toISOString(),
          status: 'invalid',
        };
        setRecentScans(prev => [newScan, ...prev.slice(0, 9)]);
        return;
      }

      const validation = await validateTicketViaAPI(normalizedData);

      if (!validation.valid || !validation.ticket) {
        setScanResult('invalid');
        setScannedTicket({ qr_code: normalizedData, message: validation.message });
        toast.error(validation.message || t('organizer.scanner.invalidTicket'));

        const newScan: RecentScan = {
          id: Date.now().toString(),
          ticket_number: normalizedData,
          attendee_name: t('organizer.scanner.unknownAttendee'),
          event_title: t('organizer.scanner.unknownEvent'),
          scanned_at: new Date().toISOString(),
          status: 'invalid',
        };
        setRecentScans(prev => [newScan, ...prev.slice(0, 9)]);
        return;
      }

      const ticket = validation.ticket;
      setScannedTicket(ticket);
      setScanResult('valid');
      toast.success(t('organizer.scanner.checkInSuccess'));

      const newScan: RecentScan = {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        attendee_name: ticket.attendee_name,
        event_title: ticket.event?.title || t('organizer.scanner.unknownEvent'),
        scanned_at: new Date().toISOString(),
        status: 'valid',
      };
      setRecentScans(prev => [newScan, ...prev.slice(0, 9)]);
    } catch (error) {
      console.error('Scan error:', error);
      setScanResult('invalid');
      const msg = error instanceof Error ? error.message : t('organizer.scanner.validateError');
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setIsValidating(false);
    }
  }, [t]);

  const resetScanner = () => {
    setScannedTicket(null);
    setScanResult(null);
    setValidationError(null);
    setScannerError(null);
    setCameraReady(false);
    setScanning(true);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
    }, 100);
  };

  const clearRecentScans = () => {
    setRecentScans([]);
    localStorage.removeItem('recent_scans');
    toast.success(t('organizer.scanner.clearSuccess'));
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-display text-white mb-2">
          {t('organizer.scanner.titlePrefix')} <span className="text-[#d3da0c]">{t('organizer.scanner.titleHighlight')}</span>
        </h1>
        <p className="text-gray-400">{t('organizer.scanner.subtitle')}</p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Scanner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 md:p-8"
        >
          <AnimatePresence mode="wait">
            {!scannedTicket ? (
              <motion.div
                key="scanner"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                {/* Camera Scanner */}
                <div className="relative mx-auto mb-6 max-w-sm rounded-2xl overflow-hidden bg-black" style={{ height: '320px' }}>
                  {isAllowedDevice ? (
                    <div
                      id="scanner-video"
                      className="w-full"
                      style={{ height: '320px' }}
                    ></div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                      <ScanLine className="w-12 h-12 text-gray-500 mb-3" />
                      <span className="text-sm text-gray-400">Camera scanning available on mobile devices</span>
                      <span className="text-xs text-gray-500 mt-1">Use manual entry below</span>
                    </div>
                  )}
                  {!cameraReady && !scannerError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                      <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin mb-3" />
                      <span className="text-sm text-gray-300">
                        {t('organizer.scanner.startingCamera') || 'Starting camera...'}
                      </span>
                    </div>
                  )}
                  {isValidating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin" />
                    </div>
                  )}
                </div>

                {scannerError && (
                  <div className="max-w-sm mx-auto mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{scannerError}</span>
                    </div>
                  </div>
                )}

                <p className="text-gray-400 mb-4 text-sm">
                  {t('organizer.scanner.scanPrompt') || 'Point your camera at a ticket QR code'}
                </p>

                {/* Error Display */}
                {validationError && (
                  <div className="max-w-sm mx-auto mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">{validationError}</span>
                    </div>
                  </div>
                )}

                {/* Manual Input */}
                <div className="max-w-sm mx-auto">
                  <p className="text-gray-500 text-sm mb-2">{t('organizer.scanner.inputLabel')}</p>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={t('organizer.scanner.inputPlaceholder')}
                    disabled={isValidating}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isValidating) {
                        handleScan(e.currentTarget.value);
                      }
                    }}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors text-center disabled:opacity-50"
                  />
                  <button
                    onClick={() => inputRef.current && handleScan(inputRef.current.value)}
                    disabled={isValidating}
                    className="w-full mt-3 py-2 bg-[#d3da0c] text-black font-medium rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50"
                  >
                    {isValidating ? t('organizer.scanner.validatingButton') : t('organizer.scanner.validateButton')}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center"
              >
                {/* Result Icon */}
                <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${scanResult === 'valid'
                  ? 'bg-green-500/20'
                  : scanResult === 'used'
                    ? 'bg-yellow-500/20'
                    : 'bg-red-500/20'
                  }`}>
                  {scanResult === 'valid' ? (
                    <Check className="w-12 h-12 text-green-500" />
                  ) : scanResult === 'used' ? (
                    <Ticket className="w-12 h-12 text-yellow-500" />
                  ) : (
                    <X className="w-12 h-12 text-red-500" />
                  )}
                </div>

                <h2 className={`text-2xl font-semibold mb-2 ${scanResult === 'valid'
                  ? 'text-green-500'
                  : scanResult === 'used'
                    ? 'text-yellow-500'
                    : 'text-red-500'
                  }`}>
                  {scanResult === 'valid'
                    ? t('organizer.scanner.resultValid')
                    : scanResult === 'used'
                      ? t('organizer.scanner.resultUsed')
                      : t('organizer.scanner.resultInvalid')}
                </h2>

                {scannedTicket && scanResult !== 'invalid' ? (
                  <div className="glass rounded-xl p-6 mt-6 text-left">
                    <div className="flex items-center gap-4 mb-4">
                      <img
                        src={scannedTicket.event?.flyer_image || '/event_placeholder.jpg'}
                        alt={scannedTicket.event?.title || t('organizer.scanner.eventAltFallback')}
                        className="w-16 h-16 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/event_placeholder.jpg';
                        }}
                      />
                      <div>
                        <p className="text-white font-semibold">{scannedTicket.event?.title || t('organizer.scanner.unknownEvent')}</p>
                        <p className="text-gray-400 text-sm">{scannedTicket.ticket_tier?.name || t('organizer.scanner.generalAdmission')}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Ticket className="w-4 h-4 text-[#d3da0c]" />
                        <span>{scannedTicket.ticket_number || scannedTicket.id}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <User className="w-4 h-4 text-[#d3da0c]" />
                        <span>{scannedTicket.attendee_name || t('organizer.scanner.unknownAttendee')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <Calendar className="w-4 h-4 text-[#d3da0c]" />
                        <span>{scannedTicket.event?.start_date ? new Date(scannedTicket.event.start_date).toLocaleDateString() : ''}</span>
                      </div>
                      {/* Table order extras */}
                      {(scannedTicket as { table_name?: string }).table_name && (
                        <div className="flex items-center gap-2 text-gray-400">
                          <Info className="w-4 h-4 text-[#d3da0c]" />
                          <span>Table: {(scannedTicket as { table_name?: string }).table_name}</span>
                        </div>
                      )}
                      {(scannedTicket as { guest_count?: number }).guest_count ? (
                        <div className="flex items-center gap-2 text-gray-400">
                          <Users className="w-4 h-4 text-[#d3da0c]" />
                          <span>Guests: {(scannedTicket as { guest_count?: number }).guest_count}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-xl p-6 mt-6 text-center">
                    <p className="text-gray-400">{scannedTicket.message || t('organizer.scanner.validationFailed')}</p>
                    <p className="text-gray-500 text-sm mt-2">{t('organizer.scanner.ticketIdLabel')}: {scannedTicket.qr_code || t('organizer.scanner.unknownTicketId')}</p>
                  </div>
                )}

                <button
                  onClick={resetScanner}
                  className="mt-8 px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-xl hover:bg-[#bbc10b] transition-colors"
                >
                  {t('organizer.scanner.scanAnother')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Recent Scans */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6 md:p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#d3da0c]" />
              {t('organizer.scanner.recentScans')}
            </h2>
            {recentScans.length > 0 && (
              <button
                onClick={clearRecentScans}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {t('organizer.scanner.clearAll')}
              </button>
            )}
          </div>

          {recentScans.length === 0 ? (
            <div className="text-center py-12">
              <ScanLine className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">{t('organizer.scanner.noScansYet')}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {recentScans.map((scan) => (
                <div
                  key={scan.id}
                  className={`p-4 rounded-xl border ${scan.status === 'valid'
                    ? 'bg-green-500/10 border-green-500/20'
                    : scan.status === 'used'
                      ? 'bg-yellow-500/10 border-yellow-500/20'
                      : 'bg-red-500/10 border-red-500/20'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${scan.status === 'valid'
                      ? 'text-green-400'
                      : scan.status === 'used'
                        ? 'text-yellow-400'
                        : 'text-red-400'
                      }`}>
                      {scan.status === 'valid'
                        ? t('organizer.scanner.statusValid')
                        : scan.status === 'used'
                          ? t('organizer.scanner.statusUsed')
                          : t('organizer.scanner.statusInvalid')}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(scan.scanned_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-white text-sm font-medium truncate">{scan.event_title}</p>
                  <p className="text-gray-400 text-xs truncate">{scan.ticket_number}</p>
                  {scan.attendee_name && scan.attendee_name !== t('organizer.scanner.unknownAttendee') && (
                    <p className="text-gray-500 text-xs mt-1">{scan.attendee_name}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Scanner;
