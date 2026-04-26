import React, { useState } from 'react';
import { 
  Key, 
  Lock, 
  X, 
  Plus,
  ShieldCheck,
  Zap,
  Info,
  RefreshCw,
  Calendar,
  Shield,
  ArrowUp,
  ArrowDown,
  Power,
  PowerOff
} from 'lucide-react';
import { Settings, Competition } from '../../types';

interface ConfiguracoesApiTabProps {
  settings: Settings;
  apifyKey: string;
  setApifyKey: (val: string) => void;
  handleSaveApiKey: () => void;
  handleDeleteApiKey: (key: string) => void;
  handleUpdateMasterKey: (newKey: string) => Promise<void>;
  // Novas props migradas do topo
  apifyKeySync: string;
  setApifyKeySync: (val: string) => void;
  handleSaveSyncKey: () => void;
  handleDeleteSyncKey: (key: string) => void;
  selectedResetCompId: string;
  setSelectedResetCompId: (val: string) => void;
  handleResetDailyRanking: (id: string) => void;
  handleResetRankingSimple: (id: string) => void;
  handleRankingResetOnly: () => void;
  handleSystemCleanup: () => void;
  repairing: boolean;
  handleRepairMetrics: () => void;
  competitions: Competition[];
  handleMoveApiKey: (type: 'general' | 'sync', index: number, direction: 'up' | 'down') => void;
  handleToggleApiKey: (key: string) => void;
}

export const ConfiguracoesApiTab: React.FC<ConfiguracoesApiTabProps> = ({
  settings,
  apifyKey,
  setApifyKey,
  handleSaveApiKey,
  handleDeleteApiKey,
  handleUpdateMasterKey,
  apifyKeySync,
  setApifyKeySync,
  handleSaveSyncKey,
  handleDeleteSyncKey,
  selectedResetCompId,
  setSelectedResetCompId,
  handleResetDailyRanking,
  handleResetRankingSimple,
  handleRankingResetOnly,
  handleSystemCleanup,
  repairing,
  handleRepairMetrics,
  competitions,
  handleMoveApiKey,
  handleToggleApiKey
}) => {
  const [newMasterKey, setNewMasterKey] = useState('');
  const [keyStats, setKeyStats] = useState<Record<string, { usage: number, limit: number, loading: boolean, renewalDate: string | null }>>({});

  const fetchStats = async (key: string) => {
    setKeyStats(prev => ({ ...prev, [key]: { ...prev[key], loading: true, renewalDate: null } }));
    try {
      const userRes = await fetch(`https://api.apify.com/v2/users/me?token=${key}`);
      let planLimit = 5;
      let basicUsage = 0;
      
      if (userRes.ok) {
        const userJson = await userRes.json();
        planLimit = userJson.data?.plan?.maxMonthlyUsageUsd || 5;
        basicUsage = userJson.data?.currentBillingPeriod?.usageUsd || 0;
      }

      const usageRes = await fetch(`https://api.apify.com/v2/users/me/usage/monthly?token=${key}`);
      if (usageRes.ok) {
        const usageJson = await usageRes.json();
        const realUsage = usageJson.data?.totalUsageCreditsUsdAfterVolumeDiscount || basicUsage;
        const endAt = usageJson.data?.usageCycle?.endAt || null;
        
        setKeyStats(prev => ({ 
          ...prev, 
          [key]: { 
            usage: realUsage, 
            limit: planLimit,
            loading: false,
            renewalDate: endAt
          } 
        }));
      } else {
        setKeyStats(prev => ({ 
          ...prev, 
          [key]: { 
            usage: basicUsage, 
            limit: planLimit,
            loading: false,
            renewalDate: null
          } 
        }));
      }
    } catch (e) {
      console.error("Erro ao buscar stats da chave:", e);
      setKeyStats(prev => ({ ...prev, [key]: { usage: 0, limit: 5, loading: false, renewalDate: null } }));
    }
  };

  React.useEffect(() => {
    if (settings.apifyKeys) {
      settings.apifyKeys.forEach(key => {
        if (!keyStats[key]) fetchStats(key);
      });
    }
  }, [settings.apifyKeys]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1600px] mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col gap-2 bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Key className="w-32 h-32" />
        </div>
        <h3 className="text-2xl font-black uppercase gold-gradient relative z-10">Gestão de APIs e Segurança</h3>
        <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-[0.2em] relative z-10">
          Central de comando técnico: chaves, sincronismo e manutenção do sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUNA 1: CHAVES GERAIS (RESSYNC) */}
        <div className="glass-card premium-border p-8 rounded-[40px] space-y-6 flex flex-col">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <RefreshCw className="w-5 h-5 text-amber-500" />
              </div>
              <h4 className="font-black text-lg uppercase tracking-tight">Chaves Gerais (Ressync)</h4>
            </div>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
              Usadas para a atualização periódica de todos os vídeos auditados.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1 group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
              <input
                type="text"
                value={apifyKey}
                onChange={(e) => setApifyKey(e.target.value)}
                placeholder="Adicionar chave..."
                className="w-full bg-black border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold focus:border-amber-500 outline-none transition-all"
              />
            </div>
            <button
              onClick={handleSaveApiKey}
              className="px-6 py-4 gold-bg text-black font-black rounded-2xl hover:scale-105 transition-all text-xs uppercase shadow-xl shadow-amber-500/20"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[450px] custom-scrollbar pr-2">
            {settings.apifyKeys?.map((key, idx) => {
              const stats = keyStats[key];
              const usage = stats?.usage || 0;
              const limit = stats?.limit || 5;
              const percent = Math.min((usage / limit) * 100, 100);
              const remainingExtractions = Math.max(0, Math.floor((limit - usage) / 0.001));

              const isDisabled = settings.disabledApifyKeys?.includes(key);

              return (
                <div key={idx} className={`flex flex-col border p-5 rounded-3xl group transition-all space-y-4 ${isDisabled ? 'bg-zinc-900/50 border-zinc-800/20 opacity-60' : 'bg-black/40 border-zinc-800/50 hover:border-amber-500/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full shadow-lg ${isDisabled ? 'bg-zinc-600' : stats?.loading ? 'bg-zinc-600 animate-pulse' : 'bg-emerald-500 shadow-emerald-500/50'}`} />
                      <code className={`text-[10px] font-mono tracking-wider ${isDisabled ? 'text-zinc-600 line-through' : 'text-zinc-400'}`}>
                        {key.substring(0, 12)}...{key.substring(key.length - 8)}
                      </code>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex flex-col gap-1 mr-2">
                        <button onClick={() => handleMoveApiKey('general', idx, 'up')} disabled={idx === 0} className="p-1 rounded bg-zinc-800/50 text-zinc-500 hover:text-white disabled:opacity-30">
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleMoveApiKey('general', idx, 'down')} disabled={idx === (settings.apifyKeys?.length || 0) - 1} className="p-1 rounded bg-zinc-800/50 text-zinc-500 hover:text-white disabled:opacity-30">
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <button onClick={() => handleToggleApiKey(key)} className={`p-2 rounded-xl transition-all ${isDisabled ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black' : 'bg-zinc-800/50 text-zinc-500 hover:text-amber-500'}`} title={isDisabled ? "Ativar Chave" : "Desativar Chave"}>
                        {isDisabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => fetchStats(key)} className="p-2 rounded-xl bg-zinc-800/50 text-zinc-500 hover:text-amber-500 transition-all">
                        <RefreshCw className={`w-3.5 h-3.5 ${stats?.loading ? 'animate-spin' : ''}`} />
                      </button>
                      <button onClick={() => handleDeleteApiKey(key)} className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <p className="text-sm font-black text-white">${usage.toFixed(2)} <span className="text-zinc-600 text-[10px]">/ ${limit.toFixed(2)}</span></p>
                      <p className="text-[10px] font-black text-amber-500">~{remainingExtractions.toLocaleString()} un</p>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 rounded-full ${percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} />
                    </div>
                    {stats?.renewalDate && (
                      <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Renova {new Date(stats.renewalDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUNA 2: SINCRONISMO INICIAL (NOVO) */}
        <div className="glass-card premium-border p-8 rounded-[40px] space-y-6 flex flex-col">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                <Zap className="w-5 h-5 text-violet-500" />
              </div>
              <h4 className="font-black text-lg uppercase tracking-tight">Sincronismo Inicial</h4>
            </div>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
              Exclusivas para a primeira validação de links aprovados.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1 group">
              <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-violet-500 transition-colors" />
              <input
                type="text"
                value={apifyKeySync}
                onChange={(e) => setApifyKeySync(e.target.value)}
                placeholder="Nova chave sync..."
                className="w-full bg-black border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold focus:border-violet-500 outline-none transition-all"
              />
            </div>
            <button
              onClick={handleSaveSyncKey}
              className="px-6 py-4 bg-violet-500 text-white font-black rounded-2xl hover:scale-105 transition-all text-xs uppercase shadow-xl shadow-violet-500/20"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[450px] custom-scrollbar pr-2">
            {settings.apifyKeysSync?.map((key, idx) => {
              const isDisabled = settings.disabledApifyKeys?.includes(key);
              return (
              <div key={idx} className={`flex items-center justify-between border p-5 rounded-3xl group transition-all ${isDisabled ? 'bg-zinc-900/50 border-zinc-800/20 opacity-60' : 'bg-violet-500/5 border-violet-500/10 hover:border-violet-500/30'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shadow-lg ${isDisabled ? 'bg-zinc-600' : 'bg-violet-500 shadow-violet-500/50'}`} />
                  <code className={`text-[10px] font-mono tracking-wider ${isDisabled ? 'text-zinc-600 line-through' : 'text-zinc-400'}`}>
                    {key.substring(0, 12)}...{key.substring(key.length - 8)}
                  </code>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex flex-col gap-1 mr-2">
                    <button onClick={() => handleMoveApiKey('sync', idx, 'up')} disabled={idx === 0} className="p-1 rounded bg-zinc-800/50 text-zinc-500 hover:text-white disabled:opacity-30">
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleMoveApiKey('sync', idx, 'down')} disabled={idx === (settings.apifyKeysSync?.length || 0) - 1} className="p-1 rounded bg-zinc-800/50 text-zinc-500 hover:text-white disabled:opacity-30">
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  <button onClick={() => handleToggleApiKey(key)} className={`p-2 rounded-xl transition-all ${isDisabled ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black' : 'bg-zinc-800/50 text-zinc-500 hover:text-amber-500'}`} title={isDisabled ? "Ativar Chave" : "Desativar Chave"}>
                    {isDisabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => handleDeleteSyncKey(key)} className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )})}
          </div>
        </div>

        {/* COLUNA 3: SEGURANÇA E MANUTENÇÃO */}
        <div className="space-y-8">
          {/* Master Key */}
          <div className="glass-card premium-border p-8 rounded-[40px] space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <ShieldCheck className="w-5 h-5 text-red-500" />
              </div>
              <h4 className="font-black text-lg uppercase tracking-tight">Master Admin Key</h4>
            </div>
            <div className="relative group">
              <input
                type="password"
                value={newMasterKey}
                onChange={(e) => setNewMasterKey(e.target.value)}
                placeholder="Nova palavra-chave..."
                className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-red-500 outline-none transition-all"
              />
            </div>
            <button
              onClick={() => {
                if (window.confirm('Confirmar troca da Master Key?')) {
                  handleUpdateMasterKey(newMasterKey);
                  setNewMasterKey('');
                }
              }}
              disabled={!newMasterKey.trim()}
              className="w-full py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-500 transition-all shadow-lg shadow-red-600/20 text-xs uppercase disabled:opacity-50"
            >
              SALVAR MASTER KEY
            </button>
          </div>

          {/* Reset Diário */}
          <div className="glass-card premium-border p-8 rounded-[40px] space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <RefreshCw className="w-5 h-5 text-amber-500" />
              </div>
              <h4 className="font-black text-lg uppercase tracking-tight">Reset de Ranking</h4>
            </div>
            <select
              value={selectedResetCompId}
              onChange={(e) => setSelectedResetCompId(e.target.value)}
              className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-[10px] font-black uppercase focus:border-amber-500 outline-none transition-all text-zinc-400"
            >
              <option value="">Selecione Competição</option>
              {competitions.filter(c => c.isActive).map(comp => (
                <option key={comp.id} value={comp.id}>{comp.title}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleResetDailyRanking(selectedResetCompId)}
                disabled={!selectedResetCompId}
                className="py-4 bg-red-500/10 text-red-500 font-black rounded-2xl border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-[10px] uppercase disabled:opacity-30"
              >
                Reset Diário
              </button>
              <button
                onClick={() => handleResetRankingSimple(selectedResetCompId)}
                disabled={!selectedResetCompId}
                className="py-4 bg-amber-500/10 text-amber-500 font-black rounded-2xl border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all text-[10px] uppercase disabled:opacity-30"
              >
                Limpar Tudo
              </button>
            </div>
          </div>

          {/* Ações Avançadas */}
          <div className="glass-card p-8 rounded-[40px] border border-zinc-800/50 bg-black/40 space-y-4">
             <button
                onClick={handleRepairMetrics}
                disabled={repairing}
                className="w-full py-4 bg-zinc-900 text-zinc-400 font-black rounded-2xl border border-zinc-800 hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-[10px] uppercase"
              >
                {repairing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Reparar Rankings
              </button>
              <button
                onClick={handleRankingResetOnly}
                className="w-full py-4 bg-zinc-900 text-amber-500/50 font-black rounded-2xl border border-zinc-800 hover:bg-amber-500 hover:text-white transition-all text-[10px] uppercase"
              >
                Zerar Geral (Resync)
              </button>
              <button
                onClick={handleSystemCleanup}
                className="w-full py-4 bg-zinc-900 text-red-500/50 font-black rounded-2xl border border-zinc-800 hover:bg-red-600 hover:text-white transition-all text-[10px] uppercase"
              >
                FACTORY RESET
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};
