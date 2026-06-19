import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X } from 'lucide-react';
import { useAssistantStore } from '@/store/assistantStore';

export default function AssistantButton() {
  const { isOpen, toggleOpen } = useAssistantStore();

  return (
    <motion.button
      onClick={toggleOpen}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full bg-[#d3da0c] text-black shadow-lg shadow-[#d3da0c]/20 flex items-center justify-center hover:bg-[#bbc10b] transition-colors"
      aria-label="Open Sound It Assistant"
    >
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="close"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <X className="w-6 h-6" />
          </motion.div>
        ) : (
          <motion.div
            key="open"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Bot className="w-7 h-7" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
