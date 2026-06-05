import React from 'react';
import useStore from '../store/useStore';

export default function RightControlPanel({ title, children }) {
  return (
    <div className="glass-card flex flex-col overflow-hidden max-h-full h-[85vh] w-full">
      <div className="p-4 border-b border-slate-700/50 bg-slate-800/80 flex justify-between items-center relative">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-500/40 to-transparent" />
        <div className="absolute right-0 top-2 bottom-2 w-[3px] rounded-l bg-white" />
        <h3 className="font-semibold tracking-wide text-white pr-3 text-right w-full">{title}</h3>
      </div>
      <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
        {children}
      </div>
    </div>
  );
}
