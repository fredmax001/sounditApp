import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, Image, FileText, X, Loader2, Upload, Sparkles,
  Calendar, ShoppingBag, MessageSquare, HelpCircle, Ticket, Music, Mail
} from 'lucide-react';
import { useAssistantStore } from '@/store/assistantStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import EventDraftCard from './EventDraftCard';
import ProductDraftCard from './ProductDraftCard';

interface AssistantDrawerProps {
  mode?: 'public' | 'dashboard';
}

export default function AssistantDrawer({ mode = 'public' }: AssistantDrawerProps) {
  const { isOpen, setOpen, messages, isLoading, isUploading, sessionId, sendMessage, extractEvent, extractProducts, fetchDrafts, drafts, discardDraft, setUserContext } = useAssistantStore();
  const { session, profile, isAuthenticated } = useAuthStore();
  const location = useLocation();
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'drafts'>('chat');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMode, setPendingMode] = useState<'event' | 'product' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = session?.access_token;
  const isDashboard = mode === 'dashboard';

  // Update SIA user context when location or profile changes
  useEffect(() => {
    setUserContext({
      current_page: location.pathname,
      user_id: profile?.id,
      user_name: profile?.first_name || profile?.display_name,
      user_type: profile?.role_type || profile?.role,
      mode,
    });
  }, [location.pathname, profile, mode, setUserContext]);

  useEffect(() => {
    if (isOpen && token) {
      fetchDrafts(token);
    }
  }, [isOpen, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Reset to chat tab when switching from dashboard (drafts visible) to public mode
  useEffect(() => {
    if (!isDashboard && activeTab === 'drafts') {
      setActiveTab('chat');
    }
  }, [isDashboard, activeTab]);

  const handleSend = async () => {
    if (!input.trim() || !token) return;
    await handleSendWithText(input.trim());
  };

  const handleSendWithText = async (text: string) => {
    if (!text || !token) return;
    setInput('');
    await sendMessage(text, token);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (mode: 'event' | 'product') => {
    setPendingMode(mode);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !pendingMode) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File too large (max 10MB)');
      return;
    }

    try {
      if (pendingMode === 'event') {
        await extractEvent(file, undefined, token);
      } else {
        await extractProducts(file, undefined, token);
      }
      setActiveTab('drafts');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setPendingMode(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const publicWelcome = `👋 Hi${profile?.first_name ? ` ${profile.first_name}` : ''}, I'm **SIA** — your Sound It Assistant.\n\nI can help you discover events, find DJs, buy tickets, and answer platform questions. Try the quick actions below or ask me anything.`;

  const dashboardWelcome = `👋 Hi${profile?.first_name ? ` ${profile.first_name}` : ''}, I'm **SIA** — your dashboard assistant.\n\nI can speed up your workflow: upload a flyer to create an event draft, or upload a menu to generate product drafts. Everything stays as a draft until you review and publish.`;

  const welcomeMessage = isDashboard ? dashboardWelcome : publicWelcome;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/60 z-[90] md:hidden"
          />
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 right-0 md:bottom-24 md:right-6 z-[95] w-full md:w-[420px] h-[80vh] md:h-[600px] bg-[#0A0A0A] border border-white/10 rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#111111]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#d3da0c]/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#d3da0c]" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">SIA</h3>
                  <p className="text-gray-500 text-xs">Sound It Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`p-2 rounded-lg transition-colors ${activeTab === 'chat' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                {isDashboard && (
                  <button
                    onClick={() => setActiveTab('drafts')}
                    className={`p-2 rounded-lg transition-colors ${activeTab === 'drafts' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'chat' ? (
                <div className="h-full flex flex-col">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Welcome */}
                    {messages.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#d3da0c]/10 flex-shrink-0 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-[#d3da0c]" />
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-200 whitespace-pre-line">
                          {welcomeMessage}
                        </div>
                      </motion.div>
                    )}

                    {messages.map((msg, idx) => {
                      const payload = msg.payload_json || {};
                      const suggestedActions = (payload.suggested_actions || []) as string[];
                      const relatedEvents = (payload.related_events || []) as Array<{
                        id: number;
                        title: string;
                        start_date?: string;
                        venue?: string;
                        ticket_price?: number;
                        cover_image?: string;
                      }>;
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                          {msg.role === 'user' ? (
                            <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center">
                              <span className="text-xs text-white">You</span>
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#d3da0c]/10 flex-shrink-0 flex items-center justify-center">
                              <Bot className="w-4 h-4 text-[#d3da0c]" />
                            </div>
                          )}
                          <div className="max-w-[80%]">
                            <div
                              className={`px-4 py-3 text-sm whitespace-pre-line rounded-2xl ${
                                msg.role === 'user'
                                  ? 'bg-[#d3da0c] text-black rounded-tr-sm'
                                  : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm'
                              }`}
                            >
                              {msg.content}
                            </div>
                            {msg.role === 'assistant' && suggestedActions.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {suggestedActions.map((action, aidx) => (
                                  <button
                                    key={aidx}
                                    onClick={() => { setInput(action); handleSendWithText(action); }}
                                    className="px-2.5 py-1 bg-white/5 hover:bg-[#d3da0c]/10 border border-white/10 hover:border-[#d3da0c]/30 rounded-full text-[11px] text-gray-400 hover:text-[#d3da0c] transition-colors"
                                  >
                                    {action}
                                  </button>
                                ))}
                              </div>
                            )}
                            {msg.role === 'assistant' && relatedEvents.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {relatedEvents.map((evt) => (
                                  <a
                                    key={evt.id}
                                    href={`/events/${evt.id}`}
                                    onClick={(e) => { e.preventDefault(); window.location.href = `/events/${evt.id}`; }}
                                    className="flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors group"
                                  >
                                    {evt.cover_image ? (
                                      <img src={evt.cover_image} alt="" className="w-10 h-10 rounded object-cover" />
                                    ) : (
                                      <div className="w-10 h-10 rounded bg-[#d3da0c]/10 flex items-center justify-center">
                                        <Calendar className="w-4 h-4 text-[#d3da0c]" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs text-white font-medium truncate group-hover:text-[#d3da0c]">{evt.title}</p>
                                      <p className="text-[10px] text-gray-500 truncate">
                                        {evt.start_date} {evt.venue ? `• ${evt.venue}` : ''}
                                        {evt.ticket_price ? ` • ¥${evt.ticket_price}` : ''}
                                      </p>
                                    </div>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                    {isLoading && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#d3da0c]/10 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-[#d3da0c]" />
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-[#d3da0c]" />
                          <span className="text-sm text-gray-400">SIA is thinking...</span>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Quick actions */}
                  {isAuthenticated && isDashboard && (
                    <div className="px-4 py-2 border-t border-white/10 flex gap-2 overflow-x-auto">
                      <button
                        onClick={() => handleFileSelect('event')}
                        disabled={isUploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-gray-300 whitespace-nowrap transition-colors"
                      >
                        <Image className="w-3.5 h-3.5" /> Upload flyer
                      </button>
                      <button
                        onClick={() => handleFileSelect('product')}
                        disabled={isUploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-gray-300 whitespace-nowrap transition-colors"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" /> Upload menu
                      </button>
                    </div>
                  )}
                  {isAuthenticated && !isDashboard && (
                    <div className="px-4 py-2 border-t border-white/10 flex gap-2 overflow-x-auto">
                      <button
                        onClick={() => { const q = 'Find events near me'; setInput(q); handleSendWithText(q); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-gray-300 whitespace-nowrap transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Find events
                      </button>
                      <button
                        onClick={() => { const q = 'How do I buy tickets?'; setInput(q); handleSendWithText(q); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-gray-300 whitespace-nowrap transition-colors"
                      >
                        <Ticket className="w-3.5 h-3.5" /> Buy tickets
                      </button>
                      <button
                        onClick={() => { const q = 'Recommend some DJs'; setInput(q); handleSendWithText(q); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-gray-300 whitespace-nowrap transition-colors"
                      >
                        <Music className="w-3.5 h-3.5" /> DJs
                      </button>
                      <button
                        onClick={() => { const q = 'What is the refund policy?'; setInput(q); handleSendWithText(q); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-gray-300 whitespace-nowrap transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5" /> Refunds
                      </button>
                      <button
                        onClick={() => { const q = 'How do I contact support?'; setInput(q); handleSendWithText(q); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-gray-300 whitespace-nowrap transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" /> Support
                      </button>
                    </div>
                  )}

                  {/* Input */}
                  <div className="p-4 border-t border-white/10 bg-[#111111]">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isAuthenticated ? "Ask SIA anything..." : "Log in to chat with SIA"}
                        disabled={!isAuthenticated || isLoading}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-[#d3da0c]/40 focus:outline-none resize-none max-h-32"
                        rows={1}
                      />
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() || !isAuthenticated || isLoading}
                        className="p-3 bg-[#d3da0c] hover:bg-[#bbc10b] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-black transition-colors"
                      >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      </button>
                    </div>
                    {!isAuthenticated && (
                      <p className="text-xs text-gray-500 mt-2">Please log in to use SIA's AI features.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto p-4 space-y-4">
                  <h4 className="text-white font-semibold text-sm">Your Drafts</h4>
                  {drafts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>No drafts yet.</p>
                      <p className="text-xs mt-1">
                        {isDashboard ? 'Upload a flyer or menu to get started.' : 'Drafts appear here when you upload flyers or menus from your dashboard.'}
                      </p>
                    </div>
                  ) : (
                    drafts.map((draft) => (
                      <div key={draft.id}>
                        {draft.draft_type === 'event' ? (
                          <EventDraftCard draft={draft} onUpdated={() => token && fetchDrafts(token)} />
                        ) : (
                          <ProductDraftCard draft={draft} onUpdated={() => token && fetchDrafts(token)} />
                        )}
                        {draft.status === 'draft' && (
                          <button
                            onClick={() => token && discardDraft(draft.id, token)}
                            className="mt-2 text-xs text-gray-500 hover:text-red-400 transition-colors"
                          >
                            Discard draft
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
