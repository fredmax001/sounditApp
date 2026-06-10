import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileText, Image, FileUp, Loader2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface MenuItem {
    name: string;
    price: number;
    description?: string;
    category?: string;
    confidence: number;
}

interface MenuImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (items: MenuItem[], category?: string) => void;
    token: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function MenuImportModal({ isOpen, onClose, onConfirm, token }: MenuImportModalProps) {
    const [mode, setMode] = useState<'select' | 'image' | 'pdf' | 'text' | 'review'>('select');
    const [items, setItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = useCallback(() => {
        setMode('select');
        setItems([]);
        setTextInput('');
        setSelectedCategory('');
        setIsLoading(false);
    }, []);

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleFileUpload = async (file: File, endpoint: string) => {
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`${API_BASE_URL}/vendors/${endpoint}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!res.ok) throw new Error('Failed to process file');
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
        if (!textInput.trim()) return;
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('text', textInput);

            const res = await fetch(`${API_BASE_URL}/vendors/menu-import/text`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!res.ok) throw new Error('Failed to parse text');
            const data = await res.json();
            setItems(data.items || []);
            setMode('review');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Parse failed');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleItem = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof MenuItem, value: string | number) => {
        setItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
        );
    };

    const handleConfirm = () => {
        if (items.length === 0) {
            toast.error('No items selected');
            return;
        }
        onConfirm(items, selectedCategory || undefined);
        handleClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h2 className="text-white font-semibold">
                            {mode === 'select' && 'Import Menu'}
                            {mode === 'image' && 'Upload Menu Photo'}
                            {mode === 'pdf' && 'Upload PDF Menu'}
                            {mode === 'text' && 'Paste Menu Text'}
                            {mode === 'review' && `Review (${items.length} items)`}
                        </h2>
                        <button onClick={handleClose} className="p-1 text-gray-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {mode === 'select' && (
                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => setMode('image')}
                                    className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-[#d3da0c]/30 transition-colors text-left"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center">
                                        <Image className="w-5 h-5 text-[#d3da0c]" />
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Upload Photo</p>
                                        <p className="text-gray-500 text-sm">JPG, PNG, HEIC menu photos</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setMode('pdf')}
                                    className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-[#d3da0c]/30 transition-colors text-left"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                        <FileUp className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Upload PDF</p>
                                        <p className="text-gray-500 text-sm">PDF menu or catalog</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setMode('text')}
                                    className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-[#d3da0c]/30 transition-colors text-left"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Paste Text</p>
                                        <p className="text-gray-500 text-sm">Copy & paste menu text</p>
                                    </div>
                                </button>
                            </div>
                        )}

                        {mode === 'image' && (
                            <div className="space-y-4">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-white/20 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-[#d3da0c]/40 transition-colors"
                                >
                                    <Upload className="w-10 h-10 text-gray-500" />
                                    <p className="text-gray-400 text-sm">Click to upload menu photo</p>
                                    <p className="text-gray-600 text-xs">JPG, PNG, HEIC up to 10MB</p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(file, 'menu-import/image');
                                    }}
                                />
                            </div>
                        )}

                        {mode === 'pdf' && (
                            <div className="space-y-4">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-white/20 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-purple-400/40 transition-colors"
                                >
                                    <FileUp className="w-10 h-10 text-gray-500" />
                                    <p className="text-gray-400 text-sm">Click to upload PDF</p>
                                    <p className="text-gray-600 text-xs">PDF up to 20MB</p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(file, 'menu-import/pdf');
                                    }}
                                />
                            </div>
                        )}

                        {mode === 'text' && (
                            <div className="space-y-4">
                                <textarea
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    placeholder="Paste your menu here...\nExample:\nFried Rice - ¥25\nBubble Tea - ¥18"
                                    className="w-full h-48 bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-gray-600 focus:border-[#d3da0c]/40 focus:outline-none resize-none"
                                />
                                <button
                                    onClick={handleTextImport}
                                    disabled={!textInput.trim() || isLoading}
                                    className="w-full py-3 bg-[#d3da0c] text-black font-medium rounded-xl hover:bg-[#c4cb0b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Parse Menu'}
                                </button>
                            </div>
                        )}

                        {mode === 'review' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#d3da0c]/40 focus:outline-none"
                                    >
                                        <option value="">Auto-detect category</option>
                                        <option value="food">Food</option>
                                        <option value="drink">Drink</option>
                                        <option value="dessert">Dessert</option>
                                        <option value="snack">Snack</option>
                                        <option value="merch">Merchandise</option>
                                        <option value="service">Service</option>
                                    </select>
                                </div>
                                {items.map((item, index) => (
                                    <div
                                        key={index}
                                        className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => toggleItem(index)}
                                                className="text-green-400 hover:text-green-300"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <input
                                                value={item.name}
                                                onChange={(e) => updateItem(index, 'name', e.target.value)}
                                                className="flex-1 bg-transparent text-white text-sm font-medium focus:outline-none"
                                            />
                                            <input
                                                type="number"
                                                value={item.price}
                                                onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                                                className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm text-right focus:border-[#d3da0c]/40 focus:outline-none"
                                            />
                                        </div>
                                        {item.confidence < 0.8 && (
                                            <div className="flex items-center gap-1 text-amber-400 text-xs">
                                                <AlertCircle className="w-3 h-3" />
                                                <span>Low confidence — please verify</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {isLoading && (
                            <div className="flex flex-col items-center gap-3 py-8">
                                <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                                <p className="text-gray-400 text-sm">Processing...</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {mode === 'review' && items.length > 0 && (
                        <div className="p-4 border-t border-white/10">
                            <button
                                onClick={handleConfirm}
                                className="w-full py-3 bg-[#d3da0c] text-black font-medium rounded-xl hover:bg-[#c4cb0b] transition-colors"
                            >
                                Confirm Import ({items.length} products)
                            </button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
