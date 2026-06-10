import { motion } from 'framer-motion';
import { Check, Clock, ChefHat, Package, Truck, XCircle } from 'lucide-react';

const STATUS_FLOW = [
    { key: 'pending_verification', label: 'Pending', icon: Clock },
    { key: 'accepted', label: 'Accepted', icon: Check },
    { key: 'preparing', label: 'Preparing', icon: ChefHat },
    { key: 'ready', label: 'Ready', icon: Package },
    { key: 'completed', label: 'Completed', icon: Truck },
];

interface OrderStatusTrackerProps {
    status: string;
    isVendor?: boolean;
}

export default function OrderStatusTracker({ status, isVendor = false }: OrderStatusTrackerProps) {
    const currentIndex = STATUS_FLOW.findIndex((s) => s.key === status);
    const isCancelled = status === 'cancelled';

    if (isCancelled) {
        return (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <XCircle className="w-6 h-6 text-red-400" />
                <div>
                    <p className="text-red-400 font-semibold">Order Cancelled</p>
                    <p className="text-red-300/70 text-sm">This order has been cancelled by the vendor.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="flex items-center justify-between relative">
                {/* Progress line */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-white/10 -z-10" />
                {currentIndex > 0 && (
                    <motion.div
                        className="absolute top-5 left-0 h-0.5 bg-[#d3da0c] -z-10"
                        initial={{ width: '0%' }}
                        animate={{ width: `${(currentIndex / (STATUS_FLOW.length - 1)) * 100}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                )}

                {STATUS_FLOW.map((step, index) => {
                    const isActive = index <= currentIndex;
                    const isCurrent = index === currentIndex;
                    const Icon = step.icon;

                    return (
                        <div key={step.key} className="flex flex-col items-center gap-2">
                            <motion.div
                                animate={{
                                    scale: isCurrent ? 1.1 : 1,
                                    backgroundColor: isActive ? '#d3da0c' : 'rgba(255,255,255,0.1)',
                                }}
                                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                                    isActive ? 'border-[#d3da0c]' : 'border-white/20'
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-gray-500'}`} />
                            </motion.div>
                            <span
                                className={`text-xs font-medium ${
                                    isActive ? 'text-white' : 'text-gray-500'
                                }`}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
