import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Image, FileText, Upload, Loader2, Check, Trash2, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface MenuItem {
    name: string;
    price: number;
    description?: string;
    category?: string;
    confidence: number;
}

export default function VendorMenuImport() {
    const { session } = useAuthStore();
    const [mode, setMode] = useState<'select' | 'image' | 'pdf' | 'text' | 'review'>('select');
    const [items, setItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const handleFileUpload = async () => {
        if (!file || !session?.access_token) return;
        setIsLoading(true);

        const endpoint = mode === 'image' ? 'menu-import/image' : 'menu-import/pdf';
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`${API_BASE_URL}/vendors/${endpoint}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: formData,
            });
            if (!res.ok) throw new Error('Failed to process');
            const data = await res.json();
            setItems(data.items || []);
            setMode('review');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTextImport = async () => {
        if (!textInput.trim() || !session?.access_token) return;
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('text', textInput);
            const res = await fetch(`${API_BASE_URL}/vendors/menu-import/text`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: formData,
            });
            if (!res.ok) throw new Error('Failed to parse');
            const data = await res.json();
            setItems(data.items || []);
            setMode('review');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Parse failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!session?.access_token || items.length === 0) return;
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('items', JSON.stringify(items));
            if (selectedCategory) formData.append('category', selectedCategory);

            const res = await fetch(`${API_BASE_URL}/vendors/products/bulk-import`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: formData,
            });
            if (!res.ok) throw new Error('Failed to import');
            const data = await res.json();
            toast.success(data.message || `Imported ${items.length} products`);
            setMode('select');
            setItems([]);
            setTextInput('');
            setFile(null);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setIsLoading(false);
        }
    };

    const updateItem = (index: number, field: keyof MenuItem, value: string | number) => {
        setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    };

    const removeItem = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const addItem = () => {
        setItems((prev) => [...prev, { name: '', price: 0, confidence: 1 }]);
    };

    return (
        <div className="min-h-screen pt-20 pb-24 bg-[#0A0A0A]">
            <div className="max-w-2xl mx-auto px-4">
                <div className="flex items-center gap-3 mb-6">
                    <Link to="/dashboard/vendor" className="p-2 text-gray-400 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-white text-2xl font-bold">Menu Import</h1>
                </div>

                <AnimatePresence mode="wait">
                    {mode === 'select' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                            <button onClick={() => setMode('image')} className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-[#d3da0c]/30 transition-colors text-left">
                                <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center"><Image className="w-6 h-6 text-[#d3da0c]" /></div>
                                <div><p className="text-white font-medium">Upload Photo</p><p className="text-gray-500 text-sm">JPG, PNG, HEIC menu photos</p></div>
                            </button>
                            <button onClick={() => setMode('pdf')} className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-purple-400/30 transition-colors text-left">
                                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center"><FileText className="w-6 h-6 text-purple-400" /></div>
                                <div><p className="text-white font-medium">Upload PDF</p><p className="text-gray-500 text-sm">PDF menu or catalog</p></div>
                            </button>
                            <button onClick={() => setMode('text')} className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-blue-400/30 transition-colors text-left">
                                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center"><FileText className="w-6 h-6 text-blue-400" /></div>
                                <div><p className="text-white font-medium">Paste Text</p><p className="text-gray-500 text-sm">Copy & paste menu text</p></div>
                            </button>
                        </motion.div>
                    )}

                    {mode === 'image' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center">
                                <input type="file" accept="image/*" className="hidden" id="menu-image" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                <label htmlFor="menu-image" className="cursor-pointer flex flex-col items-center gap-3">
                                    <Upload className="w-10 h-10 text-gray-500" />
                                    <p className="text-gray-400">{file ? file.name : 'Click to upload menu photo'}</p>
                                </label>
                            </div>
                            <button onClick={handleFileUpload} disabled={!file || isLoading} className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl disabled:opacity-50">
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Process Image'}
                            </button>
                        </motion.div>
                    )}

                    {mode === 'pdf' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center">
                                <input type="file" accept="application/pdf" className="hidden" id="menu-pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                <label htmlFor="menu-pdf" className="cursor-pointer flex flex-col items-center gap-3">
                                    <Upload className="w-10 h-10 text-gray-500" />
                                    <p className="text-gray-400">{file ? file.name : 'Click to upload PDF'}</p>
                                </label>
                            </div>
                            <button onClick={handleFileUpload} disabled={!file || isLoading} className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl disabled:opacity-50">
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Process PDF'}
                            </button>
                        </motion.div>
                    )}

                    {mode === 'text' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Paste your menu here...\nFried Rice - ¥25\nBubble Tea - ¥18" className="w-full h-48 bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-600 focus:border-[#d3da0c]/40 focus:outline-none resize-none" />
                            <button onClick={handleTextImport} disabled={!textInput.trim() || isLoading} className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl disabled:opacity-50">
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Parse Menu'}
                            </button>
                        </motion.div>
                    )}

                    {mode === 'review' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-white font-semibold">Review Items ({items.length})</h2>
                                <button onClick={addItem} className="flex items-center gap-1 text-[#d3da0c] text-sm"><Plus className="w-4 h-4" /> Add Item</button>
                            </div>
                            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                                <option value="">Auto-detect category</option>
                                <option value="food">Food</option>
                                <option value="drink">Drink</option>
                                <option value="dessert">Dessert</option>
                                <option value="snack">Snack</option>
                                <option value="merch">Merchandise</option>
                            </select>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {items.map((item, index) => (
                                    <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center gap-2">
                                        <input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} className="flex-1 bg-transparent text-white text-sm focus:outline-none" placeholder="Product name" />
                                        <input type="number" value={item.price} onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)} className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm text-right" />
                                        <button onClick={() => removeItem(index)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleConfirm} disabled={isLoading || items.length === 0} className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl disabled:opacity-50">
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <><Check className="w-5 h-5 inline mr-1" /> Confirm Import</>}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
