import React, { useState, useCallback } from 'react';

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

// ─── Sistema de Tarjas Administrativas ───────────────────────────────────────
export type TagColor = 'yellow' | 'red' | 'green' | null;
export type PostTags = { tag1: TagColor; tag2: TagColor };

const STORAGE_KEY = 'metarayx_admin_tags';

const loadTags = (): Record<string, PostTags> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveTags = (tags: Record<string, PostTags>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
};

const TAG_COLORS: { value: TagColor; bg: string; border: string; label: string }[] = [
  { value: 'yellow', bg: 'bg-amber-400', border: 'border-amber-400', label: 'Amarelo' },
  { value: 'red',    bg: 'bg-red-500',   border: 'border-red-500',   label: 'Vermelho' },
  { value: 'green',  bg: 'bg-emerald-500', border: 'border-emerald-500', label: 'Verde' },
];

const TagPicker = ({ 
  postId, tagIndex, value, onChange 
}: { 
  postId: string; tagIndex: 1 | 2; value: TagColor; onChange: (v: TagColor) => void 
}) => {
  const [open, setOpen] = useState(false);
  const activeColor = TAG_COLORS.find(c => c.value === value);

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title={`Tarja ${tagIndex}: ${activeColor?.label || 'Sem cor'}`}
        className={`
          w-2.5 h-10 rounded-full border-2 transition-all duration-300 hover:scale-110
          ${activeColor ? `${activeColor.bg} ${activeColor.border} shadow-lg shadow-black/40` : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500'}
        `}
      />

      {open && (
        <div 
          className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-2xl p-2 flex flex-col gap-1.5 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-5 h-5 rounded-full border-2 border-zinc-600 bg-zinc-800 hover:border-zinc-400 transition-all ${value === null ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900' : ''}`}
            title="Remover cor"
          />
          {TAG_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => { onChange(c.value); setOpen(false); }}
              className={`w-5 h-5 rounded-full ${c.bg} hover:scale-110 transition-all ${value === c.value ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900' : ''}`}
              title={c.label}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const PostTagRow = ({ postId }: { postId: string }) => {
  const [tags, setTags] = useState<PostTags>(() => {
    const all = loadTags();
    return all[postId] || { tag1: null, tag2: null };
  });

  const updateTag = useCallback((which: 'tag1' | 'tag2', color: TagColor) => {
    const updated = { ...tags, [which]: color };
    setTags(updated);
    const all = loadTags();
    all[postId] = updated;
    saveTags(all);
  }, [postId, tags]);

  return (
    <div className="flex flex-col gap-1.5 items-center shrink-0" title="Tarjas de organização (Local)">
      <TagPicker postId={postId} tagIndex={1} value={tags.tag1} onChange={c => updateTag('tag1', c)} />
      <TagPicker postId={postId} tagIndex={2} value={tags.tag2} onChange={c => updateTag('tag2', c)} />
    </div>
  );
};
