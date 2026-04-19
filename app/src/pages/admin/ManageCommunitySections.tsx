import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Plus, Search, Pencil, Trash2, X, Loader2, Check
} from 'lucide-react';

interface CommunitySection {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  post_count: number;
}

const ManageCommunitySections = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuthStore();
  const [sections, setSections] = useState<CommunitySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState<CommunitySection | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: '',
    sort_order: 0,
    is_active: true,
  });

  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/community/sections`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSections(data || []);
      } else {
        toast.error(t('admin.manageCommunitySections.failedToLoadSections'));
      }
    } catch {
      toast.error(t('admin.manageCommunitySections.failedToLoadSections'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', slug: '', description: '', icon: '', sort_order: 0, is_active: true });
    setEditingSection(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (section: CommunitySection) => {
    setEditingSection(section);
    setFormData({
      name: section.name,
      slug: section.slug,
      description: section.description || '',
      icon: section.icon || '',
      sort_order: section.sort_order,
      is_active: section.is_active,
    });
    setShowModal(true);
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: editingSection ? prev.slug : name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingSection
      ? `${API_BASE_URL}/admin/community/sections/${editingSection.id}`
      : `${API_BASE_URL}/admin/community/sections`;
    const method = editingSection ? 'PUT' : 'POST';

    setActionLoading(editingSection ? `edit-${editingSection.id}` : 'create');
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success(editingSection ? t('admin.manageCommunitySections.sectionUpdated') : t('admin.manageCommunitySections.sectionCreated'));
        setShowModal(false);
        resetForm();
        loadSections();
      } else {
        const err = await res.json();
        toast.error(err.detail || t('admin.manageCommunitySections.failedToSaveSection'));
      }
    } catch {
      toast.error(t('admin.manageCommunitySections.failedToSaveSection'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('admin.manageCommunitySections.confirmDelete'))) return;
    setActionLoading(`delete-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/community/sections/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageCommunitySections.sectionDeleted'));
        loadSections();
      } else {
        const err = await res.json();
        toast.error(err.detail || t('admin.manageCommunitySections.failedToDeleteSection'));
      }
    } catch {
      toast.error(t('admin.manageCommunitySections.failedToDeleteSection'));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredSections = sections.filter(s =>
    !searchQuery ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.manageCommunitySections.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.manageCommunitySections.subtitle')}</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl w-fit">
          {[
            { id: 'metrics', label: t('admin.communityMetrics.tabMetrics'), path: '/admin/community' },
            { id: 'sections', label: t('admin.communityMetrics.tabSections'), path: '/admin/community/sections' },
            { id: 'posts', label: t('admin.communityMetrics.tabPosts'), path: '/admin/community/posts' },
            { id: 'comments', label: t('admin.communityMetrics.tabComments'), path: '/admin/community/comments' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${location.pathname === tab.path ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.manageCommunitySections.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
          />
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('admin.manageCommunitySections.createSection')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wide">{t('admin.manageCommunitySections.name')}</th>
                  <th className="px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wide">{t('admin.manageCommunitySections.slug')}</th>
                  <th className="px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wide">{t('admin.manageCommunitySections.description')}</th>
                  <th className="px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wide text-center">{t('admin.manageCommunitySections.sortOrder')}</th>
                  <th className="px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wide text-center">{t('admin.manageCommunitySections.active')}</th>
                  <th className="px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wide text-center">{t('admin.manageCommunitySections.postCount')}</th>
                  <th className="px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wide text-right">{t('admin.manageCommunitySections.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <AnimatePresence>
                  {filteredSections.map((section) => (
                    <motion.tr
                      key={section.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {section.icon && <span className="text-[#d3da0c]">{section.icon}</span>}
                          <span className="text-white font-medium text-sm">{section.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{section.slug}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm max-w-xs truncate">{section.description || '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-400 text-sm">{section.sort_order}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${section.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {section.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400 text-sm">{section.post_count}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(section)}
                            disabled={actionLoading === `edit-${section.id}`}
                            className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white"
                            title={t('admin.manageCommunitySections.edit')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(section.id)}
                            disabled={actionLoading === `delete-${section.id}`}
                            className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                            title={t('admin.manageCommunitySections.delete')}
                          >
                            {actionLoading === `delete-${section.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredSections.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">
                      {t('admin.manageCommunitySections.noSectionsFound')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-lg"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">
                {editingSection ? t('admin.manageCommunitySections.editSection') : t('admin.manageCommunitySections.createSection')}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">{t('admin.manageCommunitySections.name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">{t('admin.manageCommunitySections.slug')}</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                />
                <p className="text-gray-500 text-xs mt-1">{t('admin.manageCommunitySections.slugHint')}</p>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">{t('admin.manageCommunitySections.description')}</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1.5">{t('admin.manageCommunitySections.icon')}</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder={t('admin.manageCommunitySections.iconPlaceholder')}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1.5">{t('admin.manageCommunitySections.sortOrder')}</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value || '0', 10) }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-[#d3da0c]"
                />
                <label htmlFor="is_active" className="text-gray-300 text-sm">{t('admin.manageCommunitySections.isActive')}</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 py-2.5 bg-white/5 text-white font-medium rounded-lg hover:bg-white/10 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!!actionLoading}
                  className="flex-1 py-2.5 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingSection ? t('common.save') : t('common.create')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ManageCommunitySections;
