import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface DashboardPageContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Unified dashboard page wrapper — ensures consistent padding,
 * spacing, and entry animation across all dashboard pages.
 */
export default function DashboardPageContainer({
  children,
  className = '',
}: DashboardPageContainerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`p-4 md:p-6 lg:p-8 ${className}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Standardised page header used across all dashboard pages.
 */
export function DashboardPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-display text-white mb-1">
          {title}
        </h1>
        {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Standardised content card used across all dashboard pages.
 */
export function DashboardCard({
  children,
  className = '',
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={`bg-[#111111] rounded-xl border border-white/5 overflow-hidden ${className}`}
    >
      {title && (
        <div className="px-4 py-3 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Standardised stat/metric card.
 */
export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  iconClassName = 'text-[#d3da0c]',
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconClassName?: string;
}) {
  return (
    <div className="bg-[#111111] rounded-xl p-5 border border-white/5">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-5 h-5 ${iconClassName}`} />
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
