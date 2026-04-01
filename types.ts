export type Platform = 'tiktok' | 'youtube' | 'instagram';
export type PostStatus = 'pending' | 'approved' | 'rejected';
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
  password?: string; // Added for administrative management
  lifetimeEarnings?: number;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  timestamp: number;
  status: 'paid';
  auditorId?: string;
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  url: string;
  platform: Platform;
  status: PostStatus;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  timestamp: number;
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
  status: 'pending' | 'read' | 'implemented';
}
