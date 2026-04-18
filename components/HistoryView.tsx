import React, { useState } from 'react';
import { 
  ChevronLeft, Zap, TrendingUp, Camera, Calendar, Trash2, 
  Search, Filter, Clock, Trophy, Archive, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Post, Competition } from '../types';

interface HistoryViewProps {
  posts: Post[];
  competitions: Competition[];
  onDelete: (id: string) => void;
  onRemove: (state: { isOpen: boolean; postId: string; reason: string; consent: boolean }) => void;
  isAdmin: boolean;
  fixedCompetitionId?: string;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ 
  posts, 
  competitions,
  onDelete, 
  onRemove, 
  isAdmin,
  fixedCompetitionId 
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'tiktok' | 'youtube' | 'instagram' | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [selectedCompId, setSelectedCompId] = useState<string | 'all'>(fixedCompetitionId || 'all');
  const [selectedHandle, setSelectedHandle] = useState<string | 'all'>('all');

  const filteredPosts = posts.filter(post => {
    // Não mostrar posts deletados para o usuário (soft delete)
    if (post.status === 'deleted') return false;
    
    const matchesPlatform = selectedPlatform ? post.platform === selectedPlatform : true;
    const matchesDate = !filterDate ? true : new Date(post.timestamp).setHours(0,0,0,0) >= new Date(filterDate).setHours(0,0,0,0);
    const matchesComp = selectedCompId === 'all' ? true : post.competitionId === selectedCompId;
    const matchesHandle = selectedHandle === 'all' ? true : post.accountHandle === selectedHandle;
    
    return matchesPlatform && matchesDate && matchesComp && matchesHandle;
  });

  const getPlatformCount = (p: 'tiktok' | 'youtube' | 'instagram') => {
    return posts.filter(post => {
      const matchesComp = selectedCompId === 'all' ? true : post.competitionId === selectedCompId;
      return post.platform === p && matchesComp && post.status !== 'deleted';
    }).length;
  };

  const getCompTitle = (id?: string) => {
    if (!id || id === 'all') return 'Geral / Antiga';
    return competitions.find(c => c.id === id)?.title || 'Competição Desconhecida';
  };

  // Filtrar competições que têm posts ou estão ativas (para o seletor)
  const relevantCompetitions = competitions.sort((a, b) => b.startDate - a.startDate);

  // Extrair handles únicos disponíveis no histórico do usuário
  const availableHandles = React.useMemo(() => {
    const handles = new Set<string>();
    posts.forEach(p => {
      if (p.accountHandle) handles.add(p.accountHandle);
    });
    return Array.from(handles).sort();
  }, [posts]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header & Competition Selector */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
            {selectedPlatform && (
              <button 
                onClick={() => setSelectedPlatform(null)}
                className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
                title="Voltar ao Hub"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {selectedPlatform ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span className="capitalize flex items-center gap-2">
                  {selectedPlatform === 'tiktok' ? <Zap className="w-6 h-6 text-amber-500" /> :
                   selectedPlatform === 'youtube' ? <TrendingUp className="w-6 h-6 text-red-500" /> :
                   <Camera className="w-6 h-6 text-pink-500" />}
                  {selectedPlatform} Protocols
                </span>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                  <span className="text-[11px] font-black uppercase text-zinc-100 tracking-widest">{filteredPosts.length} postados</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="text-3xl font-black gold-gradient">Meus Protocolos</span>
                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mt-1">Histórico de envios e triagem</span>
              </div>
            )}
          </h2>
          
          {(selectedPlatform || !selectedPlatform) && (
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover:text-amber-500/50 transition-colors" />
                <input 
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl pl-11 pr-4 py-2.5 text-xs font-black text-white focus:outline-none focus:border-amber-500/50 transition-all focus:ring-4 focus:ring-amber-500/5 w-full sm:w-auto uppercase tracking-widest shadow-inner"
                />
              </div>
              {filterDate && (
                <button 
                  onClick={() => setFilterDate('')}
                  className="p-2.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest hover:border-zinc-700"
                >
                  Limpar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Competition Selector (Pills) - Only shown if not fixed */}
        {!fixedCompetitionId && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
              <Filter className="w-3.5 h-3.5" /> Filtrar por Competição
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedCompId('all')}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                  selectedCompId === 'all' 
                    ? 'gold-bg text-black border-amber-500 shadow-lg shadow-amber-500/20 scale-105' 
                    : 'bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                Todas as Competições
              </button>
              {relevantCompetitions.map(comp => (
                <button
                  key={comp.id}
                  onClick={() => setSelectedCompId(comp.id)}
                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border flex items-center gap-2 ${
                    selectedCompId === comp.id 
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500 shadow-lg shadow-amber-500/5 scale-105' 
                      : 'bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <Trophy className={`w-3 h-3 ${selectedCompId === comp.id ? 'text-amber-500' : 'text-zinc-600'}`} />
                  {comp.title}
                  {comp.endDate < Date.now() && (
                    <span className="text-[8px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 ml-1">ENCERRADA</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Account Handle Selector (Dropdown) - More prominent */}
        {availableHandles.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
              <TrendingUp className="w-3.5 h-3.5" /> Filtrar por Perfil / @ Conta
            </div>
            <div className="relative group max-w-xl">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 transition-colors group-hover:text-amber-500" />
              <select
                value={selectedHandle}
                onChange={(e) => setSelectedHandle(e.target.value)}
                className="w-full bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-[2rem] pl-14 pr-12 py-4 text-sm font-black text-white focus:outline-none focus:border-amber-500/50 transition-all focus:ring-4 focus:ring-amber-500/5 uppercase tracking-widest shadow-xl appearance-none cursor-pointer"
              >
                <option value="all">Todos os Perfis (@)</option>
                {availableHandles.map(handle => (
                  <option key={handle} value={handle} className="bg-zinc-900 border-none">
                    @{handle.replace(/^@/, '')}
                  </option>
                ))}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600">
                <ChevronLeft className="w-5 h-5 -rotate-90" />
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!selectedPlatform ? (
          <motion.div 
            key="hub"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4"
          >
            {[
              { id: 'tiktok', name: 'TikTok', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/10', hover: 'hover:border-amber-500/30' },
              { id: 'instagram', name: 'Instagram', icon: Camera, color: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/10', hover: 'hover:border-pink-500/30' },
              { id: 'youtube', name: 'YouTube', icon: TrendingUp, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/10', hover: 'hover:border-red-500/30' }
            ].map((p, idx) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => setSelectedPlatform(p.id as any)}
                className={`group relative p-10 rounded-[3rem] glass overflow-hidden transition-all duration-500 border-2 ${p.border} ${p.hover} flex flex-col items-center text-center gap-8 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]`}
              >
                <div className={`p-8 rounded-[2rem] ${p.bg} transition-all duration-700 group-hover:scale-110 group-hover:rotate-12 group-hover:shadow-[0_0_30px_rgba(0,0,0,0.2)]`}>
                  <p.icon className={`w-14 h-14 ${p.color}`} />
                </div>
                <div>
                  <h3 className={`text-3xl font-black uppercase tracking-tighter mb-2 ${p.color}`}>{p.name}</h3>
                  <div className="flex items-center gap-2 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                    <p className="text-zinc-200 text-xs font-black uppercase tracking-[0.2em]">{getPlatformCount(p.id as any)} Protocolos</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                  </div>
                </div>
                <div className="mt-2 px-8 py-3 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] transform translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 shadow-xl">
                  ACESSAR REDE
                </div>
                <div className={`absolute -bottom-12 -right-12 w-32 h-32 rounded-full ${p.bg} blur-3xl opacity-0 group-hover:opacity-50 transition-opacity duration-700`} />
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="space-y-8"
          >
            {filteredPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPosts.sort((a,b) => b.timestamp - a.timestamp).map(post => {
                  const platformLabel = post.platform === 'tiktok' ? 'TikTok' : post.platform === 'youtube' ? 'YouTube' : 'Instagram';
                  const platformColor = post.platform === 'tiktok' ? 'text-amber-500' : post.platform === 'youtube' ? 'text-red-500' : 'text-pink-500';
                  const platformBg = post.platform === 'tiktok' ? 'bg-amber-500/10 border-amber-500/20' : post.platform === 'youtube' ? 'bg-red-500/10 border-red-500/20' : 'bg-pink-500/10 border-pink-500/20';
                  const platformIcon = post.platform === 'tiktok' ? <Zap className="w-5 h-5" /> : post.platform === 'youtube' ? <TrendingUp className="w-5 h-5" /> : <Camera className="w-5 h-5" />;
                  
                  return (
                    <div key={post.id} className="p-7 rounded-[2.5rem] glass border border-zinc-800/50 space-y-5 group hover:border-zinc-700 transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                      <div className="flex items-center justify-between">
                        <div className={`flex flex-col gap-1 px-5 py-3 rounded-2xl border ${platformBg}`}>
                          <div className="flex items-center gap-2">
                            <span className={platformColor}>{platformIcon}</span>
                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${platformColor}`}>{platformLabel}</span>
                          </div>
                          {post.accountHandle && (
                            <span className="text-white font-black text-xs lowercase truncate max-w-[140px]">
                              @{post.accountHandle.replace(/^@/, '')}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate max-w-[120px]">
                             {getCompTitle(post.competitionId)}
                           </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Link do Protocolo</p>
                        <a 
                          href={post.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-white font-bold text-xs truncate block hover:text-amber-500 transition-colors"
                        >
                          {post.url}
                        </a>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                          <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Status</p>
                          <div className={`text-[9px] font-black uppercase tracking-widest ${
                            post.status === 'approved' || post.status === 'synced' ? 'text-emerald-500' :
                            post.status === 'rejected' || post.status === 'banned' ? 'text-red-500' :
                            'text-amber-500'
                          }`}>
                            {post.status === 'approved' || post.status === 'synced' ? 'Aprovado' : 
                             post.status === 'rejected' || post.status === 'banned' ? 'Recusado' : 'Em Triagem'}
                          </div>
                        </div>
                        <div className="p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                          <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Data</p>
                          <div className="text-[9px] font-black text-zinc-300 uppercase">
                            {new Date(post.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        {isAdmin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(post.id); }}
                            className="p-3 rounded-xl bg-red-500/5 text-red-500/40 hover:bg-red-500 hover:text-black transition-all flex-1 flex items-center justify-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase">EXCLUIR</span>
                          </button>
                        )}
                        {(post.status === 'approved' || post.status === 'synced' || post.status === 'pending') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemove({ isOpen: true, postId: post.id, reason: '', consent: false }); }}
                            className="p-3 rounded-xl bg-red-600 text-white hover:bg-white hover:text-red-600 transition-all flex-1 flex items-center justify-center gap-2 shadow-lg"
                          >
                            <Clock className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase">REMOVER</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-32 text-center glass rounded-[3rem] border border-dashed border-zinc-800 space-y-6">
                <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-zinc-800">
                  <Archive className="w-10 h-10 text-zinc-700" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-black text-zinc-500 uppercase tracking-widest">Nenhum protocolo encontrado</h4>
                  <p className="text-zinc-600 font-bold text-sm">Não encontramos vídeos postados com esses filtros.</p>
                </div>
                {(selectedPlatform || filterDate || selectedCompId !== 'all') && (
                  <button 
                    onClick={() => { setSelectedPlatform(null); setFilterDate(''); setSelectedCompId('all'); }}
                    className="px-8 py-3 bg-white text-black font-black rounded-xl text-xs hover:scale-105 transition-all"
                  >
                    LIMPAR TODOS OS FILTROS
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
