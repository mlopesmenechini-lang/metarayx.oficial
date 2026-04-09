import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  auth, db, googleProvider, signInWithPopup, signOut,
  onSnapshot, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit,
  OperationType, handleFirestoreError, createUserWithEmailAndPassword, signInWithEmailAndPassword, addDoc, serverTimestamp, onAuthStateChanged, writeBatch
} from './firebase';

import { User, Post, Season, Announcement, Platform, PostStatus, Competition, CompetitionRegistration, UserRole, Transaction, Suggestion } from './types';
import {
  LayoutDashboard, Trophy, Send, History, Settings, LogOut,
  ShieldCheck, AlertCircle, CheckCircle2, XCircle, Clock,
  TrendingUp, Users, Zap, Calendar, MessageSquare, Menu, X, ChevronLeft, ExternalLink,
  Mail, Lock, User as UserIcon, Eye, EyeOff, Loader2, RefreshCw, Crown, Trash2, Plus,
  Heart, Share2, Bookmark, Bell, Check, Camera, BarChart3, ArrowLeft, BookOpen, Shield, Star, ChevronRight, Target,
  Award, UserX, Sparkles, CreditCard, Coins, DollarSign, Info, Archive, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { syncViewsWithApify, syncSinglePostWithApify, updateUserMetrics, repairAllUserMetrics } from './services/apifyService';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth as getSecondaryAuth, createUserWithEmailAndPassword as createSecondaryUser, signOut as signSecondaryOut } from 'firebase/auth';

const sanitizeString = (text: string) => {
  if (typeof text !== 'string') return text;
  return text
    .replace(/Ã¡/g, 'á').replace(/Ã£/g, 'ã').replace(/Ã§/g, 'ç').replace(/Ãµ/g, 'õ')
    .replace(/Ã©/g, 'é').replace(/Ãª/g, 'ê').replace(/Ã³/g, 'ó').replace(/Ã­/g, 'í')
    .replace(/TÃ-tulo/g, 'Título').replace(/Âº/g, 'º').replace(/Ãº/g, 'ú').replace(/Ã¢/g, 'â')
    .replace(/Ã\x8D/g, 'Í').replace(/Ã\x87/g, 'Ç').replace(/Ã\x95/g, 'Õ').replace(/Ã\x81/g, 'Á')
    .replace(/Ã\x89/g, 'É').replace(/Ã\x93/g, 'Ó').replace(/Ã\x8A/g, 'Ê').replace(/Ã\x9A/g, 'Ú')
    .replace(/ANÃLISE/g, 'ANÁLISE').replace(/CONCLUÃDO/g, 'CONCLUÍDO').replace(/UsuÃ¡rio/g, 'Usuário')
    .replace(/Ã€/g, 'À').replace(/AÃ§Ãµes/g, 'Ações').replace(/USUÃ¡RIOS/g, 'USUÁRIOS')
    .replace(/USUÃ¡RIO/g, 'USUÁRIO').replace(/NÃ£o/g, 'Não').replace(/Ã-/g, 'í');
};

const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    // Preserve Firestore Timestamps and other special objects
    if (typeof obj.toDate === 'function') return obj;
    
    // Process plain objects
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = sanitizeObject(obj[key]);
    }
    return newObj;
  }
  return obj;
};
import fbConfig from './firebase-applet-config.json';

const InfoTooltip = ({ text }: { text: string }) => {
  return (
    <div className="group relative inline-block ml-1.5 align-middle">
      <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-amber-500 transition-colors cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-[100]">
        <div className="bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-300 p-3 rounded-2xl shadow-2xl backdrop-blur-xl leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-800" />
        </div>
      </div>
    </div>
  );
};

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorMsg: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMsg: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-center p-6">
          <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-3xl flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black mb-2">OPS! ALGO DEU ERRADO</h1>
          <p className="text-zinc-400 max-w-xs mb-8 text-sm">
            {this.state.errorMsg}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 gold-bg text-black font-black rounded-xl hover:scale-105 transition-all"
          >
            RECARREGAR HUB
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const WalletView = ({ user, competitions, showBalances }: { user: User, competitions: Competition[], showBalances: boolean }) => {
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
      alert('✅ Chave PIX salva com sucesso!');
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

  // Transações filtradas pela competição selecionada
  const compFiltered = useMemo(() => {
    if (!selectedCompId) return transactions;
    return transactions.filter(t => t.competitionId === selectedCompId);
  }, [transactions, selectedCompId]);

  // Aplica filtro de período sobre transações já filtradas
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

  // Total pago (repasses já realizados) para a competição filtrada
  const totalPago = useMemo(() => {
    if (selectedCompId) {
      return user?.competitionStats?.[selectedCompId]?.paidTotal || 0;
    }
    return user?.lifetimeEarnings || 0;
  }, [user, selectedCompId]);

  // Ganhos creditados ainda não pagos
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
            {/* Lifetime Item */}
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

            {/* Pending Balance Item */}
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

        {/* PIX Section */}
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
            <button onClick={() => setFilter('month')} className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${filter === 'month' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>MÊS</button>
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
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest inline-block border border-amber-500/20">PRÊMIO CONTABILIZADO</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest inline-block border border-emerald-500/20">REPASSE RECEBIDO</span>
                    )}
                    <span className="text-[10px] font-bold text-zinc-600 font-mono tracking-widest uppercase">ID: {t.id}</span>
                  </div>
                  <h4 className="font-black text-sm uppercase tracking-tight text-zinc-200">
                    {t.description || (t.status === 'credit' ? 'Premiação por desempenho' : 'Pagamento via PIX')}
                  </h4>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    {new Date(t.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} às {new Date(t.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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

const AuthScreen = ({ onLoginSuccess }: { onLoginSuccess: (u: User) => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('Erro de conexão ou Provedor Google não habilitado no Firebase Console.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const isAdminEmail = email === 'matheusmenechini18@gmail.com' || email === 'hypedosmemes@gmail.com';
        const newUser: User = {
          uid: cred.user.uid,
          displayName: name || 'Anon',
          email: email,
          role: isAdminEmail ? 'admin' : 'user',
          isApproved: isAdminEmail,
          balance: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalSaves: 0,
          totalPosts: 0,
          dailyViews: 0,
          dailyLikes: 0,
          dailyComments: 0,
          dailyShares: 0,
          dailySaves: 0,
          dailyPosts: 0
        };
        await setDoc(doc(db, 'users', cred.user.uid), newUser);
        onLoginSuccess(newUser);
      }
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('Erro de conexão ou Provedor E-mail/Senha não habilitado no Firebase Console.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-black px-4 overflow-y-auto py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 gold-bg rounded-3xl flex items-center justify-center shadow-2xl">
              <Zap className="w-10 h-10 text-black" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black gold-gradient tracking-tighter uppercase">MetaRayx Hub</h1>
            <p className="text-zinc-500 font-bold text-sm uppercase tracking-widest">Hub de Criadores</p>
          </div>
        </div>

        <div className="glass p-8 rounded-[32px] border border-zinc-800/50 space-y-6">
          <div className="flex p-1 bg-zinc-900 rounded-2xl">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${isLogin ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'}`}
            >
              LOGIN
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${!isLogin ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500'}`}
            >
              CADASTRO
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest ml-1">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    type="text"
                    placeholder="Seu nome"
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="seu@email.com"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="********"
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase text-center">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full py-4 gold-bg text-black font-black rounded-2xl hover:scale-[1.02] transition-all shadow-xl flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? 'ENTRAR NO HUB' : 'CRIAR CONTA'}
            </button>
          </form>

          <div className="relative flex items-center gap-4">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-[10px] text-zinc-500 font-black">OU</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full py-4 bg-white text-black font-black rounded-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="" />
            CONTINUAR COM GOOGLE
          </button>
        </div>
        <p className="text-center text-[10px] text-zinc-600 font-black tracking-widest uppercase">Acesso Restrito a Membros Autorizados</p>
      </motion.div>
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm
      ${active ? 'gold-bg text-black shadow-lg shadow-amber-500/20' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'}
    `}
  >
    {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
    {label}
  </button>
);

const Dashboard = ({ user, announcements, rankings, competitions, registrations, posts, showBalances }: {
  user: User,
  announcements: Announcement[],
  rankings: User[],
  competitions: Competition[],
  registrations: CompetitionRegistration[],
  posts: Post[],
  showBalances: boolean
}) => {
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [acceptedRules, setAcceptedRules] = useState(false);

  const handleRegister = async (compId: string) => {
    if (!acceptedRules) {
      alert('Você precisa aceitar as regras para participar!');
      return;
    }
    try {
      const existingReg = registrations.find(r => r.competitionId === compId && r.userId === user.uid);
      if (existingReg && existingReg.status === 'rejected') {
        const regRef = doc(db, 'competition_registrations', existingReg.id);
        await updateDoc(regRef, {
          status: 'pending',
          timestamp: Date.now()
        });
        alert('Nova solicitação enviada! Aguarde a aprovação da diretoria.');
      } else {
        const newReg: Omit<CompetitionRegistration, 'id'> = {
          competitionId: compId,
          userId: user.uid,
          userName: user.displayName,
          userEmail: user.email,
          status: 'pending',
          acceptedRules: true,
          timestamp: Date.now()
        };
        await addDoc(collection(db, 'competition_registrations'), newReg);
        alert('Solicitação de inscrição enviada! Aguarde a aprovação da diretoria.');
      }
      setSelectedComp(null);
      setAcceptedRules(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'competition_registrations');
    }
  };

  const sortedMonthly = useMemo(() => {
    return [...rankings].sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0)).slice(0, 3);
  }, [rankings]);

  // Agregação por plataforma com base nos posts do usuário
  const platformStats = useMemo(() => {
    const platforms = ['tiktok', 'youtube', 'instagram'] as const;
    return platforms.map(platform => {
      const platformPosts = posts.filter(p => p.platform === platform);
      const views = platformPosts.reduce((acc, p) => acc + (p.views || 0), 0);
      const likes = platformPosts.reduce((acc, p) => acc + (p.likes || 0), 0);
      const comments = platformPosts.reduce((acc, p) => acc + (p.comments || 0), 0);
      const count = platformPosts.length;
      return { platform, views, likes, comments, count };
    });
  }, [posts]);

  const maxViews = Math.max(...platformStats.map(p => p.views), 1);

  return (
    <div className="space-y-12 shrink-0">
      {/* 🚀 Cockpit Pessoal */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
              Bem-vindo(a), <span className="gold-gradient">{user.displayName.split(' ')[0]}</span>!
            </h1>
            <p className="text-zinc-400 font-bold mt-1 text-sm md:text-base">Métricas da sua performance geral no HUB.</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-black text-emerald-500 w-fit">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            CONTA ATIVA
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass shadow-2xl shadow-amber-500/5 hover:border-amber-500/50 transition-all border border-amber-500/20 p-6 rounded-[32px] relative group flex flex-col justify-between min-h-[140px]">
            <div className="absolute inset-0 overflow-hidden rounded-[32px] pointer-events-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-amber-500/20 transition-all" />
              <TrendingUp className="absolute -bottom-4 -right-4 w-24 h-24 text-amber-500/10 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest relative z-10 flex items-center">
              LUCRO ACUMULADO <InfoTooltip text="Total de ganhos que você já acumulou na plataforma até hoje." />
            </h3>
            <p className="text-2xl md:text-3xl font-black text-white relative z-10">R$ {showBalances ? (user.lifetimeEarnings || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '***'}</p>
          </div>

          <div className="glass border border-cyan-500/20 hover:border-cyan-500/50 transition-all p-6 rounded-[32px] relative group flex flex-col justify-between min-h-[140px]">
            <div className="absolute inset-0 overflow-hidden rounded-[32px] pointer-events-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-cyan-500/20 transition-all" />
              <Eye className="absolute -bottom-4 -right-4 w-24 h-24 text-cyan-500/10 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest relative z-10 flex items-center">
              TOTAL DE VIEWS <InfoTooltip text="Soma das visualizações de todos os seus vídeos aprovados e sincronizados." />
            </h3>
            <p className="text-2xl md:text-3xl font-black text-white relative z-10">{(user.totalViews || 0).toLocaleString()}</p>
          </div>

          <div className="glass border border-pink-500/20 hover:border-pink-500/50 transition-all p-6 rounded-[32px] relative group flex flex-col justify-between min-h-[140px]">
            <div className="absolute inset-0 overflow-hidden rounded-[32px] pointer-events-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-pink-500/20 transition-all" />
              <Heart className="absolute -bottom-4 -right-4 w-24 h-24 text-pink-500/10 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-[10px] font-black text-pink-500 uppercase tracking-widest relative z-10 flex items-center">
              TOTAL DE LIKES <InfoTooltip text="Soma das curtidas de todos os seus vídeos aprovados e sincronizados." />
            </h3>
            <p className="text-2xl md:text-3xl font-black text-white relative z-10">{(user.totalLikes || 0).toLocaleString()}</p>
          </div>

          <div className="glass border border-zinc-700/50 hover:border-zinc-500 transition-all p-6 rounded-[32px] relative group flex flex-col justify-between min-h-[140px]">
            <div className="absolute inset-0 overflow-hidden rounded-[32px] pointer-events-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-white/10 transition-all" />
              <Camera className="absolute -bottom-4 -right-4 w-24 h-24 text-white/5 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest relative z-10 flex items-center">
              VÍDEOS SINCRONIZADOS <InfoTooltip text="Quantidade de vídeos seus que já foram validados e processados pelo sistema." />
            </h3>
            <p className="text-2xl md:text-3xl font-black text-white relative z-10">{(user.totalPosts || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* 🎯 Foco Central: Competições */}
      {competitions.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-3">
              <Target className="w-6 h-6 text-amber-500" /> Foco Atual
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-black text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20 shadow-lg">
              <Zap className="w-3 h-3" /> COMPETIÇÕES
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {competitions.map(comp => {
              const compStatus = comp.status || (comp.isActive ? 'active' : 'inactive');
              const isLocked = compStatus === 'upcoming' || compStatus === 'inactive';

              return (
                <motion.div
                  key={comp.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`group relative h-64 rounded-[40px] overflow-hidden border ${isLocked ? 'border-zinc-900 shadow-none cursor-not-allowed opacity-80' : 'border-zinc-800 shadow-2xl cursor-pointer'}`}
                  onClick={() => {
                    if (!isLocked) {
                      setSelectedComp(comp);
                    }
                  }}
                >
                  <img src={comp.bannerUrl} className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${!isLocked && 'group-hover:scale-110'} ${compStatus === 'inactive' ? 'grayscale opacity-80' : ''}`} alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                  {isLocked && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                       <Lock className={`w-16 h-16 ${compStatus === 'upcoming' ? 'text-amber-500' : 'text-zinc-600'}`} />
                    </div>
                  )}

                  <div className="absolute inset-0 p-8 flex flex-col justify-end space-y-4">
                    <div className="space-y-1 relative z-10">
                      <h3 className="text-3xl font-black tracking-tighter uppercase leading-none">{comp.title}</h3>
                      <p className="text-zinc-300 text-xs font-bold line-clamp-2 max-w-md">{comp.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 relative z-10">
                      {comp.prizes.slice(0, 3).map((prize, idx) => (
                        <div key={idx} className={`flex items-center gap-2 backdrop-blur-md px-4 py-2 rounded-2xl border ${isLocked ? 'bg-black/50 border-white/5 opacity-50' : 'bg-white/10 border-white/10'}`}>
                          <Trophy className={`w-4 h-4 ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-zinc-300' : 'text-amber-700'}`} />
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-zinc-400 uppercase leading-none">{prize.label}</span>
                            <span className="text-xs font-black text-white">R$ {prize.value.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="absolute top-6 right-6 z-10">
                    {(() => {
                      if (compStatus === 'upcoming') {
                        return (
                          <div className="bg-amber-500 text-black px-4 py-1.5 rounded-full text-[10px] font-black shadow-xl uppercase tracking-widest">
                            EM BREVE
                          </div>
                        );
                      }
                      if (compStatus === 'inactive') {
                        return (
                          <div className="bg-zinc-800 text-zinc-400 px-4 py-1.5 rounded-full text-[10px] font-black shadow-xl uppercase tracking-widest">
                            FINALIZADA
                          </div>
                        );
                      }

                      const reg = registrations.find(r => r.competitionId === comp.id && r.userId === user.uid);
                      if (!reg) {
                        return (
                          <div className="bg-amber-500 text-black px-6 py-2 rounded-full text-xs font-black shadow-xl hover:scale-105 transition-all">
                            VER DETALHES
                          </div>
                        );
                      }
                      return (
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black shadow-xl ${reg.status === 'approved' ? 'bg-emerald-500 text-black' :
                            reg.status === 'rejected' ? 'bg-red-500 text-white' :
                              'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                          }`}>
                          {reg.status === 'approved' ? 'PARTICIPANDO' :
                            reg.status === 'rejected' ? 'RECUSADO' : 'AGUARDANDO APROVAÇÃO'}
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🏅 Competições e Pódio */}
      <div className="grid grid-cols-1 gap-6 items-start pb-10">
        
        {/* Elite do Mês */}
        <div className="glass border border-zinc-800 rounded-[40px] p-8">
          {sortedMonthly.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight uppercase">Elite do Mês</h2>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Global</p>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-black text-zinc-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  TEMPO REAL
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 items-end pt-10 pb-4">
                {/* 2nd Place */}
                {sortedMonthly[1] && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div className="absolute -top-4 -right-2 w-8 h-8 rounded-full bg-zinc-400 flex items-center justify-center border-2 border-black z-10">
                        <span className="text-[10px] font-black text-black">2º</span>
                      </div>
                      <img src={sortedMonthly[1].photoURL || `https://ui-avatars.com/api/?name=${sortedMonthly[1].displayName}`} className="w-16 h-16 md:w-20 md:h-20 rounded-[32px] border-4 border-zinc-400/30 object-cover shadow-2xl" alt="" referrerPolicy="no-referrer" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs md:text-sm font-black truncate max-w-[90px]">@{sortedMonthly[1].displayName}</p>
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none">Views</span>
                        <span className="text-xs md:text-sm font-black text-cyan-400">{(sortedMonthly[1].totalViews || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full h-24 md:h-28 bg-gradient-to-t from-zinc-800/50 to-zinc-800/20 rounded-t-3xl border-x border-t border-zinc-800 flex flex-col items-center justify-start pt-4">
                      <div className="w-6 h-6 rounded-full bg-zinc-400/10 flex items-center justify-center"><Trophy className="w-3 h-3 text-zinc-400" /></div>
                    </div>
                  </motion.div>
                )}

                {/* 1st Place */}
                {sortedMonthly[0] && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 2, repeat: Infinity }} className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
                        <Crown className="w-8 h-8 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                      </motion.div>
                      <div className="absolute -top-4 -right-2 w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center border-2 border-black z-10 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                        <span className="text-xs font-black text-black">1º</span>
                      </div>
                      <img src={sortedMonthly[0].photoURL || `https://ui-avatars.com/api/?name=${sortedMonthly[0].displayName}`} className="w-20 h-20 md:w-28 md:h-28 rounded-[40px] border-4 border-amber-500 object-cover shadow-[0_0_40px_rgba(245,158,11,0.2)]" alt="" referrerPolicy="no-referrer" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm md:text-base font-black gold-gradient truncate max-w-[110px]">@{sortedMonthly[0].displayName}</p>
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none">Views</span>
                        <span className="text-sm md:text-lg font-black text-cyan-400">{(sortedMonthly[0].totalViews || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full h-32 md:h-36 bg-gradient-to-t from-amber-500/20 to-amber-500/5 rounded-t-[40px] border-x border-t border-amber-500/30 flex flex-col items-center justify-start pt-4 relative overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center relative z-10"><Trophy className="w-4 h-4 text-amber-500" /></div>
                    </div>
                  </motion.div>
                )}

                {/* 3rd Place */}
                {sortedMonthly[2] && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div className="absolute -top-4 -right-2 w-8 h-8 rounded-full bg-amber-800 flex items-center justify-center border-2 border-black z-10">
                        <span className="text-[10px] font-black text-white">3º</span>
                      </div>
                      <img src={sortedMonthly[2].photoURL || `https://ui-avatars.com/api/?name=${sortedMonthly[2].displayName}`} className="w-16 h-16 md:w-20 md:h-20 rounded-[32px] border-4 border-amber-800/30 object-cover shadow-2xl" alt="" referrerPolicy="no-referrer" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs md:text-sm font-black truncate max-w-[90px]">@{sortedMonthly[2].displayName}</p>
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none">Views</span>
                        <span className="text-xs md:text-sm font-black text-cyan-400">{(sortedMonthly[2].totalViews || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full h-20 md:h-24 bg-gradient-to-t from-amber-900/40 to-amber-900/10 rounded-t-3xl border-x border-t border-amber-900/30 flex flex-col items-center justify-start pt-4">
                      <div className="w-6 h-6 rounded-full bg-amber-900/20 flex items-center justify-center"><Trophy className="w-3 h-3 text-amber-800" /></div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center opacity-50">
              <Trophy className="w-12 h-12 text-zinc-700 mb-4" />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Ranking em apuração</p>
            </div>
          )}
        </div>


      </div>

      {/* Competition Details Modal */}
      <AnimatePresence>
        {selectedComp && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedComp(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass rounded-[40px] border border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="h-48 shrink-0 relative">
                <img src={selectedComp.bannerUrl} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
                <button
                  onClick={() => setSelectedComp(null)}
                  className="absolute top-6 right-6 p-2 rounded-full bg-black/50 text-white hover:bg-black transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-6 left-8">
                  <h3 className="text-3xl font-black uppercase tracking-tighter">{selectedComp.title}</h3>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Hashtags</p>
                    <p className="text-xs font-bold text-amber-500">{selectedComp.hashtags || 'Nenhuma'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Marcações</p>
                    <p className="text-xs font-bold text-amber-500">{selectedComp.mentions || 'Nenhuma'}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Bônus</p>
                    <p className="text-xs font-bold text-emerald-500">{selectedComp.bonuses || 'Nenhum'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400">Regras da Competição</h4>
                  <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-800/50 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-medium">
                    {selectedComp.rules || selectedComp.description}
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedComp.prizesMonthly && selectedComp.prizesMonthly.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400">Premiação Mensal (Tempo de Competição)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedComp.prizesMonthly.map((prize, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">
                                {prize.position}º
                              </div>
                              <span className="text-xs font-bold">{prize.label}</span>
                            </div>
                            <span className="text-sm font-black text-amber-500">R$ {prize.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedComp.prizesDaily && selectedComp.prizesDaily.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400">Premiação Diária</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedComp.prizesDaily.map((prize, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">
                                {prize.position}º
                              </div>
                              <span className="text-xs font-bold">{prize.label}</span>
                            </div>
                            <span className="text-sm font-black text-cyan-500">R$ {prize.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedComp.prizesInstagram && selectedComp.prizesInstagram.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400">Premiação Instagram (Quantidade)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedComp.prizesInstagram.map((prize, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">
                                {prize.position}º
                              </div>
                              <span className="text-xs font-bold">{prize.label}</span>
                            </div>
                            <span className="text-sm font-black text-pink-500">R$ {prize.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!selectedComp.prizesDaily && !selectedComp.prizesMonthly && !selectedComp.prizesInstagram) && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400">Premiação</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedComp.prizes.map((prize, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">
                                {prize.position}º
                              </div>
                              <span className="text-xs font-bold">{prize.label}</span>
                            </div>
                            <span className="text-sm font-black text-amber-500">R$ {prize.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-8 bg-zinc-950 border-t border-zinc-900 space-y-6">
                {(() => {
                  const existingReg = registrations.find(r => r.competitionId === selectedComp.id && r.userId === user.uid);
                  if (!existingReg || existingReg.status === 'rejected') {
                    return (
                      <>
                        <label className="flex items-start gap-4 cursor-pointer group">
                          <div className="relative flex items-center mt-1">
                            <input
                              type="checkbox"
                              checked={acceptedRules}
                              onChange={(e) => setAcceptedRules(e.target.checked)}
                              className="peer h-5 w-5 appearance-none rounded border-2 border-zinc-800 bg-zinc-900 transition-all checked:border-amber-500 checked:bg-amber-500"
                            />
                            <Check className="absolute h-3.5 w-3.5 text-black opacity-0 transition-opacity peer-checked:opacity-100 left-0.5" />
                          </div>
                          <span className="text-xs font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors">
                            Eu li e aceito todas as regras e condições desta competição.
                          </span>
                        </label>
                        <button
                          onClick={() => handleRegister(selectedComp.id)}
                          disabled={!acceptedRules}
                          className={`w-full py-5 font-black rounded-2xl transition-all shadow-xl ${
                            acceptedRules 
                              ? 'gold-bg text-black hover:scale-[1.02] shadow-amber-500/20' 
                              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                          }`}
                        >
                          {existingReg?.status === 'rejected' ? 'SOLICITAR NOVAMENTE' : 'SOLICITAR INSCRIÇÃO'}
                        </button>
                      </>
                    );
                  }
                  return (
                    <div className="text-center py-2">
                      <p className="text-amber-500 font-black uppercase tracking-widest text-sm">
                        {existingReg.status === 'approved' 
                          ? 'Você já está participando desta competição' 
                          : 'Você já solicitou inscrição nesta competição'}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Seção: Performance por Rede + Elite Global */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-6">

        {/* Performance por Rede Social (2/3) */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase">Desempenho por Rede</h2>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Suas métricas por plataforma</p>
            </div>
          </div>

          {posts.length > 0 ? (
            <div className="space-y-4">
              {platformStats.map(({ platform, views, likes, comments, count }) => {
                const barWidth = maxViews > 0 ? Math.max((views / maxViews) * 100, count > 0 ? 4 : 0) : 0;
                const platformConfig = {
                  tiktok: {
                    label: 'TikTok',
                    emoji: '🎵',
                    color: 'from-pink-500 to-rose-500',
                    border: 'border-pink-500/20',
                    glow: 'shadow-pink-500/20',
                    text: 'text-pink-400',
                    bg: 'bg-pink-500/10',
                  },
                  youtube: {
                    label: 'YouTube',
                    emoji: '▶️',
                    color: 'from-red-500 to-orange-500',
                    border: 'border-red-500/20',
                    glow: 'shadow-red-500/20',
                    text: 'text-red-400',
                    bg: 'bg-red-500/10',
                  },
                  instagram: {
                    label: 'Instagram',
                    emoji: '📸',
                    color: 'from-purple-500 to-pink-500',
                    border: 'border-purple-500/20',
                    glow: 'shadow-purple-500/20',
                    text: 'text-purple-400',
                    bg: 'bg-purple-500/10',
                  },
                };
                const cfg = platformConfig[platform];
                const isLeader = views === maxViews && views > 0;

                return (
                  <motion.div
                    key={platform}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`glass border ${cfg.border} p-6 rounded-[28px] space-y-4 relative overflow-hidden`}
                  >
                    {isLeader && (
                      <div className="absolute top-3 right-4 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" /> Melhor desempenho
                      </div>
                    )}

                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl w-10 h-10 rounded-2xl ${cfg.bg} flex items-center justify-center`}>{cfg.emoji}</div>
                        <div>
                          <p className="font-black text-base">{cfg.label}</p>
                          <p className="text-[10px] text-zinc-500 font-bold">{count} vídeo{count !== 1 ? 's' : ''} sincronizado{count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-black ${count > 0 ? cfg.text : 'text-zinc-700'}`}>{views.toLocaleString()}</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">views</p>
                      </div>
                    </div>

                    {/* Barra de progresso */}
                    <div className="relative">
                      <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                          className={`h-full rounded-full bg-gradient-to-r ${cfg.color}`}
                        />
                      </div>
                    </div>

                    {/* Métricas secundárias */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-3 text-center`}>
                        <p className={`text-sm font-black ${cfg.text}`}>{likes.toLocaleString()}</p>
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">Likes</p>
                      </div>
                      <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-3 text-center`}>
                        <p className={`text-sm font-black ${cfg.text}`}>{comments.toLocaleString()}</p>
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">Comentários</p>
                      </div>
                      <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-3 text-center`}>
                        <p className={`text-sm font-black ${cfg.text}`}>{count > 0 ? Math.round(views / count).toLocaleString() : '—'}</p>
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">Média/vídeo</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center glass rounded-[32px] border border-zinc-800 text-center">
              <BarChart3 className="w-12 h-12 text-zinc-700 mb-4" />
              <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Nenhum vídeo sincronizado ainda</p>
              <p className="text-zinc-600 text-xs mt-2 font-bold">Envie seus links para começar a ver os dados</p>
            </div>
          )}
        </div>

        {/* Elite Global (1/3) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase">Elite Global</h2>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Top do HUB</p>
            </div>
          </div>
          <div className="glass border border-zinc-800/50 rounded-[32px] p-4 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            {[...rankings].sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0)).map((player, i) => {
              const isMe = player.uid === user.uid;
              const rankStyles = ['text-amber-400 border-amber-500/30 bg-amber-500/10','text-zinc-300 border-zinc-500/30 bg-zinc-500/10','text-orange-500 border-orange-700/30 bg-orange-700/10'];
              const badgeStyle = rankStyles[i] || 'text-zinc-500 border-zinc-800 bg-zinc-900/30';
              return (
                <motion.div key={player.uid} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${isMe ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-zinc-800/40'}`}
                >
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center text-[10px] font-black shrink-0 ${badgeStyle}`}>
                    {i === 0 ? <Crown className="w-3.5 h-3.5" /> : `${i + 1}º`}
                  </div>
                  <img src={player.photoURL || `https://ui-avatars.com/api/?name=${player.displayName}&background=random&bold=true`}
                    className={`w-9 h-9 rounded-xl object-cover shrink-0 ${isMe ? 'ring-2 ring-amber-500' : ''}`}
                    alt="" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black truncate ${isMe ? 'text-amber-400' : 'text-white'}`}>{isMe ? 'Você' : player.displayName}</p>
                    <p className="text-[10px] text-zinc-500 font-bold">{(player.totalViews || 0).toLocaleString()} views</p>
                  </div>
                  {i === 0 && <Trophy className="w-4 h-4 text-amber-500 shrink-0" />}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, sub, icon, color }: { title: string, value: string, sub: string, icon: React.ReactNode, color: 'amber' | 'emerald' | 'blue' | 'purple' }) => {
  const colors = {
    amber: 'bg-amber-500/20 text-amber-500 border-amber-500/20',
    emerald: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20',
    blue: 'bg-blue-500/20 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/20 text-purple-500 border-purple-500/20'
  };

  const glowColors = {
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500'
  };

  return (
    <div className="p-6 rounded-3xl glass relative overflow-hidden group border border-zinc-800/50">
      <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-10 blur-3xl transition-opacity group-hover:opacity-20 ${glowColors[color]}`} />
      <div className="relative z-10">
        <div className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center ${colors[color]}`}>
          {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
        </div>
        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-black mb-1">{value}</p>
        <p className="text-xs text-zinc-400 font-medium">{sub}</p>
      </div>
    </div>
  );
};

const normalizeUrl = (url: string) => {
  try {
    let clean = url.trim().toLowerCase();

    // YouTube
    if (clean.includes('youtube.com') || clean.includes('youtu.be')) {
      let videoId = '';
      if (clean.includes('v=')) {
        videoId = clean.split('v=')[1]?.split('&')[0]?.split('?')[0];
      } else if (clean.includes('/shorts/')) {
        videoId = clean.split('/shorts/')[1]?.split('?')[0];
      } else if (clean.includes('youtu.be/')) {
        videoId = clean.split('youtu.be/')[1]?.split('?')[0];
      }
      if (videoId) return `youtube:${videoId}`;
    }

    // TikTok
    if (clean.includes('tiktok.com')) {
      if (clean.includes('/video/')) {
        const videoId = clean.split('/video/')[1]?.split('?')[0]?.split('/')[0];
        if (videoId) return `tiktok:${videoId}`;
      }
      // For mobile links like vm.tiktok.com/XYZ, we have to stick to the URL for now 
      // as we can't resolve redirects client-side easily without a proxy
    }

    // Instagram
    if (clean.includes('instagram.com')) {
      const parts = clean.split('/');
      const idIndex = parts.findIndex(p => p === 'p' || p === 'reels' || p === 'reel') + 1;
      if (idIndex > 0) {
        const id = parts[idIndex]?.split('?')[0];
        if (id) return `instagram:${id}`;
      }
    }

    // Fallback standard cleanup
    return clean.split('?')[0].replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');
  } catch {
    return url.toLowerCase().trim();
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'RANKINGS' | 'POST' | 'HISTORY' | 'ADMIN' | 'SETTINGS' | 'WALLET' | 'SUGGESTIONS' | 'COMPETITIONS'>('DASHBOARD');
  const [selectedActiveCompId, setSelectedActiveCompId] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [rankings, setRankings] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [registrations, setRegistrations] = useState<CompetitionRegistration[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<User[]>([]);
  const [archivedUsers, setArchivedUsers] = useState<User[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [settings, setSettings] = useState<{ apifyKey: string; lastSync?: string; lastResync?: string }>({ apifyKey: '' });
  const [timerConfig, setTimerConfig] = useState<{ enabled: boolean; endTime: number | null; targetTime: string; message: string }>({
    enabled: false,
    endTime: null,
    targetTime: '20:15',
    message: ''
  });
  const isAdmin = user?.role === 'admin';
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [compToDelete, setCompToDelete] = useState<string | null>(null);
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [showBalances, setShowBalances] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [profileTiktok, setProfileTiktok] = useState<string[]>([]);
  const [profileInstagram, setProfileInstagram] = useState<string[]>([]);
  const [profileYoutube, setProfileYoutube] = useState<string[]>([]);
  const [profilePhoto, setProfilePhoto] = useState('');
  const [settingsTab, setSettingsTab] = useState<'PROFILE' | 'SOCIAL'>('PROFILE');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [compTitle, setCompTitle] = useState('');
  const [compRankingMetric, setCompRankingMetric] = useState<'views' | 'likes'>('views');
  const [compGoalTarget, setCompGoalTarget] = useState<number>(0);
  const [compGoalMetric, setCompGoalMetric] = useState<'views' | 'likes'>('views');
  const [compDesc, setCompDesc] = useState('');
  const [compRules, setCompRules] = useState('');
  const [compHashtags, setCompHashtags] = useState('');
  const [compMentions, setCompMentions] = useState('');
  const [compBonuses, setCompBonuses] = useState('');
  const [compInstaBonus, setCompInstaBonus] = useState('');
  const [compViewBonus, setCompViewBonus] = useState<number>(0);
  const [compStartDate, setCompStartDate] = useState('');
  const [compEndDate, setCompEndDate] = useState('');
  const [compBanner, setCompBanner] = useState('');
  const [compPrizes, setCompPrizes] = useState<{ position: number; value: number; label: string; }[]>([
    { position: 1, value: 0, label: '1º Lugar' },
    { position: 2, value: 0, label: '2º Lugar' },
    { position: 3, value: 0, label: '3º Lugar' }
  ]);
  const [compPositions, setCompPositions] = useState(3);
  const [compPositionsDaily, setCompPositionsDaily] = useState(3);
  const [compPrizesDaily, setCompPrizesDaily] = useState<{ position: number; value: number; label: string; }[]>([
    { position: 1, value: 0, label: '1º Diário' },
    { position: 2, value: 0, label: '2º Diário' },
    { position: 3, value: 0, label: '3º Diário' }
  ]);
  const [compPositionsMonthly, setCompPositionsMonthly] = useState(3);
  const [compPrizesMonthly, setCompPrizesMonthly] = useState<{ position: number; value: number; label: string; }[]>([
    { position: 1, value: 0, label: '1º Mensal' },
    { position: 2, value: 0, label: '2º Mensal' },
    { position: 3, value: 0, label: '3º Mensal' }
  ]);
  const [compPositionsInstagram, setCompPositionsInstagram] = useState(3);
  const [compPrizesInstagram, setCompPrizesInstagram] = useState<{ position: number; value: number; label: string; }[]>([
    { position: 1, value: 0, label: '1º Insta' },
    { position: 2, value: 0, label: '2º Insta' },
    { position: 3, value: 0, label: '3º Insta' }
  ]);
  const [isCreatingComp, setIsCreatingComp] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPass, setEditPass] = useState('');
  const [editRole, setEditRole] = useState<'user' | 'auditor' | 'administrativo' | 'admin'>('user');
  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [isCreatingAnn, setIsCreatingAnn] = useState(false);
  const [acknowledgedAnnouncements, setAcknowledgedAnnouncements] = useState<string[]>(() => {
    const saved = localStorage.getItem('acknowledgedAnnouncements');
    return saved ? JSON.parse(saved) : [];
  });
  const [suggestionMsg, setSuggestionMsg] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });
  const [rejectionModal, setRejectionModal] = useState<{ isOpen: boolean; postId: string; status: PostStatus }>({ isOpen: false, postId: '', status: 'rejected' });
  const [removalModal, setRemovalModal] = useState<{ isOpen: boolean; postId: string; reason: string; consent: boolean }>({ isOpen: false, postId: '', reason: '', consent: false });
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (user) {
      console.log('Current User State:', {
        uid: user.uid,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved
      });
    }
  }, [user]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (view === 'SETTINGS' && user) {
      setProfileName(user.displayName || '');
      setProfilePhoto(user.photoURL || '');
      
      // Handle potential legacy string or new array
      const normalizeSocial = (val: any) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        return [val]; // Convert single string to [string]
      };

      setProfileTiktok(normalizeSocial(user.tiktok));
      setProfileInstagram(normalizeSocial(user.instagram));
      setProfileYoutube(normalizeSocial(user.youtube));
    }
  }, [view, user]);

  // Auth Listener
  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Limpa listener anterior se houver
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      if (firebaseUser) {
        const timeout = setTimeout(() => {
          if (loading) {
            setLoadError('Tempo de conexão excedido. Verifique se o Database está ativo.');
          }
        }, 15000);

        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
            clearTimeout(timeout);
            if (docSnap.exists()) {
              const userData = docSnap.data() as User;
              setUser(userData);
              setProfileName(userData.displayName || '');
              setProfilePhoto(userData.photoURL || '');
            } else {
              // Lógica de Primeiro Admin
              const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
              const isFirstUser = usersSnap.empty;
              const isAdminEmail = firebaseUser.email === 'matheusmenechini18@gmail.com' || firebaseUser.email === 'hypedosmemes@gmail.com';

              const newUser: User = {
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName || 'USUÁRIO SEM NOME',
                email: firebaseUser.email || '',
                role: (isFirstUser || isAdminEmail) ? 'admin' : 'user',
                isApproved: (isFirstUser || isAdminEmail),
                balance: 0,
                totalViews: 0,
                totalLikes: 0,
                totalComments: 0,
                totalShares: 0,
                totalSaves: 0,
                totalPosts: 0,
                dailyViews: 0,
                dailyLikes: 0,
                dailyComments: 0,
                dailyShares: 0,
                dailySaves: 0,
                dailyPosts: 0,
                photoURL: firebaseUser.photoURL || undefined
              };
              await setDoc(userRef, newUser);
            }
            setLoading(false);
          }, (error) => {
            clearTimeout(timeout);
            console.error('Firestore Error:', error);
            setLoadError(`Erro ao carregar perfil: ${error.message}`);
            setLoading(false);
          });
        } catch (err: any) {
          clearTimeout(timeout);
          console.error('Auth logic error:', err);
          setLoadError(err.message);
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);


  // Real-time Data Listeners â€” dados públicos (carrega assim que autenticado)
  useEffect(() => {
    if (!user) return;

    // Rankings Listener (público â€” não depende de aprovação)
    const rankingsQuery = query(collection(db, 'users'), where('isApproved', '==', true));
    const unsubRankings = onSnapshot(rankingsQuery, (snapshot) => {
      setRankings(snapshot.docs.map(doc => sanitizeObject({ id: doc.id, ...doc.data() }) as User));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Announcements Listener (público)
    const annQuery = query(collection(db, 'announcements'), orderBy('timestamp', 'desc'));
    const unsubAnn = onSnapshot(annQuery, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => sanitizeObject({ id: doc.id, ...doc.data() }) as Announcement));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'announcements'));

    // Competitions Listener (público)
    const compQuery = query(collection(db, 'competitions'), orderBy('timestamp', 'desc'), limit(10));
    const unsubComp = onSnapshot(compQuery, (snapshot) => {
      setCompetitions(snapshot.docs.map(doc => sanitizeObject({ id: doc.id, ...doc.data() }) as Competition));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'competitions'));

    // Timer Config Listener (público)
    const unsubTimer = onSnapshot(doc(db, 'settings', 'timer'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTimerConfig({
          enabled: data.enabled || false,
          endTime: data.endTime || null,
          targetTime: data.targetTime || '20:15',
          message: data.message || ''
        });
      }
    }, (error) => console.error('Erro ao carregar timer:', error));

    return () => {
      unsubRankings();
      unsubAnn();
      unsubComp();
      unsubTimer();
    };
  }, [user?.uid]);

  // Real-time Data Listeners â€” dados privados (depende de aprovação)
  useEffect(() => {
    if (!user) return;
    const isStaff = user.role === 'admin' || user.role === 'auditor' || user.role === 'administrativo';
    if (!user.isApproved && !isStaff) return;

    // Posts Listener (My Posts or All for Admin)
    const postsQuery = (user.role === 'admin' || user.role === 'auditor' || user.role === 'administrativo')
      ? query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(2000))
      : query(collection(db, 'posts'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'), limit(500));

    const unsubPosts = onSnapshot(postsQuery, (snapshot) => {
      setPosts(snapshot.docs.map(doc => sanitizeObject({ id: doc.id, ...doc.data() }) as Post));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'posts'));

    // Registrations Listener
    const regQuery = user.role === 'admin'
      ? query(collection(db, 'competition_registrations'), orderBy('timestamp', 'desc'))
      : query(collection(db, 'competition_registrations'), where('userId', '==', user.uid));

    const unsubReg = onSnapshot(regQuery, (snapshot) => {
      setRegistrations(snapshot.docs.map(doc => sanitizeObject({ id: doc.id, ...doc.data() }) as CompetitionRegistration));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'competition_registrations'));

    // Admin/Staff: Users Listeners
    let unsubPendingUsers = () => { };
    let unsubApprovedUsers = () => { };
    let unsubArchivedUsers = () => { };
    let unsubSettings = () => { };

    if (isStaff) {
      // Listener para as configurações globais (ex: chave API)
      unsubSettings = onSnapshot(doc(db, 'config', 'settings'), (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as { apifyKey: string; lastSync?: string; lastResync?: string });
        }
      }, (error) => console.error('Erro ao carregar configurações:', error));

      // Listener para todos os usuários para distribuir por estado (mais simples que múltiplos filtros complexos no Firestore)
      const usersQuery = query(collection(db, 'users'));
      const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
        const allUsers = snapshot.docs.map(doc => sanitizeObject(doc.data()) as User);
        
        // PENDENTES: isApproved: false E não arquivado E não rejeitado
        setPendingUsers(allUsers.filter(u => !u.isApproved && !u.isArchived && !(u as any).isRejected));
        
        // APROVADOS: isApproved: true E não arquivado
        setApprovedUsers(allUsers.filter(u => u.isApproved && !u.isArchived));
        
        // ARQUIVADOS: isArchived: true
        setArchivedUsers(allUsers.filter(u => u.isArchived));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
      
      unsubPendingUsers = unsubUsers; // Alias para manter a lógica de limpeza original
    }

    // Suggestions Listener
    const suggestionsQuery = query(collection(db, 'suggestions'), orderBy('timestamp', 'desc'));
    const unsubSuggestions = onSnapshot(suggestionsQuery, (snapshot) => {
      setSuggestions(snapshot.docs.map(doc => sanitizeObject({ id: doc.id, ...doc.data() }) as Suggestion));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'suggestions'));

    return () => {
      unsubPosts();
      unsubReg();
      unsubPendingUsers();
      unsubApprovedUsers();
      unsubSuggestions();
      unsubSettings();
    };
  }, [user, user?.role]);


  const handleDeletePost = async (postId: string) => {
    if (!user) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) return;

      const postData = postSnap.data() as Post;
      const authorId = postData.userId;

      await updateDoc(postRef, { status: 'deleted' });

      await updateUserMetrics(authorId);

      setNotification({ message: 'Vídeo removido com sucesso!', type: 'success' });
      setPostToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir post:', error);
      setNotification({ message: 'Erro ao excluir o vídeo.', type: 'error' });
    }
  };

  const handleRequestRemoval = async () => {
    if (!removalModal.postId || !removalModal.reason.trim() || !removalModal.consent) {
       setNotification({ message: 'Por favor, preencha o motivo e marque a caixa de ciência.', type: 'error' });
       return;
    }

    try {
      const postRef = doc(db, 'posts', removalModal.postId);
      await updateDoc(postRef, {
        status: 'removal_requested',
        removalRequestReason: removalModal.reason,
        removalRequestAt: Date.now()
      });
      setNotification({ message: 'Solicitação de remoção enviada com sucesso! Aguarde a revisão do administrador.', type: 'success' });
      setRemovalModal({ isOpen: false, postId: '', reason: '', consent: false });
    } catch (error) {
      console.error('Erro ao solicitar remoção:', error);
      setNotification({ message: 'Erro ao enviar solicitação.', type: 'error' });
    }
  };

  const handleApproveRemoval = async (postId: string) => {
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) return;
      const postData = postSnap.data() as Post;
      
      await updateDoc(postRef, { status: 'deleted' });
      await updateUserMetrics(postData.userId);
      setNotification({ message: 'Remoção aprovada com sucesso! O vídeo foi movido para o banco de excluídos.', type: 'success' });
    } catch (error) {
      console.error('Erro ao aprovar remoção:', error);
      setNotification({ message: 'Erro ao aprovar remoção.', type: 'error' });
    }
  };

  const handleRejectRemoval = async (postId: string) => {
    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, { 
        status: 'approved',
        removalRequestReason: '', // Limpa o motivo ao recusar
        removalRequestAt: null
      });
      setNotification({ message: 'Solicitação recusada. O vídeo continua aprovado no ranking.', type: 'success' });
    } catch (error) {
      console.error('Erro ao recusar remoção:', error);
      setNotification({ message: 'Erro ao recusar remoção.', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-black p-6 text-center">
        {!loadError ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full"
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md space-y-6"
          >
            <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase">Falha na Conexão</h2>
            <p className="text-zinc-500 font-bold text-sm leading-relaxed">
              {loadError}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-4 gold-bg text-black font-black rounded-2xl hover:scale-[1.05] transition-all"
            >
              TENTAR NOVAMENTE
            </button>
          </motion.div>
        )}
      </div>
    );
  }


  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setView('RANKINGS');
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      const updates: Partial<User> = {};
      if (profileName) updates.displayName = profileName;
      if (profilePhoto) updates.photoURL = profilePhoto;
      updates.tiktok = profileTiktok;
      updates.instagram = profileInstagram;
      updates.youtube = profileYoutube;

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', user.uid), updates);
        alert('Perfil atualizado com sucesso!');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Erro ao atualizar perfil.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem original deve ter menos de 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250;
          const MAX_HEIGHT = 250;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round(height * (MAX_WIDTH / width));
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round(width * (MAX_HEIGHT / height));
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setProfilePhoto(dataUrl);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteCompetition = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'competitions', id));
      setCompToDelete(null);
      alert('Competição excluída com sucesso!');
    } catch (error) {
      console.error('Error deleting competition:', error);
      alert('Erro ao excluir competição.');
    }
  };

  const handlePostStatus = async (postId: string, status: PostStatus) => {
    const post = posts.find(p => p.id === postId);

    if (status === 'rejected') {
      setRejectionReason(post?.rejectionReason || '');
      setRejectionModal({ isOpen: true, postId, status: 'rejected' });
      return;
    }
    try {
      // TRAVA DE STATUS: Não permitir que um vídeo 'synced' volte para 'approved'
      if (post?.status === 'synced' && status === 'approved') {
        console.log(`[Status Lock] Bloqueada reversão de 'synced' para 'approved' no post ${postId}`);
        return;
      }
      
      await updateDoc(doc(db, 'posts', postId), { status, approvedAt: Date.now() });
      if (post) await updateUserMetrics(post.userId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  const handleConfirmRejection = async () => {
    const { postId, status } = rejectionModal;
    const post = posts.find(p => p.id === postId);
    try {
      await updateDoc(doc(db, 'posts', postId), {
        status: status,
        approvedAt: Date.now(),
        rejectionReason: rejectionReason.trim() || ''
      });
      if (post) await updateUserMetrics(post.userId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
    } finally {
      setRejectionModal({ isOpen: false, postId: '', status: 'rejected' });
      setRejectionReason('');
    }
  };

  const handleUserApproval = async (userId: string, isApproved: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        isApproved, 
        approvedAt: isApproved ? Date.now() : null,
        isArchived: false // Sempre que aprova ou desativa, garante que não está arquivado
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'EXCLUIR USUÁRIO',
      message: 'TEM CERTEZA QUE DESEJA APAGAR PERMANENTEMENTE ESTE USUÁRIO E TODOS OS SEUS DADOS? ESTA AÇÃO NÃO PODE SER DESFEITA.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', userId));
          alert('Usuário excluído com sucesso!');
        } catch (error: any) {
          console.error('Erro ao deletar usuário:', error);
          if (error.code === 'permission-denied') {
            try {
              await updateDoc(doc(db, 'users', userId), { isApproved: false, isRejected: true });
              alert('O usuário não pôde ser excluído totalmente, mas foi marcado como rejeitado.');
            } catch (e2) {
              alert('Erro ao remover usuário. Verifique as regras do Firebase.');
            }
          } else {
            alert(`Erro ao remover: ${error.message}`);
          }
        }
      }
    });
  };

  const handleArchiveUser = async (userId: string, archive: boolean) => {
    setConfirmModal({
      isOpen: true,
      title: archive ? 'ARQUIVAR USUÁRIO' : 'RESTAURAR USUÁRIO',
      message: archive 
        ? 'TEM CERTEZA QUE DESEJA ARQUIVAR ESTE USUÁRIO? ELE NÃO APARECERÁ MAIS NAS LISTAS ATIVAS, MAS SEUS DADOS SERÃO PRESERVADOS.' 
        : 'DESEJA RESTAURAR ESTE USUÁRIO PARA A LISTA DE SOLICITAÇÕES PENDENTES?',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', userId), { 
            isArchived: archive,
            isApproved: false // Ao arquivar ou restaurar, o usuário deve ser re-avaliado ou ficar inativo
          });
          alert(archive ? 'Usuário arquivado!' : 'Usuário restaurado para pendentes!');
        } catch (error) {
          console.error('Erro ao arquivar/restaurar usuário:', error);
          alert('Erro ao processar ação.');
        }
      }
    });
  };

  const handleResetDailyRanking = async (compId?: string) => {
    const targetComp = compId ? competitions.find(c => c.id === compId) : competitions.find(c => c.isActive);
    
    if (!targetComp) {
      alert('Nenhuma competição ativa selecionada ou encontrada.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: `Zerar Ranking Diário - ${targetComp.title}`,
      message: `Isso calculará os vencedores do Dia e o Top 1 Insta para esta COMPETIÇÃO ESPECÍFICA, adicionará os prêmios ao Saldo, registrará as transações e zerará as estatísticas diárias DESTA COMPETIÇÃO. Deseja prosseguir?`,
      onConfirm: async () => {
        try {
          const cid = targetComp.id;
          
          // Filter users who have daily stats for THIS competition
          const dailyViewWinners = [...approvedUsers]
            .filter(u => (u.competitionStats?.[cid]?.dailyViews || 0) > 0)
            .sort((a, b) => (b.competitionStats?.[cid]?.dailyViews || 0) - (a.competitionStats?.[cid]?.dailyViews || 0))
            .slice(0, targetComp.prizesDaily?.length || 10);

          const instaWinner = [...approvedUsers]
            .filter(u => (u.competitionStats?.[cid]?.dailyInstaPosts || 0) > 0)
            .sort((a, b) => (b.competitionStats?.[cid]?.dailyInstaPosts || 0) - (a.competitionStats?.[cid]?.dailyInstaPosts || 0))[0];

          const balanceIncrements: Record<string, { amount: number, desc: string }> = {};
          const viewBonusValue = targetComp.viewBonus || 0;

          dailyViewWinners.forEach((u, i) => {
            const prize = targetComp.prizesDaily?.[i]?.value || 0;
            const dailyViews = u.competitionStats?.[cid]?.dailyViews || 0;
            const bonusFromViews = Math.floor(dailyViews / 1000000) * viewBonusValue;
            const total = prize + bonusFromViews;
            if (total > 0) {
              balanceIncrements[u.uid] = {
                amount: (balanceIncrements[u.uid]?.amount || 0) + total,
                desc: `PRÊMIO DIÁRIO ${targetComp.title.toUpperCase()} (${i + 1}º LUGAR)${bonusFromViews > 0 ? ' + BÔNUS' : ''}`
              };
            }
          });

          if (instaWinner && targetComp.prizesInstagram?.[0]) {
            const prize = targetComp.prizesInstagram[0].value || 0;
            const existing = balanceIncrements[instaWinner.uid];
            if (existing) {
              existing.amount += prize;
              if (!existing.desc.includes('+ BÔNUS')) {
                existing.desc += ' + BÔNUS';
              }
            } else {
              balanceIncrements[instaWinner.uid] = {
                amount: prize,
                desc: `PRÊMIO INSTA ${targetComp.title.toUpperCase()} + BÔNUS`
              };
            }
          }

          console.log('--- RESET DAILY RANKING LOG ---');
          console.log('Target Competition:', targetComp.title);
          console.log('Daily View Winners:', dailyViewWinners.map(u => ({ name: u.displayName, views: u.competitionStats?.[cid]?.dailyViews })));
          console.log('Insta Winner:', instaWinner?.displayName);
          console.log('Calculated Increments:', balanceIncrements);

          // Process updates using Batch
          const batch = writeBatch(db);

          // 1. Create transactions
          Object.entries(balanceIncrements).forEach(([uid, data]) => {
            const transRef = doc(collection(db, 'transactions'));
            batch.set(transRef, {
              userId: uid,
              amount: data.amount,
              timestamp: Date.now(),
              status: 'credit',
              type: 'prize',
              description: data.desc,
              competitionId: cid
            });
          });

          // 2. Reset user stats
          approvedUsers.forEach(u => {
            const uIncrement = balanceIncrements[u.uid]?.amount || 0;
            const dataToUpdate: any = {};
            
            // Reset daily stats for THIS competition
            const oldCompStats = u.competitionStats?.[cid] || {};
            dataToUpdate[`competitionStats.${cid}.dailyViews`] = 0;
            dataToUpdate[`competitionStats.${cid}.dailyLikes`] = 0;
            dataToUpdate[`competitionStats.${cid}.dailyComments`] = 0;
            dataToUpdate[`competitionStats.${cid}.dailyShares`] = 0;
            dataToUpdate[`competitionStats.${cid}.dailySaves`] = 0;
            dataToUpdate[`competitionStats.${cid}.dailyPosts`] = 0;
            dataToUpdate[`competitionStats.${cid}.dailyInstaPosts`] = 0;

            if (uIncrement > 0) {
              const currentBalance = u.balance || 0;
              const currentCompBalance = u.competitionStats?.[cid]?.balance || 0;
              dataToUpdate.balance = currentBalance + uIncrement;
              dataToUpdate[`competitionStats.${cid}.balance`] = currentCompBalance + uIncrement;
            }

            // Recalculate root daily stats (sum of all competitions EXCEPT the one being reset)
            const otherComps = Object.entries(u.competitionStats || {}).filter(([id]) => id !== cid);
            const newRootDailyViews = otherComps.reduce((acc, [_, s]) => acc + (s.dailyViews || 0), 0);
            const newRootDailyLikes = otherComps.reduce((acc, [_, s]) => acc + (s.dailyLikes || 0), 0);
            const newRootDailyPosts = otherComps.reduce((acc, [_, s]) => acc + (s.dailyPosts || 0), 0);
            const newRootDailyInstaPosts = otherComps.reduce((acc, [_, s]) => acc + (s.dailyInstaPosts || 0), 0);
            
            dataToUpdate.dailyViews = newRootDailyViews;
            dataToUpdate.dailyLikes = newRootDailyLikes;
            dataToUpdate.dailyPosts = newRootDailyPosts;
            dataToUpdate.dailyInstaPosts = newRootDailyInstaPosts;

            batch.update(doc(db, 'users', u.uid), dataToUpdate);
          });

          // 3. Update competition reset timestamp
          batch.update(doc(db, 'competitions', cid), { lastDailyReset: Date.now() });

          await batch.commit();
          if (Object.keys(balanceIncrements).length === 0) {
            const msg = dailyViewWinners.length === 0 
                ? 'Nenhum usuário com visualizações diárias registradas.' 
                : 'Nenhum prêmio configurado nesta competição.';
            alert(`⚠️ Reset realizado sem premiações:\n\n${msg}\n\nEstatísticas diárias foram zeradas mesmo assim.`);
          } else {
            const auditMsg = Object.entries(balanceIncrements)
              .map(([uid, data]) => {
                const u = approvedUsers.find(au => au.uid === uid);
                return `- ${u?.displayName || uid}: R$ ${data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
              }).join('\n');
            alert(`✅ Ranking resetado!\n\n${Object.keys(balanceIncrements).length} usuário(s) premiados:\n${auditMsg}`);
          }
        } catch (error) {
          console.error('Error resetting rankings:', error);
          alert('Erro ao resetar ranking.');
        }
      }
    });
  };

  const handleRankingResetOnly = async () => {
    setConfirmModal({
      isOpen: true,
      title: '⚠️ ZERAR RANKINGS (MANTER LINKS)',
      message: 'Isso zerará todas as estatísticas e rankings de todos os usuários, mas MANTERÁ os vídeos vinculados no sistema. Os vídeos voltarão ao status APROVADO para permitir uma nova sincronização total do zero. Deseja prosseguir?',
      onConfirm: async () => {
        try {
          let batch = writeBatch(db);
          let count = 0;

          // 1. Reset all posts (metrics to 0 and status to approved)
          const postsSnap = await getDocs(collection(db, 'posts'));
          for (const postDoc of postsSnap.docs) {
            batch.update(postDoc.ref, {
              views: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              saves: 0,
              status: 'approved'
            });
            count++;
            if (count >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }

          // 2. Reset all users (stats to 0 and clear competitionStats)
          const usersSnap = await getDocs(collection(db, 'users'));
          for (const uDoc of usersSnap.docs) {
            batch.update(uDoc.ref, {
              totalViews: 0,
              totalLikes: 0,
              totalComments: 0,
              totalShares: 0,
              totalSaves: 0,
              totalPosts: 0,
              dailyViews: 0,
              dailyLikes: 0,
              dailyComments: 0,
              dailyShares: 0,
              dailySaves: 0,
              dailyPosts: 0,
              dailyInstaPosts: 0,
              competitionStats: {}
            });
            count++;
            if (count >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }

          if (count > 0) {
            await batch.commit();
          }

          alert('✨ Rankings resetados com sucesso! Os vídeos foram liberados para nova sincronização.');
        } catch (error) {
          console.error('Error during ranking reset:', error);
          alert('Erro ao resetar rankings. Veja o console.');
        }
      }
    });
  };


  const handleSystemCleanup = async () => {
    setConfirmModal({
      isOpen: true,
      title: '🚨 LIMPEZA GERAL DO SISTEMA - PERIGO',
      message: 'VOCÊ TEM CERTEZA? Esta operação apagará permanentemente TODOS OS LINKS, TRANSAÇÕES, REGISTROS E SALDOS. Esta ação não pode ser desfeita. Apenas os usuários e suas permissões serão mantidos.',
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);

          // 1. Delete all posts
          const postsSnap = await getDocs(collection(db, 'posts'));
          postsSnap.docs.forEach(doc => batch.delete(doc.ref));

          // 2. Delete all transactions
          const transSnap = await getDocs(collection(db, 'transactions'));
          transSnap.docs.forEach(doc => batch.delete(doc.ref));

          // 3. Delete all registrations
          const regsSnap = await getDocs(collection(db, 'registrations'));
          regsSnap.docs.forEach(doc => batch.delete(doc.ref));

          // 4. Delete all announcements
          const annSnap = await getDocs(collection(db, 'announcements'));
          annSnap.docs.forEach(doc => batch.delete(doc.ref));

          // 5. Delete all suggestions
          const sugSnap = await getDocs(collection(db, 'suggestions'));
          sugSnap.docs.forEach(doc => batch.delete(doc.ref));

          // 6. Reset all users
          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.docs.forEach(uDoc => {
            batch.update(uDoc.ref, {
              balance: 0,
              lifetimeEarnings: 0,
              pixKey: '',
              totalViews: 0,
              totalLikes: 0,
              totalComments: 0,
              totalShares: 0,
              totalSaves: 0,
              totalPosts: 0,
              dailyViews: 0,
              dailyLikes: 0,
              dailyComments: 0,
              dailyShares: 0,
              dailySaves: 0,
              dailyPosts: 0,
              dailyInstaPosts: 0,
              competitionStats: {}
            });
          });

          // 7. Reset competitions lastDailyReset to now
          const compsSnap = await getDocs(collection(db, 'competitions'));
          compsSnap.docs.forEach(cDoc => {
            batch.update(cDoc.ref, { lastDailyReset: Date.now() });
          });

          await batch.commit();
          alert('🔥🔥🔥 SISTEMA FOI RESETADO COM SUCESSO! Todos os dados foram limpos.');
        } catch (error) {
          console.error('Error during cleanup:', error);
          alert('Erro durante a limpeza do sistema. Veja o console.');
        }
      }
    });
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompBanner(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateCompetition = async () => {
    if (!compTitle || !compBanner) {
      alert('Título e Banner são obrigatórios!');
      return;
    }

    try {
      const compData = {
        title: compTitle,
        description: compDesc,
        rules: compRules,
        hashtags: compHashtags,
        mentions: compMentions,
        bonuses: compBonuses,
        viewBonus: compViewBonus || 0,
        bannerUrl: compBanner,
        rankingMetric: compRankingMetric,
        goalTarget: compGoalTarget,
        goalMetric: compGoalMetric,
        isActive: true,
        startDate: compStartDate ? new Date(compStartDate + 'T00:00:00').getTime() : Date.now(),
        endDate: compEndDate ? new Date(compEndDate + 'T23:59:59').getTime() : Date.now() + 7 * 24 * 60 * 60 * 1000,
        prizes: compPrizes.slice(0, compPositions),
        prizesDaily: compPrizesDaily.slice(0, compPositionsDaily),
        prizesMonthly: compPrizesMonthly.slice(0, compPositionsMonthly),
        prizesInstagram: compPrizesInstagram.slice(0, compPositionsInstagram),
        timestamp: Date.now()
      };

      if (editingCompId) {
        await updateDoc(doc(db, 'competitions', editingCompId), compData);
        alert('Competição atualizada com sucesso!');
      } else {
        await addDoc(collection(db, 'competitions'), compData);
        alert('Competição criada com sucesso!');
      }

      setIsCreatingComp(false);
      setEditingCompId(null);
      setCompTitle('');
      setCompRankingMetric('views');
      setCompGoalTarget(0);
      setCompGoalMetric('views');
      setCompDesc('');
      setCompRules('');
      setCompHashtags('');
      setCompMentions('');
      setCompBonuses('');
      setCompInstaBonus('');
      setCompViewBonus(0);
      setCompStartDate('');
      setCompEndDate('');
      setCompBanner('');
      setCompPositions(3);
      setCompPositionsDaily(3);
      setCompPositionsMonthly(3);
      setCompPositionsInstagram(3);
      setCompPrizes([
        { position: 1, value: 0, label: '1º Lugar' },
        { position: 2, value: 0, label: '2º Lugar' },
        { position: 3, value: 0, label: '3º Lugar' }
      ]);
      setCompPrizesDaily([
        { position: 1, value: 0, label: '1º Diário' },
        { position: 2, value: 0, label: '2º Diário' },
        { position: 3, value: 0, label: '3º Diário' }
      ]);
      setCompPrizesMonthly([
        { position: 1, value: 0, label: '1º Mensal' },
        { position: 2, value: 0, label: '2º Mensal' },
        { position: 3, value: 0, label: '3º Mensal' }
      ]);
      setCompPrizesInstagram([
        { position: 1, value: 0, label: '1º Insta' },
        { position: 2, value: 0, label: '2º Insta' },
        { position: 3, value: 0, label: '3º Insta' }
      ]);
    } catch (error) {
      console.error('Error saving competition:', error);
      alert('Erro ao salvar competição.');
    }
  };

  const handleEditCompClick = (comp: Competition) => {
    setEditingCompId(comp.id);
    setCompTitle(comp.title);
    setCompRankingMetric(comp.rankingMetric || 'views');
    setCompGoalTarget(comp.goalTarget || 0);
    setCompGoalMetric(comp.goalMetric || 'views');
    setCompDesc(comp.description || '');
    setCompRules(comp.rules || '');
    setCompHashtags(comp.hashtags || '');
    setCompMentions(comp.mentions || '');
    setCompBonuses(comp.bonuses || '');
    setCompViewBonus((comp as any).viewBonus || 0);

    const formatDate = (ms: number) => {
      const d = new Date(ms);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${mm}-${dd}`;
    };
    setCompStartDate(comp.startDate ? formatDate(comp.startDate) : formatDate(Date.now()));
    setCompEndDate(comp.endDate ? formatDate(comp.endDate) : formatDate(Date.now()));

    setCompBanner(comp.bannerUrl);
    setCompPositions(comp.prizes?.length || 3);
    setCompPrizes(comp.prizes || []);
    setCompPositionsDaily(comp.prizesDaily?.length || 3);
    setCompPrizesDaily(comp.prizesDaily || []);
    setCompPositionsMonthly(comp.prizesMonthly?.length || 3);
    setCompPrizesMonthly(comp.prizesMonthly || []);
    setCompPositionsInstagram(comp.prizesInstagram?.length || 3);
    setCompPrizesInstagram(comp.prizesInstagram || []);
    setIsCreatingComp(true);
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    try {
      const updates: any = { displayName: editName, role: editRole };
      if (editPass) updates.password = editPass;

      await updateDoc(doc(db, 'users', editingUser.uid), updates);
      setEditingUser(null);
      alert('Usuário atualizado com sucesso!');
    } catch (error) {
      console.error('Error editing user:', error);
      alert('Erro ao editar usuário.');
    }
  };

  const handleUpdateTimer = async (config: { enabled: boolean; endTime: number | null; targetTime: string; message: string }) => {
    try {
      await setDoc(doc(db, 'settings', 'timer'), config);
      setNotification({ message: 'Configurações do timer atualizadas!', type: 'success' });
    } catch (error) {
      console.error('Erro ao atualizar timer:', error);
      setNotification({ message: 'Erro ao atualizar timer.', type: 'error' });
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!annMsg) return;
    try {
      await addDoc(collection(db, 'announcements'), {
        title: annTitle,
        message: annMsg,
        isActive: true,
        timestamp: Date.now()
      });
      setAnnTitle('');
      setAnnMsg('');
      setIsCreatingAnn(false);
      alert('Aviso enviado com sucesso!');
    } catch (error) {
      console.error('Error creating announcement:', error);
      alert('Erro ao criar aviso!');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remover Aviso',
      message: 'Tem certeza que deseja remover este aviso? Esta ação é permanente.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'announcements', id));
          alert('Aviso removido com sucesso!');
        } catch (error) {
          console.error('Error deleting announcement:', error);
          alert('Erro ao remover aviso.');
        }
      }
    });
  };

  const handleSendSuggestion = async () => {
    if (!user || !suggestionMsg.trim()) return;
    try {
      await addDoc(collection(db, 'suggestions'), {
        userId: user.uid,
        userName: user.displayName,
        userEmail: user.email,
        message: suggestionMsg,
        timestamp: Date.now(),
        status: 'pending'
      });
      setSuggestionMsg('');
      alert('Sua sugestão foi enviada com sucesso! Obrigado por nos ajudar a melhorar.');
    } catch (error) {
      console.error('Error sending suggestion:', error);
      alert('Erro ao enviar sugestão. Tente novamente mais tarde.');
    }
  };

  const handleUpdateSuggestionStatus = async (id: string, status: Suggestion['status']) => {
    try {
      await updateDoc(doc(db, 'suggestions', id), { status });
      alert('Status da sugestão atualizado!');
    } catch (error) {
      console.error('Error updating suggestion:', error);
      alert('Erro ao atualizar status.');
    }
  };

  const handleUpdateUserRole = async (uid: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
      alert('Cargo do usuário atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Erro ao mudar cargo!');
    }
  };

  const handleDeleteSuggestion = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remover Sugestão',
      message: 'Tem certeza que deseja remover esta sugestão?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'suggestions', id));
          alert('Sugestão removida!');
        } catch (error) {
          console.error('Error deleting suggestion:', error);
          alert('Erro ao remover sugestão.');
        }
      }
    });
  };

  const handleUpdateCompetitionStatus = async (id: string, newStatus: 'active' | 'inactive' | 'upcoming') => {
    try {
      await updateDoc(doc(db, 'competitions', id), { 
        status: newStatus,
        isActive: newStatus === 'active'
      });
    } catch (error) {
      console.error('Error updating competition status:', error);
    }
  };
  
  const handleAcknowledgeAnnouncement = (id: string) => {
    setAcknowledgedAnnouncements(prev => {
      const next = [...prev, id];
      localStorage.setItem('acknowledgedAnnouncements', JSON.stringify(next));
      return next;
    });
  };

  const handleRegistrationStatus = async (regId: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      await updateDoc(doc(db, 'competition_registrations', regId), { status });
      alert(`Inscrição ${status === 'approved' ? 'aprovada' : status === 'pending' ? 'revertida para pendente' : 'rejeitada'}!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `competition_registrations/${regId}`);
    }
  };

  const handleDeleteRegistration = async (regId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remover Inscrição',
      message: 'Tem certeza que deseja remover esta inscrição oficial? O usuário perderá o acesso a esta competição e sairá do ranking.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'competition_registrations', regId));
          alert('Inscrição removida com sucesso!');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `competition_registrations/${regId}`);
        }
      }
    });
  };

  if (!user) {
    return <AuthScreen onLoginSuccess={(u) => setUser(u)} />;
  }

  if (!user.isApproved && user.role !== 'admin' && user.role !== 'administrativo') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-black px-4 text-center">
        <div className="w-24 h-24 gold-bg rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
          <Clock className="w-12 h-12 text-black" />
        </div>
        <h1 className="text-3xl font-black gold-gradient mb-4">AGUARDANDO APROVAÇÃO</h1>
        <p className="text-zinc-400 max-w-sm mb-8">
          Sua conta foi criada com sucesso! Agora a diretoria precisa aprovar seu acesso ao Hub MetaRayx.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => window.location.reload()}
            className="w-full px-8 py-4 gold-bg text-black font-black rounded-xl hover:scale-[1.02] transition-all shadow-xl"
          >
            JÁ FUI APROVADO? RECARREGAR
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-8 py-3 bg-zinc-900 text-zinc-400 font-bold rounded-xl hover:text-zinc-100 transition-colors"
          >
            SAIR DA CONTA
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-black text-zinc-100 overflow-hidden">
        {/* Sidebar */}
        <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 glass border-r border-zinc-800/50 transform transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
          <div className="flex flex-col h-full p-6">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 gold-bg rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-black" />
              </div>
              <span className="text-xl font-black gold-gradient tracking-tighter">METARAYX</span>
              <button className="lg:hidden ml-auto" onClick={() => setIsSidebarOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <nav className="flex-1 space-y-2">
              <NavItem active={view === 'DASHBOARD'} onClick={() => { setView('DASHBOARD'); setSelectedActiveCompId(null); }} icon={<LayoutDashboard />} label="Início" />
              <NavItem active={view === 'COMPETITIONS'} onClick={() => { setView('COMPETITIONS'); setSelectedActiveCompId(null); }} icon={<Trophy />} label="Competições" />
              <NavItem active={view === 'HISTORY'} onClick={() => { setView('HISTORY'); setSelectedActiveCompId(null); }} icon={<History />} label="Meus Protocolos" />
              <NavItem active={view === 'WALLET'} onClick={() => { setView('WALLET'); setSelectedActiveCompId(null); }} icon={<Zap />} label="Minha Carteira" />
              <button 
                onClick={() => { setView('SETTINGS'); setSettingsTab('SOCIAL'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${view === 'SETTINGS' && settingsTab === 'SOCIAL' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}`}
              >
                <Share2 className="w-5 h-5 flex-shrink-0" />
                Gerenciar Contas
              </button>
              {(user.role === 'admin' || user.role === 'auditor' || user.role === 'administrativo') && (
                <NavItem active={view === 'ADMIN'} onClick={() => setView('ADMIN')} icon={<ShieldCheck />} label={
                  user.role === 'admin' ? "Diretoria" :
                    user.role === 'administrativo' ? "Administrativo" : "Gestão"
                } />
              )}
              <NavItem active={view === 'SETTINGS'} onClick={() => setView('SETTINGS')} icon={<Settings />} label="Configurações" />

              <div className="pt-2">
                <NavItem active={view === 'SUGGESTIONS'} onClick={() => setView('SUGGESTIONS')} icon={<MessageSquare />} label="Sugestões" />
              </div>
            </nav>

            <div className="mt-auto pt-6 border-t border-zinc-800/50">
              <div className="flex items-center gap-3 mb-6 p-2 rounded-xl bg-zinc-900/50">
                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-10 h-10 rounded-lg" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{user.displayName}</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">{user.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors font-bold text-sm"
              >
                <LogOut className="w-4 h-4" />
                SAIR DO HUB
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <TimerBanner config={timerConfig} />
          <AnnouncementBanner
            announcement={announcements.filter(a => a.isActive !== false && !acknowledgedAnnouncements.includes(a.id))[0]}
            onAcknowledge={handleAcknowledgeAnnouncement}
          />
          {/* Header */}
          <header className="h-20 glass border-b border-zinc-800/50 flex items-center justify-between px-6 lg:px-10 shrink-0">
            <button className="lg:hidden" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>

            <div className="hidden sm:flex items-center gap-8">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Saldo Disponível</span>
                  <button onClick={() => setShowBalances(!showBalances)} className="text-zinc-500 hover:text-amber-500 transition-colors" title={showBalances ? "Ocultar saldos" : "Mostrar saldos"}>
                    {showBalances ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-lg font-black text-emerald-400">R$ {showBalances ? (user.balance || 0).toFixed(2) : '***'}</span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Total Views</span>
                <span className="text-lg font-black gold-gradient">{user.totalViews.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Status do Ciclo</span>
                <span className="text-xs font-bold text-emerald-500 flex items-center gap-1 justify-end">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  OPERACIONAL
                </span>
              </div>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {view === 'DASHBOARD' && (
                  <Dashboard
                    user={user}
                    announcements={announcements}
                    rankings={rankings}
                    competitions={competitions}
                    registrations={registrations}
                    posts={posts.filter(p => p.userId === user.uid && p.status !== 'banned')}
                    showBalances={showBalances}
                  />
                )}
                {view === 'COMPETITIONS' && (
                  !selectedActiveCompId ? (
                    <CompetitionsView 
                      user={user} 
                      competitions={competitions} 
                      registrations={registrations} 
                      onSelectComp={setSelectedActiveCompId}
                    />
                  ) : (
                    <CompetitionDetailView
                      comp={competitions.find(c => c.id === selectedActiveCompId)!}
                      user={user}
                      rankings={rankings}
                      posts={posts}
                      registrations={registrations}
                      onBack={() => setSelectedActiveCompId(null)}
                      setView={setView}
                    />
                  )
                )}
                {view === 'HISTORY' && (
                  <HistoryView 
                    posts={posts} 
                    onDelete={handleDeletePost} 
                    onRemove={setRemovalModal}
                    isAdmin={isAdmin} 
                  />
                )}
                {view === 'WALLET' && <WalletView user={user} competitions={competitions} showBalances={showBalances} />}
                {view === 'ADMIN' && (user.role === 'admin' || user.role === 'auditor' || user.role === 'administrativo') && (
                  <AdminPanel
                    userRole={user.role}
                    posts={posts}
                    pendingUsers={pendingUsers}
                    approvedUsers={approvedUsers}
                    archivedUsers={archivedUsers}
                    settings={settings}
                    competitions={competitions}
                    registrations={registrations}
                    announcements={announcements}
                    timerConfig={timerConfig}
                    handleUpdateTimer={handleUpdateTimer}
                    onSettingsUpdate={(s) => setSettings(s)}
                    editingCompId={editingCompId}
                    setEditingCompId={setEditingCompId}
                    setCompToDelete={setCompToDelete}
                    setPostToDelete={setPostToDelete}
                    handlePostStatus={handlePostStatus}
                    handleUserApproval={handleUserApproval}
                    handleDeleteUser={handleDeleteUser}
                    handleArchiveUser={handleArchiveUser}
                    handleRegistrationStatus={handleRegistrationStatus}
                    handleDeleteRegistration={handleDeleteRegistration}
                    handleResetDailyRanking={handleResetDailyRanking}
                    handleUpdateCompetitionStatus={handleUpdateCompetitionStatus}
                    handleBannerUpload={handleBannerUpload}
                    handleCreateCompetition={handleCreateCompetition}
                    handleEditCompClick={handleEditCompClick}
                    handleEditUser={handleEditUser}
                    handleCreateAnnouncement={handleCreateAnnouncement}
                    handleDeleteAnnouncement={handleDeleteAnnouncement}
                    handleDeleteSuggestion={handleDeleteSuggestion}
                    handleUpdateSuggestionStatus={handleUpdateSuggestionStatus}
                    handleUpdateUserRole={handleUpdateUserRole}
                    handleApproveRemoval={handleApproveRemoval}
                    handleRejectRemoval={handleRejectRemoval}
                    handleRankingResetOnly={handleRankingResetOnly}
                    suggestions={suggestions}
                    compTitle={compTitle}
                    setCompTitle={setCompTitle}
                    compRankingMetric={compRankingMetric}
                    setCompRankingMetric={setCompRankingMetric}
                    compGoalTarget={compGoalTarget}
                    setCompGoalTarget={setCompGoalTarget}
                    compGoalMetric={compGoalMetric}
                    setCompGoalMetric={setCompGoalMetric}
                    compDesc={compDesc}
                    setCompDesc={setCompDesc}
                    compRules={compRules}
                    setCompRules={setCompRules}
                    compHashtags={compHashtags}
                    setCompHashtags={setCompHashtags}
                    compMentions={compMentions}
                    setCompMentions={setCompMentions}
                    compBonuses={compBonuses}
                    setCompBonuses={setCompBonuses}
                    compInstaBonus={compInstaBonus}
                    setCompInstaBonus={setCompInstaBonus}
                    compViewBonus={compViewBonus}
                    setCompViewBonus={setCompViewBonus}
                    compStartDate={compStartDate}
                    setCompStartDate={setCompStartDate}
                    compEndDate={compEndDate}
                    setCompEndDate={setCompEndDate}
                    compBanner={compBanner}
                    setCompBanner={setCompBanner}
                    compPositions={compPositions}
                    setCompPositions={setCompPositions}
                    compPrizes={compPrizes}
                    setCompPrizes={setCompPrizes}
                    compPositionsDaily={compPositionsDaily}
                    setCompPositionsDaily={setCompPositionsDaily}
                    compPrizesDaily={compPrizesDaily}
                    setCompPrizesDaily={setCompPrizesDaily}
                    compPositionsMonthly={compPositionsMonthly}
                    setCompPositionsMonthly={setCompPositionsMonthly}
                    compPrizesMonthly={compPrizesMonthly}
                    setCompPrizesMonthly={setCompPrizesMonthly}
                    compPositionsInstagram={compPositionsInstagram}
                    setCompPositionsInstagram={setCompPositionsInstagram}
                    compPrizesInstagram={compPrizesInstagram}
                    setCompPrizesInstagram={setCompPrizesInstagram}
                    isCreatingComp={isCreatingComp}
                    setIsCreatingComp={setIsCreatingComp}
                    editingUser={editingUser}
                    setEditingUser={setEditingUser}
                    editName={editName}
                    setEditName={setEditName}
                    editPass={editPass}
                    setEditPass={setEditPass}
                    editRole={editRole}
                    setEditRole={setEditRole}
                    annTitle={annTitle}
                    setAnnTitle={setAnnTitle}
                    annMsg={annMsg}
                    setAnnMsg={setAnnMsg}
                    isCreatingAnn={isCreatingAnn}
                    setIsCreatingAnn={setIsCreatingAnn}
                    handleSystemCleanup={handleSystemCleanup}
                    rejectionReason={rejectionReason}
                    setRejectionReason={setRejectionReason}
                    setRejectionModal={setRejectionModal}
                  />
                )}
                {view === 'SETTINGS' && user && (
                  <SettingsView
                    user={user}
                    profileName={profileName}
                    setProfileName={setProfileName}
                    profileTiktok={profileTiktok}
                    setProfileTiktok={setProfileTiktok}
                    profileInstagram={profileInstagram}
                    setProfileInstagram={setProfileInstagram}
                    profileYoutube={profileYoutube}
                    setProfileYoutube={setProfileYoutube}
                    profilePhoto={profilePhoto}
                    handleProfilePhotoUpload={handleProfilePhotoUpload}
                    handleUpdateProfile={handleUpdateProfile}
                    isUpdatingProfile={isUpdatingProfile}
                    settingsTab={settingsTab}
                    setSettingsTab={setSettingsTab}
                  />
                )}
                {view === 'SUGGESTIONS' && user && (
                  <SuggestionsView
                    suggestionMsg={suggestionMsg}
                    setSuggestionMsg={setSuggestionMsg}
                    handleSendSuggestion={handleSendSuggestion}
                    suggestions={suggestions}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl font-black text-sm shadow-2xl flex items-center gap-3 ${notification.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'
              }`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* General Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Rejection Reason Modal */}
      <AnimatePresence>
        {rejectionModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRejectionModal({ isOpen: false, postId: '', status: 'rejected' })}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[40px] border border-zinc-800 space-y-6"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-3xl flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tight">Recusar Vídeo</h3>
                <p className="text-zinc-500 font-bold text-xs">Informe o motivo da remoção. Esta mensagem será exibida ao usuário no card dele.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Motivo da Remoção (opcional)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ex: Vídeo não segue as regras da competição..."
                  className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-5 text-sm font-bold focus:border-red-500 outline-none transition-all h-28 resize-none shadow-inner text-zinc-200 placeholder:text-zinc-700"
                />
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleConfirmRejection}
                  className="w-full py-4 bg-red-500 text-white font-black rounded-2xl hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  CONFIRMAR REMOÇÃO
                </button>
                <button
                  onClick={() => setRejectionModal({ isOpen: false, postId: '', status: 'rejected' })}
                  className="w-full py-4 bg-zinc-900 text-zinc-400 font-black rounded-2xl hover:text-zinc-100 transition-all"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Removal Request Modal */}
      <AnimatePresence>
        {removalModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg glass p-8 rounded-[40px] border border-zinc-800 space-y-8 shadow-2xl"
            >
              <div className="space-y-4">
                <div className="w-16 h-16 bg-red-500/20 rounded-3xl flex items-center justify-center">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-3xl font-black uppercase tracking-tighter text-white">SOLICITAR REMOÇÃO</h3>
                  <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest leading-relaxed text-left">
                    Você pode solicitar a remoção deste vídeo por motivos excepcionais. 
                    <br />O administrador irá analisar seu pedido.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1 text-left">MOTIVO DA REMOÇÃO</label>
                  <textarea
                    value={removalModal.reason}
                    onChange={(e) => setRemovalModal(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Explique detalhadamente por que você deseja remover este vídeo..."
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-3xl p-6 text-sm text-white focus:outline-none focus:border-red-500/50 transition-all min-h-[150px] placeholder:text-zinc-700 font-medium"
                  />
                </div>

                <label className="flex items-start gap-4 p-6 rounded-3xl bg-red-500/5 border border-red-500/10 cursor-pointer group transition-all hover:bg-red-500/10">
                  <input
                    type="checkbox"
                    checked={removalModal.consent}
                    onChange={(e) => setRemovalModal(prev => ({ ...prev, consent: e.target.checked }))}
                    className="mt-1 w-5 h-5 rounded-lg bg-zinc-900 border-zinc-700 text-red-500 focus:ring-red-500/20"
                  />
                  <span className="text-xs font-bold text-zinc-300 group-hover:text-white transition-colors leading-relaxed text-left">
                    Estou ciente que, após a remoção ser aprovada, todas as <span className="text-red-500">visualizações e métricas deste vídeo serão subtraídas</span> do meu total e do ranking global.
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setRemovalModal({ isOpen: false, postId: '', reason: '', consent: false })}
                  className="px-8 py-5 rounded-[2rem] bg-zinc-900 border border-zinc-800 text-zinc-400 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleRequestRemoval}
                  className="px-8 py-5 rounded-[2rem] bg-red-600 text-white font-black text-[11px] uppercase tracking-[0.2em] hover:bg-white hover:text-red-600 transition-all shadow-[0_10px_30px_rgba(220,38,38,0.3)] active:scale-95"
                >
                  ENVIAR PEDIDO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Post Delete Confirmation Modal */}
      <AnimatePresence>
        {postToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPostToDelete(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[40px] border border-zinc-800 space-y-6 text-center"
            >
              <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center mx-auto">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight">Excluir Vídeo?</h3>
                <p className="text-zinc-500 font-bold text-sm">
                  Esta ação é permanente e removerá as estatísticas deste vídeo do seu ranking.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleDeletePost(postToDelete)}
                  className="w-full py-4 bg-red-500 text-white font-black rounded-2xl hover:bg-red-600 transition-all"
                >
                  SIM, EXCLUIR VÍDEO
                </button>
                <button
                  onClick={() => setPostToDelete(null)}
                  className="w-full py-4 bg-zinc-900 text-zinc-400 font-black rounded-2xl hover:text-zinc-100 transition-all"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Competition Delete Confirmation Modal */}
      <AnimatePresence>
        {compToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCompToDelete(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[40px] border border-zinc-800 space-y-6 text-center"
            >
              <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center mx-auto">
                <Trophy className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight">Excluir Competição?</h3>
                <p className="text-zinc-500 font-bold text-sm">
                  Esta ação é permanente e removerá a competição e todos os seus dados.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => deleteCompetition(compToDelete)}
                  className="w-full py-4 bg-red-500 text-white font-black rounded-2xl hover:bg-red-600 transition-all"
                >
                  SIM, EXCLUIR COMPETIÇÃO
                </button>
                <button
                  onClick={() => setCompToDelete(null)}
                  className="w-full py-4 bg-zinc-900 text-zinc-400 font-black rounded-2xl hover:text-zinc-100 transition-all"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
};











const CompetitionRegulamento = ({ comp }: { comp: Competition }) => {
  return (
    <div className="space-y-6">
      {comp.description && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-3">
          <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><BookOpen className="w-4 h-4" /> Sobre a Competição</h3>
          <p className="text-zinc-300 font-bold text-sm leading-relaxed whitespace-pre-line">{comp.description}</p>
        </div>
      )}
      {comp.rules && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-3">
          <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><Shield className="w-4 h-4" /> Regras</h3>
          <p className="text-zinc-300 font-bold text-sm leading-relaxed whitespace-pre-line">{comp.rules}</p>
        </div>
      )}
      {(comp.hashtags || comp.mentions) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {comp.hashtags && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-3">
              <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest"># Hashtags Obrigatórias</h3>
              <div className="flex flex-wrap gap-2">
                {comp.hashtags.split(/[\s,]+/).filter(Boolean).map((tag, i) => (
                  <span key={i} className="px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[11px] font-black">{tag.startsWith('#') ? tag : `#${tag}`}</span>
                ))}
              </div>
            </div>
          )}
          {comp.mentions && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-3">
              <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest">@ Menções Obrigatórias</h3>
              <div className="flex flex-wrap gap-2">
                {comp.mentions.split(/[\s,]+/).filter(Boolean).map((m, i) => (
                  <span key={i} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-[11px] font-black">{m.startsWith('@') ? m : `@${m}`}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {comp.prizes && comp.prizes.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><Trophy className="w-4 h-4" /> Premiação Geral</h3>
            <div className="space-y-2">
              {comp.prizes.map((prize, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black ${i===0?'bg-amber-500/20 text-amber-400':i===1?'bg-zinc-600/20 text-zinc-400':i===2?'bg-orange-700/20 text-orange-500':'bg-zinc-900 text-zinc-500'}`}>{prize.position}º</span>
                    <span className="text-zinc-300 text-sm font-bold">{prize.label || `${prize.position}º lugar`}</span>
                  </div>
                  <span className="text-amber-400 font-black text-sm">R$ {(prize.value||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {comp.prizesDaily && comp.prizesDaily.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><Zap className="w-4 h-4" /> Premiação Diária</h3>
            <div className="space-y-2">
              {comp.prizesDaily.map((prize, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black ${i===0?'bg-amber-500/20 text-amber-400':i===1?'bg-zinc-600/20 text-zinc-400':i===2?'bg-orange-700/20 text-orange-500':'bg-zinc-900 text-zinc-500'}`}>{prize.position}º</span>
                    <span className="text-zinc-300 text-sm font-bold">{prize.label || `${prize.position}º lugar`}</span>
                  </div>
                  <span className="text-amber-400 font-black text-sm">R$ {(prize.value||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {comp.prizesMonthly && comp.prizesMonthly.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Premiação Mensal</h3>
            <div className="space-y-2">
              {comp.prizesMonthly.map((prize, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black ${i===0?'bg-amber-500/20 text-amber-400':i===1?'bg-zinc-600/20 text-zinc-400':i===2?'bg-orange-700/20 text-orange-500':'bg-zinc-900 text-zinc-500'}`}>{prize.position}º</span>
                    <span className="text-zinc-300 text-sm font-bold">{prize.label || `${prize.position}º lugar`}</span>
                  </div>
                  <span className="text-amber-400 font-black text-sm">R$ {(prize.value||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {comp.prizesInstagram && comp.prizesInstagram.length > 0 && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><Camera className="w-4 h-4" /> Premiação Instagram</h3>
            <div className="space-y-2">
              {comp.prizesInstagram.map((prize, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black ${i===0?'bg-amber-500/20 text-amber-400':i===1?'bg-zinc-600/20 text-zinc-400':i===2?'bg-orange-700/20 text-orange-500':'bg-zinc-900 text-zinc-500'}`}>{prize.position}º</span>
                    <span className="text-zinc-300 text-sm font-bold">{prize.label || `${prize.position}º lugar`}</span>
                  </div>
                  <span className="text-amber-400 font-black text-sm">R$ {(prize.value||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {(comp.bonuses || comp.instaBonus || (comp.viewBonus && comp.viewBonus > 0)) && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-3">
          <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><Star className="w-4 h-4" /> Bônus e Multiplicadores</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(comp.viewBonus && comp.viewBonus > 0) ? (
              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Bônus por View</p>
                <p className="text-amber-400 font-black text-lg">x{comp.viewBonus}</p>
              </div>
            ) : null}
            {comp.instaBonus && (
              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 md:col-span-2">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Bônus Instagram</p>
                <p className="text-zinc-300 font-bold text-sm">{comp.instaBonus}</p>
              </div>
            )}
            {comp.bonuses && (
              <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 md:col-span-3">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Outros Bônus</p>
                <p className="text-zinc-300 font-bold text-sm whitespace-pre-line">{comp.bonuses}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CompetitionsView = ({ user, competitions, registrations, onSelectComp }: { 
  user: User, 
  competitions: Competition[], 
  registrations: CompetitionRegistration[],
  onSelectComp: (id: string) => void
}) => {
  const isStaff = user.role === 'admin' || user.role === 'auditor' || user.role === 'administrativo';
  const [selectedRegulamentoComp, setSelectedRegulamentoComp] = useState<Competition | null>(null);
  const [acceptedRules, setAcceptedRules] = useState(false);

  const handleRegister = async (compId: string) => {
    if (!acceptedRules) {
      alert('Você precisa aceitar as regras para participar!');
      return;
    }
    try {
      const regId = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'competition_registrations', regId), {
        id: regId,
        competitionId: compId,
        userId: user.uid,
        userName: user.displayName,
        userEmail: user.email,
        status: 'pending',
        acceptedRules: true,
        timestamp: Date.now()
      });
      alert('Inscrição solicitada com sucesso! Aguarde a aprovação da diretoria.');
      setSelectedRegulamentoComp(null);
      setAcceptedRules(false);
    } catch (error) {
      console.error('Registration error', error);
      alert('Erro ao solicitar inscrição.');
    }
  };

  const now = Date.now();

  const participating = competitions.filter(c => 
    c.isActive && c.endDate >= now && 
    registrations.some(r => r.competitionId === c.id && r.userId === user.uid && r.status === 'approved')
  );

  const available = competitions.filter(c => 
    c.isActive && c.startDate <= now && c.endDate >= now && 
    !registrations.some(r => r.competitionId === c.id && r.userId === user.uid)
  );

  const pendingRequests = competitions.filter(c => 
    c.isActive && c.endDate >= now && 
    registrations.some(r => r.competitionId === c.id && r.userId === user.uid && r.status === 'pending')
  );

  const upcoming = competitions.filter(c =>
    c.isActive && c.startDate > now &&
    !registrations.some(r => r.competitionId === c.id && r.userId === user.uid)
  );

  const CompetitionCard = ({ comp, type }: { comp: Competition, type: 'participating' | 'available' | 'pending' | 'upcoming' }) => (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden glass group">
      {comp.bannerUrl && (
        <div className="h-32 w-full bg-zinc-800/50 relative overflow-hidden">
          <img src={comp.bannerUrl} alt={comp.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 to-transparent" />
        </div>
      )}
      <div className={`p-6 ${comp.bannerUrl ? '-mt-12 relative z-10' : ''}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 flex border items-center justify-center rounded-xl bg-zinc-900 ${
            type === 'participating' ? 'text-emerald-500 border-emerald-500/20' : 
            type === 'pending' ? 'text-amber-500 border-amber-500/20' :
            type === 'upcoming' ? 'text-blue-500 border-blue-500/20' :
            'text-pink-500 border-pink-500/20'
          }`}>
            {type === 'participating' ? <CheckCircle2 className="w-5 h-5" /> : 
             type === 'pending' ? <Clock className="w-5 h-5" /> : 
             type === 'upcoming' ? <Calendar className="w-5 h-5" /> :
             <Trophy className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-black text-lg text-white leading-tight">{comp.title}</h3>
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">
              {new Date(comp.startDate).toLocaleDateString()} - {new Date(comp.endDate).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <p className="text-sm text-zinc-400 font-bold mb-6 line-clamp-2">
          {comp.description}
        </p>

        {type === 'available' && (
          <button
            onClick={() => {
              setSelectedRegulamentoComp(comp);
              setAcceptedRules(false);
            }}
            className="w-full py-4 text-sm font-black gold-bg text-black rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
          >
            SOLICITAR INSCRIÇÃO
          </button>
        )}
        {type === 'pending' && (
          <div className="w-full py-4 text-sm font-black bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center gap-2 border border-amber-500/20">
            AGUARDANDO APROVAÇÃO
          </div>
        )}
        {type === 'participating' && (
          <div className="space-y-3">
            <div className="w-full py-4 text-sm font-black bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center gap-2 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" /> INSCRIÇÃO APROVADA
            </div>
            <button
              onClick={() => onSelectComp(comp.id)}
              className="w-full py-4 text-sm font-black gold-bg text-black rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
            >
              ACESSAR COMPETIÇÃO
            </button>
          </div>
        )}
        {(isStaff && type !== 'participating') && (
          <button
            onClick={() => onSelectComp(comp.id)}
            className="w-full mt-3 py-4 text-[10px] font-black bg-zinc-800 text-zinc-400 rounded-xl hover:text-white transition-colors flex items-center justify-center gap-2 border border-zinc-700/50"
          >
            ACESSAR (MODO ADMIN)
          </button>
        )}
        {type === 'upcoming' && (
          <div className="w-full py-4 text-sm font-black bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center gap-2 border border-blue-500/20">
            <Calendar className="w-4 h-4" /> EM BREVE
          </div>
        )}
        <button
          onClick={() => setSelectedRegulamentoComp(comp)}
          className="w-full mt-3 py-3 text-xs font-black bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          <BookOpen className="w-4 h-4" /> VER INFORMAÇÕES
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="space-y-2">
        <h2 className="text-4xl font-black tracking-tighter">Minhas Competições</h2>
        <p className="text-zinc-400 font-bold">Acompanhe suas inscrições e explore novas competições.</p>
      </div>

      {participating.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="text-xl font-black uppercase tracking-widest text-emerald-500">Participando Atualmente</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {participating.map(c => <CompetitionCard key={c.id} comp={c} type="participating" />)}
          </div>
        </div>
      )}

      {pendingRequests.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <Clock className="w-5 h-5 text-amber-500" />
            <h3 className="text-xl font-black uppercase tracking-widest text-amber-500">Inscrições Pendentes</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingRequests.map(c => <CompetitionCard key={c.id} comp={c} type="pending" />)}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <Trophy className="w-5 h-5 text-pink-500" />
            <h3 className="text-xl font-black uppercase tracking-widest text-pink-500">Disponíveis para Inscrição</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {available.map(c => <CompetitionCard key={c.id} comp={c} type="available" />)}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <Calendar className="w-5 h-5 text-blue-500" />
            <h3 className="text-xl font-black uppercase tracking-widest text-blue-500">Próximas Competições</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcoming.map(c => <CompetitionCard key={c.id} comp={c} type="upcoming" />)}
          </div>
        </div>
      )}

      {participating.length === 0 && available.length === 0 && pendingRequests.length === 0 && upcoming.length === 0 && (
        <div className="py-24 text-center glass rounded-3xl border border-zinc-800/50 space-y-4">
          <Trophy className="w-12 h-12 text-zinc-700 mx-auto" />
          <h3 className="text-xl font-black text-zinc-500 uppercase tracking-widest">Nenhuma competição encontrada</h3>
          <p className="text-zinc-600 font-bold text-sm">Fique de olho, novas competições serão lançadas em breve.</p>
        </div>
      )}

      {selectedRegulamentoComp && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-end md:justify-center p-4 sm:p-6 pb-20">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedRegulamentoComp(null)} />
          <div className="relative w-full max-w-4xl max-h-[85vh] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/50">
               <h2 className="text-xl font-black flex items-center gap-2 text-white"><BookOpen className="w-5 h-5 text-amber-500" /> INFORMAÇÕES DA COMPETIÇÃO</h2>
               <button onClick={() => setSelectedRegulamentoComp(null)} className="p-2 bg-zinc-900 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
               </button>
            </div>
            <div className="overflow-y-auto p-6 scrollbar-hide">
               <CompetitionRegulamento comp={selectedRegulamentoComp} />
               
               {/* Regras e Aceite */}
               {!registrations.find(r => r.competitionId === selectedRegulamentoComp.id && r.userId === user.uid) && (
                 <div className="mt-8 p-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-6">
                    <div className="flex flex-col gap-4">
                      <h3 className="text-sm font-black uppercase text-amber-500 tracking-widest">Termo de Aceite</h3>
                      <label className="flex items-start gap-4 cursor-pointer group">
                        <div className="relative flex items-center mt-1">
                          <input
                            type="checkbox"
                            checked={acceptedRules}
                            onChange={(e) => setAcceptedRules(e.target.checked)}
                            className="peer h-5 w-5 appearance-none rounded border-2 border-zinc-700 bg-zinc-800 transition-all checked:border-amber-500 checked:bg-amber-500"
                          />
                          <Check className="absolute h-3.5 w-3.5 text-black opacity-0 transition-opacity peer-checked:opacity-100 left-0.5" />
                        </div>
                        <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors">
                          Eu li e aceito todas as regras e condições estabelecidas para esta competição.
                        </span>
                      </label>
                    </div>

                    <button
                      onClick={() => handleRegister(selectedRegulamentoComp.id)}
                      disabled={!acceptedRules}
                      className={`w-full py-5 font-black rounded-2xl transition-all shadow-xl ${
                        acceptedRules 
                          ? 'gold-bg text-black hover:scale-[1.02] shadow-amber-500/20' 
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                      }`}
                    >
                      CONFIRMAR E SOLICITAR INSCRIÇÃO
                    </button>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CompetitionDetailView = ({ 
  comp, 
  user, 
  rankings, 
  posts, 
  registrations, 
  onBack,
  setView
}: { 
  comp: Competition, 
  user: User, 
  rankings: User[], 
  posts: Post[], 
  registrations: CompetitionRegistration[],
  onBack: () => void,
  setView: (view: any) => void
}) => {
  const [activeTab, setActiveTab] = useState<'RANKING' | 'POST' | 'REGULAMENTO'>('RANKING');

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Detail */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-800/50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-2xl transition-colors text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-3xl font-black tracking-tighter">{comp.title}</h2>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Explorando competição individual</p>
          </div>
        </div>

        <div className="flex p-1 bg-zinc-900 rounded-2xl border border-zinc-800/50 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('RANKING')}
            className={`flex-1 md:flex-none px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'RANKING' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Trophy className="w-4 h-4" />
            RANKING
          </button>
          <button
            onClick={() => setActiveTab('POST')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'POST' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Send className="w-4 h-4" />
            POSTAR LINK
          </button>
          <button
            onClick={() => setActiveTab('REGULAMENTO')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'REGULAMENTO' ? 'bg-amber-500/20 text-amber-500 shadow-lg' : 'text-zinc-500 hover:text-amber-400'}`}
          >
            <BookOpen className="w-4 h-4" />
            REGULAMENTO
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'RANKING' ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-amber-500/5 border border-amber-500/10 p-6 rounded-3xl">
                  <div className="space-y-1">
                    <h4 className="text-amber-500 font-black uppercase text-xs tracking-widest">Ação Rápida</h4>
                    <p className="text-zinc-400 text-sm font-bold">Deseja enviar novos vídeos para esta competição?</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('POST')}
                    className="px-6 py-3 gold-bg text-black font-black rounded-xl hover:scale-105 transition-all text-xs flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    PROTOCOLAR LINKS
                  </button>
                </div>
                <Rankings rankings={rankings} competitions={[comp]} lockedCompetitionId={comp.id} />
              </div>
            ) : activeTab === 'REGULAMENTO' ? (
              <CompetitionRegulamento comp={comp} />
            ) : (
              <PostSubmit 
                user={user} 
                competitions={[comp]} 
                registrations={registrations} 
                setView={setView} 
                lockedCompetitionId={comp.id} 
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const PostSubmit = ({ user, competitions, registrations, setView, lockedCompetitionId }: {
  user: User,
  competitions: Competition[],
  registrations: CompetitionRegistration[],
  setView: (view: 'DASHBOARD' | 'RANKINGS' | 'POST' | 'HISTORY' | 'ADMIN' | 'SETTINGS' | 'WALLET' | 'SUGGESTIONS' | 'COMPETITIONS') => void,
  lockedCompetitionId?: string
}) => {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<Platform>('tiktok');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedCompId, setSelectedCompId] = useState<string>(lockedCompetitionId || '');
  const [selectedAccountHandle, setSelectedAccountHandle] = useState('');

  useEffect(() => {
    if (lockedCompetitionId) {
      setSelectedCompId(lockedCompetitionId);
    }
  }, [lockedCompetitionId]);

  // Check if the user has an approved registration in any active competition
  const activeCompIds = useMemo(() =>
    competitions.filter(c => c.isActive && c.endDate >= Date.now()).map(c => c.id),
    [competitions]
  );
  
  const hasActiveRegistration = useMemo(() => 
    registrations.some(
      r => r.userId === user.uid && r.status === 'approved' && activeCompIds.includes(r.competitionId)
    ), [registrations, user.uid, activeCompIds]
  );


  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [error, setError] = useState('');
  // removed selectedCompId local state as it is now at the top

  // Get competitions where user is approved
  const approvedCompRegistrations = useMemo(() => 
    registrations.filter(r => r.userId === user.uid && r.status === 'approved'),
    [registrations, user.uid]
  );

  const approvedCompetitions = useMemo(() => 
    competitions.filter(c => approvedCompRegistrations.some(r => r.competitionId === c.id)),
    [competitions, approvedCompRegistrations]
  );

  // Auto-select if only one approved competition
  useEffect(() => {
    if (approvedCompetitions.length === 1 && !selectedCompId) {
      setSelectedCompId(approvedCompetitions[0].id);
    }
  }, [approvedCompetitions, selectedCompId]);

  // Auto-select account handle if only one is available for the platform
  useEffect(() => {
    const handles = platform === 'tiktok' ? (Array.isArray(user.tiktok) ? user.tiktok : (user.tiktok ? [user.tiktok] : [])) :
                  platform === 'instagram' ? (Array.isArray(user.instagram) ? user.instagram : (user.instagram ? [user.instagram] : [])) :
                  (Array.isArray(user.youtube) ? user.youtube : (user.youtube ? [user.youtube] : []));
    
    if (handles.length === 1) {
      setSelectedAccountHandle(handles[0]);
    } else {
      setSelectedAccountHandle('');
    }
  }, [platform, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    setDuplicates([]);
    setError('');
    try {
      const rawUrls = url.split(/[\n,]+/).map(u => u.trim()).filter(u => u.length > 5);

      // 0. Validate if user has the social media registered in their profile
      const userTiktoks = Array.isArray(user.tiktok) ? user.tiktok : (user.tiktok ? [user.tiktok] : []);
      const userYoutube = Array.isArray(user.youtube) ? user.youtube : (user.youtube ? [user.youtube] : []);
      const userInstagram = Array.isArray(user.instagram) ? user.instagram : (user.instagram ? [user.instagram] : []);

      if (platform === 'tiktok' && userTiktoks.length === 0) {
        setError('Você precisa cadastrar pelo menos um @ do TikTok nas configurações antes de enviar links.');
        setSubmitting(false);
        return;
      }
      if (platform === 'youtube' && userYoutube.length === 0) {
        setError('Você precisa cadastrar seu canal do YouTube nas configurações antes de enviar links.');
        setSubmitting(false);
        return;
      }
      if (platform === 'instagram' && userInstagram.length === 0) {
        setError('Você precisa cadastrar pelo menos um @ do Instagram nas configurações antes de enviar links.');
        setSubmitting(false);
        return;
      }

      if (!selectedAccountHandle) {
        setError('Por favor, selecione qual conta você usou para postar este vídeo.');
        setSubmitting(false);
        return;
      }

      // 1. Validate if URL domain matches selected platform
      for (const singleUrl of rawUrls) {
        const u = singleUrl.toLowerCase();
        if (platform === 'tiktok' && !u.includes('tiktok.com')) {
          setError(`Erro: O link "${singleUrl}" não é um vídeo do TikTok válido.`);
          setSubmitting(false);
          return;
        }
        if (platform === 'youtube' && !u.includes('youtube.com') && !u.includes('youtu.be')) {
          setError(`Erro: O link "${singleUrl}" não é um vídeo do YouTube válido.`);
          setSubmitting(false);
          return;
        }
        if (platform === 'instagram' && !u.includes('instagram.com')) {
          setError(`Erro: O link "${singleUrl}" não é um post do Instagram válido.`);
          setSubmitting(false);
          return;
        }
      }

      // Remove internal duplicates in the batch first
      const normalizedMap = new Map<string, string>();
      rawUrls.forEach(u => {
        const norm = normalizeUrl(u);
        if (!normalizedMap.has(norm)) {
          normalizedMap.set(norm, u);
        }
      });

      const urls = Array.from(normalizedMap.values());
      const normalizedToUpload = Array.from(normalizedMap.keys());

      if (urls.length === 0) {
        setSubmitting(false);
        return;
      }

      // Check for duplicate URLs across the entire system (Using queries for better scalability)
      const duplicateFound: string[] = [];
      const normToOriginal = new Map<string, string>();
      normalizedToUpload.forEach(n => normToOriginal.set(n, normalizedMap.get(n)!));

      // Batch query 30 at a time
      const batches = [];
      for (let i = 0; i < normalizedToUpload.length; i += 30) {
        batches.push(normalizedToUpload.slice(i, i + 30));
      }

      for (const batch of batches) {
        // Query by normalizedUrl
        const qNorm = query(collection(db, 'posts'), where('normalizedUrl', 'in', batch));
        const snapNorm = await getDocs(qNorm);
        snapNorm.docs.forEach(doc => {
          const norm = doc.data().normalizedUrl;
          if (norm) duplicateFound.push(normToOriginal.get(norm) || doc.data().url);
        });

        // Query by exact url (fallback for old posts)
        const batchOriginals = batch.map(n => normToOriginal.get(n)!);
        const qOrig = query(collection(db, 'posts'), where('url', 'in', batchOriginals));
        const snapOrig = await getDocs(qOrig);
        snapOrig.docs.forEach(doc => {
          const original = doc.data().url;
          if (!duplicateFound.includes(original)) {
            duplicateFound.push(original);
          }
        });
      }

      if (duplicateFound.length > 0) {
        // Remove potentially identical entries in the duplicateFound list
        const uniqueDuplicates = Array.from(new Set(duplicateFound));
        setDuplicates(uniqueDuplicates);
        setError(`${uniqueDuplicates.length} link(s) já existem no sistema e foram bloqueados.`);
        setSubmitting(false);
        return;
      }

      await Promise.all(urls.map(async (singleUrl) => {
        const postId = Math.random().toString(36).substr(2, 9);
        const norm = normalizeUrl(singleUrl);
        const newPost: Post = {
          id: postId,
          userId: user.uid,
          userName: user.displayName,
          url: singleUrl,
          normalizedUrl: norm,
          platform,
          competitionId: selectedCompId, // Link to selected competition
          accountHandle: selectedAccountHandle,
          status: 'pending',
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          timestamp: Date.now()
        };
        await setDoc(doc(db, 'posts', postId), newPost);
      }));

      if (platform === 'instagram') {
        const uDoc = await getDoc(doc(db, 'users', user.uid));
        const currentCount = uDoc.data()?.dailyInstaPosts || 0;
        await updateDoc(doc(db, 'users', user.uid), { dailyInstaPosts: currentCount + urls.length });
      }

      setSuccess(true);
      setUrl('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'posts');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-black tracking-tighter">Protocolar Link</h2>
        <p className="text-zinc-400">Envie seu vídeo para triagem e sincronização</p>
      </div>

      {!hasActiveRegistration ? (
        <div className="p-8 rounded-3xl glass flex flex-col items-center justify-center text-center space-y-6 border-amber-500/20 border">
          <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center">
            <Trophy className="w-10 h-10 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white">Inscrição Necessária</h3>
            <p className="text-zinc-400 max-w-sm mx-auto">
              Para protocolar links, você precisa estar inscrito e aprovado em uma competição ativa.
            </p>
          </div>
          <button
            onClick={() => setView('COMPETITIONS')}
            className="px-8 py-4 gold-bg text-black font-black rounded-xl hover:scale-105 transition-all w-full md:w-auto"
          >
            VER COMPETIÇÕES
          </button>
        </div>
      ) : (
        <>
      <form onSubmit={handleSubmit} className="p-8 rounded-3xl glass space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Plataforma</label>
          <div className="grid grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setPlatform('tiktok')}
              className={`py-4 rounded-2xl font-bold transition-all border-2 ${platform === 'tiktok' ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-zinc-800 text-zinc-500'}`}
            >
              TikTok
            </button>
            <button
              type="button"
              onClick={() => setPlatform('youtube')}
              className={`py-4 rounded-2xl font-bold transition-all border-2 ${platform === 'youtube' ? 'border-red-500 bg-red-500/10 text-red-500' : 'border-zinc-800 text-zinc-500'}`}
            >
              YouTube
            </button>
            <button
              type="button"
              onClick={() => setPlatform('instagram')}
              className={`py-4 rounded-2xl font-bold transition-all border-2 ${platform === 'instagram' ? 'border-pink-500 bg-pink-500/10 text-pink-500' : 'border-zinc-800 text-zinc-500'}`}
            >
              Instagram
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest flex items-center justify-between">
            <span>Selecione sua Conta vinculada</span>
            <button 
              type="button" 
              onClick={() => setView('SETTINGS')}
              className="text-amber-500 hover:underline"
            >
              Gerenciar Contas
            </button>
          </label>
          <div className="flex flex-wrap gap-2">
            {(platform === 'tiktok' ? (Array.isArray(user.tiktok) ? user.tiktok : (user.tiktok ? [user.tiktok] : [])) :
              platform === 'instagram' ? (Array.isArray(user.instagram) ? user.instagram : (user.instagram ? [user.instagram] : [])) :
              (Array.isArray(user.youtube) ? user.youtube : (user.youtube ? [user.youtube] : []))
            ).map((handle) => (
              <button
                key={handle}
                type="button"
                onClick={() => setSelectedAccountHandle(handle)}
                className={`px-6 py-3 rounded-xl font-black text-xs transition-all border ${selectedAccountHandle === handle 
                  ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
              >
                {handle}
              </button>
            ))}
            {(platform === 'tiktok' ? (Array.isArray(user.tiktok) ? user.tiktok : (user.tiktok ? [user.tiktok] : [])) :
              platform === 'instagram' ? (Array.isArray(user.instagram) ? user.instagram : (user.instagram ? [user.instagram] : [])) :
              (Array.isArray(user.youtube) ? user.youtube : (user.youtube ? [user.youtube] : []))
            ).length === 0 && (
              <p className="text-red-500 text-[10px] font-black uppercase tracking-widest p-4 border border-red-500/20 bg-red-500/5 rounded-2xl w-full">
                Nenhuma conta {platform} cadastrada. Vá em "Gerenciar Contas" para vincular seu perfil.
              </p>
            )}
          </div>
        </div>

        {!lockedCompetitionId && (
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Competição</label>
            <select
              value={selectedCompId}
              onChange={(e) => setSelectedCompId(e.target.value)}
              required
              className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 py-4 font-bold focus:border-amber-500 outline-none transition-colors text-white"
            >
              <option value="" disabled>Selecione a Competição</option>
              {approvedCompetitions.map(comp => (
                <option key={comp.id} value={comp.id}>{comp.title}</option>
              ))}
            </select>
            {approvedCompetitions.length === 0 && (
              <p className="text-[10px] text-red-500 font-bold uppercase mt-1">Você não está aprovado em nenhuma competição.</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">URLs dos Vídeos (um por linha)</label>
          <textarea
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://...&#10;https://..."
            className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 py-4 font-bold focus:border-amber-500 outline-none transition-colors min-h-[120px] resize-y"
          />
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-2">
            <p className="text-red-400 font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
            {duplicates.map((d, i) => (
              <p key={i} className="text-red-300/70 text-[11px] font-mono truncate pl-6">{d}</p>
            ))}
          </div>
        )}
        <button
          disabled={submitting || success}
          className={`w-full py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 ${success ? 'bg-emerald-500 text-black' : 'gold-bg text-black hover:scale-[1.02]'}`}
        >
          {submitting ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-6 h-6 border-2 border-black border-t-transparent rounded-full" />
          ) : success ? (
            <>
              <CheckCircle2 className="w-6 h-6" />
              ENVIADO COM SUCESSO
            </>
          ) : (
            <>
              <Send className="w-6 h-6" />
              PROTOCOLAR AGORA
            </>
          )}
        </button>
      </form>

      <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-zinc-500 shrink-0" />
        <p className="text-xs text-zinc-500 leading-relaxed">
          Certifique-se de que o link é público e está correto. Links inválidos ou privados serão rejeitados automaticamente pela triagem. O prazo de aprovação é de até 24h.
        </p>
      </div>
      </>
      )}
    </div>
  );
};

const HistoryView = ({ posts, onDelete, onRemove, isAdmin }: { 
  posts: Post[], 
  onDelete: (id: string) => void, 
  onRemove: (state: { isOpen: boolean; postId: string; reason: string; consent: boolean }) => void,
  isAdmin: boolean 
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'tiktok' | 'youtube' | 'instagram' | null>(null);
  const [filterDate, setFilterDate] = useState('');

  const filteredPosts = posts.filter(post => {
    // Não mostrar posts deletados para o usuário (soft delete)
    if (post.status === 'deleted') return false;
    const matchesPlatform = selectedPlatform ? post.platform === selectedPlatform : true;
    const matchesDate = !filterDate ? true : new Date(post.timestamp).setHours(0,0,0,0) >= new Date(filterDate).setHours(0,0,0,0);
    return matchesPlatform && matchesDate;
  });

  const getPlatformCount = (p: 'tiktok' | 'youtube' | 'instagram') => posts.filter(post => post.platform === p).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
          {selectedPlatform && (
            <button 
              onClick={() => setSelectedPlatform(null)}
              className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
              title="Voltar ao Hub"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {selectedPlatform ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="capitalize flex items-center gap-2">
                {selectedPlatform === 'tiktok' ? <Zap className="w-6 h-6 text-amber-500" /> :
                 selectedPlatform === 'youtube' ? <TrendingUp className="w-6 h-6 text-red-500" /> :
                 <Camera className="w-6 h-6 text-pink-500" />}
                {selectedPlatform} Protocols
              </span>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                <span className="text-[11px] font-black uppercase text-zinc-100 tracking-widest">{filteredPosts.length} postados</span>
              </div>
            </div>
          ) : (
            "Meus Protocolos"
          )}
        </h2>
        
        {selectedPlatform && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="relative group">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover:text-amber-500/50 transition-colors" />
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl pl-11 pr-4 py-2.5 text-xs font-black text-white focus:outline-none focus:border-amber-500/50 transition-all focus:ring-4 focus:ring-amber-500/5 w-full sm:w-auto uppercase tracking-widest shadow-inner"
              />
            </div>
            {filterDate && (
              <button 
                onClick={() => setFilterDate('')}
                className="p-2.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest hover:border-zinc-700"
              >
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!selectedPlatform ? (
          <motion.div 
            key="hub"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4"
          >
            {[
              { id: 'tiktok', name: 'TikTok', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/10', hover: 'hover:border-amber-500/30' },
              { id: 'instagram', name: 'Instagram', icon: Camera, color: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/10', hover: 'hover:border-pink-500/30' },
              { id: 'youtube', name: 'YouTube', icon: TrendingUp, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/10', hover: 'hover:border-red-500/30' }
            ].map((p, idx) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => setSelectedPlatform(p.id as any)}
                className={`group relative p-10 rounded-[3rem] glass overflow-hidden transition-all duration-500 border-2 ${p.border} ${p.hover} flex flex-col items-center text-center gap-8 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]`}
              >
                <div className={`p-8 rounded-[2rem] ${p.bg} transition-all duration-700 group-hover:scale-110 group-hover:rotate-12 group-hover:shadow-[0_0_30px_rgba(0,0,0,0.2)]`}>
                  <p.icon className={`w-14 h-14 ${p.color}`} />
                </div>
                <div>
                  <h3 className={`text-3xl font-black uppercase tracking-tighter mb-2 ${p.color}`}>{p.name}</h3>
                  <div className="flex items-center gap-2 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                    <p className="text-zinc-200 text-xs font-black uppercase tracking-[0.2em]">{getPlatformCount(p.id as any)} Protocolos</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                  </div>
                </div>
                <div className="mt-2 px-8 py-3 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] transform translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 shadow-xl">
                  ACESSAR REDE
                </div>
                <div className={`absolute -bottom-12 -right-12 w-32 h-32 rounded-full ${p.bg} blur-3xl opacity-0 group-hover:opacity-50 transition-opacity duration-700`} />
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="space-y-8"
          >
            {filteredPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPosts.map(post => {
                  const platformLabel = post.platform === 'tiktok' ? 'TikTok' : post.platform === 'youtube' ? 'YouTube' : 'Instagram';
                  const platformColor = post.platform === 'tiktok' ? 'text-amber-500' : post.platform === 'youtube' ? 'text-red-500' : 'text-pink-500';
                  const platformBg = post.platform === 'tiktok' ? 'bg-amber-500/10 border-amber-500/20' : post.platform === 'youtube' ? 'bg-red-500/10 border-red-500/20' : 'bg-pink-500/10 border-pink-500/20';
                  const platformIcon = post.platform === 'tiktok' ? <Zap className="w-5 h-5" /> : post.platform === 'youtube' ? <TrendingUp className="w-5 h-5" /> : <Camera className="w-5 h-5" />;
                  const buttonHover = post.platform === 'tiktok' ? 'hover:bg-amber-500 hover:text-black hover:border-amber-500 shadow-amber-500/20' : post.platform === 'youtube' ? 'hover:bg-red-500 hover:text-white hover:border-red-500 shadow-red-500/20' : 'hover:bg-pink-500 hover:text-white hover:border-pink-500 shadow-pink-500/20';

                  return (
                    <div key={post.id} className="p-7 rounded-[2.5rem] glass border border-zinc-800/50 space-y-5 group hover:border-zinc-700 transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
                      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border ${platformBg}`}>
                        <span className={platformColor}>{platformIcon}</span>
                        <span className={`text-sm font-black uppercase tracking-widest ${platformColor}`}>{platformLabel}</span>
                        {post.accountHandle && post.accountHandle !== 'ADMIN_MANUAL' && (
                          <div className="flex items-center gap-2">
                             <span className={`text-xs font-black opacity-40 ${platformColor}`}>|</span>
                             <span className={`text-[11px] font-black ${platformColor} tracking-widest uppercase truncate max-w-[100px]`}>{post.accountHandle}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border ${
                          post.status === 'approved' || post.status === 'synced' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10' :
                          post.status === 'rejected' || post.status === 'banned' ? 'bg-red-500/10 text-red-500 border-red-500/10' :
                          'bg-amber-500/10 text-amber-500 border-amber-500/10'
                        }`}>
                          {post.status === 'approved' || post.status === 'synced' ? 'Aprovado' : post.status === 'rejected' || post.status === 'banned' ? 'Recusado' : 'Em Triagem'}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-100 font-black uppercase tracking-widest">{new Date(post.timestamp).toLocaleDateString()}</span>
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('Admin Delete Clicked for post:', post.id);
                                onDelete(post.id);
                              }}
                              className="p-2 rounded-xl bg-red-500/5 text-red-500/40 hover:bg-red-500 hover:text-black transition-all"
                              title="Excluir vídeo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(post.status === 'approved' || post.status === 'synced' || post.status === 'pending') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('User Removal Clicked for post:', post.id);
                                onRemove({ isOpen: true, postId: post.id, reason: '', consent: false });
                              }}
                              className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-red-600 transition-all flex items-center gap-1.5 shadow-lg"
                              title="Solicitar remoção"
                            >
                              Remover
                            </button>
                          )}
                          {post.status === 'removal_requested' && (
                            <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
                              Pendente
                            </div>
                          )}
                        </div>
                      </div>

                      {(post.status === 'rejected' || post.status === 'banned') && post.rejectionReason && (
                        <div className="flex items-start gap-3 px-5 py-4 rounded-3xl bg-red-500/5 border border-red-500/10">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <div className="space-y-1 min-w-0">
                            <p className="text-[8px] font-black text-red-400 uppercase tracking-[0.2em] opacity-50">Motivo da Remoção</p>
                            <p className="text-[11px] font-bold text-red-200/80 leading-relaxed">{post.rejectionReason}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800/50 p-1.5 rounded-2xl">
                        <p className="text-[11px] font-bold truncate text-zinc-100 flex-1 min-w-0 pl-3 uppercase tracking-tighter">{post.url}</p>
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-[9px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${buttonHover}`}
                          title="Abrir link"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Abrir
                        </a>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-zinc-800/50 pt-3">
                        <div className="flex flex-col items-center py-2">
                          <span className="text-zinc-200 text-[9px] font-black uppercase tracking-[0.2em] mb-1">Visualizações</span>
                          <div className="flex items-center gap-2">
                            <Eye className={`w-3.5 h-3.5 ${platformColor} opacity-80`} />
                            <span className="text-[14px] font-black tabular-nums text-white">{(post.views || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-center py-2">
                          <span className="text-zinc-200 text-[9px] font-black uppercase tracking-[0.2em] mb-1">Curtidas</span>
                          <div className="flex items-center gap-2">
                            <Heart className={`w-3.5 h-3.5 ${platformColor} opacity-80`} />
                            <span className="text-[14px] font-black tabular-nums text-white">{(post.likes || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-32 text-center glass rounded-[3rem] border-dashed border-zinc-800 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
                  <AlertCircle className="w-8 h-8 text-zinc-700" />
                </div>
                <h3 className="text-2xl font-black text-zinc-100 uppercase tracking-tighter">Nenhum protocolo encontrado</h3>
                <p className="text-zinc-300 font-bold mt-2 text-sm max-w-xs mx-auto px-4">Não encontramos vídeos na rede {selectedPlatform} com os filtros selecionados.</p>
                {filterDate && (
                  <button 
                    onClick={() => setFilterDate('')}
                    className="mt-8 px-10 py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5"
                  >
                    Resetar Filtro de Data
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Rankings = ({ rankings, competitions, lockedCompetitionId }: { rankings: User[], competitions: Competition[], lockedCompetitionId?: string }) => {
  const [selectedCompId, setSelectedCompId] = useState<string>(lockedCompetitionId || (() => {
    const active = competitions?.find(c => c.isActive);
    return active ? active.id : '';
  }));

  useEffect(() => {
    if (lockedCompetitionId) {
      setSelectedCompId(lockedCompetitionId);
    }
  }, [lockedCompetitionId]);

  const [rankingType, setRankingType] = useState<'DAILY' | 'TOTAL' | 'INSTAGRAM'>('DAILY');

  const selectedCompetition = useMemo(() => 
    competitions?.find(c => c.id === (lockedCompetitionId || selectedCompId)),
    [competitions, selectedCompId, lockedCompetitionId]
  );

  const formatGoalNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  };

  const collectiveProgress = useMemo(() => {
    if (!selectedCompetition || !selectedCompetition.goalTarget) return 0;
    return rankings.reduce((acc, user) => {
      const stats = user.competitionStats?.[selectedCompetition.id];
      if (!stats) return acc;
      return acc + (selectedCompetition.goalMetric === 'likes' ? (stats.likes || 0) : (stats.views || 0));
    }, 0);
  }, [rankings, selectedCompetition]);

  const timeLeft = selectedCompetition ? selectedCompetition.endDate - Date.now() : 0;
  const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));

  const sortedRankings = useMemo(() => {
    if (!selectedCompId) return [];

    return [...rankings]
      .filter(user => {
        const stats = user.competitionStats?.[selectedCompId];
        if (!stats) return false;
        
        // Mostrar TODOS que tenham pelo menos 1 post na competição (ou posts diários se for o caso)
        if (rankingType === 'DAILY') {
          return (stats.dailyPosts || 0) > 0 || (stats.dailyViews || 0) > 0 || (stats.dailyLikes || 0) > 0;
        }
        if (rankingType === 'INSTAGRAM') {
          return (stats.instaPosts || 0) > 0 || (stats.dailyInstaPosts || 0) > 0;
        }
        // Ranking Mensal/Total: mostra todos que postaram na competição em qualquer momento
        return (stats.posts || 0) > 0 || (stats.views || 0) > 0 || (stats.likes || 0) > 0;
      })
      .sort((a, b) => {
        const statsA = a.competitionStats?.[selectedCompId];
        const statsB = b.competitionStats?.[selectedCompId];
        if (!statsA || !statsB) return 0;

        if (rankingType === 'DAILY') {
          return selectedCompetition?.rankingMetric === 'likes' ? (statsB.dailyLikes || 0) - (statsA.dailyLikes || 0) : (statsB.dailyViews || 0) - (statsA.dailyViews || 0);
        }
        if (rankingType === 'INSTAGRAM') return (statsB.dailyInstaPosts || 0) - (statsA.dailyInstaPosts || 0);
        return selectedCompetition?.rankingMetric === 'likes' ? (statsB.likes || 0) - (statsA.likes || 0) : (statsB.views || 0) - (statsA.views || 0);
      });
  }, [rankings, selectedCompId, rankingType]);

  const getPrize = (index: number) => {
    if (!selectedCompetition) return 0;
    if (rankingType === 'DAILY') return selectedCompetition.prizesDaily?.[index]?.value || 0;
    if (rankingType === 'INSTAGRAM') return selectedCompetition.prizesInstagram?.[index]?.value || 0;
    
    // Para Ranking Mensal/Total: prioriza o campo específico prizesMonthly, 
    // mas se estiver zerado (padrão) e houver valor no campo geral prizes, usa o geral.
    const monthlyVal = selectedCompetition.prizesMonthly?.[index]?.value || 0;
    const generalVal = selectedCompetition.prizes?.[index]?.value || 0;
    
    return monthlyVal > 0 ? monthlyVal : generalVal;
  };

  const calculateStats = (player: User) => {
    const stats = player.competitionStats?.[selectedCompId] || {
      views: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: 0, instaPosts: 0,
      dailyViews: 0, dailyLikes: 0, dailyComments: 0, dailyShares: 0, dailySaves: 0, dailyPosts: 0, dailyInstaPosts: 0, balance: 0
    };

    const isDaily = rankingType === 'DAILY' || rankingType === 'INSTAGRAM';
    const views = isDaily ? (stats.dailyViews || 0) : (stats.views || 0);
    const likes = isDaily ? (stats.dailyLikes || 0) : (stats.likes || 0);
    const comments = isDaily ? (stats.dailyComments || 0) : (stats.comments || 0);
    const shares = isDaily ? (stats.dailyShares || 0) : (stats.shares || 0);
    const saves = isDaily ? (stats.dailySaves || 0) : (stats.saves || 0);
    const postCount = isDaily ? (stats.dailyPosts || 0) : (stats.posts || 0);
    
    const totalEngagement = likes + comments + shares + saves;
    const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;

    const instaPosts = isDaily ? (stats.dailyInstaPosts || 0) : (stats.instaPosts || 0);
    
    return { views, likes, comments, shares, saves, engagementRate, posts: postCount, instaPosts };
  };

  const typeLabels: Record<string, string> = {
    DAILY: 'Ranking Diário',
    TOTAL: 'Ranking Mensal',
    INSTAGRAM: 'Ranking Instagram'
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* ─── Informações da Competição (Timer + Meta) ─── */}
      {selectedCompetition && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Timer */}
          {daysLeft >= 0 && (
            <div className="glass border border-amber-500/20 rounded-[24px] p-5 flex items-center gap-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-amber-500 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Encerra em</p>
                <p className="text-3xl font-black text-amber-400 leading-none">{daysLeft} <span className="text-sm text-zinc-500">dias</span></p>
                <p className="text-[10px] font-bold text-zinc-600 uppercase mt-0.5">{selectedCompetition.title}</p>
              </div>
            </div>
          )}

          {/* Meta Coletiva */}
          {selectedCompetition.goalTarget && selectedCompetition.goalTarget > 0 ? (
            <div className={`${daysLeft >= 0 ? 'md:col-span-2' : 'md:col-span-3'} bg-[#0f0f0f] border border-amber-500/20 rounded-[24px] p-5 relative overflow-hidden`}>
              <div className="absolute inset-0 bg-amber-500/3 blur-3xl pointer-events-none" />
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <Target className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-amber-500 uppercase tracking-tight">Meta Coletiva</p>
                      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Bata a meta para liberar renovações!</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {collectiveProgress >= selectedCompetition.goalTarget ? (
                      <span className="text-xs font-black text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> META ATINGIDA!
                      </span>
                    ) : (
                      <span className="text-xs font-black text-amber-400/70 bg-amber-500/5 px-3 py-1 rounded-full border border-amber-500/10">
                        {((collectiveProgress / selectedCompetition.goalTarget) * 100).toFixed(1)}% completo
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-400">{formatGoalNumber(collectiveProgress)}</span>
                  <span className="text-sm font-bold text-zinc-600">/ {formatGoalNumber(selectedCompetition.goalTarget)} {selectedCompetition.goalMetric === 'likes' ? 'curtidas' : 'views'}</span>
                </div>

                <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 relative overflow-hidden transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min((collectiveProgress / selectedCompetition.goalTarget) * 100, 100)}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            daysLeft < 0 && <div />
          )}
        </div>
      )}

      {/* ─── Barra de Controle Unificada ─── */}
      <div className="glass border border-zinc-800/50 rounded-[24px] p-4 flex flex-col md:flex-row md:items-center gap-4">
        
        {/* Seletor de Competição */}
        {competitions && competitions.filter(c => c.isActive).length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest shrink-0">Competição</span>
            <div className="flex flex-wrap gap-1.5">
              {competitions.filter(c => c.isActive).map(comp => (
                <button
                  key={comp.id}
                  onClick={() => setSelectedCompId(comp.id)}
                  className={`px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                    selectedCompId === comp.id
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                      : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800'
                  }`}
                >
                  {comp.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {competitions && competitions.filter(c => c.isActive).length > 1 && (
          <div className="hidden md:block w-px h-6 bg-zinc-800 mx-1" />
        )}

        {/* Tabs de Tipo de Ranking */}
        <div className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/50 w-fit">
          {[
            { key: 'DAILY', label: 'Diário' },
            { key: 'TOTAL', label: 'Mensal' },
            { key: 'INSTAGRAM', label: 'Instagram', icon: <Camera className="w-3 h-3" /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setRankingType(tab.key as any)}
              className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 whitespace-nowrap ${
                rankingType === tab.key
                  ? tab.key === 'INSTAGRAM'
                    ? 'bg-pink-500/20 text-pink-400 border border-pink-500/20 shadow-sm'
                    : 'bg-zinc-800 text-white shadow-sm'
                  : tab.key === 'INSTAGRAM'
                    ? 'text-zinc-500 hover:text-pink-400 hover:bg-pink-500/5'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Métrica badge (direita) */}
        <div className="md:ml-auto">
          {rankingType !== 'INSTAGRAM' && selectedCompetition && (
            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border w-fit ${
              selectedCompetition.rankingMetric === 'likes'
                ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
            }`}>
              {selectedCompetition.rankingMetric === 'likes' ? <Heart className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {selectedCompetition.rankingMetric === 'likes' ? 'Rankeando por Curtidas' : 'Rankeando por Views'}
            </span>
          )}
        </div>
      </div>

      {/* ─── Tabela de Ranking ─── */}
      <div className="space-y-3">
        {/* Cabeçalho da Tabela - Refinado */}
        {sortedRankings.length > 0 && (
          <div className="hidden md:grid grid-cols-[80px_1fr_480px_160px] gap-4 px-8 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-y border-white/5 bg-white/[0.01]">
            <span>Posição</span>
            <span>Participante</span>
            <span className="text-center">Desempenho Social (Engajamento Total)</span>
            <span className="text-right">Prêmios</span>
          </div>
        )}

        {sortedRankings.length === 0 && (
          <div className="py-24 text-center glass rounded-[2rem] border-white/5 space-y-4">
            <div className="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center mx-auto border border-white/5">
              <Trophy className="w-10 h-10 text-zinc-800" />
            </div>
            <div>
              <p className="text-zinc-400 font-black uppercase tracking-widest text-base">Ranking em apuração</p>
              <p className="text-zinc-600 text-xs font-bold mt-1">Os dados estão sendo sincronizados com as redes sociais...</p>
            </div>
          </div>
        )}

        {sortedRankings.map((player, i) => {
          const stats = calculateStats(player);
          const prize = getPrize(i);
          const isTop3 = i < 3;
          
          return (
            <motion.div
              key={player.uid}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 100 }}
              className={`group relative flex flex-col md:grid md:grid-cols-[80px_1fr_480px_160px] gap-4 items-center
                p-5 md:px-8 md:py-6 rounded-3xl border transition-all duration-500 overflow-hidden
                ${i === 0 ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/30' :
                  i === 1 ? 'bg-gradient-to-br from-zinc-400/10 via-zinc-400/5 to-transparent border-zinc-400/30' :
                  i === 2 ? 'bg-gradient-to-br from-orange-800/20 via-orange-800/5 to-transparent border-orange-800/30' :
                  'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'}`}
            >
              {/* Shimmer Effect on Hover */}
              <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent skew-x-12 pointer-events-none" />

              {/* Posição Badge - PREMIUM METALLIC LOOK */}
              <div className="relative group/badge shrink-0">
                <div className={`
                  w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-500 group-hover:scale-110 border-2 border-white/10 relative overflow-hidden
                  ${i === 0 ? 'bg-gradient-to-br from-[#FFEDBB] via-[#FDB931] to-[#B8860B] text-black shadow-amber-500/20' :
                    i === 1 ? 'bg-gradient-to-br from-[#F8F8F8] via-[#D1D1D1] to-[#AFAFAF] text-black shadow-white/10' :
                    i === 2 ? 'bg-gradient-to-br from-[#FFDAB9] via-[#CD7F32] to-[#8B4513] text-white shadow-orange-900/20' :
                    'bg-zinc-900 border-white/5 text-zinc-500'}
                `}>
                  {/* Subtle Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover/badge:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
                  
                  <span className="text-2xl font-black tracking-tighter tabular-nums z-10">{i + 1}º</span>
                </div>

                {/* Floating Podium Icon Badge - VIBRANT & HIGH CONTRAST */}
                {isTop3 && (
                  <>
                    <motion.div 
                      key={`badge-vibrant-${i}`}
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1.1, rotate: 0 }}
                      className={`absolute -top-2.5 -right-2.5 z-30 p-2 rounded-xl shadow-[0_5px_15px_rgba(0,0,0,0.6)] border-2 ${
                        i === 0 ? 'bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-600 border-yellow-100 text-black' : 
                        i === 1 ? 'bg-gradient-to-br from-zinc-100 via-slate-400 to-zinc-600 border-white text-black' : 
                        'bg-gradient-to-br from-orange-400 via-orange-600 to-orange-800 border-orange-300 text-white'
                      }`}
                    >
                      {i === 0 && <Crown className="w-4 h-4 fill-current drop-shadow-md" />}
                      {i === 1 && <Award className="w-4 h-4 fill-current drop-shadow-md" />}
                      {i === 2 && <Star className="w-4 h-4 fill-current drop-shadow-md" />}
                    </motion.div>
                    <div className={`absolute -inset-3 blur-3xl opacity-20 animate-pulse rounded-2xl -z-10
                      ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-white' : 'bg-orange-500'}`} />
                  </>
                )}
              </div>

              {/* Criador & Avatar */}
              <div className="flex items-center gap-5 min-w-0 flex-1 w-full md:w-auto">
                <div className="relative">
                  <img
                    src={player.photoURL || `https://ui-avatars.com/api/?name=${player.displayName}&background=random&bold=true`}
                    className={`w-14 h-14 rounded-2xl border-2 object-cover transition-all group-hover:rotate-3
                      ${i === 0 ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 
                        i === 1 ? 'border-zinc-400 shadow-[0_0_20px_rgba(161,161,170,0.2)]' :
                        i === 2 ? 'border-orange-600' : 'border-zinc-800'}`}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                  {isTop3 && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-black border border-white/10 rounded-full flex items-center justify-center shadow-xl">
                      <Star className={`w-3.5 h-3.5 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : 'text-orange-500'}`} fill="currentColor" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-black text-lg tracking-tight truncate ${i === 0 ? 'text-amber-100' : 'text-white'}`}>
                      @{player.displayName}
                    </p>
                    {player.role === 'admin' && (
                      <div className="bg-blue-500/10 p-1 rounded-md">
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Criador Verificado</p>
                  
                  {/* Mobile Stats Grid - Optimized for all 5 metrics */}
                  <div className="md:hidden grid grid-cols-3 gap-2 mt-4 p-3 bg-black/40 rounded-xl border border-white/5">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-zinc-600 uppercase font-black">Views</span>
                      <span className="text-xs font-black text-cyan-400">{stats.views.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-zinc-600 uppercase font-black">Likes</span>
                      <span className="text-xs font-black text-pink-500">{stats.likes.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-zinc-600 uppercase font-black">Comms</span>
                      <span className="text-xs font-black text-emerald-500">{stats.comments.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-zinc-600 uppercase font-black">Shares</span>
                      <span className="text-xs font-black text-blue-500">{stats.shares.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-zinc-600 uppercase font-black">Saves</span>
                      <span className="text-xs font-black text-purple-500">{stats.saves.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-zinc-600 uppercase font-black">{rankingType === 'INSTAGRAM' ? 'IG Posts' : 'Posts'}</span>
                      <span className="text-xs font-black text-zinc-400">{rankingType === 'INSTAGRAM' ? stats.instaPosts : stats.posts}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop: ALL Metrics Group */}
              <div className="hidden md:flex items-center justify-center gap-1.5 p-2 bg-black/40 rounded-2xl border border-white/5 h-full min-w-full">
                {/* Views */}
                <div className="flex-1 flex flex-col items-center justify-center min-w-[70px] border-r border-white/5 px-2">
                  <Eye className="w-4 h-4 text-cyan-500 mb-1" />
                  <span className="text-[14px] font-black text-cyan-400 tabular-nums">{stats.views.toLocaleString()}</span>
                  <span className="text-[8px] font-black text-zinc-600 uppercase">Views</span>
                </div>
                {/* Likes */}
                <div className="flex-1 flex flex-col items-center justify-center min-w-[70px] border-r border-white/5 px-2">
                  <Heart className={`w-4 h-4 text-pink-500 mb-1 ${stats.likes > 0 ? 'fill-pink-500' : ''}`} />
                  <span className="text-[14px] font-black text-pink-400 tabular-nums">{stats.likes.toLocaleString()}</span>
                  <span className="text-[8px] font-black text-zinc-600 uppercase">Likes</span>
                </div>
                {/* Comments */}
                <div className="flex-1 flex flex-col items-center justify-center min-w-[70px] border-r border-white/5 px-2">
                  <MessageSquare className="w-4 h-4 text-emerald-500 mb-1" />
                  <span className="text-[14px] font-black text-emerald-400 tabular-nums">{stats.comments.toLocaleString()}</span>
                  <span className="text-[8px] font-black text-zinc-600 uppercase">Comms</span>
                </div>
                {/* Shares */}
                <div className="flex-1 flex flex-col items-center justify-center min-w-[70px] border-r border-white/5 px-2">
                  <Share2 className="w-4 h-4 text-blue-500 mb-1" />
                  <span className="text-[14px] font-black text-blue-400 tabular-nums">{stats.shares.toLocaleString()}</span>
                  <span className="text-[8px] font-black text-zinc-600 uppercase">Shares</span>
                </div>
                {/* Saves */}
                <div className="flex-1 flex flex-col items-center justify-center min-w-[70px] border-r border-white/5 px-2">
                  <Bookmark className="w-4 h-4 text-purple-500 mb-1" />
                  <span className="text-[14px] font-black text-purple-400 tabular-nums">{stats.saves.toLocaleString()}</span>
                  <span className="text-[8px] font-black text-zinc-600 uppercase">Saves</span>
                </div>
                {/* Posts */}
                <div className="flex-1 flex flex-col items-center justify-center min-w-[70px] px-2">
                  <Camera className={`w-4 h-4 ${rankingType === 'INSTAGRAM' ? 'text-pink-500' : 'text-zinc-400'} mb-1`} />
                  <span className="text-[14px] font-black text-white tabular-nums">{rankingType === 'INSTAGRAM' ? stats.instaPosts : stats.posts}</span>
                  <span className="text-[8px] font-black text-zinc-600 uppercase">{rankingType === 'INSTAGRAM' ? 'IG Posts' : 'Posts'}</span>
                </div>
              </div>

              {/* Desktop: Prêmio - PREMIUM NEON LOOK */}
              <div className="hidden md:flex flex-col items-end">
                {prize > 0 ? (
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] text-zinc-600 font-black uppercase tracking-[0.2em] mb-1.5 opacity-60">Estimativa Prêmio</span>
                    <div className={`
                      px-5 py-2.5 rounded-2xl font-black text-xl tracking-tighter transition-all duration-300
                      flex items-center gap-2 border-2 shadow-[0_0_25px_rgba(0,0,0,0.5)]
                      ${isTop3 ? 
                        'bg-gradient-to-br from-amber-500/20 via-black/40 to-amber-900/20 border-amber-500/40 text-amber-400 shadow-amber-500/10 group-hover:border-amber-400 group-hover:scale-105' : 
                        'bg-gradient-to-br from-emerald-500/20 via-black/40 to-emerald-900/20 border-emerald-500/40 text-emerald-400 shadow-emerald-500/10 group-hover:border-emerald-400 group-hover:scale-105'
                      }
                    `}>
                      <span className="text-xs opacity-50 font-bold">R$</span>
                      <span className="tabular-nums">{prize.toLocaleString()}</span>
                      {isTop3 && <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-300" />}
                    </div>
                  </div>
                ) : (
                  <div className="h-10 flex items-center">
                    <span className="w-8 h-[2px] bg-zinc-900 rounded-full" />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};


const UserListRow = ({
  user,
  onViewLinks,
  onEdit,
  onRemove,
  onArchive,
  onUpdateRole
}: {
  user: User,
  onViewLinks: (uid: string) => void,
  onEdit: (user: User | any) => void,
  onRemove: (uid: string) => void,
  onArchive: (uid: string) => void,
  onUpdateRole: (uid: string, role: UserRole) => void
}) => (
  <div className="grid grid-cols-[1.5fr_1.2fr_1fr_220px] gap-4 items-center py-2 px-8 hover:bg-white/[0.03] transition-all group border-b border-zinc-900/50 last:border-0">
    <div className="flex items-center gap-3 min-w-0">
      <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-8 h-8 rounded-lg object-cover shrink-0" alt="" />
      <div className="flex flex-col min-w-0">
        <span className="font-black text-xs text-white truncate uppercase">{user.displayName}</span>
        {user.password && <span className="text-[8px] font-mono text-zinc-600 uppercase">Senha: {user.password}</span>}
      </div>
    </div>
    <div className="truncate text-[11px] font-bold text-zinc-500">{user.email}</div>
    <div>
      <select
        value={user.role}
        onChange={(e) => onUpdateRole(user.uid, e.target.value as any)}
        className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[9px] font-black uppercase text-amber-500 outline-none focus:border-amber-500 cursor-pointer w-full max-w-[120px]"
      >
        <option value="user">USUÁRIO</option>
        <option value="auditor">AUDITOR</option>
        <option value="administrativo">ADMINISTRATIVO</option>
        <option value="admin">DIRETORIA</option>
      </select>
    </div>
    <div className="flex items-center justify-end gap-2">
      <button onClick={() => onViewLinks(user.uid)} className="p-2 rounded-lg bg-zinc-900/50 text-zinc-500 hover:text-white transition-all" title="Ver Links">
        <BarChart3 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => {
          onEdit(user);
        }}
        className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 font-black text-[9px] hover:bg-zinc-800 transition-all"
      >
        EDITAR
      </button>
      <button onClick={() => onArchive(user.uid)} className="p-2 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black transition-all" title="Arquivar Usuário">
        <Archive className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onRemove(user.uid)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all" title="Excluir Definitivamente">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

const PendingUserRow = ({ user, onApprove, onRemove, onArchive }: { user: User, onApprove: (uid: string) => void, onRemove: (uid: string) => void, onArchive: (uid: string) => void }) => (
  <div className="grid grid-cols-[1.5fr_1.5fr_200px] gap-4 items-center py-2 px-8 hover:bg-white/[0.03] transition-all group border-b border-zinc-900/50 last:border-0">
    <div className="flex items-center gap-3 min-w-0">
      <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-8 h-8 rounded-lg object-cover shrink-0" alt="" />
      <span className="font-black text-xs text-white truncate uppercase">{user.displayName}</span>
    </div>
    <div className="truncate text-xs font-bold text-zinc-500">{user.email}</div>
    <div className="flex items-center justify-end gap-2">
      <button onClick={() => onApprove(user.uid)} className="px-4 py-1.5 rounded-lg bg-emerald-500 text-black font-black text-[10px] hover:scale-105 transition-all">
        APROVAR
      </button>
      <button onClick={() => onArchive(user.uid)} className="p-2 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black transition-all" title="Arquivar Solicitação">
        <Archive className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onRemove(user.uid)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all" title="Excluir Solicitação">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

const ArchivedUserRow = ({ user, onRestore, onRemove }: { user: User, onRestore: (uid: string) => void, onRemove: (uid: string) => void }) => (
  <div className="grid grid-cols-[1.5fr_1.5fr_200px] gap-4 items-center py-2 px-8 hover:bg-white/[0.03] transition-all group border-b border-zinc-900/50 last:border-0 opacity-60">
    <div className="flex items-center gap-3 min-w-0">
      <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-8 h-8 rounded-lg object-cover shrink-0" alt="" />
      <span className="font-black text-xs text-white truncate uppercase">{user.displayName}</span>
    </div>
    <div className="truncate text-xs font-bold text-zinc-500">{user.email}</div>
    <div className="flex items-center justify-end gap-2">
      <button onClick={() => onRestore(user.uid)} className="px-4 py-1.5 rounded-lg bg-amber-500 text-black font-black text-[10px] hover:scale-105 transition-all">
        RESTAURAR
      </button>
      <button onClick={() => onRemove(user.uid)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all" title="Excluir Permanentemente">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);


const ListHeader = ({ columns, gridClass }: { columns: string[], gridClass: string }) =>
 (
  <div className={`hidden md:grid ${gridClass} gap-4 px-8 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] border-y border-white/5 bg-white/[0.01] sticky top-0 z-20 backdrop-blur-md`}>
    {columns.map((col, idx) => (
      <span key={idx} className={idx === columns.length - 1 ? 'text-right' : ''}>{col}</span>
    ))}
  </div>
);

const FinancialRow = ({ user, onViewLinks, compId, isPaidView }: { user: User, onViewLinks: (uid: string) => void, compId?: string, isPaidView?: boolean }) => {
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  
  const rawBalance = user.competitionStats?.[compId || '']?.balance || 0;
  const balance = Number(rawBalance);
  
  const handlePay = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!compId || balance <= 0) {
      return; // Do nothing silently if disabled
    }

    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000); // Cancela a confirmação após 3 segundos
      return;
    }

    setSaving(true);
    setConfirming(false);
    
    try {
      const auditorId = auth.currentUser?.uid || 'system';
      const timestamp = Date.now();
      
      const batch = writeBatch(db);

      // 1. Registra a transação
      const transRef = doc(collection(db, 'transactions'));
      batch.set(transRef, {
        userId: user.uid,
        amount: balance,
        timestamp,
        status: 'paid',
        auditorId,
        competitionId: compId
      });

      // 2. Atualiza o usuário
      const allCompStats = user.competitionStats || {};
      const newGlobalBalance = Object.entries(allCompStats).reduce((acc, [cid, stats]: [string, any]) => {
        if (cid === compId) return acc;
        return acc + Number(stats?.balance || 0);
      }, 0);

      const dataToUpdate: any = {
        [`competitionStats.${compId}.balance`]: 0,
        [`competitionStats.${compId}.paidTotal`]: Number(user.competitionStats?.[compId]?.paidTotal || 0) + balance,
        balance: newGlobalBalance,
        lifetimeEarnings: Number(user.lifetimeEarnings || 0) + balance
      };

      const userRef = doc(db, 'users', user.uid);
      batch.update(userRef, dataToUpdate);

      await batch.commit();

    } catch (error: any) {
      console.error('Erro no processamento do pagamento:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-[1.5fr_1fr_1.5fr_150px_220px] gap-4 items-center py-4 px-8 hover:bg-white/[0.02] transition-all group border-b border-zinc-900/50 last:border-0 min-h-[72px]">
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative shrink-0">
          <img
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
            className={`w-12 h-12 rounded-2xl object-cover border-2 shadow-2xl transition-all group-hover:scale-105 ${
              isPaidView ? 'border-emerald-500/30 shadow-emerald-500/5' : 'border-amber-500/30 shadow-amber-500/5'
            }`}
            alt=""
          />
          <div className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-black flex items-center justify-center ${
            isPaidView ? 'bg-emerald-500' : 'bg-amber-500'
          }`}>
            {isPaidView ? <CheckCircle2 className="w-3 h-3 text-black" /> : <Zap className="w-3 h-3 text-black" />}
          </div>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-black text-[13px] text-white truncate uppercase tracking-tight leading-tight">{user.displayName}</span>
          <span className="text-zinc-600 text-[9px] font-black uppercase truncate tracking-widest mt-0.5 opacity-60">ID: {user.uid.slice(0, 8)}</span>
        </div>
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <CreditCard className="w-3 h-3 text-zinc-700" />
          <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest whitespace-nowrap">CHAVE PIX</span>
        </div>
        <span className="font-black text-[11px] text-white truncate tracking-tight select-all selection:bg-amber-500 selection:text-black">
          {user.pixKey || 'CHAVE NÃO INFORMADA'}
        </span>
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <Coins className={`w-3 h-3 ${isPaidView ? 'text-emerald-500/50' : 'text-amber-500/50'}`} />
          <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest">{isPaidView ? 'HISTÓRICO PAGO' : 'VALOR A REPASSAR'}</span>
        </div>
        <p className={`text-[16px] font-black tabular-nums truncate tracking-tighter ${isPaidView ? 'text-emerald-500' : 'text-amber-500'}`}>
          R$ {(isPaidView ? (user.competitionStats?.[compId || '']?.paidTotal || 0) : balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="text-center">
        {isPaidView ? (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
            CONCLUÍDO
          </span>
        ) : (
          <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
            balance > 0 
              ? 'bg-red-500/10 text-red-500 border-red-500/20 shadow-lg shadow-red-500/5' 
              : 'bg-zinc-900 text-zinc-600 border-zinc-800'
          }`}>
            {balance > 0 ? 'PENDENTE' : 'ZERADO'}
          </span>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => onViewLinks(user.uid)}
          className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 transition-all"
          title="Ver links postados"
        >
          <BarChart3 className="w-4 h-4" />
        </button>
        {!isPaidView && (
          <button
            onClick={handlePay}
            disabled={saving || balance <= 0}
            className={`px-5 py-2.5 disabled:bg-zinc-900 disabled:text-zinc-700 disabled:border-zinc-800 rounded-2xl font-black text-[10px] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2.5 uppercase tracking-widest disabled:shadow-none min-w-[120px] ${
              confirming ? 'bg-red-500 text-white animate-pulse shadow-[0_4px_20px_rgba(239,68,68,0.4)]' : 'gold-bg text-black shadow-[0_4px_20px_rgba(245,158,11,0.2)]'
            }`}
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : confirming ? (
              <AlertCircle className="w-4 h-4 text-white" />
            ) : (
              <Zap className="w-4 h-4 fill-current" />
            )}
            {saving ? 'PAGANDO...' : confirming ? 'CONFIRMAR?' : 'PAGAR'}
          </button>
        )}
      </div>
    </div>
  );
};


const AdminPanel = ({
  userRole,
  posts,
  pendingUsers,
  approvedUsers,
  archivedUsers,
  settings,
  competitions,
  registrations,
  announcements,
  timerConfig,
  handleUpdateTimer,
  onSettingsUpdate,
  editingCompId,
  setEditingCompId,
  setCompToDelete,
  setPostToDelete,
  handlePostStatus,
  handleUserApproval,
  handleDeleteUser,
  handleArchiveUser,
  handleRegistrationStatus,
  handleDeleteRegistration,
  handleResetDailyRanking,
  handleUpdateCompetitionStatus,
  handleBannerUpload,
  handleCreateCompetition,
  handleEditCompClick,
  handleEditUser,
  handleCreateAnnouncement,
  handleDeleteAnnouncement,
  handleDeleteSuggestion,
  handleUpdateSuggestionStatus,
  handleUpdateUserRole,
  handleApproveRemoval,
  handleRejectRemoval,
  handleRankingResetOnly,
  suggestions,
  compTitle,
  setCompTitle,
  compRankingMetric,
  setCompRankingMetric,
  compGoalTarget,
  setCompGoalTarget,
  compGoalMetric,
  setCompGoalMetric,
  compDesc,
  setCompDesc,
  compRules,
  setCompRules,
  compHashtags,
  setCompHashtags,
  compMentions,
  setCompMentions,
  compBonuses,
  setCompBonuses,
  compInstaBonus,
  setCompInstaBonus,
  compViewBonus,
  setCompViewBonus,
  compStartDate,
  setCompStartDate,
  compEndDate,
  setCompEndDate,
  compBanner,
  setCompBanner,
  compPositions,
  setCompPositions,
  compPrizes,
  setCompPrizes,
  compPositionsDaily,
  setCompPositionsDaily,
  compPrizesDaily,
  setCompPrizesDaily,
  compPositionsMonthly,
  setCompPositionsMonthly,
  compPrizesMonthly,
  setCompPrizesMonthly,
  compPositionsInstagram,
  setCompPositionsInstagram,
  compPrizesInstagram,
  setCompPrizesInstagram,
  isCreatingComp,
  setIsCreatingComp,
  editingUser,
  setEditingUser,
  editName,
  setEditName,
  editPass,
  setEditPass,
  editRole,
  setEditRole,
  annTitle,
  setAnnTitle,
  annMsg,
  setAnnMsg,
  isCreatingAnn,
  setIsCreatingAnn,
  handleSystemCleanup,
  rejectionReason,
  setRejectionReason,
  setRejectionModal
}: {
  userRole: UserRole;
  posts: Post[];
  pendingUsers: User[];
  approvedUsers: User[];
  archivedUsers: User[];
  settings: { apifyKey: string; lastSync?: string; lastResync?: string };
  competitions: Competition[];
  registrations: CompetitionRegistration[];
  announcements: Announcement[];
  timerConfig: { enabled: boolean; endTime: number | null; targetTime: string; message: string };
  handleUpdateTimer: (config: { enabled: boolean; endTime: number | null; targetTime: string; message: string }) => Promise<void>;
  onSettingsUpdate: (s: { apifyKey: string; lastSync?: string; lastResync?: string }) => void;
  editingCompId: string | null;
  setEditingCompId: (val: string | null) => void;
  setCompToDelete: (val: string | null) => void;
  setPostToDelete: (id: string | null) => void;
  handlePostStatus: (postId: string, status: PostStatus) => void;
  handleUserApproval: (userId: string, isApproved: boolean) => void;
  handleDeleteUser: (userId: string) => void;
  handleArchiveUser: (userId: string, archive: boolean) => void;
  handleRegistrationStatus: (regId: string, status: 'approved' | 'rejected' | 'pending') => void;
  handleDeleteRegistration: (regId: string) => void;
  handleResetDailyRanking: (compId?: string) => void;
  handleUpdateCompetitionStatus: (id: string, status: 'active' | 'inactive' | 'upcoming') => void;
  handleBannerUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCreateCompetition: () => void;
  handleEditCompClick: (comp: Competition) => void;
  handleEditUser: () => void;
  handleCreateAnnouncement: () => void;
  handleDeleteAnnouncement: (id: string) => void;
  handleDeleteSuggestion: (id: string) => void;
  handleUpdateSuggestionStatus: (id: string, status: Suggestion['status']) => void;
  handleUpdateUserRole: (uid: string, role: UserRole) => void;
  handleApproveRemoval: (postId: string) => void;
  handleRejectRemoval: (postId: string) => void;
  handleRankingResetOnly: () => void;
  suggestions: Suggestion[];
  compTitle: string;
  setCompTitle: (v: string) => void;
  compRankingMetric: 'views' | 'likes';
  setCompRankingMetric: (v: 'views' | 'likes') => void;
  compGoalTarget: number;
  setCompGoalTarget: (v: number) => void;
  compGoalMetric: 'views' | 'likes';
  setCompGoalMetric: (v: 'views' | 'likes') => void;
  compDesc: string;
  setCompDesc: (v: string) => void;
  compRules: string;
  setCompRules: (v: string) => void;
  compHashtags: string;
  setCompHashtags: (v: string) => void;
  compMentions: string;
  setCompMentions: (v: string) => void;
  compBonuses: string;
  setCompBonuses: (v: string) => void;
  compInstaBonus: string;
  setCompInstaBonus: (v: string) => void;
  compViewBonus: number;
  setCompViewBonus: (v: number) => void;
  compStartDate: string;
  setCompStartDate: (v: string) => void;
  compEndDate: string;
  setCompEndDate: (v: string) => void;
  compBanner: string;
  setCompBanner: (v: string) => void;
  compPositions: number;
  setCompPositions: (v: number) => void;
  compPrizes: { position: number; value: number; label: string }[];
  setCompPrizes: (v: { position: number; value: number; label: string }[]) => void;
  compPositionsDaily: number;
  setCompPositionsDaily: (v: number) => void;
  compPrizesDaily: { position: number; value: number; label: string }[];
  setCompPrizesDaily: (v: { position: number; value: number; label: string }[]) => void;
  compPositionsMonthly: number;
  setCompPositionsMonthly: (v: number) => void;
  compPrizesMonthly: { position: number; value: number; label: string }[];
  setCompPrizesMonthly: (v: { position: number; value: number; label: string }[]) => void;
  compPositionsInstagram: number;
  setCompPositionsInstagram: (v: number) => void;
  compPrizesInstagram: { position: number; value: number; label: string }[];
  setCompPrizesInstagram: (v: { position: number; value: number; label: string }[]) => void;
  isCreatingComp: boolean;
  setIsCreatingComp: (v: boolean) => void;
  handleSystemCleanup: () => void;
  editingUser: User | null;
  setEditingUser: (v: User | null) => void;
  editName: string;
  setEditName: (v: string) => void;
  editPass: string;
  setEditPass: (v: string) => void;
  editRole: UserRole;
  setEditRole: (v: UserRole) => void;
  annTitle: string;
  setAnnTitle: (v: string) => void;
  annMsg: string;
  setAnnMsg: (v: string) => void;
  isCreatingAnn: boolean;
  setIsCreatingAnn: (v: boolean) => void;
  rejectionReason: string;
  setRejectionReason: (v: string) => void;
  setRejectionModal: (v: { isOpen: boolean; postId: string; status: PostStatus }) => void;
}) => {
  const [tab, setTab] = useState<'VISAO_GERAL' | 'POSTS' | 'USERS' | 'USERS_APPROVED' | 'COMPETITIONS' | 'SYNC' | 'REGISTROS' | 'AVISOS' | 'TIMER' | 'FINANCEIRO' | 'ACESSOS' | 'SUGESTOES' | 'RESSINCRONIZACAO' | 'SINCRONIZACAO' | 'ARCHIVED' | 'RELATORIOS' | 'REMOVED_POSTS' | 'REMOVAL_REQUESTS'>('VISAO_GERAL');
  const [selectedSyncCompId, setSelectedSyncCompId] = useState<string>('ALL');
  const [selectedResetCompId, setSelectedResetCompId] = useState<string>('');
  const [auditUserId, setAuditUserId] = useState<string | null>(null);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingPostId, setSyncingPostId] = useState<string | null>(null);
  const [apifyKey, setApifyKey] = useState(settings.apifyKey);
  const [financeTab, setFinanceTab] = useState<'RESUMO' | 'PENDING' | 'REALIZED'>('RESUMO');
  const [financeCompId, setFinanceCompId] = useState<string>(() => competitions[0]?.id || '');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'auditor' | 'administrativo' | 'admin'>('user');
  const [creatingUser, setCreatingUser] = useState(false);
  const [syncDetailCompId, setSyncDetailCompId] = useState<string | null>(null);
  const [validatedPostsLocal, setValidatedPostsLocal] = useState<string[]>([]);

  // States for Admin Manual Link Submission
  const [adminManualUrl, setAdminManualUrl] = useState('');
  const [adminManualPlatform, setAdminManualPlatform] = useState<'tiktok' | 'youtube' | 'instagram'>('tiktok');
  const [adminManualCompId, setAdminManualCompId] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const formatLastSyncDate = (dateStr?: string) => {
    if (!dateStr) return 'NUNCA REALIZADA';
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'DATA INVÁLIDA';
    }
  };

  const [metaCompId, setMetaCompId] = useState<string>(() => {
    const active = competitions?.find(c => c.isActive);
    return active ? active.id : (competitions && competitions.length > 0 ? competitions[0].id : '');
  });

  const formatGoalNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  };

  const selectedMetaComp = useMemo(() => 
    competitions?.find(c => c.id === metaCompId),
    [competitions, metaCompId]
  );

  const collectiveProgress = useMemo(() => {
    if (!selectedMetaComp || !selectedMetaComp.goalTarget) return 0;
    return approvedUsers.reduce((acc, user) => {
      const stats = user.competitionStats?.[selectedMetaComp.id];
      if (!stats) return acc;
      return acc + (selectedMetaComp.goalMetric === 'likes' ? (stats.likes || 0) : (stats.views || 0));
    }, 0);
  }, [approvedUsers, selectedMetaComp]);

  const socialCounts = useMemo(() => {
    const counts = { tiktok: 0, instagram: 0, youtube: 0 };
    approvedUsers.forEach(u => {
      const tt = Array.isArray(u.tiktok) ? u.tiktok : (u.tiktok ? [u.tiktok] : []);
      const ig = Array.isArray(u.instagram) ? u.instagram : (u.instagram ? [u.instagram] : []);
      const yt = Array.isArray(u.youtube) ? u.youtube : (u.youtube ? [u.youtube] : []);
      counts.tiktok += tt.length;
      counts.instagram += ig.length;
      counts.youtube += yt.length;
    });
    return counts;
  }, [approvedUsers]);

  // --- BI & Performance Calculations ---
  // Unificação: Buscar totais da competição selecionada diretamente nos perfis dos usuários
  // para garantir que o Alcance Global bata exatamente com o Ranking (Meta Coletiva).
  const compMetrics = useMemo(() => {
    if (!selectedMetaComp) return { views: 0, likes: 0 };
    return approvedUsers.reduce((acc, u) => {
      const stats = u.competitionStats?.[selectedMetaComp.id];
      return {
        views: acc.views + (stats?.views || 0),
        likes: acc.likes + (stats?.likes || 0)
      };
    }, { views: 0, likes: 0 });
  }, [approvedUsers, selectedMetaComp]);

  const globalViews = compMetrics.views;
  const globalLikes = compMetrics.likes;

  const approvedPosts = posts.filter(p => 
    (p.status === 'approved' || p.status === 'synced') && 
    (!selectedMetaComp || p.competitionId === selectedMetaComp.id)
  );
  
  const rejectedPosts = posts.filter(p => 
    p.status === 'rejected' && 
    (!selectedMetaComp || p.competitionId === selectedMetaComp.id)
  );

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const postsToday = posts.filter(p => p.timestamp > now - dayMs).length;
  const postsYesterday = posts.filter(p => p.timestamp > now - 2 * dayMs && p.timestamp <= now - dayMs).length;
  const dailyPostTrend = postsToday >= postsYesterday ? 'up' : 'down';

  const postsLast7d = posts.filter(p => p.timestamp > now - 7 * dayMs).length;
  const avgPosts7d = Math.round(postsLast7d / 7);

  const approvalRate = (approvedPosts.length + rejectedPosts.length) > 0
    ? Math.round((approvedPosts.length / (approvedPosts.length + rejectedPosts.length)) * 100)
    : 100;

  const inactiveUsers = approvedUsers.filter(u => {
    const userPosts = posts.filter(p => p.userId === u.uid);
    if (userPosts.length === 0) return true;
    const lastPost = Math.max(...userPosts.map(p => p.timestamp));
    return now - lastPost > 3 * dayMs;
  });

  const newUsers7d = approvedUsers.filter(u => u.approvedAt && u.approvedAt > now - 7 * dayMs).length;

  const totalPaidGlobal = approvedUsers.reduce((sum, u) => {
    if (!u.competitionStats) return sum;
    if (selectedMetaComp) {
      return sum + (u.competitionStats[selectedMetaComp.id]?.paidTotal || 0);
    }
    return sum + Object.values(u.competitionStats).reduce((s, st: any) => s + (st.paidTotal || 0), 0);
  }, 0);

  const cpp = approvedPosts.length > 0 ? totalPaidGlobal / approvedPosts.length : 0;

  const totalPendingGlobal = approvedUsers.reduce((sum, u) => {
    if (!u.competitionStats) return sum;
    if (selectedMetaComp) {
      return sum + (u.competitionStats[selectedMetaComp.id]?.balance || 0);
    }
    return sum + Object.values(u.competitionStats).reduce((s, st: any) => s + (st.balance || 0), 0);
  }, 0);

  const auditEfficiency = (() => {
    const postsWithAudit = posts.filter(p => p.approvedAt && p.timestamp);
    if (postsWithAudit.length === 0) return 0;
    const totalDiff = postsWithAudit.reduce((s, p) => s + (p.approvedAt! - p.timestamp), 0);
    const avgMinutes = Math.round(totalDiff / postsWithAudit.length / 1000 / 60);
    return avgMinutes;
  })();

  const topROIUsers = [...approvedUsers]
    .map(u => {
      const uPosts = posts.filter(p => p.userId === u.uid && (p.status === 'approved' || p.status === 'synced'));
      const uViews = uPosts.reduce((s, p) => s + (p.views || 0), 0);
      const uPaid = u.competitionStats ? Object.values(u.competitionStats).reduce((s, st: any) => s + (st.paidTotal || 0), 0) : 0;
      return { ...u, roi: uPaid > 0 ? uViews / uPaid : uViews, totalViewsCount: uViews, postsCount: uPosts.length };
    })
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 5);

  const dailyPostCounts = [6, 5, 4, 3, 2, 1, 0].map(daysAgo => {
    const d = new Date(now - daysAgo * dayMs);
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    const end = start + dayMs;
    const count = posts.filter(p => p.timestamp >= start && p.timestamp < end).length;
    return {
      day: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      count,
      fullDate: d.toLocaleDateString('pt-BR')
    };
  });

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPass.trim()) {
      alert("Preencha todos os campos.");
      return;
    }
    if (newUserPass.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setCreatingUser(true);
    try {
      // Inicializa app secundário se não existir ainda
      let secondaryApp;
      const existingApps = getApps();
      const foundSecondary = existingApps.find(a => a.name === 'Secondary');
      if (foundSecondary) {
        secondaryApp = foundSecondary;
      } else {
        secondaryApp = initializeApp(fbConfig, 'Secondary');
      }
      const secAuth = getSecondaryAuth(secondaryApp);

      // Criar conta no Firebase Auth via app secundário (não desloga o Admin)
      const userCredential = await createSecondaryUser(secAuth, newUserEmail.trim(), newUserPass.trim());
      const newUid = userCredential.user.uid;

      // Deslogar do app secundário imediatamente antes de gravar no Firestore
      await signSecondaryOut(secAuth);

      // Gravar perfil no Firestore usando o contexto do Admin logado
      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        email: newUserEmail.trim(),
        displayName: newUserName.trim(),
        role: newUserRole,
        isApproved: true,
        balance: 0,
        lifetimeEarnings: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalPosts: 0,
        totalSaves: 0,
        dailyViews: 0,
        dailyLikes: 0,
        dailyComments: 0,
        dailyShares: 0,
        dailySaves: 0,
        dailyPosts: 0,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(newUserName.trim())}&background=random`
      });

      alert(`✅ Acesso criado com sucesso!\n\nNome: ${newUserName}\nCargo: ${newUserRole.toUpperCase()}\nEmail: ${newUserEmail}`);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPass('');
      setNewUserRole('user');
    } catch (e: any) {
      console.error('Erro criar usuário:', e);
      if (e.code === 'auth/email-already-in-use') {
        alert('❌ Este email já está cadastrado no sistema.');
      } else if (e.code === 'auth/invalid-email') {
        alert('❌ Email inválido. Verifique o formato.');
      } else if (e.code === 'permission-denied' || e.message?.includes('permission')) {
        alert('❌ Sem permissão para gravar no banco.\n\nVocê precisa publicar as novas Regras de Segurança no Console do Firebase (aba Segurança do Firestore).');
      } else {
        alert(`❌ Falha ao criar acesso:\n${e.message}`);
      }
    }
    setCreatingUser(false);
  };

  const handleAdminSubmitPost = async () => {
    if (!adminManualUrl.trim() || !adminManualCompId || !auditUserId) {
      alert('Por favor, preencha todos os campos e selecione uma competição.');
      return;
    }

    const targetUser = approvedUsers.find(u => u.uid === auditUserId);
    if (!targetUser) return;

    setAdminSubmitting(true);
    try {
      const norm = normalizeUrl(adminManualUrl);
      
      // Check for duplicates
      const qNorm = query(collection(db, 'posts'), where('normalizedUrl', 'in', [norm]));
      const snapNorm = await getDocs(qNorm);
      if (!snapNorm.empty) {
        alert('❌ Este link já existe no sistema!');
        setAdminSubmitting(false);
        return;
      }

      const postId = Math.random().toString(36).substr(2, 9);
      const newPost: Post = {
        id: postId,
        userId: targetUser.uid,
        userName: targetUser.displayName,
        url: adminManualUrl,
        normalizedUrl: norm,
        platform: adminManualPlatform,
        competitionId: adminManualCompId,
        accountHandle: 'ADMIN_MANUAL',
        status: 'approved',
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        timestamp: Date.now()
      };

      await setDoc(doc(db, 'posts', postId), newPost);
      await updateUserMetrics(targetUser.uid);

      alert('✅ Link adicionado com sucesso ao perfil de ' + targetUser.displayName);
      setAdminManualUrl('');
    } catch (error: any) {
      alert('❌ Erro ao adicionar link: ' + error.message);
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apifyKey) {
      alert('Por favor, insira uma chave antes de salvar.');
      return;
    }
    try {
      await updateDoc(doc(db, 'config', 'settings'), { apifyKey });
      onSettingsUpdate({ ...settings, apifyKey });
      alert('✅ Chave API salva com sucesso!');
    } catch (error: any) {
      alert(`❌ Erro ao salvar chave: ${error.message}`);
    }
  };

  useEffect(() => {
    if (settings.apifyKey && !apifyKey) {
      setApifyKey(settings.apifyKey);
    }
  }, [settings.apifyKey]);

  const pendingPosts = posts.filter(p => p.status === 'pending');
  const pendingRegistrations = registrations.filter(r => r.status === 'pending');
  const approvedRegistrations = registrations.filter(r => r.status === 'approved');
  const rejectedRegistrations = registrations.filter(r => r.status === 'rejected');
  const [repairing, setRepairing] = useState(false);

  const handleRepairMetrics = async () => {
    setRepairing(true);
    try {
      const res = await repairAllUserMetrics();
      alert(`✅ Reparo concluído!\n\nUsuários processados: ${res.total}\nSucesso: ${res.success}\nErros: ${res.error}`);
    } catch (error: any) {
      alert(`Erro no reparo: ${error.message}`);
    } finally {
      setRepairing(false);
    }
  };

  const handleSync = async () => {
    if (!apifyKey) {
      alert('Por favor, insira sua chave Apify para sincronizar.');
      return;
    }
    setSyncing(true);
    try {
      // Save key to Firestore
      await setDoc(doc(db, 'config', 'settings'), { apifyKey });
      onSettingsUpdate({ apifyKey });

      await syncViewsWithApify(apifyKey);
      alert('Sincronização concluída com sucesso!');
    } catch (error: any) {
      alert(`Erro na sincronização: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSingleSync = async (post: Post) => {
    if (!apifyKey) {
      alert('Por favor, insira sua chave Apify para sincronizar.');
      return;
    }
    setSyncingPostId(post.id);
    try {
      await syncSinglePostWithApify(apifyKey, post);
      alert('Sincronização do vídeo concluída!');
    } catch (error: any) {
      alert(`Erro na sincronização: ${error.message}`);
    } finally {
      setSyncingPostId(null);
    }
  };

  const handleSyncApprovedSequentially = async () => {
    if (!apifyKey) {
      alert('Por favor, insira sua chave Apify para sincronizar.');
      return;
    }
    const approvedPosts = posts.filter(p => p.status === 'approved');
    if (approvedPosts.length === 0) {
      alert('Nenhum vídeo aprovado para sincronizar.');
      return;
    }

    setSyncing(true);
    try {
      for (const post of approvedPosts) {
        setSyncingPostId(post.id);
        await syncSinglePostWithApify(apifyKey, post);
        // Important: Update status to synced after successful sync
        await updateDoc(doc(db, 'posts', post.id), { status: 'synced' });
      }
      // Update last sync timestamp
      await updateDoc(doc(db, 'config', 'settings'), { lastSync: new Date().toISOString() });
      alert('Sincronização sequencial de todos os vídeos aprovados concluída!');
    } catch (error: any) {
      alert(`Erro na sincronização sequencial: ${error.message}`);
    } finally {
      setSyncing(false);
      setSyncingPostId(null);
    }
  };

  const handleStatusToggle = async (postId: string, newStatus: PostStatus, userId: string) => {
    const post = posts.find(p => p.id === postId);
    
    if (newStatus === 'banned' || newStatus === 'rejected') {
      setRejectionReason(post?.rejectionReason || '');
      setRejectionModal({ isOpen: true, postId, status: newStatus });
      return;
    }

    try {
      await updateDoc(doc(db, 'posts', postId), { status: newStatus });
      await updateUserMetrics(userId);
      alert(`Status atualizado para ${newStatus.toUpperCase()} e métricas recalculadas.`);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status.');
    }
  };

  const handleSyncAllSequentially = async () => {
    if (!apifyKey) {
      alert('Por favor, insira sua chave Apify para sincronizar.');
      return;
    }
    const syncedPosts = posts.filter(p => p.status === 'synced');
    if (syncedPosts.length === 0) {
      alert('Nenhum vídeo sincronizado para ressincronizar.');
      return;
    }

    setSyncing(true);
    try {
      for (const post of syncedPosts) {
        setSyncingPostId(post.id);
        await syncSinglePostWithApify(apifyKey, post);
      }
      // Update last resync timestamp
      await updateDoc(doc(db, 'config', 'settings'), { lastResync: new Date().toISOString() });
      alert('Sincronização sequencial de todos os vídeos concluída!');
    } catch (error: any) {
      alert(`Erro na sincronização sequencial: ${error.message}`);
    } finally {
      setSyncing(false);
      setSyncingPostId(null);
    }
  };

  const handleExportExcel = () => {
    if (!selectedCompId) {
      alert('Selecione a competição!');
      return;
    }

    const comp = competitions.find(c => c.id === selectedCompId);
    const compName = comp ? comp.title.replace(/[^a-zA-Z0-9_\- ]/g, '') : 'Competicao';
    const compPosts = posts
      .filter(p => p.competitionId === selectedCompId)
      .sort((a, b) => b.timestamp - a.timestamp);

    const allUsers = [...approvedUsers, ...pendingUsers, ...archivedUsers];

    const statusLabel = (s: string) =>
      s === 'approved' || s === 'synced' ? 'APROVADO' :
      s === 'rejected' || s === 'banned' ? 'RECUSADO' : 'EM TRIAGEM';

    // Ordem igual ao site: Plataforma > Link > Usuário > Curtidas > Views > Status > Email > Data
    const rows = compPosts.map(post => {
      const userObj = allUsers.find(u => u.uid === post.userId);
      return {
        'PLATAFORMA': post.platform,
        'LINK DO VÍDEO': post.url,
        'NOME DO USUÁRIO': post.userName || '',
        'CURTIDAS': post.likes || 0,
        'VIEWS': post.views || 0,
        'STATUS': statusLabel(post.status),
        'EMAIL': userObj ? userObj.email : 'N/A',
        'DATA': new Date(post.timestamp).toLocaleDateString('pt-BR'),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 12 }, // PLATAFORMA
      { wch: 55 }, // LINK DO VÍDEO
      { wch: 28 }, // NOME DO USUÁRIO
      { wch: 12 }, // CURTIDAS
      { wch: 12 }, // VIEWS
      { wch: 12 }, // STATUS
      { wch: 32 }, // EMAIL
      { wch: 12 }, // DATA
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Links');
    XLSX.writeFile(workbook, `MetaRayx_${compName.trim()}.xlsx`);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight uppercase">Painel da Diretoria</h2>
          <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Controle de Acesso e Sincronização</p>
        </div>

        {userRole === 'admin' && (
          <div className="flex flex-wrap items-center gap-6 bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800/50">
            {/* CONFIGURAÇÃO DA CHAVE API */}
            <div className="flex flex-col gap-2 flex-1 min-w-[320px]">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Configuração Apify</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none group-focus-within:text-amber-500 transition-colors" />
                  <input
                    type="text"
                    value={apifyKey}
                    onChange={(e) => setApifyKey(e.target.value)}
                    placeholder="Insira sua Chave API aqui"
                    className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:border-amber-500 outline-none transition-all placeholder:text-zinc-700"
                  />
                </div>
                <button
                  onClick={handleSaveApiKey}
                  className="px-6 py-3 gold-bg text-black font-black rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/20 text-[10px] uppercase whitespace-nowrap"
                >
                  Salvar
                </button>
              </div>
            </div>

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
                  className="p-3 bg-red-500/10 text-red-500 font-black rounded-xl hover:bg-red-500 hover:text-black transition-all shadow-lg shadow-red-500/10 disabled:opacity-30 flex items-center justify-center"
                  title="Zerar Diário"
                >
                  <Trash2 className="w-5 h-5" />
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
                Zerar Rankings (Soft)
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
        {/* DASHBOARD - Visão Geral */}
        <button
          onClick={() => { setTab('VISAO_GERAL'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
          className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'VISAO_GERAL' ? 'gold-bg text-black' : 'text-zinc-500'}`}
        >
          DASHBOARD
        </button>
        {/* POSTS - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('POSTS'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'POSTS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            POSTS ({posts.filter(p => p.status === 'pending').length})
          </button>
        )}
        {/* SINCRONIZAÇÃO - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('SINCRONIZACAO'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'SINCRONIZACAO' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            SINCRONIZAÇÃO ({posts.filter(p => p.status === 'approved').length})
          </button>
        )}
        {/* RESSINCRONIZAÇÃO - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('RESSINCRONIZACAO'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'RESSINCRONIZACAO' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            RESSINCRONIZAÇÃO ({posts.filter(p => p.status === 'synced' || p.status === 'banned').length})
          </button>
        )}
        {/* USERS - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('USERS'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'USERS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            PENDENTES ({pendingUsers.length})
          </button>
        )}
        {/* APROVADOS - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('USERS_APPROVED'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'USERS_APPROVED' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            APROVADOS ({approvedUsers.length})
          </button>
        )}
        {/* ARQUIVADOS - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('ARCHIVED'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'ARCHIVED' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            ARQUIVADOS ({archivedUsers.length})
          </button>
        )}
        {/* COMPETIÇÕES - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('COMPETITIONS'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'COMPETITIONS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            COMPETIÇÕES ({competitions.length})
          </button>
        )}
        {/* SOLICITAÇÕES DE REMOÇÃO - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('REMOVAL_REQUESTS'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'REMOVAL_REQUESTS' ? 'bg-amber-500 text-black' : 'text-zinc-500'}`}
          >
            SOLICITAÇÕES ({posts.filter(p => p.status === 'removal_requested').length})
          </button>
        )}
        {/* REGISTROS - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('REGISTROS'); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'REGISTROS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            REGISTROS ({pendingRegistrations.length})
          </button>
        )}
        {/* AVISOS - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('AVISOS'); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'AVISOS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            AVISOS
          </button>
        )}
        {/* TIMER - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('TIMER'); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'TIMER' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            TIMER
          </button>
        )}
        {/* FINANCEIRO - visível para admin, auditor e administrativo */}
        {(userRole === 'admin' || userRole === 'auditor' || userRole === 'administrativo') && (
          <button
            onClick={() => { setTab('FINANCEIRO'); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'FINANCEIRO' ? 'gold-bg text-black' : 'text-zinc-500'}`}
          >
            FINANCEIRO
          </button>
        )}
        {/* CRIAR ACESSO - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('ACESSOS'); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'ACESSOS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            CRIAR ACESSO
          </button>
        )}
        {/* SUGESTÕES - visível para admin e auditor */}
        {(userRole === 'admin' || userRole === 'auditor') && (
          <button
            onClick={() => { setTab('SUGESTOES'); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'SUGESTOES' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            SUGESTÕES ({suggestions.length})
          </button>
        )}
        {/* RELATÓRIOS (LINKS) - visível para admin e auditor */}
        {(userRole === 'admin' || userRole === 'auditor') && (
          <button
            onClick={() => { setTab('RELATORIOS'); setSyncDetailCompId(null); setSelectedCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'RELATORIOS' ? 'gold-bg text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            RELATÓRIOS
          </button>
        )}
        {/* REMOVIDOS - visível para admin e auditor */}
        {(userRole === 'admin' || userRole === 'auditor') && (
          <button
            onClick={() => { setTab('REMOVED_POSTS'); setSyncDetailCompId(null); setSelectedCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'REMOVED_POSTS' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            REMOVIDOS ({posts.filter(p => p.status === 'rejected' || p.status === 'banned' || p.status === 'deleted').length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {tab === 'VISAO_GERAL' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
              <div className="flex flex-col gap-1">
                <h3 className="text-2xl font-black uppercase tracking-tighter gold-gradient">Visão Geral do Ecossistema</h3>
                <p className="text-zinc-500 font-bold text-[11px] uppercase tracking-[0.2em] opacity-80">Métricas em tempo real de toda a operação MetaRayx.</p>
              </div>

              {userRole === 'admin' && (
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={handleRepairMetrics}
                    disabled={repairing}
                    className="px-6 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-black text-[10px] uppercase tracking-widest hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/30 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    {repairing ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                        <RefreshCw className="w-4 h-4" />
                      </motion.div>
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {repairing ? 'SINCRONIZANDO...' : 'REPARAR MÉTRICAS GLOBAIS'}
                  </button>
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider text-right max-w-[250px] leading-relaxed">
                    Sincroniza os perfis dos usuários com os links ativos no banco.
                    <br />
                    <span className="text-amber-500/50">Remove dados de links banidos ou excluídos.</span>
                  </p>
                </div>
              )}
            </div>

            {/* Meta Coletiva da Dashboard Admin/Auditor */}
            {selectedMetaComp && selectedMetaComp.goalTarget && selectedMetaComp.goalTarget > 0 && (
              <div className="bg-zinc-950/40 border border-amber-500/20 rounded-[32px] p-6 lg:p-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-amber-500/3 blur-3xl pointer-events-none group-hover:bg-amber-500/5 transition-all" />
                
                <div className="relative z-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-2xl shadow-amber-500/10">
                        <Target className="w-7 h-7 text-amber-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-black text-amber-500 uppercase tracking-tight">Meta Coletiva do Ecossistema</p>
                          {competitions.length > 1 && (
                            <select 
                              value={metaCompId} 
                              onChange={(e) => setMetaCompId(e.target.value)}
                              className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-2 py-1 text-[9px] font-black text-amber-500 outline-none focus:border-amber-500 transition-all uppercase"
                            >
                              {competitions.filter(c => c.goalTarget && c.goalTarget > 0).map(c => (
                                <option key={c.id} value={c.id}>{c.title}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">Objetivo compartilhado entre todos os criadores registrados</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <div className="px-4 py-2 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center gap-3">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Progresso:</span>
                        <span className="text-xl font-black text-amber-400">
                          {((collectiveProgress / selectedMetaComp.goalTarget) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                    <div className="space-y-4">
                      <div className="flex items-baseline gap-3">
                        <span className="text-5xl font-black text-white tracking-tighter">{formatGoalNumber(collectiveProgress)}</span>
                        <span className="text-sm font-black text-zinc-600 uppercase tracking-widest">/ {formatGoalNumber(selectedMetaComp.goalTarget)} {selectedMetaComp.goalMetric === 'likes' ? 'CURTIDAS' : 'VIEWS'}</span>
                      </div>
                      
                      <div className="h-4 w-full bg-black rounded-full overflow-hidden border border-zinc-900 p-0.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((collectiveProgress / selectedMetaComp.goalTarget) * 100, 100)}%` }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 relative"
                        >
                          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                        </motion.div>
                      </div>
                    </div>

                    <div className="hidden md:flex flex-wrap gap-3 justify-end">
                      <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 flex flex-col items-center min-w-[120px]">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">MÉTRICA</span>
                        <span className="text-xs font-black text-white uppercase">{selectedMetaComp.goalMetric}</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 flex flex-col items-center min-w-[120px]">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">CRIADORES</span>
                        <span className="text-xs font-black text-white">{approvedUsers.length}</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col items-center min-w-[120px]">
                        <span className="text-[8px] font-black text-amber-500/70 uppercase tracking-widest mb-1">RENOVAÇÃO</span>
                        <span className="text-xs font-black text-amber-500">{collectiveProgress >= selectedMetaComp.goalTarget ? 'LIBERADA' : 'BLOQUEADA'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats Grid - BI & Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { 
                  label: 'Alcance Global', 
                  value: globalViews.toLocaleString('pt-BR'), 
                  sub: `${globalLikes.toLocaleString('pt-BR')} Curtidas`, 
                  icon: TrendingUp, 
                  color: 'text-amber-500', 
                  bg: 'bg-amber-500/10',
                  desc: 'Total de Visualizações Aprovadas',
                  tooltip: 'Soma total de visualizações de todos os posts aprovados nas competições.'
                },
                { 
                  label: 'Posts Enviados', 
                  value: postsToday, 
                  sub: `${avgPosts7d} média / dia`, 
                  icon: Zap, 
                  color: 'text-emerald-500', 
                  bg: 'bg-emerald-500/10',
                  desc: dailyPostTrend === 'up' ? 'Aumento em relação a ontem' : 'Queda em relação a ontem',
                  trend: dailyPostTrend,
                  tooltip: 'Quantidade de vídeos submetidos hoje por todos os criadores.'
                },
                { 
                  label: 'Governança & Gestão', 
                  value: `${approvalRate}%`, 
                  sub: `${auditEfficiency} min / audit`, 
                  icon: ShieldCheck, 
                  color: 'text-blue-500', 
                  bg: 'bg-blue-500/10',
                  desc: 'Taxa de Aprovação vs. Tempo',
                  tooltip: 'Percentual de vídeos aprovados e tempo médio de resposta da auditoria.'
                },
                { 
                  label: 'Saúde da Comunidade', 
                  value: newUsers7d, 
                  sub: `${inactiveUsers.length} inativos (3d)`, 
                  icon: Users, 
                  color: 'text-pink-500', 
                  bg: 'bg-pink-500/10',
                  desc: 'Novos integrantes (7 dias)',
                  tooltip: 'Novos usuários na última semana e usuários inativos nos últimos 3 dias.'
                },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900 hover:border-amber-500/30 transition-all group relative h-full flex flex-col justify-between"
                >
                  <div className="absolute inset-0 overflow-hidden rounded-[40px] pointer-events-none">
                    <div className={`absolute top-0 right-0 w-32 h-32 ${stat.bg} blur-[60px] opacity-20 group-hover:opacity-60 transition-opacity`} />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className={`w-14 h-14 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color} shadow-lg shadow-black/40`}>
                        <stat.icon className="w-7 h-7" />
                      </div>
                      {stat.trend && (
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${stat.trend === 'up' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                          {stat.trend === 'up' ? '↑ Crescendo' : '↓ Estável'}
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center">
                        {stat.label} <InfoTooltip text={stat.tooltip || ''} />
                      </p>
                      <h4 className="text-4xl font-black text-white tracking-tight leading-none my-2">{stat.value}</h4>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <span className={stat.color}>{stat.sub}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-zinc-900/50 relative z-10">
                    <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest leading-none">{stat.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Daily Post Activity Chart */}
              <div className="lg:col-span-2 p-8 rounded-[40px] bg-zinc-950 border border-zinc-900">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h4 className="text-lg font-black uppercase text-white tracking-tight">Atividade Semanal (Posts)</h4>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Volume diário enviado ao sistema</p>
                  </div>
                  <Calendar className="w-6 h-6 text-zinc-800" />
                </div>
                
                <div className="flex items-end justify-between gap-2 h-40 pt-4">
                  {dailyPostCounts.map((d, i) => {
                    const maxCount = Math.max(...dailyPostCounts.map(x => x.count), 1);
                    const height = (d.count / maxCount) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                        <div className="w-full relative flex flex-col justify-end h-full">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${height}%` }}
                            transition={{ duration: 1, delay: i * 0.05 }}
                            className={`w-full rounded-t-xl transition-all ${i === 6 ? 'gold-bg border-t border-white/20' : 'bg-zinc-900 group-hover:bg-zinc-800 border-t border-white/5'}`}
                          >
                             {d.count > 0 && (
                               <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black text-[9px] font-black px-2 py-0.5 rounded shadow-xl whitespace-nowrap z-20">
                                 {d.count} POSTS
                               </div>
                             )}
                          </motion.div>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${i === 6 ? 'gold-gradient' : 'text-zinc-600'}`}>{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Inactive Users Preview */}
              <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h4 className="text-lg font-black uppercase text-white tracking-tight">Fila de Inatividade</h4>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-red-500/70">Integrantes sem postar há 3 dias</p>
                  </div>
                  <UserX className="w-6 h-6 text-red-500/30" />
                </div>
                
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
                  {inactiveUsers.slice(0, 10).map((u, i) => (
                    <div key={u.uid} className="flex items-center justify-between p-3 rounded-2xl bg-black border border-zinc-900 group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-800">
                          <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[10px] font-black text-zinc-400 uppercase truncate max-w-[100px]">{u.displayName}</span>
                      </div>
                      <span className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest">Sem posts</span>
                    </div>
                  ))}
                  {inactiveUsers.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10">
                      <ShieldCheck className="w-8 h-8 text-emerald-500/20 mb-2" />
                      <p className="text-[9px] font-black text-zinc-700 uppercase">Todos os ativos postaram!</p>
                    </div>
                  )}
                </div>
                
                {userRole === 'admin' && (
                  <button 
                    onClick={() => setTab('USERS_APPROVED')}
                    className="mt-6 w-full py-4 rounded-2xl border border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:border-zinc-700 transition-all"
                  >
                    Ver todos os {inactiveUsers.length} inativos
                  </button>
                )}
              </div>
            </div>

            {/* Middle Section: Distribution & Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Distribution Card */}
              <div className="lg:col-span-2 p-8 rounded-[40px] bg-zinc-950 border border-zinc-900">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h4 className="text-lg font-black uppercase text-white tracking-tight flex items-center">
                      Status de Triagem <InfoTooltip text="Distribuição atual dos vídeos enviados entre aprovados, pendentes e rejeitados." />
                    </h4>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Distribuição de vídeos por status</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {(() => {
                    const total = posts.length || 1;
                    const statuses = [
                      { label: 'Aprovados', count: posts.filter(p => p.status === 'approved' || p.status === 'synced').length, color: 'bg-emerald-500' },
                      { label: 'Pendentes', count: posts.filter(p => p.status === 'pending').length, color: 'bg-amber-500' },
                      { label: 'Rejeitados', count: posts.filter(p => p.status === 'rejected').length, color: 'bg-red-500' },
                    ];

                    return (
                      <>
                        <div className="flex h-3 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                          {statuses.map((s, i) => (
                            <div 
                              key={i} 
                              style={{ width: `${(s.count / total) * 100}%` }} 
                              className={`${s.color} transition-all duration-1000 ease-out`}
                            />
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          {statuses.map((s, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${s.color}`} />
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{s.label}</span>
                              </div>
                              <p className="text-xl font-black text-white">{s.count} <span className="text-[10px] font-bold text-zinc-600 opacity-50">({Math.round((s.count / total) * 100)}%)</span></p>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Redes Sociais - Substituindo Integridade */}
              <div className="p-8 rounded-[40px] gold-bg border border-white/10 group overflow-hidden relative flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/20 blur-[80px] -mr-20 -mt-20 rounded-full" />
                <div>
                  <h4 className="text-lg font-black uppercase text-black tracking-tight mb-1 relative z-10">Redes Sociais</h4>
                  <p className="text-[10px] font-black text-black/60 uppercase tracking-widest mb-8 relative z-10">Contas registradas no hub</p>
                  
                  <div className="space-y-4 relative z-10">
                    <div className="p-4 rounded-2xl bg-black/5 border border-black/10 flex items-center justify-between group/item hover:bg-black/10 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-black/10 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-black" />
                        </div>
                        <span className="text-[10px] font-black text-black uppercase">TikTok</span>
                      </div>
                      <span className="text-lg font-black text-black">{socialCounts.tiktok}</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/5 border border-black/10 flex items-center justify-between group/item hover:bg-black/10 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-black/10 flex items-center justify-center">
                          <Camera className="w-4 h-4 text-black" />
                        </div>
                        <span className="text-[10px] font-black text-black uppercase">Instagram</span>
                      </div>
                      <span className="text-lg font-black text-black">{socialCounts.instagram}</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/5 border border-black/10 flex items-center justify-between group/item hover:bg-black/10 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-black/10 flex items-center justify-center">
                          <Eye className="w-4 h-4 text-black" />
                        </div>
                        <span className="text-[10px] font-black text-black uppercase">YouTube</span>
                      </div>
                      <span className="text-lg font-black text-black">{socialCounts.youtube}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-black/10 flex justify-between items-center relative z-10">
                  <span className="text-[9px] font-black text-black/40 uppercase tracking-widest">Total Geral</span>
                  <span className="text-xs font-black text-black uppercase tracking-tighter">
                    {socialCounts.tiktok + socialCounts.instagram + socialCounts.youtube} Canais
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'ACESSOS' && userRole === 'admin' && (
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
                {creatingUser ? 'CRIANDO...' : 'REGISTRAR ACESSO NO BANDO DE DADOS'}
              </button>
            </div>
          </div>
        )}

        {tab === 'FINANCEIRO' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
              <div className="space-y-1">
                <h3 className="text-2xl font-black uppercase tracking-tighter gold-gradient leading-none">Gestão Financeira</h3>
                <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-[0.2em] opacity-80">Controle de pagamentos e gestão por competição.</p>
              </div>

              <div className="flex flex-wrap items-center gap-4 bg-zinc-900/30 p-2 rounded-3xl border border-zinc-800/50">
                <div className="flex flex-col gap-1 px-2">
                  <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1">Competição Alvo:</label>
                  <select
                    value={financeCompId}
                    onChange={(e) => setFinanceCompId(e.target.value)}
                    className="bg-black border border-zinc-800 rounded-xl py-2 px-4 text-[10px] font-black text-amber-500 outline-none focus:border-amber-500 transition-all min-w-[220px] cursor-pointer hover:bg-zinc-900"
                  >
                    {competitions.map(c => (
                      <option key={c.id} value={c.id}>{c.title} {c.isActive ? '• ATIVA' : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="flex p-1 bg-black rounded-2xl border border-zinc-800">
                  {[
                    { id: 'RESUMO', label: 'DASHBOARD', icon: BarChart3 },
                    { id: 'PENDING', label: 'PENDENTES', icon: Zap },
                    { id: 'REALIZED', label: 'REALIZADOS', icon: CheckCircle2 }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setFinanceTab(t.id as any); setAuditUserId(null); }}
                      className={`px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                        financeTab === t.id ? 'gold-bg text-black shadow-lg shadow-amber-500/10' : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 rounded-[40px] overflow-hidden min-h-[600px] shadow-2xl relative">
              {auditUserId ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="p-8 border-b border-zinc-900 bg-zinc-900/20 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl gold-bg flex items-center justify-center shadow-xl shadow-amber-500/10">
                        <UserIcon className="w-7 h-7 text-black" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black uppercase tracking-tight text-white mb-0.5">{approvedUsers.find(u => u.uid === auditUserId)?.displayName}</h4>
                        <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest">Gestão de Performance Social</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {(() => {
                        const user = approvedUsers.find(u => u.uid === auditUserId);
                        return user && (
                          <div className="flex items-center gap-3 bg-black border border-zinc-800 rounded-2xl px-6 py-3 ml-4 group">
                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest group-hover:text-amber-500 transition-colors">PIX KEY:</span>
                            <input
                              type="text"
                              defaultValue={user.pixKey || ''}
                              readOnly={userRole !== 'admin'}
                              onBlur={async (e) => {
                                if (userRole !== 'admin') return;
                                const val = e.target.value;
                                if (val !== user.pixKey) {
                                  try {
                                    await updateDoc(doc(db, 'users', user.uid), { pixKey: val });
                                    alert('Chave PIX salva com sucesso!');
                                  } catch (e) { alert('Erro ao salvar PIX'); }
                                }
                              }}
                              className={`bg-transparent border-none p-0 text-[11px] font-black text-white focus:ring-0 outline-none w-48 selection:bg-amber-500 selection:text-black ${userRole !== 'admin' ? 'cursor-not-allowed opacity-50 text-zinc-500' : 'cursor-text'}`}
                            />
                          </div>
                        );
                      })()}
                      <button
                        onClick={() => setAuditUserId(null)}
                        className="px-8 py-3.5 bg-zinc-900 text-zinc-400 font-black rounded-2xl text-[10px] flex items-center gap-3 hover:bg-zinc-800 hover:text-white transition-all uppercase tracking-widest border border-zinc-800"
                      >
                        <ChevronLeft className="w-4 h-4" /> VOLTAR À LISTA
                      </button>
                    </div>
                  </div>

                  <div className="min-h-[400px]">
                    <ListHeader columns={['REDES', 'LINK DO VÍDEO', 'STATUS', 'MÉTRICAS', 'CONTROLE']} gridClass="grid-cols-[80px_1fr_120px_150px_200px]" />
                    <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                      {posts.filter(p => p.userId === auditUserId).map(post => (
                        <div key={post.id} className="grid grid-cols-[80px_1fr_120px_150px_200px] gap-4 items-center py-4 px-8 hover:bg-white/[0.02] transition-all border-b border-zinc-900/50 last:border-0">
                          <div className="flex justify-center">
                            <div className={`p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 ${
                              post.platform === 'tiktok' ? 'text-amber-500' :
                              post.platform === 'youtube' ? 'text-red-500' :
                              'text-pink-500'
                            }`}>
                              {post.platform === 'tiktok' ? <Zap className="w-4 h-4" /> :
                               post.platform === 'youtube' ? <TrendingUp className="w-4 h-4" /> :
                               <Camera className="w-4 h-4" />}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold text-[11px] truncate text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors block"
                              title={post.url}
                            >{post.url}</a>
                          </div>
                          <div className="text-center">
                            <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                post.status === 'approved' || post.status === 'synced' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                post.status === 'rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              }`}>
                              {post.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-5">
                            <div className="flex flex-col items-center">
                              <span className="text-[11px] font-black text-white">{(post.views || 0).toLocaleString()}</span>
                              <span className="text-[8px] font-black text-zinc-600 uppercase">Views</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[11px] font-black text-white">{(post.likes || 0).toLocaleString()}</span>
                              <span className="text-[8px] font-black text-zinc-600 uppercase">Likes</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2.5">
                            <button 
                              onClick={() => setValidatedPostsLocal(prev => 
                                prev.includes(post.id) ? prev.filter(id => id !== post.id) : [...prev, post.id]
                              )}
                              className={`p-3 rounded-xl transition-all ${
                                validatedPostsLocal.includes(post.id) 
                                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                                  : 'bg-emerald-500/5 border border-emerald-500/10 text-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-500'
                              }`}
                              title={validatedPostsLocal.includes(post.id) ? "Conteúdo Validado Localmente" : "Validar Conteúdo (Ilustrativo)"}
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                            <a href={post.url} target="_blank" rel="noreferrer" className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => {
                                setRejectionReason(post.rejectionReason || '');
                                setRejectionModal({ isOpen: true, postId: post.id, status: post.status });
                              }}
                              className={`p-3 rounded-xl transition-all ${post.rejectionReason ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white'}`}
                              title="Enviar/Editar Mensagem"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePostStatus(post.id, 'rejected')}
                              className={`p-3 rounded-xl border transition-all ${post.status === 'rejected' ? 'bg-red-500 border-red-400 text-black shadow-lg shadow-red-500/20' : 'bg-red-500/5 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-black'}`}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {posts.filter(p => p.userId === auditUserId).length === 0 && (
                        <div className="py-32 text-center flex flex-col items-center justify-center">
                          <History className="w-12 h-12 text-zinc-900 mb-4" />
                          <p className="text-zinc-700 font-black uppercase text-xs tracking-widest">Nenhum post registrado</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in duration-700">
                    {financeTab === 'RESUMO' && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Financial Stats Cards */}
                          <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900 group relative">
                            <div className="absolute inset-0 overflow-hidden rounded-[40px] pointer-events-none">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px]" />
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6">
                              <Trophy className="w-6 h-6" />
                            </div>
                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 flex items-center">
                              TOTAL CONFIRMADO (PAGO) <InfoTooltip text="Valor total em reais que já foi efetivamente pago aos criadores de todas as competições." />
                            </p>
                            <h4 className="text-3xl font-black text-white tracking-tight">R$ {totalPaidGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                          </div>

                          <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900 group relative">
                            <div className="absolute inset-0 overflow-hidden rounded-[40px] pointer-events-none">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[60px]" />
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6">
                              <Zap className="w-6 h-6" />
                            </div>
                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 flex items-center">
                              PROJEÇÃO DE SAÍDA (PENDENTE) <InfoTooltip text="Total acumulado nos saldos dos usuários aguardando pagamento ou saque." />
                            </p>
                            <h4 className="text-3xl font-black text-amber-500 tracking-tight">R$ {totalPendingGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                          </div>

                          <div className="p-8 rounded-[40px] bg-zinc-900 border border-zinc-800 group relative">
                            <div className="absolute inset-0 overflow-hidden rounded-[40px] pointer-events-none">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px]" />
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6">
                              <BarChart3 className="w-6 h-6" />
                            </div>
                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 flex items-center">
                              CUSTO MÉDIO POR POST (CPP) <InfoTooltip text="Quanto o sistema paga, em média, por cada vídeo aprovado (Custo Por Post)." />
                            </p>
                            <h4 className="text-3xl font-black text-white tracking-tight">R$ {cpp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* ROI Rankings */}
                          <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h4 className="text-lg font-black uppercase text-white tracking-tight flex items-center">
                                  Top 5 Criadores (ROI) <InfoTooltip text="Retorno em visualizações para cada R$ 1,00 pago ao criador. Quanto mais alto, mais rentável o criador é para o ecossistema." />
                                </h4>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-amber-500/80">Views geradas por cada R$ 1,00 pago</p>
                              </div>
                              <Award className="w-6 h-6 text-amber-500 opacity-50" />
                            </div>
                            <div className="space-y-4">
                              {topROIUsers.map((u: any, i) => (
                                <div key={u.uid} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                                  <div className="flex items-center gap-4">
                                    <span className="text-xs font-black text-zinc-700 w-4">{i + 1}º</span>
                                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-zinc-800">
                                      <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} alt="" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-black text-zinc-200 uppercase">{u.displayName}</p>
                                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{u.totalViewsCount?.toLocaleString()} views totais • {u.postsCount || 0} posts</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-black text-emerald-500">{u.roi.toFixed(0)} <span className="text-[9px] text-zinc-600">V/R$</span></p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Top Earnings */}
                          <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h4 className="text-lg font-black uppercase text-white tracking-tight">Maiores Ganhadores</h4>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Acumulado Histórico (Lifetime)</p>
                              </div>
                              <Trophy className="w-6 h-6 text-emerald-500 opacity-50" />
                            </div>
                            <div className="space-y-4">
                              {[...approvedUsers]
                                .sort((a, b) => (b.lifetimeEarnings || 0) - (a.lifetimeEarnings || 0))
                                .slice(0, 5)
                                .map((u, i) => (
                                  <div key={u.uid} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                                    <div className="flex items-center gap-4">
                                      <span className="text-xs font-black text-zinc-700 w-4">{i + 1}º</span>
                                      <div className="w-10 h-10 rounded-xl overflow-hidden border border-zinc-800">
                                        <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} alt="" className="w-full h-full object-cover" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-black text-zinc-200 uppercase">{u.displayName}</p>
                                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                          {u.email.split('@')[0]} • {posts.filter(p => p.userId === u.uid && (p.status === 'approved' || p.status === 'synced')).length} posts
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-black text-white">R$ {(u.lifetimeEarnings || 0).toLocaleString('pt-BR')}</p>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>

                        {/* Competition Financial Breakdown */}
                        <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900">
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h4 className="text-lg font-black uppercase text-white tracking-tight">Performance por Competição</h4>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Premiações e Balanços</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {competitions.map(comp => {
                              const compTotal = approvedUsers.reduce((sum, u) => sum + (u.competitionStats?.[comp.id]?.balance || 0) + (u.competitionStats?.[comp.id]?.paidTotal || 0), 0);
                              const compPaid = approvedUsers.reduce((sum, u) => sum + (u.competitionStats?.[comp.id]?.paidTotal || 0), 0);
                              const percent = compTotal > 0 ? (compPaid / compTotal) * 100 : 0;
                              
                              // Métricas Portfolio por Competição
                              const compPosts = posts.filter(p => p.competitionId === comp.id && (p.status === 'approved' || p.status === 'synced'));
                              const compViews = compPosts.reduce((sum, p) => sum + (p.views || 0), 0);
                              const compCpm = compViews > 0 ? (compTotal / (compViews / 1000)) : 0;

                              return (
                                <div key={comp.id} className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800 transition-all">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${comp.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-600'}`}>
                                        <Trophy className="w-5 h-5" />
                                      </div>
                                      <div>
                                        <h5 className="font-black text-sm uppercase text-zinc-200">{comp.title}</h5>
                                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">{comp.isActive ? 'Em andamento' : 'Finalizada'}</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs font-black text-white">R$ {compTotal.toLocaleString('pt-BR')}</p>
                                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-end">
                                        {compViews.toLocaleString()} VIEWS • CPM R$ {compCpm.toFixed(2)}
                                        <InfoTooltip text="CPM (Custo por Mil): Indica quanto a competição custou para cada 1.000 visualizações geradas." />
                                      </p>
                                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1">{Math.round(percent)}% Pago</p>
                                    </div>
                                  </div>
                                  <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${percent}%` }}
                                      transition={{ duration: 1, ease: 'easeOut' }}
                                      className={`h-full ${percent >= 100 ? 'bg-emerald-500' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'}`} 
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            {competitions.length === 0 && (
                              <div className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-[32px]">
                                 <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Nenhuma competição registrada para análise financeira.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {(financeTab === 'PENDING' || financeTab === 'REALIZED') && (
                      <div className="animate-in fade-in duration-500">
                        <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-800/50 overflow-x-auto custom-scrollbar w-full md:w-fit pb-1 md:pb-1.5 mb-6">
                          {competitions.length === 0 && (
                            <span className="px-4 py-2 text-zinc-600 font-black text-[10px] uppercase tracking-widest">Nenhuma competição cadastrada</span>
                          )}
                          {competitions.map(comp => (
                            <button
                              key={comp.id}
                              onClick={() => setFinanceCompId(comp.id)}
                              className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 ${financeCompId === comp.id ? 'bg-amber-500/10 text-amber-500 shadow-md border border-amber-500/20' : 'text-zinc-500 hover:text-amber-400 hover:bg-amber-500/5'}`}
                            >
                              <Trophy className="w-3.5 h-3.5" /> {comp.title}
                            </button>
                          ))}
                        </div>
                        
                        <ListHeader columns={['INTEGRANTE', 'CHAVE PIX', 'SALDO', 'STATUS', 'GERENCIAR']} gridClass="grid-cols-[1.5fr_1fr_1.5fr_150px_220px]" />
                        <div className="max-h-[700px] overflow-y-auto custom-scrollbar">
                          {(() => {
                            const filteredUsers = approvedUsers.filter(u => {
                              const b = financeCompId ? (u.competitionStats?.[financeCompId]?.balance || 0) : 0;
                              const paid = financeCompId ? (u.competitionStats?.[financeCompId]?.paidTotal || 0) : 0;
                              if (financeTab === 'PENDING') return b > 0;
                              // REALIZED: teve pagamento confirmado nesta competição
                              return paid > 0 && b <= 0;
                            });
                            
                            return (
                              <>
                                {filteredUsers.map(u => (
                                  <FinancialRow 
                                    key={u.uid} 
                                    user={u} 
                                    onViewLinks={setAuditUserId} 
                                    compId={financeCompId} 
                                    isPaidView={financeTab === 'REALIZED'}
                                  />
                                ))}
                                
                                {filteredUsers.length === 0 && (
                                  <div className="py-32 text-center">
                                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800">
                                      <Users className="w-8 h-8 text-zinc-700" />
                                    </div>
                                    <p className="text-zinc-700 font-black uppercase text-[10px] tracking-[0.3em]">
                                      Nenhum integrante {financeTab === 'PENDING' ? 'com pagamento pendente' : 'sem pagamentos pendentes'} nesta aba.
                                    </p>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        )}



        {tab === 'POSTS' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {syncDetailCompId ? (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800/50">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase gold-gradient">
                      Triagem: {competitions.find(c => c.id === syncDetailCompId)?.title}
                    </h3>
                    <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Aprovação de Novos Links</p>
                  </div>
                  <button
                    onClick={() => setSyncDetailCompId(null)}
                    className="px-8 py-3 bg-zinc-800 text-white font-black rounded-2xl text-xs hover:bg-zinc-700 transition-all flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> VOLTAR AOS CARDS
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {posts.filter(p => p.status === 'pending' && p.competitionId === syncDetailCompId).map(post => (
                    <div key={post.id} className="p-6 rounded-3xl glass border border-zinc-800 flex flex-col md:flex-row items-center gap-6 group hover:border-amber-500/30 transition-all">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
                        {post.platform === 'tiktok' ? <Zap className="w-8 h-8 text-amber-500" /> :
                          post.platform === 'youtube' ? <TrendingUp className="w-8 h-8 text-red-500" /> :
                            <Camera className="w-8 h-8 text-pink-500" />}
                      </div>
                      <div className="flex-1 min-w-0 text-center md:text-left">
                        <p className="text-sm font-black text-zinc-300 uppercase tracking-tight mb-1">{post.userName}</p>
                        <p className="font-bold truncate text-zinc-500 mb-2 text-xs">{post.url}</p>
                        <div className="flex items-center justify-center md:justify-start gap-4 text-[10px] font-black text-zinc-500">
                          <span className="uppercase">{post.platform}</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-800" />
                          <span>{new Date(post.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <a href={post.url} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-xl bg-zinc-900 text-zinc-400 font-bold text-xs hover:text-zinc-100 transition-colors">
                          Ver Link
                        </a>
                        <button
                          onClick={() => handlePostStatus(post.id, 'approved')}
                          className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all"
                          title="Aprovar Link"
                        >
                          <CheckCircle2 className="w-6 h-6" />
                        </button>
                        <button
                          onClick={() => handlePostStatus(post.id, 'rejected')}
                          className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                          title="Rejeitar Link"
                        >
                          <XCircle className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase gold-gradient">Triagem por Competição</h3>
                  <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Links pendentes aguardando revisão oficial.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {competitions.map(comp => {
                    const compPendingPosts = posts.filter(p => p.competitionId === comp.id && p.status === 'pending');
                    if (compPendingPosts.length === 0) return null;

                    return (
                      <div 
                        key={comp.id} 
                        onClick={() => setSyncDetailCompId(comp.id)}
                        className="p-8 rounded-[40px] glass border border-zinc-800 flex flex-col justify-between group hover:border-amber-500/50 transition-all cursor-pointer bg-zinc-900/20 shadow-xl shadow-black/20"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-800 text-zinc-400 flex items-center justify-center group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-colors">
                              <History className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-black text-sm uppercase truncate max-w-[150px]">{comp.title}</h4>
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{compPendingPosts.length} Links p/ Revisar</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-8 flex items-center justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                          <span>INICIAR TRIAGEM</span>
                          <ChevronRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                  {competitions.length === 0 || posts.filter(p => p.status === 'pending').length === 0 && (
                    <div className="col-span-full py-20 text-center border border-dashed border-zinc-800 rounded-[40px]">
                      <ShieldCheck className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                      <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">Nenhum post pendente no momento.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : tab === 'SINCRONIZACAO' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {syncDetailCompId ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50">
                  <div>
                    <h3 className="text-xl font-black uppercase gold-gradient">
                      Vídeos: {competitions.find(c => c.id === syncDetailCompId)?.title}
                    </h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Aguardando Primeira Sincronização</p>
                  </div>
                  <button
                    onClick={() => setSyncDetailCompId(null)}
                    className="px-6 py-2 bg-zinc-800 text-white font-black rounded-xl text-xs hover:bg-zinc-700 transition-all flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> VOLTAR AOS CARDS
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {posts.filter(p => p.status === 'approved' && p.competitionId === syncDetailCompId).map(post => (
                    <div key={post.id} className="p-6 rounded-3xl glass flex flex-col md:flex-row items-center gap-6 group hover:border-amber-500/30 transition-all">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
                        {post.platform === 'tiktok' ? <Zap className="w-8 h-8 text-amber-500" /> :
                          post.platform === 'youtube' ? <TrendingUp className="w-8 h-8 text-red-500" /> :
                            <Camera className="w-8 h-8 text-pink-500" />}
                      </div>
                      <div className="flex-1 min-w-0 text-center md:text-left">
                        <p className="text-sm font-black text-zinc-300 uppercase tracking-tight mb-1">{post.userName}</p>
                        <p className="font-bold truncate text-zinc-500 mb-2 text-xs">{post.url}</p>
                        <div className="flex items-center justify-center md:justify-start gap-4 text-[10px] font-black text-zinc-500">
                          <span className="uppercase">{post.platform}</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-800" />
                          <span>{new Date(post.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <a href={post.url} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-xl bg-zinc-900 text-zinc-400 font-bold text-xs hover:text-zinc-100 transition-colors">
                          Ver Link
                        </a>
                        <button
                          onClick={async () => {
                            setSyncingPostId(post.id);
                            try {
                              await syncSinglePostWithApify(apifyKey, post);
                              await updateDoc(doc(db, 'posts', post.id), { status: 'synced' });
                              alert('Vídeo sincronizado com sucesso!');
                            } catch (e: any) {
                              alert('Erro ao sincronizar: ' + e.message);
                            } finally {
                              setSyncingPostId(null);
                            }
                          }}
                          disabled={syncingPostId === post.id}
                          className="flex items-center gap-2 px-6 py-3 gold-bg text-black font-black rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50"
                        >
                          {syncingPostId === post.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          SINCRONIZAR
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800/50">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase gold-gradient">Sincronização por Competição</h3>
                    <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Selecione uma competição ou processe todos de forma sequencial.</p>
                    {settings.lastSync && (
                      <p className="text-amber-500/60 font-black text-[10px] uppercase tracking-[0.2em] mt-2">
                        ÚLTIMA SINCRONIZAÇÃO: {formatLastSyncDate(settings.lastSync)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleSyncApprovedSequentially}
                    disabled={syncing}
                    className="px-10 py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-amber-500/20 disabled:opacity-50"
                  >
                    {syncing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    SINCRONIZAR TUDO (SEQUENCIAL)
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {competitions.map(comp => {
                    const compApprovedPosts = posts.filter(p => p.competitionId === comp.id && p.status === 'approved');
                    if (compApprovedPosts.length === 0) return null;

                    return (
                      <div 
                        key={comp.id} 
                        onClick={() => setSyncDetailCompId(comp.id)}
                        className="p-8 rounded-[40px] glass border border-zinc-800 flex flex-col justify-between group hover:border-amber-500/50 transition-all cursor-pointer bg-zinc-900/20"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                              <Zap className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-black text-sm uppercase truncate max-w-[150px]">{comp.title}</h4>
                              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{compApprovedPosts.length} Vídeos Pendentes</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-8 flex items-center justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                          <span>VER LINKS</span>
                          <ChevronRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                  {competitions.length === 0 || posts.filter(p => p.status === 'approved').length === 0 && (
                    <div className="col-span-full py-20 text-center border border-dashed border-zinc-800 rounded-[40px]">
                      <Clock className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                      <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">Nenhuma competição com vídeos aguardando sincronização.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : tab === 'SYNC' ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/50 gap-4">
              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase">Sincronização de Vídeos</h3>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Atualize as métricas de todos os vídeos aprovados</p>
                {settings.lastResync && (
                  <p className="text-amber-500/60 font-black text-[10px] uppercase tracking-[0.2em] mt-2">
                    ÚLTIMA RESSINCRONIZAÇÃO: {formatLastSyncDate(settings.lastResync)}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Filtrar Competição</label>
                  <select
                    value={selectedSyncCompId}
                    onChange={(e) => setSelectedSyncCompId(e.target.value)}
                    className="bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs font-bold focus:border-amber-500 outline-none text-white min-w-[200px]"
                  >
                    <option value="ALL">TODAS AS COMPETIÇÕES</option>
                    {competitions.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSyncAllSequentially}
                  disabled={syncing}
                  className="flex items-center justify-center gap-2 px-6 py-3 gold-bg text-black font-black rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50 text-xs mt-auto"
                >
                  {syncing && !syncingPostId ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  SINCRONIZAR FILTRADOS
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {posts.filter(p => {
                const isSynced = p.status === 'synced' || p.status === 'banned';
                const matchesComp = selectedSyncCompId === 'ALL' || p.competitionId === selectedSyncCompId;
                return isSynced && matchesComp;
              }).map(post => (
                <div key={post.id} className="p-6 rounded-3xl glass flex flex-col md:flex-row items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
                    {post.platform === 'tiktok' ? <Zap className="w-8 h-8 text-amber-500" /> :
                      post.platform === 'youtube' ? <TrendingUp className="w-8 h-8 text-red-500" /> :
                        <Camera className="w-8 h-8 text-pink-500" />}
                  </div>
                  <div className="flex-1 min-w-0 text-center md:text-left">
                    <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                      <p className="text-sm font-black text-zinc-300 uppercase tracking-tight">{post.userName}</p>
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${post.status === 'synced' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {post.status === 'synced' ? 'SINCRONIZADO' : 'BANIDO'}
                      </span>
                    </div>
                    <p className="font-bold truncate text-zinc-500 mb-2 text-xs">{post.url}</p>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-[10px] font-black text-zinc-500">
                      <div className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.views.toLocaleString()}</div>
                      <div className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.likes.toLocaleString()}</div>
                      <div className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {post.comments.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Classificação</label>
                      <select
                        value={post.status}
                        onChange={(e) => handleStatusToggle(post.id, e.target.value as PostStatus, post.userId)}
                        className={`bg-zinc-900 border-2 rounded-xl py-2 px-3 text-[10px] font-black outline-none transition-all cursor-pointer ${post.status === 'synced' ? 'border-emerald-500/50 text-emerald-500' : 'border-red-500/50 text-red-500'}`}
                      >
                        <option value="synced">✅ SINCRONIZADO</option>
                        <option value="banned">🚫 BANIDO</option>
                      </select>
                    </div>

                    <button
                      onClick={() => handleSingleSync(post)}
                      disabled={syncing || syncingPostId === post.id || post.status === 'banned'}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 text-amber-500 font-black text-[10px] hover:bg-amber-500 hover:text-black transition-all disabled:opacity-30 self-end"
                    >
                      {syncingPostId === post.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      ATUALIZAR
                    </button>
                    
                    <button
                      onClick={() => {
                        setRejectionReason(post.rejectionReason || '');
                        setRejectionModal({ isOpen: true, postId: post.id, status: post.status });
                      }}
                      className="p-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-all self-end"
                      title="Enviar/Editar Mensagem"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setPostToDelete(post.id)}
                      title="Excluir vídeo aprovado"
                    >
                      <Trash2 className="w-4 h-4" />
                      EXCLUIR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : tab === 'USERS_APPROVED' ? (
          <div className="space-y-6">
            <h3 className="text-xl font-black uppercase tracking-tight">Usuários Aprovados</h3>
            {auditUserId ? (
              <div className="border border-zinc-800 rounded-3xl p-6 bg-zinc-950">
                {/* ... auditoria view content ... */}
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-black uppercase text-amber-500">Links do Usuário</h3>
                    <p className="text-xs text-zinc-500 font-bold tracking-widest uppercase">
                      Visualizando postagens de {approvedUsers.find(u => u.uid === auditUserId)?.displayName}
                    </p>
                  </div>
                  <button
                    onClick={() => setAuditUserId(null)}
                    className="px-4 py-2 bg-zinc-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 hover:bg-zinc-700"
                  >
                    <X className="w-4 h-4" /> VOLTAR À LISTA
                  </button>
                </div>

                {/* Form para Envio Manual pelo Admin */}
                <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50 mb-8 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-amber-500" />
                    </div>
                    <h4 className="text-sm font-black uppercase gold-gradient">Protocolar Link Manualmente</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Plataforma</label>
                      <select 
                        value={adminManualPlatform}
                        onChange={(e) => setAdminManualPlatform(e.target.value as any)}
                        className="bg-black border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-amber-500 transition-all"
                      >
                        <option value="tiktok">TIKTOK</option>
                        <option value="youtube">YOUTUBE</option>
                        <option value="instagram">INSTAGRAM</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Competição</label>
                      <select
                        value={adminManualCompId}
                        onChange={(e) => setAdminManualCompId(e.target.value)}
                        className="bg-black border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-amber-500 transition-all"
                      >
                        <option value="">SELECIONAR COMPETIÇÃO</option>
                        {competitions.filter(c => c.isActive).map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">URL do Vídeo</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={adminManualUrl}
                          onChange={(e) => setAdminManualUrl(e.target.value)}
                          placeholder="Cole o link aqui..."
                          className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-amber-500 transition-all"
                        />
                        <button
                          onClick={handleAdminSubmitPost}
                          disabled={adminSubmitting}
                          className="px-6 py-3 gold-bg text-black font-black rounded-xl text-[10px] hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50 min-w-[120px]"
                        >
                          {adminSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : 'ADICIONAR LINK'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                  {posts.filter(p => p.userId === auditUserId).map(post => (
                    <div key={post.id} className="p-4 rounded-2xl bg-black border border-zinc-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        {post.platform === 'tiktok' ? <Zap className="w-6 h-6 text-amber-500" /> :
                          post.platform === 'youtube' ? <TrendingUp className="w-6 h-6 text-red-500" /> :
                            <Camera className="w-6 h-6 text-pink-500" />}
                        <div className="flex flex-col overflow-hidden max-w-[200px]">
                          <p className="font-bold text-xs truncate text-zinc-300">{post.url}</p>
                          <p className={`text-[10px] font-black uppercase ${post.status === 'approved' || post.status === 'synced' ? 'text-emerald-500' : post.status === 'rejected' || post.status === 'banned' ? 'text-red-500' : 'text-amber-500'}`}>
                            STATUS: {post.status === 'approved' || post.status === 'synced' ? 'APROVADO' : post.status === 'rejected' || post.status === 'banned' ? 'RECUSADO' : 'EM TRIAGEM'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 text-xs w-full md:w-auto">
                        <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-xl">
                          <span className="text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1"><Eye className="w-3 h-3 text-zinc-400" /> {(post.views || 0).toLocaleString()}</span>
                          <span className="text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1"><Heart className="w-3 h-3 text-zinc-400" /> {(post.likes || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={post.url} target="_blank" rel="noreferrer" className="flex-1 text-center sm:flex-none px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 font-bold hover:text-white transition-colors">
                            Ver Link
                          </a>
                          <button
                            onClick={() => handlePostStatus(post.id, 'approved')}
                            className={`p-2 rounded-xl transition-all ${post.status === 'approved' || post.status === 'synced' ? 'bg-emerald-500 text-black' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black'}`}
                            title="Aprovar Vídeo"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setRejectionReason(post.rejectionReason || '');
                              setRejectionModal({ isOpen: true, postId: post.id, status: post.status });
                            }}
                            className={`p-2 rounded-xl transition-all ${post.rejectionReason ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                            title="Enviar/Editar Mensagem"
                          >
                            <MessageSquare className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handlePostStatus(post.id, 'rejected')}
                            className={`p-2 rounded-xl transition-all ${post.status === 'rejected' || post.status === 'banned' ? 'bg-red-500 text-black' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black'}`}
                            title="Rejeitar Vídeo"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {posts.filter(p => p.userId === auditUserId).length === 0 && (
                    <p className="text-center py-6 text-zinc-500 font-bold">Nenhum vídeo registrado para este usuário.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <ListHeader columns={['USUÁRIO', 'EMAIL', 'CARGO', 'AÇÕES']} gridClass="grid-cols-[1.5fr_1.2fr_1fr_220px]" />
                {approvedUsers.map(u => (
                  <UserListRow
                    key={u.uid}
                    user={u}
                    onViewLinks={setAuditUserId}
                    onEdit={setEditingUser}
                    onRemove={handleDeleteUser}
                    onArchive={() => handleArchiveUser(u.uid, true)}
                    onUpdateRole={handleUpdateUserRole}
                  />
                ))}
              </div>
            )}

            {editingUser && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setEditingUser(null)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative w-full max-w-md glass p-8 rounded-[40px] border border-zinc-800 space-y-6"
                >
                  <h3 className="text-2xl font-black">Editar Usuário</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome de Exibição</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Função / Cargo</label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as any)}
                        className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all text-zinc-300 cursor-pointer"
                      >
                        <option value="user">USUÁRIO COMUM (CRIADOR DE CONTEÚDO)</option>
                        <option value="auditor">AUDITOR — REVISA VÍDEOS POSTADOS</option>
                        <option value="administrativo">ADMINISTRATIVO — FINANCEIRO + COMPETIÇÕES</option>
                        <option value="admin">ADMINISTRADOR (DIRETORIA) — ACESSO TOTAL</option>
                      </select>
                      <p className="text-[9px] text-zinc-600 font-bold ml-1">⚠️ Alterar a função afeta imediatamente o acesso do usuário</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nova Senha (opcional)</label>
                      <input
                        type="text"
                        value={editPass}
                        onChange={(e) => setEditPass(e.target.value)}
                        placeholder="Deixe em branco para não alterar"
                        className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleEditUser}
                      className="w-full py-4 gold-bg text-black font-black rounded-2xl hover:scale-[1.02] transition-all"
                    >
                      SALVAR ALTERAÇÕES
                    </button>
                    <button
                      onClick={() => setEditingUser(null)}
                      className="w-full py-4 bg-zinc-900 text-zinc-400 font-black rounded-2xl"
                    >
                      CANCELAR
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        ) : tab === 'ARCHIVED' ? (
          <div className="space-y-6">
            <h3 className="text-xl font-black uppercase tracking-tight">Usuários Arquivados</h3>
            <div className="space-y-1">
              <ListHeader columns={['USUÁRIO', 'EMAIL', 'AÇÕES']} gridClass="grid-cols-[1.5fr_1.5fr_200px]" />
              {archivedUsers.map(u => (
                <ArchivedUserRow
                  key={u.uid}
                  user={u}
                  onRestore={() => handleArchiveUser(u.uid, false)}
                  onRemove={handleDeleteUser}
                />
              ))}
              {archivedUsers.length === 0 && (
                <div className="py-20 text-center space-y-4">
                  <Archive className="w-12 h-12 text-zinc-800 mx-auto" />
                  <p className="text-zinc-500 font-bold">Nenhum usuário arquivado.</p>
                </div>
              )}
            </div>
          </div>
        ) : tab === 'USERS' ? (
          <div className="space-y-6">
            <h3 className="text-xl font-black uppercase tracking-tight">Solicitações de Acesso</h3>
            <div className="space-y-1">
              <ListHeader columns={['USUÁRIO', 'EMAIL', 'AÇÕES']} gridClass="grid-cols-[1.5fr_1.5fr_200px]" />
              {pendingUsers.map(u => (
                <PendingUserRow
                  key={u.uid}
                  user={u}
                  onApprove={(id) => handleUserApproval(id, true)}
                  onArchive={() => handleArchiveUser(u.uid, true)}
                  onRemove={handleDeleteUser}
                />
              ))}
              {pendingUsers.length === 0 && (
                <div className="py-20 text-center space-y-4">
                  <Users className="w-12 h-12 text-zinc-800 mx-auto" />
                  <p className="text-zinc-500 font-bold">Nenhum usuário aguardando aprovação!</p>
                </div>
              )}
            </div>
          </div>
        ) : tab === 'COMPETITIONS' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black uppercase tracking-tight">
                {selectedCompId ? 'Dashboard da Competição' : 'Competições'}
              </h3>
              {((userRole === 'admin' || userRole === 'administrativo')) && !selectedCompId && (
                <button
                  onClick={() => setIsCreatingComp(!isCreatingComp)}
                  className="px-6 py-2 gold-bg text-black font-black rounded-xl text-xs hover:scale-105 transition-all"
                >
                  {isCreatingComp ? 'CANCELAR' : 'NOVA COMPETIÇÃO'}
                </button>
              )}
              {selectedCompId && (
                <button
                  onClick={() => setSelectedCompId(null)}
                  className="px-6 py-2 bg-zinc-800 text-white font-black rounded-xl text-xs flex items-center gap-2 hover:bg-zinc-700 transition-all"
                >
                  <X className="w-4 h-4" /> VOLTAR
                </button>
              )}
            </div>

            {selectedCompId ? (() => {
              const comp = competitions.find(c => c.id === selectedCompId);
              if (!comp) return null;

              // Métricas: Somente Aprovados dentro do período
              const compPosts = posts.filter(p =>
                p.status === 'approved' &&
                p.timestamp >= comp.startDate &&
                p.timestamp <= (comp.endDate + 86399999) // Inclui o dia todo do fim
              );

              const stats = compPosts.reduce((acc, p) => ({
                views: acc.views + (p.views || 0),
                likes: acc.likes + (p.likes || 0),
                comments: acc.comments + (p.comments || 0),
                shares: acc.shares + (p.shares || 0),
                total: acc.total + 1,
                insta: acc.insta + (p.platform === 'instagram' ? 1 : 0)
              }), { views: 0, likes: 0, comments: 0, shares: 0, total: 0, insta: 0 });

              // CPM não disponível neste contexto (sem dados de transações financeiras do admin)
              const cpm = 0;
              const goalPercent = comp.goalTarget ? Math.min((stats.views / comp.goalTarget) * 100, 100) : 0;

              // Ranking Top 10 por Views nesta competição
              const rankingData = compPosts.reduce((acc: any, p) => {
                if (!acc[p.userId]) {
                  acc[p.userId] = {
                    name: p.userName,
                    views: 0,
                    count: 0,
                    uid: p.userId
                  };
                }
                acc[p.userId].views += (p.views || 0);
                acc[p.userId].count += 1;
                return acc;
              }, {});
              const sortedRanking = Object.values(rankingData).sort((a: any, b: any) => b.views - a.views).slice(0, 10);

              return (
                <div className="space-y-8 pb-10">
                  {/* Grid de KPIs - PORTFÓLIO STYLE */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* TOTAL VIEWS */}
                    <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[60px]" />
                      <div className="relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6">
                          <Eye className="w-6 h-6" />
                        </div>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Visualizações Totais</p>
                        <h4 className="text-4xl font-black text-white tracking-tighter">{stats.views.toLocaleString()}</h4>
                      </div>
                    </div>

                    {/* CPM */}
                    <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px]" />
                      <div className="relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6">
                          <DollarSign className="w-6 h-6" />
                        </div>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">CPM (Investimento/1k Views)</p>
                        <h4 className="text-3xl font-black text-white tracking-tighter">R$ {cpm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                      </div>
                    </div>

                    {/* META DA COMPETIÇÃO */}
                    <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900 relative overflow-hidden group lg:col-span-2">
                       <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-[80px]" />
                       <div className="relative z-10 h-full flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Meta da Competição</p>
                              <h4 className="text-sm font-black text-white uppercase tracking-tight">
                                {comp.goalTarget ? `${comp.goalTarget.toLocaleString()} ${comp.goalMetric || 'VIEWS'}` : 'NENHUMA META DEFINIDA'}
                              </h4>
                            </div>
                            <div className="text-right">
                               <span className="text-3xl font-black gold-gradient">{Math.round(goalPercent)}%</span>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="h-4 w-full bg-black rounded-full overflow-hidden border border-zinc-900 p-1">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${goalPercent}%` }}
                                 className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                               />
                            </div>
                            <div className="flex justify-between text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                               <span>Início</span>
                               <span>Atingido: {stats.views.toLocaleString()}</span>
                               <span>Objetivo</span>
                            </div>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Secondary stats row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
                      <Heart className="w-5 h-5 text-pink-500" />
                      <span className="text-2xl font-black">{stats.likes.toLocaleString()}</span>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Curtidas</span>
                    </div>
                    <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      <span className="text-2xl font-black">{stats.total}</span>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Posts Publicados</span>
                    </div>
                    <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
                      <Camera className="w-5 h-5 text-pink-500" />
                      <span className="text-2xl font-black">{stats.insta}</span>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Postagens Insta</span>
                    </div>
                    <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
                      <MessageSquare className="w-5 h-5 text-blue-500" />
                      <span className="text-2xl font-black">{stats.comments.toLocaleString()}</span>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Interações</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Ranking Interno */}
                    <div className="p-8 rounded-[40px] glass border border-zinc-800 space-y-6">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-6 h-6 text-amber-500" />
                        <h4 className="text-xl font-black uppercase tracking-tight">Top 10 Performance</h4>
                      </div>
                      <div className="space-y-3">
                        {sortedRanking.map((u: any, i) => (
                          <div key={u.uid} className="flex items-center justify-between p-4 rounded-2xl bg-black border border-zinc-800/50">
                            <div className="flex items-center gap-4">
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-500'}`}>
                                {i + 1}
                              </span>
                              <div>
                                <p className="font-black text-sm uppercase">{u.name}</p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase">{u.count} vídeos aprovados</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-amber-500 text-sm">{u.views.toLocaleString()}</p>
                              <p className="text-[10px] font-black text-zinc-600 uppercase">VIEWS</p>
                            </div>
                          </div>
                        ))}
                        {sortedRanking.length === 0 && (
                          <p className="text-center py-10 text-zinc-600 font-bold">NENHUM DADO DE RANKING DISPONÍVEL.</p>
                        )}
                      </div>
                    </div>

                    {/* Detalhes da Competição */}
                    <div className="p-8 rounded-[40px] glass border border-zinc-800 space-y-6">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-zinc-500" />
                        <h4 className="text-xl font-black uppercase tracking-tight">Período e Regras</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 rounded-3xl bg-zinc-900/50">
                          <p className="text-[10px] font-black text-zinc-500 uppercase mb-1">Início</p>
                          <p className="font-black">{new Date(comp.startDate).toLocaleDateString()}</p>
                        </div>
                        <div className="p-6 rounded-3xl bg-zinc-900/50">
                          <p className="text-[10px] font-black text-zinc-500 uppercase mb-1">Término</p>
                          <p className="font-black">{new Date(comp.endDate).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Seção de Prêmios no Dashboard */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-amber-500" />
                          <h5 className="text-xs font-black uppercase tracking-widest text-zinc-400">Tabela de Premiação</h5>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {/* Bônus por 1M Views â€” destaque especial */}
                          {(comp as any).viewBonus > 0 && (
                            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 flex items-center gap-3">
                              <Eye className="w-5 h-5 text-amber-500 shrink-0" />
                              <div>
                                <p className="text-[9px] font-black text-amber-500 uppercase">Bônus por 1 Milhão de Views</p>
                                <p className="text-lg font-black text-white">R$ {(comp as any).viewBonus.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <p className="text-[9px] text-zinc-500 font-bold">Pago a cada 1.000.000 views atingidas por vídeo</p>
                              </div>
                            </div>
                          )}
                          {comp.prizesMonthly && comp.prizesMonthly.length > 0 && (
                            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                              <p className="text-[9px] font-black text-amber-500 uppercase mb-2">RANKING MENSAL (ACUMULADO DO PERÍODO)</p>
                              <div className="flex flex-wrap gap-2">
                                {comp.prizesMonthly.map((p, idx) => (
                                  <span key={idx} className="text-[10px] font-bold bg-black px-2 py-1 rounded-lg border border-zinc-800">
                                    {p.label}: <span className="text-amber-400">R$ {p.value}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {comp.prizesDaily && comp.prizesDaily.length > 0 && (
                            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                              <p className="text-[9px] font-black text-blue-400 uppercase mb-2">PREMIAÇÃO DIÁRIA (VIEWS DO DIA)</p>
                              <div className="flex flex-wrap gap-2">
                                {comp.prizesDaily.map((p, idx) => (
                                  <span key={idx} className="text-[10px] font-bold bg-black px-2 py-1 rounded-lg border border-zinc-800">
                                    {p.label}: <span className="text-blue-400">R$ {p.value}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {comp.prizes && comp.prizes.length > 0 && (
                            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                              <p className="text-[9px] font-black text-emerald-400 uppercase mb-2">RANKING MENSAL</p>
                              <div className="flex flex-wrap gap-2">
                                {comp.prizes.map((p, idx) => (
                                  <span key={idx} className="text-[10px] font-bold bg-black px-2 py-1 rounded-lg border border-zinc-800">
                                    {p.label}: <span className="text-emerald-400">R$ {p.value}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {comp.prizesInstagram && comp.prizesInstagram.length > 0 && (
                            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
                              <p className="text-[9px] font-black text-pink-500 uppercase mb-2">INSTAGRAM (QUANTIDADE DE POSTS)</p>
                              <div className="flex flex-wrap gap-2">
                                {comp.prizesInstagram.map((p, idx) => (
                                  <span key={idx} className="text-[10px] font-bold bg-black px-2 py-1 rounded-lg border border-zinc-800">
                                    {p.label}: <span className="text-pink-400">R$ {p.value}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-6 rounded-3xl bg-zinc-900/50">
                        <p className="text-[10px] font-black text-zinc-500 uppercase mb-1">Hashtags Obrigatórias</p>
                        <p className="font-mono text-xs text-amber-500/80">{comp.hashtags || 'Nenhuma'}</p>
                      </div>
                      <div className="p-6 rounded-3xl bg-zinc-900/50">
                        <p className="text-[10px] font-black text-zinc-500 uppercase mb-1">Marcações</p>
                        <p className="font-mono text-xs text-amber-500/80">{comp.mentions || 'Nenhuma'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <>
                {(userRole === 'admin' || userRole === 'administrativo') && isCreatingComp && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 rounded-[40px] glass border border-zinc-800 space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Título da Competição</label>
                        <input
                          type="text"
                          value={compTitle}
                          onChange={(e) => setCompTitle(e.target.value)}
                          placeholder="Ex: Copa MetaRayx de Verão"
                          className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Banner da Competição</label>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleBannerUpload}
                              className="hidden"
                              id="banner-upload"
                            />
                            <label
                              htmlFor="banner-upload"
                              className="w-full flex items-center justify-center gap-2 bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold cursor-pointer hover:border-amber-500 transition-all text-zinc-400"
                            >
                              <TrendingUp className="w-4 h-4" />
                              {compBanner ? 'BANNER CARREGADO' : 'FAZER UPLOAD DO BANNER'}
                            </label>
                          </div>
                          {compBanner && (
                            <div className="w-20 h-14 rounded-xl overflow-hidden shrink-0 border border-zinc-800">
                              <img src={compBanner} className="w-full h-full object-cover" alt="Preview" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Descrição</label>
                        <textarea
                          value={compDesc}
                          onChange={(e) => setCompDesc(e.target.value)}
                          placeholder="Breve resumo da competição..."
                          className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all h-24 resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Regras Detalhadas</label>
                        <textarea
                          value={compRules}
                          onChange={(e) => setCompRules(e.target.value)}
                          placeholder="Liste todas as regras aqui..."
                          className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all h-24 resize-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Hashtags (#)</label>
                        <input
                          type="text"
                          value={compHashtags}
                          onChange={(e) => setCompHashtags(e.target.value)}
                          placeholder="#metarayx #viral"
                          className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Marcações (@)</label>
                        <input
                          type="text"
                          value={compMentions}
                          onChange={(e) => setCompMentions(e.target.value)}
                          placeholder="@metarayx_oficial"
                          className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Base do Ranking</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setCompRankingMetric('views')}
                          className={`py-4 px-6 rounded-2xl font-black text-xs transition-all border ${
                            compRankingMetric === 'views' 
                              ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/20' 
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                          }`}
                        >
                          👁️ POR VIEWS
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompRankingMetric('likes')}
                          className={`py-4 px-6 rounded-2xl font-black text-xs transition-all border ${
                            compRankingMetric === 'likes' 
                              ? 'bg-pink-500/10 border-pink-500 text-pink-500 shadow-lg shadow-pink-500/20' 
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                          }`}
                        >
                          ❤️ POR CURTIDAS
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1">Meta Global Coletiva (Progresso Opcional)</label>
                        <p className="text-[10px] text-zinc-500 font-bold ml-1">Para desativar, deixe o valor zerado (0).</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
                        <div className="grid grid-cols-2 p-1.5 bg-zinc-900 rounded-2xl border border-zinc-800">
                          <button
                            type="button"
                            onClick={() => setCompGoalMetric('views')}
                            className={`py-3 rounded-xl font-black text-[10px] transition-all uppercase tracking-widest ${
                              compGoalMetric === 'views' 
                                ? 'bg-cyan-500/10 text-cyan-400' 
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            👁️ Views
                          </button>
                          <button
                            type="button"
                            onClick={() => setCompGoalMetric('likes')}
                            className={`py-3 rounded-xl font-black text-[10px] transition-all uppercase tracking-widest ${
                              compGoalMetric === 'likes' 
                                ? 'bg-pink-500/10 text-pink-500' 
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            ❤️ Curtidas
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={compGoalTarget || ''}
                            onChange={(e) => setCompGoalTarget(Number(e.target.value))}
                            placeholder="Alvo (ex: 2000000)"
                            className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 pl-10 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                          />
                          <Trophy className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Bônus (Texto Livre)</label>
                        <input
                          type="text"
                          value={compBonuses}
                          onChange={(e) => setCompBonuses(e.target.value)}
                          placeholder="Ex: +10% para vídeos com áudio oficial"
                          className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-500 text-[9px] font-black">R$</span>
                          Bônus por 1 Milhão de Views
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-black text-sm">R$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={compViewBonus || ''}
                            onChange={(e) => setCompViewBonus(parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full bg-black border border-amber-500/30 rounded-2xl py-4 pl-10 pr-6 text-sm font-black text-amber-400 focus:border-amber-500 outline-none transition-all"
                          />
                        </div>
                        <p className="text-[9px] text-zinc-600 font-bold ml-1">Valor pago automaticamente a cada 1.000.000 views atingidas</p>
                      </div>
                    </div>

                    <div className="space-y-8 pt-4 border-t border-zinc-800">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black uppercase tracking-widest gold-gradient">Premiação Mensal (Geral)</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase">Posições:</span>
                            <input
                              type="number"
                              min="1" max="20"
                              value={compPositions}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                setCompPositions(val);
                                const newPrizes = [...compPrizes];
                                while (newPrizes.length < val) {
                                  newPrizes.push({ position: newPrizes.length + 1, value: 0, label: `${newPrizes.length + 1}º Lugar` });
                                }
                                setCompPrizes(newPrizes.slice(0, val));
                              }}
                              className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-xs font-bold text-center"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {compPrizes.map((p, i) => (
                            <div key={i} className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
                              <span className="text-[9px] font-black text-zinc-500 uppercase">{p.label}</span>
                              <input
                                type="number"
                                value={p.value}
                                onChange={(e) => {
                                  const newPrizes = [...compPrizes];
                                  newPrizes[i].value = parseFloat(e.target.value) || 0;
                                  setCompPrizes(newPrizes);
                                }}
                                className="w-full bg-transparent border-none text-sm font-black text-white focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black uppercase tracking-widest gold-gradient">Premiação Diária (Views)</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase">Posições:</span>
                            <input
                              type="number"
                              min="1" max="10"
                              value={compPositionsDaily}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                setCompPositionsDaily(val);
                                const newPrizes = [...compPrizesDaily];
                                while (newPrizes.length < val) {
                                  newPrizes.push({ position: newPrizes.length + 1, value: 0, label: `${newPrizes.length + 1}º Diário` });
                                }
                                setCompPrizesDaily(newPrizes.slice(0, val));
                              }}
                              className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-xs font-bold text-center"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {compPrizesDaily.map((p, i) => (
                            <div key={i} className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
                              <span className="text-[9px] font-black text-zinc-500 uppercase">{p.label}</span>
                              <input
                                type="number"
                                value={p.value}
                                onChange={(e) => {
                                  const newPrizes = [...compPrizesDaily];
                                  newPrizes[i].value = parseFloat(e.target.value) || 0;
                                  setCompPrizesDaily(newPrizes);
                                }}
                                className="w-full bg-transparent border-none text-sm font-black text-white focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black uppercase tracking-widest gold-gradient">Premiação Instagram (Posts)</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase">Posições:</span>
                            <input
                              type="number"
                              min="1" max="5"
                              value={compPositionsInstagram}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                setCompPositionsInstagram(val);
                                const newPrizes = [...compPrizesInstagram];
                                while (newPrizes.length < val) {
                                  newPrizes.push({ position: newPrizes.length + 1, value: 0, label: `${newPrizes.length + 1}º Insta` });
                                }
                                setCompPrizesInstagram(newPrizes.slice(0, val));
                              }}
                              className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-xs font-bold text-center"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {compPrizesInstagram.map((p, i) => (
                            <div key={i} className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1">
                              <span className="text-[9px] font-black text-zinc-500 uppercase">{p.label}</span>
                              <input
                                type="number"
                                value={p.value}
                                onChange={(e) => {
                                  const newPrizes = [...compPrizesInstagram];
                                  newPrizes[i].value = parseFloat(e.target.value) || 0;
                                  setCompPrizesInstagram(newPrizes);
                                }}
                                className="w-full bg-transparent border-none text-sm font-black text-white focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Início da Competição</label>
                        <input
                          type="date"
                          value={compStartDate}
                          onChange={(e) => setCompStartDate(e.target.value)}
                          className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Fim da Competição</label>
                        <input
                          type="date"
                          value={compEndDate}
                          onChange={(e) => setCompEndDate(e.target.value)}
                          className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleCreateCompetition}
                      className="w-full py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.01] transition-all"
                    >
                      PUBLICAR COMPETIÇÃO
                    </button>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {competitions.map(comp => (
                    <div key={comp.id} className="group relative p-4 rounded-[40px] glass border border-zinc-800 hover:border-amber-500/50 transition-all overflow-hidden flex flex-col">
                      <div className="relative h-44 rounded-[32px] overflow-hidden mb-6">
                        <img src={comp.bannerUrl} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" alt="" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${(comp.status || (comp.isActive ? 'active' : 'inactive')) === 'active' ? 'bg-emerald-500 text-black' : (comp.status === 'upcoming' ? 'bg-amber-500 text-black' : 'bg-red-500/20 text-red-500')}`}>
                            {(comp.status || (comp.isActive ? 'active' : 'inactive')) === 'active' ? 'Em Andamento' : (comp.status === 'upcoming' ? 'Em Breve' : 'Inativa')}
                          </span>
                        </div>
                      </div>

                      <div className="px-2 pb-2 flex-1 flex flex-col">
                        <h4 className="text-xl font-black uppercase tracking-tight mb-2 px-2">{comp.title}</h4>
                        <p className="text-xs text-zinc-500 font-bold px-2 line-clamp-2 mb-6">{comp.description}</p>

                        <div className="mt-auto space-y-4">
                          <button
                            onClick={() => setSelectedCompId(comp.id)}
                            className="w-full py-4 rounded-2xl bg-zinc-900 text-white font-black text-xs hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center gap-2"
                          >
                            <BarChart3 className="w-4 h-4" /> VER DASHBOARD
                          </button>

                          {userRole === 'admin' && (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-xl">
                                <button
                                  onClick={() => handleUpdateCompetitionStatus(comp.id, 'active')}
                                  className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${
                                    (comp.status || (comp.isActive ? 'active' : 'inactive')) === 'active' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:bg-zinc-800'
                                  }`}
                                >
                                  Ativa
                                </button>
                                <button
                                  onClick={() => handleUpdateCompetitionStatus(comp.id, 'upcoming')}
                                  className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${
                                    comp.status === 'upcoming' ? 'bg-amber-500 text-black' : 'text-zinc-500 hover:bg-zinc-800'
                                  }`}
                                >
                                  Em Breve
                                </button>
                                <button
                                  onClick={() => handleUpdateCompetitionStatus(comp.id, 'inactive')}
                                  className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${
                                    (comp.status || (comp.isActive ? 'active' : 'inactive')) === 'inactive' ? 'bg-red-500/20 text-red-500' : 'text-zinc-500 hover:bg-zinc-800'
                                  }`}
                                >
                                  Inativa
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditCompClick(comp)}
                                  className="flex-1 py-3 rounded-xl bg-zinc-800/50 text-zinc-400 font-black text-[10px] hover:text-white transition-all uppercase"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => setCompToDelete(comp.id)}
                                  className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {competitions.length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-4">
                      <Trophy className="w-12 h-12 text-zinc-800 mx-auto" />
                      <p className="text-zinc-500 font-bold text-sm uppercase tracking-widest">Nenhuma competição encontrada</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : tab === 'AVISOS' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black uppercase tracking-tight">Mural de Avisos</h3>
              <button
                onClick={() => setIsCreatingAnn(!isCreatingAnn)}
                className="px-6 py-2 gold-bg text-black font-black rounded-xl text-xs hover:scale-105 transition-all"
              >
                {isCreatingAnn ? 'CANCELAR' : 'NOVO AVISO'}
              </button>
            </div>

            {isCreatingAnn && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 rounded-[40px] glass border border-zinc-800 space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Título do Aviso</label>
                  <input
                    type="text"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="Ex: Manutenção Programada"
                    className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Mensagem</label>
                  <textarea
                    value={annMsg}
                    onChange={(e) => setAnnMsg(e.target.value)}
                    placeholder="Escreva o aviso para todos os usuários..."
                    className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all h-32 resize-none"
                  />
                </div>
                <button
                  onClick={handleCreateAnnouncement}
                  className="w-full py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.01] transition-all shadow-xl shadow-amber-500/10"
                >
                  PUBLICAR AVISO
                </button>
              </motion.div>
            )}

            <div className="space-y-4">
              {announcements.map(ann => (
                <div key={ann.id} className="p-6 rounded-3xl glass border border-zinc-800 flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-amber-500 uppercase tracking-tight">{ann.title || 'AVISO'}</h4>
                    <p className="text-zinc-300 font-bold">{ann.message}</p>
                    <p className="text-[10px] text-zinc-600 font-black mt-1 uppercase">{new Date(ann.timestamp).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => {
                      console.log('Trash button clicked for ann:', ann.id);
                      handleDeleteAnnouncement(ann.id);
                    }}
                    className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : tab === 'REGISTROS' ? (
          <div className="space-y-10">
            <div className="space-y-6">
              <h3 className="text-xl font-black uppercase tracking-tight">Solicitações de Inscrição</h3>
              <div className="grid grid-cols-1 gap-4">
                {pendingRegistrations.map(reg => {
                  const comp = competitions.find(c => c.id === reg.competitionId);
                  return (
                    <div key={reg.id} className="p-6 rounded-3xl glass flex flex-col md:flex-row items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0 overflow-hidden">
                        {comp ? (
                          <img src={comp.bannerUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <Trophy className="w-8 h-8 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-center md:text-left">
                        <p className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-1">
                          {reg.userName} <span className="text-zinc-700 mx-2">|</span> {comp?.title || 'Competição Desconhecida'}
                        </p>
                        <p className="font-bold text-zinc-300">{reg.userEmail}</p>
                        <div className="flex items-center justify-center md:justify-start gap-4 mt-1">
                          <p className="text-[10px] font-black text-zinc-600 uppercase">
                            Solicitado em {new Date(reg.timestamp).toLocaleString()}
                          </p>
                          {reg.acceptedRules && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">Regras Aceitas</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => handleDeleteRegistration(reg.id!)}
                          className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-md"
                          title="Remover Permanentemente (O usuário poderá solicitar novamente)"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleRegistrationStatus(reg.id!, 'rejected')}
                          className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all shadow-md"
                          title="Recusar"
                        >
                          <XCircle className="w-6 h-6" />
                        </button>
                        <button
                          onClick={() => handleRegistrationStatus(reg.id!, 'approved')}
                          className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all shadow-md"
                          title="Aprovar"
                        >
                          <CheckCircle2 className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {pendingRegistrations.length === 0 && (
                  <div className="py-20 text-center space-y-4">
                    <Clock className="w-12 h-12 text-zinc-800 mx-auto" />
                    <p className="text-zinc-500 font-bold">Nenhuma inscrição pendente!</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-black uppercase tracking-tight">Inscrições Aprovadas (Aceite de Regras)</h3>
              <div className="grid grid-cols-1 gap-4">
                {approvedRegistrations.map(reg => {
                  const comp = competitions.find(c => c.id === reg.competitionId);
                  return (
                    <div key={reg.id} className="p-6 rounded-3xl glass flex flex-col md:flex-row items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0 overflow-hidden">
                        {comp ? (
                          <img src={comp.bannerUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <Trophy className="w-8 h-8 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-center md:text-left">
                        <p className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-1">
                          {reg.userName} <span className="text-zinc-700 mx-2">|</span> {comp?.title || 'Competição Desconhecida'}
                        </p>
                        <p className="font-bold text-zinc-300">{reg.userEmail}</p>
                        <div className="flex items-center justify-center md:justify-start gap-4 mt-1">
                          <p className="text-[10px] font-black text-zinc-600 uppercase">Aprovado</p>
                          {reg.acceptedRules ? (
                            <span className="flex items-center gap-1 text-emerald-500 text-[10px] font-black uppercase">
                              <CheckCircle2 className="w-3 h-3" /> Regras Aceitas
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-500 text-[10px] font-black uppercase">
                              <XCircle className="w-3 h-3" /> Regras Não Aceitas
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => handleDeleteRegistration(reg.id!)}
                          className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                          title="Remover Inscrição"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-black uppercase tracking-tight text-red-500">Inscrições Recusadas</h3>
              <div className="grid grid-cols-1 gap-4">
                {rejectedRegistrations.map(reg => {
                  const comp = competitions.find(c => c.id === reg.competitionId);
                  return (
                    <div key={reg.id} className="p-6 rounded-3xl glass border border-red-500/20 flex flex-col md:flex-row items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0 overflow-hidden">
                        {comp ? (
                          <img src={comp.bannerUrl} className="w-full h-full object-cover grayscale opacity-50" alt="" />
                        ) : (
                          <Trophy className="w-8 h-8 text-red-500/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-center md:text-left">
                        <p className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-1">
                          {reg.userName} <span className="text-zinc-700 mx-2">|</span> {comp?.title || 'Competição Desconhecida'}
                        </p>
                        <p className="font-bold text-zinc-300">{reg.userEmail}</p>
                        <div className="flex items-center justify-center md:justify-start gap-4 mt-1">
                          <p className="text-[10px] font-black text-red-500 uppercase">Recusado</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => handleRegistrationStatus(reg.id!, 'pending')}
                          className="p-3 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black transition-all"
                          title="Voltar para Pendente"
                        >
                          <Clock className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRegistration(reg.id!)}
                          className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                          title="Remover Inscrição Permanentemente"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {rejectedRegistrations.length === 0 && (
                  <div className="py-20 text-center space-y-4">
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Nenhuma inscrição recusada no momento.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : tab === 'RESSINCRONIZACAO' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {syncDetailCompId ? (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800/50">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase gold-gradient">
                      Vídeos Sincronizados: {competitions.find(c => c.id === syncDetailCompId)?.title}
                    </h3>
                    <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Atualização Individual de Métricas</p>
                  </div>
                  <button
                    onClick={() => setSyncDetailCompId(null)}
                    className="px-8 py-3 bg-zinc-800 text-white font-black rounded-2xl text-xs hover:bg-zinc-700 transition-all flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> VOLTAR AOS CARDS
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {posts.filter(p => (p.status === 'synced' || p.status === 'banned') && p.competitionId === syncDetailCompId).map(post => (
                    <div key={post.id} className={`p-6 rounded-3xl glass border flex flex-col md:flex-row items-center gap-6 group transition-all ${post.status === 'banned' ? 'border-red-500/20 opacity-70' : 'border-zinc-800 hover:border-amber-500/30'}`}>
                      <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
                        {post.platform === 'tiktok' ? <Zap className="w-8 h-8 text-amber-500" /> :
                          post.platform === 'youtube' ? <TrendingUp className="w-8 h-8 text-red-500" /> :
                            <Camera className="w-8 h-8 text-pink-500" />}
                      </div>
                      <div className="flex-1 min-w-0 text-center md:text-left">
                        <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                          <p className={`text-sm font-black uppercase tracking-tight ${post.status === 'banned' ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>{post.userName}</p>
                          {post.status === 'synced' ? (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase">SINCRONIZADO</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-red-500/10 text-red-500 text-[9px] font-black uppercase">BANIDO</span>
                          )}
                        </div>
                        <p className="font-bold truncate text-zinc-500 mb-2 text-xs">{post.url}</p>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-[10px] font-black text-zinc-500">
                          <div className="flex items-center gap-1"><Eye className="w-3 h-3" /> {(post.views || 0).toLocaleString()}</div>
                          <div className="flex items-center gap-1"><Heart className="w-3 h-3" /> {(post.likes || 0).toLocaleString()}</div>
                          <div className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {(post.comments || 0).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex flex-col md:flex-row items-center gap-3 shrink-0">
                        <a href={post.url} target="_blank" rel="noreferrer" className="px-4 py-3 rounded-xl bg-zinc-900 text-zinc-400 font-bold text-[10px] uppercase tracking-widest hover:text-zinc-100 transition-colors text-center w-full md:w-auto">
                          Ver Link
                        </a>
                        
                        {post.status === 'synced' ? (
                          <button
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'posts', post.id), { status: 'banned' });
                                await updateUserMetrics(post.userId);
                                alert('Vídeo banido. As métricas foram descontadas dos Rankings globalmente.');
                              } catch(e: any) { alert('Erro ao banir: ' + e.message); }
                            }}
                            className="px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-500 font-black rounded-xl hover:bg-red-500 hover:text-white transition-all text-[10px] tracking-widest uppercase w-full md:w-auto text-center"
                          >
                            BANIR VÍDEO
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'posts', post.id), { status: 'synced' });
                                await updateUserMetrics(post.userId);
                                alert('Vídeo reativado! As métricas voltaram para os Rankings globalmente.');
                              } catch(e: any) { alert('Erro ao reativar: ' + e.message); }
                            }}
                            className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-black rounded-xl hover:bg-emerald-500 hover:text-black transition-all text-[10px] tracking-widest uppercase w-full md:w-auto text-center"
                          >
                            REATIVAR VÍDEO
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            setSyncingPostId(post.id);
                            try {
                              await syncSinglePostWithApify(apifyKey, post);
                              alert('Vídeo ressincronizado com sucesso!');
                            } catch (e: any) {
                              alert('Erro ao ressincronizar: ' + e.message);
                            } finally {
                              setSyncingPostId(null);
                            }
                          }}
                          disabled={syncingPostId === post.id}
                          className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 font-black rounded-xl hover:bg-amber-500 hover:text-black hover:border-amber-500 transition-all text-[10px] tracking-widest uppercase disabled:opacity-50 w-full md:w-auto"
                        >
                          {syncingPostId === post.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          RESSINC.
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/30 p-8 rounded-[40px] border border-zinc-800/50">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase gold-gradient">Ressincronização de Rankings</h3>
                    <p className="text-zinc-500 font-bold text-xs uppercase tracking-[0.2em]">Selecione uma competição para atualizar as métricas gerais.</p>
                  </div>
                  <button
                    onClick={handleSyncAllSequentially}
                    disabled={syncing}
                    className="px-10 py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-amber-500/20 disabled:opacity-50"
                  >
                    {syncing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    RESSINCRONIZAR TUDO
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {competitions.map(comp => {
                    const compPosts = posts.filter(p => p.competitionId === comp.id && (p.status === 'synced' || p.status === 'banned'));
                    if (compPosts.length === 0) return null;

                    return (
                      <div 
                        key={comp.id} 
                        onClick={() => setSyncDetailCompId(comp.id)}
                        className="p-8 rounded-[40px] glass border border-zinc-800 flex flex-col justify-between group hover:border-amber-500/50 transition-all cursor-pointer bg-zinc-900/20"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${comp.isActive ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-800 text-zinc-500'}`}>
                              <Trophy className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-black text-sm uppercase truncate max-w-[150px]">{comp.title}</h4>
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{compPosts.length} Vídeos Auditados</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-8 flex items-center justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                          <span>GERENCIAR LINKS</span>
                          <ChevronRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                  {competitions.length === 0 || posts.filter(p => p.status === 'synced' || p.status === 'banned').length === 0 && (
                    <div className="col-span-full py-20 text-center border border-dashed border-zinc-800 rounded-[40px]">
                      <Clock className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                      <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">Nenhuma competição com vídeos auditados.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : tab === 'SUGESTOES' ? (
          <div className="space-y-6">
            <h3 className="text-xl font-black uppercase tracking-tight">Sugestões dos Usuários</h3>
            <div className="grid grid-cols-1 gap-4">
              {suggestions.map(s => (
                <div key={s.id} className="p-6 rounded-3xl glass border border-zinc-800 flex items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">@{s.userName}</span>
                      <span className="text-[10px] text-zinc-600 font-black">{new Date(s.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-zinc-300 font-bold leading-relaxed">{s.message}</p>
                    <p className="text-[10px] text-zinc-500 font-black mt-2 uppercase">{s.userEmail}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                    <select
                      value={s.status}
                      onChange={(e) => handleUpdateSuggestionStatus(s.id, e.target.value as any)}
                      className="bg-black border border-zinc-800 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-amber-500 outline-none focus:border-amber-500 transition-all"
                    >
                      <option value="pendente">PENDENTE</option>
                      <option value="analise">EM ANÁLISE</option>
                      <option value="desenvolvimento">TRABALHANDO</option>
                      <option value="concluido">CONCLUÍDO</option>
                    </select>
                    <button
                      onClick={() => handleDeleteSuggestion(s.id)}
                      className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              {suggestions.length === 0 && (
                <div className="py-20 text-center space-y-4">
                  <MessageSquare className="w-12 h-12 text-zinc-800 mx-auto" />
                  <p className="text-zinc-500 font-bold">Nenhuma sugestão recebida.</p>
                </div>
              )}
            </div>
          </div>
        ) : tab === 'TIMER' ? (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
              <h3 className="text-2xl font-black uppercase tracking-tight gold-gradient">Configuração do Cronômetro</h3>
              <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Configure o contador regressivo global.</p>
            </div>

            <div className="p-8 rounded-[40px] glass border border-zinc-800 space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Clock className="w-40 h-40" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Zap className="w-3 h-3 text-amber-500" /> Status do Timer
                  </label>
                  <div 
                    onClick={() => handleUpdateTimer({ ...timerConfig, enabled: !timerConfig.enabled })}
                    className={`w-full p-6 rounded-3xl border cursor-pointer transition-all flex items-center justify-between ${timerConfig.enabled ? 'bg-amber-500/10 border-amber-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
                  >
                    <div className="space-y-1">
                      <p className={`text-sm font-black uppercase ${timerConfig.enabled ? 'text-amber-500' : 'text-zinc-500'}`}>
                        {timerConfig.enabled ? 'Timer Ativado' : 'Timer Desativado'}
                      </p>
                      <p className="text-[10px] font-bold text-zinc-600 uppercase">Visível para todos os usuários</p>
                    </div>
                    <div className={`w-12 h-6 rounded-full relative transition-all ${timerConfig.enabled ? 'bg-amber-500' : 'bg-zinc-800'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${timerConfig.enabled ? 'right-1' : 'left-1'}`} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Clock className="w-3 h-3 text-amber-500" /> Horário Diário (24h)
                  </label>
                  <input
                    type="time"
                    value={timerConfig.targetTime || '20:15'}
                    onChange={(e) => {
                      handleUpdateTimer({ ...timerConfig, targetTime: e.target.value, endTime: null });
                    }}
                    className="w-full bg-black border border-zinc-800 rounded-3xl py-6 px-8 text-xl font-black text-amber-500 focus:border-amber-500 outline-none transition-all shadow-inner text-center"
                  />
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest px-1 text-center">O cronômetro reiniciará automaticamente todos os dias neste horário.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-zinc-500" /> Ou Data Específica (Legacy)
                  </label>
                  <input
                    type="datetime-local"
                    value={timerConfig.endTime ? new Date(timerConfig.endTime).toISOString().slice(0, 16) : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value).getTime() : null;
                      handleUpdateTimer({ ...timerConfig, endTime: date, targetTime: '' });
                    }}
                    className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-3xl py-4 px-6 text-xs text-zinc-500 font-bold focus:border-amber-500/50 outline-none transition-all"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-amber-500" /> Mensagem Exibida
                  </label>
                  <input
                    type="text"
                    value={timerConfig.message}
                    onChange={(e) => handleUpdateTimer({ ...timerConfig, message: e.target.value })}
                    placeholder="Ex: Novos desafios liberados em:"
                    className="w-full bg-black border border-zinc-800 rounded-3xl py-6 px-8 text-sm font-bold focus:border-amber-500 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-900/50 flex items-center gap-4 relative z-10">
                <div className={`p-4 rounded-2xl ${timerConfig.enabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'} border border-current/20 flex items-center gap-3 flex-1`}>
                  {timerConfig.enabled ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <div>
                        <p className="text-[10px] font-black uppercase">Sistema Ativo</p>
                        <p className="text-[9px] font-bold opacity-70">O timer está configurado para resetar às {timerConfig.targetTime || '20:15'}.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5" />
                      <div>
                        <p className="text-[10px] font-black uppercase">Sistema Inativo</p>
                        <p className="text-[9px] font-bold opacity-70">O timer está oculto no cabeçalho.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : tab === 'RELATORIOS' ? (
          <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50">
              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase gold-gradient">Relatórios e Extração</h3>
                <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">
                  Veja e exporte em planilha todos os links postados na competição.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <select
                  value={selectedCompId || ''}
                  onChange={(e) => setSelectedCompId(e.target.value)}
                  className="bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-xs font-black text-amber-500 outline-none focus:border-amber-500 transition-all uppercase w-full sm:w-auto"
                >
                  <option value="">SELECIONE A COMPETIÇÃO...</option>
                  {competitions.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <button
                  onClick={handleExportExcel}
                  disabled={!selectedCompId}
                  className="px-8 py-4 bg-emerald-500/10 text-emerald-500 font-black rounded-2xl hover:bg-emerald-500 hover:text-black transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:hover:bg-emerald-500/10 disabled:hover:text-emerald-500 w-full sm:w-auto shadow-xl shadow-emerald-500/5"
                >
                  <Download className="w-5 h-5" /> BAIXAR PLANILHA
                </button>
              </div>
            </div>

            {selectedCompId && (
              <div className="bg-black border border-zinc-800 rounded-[32px] overflow-hidden p-6 md:p-8">
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                      <ListHeader columns={['PLATAFORMA', 'LINK DO VÍDEO', 'USUÁRIO CRIADOR', 'CURTIDAS', 'VIEWS', 'STATUS DO LINK']} gridClass="grid-cols-[100px_minmax(0,1.5fr)_minmax(0,1fr)_100px_100px_120px]" />
                      <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                        {posts.filter(p => p.competitionId === selectedCompId).length === 0 ? (
                          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
                            <Archive className="w-10 h-10 text-zinc-800 mx-auto mb-4" />
                            <p className="font-black text-zinc-500 text-xs tracking-widest uppercase">Nenhum link encontrado para esta competição.</p>
                          </div>
                        ) : (
                          posts.filter(p => p.competitionId === selectedCompId).sort((a, b) => b.timestamp - a.timestamp).map(post => (
                            <div key={post.id} className="grid grid-cols-[100px_minmax(0,1.5fr)_minmax(0,1fr)_100px_100px_120px] gap-4 p-5 rounded-2xl bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors items-center text-xs border border-zinc-800/30">
                              <div className="flex justify-center">
                                {post.platform === 'tiktok' ? <Zap className="w-6 h-6 text-amber-500" /> :
                                 post.platform === 'youtube' ? <TrendingUp className="w-6 h-6 text-red-500" /> :
                                 <Camera className="w-6 h-6 text-pink-500" />}
                              </div>
                              <div className="font-bold text-zinc-300 truncate px-2">
                                <a href={post.url} target="_blank" rel="noreferrer" className="hover:text-amber-500 hover:underline">{post.url}</a>
                              </div>
                              <div className="font-black text-zinc-400 capitalize truncate px-2">{post.userName}</div>
                              <div className="font-black text-emerald-400 text-center bg-emerald-500/10 py-1.5 rounded-lg">{post.likes?.toLocaleString() || 0}</div>
                              <div className="font-black text-amber-500 text-center bg-amber-500/10 py-1.5 rounded-lg">{post.views?.toLocaleString() || 0}</div>
                              <div className="flex justify-center">
                                <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${post.status === 'approved' || post.status === 'synced' ? 'bg-emerald-500/20 text-emerald-500' : post.status === 'rejected' || post.status === 'banned' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                  {post.status === 'approved' || post.status === 'synced' ? 'APROVADO' : post.status === 'rejected' || post.status === 'banned' ? 'RECUSADO' : 'EM TRIAGEM'}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : tab === 'REMOVAL_REQUESTS' ? (
          <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
             <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h3 className="text-2xl font-black uppercase text-amber-500">Solicitações de Remoção</h3>
                <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">
                  Análise de pedidos de remoção de vídeos por motivos excepcionais.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {posts.filter(p => p.status === 'removal_requested').length > 0 ? (
                posts.filter(p => p.status === 'removal_requested').map(post => (
                  <div key={post.id} className="glass p-8 rounded-[40px] border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 group hover:border-amber-500/30 transition-all">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
                          {post.platform === 'tiktok' ? <Zap className="w-6 h-6 text-amber-500" /> : 
                           post.platform === 'youtube' ? <TrendingUp className="w-6 h-6 text-red-500" /> : 
                           <Camera className="w-6 h-6 text-pink-500" />}
                        </div>
                        <div>
                          <h4 className="font-black text-white uppercase tracking-tight">{post.userName}</h4>
                          <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest truncate max-w-[200px]">{post.url}</p>
                        </div>
                      </div>
                      <div className="p-6 bg-amber-500/5 rounded-[2.5rem] border border-amber-500/10">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Motivo Alegado:</p>
                        <p className="text-sm text-zinc-300 font-medium leading-relaxed italic">"{post.removalRequestReason}"</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <button
                        onClick={() => handleRejectRemoval(post.id)}
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-all"
                      >
                        RECUSAR
                      </button>
                      <button
                        onClick={() => handleApproveRemoval(post.id)}
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white hover:text-red-600 transition-all shadow-lg"
                      >
                        APROVAR REMOÇÃO
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-20 text-center glass rounded-[40px] border border-zinc-900 border-dashed">
                  <p className="text-zinc-600 font-black text-xs uppercase tracking-[0.2em]">Nenhuma solicitação pendente</p>
                </div>
              )}
            </div>
          </div>
        ) : tab === 'REMOVED_POSTS' ? (
          <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <div className="bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase text-red-500">Recuperação de Links</h3>
                <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">
                  Restaurar vídeos excluídos, rejeitados ou banidos acidentalmente.
                </p>
              </div>
              <div className="px-6 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-black uppercase tracking-widest">
                {posts.filter(p => p.status === 'rejected' || p.status === 'banned' || p.status === 'deleted').length} itens removidos
              </div>
            </div>

            <div className="bg-black border border-zinc-800 rounded-[32px] overflow-hidden p-6 md:p-8">
              <div className="min-w-[800px]">
                <ListHeader columns={['PLATAFORMA', 'LINK / MOTIVO', 'USUÁRIO', 'CURTIDAS', 'VIEWS', 'AÇÕES']} gridClass="grid-cols-[100px_minmax(0,1.5fr)_minmax(0,1fr)_100px_100px_150px]" />
                <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                  {posts.filter(p => p.status === 'rejected' || p.status === 'banned' || p.status === 'deleted').length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl">
                      <ShieldCheck className="w-10 h-10 text-zinc-800 mx-auto mb-4" />
                      <p className="font-black text-zinc-500 text-xs tracking-widest uppercase">Nenhum post removido pendente.</p>
                    </div>
                  ) : (
                    posts.filter(p => p.status === 'rejected' || p.status === 'banned' || p.status === 'deleted').sort((a,b) => b.timestamp - a.timestamp).map(post => (
                      <div key={post.id} className="grid grid-cols-[100px_minmax(0,1.5fr)_minmax(0,1fr)_100px_100px_150px] gap-4 p-5 rounded-3xl bg-zinc-950 border border-zinc-900 hover:border-zinc-700 transition-all items-center text-xs">
                        <div className="flex justify-center">
                          <div className={`p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 ${
                            post.platform === 'tiktok' ? 'text-amber-500' :
                            post.platform === 'youtube' ? 'text-red-500' :
                            'text-pink-500'
                          }`}>
                            {post.platform === 'tiktok' ? <Zap className="w-5 h-5" /> :
                             post.platform === 'youtube' ? <TrendingUp className="w-5 h-5" /> :
                             <Camera className="w-5 h-5" />}
                          </div>
                        </div>
                        <div className="px-2 space-y-1">
                          <a href={post.url} target="_blank" rel="noreferrer" className="font-bold text-zinc-400 hover:text-white truncate block">{post.url}</a>
                          {post.rejectionReason ? (
                            <p className="text-[9px] text-red-400/70 font-bold uppercase truncate">Motivo: {post.rejectionReason}</p>
                          ) : (
                            <p className={`text-[9px] font-bold uppercase ${post.status === 'deleted' ? 'text-zinc-500' : 'text-amber-500/50'}`}>
                              STATUS: {post.status === 'deleted' ? 'EXCLUÍDO MANUALMENTE' : 'REJEITADO'}
                            </p>
                          )}
                        </div>
                        <div className="font-black text-zinc-300 capitalize truncate px-2">{post.userName}</div>
                        <div className="font-black text-emerald-400 text-center bg-emerald-500/10 py-1.5 rounded-lg">{(post.likes || 0).toLocaleString()}</div>
                        <div className="font-black text-amber-500 text-center bg-amber-500/10 py-1.5 rounded-lg">{(post.views || 0).toLocaleString()}</div>
                        <div className="flex justify-center">
                          <button
                            onClick={() => handlePostStatus(post.id, 'pending')}
                            className="w-full py-2.5 bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> RESTAURAR
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const SettingsView = ({
  user,
  profileName,
  setProfileName,
  profileTiktok,
  setProfileTiktok,
  profileInstagram,
  setProfileInstagram,
  profileYoutube,
  setProfileYoutube,
  profilePhoto,
  handleProfilePhotoUpload,
  handleUpdateProfile,
  isUpdatingProfile,
  settingsTab,
  setSettingsTab
}: {
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
      const list = [...profileTiktok];
      list[index] = newVal;
      setProfileTiktok(list);
    }
    if (platform === 'instagram') {
      const list = [...profileInstagram];
      list[index] = newVal;
      setProfileInstagram(list);
    }
    if (platform === 'youtube') {
      const list = [...profileYoutube];
      list[index] = newVal;
      setProfileYoutube(list);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight gold-gradient uppercase">Configurações</h2>
          <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Gerencie seu perfil e redes sociais</p>
        </div>
        <button
          onClick={handleUpdateProfile}
          disabled={isUpdatingProfile}
          className="px-10 py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-amber-500/10"
        >
          {isUpdatingProfile ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          SALVAR ALTERAÇÕES
        </button>
      </div>

      <div className="flex p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl w-full">
        <button
          onClick={() => setSettingsTab('PROFILE')}
          className={`flex-1 py-3.5 rounded-xl font-black text-xs tracking-widest transition-all ${settingsTab === 'PROFILE' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          MEU PERFIL
        </button>
        <button
          onClick={() => setSettingsTab('SOCIAL')}
          className={`flex-1 py-3.5 rounded-xl font-black text-xs tracking-widest transition-all ${settingsTab === 'SOCIAL' ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
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
                  <img
                    src={profilePhoto || user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                    alt=""
                  />
                  <label
                    htmlFor="profile-photo-upload"
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Camera className="w-8 h-8 text-amber-500" />
                    <input
                      type="file"
                      id="profile-photo-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={handleProfilePhotoUpload}
                    />
                  </label>
                </div>
              </div>
              <div className="flex-1 space-y-4 w-full">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <UserIcon className="w-3 h-3" /> Seu Nome de Exibição
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl py-5 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all shadow-inner"
                    placeholder="Seu nome no Hub"
                  />
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
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Share2 className="w-40 h-40" />
            </div>
            
            <div className="space-y-4 relative z-10">
              <div className="flex items-center gap-3 text-amber-500">
                <Zap className="w-5 h-5 shadow-amber-500/20" />
                <h3 className="text-xl font-black uppercase tracking-tight">Vincular Várias Contas</h3>
              </div>
              <p className="text-xs text-zinc-500 font-bold leading-relaxed">Você pode cadastrar múltiplos perfis (@) para cada rede social. Isso permite que você envie vídeos de diferentes contas suas.</p>
            </div>

            <div className="space-y-12 relative z-10">
              {/* TikTok Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500" /> Contas TikTok
                  </label>
                  <button 
                    onClick={() => addSocial('tiktok')}
                    className="text-[10px] font-black text-amber-500 hover:text-amber-400 uppercase tracking-widest flex items-center gap-1 transition-colors"
                  >
                    + Adicionar Perfil
                  </button>
                </div>
                <div className="space-y-3">
                  {profileTiktok.map((val, idx) => (
                    <div key={idx} className="relative group animate-in slide-in-from-left-2 duration-300">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-sm">@</span>
                      <input
                        type="text"
                        value={val.replace('@', '')}
                        onChange={(e) => updateSocial('tiktok', idx, e.target.value)}
                        placeholder="seu_usuario"
                        className="w-full bg-black border border-zinc-800 rounded-2xl py-5 pl-12 pr-14 text-sm font-black focus:border-amber-500 outline-none transition-all"
                      />
                      <button 
                        onClick={() => removeSocial('tiktok', idx)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-zinc-700 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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

              {/* Instagram Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5 text-pink-500" /> Contas Instagram
                  </label>
                  <button 
                    onClick={() => addSocial('instagram')}
                    className="text-[10px] font-black text-pink-500 hover:text-pink-400 uppercase tracking-widest flex items-center gap-1 transition-colors"
                  >
                    + Adicionar Perfil
                  </button>
                </div>
                <div className="space-y-3">
                  {profileInstagram.map((val, idx) => (
                    <div key={idx} className="relative group animate-in slide-in-from-left-2 duration-300">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-sm">@</span>
                      <input
                        type="text"
                        value={val.replace('@', '')}
                        onChange={(e) => updateSocial('instagram', idx, e.target.value)}
                        placeholder="seu_perfil"
                        className="w-full bg-black border border-zinc-800 rounded-2xl py-5 pl-12 pr-14 text-sm font-black focus:border-pink-500 outline-none transition-all"
                      />
                      <button 
                        onClick={() => removeSocial('instagram', idx)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-zinc-700 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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

              {/* YouTube Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-red-500" /> Canais YouTube
                  </label>
                  <button 
                    onClick={() => addSocial('youtube')}
                    className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1 transition-colors"
                  >
                    + Adicionar Canal
                  </button>
                </div>
                <div className="space-y-3">
                  {profileYoutube.map((val, idx) => (
                    <div key={idx} className="relative group animate-in slide-in-from-left-2 duration-300">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-sm">@</span>
                      <input
                        type="text"
                        value={val.replace('@', '')}
                        onChange={(e) => updateSocial('youtube', idx, e.target.value)}
                        placeholder="seu_canal"
                        className="w-full bg-black border border-zinc-800 rounded-2xl py-5 pl-12 pr-14 text-sm font-black focus:border-red-500 outline-none transition-all"
                      />
                      <button 
                        onClick={() => removeSocial('youtube', idx)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-zinc-700 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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

const SuggestionsView = ({
  suggestionMsg,
  setSuggestionMsg,
  handleSendSuggestion,
  suggestions
}: {
  suggestionMsg: string;
  setSuggestionMsg: (v: string) => void;
  handleSendSuggestion: () => void;
  suggestions: Suggestion[];
}) => (
  <div className="max-w-4xl mx-auto space-y-12 p-4 pb-20">
    <div className="space-y-4 text-center">
      <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase gold-gradient">Mural de Sugestões</h2>
      <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest max-w-lg mx-auto">Colabore com a evolução do MetaRayx. Vote, sugira e acompanhe o que estamos construindo.</p>
    </div>

    <div className="p-8 rounded-[40px] glass border border-zinc-800 space-y-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <MessageSquare className="w-32 h-32" />
      </div>
      <div className="space-y-4 relative z-10">
        <div className="flex items-center gap-3 text-amber-500">
          <Zap className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">O que podemos melhorar?</span>
        </div>
        <textarea
          value={suggestionMsg}
          onChange={(e) => setSuggestionMsg(e.target.value)}
          placeholder="Descreva sua ideia ou funcionalidade..."
          className="w-full bg-black border border-zinc-800 rounded-3xl py-6 px-8 text-sm font-bold focus:border-amber-500 outline-none transition-all h-32 resize-none shadow-inner"
        />
      </div>

      <button
        onClick={handleSendSuggestion}
        disabled={!suggestionMsg.trim()}
        className="w-full py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.01] transition-all shadow-xl shadow-amber-500/10 disabled:opacity-50 flex items-center justify-center gap-3 relative z-10"
      >
        <Send className="w-5 h-5" />
        ENVIAR MINHA SUGESTÃO
      </button>
    </div>

    <div className="space-y-6">
      <div className="flex items-center gap-3 px-2">
        <div className="w-1.5 h-6 gold-bg rounded-full" />
        <h3 className="font-black uppercase tracking-widest text-sm text-zinc-400">Ideias da Comunidade</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suggestions.map(s => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 rounded-[32px] bg-zinc-900/50 border border-zinc-800/50 flex flex-col justify-between gap-4 group hover:border-zinc-700 transition-all"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${s.status === 'pendente' ? 'bg-zinc-800 text-zinc-500' :
                    s.status === 'analise' ? 'bg-cyan-500/10 text-cyan-500' :
                      s.status === 'desenvolvimento' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-emerald-500/10 text-emerald-500'
                  }`}>
                  {s.status === 'pendente' ? 'EM ESPERA' :
                    s.status === 'analise' ? 'EM ANÁLISE' :
                      s.status === 'desenvolvimento' ? 'DESENVOLVENDO' : 'CONCLUÍDO'}
                </span>
                <span className="text-[9px] text-zinc-700 font-bold uppercase">{new Date(s.timestamp).toLocaleDateString()}</span>
              </div>
              <p className="text-zinc-300 text-sm font-bold leading-relaxed">{s.message}</p>
            </div>

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

const ConfirmModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onClose
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md glass p-8 rounded-[40px] border border-zinc-800 space-y-6 text-center"
        >
          <div className="w-20 h-20 bg-amber-500/20 rounded-3xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-10 h-10 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight">{title}</h3>
            <p className="text-zinc-500 font-bold text-sm">
              {message}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl hover:bg-amber-600 transition-all"
            >
              CONFIRMAR
            </button>
            <button
              onClick={onClose}
              className="w-full py-4 bg-zinc-900 text-zinc-400 font-black rounded-2xl hover:text-zinc-100 transition-all"
            >
              CANCELAR
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const AnnouncementBanner = ({
  announcement,
  onAcknowledge
}: {
  announcement: Announcement | undefined;
  onAcknowledge: (id: string) => void;
}) => (
  <AnimatePresence>
    {announcement && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-amber-500/10 border-b border-amber-500/20 overflow-hidden shrink-0"
      >
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-500">
              <Bell className="w-4 h-4 animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">Aviso</span>
              <p className="text-xs font-bold text-zinc-100 truncate max-w-md lg:max-w-xl">
                <span className="text-amber-500/80 mr-2">{announcement.title}:</span>
                {announcement.message}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => onAcknowledge(announcement.id)}
            className="px-4 py-1.5 gold-bg text-black text-[10px] font-black rounded-lg hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-amber-500/10 flex items-center gap-2 shrink-0"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            CIENTE
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const TimerBanner = ({ config }: { config: { enabled: boolean; endTime: number | null; message: string; targetTime?: string } }) => {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    if (!config.enabled) {
      setTimeLeft(null);
      return;
    }

    const update = () => {
      const now = new Date();
      let target: Date;

      if (config.targetTime) {
        // Lógica de Timer Diário Recorrente
        const [hours, minutes] = config.targetTime.split(':').map(Number);
        target = new Date();
        target.setHours(hours || 0, minutes || 0, 0, 0);

        if (now > target) {
          target.setDate(target.getDate() + 1);
        }
      } else if (config.endTime) {
        // Lógica de Timer Estático (legado)
        target = new Date(config.endTime);
      } else {
        setTimeLeft(null);
        return;
      }

      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ d, h, m, s });
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [config]);

  if (!timeLeft) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-black border-b border-amber-500/20 relative overflow-hidden shrink-0 group"
      >
        <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors pointer-events-none" />
        <div className="max-w-[1400px] mx-auto px-6 py-2 flex items-center justify-center gap-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            <p className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest">{config.message || 'Contagem Regressiva:'}</p>
          </div>

          <div className="flex items-center gap-4">
            {[
              { label: 'd', value: timeLeft.d },
              { label: 'h', value: timeLeft.h },
              { label: 'm', value: timeLeft.m },
              { label: 's', value: timeLeft.s },
            ].map((unit, i) => (
              <div key={i} className="flex items-baseline gap-1">
                <span className="text-xl font-black text-white tracking-tighter tabular-nums drop-shadow-lg">
                  {unit.value.toString().padStart(2, '0')}
                </span>
                <span className="text-[8px] font-black text-amber-500 uppercase">{unit.label}</span>
              </div>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            <Zap className="w-3 h-3 text-amber-500" />
            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Tempo Real</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default App;
