import React from 'react';
import { 
  Zap, 
  TrendingUp, 
  Camera, 
  Download, 
  Archive 
} from 'lucide-react';
import { Post, Competition } from '../../types';

interface RelatoriosTabProps {
  posts: Post[];
  competitions: Competition[];
  selectedCompId: string | null;
  setSelectedCompId: (id: string | null) => void;
  handleExportExcel: () => void;
  userRole: string;
  ListHeader: any; // Passing component as prop or we can move ListHeader to a shared place
}

export const RelatoriosTab: React.FC<RelatoriosTabProps> = ({
  posts,
  competitions,
  selectedCompId,
  setSelectedCompId,
  handleExportExcel,
  userRole,
  ListHeader
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50">
        <div className="space-y-2">
          <h3 className="text-2xl font-black uppercase gold-gradient">Relatórios e Extração</h3>
          <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">
            Veja e exporte em planilha todos os links postados na competição.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <select
            value={selectedCompId || ''}
            onChange={(e) => setSelectedCompId(e.target.value)}
            className="bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-xs font-black text-amber-500 outline-none focus:border-amber-500 transition-all uppercase w-full sm:w-auto"
          >
            <option value="">SELECIONE A COMPETIÇÃO...</option>
            {competitions.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <button
            onClick={handleExportExcel}
            disabled={!selectedCompId}
            className="px-8 py-4 bg-emerald-500/10 text-emerald-500 font-black rounded-2xl hover:bg-emerald-500 hover:text-black transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:hover:bg-emerald-500/10 disabled:hover:text-emerald-500 w-full sm:w-auto shadow-xl shadow-emerald-500/5"
          >
            <Download className="w-5 h-5" /> BAIXAR PLANILHA
          </button>
        </div>
      </div>

      {selectedCompId && (
        <div className="bg-black border border-zinc-800 rounded-[32px] overflow-hidden p-6 md:p-8">
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <ListHeader columns={['PLATAFORMA', 'LINK DO VÍDEO', 'USUÁRIO CRIADOR', 'CURTIDAS', 'VIEWS', 'STATUS DO LINK']} gridClass="grid-cols-[100px_minmax(0,1.5fr)_minmax(0,1fr)_100px_100px_120px]" />
                <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                  {posts.filter(p => p.competitionId === selectedCompId).length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
                      <Archive className="w-10 h-10 text-zinc-800 mx-auto mb-4" />
                      <p className="font-black text-zinc-500 text-xs tracking-widest uppercase">Nenhum link encontrado para esta competição.</p>
                    </div>
                  ) : (
                    posts.filter(p => p.competitionId === selectedCompId).sort((a, b) => b.timestamp - a.timestamp).map(post => (
                      <div key={post.id} className="grid grid-cols-[100px_minmax(0,1.5fr)_minmax(0,1fr)_100px_100px_120px] gap-4 p-5 rounded-2xl bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors items-center text-xs border border-zinc-800/30">
                        <div className="flex justify-center">
                          {post.platform === 'tiktok' ? <Zap className="w-6 h-6 text-amber-500" /> :
                           post.platform === 'youtube' ? <TrendingUp className="w-6 h-6 text-red-500" /> :
                           <Camera className="w-6 h-6 text-pink-500" />}
                        </div>
                        <div className="font-bold text-zinc-300 truncate px-2">
                          <a href={post.url} target="_blank" rel="noreferrer" className="hover:text-amber-500 hover:underline">{post.url}</a>
                        </div>
                        <div className="font-black text-zinc-400 capitalize truncate px-2">{post.userName}</div>
                        <div className="font-black text-emerald-400 text-center bg-emerald-500/10 py-1.5 rounded-lg">{post.likes?.toLocaleString() || 0}</div>
                        <div className="font-black text-amber-500 text-center bg-amber-500/10 py-1.5 rounded-lg">{post.views?.toLocaleString() || 0}</div>
                        <div className="flex justify-center">
                          <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${post.status === 'approved' || post.status === 'synced' ? 'bg-emerald-500/20 text-emerald-500' : post.status === 'rejected' || post.status === 'banned' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'}`}>
                            {post.status === 'approved' || post.status === 'synced' ? 'APROVADO' : post.status === 'rejected' || post.status === 'banned' ? 'RECUSADO' : 'EM TRIAGEM'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
