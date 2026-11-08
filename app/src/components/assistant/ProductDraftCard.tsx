import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Trash2, Plus, Check, Loader2, Edit3, AlertCircle } from 'lucide-react';
import { useAssistantStore, type AssistantDraft, type ExtractedProduct } from '@/store/assistantStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

interface ProductDraftCardProps {
  draft: AssistantDraft;
  onUpdated?: () => void;
}

export default function ProductDraftCard({ draft, onUpdated }: ProductDraftCardProps) {
  const { session } = useAuthStore();
  const { updateDraft, publishDraft } = useAssistantStore();
  const [isPublishing, setIsPublishing] = useState(false);
  const [products, setProducts] = useState<ExtractedProduct[]>(
    (draft.payload_json?.products as ExtractedProduct[]) || []
  );
  const [isEditing, setIsEditing] = useState(false);

  const token = session?.access_token;

  const updateProduct = (index: number, field: keyof ExtractedProduct, value: string | number) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const removeProduct = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const addProduct = () => {
    setProducts((prev) => [...prev, { name: '', price: 0, currency: 'CNY', stock_quantity: 0 }]);
  };

  const handleSave = async () => {
    if (!token) return;
    await updateDraft(draft.id, { products }, token);
    setIsEditing(false);
    toast.success('Draft updated');
    onUpdated?.();
  };

  const handlePublish = async () => {
    if (!token) return;
    const valid = products.filter((p) => p.name && p.price !== undefined);
    if (valid.length === 0) {
      toast.error('Add at least one valid product');
      return;
    }
    setIsPublishing(true);
    try {
      const result = await publishDraft(draft.id, token);
      toast.success(result.message || 'Products published');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-purple-400/30 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-white font-semibold flex items-center gap-2">
          <Package className="w-4 h-4 text-purple-400" />
          {products.length} Product{products.length !== 1 ? 's' : ''}
        </h4>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
        >
          {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {products.length === 0 && (
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> No products extracted.
          </p>
        )}
        {products.map((product, index) => (
          <div
            key={index}
            className="flex items-center gap-2 bg-white/5 rounded-lg p-2 text-sm"
          >
            {isEditing ? (
              <>
                <input
                  value={product.name}
                  onChange={(e) => updateProduct(index, 'name', e.target.value)}
                  className="flex-1 bg-transparent text-white focus:outline-none"
                  placeholder="Name"
                />
                <input
                  type="number"
                  value={product.price}
                  onChange={(e) => updateProduct(index, 'price', parseFloat(e.target.value) || 0)}
                  className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-right"
                />
                <button
                  onClick={() => removeProduct(index)}
                  className="p-1 text-gray-500 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-white truncate">{product.name}</span>
                <span className="text-[#d3da0c] font-medium">¥{product.price}</span>
                {product.category && (
                  <span className="text-xs text-gray-500 capitalize">{product.category}</span>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {isEditing && (
        <button
          onClick={addProduct}
          className="w-full py-2 border border-dashed border-white/20 text-gray-400 hover:text-white hover:border-white/40 rounded-lg text-sm flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      )}

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
        disabled={isPublishing || products.length === 0}
        className="w-full py-2 bg-[#d3da0c] hover:bg-[#bbc10b] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm rounded-lg flex items-center justify-center gap-2"
      >
        {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {isPublishing ? 'Publishing...' : 'Publish Products'}
      </button>
    </motion.div>
  );
}
