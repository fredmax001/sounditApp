import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Images,
  Upload,
  FolderUp,
  Cloud,
  ExternalLink,
  Download,
  Trash2,
  Calendar,
  Building2,
  Check,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { saveImageToDevice } from '@/lib/downloadImage';
import { slugify } from '@/lib/slug';

interface EventGallerySummary {
  id: number;
  title: string;
  slug?: string;
  start_date?: string;
  end_date?: string;
  city?: string;
  flyer_image?: string;
  status?: string;
  gallery_images: string[];
  photo_album_url?: string;
}

interface GallerySummaryResponse {
  general_gallery: string[];
  general_photo_album_url?: string;
  events: EventGallerySummary[];
}

export default function BusinessGallery() {
  const { session, businessProfile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [generalGallery, setGeneralGallery] = useState<string[]>([]);
  const [generalAlbumUrl, setGeneralAlbumUrl] = useState<string>('');
  const [events, setEvents] = useState<EventGallerySummary[]>([]);

  // Selected destination: 'general' or event ID (number)
  const [targetId, setTargetId] = useState<'general' | number>('general');

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // External cloud album editing
  const [albumInput, setAlbumInput] = useState('');
  const [isSavingAlbum, setIsSavingAlbum] = useState(false);

  // Fullscreen Preview Lightbox
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/business/gallery/summary`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to load gallery data');
      const data: GallerySummaryResponse = await res.json();
      setGeneralGallery(data.general_gallery || []);
      setGeneralAlbumUrl(data.general_photo_album_url || '');
      setEvents(data.events || []);

      // Initialize albumInput based on current target
      if (targetId === 'general') {
        setAlbumInput(data.general_photo_album_url || '');
      } else {
        const evt = data.events.find(e => e.id === targetId);
        setAlbumInput(evt?.photo_album_url || '');
      }
    } catch (err) {
      console.error('Gallery summary fetch error:', err);
      toast.error('Could not load gallery media');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, targetId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Update album input when target changes
  const handleSelectTarget = (newTarget: 'general' | number) => {
    setTargetId(newTarget);
    setPreviewIndex(null);
    if (newTarget === 'general') {
      setAlbumInput(generalAlbumUrl);
    } else {
      const evt = events.find(e => e.id === newTarget);
      setAlbumInput(evt?.photo_album_url || '');
    }
  };

  // Currently active photos list
  const currentPhotos = targetId === 'general'
    ? generalGallery
    : (events.find(e => e.id === targetId)?.gallery_images || []);

  const currentEvent = targetId !== 'general'
    ? events.find(e => e.id === targetId)
    : null;

  const currentTitle = targetId === 'general'
    ? (businessProfile?.business_name || 'General Organizer & Brand Gallery')
    : (currentEvent?.title || 'Event Gallery');

  // Save Cloud Photo Album URL
  const handleSaveAlbumUrl = async () => {
    if (!session?.access_token) return;
    try {
      setIsSavingAlbum(true);
      const cleanUrl = albumInput.trim();

      if (targetId === 'general') {
        const res = await fetch(`${API_BASE_URL}/business/gallery/general`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ photo_album_url: cleanUrl || null }),
        });
        if (!res.ok) throw new Error('Failed to save cloud album link');
        setGeneralAlbumUrl(cleanUrl);
        toast.success('Cloud album link saved to general profile!');
      } else {
        const res = await fetch(`${API_BASE_URL}/business/gallery/events/${targetId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ photo_album_url: cleanUrl || null }),
        });
        if (!res.ok) throw new Error('Failed to save event cloud album link');
        setEvents(prev => prev.map(e => e.id === targetId ? { ...e, photo_album_url: cleanUrl } : e));
        toast.success(`Cloud album link saved for "${currentEvent?.title}"!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save cloud album link');
    } finally {
      setIsSavingAlbum(false);
    }
  };

  // Upload a batch of files
  const uploadFiles = async (files: File[]) => {
    if (!session?.access_token) {
      toast.error('Not authenticated');
      return;
    }

    const validFiles = files.filter(f => {
      const isImg = f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(f.name);
      if (!isImg) {
        console.warn(`Skipping non-image file: ${f.name}`);
        return false;
      }
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 20MB limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      toast.error('No valid image files found in selection');
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: validFiles.length });

    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < validFiles.length; i++) {
        setUploadProgress({ current: i + 1, total: validFiles.length });
        const file = validFiles[i];
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE_URL}/media/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
        const data = await res.json();
        if (data.url) uploadedUrls.push(data.url);
      }

      if (uploadedUrls.length > 0) {
        if (targetId === 'general') {
          const newGallery = [...generalGallery, ...uploadedUrls];
          const res = await fetch(`${API_BASE_URL}/business/gallery/general`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ gallery_images: newGallery }),
          });
          if (!res.ok) throw new Error('Failed to update general gallery');
          setGeneralGallery(newGallery);
        } else {
          const currentEvt = events.find(e => e.id === targetId);
          const newGallery = [...(currentEvt?.gallery_images || []), ...uploadedUrls];
          const res = await fetch(`${API_BASE_URL}/business/gallery/events/${targetId}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ gallery_images: newGallery }),
          });
          if (!res.ok) throw new Error('Failed to update event gallery');
          setEvents(prev => prev.map(e => e.id === targetId ? { ...e, gallery_images: newGallery } : e));
        }

        toast.success(`Successfully uploaded ${uploadedUrls.length} photo${uploadedUrls.length > 1 ? 's' : ''}!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error uploading images');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  // Remove photo from active gallery
  const handleRemovePhoto = async (indexToRemove: number) => {
    if (!session?.access_token) return;
    const updated = currentPhotos.filter((_, idx) => idx !== indexToRemove);

    try {
      if (targetId === 'general') {
        const res = await fetch(`${API_BASE_URL}/business/gallery/general`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ gallery_images: updated }),
        });
        if (!res.ok) throw new Error('Failed to delete photo');
        setGeneralGallery(updated);
      } else {
        const res = await fetch(`${API_BASE_URL}/business/gallery/events/${targetId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ gallery_images: updated }),
        });
        if (!res.ok) throw new Error('Failed to delete photo');
        setEvents(prev => prev.map(e => e.id === targetId ? { ...e, gallery_images: updated } : e));
      }

      toast.success('Photo removed');
      if (previewIndex !== null && previewIndex >= updated.length) {
        setPreviewIndex(updated.length > 0 ? updated.length - 1 : null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete photo');
    }
  };

  // Download all photos for current view
  const handleDownloadAll = async () => {
    if (currentPhotos.length === 0) return;
    toast.info(`Preparing to save ${currentPhotos.length} photo(s)...`);
    for (let i = 0; i < currentPhotos.length; i++) {
      await saveImageToDevice(currentPhotos[i], `${slugify(currentTitle)}-photo-${i + 1}.jpg`);
    }
    toast.success('Photos saved to your device!');
  };

  // Drag and Drop folder scanning helper
  const scanEntry = async (entry: any): Promise<File[]> => {
    if (entry.isFile) {
      return new Promise<File[]>((resolve) => {
        entry.file(
          (file: File) => {
            if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(file.name)) {
              resolve([file]);
            } else {
              resolve([]);
            }
          },
          () => resolve([])
        );
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const readAllEntries = async (): Promise<any[]> => {
        const all: any[] = [];
        let batch: any[] = [];
        do {
          batch = await new Promise<any[]>((resolve) => {
            reader.readEntries((ents: any[]) => resolve(ents), () => resolve([]));
          });
          all.push(...batch);
        } while (batch.length > 0);
        return all;
      };

      const entries = await readAllEntries();
      const filesNested = await Promise.all(entries.map(e => scanEntry(e)));
      return filesNested.flat();
    }
    return [];
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    const collectedFiles: File[] = [];

    if (items && items.length > 0) {
      const promises: Promise<File[]>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (typeof item.webkitGetAsEntry === 'function') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            promises.push(scanEntry(entry));
          }
        } else if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) collectedFiles.push(file);
        }
      }
      const scanned = await Promise.all(promises);
      collectedFiles.push(...scanned.flat());
    } else if (e.dataTransfer.files) {
      collectedFiles.push(...Array.from(e.dataTransfer.files));
    }

    if (collectedFiles.length > 0) {
      uploadFiles(collectedFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const totalAllPhotos = generalGallery.length + events.reduce((acc, evt) => acc + (evt.gallery_images?.length || 0), 0);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#020b00] dark:text-white flex items-center gap-2.5">
            <Images className="w-6 h-6 text-[#d3da0c]" />
            <span>Photo Gallery & Cloud Media</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload photos and connect cloud drives directly to your general organizer profile or specific events without editing past events.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-700 dark:text-gray-300 font-medium">
            Total Media: <strong className="text-[#020b00] dark:text-[#d3da0c]">{totalAllPhotos}</strong> photos
          </span>
        </div>
      </div>

      {/* Target Selector: General vs Specific Event */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl p-4 sm:p-5 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Select Destination to Manage
          </label>
          <span className="text-xs text-gray-400">
            {targetId === 'general' ? 'Managing General Profile' : `Managing Event #${targetId}`}
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {/* General Profile Pill */}
          <button
            type="button"
            onClick={() => handleSelectTarget('general')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 ${
              targetId === 'general'
                ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs ring-2 ring-[#d3da0c]/20'
                : 'bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white border border-black/5 dark:border-white/5'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>General Profile Gallery</span>
            <span className="text-[10px] opacity-80">({generalGallery.length})</span>
          </button>

          {/* Event Pills */}
          {events.map((evt) => {
            const count = evt.gallery_images?.length || 0;
            const isSelected = targetId === evt.id;
            return (
              <button
                key={evt.id}
                type="button"
                onClick={() => handleSelectTarget(evt.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 ${
                  isSelected
                    ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs ring-2 ring-[#d3da0c]/20'
                    : 'bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white border border-black/5 dark:border-white/5'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="max-w-[160px] truncate">{evt.title}</span>
                <span className="text-[10px] opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cloud Album & External Link Card */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl p-5 sm:p-6 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-[#d3da0c]" />
            <h3 className="text-base font-bold text-[#020b00] dark:text-white">
              Connect Google Cloud / Drive / External Album
            </h3>
          </div>
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            For: <span className="text-[#020b00] dark:text-white font-semibold">{currentTitle}</span>
          </span>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Paste your Google Cloud Storage bucket URL, Google Drive shared folder link, Baidu Netdisk, iCloud, or Dropbox album.
          Attendees can open this cloud album directly from your event and public profile to view and download full-resolution photos.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="url"
            value={albumInput}
            onChange={(e) => setAlbumInput(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/... or https://storage.googleapis.com/..."
            className="flex-1 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#d3da0c]"
          />
          <div className="flex items-center gap-2 shrink-0">
            {albumInput && (
              <a
                href={albumInput.startsWith('http') ? albumInput : `https://${albumInput}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-[#d3da0c] flex items-center gap-1.5 transition-colors"
                title="Test opening link"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Test Link</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleSaveAlbumUrl}
              disabled={isSavingAlbum}
              className="px-4 py-2.5 rounded-xl bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black text-xs font-bold shadow-xs active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSavingAlbum ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save Link</span>
            </button>
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone (Supports Multiple Images and Folders) */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-all ${
          isDragging
            ? 'border-[#d3da0c] bg-[#d3da0c]/10 scale-[1.01]'
            : 'border-black/15 dark:border-white/10 bg-white dark:bg-[#111111] hover:border-[#d3da0c]/40'
        }`}
      >
        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#d3da0c]/10 flex items-center justify-center text-[#d3da0c] mb-3">
            <Upload className="w-7 h-7" />
          </div>

          <h3 className="text-base font-bold text-[#020b00] dark:text-white">
            Drag & Drop Photos or Entire Folder Here
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-5">
            Drop multiple images or drop a photo folder from your computer. Supports JPG, PNG, WebP, GIF, and HEIC up to 20MB.
          </p>

          {/* Hidden Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              if (e.target.files) uploadFiles(Array.from(e.target.files));
            }}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            accept="image/*"
            multiple
            // @ts-expect-error webkitdirectory is standard for folder picker in modern browsers
            webkitdirectory=""
            directory=""
            onChange={(e) => {
              if (e.target.files) uploadFiles(Array.from(e.target.files));
            }}
            className="hidden"
          />

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black text-xs font-bold shadow-xs active:scale-95 transition-transform disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>Choose Multiple Photos</span>
            </button>

            <button
              type="button"
              disabled={isUploading}
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-[#020b00] dark:text-white text-xs font-bold hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 transition-all disabled:opacity-50"
            >
              <FolderUp className="w-4 h-4 text-[#d3da0c]" />
              <span>Upload Folder</span>
            </button>
          </div>

          {/* Real-time upload progress */}
          {uploadProgress && (
            <div className="w-full mt-5 p-3 rounded-xl bg-[#d3da0c]/10 border border-[#d3da0c]/30 text-xs text-[#020b00] dark:text-white text-left">
              <div className="flex items-center justify-between font-semibold mb-1">
                <span>Uploading photo {uploadProgress.current} of {uploadProgress.total}...</span>
                <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#d3da0c] transition-all duration-200"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Photos Grid Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#020b00] dark:text-white flex items-center gap-2">
            <span>{currentTitle} Photos</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
              ({currentPhotos.length} photo{currentPhotos.length !== 1 ? 's' : ''})
            </span>
          </h2>
        </div>

        {currentPhotos.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
            title="Download all photos in current view"
          >
            <Download className="w-3.5 h-3.5 text-[#d3da0c]" />
            <span>Download All</span>
          </button>
        )}
      </div>

      {/* Photos Grid */}
      {currentPhotos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {currentPhotos.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="group relative aspect-square rounded-2xl overflow-hidden bg-neutral-100 dark:bg-[#141414] border border-black/8 dark:border-white/5 shadow-xs"
            >
              <img
                src={url}
                alt={`Photo ${idx + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />

              {/* Hover overlay with action buttons */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewIndex(idx)}
                  className="w-8 h-8 rounded-lg bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition-colors shadow-sm"
                  title="View full image"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    toast.info('Saving photo to device...');
                    const ok = await saveImageToDevice(url, `${slugify(currentTitle)}-photo-${idx + 1}.jpg`);
                    if (ok) toast.success('Photo saved to device');
                  }}
                  className="w-8 h-8 rounded-lg bg-black/70 hover:bg-black/90 text-white hover:text-[#d3da0c] flex items-center justify-center transition-colors shadow-sm"
                  title="Save to device"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleRemovePhoto(idx)}
                  className="w-8 h-8 rounded-lg bg-red-600/80 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-sm"
                  title="Delete photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] text-white font-medium">
                #{idx + 1}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-10 text-center rounded-2xl border border-dashed border-black/15 dark:border-white/10 bg-white dark:bg-[#111111]">
          <Images className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-[#020b00] dark:text-white">No photos uploaded for this section yet</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
            Use the drag and drop area above or click "Choose Multiple Photos" / "Upload Folder" to populate this gallery.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black text-xs font-bold shadow-xs active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Photos Now</span>
          </button>
        </div>
      )}

      {/* Lightbox Modal */}
      {previewIndex !== null && currentPhotos[previewIndex] && (() => {
        const url = currentPhotos[previewIndex];
        const hasPrev = previewIndex > 0;
        const hasNext = previewIndex < currentPhotos.length - 1;
        return (
          <div
            onClick={() => setPreviewIndex(null)}
            className="fixed inset-0 bg-black/95 backdrop-blur-md flex flex-col justify-between z-50 p-4 select-none"
          >
            {/* Top Bar */}
            <div
              className="flex items-center justify-between gap-3 text-white max-w-5xl w-full mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold truncate text-white">{currentTitle}</p>
                <p className="text-xs text-gray-400">
                  Photo {previewIndex + 1} of {currentPhotos.length}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    toast.info('Saving photo to device...');
                    const ok = await saveImageToDevice(url, `${slugify(currentTitle)}-photo-${previewIndex + 1}.jpg`);
                    if (ok) toast.success('Photo saved to device');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#d3da0c] text-black text-xs font-bold shadow-xs hover:opacity-90 active:scale-95 transition-transform"
                >
                  <Download className="w-4 h-4" />
                  <span>Save to Device</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRemovePhoto(previewIndex)}
                  className="p-2 text-white/80 hover:text-red-400 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  title="Delete photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewIndex(null)}
                  className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Image */}
            <div
              className="relative flex-1 flex items-center justify-center my-2 max-w-5xl w-full mx-auto overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {hasPrev && (
                <button
                  type="button"
                  onClick={() => setPreviewIndex(previewIndex - 1)}
                  className="absolute left-2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              <img
                src={url}
                alt="Preview"
                className="max-w-full max-h-[78vh] rounded-2xl object-contain shadow-2xl"
              />

              {hasNext && (
                <button
                  type="button"
                  onClick={() => setPreviewIndex(previewIndex + 1)}
                  className="absolute right-2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-center text-xs text-gray-400 max-w-5xl w-full mx-auto pb-1"
              onClick={(e) => e.stopPropagation()}
            >
              <span>Sound It Media Manager</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
