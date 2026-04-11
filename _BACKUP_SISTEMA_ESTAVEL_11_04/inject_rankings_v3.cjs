const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const fbConfig = require('./firebase-applet-config.json');

const app = initializeApp(fbConfig);
const db = getFirestore(app);

const TARGET_COMP_NAME = 'Danilo e Davi';

const manualRanking = [
  { name: 'Protta', views: 55251, likes: 709, comms: 0, shares: 1, saves: 2, posts: 10 },
  { name: 'Luiz', views: 21770, likes: 683, comms: 7, shares: 6, saves: 24, posts: 9 },
  { name: 'Regina Ramos', views: 20078, likes: 313, comms: 2, shares: 5, saves: 4, posts: 20 },
  { name: 'Adriana de Lima', views: 15084, likes: 306, comms: 1, shares: 0, saves: 2, posts: 18 },
  { name: 'Jessica Reis', views: 7212, likes: 233, comms: 2, shares: 0, saves: 1, posts: 16 },
  { name: 'Rodrigo MRX', views: 8475, likes: 185, comms: 2, shares: 1, saves: 7, posts: 13 },
  { name: 'Polyanne', views: 6420, likes: 142, comms: 0, shares: 2, saves: 0, posts: 11 },
  { name: 'Paula de Paula', views: 10009, likes: 130, comms: 0, shares: 1, saves: 4, posts: 17 },
  { name: 'Abibe', views: 8858, likes: 124, comms: 2, shares: 0, saves: 0, posts: 9 },
  { name: 'Matheus Menechini', views: 4791, likes: 105, comms: 0, shares: 0, saves: 1, posts: 9 },
  { name: 'Rafaela cardoso', views: 6539, likes: 96, comms: 2, shares: 0, saves: 1, posts: 9 },
  { name: 'Vive', views: 4763, likes: 85, comms: 0, shares: 1, saves: 0, posts: 9 },
  { name: 'Francielli Silva', views: 4278, likes: 75, comms: 0, shares: 0, saves: 0, posts: 7 }
];

async function start() {
    console.log('--- INICIANDO INJEÇÃO FINAL V3 ---');
    
    const compsSnap = await getDocs(collection(db, 'competitions'));
    const targetComp = compsSnap.docs.find(d => d.data().title.includes(TARGET_COMP_NAME));
    const compId = targetComp.id;

    const usersSnap = await getDocs(collection(db, 'users'));
    const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const item of manualRanking) {
        const cleanSearch = item.name.toLowerCase();
        const userMatch = usersList.find(u => u.displayName?.toLowerCase().includes(cleanSearch));

        if (userMatch) {
            console.log(`Atualizando TUDO para ${userMatch.displayName}...`);
            const userRef = doc(db, 'users', userMatch.id);
            
            await updateDoc(userRef, {
                [`competitionStats.${compId}.views`]: item.views,
                [`competitionStats.${compId}.likes`]: item.likes,
                [`competitionStats.${compId}.comments`]: item.comms,
                [`competitionStats.${compId}.shares`]: item.shares,
                [`competitionStats.${compId}.saves`]: item.saves,
                [`competitionStats.${compId}.posts`]: item.posts,
                
                [`competitionStats.${compId}.dailyViews`]: item.views,
                [`competitionStats.${compId}.dailyLikes`]: item.likes,
                [`competitionStats.${compId}.dailyComments`]: item.comms,
                [`competitionStats.${compId}.dailyShares`]: item.shares,
                [`competitionStats.${compId}.dailySaves`]: item.saves,
                [`competitionStats.${compId}.dailyPosts`]: item.posts,

                totalViews: item.views,
                totalLikes: item.likes,
                totalComments: item.comms,
                totalShares: item.shares,
                totalSaves: item.saves,
                totalPosts: item.posts
            });
            console.log(`\tSucesso total.`);
        }
    }
    console.log('--- CONCLUÍDO ---');
    process.exit(0);
}

start().catch(err => { console.error(err); process.exit(1); });
