/**
 * MobileFilterPills - Date + category quick-filter pills for mobile
 * Matches the Eventix "Today / Tomorrow / This week" style
 */
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export type DateFilter = 'all' | 'current' | 'upcoming' | 'past';

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
  { id: 'all', label: 'All Events' },
  { id: 'current', label: 'Current Events' },
  { id: 'upcoming', label: 'Upcoming Events' },
  { id: 'past', label: 'Past Events' },
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
      <div className="grid grid-cols-2 gap-2 px-4 pb-0.5">
        {DATE_PILLS.map((pill) => {
          const isActive = activeDate === pill.id;
          return (
            <motion.button
              key={pill.id}
              whileTap={{ scale: 0.94 }}
              onClick={() => onDateChange(pill.id)}
              className={`flex w-full items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold transition-all ${
                isActive
                  ? 'bg-[#d3da0c] text-black shadow-md shadow-[#d3da0c]/30'
                  : 'bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-400 border border-black/8 dark:border-white/8 hover:bg-black/10 dark:hover:bg-white/10'
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
                    : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-black/8 dark:border-white/8'
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
