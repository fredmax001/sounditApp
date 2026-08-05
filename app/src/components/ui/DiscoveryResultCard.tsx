import { Link } from 'react-router-dom';
import { ChevronRight, BadgeCheck } from 'lucide-react';
interface DiscoveryResultCardProps {
  user: any;
  subtitle?: string;
}

const DiscoveryResultCard = ({ user, subtitle }: DiscoveryResultCardProps) => {
  const isArtist = user.role === 'artist' || user.role === 'dj';
  const isVendor = user.role === 'vendor';
  const isBusiness = user.role === 'business' || user.role === 'organizer';
  
  const targetId = user.user_id || user.id;
  
  const linkPath = isArtist 
    ? `/artists/${targetId}` 
    : isVendor 
      ? `/vendors/${targetId}` 
      : `/profiles/${targetId}`;
  
  const displayName = isArtist 
    ? (user.artist_profile?.stage_name || user.first_name)
    : isVendor 
      ? (user.vendor_profile?.business_name || user.first_name)
      : isBusiness 
        ? (user.business_profile?.business_name || user.first_name)
        : user.first_name;

  return (
    <Link
      to={linkPath}
      className="flex items-center p-2 bg-[#1A1A1A] border border-white/5 rounded-xl hover:bg-[#222] transition-colors active:scale-[0.98] touch-feedback mb-2"
    >
      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 mr-3 border border-white/10">
        <img
          src={user.avatar_url || '/default-avatar.png'}
          alt={displayName}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0 justify-center">
        <div className="flex items-center gap-1">
          <h4 className="text-sm font-bold text-white truncate">{displayName}</h4>
          {user.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
        </div>
        <p className="text-xs text-gray-400 truncate capitalize">
          {subtitle || user.role}
        </p>
      </div>

      <div className="pl-2">
        <ChevronRight className="w-4 h-4 text-gray-500" />
      </div>
    </Link>
  );
};

export default DiscoveryResultCard;
