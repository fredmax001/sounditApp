import React from 'react';
import { PlaySquare, Users, Camera } from 'lucide-react';
import { useHaptic } from '@/hooks/useHaptic';

export type RecapsTab = 'reels' | 'community' | 'events';

interface RecapsSegmentNavProps {
  activeTab: RecapsTab;
  onTabChange: (tab: RecapsTab) => void;
  className?: string;
}

export const RecapsSegmentNav: React.FC<RecapsSegmentNavProps> = ({
  activeTab,
  onTabChange,
  className = '',
}) => {
  const { trigger } = useHaptic();

  const handleSelect = (tab: RecapsTab) => {
    trigger('light');
    onTabChange(tab);
  };

  return (
    <div
      className={`inline-flex items-center p-1 rounded-full bg-black/60 dark:bg-black/75 backdrop-blur-xl border border-white/15 shadow-md ${className}`}
    >
      <button
        type="button"
        onClick={() => handleSelect('reels')}
        className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
          activeTab === 'reels'
            ? 'bg-[#d3da0c] text-black shadow-sm'
            : 'text-gray-300 hover:text-white'
        }`}
        aria-label="Reels Tab"
      >
        <PlaySquare className="w-3.5 h-3.5" />
        <span>Reels</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect('community')}
        className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
          activeTab === 'community'
            ? 'bg-[#d3da0c] text-black shadow-sm'
            : 'text-gray-300 hover:text-white'
        }`}
        aria-label="Community Tab"
      >
        <Users className="w-3.5 h-3.5" />
        <span>Community</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect('events')}
        className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
          activeTab === 'events'
            ? 'bg-[#d3da0c] text-black shadow-sm'
            : 'text-gray-300 hover:text-white'
        }`}
        aria-label="Event Recaps Tab"
      >
        <Camera className="w-3.5 h-3.5" />
        <span>Event Recaps</span>
      </button>
    </div>
  );
};

export default RecapsSegmentNav;
