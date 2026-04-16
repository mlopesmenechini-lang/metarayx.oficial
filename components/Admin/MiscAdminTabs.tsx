import React from 'react';
import { 
  ClipboardList, 
  X, 
  Check, 
  Bell, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Clock, 
  MessageSquare,
  Zap,
  TrendingUp,
  Camera,
  Trash
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Post, Announcement, Suggestion, CompetitionRegistration } from '../../types';
import { ListHeader, PostTagRow } from './AdminUI';

interface RegistrosTabProps {
  pendingRegistrations: CompetitionRegistration[];
  handleRegistrationStatus: (id: string, status: 'approved' | 'rejected') => void;
  handleDeleteRegistration: (id: string) => void;
}

export const RegistrosTab: React.FC<RegistrosTabProps> = ({
  pendingRegistrations,
  handleRegistrationStatus,
  handleDeleteRegistration
}) => (
  <div className="space-y-6">
    <h3 className="text-xl font-black uppercase tracking-tight">Solicitações de Inscrição</h3>
    <div className="space-y-1">
      <ListHeader columns={['DATA', 'USUÁRIO', 'COMPETIÇÃO', 'AÇÕES']} gridClass="grid-cols-[120px_1fr_1.5fr_200px]" />
      {pendingRegistrations.map(r => (
        <div key={r.id} className="grid grid-cols-[120px_1fr_1.5fr_200px] gap-4 items-center bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/50">
          <span className="text-[10px] font-black text-zinc-500 uppercase">{new Date(r.timestamp).toLocaleDateString()}</span>
          <span className="font-black text-sm uppercase text-white">{r.userName}</span>
          <span className="text-xs font-bold text-amber-500 uppercase">{r.competitionId}</span>
          <div className="flex gap-2">
            <button onClick={() => handleRegistrationStatus(r.id, 'approved')} className="px-4 py-2 bg-emerald-500 text-black font-black rounded-xl text-[10px] hover:scale-105 transition-all">APROVAR</button>
            <button onClick={() => handleRegistrationStatus(r.id, 'rejected')} className="px-4 py-2 bg-zinc-800 text-zinc-400 font-black rounded-xl text-[10px] hover:bg-zinc-700 transition-all">RECUSAR</button>
            <button onClick={() => handleDeleteRegistration(r.id)} className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      {pendingRegistrations.length === 0 && (
        <div className="py-20 text-center space-y-4">
          <ClipboardList className="w-12 h-12 text-zinc-800 mx-auto" />
          <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Nenhuma inscrição pendente!</p>
        </div>
      )}
    </div>
  </div>
);

interface AvisosTabProps {
  announcements: Announcement[];
  annTitle: string;
  setAnnTitle: (v: string) => void;
  annMsg: string;
  setAnnMsg: (v: string) => void;
  isCreatingAnn: boolean;
  setIsCreatingAnn: (v: boolean) => void;
  handleCreateAnnouncement: () => void;
  handleDeleteAnnouncement: (id: string) => void;
}

export const AvisosTab: React.FC<AvisosTabProps> = ({
  announcements, annTitle, setAnnTitle, annMsg, setAnnMsg, isCreatingAnn, setIsCreatingAnn,
  handleCreateAnnouncement, handleDeleteAnnouncement
}) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h3 className="text-xl font-black uppercase tracking-tight">Avisos do Sistema</h3>
      <button
        onClick={() => setIsCreatingAnn(!isCreatingAnn)}
        className="px-6 py-2 gold-bg text-black font-black rounded-xl text-xs hover:scale-105 transition-all"
      >
        {isCreatingAnn ? 'CANCELAR' : 'NOVO AVISO'}
      </button>
    </div>

    {isCreatingAnn && (
      <div className="p-6 bg-zinc-900 rounded-3xl border border-zinc-800 space-y-4">
        <input
          type="text" value={annTitle} onChange={e => setAnnTitle(e.target.value)}
          placeholder="Título do Aviso"
          className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl focus:border-amber-500 outline-none transition-all font-black text-xs uppercase"
        />
        <textarea
          value={annMsg} onChange={e => setAnnMsg(e.target.value)}
          placeholder="Mensagem do aviso..."
          className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl focus:border-amber-500 outline-none transition-all font-bold text-xs h-32"
        />
        <button
          onClick={handleCreateAnnouncement}
          className="w-full py-4 gold-bg text-black font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all"
        >
          Postar Aviso
        </button>
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {announcements.map(ann => (
        <div key={ann.id} className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl relative group">
          <button
            onClick={() => handleDeleteAnnouncement(ann.id)}
            className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-amber-500" />
            <h4 className="font-black uppercase text-sm">{ann.title}</h4>
          </div>
          <p className="text-xs font-bold text-zinc-400 leading-relaxed">{ann.message}</p>
          <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center">
            <span className="text-[10px] font-black text-zinc-600 uppercase">Postado em: {new Date(ann.timestamp).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

interface TimerTabProps {
  timerConfig: { enabled: boolean; endTime: number | null; targetTime: string; message: string };
  handleUpdateTimer: (config: any) => Promise<void>;
}

export const TimerTab: React.FC<TimerTabProps> = ({ timerConfig, handleUpdateTimer }) => {
  const [targetTime, setTargetTime] = React.useState(timerConfig.targetTime);
  const [message, setMessage] = React.useState(timerConfig.message);
  const [updating, setUpdating] = React.useState(false);

  return (
    <div className="max-w-xl mx-auto space-y-8 py-10">
      <div className="text-center space-y-2">
        <h3 className="text-3xl font-black uppercase tracking-tighter gold-gradient">Timer do Sistema</h3>
        <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Controle a contagem regressiva exibida no dashboard.</p>
      </div>

      <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-[40px] space-y-6">
        <div className="flex items-center justify-between p-4 bg-black rounded-2xl border border-zinc-800">
           <div className="flex items-center gap-3">
             <div className={`w-3 h-3 rounded-full ${timerConfig.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
             <span className="text-xs font-black uppercase text-zinc-300">Status: {timerConfig.enabled ? 'ATIVO' : 'DESATIVADO'}</span>
           </div>
           <button
             onClick={async () => {
               setUpdating(true);
               await handleUpdateTimer({ ...timerConfig, enabled: !timerConfig.enabled });
               setUpdating(false);
             }}
             className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${timerConfig.enabled ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500 text-black'}`}
           >
             {timerConfig.enabled ? 'Desativar' : 'Ativar'}
           </button>
        </div>

        <div className="space-y-4">
           <div>
             <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 mb-1 block">Data/Hora Alvo (ISO)</label>
             <input
               type="datetime-local" value={targetTime} onChange={e => setTargetTime(e.target.value)}
               className="w-full bg-black border border-zinc-800 px-5 py-4 rounded-2xl font-black text-xs text-amber-500 outline-none"
             />
           </div>
           <div>
             <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 mb-1 block">Mensagem Customizada</label>
             <input
               type="text" value={message} onChange={e => setMessage(e.target.value)}
               placeholder="Ex: NOVO RANKING EM..."
               className="w-full bg-black border border-zinc-800 px-5 py-4 rounded-2xl font-black text-xs text-white outline-none"
             />
           </div>
           
           <button
             disabled={updating}
             onClick={async () => {
                setUpdating(true);
                await handleUpdateTimer({ ...timerConfig, targetTime, message, endTime: new Date(targetTime).getTime() });
                setUpdating(false);
             }}
             className="w-full py-4 gold-bg text-black font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
           >
             {updating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
             Salvar Configurações do Timer
           </button>
        </div>
      </div>
    </div>
  );
};

interface SugestoesTabProps {
  suggestions: Suggestion[];
  handleUpdateSuggestionStatus: (id: string, status: Suggestion['status']) => void;
  handleDeleteSuggestion: (id: string) => void;
}

export const SugestoesTab: React.FC<SugestoesTabProps> = ({ suggestions, handleUpdateSuggestionStatus, handleDeleteSuggestion }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-black uppercase tracking-tight">Caixa de Sugestões ({suggestions.length})</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {suggestions.map(s => (
        <div key={s.id} className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-4">
          <div className="flex justify-between items-start">
            <div className={`px-2 py-1 rounded text-[8px] font-black uppercase ${s.status === 'pendente' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              {s.status}
            </div>
            <button onClick={() => handleDeleteSuggestion(s.id)} className="text-red-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
          </div>
          <p className="text-xs font-bold text-white">{s.message}</p>
          <div className="pt-4 border-t border-zinc-800 flex justify-between items-center">
            <span className="text-[10px] font-black text-zinc-500 uppercase">Por: {s.userName}</span>
            {s.status === 'pendente' && (
              <button onClick={() => handleUpdateSuggestionStatus(s.id, 'concluido')} className="text-[10px] font-black text-emerald-500 uppercase hover:underline">Marcar Concluído</button>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

interface SolicitacoesRemocaoTabProps {
  posts: Post[];
  handleApproveRemoval: (id: string) => void;
  handleRejectRemoval: (id: string) => void;
}

export const SolicitacoesRemocaoTab: React.FC<SolicitacoesRemocaoTabProps> = ({ posts, handleApproveRemoval, handleRejectRemoval }) => {
  const requests = posts.filter(p => p.status === 'removal_requested');

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-black uppercase tracking-tight">Solicitações de Remoção ({requests.length})</h3>
      <div className="space-y-4">
        {requests.map(post => (
          <div key={post.id} className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
               <PostTagRow postId={post.id} />
               {post.platform === 'tiktok' ? <Zap className="w-8 h-8 text-amber-500" /> : post.platform === 'youtube' ? <TrendingUp className="w-8 h-8 text-red-500" /> : <Camera className="w-8 h-8 text-pink-500" />}
               <div>
                 <p className="text-xs font-black text-white truncate max-w-md">{post.url}</p>
                 <p className="text-[10px] font-bold text-zinc-500 uppercase">Solicitado por: {post.userName}</p>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <button onClick={() => handleApproveRemoval(post.id)} className="px-6 py-2 bg-red-500 text-white font-black rounded-xl text-[10px] uppercase hover:bg-red-600 transition-all flex items-center gap-2"><Trash className="w-4 h-4" /> Aprovar Remoção</button>
               <button onClick={() => handleRejectRemoval(post.id)} className="px-6 py-2 bg-zinc-800 text-zinc-400 font-black rounded-xl text-[10px] uppercase hover:bg-zinc-700 transition-all">Manter Post</button>
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <div className="py-20 text-center border border-dashed border-zinc-900 rounded-[40px] text-zinc-600 font-black uppercase text-xs tracking-widest">
            Nenhuma solicitação de remoção pendente.
          </div>
        )}
      </div>
    </div>
  );
};
