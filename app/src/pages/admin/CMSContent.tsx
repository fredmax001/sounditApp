import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  FileText, Search, Plus, Edit2, Trash2,
  Loader2, Save, X, Layout, Image as ImageIcon
} from 'lucide-react';

interface Page {
  id: number;
  title: string;
  slug: string;
  content: string;
  meta_description: string;
  is_published: boolean;
  updated_at: string;
}

interface Banner {
  id: number;
  title: string;
  image_url: string;
  position: string;
  is_active: boolean;
}

const CMSContent = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [pages, setPages] = useState<Page[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<Partial<Page> | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [activeTab, setActiveTab] = useState('pages');

  const loadContent = useCallback(async () => {
    try {
      const [pagesRes, bannersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/cms/pages`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }),
        fetch(`${API_BASE_URL}/admin/cms/banners`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        })
      ]);

      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        setPages(Array.isArray(pagesData) ? pagesData : (pagesData.pages && Array.isArray(pagesData.pages) ? pagesData.pages : []));
      }
      if (bannersRes.ok) {
        const bannersData = await bannersRes.json();
        setBanners(Array.isArray(bannersData) ? bannersData : (bannersData.banners && Array.isArray(bannersData.banners) ? bannersData.banners : []));
      }
    } catch {
      toast.error(t('admin.cmsContent.failedToLoadContent'));
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('save');
    try {
      const method = editingPage.id ? 'PUT' : 'POST';
      const url = editingPage.id
        ? `${API_BASE_URL}/admin/cms/pages/${editingPage.id}`
        : `${API_BASE_URL}/admin/cms/pages`;

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingPage)
      });

      if (res.ok) {
        toast.success(editingPage.id ? t('admin.cmsContent.pageUpdated') : t('admin.cmsContent.pageCreated'));;
        setShowEditor(false);
        setEditingPage(null);
        loadContent();
      }
    } catch {
      toast.error(t('admin.cmsContent.failedToSavePage'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePage = async (id: number) => {
    if (!confirm(t('admin.cmsContent.confirmDelete'))) return;
    setActionLoading(`delete-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/cms/pages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.cmsContent.pageDeleted'));
        loadContent();
      }
    } catch {
      toast.error(t('admin.cmsContent.failedToDeletePage'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleBanner = async (id: number, active: boolean) => {
    setActionLoading(`banner-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/cms/banners/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !active })
      });
      if (res.ok) {
        toast.success(t('admin.cmsContent.bannerUpdated'));
        loadContent();
      }
    } catch {
      toast.error(t('admin.cmsContent.failedToUpdateBanner'));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPages = pages.filter(page =>
    !searchQuery ||
    page.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    page.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.cmsContent.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.cmsContent.subtitle')}</p>
        </div>
        {activeTab === 'pages' && (
          <button
            onClick={() => {
              setEditingPage({ title: '', slug: '', content: '', meta_description: '', is_published: false });
              setShowEditor(true);
            }}
            className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('admin.cmsContent.newPage')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab('pages')}
          className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'pages' ? 'text-[#d3da0c] border-b-2 border-[#d3da0c]' : 'text-gray-400 hover:text-white'
            }`}
        >
          <Layout className="w-4 h-4 inline mr-2" />
          {t('admin.cmsContent.pages')}
        </button>
        <button
          onClick={() => setActiveTab('banners')}
          className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'banners' ? 'text-[#d3da0c] border-b-2 border-[#d3da0c]' : 'text-gray-400 hover:text-white'
            }`}
        >
          <ImageIcon className="w-4 h-4 inline mr-2" />
          {t('admin.cmsContent.banners')}
        </button>
      </div>

      {/* Search */}
      {activeTab === 'pages' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.cmsContent.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
        </div>
      ) : activeTab === 'pages' ? (
        <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.cmsContent.page')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.cmsContent.slug')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.cmsContent.status')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.cmsContent.updated')}</th>
                <th className="text-right text-gray-400 text-sm font-medium p-4">{t('admin.cmsContent.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.map((page) => (
                <tr key={page.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <span className="text-white font-medium">{page.title}</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-400 font-mono text-sm">/{page.slug}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${page.is_published ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                      {page.is_published ? t('admin.cmsContent.published') : t('admin.cmsContent.draft')}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400">{new Date(page.updated_at).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingPage(page);
                          setShowEditor(true);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg text-blue-400"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePage(page.id)}
                        disabled={actionLoading === `delete-${page.id}`}
                        className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                      >
                        {actionLoading === `delete-${page.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map((banner) => (
            <div key={banner.id} className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
              <img
                src={banner.image_url}
                alt={banner.title}
                className="w-full h-32 object-cover"
              />
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">{banner.title}</h3>
                    <p className="text-gray-400 text-sm">{banner.position}</p>
                  </div>
                  <button
                    onClick={() => handleToggleBanner(banner.id, banner.is_active)}
                    disabled={actionLoading === `banner-${banner.id}`}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${banner.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}
                  >
                    {actionLoading === `banner-${banner.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : (banner.is_active ? 'Active' : 'Inactive')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Page Editor Modal */}
      {showEditor && editingPage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {editingPage.id ? t('admin.cmsContent.editPage') : t('admin.cmsContent.newPage')}
              </h2>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditingPage(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSavePage} className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('admin.cmsContent.titleLabel')}</label>
                <input
                  type="text"
                  value={editingPage.title}
                  onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('admin.cmsContent.slugLabel')}</label>
                <input
                  type="text"
                  value={editingPage.slug}
                  onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('admin.cmsContent.contentLabel')}</label>
                <textarea
                  value={editingPage.content}
                  onChange={(e) => setEditingPage({ ...editingPage, content: e.target.value })}
                  rows={10}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('admin.cmsContent.metaDescription')}</label>
                <input
                  type="text"
                  value={editingPage.meta_description}
                  onChange={(e) => setEditingPage({ ...editingPage, meta_description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_published"
                  checked={editingPage.is_published}
                  onChange={(e) => setEditingPage({ ...editingPage, is_published: e.target.checked })}
                  className="w-4 h-4 rounded border-white/10"
                />
                <label htmlFor="is_published" className="text-white text-sm">{t('admin.cmsContent.publishImmediately')}</label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditor(false);
                    setEditingPage(null);
                  }}
                  className="px-4 py-2 border border-white/10 text-white rounded-lg hover:bg-white/5"
                >
                  {t('admin.cmsContent.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'save'}
                  className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t('admin.cmsContent.savePage')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CMSContent;
