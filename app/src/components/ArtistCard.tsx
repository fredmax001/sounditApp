import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Music, Instagram } from 'lucide-react';

interface Artist {
  id: string;
  stage_name?: string;
  name?: string;
  avatar_url?: string;
  image?: string;
  genres?: string[];
  genre?: string;
}

interface ArtistCardProps {
  artist: Artist;
  variant?: 'default' | 'featured';
}

const ArtistCard = ({ artist, variant = 'default' }: ArtistCardProps) => {
  const displayName = artist.name || artist.stage_name || 'Artist';
  const imageUrl = artist.image || artist.avatar_url || '/default-avatar.jpg';
  const displayGenre = artist.genre || (artist.genres && artist.genres[0]) || 'Music';
  const isFeatured = variant === 'featured';

  // Featured variant — circular avatar with ring for horizontal scroll
  if (isFeatured) {
    return (
      <Link to={`/artists/${artist.id}`}>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group flex flex-col items-center gap-2 w-[100px]"
        >
          {/* Avatar with gradient ring */}
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] p-[2px]">
              <div className="w-full h-full rounded-full bg-[#0A0A0F] p-[2px]">
                <img
                  src={imageUrl}
                  alt={displayName}
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/default-avatar.jpg';
                  }}
                />
              </div>
            </div>
            {/* Live indicator */}
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-[#00E676] rounded-full border-2 border-[#0A0A0F]" />
          </div>

          {/* Name */}
          <div className="text-center">
            <p className="text-white text-xs font-semibold truncate max-w-[90px] group-hover:text-[#d3da0c] transition-colors">
              {displayName}
            </p>
            <p className="text-gray-500 text-[10px] truncate max-w-[90px]">{displayGenre}</p>
          </div>
        </motion.div>
      </Link>
    );
  }

  // Default variant — square card
  return (
    <Link to={`/artists/${artist.id}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="group relative"
      >
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-800">
          <img
            src={imageUrl}
            alt={displayName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/default-avatar.jpg';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
          <div className="absolute top-4 left-4 px-3 py-1 glass rounded-full">
            <span className="text-[#d3da0c] text-xs font-medium flex items-center gap-1">
              <Music className="w-3 h-3" /> {displayGenre}
            </span>
          </div>
          <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Instagram className="w-4 h-4 text-white" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-xl font-semibold text-white group-hover:text-[#d3da0c] transition-colors truncate">
              {displayName}
            </h3>
            <p className="text-gray-400 text-sm mt-1">{displayGenre} Artist</p>
          </div>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="absolute inset-0 border-2 border-[#d3da0c]/30 rounded-2xl" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default ArtistCard;
