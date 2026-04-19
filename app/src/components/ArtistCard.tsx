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
}

const ArtistCard = ({ artist }: ArtistCardProps) => {
  // Handle both DJ and Artist data formats
  const displayName = artist.name || artist.stage_name || 'Artist';
  const imageUrl = artist.image || artist.avatar_url || '/default-avatar.jpg';
  const displayGenre = artist.genre || (artist.genres && artist.genres[0]) || 'Music';

  return (
    <Link to={`/artists/${artist.id}`}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="group relative"
      >
        {/* Image Container */}
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-800">
          <img
            src={imageUrl}
            alt={displayName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/default-avatar.jpg';
            }}
          />
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
          
          {/* Genre Badge */}
          <div className="absolute top-4 left-4 px-3 py-1 glass rounded-full">
            <span className="text-[#d3da0c] text-xs font-medium flex items-center gap-1">
              <Music className="w-3 h-3" />
              {displayGenre}
            </span>
          </div>

          {/* Social Icon */}
          <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Instagram className="w-4 h-4 text-white" />
          </div>

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-xl font-semibold text-white group-hover:text-[#d3da0c] transition-colors truncate">
              {displayName}
            </h3>
            <p className="text-gray-400 text-sm mt-1">{displayGenre} Artist</p>
          </div>

          {/* Hover Glow */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="absolute inset-0 border-2 border-[#d3da0c]/30 rounded-2xl" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default ArtistCard;
