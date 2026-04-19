import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar, MapPin, Clock, Users, DollarSign, Plus, X, Upload, Loader2, AlertCircle,
  Ticket, ChevronLeft, Shield, Music, ImageIcon, CreditCard, Tag, Trash2,
  Check, QrCode, Copy
} from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface TicketTierData {
  id: string;
  name: string;
  price: string;
  quantity: string;
  description: string;
  saleStartDate: string;
  saleEndDate: string;
  maxPerPerson: string;
  originalId?: string;
}

interface EventFormData {
  title: string;
  titleCN: string;
  description: string;
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  venue: string;
  address: string;
  city: string;
  capacity: string;
  image: string;
  tags: string[];
  eventType: string;
  refundPolicy: string;
  requireId: boolean;
  ticketPrice: string;
}

const EVENT_TYPES = ['Party', 'Concert', 'Festival', 'Day Party', 'Rooftop Party', 'Club Night', 'Live Music', 'DJ Set'];
const REFUND_POLICIES = ['Non-refundable', 'Full refund', 'Partial refund', 'Exchange only'];

const SectionCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-[#111111] border border-white/10 rounded-2xl p-6 ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon className="w-5 h-5 text-[#d3da0c]" />
    <h3 className="text-white font-semibold text-lg">{title}</h3>
  </div>
);

const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-gray-400 text-sm mb-2">
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </label>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors ${props.className || ''}`}
  />
);

const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors resize-none ${props.className || ''}`}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none transition-colors appearance-none cursor-pointer ${props.className || ''}`}
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
      backgroundSize: '20px',
      ...props.style,
    }}
  />
);

const EditEvent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: eventId } = useParams<{ id: string }>();
  const { currentEvent, fetchEventById, updateEvent, isLoading, addTicketTier: addTicketTierStore, updateTicketTier, deleteTicketTier } = useEventStore();
  const { profile, businessProfile, fetchBusinessProfile, session } = useAuthStore();
  const token = session?.access_token;

  const [isLoadingEvent, setIsLoadingEvent] = useState(true);

  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    titleCN: '',
    description: '',
    date: '',
    time: '',
    endDate: '',
    endTime: '',
    venue: '',
    address: '',
    city: '',
    capacity: '',
    image: '',
    tags: [],
    eventType: '',
    refundPolicy: 'Non-refundable',
    requireId: false,
    ticketPrice: '',
  });

  const [ticketTiers, setTicketTiers] = useState<TicketTierData[]>([]);
  const [originalTierIds, setOriginalTierIds] = useState<Set<string>>(new Set());

  const [newTag, setNewTag] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Load event data
  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      setIsLoadingEvent(true);
      try {
        await fetchEventById(eventId);
      } catch {
        toast.error(t('organizer.manageEvents.loadErrorToast'));
        navigate('/dashboard/business/events');
      } finally {
        setIsLoadingEvent(false);
      }
    };
    load();
  }, [eventId, fetchEventById, navigate, t]);

  // Populate form when currentEvent loads
  useEffect(() => {
    if (!currentEvent) return;

    // Parse dates
    const start = currentEvent.start_date ? new Date(currentEvent.start_date) : null;
    const end = currentEvent.end_date ? new Date(currentEvent.end_date) : null;

    // Parse description for venue
    let venue = '';
    let description = currentEvent.description || '';
    const venueMatch = description.match(/^Venue:\s*(.+?)(?:,\s*(.+))?\n\n([\s\S]*)$/);
    if (venueMatch) {
      venue = venueMatch[1] || '';
      description = venueMatch[3] || '';
    } else {
      venue = currentEvent.address || '';
    }

    setFormData({
      title: currentEvent.title || '',
      titleCN: currentEvent.title_cn || '',
      description,
      date: start ? start.toISOString().split('T')[0] : '',
      time: start ? start.toTimeString().slice(0, 5) : '',
      endDate: end ? end.toISOString().split('T')[0] : '',
      endTime: end ? end.toTimeString().slice(0, 5) : '',
      venue,
      address: currentEvent.address || '',
      city: currentEvent.city ? currentEvent.city.charAt(0).toUpperCase() + currentEvent.city.slice(1) : '',
      capacity: currentEvent.capacity ? String(currentEvent.capacity) : '',
      image: currentEvent.flyer_image || '',
      tags: currentEvent.tags || [],
      eventType: currentEvent.event_type || '',
      refundPolicy: currentEvent.refund_policy || 'Non-refundable',
      requireId: currentEvent.require_id || false,
      ticketPrice: currentEvent.ticket_price != null ? String(currentEvent.ticket_price) : '',
    });

    // Gallery
    if (currentEvent.gallery_images?.length) {
      setGalleryPreviews(currentEvent.gallery_images);
    }

    // Ticket tiers
    if (currentEvent.ticket_tiers?.length) {
      const tiers = currentEvent.ticket_tiers.map((tier) => ({
        id: tier.id,
        originalId: tier.id,
        name: tier.name || '',
        price: tier.price != null ? String(tier.price) : '',
        quantity: tier.quantity != null ? String(tier.quantity) : '',
        description: tier.description || '',
        saleStartDate: tier.sale_start ? tier.sale_start.split('T')[0] : '',
        saleEndDate: tier.sale_end ? tier.sale_end.split('T')[0] : '',
        maxPerPerson: tier.max_per_order != null ? String(tier.max_per_order) : '10',
      }));
      setTicketTiers(tiers);
      setOriginalTierIds(new Set(tiers.map(t => t.id)));
    } else {
      setTicketTiers([{
        id: '1',
        name: 'General Admission',
        price: '',
        quantity: '',
        description: '',
        saleStartDate: '',
        saleEndDate: '',
        maxPerPerson: '10',
      }]);
      setOriginalTierIds(new Set());
    }
  }, [currentEvent]);

  useEffect(() => {
    const loadBusinessProfile = async () => {
      if (!businessProfile && profile?.id) {
        try {
          await fetchBusinessProfile();
        } catch {
          toast.warning(t('organizer.createEvent.businessProfileWarning'));
        }
      }
    };
    loadBusinessProfile();
  }, [profile, businessProfile, fetchBusinessProfile, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleTicketTierChange = (id: string, field: keyof TicketTierData, value: string) => {
    setTicketTiers(tiers => tiers.map(tier =>
      tier.id === id ? { ...tier, [field]: value } : tier
    ));
  };

  const addTicketTier = () => {
    if (ticketTiers.length >= 4) {
      toast.error(t('organizer.createEvent.maxTiersError'));
      return;
    }
    const newId = String(Date.now());
    setTicketTiers([...ticketTiers, {
      id: newId,
      name: '',
      price: '',
      quantity: '',
      description: '',
      saleStartDate: '',
      saleEndDate: '',
      maxPerPerson: '10',
    }]);
  };

  const removeTicketTier = (id: string) => {
    if (ticketTiers.length <= 1) {
      toast.error(t('organizer.createEvent.minTiersError'));
      return;
    }
    setTicketTiers(tiers => tiers.filter(tier => tier.id !== id));
  };

  const handleAddTag = () => {
    if (newTag && !formData.tags.includes(newTag)) {
      setFormData({ ...formData, tags: [...formData.tags, newTag] });
      setNewTag('');
    }
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('organizer.createEvent.invalidImageError'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('organizer.createEvent.imageSizeError'));
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData(prev => ({ ...prev, image: e.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleGallerySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`Skipped ${file.name}: not an image`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Skipped ${file.name}: exceeds 5MB`);
        return false;
      }
      return true;
    });

    setGalleryFiles(prev => [...prev, ...validFiles]);
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setGalleryPreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeGalleryImage = (index: number) => {
    // If index is within existing gallery previews that came from server (not new files)
    const serverImagesCount = galleryPreviews.length - galleryFiles.length;
    if (index < serverImagesCount) {
      // It's a server image, just remove from previews
      setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      // It's a new file
      const fileIndex = index - serverImagesCount;
      setGalleryFiles(prev => prev.filter((_, i) => i !== fileIndex));
      setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
    }
  };


  const uploadFile = async (file: File): Promise<string> => {
    const authToken = localStorage.getItem('auth-token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!authToken) throw new Error(t('organizer.createEvent.authRequiredError'));
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    const response = await fetch(`${API_BASE_URL}/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: formDataUpload,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || t('organizer.createEvent.uploadImageError'));
    }
    const data = await response.json();
    return data.url;
  };

  const uploadFlyer = async (): Promise<string> => {
    if (!imageFile) return formData.image;
    setIsUploadingImage(true);
    try {
      return await uploadFile(imageFile);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const uploadGallery = async (): Promise<string[]> => {
    if (galleryFiles.length === 0) return galleryPreviews;
    setIsUploadingGallery(true);
    try {
      // existing server images + newly uploaded
      const serverImagesCount = galleryPreviews.length - galleryFiles.length;
      const existingUrls = galleryPreviews.slice(0, serverImagesCount);
      const newUrls = await Promise.all(galleryFiles.map(file => uploadFile(file)));
      return [...existingUrls, ...newUrls];
    } finally {
      setIsUploadingGallery(false);
    }
  };

  const createTicketTierApi = async (eventId: number, tier: TicketTierData, authToken: string) => {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/ticket-tiers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: tier.name,
        price: parseFloat(tier.price),
        quantity: parseInt(tier.quantity),
        description: tier.description,
        currency: 'CNY',
        max_per_order: parseInt(tier.maxPerPerson) || 10,
        sale_start: tier.saleStartDate ? `${tier.saleStartDate}T00:00:00` : undefined,
        sale_end: tier.saleEndDate ? `${tier.saleEndDate}T23:59:59` : undefined,
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `Failed to create tier: ${tier.name}`);
    }
    return response.json();
  };

  const handleSubmit = async () => {
    if (!eventId) return;
    if (!formData.title.trim()) {
      toast.error(t('organizer.createEvent.titleRequired'));
      return;
    }
    if (!formData.date) {
      toast.error(t('organizer.createEvent.dateRequired'));
      return;
    }
    if (!formData.time) {
      toast.error(t('organizer.createEvent.timeRequired'));
      return;
    }
    if (!formData.venue.trim()) {
      toast.error(t('organizer.createEvent.venueRequired'));
      return;
    }
    if (!formData.city.trim()) {
      toast.error(t('organizer.createEvent.cityRequired'));
      return;
    }
    if (!formData.capacity || parseInt(formData.capacity) < 1) {
      toast.error(t('organizer.createEvent.capacityRequired'));
      return;
    }
    if (!formData.image && !imageFile) {
      toast.error(t('organizer.createEvent.flyerRequired'));
      return;
    }

    for (const tier of ticketTiers) {
      if (!tier.name.trim()) {
        toast.error(t('organizer.createEvent.tierNameRequired', { id: tier.id }));
        return;
      }
      const tierPrice = parseFloat(tier.price);
      if (isNaN(tierPrice) || tierPrice < 0) {
        toast.error(t('organizer.createEvent.tierPriceRequired', { name: tier.name }));
        return;
      }
      if (!tier.quantity || parseInt(tier.quantity) < 1) {
        toast.error(t('organizer.createEvent.tierQuantityRequired', { name: tier.name }));
        return;
      }
    }

    const authToken = localStorage.getItem('auth-token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!authToken) {
      toast.error(t('organizer.createEvent.authRequiredError'));
      return;
    }

    try {
      const flyerImageUrl = imageFile ? await uploadFlyer() : formData.image;
      const galleryUrls = await uploadGallery();

      // Build description with embedded metadata
      let fullDescription = formData.description || '';
      fullDescription = `${t('organizer.createEvent.venuePrefix')} ${formData.venue}${formData.address ? `, ${formData.address}` : ''}\n\n${fullDescription}`;

      const updateData = {
        title: formData.title.trim(),
        title_cn: formData.titleCN.trim() || undefined,
        description: fullDescription.trim(),
        start_date: `${formData.date}T${formData.time}:00`,
        end_date: formData.endDate && formData.endTime
          ? `${formData.endDate}T${formData.endTime}:00`
          : `${formData.date}T${formData.time}:00`,
        city: formData.city.trim().toLowerCase(),
        flyer_image: flyerImageUrl,
        gallery_images: galleryUrls.length > 0 ? galleryUrls : undefined,
        capacity: parseInt(formData.capacity),
        address: formData.address || formData.venue,
        event_type: formData.eventType || undefined,
        refund_policy: formData.refundPolicy || undefined,
        require_id: formData.requireId,
        ticket_price: formData.ticketPrice ? parseFloat(formData.ticketPrice) : undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
      };

      await updateEvent(eventId, updateData);

      // Sync ticket tiers
      const currentTierIds = new Set(ticketTiers.map(t => t.id));
      const tiersToDelete = Array.from(originalTierIds).filter(id => !currentTierIds.has(id));
      for (const tierId of tiersToDelete) {
        await deleteTicketTier(tierId);
      }

      for (const tier of ticketTiers) {
        if (tier.originalId && originalTierIds.has(tier.originalId)) {
          // Update existing
          await updateTicketTier(tier.originalId, {
            name: tier.name,
            price: parseFloat(tier.price),
            quantity: parseInt(tier.quantity),
            description: tier.description,
            max_per_order: parseInt(tier.maxPerPerson) || 10,
            sale_start: tier.saleStartDate ? `${tier.saleStartDate}T00:00:00` : undefined,
            sale_end: tier.saleEndDate ? `${tier.saleEndDate}T23:59:59` : undefined,
          });
        } else {
          // Create new
          await createTicketTierApi(Number(eventId), tier, authToken);
        }
      }

      toast.success(t('organizer.manageEvents.updateSuccess'));
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to update event:', error);
      toast.error(error instanceof Error ? error.message : t('organizer.manageEvents.updateError'));
    }
  };

  const isSubmitting = isLoading || isUploadingImage || isUploadingGallery || isLoadingEvent;

  const formatPreviewDate = () => {
    if (!formData.date || !formData.time) return null;
    const date = new Date(`${formData.date}T${formData.time}`);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoadingEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard/business/events')}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {formData.title || t('organizer.manageEvents.editModalTitle')}
                </h1>
                <p className="text-sm text-gray-400">
                  {formData.city ? `${formData.city} • ` : ''}
                  {formData.date || t('organizer.createEvent.draft')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard/business/events')}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !businessProfile}
                className="px-6 py-2 bg-[#d3da0c] text-black rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 font-semibold"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('organizer.manageEvents.saving')}
                  </span>
                ) : (
                  t('organizer.manageEvents.saveChanges')
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Flyer Upload */}
            <SectionCard>
              <SectionTitle icon={ImageIcon} title={t('organizer.createEvent.eventFlyer')} />
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileSelect}
                  disabled={isUploadingImage}
                  className="hidden"
                  id="flyer-upload"
                />
                {!formData.image ? (
                  <label
                    htmlFor="flyer-upload"
                    className="flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed border-white/20 rounded-xl text-gray-400 hover:border-[#d3da0c] hover:text-[#d3da0c] cursor-pointer transition-colors"
                  >
                    {isUploadingImage ? (
                      <Loader2 className="w-10 h-10 animate-spin" />
                    ) : (
                      <Upload className="w-10 h-10" />
                    )}
                    <div className="text-center">
                      <p className="text-white font-medium mb-1">
                        {isUploadingImage ? t('organizer.createEvent.uploading') : t('organizer.createEvent.uploadFlyerHint')}
                      </p>
                      <p className="text-sm text-gray-500">JPEG or PNG, max 5MB</p>
                    </div>
                  </label>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-white/10">
                    <img
                      src={formData.image}
                      alt={t('organizer.createEvent.flyerAlt')}
                      className="w-full aspect-video object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, image: '' }));
                        setImageFile(null);
                      }}
                      className="absolute top-4 right-4 px-4 py-2 bg-black/70 text-white text-sm rounded-lg hover:bg-black/90 transition-colors"
                    >
                      Change Photo
                    </button>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* General Info */}
            <SectionCard>
              <SectionTitle icon={Tag} title={t('organizer.createEvent.generalInfo')} />
              <div className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label required>{t('organizer.createEvent.eventNameEN')}</Label>
                    <Input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="e.g., Neon Nights"
                    />
                  </div>
                  <div>
                    <Label>{t('organizer.createEvent.eventNameZH')}</Label>
                    <Input
                      type="text"
                      name="titleCN"
                      value={formData.titleCN}
                      onChange={handleChange}
                      placeholder="例如：霓虹之夜"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('organizer.createEvent.eventType')}</Label>
                    <Select name="eventType" value={formData.eventType} onChange={handleChange}>
                      <option value="" className="bg-[#111111]">{t('organizer.createEvent.selectType')}</option>
                      {EVENT_TYPES.map(type => (
                        <option key={type} value={type} className="bg-[#111111]">{type}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>{t('organizer.createEvent.refundPolicy')}</Label>
                    <Select name="refundPolicy" value={formData.refundPolicy} onChange={handleChange}>
                      {REFUND_POLICIES.map(policy => (
                        <option key={policy} value={policy} className="bg-[#111111]">{policy}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div>
                  <Label required>{t('organizer.createEvent.venueName')}</Label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      type="text"
                      name="venue"
                      value={formData.venue}
                      onChange={handleChange}
                      placeholder="e.g., Warehouse District"
                      className="pl-12"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('organizer.createEvent.addressLabel')}</Label>
                    <Input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder={t('organizer.createEvent.addressPlaceholder')}
                    />
                  </div>
                  <div>
                    <Label required>City</Label>
                    <Select name="city" value={formData.city} onChange={handleChange}>
                      <option value="" disabled className="bg-[#1a1a1a] text-gray-500">Select a city</option>
                      {['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Ningbo', 'Yiwu', 'Nanjing', 'Wuhan', "Xi'an", 'Chongqing', 'Suzhou', 'Tianjin', 'Qingdao', 'Dalian', 'Xiamen', 'Kunming', 'Changsha', 'Zhengzhou'].map(city => (
                        <option key={city} value={city} className="bg-[#1a1a1a] text-white">{city}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>{t('organizer.createEvent.tagsLabel')}</Label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      placeholder={t('organizer.createEvent.addTag')}
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                    />
                    <button
                      onClick={handleAddTag}
                      disabled={!newTag.trim()}
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-[#d3da0c]/20 text-[#d3da0c] text-sm rounded-full"
                      >
                        #{tag}
                        <button onClick={() => setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))} className="hover:text-white transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label required>{t('organizer.createEvent.startDate')}</Label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <Input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        className="pl-12"
                      />
                    </div>
                  </div>
                  <div>
                    <Label required>{t('organizer.createEvent.startTime')}</Label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <Input
                        type="time"
                        name="time"
                        value={formData.time}
                        onChange={handleChange}
                        className="pl-12"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('organizer.createEvent.endDate')}</Label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <Input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                        min={formData.date || new Date().toISOString().split('T')[0]}
                        className="pl-12"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{t('organizer.createEvent.endTime')}</Label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <Input
                        type="time"
                        name="endTime"
                        value={formData.endTime}
                        onChange={handleChange}
                        className="pl-12"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>{t('organizer.createEvent.descriptionLabel')}</Label>
                  <TextArea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={5}
                    placeholder={t('organizer.createEvent.descriptionPlaceholder')}
                  />
                </div>
              </div>
            </SectionCard>

            {/* Music / DJs */}
            <SectionCard>
              <SectionTitle icon={Music} title={t('organizer.createEvent.musicLineup')} />
              <div className="space-y-4">
                <div>
                  <Label>Music Style</Label>
                  <div className="flex flex-wrap gap-2">
                    {['Afrobeats', 'Amapiano', 'Techno', 'House', 'Hip Hop', 'R&B', 'Jazz', 'Reggae', 'Dancehall'].map(style => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => {
                          if (formData.tags.includes(style)) {
                            setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== style) }));
                          } else {
                            setFormData(prev => ({ ...prev, tags: [...prev.tags, style] }));
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          formData.tags.includes(style)
                            ? 'bg-[#d3da0c] text-black font-medium'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Photos / Gallery */}
            <SectionCard>
              <SectionTitle icon={ImageIcon} title={t('organizer.createEvent.photos')} />
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {galleryPreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-white/10">
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeGalleryImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-[#d3da0c] transition-colors">
                  <Plus className="w-6 h-6 text-gray-500" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGallerySelect}
                    className="hidden"
                  />
                </label>
              </div>
            </SectionCard>

            {/* Tickets */}
            <SectionCard>
              <SectionTitle icon={Ticket} title={t('organizer.createEvent.tickets')} />
              <div className="space-y-4">
                {ticketTiers.map((tier, index) => (
                  <div key={tier.id} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-[#d3da0c]" />
                        <span className="text-white font-medium">{tier.name || `${t('organizer.createEvent.ticket')} ${index + 1}`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeTicketTier(tier.id)}
                          disabled={ticketTiers.length <= 1}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                      <Input
                        type="text"
                        value={tier.name}
                        onChange={(e) => handleTicketTierChange(tier.id, 'name', e.target.value)}
                        placeholder={t('organizer.createEvent.ticketCategory')}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <Input
                            type="number"
                            value={tier.price}
                            onChange={(e) => handleTicketTierChange(tier.id, 'price', e.target.value)}
                            placeholder={t('organizer.createEvent.ticketPrice')}
                            className="pl-9"
                          />
                        </div>
                        <div className="relative">
                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <Input
                            type="number"
                            value={tier.quantity}
                            onChange={(e) => handleTicketTierChange(tier.id, 'quantity', e.target.value)}
                            placeholder={t('organizer.createEvent.qty')}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs block mb-1">{t('organizer.createEvent.saleStart')}</span>
                        <Input
                          type="date"
                          value={tier.saleStartDate}
                          onChange={(e) => handleTicketTierChange(tier.id, 'saleStartDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block mb-1">{t('organizer.createEvent.saleEnd')}</span>
                        <Input
                          type="date"
                          value={tier.saleEndDate}
                          onChange={(e) => handleTicketTierChange(tier.id, 'saleEndDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block mb-1">{t('organizer.createEvent.maxPerPerson')}</span>
                        <Input
                          type="number"
                          value={tier.maxPerPerson}
                          onChange={(e) => handleTicketTierChange(tier.id, 'maxPerPerson', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addTicketTier}
                  disabled={ticketTiers.length >= 4}
                  className="w-full py-3 border-2 border-dashed border-white/20 rounded-xl text-gray-400 hover:border-[#d3da0c] hover:text-[#d3da0c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  {t('organizer.createEvent.addTicketCategory')}
                </button>
              </div>
            </SectionCard>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Preview Card */}
            <SectionCard className="sticky top-24">
              <h3 className="text-white font-semibold mb-4">{t('organizer.createEvent.eventPreview')}</h3>
              <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0A0A0A]">
                {formData.image ? (
                  <img src={formData.image} alt="" className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-white/5 flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-white/20" />
                  </div>
                )}
                <div className="p-4">
                  <h4 className="text-white font-semibold mb-2 line-clamp-1">
                    {formData.title || t('organizer.createEvent.eventTitle')}
                  </h4>
                  {formatPreviewDate() && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                      <Calendar className="w-4 h-4 text-[#d3da0c]" />
                      {formatPreviewDate()}
                    </div>
                  )}
                  {(formData.venue || formData.city) && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
                      <MapPin className="w-4 h-4 text-[#d3da0c]" />
                      {formData.venue}{formData.city ? `, ${formData.city}` : ''}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-2 py-1 bg-white/5 text-gray-400 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Capacity */}
            <SectionCard>
              <SectionTitle icon={Users} title={t('organizer.createEvent.capacityLabel')} />
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  placeholder="100"
                  min="1"
                  className="pl-12"
                />
              </div>
            </SectionCard>

            {/* Security & Verification */}
            <SectionCard>
              <SectionTitle icon={Shield} title={t('organizer.createEvent.securityVerification')} />
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="requireId"
                  checked={formData.requireId}
                  onChange={handleChange}
                  className="mt-1 w-5 h-5 rounded border-white/20 bg-white/5 text-[#d3da0c] focus:ring-[#d3da0c]"
                />
                <div>
                  <p className="text-white text-sm font-medium">{t('organizer.createEvent.requireIdDocument')}</p>
                  <p className="text-gray-400 text-xs">{t('organizer.createEvent.requireIdDescription')}</p>
                </div>
              </label>
            </SectionCard>

            {/* Payment Setup - PROMINENT */}
            <SectionCard className="border-[#d3da0c]/30 bg-[#d3da0c]/5">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-[#d3da0c]" />
                <h3 className="text-white font-semibold text-lg">{t('organizer.createEvent.paymentSetup')}</h3>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                {t('organizer.createEvent.paymentSetupDescription')}
              </p>
              <div className="space-y-4">
                <div>
                  <Label>{t('organizer.createEvent.ticketPriceLabel')}</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      type="number"
                      name="ticketPrice"
                      value={formData.ticketPrice}
                      onChange={handleChange}
                      placeholder="e.g. 150"
                      min="0"
                      step="0.01"
                      className="pl-12"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            {!businessProfile && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">
                  {t('organizer.createEvent.businessProfileMissing')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && currentEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111111] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[#d3da0c]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-[#d3da0c]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{t('organizer.manageEvents.updateSuccess')}</h2>
              <p className="text-gray-400 text-sm">{t('organizer.createEvent.eventCreatedDesc')}</p>
            </div>

            {/* Event Preview */}
            <div className="rounded-xl overflow-hidden border border-white/10 mb-6">
              {currentEvent.flyer_image ? (
                <img
                  src={currentEvent.flyer_image}
                  alt=""
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-white/5 flex items-center justify-center">
                  <ImageIcon className="w-10 h-10 text-white/20" />
                </div>
              )}
              <div className="p-4">
                <h3 className="text-white font-semibold line-clamp-1">{currentEvent.title}</h3>
              </div>
            </div>

            {/* QR Code */}
            {currentEvent.qr_code && (
              <div className="mb-6 text-center">
                <p className="text-gray-400 text-sm mb-3">{t('organizer.createEvent.shareEvent')}</p>
                <div className="bg-white rounded-xl p-4 inline-block">
                  <img src={currentEvent.qr_code} alt="QR" className="w-40 h-40" />
                </div>
              </div>
            )}

            {/* Share Link */}
            <div className="mb-6">
              <label className="block text-gray-400 text-sm mb-2">{t('organizer.createEvent.eventLink')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={currentEvent.share_url || `${window.location.origin}/events/${currentEvent.id}`}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                />
                <button
                  onClick={() => {
                    const url = currentEvent.share_url || `${window.location.origin}/events/${currentEvent.id}`;
                    navigator.clipboard.writeText(url);
                    setLinkCopied(true);
                    toast.success(t('organizer.createEvent.linkCopied'));
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  {linkCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {t('organizer.createEvent.copyLink')}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {currentEvent.qr_code && (
                <a
                  href={currentEvent.qr_code}
                  download={`event-${currentEvent.id}-qr.png`}
                  className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <QrCode className="w-4 h-4" />
                  {t('organizer.createEvent.downloadQrCode')}
                </a>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors font-medium"
                >
                  {t('organizer.createEvent.createAnotherEvent')}
                </button>
                <button
                  onClick={() => navigate('/dashboard/business/events')}
                  className="py-3 bg-[#d3da0c] text-black rounded-lg hover:bg-[#bbc10b] transition-colors font-semibold"
                >
                  {t('organizer.createEvent.goToMyEvents')}
                </button>
              </div>
              <button
                onClick={() => navigate(`/events/${currentEvent.id}`)}
                className="w-full py-3 text-gray-400 hover:text-white transition-colors text-sm"
              >
                {t('organizer.createEvent.viewEvent')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default EditEvent;
