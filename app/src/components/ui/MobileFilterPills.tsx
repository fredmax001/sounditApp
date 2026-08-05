/**
 * MobileFilterPills — Date + category quick-filter pills for mobile
 * Matches the Eventix "Today / Tomorrow / This week" style
 */
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export type DateFilter = 'all' | 'today' | 'tomorrow' | 'this_week' | 'this_weekend';

interface DatePill {
  id: DateFilter;
  label: string;
}

interface MobileFilterPillsProps {
  activeDate: DateFilter;
  onDateChange: (filter: DateFilter) => void;
  activeCategory?: string;
  onCategoryChange?: (cat: string) => void;
  categories?: string[];
  showCategoryRow?: boolean;
}

const DATE_PILLS: DatePill[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'this_week', label: 'This week' },
  { id: 'this_weekend', label: 'Weekend' },
];

const DEFAULT_CATEGORIES = ['Music', 'Nightlife', 'Sports', 'Art', 'Food', 'Film', 'Business', 'Culture'];

const MobileFilterPills = ({
  activeDate,
  onDateChange,
  activeCategory = '',
  onCategoryChange,
  categories = DEFAULT_CATEGORIES,
  showCategoryRow = true,
}: MobileFilterPillsProps) => {
  return (
    <div className="space-y-2.5">
      {/* Date filter row */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 pb-0.5">
        {DATE_PILLS.map((pill) => {
          const isActive = activeDate === pill.id;
          return (
            <motion.button
              key={pill.id}
              whileTap={{ scale: 0.94 }}
              onClick={() => onDateChange(pill.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                isActive
                  ? 'bg-[#d3da0c] text-black shadow-md shadow-[#d3da0c]/30'
                  : 'bg-white/5 text-gray-400 border border-white/8'
              }`}
            >
              {pill.label}
              {isActive && pill.id !== 'all' && (
                <span
                  className="w-3.5 h-3.5 rounded-full bg-black/20 flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDateChange('all');
                  }}
                >
                  <X className="w-2 h-2" />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Category filter row */}
      {showCategoryRow && onCategoryChange && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 pb-0.5">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <motion.button
                key={cat}
                whileTap={{ scale: 0.94 }}
                onClick={() => onCategoryChange(isActive ? '' : cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                  isActive
                    ? 'bg-[#FF2D8F]/15 text-[#FF2D8F] border border-[#FF2D8F]/40'
                    : 'bg-white/5 text-gray-500 border border-white/8'
                }`}
              >
                {cat}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MobileFilterPills;
