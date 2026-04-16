import React from 'react';
import { 
  Zap, 
  TrendingUp, 
  Camera, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  History, 
  ChevronRight, 
  ShieldCheck
} from 'lucide-react';
import { Post, Competition, PostStatus } from '../../types';
import { PostTagRow } from './AdminUI';

interface TriagemTabProps {
  posts: Post[];
  competitions: Competition[];
  syncDetailCompId: string | null;
  setSyncDetailCompId: (id: string | null) => void;
  handlePostStatus: (postId: string, status: PostStatus) => void;
}

export const TriagemTab: React.FC<TriagemTabProps> = ({
  posts,
  competitions,
  syncDetailCompId,
  setSyncDetailCompId,
  handlePostStatus,
}) => {
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
            <button
              onClick={() => setSyncDetailCompId(null)}
              className="px-8 py-3 bg-zinc-800 text-white font-black rounded-2xl text-xs hover:bg-zinc-700 transition-all flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> VOLTAR AOS CARDS
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {posts.filter(p => p.status === 'pending' && p.competitionId === syncDetailCompId).map(post => (
              <div key={post.id} className="p-6 rounded-3xl glass border border-zinc-800 flex flex-col md:flex-row items-center gap-6 group hover:border-amber-500/30 transition-all">
                
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
                  <p className="text-sm font-black text-zinc-300 uppercase tracking-tight mb-1">{post.userName}</p>
                  <p className="font-bold truncate text-zinc-500 mb-2 text-xs">{post.url}</p>
                  <div className="flex items-center justify-center md:justify-start gap-4 text-[10px] font-black text-zinc-500">
                    <span className="uppercase">{post.platform}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span>{new Date(post.timestamp).toLocaleString()}</span>
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
                    onClick={() => handlePostStatus(post.id, 'rejected')}
                    className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                    title="Rejeitar Link"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-black uppercase gold-gradient">Triagem por Competição</h3>
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
