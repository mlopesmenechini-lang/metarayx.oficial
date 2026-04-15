import React from 'react';

export const ListHeader = ({ columns, gridClass }: { columns: string[], gridClass: string }) => (
  <div className={`grid ${gridClass} gap-4 px-8 py-4 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 mb-4`}>
    {columns.map((col, idx) => (
      <span key={idx} className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">{col}</span>
    ))}
  </div>
);

export const StatCard = ({ label, value, icon: Icon, colorClass, trend }: any) => (
  <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900 relative overflow-hidden group">
    <div className={`absolute top-0 right-0 w-32 h-32 ${colorClass} blur-[60px] opacity-20`} />
    <div className="relative z-10">
      <div className={`w-12 h-12 rounded-2xl ${colorClass.replace('bg-', 'bg-').replace('blur-', '')} flex items-center justify-center mb-6`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <h4 className="text-4xl font-black text-white tracking-tighter">{value}</h4>
        {trend && <span className="text-[10px] font-black text-emerald-500">{trend}</span>}
      </div>
    </div>
  </div>
);
