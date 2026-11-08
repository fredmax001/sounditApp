import { useState, useEffect, useCallback } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Key, RefreshCw, Loader2, Copy, Eye, EyeOff,
  Webhook, Cloud, Plus, Trash2
} from 'lucide-react';

interface Integration {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

interface ApiKey {
  id: number;
  name: string;
  created_at: string;
  key: string;
}

interface Webhook {
  id: number;
  url: string;
  status: 'active' | 'failed' | string;
  events: string[];
}

const APIIntegrations = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<number | null>(null);
  const [newWebhook, setNewWebhook] = useState({ url: '', events: [] as string[] });
  const [showAddWebhook, setShowAddWebhook] = useState(false);

  const availableEvents = [
    'user.created',
    'user.updated',
    'event.created',
    'event.updated',
    'booking.created',
    'booking.confirmed',
    'payment.received',
    'withdrawal.requested'
  ];

  const loadIntegrations = useCallback(async () => {
    try {
      const [integrationsRes, keysRes, webhooksRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/integrations`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }),
        fetch(`${API_BASE_URL}/admin/api-keys`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }),
        fetch(`${API_BASE_URL}/admin/webhooks`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        })
      ]);

      if (integrationsRes.ok) setIntegrations(await integrationsRes.json());
      if (keysRes.ok) setApiKeys(await keysRes.json());
      if (webhooksRes.ok) setWebhooks(await webhooksRes.json());
    } catch {
      toast.error(t('admin.apiIntegrations.failedToLoadIntegrations'));
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  const handleToggleIntegration = async (id: number, enabled: boolean) => {
    setActionLoading(`toggle-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/integrations/${id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !enabled })
      });

      if (res.ok) {
        toast.success(enabled ? t('admin.apiIntegrations.integrationDisabled') : t('admin.apiIntegrations.integrationEnabled'));
        loadIntegrations();
      }
    } catch {
      toast.error(t('admin.apiIntegrations.failedToUpdateIntegration'));
    } finally {
      setActionLoading(null);
    }
  };

  const [revealedKey, setRevealedKey] = useState<{id: number, key: string} | null>(null);

  const handleRegenerateKey = async (id: number) => {
    const isNew = id === 0;
    if (!isNew && !confirm(t('admin.apiIntegrations.confirmRegenerateKey'))) return;
    setActionLoading(`regen-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/api-keys/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(isNew ? t('admin.apiIntegrations.apiKeyGenerated') : t('admin.apiIntegrations.apiKeyRegenerated'));
        if (data.key) {
          setRevealedKey({ id: data.key_id, key: data.key });
        }
        loadIntegrations();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to regenerate key');
      }
    } catch {
      toast.error(t('admin.apiIntegrations.failedToRegenerateKey'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('add-webhook');
    try {
      const res = await fetch(`${API_BASE_URL}/admin/webhooks`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newWebhook)
      });

      if (res.ok) {
        toast.success(t('admin.apiIntegrations.webhookAdded'));
        setShowAddWebhook(false);
        setNewWebhook({ url: '', events: [] });
        loadIntegrations();
      }
    } catch {
      toast.error(t('admin.apiIntegrations.failedToAddWebhook'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteWebhook = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    setActionLoading(`delete-webhook-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/webhooks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      if (res.ok) {
        toast.success(t('admin.apiIntegrations.webhookDeleted'));
        loadIntegrations();
      }
    } catch {
      toast.error(t('admin.apiIntegrations.failedToDeleteWebhook'));
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('admin.apiIntegrations.copiedToClipboard'));
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader chip="System" title={t('admin.apiIntegrations.title')} subtitle={t('admin.apiIntegrations.subtitle')} />

      {/* API Keys */}
      <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 shadow-xs dark:shadow-none rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d3da0c]/10 rounded-lg">
              <Key className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <h2 className="text-lg font-semibold text-[#020b00] dark:text-white">{t('admin.apiIntegrations.apiKeys')}</h2>
          </div>
          <button
            onClick={() => handleRegenerateKey(0)}
            className="px-3 py-1.5 text-sm border border-black/10 dark:border-white/10 text-[#020b00] dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('admin.apiIntegrations.generateNewKey')}
          </button>
        </div>

        <div className="space-y-3">
          {apiKeys.map((key) => (
            <div key={key.id} className="p-4 bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-transparent rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#020b00] dark:text-white font-medium">{key.name}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{t('admin.apiIntegrations.created')} {new Date(key.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-neutral-200/70 dark:bg-black/50 border border-black/5 dark:border-white/10 rounded-lg px-3 py-2">
                    <code className="text-[#020b00] dark:text-[#d3da0c] text-sm font-mono font-medium">
                      {revealedKey?.id === key.id ? revealedKey.key : (showKey === key.id ? key.key : '••••••••••••••••••••••••••')}
                    </code>
                    <button
                      onClick={() => setShowKey(showKey === key.id ? null : key.id)}
                      className="p-1 hover:bg-neutral-300/60 dark:hover:bg-white/10 rounded transition-colors"
                    >
                      {showKey === key.id ? <EyeOff className="w-4 h-4 text-gray-500 dark:text-gray-400" /> : <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(revealedKey?.id === key.id ? revealedKey.key : key.key)}
                      className="p-1 hover:bg-neutral-300/60 dark:hover:bg-white/10 rounded transition-colors"
                    >
                      <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleRegenerateKey(key.id)}
                    disabled={actionLoading === `regen-${key.id}`}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
                  >
                    {actionLoading === `regen-${key.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Third-party Integrations */}
      <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 shadow-xs dark:shadow-none rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Cloud className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-[#020b00] dark:text-white">{t('admin.apiIntegrations.thirdPartyServices')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <div key={integration.id} className="p-4 bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-transparent rounded-xl">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-100 dark:bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                    {integration.icon ? (
                      <img src={integration.icon} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <Cloud className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-[#020b00] dark:text-white font-medium">{integration.name}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">{integration.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleIntegration(integration.id, integration.enabled)}
                  disabled={actionLoading === `toggle-${integration.id}`}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    integration.enabled ? 'bg-[#d3da0c]' : 'bg-neutral-300 dark:bg-gray-600'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                    integration.enabled ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
              {integration.enabled && integration.config && (
                <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
                  <div className="grid grid-cols-2 gap-3">
                    {Object.keys(integration.config).map((key) => (
                      <div key={key}>
                        <label className="text-gray-500 dark:text-gray-400 text-xs capitalize">{key.replace('_', ' ')}</label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-gray-600 dark:text-gray-400 text-xs">••••••••</code>
                          <button className="text-[#020b00] dark:text-[#d3da0c] text-xs font-medium hover:underline">{t('admin.apiIntegrations.edit')}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Webhooks */}
      <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 shadow-xs dark:shadow-none rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Webhook className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-[#020b00] dark:text-white">{t('admin.apiIntegrations.webhooks')}</h2>
          </div>
          <button
            onClick={() => setShowAddWebhook(true)}
            className="px-3 py-1.5 text-sm bg-[#020b00] dark:bg-[#d3da0c] text-[#d3da0c] dark:text-black font-bold rounded-lg hover:bg-neutral-900 dark:hover:bg-white transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Webhook
          </button>
        </div>

        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="p-4 bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-transparent rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[#020b00] dark:text-white font-medium">{webhook.url}</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      webhook.status === 'active' ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
                      webhook.status === 'failed' ? 'bg-red-500/15 text-red-700 dark:text-red-400' :
                      'bg-gray-500/15 text-gray-700 dark:text-gray-400'
                    }`}>
                      {webhook.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {webhook.events.map((event: string) => (
                      <span key={event} className="px-2 py-0.5 bg-neutral-200/70 dark:bg-white/10 rounded text-xs text-gray-700 dark:text-gray-300">
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteWebhook(webhook.id)}
                  disabled={actionLoading === `delete-webhook-${webhook.id}`}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 dark:text-red-400 transition-colors"
                >
                  {actionLoading === `delete-webhook-${webhook.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Webhook Modal */}
      {showAddWebhook && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-[#020b00] dark:text-white mb-4">{t('admin.apiIntegrations.addWebhook')}</h2>
            <form onSubmit={handleAddWebhook} className="space-y-4">
              <div>
                <label className="block text-gray-700 dark:text-gray-400 text-sm mb-2">{t('admin.apiIntegrations.webhookUrl')}</label>
                <input
                  type="url"
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                  placeholder={t('admin.apiIntegrations.webhookUrlPlaceholder')}
                  className="w-full px-4 py-2 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 dark:text-gray-400 text-sm mb-2">{t('admin.apiIntegrations.events')}</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto">
                  {availableEvents.map((event) => (
                    <label key={event} className="flex items-center gap-2 p-2 bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-transparent rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewWebhook({ ...newWebhook, events: [...newWebhook.events, event] });
                          } else {
                            setNewWebhook({ ...newWebhook, events: newWebhook.events.filter((e: string) => e !== event) });
                          }
                        }}
                        className="rounded border-black/20 dark:border-white/10 accent-[#d3da0c]"
                      />
                      <span className="text-gray-700 dark:text-gray-300 text-xs">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddWebhook(false)}
                  className="px-4 py-2 border border-black/10 dark:border-white/10 text-gray-700 dark:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                >
                  {t('admin.apiIntegrations.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'add-webhook' || newWebhook.events.length === 0}
                  className="px-4 py-2 bg-[#020b00] dark:bg-[#d3da0c] text-[#d3da0c] dark:text-black font-bold rounded-lg hover:bg-neutral-900 dark:hover:bg-white disabled:opacity-50 transition-colors"
                >
                  {actionLoading === 'add-webhook' ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.apiIntegrations.addWebhook')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default APIIntegrations;
