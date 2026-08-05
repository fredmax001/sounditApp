/**
 * MobileSectionHeader — Consistent section header with label, title, and "See all" link
 */
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface MobileSectionHeaderProps {
  label?: string;
  title: string;
  seeAllPath?: string;
  seeAllLabel?: string;
  accentColor?: string;
}

const MobileSectionHeader = ({
  label,
  title,
  seeAllPath,
  seeAllLabel = 'See all',
  accentColor = '#d3da0c',
}: MobileSectionHeaderProps) => {
  return (
    <div className="flex items-end justify-between mb-3 px-4">
      <div>
        {label && (
          <span
            className="block text-[10px] font-semibold uppercase tracking-widest mb-0.5"
            style={{ color: accentColor }}
          >
            {label}
          </span>
        )}
        <h2 className="text-[17px] font-bold text-white leading-tight">{title}</h2>
      </div>
      {seeAllPath && (
        <Link
          to={seeAllPath}
          className="flex items-center gap-0.5 text-sm font-medium"
          style={{ color: accentColor }}
        >
          {seeAllLabel}
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
};

export default MobileSectionHeader;
