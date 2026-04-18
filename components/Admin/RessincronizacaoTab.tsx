import React from 'react';
import { 
  Zap, 
  TrendingUp, 
  Camera, 
  ArrowLeft, 
  Check, 
  CheckCircle2,
  RotateCcw, 
  RefreshCw, 
  Clock, 
  ChevronRight,
  Key,
  Lock,
  X,
  Trophy,
  ArrowRight,
  ExternalLink,
  Calendar,
  MessageSquare,
  Eye,
  Heart
} from 'lucide-react';
import { Post, Competition, Settings } from '../../types';
import { PostTagRow } from './AdminUI';

interface RessincronizacaoTabProps {
  posts: Post[];
  competitions: Competition[];
  settings: Settings;
  syncDetailCompId: string | null;
  setSyncDetailCompId: (id: string | null) => void;
  selectedResyncPostIds: string[];
  setSelectedResyncPostIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  handleSyncCompetitionSequentially: (id: string) => void;
  handleSyncCompetitionParallel: (id: string) => void;
  handleSyncAllSequentially: () => void;
  handleSyncAllParallel: () => void;
  handleBulkForceMonthly: () => void;
  handleBulkForceDaily: () => void;
  handleBulkResetMetrics: () => void;
  handleBulkSyncSelected: () => void;
  syncing: boolean;
  syncingCompId: string | null;
  syncProgress: number;
  syncTotal: number;
  sessionSyncedIds: string[];
  setSessionSyncedIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  syncingPostId: string | null;
  setSyncingPostId: (id: string | null) => void;
  apifyKey: string;
  setApifyKey: (val: string) => void;
  handleSaveApiKey: () => void;
  handleDeleteApiKey: (key: string) => void;
  // Handlers needed for individual post actions
  onForceMonthly: (post: Post) => Promise<void>;
  onForceDaily: (post: Post) => Promise<void>;
  onResetToSync: (post: Post) => Promise<void>;
  onSingleSync: (post: Post) => Promise<void>;
  setRejectionReason: (val: string) => void;
  setRejectionModal: (val: { isOpen: boolean; postId: string; status: any }) => void;
  handleMovePostToCompetition: (postId: string, newCompId: string) => Promise<void>;
  pendingMoves: Record<string, string>;
  setPendingMoves: (val: any) => void;
  selectedAdminHandle: string;
  setSelectedAdminHandle: (handle: string) => void;
  adminHandles: string[];
}

export const RessincronizacaoTab: React.FC<RessincronizacaoTabProps> = ({
  posts,
  competitions,
  settings,
  syncDetailCompId,
  setSyncDetailCompId,
  selectedResyncPostIds,
  setSelectedResyncPostIds,
  handleSyncCompetitionSequentially,
  handleSyncCompetitionParallel,
  handleSyncAllSequentially,
  handleSyncAllParallel,
  handleBulkForceMonthly,
  handleBulkForceDaily,
  handleBulkResetMetrics,
  handleBulkSyncSelected,
  syncing,
  syncingCompId,
  syncProgress,
  syncTotal,
  sessionSyncedIds,
  setSessionSyncedIds,
  syncingPostId,
  setSyncingPostId,
  apifyKey,
  setApifyKey,
  handleSaveApiKey,
  handleDeleteApiKey,
  onForceMonthly,
  onForceDaily,
  onResetToSync,
  onSingleSync,
  setRejectionReason,
  setRejectionModal,
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
            <div className="flex flex-col md:flex-row md:items-center gap-8">
              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase gold-gradient">
                  Vídeos Sincronizados: {competitions.find(c => c.id === syncDetailCompId)?.title}
                </h3>
                <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Atualização Individual de Métricas</p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
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
                  onClick={() => handleSyncCompetitionSequentially(syncDetailCompId!)}
                  disabled={syncing}
                  className={`px-8 py-4 rounded-2xl border transition-all flex items-center gap-3 text-[10px] font-black uppercase tracking-widest
                    ${syncingCompId === syncDetailCompId && !sessionSyncedIds.length 
                      ? 'bg-amber-500 text-black border-amber-500 shadow-xl shadow-amber-500/20' 
                      : 'bg-zinc-800/50 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    } disabled:opacity-50 mt-auto h-fit`}
                >
                  {syncingCompId === syncDetailCompId && !sessionSyncedIds.length ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                  SEQUENCIAL
                </button>

                <button
                  onClick={() => handleSyncCompetitionParallel(syncDetailCompId!)}
                  disabled={syncing}
                  className={`px-8 py-4 rounded-2xl border transition-all flex items-center gap-3 text-[10px] font-black uppercase tracking-widest
                    ${syncingCompId === syncDetailCompId
                      ? 'bg-amber-500 text-black border-amber-500 shadow-xl shadow-amber-500/20' 
                      : 'gold-bg text-black hover:scale-[1.02]'
                    } disabled:opacity-50 mt-auto h-fit`}
                >
                  {syncingCompId === syncDetailCompId ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                  {syncingCompId === syncDetailCompId ? `DUAL-SYNC: ${syncProgress} / ${syncTotal}` : 'DUAL-SYNC (ALTA PERFORMANCE)'}
                </button>
              </div>
            </div>

            <button
              onClick={() => setSyncDetailCompId(null)}
              className="px-8 py-3 bg-zinc-800 text-zinc-400 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-zinc-700 hover:text-white transition-all flex items-center gap-2 mt-auto"
            >
              <ArrowLeft className="w-4 h-4" /> VOLTAR AOS CARDS
            </button>
          </div>

          <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800/50 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const allVisiblePosts = posts.filter(p => {
                    const matchesComp = p.competitionId === syncDetailCompId;
                    const matchesStatus = p.status === 'synced' || p.status === 'banned';
                    const matchesHandle = selectedAdminHandle === 'all' || p.accountHandle === selectedAdminHandle;
                    return matchesComp && matchesStatus && matchesHandle;
                  }).map(p => p.id);
                  
                  if (selectedResyncPostIds.length === allVisiblePosts.length) {
                    setSelectedResyncPostIds([]);
                  } else {
                    setSelectedResyncPostIds(allVisiblePosts);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-all"
              >
                {selectedResyncPostIds.length > 0 ? 'Desmarcar Todos' : 'Selecionar Filtrados'}
              </button>
              {selectedResyncPostIds.length > 0 && (
                <span className="text-amber-500 font-black text-[10px] uppercase tracking-widest">
                  {selectedResyncPostIds.length} selecionados
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedResyncPostIds.length > 0 && (
                <>
                  <button
                    onClick={handleBulkForceMonthly}
                    disabled={syncing}
                    className="px-4 py-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[9px] font-black uppercase tracking-widest hover:bg-violet-500 hover:text-white transition-all disabled:opacity-50"
                  >
                    Mensal em Lote
                  </button>
                  <button
                    onClick={handleBulkForceDaily}
                    disabled={syncing}
                    className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all disabled:opacity-50"
                  >
                    Diário em Lote
                  </button>
                  <button
                    onClick={handleBulkResetMetrics}
                    disabled={syncing}
                    className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all disabled:opacity-50"
                  >
                    Zerar e Voltar
                  </button>
                  <button
                    onClick={handleBulkSyncSelected}
                    disabled={syncing}
                    className="px-4 py-2 rounded-xl gold-bg text-black text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50"
                  >
                    Sinc. Selecionados
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {posts.filter(p => {
              const matchesComp = p.competitionId === syncDetailCompId;
              const matchesStatus = p.status === 'synced' || p.status === 'banned';
              const matchesHandle = selectedAdminHandle === 'all' || p.accountHandle === selectedAdminHandle;
              return matchesComp && matchesStatus && matchesHandle;
            }).map(post => {
              const isSyncedInSession = sessionSyncedIds.includes(post.id);
              const sessionActive = syncing || sessionSyncedIds.length > 0;
              const isDimmed = sessionActive && isSyncedInSession;

              return (
                <div 
                  key={post.id} 
                  className={`p-6 rounded-[32px] glass-card border transition-all duration-500 group flex flex-col md:flex-row items-center gap-8
                    ${post.status === 'banned' ? 'border-red-500/10 opacity-60' : 'border-zinc-800/50 hover:border-amber-500/30'}
                    ${isDimmed ? 'opacity-30 grayscale blur-[1px]' : 'opacity-100 grayscale-0'}
                    ${isSyncedInSession ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : ''}
                    ${selectedResyncPostIds.includes(post.id) ? 'border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20' : ''}
                  `}
                >
                <div 
                  onClick={() => {
                    if (selectedResyncPostIds.includes(post.id)) {
                      setSelectedResyncPostIds(prev => prev.filter(id => id !== post.id));
                    } else {
                      setSelectedResyncPostIds(prev => [...prev, post.id]);
                    }
                  }}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                  selectedResyncPostIds.includes(post.id) ? 'bg-amber-500 border-amber-500 text-black' : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-500'
                }`}>
                  {selectedResyncPostIds.includes(post.id) && <Check className="w-4 h-4" strokeWidth={4} />}
                </div>

                {/* ── TARJAS ── */}
                <PostTagRow postId={post.id} />

                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shrink-0 transition-all duration-500 group-hover:scale-110 relative ${
                  post.platform === 'tiktok' ? 'bg-amber-500/10 text-amber-500 shadow-lg shadow-amber-500/5' :
                  post.platform === 'youtube' ? 'bg-red-500/10 text-red-500 shadow-lg shadow-red-500/5' :
                  'bg-pink-500/10 text-pink-500 shadow-lg shadow-pink-500/5'
                }`}>
                  {post.platform === 'tiktok' ? <Zap className="w-10 h-10" /> :
                    post.platform === 'youtube' ? <TrendingUp className="w-10 h-10" /> :
                      <Camera className="w-10 h-10" />}
                  <div className="absolute inset-0 rounded-3xl bg-current opacity-0 group-hover:opacity-10 transition-opacity" />
                </div>

                <div className="flex-1 min-w-0 text-center md:text-left space-y-3">
                  <div className="flex items-center gap-3 mb-1 justify-center md:justify-start">
                    <p className={`text-lg font-black uppercase tracking-tight transition-colors ${post.status === 'banned' ? 'text-zinc-600 line-through' : 'text-white group-hover:text-amber-500'}`}>
                      {post.userName}
                    </p>
                    {post.accountHandle && (
                      <span className="text-[10px] font-black text-amber-500/80 lowercase bg-amber-500/5 px-2 py-0.5 rounded-lg border border-amber-500/10 mr-2">
                        @{post.accountHandle.replace(/^@/, '')}
                      </span>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {isSyncedInSession ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-500 text-black text-[8px] font-black uppercase tracking-widest border border-emerald-400 flex items-center gap-1 shadow-lg shadow-emerald-500/20 animate-in zoom-in-50 duration-300">
                          <CheckCircle2 className="w-3 h-3" /> OK / CONCLUÍDO
                        </span>
                      ) : post.status === 'synced' ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">ATUALIZADO</span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-widest border border-red-500/20">SUSPENSO</span>
                      )}
                      {(post as any).forceMonthly && (
                        <span className="px-3 py-1 rounded-full bg-violet-500/20 text-violet-400 text-[8px] font-black uppercase tracking-widest border border-violet-500/30 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> SÓ MENSAL
                        </span>
                      )}
                      {(post as any).forceDaily && (
                        <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-widest border border-amber-500/30 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" /> SÓ DIÁRIO
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <p className="font-bold truncate text-zinc-500 text-xs hover:text-zinc-300 transition-colors cursor-pointer max-w-md mx-auto md:mx-0">
                    {post.url}
                  </p>

                  <div className="flex items-center justify-center md:justify-start gap-4 text-[10px] font-black text-zinc-500 mt-1">
                    <span className="uppercase">{post.platform}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span>{new Date(post.timestamp).toLocaleString()}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 pt-2">
                    <div className="flex items-center gap-2 group/metric">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800/50 flex items-center justify-center group-hover/metric:bg-amber-500/20 group-hover/metric:text-amber-500 transition-all">
                        <Eye className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-black text-zinc-400">{(post.views || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 group/metric">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800/50 flex items-center justify-center group-hover/metric:bg-red-500/20 group-hover/metric:text-red-500 transition-all">
                        <Heart className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-black text-zinc-400">{(post.likes || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-3 shrink-0 p-2 bg-zinc-900/50 rounded-[28px] border border-white/5" onClick={e => e.stopPropagation()}>
                  
                  {/* ── REMANEJAR ── */}
                  <div className="flex flex-col gap-1 mr-2 bg-black/40 p-2 rounded-2xl border border-zinc-800/50">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-1 text-center">Mover para:</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={pendingMoves[post.id] || post.competitionId}
                        onChange={(e) => {
                          setPendingMoves((prev: any) => ({ ...prev, [post.id]: e.target.value }));
                        }}
                        className="bg-black/50 border border-zinc-800 rounded-xl py-2 px-3 text-[10px] font-bold text-zinc-300 focus:border-amber-500 outline-none w-[120px]"
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

                  <a href={post.url} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-2xl bg-zinc-800 text-zinc-400 flex items-center justify-center hover:bg-amber-500 hover:text-black transition-all shadow-lg" title="Ver Link Original">
                    <ExternalLink className="w-5 h-5" />
                  </a>

                  <button
                    onClick={() => onForceMonthly(post)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl transition-all text-[9px] tracking-widest uppercase font-black whitespace-nowrap shadow-lg
                      ${(post as any).forceMonthly
                        ? 'bg-violet-500 text-white hover:bg-violet-400'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-violet-600 hover:text-white'
                      }`}
                  >
                    <Calendar className="w-4 h-4" />
                    {(post as any).forceMonthly ? 'MENSAL ✓' : 'MENSAL'}
                  </button>

                  <button
                    onClick={() => onForceDaily(post)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl transition-all text-[9px] tracking-widest uppercase font-black whitespace-nowrap shadow-lg
                      ${(post as any).forceDaily
                        ? 'bg-amber-500 text-black hover:bg-amber-400'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-amber-600 hover:text-white'
                      }`}
                  >
                    <Zap className="w-4 h-4" />
                    {(post as any).forceDaily ? 'DIÁRIO ✓' : 'DIÁRIO'}
                  </button>

                  <button
                    onClick={() => onResetToSync(post)}
                    className="w-12 h-12 rounded-2xl bg-zinc-800 text-zinc-400 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-lg"
                    title="Voltar para Sincronização (Zerar Métricas)"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => onSingleSync(post)}
                    disabled={syncingPostId === post.id}
                    className={`flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl transition-all text-[9px] tracking-widest uppercase font-black whitespace-nowrap
                      ${syncingPostId === post.id 
                        ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30' 
                        : 'bg-zinc-800 text-zinc-300 hover:bg-white hover:text-black'
                      } disabled:opacity-50`}
                  >
                    {syncingPostId === post.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {syncingPostId === post.id ? 'SINCRONIZANDO' : 'SINCRONIZAR'}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800/50">
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase gold-gradient">Ressincronização de Rankings</h3>
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-[0.2em]">Selecione uma competição para atualizar as métricas gerais.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleSyncAllSequentially}
                disabled={syncing}
                className="px-8 py-5 bg-zinc-800 text-zinc-400 font-black rounded-2xl border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {syncing && !syncingCompId ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                SEQUENCIAL
              </button>

              <button
                onClick={handleSyncAllParallel}
                disabled={syncing}
                className="px-10 py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-amber-500/20 disabled:opacity-50"
              >
                {syncing && !syncingCompId ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    MULTI-SYNC: {syncProgress} / {syncTotal}
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 font-black" />
                    MULTI-SYNC ({settings.apifyKeys?.length || 1} CHAVES)
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800/50 space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                  <Key className="w-3 h-3" /> Gestão de Chaves Apify (Multi-Sync)
                </label>
                <p className="text-zinc-500 text-[9px] font-bold uppercase">Adicione múltiplas chaves para acelerar o processamento paralelo.</p>
              </div>

              <div className="flex items-center gap-3 flex-1 max-w-2xl">
                <div className="relative flex-1 group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
                  <input
                    type="text"
                    value={apifyKey}
                    onChange={(e) => setApifyKey(e.target.value)}
                    placeholder="Insira nova chave Apify..."
                    className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:border-amber-500 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={handleSaveApiKey}
                  className="px-6 py-3 gold-bg text-black font-black rounded-xl hover:scale-105 transition-all text-[10px] uppercase"
                >
                  Adicionar
                </button>
              </div>
            </div>

            {settings.apifyKeys && settings.apifyKeys.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/50">
                {settings.apifyKeys.map((key, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-black/40 border border-zinc-800/50 px-3 py-1.5 rounded-lg group">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <code className="text-[9px] text-zinc-400 font-mono">
                      {key.substring(0, 8)}...{key.substring(key.length - 6)}
                    </code>
                    <button 
                      onClick={() => handleDeleteApiKey(key)}
                      className="text-zinc-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {competitions.map(comp => {
              const compPosts = posts.filter(p => p.competitionId === comp.id && (p.status === 'synced' || p.status === 'banned'));
              if (compPosts.length === 0) return null;

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
                              {compPosts.length} <span className="text-zinc-700">Auditados</span>
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
                          handleSyncCompetitionSequentially(comp.id);
                        }}
                        disabled={syncing}
                        className={`py-4 px-4 rounded-2xl border transition-all flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-widest
                          ${syncingCompId === comp.id && !sessionSyncedIds.length 
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-400' 
                            : 'bg-black border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white'
                          } disabled:opacity-50`}
                      >
                        {syncingCompId === comp.id && !sessionSyncedIds.length ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        SEQUENCIAL
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSyncCompetitionParallel(comp.id);
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
            {(competitions.length === 0 || posts.filter(p => p.status === 'synced' || p.status === 'banned').length === 0) && (
              <div className="col-span-full py-20 text-center border border-dashed border-zinc-800 rounded-[40px]">
                <Clock className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">Nenhuma competição com vídeos auditados.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
