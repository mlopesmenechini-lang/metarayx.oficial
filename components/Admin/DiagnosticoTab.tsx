import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ShieldAlert, 
  Info, 
  RefreshCw, 
  UserCheck, 
  XCircle, 
  Clock, 
  Target,
  ChevronRight,
  TrendingUp,
  Zap,
  Camera,
  AlertCircle,
  Share2,
  Link,
  AlertTriangle,
  Trash2,
  Copy
} from 'lucide-react';
import { User, Post, Competition, CompetitionRegistration } from '../../types';
import { updateUserMetrics } from '../../services/apifyService';
import { db, doc, updateDoc } from '../../firebase';

interface DiagnosticoTabProps {
  users: User[];
  posts: Post[];
  competitions: Competition[];
  registrations: CompetitionRegistration[];
  handleDeleteAllDuplicates?: () => Promise<void>;
  userRole?: string;
}

export const DiagnosticoTab: React.FC<DiagnosticoTabProps> = ({
  users,
  posts,
  competitions,
  registrations,
  handleDeleteAllDuplicates,
  userRole
}) => {
  const [viewMode, setViewMode] = useState<'USER_SEARCH' | 'CONTINGENCY' | 'LINK_SEARCH'>('USER_SEARCH');
  const [searchTerm, setSearchTerm] = useState('');
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isSyncingSocials, setIsSyncingSocials] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return users.filter(u => 
      u.displayName?.toLowerCase().includes(term) || 
      u.email?.toLowerCase().includes(term) ||
      u.uid.toLowerCase().includes(term)
    ).slice(0, 5);
  }, [searchTerm, users]);

  const selectedUser = useMemo(() => 
    users.find(u => u.uid === selectedUserId),
    [selectedUserId, users]
  );

  const userPosts = useMemo(() => 
    posts.filter(p => p.userId === selectedUserId),
    [selectedUserId, posts]
  );

  const userRegistrations = useMemo(() => 
    registrations.filter(r => r.userId === selectedUserId),
    [selectedUserId, registrations]
  );

  const handleRepairUser = async () => {
    if (!selectedUserId) return;
    setIsRepairing(true);
    try {
      await updateUserMetrics(selectedUserId);
      alert('Métricas sincronizadas com sucesso para este usuário!');
    } catch (err) {
      console.error(err);
      alert('Erro ao sincronizar métricas.');
    } finally {
      setIsRepairing(false);
    }
  };

  const handleSyncSocials = async () => {
    if (!selectedUserId || !selectedUser) return;
    
    if (!confirm('Este processo irá varrer todos os vídeos deste usuário e adicionar os @s encontrados ao perfil dele. Deseja continuar?')) {
      return;
    }

    setIsSyncingSocials(true);
    try {
      const tiktokSet = new Set<string>(selectedUser.tiktok || []);
      const instagramSet = new Set<string>(selectedUser.instagram || []);
      const youtubeSet = new Set<string>(selectedUser.youtube || []);

      userPosts.forEach(post => {
        if (post.accountHandle) {
          const handle = post.accountHandle.startsWith('@') ? post.accountHandle : `@${post.accountHandle}`;
          if (post.platform === 'tiktok') tiktokSet.add(handle);
          if (post.platform === 'instagram') instagramSet.add(handle);
          if (post.platform === 'youtube') youtubeSet.add(handle);
        }
      });

      await updateDoc(doc(db, 'users', selectedUserId), {
        tiktok: Array.from(tiktokSet),
        instagram: Array.from(instagramSet),
        youtube: Array.from(youtubeSet)
      });

      alert('Redes sociais sincronizadas e recuperadas com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao sincronizar redes sociais.');
    } finally {
      setIsSyncingSocials(false);
    }
  };

  const normalizeUrlForDisplay = (url: string) => {
    try {
      let clean = url.trim().toLowerCase();
      if (clean.includes('youtube.com') || clean.includes('youtu.be')) {
        let videoId = '';
        if (clean.includes('v=')) videoId = clean.split('v=')[1]?.split('&')[0]?.split('?')[0];
        else if (clean.includes('/shorts/')) videoId = clean.split('/shorts/')[1]?.split('?')[0];
        else if (clean.includes('youtu.be/')) videoId = clean.split('youtu.be/')[1]?.split('?')[0];
        if (videoId) return `youtube:${videoId}`;
      }
      if (clean.includes('tiktok.com')) {
        if (clean.includes('/video/')) {
          const videoId = clean.split('/video/')[1]?.split('?')[0]?.split('/')[0];
          if (videoId) return `tiktok:${videoId}`;
        }
      }
      if (clean.includes('instagram.com')) {
        const parts = clean.split('/');
        const pIndex = parts.indexOf('p');
        const reelIndex = parts.indexOf('reel');
        const parentIndex = pIndex !== -1 ? pIndex : reelIndex;
        if (parentIndex !== -1 && parts.length > parentIndex + 1) {
          return `instagram:${parts[parentIndex + 1].split('?')[0]}`;
        }
      }
      // Fallback: limpa parâmetros de rastreio para qualquer outro tipo de link (ex: vm.tiktok.com)
      return clean.split('?')[0].replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');
    } catch { return url; }
  };

  const duplicateGroups = useMemo(() => {
    const groups: Record<string, Post[]> = {};
    posts.forEach(p => {
      // Ignora deletados para não inflar duplicatas de lixo antigo
      if (p.status === 'deleted' || p.status === 'banned') return;
      const norm = normalizeUrlForDisplay(p.url);
      if (!groups[norm]) groups[norm] = [];
      groups[norm].push(p);
    });
    return Object.entries(groups)
      .filter(([_, group]) => group.length > 1)
      .map(([norm, group]) => ({ norm, group: group.sort((a,b) => (a.timestamp || 0) - (b.timestamp || 0)) }));
  }, [posts]);

  useEffect(() => {
    // Debug para encontrar o vídeo 7630262796260789522
    const foundPosts = posts.filter(p => typeof p.url === 'string' && p.url.includes('7630262796260789522'));
    console.log("=== INSPEÇÃO PROFUNDA DO LINK: 7630262796260789522 ===");
    console.log(`Encontrados no banco: ${foundPosts.length}`);
    foundPosts.forEach(p => console.log(`- ID: ${p.id} | Status: ${p.status} | URL: ${p.url}`));
    console.log("====================================================");
  }, [posts]);

  const foundPosts = posts.filter(p => typeof p.url === 'string' && p.url.includes('7630262796260789522'));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex gap-4 p-2 bg-zinc-900/50 rounded-2xl w-max">
        <button
          onClick={() => setViewMode('USER_SEARCH')}
          className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${
            viewMode === 'USER_SEARCH' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-amber-400'
          }`}
        >
          BUSCA DE USUÁRIO
        </button>
        <button
          onClick={() => setViewMode('LINK_SEARCH')}
          className={`px-6 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
            viewMode === 'LINK_SEARCH' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-indigo-400'
          }`}
        >
          <Search className="w-4 h-4" />
          BUSCA DE LINK
        </button>
        {userRole !== 'auditor' && (
          <button
            onClick={() => setViewMode('CONTINGENCY')}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
              viewMode === 'CONTINGENCY' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-zinc-500 hover:text-red-400'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            CONTINGÊNCIA
            {duplicateGroups.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${viewMode === 'CONTINGENCY' ? 'bg-white text-red-600' : 'bg-red-500/20 text-red-500'}`}>
                {duplicateGroups.length}
              </span>
            )}
          </button>
        )}
      </div>

      {viewMode === 'CONTINGENCY' && userRole !== 'auditor' ? (
        <div className="space-y-6">
          <div className="bg-red-500/5 border border-red-500/20 rounded-[40px] p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase text-red-500 flex items-center gap-3">
                <Trash2 className="w-8 h-8" /> Limpeza de Duplicados
              </h3>
              <p className="text-zinc-400 font-bold text-xs">
                O sistema identificou <strong className="text-red-500">{duplicateGroups.length} links copiados ou inseridos em duplicidade</strong>. Apenas o envio mais antigo será mantido, os demais serão descartados e as pontuações removidas.
              </p>
              
              <div className="mt-4 p-4 border border-zinc-800 rounded-xl bg-black">
                <p className="text-xs text-amber-500 font-black mb-2">DEBUG DO SISTEMA PARA O LINK FAMAFLASH (7630262796260789522):</p>
                <p className="text-xs text-zinc-300">Encontrados no banco de dados ativo: {foundPosts.length}</p>
                {foundPosts.map(fp => (
                  <p key={fp.id} className="text-[10px] text-zinc-500 mt-1">ID: {fp.id} | Status: {fp.status} | URL: {fp.url}</p>
                ))}
              </div>
            </div>
            
            <button
              onClick={async () => {
                if (confirm('Tem certeza? Isso irá excluir permanentemente todos os posts excedentes e remover os pontos referentes a eles em todas as competições e rankings globais. Esta ação não pode ser desfeita.')) {
                  setIsCleaning(true);
                  if (handleDeleteAllDuplicates) await handleDeleteAllDuplicates();
                  setIsCleaning(false);
                }
              }}
              disabled={isCleaning || duplicateGroups.length === 0}
              className="px-8 py-4 bg-red-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-white hover:text-red-600 transition-all opacity-100 disabled:opacity-50 min-w-max flex items-center gap-2"
            >
              {isCleaning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {isCleaning ? 'APAGANDO DADOS...' : 'EXCLUIR TODOS OS DUPLICADOS'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {duplicateGroups.map((g, i) => {
              const displayUrl = g.group[0]?.url?.split('?')[0] || g.norm;
              return (
              <div key={i} className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-3 w-full bg-black/40 p-3 rounded-xl border border-zinc-800/50">
                  <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center shrink-0">
                    <Copy className="w-4 h-4 text-zinc-500" />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 truncate w-full" title={displayUrl}>{displayUrl}</span>
                </div>
                
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Envolvidos ({g.group.length}):</p>
                  {g.group.map((post, idx) => (
                    <div key={post.id} className="flex flex-col sm:flex-row items-center justify-between p-3 bg-black/20 rounded-xl gap-2">
                       <div className="flex items-center gap-2">
                         <span className="text-xs font-bold text-white">{post.userName}</span>
                         <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${idx === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                           {idx === 0 ? 'MANTIDO' : 'A EXCLUIR'}
                         </span>
                       </div>
                       <div className="text-right">
                         <p className="text-[10px] font-black text-zinc-500">{new Date(post.timestamp).toLocaleString()}</p>
                         <p className="text-[9px] font-bold text-zinc-700">Views: {post.views}</p>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            );
            })}
            {duplicateGroups.length === 0 && (
              <div className="md:col-span-2 py-20 text-center glass border-dashed border-zinc-900 rounded-[40px] ">
                <ShieldAlert className="w-12 h-12 text-emerald-500/50 mx-auto mb-4" />
                <p className="text-emerald-500 font-black uppercase tracking-widest text-sm">Banco de dados íntegro</p>
                <p className="text-zinc-500 text-xs mt-2">Nenhuma duplicidade detectada no sistema no momento.</p>
              </div>
            )}
          </div>
        </div>
      ) : viewMode === 'LINK_SEARCH' ? (
        <div className="space-y-6">
          <div className="bg-indigo-500/5 p-8 rounded-[40px] border border-indigo-500/20 space-y-6">
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase text-indigo-500 flex items-center gap-3">
                <Search className="w-8 h-8" /> Investigação de Link
              </h3>
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Cole um link abaixo para descobrir quem o enviou e qual o status atual no sistema.</p>
            </div>

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                <Link className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Cole a URL do vídeo (TikTok, YouTube ou Instagram)..."
                value={linkSearchTerm}
                onChange={(e) => setLinkSearchTerm(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all shadow-xl"
              />
            </div>
          </div>

          <div className="space-y-4">
            {linkSearchTerm.trim().length > 3 ? (
              posts.filter(p => p.url?.toLowerCase().includes(linkSearchTerm.toLowerCase())).length > 0 ? (
                posts.filter(p => p.url?.toLowerCase().includes(linkSearchTerm.toLowerCase())).map(post => (
                  <div key={post.id} className="p-8 rounded-[2.5rem] glass border border-zinc-800/50 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${
                          post.platform === 'tiktok' ? 'bg-amber-500/10 text-amber-500' :
                          post.platform === 'youtube' ? 'bg-red-500/10 text-red-500' : 'bg-pink-500/10 text-pink-500'
                        }`}>
                          {post.platform === 'tiktok' ? <Zap className="w-6 h-6" /> :
                           post.platform === 'youtube' ? <TrendingUp className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Enviado por</p>
                          <h4 className="text-xl font-black text-white">{post.userName || 'Usuário Desconhecido'}</h4>
                          <p className="text-[10px] font-bold text-zinc-600">{post.userId}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                          <p className="text-[8px] font-black text-zinc-600 uppercase">Status</p>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${
                            post.status === 'approved' || post.status === 'synced' ? 'text-emerald-500' :
                            post.status === 'rejected' || post.status === 'deleted' ? 'text-red-500' : 'text-amber-500'
                          }`}>
                            {post.status === 'approved' || post.status === 'synced' ? 'Aprovado' : 
                             post.status === 'rejected' ? 'Recusado' : 
                             post.status === 'deleted' ? 'Removido/Lixo' : 'Em Triagem'}
                          </p>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                          <p className="text-[8px] font-black text-zinc-600 uppercase">Métrica</p>
                          <p className="text-[10px] font-black text-white uppercase">{(post.views || 0).toLocaleString()} VIEWS</p>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                          <p className="text-[8px] font-black text-zinc-600 uppercase">Data Envio</p>
                          <p className="text-[10px] font-black text-zinc-400 uppercase">{new Date(post.timestamp).toLocaleDateString()} {new Date(post.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-black/40 rounded-2xl border border-zinc-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 w-full">
                        <Link className="w-4 h-4 text-zinc-600 shrink-0" />
                        <span className="text-xs font-bold text-zinc-400 truncate">{post.url}</span>
                      </div>
                      <a 
                        href={post.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="px-6 py-2 bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-105 transition-all whitespace-nowrap"
                      >
                        Abrir Original
                      </a>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <Target className="w-4 h-4 text-zinc-600" />
                       <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                         Competição: <span className="text-zinc-300">{competitions.find(c => c.id === post.competitionId)?.title || 'GERAL / NENHUMA'}</span>
                       </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center glass border-dashed border-zinc-900 rounded-[40px]">
                  <AlertCircle className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                  <p className="text-zinc-600 font-black uppercase tracking-widest text-sm">Link não encontrado</p>
                  <p className="text-zinc-700 text-xs mt-2">Nenhum post no sistema corresponde a esta URL.</p>
                </div>
              )
            ) : linkSearchTerm.trim().length > 0 ? (
               <div className="py-10 text-center">
                 <p className="text-zinc-600 text-xs font-bold italic">Continue digitando ou cole o link completo...</p>
               </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center space-y-6 text-center">
                <div className="w-20 h-20 bg-zinc-900/50 rounded-[30px] flex items-center justify-center border border-zinc-800/50">
                  <Search className="w-10 h-10 text-zinc-800" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-zinc-600 uppercase">Aguardando busca...</h4>
                  <p className="text-[10px] font-bold text-zinc-700">O resultado aparecerá automaticamente após inserir o link.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
      <>
      <div className="bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800/50 space-y-6">
        <div className="space-y-2">
          <h3 className="text-2xl font-black uppercase gold-gradient flex items-center gap-3">
            <ShieldAlert className="w-8 h-8" /> Diagnóstico de Usuário
          </h3>
          <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Investigue por que um usuário não aparece no ranking ou tem métricas inconsistentes.</p>
        </div>

        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nome, email ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white outline-none focus:border-amber-500 transition-all shadow-xl"
          />

          {filteredUsers.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden z-50 shadow-2xl">
              {filteredUsers.map(u => (
                <button
                  key={u.uid}
                  onClick={() => {
                    setSelectedUserId(u.uid);
                    setSearchTerm('');
                  }}
                  className="w-full p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 font-black text-[10px]">
                      {u.displayName?.substring(0, 2).toUpperCase() || '??'}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-white">{u.displayName}</p>
                      <p className="text-[10px] font-bold text-zinc-500">{u.email}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedUser && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* COLUNA 1: STATUS GERAL */}
          <div className="space-y-6">
            <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Status do Usuário</h4>
                <button 
                  onClick={handleRepairUser}
                  disabled={isRepairing}
                  className="p-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-black transition-all"
                  title="Recalcular métricas deste usuário"
                >
                  <RefreshCw className={`w-4 h-4 ${isRepairing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-zinc-800/50">
                  <span className="text-xs font-bold text-zinc-400 text-zinc-400">Aprovado Globalmente</span>
                  {selectedUser.isApproved ? (
                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase"><UserCheck className="w-3 h-3" /> SIM</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase"><XCircle className="w-3 h-3" /> NÃO</span>
                  )}
                </div>
                <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-zinc-800/50">
                  <span className="text-xs font-bold text-zinc-400 text-zinc-400">Arquivado</span>
                  {selectedUser.isArchived ? (
                    <span className="text-[10px] font-black text-amber-500 uppercase">SIM</span>
                  ) : (
                    <span className="text-[10px] font-black text-zinc-500 uppercase">NÃO</span>
                  )}
                </div>
                <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-zinc-800/50">
                  <span className="text-xs font-bold text-zinc-400 text-zinc-400">Total de Posts</span>
                  <span className="text-[10px] font-black text-white">{selectedUser.totalPosts || 0}</span>
                </div>
              </div>

               <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-2">
                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                  <Info className="w-3 h-3" /> Conclusão Diagnóstica
                </p>
                <p className="text-[11px] font-bold text-zinc-400 leading-relaxed">
                  {!selectedUser.isApproved 
                    ? "Este usuário NÃO está aprovado globalmente. Ele nunca aparecerá em nenhum ranking até ser aprovado na aba de Pendentes."
                    : selectedUser.totalPosts === 0 
                    ? "Este usuário está aprovado mas não possui NENHUM post aprovado no sistema."
                    : userPosts.length === 0
                    ? "O contador de posts diz que ele tem vídeos, mas não encontrei posts vinculados ao UID dele. Pode haver um erro de sincronização."
                    : "O usuário está ativo e possui posts. Verifique as competições ao lado."
                  }
                </p>
              </div>
            </div>

            {/* CARD DE REDES SOCIAIS */}
            <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Redes Sociais</h4>
                <button 
                  onClick={handleSyncSocials}
                  disabled={isSyncingSocials}
                  className="px-3 py-1.5 bg-pink-500/10 text-pink-500 rounded-xl hover:bg-pink-500 hover:text-black transition-all flex items-center gap-2 text-[8px] font-black uppercase tracking-widest"
                >
                  {isSyncingSocials ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />}
                  Sincronizar via Posts
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-1 flex items-center gap-2">
                    <Zap className="w-3 h-3" /> TikTok
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.tiktok && selectedUser.tiktok.length > 0 ? (
                      selectedUser.tiktok.map(t => (
                        <span key={t} className="px-3 py-1.5 bg-black border border-amber-500/20 text-amber-500 text-[10px] font-black rounded-lg">
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-bold text-zinc-700 italic px-1">Nenhuma conta cadastrada</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-1 flex items-center gap-2">
                    <Camera className="w-3 h-3" /> Instagram
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.instagram && selectedUser.instagram.length > 0 ? (
                      selectedUser.instagram.map(i => (
                        <span key={i} className="px-3 py-1.5 bg-black border border-pink-500/20 text-pink-500 text-[10px] font-black rounded-lg">
                          {i}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-bold text-zinc-700 italic px-1">Nenhuma conta cadastrada</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-1 flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" /> YouTube
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.youtube && selectedUser.youtube.length > 0 ? (
                      selectedUser.youtube.map(y => (
                        <span key={y} className="px-3 py-1.5 bg-black border border-red-500/20 text-red-500 text-[10px] font-black rounded-lg">
                          {y}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-bold text-zinc-700 italic px-1">Nenhuma conta cadastrada</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA 2: INSCRIÇÕES */}
          <div className="space-y-6 lg:col-span-2">
            <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 space-y-6">
              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Inscrições em Competições</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {competitions.map(comp => {
                  const reg = userRegistrations.find(r => r.competitionId === comp.id);
                  const compPosts = userPosts.filter(p => p.competitionId === comp.id);
                  const stats = selectedUser.competitionStats?.[comp.id];

                  return (
                    <div key={comp.id} className={`p-5 rounded-2xl border ${reg ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-black/20 border-zinc-800 opacity-50'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-xs font-black text-white uppercase truncate pr-4">{comp.title}</h5>
                        {reg ? (
                          <span className={`text-[9px] font-black px-2 py-1 rounded-lg ${
                            reg.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                            reg.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {reg.status.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-zinc-800 text-zinc-500">NÃO INSCRITO</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-zinc-500 uppercase">Links (Triados)</p>
                          <p className="text-sm font-black text-zinc-300">
                            {compPosts.filter(p => p.status === 'approved' || p.status === 'synced').length} / {compPosts.length}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-zinc-500 uppercase">Pontos (Mensal)</p>
                          <p className="text-sm font-black text-amber-500">
                            {(stats?.views || 0).toLocaleString()} <span className="text-[10px] text-zinc-600">views</span>
                          </p>
                        </div>
                      </div>

                      {reg && reg.status !== 'approved' && (
                        <div className="mt-4 flex items-center gap-2 p-2 bg-red-500/5 border border-red-500/20 rounded-xl">
                          <AlertCircle className="w-3 h-3 text-red-500" />
                          <p className="text-[10px] font-bold text-red-400">Inscrição não aprovada. Isso pode impedir a pontuação.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LISTA DE POSTS BRUTOS */}
            <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 space-y-6">
              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Links de {selectedUser.displayName}</h4>
              
              <div className="space-y-3">
                {userPosts.map(post => (
                  <div key={post.id} className="p-4 bg-black/40 rounded-2xl border border-zinc-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
                        {post.platform === 'tiktok' ? <Zap className="w-5 h-5 text-amber-500" /> :
                         post.platform === 'youtube' ? <TrendingUp className="w-5 h-5 text-red-500" /> :
                         <Camera className="w-5 h-5 text-pink-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate">{post.url}</p>
                        <div className="flex items-center gap-2">
                           <p className="text-[10px] font-bold text-zinc-300">
                             {competitions.find(c => c.id === post.competitionId)?.title || 'SEM COMPETIÇÃO'}
                           </p>
                           <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                             post.status === 'approved' || post.status === 'synced' ? 'bg-emerald-500/10 text-emerald-500' :
                             post.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                           }`}>
                             {post.status.toUpperCase()}
                           </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-white">{(post.views || 0).toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase">Views Totais</p>
                    </div>
                  </div>
                ))}
                {userPosts.length === 0 && (
                  <div className="py-10 text-center border border-dashed border-zinc-800 rounded-2xl">
                    <p className="text-zinc-600 font-black text-[10px] uppercase">Nenhum post encontrado</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedUser && searchTerm === '' && (
        <div className="py-32 flex flex-col items-center justify-center space-y-6 text-center">
          <div className="w-24 h-24 bg-zinc-900 rounded-[40px] flex items-center justify-center border border-zinc-800">
            <Target className="w-10 h-10 text-zinc-700" />
          </div>
          <div className="space-y-2">
            <h4 className="text-xl font-black text-zinc-600 uppercase">Inicie uma Busca</h4>
            <p className="text-sm font-bold text-zinc-700 max-w-xs mx-auto text-zinc-700">Digite o nome do usuário que deseja investigar para carregar o PDF técnico de performance.</p>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};
