import React from 'react';
import { 
  Zap, 
  TrendingUp, 
  Camera, 
  ArrowLeft, 
  Check, 
  RefreshCw, 
  Clock, 
  ChevronRight,
  Trophy,
  ArrowRight
} from 'lucide-react';
import { Post, Competition, Settings } from '../../types';
import { PostTagRow, CompliancePanel } from './AdminUI';

interface SincronizacaoTabProps {
  posts: Post[];
  competitions: Competition[];
  settings: Settings;
  syncDetailCompId: string | null;
  setSyncDetailCompId: (id: string | null) => void;
  selectedSyncPostIds: string[];
  setSelectedSyncPostIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  handleBulkRevertToPending: () => void;
  handleBulkSyncSelectedApproved: () => void;
  syncing: boolean;
  syncingPostId: string | null;
  setSyncingPostId: (id: string | null) => void;
  syncingCompId?: string | null;
  syncProgress?: number;
  syncTotal?: number;
  sessionSyncedIds?: string[];
  handleSyncApprovedParallel: (compId?: string) => void;
  handleSyncApprovedSequentially: (compId?: string) => void;
  formatLastSyncDate: (date?: string) => string;
  onSingleSync: (post: Post) => Promise<void>;
  handleMovePostToCompetition: (postId: string, newCompId: string) => Promise<void>;
  pendingMoves: Record<string, string>;
  setPendingMoves: (val: any) => void;
  selectedAdminHandle: string;
  setSelectedAdminHandle: (handle: string) => void;
  adminHandles: string[];
  onUpdateMasterKey?: () => Promise<void>;
}

export const SincronizacaoTab: React.FC<SincronizacaoTabProps> = ({
  posts,
  competitions,
  settings,
  syncDetailCompId,
  setSyncDetailCompId,
  selectedSyncPostIds,
  setSelectedSyncPostIds,
  handleBulkRevertToPending,
  handleBulkSyncSelectedApproved,
  syncing,
  syncingPostId,
  setSyncingPostId,
  syncingCompId,
  syncProgress,
  syncTotal,
  sessionSyncedIds = [],
  handleSyncApprovedParallel,
  handleSyncApprovedSequentially,
  formatLastSyncDate,
  onSingleSync,
  handleMovePostToCompetition,
  pendingMoves,
  setPendingMoves,
  selectedAdminHandle,
  setSelectedAdminHandle,
  adminHandles
}) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {syncDetailCompId ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800/50">
            <div>
              <h3 className="text-xl font-black uppercase gold-gradient">
                Vídeos: {competitions.find(c => c.id === syncDetailCompId)?.title}
              </h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Aguardando Primeira Sincronização</p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Filtro por Handle Administrativo */}
              <div className="flex flex-col gap-1.5 w-[200px]">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Filtrar por Conta (@)</label>
                <select
                  value={selectedAdminHandle}
                  onChange={(e) => setSelectedAdminHandle(e.target.value)}
                  className="bg-black border border-zinc-800 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="all">Todas as Contas</option>
                  {adminHandles.map(handle => (
                    <option key={handle} value={handle}>@{handle.replace(/^@/, '')}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setSyncDetailCompId(null)}
                className="px-6 py-2 bg-zinc-800 text-white font-black rounded-xl text-xs hover:bg-zinc-700 transition-all flex items-center gap-2 h-fit mt-auto"
              >
                <ArrowLeft className="w-4 h-4" /> VOLTAR AOS CARDS
              </button>
            </div>
          </div>

          <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800/50 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const allVisibleAndPending = posts.filter(p => {
                    const matchesComp = p.competitionId === syncDetailCompId;
                    const matchesStatus = p.status === 'approved';
                    const matchesHandle = selectedAdminHandle === 'all' || p.accountHandle === selectedAdminHandle;
                    return matchesComp && matchesStatus && matchesHandle;
                  }).map(p => p.id);
                  
                  if (selectedSyncPostIds.length === allVisibleAndPending.length) {
                    setSelectedSyncPostIds([]);
                  } else {
                    setSelectedSyncPostIds(allVisibleAndPending);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-all"
              >
                {selectedSyncPostIds.length > 0 ? 'Desmarcar Todos' : 'Selecionar Todos Filtros'}
              </button>
              {selectedSyncPostIds.length > 0 && (
                <span className="text-amber-500 font-black text-[10px] uppercase tracking-widest">
                  {selectedSyncPostIds.length} selecionados
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedSyncPostIds.length > 0 && (
                <button
                  onClick={handleBulkRevertToPending}
                  disabled={syncing}
                  className="px-6 py-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reverter para Posts (Triagem)
                </button>
              )}
              {selectedSyncPostIds.length > 0 && (
                <button
                  onClick={handleBulkSyncSelectedApproved}
                  disabled={syncing}
                  className="px-6 py-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  Sincronizar Selecionados
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {posts.filter(p => {
              const matchesComp = p.competitionId === syncDetailCompId;
              const matchesStatus = p.status === 'approved';
              const matchesHandle = selectedAdminHandle === 'all' || p.accountHandle === selectedAdminHandle;
              return matchesComp && matchesStatus && matchesHandle;
            }).map(post => (
              <div 
                key={post.id} 
                className={`p-6 rounded-[32px] glass-card border transition-all duration-300 group flex flex-col md:flex-row items-center gap-6
                  ${selectedSyncPostIds.includes(post.id) ? 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.05)]' : 'border-zinc-800/50 hover:border-zinc-700'}
                `}
              >
                <div className="flex items-center gap-4 shrink-0">
                  <div 
                    onClick={() => {
                      if (selectedSyncPostIds.includes(post.id)) {
                        setSelectedSyncPostIds(prev => prev.filter(id => id !== post.id));
                      } else {
                        setSelectedSyncPostIds(prev => [...prev, post.id]);
                      }
                    }}
                    className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center cursor-pointer
                    ${selectedSyncPostIds.includes(post.id) ? 'bg-amber-500 border-amber-500' : 'border-zinc-700 group-hover:border-zinc-500'}
                  `}>
                    {selectedSyncPostIds.includes(post.id) && <Check className="w-3.5 h-3.5 text-black stroke-[4]" />}
                  </div>
                  
                  {/* ── CONFORMIDADE ── */}
                  <CompliancePanel 
                    post={post} 
                    competition={competitions.find(c => c.id === post.competitionId)} 
                  />

                  {/* ── TARJAS ── */}
                  <PostTagRow postId={post.id} />

                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
                    {post.platform === 'tiktok' ? <Zap className="w-8 h-8 text-amber-500" /> :
                      post.platform === 'youtube' ? <TrendingUp className="w-8 h-8 text-red-500" /> :
                        <Camera className="w-8 h-8 text-pink-500" />}
                  </div>
                </div>
                <div className="flex-1 min-w-0 text-center md:text-left">
                  <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                    <p className="text-sm font-black text-zinc-300 uppercase tracking-tight">{post.userName}</p>
                    {post.accountHandle && (
                      <span className="text-[10px] font-black text-amber-500/80 lowercase bg-amber-500/5 px-2 py-0.5 rounded-lg border border-amber-500/10">
                        @{post.accountHandle.replace(/^@/, '')}
                      </span>
                    )}
                  </div>
                  <p className="font-bold truncate text-zinc-500 mb-2 text-xs">{post.url}</p>
                  <div className="flex items-center justify-center md:justify-start gap-4 text-[10px] font-black text-zinc-500">
                    <span className="uppercase">{post.platform}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span>{new Date(post.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                {/* ── REMANEJAR ── */}
                <div className="flex flex-col gap-1 px-4 py-3 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest px-1">Remanejar Vídeo</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={pendingMoves[post.id] || post.competitionId}
                      onChange={(e) => {
                        setPendingMoves((prev: any) => ({ ...prev, [post.id]: e.target.value }));
                      }}
                      className="bg-black border border-zinc-800 rounded-xl py-2 px-3 text-[10px] font-bold text-zinc-300 focus:border-amber-500 outline-none w-[160px]"
                    >
                      {competitions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={async () => {
                        const newCompId = pendingMoves[post.id];
                        const newCompName = competitions.find(c => c.id === newCompId)?.title;
                        if (newCompId && newCompId !== post.competitionId) {
                          if (window.confirm(`Tem certeza que deseja mover este link para a competição "${newCompName}"?`)) {
                            await handleMovePostToCompetition(post.id, newCompId);
                            setPendingMoves((prev: any) => { const n = { ...prev }; delete n[post.id]; return n; });
                          }
                        }
                      }}
                      disabled={!pendingMoves[post.id] || pendingMoves[post.id] === post.competitionId}
                      className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black transition-all disabled:opacity-50 disabled:grayscale"
                      title="Confirmar mudança de competição"
                    >
                      <Check className="w-5 h-5" strokeWidth={3} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <a href={post.url} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-xl bg-zinc-900 text-zinc-400 font-bold text-xs hover:text-zinc-100 transition-colors">
                    Ver Link
                  </a>
                  <button
                    onClick={() => onSingleSync(post)}
                    disabled={syncingPostId === post.id}
                    className="flex items-center gap-2 px-6 py-3 gold-bg text-black font-black rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {syncingPostId === post.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    SINCRONIZAR
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800/50">
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase gold-gradient">Sincronização de Triagem</h3>
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Validação inicial de links aprovados. Selecione uma competição ou processe todos.</p>
              {settings.lastSync && (
                <p className="text-amber-500/60 font-black text-[10px] uppercase tracking-[0.2em] mt-2">
                  ÚLTIMA SINCRONIZAÇÃO: {formatLastSyncDate(settings.lastSync)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleSyncApprovedSequentially}
                disabled={syncing}
                className="px-8 py-5 bg-zinc-800 text-zinc-400 font-black rounded-2xl border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {syncing && !syncingCompId ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                SEQUENCIAL
              </button>

              <button
                onClick={handleSyncApprovedParallel}
                disabled={syncing}
                className="px-10 py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-amber-500/20 disabled:opacity-50"
              >
                {syncing && !syncingCompId ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    MULTI-SYNC
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 font-black" />
                    MULTI-SYNC ({settings.apifyKeysSync?.length || 1} CHAVES)
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {competitions.map(comp => {
              const compApprovedPosts = posts.filter(p => p.competitionId === comp.id && p.status === 'approved');
              if (compApprovedPosts.length === 0) return null;

              return (
                <div 
                  key={comp.id} 
                  onClick={() => setSyncDetailCompId(comp.id)}
                  className="glass-card premium-border p-8 rounded-[40px] flex flex-col justify-between group hover:border-amber-500/50 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-amber-500/0 to-amber-500/0 group-hover:from-amber-500/5 group-hover:to-transparent transition-all duration-500" />
                  
                  <div className="space-y-6 relative z-10">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-5">
                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:gold-glow shadow-inner ${comp.isActive ? 'bg-amber-500/20 text-amber-500 shadow-amber-500/20' : 'bg-zinc-800/50 text-zinc-500'}`}>
                          <Trophy className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-black text-xl uppercase tracking-tight text-white group-hover:text-amber-500 transition-colors duration-300 truncate max-w-[200px]">
                            {comp.title}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${comp.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                              {compApprovedPosts.length} <span className="text-zinc-700">Vídeos Pendentes</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="p-2 rounded-full bg-zinc-800/50 text-zinc-600 group-hover:text-amber-500 transition-colors">
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 flex flex-col gap-4 relative z-10">
                    <div className="w-full py-4 px-6 rounded-2xl bg-white/5 border border-white/10 group-hover:border-amber-500/20 group-hover:bg-amber-500/10 transition-all flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 group-hover:text-amber-500">Acessar Detalhes</span>
                      <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-black transition-all">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSyncApprovedSequentially(comp.id);
                        }}
                        disabled={syncing}
                        className={`py-4 px-4 rounded-2xl border transition-all flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-widest
                          ${syncingCompId === comp.id && (!sessionSyncedIds || !sessionSyncedIds.length) 
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-400' 
                            : 'bg-black border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white'
                          } disabled:opacity-50`}
                      >
                        {syncingCompId === comp.id && (!sessionSyncedIds || !sessionSyncedIds.length) ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        SEQUENCIAL
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSyncApprovedParallel(comp.id);
                        }}
                        disabled={syncing}
                        className={`py-4 px-4 rounded-2xl border transition-all flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-widest
                          ${syncingCompId === comp.id 
                            ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20' 
                            : 'gold-bg text-black border-amber-500/50 hover:scale-[1.05] shadow-md'
                          } disabled:opacity-50`}
                      >
                        {syncingCompId === comp.id ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            {syncProgress}/{syncTotal}
                          </>
                        ) : (
                          <>
                            <Zap className="w-3 h-3" />
                            MULTI-SYNC
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {(competitions.length === 0 || posts.filter(p => p.status === 'approved').length === 0) && (
              <div className="col-span-full py-20 text-center border border-dashed border-zinc-800 rounded-[40px]">
                <Clock className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">Nenhuma competição com vídeos aguardando sincronização.</p>
              </div>
            )}
           </div>
        </div>
      )}

    </div>
  );
};
