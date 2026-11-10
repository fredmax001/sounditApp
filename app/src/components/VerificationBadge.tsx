import { Check } from 'lucide-react';

interface VerificationBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

export const VerificationBadge = ({
  size = 'md',
  className = '',
  title = 'Verified by Sound It',
}: VerificationBadgeProps) => {
  const sizes = {
    xs: { container: 'w-3.5 h-3.5 min-w-[14px]', icon: 'w-2 h-2' },
    sm: { container: 'w-4 h-4 min-w-[16px]', icon: 'w-2.5 h-2.5' },
    md: { container: 'w-5 h-5 min-w-[20px]', icon: 'w-3 h-3' },
    lg: { container: 'w-6 h-6 min-w-[24px]', icon: 'w-3.5 h-3.5' },
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-[#d3da0c] text-black shrink-0 select-none shadow-xs ${sizes[size].container} ${className}`}
      title={title}
    >
      <Check className={`${sizes[size].icon} text-black stroke-[3.5]`} />
    </span>
  );
};

export default VerificationBadge;
