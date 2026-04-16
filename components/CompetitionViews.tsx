import React, { useState, useMemo, useEffect } from 'react';
import { 
  BookOpen, Star, Zap, TrendingUp, Camera, Trophy, 
  CheckCircle2, Clock, Calendar, X, Check, Send, ArrowLeft, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HistoryView } from './HistoryView';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Competition, User, Post, CompetitionRegistration } from '../types';

// ─── CompetitionRegulamento ─────────────────────────────────────────────────
export const CompetitionRegulamento = ({ comp }: { comp: Competition }) => {
  return (
    <div className="space-y-6">
      {comp.description && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-3">
          <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><BookOpen className="w-4 h-4" /> Sobre a Competição</h3>
          <p className="text-zinc-300 font-bold text-sm leading-relaxed whitespace-pre-line">{comp.description}</p>
        </div>
      )}
      {comp.rules && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-3">
          <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><BookOpen className="w-4 h-4" /> Regulamento</h3>
          <p className="text-zinc-300 font-bold text-sm leading-relaxed whitespace-pre-line">{comp.rules}</p>
        </div>
      )}
      {comp.hashtags && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-3">
          <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest"># Hashtags Obrigatórias</h3>
          <p className="text-zinc-300 font-bold text-sm">{comp.hashtags}</p>
        </div>
      )}
      {comp.mentions && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-3">
          <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest">@ Menções Obrigatórias</h3>
          <p className="text-zinc-300 font-bold text-sm">{comp.mentions}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {comp.prizes && comp.prizes.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><Trophy className="w-4 h-4" /> Premiação Geral</h3>
            <div className="space-y-2">
              {comp.prizes.map((prize, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black ${i===0?'bg-amber-500/20 text-amber-400':i===1?'bg-zinc-600/20 text-zinc-400':i===2?'bg-orange-700/20 text-orange-500':'bg-zinc-900 text-zinc-500'}`}>{prize.position}º</span>
                    <span className="text-zinc-300 text-sm font-bold">{prize.label || `${prize.position}º lugar`}</span>
                  </div>
                  <span className="text-amber-400 font-black text-sm">R$ {(prize.value||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {comp.prizesDaily && comp.prizesDaily.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><Zap className="w-4 h-4" /> Premiação Diária</h3>
            <div className="space-y-2">
              {comp.prizesDaily.map((prize, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black ${i===0?'bg-amber-500/20 text-amber-400':i===1?'bg-zinc-600/20 text-zinc-400':i===2?'bg-orange-700/20 text-orange-500':'bg-zinc-900 text-zinc-500'}`}>{prize.position}º</span>
                    <span className="text-zinc-300 text-sm font-bold">{prize.label || `${prize.position}º lugar`}</span>
                  </div>
                  <span className="text-amber-400 font-black text-sm">R$ {(prize.value||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {comp.prizesMonthly && comp.prizesMonthly.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Premiação Mensal</h3>
            <div className="space-y-2">
              {comp.prizesMonthly.map((prize, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black ${i===0?'bg-amber-500/20 text-amber-400':i===1?'bg-zinc-600/20 text-zinc-400':i===2?'bg-orange-700/20 text-orange-500':'bg-zinc-900 text-zinc-500'}`}>{prize.position}º</span>
                    <span className="text-zinc-300 text-sm font-bold">{prize.label || `${prize.position}º lugar`}</span>
                  </div>
                  <span className="text-amber-400 font-black text-sm">R$ {(prize.value||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {comp.prizesInstagram && comp.prizesInstagram.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><Camera className="w-4 h-4" /> Premiação Instagram</h3>
            <div className="space-y-2">
              {comp.prizesInstagram.map((prize, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black ${i===0?'bg-amber-500/20 text-amber-400':i===1?'bg-zinc-600/20 text-zinc-400':i===2?'bg-orange-700/20 text-orange-500':'bg-zinc-900 text-zinc-500'}`}>{prize.position}º</span>
                    <span className="text-zinc-300 text-sm font-bold">{prize.label || `${prize.position}º lugar`}</span>
                  </div>
                  <span className="text-amber-400 font-black text-sm">R$ {(prize.value||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {(comp.bonuses || comp.instaBonus || (comp.viewBonus && comp.viewBonus > 0)) && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-3">
          <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><Star className="w-4 h-4" /> Bônus e Multiplicadores</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(comp.viewBonus && comp.viewBonus > 0) ? (
              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Bônus por View</p>
                <p className="text-amber-400 font-black text-lg">x{comp.viewBonus}</p>
              </div>
            ) : null}
            {comp.instaBonus && (
              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 md:col-span-2">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Bônus Instagram</p>
                <p className="text-zinc-300 font-bold text-sm">{comp.instaBonus}</p>
              </div>
            )}
            {comp.bonuses && (
              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 md:col-span-3">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Outros Bônus</p>
                <p className="text-zinc-300 font-bold text-sm whitespace-pre-line">{comp.bonuses}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CompetitionsView ────────────────────────────────────────────────────────
export const CompetitionsView = ({ user, competitions, registrations, onSelectComp }: { 
  user: User, 
  competitions: Competition[], 
  registrations: CompetitionRegistration[],
  onSelectComp: (id: string) => void
}) => {
  const isStaff = user.role === 'admin' || user.role === 'auditor' || user.role === 'administrativo';
  const [selectedRegulamentoComp, setSelectedRegulamentoComp] = useState<Competition | null>(null);
  const [acceptedRules, setAcceptedRules] = useState(false);

  const handleRegister = async (compId: string) => {
    if (!acceptedRules) {
      alert('Você precisa aceitar as regras para participar!');
      return;
    }
    try {
      const regId = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'competition_registrations', regId), {
        id: regId,
        competitionId: compId,
        userId: user.uid,
        userName: user.displayName,
        userEmail: user.email,
        status: 'pending',
        acceptedRules: true,
        timestamp: Date.now()
      });
      alert('Inscrição solicitada com sucesso! Aguarde a aprovação da diretoria.');
      setSelectedRegulamentoComp(null);
      setAcceptedRules(false);
    } catch (error) {
      console.error('Registration error', error);
      alert('Erro ao solicitar inscrição.');
    }
  };

  const now = Date.now();
  const participating = competitions.filter(c => 
    c.isActive && c.endDate >= now && 
    registrations.some(r => r.competitionId === c.id && r.userId === user.uid && r.status === 'approved')
  );
  const available = competitions.filter(c => 
    c.isActive && c.startDate <= now && c.endDate >= now && 
    !registrations.some(r => r.competitionId === c.id && r.userId === user.uid)
  );
  const pendingRequests = competitions.filter(c => 
    c.isActive && c.endDate >= now && 
    registrations.some(r => r.competitionId === c.id && r.userId === user.uid && r.status === 'pending')
  );
  const upcoming = competitions.filter(c =>
    c.isActive && c.startDate > now &&
    !registrations.some(r => r.competitionId === c.id && r.userId === user.uid)
  );

  const CompetitionCard = ({ comp, type }: { comp: Competition, type: 'participating' | 'available' | 'pending' | 'upcoming' }) => (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden glass group">
      {comp.bannerUrl && (
        <div className="h-32 w-full bg-zinc-800/50 relative overflow-hidden">
          <img src={comp.bannerUrl} alt={comp.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 to-transparent" />
        </div>
      )}
      <div className={`p-6 ${comp.bannerUrl ? '-mt-12 relative z-10' : ''}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 flex border items-center justify-center rounded-xl bg-zinc-900 ${
            type === 'participating' ? 'text-emerald-500 border-emerald-500/20' : 
            type === 'pending' ? 'text-amber-500 border-amber-500/20' :
            type === 'upcoming' ? 'text-blue-500 border-blue-500/20' :
            'text-pink-500 border-pink-500/20'
          }`}>
            {type === 'participating' ? <CheckCircle2 className="w-5 h-5" /> : 
             type === 'pending' ? <Clock className="w-5 h-5" /> : 
             type === 'upcoming' ? <Calendar className="w-5 h-5" /> :
             <Trophy className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-black text-lg text-white leading-tight">{comp.title}</h3>
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">
              {new Date(comp.startDate).toLocaleDateString()} - {new Date(comp.endDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        <p className="text-sm text-zinc-400 font-bold mb-6 line-clamp-2">{comp.description}</p>

        {type === 'available' && (
          <button onClick={() => { setSelectedRegulamentoComp(comp); setAcceptedRules(false); }}
            className="w-full py-4 text-sm font-black gold-bg text-black rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
            SOLICITAR INSCRIÇÃO
          </button>
        )}
        {type === 'pending' && (
          <div className="w-full py-4 text-sm font-black bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center gap-2 border border-amber-500/20">
            AGUARDANDO APROVAÇÃO
          </div>
        )}
        {type === 'participating' && (
          <div className="space-y-3">
            <div className="w-full py-4 text-sm font-black bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center gap-2 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" /> INSCRIÇÃO APROVADA
            </div>
            <button onClick={() => onSelectComp(comp.id)}
              className="w-full py-4 text-sm font-black gold-bg text-black rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
              ACESSAR COMPETIÇÃO
            </button>
          </div>
        )}
        {(isStaff && type !== 'participating') && (
          <button onClick={() => onSelectComp(comp.id)}
            className="w-full mt-3 py-4 text-[10px] font-black bg-zinc-800 text-zinc-400 rounded-xl hover:text-white transition-colors flex items-center justify-center gap-2 border border-zinc-700/50">
            ACESSAR (MODO ADMIN)
          </button>
        )}
        {type === 'upcoming' && (
          <div className="w-full py-4 text-sm font-black bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center gap-2 border border-blue-500/20">
            <Calendar className="w-4 h-4" /> EM BREVE
          </div>
        )}
        <button onClick={() => setSelectedRegulamentoComp(comp)}
          className="w-full mt-3 py-3 text-xs font-black bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl hover:text-white transition-colors flex items-center justify-center gap-2">
          <BookOpen className="w-4 h-4" /> VER INFORMAÇÕES
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="space-y-2">
        <h2 className="text-4xl font-black tracking-tighter">Minhas Competições</h2>
        <p className="text-zinc-400 font-bold">Acompanhe suas inscrições e explore novas competições.</p>
      </div>

      {participating.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="text-xl font-black uppercase tracking-widest text-emerald-500">Participando Atualmente</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {participating.map(c => <CompetitionCard key={c.id} comp={c} type="participating" />)}
          </div>
        </div>
      )}
      {pendingRequests.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <Clock className="w-5 h-5 text-amber-500" />
            <h3 className="text-xl font-black uppercase tracking-widest text-amber-500">Inscrições Pendentes</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingRequests.map(c => <CompetitionCard key={c.id} comp={c} type="pending" />)}
          </div>
        </div>
      )}
      {available.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <Trophy className="w-5 h-5 text-pink-500" />
            <h3 className="text-xl font-black uppercase tracking-widest text-pink-500">Disponíveis para Inscrição</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {available.map(c => <CompetitionCard key={c.id} comp={c} type="available" />)}
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <Calendar className="w-5 h-5 text-blue-500" />
            <h3 className="text-xl font-black uppercase tracking-widest text-blue-500">Próximas Competições</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcoming.map(c => <CompetitionCard key={c.id} comp={c} type="upcoming" />)}
          </div>
        </div>
      )}

      {participating.length === 0 && available.length === 0 && pendingRequests.length === 0 && upcoming.length === 0 && (
        <div className="py-24 text-center glass rounded-3xl border border-zinc-800/50 space-y-4">
          <Trophy className="w-12 h-12 text-zinc-700 mx-auto" />
          <h3 className="text-xl font-black text-zinc-500 uppercase tracking-widest">Nenhuma competição encontrada</h3>
          <p className="text-zinc-600 font-bold text-sm">Fique de olho, novas competições serão lançadas em breve.</p>
        </div>
      )}

      {selectedRegulamentoComp && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-end md:justify-center p-4 sm:p-6 pb-20">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedRegulamentoComp(null)} />
          <div className="relative w-full max-w-4xl max-h-[85vh] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/50">
               <h2 className="text-xl font-black flex items-center gap-2 text-white"><BookOpen className="w-5 h-5 text-amber-500" /> INFORMAÇÕES DA COMPETIÇÃO</h2>
               <button onClick={() => setSelectedRegulamentoComp(null)} className="p-2 bg-zinc-900 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
               </button>
            </div>
            <div className="overflow-y-auto p-6 scrollbar-hide">
               <CompetitionRegulamento comp={selectedRegulamentoComp} />
               {!registrations.find(r => r.competitionId === selectedRegulamentoComp.id && r.userId === user.uid) && (
                 <div className="mt-8 p-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-6">
                    <div className="flex flex-col gap-4">
                      <h3 className="text-sm font-black uppercase text-amber-500 tracking-widest">Termo de Aceite</h3>
                      <label className="flex items-start gap-4 cursor-pointer group">
                        <div className="relative flex items-center mt-1">
                          <input type="checkbox" checked={acceptedRules} onChange={(e) => setAcceptedRules(e.target.checked)}
                            className="peer h-5 w-5 appearance-none rounded border-2 border-zinc-700 bg-zinc-800 transition-all checked:border-amber-500 checked:bg-amber-500" />
                          <Check className="absolute h-3.5 w-3.5 text-black opacity-0 transition-opacity peer-checked:opacity-100 left-0.5" />
                        </div>
                        <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors">
                          Eu li e aceito todas as regras e condições estabelecidas para esta competição.
                        </span>
                      </label>
                    </div>
                    <button onClick={() => handleRegister(selectedRegulamentoComp.id)} disabled={!acceptedRules}
                      className={`w-full py-5 font-black rounded-2xl transition-all shadow-xl ${acceptedRules ? 'gold-bg text-black hover:scale-[1.02] shadow-amber-500/20' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'}`}>
                      CONFIRMAR E SOLICITAR INSCRIÇÃO
                    </button>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CompetitionDetailView ───────────────────────────────────────────────────
interface CompetitionDetailViewProps {
  comp: Competition;
  user: User;
  rankings: User[];
  posts: Post[];
  registrations: CompetitionRegistration[];
  onBack: () => void;
  setView: (view: any) => void;
  RankingsComponent: React.ComponentType<any>;
  PostSubmitComponent: React.ComponentType<any>;
  onDelete: (id: string) => void;
  onRemove: (state: { isOpen: boolean; postId: string; reason: string; consent: boolean }) => void;
  isAdmin: boolean;
  allCompetitions: Competition[];
}

export const CompetitionDetailView: React.FC<CompetitionDetailViewProps> = ({
  comp, user, rankings, posts, registrations, onBack, setView, RankingsComponent: Rankings, PostSubmitComponent: PostSubmit,
  onDelete, onRemove, isAdmin, allCompetitions
}) => {
  const [activeTab, setActiveTab] = useState<'RANKING' | 'POST' | 'REGULAMENTO' | 'PROTOCOLOS'>('RANKING');

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-colors text-zinc-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-black tracking-tighter">{comp.title}</h2>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Explorando competição individual</p>
          </div>
        </div>

        <div className="flex p-1 bg-zinc-900 rounded-2xl border border-zinc-800/50 w-full md:w-auto">
          <button onClick={() => setActiveTab('RANKING')}
            className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'RANKING' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <Trophy className="w-4 h-4" /> RANKING
          </button>
          <button onClick={() => setActiveTab('POST')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'POST' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <Send className="w-4 h-4" /> POSTAR LINK
          </button>
          <button onClick={() => setActiveTab('REGULAMENTO')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'REGULAMENTO' ? 'bg-amber-500/20 text-amber-500 shadow-lg' : 'text-zinc-500 hover:text-amber-400'}`}>
            <BookOpen className="w-4 h-4" /> REGULAMENTO
          </button>
          <button onClick={() => setActiveTab('PROTOCOLOS')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'PROTOCOLOS' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <History className="w-4 h-4" /> MEUS LINKS
          </button>
        </div>
      </div>

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {activeTab === 'RANKING' ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-amber-500/5 border border-amber-500/10 p-6 rounded-3xl">
                  <div className="space-y-1">
                    <h4 className="text-amber-500 font-black uppercase text-xs tracking-widest">Ação Rápida</h4>
                    <p className="text-zinc-400 text-sm font-bold">Deseja enviar novos vídeos para esta competição?</p>
                  </div>
                  <button onClick={() => setActiveTab('POST')} className="px-6 py-3 gold-bg text-black font-black rounded-xl hover:scale-105 transition-all text-xs flex items-center gap-2">
                    <Send className="w-4 h-4" /> PROTOCOLAR LINKS
                  </button>
                </div>
                <Rankings rankings={rankings} competitions={[comp]} lockedCompetitionId={comp.id} />
              </div>
            ) : activeTab === 'REGULAMENTO' ? (
              <CompetitionRegulamento comp={comp} />
            ) : activeTab === 'PROTOCOLOS' ? (
              <HistoryView 
                posts={posts} 
                competitions={allCompetitions} 
                onDelete={onDelete} 
                onRemove={onRemove} 
                isAdmin={isAdmin} 
                fixedCompetitionId={comp.id} 
              />
            ) : (
              <PostSubmit user={user} competitions={[comp]} registrations={registrations} setView={setView} lockedCompetitionId={comp.id} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
