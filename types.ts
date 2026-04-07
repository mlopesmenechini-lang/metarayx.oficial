export type Platform = 'tiktok' | 'youtube' | 'instagram';
export type PostStatus = 'pending' | 'approved' | 'rejected' | 'synced' | 'banned';
export type UserRole = 'admin' | 'auditor' | 'administrativo' | 'user';

export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  isApproved: boolean;
  balance: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalPosts: number;
  dailyViews: number;
  dailyLikes: number;
  dailyComments: number;
  dailyShares: number;
  dailySaves: number;
  dailyPosts: number;
  dailyInstaPosts?: number;
  photoURL?: string;
  password?: string;
  lifetimeEarnings?: number;
  pixKey?: string;
  approvedAt?: number;
  // Social media handles
  tiktok?: string[];
  instagram?: string[];
  youtube?: string[];
  userInstagram?: string[];
  competitionStats?: Record<string, {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    posts: number;
    instaPosts: number;
    dailyViews: number;
    dailyLikes: number;
    dailyComments: number;
    dailyShares: number;
    dailySaves: number;
    dailyPosts: number;
    dailyInstaPosts: number;
    balance?: number;
    paidTotal?: number;
  }>;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  timestamp: number;
  type?: 'credit' | 'debit';
  description?: string;
  status: 'paid' | 'pending' | 'credit';
  auditorId?: string;
  userName?: string;
  competitionId?: string;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  url: string;
  normalizedUrl?: string;
  accountHandle?: string;
  platform: Platform;
  status: PostStatus;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  timestamp: number;
  competitionId?: string;
  approvedAt?: number;
}

export interface Season {
  id: string;
  name: string;
  isActive: boolean;
  startDate: number;
  endDate: number;
  rules: string;
}

export interface Announcement {
  id: string;
  message: string;
  isActive: boolean;
  timestamp: number;
  title?: string;
}

export interface Competition {
  id: string;
  title: string;
  description: string;
  bannerUrl: string;
  isActive: boolean;
  status?: 'active' | 'inactive' | 'upcoming';
  startDate: number;
  endDate: number;
  prizes: {
    position: number;
    value: number;
    label: string;
  }[];
  prizesDaily: {
    position: number;
    value: number;
    label: string;
  }[];
  prizesMonthly: {
    position: number;
    value: number;
    label: string;
  }[];
  prizesInstagram: {
    position: number;
    value: number;
    label: string;
  }[];
  timestamp: number;
  rules?: string;
  hashtags?: string;
  mentions?: string;
  bonuses?: string;
  viewBonus?: number;
  rankingMetric?: 'views' | 'likes';
  goalTarget?: number;
  goalMetric?: 'views' | 'likes';
  instaBonus?: string;
  lastDailyReset?: number;
}

export interface CompetitionRegistration {
  id: string;
  competitionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
  acceptedRules?: boolean;
}

export interface Suggestion {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  timestamp: number;
  status: 'pendente' | 'analise' | 'desenvolvimento' | 'concluido';
}
