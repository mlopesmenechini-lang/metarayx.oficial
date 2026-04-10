const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where, limit } = require('firebase/firestore');
const fbConfig = require('./firebase-applet-config.json');

const app = initializeApp(fbConfig);
const db = getFirestore(app);

const TARGET_COMP_ID = 'bJSz1HZAiLi0aKlIi1es';

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
  { name: 'Matheus Menechini', email: 'mlopesmenechini@gmail.com', views: 4791, likes: 105, comms: 0, shares: 0, saves: 1, posts: 9 },
  { name: 'Rafaela cardoso', views: 6539, likes: 96, comms: 2, shares: 0, saves: 1, posts: 9 },
  { name: 'Vive', views: 4763, likes: 85, comms: 0, shares: 1, saves: 0, posts: 9 },
  { name: 'Francielli Silva', views: 4278, likes: 75, comms: 0, shares: 0, saves: 0, posts: 7 }
];

async function start() {
    console.log('--- INICIANDO ESTABILIZAÇÃO DE RANKING ---');
    
    const usersSnap = await getDocs(collection(db, 'users'));
    const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const item of manualRanking) {
        let userMatch = item.email ? allUsers.find(u => u.email === item.email) : allUsers.find(u => u.displayName?.toLowerCase().includes(item.name.toLowerCase()));

        if (userMatch) {
            console.log(`Estabilizando ${userMatch.displayName}...`);
            const uid = userMatch.id;

            // 1. Atualizar Estatísticas do Usuário
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                [`competitionStats.${TARGET_COMP_ID}.views`]: item.views,
                [`competitionStats.${TARGET_COMP_ID}.likes`]: item.likes,
                [`competitionStats.${TARGET_COMP_ID}.comments`]: item.comms,
                [`competitionStats.${TARGET_COMP_ID}.shares`]: item.shares,
                [`competitionStats.${TARGET_COMP_ID}.saves`]: item.saves,
                [`competitionStats.${TARGET_COMP_ID}.posts`]: item.posts,
                [`competitionStats.${TARGET_COMP_ID}.dailyViews`]: item.views,
                [`competitionStats.${TARGET_COMP_ID}.dailyLikes`]: item.likes
            });

            // 2. Tentar achar ao menos um post desse usuário nesta competição para injetar as views
            const postsQuery = query(
                collection(db, 'posts'), 
                where('userId', '==', uid), 
                where('competitionId', '==', TARGET_COMP_ID),
                limit(1)
            );
            const postsSnap = await getDocs(postsQuery);
            
            if (!postsSnap.empty) {
                const postDoc = postsSnap.docs[0];
                console.log(`\t-> Injetando métricas no post: ${postDoc.id}`);
                await updateDoc(doc(db, 'posts', postDoc.id), {
                    views: item.views,
                    likes: item.likes,
                    comments: item.comms,
                    shares: item.shares,
                    saves: item.saves,
                    viewsBaseline: 0, // Resetar baselines para garantir que Views - Baseline = Total
                    likesBaseline: 0,
                    commentsBaseline: 0,
                    sharesBaseline: 0,
                    savesBaseline: 0,
                    lastSync: Date.now()
                });
            } else {
                console.warn(`\t-> AVISO: Nenhum documento de POST encontrado para ${userMatch.displayName} nesta competição.`);
            }
        }
    }

    console.log('--- ESTABILIZAÇÃO CONCLUÍDA ---');
    process.exit(0);
}

start().catch(console.error);
