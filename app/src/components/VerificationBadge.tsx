import { Check } from 'lucide-react';

interface VerificationBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VerificationBadge = ({ size = 'md', className = '' }: VerificationBadgeProps) => {
  const sizes = {
    sm: { container: 'w-4 h-4', icon: 'w-2.5 h-2.5' },
    md: { container: 'w-5 h-5', icon: 'w-3 h-3' },
    lg: { container: 'w-6 h-6', icon: 'w-3.5 h-3.5' },
  };

  return (
    <div 
      className={`inline-flex items-center justify-center rounded-full bg-[#d3da0c] ${sizes[size].container} ${className}`}
      title="Verified by Sound It"
    >
      <Check className={`${sizes[size].icon} text-black stroke-[3]`} />
    </div>
  );
};

export default VerificationBadge;
