import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Zap, Mail, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { User, Competition, Transaction } from '../types';

interface WalletViewProps {
  user: User;
  competitions: Competition[];
  showBalances: boolean;
}

export const WalletView = ({ user, competitions, showBalances }: WalletViewProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'day' | 'week' | 'month'>('all');
  const [selectedCompId, setSelectedCompId] = useState<string>(() => {
    const active = competitions?.find(c => c.isActive);
    return active ? active.id : '';
  });
  const [pixKey, setPixKey] = useState(user.pixKey || '');
  const [isSavingPix, setIsSavingPix] = useState(false);

  const handleSavePix = async () => {
    if (!pixKey.trim()) return;
    setIsSavingPix(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { pixKey });
      alert('â Chave PIX salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar PIX:', error);
      alert('Erro ao salvar chave PIX.');
    } finally {
      setIsSavingPix(false);
    }
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        data.sort((a, b) => b.timestamp - a.timestamp);
        setTransactions(data);
      } catch (e) {
        console.error("Erro fetch extrato", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [user.uid]);

  const compFiltered = useMemo(() => {
    if (!selectedCompId) return transactions;
    return transactions.filter(t => t.competitionId === selectedCompId);
  }, [transactions, selectedCompId]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return compFiltered.filter(t => {
      if (filter === 'all') return true;
      if (filter === 'day') return now - t.timestamp <= dayMs;
      if (filter === 'week') return now - t.timestamp <= 7 * dayMs;
      if (filter === 'month') return now - t.timestamp <= 30 * dayMs;
      return true;
    });
  }, [compFiltered, filter]);

  const totalPago = useMemo(() => {
    if (selectedCompId) {
      return user?.competitionStats?.[selectedCompId]?.paidTotal || 0;
    }
    return user?.lifetimeEarnings || 0;
  }, [user, selectedCompId]);

  const totalPendente = useMemo(() => {
    if (selectedCompId) {
      return user?.competitionStats?.[selectedCompId]?.balance || 0;
    }
    return user?.balance || 0;
  }, [user, selectedCompId]);

  const selectedComp = competitions?.find(c => c.id === selectedCompId);

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-4 md:p-6 lg:p-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-black tracking-tight uppercase gold-gradient">Portal Financeiro</h2>
          <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Acompanhe seus rendimentos e recebimentos</p>
        </div>
        <div className="flex flex-col gap-1.5 min-w-[240px]">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Filtrar por Competição:</span>
          <select
            value={selectedCompId}
            onChange={(e) => setSelectedCompId(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold focus:border-amber-500 outline-none transition-all text-white"
          >
            <option value="">Geral (Total Hub)</option>
            {competitions?.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-[32px] p-8 space-y-6 shadow-2xl">
        <div className="space-y-4">
          <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest px-1">Resumo de Saldos</h3>
          <div className="flex flex-col divide-y divide-zinc-800/50">
            <div className="flex items-center justify-between py-6 group hover:bg-white/5 transition-all px-2 -mx-2 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-emerald-500 transition-colors">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{selectedCompId ? `Total Recebido (${selectedComp?.title})` : 'Total Recebido em Premiações (Hub)'}</p>
                  <p className="text-xl font-black text-white">R$ {showBalances ? (selectedCompId ? totalPago : (user.lifetimeEarnings || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '***'}</p>
                </div>
              </div>
              <div className="hidden md:block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest">HISTÓRICO</div>
            </div>

            <div className="flex items-center justify-between py-6 group hover:bg-white/5 transition-all px-2 -mx-2 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-amber-500 transition-colors">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Ganhos em Análise</p>
                  <p className="text-xl font-black text-amber-500">R$ {showBalances ? totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '***'}</p>
                </div>
              </div>
              <div className="hidden md:block px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase tracking-widest">PENDENTE</div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-900">
          <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest px-1 mb-4">Dados para Pagamento</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="w-4 h-4 text-zinc-500" />
              </div>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Sua Chave PIX (E-mail, CPF, Celular...)"
                className="w-full bg-black border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:border-amber-500 outline-none transition-all placeholder:text-zinc-700"
              />
            </div>
            <button
              onClick={handleSavePix}
              disabled={isSavingPix || !pixKey}
              className="px-8 py-4 gold-bg text-black font-black rounded-2xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 min-w-[140px]"
            >
              {isSavingPix ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SALVAR CHAVE'}
            </button>
          </div>
          <p className="mt-3 px-1 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Atenção: Verifique os dados antes de salvar para evitar erros nos repasses.</p>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 overflow-hidden mt-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h3 className="font-black uppercase text-xl text-white">Extrato de Pagamentos</h3>
            <p className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Histórico das transferências enviadas pela Diretoria</p>
          </div>

          <div className="flex p-1 bg-zinc-900 rounded-xl border border-zinc-800">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${filter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>TUDO</button>
            <button onClick={() => setFilter('day')} className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${filter === 'day' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>HOJE</button>
            <button onClick={() => setFilter('week')} className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${filter === 'week' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>SEMANA</button>
            <button onClick={() => setFilter('month')} className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${filter === 'month' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>MÃS</button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <RefreshCw className="w-8 h-8 text-zinc-600 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => (
              <div key={t.id} className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 md:gap-0 p-5 bg-black border border-zinc-800 rounded-2xl relative overflow-hidden hover:border-zinc-700 hover:bg-white/[0.02] transition-all group">
                <div className="flex flex-col gap-1.5 z-10 w-full md:w-auto">
                  <div className="flex items-center justify-between md:justify-start gap-3">
                    {t.status === 'credit' ? (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest inline-block border border-amber-500/20">PRÃMIO CONTABILIZADO</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest inline-block border border-emerald-500/20">REPASSE RECEBIDO</span>
                    )}
                    <span className="text-[10px] font-bold text-zinc-600 font-mono tracking-widest uppercase">ID: {t.id}</span>
                  </div>
                  <h4 className="font-black text-sm uppercase tracking-tight text-zinc-200">
                    {t.description || (t.status === 'credit' ? 'Premiação por desempenho' : 'Pagamento via PIX')}
                  </h4>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    {new Date(t.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} Ã s {new Date(t.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex flex-col items-end z-10 w-full md:w-auto border-t md:border-t-0 border-zinc-900 pt-4 md:pt-0">
                  <span className={`text-2xl font-black tabular-nums ${t.status === 'credit' ? 'text-amber-500' : 'text-emerald-500'}`}>
                    R$ {showBalances ? t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '***'}
                  </span>
                  <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Valor do {t.status === 'credit' ? 'Crédito' : 'Repasse'}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-20 flex flex-col items-center gap-4 border-2 border-dashed border-zinc-800 rounded-2xl">
                <XCircle className="w-12 h-12 text-zinc-800" />
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Nenhum pagamento encontrado.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
