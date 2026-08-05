/**
 * MobileSearchBar — Standalone mobile search input
 * Full-width with search icon and clear button
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MobileSearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  showFiltersButton?: boolean;
  onFiltersClick?: () => void;
  className?: string;
}

const MobileSearchBar = ({
  placeholder = 'Search events, artists, venues...',
  onSearch,
  showFiltersButton = false,
  onFiltersClick,
  className = '',
}: MobileSearchBarProps) => {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      if (onSearch) {
        onSearch(query.trim());
      } else {
        navigate(`/events?search=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
    if (onSearch) onSearch('');
  };

  return (
    <form onSubmit={handleSubmit} className={`flex items-center gap-2 px-4 ${className}`}>
      <motion.div
        animate={{
          boxShadow: focused
            ? '0 0 0 2px rgba(211,218,12,0.4), 0 4px 20px rgba(0,0,0,0.3)'
            : '0 2px 10px rgba(0,0,0,0.2)',
        }}
        transition={{ duration: 0.2 }}
        className="flex-1 flex items-center gap-2.5 h-11 px-3.5 bg-[#1A1A1A] border border-white/8 rounded-2xl"
      >
        <Search className={`w-4 h-4 flex-shrink-0 transition-colors ${focused ? 'text-[#d3da0c]' : 'text-gray-500'}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
        />
        <AnimatePresence>
          {query.length > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              onClick={handleClear}
              className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
            >
              <X className="w-3 h-3 text-gray-400" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {showFiltersButton && (
        <button
          type="button"
          onClick={onFiltersClick}
          className="w-11 h-11 rounded-2xl bg-[#1A1A1A] border border-white/8 flex items-center justify-center text-gray-400 active:scale-95 transition-transform"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      )}
    </form>
  );
};

export default MobileSearchBar;
