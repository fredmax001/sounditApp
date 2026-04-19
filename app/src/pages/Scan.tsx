/**
 * Ticket Scanner Page
 * Mobile-optimized ticket scanning using camera
 * Works across all user roles (Admin, Business, Artist, Vendor)
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ScanLine,
  Flashlight,
  Image as ImageIcon,
  X,
  CheckCircle,
  AlertCircle,
  Ticket,
  User,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';

interface ScanResult {
  success: boolean;
  ticket?: {
    id: string;
    ticket_number: string;
    event_title: string;
    event_date: string;
    user_name: string;
    status: string;
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
  const [hasCamera, setHasCamera] = useState(true);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Request camera access
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
        setHasCamera(true);
        setIsScanning(true);
      } catch (err) {
        console.error('Camera access denied:', err);
        setHasCamera(false);
        toast.error(t('scan.cameraDenied'));
      }
    };

    initCamera();

    return () => {
      // Cleanup camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Extract token from QR code data
  const extractTokenFromQR = (qrData: string): string | null => {
    try {
      // Handle URL format: https://sounditent.com/validate/{token}
      if (qrData.includes('/validate/')) {
        const token = qrData.split('/validate/')[1];
        if (token && token.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          return token;
        }
      }

      // Handle direct UUID token format
      if (qrData.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return qrData;
      }

      return null;
    } catch {
      console.error('Error extracting token from QR');
      return null;
    }
  };

  // {t('scan.validate')} ticket by token
  const handleScan = async (code: string) => {
    if (!code || scanResult) return;

    setIsScanning(false);

    // Extract token from QR data
    const token = extractTokenFromQR(code);
    if (!token) {
      setScanResult({
        success: false,
        message: t('scan.invalidQRCode')
      });
      toast.error(t('scan.invalidQRCodeFormat'));
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/payments/validate/${token}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setScanResult({
          success: true,
          ticket: {
            id: data.ticket_id,
            ticket_number: token,
            event_title: `${t('scan.event')} ${data.event_id}`,
            event_date: data.validated_at || new Date().toLocaleString(),
            user_name: `${t('scan.user')} ${data.user_id}`,
            status: data.status
          },
          message: data.message || t('scan.ticketValidatedSuccess')
        });
        toast.success(t('scan.ticketValidated'));
      } else {
        setScanResult({
          success: false,
          message: data.message || t('scan.ticketValidationFailed')
        });

        // Show specific error messages based on status
        if (data.status === 'already_used') {
          toast.error(`${t('scan.ticketAlreadyUsed')} ${data.used_at}`);
        } else if (data.status === 'cancelled') {
          toast.error(t('scan.ticketCancelled'));
        } else if (data.status === 'ticket_not_found') {
          toast.error(t('scan.ticketNotFound'));
        } else {
          toast.error(data.message || t('scan.invalidTicket'));
        }
      }
    } catch {
      console.error('Validation error');
      setScanResult({
        success: false,
        message: t('scan.networkError')
      });
      toast.error(t('scan.validationFailed'));
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
    setIsScanning(true);
  };

  const toggleFlashlight = async () => {
    try {
      if (streamRef.current) {
        const track = streamRef.current.getVideoTracks()[0];
        const capabilities = track.getCapabilities() as unknown as { torch?: boolean };

        if (capabilities.torch) {
          await track.applyConstraints({ advanced: [{ torch: !flashlightOn }] } as unknown);
          setFlashlightOn(!flashlightOn);
        }
      }
    } catch {
      toast.error(t('scan.flashlightNotAvailable'));
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#0A0A0A]">
        <button
          onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
          className="p-2 text-white hover:bg-white/10 rounded-full"
        >
          <X className="w-6 h-6" />
        </button>
        <h1 className="text-white font-semibold">{t('scan.title')}</h1>
        <div className="w-10" />
      </div>

      {/* Scan Result Overlay */}
      {scanResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <div className="bg-[#111111] rounded-2xl p-6 w-full max-w-sm">
            {scanResult.success ? (
              <>
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-white text-xl font-bold text-center mb-2">
                  {t('scan.validTicket')}
                </h2>

                {scanResult.ticket && (
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-gray-400">
                      <Ticket className="w-5 h-5" />
                      <span className="text-white">{scanResult.ticket.ticket_number}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-400">
                      <Calendar className="w-5 h-5" />
                      <span className="text-white">{scanResult.ticket.event_title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-400">
                      <User className="w-5 h-5" />
                      <span className="text-white">{scanResult.ticket.user_name}</span>
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
                  {t('scan.invalidTicketTitle')}
                </h2>
                <p className="text-gray-400 text-center mb-6">
                  {scanResult.message}
                </p>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={resetScan}
                className="flex-1 py-3 bg-white/10 text-white rounded-xl font-medium"
              >
                {t('scan.scanAnother')}
              </button>
              <button
                onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
                className="flex-1 py-3 bg-[#d3da0c] text-black rounded-xl font-medium"
              >
                {t('scan.done')}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Camera View */}
      {!scanResult && !showManualEntry && (
        <div className="flex-1 relative">
          {hasCamera ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Scan Frame */}
              <div className="absolute inset-0 flex items-center justify-center">
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

              {/* Controls */}
              <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6">
                <button
                  onClick={toggleFlashlight}
                  className={`p-4 rounded-full ${flashlightOn ? 'bg-[#d3da0c] text-black' : 'bg-white/10 text-white'}`}
                >
                  <Flashlight className="w-6 h-6" />
                </button>

                <button
                  onClick={() => setShowManualEntry(true)}
                  className="p-4 rounded-full bg-white/10 text-white"
                >
                  <ImageIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Scan hint */}
              <div className="absolute top-8 left-0 right-0 text-center">
                <p className="text-white/60 text-sm">
                  {t('scan.positionQR')}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-4">
              <ScanLine className="w-16 h-16 text-gray-600 mb-4" />
              <p className="text-gray-400 text-center mb-4">
                {t('scan.cameraNotAvailable')}
              </p>
              <button
                onClick={() => setShowManualEntry(true)}
                className="px-6 py-3 bg-[#d3da0c] text-black rounded-xl font-medium"
              >
                {t('scan.enterCodeManually')}
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
                {t('scan.enterTicketCode')}
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={t('scan.codePlaceholder')}
                className="w-full max-w-xs px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-center text-2xl tracking-wider focus:border-[#d3da0c] focus:outline-none"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowManualEntry(false)}
                className="flex-1 py-4 bg-white/10 text-white rounded-xl font-medium"
              >
                {t('scan.back')}
              </button>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="flex-1 py-4 bg-[#d3da0c] text-black rounded-xl font-medium disabled:opacity-50"
              >{t('scan.validate')}</button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
};

export default ScanPage;
