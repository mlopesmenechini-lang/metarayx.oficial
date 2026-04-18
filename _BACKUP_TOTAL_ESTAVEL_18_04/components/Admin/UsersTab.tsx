import React from 'react';
import { Users, UserX, UserCheck, Archive, Shield, Trash2, ShieldAlert } from 'lucide-react';
import { User, UserRole } from '../../types';
import { ListHeader } from './AdminUI';

interface UsersTabProps {
  type: 'PENDING' | 'APPROVED' | 'ARCHIVED';
  users: User[];
  handleUserApproval?: (userId: string, isApproved: boolean) => void;
  handleArchiveUser?: (userId: string, archive: boolean) => void;
  handleDeleteUser?: (userId: string) => void;
  handleUpdateUserRole?: (uid: string, role: UserRole) => void;
  userRole: UserRole;
  PendingUserRow: any; // Injected for now or moved later
  ApprovedUserRow: any;
}

export const UsersTab: React.FC<UsersTabProps> = ({
  type,
  users,
  handleUserApproval,
  handleArchiveUser,
  handleDeleteUser,
  handleUpdateUserRole,
  userRole,
  PendingUserRow,
  ApprovedUserRow
}) => {
  const title = type === 'PENDING' ? 'Solicitações de Acesso' : 
                type === 'APPROVED' ? 'Membros da Elite (Aprovados)' : 
                'Usuários Arquivados';
  
  const icon = type === 'PENDING' ? <Users className="w-12 h-12 text-zinc-800 mx-auto" /> : 
               type === 'APPROVED' ? <Shield className="w-12 h-12 text-zinc-800 mx-auto" /> : 
               <Archive className="w-12 h-12 text-zinc-800 mx-auto" />;

  const emptyMsg = type === 'PENDING' ? 'Nenhum usuário aguardando aprovação!' : 
                   type === 'APPROVED' ? 'Nenhum usuário aprovado no sistema!' : 
                   'Nenhum usuário arquivado.';

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-black uppercase tracking-tight">{title}</h3>
      <div className="space-y-1">
        {type === 'PENDING' ? (
          <>
            <ListHeader columns={['USUÁRIO', 'EMAIL', 'AÇÕES']} gridClass="grid-cols-[1.5fr_1.5fr_200px]" />
            {users.map(u => (
              <PendingUserRow
                key={u.uid}
                user={u}
                onApprove={(id: string) => handleUserApproval?.(id, true)}
                onArchive={() => handleArchiveUser?.(u.uid, true)}
                onRemove={handleDeleteUser}
              />
            ))}
          </>
        ) : type === 'APPROVED' ? (
          <>
            <ListHeader columns={['DATA', 'USUÁRIO/IDENTIDADE', 'DADOS DE ACESSO', 'CARGO ATUAL', 'AÇÕES']} gridClass="grid-cols-[100px_1.5fr_1.5fr_1fr_200px]" />
            {users.map(u => (
              <ApprovedUserRow
                key={u.uid}
                user={u}
                onRoleUpdate={handleUpdateUserRole}
                onArchive={() => handleArchiveUser?.(u.uid, true)}
                onRemove={handleDeleteUser}
              />
            ))}
          </>
        ) : (
          <>
            <ListHeader columns={['USUÁRIO', 'EMAIL', 'AÇÕES']} gridClass="grid-cols-[1.5fr_1.5fr_200px]" />
            {users.map(u => (
              <div key={u.uid} className="grid grid-cols-[1.5fr_1.5fr_200px] gap-4 items-center bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/50">
                <span className="font-black text-sm uppercase text-white">{u.displayName}</span>
                <span className="text-xs font-bold text-zinc-500">{u.email}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleArchiveUser?.(u.uid, false)} className="px-4 py-2 bg-emerald-500/10 text-emerald-500 font-black rounded-xl text-[10px] hover:bg-emerald-500 hover:text-black transition-all">RESTAURAR</button>
                  <button onClick={() => handleDeleteUser?.(u.uid)} className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </>
        )}
        
        {users.length === 0 && (
          <div className="py-20 text-center space-y-4 border border-dashed border-zinc-900 rounded-[40px]">
            {icon}
            <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">{emptyMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
};
