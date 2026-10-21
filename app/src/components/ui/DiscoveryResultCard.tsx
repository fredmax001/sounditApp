import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import VerificationBadge from '@/components/VerificationBadge';
interface DiscoveryResultCardProps {
  user: any;
  subtitle?: string;
  linkPath?: string;
}

const DiscoveryResultCard = ({ user, subtitle, linkPath }: DiscoveryResultCardProps) => {
  const isArtist = user.role === 'artist' || user.role === 'dj';
  const isVendor = user.role === 'vendor';
  const isBusiness = user.role === 'business' || user.role === 'organizer';
  
  // Route to the exact profile ID for each entity type:
  // - Artists require ArtistProfile.id (/artists/:id)
  // - Vendors require VendorProfile.id (/vendors/:id)
  // - Businesses & Organizers require User.id (/profiles/:user_id)
  const resolvedLink = linkPath || (
    isArtist
      ? `/artists/${user.artist_id || user.id}`
      : isVendor
        ? `/vendors/${user.vendor_id || user.id}`
        : `/profiles/${user.user_id || user.id}`
  );
  
  const displayName = isArtist 
    ? (user.artist_profile?.stage_name || user.first_name || user.name)
    : isVendor 
      ? (user.vendor_profile?.business_name || user.first_name || user.name)
      : isBusiness 
        ? (user.business_profile?.business_name || user.first_name || user.name)
        : (user.first_name || user.name);

  return (
    <Link
      to={resolvedLink}
      className="flex items-center p-2 bg-white dark:bg-[#1A1A1A] border border-black/8 dark:border-white/5 rounded-xl hover:bg-neutral-50 dark:hover:bg-[#222] transition-colors active:scale-[0.98] touch-feedback mb-2 shadow-sm dark:shadow-none"
    >
      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 mr-3 border border-black/10 dark:border-white/10">
        <img
          src={user.avatar_url || '/default-avatar.png'}
          alt={displayName}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0 justify-center">
        <div className="flex items-center gap-1">
          <h4 className="text-sm font-bold text-[#020b00] dark:text-white truncate">{displayName}</h4>
          {user.is_verified && <VerificationBadge size="sm" />}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize">
          {subtitle || user.role}
        </p>
      </div>

      <div className="pl-2">
        <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
      </div>
    </Link>
  );
};

export default DiscoveryResultCard;
