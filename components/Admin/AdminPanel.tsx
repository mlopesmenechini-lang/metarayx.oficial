import React from 'react';
import { 
  Trash2, 
  RefreshCw, 
  Loader2, 
  Shield 
} from 'lucide-react';
import { Post, Competition, User, Settings, Transaction, UserRole } from '../../types';
import { TriagemTab } from './TriagemTab';
import { SincronizacaoTab } from './SincronizacaoTab';
import { RessincronizacaoTab } from './RessincronizacaoTab';
import { RelatoriosTab } from './RelatoriosTab';
import { RemovidosTab } from './RemovidosTab';
import { AcessosTab } from './AcessosTab';
import { FinanceiroTab } from './FinanceiroTab';
import { CompetitionsTab } from './CompetitionsTab';
import { UsersTab } from './UsersTab';
import { 
  RegistrosTab, 
  AvisosTab, 
  TimerTab, 
  SugestoesTab, 
  SolicitacoesRemocaoTab 
} from './MiscAdminTabs';
import { ListHeader } from './AdminUI';

interface AdminPanelProps {
  userRole: UserRole;
  tab: string;
  setTab: (tab: string) => void;
  posts: Post[];
  competitions: Competition[];
  approvedUsers: User[];
  pendingUsers: User[];
  archivedUsers: User[];
  suggestions: any[];
  pendingRegistrations: any[];
  settings: Settings;
  transactions: Transaction[];
  
  // States
  auditUserId: string | null;
  setAuditUserId: (id: string | null) => void;
  selectedCompId: string | null;
  setSelectedCompId: (id: string | null) => void;
  syncDetailCompId: string | null;
  setSyncDetailCompId: (id: string | null) => void;
  
  // Handlers - triagem
  handlePostStatus: (postId: string, status: any) => void;
  handleMovePostToCompetition: (postId: string, newCompId: string) => Promise<void>;
  
  // Handlers - sincronização
  selectedSyncPostIds: string[];
  setSelectedSyncPostIds: any;
  handleBulkRevertToPending: () => void;
  handleBulkSyncSelectedApproved: () => void;
  syncing: boolean;
  syncingPostId: string | null;
  setSyncingPostId: (id: string | null) => void;
  handleSyncApprovedParallel: () => void;
  handleSyncApprovedSequentially: () => void;
  formatLastSyncDate: (date?: string) => string;
  onSingleSync: (post: Post) => Promise<void>;
  
  // Handlers - ressincronização
  selectedResyncPostIds: string[];
  setSelectedResyncPostIds: any;
  handleSyncCompetitionSequentially: (id: string) => void;
  handleSyncCompetitionParallel: (id: string) => void;
  handleSyncAllSequentially: () => void;
  handleSyncAllParallel: () => void;
  handleBulkForceMonthly: () => void;
  handleBulkForceDaily: () => void;
  handleBulkResetMetrics: () => void;
  handleBulkSyncSelected: () => void;
  syncingCompId: string | null;
  syncProgress: number;
  syncTotal: number;
  sessionSyncedIds: string[];
  setSessionSyncedIds: any;
  apifyKey: string;
  setApifyKey: (val: string) => void;
  handleSaveApiKey: () => void;
  handleDeleteApiKey: (key: string) => void;
  onForceMonthly: (post: Post) => Promise<void>;
  onForceDaily: (post: Post) => Promise<void>;
  onResetToSync: (post: Post) => Promise<void>;
  
  // Handlers - Financeiro
  financeTab: 'RESUMO' | 'PENDING' | 'REALIZED';
  setFinanceTab: (tab: 'RESUMO' | 'PENDING' | 'REALIZED') => void;
  financeCompId: string;
  setFinanceCompId: (id: string) => void;
  financeDateFilter: string;
  setFinanceDateFilter: (date: string) => void;
  handleMarkPaid: (userId: string, amount: number, competitionId: string) => Promise<void>;
  handleToggleManualPostValidation: (postId: string) => void;
  validatedPostsLocal: string[];
  setValidatedPostsLocal: any;
  onUpdatePixKey: (userId: string, pixKey: string) => Promise<void>;
  
  // Handlers - Outros
  handleExportExcel: () => void;
  handleDeleteUserPost: (postId: string) => Promise<void>;
  handleResetDailyRanking: (id: string | null) => void;
  handleResetRankingSimple: (id: string | null) => void;
  handleRepairMetrics: () => void;
  handleRankingResetOnly: () => void;
  handleSystemCleanup: () => void;
  repairing: boolean;
  selectedResetCompId: string;
  setSelectedResetCompId: (id: string) => void;
  
  // Acessos
  newUserRole: UserRole;
  setNewUserRole: (role: UserRole) => void;
  newUserName: string;
  setNewUserName: (name: string) => void;
  newUserEmail: string;
  setNewUserEmail: (email: string) => void;
  newUserPass: string;
  setNewUserPass: (pass: string) => void;
  handleCreateUser: () => void;
  creatingUser: boolean;

  // Legacy/Other tabs (can be extracted later or passed as children)
  children?: React.ReactNode;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  userRole, tab, setTab, posts, competitions, approvedUsers, pendingUsers, archivedUsers,
  suggestions, pendingRegistrations, settings, transactions,
  auditUserId, setAuditUserId, selectedCompId, setSelectedCompId, syncDetailCompId, setSyncDetailCompId,
  handlePostStatus, handleMovePostToCompetition,
  selectedSyncPostIds, setSelectedSyncPostIds, handleBulkRevertToPending, handleBulkSyncSelectedApproved, syncing, syncingPostId, setSyncingPostId,
  handleSyncApprovedParallel, handleSyncApprovedSequentially, formatLastSyncDate, onSingleSync,
  selectedResyncPostIds, setSelectedResyncPostIds, handleSyncCompetitionSequentially, handleSyncCompetitionParallel,
  handleSyncAllSequentially, handleSyncAllParallel, handleBulkForceMonthly, handleBulkForceDaily,
  handleBulkResetMetrics, handleBulkSyncSelected, syncingCompId, syncProgress, syncTotal, sessionSyncedIds, setSessionSyncedIds,
  apifyKey, setApifyKey, handleSaveApiKey, handleDeleteApiKey, onForceMonthly, onForceDaily, onResetToSync,
  financeTab, setFinanceTab, financeCompId, setFinanceCompId, financeDateFilter, setFinanceDateFilter,
  handleMarkPaid, handleToggleManualPostValidation, validatedPostsLocal, setValidatedPostsLocal, onUpdatePixKey,
  handleExportExcel, handleDeleteUserPost, handleResetDailyRanking, handleResetRankingSimple,
  handleRepairMetrics, handleRankingResetOnly, handleSystemCleanup, repairing, selectedResetCompId, setSelectedResetCompId,
  newUserRole, setNewUserRole, newUserName, setNewUserName, newUserEmail, setNewUserEmail, newUserPass, setNewUserPass,
  handleCreateUser, creatingUser,
  children
}) => {
  return (
    <div className="space-y-12">
      {/* HEADER DO ADMIN - CONTROLES GLOBAIS */}
      <div className="flex flex-wrap items-center justify-between gap-10 bg-zinc-950/50 p-10 rounded-[50px] border border-zinc-900 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 blur-[120px] -z-10 group-hover:bg-amber-500/10 transition-all duration-1000" />
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-4 h-4 rounded-full bg-amber-500 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
            <h2 className="text-4xl font-black uppercase tracking-tighter gold-gradient">Painel de Controle Elite</h2>
          </div>
          <p className="text-zinc-500 font-bold text-xs uppercase tracking-[0.3em] ml-1">Gerenciamento Centralizado de Operações MetaRayx</p>
        </div>

        {userRole === 'admin' && (
          <div className="flex flex-wrap items-end gap-10">
            {/* RESET DIÁRIO */}
            <div className="flex flex-col gap-2 min-w-[240px]">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Zerar Ranking Diário</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedResetCompId}
                  onChange={(e) => setSelectedResetCompId(e.target.value)}
                  className="bg-black border border-zinc-800 rounded-xl py-3 px-4 text-[10px] font-bold focus:border-amber-500 outline-none transition-all text-white flex-1"
                >
                  <option value="">Selecione Competição</option>
                  {competitions.filter(c => c.isActive).map(comp => (
                    <option key={comp.id} value={comp.id}>{comp.title}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleResetDailyRanking(selectedResetCompId)}
                  disabled={!selectedResetCompId}
                  className="p-3 bg-red-500/10 text-red-500 font-black rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10 disabled:opacity-30 flex items-center justify-center text-[10px]"
                  title="Zerar Diário (Com Premiação)"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleResetRankingSimple(selectedResetCompId)}
                  disabled={!selectedResetCompId}
                  className="p-3 bg-amber-500/10 text-amber-500 font-black rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/10 disabled:opacity-30 flex items-center justify-center text-[10px]"
                  title="Limpar Tudo (Preparar Ressincronização)"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* AÇÕES DE SISTEMA */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleRepairMetrics}
                disabled={repairing}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-500/10 text-amber-500 font-black rounded-xl hover:bg-amber-500 hover:text-black transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50 text-[10px] uppercase"
              >
                {repairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Reparar Rankings
              </button>

              <button
                onClick={handleRankingResetOnly}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-500/20 text-amber-500 font-black rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/20 text-[10px] uppercase"
              >
                <RefreshCw className="w-4 h-4" />
                Zerar Geral (Resync)
              </button>

              <button
                onClick={handleSystemCleanup}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600/20 text-red-600 font-black rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-lg shadow-red-600/20 text-[10px] uppercase"
              >
                <Shield className="w-4 h-4" />
                Factory Reset
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap p-1 bg-zinc-900 rounded-2xl w-fit gap-1">
        {/* USANDO OS BOTÕES DE TAB ORIGINAIS PARA MANTER O LOOK */}
        <button
          onClick={() => { setTab('VISAO_GERAL'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
          className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'VISAO_GERAL' ? 'gold-bg text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          DASHBOARD
        </button>
        {userRole === 'admin' && (
          <>
            <button
              onClick={() => { setTab('POSTS'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'POSTS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              POSTS ({posts.filter(p => p.status === 'pending').length})
            </button>
            <button
              onClick={() => { setTab('SINCRONIZACAO'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'SINCRONIZACAO' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              SINCRONIZAÇÃO ({posts.filter(p => p.status === 'approved').length})
            </button>
            <button
              onClick={() => { setTab('RESSINCRONIZACAO'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'RESSINCRONIZACAO' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              RESSINCRONIZAÇÃO ({posts.filter(p => p.status === 'synced' || p.status === 'banned').length})
            </button>
            <button
              onClick={() => { setTab('USERS'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'USERS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              PENDENTES ({pendingUsers.length})
            </button>
            <button
              onClick={() => { setTab('USERS_APPROVED'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'USERS_APPROVED' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
            >
              APROVADOS ({approvedUsers.length})
            </button>
            <button
              onClick={() => { setTab('COMPETITIONS'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'COMPETITIONS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
            >
              COMPETIÇÕES ({competitions.length})
            </button>
            <button
              onClick={() => { setTab('REMOVAL_REQUESTS'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'REMOVAL_REQUESTS' ? 'bg-amber-500 text-black' : 'text-zinc-500'}`}
            >
              SOLICITAÇÕES ({posts.filter(p => p.status === 'removal_requested').length})
            </button>
            <button
              onClick={() => { setTab('REGISTROS'); setSyncDetailCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'REGISTROS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
            >
              REGISTROS
            </button>
            <button
              onClick={() => { setTab('AVISOS'); setSyncDetailCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'AVISOS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
            >
              AVISOS
            </button>
            <button
              onClick={() => { setTab('TIMER'); setSyncDetailCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'TIMER' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
            >
              TIMER
            </button>
          </>
        )}
        {(userRole === 'admin' || userRole === 'auditor' || userRole === 'administrativo') && (
          <button
            onClick={() => { setTab('FINANCEIRO'); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'FINANCEIRO' ? 'gold-bg text-black' : 'text-zinc-500'}`}
          >
            FINANCEIRO
          </button>
        )}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('ACESSOS'); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'ACESSOS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            CRIAR ACESSO
          </button>
        )}
        {(userRole === 'admin' || userRole === 'auditor') && (
          <>
            <button
              onClick={() => { setTab('SUGESTOES'); setSyncDetailCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'SUGESTOES' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
            >
              SUGESTÕES ({suggestions.length})
            </button>
            <button
              onClick={() => { setTab('RELATORIOS'); setSyncDetailCompId(null); setSelectedCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'RELATORIOS' ? 'gold-bg text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              RELATÓRIOS
            </button>
            <button
              onClick={() => { setTab('REMOVED_POSTS'); setSyncDetailCompId(null); setSelectedCompId(null); }}
              className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'REMOVED_POSTS' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              REMOVIDOS
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {tab === 'POSTS' && (
          <TriagemTab 
            posts={posts} 
            competitions={competitions} 
            syncDetailCompId={syncDetailCompId} 
            setSyncDetailCompId={setSyncDetailCompId} 
            handlePostStatus={handlePostStatus} 
            handleMovePostToCompetition={handleMovePostToCompetition}
          />
        )}
        
        {tab === 'SINCRONIZACAO' && (
          <SincronizacaoTab 
            posts={posts} competitions={competitions} settings={settings} syncDetailCompId={syncDetailCompId} setSyncDetailCompId={setSyncDetailCompId}
            selectedSyncPostIds={selectedSyncPostIds} setSelectedSyncPostIds={setSelectedSyncPostIds} handleBulkRevertToPending={handleBulkRevertToPending}
            handleBulkSyncSelectedApproved={handleBulkSyncSelectedApproved}
            syncing={syncing} syncingPostId={syncingPostId} setSyncingPostId={setSyncingPostId} handleSyncApprovedParallel={handleSyncApprovedParallel}
            handleSyncApprovedSequentially={handleSyncApprovedSequentially} formatLastSyncDate={formatLastSyncDate} onSingleSync={onSingleSync}
            handleMovePostToCompetition={handleMovePostToCompetition}
          />
        )}
        
          <RessincronizacaoTab 
            posts={posts} competitions={competitions} settings={settings} syncDetailCompId={syncDetailCompId} setSyncDetailCompId={setSyncDetailCompId}
            selectedResyncPostIds={selectedResyncPostIds} setSelectedResyncPostIds={setSelectedResyncPostIds} handleSyncCompetitionSequentially={handleSyncCompetitionSequentially}
            handleSyncCompetitionParallel={handleSyncCompetitionParallel} handleSyncAllSequentially={handleSyncAllSequentially} handleSyncAllParallel={handleSyncAllParallel}
            handleBulkForceMonthly={handleBulkForceMonthly} handleBulkForceDaily={handleBulkForceDaily} handleBulkResetMetrics={handleBulkResetMetrics}
            handleBulkSyncSelected={handleBulkSyncSelected} syncing={syncing} syncingCompId={syncingCompId} syncProgress={syncProgress} syncTotal={syncTotal}
            sessionSyncedIds={sessionSyncedIds} setSessionSyncedIds={setSessionSyncedIds} syncingPostId={syncingPostId} setSyncingPostId={setSyncingPostId}
            apifyKey={apifyKey} setApifyKey={setApifyKey} handleSaveApiKey={handleSaveApiKey} handleDeleteApiKey={handleDeleteApiKey}
            onForceMonthly={onForceMonthly} onForceDaily={onForceDaily} onResetToSync={onResetToSync} onSingleSync={onSingleSync}
            handleMovePostToCompetition={handleMovePostToCompetition}
            pendingMoves={pendingMoves}
            setPendingMoves={setPendingMoves}
            setRejectionReason={() => {}} setRejectionModal={() => {}}
          />
        )}

        {tab === 'USERS' && (
          <UsersTab 
            type="PENDING" users={pendingUsers} userRole={userRole}
            handleUserApproval={() => {}} handleArchiveUser={() => {}} handleDeleteUser={() => {}}
            PendingUserRow={() => null} ApprovedUserRow={() => null} // These will be passed from App.tsx
          />
        )}

        {tab === 'USERS_APPROVED' && (
          <UsersTab 
            type="APPROVED" users={approvedUsers} userRole={userRole}
            handleUpdateUserRole={() => {}} handleArchiveUser={() => {}} handleDeleteUser={() => {}}
            PendingUserRow={() => null} ApprovedUserRow={() => null} // These will be passed from App.tsx
          />
        )}

        {tab === 'ARCHIVED' && (
          <UsersTab 
            type="ARCHIVED" users={archivedUsers} userRole={userRole}
            handleArchiveUser={() => {}} handleDeleteUser={() => {}}
            PendingUserRow={() => null} ApprovedUserRow={() => null}
          />
        )}

        {tab === 'COMPETITIONS' && (
          <CompetitionsTab 
            competitions={competitions} posts={posts} selectedCompId={selectedCompId} setSelectedCompId={setSelectedCompId}
            isCreatingComp={false} setIsCreatingComp={() => {}} userRole={userRole}
            handleEditCompClick={() => {}} setCompToDelete={() => {}}
          />
        )}

        {tab === 'REGISTROS' && (
          <RegistrosTab 
            pendingRegistrations={pendingRegistrations} 
            handleRegistrationStatus={() => {}} 
            handleDeleteRegistration={() => {}} 
          />
        )}

        {tab === 'AVISOS' && (
          <AvisosTab 
            announcements={[]} annTitle="" setAnnTitle={() => {}} annMsg="" setAnnMsg={() => {}}
            isCreatingAnn={false} setIsCreatingAnn={() => {}} handleCreateAnnouncement={() => {}}
            handleDeleteAnnouncement={() => {}}
          />
        )}

        {tab === 'TIMER' && (
          <TimerTab 
            timerConfig={{ enabled: false, endTime: 0, targetTime: '', message: '' }}
            handleUpdateTimer={async () => {}}
          />
        )}

        {tab === 'SUGESTOES' && (
          <SugestoesTab 
            suggestions={suggestions} 
            handleUpdateSuggestionStatus={() => {}} 
            handleDeleteSuggestion={() => {}} 
          />
        )}

        {tab === 'REMOVAL_REQUESTS' && (
          <SolicitacoesRemocaoTab 
            posts={posts} 
            handleApproveRemoval={() => {}} 
            handleRejectRemoval={() => {}} 
          />
        )}

        {tab === 'RELATORIOS' && (
          <RelatoriosTab 
            posts={posts} competitions={competitions} selectedCompId={selectedCompId} setSelectedCompId={setSelectedCompId}
            handleExportExcel={handleExportExcel} userRole={userRole} ListHeader={ListHeader}
          />
        )}

        {tab === 'REMOVED_POSTS' && (
          <RemovidosTab 
            posts={posts} handleDeleteUserPost={handleDeleteUserPost} userRole={userRole} ListHeader={ListHeader}
          />
        )}

        {tab === 'ACESSOS' && (
          <AcessosTab 
            newUserRole={newUserRole} setNewUserRole={setNewUserRole} newUserName={newUserName} setNewUserName={setNewUserName}
            newUserEmail={newUserEmail} setNewUserEmail={setNewUserEmail} newUserPass={newUserPass} setNewUserPass={setNewUserPass}
            handleCreateUser={handleCreateUser} creatingUser={creatingUser}
          />
        )}

        {tab === 'FINANCEIRO' && (
          <FinanceiroTab 
            competitions={competitions} approvedUsers={approvedUsers} posts={posts} transactions={transactions}
            financeTab={financeTab} setFinanceTab={setFinanceTab} financeCompId={financeCompId} setFinanceCompId={setFinanceCompId}
            financeDateFilter={financeDateFilter} setFinanceDateFilter={setFinanceDateFilter} auditUserId={auditUserId} setAuditUserId={setAuditUserId}
            userRole={userRole} handleMarkPaid={handleMarkPaid} handleToggleManualPostValidation={handleToggleManualPostValidation}
            validatedPostsLocal={validatedPostsLocal} setValidatedPostsLocal={setValidatedPostsLocal} onUpdatePixKey={onUpdatePixKey}
          />
        )}

        {/* Fallback for other tabs that are still in App.tsx or yet to be extracted */}
        {children}
      </div>
    </div>
  );
};
