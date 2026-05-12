import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Send, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';

interface Review {
  id: number;
  rating: number;
  comment: string | null;
  event_type?: string;
  is_verified: boolean;
  created_at: string;
  reviewer: {
    id?: number;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface ReviewsSectionProps {
  entityId: number;
  entityType: 'artist' | 'vendor' | 'business' | 'organizer';
  entityName: string;
}

function getReviewEndpoint(entityType: string, entityId: number, method: 'GET' | 'POST') {
  switch (entityType) {
    case 'artist':
      return `${API_BASE_URL}/bookings/artists/${entityId}/reviews`;
    case 'vendor':
      return `${API_BASE_URL}/reviews/vendors/${entityId}`;
    case 'business':
      return `${API_BASE_URL}/reviews/businesses/${entityId}`;
    case 'organizer':
      return `${API_BASE_URL}/reviews/organizers/${entityId}`;
    default:
      return '';
  }
}

function canWriteReview(entityType: string) {
  // Artist reviews are created via booking flow, not direct POST
  return entityType !== 'artist';
}

function StarRating({ rating, size = 'sm', interactive = false, onRate }: { rating: number; size?: 'sm' | 'md' | 'lg'; interactive?: boolean; onRate?: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  const sizeClass = size === 'lg' ? 'w-8 h-8' : size === 'md' ? 'w-6 h-6' : 'w-4 h-4';

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onRate?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
        >
          <Star
            className={`${sizeClass} ${
              star <= (hover || rating)
                ? 'text-[#d3da0c] fill-[#d3da0c]'
                : 'text-gray-600'
            } transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ReviewsSection({ entityId, entityType, entityName }: ReviewsSectionProps) {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const url = getReviewEndpoint(entityType, entityId, 'GET');
      if (!url) {
        setReviews([]);
        return;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReviews(Array.isArray(data) ? data : []);
      } else {
        setReviews([]);
      }
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [entityId, entityType]);

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const starCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) {
      toast.info('Please log in to write a review');
      return;
    }
    if (formRating < 1) {
      toast.error('Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      const url = getReviewEndpoint(entityType, entityId, 'POST');
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          rating: formRating,
          comment: formComment.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast.success('Review submitted successfully');
        setFormRating(0);
        setFormComment('');
        setShowForm(false);
        await fetchReviews();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to submit review');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#111111] border border-white/5 rounded-xl p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          {t('reviews.title') || 'Reviews'}
          {reviews.length > 0 && (
            <span className="text-gray-400 text-sm font-normal ml-2">({reviews.length})</span>
          )}
        </h2>
        {canWriteReview(entityType) && session?.access_token && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-[#d3da0c] text-black text-sm font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
          >
            {showForm ? (t('reviews.cancel') || 'Cancel') : (t('reviews.writeReview') || 'Write a Review')}
          </button>
        )}
      </div>

      {/* Rating Summary */}
      <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="text-center">
            <p className="text-5xl font-bold text-white">{averageRating.toFixed(1)}</p>
            <div className="flex items-center justify-center gap-1 my-2">
              <StarRating rating={Math.round(averageRating)} size="md" />
            </div>
            <p className="text-gray-400 text-sm">{reviews.length} {t('reviews.reviews') || 'reviews'}</p>
          </div>
          <div className="flex-1 w-full space-y-2">
            {starCounts.map(({ star, count }) => {
              const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm w-8 text-right">{star}</span>
                  <Star className="w-3 h-3 text-gray-500" />
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#d3da0c] rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-gray-500 text-sm w-8">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Write Review Form */}
      {showForm && canWriteReview(entityType) && (
        <form onSubmit={handleSubmit} className="bg-[#111111] border border-white/5 rounded-xl p-6 space-y-4">
          <h3 className="text-white font-semibold">{t('reviews.rate') || 'Rate'} {entityName}</h3>
          <div>
            <label className="block text-gray-400 text-sm mb-2">{t('reviews.yourRating') || 'Your Rating'}</label>
            <StarRating rating={formRating} size="lg" interactive onRate={setFormRating} />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-2">{t('reviews.yourReview') || 'Your Review'}</label>
            <textarea
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none resize-none"
              placeholder={t('reviews.placeholder') || 'Share your experience...'}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || formRating < 1}
              className="px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('reviews.submitting') || 'Submitting...'}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t('reviews.submit') || 'Submit Review'}
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="bg-[#111111] border border-white/5 rounded-xl p-8 text-center">
            <Star className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">{t('reviews.noReviews') || 'No reviews yet.'}</p>
            {canWriteReview(entityType) && session?.access_token && (
              <p className="text-gray-500 text-sm mt-1">{t('reviews.beFirst') || 'Be the first to write a review!'}</p>
            )}
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="bg-[#111111] border border-white/5 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {review.reviewer?.avatar_url ? (
                    <img
                      src={review.reviewer.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center text-black font-bold text-sm">
                      {(review.reviewer?.first_name?.[0] || 'U').toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-white font-medium text-sm">
                      {review.reviewer?.first_name || ''} {review.reviewer?.last_name || ''}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {review.created_at
                        ? new Date(review.created_at).toLocaleDateString()
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <StarRating rating={review.rating} size="sm" />
                </div>
              </div>
              {review.comment && <p className="text-gray-300 text-sm leading-relaxed">{review.comment}</p>}
              {review.is_verified && (
                <span className="inline-flex items-center gap-1 text-[#d3da0c] text-xs mt-2">
                  <CheckCircle className="w-3 h-3" />
                  {t('reviews.verified') || 'Verified booking'}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}


