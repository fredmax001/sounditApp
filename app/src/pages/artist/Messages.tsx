import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import { 
  MessageCircle, 
  Send, 
  ArrowLeft, 
  Loader2,
  Search,
  Check,
  CheckCheck
} from 'lucide-react';

interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  avatar_url?: string;
}

interface Message {
  id: number;
  content: string;
  created_at: string;
  sender_id: number;
  is_read: boolean;
  sender: User;
}

interface Conversation {
  id: number;
  participant_1_id: number;
  participant_2_id: number;
  created_at: string;
  updated_at: string;
  other_participant: User;
  last_message: Message | null;
  unread_count: number;
}

export default function Messages() {
  const { t } = useTranslation();
  const { session, profile } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch conversations
  const fetchConversations = async (silent = false) => {
    if (!session?.access_token) return;
    if (!silent) setLoadingList(true);
    
    try {
      const res = await fetch(`${API_BASE_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      if (!silent) toast.error('Failed to load conversations');
    } finally {
      if (!silent) setLoadingList(false);
    }
  };

  // Fetch messages for active conversation
  const fetchMessages = async (convId: number, silent = false) => {
    if (!session?.access_token) return;
    if (!silent) setLoadingChat(true);
    
    try {
      const res = await fetch(`${API_BASE_URL}/messages/conversations/${convId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      if (!silent) toast.error('Failed to load messages');
    } finally {
      if (!silent) setLoadingChat(false);
    }
  };

  // Send a message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeConversation || !session?.access_token) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/messages/conversations/${activeConversation.id}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ content })
      });
      
      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => [...prev, newMsg]);
        fetchConversations(true); // Update last message preview
      } else {
        toast.error('Failed to send message');
        setNewMessage(content); // restore text
      }
    } catch {
      toast.error('Network error');
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchConversations();
    
    // Polling for new conversations
    const interval = setInterval(() => {
      fetchConversations(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [session]);

  // Handle active conversation selection
  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
      
      // Clear previous polling
      if (pollingRef.current) clearInterval(pollingRef.current);
      
      // Poll active chat every 5s
      pollingRef.current = setInterval(() => {
        fetchMessages(activeConversation.id, true);
      }, 5000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeConversation, session]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredConversations = conversations.filter(c => {
    const name = c.other_participant?.display_name || c.other_participant?.first_name || 'Unknown User';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-[calc(100vh-4rem-5rem)] sm:h-[calc(100vh-4rem)] flex flex-col md:flex-row bg-[#0A0A0A]">
      {/* LEFT PANEL: Conversation List */}
      <div 
        className={`w-full md:w-80 lg:w-96 border-r border-white/5 flex flex-col h-full bg-[#111111] ${activeConversation ? 'hidden md:flex' : 'flex'}`}
      >
        <div className="p-4 border-b border-white/5">
          <h1 className="text-xl font-bold text-white mb-4">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#d3da0c]" />
            </div>
          ) : filteredConversations.length > 0 ? (
            <div className="divide-y divide-white/5">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left ${
                    activeConversation?.id === conv.id ? 'bg-white/5 border-l-2 border-[#d3da0c]' : 'border-l-2 border-transparent'
                  }`}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center overflow-hidden flex-shrink-0">
                      {conv.other_participant?.avatar_url ? (
                        <img 
                          src={conv.other_participant.avatar_url} 
                          alt="" 
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
                        />
                      ) : (
                        <span className="text-black font-bold text-lg">
                          {(conv.other_participant?.display_name || conv.other_participant?.first_name || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {conv.unread_count > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#d3da0c] text-black text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#111111]">
                        {conv.unread_count}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="text-white font-semibold text-sm truncate pr-2">
                        {conv.other_participant?.display_name || conv.other_participant?.first_name || 'Unknown User'}
                      </h3>
                      <span className="text-[10px] text-gray-500 whitespace-nowrap">
                        {conv.last_message ? new Date(conv.last_message.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-white font-medium' : 'text-gray-500'}`}>
                      {conv.last_message ? (
                        <>
                          {conv.last_message.sender_id.toString() === profile?.id?.toString() ? 'You: ' : ''}
                          {conv.last_message.content}
                        </>
                      ) : (
                        <span className="italic">No messages yet</span>
                      )}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <MessageCircle className="w-6 h-6 text-gray-500" />
              </div>
              <p className="text-gray-400 font-medium">No conversations yet</p>
              <p className="text-xs text-gray-500 mt-1 max-w-[200px]">When users message you, they will appear here.</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Active Chat */}
      <div 
        className={`flex-1 flex flex-col h-full bg-[#0A0A0A] ${!activeConversation ? 'hidden md:flex' : 'flex'}`}
      >
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-[#111111] z-10">
              <button 
                onClick={() => setActiveConversation(null)}
                className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center overflow-hidden">
                {activeConversation.other_participant?.avatar_url ? (
                  <img 
                    src={activeConversation.other_participant.avatar_url} 
                    alt="" 
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
                  />
                ) : (
                  <span className="text-black font-bold">
                    {(activeConversation.other_participant?.display_name || activeConversation.other_participant?.first_name || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-white font-semibold">
                  {activeConversation.other_participant?.display_name || activeConversation.other_participant?.first_name || 'Unknown User'}
                </h2>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
              {loadingChat ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A]/50 z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-[#d3da0c]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <MessageCircle className="w-12 h-12 mb-3 opacity-20" />
                  <p>Send a message to start the chat</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.sender_id.toString() === profile?.id?.toString();
                  const showTime = index === 0 || 
                    new Date(msg.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 300000; // 5 min gap
                  
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {showTime && (
                        <div className="text-[10px] text-gray-500 mb-2 mt-4 text-center w-full">
                          {new Date(msg.created_at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      <div 
                        className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                          isMe 
                            ? 'bg-[#d3da0c] text-black rounded-tr-sm' 
                            : 'bg-white/10 text-white rounded-tl-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[9px] text-gray-500">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && (
                          msg.is_read ? 
                            <CheckCheck className="w-3 h-3 text-[#d3da0c]" /> : 
                            <Check className="w-3 h-3 text-gray-500" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[#111111] border-t border-white/5">
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c] transition-colors resize-none min-h-[44px] max-h-32"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="w-11 h-11 rounded-full bg-[#d3da0c] text-black flex items-center justify-center flex-shrink-0 hover:bg-[#bbc10b] transition-colors disabled:opacity-50 touch-feedback"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="hidden md:flex h-full flex-col items-center justify-center text-gray-500">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-xl font-medium text-white mb-2">Your Messages</h2>
            <p>Select a conversation from the sidebar to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
