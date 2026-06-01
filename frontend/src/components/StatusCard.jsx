import React from 'react';
import { motion } from 'framer-motion';

export default function StatusCard({ title, value, icon: Icon, trend, alert }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`glass-card relative overflow-hidden p-4 flex flex-col gap-2 ${
        alert
          ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
          : 'hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
      }`}
    >
      {/* Top accent line — 2px gradient bar for premium card depth */}
      {/* Red gradient for alert state, cyan gradient for normal */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${
        alert
          ? 'bg-gradient-to-r from-transparent via-red-500 to-transparent'
          : 'bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent'
      }`} />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400 tracking-wide uppercase">{title}</span>
        {/* Icon with subtle circular background glow for visual weight */}
        {Icon && (
          <div className={`p-1.5 rounded-lg ${
            alert ? 'bg-red-500/10' : 'bg-cyan-500/10'
          }`}>
            <Icon className={`w-5 h-5 ${alert ? 'text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]' : 'text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]'}`} />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        {/* Large metric value with text-shadow glow for emphasis */}
        <span
          className={`text-3xl font-bold tracking-tight ${alert ? 'neon-text-alert' : 'text-slate-100'}`}
          style={{ textShadow: alert ? '0 0 15px rgba(239,68,68,0.4)' : '0 0 10px rgba(255,255,255,0.1)' }}
        >
          {value}
        </span>
        {trend && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${trend.startsWith('+') ? 'text-red-400 bg-red-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
            {trend}
          </span>
        )}
      </div>
    </motion.div>
  );
}
