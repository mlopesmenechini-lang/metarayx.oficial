import React from 'react';
import { 
  Check, RefreshCw, Zap, Camera, TrendingUp, 
  Trash2, AlertCircle, ShieldCheck,
  User as UserIcon, Crown, Share2
} from 'lucide-react';
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
  const addSocial = (platform: 'tiktok' | 'instagram' | 'youtube') => {
    if (platform === 'tiktok') setProfileTiktok([...profileTiktok, '@']);
    if (platform === 'instagram') setProfileInstagram([...profileInstagram, '@']);
    if (platform === 'youtube') setProfileYoutube([...profileYoutube, '@']);
  };

  const removeSocial = (platform: 'tiktok' | 'instagram' | 'youtube', index: number) => {
    if (platform === 'tiktok') setProfileTiktok(profileTiktok.filter((_, i) => i !== index));
    if (platform === 'instagram') setProfileInstagram(profileInstagram.filter((_, i) => i !== index));
    if (platform === 'youtube') setProfileYoutube(profileYoutube.filter((_, i) => i !== index));
  };

  const updateSocial = (platform: 'tiktok' | 'instagram' | 'youtube', index: number, val: string) => {
    const newVal = '@' + val.replace('@', '');
    if (platform === 'tiktok') {
      const list = [...profileTiktok]; list[index] = newVal; setProfileTiktok(list);
    }
    if (platform === 'instagram') {
      const list = [...profileInstagram]; list[index] = newVal; setProfileInstagram(list);
    }
    if (platform === 'youtube') {
      const list = [...profileYoutube]; list[index] = newVal; setProfileYoutube(list);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight gold-gradient uppercase">Configurações</h2>
          <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Gerencie seu perfil e redes sociais</p>
        </div>
        <button onClick={handleUpdateProfile} disabled={isUpdatingProfile}
          className="px-10 py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-amber-500/10">
          {isUpdatingProfile ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          SALVAR ALTERAÇÕES
        </button>
      </div>

      <div className="flex p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl w-full">
        <button onClick={() => setSettingsTab('PROFILE')}
          className={`flex-1 py-3.5 rounded-xl font-black text-xs tracking-widest transition-all ${settingsTab === 'PROFILE' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
          MEU PERFIL
        </button>
        <button onClick={() => setSettingsTab('SOCIAL')}
          className={`flex-1 py-3.5 rounded-xl font-black text-xs tracking-widest transition-all ${settingsTab === 'SOCIAL' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>
          REDES SOCIAIS
        </button>
      </div>

      <div className="space-y-6">
        {settingsTab === 'PROFILE' ? (
          <div className="p-8 rounded-[40px] glass border border-zinc-800 space-y-8 relative overflow-hidden">
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
        ) : (
          <div className="p-10 rounded-[40px] glass border border-zinc-800 space-y-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5"><Share2 className="w-40 h-40" /></div>
            <div className="space-y-4 relative z-10">
              <div className="flex items-center gap-3 text-amber-500">
                <Zap className="w-5 h-5 shadow-amber-500/20" />
                <h3 className="text-xl font-black uppercase tracking-tight">Vincular Várias Contas</h3>
              </div>
              <p className="text-xs text-zinc-500 font-bold leading-relaxed">Você pode cadastrar múltiplos perfis (@) para cada rede social. Isso permite que você envie vídeos de diferentes contas suas.</p>
            </div>

            <div className="space-y-12 relative z-10">
              {/* TikTok */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-amber-500" /> Contas TikTok</label>
                  <button onClick={() => addSocial('tiktok')} className="text-[10px] font-black text-amber-500 hover:text-amber-400 uppercase tracking-widest flex items-center gap-1 transition-colors">+ Adicionar Perfil</button>
                </div>
                <div className="space-y-3">
                  {profileTiktok.map((val, idx) => (
                    <div key={idx} className="relative group animate-in slide-in-from-left-2 duration-300">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-sm">@</span>
                      <input type="text" value={val.replace('@', '')} onChange={(e) => updateSocial('tiktok', idx, e.target.value)}
                        placeholder="seu_usuario" className="w-full bg-black border border-zinc-800 rounded-2xl py-5 pl-12 pr-14 text-sm font-black focus:border-amber-500 outline-none transition-all" />
                      <button onClick={() => removeSocial('tiktok', idx)} className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-zinc-700 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {profileTiktok.length === 0 && (
                    <div onClick={() => addSocial('tiktok')} className="py-8 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-500/30 transition-all group">
                      <Zap className="w-5 h-5 text-zinc-800 group-hover:text-amber-500/50" />
                      <p className="text-[10px] font-black text-zinc-700 group-hover:text-amber-500/50 uppercase tracking-widest">Nenhuma conta TikTok vinculada</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Instagram */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Camera className="w-3.5 h-3.5 text-pink-500" /> Contas Instagram</label>
                  <button onClick={() => addSocial('instagram')} className="text-[10px] font-black text-pink-500 hover:text-pink-400 uppercase tracking-widest flex items-center gap-1 transition-colors">+ Adicionar Perfil</button>
                </div>
                <div className="space-y-3">
                  {profileInstagram.map((val, idx) => (
                    <div key={idx} className="relative group animate-in slide-in-from-left-2 duration-300">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-sm">@</span>
                      <input type="text" value={val.replace('@', '')} onChange={(e) => updateSocial('instagram', idx, e.target.value)}
                        placeholder="seu_perfil" className="w-full bg-black border border-zinc-800 rounded-2xl py-5 pl-12 pr-14 text-sm font-black focus:border-pink-500 outline-none transition-all" />
                      <button onClick={() => removeSocial('instagram', idx)} className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-zinc-700 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {profileInstagram.length === 0 && (
                    <div onClick={() => addSocial('instagram')} className="py-8 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-pink-500/30 transition-all group">
                      <Camera className="w-5 h-5 text-zinc-800 group-hover:text-pink-500/50" />
                      <p className="text-[10px] font-black text-zinc-700 group-hover:text-pink-500/50 uppercase tracking-widest">Nenhuma conta Instagram vinculada</p>
                    </div>
                  )}
                </div>
              </div>

              {/* YouTube */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-red-500" /> Canais YouTube</label>
                  <button onClick={() => addSocial('youtube')} className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1 transition-colors">+ Adicionar Canal</button>
                </div>
                <div className="space-y-3">
                  {profileYoutube.map((val, idx) => (
                    <div key={idx} className="relative group animate-in slide-in-from-left-2 duration-300">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-sm">@</span>
                      <input type="text" value={val.replace('@', '')} onChange={(e) => updateSocial('youtube', idx, e.target.value)}
                        placeholder="seu_canal" className="w-full bg-black border border-zinc-800 rounded-2xl py-5 pl-12 pr-14 text-sm font-black focus:border-red-500 outline-none transition-all" />
                      <button onClick={() => removeSocial('youtube', idx)} className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-zinc-700 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {profileYoutube.length === 0 && (
                    <div onClick={() => addSocial('youtube')} className="py-8 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-red-500/30 transition-all group">
                      <TrendingUp className="w-5 h-5 text-zinc-800 group-hover:text-red-500/50" />
                      <p className="text-[10px] font-black text-zinc-700 group-hover:text-red-500/50 uppercase tracking-widest">Nenhum canal YouTube vinculado</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-4">
              <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-[10px] text-amber-500/70 font-bold leading-relaxed uppercase tracking-wide">
                Importante: Você pode adicionar múltiplos perfis, mas lembre-se que cada vídeo postado deve originar-se de um desses perfis cadastrados para ser validado.
              </p>
            </div>
          </div>
        )}

        <div className="p-8 rounded-3xl bg-zinc-950/50 border border-zinc-900 flex items-start gap-5">
          <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-zinc-600" />
          </div>
          <p className="text-xs text-zinc-500 font-medium leading-relaxed">
            Mantenha suas contas vinculadas atualizadas. O MetaRayx Hub realiza verificações periódicas para garantir a integridade dos dados das competições.
          </p>
        </div>
      </div>
    </div>
  );
};
