import React, { useState } from 'react';
import { 
  Check, RefreshCw, Zap, Camera, TrendingUp, 
  Trash2, AlertCircle, ShieldCheck,
  User as UserIcon, Crown, Share2, Plus, X, ChevronRight, Pencil, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';

interface SettingsViewProps {
  user: User;
  profileName: string;
  setProfileName: (val: string) => void;
  profileTiktok: string[];
  setProfileTiktok: (val: string[]) => void;
  profileInstagram: string[];
  setProfileInstagram: (val: string[]) => void;
  profileYoutube: string[];
  setProfileYoutube: (val: string[]) => void;
  profilePhoto: string;
  handleProfilePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUpdateProfile: () => void;
  isUpdatingProfile: boolean;
  settingsTab: 'PROFILE' | 'SOCIAL';
  setSettingsTab: (val: 'PROFILE' | 'SOCIAL') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user, profileName, setProfileName,
  profileTiktok, setProfileTiktok,
  profileInstagram, setProfileInstagram,
  profileYoutube, setProfileYoutube,
  profilePhoto, handleProfilePhotoUpload,
  handleUpdateProfile, isUpdatingProfile,
  settingsTab, setSettingsTab
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAccountPlatform, setNewAccountPlatform] = useState<'instagram' | 'tiktok' | 'youtube'>('instagram');
  const [newAccountUsername, setNewAccountUsername] = useState('');

  const handleAddAccount = () => {
    if (!newAccountUsername.trim()) return;
    
    const formattedUsername = '@' + newAccountUsername.replace('@', '').trim();
    
    if (newAccountPlatform === 'tiktok') {
      if (!profileTiktok.includes(formattedUsername)) {
        setProfileTiktok([...profileTiktok, formattedUsername]);
      }
    } else if (newAccountPlatform === 'instagram') {
      if (!profileInstagram.includes(formattedUsername)) {
        setProfileInstagram([...profileInstagram, formattedUsername]);
      }
    } else if (newAccountPlatform === 'youtube') {
      if (!profileYoutube.includes(formattedUsername)) {
        setProfileYoutube([...profileYoutube, formattedUsername]);
      }
    }
    
    setNewAccountUsername('');
    setIsModalOpen(false);
  };

  const removeSocial = (platform: 'tiktok' | 'instagram' | 'youtube', username: string) => {
    if (platform === 'tiktok') setProfileTiktok(profileTiktok.filter(u => u !== username));
    if (platform === 'instagram') setProfileInstagram(profileInstagram.filter(u => u !== username));
    if (platform === 'youtube') setProfileYoutube(profileYoutube.filter(u => u !== username));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 px-4 md:px-0">
      {/* Tab Switcher */}
      <div className="flex p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md mx-auto md:mx-0">
        <button onClick={() => setSettingsTab('PROFILE')}
          className={`flex-1 py-3.5 rounded-xl font-black text-xs tracking-widest transition-all ${settingsTab === 'PROFILE' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
          MEU PERFIL
        </button>
        <button onClick={() => setSettingsTab('SOCIAL')}
          className={`flex-1 py-3.5 rounded-xl font-black text-xs tracking-widest transition-all ${settingsTab === 'SOCIAL' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
          REDES SOCIAIS
        </button>
      </div>

      {settingsTab === 'PROFILE' ? (
        <div className="space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-3xl font-black tracking-tight gold-gradient uppercase">Meu Perfil</h2>
              <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Gerencie suas informações pessoais</p>
            </div>
            <button onClick={handleUpdateProfile} disabled={isUpdatingProfile}
              className="px-10 py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-amber-500/10">
              {isUpdatingProfile ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              SALVAR ALTERAÇÕES
            </button>
          </div>

          <div className="p-8 rounded-[40px] glass border border-zinc-800 space-y-8 relative overflow-hidden max-w-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <UserIcon className="w-40 h-40" />
            </div>
            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
              <div className="relative group">
                <div className="w-32 h-32 rounded-[40px] border-4 border-zinc-900 shadow-2xl overflow-hidden relative">
                  <img src={profilePhoto || user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="" />
                  <label htmlFor="profile-photo-upload" className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="w-8 h-8 text-amber-500" />
                    <input type="file" id="profile-photo-upload" className="hidden" accept="image/*" onChange={handleProfilePhotoUpload} />
                  </label>
                </div>
              </div>
              <div className="flex-1 space-y-4 w-full">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <UserIcon className="w-3 h-3" /> Seu Nome de Exibição
                  </label>
                  <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl py-5 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all shadow-inner"
                    placeholder="Seu nome no Hub" />
                </div>
                <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">E-mail de Login</p>
                  <p className="font-bold text-zinc-300">{user.email}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-8 border-t border-zinc-800 relative z-10">
              <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800/50 group hover:border-amber-500/30 transition-all">
                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1 flex items-center gap-2">
                  <Crown className="w-3 h-3 text-amber-500" /> Cargo Atual
                </p>
                <p className="font-black text-amber-500 uppercase text-xs">{user.role}</p>
              </div>
              <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800/50">
                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Identificador #ID</p>
                <p className="font-bold text-zinc-300 text-xs font-mono">{user.uid.substr(0, 12).toUpperCase()}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Header Social */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-3xl font-black tracking-tight text-white uppercase">Minhas Contas</h2>
              <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Gerencie suas contas de redes sociais para competir</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-8 py-4 bg-[#00D1FF] text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#00D1FF]/20"
            >
              <Plus className="w-5 h-5" />
              ADICIONAR CONTA
            </button>
          </div>

          {/* Platform Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-zinc-900/30 border border-zinc-800 p-8 rounded-[40px] flex flex-col items-center justify-center text-center space-y-4 hover:border-pink-500/30 transition-all group">
              <div className="w-16 h-16 rounded-[24px] bg-pink-500/10 flex items-center justify-center text-pink-500 mb-2">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Instagram</p>
                <p className="text-4xl font-black text-white">{profileInstagram.length}</p>
              </div>
            </div>

            <div className="bg-zinc-900/30 border border-zinc-800 p-8 rounded-[40px] flex flex-col items-center justify-center text-center space-y-4 hover:border-amber-500/30 transition-all group">
              <div className="w-16 h-16 rounded-[24px] bg-amber-500/10 flex items-center justify-center text-amber-500 mb-2">
                <Zap className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">TikTok</p>
                <p className="text-4xl font-black text-white">{profileTiktok.length}</p>
              </div>
            </div>

            <div className="bg-zinc-900/30 border border-zinc-800 p-8 rounded-[40px] flex flex-col items-center justify-center text-center space-y-4 hover:border-red-500/30 transition-all group">
              <div className="w-16 h-16 rounded-[24px] bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">YouTube</p>
                <p className="text-4xl font-black text-white">{profileYoutube.length}</p>
              </div>
            </div>
          </div>

          {/* Accounts List */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="w-4 h-4 text-pink-500" />
              <h4 className="text-sm font-black text-zinc-500 uppercase tracking-widest">Instagram</h4>
              <span className="text-[10px] font-bold text-zinc-700 bg-zinc-900 px-2 py-0.5 rounded-md">{profileInstagram.length}</span>
            </div>
            {profileInstagram.map((username, idx) => (
              <div key={`ig-${idx}`} className="group bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-3xl flex items-center justify-between hover:border-zinc-700 transition-all">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-pink-500">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight">{username}</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1">
                       Vínculo verificado <Check className="w-3 h-3 text-emerald-500" />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                   <button 
                    onClick={() => removeSocial('instagram', username)}
                    className="p-3 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                   >
                     <Trash2 className="w-5 h-5" />
                   </button>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 mb-4 pt-6">
              <Zap className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-black text-zinc-500 uppercase tracking-widest">TikTok</h4>
              <span className="text-[10px] font-bold text-zinc-700 bg-zinc-900 px-2 py-0.5 rounded-md">{profileTiktok.length}</span>
            </div>
            {profileTiktok.map((username, idx) => (
              <div key={`tt-${idx}`} className="group bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-3xl flex items-center justify-between hover:border-zinc-700 transition-all">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-500">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight">{username}</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1">
                       Vínculo verificado <Check className="w-3 h-3 text-emerald-500" />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                   <button 
                    onClick={() => removeSocial('tiktok', username)}
                    className="p-3 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                   >
                     <Trash2 className="w-5 h-5" />
                   </button>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 mb-4 pt-6">
              <TrendingUp className="w-4 h-4 text-red-500" />
              <h4 className="text-sm font-black text-zinc-500 uppercase tracking-widest">YouTube</h4>
              <span className="text-[10px] font-bold text-zinc-700 bg-zinc-900 px-2 py-0.5 rounded-md">{profileYoutube.length}</span>
            </div>
            {profileYoutube.map((username, idx) => (
              <div key={`yt-${idx}`} className="group bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-3xl flex items-center justify-between hover:border-zinc-700 transition-all">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-red-500">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight">{username}</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1">
                       Vínculo verificado <Check className="w-3 h-3 text-emerald-500" />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                   <button 
                    onClick={() => removeSocial('youtube', username)}
                    className="p-3 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                   >
                     <Trash2 className="w-5 h-5" />
                   </button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleUpdateProfile} disabled={isUpdatingProfile}
            className="w-full py-6 gold-bg text-black font-black rounded-2xl hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-2xl shadow-amber-500/10 mt-12">
            {isUpdatingProfile ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            SALVAR TODAS AS CONFIGURAÇÕES
          </button>
        </div>
      )}

      {/* Nova Conta Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-zinc-950 rounded-[40px] border border-zinc-800/50 shadow-2xl overflow-hidden p-8"
            >
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center">
                        <Plus className="w-6 h-6 text-white" />
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Nova Conta</h3>
                        <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Adicione uma conta de rede social</p>
                     </div>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-500 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
               </div>

               <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">PLATAFORMA</label>
                    <select 
                      value={newAccountPlatform}
                      onChange={(e) => setNewAccountPlatform(e.target.value as any)}
                      className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold text-white focus:border-[#00D1FF] outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="youtube">YouTube</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">USERNAME</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-sm">@</span>
                      <input 
                        type="text" 
                        value={newAccountUsername}
                        onChange={(e) => setNewAccountUsername(e.target.value)}
                        placeholder="seu_usuario" 
                        className="w-full bg-black border border-zinc-800 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold text-white focus:border-[#00D1FF] outline-none transition-all shadow-inner" 
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 bg-zinc-900 text-zinc-400 font-black rounded-2xl hover:bg-zinc-800 transition-all text-xs uppercase tracking-widest"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleAddAccount}
                      className="flex-1 py-4 bg-[#00D1FF] text-black font-black rounded-2xl hover:scale-[1.02] transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      ADICIONAR
                    </button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
