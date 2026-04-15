import React from 'react';
import { 
  RefreshCw, 
  ShieldCheck 
} from 'lucide-react';
import { UserRole } from '../../types';

interface AcessosTabProps {
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
}

export const AcessosTab: React.FC<AcessosTabProps> = ({
  newUserRole,
  setNewUserRole,
  newUserName,
  setNewUserName,
  newUserEmail,
  setNewUserEmail,
  newUserPass,
  setNewUserPass,
  handleCreateUser,
  creatingUser,
}) => {
  return (
    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl max-w-xl mx-auto w-full">
      <h3 className="text-xl font-black uppercase mb-2">Criar Novo Funcionário/Acesso</h3>
      <p className="text-xs font-bold text-zinc-500 mb-6">Crie um acesso direto para Gestores, Administradores ou Usuários sem sair da sua conta atual.</p>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-black text-zinc-500 uppercase ml-2 mb-1 block">TIPO DE CARGO</label>
          <select
            value={newUserRole}
            onChange={e => setNewUserRole(e.target.value as any)}
            className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl focus:border-amber-500 outline-none transition-all font-bold text-sm text-zinc-300"
          >
            <option value="user">👤 Usuário Comum (Criador de Conteúdo)</option>
            <option value="auditor">🔍 Gestor — Controle de Campanhas</option>
            <option value="administrativo">🏢 Administrativo — Gestão + Financeiro + Acesso como usuário</option>
            <option value="admin">👑 Administrador (Diretoria) — Acesso total</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-black text-zinc-500 uppercase ml-2 mb-1 block">NOME DO USUÁRIO</label>
          <input
            type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)}
            placeholder="Nome do integrante"
            className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl focus:border-amber-500 outline-none transition-all font-bold text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-black text-zinc-500 uppercase ml-2 mb-1 block">EMAIL (LOGIN)</label>
          <input
            type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)}
            placeholder="acesso@metarayx.com.br"
            className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl focus:border-amber-500 outline-none transition-all font-bold text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-black text-zinc-500 uppercase ml-2 mb-1 block">SENHA</label>
          <input
            type="text" value={newUserPass} onChange={e => setNewUserPass(e.target.value)}
            placeholder="No mínimo 6 caracteres"
            className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl focus:border-amber-500 outline-none transition-all font-bold text-sm"
          />
        </div>

        <button
          onClick={handleCreateUser}
          disabled={creatingUser}
          className="w-full mt-6 flex justify-center items-center gap-2 gold-bg text-black font-black uppercase tracking-widest py-4 rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50"
        >
          {creatingUser ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
          {creatingUser ? 'CRIANDO...' : 'REGISTRAR ACESSO NO BANCO DE DADOS'}
        </button>
      </div>
    </div>
  );
};
