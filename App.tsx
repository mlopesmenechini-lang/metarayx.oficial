import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';
import {
  auth, db, googleProvider, signInWithPopup, signOut,
  onSnapshot, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit,
  OperationType, handleFirestoreError, createUserWithEmailAndPassword, signInWithEmailAndPassword, addDoc, serverTimestamp, onAuthStateChanged, writeBatch, deleteField
} from './firebase';

import { User, Post, Season, Announcement, Platform, PostStatus, Competition, CompetitionRegistration, UserRole, Transaction, Suggestion, Settings } from './types';
import {
  LayoutDashboard, Trophy, Send, History, Settings as SettingsIcon, LogOut,
  ShieldCheck, AlertCircle, CheckCircle2, XCircle, Clock,
  TrendingUp, Users, Zap, Calendar, MessageSquare, Menu, X, ChevronLeft, ExternalLink,
  Mail, Lock, User as UserIcon, Eye, EyeOff, Loader2, RefreshCw, Crown, Trash2, Plus,
  Heart, Share2, Bookmark, Bell, Check, Camera, BarChart3, ArrowLeft, ArrowRight, BookOpen, Shield, Star, ChevronRight, Target,
  Award, UserX, Sparkles, CreditCard, Coins, DollarSign, Info, Archive, Download, RotateCcw, Pencil, PlusCircle, MinusCircle, Key, ShieldAlert,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { syncViewsWithApify, syncSinglePostWithApify, updateUserMetrics, repairAllUserMetrics } from './services/apifyService';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth as getSecondaryAuth, createUserWithEmailAndPassword as createSecondaryUser, signOut as signSecondaryOut } from 'firebase/auth';

// Componentes Extraídos
import { InfoTooltip, ErrorBoundary, NavItem } from './components/Shared';
import { AuthScreen } from './components/AuthScreen';
import { WalletView } from './components/WalletView';
import { Dashboard } from './components/Dashboard';
import { CompetitionRegulamento, CompetitionsView, CompetitionDetailView } from './components/CompetitionViews';
import { SettingsView } from './components/SettingsView';
import { SuggestionsView } from './components/SuggestionsView';
import { HistoryView } from './components/HistoryView';
import { TriagemTab } from './components/Admin/TriagemTab';
import { SincronizacaoTab } from './components/Admin/SincronizacaoTab';
import { RessincronizacaoTab } from './components/Admin/RessincronizacaoTab';
import { DiagnosticoTab } from './components/Admin/DiagnosticoTab';

const sanitizeString = (text: string) => {
  if (typeof text !== 'string') return text;
  
  // Limpeza de caracteres corrompidos comuns (Mojibake UTF-8)
  return text
    .replace(/á/g, 'á').replace(/ã/g, 'ã').replace(/ç/g, 'ç').replace(/Ãõ/g, 'õ')
    .replace(/é/g, 'é').replace(/ê/g, 'ê').replace(/ó/g, 'ó').replace(/í/g, 'í')
    .replace(/ú/g, 'ú').replace(/â/g, 'â').replace(/à/g, 'à').replace(/È/g, 'È')
    .replace(/Ê/g, 'Ê').replace(/À/g, 'À').replace(/º/g, 'º')
    .replace(/Ã\x81/g, 'Á').replace(/Ã\x89/g, 'É').replace(/Ã\x8D/g, 'Í').replace(/Ã\x93/g, 'Ó')
    .replace(/Ã\x9A/g, 'Ú').replace(/Ã\x87/g, 'Ç').replace(/Ã\x95/g, 'Õ');
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

export type AdminTab = 'VISAO_GERAL' | 'SYNC' | 'TIMER' | 'TRIAGEM' | 'SINCRONIZACAO' | 'RESSINCRONIZACAO' | 'FINANCEIRO' | 'ACESSOS' | 'SUGESTOES' | 'RELATORIOS' | 'REMOVED_POSTS' | 'REMOVAL_REQUESTS' | 'REGISTROS' | 'AVISOS' | 'ARCHIVED' | 'POSTS' | 'USERS' | 'USERS_APPROVED' | 'COMPETITIONS' | 'DIAGNOSTICO';

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
  const [settings, setSettings] = useState<Settings>({ apifyKey: '', apifyKeys: [], apifyKeysSync: [] });
  const [sessionSyncedIds, setSessionSyncedIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncingPostId, setSyncingPostId] = useState<string | null>(null);
  const [syncingCompId, setSyncingCompId] = useState<string | null>(null);
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
  const [pendingMoves, setPendingMoves] = useState<Record<string, string>>({});
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [protocolCount, setProtocolCount] = useState(1);
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);
  const [showBalances, setShowBalances] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [profileTiktok, setProfileTiktok] = useState<string[]>([]);
  const [profileInstagram, setProfileInstagram] = useState<string[]>([]);
  const [profileYoutube, setProfileYoutube] = useState<string[]>([]);
  const [profilePhoto, setProfilePhoto] = useState('');
  const [settingsTab, setSettingsTab] = useState<'PROFILE' | 'SOCIAL'>('PROFILE');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [apifyKeySync, setApifyKeySync] = useState('');
  const [compTitle, setCompTitle] = useState('');
  const [compRankingMetric, setCompRankingMetric] = useState<'views' | 'likes'>('views');
  const [compGoalTarget, setCompGoalTarget] = useState<number>(0);
  const [compGoalMetric, setCompGoalMetric] = useState<'views' | 'likes'>('views');
  const [compDesc, setCompDesc] = useState('');
  const [compRules, setCompRules] = useState('');
  const [compHashtags, setCompHashtags] = useState('');
  const [compMentions, setCompMentions] = useState('');
  const [compRequiredHashtags, setCompRequiredHashtags] = useState('');
  const [compReqHashtagsYouTube, setCompReqHashtagsYouTube] = useState('');
  const [compRequiredMentions, setCompRequiredMentions] = useState('');
  const [compReqTikTok, setCompReqTikTok] = useState('');
  const [compReqYouTube, setCompReqYouTube] = useState('');
  const [compReqInsta, setCompReqInsta] = useState('');
  const [compDailyResetTime, setCompDailyResetTime] = useState('20:00');
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

  // Role Security States
  const [showRoleChallenge, setShowRoleChallenge] = useState(false);
  const [roleChallengeInput, setRoleChallengeInput] = useState('');
  const [pendingRoleAction, setPendingRoleAction] = useState<{
    type: 'UPDATE' | 'EDIT';
    uid?: string;
    role: UserRole;
  } | null>(null);
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
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>(() => {
    const saved = localStorage.getItem('dismissedNotifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const NOTIFICATION_ACTIVATION_TIME = 1776646000000; // 19/04/2026
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
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionModal, setRejectionModal] = useState<{ isOpen: boolean; postId: string; status: PostStatus }>({ isOpen: false, postId: '', status: 'rejected' });
  const [removalModal, setRemovalModal] = useState<{ isOpen: boolean; postId: string; reason: string; consent: boolean }>({ isOpen: false, postId: '', reason: '', consent: false });


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

  const handleDismissNotification = (postId: string) => {
    setDismissedNotifications(prev => {
      const next = [...prev, postId];
      localStorage.setItem('dismissedNotifications', JSON.stringify(next));
      return next;
    });
  };

  const notificationList = useMemo(() => {
    if (!user) return [];
    
    // Personal Notifications (Rejected Posts)
    const personal = posts.filter(p => 
      p.userId === user.uid && 
      p.status === 'rejected' && 
      p.approvedAt && p.approvedAt > NOTIFICATION_ACTIVATION_TIME &&
      !dismissedNotifications.includes(p.id)
    ).map(p => ({
      id: p.id,
      type: 'personal' as const,
      title: 'Vídeo Desclassificado',
      message: p.rejectionReason || 'Seu vídeo foi removido por não seguir as regras da competição.',
      timestamp: p.approvedAt!,
      badge: 'Alerta'
    }));

    // Global Notifications (Announcements)
    const global = announcements.filter(a => 
      a.isActive !== false && 
      !acknowledgedAnnouncements.includes(a.id)
    ).map(a => ({
      id: a.id,
      type: 'global' as const,
      title: a.title,
      message: a.message,
      timestamp: a.timestamp,
      badge: 'Aviso'
    }));

    return [...personal, ...global].sort((a, b) => b.timestamp - a.timestamp);
  }, [posts, announcements, user, dismissedNotifications, acknowledgedAnnouncements]);


  // Real-time Data Listeners — dados públicos (carrega assim que autenticado)
  useEffect(() => {
    if (!user) return;

    // Rankings Listener (público — não depende de aprovação)
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

  // Real-time Data Listeners á¢á¢ââ‚¬Å¡Ã‚Â¬á¢ââ€šÂ¬Ã‚Â dados privados (depende de aprovação)
  useEffect(() => {
    if (!user) return;
    const isStaff = user.role === 'admin' || user.role === 'auditor' || user.role === 'administrativo';
    if (!user.isApproved && !isStaff) return;

    // Posts Listener (My Posts or All for Admin)
    const postsQuery = (user.role === 'admin' || user.role === 'auditor' || user.role === 'administrativo')
      ? query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(10000))
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
          const data = docSnap.data();
          // Migração automática e suporte a múltiplas chaves
          const keys = data.apifyKeys || (data.apifyKey ? [data.apifyKey] : []);
          setSettings({
            ...data,
            apifyKey: data.apifyKey || (keys[0] || ''),
            apifyKeys: keys
          } as any);
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
      const cid = postData.competitionId;

      // 1. Marca como deletado no Firestore
      await updateDoc(postRef, { status: 'deleted' });

      // 2. Subtrai IMEDIATAMENTE os stats do usuário sem depender de propagação de query
      if (cid) {
        const userRef = doc(db, 'users', authorId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as any;
          const compStats = userData.competitionStats?.[cid] || {};

          const wasApproved = postData.status === 'approved' || postData.status === 'synced';
          const viewsGain  = wasApproved ? Math.max(0, (postData.views    || 0) - (postData.viewsBaseline    || 0)) : 0;
          const likesGain  = wasApproved ? Math.max(0, (postData.likes    || 0) - (postData.likesBaseline    || 0)) : 0;
          const commGain   = wasApproved ? Math.max(0, (postData.comments || 0) - (postData.commentsBaseline || 0)) : 0;
          const shrGain    = wasApproved ? Math.max(0, (postData.shares   || 0) - (postData.sharesBaseline   || 0)) : 0;
          const savGain    = wasApproved ? Math.max(0, (postData.saves    || 0) - (postData.savesBaseline    || 0)) : 0;

          const patch: any = {
            // Stats globais mensais
            totalViews:    Math.max(0, (userData.totalViews    || 0) - (postData.views    || 0)),
            totalLikes:    Math.max(0, (userData.totalLikes    || 0) - (postData.likes    || 0)),
            totalComments: Math.max(0, (userData.totalComments || 0) - (postData.comments || 0)),
            totalPosts:    Math.max(0, (userData.totalPosts    || 0) - 1),
            // Stats diários globais (só se o post contava para o diário)
            dailyViews:    Math.max(0, (userData.dailyViews    || 0) - viewsGain),
            dailyLikes:    Math.max(0, (userData.dailyLikes    || 0) - likesGain),
            dailyComments: Math.max(0, (userData.dailyComments || 0) - commGain),
            dailyShares:   Math.max(0, (userData.dailyShares   || 0) - shrGain),
            dailySaves:    Math.max(0, (userData.dailySaves    || 0) - savGain),
            dailyPosts:    Math.max(0, (userData.dailyPosts    || 0) - (wasApproved ? 1 : 0)),
            // Stats da competição
            [`competitionStats.${cid}.views`]:    Math.max(0, (compStats.views    || 0) - (postData.views    || 0)),
            [`competitionStats.${cid}.likes`]:    Math.max(0, (compStats.likes    || 0) - (postData.likes    || 0)),
            [`competitionStats.${cid}.comments`]: Math.max(0, (compStats.comments || 0) - (postData.comments || 0)),
            [`competitionStats.${cid}.posts`]:    Math.max(0, (compStats.posts    || 0) - 1),
            // Stats diários da competição
            [`competitionStats.${cid}.dailyViews`]:    Math.max(0, (compStats.dailyViews    || 0) - viewsGain),
            [`competitionStats.${cid}.dailyLikes`]:    Math.max(0, (compStats.dailyLikes    || 0) - likesGain),
            [`competitionStats.${cid}.dailyComments`]: Math.max(0, (compStats.dailyComments || 0) - commGain),
            [`competitionStats.${cid}.dailyPosts`]:    Math.max(0, (compStats.dailyPosts    || 0) - (wasApproved ? 1 : 0)),
          };

          await updateDoc(userRef, patch);
        }
      }

      // 3. Recálculo completo em background para consistência final
      updateUserMetrics(authorId).catch(() => {});

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

  const handleDeleteAllDuplicates = async () => {
    if (!user || user.role !== 'admin') return;
    
    setNotification({ message: 'Iniciando limpeza de duplicados...', type: 'success' });
    
    try {
      // 1. Agrupar posts por url normalizada em tempo real (ignorando banco legado)
      const groups: Record<string, Post[]> = {};
      posts.forEach(p => {
        const norm = normalizeUrl(p.url);
        if (!norm) return;
        if (!groups[norm]) groups[norm] = [];
        groups[norm].push(p);
      });

      const duplicateGroups = Object.values(groups).filter(g => g.length > 1);
      if (duplicateGroups.length === 0) {
        setNotification({ message: 'Nenhum link duplicado encontrado!', type: 'success' });
        return;
      }

      const affectedUserIds = new Set<string>();
      let deletedCount = 0;

      for (const group of duplicateGroups) {
        // Ordenar por timestamp e manter o mais antigo
        const sorted = [...group].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const [keep, ...toDelete] = sorted;

        for (const post of toDelete) {
          // Marca como deletado no Firestore
          await updateDoc(doc(db, 'posts', post.id), { status: 'deleted' });
          affectedUserIds.add(post.userId);
          deletedCount++;
        }
      }

      // 2. Recalcular métricas de todos os usuários afetados
      for (const uid of Array.from(affectedUserIds)) {
        await updateUserMetrics(uid);
      }

      // 3. Reparo final opcional
      await repairAllUserMetrics().catch(console.error);

      setNotification({ 
        message: `Limpeza concluída! ${deletedCount} posts duplicados foram removidos e os rankings atualizados.`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Erro na limpeza de duplicados:', error);
      setNotification({ message: 'Erro fatal durante a limpeza de duplicados.', type: 'error' });
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

  const handleApproveAsMonthly = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (!window.confirm('Enviar diretamente para Ressincronização (Mensal)?\n\nEste link NÃO contará no ranking Diário — apenas no Mensal/Geral.')) return;
    try {
      await updateDoc(doc(db, 'posts', postId), {
        status: 'synced',
        forceMonthly: true,
        approvedAt: Date.now()
      });
      if (post) await updateUserMetrics(post.userId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
    }
  };
  const handleMovePostToCompetition = async (postId: string, newCompId: string) => {
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) return;
      const postData = postSnap.data() as Post;
      const oldCompId = postData.competitionId;

      if (oldCompId === newCompId) return;

      // 1. Atualiza a competição no post
      await updateDoc(postRef, { competitionId: newCompId });

      // 2. Dispara recálculo de métricas para o usuário em ambas as competições
      await updateUserMetrics(postData.userId);
      
      setNotification({ message: 'Vídeo movido para a nova competição!', type: 'success' });
    } catch (error) {
      console.error('Erro ao mover post:', error);
      setNotification({ message: 'Erro ao mover o vídeo entre competições.', type: 'error' });
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
      message: `Isso calculará os vencedores do Dia e o Top 1 Insta para esta COMPETIÇÃO ESPECáFICA, adicionará os prêmios ao Saldo, registrará as transações e zerará as estatísticas diárias DESTA COMPETIÇÃO. Deseja prosseguir?`,
      onConfirm: async () => {
        try {
          const cid = targetComp.id;
          
          // --- LÓGICA V3: RESET MANUAL ABSOLUTO ---
          // Filtra usuários que possuem estatísticas diárias para ESTA competição
          const dailyViewWinners = [...approvedUsers]
            .filter(u => (u.competitionStats?.[cid]?.dailyViews || 0) > 0)
            .sort((a, b) => (b.competitionStats?.[cid]?.dailyViews || 0) - (a.competitionStats?.[cid]?.dailyViews || 0))
            .slice(0, targetComp.prizesDaily?.length || 10);

          const quantityWinner = [...approvedUsers]
            .filter(u => (u.competitionStats?.[cid]?.dailyPosts || 0) > 0)
            .sort((a, b) => {
              const statsA = a.competitionStats?.[cid];
              const statsB = b.competitionStats?.[cid];
              if (!statsA || !statsB) return 0;
              return (statsB.dailyPosts || 0) - (statsA.dailyPosts || 0) || (statsB.dailyViews || 0) - (statsA.dailyViews || 0);
            })[0];

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
                desc: `PRÃÅ MIO DIÁRIO ${targetComp.title.toUpperCase()} (${i + 1}º LUGAR)${bonusFromViews > 0 ? ' + Bá€NUS' : ''}`
              };
            }
          });

          if (quantityWinner && targetComp.prizesInstagram?.[0]) {
            const prize = targetComp.prizesInstagram[0].value || 0;
            const existing = balanceIncrements[quantityWinner.uid];
            if (existing) {
              existing.amount += prize;
              if (!existing.desc.includes('+ Bá€NUS')) {
                existing.desc += ' + Bá€NUS';
              }
            } else {
              balanceIncrements[quantityWinner.uid] = {
                amount: prize,
                desc: `PRÃÅ MIO QUANTIDADE ${targetComp.title.toUpperCase()} + Bá€NUS`
              };
            }
          }

          console.log('--- RESET DAILY RANKING LOG (ACTION BASED) ---');
          console.log('Target Competition:', targetComp.title);
          console.log('Daily View Winners:', dailyViewWinners.map(u => ({ name: u.displayName, views: u.competitionStats?.[cid]?.dailyViews })));
          console.log('Quantity Winner:', quantityWinner?.displayName);

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

          // 3. Reset post baselines para TODOS os posts ativos (pois o ciclo acabou)
          const postsToReset = posts.filter(p => p.competitionId === cid && (p.status === 'approved' || p.status === 'synced'));
          postsToReset.forEach(p => {
            batch.update(doc(db, 'posts', p.id), {
              viewsBaseline: p.views || 0,
              likesBaseline: p.likes || 0,
              commentsBaseline: p.comments || 0,
              sharesBaseline: p.shares || 0,
              savesBaseline: p.saves || 0
            });
          });

          // 4. Update competition reset timestamp - Marcar o agora como início do novo ciclo
          const resetTime = Date.now();
          batch.update(doc(db, 'competitions', cid), { lastDailyReset: resetTime });

          await batch.commit();
          if (Object.keys(balanceIncrements).length === 0) {
            const msg = dailyViewWinners.length === 0 
                ? 'Nenhum usuário com visualizações diárias registradas.' 
                : 'Nenhum prêmio configurado nesta competição.';
            alert(`âÅ¡Â Ã¯Â¸Â Reset realizado sem premiações:\n\n${msg}\n\nEstatísticas diárias foram zeradas mesmo assim.`);
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
      title: 'âÅ¡Â Ã¯Â¸Â ZERAR GERAL (RESSINCRONIZAR)',
      message: 'Este procedimento zerará as estatísticas de TODOS os usuários e posts, mas MANTERÁ o status atual dos links. Os vídeos processados continuarão na aba de RESSINCRONIZAÇÃO, permitindo que você inicie uma nova coleta do zero com total controle. Deseja prosseguir?',
      onConfirm: async () => {
        try {
          let batch = writeBatch(db);
          let count = 0;

          // 1. Reset all posts (metrics to 0, status is PRESERVED)
          const postsSnap = await getDocs(collection(db, 'posts'));
          for (const postDoc of postsSnap.docs) {
            batch.update(postDoc.ref, {
              views: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              saves: 0
              // status: 'approved' REMOVIDO PARA MANTER NA ABA DE RESSINCRONIZAÇÃO
            });
            count++;
            if (count >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }

          // 2. Reset all users (stats to 0 but PRESERVE balance and paidTotal in competitionStats)
          const usersSnap = await getDocs(collection(db, 'users'));
          for (const uDoc of usersSnap.docs) {
            const userData = uDoc.data();
            const existingStats = userData.competitionStats || {};
            const newStats: any = {};
            
            // Rebuild stats preserving financial data
            Object.keys(existingStats).forEach(cid => {
              newStats[cid] = {
                ...existingStats[cid],
                views: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: 0,
                dailyViews: 0, dailyLikes: 0, dailyComments: 0, dailyShares: 0, dailySaves: 0, dailyPosts: 0, dailyInstaPosts: 0,
                // Ensure financial fields are kept as they are
                balance: existingStats[cid].balance || 0,
                paidTotal: existingStats[cid].paidTotal || 0,
                paidHistory: existingStats[cid].paidHistory || []
              };
            });

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
              competitionStats: newStats
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

          alert('✅ Rankings resetados com sucesso! Os vídeos foram liberados para nova sincronização.');
        } catch (error) {
          console.error('Error during ranking reset:', error);
          alert('Erro ao resetar rankings. Veja o console.');
        }
      }
    });
  };

  const handleResetRankingSimple = async (compId: string) => {
    const targetComp = competitions.find(c => c.id === compId);
    if (!targetComp) {
      alert('Selecione uma competição!');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: '⚠️ LIMPAR RANKING (RESSINCRONIZAR)',
      message: `Deseja ZERAR apenas os contadores (views, likes, etc) da competição "${targetComp.title}"? \n\nIsso limpará os rankings DIÁRIO e MENSAL desta competição específica para você poder ressincronizar do zero. Nada mais será alterado.`,
      onConfirm: async () => {
        try {
          let batch = writeBatch(db);
          let count = 0;

          // 1. Reset metrics in posts of this competition
          const postsToReset = posts.filter(p => p.competitionId === compId);
          for (const p of postsToReset) {
            batch.update(doc(db, 'posts', p.id), {
              views: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              saves: 0,
              viewsBaseline: 0,
              likesBaseline: 0,
              commentsBaseline: 0,
              sharesBaseline: 0,
              savesBaseline: 0
            });
            count++;
            if (count >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }

          // 2. Reset user competitionStats for this comp
          const approvedUsersSnapshot = await getDocs(query(collection(db, 'users'), where('isApproved', '==', true)));
          for (const uDoc of approvedUsersSnapshot.docs) {
            const userData = uDoc.data();
            if (userData.competitionStats?.[compId]) {
              batch.update(uDoc.ref, {
                [`competitionStats.${compId}.views`]: 0,
                [`competitionStats.${compId}.likes`]: 0,
                [`competitionStats.${compId}.comments`]: 0,
                [`competitionStats.${compId}.shares`]: 0,
                [`competitionStats.${compId}.saves`]: 0,
                [`competitionStats.${compId}.dailyViews`]: 0,
                [`competitionStats.${compId}.dailyLikes`]: 0,
                [`competitionStats.${compId}.dailyComments`]: 0,
                [`competitionStats.${compId}.dailyShares`]: 0,
                [`competitionStats.${compId}.dailySaves`]: 0,
                [`competitionStats.${compId}.dailyPosts`]: 0,
              });
              count++;
              if (count >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
              }
            }
          }

          if (count > 0) {
            await batch.commit();
          }

          alert('á¢Ã…â€œÃ‚Â¨ Ranking da competição limpo com sucesso! Agora você pode ressincronizar os vídeos.');
        } catch (error: any) {
          console.error('Error clearing ranking:', error);
          alert('Erro ao limpar ranking: ' + error.message);
        }
      }
    });
  };



  const handleSystemCleanup = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Ã°Å¸Å¡Â¨ LIMPEZA GERAL DO SISTEMA - PERIGO',
      message: 'VOCÃÅ  TEM CERTEZA? Esta operação apagará permanentemente TODOS OS LINKS, TRANSAÇÕES, REGISTROS E SALDOS. Esta ação não pode ser desfeita. Apenas os usuários e suas permissões serão mantidos.',
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

          // 7. Reset competitions lastDailyReset to now - Anchor to 20:00
          const resetAnchor = new Date();
          resetAnchor.setHours(20, 0, 0, 0);
          const compsSnap = await getDocs(collection(db, 'competitions'));
          compsSnap.docs.forEach(cDoc => {
            batch.update(cDoc.ref, { lastDailyReset: resetAnchor.getTime() });
          });

          await batch.commit();
          alert('á°Ã…Â¸ââ‚¬ÂÃ‚Â¥á°Ã…Â¸ââ‚¬ÂÃ‚Â¥á°Ã…Â¸ââ‚¬ÂÃ‚Â¥ SISTEMA FOI RESETADO COM SUCESSO! Todos os dados foram limpos.');
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
        requiredHashtags: compRequiredHashtags.split(/[\n,]+/).map(h => h.trim().replace(/^#/, '')).filter(Boolean),
        requiredHashtagsYouTube: compReqHashtagsYouTube.split(/[\n,]+/).map(h => h.trim().replace(/^#/, '')).filter(Boolean),
        requiredMentions: compRequiredMentions.split(/[\n,]+/).map(m => m.trim().replace(/^@/, '')).filter(Boolean),
        requiredMentionsTikTok: compReqTikTok.split(/[\n,]+/).map(m => m.trim().replace(/^@/, '')).filter(Boolean),
        requiredMentionsYouTube: compReqYouTube.split(/[\n,]+/).map(m => m.trim().replace(/^@/, '')).filter(Boolean),
        requiredMentionsInstagram: compReqInsta.split(/[\n,]+/).map(m => m.trim().replace(/^@/, '')).filter(Boolean),
        dailyResetTime: compDailyResetTime,
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

      console.log('Salvando dados da competição:', compData);

      if (editingCompId) {
        await updateDoc(doc(db, 'competitions', editingCompId), compData);
        setNotification({ message: 'Competição atualizada com sucesso!', type: 'success' });
      } else {
        await addDoc(collection(db, 'competitions'), compData);
        setNotification({ message: 'Competição criada com sucesso!', type: 'success' });
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
      setCompRequiredHashtags('');
      setCompReqHashtagsYouTube('');
      setCompRequiredMentions('');
      setCompReqTikTok('');
      setCompReqYouTube('');
      setCompReqInsta('');
      setCompDailyResetTime('20:00');
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
    setCompRequiredHashtags((comp as any).requiredHashtags?.join(', ') || '');
    setCompReqHashtagsYouTube((comp as any).requiredHashtagsYouTube?.join(', ') || '');
    setCompRequiredMentions((comp as any).requiredMentions?.join(', ') || '');
    setCompReqTikTok((comp as any).requiredMentionsTikTok?.join(', ') || '');
    setCompReqYouTube((comp as any).requiredMentionsYouTube?.join(', ') || '');
    setCompReqInsta((comp as any).requiredMentionsInstagram?.join(', ') || '');
    setCompDailyResetTime(comp.dailyResetTime || '20:00');
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
      if (editRole === 'admin') {
        setPendingRoleAction({ type: 'EDIT', role: 'admin' });
        setShowRoleChallenge(true);
        return;
      }

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
  
  const handleUpdateSuggestionResponse = async (id: string, adminResponse: string) => {
    try {
      await updateDoc(doc(db, 'suggestions', id), { 
        adminResponse: adminResponse.trim(),
        respondedAt: Date.now()
      });
      alert('Resposta enviada com sucesso!');
    } catch (error) {
      console.error('Error responding to suggestion:', error);
      alert('Erro ao enviar resposta.');
    }
  };

  const handleUpdateUserRole = async (uid: string, role: UserRole, skipCheck = false) => {
    try {
      if (role === 'admin' && !skipCheck) {
        setPendingRoleAction({ type: 'UPDATE', uid, role });
        setShowRoleChallenge(true);
        return;
      }

      await updateDoc(doc(db, 'users', uid), { role });
      alert('Cargo do usuário atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Erro ao mudar cargo!');
    }
  };

  const handleConfirmRoleChallenge = async () => {
    if (!pendingRoleAction) return;

    const masterKey = settings.masterAdminKey || 'METARAYX2024';
    if (roleChallengeInput !== masterKey) {
      alert('Palavra-chave incorreta! Acesso negado.');
      setRoleChallengeInput('');
      return;
    }

    try {
      if (pendingRoleAction.type === 'UPDATE' && pendingRoleAction.uid) {
        await handleUpdateUserRole(pendingRoleAction.uid, pendingRoleAction.role, true);
      } else if (pendingRoleAction.type === 'EDIT' && editingUser) {
        const updates: any = { displayName: editName, role: editRole };
        if (editPass) updates.password = editPass;
        await updateDoc(doc(db, 'users', editingUser.uid), updates);
        setEditingUser(null);
        alert('Usuário promovido a ADMINISTRADOR com sucesso!');
      }
    } catch (error) {
      console.error('Role Challenge Error:', error);
      alert('Erro crítico ao processar alteração de cargo.');
    } finally {
      setShowRoleChallenge(false);
      setRoleChallengeInput('');
      setPendingRoleAction(null);
    }
  };

  const handleUpdateMasterKey = async (newKey: string) => {
    if (!newKey.trim()) {
      alert('A palavra-chave não pode ser vazia.');
      return;
    }
    try {
      await updateDoc(doc(db, 'config', 'settings'), { masterAdminKey: newKey.trim() });
      alert('âÅ“â€¦ Palavra-chave mestra atualizada com sucesso!');
    } catch (error: any) {
      alert(`âÂÅ’ Erro ao atualizar palavra-chave: ${error.message}`);
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
          <div className="flex flex-col h-full p-6 overflow-y-auto">
            <div className="flex items-center gap-3 mb-8 shrink-0">
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
                <NavItem 
                  active={view === 'ADMIN'} 
                  onClick={() => setView('ADMIN')} 
                  icon={<ShieldCheck />} 
                  badgeCount={
                    posts.filter(p => p.status === 'pending').length + 
                    pendingUsers.length + 
                    posts.filter(p => p.status === 'removal_requested').length
                  }
                  label={
                    user.role === 'admin' ? "Diretoria" :
                      user.role === 'administrativo' ? "Administrativo" : "Gestão"
                  } 
                />
              )}
              <NavItem active={view === 'SETTINGS'} onClick={() => setView('SETTINGS')} icon={<SettingsIcon />} label="Configurações" />

              <div className="pt-2">
                <NavItem 
                  active={view === 'SUGGESTIONS'} 
                  onClick={() => setView('SUGGESTIONS')} 
                  icon={<MessageSquare />} 
                  label="Sugestões" 
                  badgeCount={suggestions.length}
                />
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
          <header className="h-20 glass border-b border-zinc-800/50 flex items-center justify-between px-6 lg:px-10 shrink-0 z-50">
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

            <div className="flex items-center gap-6">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-2.5 rounded-xl transition-all relative group ${showNotifications ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-900/50 text-zinc-400 hover:text-amber-500'}`}
                >
                  <Bell className="w-5 h-5" />
                  {notificationList.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-black"
                    >
                      {notificationList.length}
                    </motion.span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotifications && (
                    <>
                      <div 
                        className="fixed inset-0 z-[140]" 
                        onClick={() => setShowNotifications(false)} 
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-4 w-80 glass border border-zinc-800 rounded-[32px] shadow-2xl p-6 z-[150] overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Notificações</h4>
                          {notificationList.length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-bold uppercase">Novas</span>
                          )}
                        </div>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar -mr-2 pr-2">
                          {notificationList.length === 0 ? (
                            <div className="py-10 text-center space-y-3">
                              <div className="w-12 h-12 bg-zinc-900/50 rounded-2xl flex items-center justify-center mx-auto">
                                <Check className="w-6 h-6 text-zinc-700" />
                              </div>
                              <p className="text-xs font-bold text-zinc-600">Nenhum aviso novo por aqui!</p>
                            </div>
                          ) : (
                            notificationList.map(item => (
                              <motion.div
                                key={item.id}
                                layout
                                className={`group rounded-2xl p-4 transition-all border ${
                                  item.type === 'personal' 
                                    ? 'bg-red-500/5 border-red-500/10 hover:bg-red-500/10' 
                                    : 'bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10'
                                }`}
                              >
                                <div className="flex gap-3">
                                  <div className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center ${
                                    item.type === 'personal' ? 'bg-red-500/20' : 'bg-amber-500/20'
                                  }`}>
                                    {item.type === 'personal' ? (
                                      <ShieldAlert className="w-4 h-4 text-red-500" />
                                    ) : (
                                      <Bell className="w-4 h-4 text-amber-500" />
                                    )}
                                  </div>
                                  <div className="space-y-1 flex-1">
                                    <div className="flex items-center justify-between">
                                      <h5 className={`text-[11px] font-black uppercase tracking-tight ${
                                        item.type === 'personal' ? 'text-red-500' : 'text-amber-500'
                                      }`}>
                                        {item.title}
                                      </h5>
                                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${
                                        item.type === 'personal' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                                      }`}>
                                        {item.badge}
                                      </span>
                                    </div>
                                    <p className="text-xs font-bold text-zinc-300 leading-relaxed">
                                      {item.message}
                                    </p>
                                    <div className="flex items-center justify-between pt-2">
                                      <span className="text-[9px] font-black text-zinc-600 uppercase">
                                        {item.type === 'personal' ? 'Verifique seus protocolos' : 'Mantenha-se informado'}
                                      </span>
                                      <button
                                        onClick={() => item.type === 'personal' ? handleDismissNotification(item.id) : handleAcknowledgeAnnouncement(item.id)}
                                        className={`text-[9px] font-black px-2 py-1 rounded-lg transition-colors ${
                                          item.type === 'personal' ? 'bg-red-500 text-white hover:bg-red-600' : 'gold-bg text-black hover:scale-105'
                                        }`}
                                      >
                                        OK, ENTENDI
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

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
                      RankingsComponent={Rankings}
                      PostSubmitComponent={PostSubmit}
                      onDelete={handleDeletePost}
                      onRemove={setRemovalModal}
                      isAdmin={isAdmin}
                      allCompetitions={competitions}
                      setShowConfirmModal={setShowConfirmModal}
                      setProtocolCount={setProtocolCount}
                      setConfirmCallback={setConfirmCallback}
                      setGlobalSelectedCompId={setSelectedActiveCompId}
                    />
                  )
                )}
                {view === 'HISTORY' && (
                  <HistoryView 
                    posts={posts.filter(p => isAdmin || p.userId === user.uid)} 
                    competitions={competitions}
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
                    handleUpdateSuggestionResponse={handleUpdateSuggestionResponse}
                    handleUpdateUserRole={handleUpdateUserRole}
                    handleApproveRemoval={handleApproveRemoval}
                    handleRejectRemoval={handleRejectRemoval}
                    handleRankingResetOnly={handleRankingResetOnly}
                    handleResetRankingSimple={handleResetRankingSimple}
                    handleUpdateMasterKey={handleUpdateMasterKey}
                    showRoleChallenge={showRoleChallenge}
                    setShowRoleChallenge={setShowRoleChallenge}
                    roleChallengeInput={roleChallengeInput}
                    setRoleChallengeInput={setRoleChallengeInput}
                    pendingRoleAction={pendingRoleAction}
                    setPendingRoleAction={setPendingRoleAction}
                    handleConfirmRoleChallenge={handleConfirmRoleChallenge}
                    suggestions={suggestions}
                    sessionSyncedIds={sessionSyncedIds}
                    setSessionSyncedIds={setSessionSyncedIds}
                    syncing={syncing}
                    setSyncing={setSyncing}
                    syncProgress={syncProgress}
                    setSyncProgress={setSyncProgress}
                    syncTotal={syncTotal}
                    setSyncTotal={setSyncTotal}
                    syncingPostId={syncingPostId}
                    setSyncingPostId={setSyncingPostId}
                    syncingCompId={syncingCompId}
                    setSyncingCompId={setSyncingCompId}
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
                    compRequiredHashtags={compRequiredHashtags}
                    setCompRequiredHashtags={setCompRequiredHashtags}
                    compReqHashtagsYouTube={compReqHashtagsYouTube}
                    setCompReqHashtagsYouTube={setCompReqHashtagsYouTube}
                    compRequiredMentions={compRequiredMentions}
                    setCompRequiredMentions={setCompRequiredMentions}
                    compDailyResetTime={compDailyResetTime}
                    setCompDailyResetTime={setCompDailyResetTime}
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
                    handleDeleteAllDuplicates={handleDeleteAllDuplicates}
                    rejectionReason={rejectionReason}
                    setRejectionReason={setRejectionReason}
                    setRejectionModal={setRejectionModal}
                    apifyKeySync={apifyKeySync}
                    setApifyKeySync={setApifyKeySync}
                    handleApproveAsMonthly={handleApproveAsMonthly}
                    handleMovePostToCompetition={handleMovePostToCompetition}
                    pendingMoves={pendingMoves}
                    setPendingMoves={setPendingMoves}
                    compRequiredMentionsTikTok={compReqTikTok}
                    setCompRequiredMentionsTikTok={setCompReqTikTok}
                    compRequiredMentionsYouTube={compReqYouTube}
                    setCompRequiredMentionsYouTube={setCompReqYouTube}
                    compRequiredMentionsInsta={compReqInsta}
                    setCompRequiredMentionsInsta={setCompReqInsta}
                    setShowConfirmModal={setShowConfirmModal}
                    setProtocolCount={setProtocolCount}
                    setConfirmCallback={setConfirmCallback}
                    setGlobalSelectedCompId={setSelectedActiveCompId}
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
                    handleUpdateSuggestionResponse={handleUpdateSuggestionResponse}
                    suggestions={suggestions}
                    userRole={user.role}
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
                  SIM, EXCLUIR VáDEO
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
      {/* Final Verification Modal (Premium) */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmModal(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-lg glass p-10 rounded-[45px] border border-zinc-800 shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/5 blur-[80px] rounded-full" />
              
              <div className="relative space-y-8 text-center">
                <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-amber-500 to-yellow-300 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-amber-500/20 rotate-6 hover:rotate-0 transition-transform duration-500">
                  <ShieldCheck className="w-12 h-12 text-black" />
                </div>

                <div className="space-y-4">
                  <h3 className="text-4xl font-black tracking-tighter text-white uppercase italic">
                    Verificação Final
                  </h3>
                  <div className="h-1 w-16 bg-amber-500 mx-auto rounded-full" />
                </div>
                
                <p className="text-zinc-400 font-bold text-sm leading-relaxed px-2">
                  Você confirma que {protocolCount > 1 ? `estes ${protocolCount} links pertencem` : 'este link pertence'} <span className="text-white underline decoration-amber-500/50 underline-offset-4">de fato</span> á  competição:
                  <span className="text-white text-xl block mt-3 font-black tracking-tighter bg-zinc-900 py-3 rounded-2xl border border-zinc-800 shadow-inner">
                    {competitions.find(c => c.id === selectedActiveCompId)?.title || "a esta competição"}
                  </span>
                </p>
                
                <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">
                  Certifique-se antes de continuar. Envios incorretos não serão validados.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-8">
                <button
                  onClick={() => {
                    if (confirmCallback) {
                      confirmCallback();
                      setConfirmCallback(null);
                    }
                  }}
                  className="w-full py-5 gold-bg text-black font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(245,158,11,0.2)]"
                >
                  <CheckCircle2 className="w-6 h-6" />
                  CONFIRMAR E PROTOCOLAR
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full py-5 bg-zinc-900/50 text-zinc-500 font-black rounded-2xl hover:text-white hover:bg-zinc-800 transition-all uppercase text-[10px] tracking-widest"
                >
                  AINDA NÃO, VOU REVISAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
};












const PostSubmit = ({ user, competitions, registrations, setView, lockedCompetitionId, setShowConfirmModal, setProtocolCount, setConfirmCallback, setAppSelectedCompId }: {
  user: User,
  competitions: Competition[],
  registrations: CompetitionRegistration[],
  setView: (view: 'DASHBOARD' | 'RANKINGS' | 'POST' | 'HISTORY' | 'ADMIN' | 'SETTINGS' | 'WALLET' | 'SUGGESTIONS' | 'COMPETITIONS') => void,
  lockedCompetitionId?: string,
  setShowConfirmModal: (v: boolean) => void,
  setProtocolCount: (v: number) => void,
  setConfirmCallback: (v: any) => void,
  setAppSelectedCompId: (v: string | null) => void
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
      setAppSelectedCompId(approvedCompetitions[0].id);
    }
  }, [approvedCompetitions, selectedCompId, setAppSelectedCompId]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    if (!selectedCompId) {
      setError('Por favor, selecione uma competição.');
      return;
    }

    const rawUrls = url.split(/[\n,]+/).map(u => u.trim()).filter(u => u.length > 5);
    if (rawUrls.length === 0) return;

    setProtocolCount(rawUrls.length);
    setAppSelectedCompId(selectedCompId);
    setConfirmCallback(() => handlePerformSubmit);
    setShowConfirmModal(true);
  };

  const handlePerformSubmit = async () => {
    setShowConfirmModal(false);
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
        if (platform === 'tiktok' && (u.includes('vt.tiktok.com') || u.includes('vm.tiktok.com'))) {
          setError(`Link encurtado não permitido: "${singleUrl}"\n\nComo resolver: Cole esse link no navegador do celular ou computador. Quando a página abrir, copie o link completo que aparece na barra de endereço (ex: tiktok.com/@usuario/video/123...) e use esse link aqui.`);
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
            {Array.from(new Set(
              (platform === 'tiktok' ? (Array.isArray(user.tiktok) ? user.tiktok : (user.tiktok ? [user.tiktok] : [])) :
              platform === 'instagram' ? (Array.isArray(user.instagram) ? user.instagram : (user.instagram ? [user.instagram] : [])) :
              (Array.isArray(user.youtube) ? user.youtube : (user.youtube ? [user.youtube] : [])))
              .filter(Boolean)
              .map(h => h.trim())
            )).map((handle) => (
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

      <div className="p-8 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-5 shadow-[0_0_40px_rgba(245,158,11,0.05)] relative overflow-hidden group mb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
        <AlertCircle className="w-8 h-8 text-amber-500 shrink-0 transform group-hover:rotate-12 transition-transform duration-500" />
        <div className="space-y-3 relative z-10">
          <h3 className="text-lg font-black text-amber-500 uppercase tracking-widest leading-none">
            AVISO CRÍTICO: REGRAS DE POSTAGEM!
          </h3>
          <p className="text-[13px] font-bold text-zinc-100 leading-relaxed uppercase tracking-tight max-w-2xl">
            COLOQUE AS <span className="text-amber-500 underline decoration-2 underline-offset-4">HASHTAGS E MARCAÇÕES</span> CORRETAMENTE PARA ESTA COMPETIÇÃO. 
            VáDEOS SEM AS OBRIGATORIEDADES OU PRIVADOS SERÃO <span className="text-red-500">REJEITADOS</span>.
          </p>
        </div>
      </div>
      </>
      )}

    </div>
  );
};

// HistoryView agora é um componente modular importado de ./components/HistoryView


const Rankings = ({ rankings, competitions, lockedCompetitionId, userRole }: { rankings: User[], competitions: Competition[], lockedCompetitionId?: string, userRole?: UserRole }) => {
  const rankingRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedCompId, setSelectedCompId] = useState<string>(lockedCompetitionId || (() => {
    const active = competitions?.find(c => c.isActive);
    return active ? active.id : '';
  }));

  const handleDownloadScreenshot = async () => {
    if (!rankingRef.current) return;
    setIsDownloading(true);
    
    try {
      // Pequeno delay para garantir que o DOM esteja pronto
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(rankingRef.current, {
        quality: 0.95,
        backgroundColor: '#000000',
        style: {
          borderRadius: '24px',
          padding: '20px'
        }
      });
      
      const link = document.createElement('a');
      const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      link.download = `Ranking-${rankingType}-${selectedCompetition?.title || 'Metarayx'}-${dateStr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao gerar print:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (lockedCompetitionId) {
      setSelectedCompId(lockedCompetitionId);
    }
  }, [lockedCompetitionId]);

  const [rankingType, setRankingType] = useState<'DAILY' | 'TOTAL' | 'QUANTITY'>('DAILY');

  const selectedCompetition = useMemo(() => 
    competitions?.find(c => c.id === (lockedCompetitionId || selectedCompId)),
    [competitions, selectedCompId, lockedCompetitionId]
  );

  const totalDailyViews = useMemo(() => {
    if (!selectedCompetition) return 0;
    return rankings.reduce((acc, user) => {
      const stats = user.competitionStats?.[selectedCompetition.id];
      if (!stats) return acc;
      return acc + (stats.dailyViews || 0);
    }, 0);
  }, [rankings, selectedCompetition]);

  const formatGoalNumber = (num: number) => {
    return num.toLocaleString('pt-BR');
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
        
        // Mostrar TODOS que tenham pelo menos 1 vídeo na competição, 
        // independentemente do tipo de ranking. Isso garante que o ranking
        // não "suma" com as pessoas se elas ainda não postaram hoje.
        return (stats.posts || 0) > 0 || (stats.views || 0) > 0 || (stats.likes || 0) > 0;
      })
      .sort((a, b) => {
        const statsA = a.competitionStats?.[selectedCompId];
        const statsB = b.competitionStats?.[selectedCompId];
        if (!statsA || !statsB) return 0;

        if (rankingType === 'DAILY') {
          return selectedCompetition?.rankingMetric === 'likes' ? (statsB.dailyLikes || 0) - (statsA.dailyLikes || 0) : (statsB.dailyViews || 0) - (statsA.dailyViews || 0);
        }
        if (rankingType === 'QUANTITY') {
          return (statsB.dailyPosts || 0) - (statsA.dailyPosts || 0) || (statsB.dailyViews || 0) - (statsA.dailyViews || 0);
        }
        return selectedCompetition?.rankingMetric === 'likes' ? (statsB.likes || 0) - (statsA.likes || 0) : (statsB.views || 0) - (statsA.views || 0);
      });
  }, [rankings, selectedCompId, rankingType]);

  const getPrize = (index: number) => {
    if (!selectedCompetition) return 0;
    if (rankingType === 'DAILY') return selectedCompetition.prizesDaily?.[index]?.value || 0;
    if (rankingType === 'QUANTITY') return selectedCompetition.prizesInstagram?.[index]?.value || 0;
    
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

    const isDaily = rankingType === 'DAILY';
    const isQuantity = rankingType === 'QUANTITY';
    const useDailyStats = isDaily || isQuantity;
    
    // No diário e quantidade mostra ganhos de hoje, no mensal mostra totais
    const views = useDailyStats ? (stats.dailyViews || 0) : (stats.views || 0);
    const likes = useDailyStats ? (stats.dailyLikes || 0) : (stats.likes || 0);
    const comments = useDailyStats ? (stats.dailyComments || 0) : (stats.comments || 0);
    const shares = useDailyStats ? (stats.dailyShares || 0) : (stats.shares || 0);
    const saves = useDailyStats ? (stats.dailySaves || 0) : (stats.saves || 0);
    const postCountResult = useDailyStats ? (stats.dailyPosts || 0) : (stats.posts || 0);
    
    // Se for ranking de Instagram, forçamos a contagem para mostrar posts de Insta
    const postCount = postCountResult;
    // Fallback para mostrar total se o diário for zero e não tivermos resetado oficialmente
    const finalPostCount = (isQuantity && postCount === 0 && (stats.posts || 0) > 0 && !selectedCompetition?.lastDailyReset) 
      ? stats.posts 
      : postCount;

    const totalEngagement = likes + comments + shares + saves;
    const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;

    return { views, likes, comments, shares, saves, engagementRate, posts: finalPostCount, instaPosts: finalPostCount };
  };

  const typeLabels: Record<string, string> = {
    DAILY: 'Ranking Diário',
    TOTAL: 'Ranking Mensal',
    QUANTITY: 'Ranking de Quantidade Geral'
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* á¢ââ‚¬Âââ€šÂ¬á¢ââ‚¬Âââ€šÂ¬á¢ââ‚¬Âââ€šÂ¬ Informações da Competição (Timer + Meta) á¢ââ‚¬Âââ€šÂ¬á¢ââ‚¬Âââ€šÂ¬á¢ââ‚¬Âââ€šÂ¬ */}
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

      {/* á¢ââ‚¬Âââ€šÂ¬á¢ââ‚¬Âââ€šÂ¬á¢ââ‚¬Âââ€šÂ¬ Barra de Controle Unificada á¢ââ‚¬Âââ€šÂ¬á¢ââ‚¬Âââ€šÂ¬á¢ââ‚¬Âââ€šÂ¬ */}
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
            { key: 'QUANTITY', label: 'Quantidade Geral', icon: <Camera className="w-3 h-3" /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setRankingType(tab.key as any)}
              className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 whitespace-nowrap ${
                rankingType === tab.key
                  ? tab.key === 'QUANTITY'
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/20 shadow-sm'
                    : 'bg-zinc-800 text-white shadow-sm'
                  : tab.key === 'QUANTITY'
                    ? 'text-zinc-500 hover:text-amber-500 hover:bg-amber-500/5'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Somatória de Views Diários */}
        {rankingType === 'DAILY' && selectedCompetition && (
          <div className="hidden md:flex flex-1 items-center justify-center animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Eye className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-500/70 mb-1">Somatória Diária</span>
                <span className="text-lg font-black text-amber-400 tabular-nums leading-none tracking-tight">{totalDailyViews.toLocaleString()} <span className="text-[10px] text-amber-500/50 uppercase tracking-widest">views</span></span>
              </div>
            </div>
          </div>
        )}

        {/* Métrica badge (direita) */}
        <div className="md:ml-auto flex items-center gap-3">
          {rankingType !== 'QUANTITY' && selectedCompetition && (
            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border w-fit ${
              selectedCompetition.rankingMetric === 'likes'
                ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
            }`}>
              {selectedCompetition.rankingMetric === 'likes' ? <Heart className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          ðŸ‘ï¸ POR VIEWS
            </span>
          )}

          {/* Botão de Print EXCLUSIVO ADMIN */}
          {userRole === 'admin' && (
            <button
              onClick={handleDownloadScreenshot}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 font-black text-[10px] hover:text-white hover:border-zinc-500 transition-all rounded-xl disabled:opacity-50"
            >
              {isDownloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              {isDownloading ? 'GERANDO...' : 'BAIXAR IMAGEM'}
            </button>
          )}
        </div>
      </div>

      {/* á¢ââ‚¬Âââ€šÂ¬á¢ââ‚¬Âââ€šÂ¬á¢ââ‚¬Âââ€šÂ¬ Tabela de Ranking á¢ââ‚¬Âââ€šÂ¬á¢ââ‚¬Âââ€šÂ¬á¢ââ‚¬Âââ€šÂ¬ */}
      <div ref={rankingRef} className="space-y-3 relative bg-black/50 p-2 rounded-[2rem]">
        
        {/* Marca d'água oficial apenas para o print (visível sempre ou via CSS específico se preferir) */}
        <div className="flex items-center justify-between px-8 py-2 border-b border-white/5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
              <Trophy className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-black gold-gradient uppercase leading-none">Ranking Oficial</h2>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{typeLabels[rankingType]} • {selectedCompetition?.title}</p>
            </div>
          </div>
        </div>
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
                      <span className="text-[8px] text-zinc-600 uppercase font-black">Posts</span>
                      <span className="text-xs font-black text-zinc-400">{stats.posts}</span>
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
                  <Camera className={`w-4 h-4 ${rankingType === 'QUANTITY' ? 'text-amber-500' : 'text-zinc-400'} mb-1`} />
                  <span className="text-[14px] font-black text-white tabular-nums">{stats.posts}</span>
                  <span className="text-[8px] font-black text-zinc-600 uppercase">Posts</span>
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

  const [adjustmentValue, setAdjustmentValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [processingAdjustment, setProcessingAdjustment] = useState(false);

  const handleManualAdjustment = async (type: 'add' | 'subtract') => {
    const val = parseFloat(adjustmentValue.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Insira um valor válido');
      return;
    }

    const finalAmount = type === 'subtract' ? -val : val;
    setProcessingAdjustment(true);

    try {
      const batch = writeBatch(db);
      
      const newGlobalBalance = Math.max(0, (user.balance || 0) + finalAmount);
      const newCompBalance = Math.max(0, (user.competitionStats?.[compId || '']?.balance || 0) + finalAmount);

      const transRef = doc(collection(db, 'transactions'));
      batch.set(transRef, {
        userId: user.uid,
        amount: finalAmount,
        timestamp: Date.now(),
        status: type === 'subtract' ? 'cancelled' : 'credit',
        type: 'adjustment',
        description: `AJUSTE MANUAL ADMIN (${type === 'subtract' ? 'ESTORNO' : 'Bá€NUS'}): ${compId || 'GERAL'}`,
        competitionId: compId
      });

      const dataToUpdate: any = {
        [`competitionStats.${compId}.balance`]: newCompBalance,
        balance: newGlobalBalance
      };

      const userRef = doc(db, 'users', user.uid);
      batch.update(userRef, dataToUpdate);

      await batch.commit();
      setAdjustmentValue('');
      setIsEditing(false);
    } catch (error: any) {
      console.error('Erro no ajuste manual:', error);
      alert('Erro ao processar ajuste');
    } finally {
      setProcessingAdjustment(false);
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
            CONCLUáDO
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
          <div className="flex items-center gap-2">
            {isEditing ? (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                <input
                  type="text"
                  value={adjustmentValue}
                  onChange={(e) => setAdjustmentValue(e.target.value)}
                  placeholder="0.00"
                  className="w-20 bg-black border border-zinc-800 rounded-lg px-2 py-2 text-[10px] font-black text-white outline-none focus:border-amber-500 transition-all font-mono"
                />
                <button
                  onClick={() => handleManualAdjustment('subtract')}
                  disabled={processingAdjustment}
                  className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5 border border-red-500/20"
                  title="Subtrair do Saldo"
                >
                  {processingAdjustment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MinusCircle className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleManualAdjustment('add')}
                  disabled={processingAdjustment}
                  className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/5 border border-emerald-500/20"
                  title="Adicionar ao Saldo"
                >
                  {processingAdjustment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-2 rounded-lg bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all"
                  title="Cancelar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                disabled={saving}
                className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-500 hover:text-amber-500 hover:border-amber-500/30 transition-all"
                title="Ajustar Saldo Manualmente"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}

            {!isEditing && (
              <button
                onClick={handlePay}
                disabled={saving || balance <= 0}
                className={`px-5 py-2.5 disabled:opacity-30 rounded-2xl font-black text-[10px] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2.5 uppercase tracking-widest min-w-[100px] ${
                  confirming ? 'bg-red-500 text-white animate-pulse' : 'gold-bg text-black shadow-lg shadow-amber-500/10'
                }`}
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : confirming ? <AlertCircle className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                {saving ? 'PAGANDO...' : confirming ? 'CONFIRMAR?' : 'PAGAR'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Componente para exibir uma transação individual no filtro diário
const DailyTransactionRow = ({ transaction, users }: { transaction: Transaction, users: User[] }) => {
  const user = users.find(u => u.uid === transaction.userId);
  return (
    <div className="grid grid-cols-[1.5fr_1fr_1.5fr_150px_220px] gap-4 items-center py-4 px-8 hover:bg-white/[0.02] transition-all group border-b border-zinc-900/50 last:border-0 min-h-[72px]">
      <div className="flex items-center gap-4 min-w-0">
        <div className="shrink-0 relative">
          <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || 'U'}`} className="w-12 h-12 rounded-2xl object-cover border border-zinc-800 shadow-xl" alt="" />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-black flex items-center justify-center">
            <CheckCircle2 className="w-2 h-2 text-black" />
          </div>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-black text-[13px] text-white truncate uppercase tracking-tight leading-tight">{user?.displayName || 'Usuário'}</span>
          <span className="text-zinc-600 text-[9px] font-black uppercase opacity-60 tracking-wider mt-0.5">{new Date(transaction.timestamp).toLocaleTimeString('pt-BR')}</span>
        </div>
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <CreditCard className="w-3 h-3 text-zinc-700" />
          <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest whitespace-nowrap">CHAVE PIX</span>
        </div>
        <span className="font-black text-[10px] text-zinc-400 truncate tracking-tight uppercase select-all">{user?.pixKey || 'NÃO INFORMADA'}</span>
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <Coins className="w-3 h-3 text-emerald-500/50" />
          <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest">VALOR PAGO</span>
        </div>
        <p className="text-[16px] font-black tabular-nums text-emerald-500 tracking-tighter">
          R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="text-center">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
          PAGAMENTO ÚNICO
        </span>
      </div>
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-xl text-[9px] font-black uppercase tracking-widest opacity-60">
          <ShieldCheck className="w-3.5 h-3.5" /> LIQUIDADO
        </div>
      </div>
    </div>
  );
};

const TabBadge = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span className="ml-2 px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center shadow-lg shadow-red-600/20 animate-pulse">
      {count > 99 ? '99+' : count}
    </span>
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
  handleUpdateSuggestionResponse,
  handleUpdateUserRole,
  handleApproveRemoval,
  handleRejectRemoval,
  handleRankingResetOnly,
  handleResetRankingSimple,
  handleUpdateMasterKey,
  showRoleChallenge,
  setShowRoleChallenge,
  roleChallengeInput,
  setRoleChallengeInput,
  pendingRoleAction,
  setPendingRoleAction,
  handleConfirmRoleChallenge,
  suggestions,
  sessionSyncedIds,
  setSessionSyncedIds,
  syncing,
  setSyncing,
  syncProgress,
  setSyncProgress,
  syncTotal,
  setSyncTotal,
  syncingPostId,
  setSyncingPostId,
  syncingCompId,
  setSyncingCompId,
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
  compRequiredHashtags,
  setCompRequiredHashtags,
  compReqHashtagsYouTube,
  setCompReqHashtagsYouTube,
  compRequiredMentions,
  setCompRequiredMentions,
  compDailyResetTime,
  setCompDailyResetTime,
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
  handleDeleteAllDuplicates,
  rejectionReason,
  setRejectionReason,
  setRejectionModal,
  apifyKeySync,
  setApifyKeySync,
  handleApproveAsMonthly,
  handleMovePostToCompetition,
  pendingMoves,
  setPendingMoves,
  compRequiredMentionsTikTok: compReqTikTok,
  setCompRequiredMentionsTikTok: setCompReqTikTok,
  compRequiredMentionsYouTube: compReqYouTube,
  setCompRequiredMentionsYouTube: setCompReqYouTube,
  compRequiredMentionsInsta: compReqInsta,
  setCompRequiredMentionsInsta: setCompReqInsta,
  setShowConfirmModal,
  setProtocolCount,
  setConfirmCallback,
  setGlobalSelectedCompId
}: {
  userRole: UserRole;
  posts: Post[];
  pendingUsers: User[];
  approvedUsers: User[];
  archivedUsers: User[];
  settings: Settings;
  competitions: Competition[];
  registrations: CompetitionRegistration[];
  announcements: Announcement[];
  timerConfig: { enabled: boolean; endTime: number | null; targetTime: string; message: string };
  handleUpdateTimer: (config: any) => Promise<void>;
  onSettingsUpdate: (s: Settings) => void;
  editingCompId: string | null;
  setEditingCompId: (val: string | null) => void;
  setCompToDelete: (val: string | null) => void;
  setPostToDelete: (id: string | null) => void;
  handlePostStatus: (postId: string, status: PostStatus) => void;
  handleUserApproval: (userId: string, isApproved: boolean) => void;
  handleDeleteUser: (userId: string) => void;
  handleArchiveUser: (userId: string, archive: boolean) => void;
  handleRegistrationStatus: (regId: string, status: any) => void;
  handleDeleteRegistration: (regId: string) => void;
  handleResetDailyRanking: (compId?: string) => void;
  handleUpdateCompetitionStatus: (id: string, status: any) => void;
  handleBannerUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCreateCompetition: () => void;
  handleEditCompClick: (comp: Competition) => void;
  handleEditUser: () => void;
  handleCreateAnnouncement: () => void;
  handleDeleteAnnouncement: (id: string) => void;
  handleDeleteSuggestion: (id: string) => void;
  handleUpdateSuggestionStatus: (id: string, status: Suggestion['status']) => void;
  handleUpdateSuggestionResponse: (id: string, response: string) => void;
  handleUpdateUserRole: (uid: string, role: UserRole) => void;
  handleApproveRemoval: (postId: string) => void;
  handleRejectRemoval: (postId: string) => void;
  handleRankingResetOnly: () => void;
  handleResetRankingSimple: (compId: string) => void;
  handleUpdateMasterKey: (newKey: string) => Promise<void>;
  showRoleChallenge: boolean;
  setShowRoleChallenge: (val: boolean) => void;
  roleChallengeInput: string;
  setRoleChallengeInput: (val: string) => void;
  pendingRoleAction: any;
  setPendingRoleAction: (val: any) => void;
  handleConfirmRoleChallenge: () => Promise<void>;
  suggestions: Suggestion[];
  sessionSyncedIds: string[];
  setSessionSyncedIds: (v: any) => void;
  syncing: boolean;
  setSyncing: (v: boolean) => void;
  syncProgress: number;
  setSyncProgress: (v: number) => void;
  syncTotal: number;
  setSyncTotal: (v: number) => void;
  syncingPostId: string | null;
  setSyncingPostId: (v: string | null) => void;
  syncingCompId: string | null;
  setSyncingCompId: (v: string | null) => void;
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
  compRequiredHashtags: string;
  setCompRequiredHashtags: (v: string) => void;
  compReqHashtagsYouTube: string;
  setCompReqHashtagsYouTube: (v: string) => void;
  compRequiredMentions: string;
  setCompRequiredMentions: (v: string) => void;
  compDailyResetTime: string;
  setCompDailyResetTime: (v: string) => void;
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
  setCompPrizes: (v: any[]) => void;
  compPositionsDaily: number;
  setCompPositionsDaily: (v: number) => void;
  compPrizesDaily: { position: number; value: number; label: string }[];
  setCompPrizesDaily: (v: any[]) => void;
  compPositionsMonthly: number;
  setCompPositionsMonthly: (v: number) => void;
  compPrizesMonthly: { position: number; value: number; label: string }[];
  setCompPrizesMonthly: (v: any[]) => void;
  compPositionsInstagram: number;
  setCompPositionsInstagram: (v: number) => void;
  compPrizesInstagram: { position: number; value: number; label: string }[];
  setCompPrizesInstagram: (v: any[]) => void;
  isCreatingComp: boolean;
  setIsCreatingComp: (v: boolean) => void;
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
  handleSystemCleanup: () => void;
  handleDeleteAllDuplicates: () => Promise<void>;
  rejectionReason: string;
  setRejectionReason: (v: string) => void;
  setRejectionModal: (v: any) => void;
  apifyKeySync: string;
  setApifyKeySync: (v: string) => void;
  handleApproveAsMonthly: (postId: string) => Promise<void>;
  handleMovePostToCompetition: (postId: string, newCompId: string) => Promise<void>;
  pendingMoves: Record<string, string>;
  setPendingMoves: (v: any) => void;
  compRequiredMentionsTikTok: string;
  setCompRequiredMentionsTikTok: (v: string) => void;
  compRequiredMentionsYouTube: string;
  setCompRequiredMentionsYouTube: (v: string) => void;
  compRequiredMentionsInsta: string;
  setCompRequiredMentionsInsta: (v: string) => void;
  setShowConfirmModal: (v: boolean) => void;
  setProtocolCount: (v: number) => void;
  setConfirmCallback: (v: any) => void;
  setGlobalSelectedCompId: (v: string | null) => void;
}) => {
  const [tab, setTab] = useState<AdminTab>('VISAO_GERAL');
  const [selectedSyncCompId, setSelectedSyncCompId] = useState<string>('ALL');
  const [selectedResetCompId, setSelectedResetCompId] = useState<string>('');
  const [auditUserId, setAuditUserId] = useState<string | null>(null);
  const [auditDayFilter, setAuditDayFilter] = useState<string>('');
  const [auditHandleFilter, setAuditHandleFilter] = useState<string>('all');
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [apifyKey, setApifyKey] = useState(settings.apifyKey);
  const [financeTab, setFinanceTab] = useState<'RESUMO' | 'PENDING' | 'REALIZED'>('RESUMO');
  const [financeCompId, setFinanceCompId] = useState<string>(() => competitions[0]?.id || '');
  const [financeDateFilter, setFinanceDateFilter] = useState('');
  const [manuallyAddedFinancialUsers, setManuallyAddedFinancialUsers] = useState<string[]>([]);
  const [searchManualUser, setSearchManualUser] = useState('');
  const [showManualUserSelect, setShowManualUserSelect] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'auditor' | 'administrativo' | 'admin'>('user');
  const [creatingUser, setCreatingUser] = useState(false);
  const [syncDetailCompId, setSyncDetailCompId] = useState<string | null>(null);
  const [validatedPostsLocal, setValidatedPostsLocal] = useState<string[]>([]);
  const [realizedPayments, setRealizedPayments] = useState<Transaction[]>([]);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [localTimerEnabled, setLocalTimerEnabled] = useState(timerConfig.enabled);
  const [localTimerTargetTime, setLocalTimerTargetTime] = useState(timerConfig.targetTime);
  const [localTimerEndTime, setLocalTimerEndTime] = useState(timerConfig.endTime);
  const [localTimerMessage, setLocalTimerMessage] = useState(timerConfig.message);

  useEffect(() => {
    // Sincroniza estados locais apenas uma vez ao carregar configurações globais,
    // ou se o administrador resetar explicitamente. Isso evita que a digitação seja sobrescrita pelo snapshot.
    if (!localTimerTargetTime || localTimerTargetTime === '20:15') {
       setLocalTimerEnabled(timerConfig.enabled);
       setLocalTimerTargetTime(timerConfig.targetTime);
       setLocalTimerEndTime(timerConfig.endTime);
       setLocalTimerMessage(timerConfig.message);
    }
  }, [timerConfig]); // Mantemos o objeto inteiro como gatilho, mas com guarda interna.

  const onSaveTimerConfig = async () => {
    try {
      await handleUpdateTimer({
        enabled: localTimerEnabled,
        targetTime: localTimerTargetTime,
        endTime: localTimerEndTime,
        message: localTimerMessage
      });
      alert('Configurações do croná´metro salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar timer:', error);
      alert('Erro ao salvar configurações do croná´metro.');
    }
  };

  const [selectedNetworkUserId, setSelectedNetworkUserId] = useState<string>('all');
  const [selectedResyncPostIds, setSelectedResyncPostIds] = useState<string[]>([]);
  const [selectedSyncPostIds, setSelectedSyncPostIds] = useState<string[]>([]);
  const [selectedAdminHandle, setSelectedAdminHandle] = useState<string>('all');

  const adminHandles = useMemo(() => {
    const handles = new Set<string>();
    posts.forEach(p => {
      if (p.accountHandle) handles.add(p.accountHandle.trim());
    });
    return Array.from(handles).sort();
  }, [posts]);

  const isSameDay = (timestamp: number, dateStr: string) => {
    if (!dateStr) return true;
    const date = new Date(timestamp);
    const filterDate = new Date(dateStr + 'T12:00:00'); // Use mid-day to avoid TZ issues
    return date.getFullYear() === filterDate.getFullYear() &&
           date.getMonth() === filterDate.getMonth() &&
           date.getDate() === filterDate.getDate();
  };

  useEffect(() => {
    if (!financeCompId && competitions.length > 0) {
      setFinanceCompId(competitions[0].id);
    }
  }, [competitions, financeCompId]);

  useEffect(() => {
    const fetchFilteredTransactions = async () => {
      if (tab === 'FINANCEIRO' && financeTab === 'REALIZED' && financeDateFilter && financeCompId) {
        setLoadingFinancials(true);
        try {
          // Busca transações da competição
          const q = query(
            collection(db, 'transactions'), 
            where('competitionId', '==', financeCompId),
            orderBy('timestamp', 'desc')
          );
          const snap = await getDocs(q);
          const allTrans = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
          
          // Filtra manualmente por dia (mais simples que lidar com timestamps complexos no Firestore query)
          const filtered = allTrans.filter(t => isSameDay(t.timestamp, financeDateFilter));
          setRealizedPayments(filtered);
        } catch (e) {
          console.error("Erro fetch transações filtradas", e);
        } finally {
          setLoadingFinancials(false);
        }
      }
    };
    fetchFilteredTransactions();
  }, [tab, financeTab, financeDateFilter, financeCompId]);

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
    return num.toLocaleString('pt-BR');
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

  const approvedPostsCount = useMemo(() => {
    return approvedUsers.reduce((sum, u) => {
      if (!selectedMetaComp) return sum + (u.totalPosts || 0);
      return sum + (u.competitionStats?.[selectedMetaComp.id]?.posts || 0);
    }, 0);
  }, [approvedUsers, selectedMetaComp]);

  const postsToday = useMemo(() => {
    const lastReset = selectedMetaComp?.lastDailyReset || 0;
    
    return posts.filter(p => {
      const isApproved = p.status === 'approved' || p.status === 'synced';
      const isWithinComp = !selectedMetaComp || p.competitionId === selectedMetaComp.id;
      
      const approvedAt = p.approvedAt || p.timestamp || 0;
      const isAfterReset = approvedAt > lastReset;
      const isNewDailyPost = !(p as any).forceMonthly && ((p as any).forceDaily || isAfterReset);

      return isApproved && isWithinComp && isNewDailyPost;
    }).length;
  }, [posts, selectedMetaComp]);

  // Fallback para posts rejeitados (usa o array posts já que não temos contador no perfil)
  // Com o limite aumentado para 10.000, deve ser suficiente para quase todos os casos
  const rejectedPosts = posts.filter(p => 
    p.status === 'rejected' && 
    (!selectedMetaComp || p.competitionId === selectedMetaComp.id)
  );

  const approvalRate = (approvedPostsCount + rejectedPosts.length) > 0
    ? Math.round((approvedPostsCount / (approvedPostsCount + rejectedPosts.length)) * 100)
    : 100;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Estima tendência usando postsToday e a média de 7 dias (baseado em approvedUsers para precisão)
  const postsLast7d = posts.filter(p => p.timestamp > now - 7 * dayMs).length;
  const avgPosts7d = Math.round(postsLast7d / 7);
  const dailyPostTrend = postsToday >= avgPosts7d ? 'up' : 'down';

  const inactiveUsers = approvedUsers.filter(u => {
    const userPosts = posts.filter(p => p.userId === u.uid);
    if (userPosts.length === 0) return true;
    const lastPost = Math.max(...userPosts.map(p => p.timestamp));
    return now - lastPost > 3 * dayMs;
  });

  const userPostAverages = useMemo(() => {
    const currentNow = Date.now();
    
    // First, map each user to their earliest post timestamp to avoid O(N*M) lookups inside the map
    const userFirstPostTime: Record<string, number> = {};
    posts.forEach(p => {
       if (!userFirstPostTime[p.userId] || p.timestamp < userFirstPostTime[p.userId]) {
         userFirstPostTime[p.userId] = p.timestamp;
       }
    });

    return approvedUsers
      .map(u => {
        // Find the timestamp of their first ever post as the true "start" date
        const firstPostTime = userFirstPostTime[u.uid];
        
        // If they have no posts, use current time (0 days active = 0 avg)
        const activeStart = firstPostTime || currentNow;
        
        // Calculate days between first post and now.
        // Math.ceil ensures that if they posted today, it counts as 1 day (not 0).
        // Math.max guarantees we never divide by zero.
        const daysActive = Math.max(1, Math.ceil((currentNow - activeStart) / (24 * 60 * 60 * 1000)));
        
        const avg = (u.totalPosts || 0) / daysActive;
        
        return {
          uid: u.uid,
          displayName: u.displayName,
          photoURL: u.photoURL,
          avgPostsPerDay: avg
        };
      })
      .sort((a, b) => b.avgPostsPerDay - a.avgPostsPerDay);
  }, [approvedUsers, posts]);

  const newUsers7d = approvedUsers.filter(u => u.approvedAt && u.approvedAt > now - 7 * dayMs).length;

  const totalPaidGlobal = approvedUsers.reduce((sum, u) => {
    if (!u.competitionStats) return sum;
    if (selectedMetaComp) {
      return sum + (u.competitionStats[selectedMetaComp.id]?.paidTotal || 0);
    }
    return sum + Object.values(u.competitionStats).reduce((s, st: any) => s + (st.paidTotal || 0), 0);
  }, 0);

  const cpp = approvedPostsCount > 0 ? totalPaidGlobal / approvedPostsCount : 0;

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
    // Fix: Handle Firestore Timestamp or number correctly with TS safety
    const count = posts.filter(p => {
      const ts = p.timestamp as any;
      const pTime = typeof ts === 'number' ? ts : (ts?.toMillis?.() || 0);
      return pTime >= start && pTime < end;
    }).length;
    return {
      day: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase(),
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

      alert(`á¢Ã…â€œââ‚¬Â¦ Acesso criado com sucesso!\n\nNome: ${newUserName}\nCargo: ${newUserRole.toUpperCase()}\nEmail: ${newUserEmail}`);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPass('');
      setNewUserRole('user');
    } catch (e: any) {
      console.error('Erro criar usuário:', e);
      if (e.code === 'auth/email-already-in-use') {
        alert('á¢Ã‚ÂÃ…â€™ Este email já está cadastrado no sistema.');
      } else if (e.code === 'auth/invalid-email') {
        alert('á¢Ã‚ÂÃ…â€™ Email inválido. Verifique o formato.');
      } else if (e.code === 'permission-denied' || e.message?.includes('permission')) {
        alert('á¢Ã‚ÂÃ…â€™ Sem permissão para gravar no banco.\n\nVocê precisa publicar as novas Regras de Segurança no Console do Firebase (aba Segurança do Firestore).');
      } else {
        alert(`á¢Ã‚ÂÃ…â€™ Falha ao criar acesso:\n${e.message}`);
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

    // Trigger confirmation modal for admin too
    setGlobalSelectedCompId(adminManualCompId); // Use the renamed prop to set App state
    setProtocolCount(1);
    setConfirmCallback(() => () => performAdminSubmit(targetUser.uid, targetUser.displayName));
    setShowConfirmModal(true);
  };

  const performAdminSubmit = async (targetUid: string, targetDisplayName: string) => {
    setShowConfirmModal(false);
    setAdminSubmitting(true);
    try {
      const norm = normalizeUrl(adminManualUrl);
      
      // Check for duplicates
      const qNorm = query(collection(db, 'posts'), where('normalizedUrl', 'in', [norm]));
      const snapNorm = await getDocs(qNorm);
      if (!snapNorm.empty) {
        alert('á¢Ã‚ÂÃ…â€™ Este link já existe no sistema!');
        setAdminSubmitting(false);
        return;
      }

      const postId = Math.random().toString(36).substr(2, 9);
      const newPost: Post = {
        id: postId,
        userId: targetUid,
        userName: targetDisplayName,
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
      await updateUserMetrics(targetUid);

      alert('âÅ“â€¦ Link adicionado com sucesso ao perfil de ' + targetDisplayName);
      setAdminManualUrl('');
    } catch (error: any) {
      alert('á¢Ã‚ÂÃ…â€™ Erro ao adicionar link: ' + error.message);
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleSaveApiKey = async () => {
    const trimmedKey = apifyKey.trim();
    if (!trimmedKey) {
      alert('Por favor, insira uma chave antes de salvar.');
      return;
    }
    
    // Evitar duplicatas
    if (settings.apifyKeys?.includes(trimmedKey)) {
      alert('Esta chave já está na lista.');
      return;
    }

    try {
      const newKeys = [...(settings.apifyKeys || []), trimmedKey];
      await updateDoc(doc(db, 'config', 'settings'), { 
        apifyKeys: newKeys,
        apifyKey: trimmedKey // Mantém a última como principal por compatibilidade
      });
      setApifyKey(''); // Limpa o input após adicionar
      alert('á¢Ã…â€œââ‚¬Â¦ Chave API adicionada com sucesso!');
    } catch (error: any) {
      alert(`á¢ Ã…â€™ Erro ao salvar chave: ${error.message}`);
    }
  };

  const handleDeleteApiKey = async (keyToDelete: string) => {
    if (!confirm('Tem certeza que deseja remover esta chave?')) return;
    try {
      const newKeys = (settings.apifyKeys || []).filter(k => k !== keyToDelete);
      await updateDoc(doc(db, 'config', 'settings'), { 
        apifyKeys: newKeys,
        apifyKey: newKeys[0] || '' // Atualiza a principal
      });
      alert('á¢Ã…â€œââ‚¬Â¦ Chave removida.');
    } catch (error: any) {
      alert(`á¢ Ã…â€™ Erro ao remover chave: ${error.message}`);
    }
  };


  const handleSaveSyncKey = async () => {
    const trimmedKey = apifyKeySync.trim();
    if (!trimmedKey) {
      alert('Por favor, insira uma chave antes de salvar.');
      return;
    }
    if (settings.apifyKeysSync?.includes(trimmedKey)) {
      alert('Esta chave já está na lista.');
      return;
    }
    try {
      const newKeys = [...(settings.apifyKeysSync || []), trimmedKey];
      await updateDoc(doc(db, 'config', 'settings'), { apifyKeysSync: newKeys });
      setApifyKeySync('');
      alert('á¢Ã…â€œââ‚¬Â¦ Chave de Sincronização Inicial adicionada!');
    } catch (error: any) {
      alert(`á¢ Ã…â€™ Erro ao salvar chave: ${error.message}`);
    }
  };

  const handleDeleteSyncKey = async (keyToDelete: string) => {
    if (!confirm('Remover esta chave de sincronização inicial?')) return;
    try {
      const newKeys = (settings.apifyKeysSync || []).filter(k => k !== keyToDelete);
      await updateDoc(doc(db, 'config', 'settings'), { apifyKeysSync: newKeys });
      alert('á¢Ã…â€œââ‚¬Â¦ Chave removida.');
    } catch (error: any) {
      alert(`á¢ Ã…â€™ Erro ao remover chave: ${error.message}`);
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
      const res = await repairAllUserMetrics(true);
      alert(`á¢Ã…â€œââ‚¬Â¦ Reparo concluído!\n\nUsuários processados: ${res.total}\nSucesso: ${res.success}\nErros: ${res.error}`);
    } catch (error: any) {
      alert(`Erro no reparo: ${error.message}`);
    } finally {
      setRepairing(false);
    }
  };

  const handleSync = async () => {
    const keys = settings.apifyKeys && settings.apifyKeys.length > 0 ? settings.apifyKeys : [apifyKey];
    if (keys.length === 0 || !keys[0]) {
      alert('Por favor, insira sua chave Apify para sincronizar.');
      return;
    }

    setSyncing(true);
    try {
      // Save key to Firestore if it's the only one
      if (!settings.apifyKeys || settings.apifyKeys.length === 0) {
        await setDoc(doc(db, 'config', 'settings'), { apifyKey });
      }

      await syncViewsWithApify(keys);
      alert('Sincronização concluída com sucesso!');
    } catch (error: any) {
      alert(`Erro na sincronização: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSingleSync = async (post: Post) => {
    const keys = settings.apifyKeys && settings.apifyKeys.length > 0 ? settings.apifyKeys : [apifyKey];
    if (keys.length === 0 || !keys[0]) {
      alert('Por favor, insira sua chave Apify para sincronizar.');
      return;
    }

    setSyncingPostId(post.id);
    try {
      await syncSinglePostWithApify(keys, post, false);
      alert('Sincronização do vídeo concluída!');
    } catch (error: any) {
      alert(`Erro na sincronização: ${error.message}`);
    } finally {
      setSyncingPostId(null);
    }
  };

  const handleSyncApprovedSequentially = async () => {
    // Prioriza chaves exclusivas de sincronização se fornecidas
    const keys = (settings.apifyKeysSync && settings.apifyKeysSync.length > 0)
      ? settings.apifyKeysSync 
      : (settings.apifyKeys && settings.apifyKeys.length > 0 ? settings.apifyKeys : [apifyKey]);

    if (keys.length === 0 || !keys[0]) {
      alert('Configurações de API ausentes.');
      return;
    }

    const approvedPosts = posts.filter(p => p.status === 'approved');
    if (approvedPosts.length === 0) {
      alert('Nenhum vídeo aprovado para sincronizar.');
      return;
    }

    setSyncing(true);
    setSyncTotal(approvedPosts.length);
    setSyncProgress(0);
    setSessionSyncedIds([]);
    
    let completed = 0;
    try {
      for (const post of approvedPosts) {
        setSyncingPostId(post.id);
        await syncSinglePostWithApify(keys, post, false);
        await updateDoc(doc(db, 'posts', post.id), { status: 'synced' });
        await updateUserMetrics(post.userId);
        completed++;
        setSyncProgress(completed);
        setSessionSyncedIds((prev: string[]) => [...prev, post.id]);
      }
      await updateDoc(doc(db, 'config', 'settings'), { lastSync: new Date().toISOString() });
      alert('Sincronização sequencial concluída!');
    } catch (e: any) {
      alert(`Erro na sincronização: ${e.message}`);
    } finally {
      setSyncing(false);
      setSyncingPostId(null);
      setSyncProgress(0);
      setSyncTotal(0);
    }
  };

  const handleSyncApprovedParallel = async () => {
    const syncKeys = settings.apifyKeysSync && settings.apifyKeysSync.length > 0 
      ? settings.apifyKeysSync 
      : (settings.apifyKeys || []);
      
    if (syncKeys.length < 1) {
      alert('Por favor, configure pelo menos uma chave Apify (Rede Social) para sincronização.');
      return;
    }

    const approvedPosts = posts.filter(p => p.status === 'approved');
    if (approvedPosts.length === 0) {
      alert('Nenhum vídeo aprovado para sincronizar.');
      return;
    }

    setSyncing(true);
    setSyncTotal(approvedPosts.length);
    setSyncProgress(0);
    setSessionSyncedIds([]);

    const n = syncKeys.length;
    const groups: Post[][] = Array.from({ length: n }, () => []);
    // Distribuir posts alternadamente para que as chaves não fiquem presas em uma mesma competição extensa
    approvedPosts.forEach((post, i) => groups[i % n].push(post));

    let completed = 0;
    const worker = async (group: Post[], key: string) => {
      for (const post of group) {
        try {
          setSyncingPostId(post.id);
          await syncSinglePostWithApify([key], post, false);
          await updateDoc(doc(db, 'posts', post.id), { status: 'synced' });
          await updateUserMetrics(post.userId);
          completed++;
          setSyncProgress(completed);
          setSessionSyncedIds((prev: string[]) => [...prev, post.id]);
        } catch (err) {
          console.error(`Erro no worker com chave ${key}:`, err);
        }
      }
    };

    try {
      await Promise.all(groups.map((group, i) => worker(group, syncKeys[i])));
      await updateDoc(doc(db, 'config', 'settings'), { lastSync: new Date().toISOString() });
      alert(`Sincronização Multi-Sync (${n} chaves) concluída com sucesso!`);
    } catch (e: any) {
      alert('Erro na sincronização paralela: ' + e.message);
    } finally {
      setSyncing(false);
      setSyncingPostId(null);
      setSyncProgress(0);
      setSyncTotal(0);
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
    const keys = settings.apifyKeys && settings.apifyKeys.length > 0 ? settings.apifyKeys : [apifyKey];
    if (keys.length === 0 || !keys[0]) {
      alert('Por favor, insira sua chave Apify para sincronizar.');
      return;
    }

    const allSyncedPosts = posts.filter(p => p.status === 'synced');
    const syncedPosts = allSyncedPosts.filter(p => !sessionSyncedIds.includes(p.id));

    if (syncedPosts.length === 0) {
      if (allSyncedPosts.length > 0) {
        alert('Todos os posts já foram conferidos nesta sessão! Liberando todos os vídeos para uma nova ressincronização completa.');
        setSessionSyncedIds([]);
        setSyncProgress(0);
        setSyncTotal(0);
      } else {
        alert('Nenhum vídeo sincronizado para ressincronizar.');
      }
      return;
    }

    setSyncing(true);
    let current = sessionSyncedIds.length;
    setSyncProgress(current);
    setSyncTotal(allSyncedPosts.length);
    try {
      for (const post of syncedPosts) {
        setSyncingPostId(post.id);
        await syncSinglePostWithApify(keys, post, false);
        setSessionSyncedIds((prev: string[]) => [...prev, post.id]);
        current++;
        setSyncProgress(current);
      }
      // Update last resync timestamp
      await updateDoc(doc(db, 'config', 'settings'), { lastResync: new Date().toISOString() });
      alert('Sincronização sequencial de todos os vídeos concluída!');
    } catch (error: any) {
      alert(`Erro na sincronização sequencial: ${error.message}`);
    } finally {
      setSyncing(false);
      setSyncingCompId(null);
      setSyncingPostId(null);
    }
  };

  const handleSyncAllParallel = async () => {
    const keys = settings.apifyKeys && settings.apifyKeys.length > 0 ? settings.apifyKeys : [apifyKey];
    if (keys.length < 1) {
      alert('Configure pelo menos uma chave de API nas Configurações.');
      return;
    }

    const allSyncedPosts = posts.filter(p => p.status === 'synced' || p.status === 'banned');
    const syncedPosts = allSyncedPosts.filter(p => !sessionSyncedIds.includes(p.id));

    if (syncedPosts.length === 0) {
      if (allSyncedPosts.length > 0) {
        alert('Todos os posts já foram conferidos nesta sessão! Liberando todos os vídeos para uma nova ressincronização completa.');
        setSessionSyncedIds([]);
        setSyncProgress(0);
        setSyncTotal(0);
      } else {
        alert('Nenhum vídeo sincronizado para ressincronizar.');
      }
      return;
    }

    setSyncing(true);
    let completed = sessionSyncedIds.length;
    setSyncProgress(completed);
    setSyncTotal(allSyncedPosts.length);
    
    const worker = async (list: Post[], key: string) => {
      for (const post of list) {
        setSyncingPostId(post.id);
        try {
          // Usa apenas a chave específica deste worker
          await syncSinglePostWithApify([key], post, false);
          setSessionSyncedIds((prev: string[]) => [...prev, post.id]);
          completed++;
          setSyncProgress(completed);
        } catch (e) {
          console.error(`Erro no Multi-Sync (all) para o post ${post.id}:`, e);
        }
      }
    };

    try {
      // Distribui os posts em N grupos, um para cada chave
      const n = keys.length;
      const groups: Post[][] = Array.from({ length: n }, () => []);
      syncedPosts.forEach((post, i) => {
        groups[i % n].push(post);
      });

      await Promise.all(groups.map((group, i) => worker(group, keys[i])));
      alert(`Sincronização Paralela (Multi-Sync) com ${n} chaves finalizada!`);
    } catch (error: any) {
      alert(`Erro no Multi-Sync: ${error.message}`);
    } finally {
      setSyncing(false);
      setSyncingCompId(null);
      setSyncingPostId(null);
    }
  };

  const handleSyncCompetitionSequentially = async (compId: string) => {
    const keys = settings.apifyKeys && settings.apifyKeys.length > 0 ? settings.apifyKeys : [apifyKey];
    if (keys.length === 0 || !keys[0]) {
      alert('Por favor, insira sua chave Apify para sincronizar.');
      return;
    }

    const allCompPosts = posts.filter(p => p.competitionId === compId && (p.status === 'synced' || p.status === 'banned'));
    const compPosts = allCompPosts.filter(p => !sessionSyncedIds.includes(p.id));

    if (compPosts.length === 0) {
      if (allCompPosts.length > 0) {
        alert('Todos os posts desta competição já foram conferidos! Liberando para uma nova bateria completa.');
        setSessionSyncedIds([]);
        setSyncProgress(0);
        setSyncTotal(0);
      } else {
        alert('Nenhum vídeo nesta competição para ressincronizar.');
      }
      return;
    }

    setSyncing(true);
    setSyncingCompId(compId);
    let current = sessionSyncedIds.length;
    setSyncProgress(current);
    setSyncTotal(allCompPosts.length);
    try {
      for (const post of compPosts) {
        setSyncingPostId(post.id);
        await syncSinglePostWithApify(keys, post, false);
        setSessionSyncedIds((prev: string[]) => [...prev, post.id]);
        current++;
        setSyncProgress(current);
      }
      alert('Sincronização desta competição concluída com sucesso!');
    } catch (error: any) {
      alert(`Erro na sincronização: ${error.message}`);
    } finally {
      setSyncing(false);
      setSyncingCompId(null);
      setSyncingPostId(null);
    }
  };

  const handleSyncCompetitionParallel = async (compId: string) => {
    const keys = settings.apifyKeys && settings.apifyKeys.length > 0 ? settings.apifyKeys : [apifyKey];
    if (keys.length < 1) {
      alert('Configure pelo menos uma chave de API nas Configurações.');
      return;
    }

    const allCompPosts = posts.filter(p => p.competitionId === compId && (p.status === 'synced' || p.status === 'banned'));
    const compPosts = allCompPosts.filter(p => !sessionSyncedIds.includes(p.id));

    if (compPosts.length === 0) {
      if (allCompPosts.length > 0) {
        alert('Todos os posts desta competição já foram conferidos! Liberando para uma nova bateria completa.');
        setSessionSyncedIds([]);
        setSyncProgress(0);
        setSyncTotal(0);
      } else {
        alert('Nenhum vídeo nesta competição para ressincronizar.');
      }
      return;
    }

    setSyncing(true);
    setSyncingCompId(compId);
    let completed = sessionSyncedIds.length;
    setSyncProgress(completed);
    setSyncTotal(allCompPosts.length);

    const worker = async (list: Post[], key: string) => {
      for (const post of list) {
        setSyncingPostId(post.id);
        try {
          await syncSinglePostWithApify([key], post, false);
          setSessionSyncedIds((prev: string[]) => [...prev, post.id]);
          completed++;
          setSyncProgress(completed);
        } catch (e) {
          console.error(`Erro no Multi-Sync (comp) para o post ${post.id}:`, e);
        }
      }
    };

    try {
      const n = keys.length;
      const groups: Post[][] = Array.from({ length: n }, () => []);
      compPosts.forEach((post, i) => {
        groups[i % n].push(post);
      });

      await Promise.all(groups.map((group, i) => worker(group, keys[i])));
      alert(`Multi-Sync da competição finalizado com ${n} chaves!`);
    } catch (error: any) {
      alert(`Erro no Multi-Sync: ${error.message}`);
    } finally {
      setSyncing(false);
      setSyncingCompId(null);
      setSyncingPostId(null);
    }
  };

  const handleBulkForceMonthly = async () => {
    if (selectedResyncPostIds.length === 0) return;
    if (!confirm(`Deseja forçar ${selectedResyncPostIds.length} posts para o MENSAL?`)) return;
    
    setSyncing(true);
    try {
      const userIdsToUpdate = new Set<string>();
      for (const postId of selectedResyncPostIds) {
        const post = posts.find(p => p.id === postId);
        if (post) {
          await updateDoc(doc(db, 'posts', postId), { forceMonthly: true, forceDaily: false });
          userIdsToUpdate.add(post.userId);
        }
      }
      
      for (const userId of userIdsToUpdate) {
        await updateUserMetrics(userId);
      }
      
      alert('Ação em lote concluída: Posts forçados para o Mensal!');
      setSelectedResyncPostIds([]);
    } catch (e: any) {
      alert('Erro na ação em lote: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkForceDaily = async () => {
    if (selectedResyncPostIds.length === 0) return;
    if (!confirm(`Deseja forçar ${selectedResyncPostIds.length} posts para o DIÁRIO?`)) return;
    
    setSyncing(true);
    try {
      const userIdsToUpdate = new Set<string>();
      for (const postId of selectedResyncPostIds) {
        const post = posts.find(p => p.id === postId);
        if (post) {
          await updateDoc(doc(db, 'posts', postId), { forceDaily: true, forceMonthly: false });
          userIdsToUpdate.add(post.userId);
        }
      }
      
      for (const userId of userIdsToUpdate) {
        await updateUserMetrics(userId);
      }
      
      alert('Ação em lote concluída: Posts forçados para o Diário!');
      setSelectedResyncPostIds([]);
    } catch (e: any) {
      alert('Erro na ação em lote: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkResetMetrics = async () => {
    if (selectedResyncPostIds.length === 0) return;
    if (!confirm(`Deseja ZERAR as métricas de ${selectedResyncPostIds.length} posts e enviá-los de volta para sincronização?`)) return;
    
    setSyncing(true);
    try {
      const userIdsToUpdate = new Set<string>();
      for (const postId of selectedResyncPostIds) {
        const post = posts.find(p => p.id === postId);
        if (post) {
          await updateDoc(doc(db, 'posts', postId), { 
            status: 'approved',
            views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
            viewsBaseline: 0, likesBaseline: 0, commentsBaseline: 0, sharesBaseline: 0, savesBaseline: 0
          });
          userIdsToUpdate.add(post.userId);
        }
      }
      
      for (const userId of userIdsToUpdate) {
        await updateUserMetrics(userId);
      }
      
      alert('Ação em lote concluída: Posts resetados e enviados para re-sincronia!');
      setSelectedResyncPostIds([]);
    } catch (e: any) {
      alert('Erro na ação em lote: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkSyncSelected = async () => {
    if (selectedResyncPostIds.length === 0) return;
    const keys = settings.apifyKeys && settings.apifyKeys.length > 0 ? settings.apifyKeys : [apifyKey];
    if (keys.length < 1) {
      alert('Configure pelo menos uma chave de API.');
      return;
    }

    setSyncing(true);
    setSyncTotal(selectedResyncPostIds.length);
    let completed = 0;
    setSyncProgress(0);

    try {
      const selectedPosts = posts.filter(p => selectedResyncPostIds.includes(p.id));
      const n = keys.length;
      const groups: Post[][] = Array.from({ length: n }, () => []);
      selectedPosts.forEach((post, i) => groups[i % n].push(post));

      const worker = async (list: Post[], key: string) => {
        for (const post of list) {
          setSyncingPostId(post.id);
          try {
            await syncSinglePostWithApify([key], post, false);
            completed++;
            setSyncProgress(completed);
          } catch (e) {
            console.error(`Erro no Bulk Sync para o post ${post.id}:`, e);
          }
        }
      };

      await Promise.all(groups.map((group, i) => worker(group, keys[i])));
      alert('Sincronização em lote dos selecionados finalizada!');
      setSelectedResyncPostIds([]);
    } catch (error: any) {
      alert(`Erro no Bulk Sync: ${error.message}`);
    } finally {
      setSyncing(false);
      setSyncingPostId(null);
    }
  };

  const handleBulkSyncSelectedApproved = async () => {
    if (selectedSyncPostIds.length === 0) return;
    const keys = settings.apifyKeys && settings.apifyKeys.length > 0 ? settings.apifyKeys : [apifyKeySync];
    if (keys.length < 1) {
      alert('Configure pelo menos uma chave de API.');
      return;
    }

    setSyncing(true);
    setSyncTotal(selectedSyncPostIds.length);
    let completed = 0;
    setSyncProgress(0);

    try {
      const selectedPosts = posts.filter(p => selectedSyncPostIds.includes(p.id));
      const n = keys.length;
      const groups: Post[][] = Array.from({ length: n }, () => []);
      selectedPosts.forEach((post, i) => groups[i % n].push(post));

      const worker = async (list: Post[], key: string) => {
        for (const post of list) {
          setSyncingPostId(post.id);
          try {
            await syncSinglePostWithApify([key], post, false);
            await updateDoc(doc(db, 'posts', post.id), { status: 'synced' });
            await updateUserMetrics(post.userId);
            completed++;
            setSyncProgress(completed);
          } catch (e) {
            console.error(`Erro no Bulk Sync (Approved) para o post ${post.id}:`, e);
          }
        }
      };

      await Promise.all(groups.map((group, i) => worker(group, keys[i])));
      alert('Sincronização em lote dos selecionados finalizada!');
      setSelectedSyncPostIds([]);
    } catch (error: any) {
      alert(`Erro no Bulk Sync: ${error.message}`);
    } finally {
      setSyncing(false);
      setSyncingPostId(null);
    }
  };

  const onForceMonthly = async (post: Post) => {
    const isAlreadyForced = (post as any).forceMonthly === true;
    const msg = isAlreadyForced
      ? 'Este link já está forçado para o Mensal. Deseja REVERTER para o comportamento normal (voltará ao Diário se dentro do ciclo)?'
      : 'Forçar este link para o Ranking MENSAL? Ele sairá do Diário e todos os seus dados diários serão removidos imediatamente.';
    if (!confirm(msg)) return;
    try {
      await updateDoc(doc(db, 'posts', post.id), { forceMonthly: !isAlreadyForced, forceDaily: false });
      await updateUserMetrics(post.userId);
      alert(isAlreadyForced ? 'Revertido! Link voltou ao comportamento normal.' : 'á¢Ã…â€œââ‚¬Â¦ Link forçado para o Mensal! Stats diários removidos.');
    } catch(e: any) { alert('Erro: ' + e.message); }
  };

  const onForceDaily = async (post: Post) => {
    const isAlreadyForcedDaily = (post as any).forceDaily === true;
    if (!isAlreadyForcedDaily && (post as any).forceMonthly) {
       alert('Remova primeiro a tag Mensal antes de forçar no Diário.');
       return;
    }
    const msg = isAlreadyForcedDaily
      ? 'Este link já está forçado para o Diário. Deseja REVERTER para o comportamento normal?'
      : 'Forçar este link para o Ranking DIÁRIO? Ele entrará na contagem diária permanentemente.';
    if (!confirm(msg)) return;
    try {
      await updateDoc(doc(db, 'posts', post.id), { forceDaily: !isAlreadyForcedDaily, forceMonthly: false });
      await updateUserMetrics(post.userId);
      alert(isAlreadyForcedDaily ? 'Revertido! Link voltou ao comportamento normal.' : 'á¢Ã…â€œââ‚¬Â¦ Link forçado para o Diário! Stats integrados imediatamente.');
    } catch(e: any) { alert('Erro: ' + e.message); }
  };

  const onResetToSync = async (post: Post) => {
    if (!confirm('Tem certeza que deseja voltar este link para a sincronização? As métricas atuais serão ZERADAS para que ele seja recolocado no ranking corretamente.')) return;
    try {
      await updateDoc(doc(db, 'posts', post.id), { 
        status: 'approved',
        views: 0, likes: 0, comments: 0, shares: 0, saves: 0,
        viewsBaseline: 0, likesBaseline: 0, commentsBaseline: 0, sharesBaseline: 0, savesBaseline: 0
      });
      await updateUserMetrics(post.userId);
      alert('Link enviado de volta para Sincronização e métricas zeradas.');
    } catch(e: any) { alert('Erro: ' + e.message); }
  };

  const onSingleSync = async (post: Post) => {
    const keys = settings.apifyKeys && settings.apifyKeys.length > 0 ? settings.apifyKeys : [apifyKeySync];
    if (keys.length === 0 || !keys[0]) {
      alert('Configurações de API ausentes.');
      return;
    }
    try {
      setSyncingPostId(post.id);
      await syncSinglePostWithApify(keys, post, false);
      setSessionSyncedIds((prev: string[]) => [...prev, post.id]);
      alert('Sincronização individual concluída!');
    } catch (e: any) { alert('Erro: ' + e.message); }
    finally { setSyncingPostId(null); }
  };

  const handleBulkRevertToPending = async () => {
    if (selectedSyncPostIds.length === 0) return;
    if (!confirm(`Deseja reverter ${selectedSyncPostIds.length} posts selecionados para a Triagem (Pendentes)?`)) return;

    try {
      setSyncing(true);
      const affectedUserIds = new Set<string>();
      
      for (const postId of selectedSyncPostIds) {
        const post = posts.find(p => p.id === postId);
        if (post) {
          affectedUserIds.add(post.userId);
          await updateDoc(doc(db, 'posts', postId), { 
            status: 'pending', 
            approvedAt: deleteField() 
          });
        }
      }
      
      for (const uid of Array.from(affectedUserIds)) {
        await updateUserMetrics(uid);
      }
      
      setSelectedSyncPostIds([]);
      alert('Links revertidos para a Triagem com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'bulk_revert');
    } finally {
      setSyncing(false);
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
        'LINK DO VáDEO': post.url,
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
      { wch: 55 }, // LINK DO VáDEO
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
            {/* CONFIGURAÇÃO DA CHAVE API GERAL */}
            <div className="flex flex-col gap-4 flex-1 min-w-[300px]">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  Chaves Gerais (Ressincronização)
                  <InfoTooltip text="Chaves usadas para a atualização periódica de todos os vídeos já auditados." />
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none group-focus-within:text-amber-500 transition-colors" />
                    <input
                      type="text"
                      value={apifyKey}
                      onChange={(e) => setApifyKey(e.target.value)}
                      placeholder="Adicionar chave..."
                      className="w-full bg-black border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:border-amber-500 outline-none transition-all placeholder:text-zinc-700"
                    />
                  </div>
                  <button
                    onClick={handleSaveApiKey}
                    className="px-6 py-3 bg-zinc-800 text-zinc-300 font-black rounded-xl hover:bg-zinc-700 active:scale-95 transition-all text-[10px] uppercase whitespace-nowrap"
                  >
                    Salvar
                  </button>
                </div>
              </div>

              {settings.apifyKeys && settings.apifyKeys.length > 0 && (
                <div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto pr-2 custom-scrollbar">
                  {settings.apifyKeys.map((key, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-black/40 border border-zinc-800/50 px-3 py-1.5 rounded-lg group">
                      <code className="text-[9px] text-zinc-500 font-mono truncate max-w-[80px]">
                        {key.substring(0, 6)}...{key.substring(key.length - 4)}
                      </code>
                      <button 
                        onClick={() => handleDeleteApiKey(key)}
                        className="text-zinc-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                        title="Remover Chave"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CONFIGURAÇÃO DA CHAVE API EXCLUSIVA PARA SINCRONISMO */}
            <div className="flex flex-col gap-4 flex-1 min-w-[300px] border-l border-zinc-800/50 pl-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Zap className="w-3 h-3 fill-current" /> Chaves Sincronismo Inicial
                  <InfoTooltip text="Chaves usadas exclusivamente para a primeira validação de links aprovados. Recomendado usar chaves diferentes das gerais." />
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 group">
                    <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none group-focus-within:text-amber-500 transition-colors" />
                    <input
                      type="text"
                      value={apifyKeySync}
                      onChange={(e) => setApifyKeySync(e.target.value)}
                      placeholder="Adicionar chave sync..."
                      className="w-full bg-black border border-amber-500/20 rounded-xl py-3 pl-12 pr-4 text-xs font-bold focus:border-amber-500 outline-none transition-all placeholder:text-zinc-700"
                    />
                  </div>
                  <button
                    onClick={handleSaveSyncKey}
                    className="px-6 py-3 gold-bg text-black font-black rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-amber-500/20 text-[10px] uppercase whitespace-nowrap"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {settings.apifyKeysSync && settings.apifyKeysSync.length > 0 && (
                <div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto pr-2 custom-scrollbar">
                  {settings.apifyKeysSync.map((key, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 px-3 py-1.5 rounded-lg group">
                      <code className="text-[9px] text-zinc-400 font-mono truncate max-w-[80px]">
                        {key.substring(0, 6)}...{key.substring(key.length - 4)}
                      </code>
                      <button 
                        onClick={() => handleDeleteSyncKey(key)}
                        className="text-zinc-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                        title="Remover Chave"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                  title="Zerar Diário (Com Premiação)"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleResetRankingSimple(selectedResetCompId)}
                  disabled={!selectedResetCompId}
                  className="p-3 bg-amber-500/10 text-amber-500 font-black rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/10 disabled:opacity-30 flex items-center justify-center"
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
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all flex items-center ${tab === 'POSTS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            POSTS ({posts.filter(p => p.status === 'pending').length})
            <TabBadge count={posts.filter(p => p.status === 'pending').length} />
          </button>
        )}
        {/* SINCRONIZAÇÃO - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('SINCRONIZACAO'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${(tab as any) === 'SINCRONIZACAO' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            SINCRONIZAÇÃO ({posts.filter(p => p.status === 'approved').length})
          </button>
        )}
        {/* RESSINCRONIZAÇÃO - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('RESSINCRONIZACAO'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${(tab as any) === 'RESSINCRONIZACAO' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            RESSINCRONIZAÇÃO ({posts.filter(p => p.status === 'synced' || p.status === 'banned').length})
          </button>
        )}
        {/* USERS - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('USERS'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all flex items-center ${tab === 'USERS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            PENDENTES ({pendingUsers.length})
            <TabBadge count={pendingUsers.length} />
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
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${(tab as any) === 'COMPETITIONS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            COMPETIÇÕES ({competitions.length})
          </button>
        )}
        {/* SOLICITAÇÕES DE REMOÇÃO - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('REMOVAL_REQUESTS'); setAuditUserId(null); setSelectedCompId(null); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all flex items-center ${tab === 'REMOVAL_REQUESTS' ? 'bg-amber-500 text-black' : 'text-zinc-500'}`}
          >
            SOLICITAÇÕES ({posts.filter(p => p.status === 'removal_requested').length})
            <TabBadge count={posts.filter(p => p.status === 'removal_requested').length} />
          </button>
        )}
        {/* REGISTROS - visível apenas para admin */}
        {userRole === 'admin' && (
          <button
            onClick={() => { setTab('REGISTROS'); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all flex items-center ${tab === 'REGISTROS' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            REGISTROS ({pendingRegistrations.length})
            <TabBadge count={pendingRegistrations.length} />
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
        {/* DIAGNÓSTICO - visível apenas para admin e administrativo */}
        {(userRole === 'admin' || userRole === 'administrativo') && (
          <button
            onClick={() => { setTab('DIAGNOSTICO'); setSyncDetailCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${tab === 'DIAGNOSTICO' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-amber-400'}`}
          >
            DIAGNÓSTICO
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
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all flex items-center ${tab === 'SUGESTOES' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
          >
            SUGESTÕES ({suggestions.length})
            <TabBadge count={suggestions.length} />
          </button>
        )}
        {/* RELATÓRIOS (LINKS) - visível para admin e auditor */}
        {(userRole === 'admin' || userRole === 'auditor') && (
          <button
            onClick={() => { setTab('RELATORIOS'); setSyncDetailCompId(null); setSelectedCompId(null); }}
            className={`px-6 py-2 rounded-xl font-bold text-xs transition-all flex items-center ${tab === 'RELATORIOS' ? 'gold-bg text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
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
                  tooltip: 'Soma total de visualizações de todos os posts aprovados nas competições.',
                  trend: undefined
                },
                { 
                  label: 'Posts Enviados', 
                  value: postsToday, 
                  sub: selectedMetaComp?.title || 'Todas as Competições', 
                  icon: Zap, 
                  color: 'text-emerald-500', 
                  bg: 'bg-emerald-500/10',
                  desc: 'Volume enviado após o último reset',
                  tooltip: 'Quantidade de vídeos aprovados hoje (desde o último reset) por todos os criadores.',
                  trend: undefined
                },
                { 
                  label: 'Governança & Gestão', 
                  value: `${approvalRate}%`, 
                  sub: `${auditEfficiency} min / audit`, 
                  icon: ShieldCheck, 
                  color: 'text-blue-500', 
                  bg: 'bg-blue-500/10',
                  desc: 'Taxa de Aprovação vs. Tempo',
                  tooltip: 'Percentual de vídeos aprovados e tempo médio de resposta da auditoria.',
                  trend: undefined
                },
                { 
                  label: 'Redes Vinculadas', 
                  value: (() => {
                    const activeUsers = [...approvedUsers, ...pendingUsers];
                    const targetUsers = selectedNetworkUserId === 'all' ? activeUsers : activeUsers.filter(u => u.uid === selectedNetworkUserId);
                    return targetUsers.reduce((acc: number, u: any) => acc + (u.tiktok?.length || 0) + (u.instagram?.length || 0) + ((u as any).userInstagram?.length || 0) + (u.youtube?.length || 0), 0);
                  })(),
                  sub: (() => {
                    const activeUsers = [...approvedUsers, ...pendingUsers];
                    if (selectedNetworkUserId !== 'all') {
                      const selUser = activeUsers.find(u => u.uid === selectedNetworkUserId);
                      if (!selUser) return 'Usuário não encontrado';
                      const tkCount = (selUser.tiktok || []).length;
                      const igCount = ((selUser.instagram || []).length + ((selUser as any).userInstagram || []).length);
                      const ytCount = (selUser.youtube || []).length;
                      const totalCount = tkCount + igCount + ytCount;
                      return `Visualizando detalhes de perfis (${totalCount})`;
                    }
                    const tk = activeUsers.reduce((acc: number, u: any) => acc + (u.tiktok?.length || 0), 0);
                    const ig = activeUsers.reduce((acc: number, u: any) => acc + (u.instagram?.length || 0) + ((u as any).userInstagram?.length || 0), 0);
                    const yt = activeUsers.reduce((acc: number, u: any) => acc + (u.youtube?.length || 0), 0);
                    return `Tiktok: ${tk} • Insta: ${ig} • YT: ${yt}`;
                  })(), 
                  icon: Share2, 
                  color: 'text-pink-500', 
                  bg: 'bg-pink-500/10',
                  desc: 'Total de contas sociais cadastradas',
                  tooltip: 'Quantidade de redes sociais conectadas nos perfis dos usuários.',
                  trend: undefined
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
                          {stat.trend === 'up' ? '↑ Crescendo' : '→ Estável'}
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

                  <div className="mt-8 pt-4 border-t border-zinc-900/50 relative z-10 flex flex-col gap-3">
                    <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest leading-none">{stat.desc}</p>
                    {stat.label === 'Redes Vinculadas' && (
                      <>
                        <select
                          value={selectedNetworkUserId}
                          onChange={(e) => setSelectedNetworkUserId(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1.5 text-[8px] font-black text-zinc-300 uppercase tracking-widest focus:outline-none focus:border-pink-500/50 transition-all cursor-pointer"
                        >
                          <option value="all" className="bg-zinc-900 text-zinc-300 font-black">TODOS OS USUÁRIOS</option>
                          {[...approvedUsers, ...pendingUsers]
                            .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''))
                            .map(u => (
                            <option key={u.uid} value={u.uid} className="bg-zinc-900 text-zinc-300">
                              {u.displayName ? u.displayName.toUpperCase() : (u.email ? u.email.toUpperCase() : 'SEM NOME')}
                            </option>
                          ))}
                        </select>
                        {selectedNetworkUserId !== 'all' && (() => {
                          const selUser = [...approvedUsers, ...pendingUsers].find(u => u.uid === selectedNetworkUserId);
                          if (!selUser) return null;
                          const tks = selUser.tiktok || [];
                          const igs = [...(selUser.instagram || []), ...((selUser as any).userInstagram || [])];
                          const yts = selUser.youtube || [];
                          const allHandles = [
                            ...tks.map(h => ({ platform: 'TikTok', handle: h, color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' })),
                            ...igs.map(h => ({ platform: 'Instagram', handle: h, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' })),
                            ...yts.map(h => ({ platform: 'YouTube', handle: h, color: 'text-red-500 bg-red-500/10 border-red-500/20' }))
                          ];
                          if (allHandles.length === 0) return <div className="text-[9px] text-zinc-500 text-center font-bold mt-2">NENHUMA CONTA ENCONTRADA</div>;
                          return (
                            <div className="mt-2 flex flex-col gap-2 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                              {allHandles.map((h, idx) => (
                                <div key={idx} className="flex flex-col gap-1.5 items-center justify-center p-2 rounded-xl bg-black border border-zinc-900 group text-center">
                                  <span className="text-[8px] font-black text-zinc-500 uppercase">{h.platform}</span>
                                  <div className={`px-3 py-1 rounded-full border text-[9px] font-black tracking-widest ${h.color} truncate w-full max-w-[200px]`}>
                                    {h.handle}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </>
                    )}
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
                
                <div className="flex items-end justify-between gap-4 h-48 pt-10 px-4">
                  {dailyPostCounts.map((d, i) => {
                    const maxCount = Math.max(...dailyPostCounts.map(x => x.count), 1);
                    const height = (d.count / maxCount) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-4 group h-full">
                        <div className="w-full relative flex flex-col justify-end h-full">
                          {/* Sombra/Fundo da barra para profundidade */}
                          <div className="absolute inset-x-0 bottom-0 w-8 mx-auto bg-white/[0.02] rounded-t-xl h-full" />
                          
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(height, 2)}%` }} // Garante visibilidade mínima se houver dados
                            transition={{ duration: 1, delay: i * 0.05 }}
                            className={`w-8 mx-auto rounded-t-xl transition-all relative overflow-hidden ${i === 6 ? 'gold-bg shadow-[0_0_30px_rgba(251,191,36,0.2)]' : 'bg-zinc-800 group-hover:bg-amber-500/50'}`}
                          >
                             {/* Textura de gradiente interna */}
                             <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                             
                             {d.count > 0 && (
                               <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-white text-black text-[10px] font-black px-3 py-1.5 rounded-xl shadow-2xl whitespace-nowrap z-20 scale-90 group-hover:scale-100">
                                 {d.count} POSTS
                               </div>
                             )}
                          </motion.div>
                        </div>
                        <span className={`text-[10px] font-black tracking-widest ${i === 6 ? 'text-amber-500' : 'text-zinc-600 group-hover:text-zinc-400'} transition-colors`}>{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Efficiency Metric Card */}
              <div className="p-8 rounded-[40px] bg-zinc-950 border border-zinc-900 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h4 className="text-lg font-black uppercase text-white tracking-tight">Eficiência de Postagem</h4>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Média de posts por dia / criador</p>
                  </div>
                  <TrendingUp className="w-6 h-6 text-amber-500/30" />
                </div>
                
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] custom-scrollbar pr-1">
                  {userPostAverages.map((u) => {
                    const avg = u.avgPostsPerDay || 0;
                    const colorClass = avg >= 1.0 ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
                                     avg >= 0.5 ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
                                     'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
                    return (
                      <div key={u.uid} className="flex items-center justify-between p-3 rounded-2xl bg-black border border-zinc-900 group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-800">
                            <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} alt="" className="w-full h-full object-cover" />
                          </div>
                          <span className="text-[10px] font-black text-zinc-400 uppercase truncate max-w-[100px]">{u.displayName}</span>
                        </div>
                        <div className={`px-3 py-1 rounded-full border text-[9px] font-black tracking-widest ${colorClass}`}>
                          {avg.toFixed(2)} / DIA
                        </div>
                      </div>
                    );
                  })}
                  {userPostAverages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10">
                      <ShieldCheck className="w-8 h-8 text-emerald-500/20 mb-2" />
                      <p className="text-[9px] font-black text-zinc-700 uppercase">Aguardando dados...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Middle Section: Distribution & Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Distribution Card - Full width now */}
              <div className="lg:col-span-3 p-8 rounded-[40px] bg-zinc-950 border border-zinc-900">
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
                  <option value="user">Usuário Comum (Criador de Conteúdo)</option>
                  <option value="auditor">Gestor — Controle de Campanhas</option>
                  <option value="administrativo">Administrativo — Gestão + Financeiro + Acesso como usuário</option>
                  <option value="admin">Administrador (Diretoria) — Acesso total</option>
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

                <div className="flex flex-col gap-1 px-2">
                  <label className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] ml-1">Filtrar por Dia:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={financeDateFilter}
                      onChange={(e) => setFinanceDateFilter(e.target.value)}
                      className="bg-black border border-zinc-800 rounded-xl py-2 px-4 text-[10px] font-black text-amber-500 outline-none focus:border-amber-500 transition-all cursor-pointer hover:bg-zinc-900 icon-calendar-white"
                    />
                    {financeDateFilter && (
                      <button 
                        onClick={() => setFinanceDateFilter('')}
                        className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                        title="Limpar Filtro"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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
                              PROJEÇÃO DE SAáDA (PENDENTE) <InfoTooltip text="Total acumulado nos saldos dos usuários aguardando pagamento ou saque." />
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
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                          <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-800/50 overflow-x-auto custom-scrollbar w-full md:w-fit">
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
                          
                          <div className="relative w-full md:w-auto">
                            <button 
                              onClick={() => setShowManualUserSelect(!showManualUserSelect)}
                              className="w-full md:w-auto px-4 py-2.5 bg-zinc-900 text-zinc-300 font-black rounded-xl text-[10px] uppercase tracking-widest border border-zinc-800 hover:border-amber-500/50 hover:text-amber-500 transition-all flex items-center justify-center gap-2 shadow-lg"
                            >
                              <Plus className="w-3.5 h-3.5" /> INSERIR USUÁRIO MANUAL
                            </button>

                            {showManualUserSelect && (
                              <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl z-50 p-3 flex flex-col gap-3">
                                <input 
                                  type="text"
                                  placeholder="Buscar por nome..."
                                  value={searchManualUser}
                                  onChange={(e) => setSearchManualUser(e.target.value)}
                                  className="bg-black border border-zinc-800 rounded-xl py-2 px-3 text-[10px] font-bold text-white outline-none focus:border-amber-500"
                                />
                                <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                  {approvedUsers
                                    .filter(u => u.displayName.toLowerCase().includes(searchManualUser.toLowerCase()))
                                    .map(u => (
                                      <button
                                        key={u.uid}
                                        onClick={() => {
                                          setManuallyAddedFinancialUsers(prev => prev.includes(u.uid) ? prev : [...prev, u.uid]);
                                          setShowManualUserSelect(false);
                                          setSearchManualUser('');
                                        }}
                                        className="text-left px-3 py-2 rounded-lg text-[10px] font-black text-zinc-400 hover:bg-zinc-900 hover:text-white uppercase transition-all truncate"
                                      >
                                        {u.displayName}
                                      </button>
                                  ))}
                                  {approvedUsers.filter(u => u.displayName.toLowerCase().includes(searchManualUser.toLowerCase())).length === 0 && (
                                    <p className="text-[10px] font-bold text-zinc-600 text-center py-2">Nenhum usuário encontrado</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <ListHeader columns={['INTEGRANTE', 'CHAVE PIX', 'SALDO', 'STATUS', 'GERENCIAR']} gridClass="grid-cols-[1.5fr_1fr_1.5fr_150px_220px]" />
                        <div className="max-h-[700px] overflow-y-auto custom-scrollbar">
                          {(() => {
                            if (loadingFinancials) {
                              return (
                                <div className="py-32 text-center">
                                  <RefreshCw className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" />
                                  <p className="text-zinc-600 font-black uppercase text-[10px] tracking-widest">Carregando dados financeiros...</p>
                                </div>
                              );
                            }

                            if (financeTab === 'REALIZED' && financeDateFilter) {
                              return (
                                <>
                                  {realizedPayments.map(t => (
                                    <DailyTransactionRow key={t.id} transaction={t} users={approvedUsers} />
                                  ))}
                                  {realizedPayments.length === 0 && (
                                    <div className="py-32 text-center">
                                      <History className="w-12 h-12 text-zinc-900 mx-auto mb-4" />
                                      <p className="text-zinc-700 font-black uppercase text-[10px] tracking-widest">Nenhum pagamento registrado neste dia.</p>
                                    </div>
                                  )}
                                </>
                              );
                            }

                            const filteredUsers = approvedUsers.filter(u => {
                              const b = financeCompId ? (u.competitionStats?.[financeCompId]?.balance || 0) : 0;
                              const paid = financeCompId ? (u.competitionStats?.[financeCompId]?.paidTotal || 0) : 0;
                              
                              if (financeDateFilter && financeTab === 'PENDING') {
                                // Filtra usuários que tiveram posts aprovados na data selecionada E possuem saldo
                                const dailyPosts = posts.filter(p => 
                                  p.userId === u.uid && 
                                  p.competitionId === financeCompId && 
                                  (p.status === 'approved' || p.status === 'synced') &&
                                  p.approvedAt && isSameDay(p.approvedAt, financeDateFilter)
                                );
                                return b > 0 && dailyPosts.length > 0;
                              }

                              if (financeTab === 'PENDING') return b > 0 || manuallyAddedFinancialUsers.includes(u.uid);
                              // Para REALIZED, mostramos quem já recebeu qualquer valor
                              return paid > 0 || manuallyAddedFinancialUsers.includes(u.uid);
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



        {tab === 'DIAGNOSTICO' && (
          <DiagnosticoTab 
            users={[...approvedUsers, ...pendingUsers, ...archivedUsers]}
            posts={posts}
            competitions={competitions}
            registrations={registrations}
            handleDeleteAllDuplicates={handleDeleteAllDuplicates}
          />
        )}

        {tab === 'POSTS' ? (
          <TriagemTab 
            posts={posts}
            competitions={competitions}
            syncDetailCompId={syncDetailCompId}
            setSyncDetailCompId={setSyncDetailCompId}
            handlePostStatus={handlePostStatus}
            handleApproveAsMonthly={handleApproveAsMonthly}
            pendingMoves={pendingMoves}
            setPendingMoves={setPendingMoves}
            handleMovePostToCompetition={handleMovePostToCompetition}
            selectedAdminHandle={selectedAdminHandle}
            setSelectedAdminHandle={setSelectedAdminHandle}
            adminHandles={adminHandles}
          />
        ) : (tab as any) === 'SINCRONIZACAO' ? (
          <SincronizacaoTab 
            posts={posts}
            competitions={competitions}
            syncDetailCompId={syncDetailCompId}
            setSyncDetailCompId={setSyncDetailCompId}
            selectedSyncPostIds={selectedSyncPostIds}
            setSelectedSyncPostIds={setSelectedSyncPostIds}
            handleBulkRevertToPending={handleBulkRevertToPending}
            handleBulkSyncSelectedApproved={handleBulkSyncSelectedApproved}
            syncingPostId={syncingPostId}
            setSyncingPostId={setSyncingPostId}
            syncing={syncing}
            settings={settings}
            handleSyncApprovedParallel={handleSyncApprovedParallel}
            handleSyncApprovedSequentially={handleSyncApprovedSequentially}
            onSingleSync={onSingleSync}
            onUpdateMasterKey={handleUpdateMasterKey}
            formatLastSyncDate={formatLastSyncDate ?? ((d: any) => d?.toString())}
            handleMovePostToCompetition={handleMovePostToCompetition}
            pendingMoves={pendingMoves}
            setPendingMoves={setPendingMoves}
            selectedAdminHandle={selectedAdminHandle}
            setSelectedAdminHandle={setSelectedAdminHandle}
            adminHandles={adminHandles}
          />
        ) : (tab as any) === 'RESSINCRONIZACAO' ? (
          <RessincronizacaoTab 
            posts={posts}
            competitions={competitions}
            settings={settings}
            syncDetailCompId={syncDetailCompId}
            setSyncDetailCompId={setSyncDetailCompId}
            syncing={syncing}
            syncingCompId={syncingCompId}
            sessionSyncedIds={sessionSyncedIds}
            setSessionSyncedIds={setSessionSyncedIds}
            syncingPostId={syncingPostId}
            setSyncingPostId={setSyncingPostId}
            syncProgress={syncProgress}
            syncTotal={syncTotal}
            selectedResyncPostIds={selectedResyncPostIds}
            setSelectedResyncPostIds={setSelectedResyncPostIds}
            handleSyncCompetitionSequentially={handleSyncCompetitionSequentially}
            handleSyncCompetitionParallel={handleSyncCompetitionParallel}
            handleSyncAllSequentially={handleSyncAllSequentially}
            handleSyncAllParallel={handleSyncAllParallel}
            handleBulkForceMonthly={handleBulkForceMonthly}
            handleBulkForceDaily={handleBulkForceDaily}
            handleBulkResetMetrics={handleBulkResetMetrics}
            handleBulkSyncSelected={handleBulkSyncSelected}
            apifyKey={apifyKey}
            setApifyKey={setApifyKey}
            handleSaveApiKey={handleSaveApiKey}
            handleDeleteApiKey={handleDeleteApiKey}
            onForceMonthly={onForceMonthly}
            onForceDaily={onForceDaily}
            onResetToSync={onResetToSync}
            onSingleSync={onSingleSync}
            setRejectionReason={setRejectionReason}
            setRejectionModal={setRejectionModal}
            handleMovePostToCompetition={handleMovePostToCompetition}
            pendingMoves={pendingMoves}
            setPendingMoves={setPendingMoves}
            selectedAdminHandle={selectedAdminHandle}
            setSelectedAdminHandle={setSelectedAdminHandle}
            adminHandles={adminHandles}
          />
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

                {/* Daily Summary + Filter */}
                {(() => {
                  const userPosts = posts.filter(p => p.userId === auditUserId);
                  
                  // Agrupar posts por dia (usando timestamp)
                  const dayMap: Record<string, typeof userPosts> = {};
                  userPosts.forEach(p => {
                    const d = new Date(p.timestamp);
                    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    if (!dayMap[key]) dayMap[key] = [];
                    dayMap[key].push(p);
                  });
                  const sortedDays = Object.keys(dayMap).sort((a, b) => b.localeCompare(a));
                  
                  let filteredPosts = auditDayFilter
                    ? (dayMap[auditDayFilter] || [])
                    : userPosts;

                  if (auditHandleFilter !== 'all') {
                    filteredPosts = filteredPosts.filter(p => p.accountHandle && p.accountHandle.trim() === auditHandleFilter);
                  }

                  const availableAuditHandles = Array.from(new Set(userPosts.map(p => p.accountHandle).filter((h): h is string => !!h).map(h => h.trim()))) as string[];

                  return (
                    <>
                      {/* Cards de resumo por dia */}
                      {sortedDays.length > 0 && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Posts por Dia</p>
                            {auditDayFilter && (
                              <button
                                onClick={() => setAuditDayFilter('')}
                                className="text-[10px] font-black text-amber-500 uppercase tracking-widest hover:text-amber-400 transition-colors flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Limpar Filtro
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {sortedDays.map(day => {
                              const dayPosts = dayMap[day];
                              const approved = dayPosts.filter(p => p.status === 'approved' || p.status === 'synced').length;
                              const pending = dayPosts.filter(p => p.status === 'pending').length;
                              const rejected = dayPosts.filter(p => p.status === 'rejected' || p.status === 'banned').length;
                              const isSelected = auditDayFilter === day;
                              const label = new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                              return (
                                <button
                                  key={day}
                                  onClick={() => setAuditDayFilter(isSelected ? '' : day)}
                                  className={`flex flex-col items-center px-4 py-3 rounded-2xl border transition-all text-left ${
                                    isSelected
                                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
                                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white'
                                  }`}
                                >
                                  <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                                  <span className={`text-xl font-black mt-0.5 ${isSelected ? 'text-amber-500' : 'text-white'}`}>{dayPosts.length}</span>
                                  <div className="flex items-center gap-2 mt-1">
                                    {approved > 0 && <span className="text-[8px] font-black text-emerald-500">{approved}✓</span>}
                                    {pending > 0 && <span className="text-[8px] font-black text-amber-400">{pending}á¢Ã‚ÂÃ‚Â³</span>}
                                    {rejected > 0 && <span className="text-[8px] font-black text-red-500">{rejected}✕</span>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {auditDayFilter && (
                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-3">
                              Mostrando {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''} de {new Date(auditDayFilter + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Filtro de Handle @ para o Administrador */}
                      {availableAuditHandles.length > 0 && (
                        <div className="mb-6 flex flex-col gap-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            Filtrar por Perfil / @ Conta
                          </label>
                          <select
                            value={auditHandleFilter}
                            onChange={(e) => setAuditHandleFilter(e.target.value)}
                            className="w-full md:w-1/2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-amber-500 transition-all uppercase tracking-widest"
                          >
                            <option value="all">TODOS OS PERFIS (@)</option>
                            {availableAuditHandles.map(handle => (
                              <option key={handle} value={handle}>@{handle.replace(/^@/, '')}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Lista de posts */}
                      <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                        {filteredPosts.map(post => (
                          <div key={post.id} className="p-4 rounded-2xl bg-black border border-zinc-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                              {post.platform === 'tiktok' ? <Zap className="w-6 h-6 text-amber-500" /> :
                                post.platform === 'youtube' ? <TrendingUp className="w-6 h-6 text-red-500" /> :
                                  <Camera className="w-6 h-6 text-pink-500" />}
                              <div className="flex flex-col overflow-hidden max-w-[200px]">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="font-bold text-xs truncate text-zinc-300">{post.url}</p>
                                </div>
                                {post.accountHandle && (
                                  <span className="text-[10px] text-zinc-400 font-bold lowercase truncate max-w-full">
                                    @{post.accountHandle.replace(/^@/, '')}
                                  </span>
                                )}
                                <p className={`text-[10px] font-black uppercase ${post.status === 'approved' || post.status === 'synced' ? 'text-emerald-500' : post.status === 'rejected' || post.status === 'banned' ? 'text-red-500' : 'text-amber-500'}`}>
                                  STATUS: {post.status === 'approved' || post.status === 'synced' ? 'APROVADO' : post.status === 'rejected' || post.status === 'banned' ? 'RECUSADO' : 'EM TRIAGEM'}
                                </p>
                                <p className="text-[9px] font-bold text-zinc-600 mt-0.5">{new Date(post.timestamp).toLocaleString('pt-BR')}</p>
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
                        {filteredPosts.length === 0 && (
                          <p className="text-center py-6 text-zinc-500 font-bold">Nenhum vídeo registrado para este usuário{auditDayFilter ? ' neste dia' : ''}.</p>
                        )}
                      </div>
                    </>
                  );
                })()}
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
                        <option value="auditor">AUDITOR á¢ââ€šÂ¬ââ‚¬Â REVISA VáDEOS POSTADOS</option>
                        <option value="administrativo">ADMINISTRATIVO á¢ââ€šÂ¬ââ‚¬Â FINANCEIRO + COMPETIÇÕES</option>
                        <option value="admin">ADMINISTRADOR (DIRETORIA) á¢ââ€šÂ¬ââ‚¬Â ACESSO TOTAL</option>
                      </select>
                      <p className="text-[9px] text-zinc-600 font-bold ml-1">á¢Ã…Â¡Ã‚Â á¯Ã‚Â¸Ã‚Â Alterar a função afeta imediatamente o acesso do usuário</p>
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
        ) : (tab as any) === 'COMPETITIONS' ? (
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

              // RANKING POR VIEWS
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
                          <p className="text-center py-10 text-zinc-600 font-bold">NENHUM DADO DE RANKING DISPONáVEL.</p>
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
                          {/* BÀÃ‚Â destaque especial */}
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
                              <p className="text-[9px] font-black text-amber-500 uppercase mb-2">RANKING MENSAL (ACUMULADO DO PERáODO)</p>
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
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Hashtags Informativas (#)</label>
                        <input
                          type="text"
                          value={compHashtags}
                          onChange={(e) => setCompHashtags(e.target.value)}
                          placeholder="#metarayx #viral"
                          className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Marcações Informativas (@)</label>
                        <input
                          type="text"
                          value={compMentions}
                          onChange={(e) => setCompMentions(e.target.value)}
                          placeholder="@metarayx_oficial"
                          className="w-full bg-black border border-zinc-800 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="p-8 rounded-[32px] bg-amber-500/5 border border-amber-500/20 space-y-6">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-amber-500" />
                        <div>
                          <h4 className="text-sm font-black uppercase gold-gradient">Validação Automatizada</h4>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Configure os itens obrigatórios para o painel de triagem</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1">Hashtags OBRIGATÓRIAS - Global</label>
                              <input
                                type="text"
                                value={compRequiredHashtags}
                                onChange={(e) => setCompRequiredHashtags(e.target.value)}
                                placeholder="Ex: zefelipe, musica (separe por vírgula)"
                                className="w-full bg-black border border-amber-500/20 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Zap className="w-3 h-3" /> YouTube Hashtags (Título ou Descrição)
                              </label>
                              <input
                                type="text"
                                value={compReqHashtagsYouTube}
                                onChange={(e) => setCompReqHashtagsYouTube(e.target.value)}
                                placeholder="Hashtags específicas YouTube (separe por vírgula)"
                                className="w-full bg-black border border-red-500/20 rounded-2xl py-4 px-6 text-sm font-bold focus:border-red-500 outline-none transition-all"
                              />
                            </div>
                            <p className="text-[9px] text-zinc-600 px-1 font-bold italic">* hashtags sem o símbolo # que o sistema deve validar na sincronização</p>
                          </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1">Menções OBRIGATÓRIAS - Global (@)</label>
                            <input
                              type="text"
                              value={compRequiredMentions}
                              onChange={(e) => setCompRequiredMentions(e.target.value)}
                              placeholder="Ex: zefelipe, metarayx (separe por vírgula)"
                              className="w-full bg-black border border-amber-500/20 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all"
                            />
                            <p className="text-[9px] text-zinc-600 px-1 font-bold italic">* Aplicado se o campo da plataforma estiver vazio</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Zap className="w-3 h-3 text-amber-500" /> TikTok
                              </label>
                              <input
                                type="text"
                                value={compReqTikTok}
                                onChange={(e) => setCompReqTikTok(e.target.value)}
                                placeholder="Perfil TikTok"
                                className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-xs font-bold focus:border-amber-500 outline-none transition-all"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Zap className="w-3 h-3 text-red-500" /> YouTube (Título ou Descrição)
                              </label>
                              <input
                                type="text"
                                value={compReqYouTube}
                                onChange={(e) => setCompReqYouTube(e.target.value)}
                                placeholder="Marking em Título/Desc"
                                className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-xs font-bold focus:border-amber-500 outline-none transition-all"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Camera className="w-3 h-3 text-pink-500" /> Instagram
                              </label>
                              <input
                                type="text"
                                value={compReqInsta}
                                onChange={(e) => setCompReqInsta(e.target.value)}
                                placeholder="Perfil Instagram"
                                className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-xs font-bold focus:border-amber-500 outline-none transition-all"
                              />
                            </div>
                          </div>
                        </div>
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
                          ðŸ‘ï¸ POR VIEWS
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
                          â¤ï¸ POR CURTIDAS
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          Reset Diário (20h á s 20h)
                        </label>
                        <input
                          type="time"
                          value={compDailyResetTime}
                          onChange={(e) => setCompDailyResetTime(e.target.value)}
                          className="w-full bg-black border border-amber-500/20 rounded-2xl py-4 px-6 text-sm font-bold focus:border-amber-500 outline-none transition-all text-amber-500"
                        />
                        <p className="text-[9px] text-zinc-600 px-1 font-bold italic">* Horário que fecha a contagem do dia</p>
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
        ) : (tab as any) === 'RESSINCRONIZACAO' ? (
          <RessincronizacaoTab 
            posts={posts}
            competitions={competitions}
            settings={settings}
            syncDetailCompId={syncDetailCompId}
            setSyncDetailCompId={setSyncDetailCompId}
            syncing={syncing}
            syncingCompId={syncingCompId}
            sessionSyncedIds={sessionSyncedIds}
            setSessionSyncedIds={setSessionSyncedIds}
            syncingPostId={syncingPostId}
            setSyncingPostId={setSyncingPostId}
            syncProgress={syncProgress}
            syncTotal={syncTotal}
            selectedResyncPostIds={selectedResyncPostIds}
            setSelectedResyncPostIds={setSelectedResyncPostIds}
            handleSyncCompetitionSequentially={handleSyncCompetitionSequentially}
            handleSyncCompetitionParallel={handleSyncCompetitionParallel}
            handleSyncAllSequentially={handleSyncAllSequentially}
            handleSyncAllParallel={handleSyncAllParallel}
            handleBulkForceMonthly={handleBulkForceMonthly}
            handleBulkForceDaily={handleBulkForceDaily}
            handleBulkResetMetrics={handleBulkResetMetrics}
            handleBulkSyncSelected={handleBulkSyncSelected}
            apifyKey={apifyKey}
            setApifyKey={setApifyKey}
            handleSaveApiKey={handleSaveApiKey}
            handleDeleteApiKey={handleDeleteApiKey}
            onForceMonthly={onForceMonthly}
            onForceDaily={onForceDaily}
            onResetToSync={onResetToSync}
            onSingleSync={onSingleSync}
            setRejectionReason={setRejectionReason}
            setRejectionModal={setRejectionModal}
            handleMovePostToCompetition={handleMovePostToCompetition}
            pendingMoves={pendingMoves}
            setPendingMoves={setPendingMoves}
            selectedAdminHandle={selectedNetworkUserId}
            setSelectedAdminHandle={setSelectedNetworkUserId}
            adminHandles={Array.from(new Set(posts.map(p => p.accountHandle).filter(Boolean) as string[]))}
          />
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
                      <option value="concluido">CONCLUáDO</option>
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
              <h3 className="text-2xl font-black uppercase tracking-tight gold-gradient">Configuração do Croná´metro</h3>
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
                    onClick={() => setLocalTimerEnabled(!localTimerEnabled)}
                    className={`w-full p-6 rounded-3xl border cursor-pointer transition-all flex items-center justify-between ${localTimerEnabled ? 'bg-amber-500/10 border-amber-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
                  >
                    <div className="space-y-1">
                      <p className={`text-sm font-black uppercase ${localTimerEnabled ? 'text-amber-500' : 'text-zinc-500'}`}>
                        {localTimerEnabled ? 'Timer Ativado' : 'Timer Desativado'}
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
                    value={localTimerTargetTime || '20:15'}
                    onChange={(e) => {
                      setLocalTimerTargetTime(e.target.value);
                      setLocalTimerEndTime(null);
                    }}
                    className="w-full bg-black border border-zinc-800 rounded-3xl py-6 px-8 text-xl font-black text-amber-500 focus:border-amber-500 outline-none transition-all shadow-inner text-center"
                  />
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest px-1 text-center">O croná´metro reiniciará automaticamente todos os dias neste horário.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-zinc-500" /> Ou Data Específica (Legacy)
                  </label>
                  <input
                    type="datetime-local"
                    value={localTimerEndTime ? new Date(localTimerEndTime).toISOString().slice(0, 16) : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value).getTime() : null;
                      setLocalTimerEndTime(date);
                      setLocalTimerTargetTime(''); // Reseta o targetTime ao usar data fixa
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
                    value={localTimerMessage}
                    onChange={(e) => setLocalTimerMessage(e.target.value)}
                    placeholder="Ex: Novos desafios liberados em:"
                    className="w-full bg-black border border-zinc-800 rounded-3xl py-6 px-8 text-sm font-bold focus:border-amber-500 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 relative z-10 pt-4 border-t border-zinc-800/50">
                <button
                  onClick={onSaveTimerConfig}
                  className="w-full py-5 bg-amber-500 text-black font-black rounded-[28px] hover:scale-[1.01] transition-all flex items-center justify-center gap-3 shadow-xl shadow-amber-500/20"
                >
                  <Save className="w-5 h-5" />
                  SALVAR CONFIGURAÇÕES DO TIMER
                </button>
              </div>


              <div className="pt-4 border-t border-zinc-900/50 flex items-center gap-4 relative z-10">
                <div className={`p-4 rounded-2xl ${timerConfig.enabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'} border border-current/20 flex items-center gap-3 flex-1`}>
                  {timerConfig.enabled ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <div>
                        <p className="text-[10px] font-black uppercase">Sistema Ativo</p>
                        <p className="text-[9px] font-bold opacity-70">O timer está configurado para resetar á s {timerConfig.targetTime || '20:15'}.</p>
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
        ) : tab === 'RELATORIOS' && (userRole === 'admin' || userRole === 'auditor') ? (
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
                      <ListHeader columns={['PLATAFORMA', 'LINK DO VáDEO', 'USUÁRIO CRIADOR', 'CURTIDAS', 'VIEWS', 'STATUS DO LINK']} gridClass="grid-cols-[100px_minmax(0,1.5fr)_minmax(0,1fr)_100px_100px_120px]" />
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
                              STATUS: {post.status === 'deleted' ? 'EXCLUáDO MANUALMENTE' : 'REJEITADO'}
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
      <AdminRoleChallengeModal
        isOpen={showRoleChallenge}
        inputValue={roleChallengeInput}
        setInputValue={setRoleChallengeInput}
        onConfirm={handleConfirmRoleChallenge}
        onCancel={() => {
          setShowRoleChallenge(false);
          setRoleChallengeInput('');
          setPendingRoleAction(null);
        }}
      />
    </div>
  );
};

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

const AdminRoleChallengeModal = ({
  isOpen,
  onConfirm,
  onCancel,
  inputValue,
  setInputValue
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  inputValue: string;
  setInputValue: (val: string) => void;
}) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-black/95 backdrop-blur-xl"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-zinc-950 p-10 rounded-[40px] border border-red-500/20 space-y-8 text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-red-500/10 rounded-[32px] flex items-center justify-center mx-auto border border-red-500/20">
            <ShieldAlert className="w-10 h-10 text-red-500" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight uppercase text-white">Ação Restrita</h3>
            <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest leading-relaxed">
              Você está tentando promover um usuário a <span className="text-red-500">ADMINISTRADOR</span>.
              Digite a palavra-chave mestra para autorizar:
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="password"
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
              placeholder="PALAVRA-CHAVE MESTRA"
              className="w-full bg-black border border-zinc-800 rounded-2xl py-5 px-6 text-xl font-black text-center text-white tracking-[0.5em] focus:border-red-500 outline-none transition-all placeholder:tracking-normal placeholder:text-[10px]"
            />
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onConfirm}
              className="w-full py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-500 transition-all shadow-lg shadow-red-600/20"
            >
              AUTORIZAR MUDANÇA
            </button>
            <button
              onClick={onCancel}
              className="w-full py-4 bg-zinc-900/50 text-zinc-500 font-black rounded-2xl hover:text-zinc-300 transition-all"
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
