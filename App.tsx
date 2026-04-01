import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, 
  onSnapshot, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit,
  OperationType, handleFirestoreError, createUserWithEmailAndPassword, signInWithEmailAndPassword, addDoc, serverTimestamp
} from './firebase';
import { User, Post, Season, Announcement, Platform, PostStatus, Competition, CompetitionRegistration, UserRole, Transaction, Suggestion } from './types';
import { 
  LayoutDashboard, Trophy, Send, History, Settings, LogOut, 
  ShieldCheck, AlertCircle, CheckCircle2, XCircle, Clock, 
  TrendingUp, Users, Zap, Calendar, MessageSquare, Menu, X,
  Mail, Lock, User as UserIcon, Eye, EyeOff, Loader2, RefreshCw, Crown, Trash2,
  Heart, Share2, Bookmark, Bell, Check, Camera, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { syncViewsWithApify, syncSinglePostWithApify } from './services/apifyService';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth as getSecondaryAuth, createUserWithEmailAndPassword as createSecondaryUser, signOut as signSecondaryOut } from 'firebase/auth';
import fbConfig from './firebase-applet-config.json';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
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
            Ocorreu um erro inesperado na interface. Tente atualizar a página.
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

const WalletView = ({ user }: { user: User }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'day' | 'week' | 'month'>('week');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const q = query(collection(db, 'transactions'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        setTransactions(data);
      } catch (e) {
        console.error("Erro fetch extrato", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [user.uid]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return transactions.filter(t => {
      if (filter === 'all') return true;
      if (filter === 'day') return now - t.timestamp <= dayMs;
      if (filter === 'week') return now - t.timestamp <= 7 * dayMs;
      if (filter === 'month') return now - t.timestamp <= 30 * dayMs;
      return true;
    });
  }, [transactions, filter]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-4 md:p-6 lg:p-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
         <div className="space-y-2">
           <h2 className="text-3xl font-black tracking-tight uppercase gold-gradient">Portal Financeiro</h2>
           <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Acompanhe seus rendimentos e recebimentos</p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10">
             <Zap className="w-24 h-24" />
           </div>
           <div className="relative z-10 flex flex-col items-start gap-2">
             <span className="text-zinc-500 font-black text-[10px] tracking-widest uppercase">Pagamentos Recebidos (Lifetime)</span>
             <span className="text-4xl md:text-5xl font-black text-white tracking-tighter">
               R$ {(user.lifetimeEarnings || 0).toLocaleString()}
             </span>
           </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10">
             <Clock className="w-24 h-24 text-amber-500" />
           </div>
           <div className="relative z-10 flex flex-col items-start gap-2">
             <span className="text-amber-500 font-black text-[10px] tracking-widest uppercase">Saldo a Receber (Pendente)</span>
             <span className="text-4xl md:text-5xl font-black text-amber-500 tracking-tighter">
               R$ {(user.balance || 0).toLocaleString()}
             </span>
           </div>
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
               <div key={t.id} className="flex justify-between items-center p-4 bg-black border border-zinc-800 rounded-2xl relative overflow-hidden hover:border-zinc-700 transition-colors">
                 <div className="flex flex-col gap-1 z-10">
                   <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">PAGAMENTO RECEBIDO</span>
                   <span className="font-bold text-zinc-300 text-xs">Aprovado pelo Auditor: {t.auditorId || 'Sistema'}</span>
                 </div>
                 <div className="flex flex-col items-end z-10">
                   <span className="text-xl font-black text-white">+R$ {t.amount.toLocaleString()}</span>
                   <span className="text-[10px] font-bold text-zinc-500 tracking-widest">
                     {new Date(t.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                   </span>
                 </div>
                 <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-emerald-500/5 to-transparent z-0 pointer-events-none" />
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

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'DASHBOARD' | 'RANKINGS' | 'POST' | 'HISTORY' | 'ADMIN' | 'SETTINGS' | 'WALLET' | 'SUGGESTIONS'>('RANKINGS');
  const [posts, setPosts] = useState<Post[]>([]);
  const [rankings, setRankings] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [registrations, setRegistrations] = useState<CompetitionRegistration[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<User[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [globalSyncing, setGlobalSyncing] = useState(false);
  const [settings, setSettings] = useState<{ apifyKey: string }>({ apifyKey: '' });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [compToDelete, setCompToDelete] = useState<string | null>(null);
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [compTitle, setCompTitle] = useState('');
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
  const [editRole, setEditRole] = useState<'user'|'auditor'|'administrativo'|'admin'>('user');
  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [isCreatingAnn, setIsCreatingAnn] = useState(false);
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
    onConfirm: () => {},
  });

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
    }
  }, [view, user]);

  // Auth Listener
  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
      console.log('Auth state changed. User:', firebaseUser?.email);
      // Clean up previous user listener
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      if (firebaseUser) {
        console.log('User detected:', firebaseUser.uid);
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Fetch settings once
        const settingsRef = doc(db, 'config', 'settings');
        getDoc(settingsRef).then(settingsDoc => {
          if (settingsDoc.exists()) {
            setSettings(settingsDoc.data() as { apifyKey: string });
          }
        }).catch(err => handleFirestoreError(err, OperationType.GET, settingsRef.path));

        // Set up real-time listener for user document
        unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
          console.log('User snapshot received. Exists:', docSnap.exists());
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            console.log('User data isApproved:', userData.isApproved);
            setUser({
              ...userData,
              totalViews: userData.totalViews || 0,
              totalLikes: userData.totalLikes || 0,
              totalComments: userData.totalComments || 0,
              totalShares: userData.totalShares || 0,
              totalPosts: userData.totalPosts || 0,
              dailyViews: userData.dailyViews || 0,
              dailyLikes: userData.dailyLikes || 0,
              dailyComments: userData.dailyComments || 0,
              dailyShares: userData.dailyShares || 0,
              dailyPosts: userData.dailyPosts || 0,
              balance: userData.balance || 0
            });
          } else {
            // Create user doc if it doesn't exist (e.g. Google Login first time)
            const isAdminEmail = firebaseUser.email === 'matheusmenechini18@gmail.com' || firebaseUser.email === 'hypedosmemes@gmail.com';
            const newUser: User = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Anon',
              email: firebaseUser.email || '',
              role: isAdminEmail ? 'admin' : 'user',
              isApproved: isAdminEmail, // Admin auto-approved
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
            try {
              await setDoc(userRef, newUser);
              // The onSnapshot will trigger again after setDoc
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, userRef.path);
            }
          }
          setLoading(false);
        }, (error) => {
          console.error('User listener error:', error);
          setLoading(false);
        });
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

  // Real-time Data Listeners
  useEffect(() => {
    if (!user) return;
    const isStaff = user.role === 'admin' || user.role === 'auditor' || user.role === 'administrativo';
    if (!user.isApproved && !isStaff) return;

    // Posts Listener (My Posts or All for Admin)
    const postsQuery = user.role === 'admin' 
      ? query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(100))
      : query(collection(db, 'posts'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'), limit(50));

    const unsubPosts = onSnapshot(postsQuery, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'posts'));

    // Rankings Listener
    const rankingsQuery = query(collection(db, 'users'), where('isApproved', '==', true), orderBy('totalViews', 'desc'), limit(20));
    const unsubRankings = onSnapshot(rankingsQuery, (snapshot) => {
      setRankings(snapshot.docs.map(doc => doc.data() as User));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Announcements Listener
    const annQuery = query(collection(db, 'announcements'), orderBy('timestamp', 'desc'));
    const unsubAnn = onSnapshot(annQuery, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'announcements'));

    // Competitions Listener
    const compQuery = query(collection(db, 'competitions'), orderBy('timestamp', 'desc'), limit(10));
    const unsubComp = onSnapshot(compQuery, (snapshot) => {
      setCompetitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'competitions'));

    // Registrations Listener
    const regQuery = user.role === 'admin'
      ? query(collection(db, 'competition_registrations'), orderBy('timestamp', 'desc'))
      : query(collection(db, 'competition_registrations'), where('userId', '==', user.uid));
    
    const unsubReg = onSnapshot(regQuery, (snapshot) => {
      setRegistrations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionRegistration)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'competition_registrations'));

    // Admin/Staff: Users & Suggestions Listeners
    let unsubPendingUsers = () => {};
    let unsubApprovedUsers = () => {};
    let unsubSuggestions = () => {};

    if (isStaff) {
      const pendingUsersQuery = query(collection(db, 'users'), where('isApproved', '==', false));
      unsubPendingUsers = onSnapshot(pendingUsersQuery, (snapshot) => {
        const users = snapshot.docs.map(doc => doc.data() as User);
        setPendingUsers(users.filter(u => !(u as any).isRejected));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

      const approvedUsersQuery = query(collection(db, 'users'), where('isApproved', '==', true));
      unsubApprovedUsers = onSnapshot(approvedUsersQuery, (snapshot) => {
        setApprovedUsers(snapshot.docs.map(doc => doc.data() as User));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

      const suggestionsQuery = query(collection(db, 'suggestions'), orderBy('timestamp', 'desc'));
      unsubSuggestions = onSnapshot(suggestionsQuery, (snapshot) => {
        setSuggestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Suggestion)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'suggestions'));
    }

    return () => { 
      unsubPosts(); 
      unsubRankings(); 
      unsubAnn(); 
      unsubComp();
      unsubReg();
      unsubPendingUsers();
      unsubApprovedUsers();
      unsubSuggestions();
    };
  }, [user]);

  const handleGlobalSync = async () => {
    if (user?.role !== 'admin') {
      alert('Apenas administradores podem iniciar a sincronização global.');
      return;
    }
    
    setGlobalSyncing(true);
    try {
      const apifyKey = settings.apifyKey;
      if (!apifyKey) {
        alert('Por favor, configure sua chave Apify na Diretoria primeiro.');
        return;
      }
      await syncViewsWithApify(apifyKey);
      alert('Sincronização global concluída!');
    } catch (error: any) {
      alert(`Erro na sincronização: ${error.message}`);
    } finally {
      setGlobalSyncing(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) return;
      
      const postData = postSnap.data() as Post;
      const authorId = postData.userId;

      await deleteDoc(postRef);
      
      // Recalculate totals for the AUTHOR
      const userPostsQuery = query(collection(db, 'posts'), where('userId', '==', authorId), where('status', '==', 'approved'));
      const userPostsSnapshot = await getDocs(userPostsQuery);
      
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      
      const totals = userPostsSnapshot.docs.reduce((acc, doc) => {
        const data = doc.data() as Post;
        const isDaily = (data.timestamp || 0) > oneDayAgo;
        
        return {
          views: acc.views + (data.views || 0),
          likes: acc.likes + (data.likes || 0),
          comments: acc.comments + (data.comments || 0),
          shares: acc.shares + (data.shares || 0),
          saves: acc.saves + (data.saves || 0),
          posts: acc.posts + 1,
          dailyViews: acc.dailyViews + (isDaily ? (data.views || 0) : 0),
          dailyLikes: acc.dailyLikes + (isDaily ? (data.likes || 0) : 0),
          dailyComments: acc.dailyComments + (isDaily ? (data.comments || 0) : 0),
          dailyShares: acc.dailyShares + (isDaily ? (data.shares || 0) : 0),
          dailySaves: acc.dailySaves + (isDaily ? (data.saves || 0) : 0),
          dailyPosts: acc.dailyPosts + (isDaily ? 1 : 0)
        };
      }, { 
        views: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: 0,
        dailyViews: 0, dailyLikes: 0, dailyComments: 0, dailyShares: 0, dailySaves: 0, dailyPosts: 0
      });
      
      await updateDoc(doc(db, 'users', authorId), {
        totalViews: totals.views,
        totalLikes: totals.likes,
        totalComments: totals.comments,
        totalShares: totals.shares,
        totalSaves: totals.saves,
        totalPosts: totals.posts,
        dailyViews: totals.dailyViews,
        dailyLikes: totals.dailyLikes,
        dailyComments: totals.dailyComments,
        dailyShares: totals.dailyShares,
        dailySaves: totals.dailySaves,
        dailyPosts: totals.dailyPosts
      });

      setNotification({ message: 'Vídeo removido com sucesso!', type: 'success' });
      setPostToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir post:', error);
      setNotification({ message: 'Erro ao excluir o vídeo.', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full"
        />
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
      if (file.size > 1024 * 1024) {
        alert('A imagem deve ter menos de 1MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
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
    if (status === 'rejected') {
      setConfirmModal({
        isOpen: true,
        title: 'Recusar Vídeo',
        message: 'Tem certeza que deseja recusar este vídeo? Esta ação removerá o vídeo da triagem.',
        onConfirm: async () => {
          try {
            await updateDoc(doc(db, 'posts', postId), { status });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
          }
        }
      });
      return;
    }
    try {
      await updateDoc(doc(db, 'posts', postId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  const handleUserApproval = async (userId: string, isApproved: boolean) => {
    if (!isApproved) {
      setConfirmModal({
        isOpen: true,
        title: 'Remover Usuário',
        message: 'Tem certeza que deseja remover este usuário? Ele perderá o acesso ao HUB.',
        onConfirm: async () => {
          try {
            await updateDoc(doc(db, 'users', userId), { isApproved });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
          }
        }
      });
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { isApproved });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remover Solicitação',
      message: 'Tem certeza que deseja apagar os dados desta solicitação de acesso pendente? O usuário não poderá mais fazer login.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', userId));
          alert('Solicitação removida com sucesso!');
        } catch (error: any) {
          console.error('Erro ao deletar usuário:', error);
          if (error.code === 'permission-denied') {
            // Fallback: se não tiver permissão de deletar, marca como rejeitado
            try {
              await updateDoc(doc(db, 'users', userId), { isApproved: false, isRejected: true });
              alert('Solicitação marcada como rejeitada. Para deletar definitivamente, publique as Regras atualizadas no Firebase Console.');
            } catch (e2) {
              alert('Erro ao remover solicitação. Verifique as regras do Firebase.');
            }
          } else {
            alert(`Erro ao remover: ${error.message}`);
          }
        }
      }
    });
  };

  const handleResetDailyRanking = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Zerar Ranking Diário e Pagar Vencedores',
      message: 'Isso calculará os 10 vencedores do Dia e o Top 1 Insta, injetará o prêmio direto no Saldo deles, e zerará as estatísticas diárias de todos. Confirmar o pagamento e o repasse?',
      onConfirm: async () => {
        try {
          const activeCompetition = competitions.find(c => c.isActive);
          const dailyViewWinners = [...approvedUsers]
            .filter(u => u.dailyViews > 0)
            .sort((a,b) => b.dailyViews - a.dailyViews)
            .slice(0, activeCompetition?.prizesDaily?.length || 10);
            
          const instaWinner = [...approvedUsers]
            .filter(u => (u.dailyInstaPosts || 0) > 0)
            .sort((a,b) => (b.dailyInstaPosts || 0) - (a.dailyInstaPosts || 0))[0];

          const balanceIncrements: Record<string, number> = {};
          
          dailyViewWinners.forEach((u, i) => {
             const prize = activeCompetition?.prizesDaily?.[i]?.value || 0;
             balanceIncrements[u.uid] = (balanceIncrements[u.uid] || 0) + prize;
          });
          
          if (instaWinner && activeCompetition?.prizesInstagram?.[0]) {
             balanceIncrements[instaWinner.uid] = (balanceIncrements[instaWinner.uid] || 0) + (activeCompetition.prizesInstagram[0].value || 0);
          }

          await Promise.all(
            approvedUsers.map(u => {
              const currentBalance = u.balance || 0;
              const increment = balanceIncrements[u.uid] || 0;
              const dataToUpdate: any = {
                dailyViews: 0,
                dailyLikes: 0,
                dailyComments: 0,
                dailyShares: 0,
                dailySaves: 0,
                dailyPosts: 0,
                dailyInstaPosts: 0,
              };
              if (increment > 0) dataToUpdate.balance = currentBalance + increment;
              return updateDoc(doc(db, 'users', u.uid), dataToUpdate);
            })
          );
          alert('Ranking resetado e pagamentos realizados com sucesso!');
        } catch (error) {
          console.error('Error resetting rankings:', error);
          alert('Erro ao resetar ranking.');
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

  const toggleCompetitionStatus = async (id: string, isActive: boolean) => {
    try {
      await updateDoc(doc(db, 'competitions', id), { isActive });
    } catch (error) {
      console.error('Error updating competition:', error);
    }
  };

  const handleRegistrationStatus = async (regId: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'competition_registrations', regId), { status });
      alert(`Inscrição ${status === 'approved' ? 'aprovada' : 'rejeitada'}!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `competition_registrations/${regId}`);
    }
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
              <NavItem active={view === 'RANKINGS'} onClick={() => setView('RANKINGS')} icon={<Trophy />} label="Rankings" />
              <NavItem active={view === 'POST'} onClick={() => setView('POST')} icon={<Send />} label="Postar Link" />
              <NavItem active={view === 'HISTORY'} onClick={() => setView('HISTORY')} icon={<History />} label="Meus Protocolos" />
              <NavItem active={view === 'WALLET'} onClick={() => setView('WALLET')} icon={<Zap />} label="Minha Carteira" />
              {(user.role === 'admin' || user.role === 'auditor' || user.role === 'administrativo') && (
                <NavItem active={view === 'ADMIN'} onClick={() => setView('ADMIN')} icon={<ShieldCheck />} label={
                  user.role === 'admin' ? "Diretoria" : 
                  user.role === 'administrativo' ? "Administrativo" : "Auditoria"
                } />
              )}
              <NavItem active={view === 'SETTINGS'} onClick={() => setView('SETTINGS')} icon={<Settings />} label="Configurações" />
              
              {user.role === 'admin' && (
                <div className="pt-4 mt-4 border-t border-zinc-800/50">
                  <button 
                    onClick={handleGlobalSync}
                    disabled={globalSyncing}
                    className="w-full flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-xl transition-all font-bold text-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${globalSyncing ? 'animate-spin' : ''}`} />
                    RESSINCRONIZAR LINKS
                  </button>
                </div>
              )}
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
        {/* Header */}
        <header className="h-20 glass border-b border-zinc-800/50 flex items-center justify-between px-6 lg:px-10 shrink-0">
          <button className="lg:hidden" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="hidden sm:flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Saldo Disponível</span>
              <span className="text-lg font-black text-emerald-400">R$ {user.balance.toFixed(2)}</span>
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
                />
              )}
              {view === 'RANKINGS' && <Rankings rankings={rankings} competitions={competitions} />}
              {view === 'POST' && <PostSubmit user={user} />}
              {view === 'HISTORY' && <HistoryView posts={posts} onDelete={setPostToDelete} isAdmin={user.role === 'admin'} />}
              {view === 'WALLET' && <WalletView user={user} />}
              {view === 'ADMIN' && (user.role === 'admin' || user.role === 'auditor' || user.role === 'administrativo') && (
                <AdminPanel 
                  userRole={user.role}
                  posts={posts} 
                  pendingUsers={pendingUsers} 
                  approvedUsers={approvedUsers}
                  settings={settings}
                  competitions={competitions}
                  registrations={registrations}
                  announcements={announcements}
                  onSettingsUpdate={(s) => setSettings(s)}
                  editingCompId={editingCompId}
                  setEditingCompId={setEditingCompId}
                  setCompToDelete={setCompToDelete}
                  setPostToDelete={setPostToDelete}
                  handlePostStatus={handlePostStatus}
                  handleUserApproval={handleUserApproval}
                  handleDeleteUser={handleDeleteUser}
                  handleRegistrationStatus={handleRegistrationStatus}
                  handleResetDailyRanking={handleResetDailyRanking}
                  toggleCompetitionStatus={toggleCompetitionStatus}
                  handleBannerUpload={handleBannerUpload}
                  handleCreateCompetition={handleCreateCompetition}
                  handleEditCompClick={handleEditCompClick}
                  handleEditUser={handleEditUser}
                  handleCreateAnnouncement={handleCreateAnnouncement}
                  handleDeleteAnnouncement={handleDeleteAnnouncement}
                  handleDeleteSuggestion={handleDeleteSuggestion}
                  suggestions={suggestions}
                  compTitle={compTitle} setCompTitle={setCompTitle}
                  compDesc={compDesc} setCompDesc={setCompDesc}
                  compRules={compRules} setCompRules={setCompRules}
                  compHashtags={compHashtags} setCompHashtags={setCompHashtags}
                  compMentions={compMentions} setCompMentions={setCompMentions}
                  compBonuses={compBonuses} setCompBonuses={setCompBonuses}
                  compInstaBonus={compInstaBonus} setCompInstaBonus={setCompInstaBonus}
                  compViewBonus={compViewBonus} setCompViewBonus={setCompViewBonus}
                  compStartDate={compStartDate} setCompStartDate={setCompStartDate}
                  compEndDate={compEndDate} setCompEndDate={setCompEndDate}
                  compBanner={compBanner} setCompBanner={setCompBanner}
                  compPositions={compPositions} setCompPositions={setCompPositions}
                  compPrizes={compPrizes} setCompPrizes={setCompPrizes}
                  compPositionsDaily={compPositionsDaily} setCompPositionsDaily={setCompPositionsDaily}
                  compPrizesDaily={compPrizesDaily} setCompPrizesDaily={setCompPrizesDaily}
                  compPositionsMonthly={compPositionsMonthly} setCompPositionsMonthly={setCompPositionsMonthly}
                  compPrizesMonthly={compPrizesMonthly} setCompPrizesMonthly={setCompPrizesMonthly}
                  compPositionsInstagram={compPositionsInstagram} setCompPositionsInstagram={setCompPositionsInstagram}
                  compPrizesInstagram={compPrizesInstagram} setCompPrizesInstagram={setCompPrizesInstagram}
                  isCreatingComp={isCreatingComp} setIsCreatingComp={setIsCreatingComp}
                  editingUser={editingUser} setEditingUser={setEditingUser}
                  editName={editName} setEditName={setEditName}
                  editPass={editPass} setEditPass={setEditPass}
                  annTitle={annTitle} setAnnTitle={setAnnTitle}
                  annMsg={annMsg} setAnnMsg={setAnnMsg}
                  isCreatingAnn={isCreatingAnn} setIsCreatingAnn={setIsCreatingAnn}
                  editRole={editRole} setEditRole={setEditRole}
                />
              )}
              {view === 'SETTINGS' && user && (
                <SettingsView 
                  user={user} 
                  profileName={profileName}
                  setProfileName={setProfileName}
                  profilePhoto={profilePhoto}
                  handleProfilePhotoUpload={handleProfilePhotoUpload}
                  handleUpdateProfile={handleUpdateProfile}
                  isUpdatingProfile={isUpdatingProfile}
                />
              )}
              {view === 'SUGGESTIONS' && user && (
                <SuggestionsView 
                  suggestionMsg={suggestionMsg}
                  setSuggestionMsg={setSuggestionMsg}
                  handleSendSuggestion={handleSendSuggestion}
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
          className={`fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl font-black text-sm shadow-2xl flex items-center gap-3 ${
            notification.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'
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
                  placeholder="••••••••"
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

const Dashboard = ({ user, announcements, rankings, competitions, registrations }: { 
  user: User, 
  announcements: Announcement[], 
  rankings: User[], 
  competitions: Competition[],
  registrations: CompetitionRegistration[]
}) => {
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [acceptedRules, setAcceptedRules] = useState(false);

  const handleRegister = async (compId: string) => {
    if (!acceptedRules) {
      alert('Você precisa aceitar as regras para participar!');
      return;
    }
    try {
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
      setSelectedComp(null);
      setAcceptedRules(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'competition_registrations');
    }
  };

  const sortedMonthly = useMemo(() => {
    return [...rankings].sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0)).slice(0, 3);
  }, [rankings]);

  return (
    <div className="space-y-10">
    {/* Monthly Podium */}
    {sortedMonthly.length > 0 && (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight uppercase">Elite do Mês</h2>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Os maiores clipadores do HUB</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-black text-zinc-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ATUALIZADO EM TEMPO REAL
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 items-end pt-10 pb-4">
          {/* 2nd Place */}
          {sortedMonthly[1] && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center space-y-4"
            >
              <div className="relative">
                <div className="absolute -top-4 -right-2 w-8 h-8 rounded-full bg-zinc-400 flex items-center justify-center border-2 border-black z-10">
                  <span className="text-[10px] font-black text-black">2º</span>
                </div>
                <img 
                  src={sortedMonthly[1].photoURL || `https://ui-avatars.com/api/?name=${sortedMonthly[1].displayName}`} 
                  className="w-16 h-16 md:w-24 md:h-24 rounded-[32px] border-4 border-zinc-400/30 object-cover shadow-2xl" 
                  alt="" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-center">
                <p className="text-xs md:text-sm font-black truncate max-w-[100px]">@{sortedMonthly[1].displayName}</p>
                <div className="flex flex-col items-center mt-1">
                  <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none">Views</span>
                  <span className="text-sm font-black text-cyan-400">{(sortedMonthly[1].totalViews || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="w-full h-24 md:h-32 bg-gradient-to-t from-zinc-800/50 to-zinc-800/20 rounded-t-3xl border-x border-t border-zinc-800 flex items-center justify-center">
                 <div className="w-8 h-8 rounded-full bg-zinc-400/10 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-zinc-400" />
                 </div>
              </div>
            </motion.div>
          )}

          {/* 1st Place */}
          {sortedMonthly[0] && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center space-y-4"
            >
              <div className="relative">
                <motion.div 
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-8 left-1/2 -translate-x-1/2 z-10"
                >
                  <Crown className="w-10 h-10 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                </motion.div>
                <div className="absolute -top-4 -right-2 w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center border-2 border-black z-10 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                  <span className="text-xs font-black text-black">1º</span>
                </div>
                <img 
                  src={sortedMonthly[0].photoURL || `https://ui-avatars.com/api/?name=${sortedMonthly[0].displayName}`} 
                  className="w-20 h-20 md:w-32 md:h-32 rounded-[40px] border-4 border-amber-500 object-cover shadow-[0_0_40px_rgba(245,158,11,0.2)]" 
                  alt="" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-center">
                <p className="text-sm md:text-lg font-black gold-gradient truncate max-w-[120px]">@{sortedMonthly[0].displayName}</p>
                <div className="flex flex-col items-center mt-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest leading-none">Views</span>
                  <span className="text-lg md:text-xl font-black text-cyan-400">{(sortedMonthly[0].totalViews || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="w-full h-32 md:h-48 bg-gradient-to-t from-amber-500/20 to-amber-500/5 rounded-t-[40px] border-x border-t border-amber-500/30 flex items-center justify-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                 <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center relative z-10">
                    <Trophy className="w-6 h-6 text-amber-500" />
                 </div>
              </div>
            </motion.div>
          )}

          {/* 3rd Place */}
          {sortedMonthly[2] && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center space-y-4"
            >
              <div className="relative">
                <div className="absolute -top-4 -right-2 w-8 h-8 rounded-full bg-amber-800 flex items-center justify-center border-2 border-black z-10">
                  <span className="text-[10px] font-black text-white">3º</span>
                </div>
                <img 
                  src={sortedMonthly[2].photoURL || `https://ui-avatars.com/api/?name=${sortedMonthly[2].displayName}`} 
                  className="w-16 h-16 md:w-24 md:h-24 rounded-[32px] border-4 border-amber-800/30 object-cover shadow-2xl" 
                  alt="" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-center">
                <p className="text-xs md:text-sm font-black truncate max-w-[100px]">@{sortedMonthly[2].displayName}</p>
                <div className="flex flex-col items-center mt-1">
                  <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none">Views</span>
                  <span className="text-sm font-black text-cyan-400">{(sortedMonthly[2].totalViews || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="w-full h-20 md:h-24 bg-gradient-to-t from-amber-900/40 to-amber-900/10 rounded-t-3xl border-x border-t border-amber-900/30 flex items-center justify-center">
                 <div className="w-8 h-8 rounded-full bg-amber-900/20 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-amber-800" />
                 </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    )}

    {/* Announcements */}
    {announcements.filter(a => a.isActive).length > 0 && (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Avisos da Diretoria</h3>
        </div>
        {announcements.filter(a => a.isActive).map(ann => (
          <motion.div 
            key={ann.id}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-5 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-500 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-amber-500 uppercase tracking-tight">{ann.title || 'AVISO IMPORTANTE'}</h4>
              <p className="text-sm font-bold text-amber-100/80 leading-relaxed">{ann.message}</p>
              <p className="text-[10px] text-amber-500/40 uppercase font-black mt-2 tracking-widest">Postado em {new Date(ann.timestamp).toLocaleDateString()}</p>
            </div>
          </motion.div>
        ))}
      </div>
    )}

    {/* Active Competitions Banner */}
    {competitions.filter(c => c.isActive).length > 0 && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight uppercase">Competições Ativas</h2>
          <div className="flex items-center gap-2 text-[10px] font-black text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            <Zap className="w-3 h-3" /> EVENTO ESPECIAL
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {competitions.filter(c => c.isActive).map(comp => (
            <motion.div 
              key={comp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative h-64 rounded-[40px] overflow-hidden border border-zinc-800 shadow-2xl cursor-pointer"
              onClick={() => setSelectedComp(comp)}
            >
              <img src={comp.bannerUrl} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              
              <div className="absolute inset-0 p-8 flex flex-col justify-end space-y-4">
                <div className="space-y-1">
                  <h3 className="text-3xl font-black tracking-tighter uppercase leading-none">{comp.title}</h3>
                  <p className="text-zinc-300 text-xs font-bold line-clamp-2 max-w-md">{comp.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {comp.prizes.slice(0, 3).map((prize, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                      <Trophy className={`w-4 h-4 ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-zinc-300' : 'text-amber-700'}`} />
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-zinc-400 uppercase leading-none">{prize.label}</span>
                        <span className="text-xs font-black text-white">R$ {prize.value.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute top-6 right-6">
                {(() => {
                  const reg = registrations.find(r => r.competitionId === comp.id && r.userId === user.uid);
                  if (!reg) {
                    return (
                      <div className="bg-amber-500 text-black px-6 py-2 rounded-full text-xs font-black shadow-xl hover:scale-105 transition-all">
                        VER DETALHES
                      </div>
                    );
                  }
                  return (
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black shadow-xl ${
                      reg.status === 'approved' ? 'bg-emerald-500 text-black' :
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
          ))}
        </div>
      </div>
    )}

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
              {!registrations.find(r => r.competitionId === selectedComp.id && r.userId === user.uid) ? (
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
                    className="w-full py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.02] transition-all shadow-xl shadow-amber-500/20"
                  >
                    SOLICITAR INSCRIÇÃO
                  </button>
                </>
              ) : (
                <div className="text-center py-2">
                  <p className="text-amber-500 font-black uppercase tracking-widest text-sm">Você já solicitou inscrição nesta competição</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatCard title="Total Views" value={(user.totalViews || 0).toLocaleString()} sub="Acumulado" icon={<Eye />} color="amber" />
      <StatCard title="Total Likes" value={(user.totalLikes || 0).toLocaleString()} sub="Engajamento" icon={<Zap />} color="emerald" />
      <StatCard title="Comentários" value={(user.totalComments || 0).toLocaleString()} sub="Interações" icon={<MessageSquare />} color="blue" />
      <StatCard title="Compartilhamentos" value={(user.totalShares || 0).toLocaleString()} sub="Alcance" icon={<TrendingUp />} color="purple" />
    </div>

    {/* Main Grid */}
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
      <div className="xl:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight">Agenda Operacional</h2>
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
            <Calendar className="w-4 h-4" />
            MARÇO 2026
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={`h-32 rounded-2xl glass flex flex-col items-center justify-center gap-2 ${i === 0 ? 'border-amber-500/50 bg-amber-500/5' : ''}`}>
              <span className="text-[10px] font-black text-zinc-500 uppercase">Seg</span>
              <span className="text-xl font-black">30</span>
              {i === 0 && <div className="px-2 py-0.5 rounded-full bg-amber-500 text-[8px] font-black text-black">HOJE</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-black tracking-tight">Top Players</h2>
        <div className="space-y-3">
          {rankings.slice(0, 5).map((player, i) => (
            <div key={player.uid} className="flex items-center gap-4 p-3 rounded-2xl glass">
              <span className="w-6 text-xs font-black text-zinc-500">#{i + 1}</span>
              <img src={player.photoURL || `https://ui-avatars.com/api/?name=${player.displayName}`} className="w-8 h-8 rounded-lg" alt="" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{player.displayName}</p>
                <p className="text-[10px] text-zinc-500 font-bold">{(player.totalViews || 0).toLocaleString()} views</p>
              </div>
              {i === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
            </div>
          ))}
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

const PostSubmit = ({ user }: { user: User }) => {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<Platform>('tiktok');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      const urls = url.split(/[\n,]+/).map(u => u.trim()).filter(u => u.length > 5);

      if (urls.length === 0) {
        setSubmitting(false);
        return;
      }

      await Promise.all(urls.map(async (singleUrl) => {
        const postId = Math.random().toString(36).substr(2, 9);
        const newPost: Post = {
          id: postId,
          userId: user.uid,
          userName: user.displayName,
          url: singleUrl,
          platform,
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

        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">URLs dos Vídeos (um por linha)</label>
          <textarea 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://...&#10;https://..."
            className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 py-4 font-bold focus:border-amber-500 outline-none transition-colors min-h-[120px] resize-y"
          />
        </div>

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
    </div>
  );
};

const HistoryView = ({ posts, onDelete, isAdmin }: { posts: Post[], onDelete: (id: string) => void, isAdmin: boolean }) => (
  <div className="space-y-8">
    <h2 className="text-3xl font-black tracking-tight">Meus Protocolos</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {posts.map(post => (
        <div key={post.id} className="p-6 rounded-3xl glass space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {post.platform === 'tiktok' ? <Zap className="w-4 h-4 text-amber-500" /> : 
               post.platform === 'youtube' ? <TrendingUp className="w-4 h-4 text-red-500" /> :
               <Camera className="w-4 h-4 text-pink-500" />}
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                post.status === 'approved' ? 'bg-emerald-500/20 text-emerald-500' :
                post.status === 'rejected' ? 'bg-red-500/20 text-red-500' :
                'bg-amber-500/20 text-amber-500'
              }`}>
                {post.status === 'approved' ? 'Aprovado' : post.status === 'rejected' ? 'Recusado' : 'Em Triagem'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-bold">{new Date(post.timestamp).toLocaleDateString()}</span>
              {isAdmin && (
                <button 
                  onClick={() => onDelete(post.id)}
                  className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                  title="Excluir vídeo"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm font-bold truncate text-zinc-400">{post.url}</p>
          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-2">
              <Eye className="w-3 h-3 text-zinc-500" />
              <span className="text-[10px] font-bold">{(post.views || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="w-3 h-3 text-zinc-500" />
              <span className="text-[10px] font-bold">{(post.likes || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3 h-3 text-zinc-500" />
              <span className="text-[10px] font-bold">{(post.comments || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Share2 className="w-3 h-3 text-zinc-500" />
              <span className="text-[10px] font-bold">{(post.shares || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Bookmark className="w-3 h-3 text-zinc-500" />
              <span className="text-[10px] font-bold">{(post.saves || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
      {posts.length === 0 && (
        <div className="col-span-full py-20 text-center space-y-4">
          <History className="w-12 h-12 text-zinc-800 mx-auto" />
          <p className="text-zinc-500 font-bold">Nenhum protocolo encontrado</p>
        </div>
      )}
    </div>
  </div>
);

const Rankings = ({ rankings, competitions }: { rankings: User[], competitions: Competition[] }) => {
  const [timeframe, setTimeframe] = useState<'DAILY' | 'MONTHLY' | 'INSTAGRAM'>('MONTHLY');

  const activeCompetition = competitions?.find(c => c.isActive);
  const timeLeft = activeCompetition ? activeCompetition.endDate - Date.now() : 0;
  const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));

  const sortedRankings = useMemo(() => {
    return [...rankings]
      .filter(user => {
        if (timeframe === 'INSTAGRAM') return (user.dailyInstaPosts || 0) > 0;
        const views = timeframe === 'MONTHLY' ? (user.totalViews || 0) : (user.dailyViews || 0);
        return views > 0;
      })
      .sort((a, b) => {
        if (timeframe === 'INSTAGRAM') {
          return (b.dailyInstaPosts || 0) - (a.dailyInstaPosts || 0);
        }
        const viewsA = timeframe === 'MONTHLY' ? (a.totalViews || 0) : (a.dailyViews || 0);
        const viewsB = timeframe === 'MONTHLY' ? (b.totalViews || 0) : (b.dailyViews || 0);
        return viewsB - viewsA;
      }).slice(0, timeframe === 'INSTAGRAM' ? 3 : 10);
  }, [rankings, timeframe]);

  const getPrize = (index: number) => {
    const prizes = [7000, 4000, 3000, 2000, 1000, 800, 700, 600, 500, 400];
    return prizes[index] || 0;
  };

  const calculateStats = (player: User) => {
    const views = timeframe === 'MONTHLY' ? (player.totalViews || 0) : (player.dailyViews || 0);
    const likes = timeframe === 'MONTHLY' ? (player.totalLikes || 0) : (player.dailyLikes || 0);
    const comments = timeframe === 'MONTHLY' ? (player.totalComments || 0) : (player.dailyComments || 0);
    const shares = timeframe === 'MONTHLY' ? (player.totalShares || 0) : (player.dailyShares || 0);
    const saves = timeframe === 'MONTHLY' ? (player.totalSaves || 0) : (player.dailySaves || 0);
    const posts = timeframe === 'MONTHLY' ? (player.totalPosts || 0) : (player.dailyPosts || 0);
    
    const totalEngagement = likes + comments + shares + saves;
    const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;
    const score = totalEngagement;

    return { views, likes, comments, shares, saves, engagementRate, score, posts };
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {activeCompetition && daysLeft >= 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between text-amber-500 shadow-xl shadow-amber-500/5 mb-8">
           <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 animate-pulse text-amber-500" />
              <div className="flex flex-col">
                 <span className="font-black text-sm uppercase md:text-md tracking-tight">{activeCompetition.title}</span>
                 <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">A competição encerra em breve</span>
              </div>
           </div>
           <div className="flex flex-col items-end">
              <span className="text-3xl font-black">{daysLeft}</span>
              <span className="text-[10px] uppercase font-black tracking-widest leading-none">Dias Restantes</span>
           </div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 mt-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            <h2 className="text-2xl font-black tracking-tight uppercase">
              {timeframe === 'MONTHLY' ? 'Ranking Mensal' : timeframe === 'DAILY' ? 'Ranking Diário' : 'Top 3 Instagram'}
            </h2>
          </div>
          <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">
            {timeframe === 'INSTAGRAM' ? 'Ranking baseado na quantidade de vídeos de Instagram enviados hoje' : 'Ranking baseado no total de visualizações (Views)'}
          </p>
        </div>

        <div className="flex p-1 bg-zinc-900 rounded-xl border border-zinc-800">
          <button 
            onClick={() => setTimeframe('DAILY')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${timeframe === 'DAILY' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Zap className="w-3 h-3" /> DIA
          </button>
          <button 
            onClick={() => setTimeframe('INSTAGRAM')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${timeframe === 'INSTAGRAM' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Camera className="w-3 h-3" /> INSTA
          </button>
          <button 
            onClick={() => setTimeframe('MONTHLY')} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${timeframe === 'MONTHLY' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Trophy className="w-3 h-3" /> MÊS
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {sortedRankings.length === 0 && (
          <div className="p-12 text-center text-zinc-500 font-bold glass rounded-2xl border border-zinc-800/50">
            Aguardando inserção de dados. O painel deste ranking está vazio no momento.
          </div>
        )}
        {sortedRankings.map((player, i) => {
          const stats = calculateStats(player);
          return (
            <motion.div 
              key={player.uid}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`
                relative flex flex-col md:flex-row md:items-center gap-4 p-5 rounded-2xl border transition-all hover:scale-[1.01]
                ${i === 0 ? 'bg-gradient-to-r from-amber-500/10 via-zinc-900/40 to-transparent border-amber-500/30' : 
                  i === 1 ? 'bg-gradient-to-r from-zinc-400/10 via-zinc-900/40 to-transparent border-zinc-400/30' :
                  i === 2 ? 'bg-gradient-to-r from-amber-700/10 via-zinc-900/40 to-transparent border-amber-700/30' : 
                  'bg-zinc-900/40 border-zinc-800/50'}
              `}
            >
              {/* Glow effect for top 3 */}
              {i < 3 && (
                <div className={`absolute inset-0 rounded-2xl opacity-10 blur-xl pointer-events-none ${
                  i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-zinc-400' : 'bg-amber-700'
                }`} />
              )}

              <div className="flex items-center gap-4 flex-1 relative z-10">
                {/* Rank Badge */}
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center font-black text-sm shrink-0 border-2 shadow-2xl
                  ${i === 0 ? 'bg-amber-500 text-black border-amber-400' : 
                    i === 1 ? 'bg-zinc-400 text-black border-zinc-300' :
                    i === 2 ? 'bg-amber-700 text-white border-amber-600' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}
                `}>
                  {i === 0 ? <Crown className="w-5 h-5" /> : `${i + 1}º`}
                </div>

                {/* Avatar */}
                <div className="relative shrink-0">
                  <img 
                    src={player.photoURL || `https://ui-avatars.com/api/?name=${player.displayName}`} 
                    className={`w-14 h-14 rounded-2xl border-2 object-cover ${i < 3 ? 'border-amber-500/50' : 'border-zinc-800'}`} 
                    alt="" 
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* User Info & Stats */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-black text-base tracking-tight">@{player.displayName}</p>
                    {player.role === 'admin' && <ShieldCheck className="w-4 h-4 text-blue-400" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[14px] font-black uppercase tracking-tight">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Send className="w-4 h-4" /> {stats.posts} posts
                    </div>
                    <div className="flex items-center gap-1.5 text-pink-500">
                      <Heart className="w-4 h-4" /> {stats.likes.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-400">
                      <MessageSquare className="w-4 h-4" /> {stats.comments.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1.5 text-purple-400">
                      <Share2 className="w-4 h-4" /> {stats.shares.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-400">
                      <Bookmark className="w-4 h-4" /> {stats.saves.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-300">
                      <Eye className="w-4 h-4" /> {stats.views.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <TrendingUp className="w-4 h-4" /> {stats.engagementRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Views & Prize */}
              <div className="flex items-center gap-8 md:gap-12 relative z-10">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                    {timeframe === 'INSTAGRAM' ? 'Vídeos' : 'Views'}
                  </span>
                  <span className="text-2xl md:text-3xl font-black text-cyan-400">
                    {timeframe === 'INSTAGRAM' ? (player.dailyInstaPosts || 0).toLocaleString() : stats.views.toLocaleString()}
                  </span>
                </div>
                {!(timeframe === 'INSTAGRAM' && i > 0) && (
                  <div className="flex flex-col items-end min-w-[140px]">
                    <span className="text-[12px] text-zinc-500 uppercase font-black tracking-widest">Prêmio</span>
                    <span className={`text-3xl font-black ${i < 3 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {`R$ ${getPrize(i).toLocaleString()}`}
                    </span>
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

const FinancialRow = ({ user, onViewLinks }: { user: User, onViewLinks: (uid: string) => void }) => {
  const [saving, setSaving] = useState(false);
  
  const balance = user.balance || 0;
  const lifetime = user.lifetimeEarnings || 0;

  const handlePay = async () => {
    if (balance <= 0) {
      alert('Usuário não possui saldo pendente.');
      return;
    }

    if (!window.confirm(`Confirma o repasse financeiro de R$ ${balance.toLocaleString()} para ${user.displayName}? Esse valor será zerado e contabilizado no histórico dele.`)) {
      return;
    }

    setSaving(true);
    try {
      const auditorId = auth.currentUser?.uid || 'system';
      
      // Criar transação
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        amount: balance,
        timestamp: Date.now(),
        status: 'paid',
        auditorId: auditorId
      });

      // Atualizar Saldo do Usuário
      await updateDoc(doc(db, 'users', user.uid), { 
        balance: 0,
        lifetimeEarnings: lifetime + balance
      });
      
      alert('Pagamento confirmado com sucesso!');
    } catch(e: any) {
      console.error(e);
      alert(`Erro ao confirmar pagamento: ${e.message}`);
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-xl">
       <div className="flex justify-between items-start">
         <div className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-amber-500 font-bold tracking-widest uppercase text-[10px]">@{user.displayName?.toLowerCase().replace(/\s+/g, '_')}</span>
            <span className="font-black text-lg text-white truncate max-w-[200px] leading-tight">{user.displayName}</span>
            <span className="text-zinc-500 text-[10px] font-bold mt-1 uppercase">Ganhos Totais: R$ {lifetime.toLocaleString()}</span>
         </div>
         <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Saldo a Pagar</span>
            <span className="text-3xl font-black text-white">R$ {balance.toLocaleString()}</span>
         </div>
       </div>
       
       <div className="flex gap-2 w-full pt-4 border-t border-zinc-800">
         <button 
           onClick={() => onViewLinks(user.uid)}
           className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-black text-xs transition-all flex justify-center items-center gap-2"
         >
           <CheckCircle2 className="w-4 h-4" />
           AUDITAR CONTA
         </button>
         <button 
           onClick={handlePay} 
           disabled={saving || balance <= 0} 
           className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:opacity-50 text-black py-3 rounded-xl font-black text-xs transition-all flex justify-center items-center gap-2"
         >
           {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
           {saving ? '...' : 'EFETUAR PAGTO'}
         </button>
       </div>
    </div>
  );
};

const AdminPanel = ({ 
  userRole,
  posts, 
  pendingUsers, 
  approvedUsers, 
  settings, 
  competitions, 
  registrations, 
  announcements, 
  onSettingsUpdate,
  editingCompId,
  setEditingCompId,
  setCompToDelete,
  setPostToDelete,
  handlePostStatus,
  handleUserApproval,
  handleDeleteUser,
  handleRegistrationStatus,
  handleResetDailyRanking,
  toggleCompetitionStatus,
  handleBannerUpload,
  handleCreateCompetition,
  handleEditCompClick,
  handleEditUser,
  handleCreateAnnouncement,
  handleDeleteAnnouncement,
  handleDeleteSuggestion,
  suggestions,
  compTitle, setCompTitle,
  compDesc, setCompDesc,
  compRules, setCompRules,
  compHashtags, setCompHashtags,
  compMentions, setCompMentions,
  compBonuses, setCompBonuses,
  compInstaBonus, setCompInstaBonus,
  compViewBonus, setCompViewBonus,
  compStartDate, setCompStartDate,
  compEndDate, setCompEndDate,
  compBanner, setCompBanner,
  compPositions, setCompPositions,
  compPrizes, setCompPrizes,
  compPositionsDaily, setCompPositionsDaily,
  compPrizesDaily, setCompPrizesDaily,
  compPositionsMonthly, setCompPositionsMonthly,
  compPrizesMonthly, setCompPrizesMonthly,
  compPositionsInstagram, setCompPositionsInstagram,
  compPrizesInstagram, setCompPrizesInstagram,
  isCreatingComp, setIsCreatingComp,
  editingUser, setEditingUser,
  editName, setEditName,
  editPass, setEditPass,
  editRole, setEditRole,
  annTitle, setAnnTitle,
  annMsg, setAnnMsg,
  isCreatingAnn, setIsCreatingAnn
}: { 
  userRole: UserRole,
  posts: Post[], 
  pendingUsers: User[], 
  approvedUsers: User[],
  settings: { apifyKey: string }, 
  competitions: Competition[],
  registrations: CompetitionRegistration[],
  announcements: Announcement[],
  onSettingsUpdate: (s: { apifyKey: string }) => void,
  editingCompId: string | null,
  setEditingCompId: (val: string | null) => void,
  setCompToDelete: (val: string | null) => void,
  setPostToDelete: (id: string | null) => void,
  handlePostStatus: (postId: string, status: PostStatus) => void,
  handleUserApproval: (userId: string, isApproved: boolean) => void,
  handleDeleteUser: (userId: string) => void,
  handleRegistrationStatus: (regId: string, status: 'approved' | 'rejected') => void,
  handleResetDailyRanking: () => void,
  toggleCompetitionStatus: (id: string, isActive: boolean) => void,
  handleBannerUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
  handleCreateCompetition: () => void,
  handleEditCompClick: (comp: Competition) => void,
  handleEditUser: () => void,
  handleCreateAnnouncement: () => void,
  handleDeleteAnnouncement: (id: string) => void,
  handleDeleteSuggestion: (id: string) => void,
  suggestions: Suggestion[],
  compTitle: string, setCompTitle: (v: string) => void,
  compDesc: string, setCompDesc: (v: string) => void,
  compRules: string, setCompRules: (v: string) => void,
  compHashtags: string, setCompHashtags: (v: string) => void,
  compMentions: string, setCompMentions: (v: string) => void,
  compBonuses: string, setCompBonuses: (v: string) => void,
  compInstaBonus: string, setCompInstaBonus: (v: string) => void,
  compViewBonus: number, setCompViewBonus: (v: number) => void,
  compStartDate: string, setCompStartDate: (v: string) => void,
  compEndDate: string, setCompEndDate: (v: string) => void,
  compBanner: string, setCompBanner: (v: string) => void,
  compPositions: number, setCompPositions: (v: number) => void,
  compPrizes: { position: number, value: number, label: string }[], setCompPrizes: (v: { position: number, value: number, label: string }[]) => void,
  compPositionsDaily: number, setCompPositionsDaily: (v: number) => void,
  compPrizesDaily: { position: number, value: number, label: string }[], setCompPrizesDaily: (v: { position: number, value: number, label: string }[]) => void,
  compPositionsMonthly: number, setCompPositionsMonthly: (v: number) => void,
  compPrizesMonthly: { position: number, value: number, label: string }[], setCompPrizesMonthly: (v: { position: number, value: number, label: string }[]) => void,
  compPositionsInstagram: number, setCompPositionsInstagram: (v: number) => void,
  compPrizesInstagram: { position: number, value: number, label: string }[], setCompPrizesInstagram: (v: { position: number, value: number, label: string }[]) => void,
  isCreatingComp: boolean, setIsCreatingComp: (v: boolean) => void,
  editingUser: User | null, setEditingUser: (v: User | null) => void,
  editName: string, setEditName: (v: string) => void,
  editPass: string, setEditPass: (v: string) => void,
  editRole: UserRole, setEditRole: (v: UserRole) => void,
  annTitle: string, setAnnTitle: (v: string) => void,
  annMsg: string, setAnnMsg: (v: string) => void,
  isCreatingAnn: boolean, setIsCreatingAnn: (v: boolean) => void
}) => {
  const [tab, setTab] = useState<'POSTS' | 'USERS' | 'USERS_APPROVED' | 'COMPETITIONS' | 'REGISTROS' | 'SYNC' | 'AVISOS' | 'FINANCEIRO' | 'ACESSOS' | 'SUGESTOES'>(
    userRole === 'administrativo' ? 'FINANCEIRO' : 'POSTS'
  );
  const [auditUserId, setAuditUserId] = useState<string | null>(null);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingPostId, setSyncingPostId] = useState<string | null>(null);
  const [apifyKey, setApifyKey] = useState(settings.apifyKey);

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user'|'auditor'|'administrativo'|'admin'>('user');
  const [creatingUser, setCreatingUser] = useState(false);

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

  useEffect(() => {
    if (settings.apifyKey && !apifyKey) {
      setApifyKey(settings.apifyKey);
    }
  }, [settings.apifyKey]);
  
  const pendingPosts = posts.filter(p => p.status === 'pending');
  const pendingRegistrations = registrations.filter(r => r.status === 'pending');
  const approvedRegistrations = registrations.filter(r => r.status === 'approved');

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

  const handleSyncAllSequentially = async () => {
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
      }
      alert('Sincronização sequencial de todos os vídeos concluída!');
    } catch (error: any) {
      alert(`Erro na sincronização sequencial: ${error.message}`);
    } finally {
      setSyncing(false);
      setSyncingPostId(null);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight uppercase">Painel da Diretoria</h2>
          <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Controle de Acesso e Sincronização</p>
        </div>
        
        {userRole === 'admin' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800/50">
            <div className="relative flex-1 sm:w-64">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="password"
                value={apifyKey}
                onChange={(e) => setApifyKey(e.target.value)}
                placeholder="Chave Apify API"
                className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:border-amber-500 outline-none transition-all"
              />
            </div>
            <button 
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center justify-center gap-2 px-8 py-3 gold-bg text-black font-black rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg shadow-amber-500/10"
            >
              {syncing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
              SINCRONIZAR AGORA
            </button>
            <button 
              onClick={handleResetDailyRanking}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-red-500/10 text-red-500 font-black rounded-xl hover:bg-red-500 hover:text-black transition-all shadow-lg shadow-red-500/10"
            >
              <Trash2 className="w-5 h-5" />
              ZERAR DIÁRIO
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap p-1 bg-zinc-900 rounded-2xl w-fit gap-1">
        {/* POSTS - visível apenas para admin e auditor */}
        {(userRole === 'admin' || userRole === 'auditor') && (
          <button 
            onClick={() => { setTab('POSTS'); setAuditUserId(null); setSelectedCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'POSTS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            POSTS ({pendingPosts.length})
          </button>
        )}
        {/* USERS - visível apenas para admin */}
        {userRole === 'admin' && (
          <button 
            onClick={() => { setTab('USERS'); setAuditUserId(null); setSelectedCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'USERS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            PENDENTES ({pendingUsers.length})
          </button>
        )}
        {/* APROVADOS - visível apenas para admin */}
        {userRole === 'admin' && (
          <button 
            onClick={() => { setTab('USERS_APPROVED'); setAuditUserId(null); setSelectedCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'USERS_APPROVED' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            APROVADOS ({approvedUsers.length})
          </button>
        )}
        {/* COMPETIÇÕES - visível para admin e auditor */}
        {(userRole === 'admin' || userRole === 'auditor') && (
          <button 
            onClick={() => { setTab('COMPETITIONS'); setAuditUserId(null); setSelectedCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'COMPETITIONS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            COMPETIÇÕES ({competitions.length})
          </button>
        )}
        {/* SINCRONIA - visível apenas para admin */}
        {userRole === 'admin' && (
          <button 
            onClick={() => { setTab('SYNC'); setAuditUserId(null); setSelectedCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'SYNC' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            SINCRONIA ({posts.filter(p => p.status === 'approved').length})
          </button>
        )}
        {/* REGISTROS - visível apenas para admin */}
        {userRole === 'admin' && (
          <button 
            onClick={() => setTab('REGISTROS')}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'REGISTROS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            REGISTROS ({pendingRegistrations.length})
          </button>
        )}
        {/* AVISOS - visível apenas para admin */}
        {userRole === 'admin' && (
          <button 
            onClick={() => setTab('AVISOS')}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'AVISOS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            AVISOS
          </button>
        )}
        {/* FINANCEIRO - visível para admin, auditor e administrativo */}
        {(userRole === 'admin' || userRole === 'auditor' || userRole === 'administrativo') && (
          <button 
            onClick={() => setTab('FINANCEIRO')}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'FINANCEIRO' ? 'gold-bg text-black' : 'text-zinc-500'}`}
          >
            FINANCEIRO
          </button>
        )}
        {/* CRIAR ACESSO - visível apenas para admin */}
        {userRole === 'admin' && (
          <button 
            onClick={() => setTab('ACESSOS')}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'ACESSOS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            CRIAR ACESSO
          </button>
        )}
        {/* SUGESTÕES - visível para admin e auditor */}
        {(userRole === 'admin' || userRole === 'auditor') && (
          <button 
            onClick={() => setTab('SUGESTOES')}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'SUGESTOES' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            SUGESTÕES ({suggestions.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {tab === 'ACESSOS' && userRole === 'admin' && (
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl max-w-xl mx-auto w-full">
            <h3 className="text-xl font-black uppercase mb-2">Criar Novo Funcionário/Acesso</h3>
            <p className="text-xs font-bold text-zinc-500 mb-6">Crie um acesso direto para Auditores, Administradores ou Usuários sem sair da sua conta atual.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-zinc-500 uppercase ml-2 mb-1 block">TIPO DE CARGO</label>
                <select 
                  value={newUserRole} 
                  onChange={e => setNewUserRole(e.target.value as any)}
                  className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl focus:border-amber-500 outline-none transition-all font-bold text-sm text-zinc-300"
                >
                  <option value="user">👤 Usuário Comum (Criador de Conteúdo)</option>
                  <option value="auditor">🔍 Auditor — Revisa vídeos postados</option>
                  <option value="administrativo">🏢 Administrativo — Auditoria + Financeiro + Acesso como usuário</option>
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
            <div className="flex flex-col gap-2 mb-4">
              <h3 className="text-xl font-black uppercase tracking-tight">Gestão Financeira e Premiações</h3>
              <p className="text-zinc-500 font-bold text-xs">Monitore saldos a pagar. Atualize o valor após fechar o pix e ele marcará como Pago.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {auditUserId ? (
                <div className="col-span-full border border-zinc-800 rounded-3xl p-6 bg-zinc-950">
                  <div className="flex justify-between items-center mb-6">
                     <div>
                       <h3 className="text-xl font-black uppercase text-amber-500">Auditoria Aprofundada</h3>
                       <p className="text-xs text-zinc-500 font-bold tracking-widest uppercase">
                         Verificando vídeos de {approvedUsers.find(u => u.uid === auditUserId)?.displayName}
                       </p>
                     </div>
                     <button 
                       onClick={() => setAuditUserId(null)}
                       className="px-4 py-2 bg-zinc-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 hover:bg-zinc-700"
                     >
                       <X className="w-4 h-4" /> VOLTAR À LISTA
                     </button>
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
                              <p className={`text-[10px] font-black uppercase ${post.status === 'approved' ? 'text-emerald-500' : post.status === 'rejected' ? 'text-red-500' : 'text-amber-500'}`}>
                                STATUS: {post.status}
                              </p>
                            </div>
                         </div>
                         <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 text-xs w-full md:w-auto">
                            <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-xl">
                              <span className="text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1"><Eye className="w-3 h-3 text-zinc-400"/> {(post.views || 0).toLocaleString()}</span>
                              <span className="text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1"><Heart className="w-3 h-3 text-zinc-400"/> {(post.likes || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <a href={post.url} target="_blank" rel="noreferrer" className="flex-1 text-center sm:flex-none px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 font-bold hover:text-white transition-colors">
                                Ver Link
                              </a>
                              <button 
                                onClick={() => handlePostStatus(post.id, 'approved')}
                                className={`p-2 rounded-xl transition-all ${post.status === 'approved' ? 'bg-emerald-500 text-black' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black'}`}
                                title="Aprovar Vídeo"
                              >
                                <CheckCircle2 className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => handlePostStatus(post.id, 'rejected')}
                                className={`p-2 rounded-xl transition-all ${post.status === 'rejected' ? 'bg-red-500 text-black' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black'}`}
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
                <>
                  {approvedUsers.map(u => (
                     <FinancialRow key={u.uid} user={u} onViewLinks={setAuditUserId} />
                  ))}
                  {approvedUsers.length === 0 && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
                      <p className="text-zinc-500 font-bold">Nenhum usuário aprovado para gerir finanças.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'POSTS' ? (
          <>
            {pendingPosts.map(post => (
              <div key={post.id} className="p-6 rounded-3xl glass flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
                  {post.platform === 'tiktok' ? <Zap className="w-8 h-8 text-amber-500" /> : 
                   post.platform === 'youtube' ? <TrendingUp className="w-8 h-8 text-red-500" /> :
                   <Camera className="w-8 h-8 text-pink-500" />}
                </div>
                <div className="flex-1 min-w-0 text-center md:text-left">
                  <p className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-1">{post.userName}</p>
                  <p className="font-bold truncate text-zinc-300 mb-2">{post.url}</p>
                  <div className="flex items-center justify-center md:justify-start gap-4 text-[10px] font-black text-zinc-500">
                    <span className="uppercase">{post.platform}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span>{new Date(post.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button 
                    onClick={() => handleSingleSync(post)}
                    disabled={syncing || syncingPostId === post.id}
                    className="p-3 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black transition-all disabled:opacity-50"
                    title="Sincronizar métricas agora"
                  >
                    {syncingPostId === post.id ? <RefreshCw className="w-6 h-6 animate-spin" /> : <RefreshCw className="w-6 h-6" />}
                  </button>
                  <a href={post.url} target="_blank" rel="noreferrer" className="px-6 py-3 rounded-xl bg-zinc-900 text-zinc-400 font-bold text-sm hover:text-zinc-100 transition-colors">
                    Ver Link
                  </a>
                  <button 
                    onClick={() => handlePostStatus(post.id, 'rejected')}
                    className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => handlePostStatus(post.id, 'approved')}
                    className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                  </button>
                </div>
              </div>
            ))}
            {pendingPosts.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <ShieldCheck className="w-12 h-12 text-zinc-800 mx-auto" />
                <p className="text-zinc-500 font-bold">Nenhum post pendente!</p>
              </div>
            )}
          </>
        ) : tab === 'SYNC' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/50">
              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase">Sincronização de Vídeos</h3>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Atualize as métricas de todos os vídeos aprovados</p>
              </div>
              <button 
                onClick={handleSyncAllSequentially}
                disabled={syncing}
                className="flex items-center gap-2 px-8 py-3 gold-bg text-black font-black rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50"
              >
                {syncing && !syncingPostId ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                SINCRONIZAR TODOS SEQUENCIALMENTE
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {posts.filter(p => p.status === 'approved').map(post => (
                <div key={post.id} className="p-6 rounded-3xl glass flex flex-col md:flex-row items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shrink-0">
                    {post.platform === 'tiktok' ? <Zap className="w-8 h-8 text-amber-500" /> : 
                     post.platform === 'youtube' ? <TrendingUp className="w-8 h-8 text-red-500" /> :
                     <Camera className="w-8 h-8 text-pink-500" />}
                  </div>
                  <div className="flex-1 min-w-0 text-center md:text-left">
                    <p className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-1">{post.userName}</p>
                    <p className="font-bold truncate text-zinc-300 mb-2">{post.url}</p>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-[10px] font-black text-zinc-500">
                      <div className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.views.toLocaleString()}</div>
                      <div className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.likes.toLocaleString()}</div>
                      <div className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {post.comments.toLocaleString()}</div>
                      <div className="flex items-center gap-1"><Share2 className="w-3 h-3" /> {post.shares.toLocaleString()}</div>
                      <div className="flex items-center gap-1"><Bookmark className="w-3 h-3" /> {post.saves.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button 
                      onClick={() => handleSingleSync(post)}
                      disabled={syncing || syncingPostId === post.id}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500/10 text-amber-500 font-black text-xs hover:bg-amber-500 hover:text-black transition-all disabled:opacity-50"
                    >
                      {syncingPostId === post.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      SINCRONIZAR
                    </button>
                    <a href={post.url} target="_blank" rel="noreferrer" className="px-6 py-3 rounded-xl bg-zinc-900 text-zinc-400 font-bold text-sm hover:text-zinc-100 transition-colors">
                      Ver Link
                    </a>
                    <button 
                      onClick={() => setPostToDelete(post.id)}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/10 text-red-500 font-black text-xs hover:bg-red-500 hover:text-black transition-all"
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

                <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                   {posts.filter(p => p.userId === auditUserId).map(post => (
                     <div key={post.id} className="p-4 rounded-2xl bg-black border border-zinc-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                       <div className="flex items-center gap-4 w-full md:w-auto">
                          {post.platform === 'tiktok' ? <Zap className="w-6 h-6 text-amber-500" /> : 
                           post.platform === 'youtube' ? <TrendingUp className="w-6 h-6 text-red-500" /> :
                           <Camera className="w-6 h-6 text-pink-500" />}
                          <div className="flex flex-col overflow-hidden max-w-[200px]">
                            <p className="font-bold text-xs truncate text-zinc-300">{post.url}</p>
                            <p className={`text-[10px] font-black uppercase ${post.status === 'approved' ? 'text-emerald-500' : post.status === 'rejected' ? 'text-red-500' : 'text-amber-500'}`}>
                              STATUS: {post.status}
                            </p>
                          </div>
                       </div>
                       <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 text-xs w-full md:w-auto">
                          <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-xl">
                            <span className="text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1"><Eye className="w-3 h-3 text-zinc-400"/> {(post.views || 0).toLocaleString()}</span>
                            <span className="text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1"><Heart className="w-3 h-3 text-zinc-400"/> {(post.likes || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={post.url} target="_blank" rel="noreferrer" className="flex-1 text-center sm:flex-none px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 font-bold hover:text-white transition-colors">
                              Ver Link
                            </a>
                            <button 
                              onClick={() => handlePostStatus(post.id, 'approved')}
                              className={`p-2 rounded-xl transition-all ${post.status === 'approved' ? 'bg-emerald-500 text-black' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black'}`}
                              title="Aprovar Vídeo"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handlePostStatus(post.id, 'rejected')}
                              className={`p-2 rounded-xl transition-all ${post.status === 'rejected' ? 'bg-red-500 text-black' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black'}`}
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
              <div className="grid grid-cols-1 gap-4">
                {approvedUsers.map(u => (
                  <div key={u.uid} className="p-6 rounded-3xl glass flex flex-col md:flex-row items-center gap-6">
                    <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-16 h-16 rounded-2xl shrink-0" alt="" />
                    <div className="flex-1 min-w-0 text-center md:text-left">
                      <p className="text-lg font-black">{u.displayName}</p>
                      <p className="text-sm font-bold text-zinc-500">{u.email}</p>
                      <span className={`inline-flex items-center gap-1 mt-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest w-fit ${
                        u.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        u.role === 'administrativo' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                        u.role === 'auditor' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        {u.role === 'admin' ? '👑 Admin' : u.role === 'administrativo' ? '🏢 Administrativo' : u.role === 'auditor' ? '🔍 Auditor' : '👤 Usuário'}
                      </span>
                      {u.password && <p className="text-[10px] font-mono text-zinc-600 mt-1">Senha: {u.password}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button 
                        onClick={() => setAuditUserId(u.uid)}
                        className="px-6 py-3 rounded-xl bg-amber-500/10 text-amber-500 font-black text-xs hover:bg-amber-500 hover:text-black transition-all"
                      >
                        VER LINKS
                      </button>
                      <button 
                        onClick={() => {
                          setEditingUser(u);
                          setEditName(u.displayName);
                          setEditPass('');
                          setEditRole(u.role as any);
                        }}
                        className="px-6 py-3 rounded-xl bg-zinc-800 text-zinc-300 font-black text-xs hover:bg-zinc-700 transition-all"
                      >
                        EDITAR
                      </button>
                      <button 
                        onClick={() => handleUserApproval(u.uid, false)}
                        className="px-6 py-3 rounded-xl bg-red-500/10 text-red-500 font-black text-xs hover:bg-red-500 hover:text-black transition-all"
                      >
                        REMOVER
                      </button>
                    </div>
                  </div>
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
                        <option value="user">👤 Usuário Comum (Criador de Conteúdo)</option>
                        <option value="auditor">🔍 Auditor — Revisa vídeos postados</option>
                        <option value="administrativo">🏢 Administrativo — Financeiro + Competições</option>
                        <option value="admin">👑 Administrador (Diretoria) — Acesso total</option>
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
        ) : tab === 'USERS' ? (
          <>
            {pendingUsers.map(u => (
              <div key={u.uid} className="p-6 rounded-3xl glass flex flex-col md:flex-row items-center gap-6">
                <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-16 h-16 rounded-2xl shrink-0" alt="" />
                <div className="flex-1 min-w-0 text-center md:text-left">
                  <p className="text-lg font-black">{u.displayName}</p>
                  <p className="text-sm font-bold text-zinc-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button 
                    onClick={() => handleUserApproval(u.uid, true)}
                    className="px-8 py-3 rounded-xl bg-emerald-500 text-black font-black text-sm hover:scale-[1.02] transition-all"
                  >
                    APROVAR
                  </button>
                  <button 
                    onClick={() => handleDeleteUser(u.uid)}
                    className="px-8 py-3 rounded-xl bg-red-500/10 text-red-500 font-black text-sm hover:bg-red-500 hover:text-black transition-all"
                  >
                    REMOVER SOLICITAÇÃO
                  </button>
                </div>
              </div>
            ))}
            {pendingUsers.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <Users className="w-12 h-12 text-zinc-800 mx-auto" />
                <p className="text-zinc-500 font-bold">Nenhum usuário aguardando aprovação!</p>
              </div>
            )}
          </>
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

              const sortedRanking = Object.values(rankingData)
                .sort((a: any, b: any) => b.views - a.views)
                .slice(0, 10);

              return (
                <div className="space-y-8 pb-10">
                  {/* Grid de KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
                       <Eye className="w-5 h-5 text-amber-500" />
                       <span className="text-2xl font-black">{stats.views.toLocaleString()}</span>
                       <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Views</span>
                    </div>
                    <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
                       <Heart className="w-5 h-5 text-pink-500" />
                       <span className="text-2xl font-black">{stats.likes.toLocaleString()}</span>
                       <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Curtidas</span>
                    </div>
                    <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
                       <MessageSquare className="w-5 h-5 text-blue-500" />
                       <span className="text-2xl font-black">{stats.comments.toLocaleString()}</span>
                       <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Comentários</span>
                    </div>
                    <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
                       <Share2 className="w-5 h-5 text-emerald-500" />
                       <span className="text-2xl font-black">{stats.shares.toLocaleString()}</span>
                       <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Shares</span>
                    </div>
                    <div className="p-6 rounded-[32px] glass border border-zinc-800 flex flex-col gap-2">
                       <Zap className="w-5 h-5 text-amber-500" />
                       <span className="text-2xl font-black">{stats.total}</span>
                       <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Vídeos</span>
                    </div>
                    <div className="p-6 rounded-[32px] bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/20 flex flex-col gap-2">
                       <Camera className="w-5 h-5 text-pink-500" />
                       <span className="text-2xl font-black text-pink-500">{stats.insta}</span>
                       <span className="text-[10px] font-black text-pink-500/50 uppercase tracking-widest">Instagram</span>
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
                          <p className="text-center py-10 text-zinc-600 font-bold">Nenhum dado de ranking disponível.</p>
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
                           {/* Bônus por 1M Views — destaque especial */}
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
                               <p className="text-[9px] font-black text-amber-500 uppercase mb-2">🏆 Ranking Mensal (Acumulado do Período)</p>
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
                               <p className="text-[9px] font-black text-blue-400 uppercase mb-2">📅 Premiação Diária (Views do Dia)</p>
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
                               <p className="text-[9px] font-black text-emerald-400 uppercase mb-2">📊 Ranking Geral</p>
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
                               <p className="text-[9px] font-black text-pink-500 uppercase mb-2">📸 Instagram (Quantidade de Posts)</p>
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
                                while(newPrizes.length < val) {
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
                                while(newPrizes.length < val) {
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
                                while(newPrizes.length < val) {
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
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${comp.isActive ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                            {comp.isActive ? 'Em Andamento' : 'Finalizada'}
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
                          onClick={() => handleRegistrationStatus(reg.id!, 'rejected')}
                          className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                        >
                          <XCircle className="w-6 h-6" />
                        </button>
                        <button 
                          onClick={() => handleRegistrationStatus(reg.id!, 'approved')}
                          className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all"
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
                    </div>
                  );
                })}
              </div>
            </div>
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
                  <button 
                    onClick={() => handleDeleteSuggestion(s.id)}
                    className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
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
        ) : null}
      </div>
    </div>
  );
};

const SettingsView = ({ 
  user, 
  profileName, 
  setProfileName, 
  profilePhoto, 
  handleProfilePhotoUpload, 
  handleUpdateProfile, 
  isUpdatingProfile 
}: { 
  user: User; 
  profileName: string; 
  setProfileName: (val: string) => void; 
  profilePhoto: string; 
  handleProfilePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  handleUpdateProfile: () => void; 
  isUpdatingProfile: boolean; 
}) => (
  <div className="max-w-2xl mx-auto space-y-10">
    <div className="flex items-center justify-between">
      <h2 className="text-3xl font-black tracking-tight">Configurações</h2>
      <button 
        onClick={handleUpdateProfile}
        disabled={isUpdatingProfile}
        className="px-8 py-3 gold-bg text-black font-black rounded-xl hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
      >
        {isUpdatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        SALVAR ALTERAÇÕES
      </button>
    </div>
    
    <div className="space-y-6">
      <div className="p-8 rounded-3xl glass space-y-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <img 
              src={profilePhoto || user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              className="w-32 h-32 rounded-[40px] object-cover border-4 border-zinc-900 shadow-2xl" 
              alt="" 
            />
            <label 
              htmlFor="profile-photo-upload" 
              className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-[40px]"
            >
              <Zap className="w-8 h-8 text-amber-500" />
              <input 
                type="file" 
                id="profile-photo-upload" 
                className="hidden" 
                accept="image/*" 
                onChange={handleProfilePhotoUpload} 
              />
            </label>
          </div>
          <div className="flex-1 space-y-4 w-full">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome de Exibição</label>
              <input 
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                placeholder="Seu nome no Hub"
              />
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">E-mail da Conta</p>
              <p className="font-bold text-zinc-300">{user.email}</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-8 border-t border-zinc-800">
          <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800/50">
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Nível de Acesso</p>
            <p className="font-bold text-amber-500 uppercase flex items-center gap-2">
              <Crown className="w-4 h-4" />
              {user.role}
            </p>
          </div>
          <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800/50">
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">ID do Hub</p>
            <p className="font-bold text-zinc-300">#{user.uid.substr(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-start gap-4">
        <ShieldCheck className="w-5 h-5 text-zinc-500 shrink-0" />
        <p className="text-xs text-zinc-500 leading-relaxed">
          Sua conta está vinculada ao sistema MetaRayx. Se precisar de suporte técnico, entre em contato com a diretoria no Discord oficial.
        </p>
      </div>
    </div>
  </div>
);

const SuggestionsView = ({ 
  suggestionMsg, 
  setSuggestionMsg, 
  handleSendSuggestion 
}: { 
  suggestionMsg: string; 
  setSuggestionMsg: (v: string) => void; 
  handleSendSuggestion: () => void;
}) => (
  <div className="max-w-2xl mx-auto space-y-10">
    <div className="space-y-2">
      <h2 className="text-3xl font-black tracking-tight uppercase">Sugestões e Ideias</h2>
      <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">Ajude-nos a construir o melhor HUB de criadores do Brasil</p>
    </div>

    <div className="p-8 rounded-[40px] glass border border-zinc-800 space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-amber-500">
           <Zap className="w-5 h-5" />
           <span className="text-xs font-black uppercase tracking-widest">O que podemos melhorar?</span>
        </div>
        <textarea 
          value={suggestionMsg}
          onChange={(e) => setSuggestionMsg(e.target.value)}
          placeholder="Descreva sua ideia, bug encontrado ou sugestão de nova funcionalidade..."
          className="w-full bg-black border border-zinc-800 rounded-3xl py-6 px-8 text-sm font-bold focus:border-amber-500 outline-none transition-all h-48 resize-none shadow-inner"
        />
      </div>

      <button 
        onClick={handleSendSuggestion}
        disabled={!suggestionMsg.trim()}
        className="w-full py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.01] transition-all shadow-xl shadow-amber-500/10 disabled:opacity-50 flex items-center justify-center gap-3"
      >
        <Send className="w-5 h-5" />
        ENVIAR MINHA SUGESTÃO
      </button>
    </div>

    <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800 flex items-start gap-4">
      <div className="p-2 rounded-lg bg-zinc-800">
        <Heart className="w-5 h-5 text-pink-500" />
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed font-bold">
        Todas as sugestões são lidas pela diretoria. Valorizamos cada feedback para tornar sua experiência no MetaRayx cada vez mais produtiva e rentável.
      </p>
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

export default App;
