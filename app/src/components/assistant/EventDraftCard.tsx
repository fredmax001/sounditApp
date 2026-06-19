import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Ticket, Tag, AlertCircle, Check, Loader2, Edit3, ExternalLink } from 'lucide-react';
import { useAssistantStore, type AssistantDraft, type ExtractedEvent } from '@/store/assistantStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

interface EventDraftCardProps {
  draft: AssistantDraft;
  onUpdated?: () => void;
}

export default function EventDraftCard({ draft, onUpdated }: EventDraftCardProps) {
  const { session } = useAuthStore();
  const { updateDraft, publishDraft } = useAssistantStore();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editPayload, setEditPayload] = useState<ExtractedEvent>(
    (draft.payload_json as unknown as ExtractedEvent) || {}
  );

  const event = (draft.payload_json as unknown as ExtractedEvent) || {};
  const token = session?.access_token;

  const missing = event.missing_fields || [];
  const canPublish = event.title && event.start_date && event.start_time && !isPublishing;

  const handleSave = async () => {
    if (!token) return;
    await updateDraft(draft.id, editPayload as unknown as Record<string, unknown>, token);
    setIsEditing(false);
    toast.success('Draft updated');
    onUpdated?.();
  };

  const handlePublish = async () => {
    if (!token) return;
    if (missing.length > 0) {
      toast.error(`Please fill missing fields: ${missing.join(', ')}`);
      setIsEditing(true);
      return;
    }
    setIsPublishing(true);
    try {
      const result = await publishDraft(draft.id, token);
      toast.success(result.message || 'Event published as draft');
      if (result.event_id) {
        // Optionally navigate to edit page
        window.open(`/dashboard/business/events/${result.event_id}/edit`, '_blank');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  };

  const display = isEditing ? editPayload : event;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-[#d3da0c]/30 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-white font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#d3da0c]" />
            {isEditing ? (
              <input
                value={editPayload.title || ''}
                onChange={(e) => setEditPayload({ ...editPayload, title: e.target.value })}
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white"
                placeholder="Event title"
              />
            ) : (
              event.title || 'Untitled Event'
            )}
          </h4>
          {missing.length > 0 && !isEditing && (
            <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Missing: {missing.join(', ')}
            </p>
          )}
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
        >
          {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm">
        <div className="flex items-center gap-2 text-gray-300">
          <Calendar className="w-4 h-4 text-gray-500" />
          {isEditing ? (
            <div className="flex gap-2">
              <input
                type="date"
                value={editPayload.start_date || ''}
                onChange={(e) => setEditPayload({ ...editPayload, start_date: e.target.value })}
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs"
              />
              <input
                type="time"
                value={editPayload.start_time || ''}
                onChange={(e) => setEditPayload({ ...editPayload, start_time: e.target.value })}
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs"
              />
            </div>
          ) : (
            <span>
              {event.start_date || '—'} {event.start_time ? `at ${event.start_time}` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-gray-300">
          <MapPin className="w-4 h-4 text-gray-500" />
          {isEditing ? (
            <input
              value={editPayload.venue || ''}
              onChange={(e) => setEditPayload({ ...editPayload, venue: e.target.value })}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs flex-1"
              placeholder="Venue"
            />
          ) : (
            <span>{event.venue || '—'}</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-gray-300">
          <Ticket className="w-4 h-4 text-gray-500" />
          {isEditing ? (
            <input
              type="number"
              value={editPayload.ticket_price ?? ''}
              onChange={(e) => setEditPayload({ ...editPayload, ticket_price: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs"
              placeholder="Price"
            />
          ) : (
            <span>{event.ticket_price !== undefined ? `¥${event.ticket_price}` : '—'}</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-gray-300">
          <Tag className="w-4 h-4 text-gray-500" />
          <span className="text-gray-400 text-xs">
            {(event.tags || []).join(', ') || 'No tags'}
          </span>
        </div>
      </div>

      {isEditing && (
        <button
          onClick={handleSave}
          className="w-full py-2 bg-white/10 hover:bg-white/15 text-white text-sm rounded-lg transition-colors"
        >
          Save Changes
        </button>
      )}

      <button
        onClick={handlePublish}
        disabled={!canPublish}
        className="w-full py-2 bg-[#d3da0c] hover:bg-[#bbc10b] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm rounded-lg flex items-center justify-center gap-2"
      >
        {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
        {isPublishing ? 'Publishing...' : 'Publish as Draft Event'}
      </button>
    </motion.div>
  );
}
