import { db, doc, updateDoc, getDocs, collection, query, where, getDoc } from '../firebase';
import { Post, User } from '../types';

const runActorAndGetResults = async (apiKey: string, actorId: string, input: any) => {
  // Start the run
  const runResponse = await fetch(`https://api.apify.com/v2/acts/${actorId.replace('/', '~')}/runs?token=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!runResponse.ok) {
    const error = await runResponse.json();
    throw new Error(`Apify Error: ${error.error?.message || runResponse.statusText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;
  const datasetId = runData.data.defaultDatasetId;

  // Poll for completion (simple version)
  let finished = false;
  let attempts = 0;
  while (!finished && attempts < 30) { // Max 5 minutes (10s intervals)
    await new Promise(r => setTimeout(r, 10000));
    const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`);
    const statusData = await statusResponse.json();
    if (statusData.data.status === 'SUCCEEDED') {
      finished = true;
    } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(statusData.data.status)) {
      throw new Error(`Actor run ${statusData.data.status}`);
    }
    attempts++;
  }

  if (!finished) throw new Error('Actor run timed out');

  // Get dataset items
  const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}`);
  return await itemsResponse.json();
};

export const updateUserMetrics = async (userId: string) => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const userData = userSnap.data() as User;
  const userPostsQuery = query(collection(db, 'posts'), where('userId', '==', userData.uid), where('status', '==', 'approved'));
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
  
  await updateDoc(userRef, {
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
};

const formatYoutubeUrl = (url: string) => {
  if (url.includes('/shorts/')) {
    const videoId = url.split('/shorts/')[1]?.split('?')[0];
    if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return url;
};

export const syncSinglePostWithApify = async (apiKey: string, post: Post) => {
  if (!apiKey) throw new Error('Apify API Key is required.');

  let items = [];
  if (post.platform === 'tiktok') {
    items = await runActorAndGetResults(apiKey, 'apify/tiktok-scraper', {
      postURLs: [post.url],
      resultsPerPage: 1,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    });
    
    if (items.length > 0) {
      const item = items[0];
      await updateDoc(doc(db, 'posts', post.id), {
        views: item.playCount || item.videoPlayCount || item.viewCount || 0,
        likes: item.diggCount || item.likesCount || item.likeCount || item.likes || 0,
        comments: item.commentCount || 0,
        shares: item.shareCount || 0,
        saves: item.collectCount || 0,
      });
    }
  } else if (post.platform === 'youtube') {
    const formattedUrl = formatYoutubeUrl(post.url);
    items = await runActorAndGetResults(apiKey, 'streamers/youtube-scraper', {
      startUrls: [{ url: formattedUrl }],
      maxResults: 1,
    });

    if (items.length > 0) {
      const item = items[0];
      await updateDoc(doc(db, 'posts', post.id), {
        views: item.viewCount || item.statistics?.viewCount || 0,
        likes: item.likeCount || item.likesCount || item.likes || item.statistics?.likeCount || 0,
        comments: item.commentCount || item.statistics?.commentCount || 0,
        shares: 0,
        saves: 0,
      });
    }
  } else if (post.platform === 'instagram') {
    items = await runActorAndGetResults(apiKey, 'apify/instagram-scraper', {
      directUrls: [post.url],
      resultsType: 'posts',
      searchLimit: 1,
    });

    if (items.length > 0) {
      const item = items[0];
      await updateDoc(doc(db, 'posts', post.id), {
        views: item.videoPlayCount || item.videoViewCount || item.displayResources?.[0]?.videoViewCount || 0,
        likes: item.likesCount || 0,
        comments: item.commentsCount || 0,
        shares: 0,
        saves: 0,
      });
    }
  }

  await updateUserMetrics(post.userId);
};

export const syncViewsWithApify = async (apiKey: string) => {
  if (!apiKey) {
    throw new Error('Apify API Key is required for synchronization.');
  }

  const postsQuery = query(collection(db, 'posts'), where('status', '==', 'approved'));
  const postsSnapshot = await getDocs(postsQuery);
  const posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));

  if (posts.length === 0) return;

  const tiktokPosts = posts.filter(p => p.platform === 'tiktok');
  const youtubePosts = posts.filter(p => p.platform === 'youtube');
  const instagramPosts = posts.filter(p => p.platform === 'instagram');

  if (tiktokPosts.length > 0) {
    try {
      const items = await runActorAndGetResults(apiKey, 'apify/tiktok-scraper', {
        postURLs: tiktokPosts.map(p => p.url),
        resultsPerPage: tiktokPosts.length,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      });
      
      for (const item of items) {
        const videoUrl = item.webVideoUrl || item.url;
        if (!videoUrl) continue;
        
        const post = tiktokPosts.find(p => 
          p.url.includes(videoUrl as string) || 
          (videoUrl as string).includes(p.url) ||
          p.url.split('?')[0] === (videoUrl as string).split('?')[0]
        );
        
        if (post) {
          await updateDoc(doc(db, 'posts', post.id), {
            views: item.playCount || item.videoPlayCount || item.viewCount || 0,
            likes: item.diggCount || item.likesCount || item.likeCount || item.likes || 0,
            comments: item.commentCount || 0,
            shares: item.shareCount || 0,
            saves: item.collectCount || 0,
          });
        }
      }
    } catch (error) {
      console.error('Error syncing TikTok posts:', error);
    }
  }

  if (youtubePosts.length > 0) {
    try {
      const items = await runActorAndGetResults(apiKey, 'streamers/youtube-scraper', {
        startUrls: youtubePosts.map(p => ({ url: formatYoutubeUrl(p.url) })),
        maxResults: youtubePosts.length,
      });

      for (const item of items) {
        const videoUrl = item.url || item.webVideoUrl;
        if (!videoUrl) continue;

        const post = youtubePosts.find(p => {
          const formattedPUrl = formatYoutubeUrl(p.url);
          return formattedPUrl.includes(videoUrl as string) || 
                 (videoUrl as string).includes(formattedPUrl) ||
                 formattedPUrl.split('?')[0] === (videoUrl as string).split('?')[0];
        });

        if (post) {
          await updateDoc(doc(db, 'posts', post.id), {
            views: item.viewCount || item.statistics?.viewCount || 0,
            likes: item.likeCount || item.likesCount || item.likes || item.statistics?.likeCount || 0,
            comments: item.commentCount || item.statistics?.commentCount || 0,
            shares: 0,
            saves: 0,
          });
        }
      }
    } catch (error) {
      console.error('Error syncing YouTube posts:', error);
    }
  }

  if (instagramPosts.length > 0) {
    try {
      const items = await runActorAndGetResults(apiKey, 'apify/instagram-scraper', {
        directUrls: instagramPosts.map(p => p.url),
        resultsType: 'posts',
        searchLimit: instagramPosts.length,
      });

      for (const item of items) {
        const videoUrl = item.url || item.webVideoUrl;
        if (!videoUrl) continue;

        const post = instagramPosts.find(p => 
          p.url.includes(videoUrl as string) || 
          (videoUrl as string).includes(p.url) ||
          p.url.split('?')[0] === (videoUrl as string).split('?')[0]
        );

        if (post) {
          await updateDoc(doc(db, 'posts', post.id), {
            views: item.videoPlayCount || item.videoViewCount || item.displayResources?.[0]?.videoViewCount || 0,
            likes: item.likesCount || 0,
            comments: item.commentsCount || 0,
            shares: 0,
            saves: 0,
          });
        }
      }
    } catch (error) {
      console.error('Error syncing Instagram posts:', error);
    }
  }

  const usersSnapshot = await getDocs(collection(db, 'users'));
  for (const userDoc of usersSnapshot.docs) {
    await updateUserMetrics(userDoc.id);
  }
};
