export type Platform = 'tiktok' | 'youtube' | 'instagram';
export type PostStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'admin' | 'user';

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
  timestamp: number;
  rules?: string;
  hashtags?: string;
  mentions?: string;
  bonuses?: string;
  instaBonusPrize?: number;
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
