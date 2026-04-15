import React from 'react';
import { 
  Zap, 
  TrendingUp, 
  Camera, 
  Trash2,
  ExternalLink 
} from 'lucide-react';
import { Post, User } from '../../types';

interface RemovidosTabProps {
  posts: Post[];
  handleDeleteUserPost: (postId: string) => Promise<void>;
  userRole: string;
  ListHeader: any;
}

export const RemovidosTab: React.FC<RemovidosTabProps> = ({
  posts,
  handleDeleteUserPost,
  userRole,
  ListHeader
}) => {
  const removedPosts = posts.filter(p => p.status === 'rejected' || p.status === 'banned' || p.status === 'deleted');

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50">
        <h3 className="text-2xl font-black uppercase gold-gradient">Posts Removidos / Recusados</h3>
        <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">
          Histórico de vídeos que foram removidos do sistema ou recusados na triagem.
        </p>
      </div>

      <div className="bg-black border border-zinc-800 rounded-[32px] overflow-hidden p-6 md:p-8">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <ListHeader columns={['PLATAFORMA', 'LINK', 'USUÁRIO', 'STATUS', 'AÇÕES']} gridClass="grid-cols-[100px_minmax(0,2fr)_minmax(0,1fr)_120px_100px]" />
            <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
              {removedPosts.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl text-zinc-600 font-black uppercase text-xs tracking-widest">
                  Nenhum post removido encontrado.
                </div>
              ) : (
                removedPosts.sort((a, b) => b.timestamp - a.timestamp).map(post => (
                  <div key={post.id} className="grid grid-cols-[100px_minmax(0,2fr)_minmax(0,1fr)_120px_100px] gap-4 p-5 rounded-2xl bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors items-center text-xs border border-zinc-800/30">
                    <div className="flex justify-center">
                      {post.platform === 'tiktok' ? <Zap className="w-6 h-6 text-amber-500" /> :
                       post.platform === 'youtube' ? <TrendingUp className="w-6 h-6 text-red-500" /> :
                       <Camera className="w-6 h-6 text-pink-500" />}
                    </div>
                    <div className="font-bold text-zinc-400 truncate px-2">{post.url}</div>
                    <div className="font-black text-zinc-500 capitalize truncate px-2">{post.userName}</div>
                    <div className="flex justify-center">
                      <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${post.status === 'deleted' ? 'bg-red-900/20 text-red-600' : 'bg-zinc-800 text-zinc-500'}`}>
                        {post.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-center gap-2">
                      <a href={post.url} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button 
                        onClick={() => handleDeleteUserPost(post.id)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
