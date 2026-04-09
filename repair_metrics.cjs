const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, updateDoc, query, where } = require('firebase/firestore');
const fbConfig = require('./firebase-applet-config.json');

const app = initializeApp(fbConfig);
const db = getFirestore(app);

async function updateUserMetrics(userId) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const userPostsQuery = query(collection(db, 'posts'), where('userId', '==', userId), where('status', 'in', ['approved', 'synced']));
  const userPostsSnapshot = await getDocs(userPostsQuery);
  
  const compsSnapshot = await getDocs(query(collection(db, 'competitions'), where('isActive', '==', true)));
  const activeComps = compsSnapshot.docs.reduce((acc, d) => {
    acc[d.id] = d.data();
    return acc;
  }, {});
  
  const globalTotals = {
    views: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: 0, instaPosts: 0,
    dailyViews: 0, dailyLikes: 0, dailyComments: 0, dailyShares: 0, dailySaves: 0, dailyPosts: 0, dailyInstaPosts: 0
  };

  const competitionStats = {};
  if (userData.competitionStats) {
    Object.keys(userData.competitionStats).forEach(cid => {
      competitionStats[cid] = {
        views: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: 0, instaPosts: 0,
        dailyViews: 0, dailyLikes: 0, dailyComments: 0, dailyShares: 0, dailySaves: 0, dailyPosts: 0, dailyInstaPosts: 0,
        balance: userData.competitionStats[cid].balance || 0,
        paidTotal: userData.competitionStats[cid].paidTotal || 0
      };
    });
  }

  userPostsSnapshot.docs.forEach((d) => {
    const data = d.data();
    const cid = data.competitionId || 'no_competition';
    const compConfig = activeComps[cid];
    const lastReset = compConfig?.lastDailyReset || 0;

    const postTime = (data.approvedAt || data.timestamp || 0);
    const isNewDailyPost = lastReset === 0 || postTime > lastReset;
    
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

    competitionStats[cid].views += (data.views || 0);
    competitionStats[cid].likes += (data.likes || 0);
    competitionStats[cid].comments += (data.comments || 0);
    competitionStats[cid].shares += (data.shares || 0);
    competitionStats[cid].saves += (data.saves || 0);
    competitionStats[cid].posts += 1;
    if (isInsta) competitionStats[cid].instaPosts += 1;

    competitionStats[cid].dailyViews += viewsGain;
    competitionStats[cid].dailyLikes += likesGain;
    competitionStats[cid].dailyComments += commentsGain;
    competitionStats[cid].dailyShares += sharesGain;
    competitionStats[cid].dailySaves += savesGain;
    
    if (isNewDailyPost) {
      competitionStats[cid].dailyPosts += 1;
      if (isInsta) competitionStats[cid].dailyInstaPosts += 1;
    }

    globalTotals.views += (data.views || 0);
    globalTotals.likes += (data.likes || 0);
    globalTotals.comments += (data.comments || 0);
    globalTotals.shares += (data.shares || 0);
    globalTotals.saves += (data.saves || 0);
    globalTotals.posts += 1;
    if (isInsta) globalTotals.instaPosts += 1;

    globalTotals.dailyViews += viewsGain;
    globalTotals.dailyLikes += likesGain;
    globalTotals.dailyComments += commentsGain;
    globalTotals.dailyShares += sharesGain;
    globalTotals.dailySaves += savesGain;
    
    if (isNewDailyPost) {
      globalTotals.dailyPosts += 1;
      if (isInsta) globalTotals.dailyInstaPosts += 1;
    }
  });
  
  await updateDoc(userRef, {
    totalViews: globalTotals.views,
    totalLikes: globalTotals.likes,
    totalComments: globalTotals.comments,
    totalShares: globalTotals.shares,
    totalSaves: globalTotals.saves,
    totalPosts: globalTotals.posts,
    instaPosts: globalTotals.instaPosts,
    dailyViews: globalTotals.dailyViews,
    dailyLikes: globalTotals.dailyLikes,
    dailyComments: globalTotals.dailyComments,
    dailyShares: globalTotals.dailyShares,
    dailySaves: globalTotals.dailySaves,
    dailyPosts: globalTotals.dailyPosts,
    dailyInstaPosts: globalTotals.dailyInstaPosts,
    competitionStats: competitionStats
  });
}

async function start() {
    console.log('Iniciando reparo de métricas...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    for (const userDoc of usersSnapshot.docs) {
        process.stdout.write(`Reparando usuário: ${userDoc.id}... `);
        await updateUserMetrics(userDoc.id);
        console.log('OK');
    }
    console.log('REPARO CONCLUÍDO COM SUCESSO!');
    process.exit(0);
}

start().catch(err => {
    console.error('ERRO NO REPARO:', err);
    process.exit(1);
});
