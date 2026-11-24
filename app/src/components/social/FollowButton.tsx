import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserCheck, UserPlus, Clock, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

export type FollowRelationshipState = 'self' | 'following' | 'requested' | 'follow_back' | 'follow';

interface FollowButtonProps {
  targetUserId: number | string;
  targetUsername?: string;
  initialState?: FollowRelationshipState;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'subtle' | 'pill' | 'compact';
  onFollowChange?: (newState: FollowRelationshipState, delta: number) => void;
  className?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const FollowButton: React.FC<FollowButtonProps> = ({
  targetUserId,
  targetUsername,
  initialState,
  size = 'md',
  variant = 'primary',
  onFollowChange,
  className = ''
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, session, isAuthenticated } = useAuthStore();

  const currentUserId = profile?.id ? String(profile.id) : null;
  const isSelf = currentUserId && String(targetUserId) === currentUserId;

  const [relationship, setRelationship] = useState<FollowRelationshipState>(initialState || 'follow');
  const [loading, setLoading] = useState<boolean>(!initialState && !isSelf);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Fetch relationship if initialState not provided
  useEffect(() => {
    if (initialState) {
      setRelationship(initialState);
      return;
    }
    if (isSelf || !targetUserId) {
      setRelationship('self');
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchRelationship = async () => {
      try {
        const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE_URL}/social/users/${targetUserId}/relationship`, { headers });
        if (res.ok && isMounted) {
          const data = await res.json();
          setRelationship(data.relationship || 'follow');
        }
      } catch {
        // Fallback default
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRelationship();
    return () => {
      isMounted = false;
    };
  }, [targetUserId, initialState, session?.access_token, isSelf]);

  if (isSelf || relationship === 'self') {
    return null;
  }

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isAuthenticated) {
      toast('Please sign in to follow users');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    if (submitting) return;

    const previousState = relationship;
    let nextState: FollowRelationshipState = 'follow';
    let delta = 0;

    if (relationship === 'following' || relationship === 'requested') {
      nextState = previousState === 'follow_back' ? 'follow_back' : 'follow';
      delta = -1;
    } else {
      nextState = 'following';
      delta = 1;
    }

    // Optimistic UI update
    setRelationship(nextState);
    if (onFollowChange) onFollowChange(nextState, delta);
    setSubmitting(true);

    try {
      const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');
      const isUnfollowing = previousState === 'following' || previousState === 'requested';
      const method = isUnfollowing ? 'DELETE' : 'POST';

      const res = await fetch(`${API_BASE_URL}/social/users/${targetUserId}/follow`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        const serverState = data.status === 'pending' ? 'requested' : isUnfollowing ? (data.mutual_follows ? 'follow_back' : 'follow') : 'following';
        setRelationship(serverState);
        if (isUnfollowing) {
          toast.success(targetUsername ? `Unfollowed @${targetUsername}` : 'Unfollowed');
        } else if (serverState === 'requested') {
          toast.success('Follow request sent');
        } else {
          toast.success(targetUsername ? `Following @${targetUsername}` : 'Following');
        }
      } else {
        // Rollback
        setRelationship(previousState);
        if (onFollowChange) onFollowChange(previousState, -delta);
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Could not update follow state');
      }
    } catch {
      setRelationship(previousState);
      if (onFollowChange) onFollowChange(previousState, -delta);
      toast.error('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Button sizing classes
  const sizeClasses = {
    sm: 'px-2.5 py-1 text-[0.6875rem] gap-1',
    md: 'px-3.5 py-1.5 text-xs gap-1.5',
    lg: 'px-5 py-2.5 text-sm gap-2',
    compact: 'px-2 py-0.5 text-[0.625rem] gap-1'
  }[size];

  // Visual appearance based on relationship state
  const isFollowing = relationship === 'following';
  const isRequested = relationship === 'requested';
  const isFollowBack = relationship === 'follow_back';

  let appearanceClasses = '';
  if (isFollowing) {
    appearanceClasses = isHovered
      ? 'bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25'
      : 'bg-white/10 border-white/20 text-gray-200 hover:border-white/40';
  } else if (isRequested) {
    appearanceClasses = 'bg-white/5 border-white/15 text-gray-400';
  } else if (isFollowBack) {
    appearanceClasses = 'bg-[#d3da0c] border-[#d3da0c] text-black hover:bg-[#bbc10b] shadow-md shadow-[#d3da0c]/20';
  } else {
    // Standard 'follow'
    appearanceClasses = variant === 'subtle'
      ? 'bg-white/10 border-white/20 text-white hover:bg-[#d3da0c] hover:text-black hover:border-[#d3da0c]'
      : 'bg-[#d3da0c] border-[#d3da0c] text-black hover:bg-[#bbc10b] shadow-md shadow-[#d3da0c]/15';
  }

  const roundedClasses = variant === 'pill' ? 'rounded-full' : 'rounded-xl';

  return (
    <button
      onClick={handleToggleFollow}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={loading || submitting}
      className={`inline-flex items-center justify-center font-extrabold border transition-all active:scale-95 disabled:opacity-50 select-none ${sizeClasses} ${appearanceClasses} ${roundedClasses} ${className}`}
      aria-label={isFollowing ? 'Unfollow' : 'Follow'}
    >
      {submitting || loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserCheck className="w-3.5 h-3.5" />
          <span>{isHovered ? 'Unfollow' : 'Following'}</span>
        </>
      ) : isRequested ? (
        <>
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>Requested</span>
        </>
      ) : isFollowBack ? (
        <>
          <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Follow Back</span>
        </>
      ) : (
        <>
          <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Follow</span>
        </>
      )}
    </button>
  );
};

export default FollowButton;
