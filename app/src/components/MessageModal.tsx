import { useState } from 'react';
import { X, Send, Loader2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';

interface MessageModalProps {
  recipientId: number;
  recipientName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function MessageModal({ recipientId, recipientName, isOpen, onClose }: MessageModalProps) {
  const { session } = useAuthStore();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!session?.access_token) {
      toast.info('Please log in to send messages');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create or find conversation
      let conversationId: number | null = null;
      try {
        const createRes = await fetch(`${API_BASE_URL}/messages/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ participant_id: recipientId }),
        });

        if (createRes.ok) {
          const convData = await createRes.json();
          conversationId = convData.id;
        } else if (createRes.status === 400) {
          // Conversation may already exist — fetch and find it
          const listRes = await fetch(`${API_BASE_URL}/messages/conversations`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (listRes.ok) {
            const conversations = await listRes.json();
            const existing = conversations.find(
              (c: { participant_1_id: number; participant_2_id: number }) =>
                c.participant_1_id === recipientId || c.participant_2_id === recipientId
            );
            if (existing) {
              conversationId = existing.id;
            }
          }
        }
      } catch {
        toast.error('Failed to start conversation');
        setLoading(false);
        return;
      }

      if (!conversationId) {
        toast.error('Could not find or create conversation');
        setLoading(false);
        return;
      }

      // Step 2: Send message
      const msgRes = await fetch(`${API_BASE_URL}/messages/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content: message.trim() }),
      });

      if (msgRes.ok) {
        toast.success('Message sent');
        setMessage('');
        onClose();
      } else {
        const err = await msgRes.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to send message');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#d3da0c]/10 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-[#d3da0c]" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Send Message</h3>
                  <p className="text-gray-400 text-sm">To {recipientName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-[#d3da0c] outline-none resize-none"
                placeholder="Type your message..."
                disabled={loading}
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-5 border-t border-white/10">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-5 py-2.5 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={loading || !message.trim()}
                className="px-5 py-2.5 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
