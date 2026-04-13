import { db, doc, updateDoc, getDocs, collection, query, where, getDoc } from '../firebase';
import { Post, User } from '../types';

const runActorAndGetResults = async (apiKeys: string | string[], actorId: string, input: any) => {
  const keys = Array.isArray(apiKeys) ? apiKeys : [apiKeys];
  let lastError: any = null;

  for (const apiKey of keys) {
    try {
      // Start the run
      const runResponse = await fetch(`https://api.apify.com/v2/acts/${actorId.replace('/', '~')}/runs?token=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });

      if (!runResponse.ok) {
        const error = await runResponse.json();
        const status = runResponse.status;
        const errorMessage = error.error?.message || runResponse.statusText;
        
        // Se for erro de autenticação ou cota, tenta a próxima chave
        if (status === 401 || status === 402 || errorMessage.toLowerCase().includes('token') || errorMessage.toLowerCase().includes('credit')) {
          console.warn(`Chave Apify falhou (Status ${status}). Tentando próxima chave...`);
          lastError = new Error(`Apify Error (${actorId}): ${errorMessage}`);
          continue;
        }
        
        throw new Error(`Apify Error (${actorId}): ${errorMessage}`);
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

    } catch (err: any) {
      lastError = err;
      // Se for erro de rede ou algo que sugira tentar a próxima chave, continue.
      // Caso contrário, se for um erro específico do Actor, talvez não adiante mudar a chave.
      // Por simplicidade, vamos tentar a próxima chave em caso de qualquer falha na execução inicial.
      console.warn(`Erro na execução com chave atual: ${err.message}. Tentando próxima...`);
    }
  }

  throw lastError || new Error(`Todas as ${keys.length} chaves API falharam.`);
};

export const updateUserMetrics = async (userId: string, skipDaily: boolean = false) => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const userData = userSnap.data() as User;
  const userPostsQuery = query(collection(db, 'posts'), where('userId', '==', userId), where('status', 'in', ['approved', 'synced']));
  const userPostsSnapshot = await getDocs(userPostsQuery);
  
  // Fetch active competitions to get their lastDailyReset
  // Buscamos TODAS as competições (não apenas as ativas) para garantir que posts de competições 
  // finalizadas ou arquivadas também respeitem o carimbo de lastDailyReset nas métricas diárias.
  const compsSnapshot = await getDocs(collection(db, 'competitions'));
  const activeComps = compsSnapshot.docs.reduce((acc, d) => {
    acc[d.id] = d.data();
    return acc;
  }, {} as Record<string, any>);
  
  const now = new Date();
  
  // A virada oficial do "painel de ranking" só acontece na meia-noite.
  // Então o ciclo base atual SEMPRE termina às 20:05 do dia corrente,
  // e começa às 20h cravado do dia anterior.
  const activeCycleEnd = new Date(now);
  activeCycleEnd.setHours(20, 5, 59, 999);

  const activeCycleStart = new Date(activeCycleEnd);
  activeCycleStart.setDate(activeCycleStart.getDate() - 1);
  activeCycleStart.setHours(20, 0, 0, 0);

  const target20hMs = activeCycleStart.getTime();
  const end20hMs = activeCycleEnd.getTime();

  const globalTotals = {
    views: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: 0, instaPosts: 0,
    dailyViews: skipDaily ? (userData.dailyViews || 0) : 0, 
    dailyLikes: skipDaily ? (userData.dailyLikes || 0) : 0, 
    dailyComments: skipDaily ? (userData.dailyComments || 0) : 0, 
    dailyShares: skipDaily ? (userData.dailyShares || 0) : 0, 
    dailySaves: skipDaily ? (userData.dailySaves || 0) : 0, 
    dailyPosts: skipDaily ? (userData.dailyPosts || 0) : 0, 
    dailyInstaPosts: skipDaily ? (userData.dailyInstaPosts || 0) : 0
  };

  const competitionStats: Record<string, any> = {};
  
  // Initialize competitionStats with existing data to preserve persistent fields
  if (userData.competitionStats) {
    Object.keys(userData.competitionStats).forEach(cid => {
      const existing = userData.competitionStats?.[cid];
      competitionStats[cid] = {
        views: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: 0, instaPosts: 0,
        // Preserve daily metrics if we are skipping the update
        dailyViews: skipDaily ? (existing?.dailyViews || 0) : 0,
        dailyLikes: skipDaily ? (existing?.dailyLikes || 0) : 0,
        dailyComments: skipDaily ? (existing?.dailyComments || 0) : 0,
        dailyShares: skipDaily ? (existing?.dailyShares || 0) : 0,
        dailySaves: skipDaily ? (existing?.dailySaves || 0) : 0,
        dailyPosts: skipDaily ? (existing?.dailyPosts || 0) : 0,
        dailyInstaPosts: skipDaily ? (existing?.dailyInstaPosts || 0) : 0,
        balance: existing?.balance || 0,
        paidTotal: existing?.paidTotal || 0
      };
    });
  }

  userPostsSnapshot.docs.forEach((doc) => {
    const data = doc.data() as Post;
    const cid = data.competitionId || 'no_competition';

    // O horário real em que o post foi feito na plataforma (ou fallback de aprovação)
    const truePostTime = data.timestamp || data.approvedAt || 0;
    
    // Calcula as bordas dinâmicas: Se o Admin já encerrou (zerou) o dia depois das 20:05,
    // o ciclo já virou para amanhã para esta competição específica.
    const lastDailyReset = activeComps[cid]?.lastDailyReset || 0;
    let postTarget20hMs = target20hMs;
    let postEnd20hMs = end20hMs;

    if (lastDailyReset >= end20hMs) {
      const nextStart = new Date(activeCycleEnd);
      nextStart.setHours(20, 0, 0, 0);
      const nextEnd = new Date(nextStart);
      nextEnd.setDate(nextEnd.getDate() + 1);
      nextEnd.setHours(20, 5, 59, 999);
      postTarget20hMs = nextStart.getTime();
      postEnd20hMs = nextEnd.getTime();
    }

    // Um post conta para os quantitativos diários estritamente se foi publicado dentro da janela
    // do horário das 20h. E a janela ativa permanece até a meia-noite visualmente, a menos que o admin feche-a primeiro.
    // TRAVA DE SEGURANÇA: Se o horário do post for anterior ao último Reset Diário desta competição, 
    // ele NUNCA entra no diário (evita "ressurreição" pós-pagamento).
    const isAfterReset = truePostTime > lastDailyReset;
    const isNewDailyPost = !data.forceMonthly && isAfterReset && (data.forceDaily || (truePostTime >= postTarget20hMs && truePostTime < postEnd20hMs));
    
    // Engagement Gain logic:
    const viewsGain = Math.max(0, (data.views || 0) - (data.viewsBaseline || 0));
    const likesGain = Math.max(0, (data.likes || 0) - (data.likesBaseline || 0));
    const commentsGain = Math.max(0, (data.comments || 0) - (data.commentsBaseline || 0));
    const sharesGain = Math.max(0, (data.shares || 0) - (data.sharesBaseline || 0));
    const savesGain = Math.max(0, (data.saves || 0) - (data.savesBaseline || 0));
    
    const isInsta = data.platform === 'instagram';

    if (!competitionStats[cid]) {
      competitionStats[cid] = {
        views: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: 0, instaPosts: 0,
        dailyViews: 0, dailyLikes: 0, dailyComments: 0, dailyShares: 0, dailySaves: 0, dailyPosts: 0, dailyInstaPosts: 0,
        balance: 0, paidTotal: 0
      };
    }

    // Update Competition Totals (Monthly/Overall)
    competitionStats[cid].views += (data.views || 0);
    competitionStats[cid].likes += (data.likes || 0);
    competitionStats[cid].comments += (data.comments || 0);
    competitionStats[cid].shares += (data.shares || 0);
    competitionStats[cid].saves += (data.saves || 0);
    competitionStats[cid].posts += 1;
    if (isInsta) competitionStats[cid].instaPosts += 1;

    // Update Competition Daily Stats (Gains) - ONLY if not skipped AND not forced to monthly
    // forceMonthly=true remove o post COMPLETAMENTE do diário: sem gains, sem contagem
    if (!skipDaily && !data.forceMonthly) {
      // O usuário pediu explicitamente: "sómente as views reais de quem foi aprovado hoje nao quero nenhum resquicio"
      // Então NENHUM ganho de engajamento de posts antigos deve entrar no Ranking Diário.
      // O post SÓ pontua no diário se pertencer ao ciclo atual (isNewDailyPost).
      if (isNewDailyPost) {
        competitionStats[cid].dailyViews += viewsGain;
        competitionStats[cid].dailyLikes += likesGain;
        competitionStats[cid].dailyComments += commentsGain;
        competitionStats[cid].dailyShares += sharesGain;
        competitionStats[cid].dailySaves += savesGain;
        competitionStats[cid].dailyPosts += 1;
        if (isInsta) competitionStats[cid].dailyInstaPosts += 1;
      }
    }

    // Update Global Totals
    globalTotals.views += (data.views || 0);
    globalTotals.likes += (data.likes || 0);
    globalTotals.comments += (data.comments || 0);
    globalTotals.shares += (data.shares || 0);
    globalTotals.saves += (data.saves || 0);
    globalTotals.posts += 1;
    if (isInsta) globalTotals.instaPosts += 1;

    if (!skipDaily && !data.forceMonthly) {
      if (isNewDailyPost) {
        globalTotals.dailyViews += viewsGain;
        globalTotals.dailyLikes += likesGain;
        globalTotals.dailyComments += commentsGain;
        globalTotals.dailyShares += sharesGain;
        globalTotals.dailySaves += savesGain;
        globalTotals.dailyPosts += 1;
        if (isInsta) globalTotals.dailyInstaPosts += 1;
      }
    }
  });

  // Prepare final update object
  const finalUpdate: any = {
    totalViews: globalTotals.views,
    totalLikes: globalTotals.likes,
    totalComments: globalTotals.comments,
    totalShares: globalTotals.shares,
    totalSaves: globalTotals.saves,
    totalPosts: globalTotals.posts,
    instaPosts: globalTotals.instaPosts,
    competitionStats: competitionStats,
    // Always include daily stats in the object since competitionStats was updated
    dailyViews: globalTotals.dailyViews,
    dailyLikes: globalTotals.dailyLikes,
    dailyComments: globalTotals.dailyComments,
    dailyShares: globalTotals.dailyShares,
    dailySaves: globalTotals.dailySaves,
    dailyPosts: globalTotals.dailyPosts,
    dailyInstaPosts: globalTotals.dailyInstaPosts
  };

  await updateDoc(userRef, finalUpdate);
};

export const repairAllUserMetrics = async (skipDaily: boolean = false) => {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const results = { total: usersSnapshot.size, success: 0, error: 0 };
  
  for (const userDoc of usersSnapshot.docs) {
    try {
      await updateUserMetrics(userDoc.id, skipDaily);
      results.success++;
    } catch (err) {
      console.error(`Error repairing user ${userDoc.id}:`, err);
      results.error++;
    }
  }
  return results;
};

const formatYoutubeUrl = (url: string) => {
  if (url.includes('/shorts/')) {
    const videoId = url.split('/shorts/')[1]?.split('?')[0];
    if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return url;
};

export const syncSinglePostWithApify = async (apiKeys: string | string[], post: Post, skipDaily: boolean = false) => {
  const apiKey = Array.isArray(apiKeys) ? apiKeys[0] : apiKeys; 
  if (!apiKey) throw new Error('Apify API Key is required.');

  let items: any[] = [];
  if (post.platform === 'tiktok') {
    items = await runActorAndGetResults(apiKey, 'clockworks/tiktok-scraper', {
      postURLs: [post.url],
      resultsPerPage: 1,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
    });
  } else if (post.platform === 'youtube') {
    const formattedUrl = formatYoutubeUrl(post.url);
    items = await runActorAndGetResults(apiKey, 'streamers/youtube-scraper', {
      startUrls: [{ url: formattedUrl }],
      maxResults: 1,
    });
  } else if (post.platform === 'instagram') {
    items = await runActorAndGetResults(apiKey, 'apify/instagram-scraper', {
      directUrls: [post.url],
      resultsType: 'posts',
      searchLimit: 1,
    });
  }

  // Prepare new metrics
  let newViews = 0, newLikes = 0, newComments = 0, newShares = 0, newSaves = 0;

  if (items.length > 0) {
    const item = items[0];
    if (post.platform === 'tiktok') {
      newViews = item.playCount || item.videoPlayCount || item.viewCount || 0;
      newLikes = item.diggCount || item.likesCount || item.likeCount || item.likes || 0;
      newComments = item.commentCount || 0;
      newShares = item.shareCount || 0;
      newSaves = item.collectCount || 0;
    } else if (post.platform === 'youtube') {
      newViews = item.viewCount || item.statistics?.viewCount || 0;
      newLikes = item.likeCount || item.likesCount || item.likes || item.statistics?.likeCount || 0;
      newComments = item.commentCount || item.statistics?.commentCount || 0;
    } else if (post.platform === 'instagram') {
      newViews = item.videoPlayCount || item.videoViewCount || item.displayResources?.[0]?.videoViewCount || 0;
      newLikes = item.likesCount || 0;
      newComments = item.commentsCount || 0;
    }

    const updateData: any = {
      views: newViews,
      likes: newLikes,
      comments: newComments,
      shares: newShares,
      saves: newSaves,
    };

    await updateDoc(doc(db, 'posts', post.id), updateData);
  }

  await updateUserMetrics(post.userId, skipDaily);
};

export const syncViewsWithApify = async (apiKeys: string | string[]) => {
  const keys = Array.isArray(apiKeys) ? apiKeys : [apiKeys];
  if (keys.length === 0 || !keys[0]) {
    throw new Error('Apify API Key is required for synchronization.');
  }

  const postsQuery = query(collection(db, 'posts'), where('status', 'in', ['approved', 'synced']));
  const postsSnapshot = await getDocs(postsQuery);
  const posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));

  if (posts.length === 0) return;

  const tiktokPosts = posts.filter(p => p.platform === 'tiktok');
  const youtubePosts = posts.filter(p => p.platform === 'youtube');
  const instagramPosts = posts.filter(p => p.platform === 'instagram');

  const compsSnapshot = await getDocs(query(collection(db, 'competitions'), where('isActive', '==', true)));
  const activeComps = compsSnapshot.docs.reduce((acc, d) => {
    acc[d.id] = { id: d.id, ...d.data() };
    return acc;
  }, {} as Record<string, any>);

  const splitList = <T>(list: T[]): [T[], T[]] => {
    const half = Math.ceil(list.length / 2);
    return [list.slice(0, half), list.slice(half)];
  };

  const processItems = async (items: any[], platform: string, sourcePosts: Post[]) => {
    for (const item of items) {
      const videoUrl = item.webVideoUrl || item.url;
      if (!videoUrl) continue;
      
      const post = sourcePosts.find(p => {
        const pUrl = platform === 'youtube' ? formatYoutubeUrl(p.url) : p.url;
        return pUrl.includes(videoUrl as string) || 
               (videoUrl as string).includes(pUrl) ||
               pUrl.split('?')[0] === (videoUrl as string).split('?')[0];
      });
      
      if (post) {
        let newViews = 0, newLikes = 0, newComments = 0, newShares = 0, newSaves = 0;
        
        if (platform === 'tiktok') {
          newViews = item.playCount || item.videoPlayCount || item.viewCount || 0;
          newLikes = item.diggCount || item.likesCount || item.likeCount || item.likes || 0;
          newComments = item.commentCount || 0;
          newShares = item.shareCount || 0;
          newSaves = item.collectCount || 0;
        } else if (platform === 'youtube') {
          newViews = item.viewCount || item.statistics?.viewCount || 0;
          newLikes = item.likeCount || item.likesCount || item.likes || item.statistics?.likeCount || 0;
          newComments = item.commentCount || item.statistics?.commentCount || 0;
        } else if (platform === 'instagram') {
          newViews = item.videoPlayCount || item.videoViewCount || item.displayResources?.[0]?.videoViewCount || 0;
          newLikes = item.likesCount || 0;
          newComments = item.commentsCount || 0;
        }

        const updateData: any = {
          views: newViews,
          likes: newLikes,
          comments: newComments,
          shares: newShares,
          saves: newSaves,
        };

        await updateDoc(doc(db, 'posts', post.id), updateData);
      }
    }
  };

  if (tiktokPosts.length > 0) {
    try {
      if (keys.length >= 2 && tiktokPosts.length >= 2) {
        const [groupA, groupB] = splitList(tiktokPosts);
        const [resultsA, resultsB] = await Promise.all([
          runActorAndGetResults(keys[0], 'clockworks/tiktok-scraper', {
            postURLs: groupA.map(p => p.url),
            resultsPerPage: groupA.length,
            shouldDownloadVideos: false,
            shouldDownloadCovers: false,
          }),
          runActorAndGetResults(keys[1], 'clockworks/tiktok-scraper', {
            postURLs: groupB.map(p => p.url),
            resultsPerPage: groupB.length,
            shouldDownloadVideos: false,
            shouldDownloadCovers: false,
          })
        ]);
        await Promise.all([processItems(resultsA, 'tiktok', groupA), processItems(resultsB, 'tiktok', groupB)]);
      } else {
        const items = await runActorAndGetResults(keys, 'clockworks/tiktok-scraper', {
          postURLs: tiktokPosts.map(p => p.url),
          resultsPerPage: tiktokPosts.length,
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
        });
        await processItems(items, 'tiktok', tiktokPosts);
      }
    } catch (error) { console.error('TikTok sync error:', error); }
  }

  if (youtubePosts.length > 0) {
    try {
      if (keys.length >= 2 && youtubePosts.length >= 2) {
        const [groupA, groupB] = splitList(youtubePosts);
        const [resultsA, resultsB] = await Promise.all([
          runActorAndGetResults(keys[0], 'streamers/youtube-scraper', {
            startUrls: groupA.map(p => ({ url: formatYoutubeUrl(p.url) })),
            maxResults: groupA.length,
          }),
          runActorAndGetResults(keys[1], 'streamers/youtube-scraper', {
            startUrls: groupB.map(p => ({ url: formatYoutubeUrl(p.url) })),
            maxResults: groupB.length,
          })
        ]);
        await Promise.all([processItems(resultsA, 'youtube', groupA), processItems(resultsB, 'youtube', groupB)]);
      } else {
        const items = await runActorAndGetResults(keys, 'streamers/youtube-scraper', {
          startUrls: youtubePosts.map(p => ({ url: formatYoutubeUrl(p.url) })),
          maxResults: youtubePosts.length,
        });
        await processItems(items, 'youtube', youtubePosts);
      }
    } catch (error) { console.error('YouTube sync error:', error); }
  }

  if (instagramPosts.length > 0) {
    try {
      if (keys.length >= 2 && instagramPosts.length >= 2) {
        const [groupA, groupB] = splitList(instagramPosts);
        const [resultsA, resultsB] = await Promise.all([
          runActorAndGetResults(keys[0], 'apify/instagram-scraper', {
            directUrls: groupA.map(p => p.url),
            resultsType: 'posts',
            searchLimit: groupA.length,
          }),
          runActorAndGetResults(keys[1], 'apify/instagram-scraper', {
            directUrls: groupB.map(p => p.url),
            resultsType: 'posts',
            searchLimit: groupB.length,
          })
        ]);
        await Promise.all([processItems(resultsA, 'instagram', groupA), processItems(resultsB, 'instagram', groupB)]);
      } else {
        const items = await runActorAndGetResults(keys, 'apify/instagram-scraper', {
          directUrls: instagramPosts.map(p => p.url),
          resultsType: 'posts',
          searchLimit: instagramPosts.length,
        });
        await processItems(items, 'instagram', instagramPosts);
      }
    } catch (error) { console.error('Instagram sync error:', error); }
  }

  const usersSnapshot = await getDocs(collection(db, 'users'));
  for (const userDoc of usersSnapshot.docs) {
    await updateUserMetrics(userDoc.id);
  }
};
