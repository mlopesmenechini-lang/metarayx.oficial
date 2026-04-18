import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, Zap, TrendingUp, Eye, Heart, Camera, Target, Lock, Crown, X, Star, BarChart3, Info, ChevronRight, Check
} from 'lucide-react';
import { doc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, Post, Announcement, Competition, CompetitionRegistration } from '../types';
import { handleFirestoreError, OperationType } from '../firebase';
import { InfoTooltip } from './Shared';

interface DashboardProps {
  user: User;
  announcements: Announcement[];
  rankings: User[];
  competitions: Competition[];
  registrations: CompetitionRegistration[];
  posts: Post[];
  showBalances: boolean;
}

export const Dashboard = ({ user, announcements, rankings, competitions, registrations, posts, showBalances }: DashboardProps) => {
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [acceptedRules, setAcceptedRules] = useState(false);

  const handleRegister = async (compId: string) => {
    if (!acceptedRules) {
      alert('Você precisa aceitar as regras para participar!');
      return;
    }
    try {
      const existingReg = registrations.find(r => r.competitionId === compId && r.userId === user.uid);
      if (existingReg && existingReg.status === 'rejected') {
        const regRef = doc(db, 'competition_registrations', existingReg.id);
        await updateDoc(regRef, {
          status: 'pending',
          timestamp: Date.now()
        });
        alert('Nova solicitação enviada! Aguarde a aprovação da diretoria.');
      } else {
        const newReg: Omit<CompetitionRegistration, 'id'> = {
          competitionId: compId,
          userId: user.uid,
          userName: user.displayName,
          userEmail: user.email,
          status: 'pending',
          acceptedRules: true,
          timestamp: Date.now()
        };
        await addDoc(collection(db, 'competition_registrations'), newReg);
        alert('Solicitação de inscrição enviada! Aguarde a aprovação da diretoria.');
      }

      setSelectedComp(null);
      setAcceptedRules(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'competition_registrations');
    }
  };

  const sortedMonthly = useMemo(() => {
    return [...rankings].sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0)).slice(0, 3);
  }, [rankings]);

  // Agregação por plataforma com base nos posts do usuário
  const platformStats = useMemo(() => {
    const platforms = ['tiktok', 'youtube', 'instagram'] as const;
    return platforms.map(platform => {
      const platformPosts = posts.filter(p => p.platform === platform);
      const views = platformPosts.reduce((acc, p) => acc + (p.views || 0), 0);
      const likes = platformPosts.reduce((acc, p) => acc + (p.likes || 0), 0);
      const comments = platformPosts.reduce((acc, p) => acc + (p.comments || 0), 0);
      const count = platformPosts.length;
      return { platform, views, likes, comments, count };
    });
  }, [posts]);

  const maxViews = Math.max(...platformStats.map(p => p.views), 1);

  return (
    <div className="space-y-12 shrink-0">
      {/* 🚀 Cockpit Pessoal */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
              Bem-vindo(a), <span className="gold-gradient">{user.displayName.split(' ')[0]}</span>!
            </h1>
            <p className="text-zinc-400 font-bold mt-1 text-sm md:text-base">Métricas da sua performance geral no HUB.</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-black text-emerald-500 w-fit">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            CONTA ATIVA
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass shadow-2xl shadow-amber-500/5 hover:border-amber-500/50 transition-all border border-amber-500/20 p-6 rounded-[32px] relative group flex flex-col justify-between min-h-[140px]">
            <div className="absolute inset-0 overflow-hidden rounded-[32px] pointer-events-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-amber-500/20 transition-all" />
              <TrendingUp className="absolute -bottom-4 -right-4 w-24 h-24 text-amber-500/10 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest relative z-10 flex items-center">
              LUCRO ACUMULADO <InfoTooltip text="Total de ganhos que você já acumulou na plataforma até hoje." />
            </h3>
            <p className="text-2xl md:text-3xl font-black text-white relative z-10">R$ {showBalances ? (user.lifetimeEarnings || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '***'}</p>
          </div>

          <div className="glass border border-cyan-500/20 hover:border-cyan-500/50 transition-all p-6 rounded-[32px] relative group flex flex-col justify-between min-h-[140px]">
            <div className="absolute inset-0 overflow-hidden rounded-[32px] pointer-events-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-cyan-500/20 transition-all" />
              <Eye className="absolute -bottom-4 -right-4 w-24 h-24 text-cyan-500/10 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest relative z-10 flex items-center">
              TOTAL DE VIEWS <InfoTooltip text="Soma das visualizações de todos os seus vídeos aprovados e sincronizados." />
            </h3>
            <p className="text-2xl md:text-3xl font-black text-white relative z-10">{(user.totalViews || 0).toLocaleString()}</p>
          </div>

          <div className="glass border border-pink-500/20 hover:border-pink-500/50 transition-all p-6 rounded-[32px] relative group flex flex-col justify-between min-h-[140px]">
            <div className="absolute inset-0 overflow-hidden rounded-[32px] pointer-events-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-pink-500/20 transition-all" />
              <Heart className="absolute -bottom-4 -right-4 w-24 h-24 text-pink-500/10 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-[10px] font-black text-pink-500 uppercase tracking-widest relative z-10 flex items-center">
              TOTAL DE LIKES <InfoTooltip text="Soma das curtidas de todos os seus vídeos aprovados e sincronizados." />
            </h3>
            <p className="text-2xl md:text-3xl font-black text-white relative z-10">{(user.totalLikes || 0).toLocaleString()}</p>
          </div>

          <div className="glass border border-zinc-700/50 hover:border-zinc-500 transition-all p-6 rounded-[32px] relative group flex flex-col justify-between min-h-[140px]">
            <div className="absolute inset-0 overflow-hidden rounded-[32px] pointer-events-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-white/10 transition-all" />
              <Camera className="absolute -bottom-4 -right-4 w-24 h-24 text-white/5 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest relative z-10 flex items-center">
              VÍDEOS SINCRONIZADOS <InfoTooltip text="Quantidade de vídeos seus que já foram validados e processados pelo sistema." />
            </h3>
            <p className="text-2xl md:text-3xl font-black text-white relative z-10">{(user.totalPosts || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 🎯 Foco Central: Competições */}
      {competitions.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-3">
              <Target className="w-6 h-6 text-amber-500" /> Foco Atual
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-black text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20 shadow-lg">
              <Zap className="w-3 h-3" /> COMPETIÇÕES
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {competitions.map(comp => {
              const compStatus = comp.status || (comp.isActive ? 'active' : 'inactive');
              const isLocked = compStatus === 'upcoming' || compStatus === 'inactive';

              return (
                <motion.div
                  key={comp.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`group relative h-64 rounded-[40px] overflow-hidden border ${isLocked ? 'border-zinc-900 shadow-none cursor-not-allowed opacity-80' : 'border-zinc-800 shadow-2xl cursor-pointer'}`}
                  onClick={() => {
                    if (!isLocked) {
                      setSelectedComp(comp);
                    }
                  }}
                >
                  <img src={comp.bannerUrl} className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${!isLocked && 'group-hover:scale-110'} ${compStatus === 'inactive' ? 'grayscale opacity-80' : ''}`} alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                  {isLocked && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                       <Lock className={`w-16 h-16 ${compStatus === 'upcoming' ? 'text-amber-500' : 'text-zinc-600'}`} />
                    </div>
                  )}

                  <div className="absolute inset-0 p-8 flex flex-col justify-end space-y-4">
                    <div className="space-y-1 relative z-10">
                      <h3 className="text-3xl font-black tracking-tighter uppercase leading-none">{comp.title}</h3>
                      <p className="text-zinc-300 text-xs font-bold line-clamp-2 max-w-md">{comp.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 relative z-10">
                      {comp.prizes.slice(0, 3).map((prize, idx) => (
                        <div key={idx} className={`flex items-center gap-2 backdrop-blur-md px-4 py-2 rounded-2xl border ${isLocked ? 'bg-black/50 border-white/5 opacity-50' : 'bg-white/10 border-white/10'}`}>
                          <Trophy className={`w-4 h-4 ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-zinc-300' : 'text-amber-700'}`} />
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-zinc-400 uppercase leading-none">{prize.label}</span>
                            <span className="text-xs font-black text-white">R$ {prize.value.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="absolute top-6 right-6 z-10">
                    {(() => {
                      if (compStatus === 'upcoming') {
                        return (
                          <div className="bg-amber-500 text-black px-4 py-1.5 rounded-full text-[10px] font-black shadow-xl uppercase tracking-widest">
                            EM BREVE
                          </div>
                        );
                      }
                      if (compStatus === 'inactive') {
                        return (
                          <div className="bg-zinc-800 text-zinc-400 px-4 py-1.5 rounded-full text-[10px] font-black shadow-xl uppercase tracking-widest">
                            FINALIZADA
                          </div>
                        );
                      }

                      const reg = registrations.find(r => r.competitionId === comp.id && r.userId === user.uid);
                      if (!reg) {
                        return (
                          <div className="bg-amber-500 text-black px-6 py-2 rounded-full text-xs font-black shadow-xl hover:scale-105 transition-all">
                            VER DETALHES
                          </div>
                        );
                      }
                      return (
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black shadow-xl ${reg.status === 'approved' ? 'bg-emerald-500 text-black' :
                            reg.status === 'rejected' ? 'bg-red-500 text-white' :
                              'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                          }`}>
                          {reg.status === 'approved' ? 'PARTICIPANDO' :
                            reg.status === 'rejected' ? 'RECUSADO' : 'AGUARDANDO APROVAÇÃO'}
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🏅 Competições e Pódio */}
      <div className="grid grid-cols-1 gap-6 items-start pb-10">
        
        {/* Elite do Mês */}
        <div className="glass border border-zinc-800 rounded-[40px] p-8">
          {sortedMonthly.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight uppercase">Elite do Mês</h2>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Global</p>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-black text-zinc-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  TEMPO REAL
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 items-end pt-10 pb-4">
                {/* 2nd Place */}
                {sortedMonthly[1] && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div className="absolute -top-4 -right-2 w-8 h-8 rounded-full bg-zinc-400 flex items-center justify-center border-2 border-black z-10">
                        <span className="text-[10px] font-black text-black">2º</span>
                      </div>
                      <img src={sortedMonthly[1].photoURL || `https://ui-avatars.com/api/?name=${sortedMonthly[1].displayName}`} className="w-16 h-16 md:w-20 md:h-20 rounded-[32px] border-4 border-zinc-400/30 object-cover shadow-2xl" alt="" referrerPolicy="no-referrer" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs md:text-sm font-black truncate max-w-[90px]">@{sortedMonthly[1].displayName}</p>
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none">Views</span>
                        <span className="text-xs md:text-sm font-black text-cyan-400">{(sortedMonthly[1].totalViews || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full h-24 md:h-28 bg-gradient-to-t from-zinc-800/50 to-zinc-800/20 rounded-t-3xl border-x border-t border-zinc-800 flex flex-col items-center justify-start pt-4">
                      <div className="w-6 h-6 rounded-full bg-zinc-400/10 flex items-center justify-center"><Trophy className="w-3 h-3 text-zinc-400" /></div>
                    </div>
                  </motion.div>
                )}

                {/* 1st Place */}
                {sortedMonthly[0] && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 2, repeat: Infinity }} className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
                        <Crown className="w-8 h-8 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                      </motion.div>
                      <div className="absolute -top-4 -right-2 w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center border-2 border-black z-10 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                        <span className="text-xs font-black text-black">1º</span>
                      </div>
                      <img src={sortedMonthly[0].photoURL || `https://ui-avatars.com/api/?name=${sortedMonthly[0].displayName}`} className="w-20 h-20 md:w-28 md:h-28 rounded-[40px] border-4 border-amber-500 object-cover shadow-[0_0_40px_rgba(245,158,11,0.2)]" alt="" referrerPolicy="no-referrer" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm md:text-base font-black gold-gradient truncate max-w-[110px]">@{sortedMonthly[0].displayName}</p>
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none">Views</span>
                        <span className="text-sm md:text-lg font-black text-cyan-400">{(sortedMonthly[0].totalViews || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full h-32 md:h-36 bg-gradient-to-t from-amber-500/20 to-amber-500/5 rounded-t-[40px] border-x border-t border-amber-500/30 flex flex-col items-center justify-start pt-4 relative overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center relative z-10"><Trophy className="w-4 h-4 text-amber-500" /></div>
                    </div>
                  </motion.div>
                )}

                {/* 3rd Place */}
                {sortedMonthly[2] && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div className="absolute -top-4 -right-2 w-8 h-8 rounded-full bg-amber-800 flex items-center justify-center border-2 border-black z-10">
                        <span className="text-[10px] font-black text-white">3º</span>
                      </div>
                      <img src={sortedMonthly[2].photoURL || `https://ui-avatars.com/api/?name=${sortedMonthly[2].displayName}`} className="w-16 h-16 md:w-20 md:h-20 rounded-[32px] border-4 border-amber-800/30 object-cover shadow-2xl" alt="" referrerPolicy="no-referrer" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs md:text-sm font-black truncate max-w-[90px]">@{sortedMonthly[2].displayName}</p>
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none">Views</span>
                        <span className="text-xs md:text-sm font-black text-cyan-400">{(sortedMonthly[2].totalViews || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full h-20 md:h-24 bg-gradient-to-t from-amber-900/40 to-amber-900/10 rounded-t-3xl border-x border-t border-amber-900/30 flex flex-col items-center justify-start pt-4">
                      <div className="w-6 h-6 rounded-full bg-amber-900/20 flex items-center justify-center"><Trophy className="w-3 h-3 text-amber-800" /></div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center opacity-50">
              <Trophy className="w-12 h-12 text-zinc-700 mb-4" />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Ranking em apuração</p>
            </div>
          )}
        </div>


      </div>

      {/* Competition Details Modal */}
      <AnimatePresence>
        {selectedComp && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedComp(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass rounded-[40px] border border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="h-48 shrink-0 relative">
                <img src={selectedComp.bannerUrl} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
                <button
                  onClick={() => setSelectedComp(null)}
                  className="absolute top-6 right-6 p-2 rounded-full bg-black/50 text-white hover:bg-black transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-6 left-8">
                  <h3 className="text-3xl font-black uppercase tracking-tighter">{selectedComp.title}</h3>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Hashtags</p>
                    <p className="text-xs font-bold text-amber-500">{selectedComp.hashtags || 'Nenhuma'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Marcações</p>
                    <p className="text-xs font-bold text-amber-500">{selectedComp.mentions || 'Nenhuma'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Bônus</p>
                    <p className="text-xs font-bold text-emerald-500">{selectedComp.bonuses || 'Nenhum'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400">Regras da Competição</h4>
                  <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-medium">
                    {selectedComp.rules || selectedComp.description}
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedComp.prizesMonthly && selectedComp.prizesMonthly.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400">Premiação Mensal (Tempo de Competição)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedComp.prizesMonthly.map((prize, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">
                                {prize.position}º
                              </div>
                              <span className="text-xs font-bold">{prize.label}</span>
                            </div>
                            <span className="text-sm font-black text-amber-500">R$ {prize.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedComp.prizesDaily && selectedComp.prizesDaily.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400">Premiação Diária</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedComp.prizesDaily.map((prize, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">
                                {prize.position}º
                              </div>
                              <span className="text-xs font-bold">{prize.label}</span>
                            </div>
                            <span className="text-sm font-black text-cyan-500">R$ {prize.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedComp.prizesInstagram && selectedComp.prizesInstagram.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400">Premiação Instagram (Quantidade)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedComp.prizesInstagram.map((prize, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">
                                {prize.position}º
                              </div>
                              <span className="text-xs font-bold">{prize.label}</span>
                            </div>
                            <span className="text-sm font-black text-pink-500">R$ {prize.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!selectedComp.prizesDaily && !selectedComp.prizesMonthly && !selectedComp.prizesInstagram) && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400">Premiação</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedComp.prizes.map((prize, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">
                                {prize.position}º
                              </div>
                              <span className="text-xs font-bold">{prize.label}</span>
                            </div>
                            <span className="text-sm font-black text-amber-500">R$ {prize.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-8 bg-zinc-950 border-t border-zinc-900 space-y-6">
                {(() => {
                  const existingReg = registrations.find(r => r.competitionId === selectedComp.id && r.userId === user.uid);
                  if (!existingReg || existingReg.status === 'rejected') {
                    return (
                      <>
                        <label className="flex items-start gap-4 cursor-pointer group">
                          <div className="relative flex items-center mt-1">
                            <input
                              type="checkbox"
                              checked={acceptedRules}
                              onChange={(e) => setAcceptedRules(e.target.checked)}
                              className="peer h-5 w-5 appearance-none rounded border-2 border-zinc-800 bg-zinc-900 transition-all checked:border-amber-500 checked:bg-amber-500"
                            />
                            <Check className="absolute h-3.5 w-3.5 text-black opacity-0 transition-opacity peer-checked:opacity-100 left-0.5" />
                          </div>
                          <span className="text-xs font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors">
                            Eu li e aceito todas as regras e condições desta competição.
                          </span>
                        </label>
                        <button
                          onClick={() => handleRegister(selectedComp.id)}
                          disabled={!acceptedRules}
                          className={`w-full py-5 font-black rounded-2xl transition-all shadow-xl ${
                            acceptedRules 
                              ? 'gold-bg text-black hover:scale-[1.02] shadow-amber-500/20' 
                              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                          }`}
                        >
                          {existingReg?.status === 'rejected' ? 'SOLICITAR NOVAMENTE' : 'SOLICITAR INSCRIÇÃO'}
                        </button>
                      </>
                    );
                  }
                  return (
                    <div className="text-center py-2">
                      <p className="text-amber-500 font-black uppercase tracking-widest text-sm">
                        {existingReg.status === 'approved' 
                          ? 'Você já está participando desta competição' 
                          : 'Você já solicitou inscrição nesta competição'}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Seção: Performance por Rede + Elite Global */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-6">

        {/* Performance por Rede Social (2/3) */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase">Desempenho por Rede</h2>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Suas métricas por plataforma</p>
            </div>
          </div>

          {posts.length > 0 ? (
            <div className="space-y-4">
              {platformStats.map(({ platform, views, likes, comments, count }) => {
                const barWidth = maxViews > 0 ? Math.max((views / maxViews) * 100, count > 0 ? 4 : 0) : 0;
                const platformConfig = {
                  tiktok: {
                    label: 'TikTok',
                    emoji: '🎵',
                    color: 'from-pink-500 to-rose-500',
                    border: 'border-pink-500/20',
                    glow: 'shadow-pink-500/20',
                    text: 'text-pink-400',
                    bg: 'bg-pink-500/10',
                  },
                  youtube: {
                    label: 'YouTube',
                    emoji: '▶️',
                    color: 'from-red-500 to-orange-500',
                    border: 'border-red-500/20',
                    glow: 'shadow-red-500/20',
                    text: 'text-red-400',
                    bg: 'bg-red-500/10',
                  },
                  instagram: {
                    label: 'Instagram',
                    emoji: '📸',
                    color: 'from-purple-500 to-pink-500',
                    border: 'border-purple-500/20',
                    glow: 'shadow-purple-500/20',
                    text: 'text-purple-400',
                    bg: 'bg-purple-500/10',
                  },
                };
                const cfg = platformConfig[platform];
                const isLeader = views === maxViews && views > 0;

                return (
                  <motion.div
                    key={platform}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`glass border ${cfg.border} p-6 rounded-[28px] space-y-4 relative overflow-hidden`}
                  >
                    {isLeader && (
                      <div className="absolute top-3 right-4 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" /> Melhor desempenho
                      </div>
                    )}

                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl w-10 h-10 rounded-2xl ${cfg.bg} flex items-center justify-center`}>{cfg.emoji}</div>
                        <div>
                          <p className="font-black text-base">{cfg.label}</p>
                          <p className="text-[10px] text-zinc-500 font-bold">{count} vídeo{count !== 1 ? 's' : ''} sincronizado{count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-black ${count > 0 ? cfg.text : 'text-zinc-700'}`}>{views.toLocaleString()}</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">views</p>
                      </div>
                    </div>

                    {/* Barra de progresso */}
                    <div className="relative">
                      <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                          className={`h-full rounded-full bg-gradient-to-r ${cfg.color}`}
                        />
                      </div>
                    </div>

                    {/* Métricas secundárias */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-3 text-center`}>
                        <p className={`text-sm font-black ${cfg.text}`}>{likes.toLocaleString()}</p>
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">Likes</p>
                      </div>
                      <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-3 text-center`}>
                        <p className={`text-sm font-black ${cfg.text}`}>{comments.toLocaleString()}</p>
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">Comentários</p>
                      </div>
                      <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-3 text-center`}>
                        <p className={`text-sm font-black ${cfg.text}`}>{count > 0 ? Math.round(views / count).toLocaleString() : '—'}</p>
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">Média/vídeo</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center glass rounded-[32px] border border-zinc-800 text-center">
              <BarChart3 className="w-12 h-12 text-zinc-700 mb-4" />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Nenhum vídeo sincronizado ainda</p>
              <p className="text-zinc-600 text-xs mt-2 font-bold">Envie seus links para começar a ver os dados</p>
            </div>
          )}
        </div>

        {/* Elite Global (1/3) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase">Elite Global</h2>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Top do HUB</p>
            </div>
          </div>
          <div className="glass border border-zinc-800/50 rounded-[32px] p-4 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            {[...rankings].sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0)).map((player, i) => {
              const isMe = player.uid === user.uid;
              const rankStyles = ['text-amber-400 border-amber-500/30 bg-amber-500/10','text-zinc-300 border-zinc-500/30 bg-zinc-500/10','text-orange-500 border-orange-700/30 bg-orange-700/10'];
              const badgeStyle = rankStyles[i] || 'text-zinc-500 border-zinc-800 bg-zinc-900/30';
              return (
                <motion.div key={player.uid} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${isMe ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-zinc-800/40'}`}
                >
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center text-[10px] font-black shrink-0 ${badgeStyle}`}>
                    {i === 0 ? <Crown className="w-3.5 h-3.5" /> : `${i + 1}º`}
                  </div>
                  <img src={player.photoURL || `https://ui-avatars.com/api/?name=${player.displayName}&background=random&bold=true`}
                    className={`w-9 h-9 rounded-xl object-cover shrink-0 ${isMe ? 'ring-2 ring-amber-500' : ''}`}
                    alt="" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black truncate ${isMe ? 'text-amber-400' : 'text-white'}`}>{isMe ? 'Você' : player.displayName}</p>
                    <p className="text-[10px] text-zinc-500 font-bold">{(player.totalViews || 0).toLocaleString()} views</p>
                  </div>
                  {i === 0 && <Trophy className="w-4 h-4 text-amber-500 shrink-0" />}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
