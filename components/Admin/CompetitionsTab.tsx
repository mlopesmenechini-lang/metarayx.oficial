import React from 'react';
import { 
  X, 
  Eye, 
  DollarSign, 
  Heart, 
  Zap, 
  Camera, 
  MessageSquare, 
  Trophy 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Competition, Post, UserRole } from '../../types';

interface CompetitionsTabProps {
  competitions: Competition[];
  posts: Post[];
  selectedCompId: string | null;
  setSelectedCompId: (id: string | null) => void;
  isCreatingComp: boolean;
  setIsCreatingComp: (v: boolean) => void;
  userRole: UserRole;
  handleEditCompClick: (comp: Competition) => void;
  setCompToDelete: (id: string) => void;
  // Competition Form Props
  compTitle: string;
  setCompTitle: (val: string) => void;
  compRankingMetric: 'views' | 'likes';
  setCompRankingMetric: (val: 'views' | 'likes') => void;
  compGoalTarget: number;
  setCompGoalTarget: (val: number) => void;
  compGoalMetric: 'views' | 'likes';
  setCompGoalMetric: (val: 'views' | 'likes') => void;
  compDesc: string;
  setCompDesc: (val: string) => void;
  compRules: string;
  setCompRules: (val: string) => void;
  compHashtags: string;
  setCompHashtags: (val: string) => void;
  compMentions: string;
  setCompMentions: (val: string) => void;
  compRequiredHashtags: string;
  setCompRequiredHashtags: (val: string) => void;
  compRequiredMentions: string;
  setCompRequiredMentions: (val: string) => void;
  compBonuses: string;
  setCompBonuses: (val: string) => void;
  compInstaBonus: string;
  setCompInstaBonus: (val: string) => void;
  compViewBonus: number;
  setCompViewBonus: (val: number) => void;
  compStartDate: string;
  setCompStartDate: (val: string) => void;
  compEndDate: string;
  setCompEndDate: (val: string) => void;
  compDailyResetTime: string;
  setCompDailyResetTime: (val: string) => void;
  compRequiredMentionsTikTok: string;
  setCompRequiredMentionsTikTok: (val: string) => void;
  compRequiredMentionsYouTube: string;
  setCompRequiredMentionsYouTube: (val: string) => void;
  compRequiredMentionsInsta: string;
  setCompRequiredMentionsInsta: (val: string) => void;
  compBanner: string;
  setCompBanner: (val: string) => void;
  compPositions: number;
  setCompPositions: (val: number) => void;
  compPrizes: any[];
  setCompPrizes: (val: any[]) => void;
  compPositionsDaily: number;
  setCompPositionsDaily: (val: number) => void;
  compPrizesDaily: any[];
  setCompPrizesDaily: (val: any[]) => void;
  compPositionsMonthly: number;
  setCompPositionsMonthly: (val: number) => void;
  compPrizesMonthly: any[];
  setCompPrizesMonthly: (val: any[]) => void;
  compPositionsInstagram: number;
  setCompPositionsInstagram: (val: number) => void;
  compPrizesInstagram: any[];
  setCompPrizesInstagram: (val: any[]) => void;
  handleBannerUpload: (e: any) => void;
  handleCreateCompetition: () => void;
  editingCompId: string | null;
}

export const CompetitionsTab: React.FC<CompetitionsTabProps> = ({
  competitions,
  posts,
  selectedCompId,
  setSelectedCompId,
  isCreatingComp,
  setIsCreatingComp,
  userRole,
  handleEditCompClick,
  setCompToDelete,
  compTitle, setCompTitle,
  compRankingMetric, setCompRankingMetric,
  compGoalTarget, setCompGoalTarget,
  compGoalMetric, setCompGoalMetric,
  compDesc, setCompDesc,
  compRules, setCompRules,
  compHashtags, setCompHashtags,
  compMentions, setCompMentions,
  compRequiredHashtags, setCompRequiredHashtags,
  compRequiredMentions, setCompRequiredMentions,
  compBonuses, setCompBonuses,
  compInstaBonus, setCompInstaBonus,
  compViewBonus, setCompViewBonus,
  compStartDate, setCompStartDate,
  compEndDate, setCompEndDate,
  compDailyResetTime, setCompDailyResetTime,
  compRequiredMentionsTikTok, setCompRequiredMentionsTikTok,
  compRequiredMentionsYouTube, setCompRequiredMentionsYouTube,
  compRequiredMentionsInsta, setCompRequiredMentionsInsta,
  compBanner, setCompBanner,
  compPositions, setCompPositions,
  compPrizes, setCompPrizes,
  compPositionsDaily, setCompPositionsDaily,
  compPrizesDaily, setCompPrizesDaily,
  compPositionsMonthly, setCompPositionsMonthly,
  compPrizesMonthly, setCompPrizesMonthly,
  compPositionsInstagram, setCompPositionsInstagram,
  compPrizesInstagram, setCompPrizesInstagram,
  handleBannerUpload,
  handleCreateCompetition,
  editingCompId
}) => {
  if (selectedCompId) {
    const comp = competitions.find(c => c.id === selectedCompId);
    if (!comp) return null;

    const compPosts = posts.filter(p =>
      p.status === 'approved' &&
      p.timestamp >= comp.startDate &&
      p.timestamp <= (comp.endDate + 86399999)
    );

    const stats = compPosts.reduce((acc, p) => ({
      views: acc.views + (p.views || 0),
      likes: acc.likes + (p.likes || 0),
      comments: acc.comments + (p.comments || 0),
      shares: acc.shares + (p.shares || 0),
      total: acc.total + 1,
      insta: acc.insta + (p.platform === 'instagram' ? 1 : 0)
    }), { views: 0, likes: 0, comments: 0, shares: 0, total: 0, insta: 0 });

    const cpm = 0;
    const goalPercent = comp.goalTarget ? Math.min((stats.views / comp.goalTarget) * 100, 100) : 0;

    const rankingData = compPosts.reduce((acc: any, p) => {
      if (!acc[p.userId]) {
        acc[p.userId] = {
          name: p.userName,
          views: 0,
          count: 0,
          uid: p.userId
        };
      }
      acc[p.userId].views += (p.views || 0);
      acc[p.userId].count += 1;
      return acc;
    }, {});
    const sortedRanking = Object.values(rankingData).sort((a: any, b: any) => b.views - a.views).slice(0, 10);

    return (
      <div className="space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black uppercase tracking-tight">Dashboard da Competição</h3>
          <button
            onClick={() => setSelectedCompId(null)}
            className="px-6 py-2 bg-zinc-800 text-white font-black rounded-xl text-xs flex items-center gap-2 hover:bg-zinc-700 transition-all"
          >
            <X className="w-4 h-4" /> VOLTAR
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[60px]" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6">
                <Eye className="w-6 h-6" />
              </div>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Visualizações Totais</p>
              <h4 className="text-4xl font-black text-white tracking-tighter">{stats.views.toLocaleString()}</h4>
            </div>
          </div>

          <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px]" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6">
                <DollarSign className="w-6 h-6" />
              </div>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">CPM (Investimento/1k Views)</p>
              <h4 className="text-3xl font-black text-white tracking-tighter">R$ {cpm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
            </div>
          </div>

          <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900 relative overflow-hidden group lg:col-span-2">
             <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-[80px]" />
             <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Meta da Competição</p>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">
                      {comp.goalTarget ? `${comp.goalTarget.toLocaleString()} ${comp.goalMetric || 'VIEWS'}` : 'NENHUMA META DEFINIDA'}
                    </h4>
                  </div>
                  <div className="text-right">
                     <span className="text-3xl font-black gold-gradient">{Math.round(goalPercent)}%</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="h-4 w-full bg-black rounded-full overflow-hidden border border-zinc-900 p-1">
                     <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${goalPercent}%` }}
                       className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                     />
                  </div>
                  <div className="flex justify-between text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                     <span>Início</span>
                     <span>Atingido: {stats.views.toLocaleString()}</span>
                     <span>Objetivo</span>
                  </div>
                </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            <span className="text-2xl font-black">{stats.likes.toLocaleString()}</span>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Curtidas</span>
          </div>
          <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <span className="text-2xl font-black">{stats.total}</span>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Posts Publicados</span>
          </div>
          <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
            <Camera className="w-5 h-5 text-pink-500" />
            <span className="text-2xl font-black">{stats.insta}</span>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Postagens Insta</span>
          </div>
          <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            <span className="text-2xl font-black">{stats.comments.toLocaleString()}</span>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Interações</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-8 rounded-[40px] glass border border-zinc-800 space-y-6">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-amber-500" />
              <h4 className="text-xl font-black uppercase tracking-tight">Top 10 Performance</h4>
            </div>
            <div className="space-y-3">
              {sortedRanking.map((u: any, i) => (
                <div key={u.uid} className="flex items-center justify-between p-4 rounded-2xl bg-black border border-zinc-800/50">
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-500'}`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-black text-sm uppercase">{u.name}</p>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase">{u.count} vídeos aprovados</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-white">{u.views.toLocaleString()}</p>
                    <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Views</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black uppercase tracking-tight">Competições</h3>
        {((userRole === 'admin' || userRole === 'administrativo')) && (
          <button
            onClick={() => setIsCreatingComp(!isCreatingComp)}
            className="px-6 py-2 gold-bg text-black font-black rounded-xl text-xs hover:scale-105 transition-all"
          >
            {isCreatingComp ? 'CANCELAR' : 'NOVA COMPETIÇÃO'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {competitions.map((comp) => (
          <div key={comp.id} className="p-6 rounded-[32px] bg-zinc-900 border border-zinc-800 space-y-4 hover:border-amber-500/30 transition-all">
            <div className="h-32 rounded-2xl overflow-hidden bg-black mb-4">
              {comp.bannerUrl ? (
                <img src={comp.bannerUrl} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-800">
                  <Trophy className="w-12 h-12" />
                </div>
              )}
            </div>
            <div>
              <h4 className="font-black uppercase text-lg">{comp.title}</h4>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                {new Date(comp.startDate).toLocaleDateString()} - {new Date(comp.endDate).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCompId(comp.id)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-black text-[10px] uppercase hover:bg-zinc-700 transition-all"
              >
                Detalhes
              </button>
              {userRole === 'admin' && (
                <>
                  <button
                    onClick={() => handleEditCompClick(comp)}
                    className="p-3 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-all"
                  >
                    <Trophy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCompToDelete(comp.id)}
                    className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
