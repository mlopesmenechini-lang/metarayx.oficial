import React, { useState } from 'react';
import { 
  Zap, 
  TrendingUp, 
  Camera, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  History, 
  ChevronRight, 
  ShieldCheck,
  Check,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { Post, Competition, PostStatus } from '../../types';
import { PostTagRow } from './AdminUI';

interface TriagemTabProps {
  posts: Post[];
  competitions: Competition[];
  syncDetailCompId: string | null;
  setSyncDetailCompId: (id: string | null) => void;
  handlePostStatus: (postId: string, status: PostStatus) => void;
  handleApproveAsMonthly: (postId: string) => Promise<void>;
  handleMovePostToCompetition: (postId: string, newCompId: string) => Promise<void>;
  pendingMoves: Record<string, string>;
  setPendingMoves: (val: any) => void;
  selectedAdminHandle: string;
  setSelectedAdminHandle: (handle: string) => void;
  adminHandles: string[];
}

export const TriagemTab: React.FC<TriagemTabProps> = ({
  posts,
  competitions,
  syncDetailCompId,
  setSyncDetailCompId,
  handlePostStatus,
  handleApproveAsMonthly,
  handleMovePostToCompetition,
  pendingMoves,
  setPendingMoves,
  selectedAdminHandle,
  setSelectedAdminHandle,
  adminHandles
}) => {
  const [selectedUserFilter, setSelectedUserFilter] = useState('all');

  const availableUsers = Array.from(new Set(
    posts.filter(p => p.competitionId === syncDetailCompId && p.status === 'pending').map(p => p.userName)
  )).filter(Boolean).sort() as string[];

  const normalizeUrlLocal = (url: string) => {
    try {
      let clean = url.trim().toLowerCase();
      if (clean.includes('youtube.com') || clean.includes('youtu.be')) {
        let videoId = '';
        if (clean.includes('v=')) videoId = clean.split('v=')[1]?.split('&')[0]?.split('?')[0];
        else if (clean.includes('/shorts/')) videoId = clean.split('/shorts/')[1]?.split('?')[0];
        else if (clean.includes('youtu.be/')) videoId = clean.split('youtu.be/')[1]?.split('?')[0];
        if (videoId) return `youtube:${videoId}`;
      }
      if (clean.includes('tiktok.com')) {
        if (clean.includes('/video/')) {
          const videoId = clean.split('/video/')[1]?.split('?')[0]?.split('/')[0];
          if (videoId) return `tiktok:${videoId}`;
        }
      }
      if (clean.includes('instagram.com')) {
        const parts = clean.split('/');
        const pIndex = parts.indexOf('p');
        const reelIndex = parts.indexOf('reel');
        const parentIndex = pIndex !== -1 ? pIndex : reelIndex;
        if (parentIndex !== -1 && parts.length > parentIndex + 1) {
          return `instagram:${parts[parentIndex + 1].split('?')[0]}`;
        }
      }
      // Fallback: limpa parâmetros de rastreio para qualquer outro tipo de link
      return clean.split('?')[0].replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');
    } catch { return url; }
  };

  const getDuplicateContext = (post: Post) => {
    const norm = normalizeUrlLocal(post.url);
    if (!norm) return false;
    // Verifica se existe algum outro post com mesmo link (aprovado/synced ou mais antigo pendente)
    return posts.some(p => p.id !== post.id && normalizeUrlLocal(p.url) === norm);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {syncDetailCompId ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800/50">
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase gold-gradient">
                Triagem: {competitions.find(c => c.id === syncDetailCompId)?.title}
              </h3>
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Aprovação de Novos Links</p>
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

              {/* Filtro por Nome de Usuário */}
              <div className="flex flex-col gap-1.5 w-[200px]">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Filtrar por Usuário</label>
                <select
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="bg-black border border-zinc-800 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer truncate"
                >
                  <option value="all">Todos os Usuários</option>
                  {availableUsers.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setSyncDetailCompId(null)}
                className="px-8 py-3 bg-zinc-800 text-white font-black rounded-2xl text-xs hover:bg-zinc-700 transition-all flex items-center gap-2 h-fit mt-auto"
              >
                <ArrowLeft className="w-4 h-4" /> VOLTAR AOS CARDS
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {posts.filter(p => {
              const matchesComp = p.competitionId === syncDetailCompId;
              const matchesStatus = p.status === 'pending';
              const matchesHandle = selectedAdminHandle === 'all' || p.accountHandle === selectedAdminHandle;
              const matchesUser = selectedUserFilter === 'all' || p.userName === selectedUserFilter;
              return matchesComp && matchesStatus && matchesHandle && matchesUser;
            }).map(post => {
              const isDuplicated = getDuplicateContext(post);
              return (
              <div key={post.id} className={`relative p-6 rounded-3xl glass border ${isDuplicated ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)] bg-red-500/5' : 'border-zinc-800'} flex flex-col md:flex-row items-center gap-6 group hover:border-amber-500/30 transition-all`}>
                
                {isDuplicated && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full animate-pulse flex items-center gap-1.5 shadow-lg shadow-red-600/30">
                    <AlertTriangle className="w-3 h-3" /> LINK DUPLICADO
                  </div>
                )}

                {/* ── TARJAS ── */}
                <PostTagRow postId={post.id} />

                {/* ── ÍCONE PLATAFORMA ── */}
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
                  {post.platform === 'tiktok' ? <Zap className="w-8 h-8 text-amber-500" /> :
                    post.platform === 'youtube' ? <TrendingUp className="w-8 h-8 text-red-500" /> :
                      <Camera className="w-8 h-8 text-pink-500" />}
                </div>

                {/* ── INFOS ── */}
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

                {/* ── AÇÕES ── */}
                <div className="flex items-center gap-3 shrink-0">
                  <a href={post.url} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-xl bg-zinc-900 text-zinc-400 font-bold text-xs hover:text-zinc-100 transition-colors">
                    Ver Link
                  </a>
                  <button
                    onClick={() => handlePostStatus(post.id, 'approved')}
                    className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all"
                    title="Aprovar Link"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => handleApproveAsMonthly(post.id)}
                    className="p-3 rounded-xl bg-violet-500/10 text-violet-500 hover:bg-violet-500 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-violet-500"
                    title="Aprovar (Somente Mensal / Pula o Diário)"
                  >
                    <Calendar className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => handlePostStatus(post.id, 'rejected')}
                    className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                    title="Rejeitar Link"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )})}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase gold-gradient">
                Triagem por Competição
              </h3>
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Links pendentes aguardando revisão oficial.</p>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {competitions.map(comp => {
              const compPendingPosts = posts.filter(p => p.competitionId === comp.id && p.status === 'pending');
              if (compPendingPosts.length === 0) return null;

              return (
                <div 
                  key={comp.id} 
                  onClick={() => setSyncDetailCompId(comp.id)}
                  className="p-8 rounded-[40px] glass border border-zinc-800 flex flex-col justify-between group hover:border-amber-500/50 transition-all cursor-pointer bg-zinc-900/20 shadow-xl shadow-black/20"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-800 text-zinc-400 flex items-center justify-center group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-colors">
                        <History className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm uppercase truncate max-w-[150px]">{comp.title}</h4>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{compPendingPosts.length} Links p/ Revisar</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 flex items-center justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    <span>INICIAR TRIAGEM</span>
                    <ChevronRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
            {(competitions.length === 0 || posts.filter(p => p.status === 'pending').length === 0) && (
              <div className="col-span-full py-20 text-center border border-dashed border-zinc-800 rounded-[40px]">
                <ShieldCheck className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">Nenhum post pendente no momento.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
