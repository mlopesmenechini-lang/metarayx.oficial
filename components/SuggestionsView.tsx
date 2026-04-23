import React from 'react';
import { Send, Zap, MessageSquare, User as UserIcon, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { Suggestion } from '../types';

interface SuggestionsViewProps {
  suggestionMsg: string;
  setSuggestionMsg: (v: string) => void;
  handleSendSuggestion: () => void;
  handleUpdateSuggestionResponse: (id: string, response: string) => void;
  suggestions: Suggestion[];
  userRole?: string;
}

export const SuggestionsView: React.FC<SuggestionsViewProps> = ({
  suggestionMsg, setSuggestionMsg, handleSendSuggestion, handleUpdateSuggestionResponse, suggestions, userRole
}) => {
  const [adminResponses, setAdminResponses] = React.useState<Record<string, string>>({});
  const isAdmin = ['admin', 'auditor', 'administrativo'].includes(userRole || '');

  return (
    <div className="max-w-4xl mx-auto space-y-12 p-4 pb-20">
    <div className="space-y-4 text-center">
      <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase gold-gradient">Mural de Sugestões</h2>
      <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest max-w-lg mx-auto">Colabore com a evolução do MetaRayx. Vote, sugira e acompanhe o que estamos construindo.</p>
    </div>

    <div className="p-8 rounded-[40px] glass border border-zinc-800 space-y-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5"><MessageSquare className="w-32 h-32" /></div>
      <div className="space-y-4 relative z-10">
        <div className="flex items-center gap-3 text-amber-500">
          <Zap className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">O que podemos melhorar?</span>
        </div>
        <textarea value={suggestionMsg} onChange={(e) => setSuggestionMsg(e.target.value)}
          placeholder="Descreva sua ideia ou funcionalidade..."
          className="w-full bg-black border border-zinc-800 rounded-3xl py-6 px-8 text-sm font-bold focus:border-amber-500 outline-none transition-all h-32 resize-none shadow-inner" />
      </div>
      <button onClick={handleSendSuggestion} disabled={!suggestionMsg.trim()}
        className="w-full py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.01] transition-all shadow-xl shadow-amber-500/10 disabled:opacity-50 flex items-center justify-center gap-3 relative z-10">
        <Send className="w-5 h-5" /> ENVIAR MINHA SUGESTÃO
      </button>
    </div>

    <div className="space-y-6">
      <div className="flex items-center gap-3 px-2">
        <div className="w-1.5 h-6 gold-bg rounded-full" />
        <h3 className="font-black uppercase tracking-widest text-sm text-zinc-400">Ideias da Comunidade</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suggestions.map(s => (
          <motion.div key={s.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="p-6 rounded-[32px] bg-zinc-900/50 border border-zinc-800/50 flex flex-col justify-between gap-4 group hover:border-zinc-700 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                  s.status === 'pendente' ? 'bg-zinc-800 text-zinc-500' :
                  s.status === 'analise' ? 'bg-cyan-500/10 text-cyan-500' :
                  s.status === 'desenvolvimento' ? 'bg-amber-500/10 text-amber-500' :
                  'bg-emerald-500/10 text-emerald-500'
                }`}>
                  {s.status === 'pendente' ? 'EM ESPERA' : s.status === 'analise' ? 'EM ANÁLISE' : s.status === 'desenvolvimento' ? 'DESENVOLVENDO' : 'CONCLUÍDO'}
                </span>
                <span className="text-[9px] text-zinc-700 font-bold uppercase">{new Date(s.timestamp).toLocaleDateString()}</span>
              </div>
              <p className="text-zinc-300 text-sm font-bold leading-relaxed">{s.message}</p>
              {s.adminResponse && (
                <div className="mt-4 p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 space-y-2 relative overflow-hidden group/response">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover/response:opacity-20 transition-opacity">
                    <ShieldCheck className="w-8 h-8 text-amber-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-2 py-0.5 rounded-md bg-amber-500 text-black text-[8px] font-black uppercase tracking-tighter">
                      RESPOSTA OFICIAL
                    </div>
                    {s.respondedAt && (
                      <span className="text-[8px] text-zinc-500 font-bold uppercase">
                        {new Date(s.respondedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-zinc-300 leading-relaxed italic">
                    "{s.adminResponse}"
                  </p>
                </div>
              )}
            </div>

            {/* Admin Response Input */}
            {isAdmin && (
              <div className="mt-4 pt-4 border-t border-zinc-800/50 space-y-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Responder Sugestão (Admin)</label>
                    {(adminResponses[s.id] || s.adminResponse) && <span className="text-[8px] text-amber-500 font-bold uppercase italic">Editando Resposta</span>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={adminResponses[s.id] ?? s.adminResponse ?? ''}
                      onChange={(e) => setAdminResponses(prev => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="Escreva sua resposta oficial aqui..."
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-[11px] font-bold text-white focus:border-amber-500 outline-none transition-all h-24 resize-none shadow-inner"
                    />
                    <button
                      onClick={() => handleUpdateSuggestionResponse(s.id, adminResponses[s.id] || s.adminResponse || '')}
                      className="w-full py-3 gold-bg text-black font-black text-[10px] uppercase rounded-xl hover:scale-[1.01] transition-all shadow-lg shadow-amber-500/10"
                    >
                      Salvar Resposta Oficial
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/50">
              <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center">
                <UserIcon className="w-3 h-3 text-zinc-500" />
              </div>
              <span className="text-[10px] font-black text-zinc-600 uppercase">Enviado por @{s.userName?.toLowerCase().split(' ')[0]}</span>
            </div>
          </motion.div>
        ))}
        {suggestions.length === 0 && (
          <div className="col-span-full py-20 text-center space-y-4">
            <MessageSquare className="w-12 h-12 text-zinc-800 mx-auto opacity-20" />
            <p className="text-zinc-600 font-bold uppercase text-[10px] tracking-widest">Inaugure o mural com sua ideia!</p>
          </div>
        )}
      </div>
    </div>
  </div>
  );
};
