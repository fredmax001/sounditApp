import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  Plus, 
  Trash2, 
  Edit3, 
  Eye, 
  Heart,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  type LucideIcon
} from 'lucide-react';
import { useRecapsStore, type CreateRecapData, type Recap } from '../../store/recapsStore';
import { useEventStore } from '../../store/eventStore';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '@/config/api';

const MAX_PHOTOS = 20;

export default function RecapsManagement() {
  const { t } = useTranslation();
  const { 
    myRecaps, 
    isLoading, 
    fetchMyRecaps, 
    createRecap, 
    updateRecap, 
    deleteRecap,
    publishRecap
  } = useRecapsStore();
  
  const { events, fetchMyEvents } = useEventStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRecap, setEditingRecap] = useState<Recap | null>(null);
  const [selectedRecap, setSelectedRecap] = useState<Recap | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  
  // Form state
  const [formData, setFormData] = useState<CreateRecapData>({
    title: '',
    description: '',
    photos: [],
    event_id: undefined
  });

  const loadData = useCallback(() => {
    fetchMyRecaps();
    fetchMyEvents();
  }, [fetchMyRecaps, fetchMyEvents]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    try {
      await createRecap(formData);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create recap:', error);
    }
  };

  const handleUpdate = async () => {
    if (!editingRecap) return;
    try {
      await updateRecap(editingRecap.id, formData);
      setEditingRecap(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update recap:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('organizer.recaps.deleteConfirm'))) return;
    try {
      await deleteRecap(id);
    } catch (error) {
      console.error('Failed to delete recap:', error);
    }
  };

  const handlePublish = async (id: number) => {
    try {
      await publishRecap(id);
    } catch (error) {
      console.error('Failed to publish recap:', error);
    }
  };

  const openEditModal = (recap: Recap) => {
    setEditingRecap(recap);
    setFormData({
      title: recap.title,
      description: recap.description || '',
      photos: recap.photos,
      event_id: recap.event_id
    });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      photos: [],
      event_id: undefined
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const uploadPhoto = async (file: File): Promise<string> => {
    const authToken = localStorage.getItem('auth-token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!authToken) throw new Error('Authentication required');
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    const response = await fetch(`${API_BASE_URL}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: uploadForm,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Upload failed');
    }
    const data = await response.json();
    return data.url;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (formData.photos.length >= MAX_PHOTOS) {
      alert(t('organizer.recaps.maxPhotosAlert', { max: MAX_PHOTOS }));
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const url = await uploadPhoto(file);
      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, url]
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: LucideIcon; labelKey: string }> = {
      draft: { color: 'bg-gray-600', icon: Clock, labelKey: 'organizer.recaps.statusDraft' },
      pending: { color: 'bg-yellow-600', icon: Clock, labelKey: 'organizer.recaps.statusPending' },
      published: { color: 'bg-green-600', icon: CheckCircle, labelKey: 'organizer.recaps.statusPublished' },
      rejected: { color: 'bg-red-600', icon: AlertCircle, labelKey: 'organizer.recaps.statusRejected' }
    };
    
    const badge = badges[status] || badges.draft;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${badge.color} text-white`}>
        <Icon className="w-3.5 h-3.5" />
        {t(badge.labelKey)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <Camera className="w-8 h-8 text-[#d3da0c]" />
            {t('organizer.recaps.title')}
          </h1>
          <p className="text-gray-400 mt-1">
            {t('organizer.recaps.subtitle', { max: MAX_PHOTOS })}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#d3da0c] to-[#aacc00] text-black font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          {t('organizer.recaps.createRecap')}
        </button>
      </div>

      {/* Recaps Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : myRecaps.length === 0 ? (
        <div className="text-center py-20 bg-[#111] rounded-2xl border border-white/5">
          <Camera className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">{t('organizer.recaps.noRecapsTitle')}</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            {t('organizer.recaps.noRecapsDesc')}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            {t('organizer.recaps.createFirstRecap')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myRecaps.map((recap) => (
            <motion.div
              key={recap.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111] rounded-2xl overflow-hidden border border-white/5"
            >
              {/* Photo Preview */}
              <div 
                className="aspect-video relative cursor-pointer group"
                onClick={() => {
                  setSelectedRecap(recap);
                  setSelectedPhotoIndex(0);
                }}
              >
                {recap.photos[0] ? (
                  <img
                    src={recap.photos[0]}
                    alt={recap.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
                    <Camera className="w-8 h-8 text-gray-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="w-8 h-8 text-white" />
                </div>
                {recap.photos.length > 1 && (
                  <div className="absolute top-3 right-3 bg-black/70 px-2 py-1 rounded-full">
                    <span className="text-xs text-white font-medium">
                      {t('organizer.recaps.morePhotos', { count: recap.photos.length - 1 })}
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-white font-semibold line-clamp-1">{recap.title}</h3>
                  {getStatusBadge(recap.status)}
                </div>
                
                {recap.description && (
                  <p className="text-gray-400 text-sm line-clamp-2 mb-3">
                    {recap.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {recap.views_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    {recap.likes_count}
                  </span>
                  <span>{t('organizer.recaps.photoCount', { count: recap.photos.length })}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(recap)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    {t('organizer.recaps.edit')}
                  </button>
                  {recap.status === 'draft' && (
                    <button
                      onClick={() => handlePublish(recap.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#d3da0c] text-black rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <Send className="w-4 h-4" />
                      {t('organizer.recaps.submit')}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(recap.id)}
                    className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {(showCreateModal || editingRecap) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h2 className="text-xl font-bold text-white">
                  {editingRecap ? t('organizer.recaps.editRecapTitle') : t('organizer.recaps.createRecapTitle')}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingRecap(null);
                    resetForm();
                  }}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {/* Title */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    {t('organizer.recaps.titleLabel')}
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={t('organizer.recaps.titlePlaceholder')}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>

                {/* Event Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    {t('organizer.recaps.relatedEventLabel')}
                  </label>
                  <select
                    value={formData.event_id || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      event_id: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#d3da0c]"
                  >
                    <option value="">{t('organizer.recaps.selectEventPlaceholder')}</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    {t('organizer.recaps.descriptionLabel')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('organizer.recaps.descriptionPlaceholder')}
                    rows={3}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c] resize-none"
                  />
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Photos */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-400">
                      {t('organizer.recaps.photosLabel', { current: formData.photos.length, max: MAX_PHOTOS })}
                    </label>
                    <button
                      onClick={triggerFileSelect}
                      disabled={formData.photos.length >= MAX_PHOTOS || isUploadingPhoto}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d3da0c]/10 text-[#d3da0c] rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#d3da0c]/20 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      {isUploadingPhoto ? 'Uploading...' : t('organizer.recaps.addPhoto')}
                    </button>
                  </div>

                  {formData.photos.length === 0 ? (
                    <div 
                      onClick={triggerFileSelect}
                      className="aspect-video bg-[#1a1a1a] border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#d3da0c]/50 transition-colors"
                    >
                      <Camera className="w-12 h-12 text-gray-600 mb-2" />
                      <span className="text-gray-500 text-sm">{t('organizer.recaps.addPhotosPrompt')}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {formData.photos.map((photo, index) => (
                        <div key={index} className="aspect-square relative group rounded-xl overflow-hidden">
                          <img
                            src={photo}
                            alt={t('organizer.recaps.photoAlt', { number: index + 1 })}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => removePhoto(index)}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                      {formData.photos.length < MAX_PHOTOS && (
                        <button
                          onClick={triggerFileSelect}
                          disabled={isUploadingPhoto}
                          className="aspect-square bg-[#1a1a1a] border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center hover:border-[#d3da0c]/50 transition-colors disabled:opacity-50"
                        >
                          <Plus className="w-6 h-6 text-gray-500" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingRecap(null);
                    resetForm();
                  }}
                  className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
                >
                  {t('organizer.recaps.cancel')}
                </button>
                <button
                  onClick={editingRecap ? handleUpdate : handleCreate}
                  disabled={!formData.title || formData.photos.length === 0}
                  className="px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingRecap ? t('organizer.recaps.saveChanges') : t('organizer.recaps.createRecapButton')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo Viewer Modal */}
      <AnimatePresence>
        {selectedRecap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
              <button
                onClick={() => setSelectedRecap(null)}
                className="flex items-center gap-2 text-white"
              >
                <ChevronLeft className="w-5 h-5" />
                {t('organizer.recaps.back')}
              </button>
              <h3 className="text-white font-medium">{selectedRecap.title}</h3>
              <div className="w-20" />
            </div>

            {/* Photo */}
            <div className="flex-1 flex items-center justify-center relative">
              <img
                src={selectedRecap.photos[selectedPhotoIndex]}
                alt={t('organizer.recaps.photoAlt', { number: selectedPhotoIndex + 1 })}
                className="max-h-full max-w-full object-contain"
              />
              
              {/* Navigation */}
              {selectedRecap.photos.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedPhotoIndex(prev => Math.max(0, prev - 1))}
                    disabled={selectedPhotoIndex === 0}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={() => setSelectedPhotoIndex(prev => Math.min(selectedRecap.photos.length - 1, prev + 1))}
                    disabled={selectedPhotoIndex === selectedRecap.photos.length - 1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-30"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                </>
              )}

              {/* Counter */}
              <div className="absolute top-4 right-4 bg-black/60 px-4 py-2 rounded-full">
                <span className="text-white font-medium">
                  {selectedPhotoIndex + 1} / {selectedRecap.photos.length}
                </span>
              </div>
            </div>

            {/* Thumbnails */}
            {selectedRecap.photos.length > 1 && (
              <div className="p-4 bg-gradient-to-t from-black to-transparent">
                <div className="flex gap-2 overflow-x-auto">
                  {selectedRecap.photos.map((photo: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPhotoIndex(idx)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all ${
                        idx === selectedPhotoIndex ? 'ring-2 ring-[#d3da0c]' : 'opacity-50'
                      }`}
                    >
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
