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

// ─── Sistema de Tarjas Administrativas ────────────────────────────────────────
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

// ─── Validação de Conformidade (Triagem/Sincronização) ──────────────────
import { Hash, AtSign, Clock as ClockIcon, Check as CheckIcon, X as XIcon } from 'lucide-react';
import { Post, Competition } from '../../types';

export const CompliancePanel = ({ post, competition, checkDailyCycle = true }: { post: Post, competition?: Competition, checkDailyCycle?: boolean }) => {
  if (!competition) return null;

  const normalize = (s: string) => s.toLowerCase().trim().replace(/[#@]/g, '');
  
  const postHashtags = (post.videoHashtags || []).map(normalize);
  const postMentions = (post.videoMentions || []).map(normalize);
  let platformHashtags: string[] = [];
  if (post.platform === 'youtube' && competition.requiredHashtagsYouTube?.length) {
    platformHashtags = competition.requiredHashtagsYouTube;
  } else {
    platformHashtags = competition.requiredHashtags || [];
  }

  const requiredHashtags = platformHashtags.map(normalize);
  
  // Seleção dinâmica de menções por plataforma
  let platformMentions: string[] = [];
  if (post.platform === 'tiktok' && competition.requiredMentionsTikTok?.length) {
    platformMentions = competition.requiredMentionsTikTok;
  } else if (post.platform === 'youtube' && competition.requiredMentionsYouTube?.length) {
    platformMentions = competition.requiredMentionsYouTube;
  } else if (post.platform === 'instagram' && competition.requiredMentionsInstagram?.length) {
    platformMentions = competition.requiredMentionsInstagram;
  } else {
    platformMentions = competition.requiredMentions || [];
  }

  const requiredMentions = platformMentions.map(normalize);

  // Validação flexível para YouTube: busca no caption (título + descrição) se não achar nos arrays
  const normalizedCaption = normalize(post.caption || '');
  
  const missingHashtags = requiredHashtags.filter(h => {
    const inArray = postHashtags.includes(h);
    if (inArray) return false;
    // Se for YouTube, tenta procurar no texto do título/descrição (caption)
    if (post.platform === 'youtube' && normalizedCaption.includes(h)) return false;
    return true;
  });

  const missingMentions = requiredMentions.filter(m => {
    const inArray = postMentions.includes(m);
    if (inArray) return false;
    // Para todas as plataformas, buscador de texto no caption como redundância
    if (normalizedCaption.includes(m)) return false;
    return true;
  });

  // Lógica de Ciclo Diário (20h às 20h)
  const getLatestResetTimestamp = (resetTime: string) => {
    const [h, m] = (resetTime || '20:00').split(':').map(Number);
    const now = new Date();
    const lastReset = new Date(now);
    lastReset.setHours(h, m, 0, 0);

    // Se o horário de reset hoje ainda não passou, o último reset foi às 20h de ontem
    if (now.getTime() < lastReset.getTime()) {
      lastReset.setDate(lastReset.getDate() - 1);
    }
    return lastReset.getTime();
  };

  const lastResetTs = getLatestResetTimestamp(competition.dailyResetTime || '20:00');
  const isAfterGlobalStart = post.postedAt && competition.startDate && post.postedAt >= competition.startDate;
  
  // Se checkDailyCycle for false, ignoramos a verificação do reset diário
  const isWithinCurrentCycle = checkDailyCycle 
    ? (post.postedAt && post.postedAt >= lastResetTs)
    : true;
  
  const isTimeOk = isAfterGlobalStart && isWithinCurrentCycle;

  const timeStatusText = !post.postedAt ? 'Data de postagem não encontrada' :
                        !isAfterGlobalStart ? 'Postado antes do início da competição' :
                        (checkDailyCycle && !isWithinCurrentCycle) ? 'Postado em um ciclo diário anterior (Link Antigo)' :
                        'Horário de postagem OK';

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-black/40 rounded-2xl border border-zinc-800/50">
      {/* Hashtags */}
      <div className="flex items-center gap-1.5" title={missingHashtags.length > 0 ? `Faltando: ${missingHashtags.join(', ')}` : 'Hashtags OK'}>
        <div className={`p-1 rounded-md ${missingHashtags.length === 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
          <Hash className="w-3 h-3" />
        </div>
        {missingHashtags.length === 0 ? <CheckIcon className="w-3 h-3 text-emerald-500" /> : <XIcon className="w-3 h-3 text-red-500" />}
      </div>

      <div className="w-px h-3 bg-zinc-800" />

      {/* Menções */}
      <div className="flex items-center gap-1.5" title={missingMentions.length > 0 ? `Faltando: ${missingMentions.join(', ')}` : 'Menções OK'}>
        <div className={`p-1 rounded-md ${missingMentions.length === 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
          <AtSign className="w-3 h-3" />
        </div>
        {missingMentions.length === 0 ? <CheckIcon className="w-3 h-3 text-emerald-500" /> : <XIcon className="w-3 h-3 text-red-500" />}
      </div>

      <div className="w-px h-3 bg-zinc-800" />

      {/* Horário */}
      <div 
        className="flex items-center gap-1.5 cursor-help" 
        title={`${timeStatusText}${post.postedAt ? ` \nPostado em: ${new Date(post.postedAt).toLocaleString('pt-BR')}` : ''}`}
      >
        <div className={`p-1 rounded-md ${isTimeOk ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
          <ClockIcon className="w-3 h-3" />
        </div>
        {isTimeOk ? <CheckIcon className="w-3 h-3 text-emerald-500" /> : <XIcon className="w-3 h-3 text-red-500" />}
      </div>
    </div>
  );
};
