import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check, Ticket, Calendar, Download, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const PaymentSuccess = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen pt-20 pb-24 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-display text-white mb-2">{t('payment.paymentSuccessful')}</h1>
          <p className="text-gray-400">{t('payment.yourTicketsHaveBeenBookedSuccessfully')}</p>
        </motion.div>

        {/* Ticket Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6 mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-xl bg-[#d3da0c]/20 flex items-center justify-center">
              <Ticket className="w-8 h-8 text-[#d3da0c]" />
            </div>
            <div>
              <p className="text-white font-semibold">{t('payment.yourTicketsAreReady')}</p>
              <p className="text-gray-400 text-sm">{t('payment.showQrCodeAtTheEntrance')}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 mb-4">
            <QRCodeSVG
              value="SOUNDIT-BETA-TICKET-VALIDATION"
              size={200}
              className="w-full"
              level="H"
            />
          </div>

          <div className="flex gap-3">
            <button className="flex-1 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              {t('payment.downloadLabel')}
            </button>
            <button className="flex-1 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2">
              <Share2 className="w-4 h-4" />
              {t('payment.shareLabel')}
            </button>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <Link
            to="/tickets"
            className="block w-full py-4 btn-custom text-white font-semibold rounded-lg transition-colors text-center"
          >{t('payment.viewMyTickets')}</Link>
          <Link
            to="/events"
            className="block w-full py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-center"
          >{t('payment.browseMoreEvents')}</Link>
        </motion.div>

        {/* Event Reminder */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center"
        >
          <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
            <Calendar className="w-4 h-4" />
            <span>{t('payment.wellRemindYouBeforeTheEvent')}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
