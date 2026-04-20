import React from 'react';
import { 
  Zap, 
  TrendingUp, 
  Camera, 
  BarChart3, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft,
  User as UserIcon,
  DollarSign,
  Calendar,
  Eye,
  Heart,
  MessageSquare
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Post, Competition, User, Transaction } from '../../types';
import { ListHeader, StatCard, PostTagRow } from './AdminUI';

interface FinanceiroTabProps {
  competitions: Competition[];
  approvedUsers: User[];
  posts: Post[];
  transactions: Transaction[];
  financeTab: 'RESUMO' | 'PENDING' | 'REALIZED';
  setFinanceTab: (tab: 'RESUMO' | 'PENDING' | 'REALIZED') => void;
  financeCompId: string;
  setFinanceCompId: (id: string) => void;
  financeDateFilter: string;
  setFinanceDateFilter: (date: string) => void;
  auditUserId: string | null;
  setAuditUserId: (id: string | null) => void;
  userRole: string;
  handleMarkPaid: (userId: string, amount: number, competitionId: string) => Promise<void>;
  handleToggleManualPostValidation: (postId: string) => void;
  validatedPostsLocal: string[];
  setValidatedPostsLocal: (ids: string[] | ((prev: string[]) => string[])) => void;
  onUpdatePixKey: (userId: string, pixKey: string) => Promise<void>;
}

export const FinanceiroTab: React.FC<FinanceiroTabProps> = ({
  competitions,
  approvedUsers,
  posts,
  transactions,
  financeTab,
  setFinanceTab,
  financeCompId,
  setFinanceCompId,
  financeDateFilter,
  setFinanceDateFilter,
  auditUserId,
  setAuditUserId,
  userRole,
  handleMarkPaid,
  handleToggleManualPostValidation,
  validatedPostsLocal,
  setValidatedPostsLocal,
  onUpdatePixKey
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div className="space-y-1">
          <h3 className="text-2xl font-black uppercase tracking-tighter gold-gradient leading-none">Gestão Financeira</h3>
          <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-[0.2em] opacity-80">Controle de pagamentos e gestão por competição.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-zinc-900/30 p-2 rounded-3xl border border-zinc-800/50">
          <div className="flex flex-col gap-1 px-2">
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1">Competição Alvo:</label>
            <select
              value={financeCompId}
              onChange={(e) => setFinanceCompId(e.target.value)}
              className="bg-black border border-zinc-800 rounded-xl py-2 px-4 text-[10px] font-black text-amber-500 outline-none focus:border-amber-500 transition-all min-w-[220px] cursor-pointer hover:bg-zinc-900"
            >
              {competitions.map(c => (
                <option key={c.id} value={c.id}>{c.title} {c.isActive ? 'â¢ ATIVA' : ''}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 px-2">
            <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1">Filtrar por Dia:</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={financeDateFilter}
                onChange={(e) => setFinanceDateFilter(e.target.value)}
                className="bg-black border border-zinc-800 rounded-xl py-2 px-4 text-[10px] font-black text-amber-500 outline-none focus:border-amber-500 transition-all cursor-pointer hover:bg-zinc-900 icon-calendar-white"
              />
              {financeDateFilter && (
                <button 
                  onClick={() => setFinanceDateFilter('')}
                  className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex p-1 bg-black rounded-2xl border border-zinc-800">
            {[
              { id: 'RESUMO', label: 'DASHBOARD', icon: BarChart3 },
              { id: 'PENDING', label: 'PENDENTES', icon: Zap },
              { id: 'REALIZED', label: 'REALIZADOS', icon: CheckCircle2 }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => { setFinanceTab(t.id as any); setAuditUserId(null); }}
                className={`px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                  financeTab === t.id ? 'gold-bg text-black shadow-lg shadow-amber-500/10' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-900 rounded-[40px] overflow-hidden min-h-[600px] shadow-2xl relative">
        {auditUserId ? (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="p-8 border-b border-zinc-900 bg-zinc-900/20 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl gold-bg flex items-center justify-center shadow-xl shadow-amber-500/10">
                  <UserIcon className="w-7 h-7 text-black" />
                </div>
                <div>
                  <h4 className="text-xl font-black uppercase tracking-tight text-white mb-0.5">{approvedUsers.find(u => u.uid === auditUserId)?.displayName}</h4>
                  <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest">Gestão de Performance Social</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {(() => {
                  const user = approvedUsers.find(u => u.uid === auditUserId);
                  return user && (
                    <div className="flex items-center gap-3 bg-black border border-zinc-800 rounded-2xl px-6 py-3 ml-4 group">
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest group-hover:text-amber-500 transition-colors">PIX KEY:</span>
                      <input
                        type="text"
                        defaultValue={user.pixKey || ''}
                        readOnly={userRole !== 'admin'}
                        onBlur={async (e) => {
                          if (userRole !== 'admin') return;
                          onUpdatePixKey(user.uid, e.target.value);
                        }}
                        className={`bg-transparent border-none p-0 text-[11px] font-black text-white focus:ring-0 outline-none w-48 selection:bg-amber-500 selection:text-black ${userRole !== 'admin' ? 'cursor-not-allowed opacity-50 text-zinc-500' : 'cursor-text'}`}
                      />
                    </div>
                  );
                })()}
                <button
                  onClick={() => setAuditUserId(null)}
                  className="px-8 py-3.5 bg-zinc-900 text-zinc-400 font-black rounded-2xl text-[10px] flex items-center gap-3 hover:bg-zinc-800 hover:text-white transition-all uppercase tracking-widest border border-zinc-800"
                >
                  <ChevronLeft className="w-4 h-4" /> VOLTAR À LISTA
                </button>
              </div>
            </div>

            <div className="min-h-[400px]">
              <ListHeader columns={['TARJAS', 'REDES', 'LINK DO VÍDEO', 'STATUS', 'MÉTRICAS', 'VAL.' ]} gridClass="grid-cols-[80px_80px_1fr_120px_150px_100px]" />
              <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                {posts.filter(p => p.userId === auditUserId).map(post => (
                  <div key={post.id} className="grid grid-cols-[80px_80px_1fr_120px_150px_100px] gap-4 items-center py-4 px-8 hover:bg-white/[0.02] transition-all border-b border-zinc-900/50 last:border-0">
                    <div className="flex justify-center">
                      <PostTagRow postId={post.id} />
                    </div>
                    <div className="flex justify-center">
                      <div className={`p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 ${
                        post.platform === 'tiktok' ? 'text-amber-500' :
                        post.platform === 'youtube' ? 'text-red-500' :
                        'text-pink-500'
                      }`}>
                        {post.platform === 'tiktok' ? <Zap className="w-4 h-4" /> :
                         post.platform === 'youtube' ? <TrendingUp className="w-4 h-4" /> :
                         <Camera className="w-4 h-4" />}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <a href={post.url} target="_blank" rel="noreferrer" className="font-bold text-[11px] truncate text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors block" title={post.url}>{post.url}</a>
                    </div>
                    <div className="text-center">
                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                          post.status === 'approved' || post.status === 'synced' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          post.status === 'rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                          'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                        {post.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-5">
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] font-black text-white">{(post.views || 0).toLocaleString()}</span>
                        <span className="text-[8px] font-black text-zinc-600 uppercase">Views</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] font-black text-white">{(post.likes || 0).toLocaleString()}</span>
                        <span className="text-[8px] font-black text-zinc-600 uppercase">Likes</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2.5">
                      <button 
                        onClick={() => handleToggleManualPostValidation(post.id)}
                        className={`p-3 rounded-xl transition-all ${
                          validatedPostsLocal.includes(post.id) 
                            ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                            : 'bg-emerald-500/5 border border-emerald-500/10 text-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-500'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : financeTab === 'RESUMO' ? (
           <div className="p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCard 
                   label="Saldo Total Pendente" 
                   value={`R$ ${approvedUsers.reduce((acc, u) => acc + (u.balance || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                   icon={DollarSign}
                   colorClass="bg-amber-500/10 text-amber-500"
                 />
                 <StatCard 
                   label="Pagamentos Realizados" 
                   value={`R$ ${transactions.reduce((acc, t) => acc + (t.amount || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                   icon={CheckCircle2}
                   colorClass="bg-emerald-500/10 text-emerald-500"
                 />
              </div>
           </div>
        ) : (
          <div className="p-8">
            <ListHeader columns={['DATA REGISTRO', 'USUÁRIO', 'SALDO ATUAL', 'VALOR PAGO', 'AÇÕES']} gridClass="grid-cols-[120px_1fr_120px_120px_200px]" />
            <div className="space-y-4">
              {approvedUsers.map(user => {
                const userTransactions = transactions.filter(t => t.userId === user.uid && t.competitionId === financeCompId);
                const totalPaid = userTransactions.reduce((acc, t) => acc + t.amount, 0);
                
                if (financeTab === 'PENDING' && user.balance <= 0) return null;
                if (financeTab === 'REALIZED' && totalPaid <= 0) return null;

                return (
                  <div key={user.uid} className="grid grid-cols-[120px_1fr_120px_120px_200px] gap-4 items-center bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50 hover:border-amber-500/30 transition-all">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{user.approvedAt ? new Date(user.approvedAt).toLocaleDateString() : 'N/A'}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <span className="font-black text-sm uppercase text-white truncate">{user.displayName}</span>
                    </div>
                    <span className="text-xs font-black text-amber-500">R$ {user.balance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span className="text-xs font-black text-emerald-500">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <div className="flex items-center justify-end gap-2">
                       <button onClick={() => setAuditUserId(user.uid)} className="px-4 py-2 rounded-xl bg-zinc-800 text-white font-black text-[10px] uppercase tracking-widest hover:bg-zinc-700 transition-all">Audit</button>
                       {financeTab === 'PENDING' && (
                         <button onClick={() => handleMarkPaid(user.uid, user.balance, financeCompId)} className="px-5 py-2 rounded-xl gold-bg text-black font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all">Pagar</button>
                       )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
