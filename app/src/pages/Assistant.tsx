import { useEffect } from 'react';
import { useAssistantStore } from '@/store/assistantStore';
import { useAuthStore } from '@/store/authStore';
import { Bot, Sparkles } from 'lucide-react';

export default function AssistantPage() {
  const { setOpen } = useAssistantStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Open the global assistant drawer automatically on this page
    setOpen(true);
  }, [setOpen]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-20 pb-24 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-20 h-20 bg-[#d3da0c]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-[#d3da0c]" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Sound It Assistant</h1>
        <p className="text-gray-400 mb-8">
          SIA is your AI assistant for discovering events, buying tickets, finding DJs, and answering platform questions.
          {isAuthenticated
            ? ' The assistant panel is open — start chatting below.'
            : ' Log in to access all AI features.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
            <Bot className="w-6 h-6 text-[#d3da0c] mb-3" />
            <h3 className="text-white font-semibold mb-1">Ask Anything</h3>
            <p className="text-gray-500 text-sm">Get help with events, tickets, vendors, and platform navigation.</p>
          </div>
          <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
            <Sparkles className="w-6 h-6 text-purple-400 mb-3" />
            <h3 className="text-white font-semibold mb-1">Create Drafts</h3>
            <p className="text-gray-500 text-sm">Upload flyers or menus to generate event and product drafts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
