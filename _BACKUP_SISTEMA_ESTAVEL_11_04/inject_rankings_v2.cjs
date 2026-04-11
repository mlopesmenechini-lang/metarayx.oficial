const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const fbConfig = require('./firebase-applet-config.json');

const app = initializeApp(fbConfig);
const db = getFirestore(app);

const TARGET_COMP_NAME = 'Danilo e Davi';

const manualRanking = [
  { name: 'Protta', views: 55251, likes: 709, posts: 10 },
  { name: 'Luiz', views: 21770, likes: 683, posts: 9 },
  { name: 'Regina Ramos', views: 20078, likes: 313, posts: 20 },
  { name: 'Adriana de Lima', views: 15084, likes: 306, posts: 18 },
  { name: 'Jessica Reis', views: 7212, likes: 233, posts: 16 },
  { name: 'Rodrigo MRX', views: 8475, likes: 185, posts: 13 },
  { name: 'Polyanne', views: 6420, likes: 142, posts: 11 },
  { name: 'Paula de Paula', views: 10009, likes: 130, posts: 17 },
  { name: 'Abibe', views: 8858, likes: 124, posts: 9 },
  { name: 'Matheus Menechini', views: 4791, likes: 105, posts: 9 },
  { name: 'Rafaela cardoso', views: 6539, likes: 96, posts: 9 },
  { name: 'Vive', views: 4763, likes: 85, posts: 9 },
  { name: 'Francielli Silva', views: 4278, likes: 75, posts: 7 }
];

async function start() {
    console.log('--- INICIANDO INJEÇÃO V2 ---');
    
    const compsSnap = await getDocs(collection(db, 'competitions'));
    const targetComp = compsSnap.docs.find(d => d.data().title.includes(TARGET_COMP_NAME));
    if (!targetComp) { console.error('Erro: Competição não encontrada'); process.exit(1); }
    const compId = targetComp.id;

    const usersSnap = await getDocs(collection(db, 'users'));
    const usersList = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const item of manualRanking) {
        const cleanSearch = item.name.toLowerCase();
        const userMatch = usersList.find(u => u.displayName?.toLowerCase().includes(cleanSearch));

        if (userMatch) {
            console.log(`Atualizando ${userMatch.displayName}...`);
            const userRef = doc(db, 'users', userMatch.id);
            
            await updateDoc(userRef, {
                [`competitionStats.${compId}.views`]: item.views,
                [`competitionStats.${compId}.likes`]: item.likes,
                [`competitionStats.${compId}.posts`]: item.posts,
                [`competitionStats.${compId}.dailyViews`]: item.views,
                [`competitionStats.${compId}.dailyLikes`]: item.likes,
                [`competitionStats.${compId}.dailyPosts`]: item.posts,
                // Garantir campos globais para visibilidade
                totalViews: item.views,
                totalLikes: item.likes,
                totalPosts: item.posts,
                dailyViews: item.views,
                dailyLikes: item.likes
            });
            console.log(`\tOK: ${item.views} views / ${item.posts} posts`);
        } else {
            console.warn(`Aviso: "${item.name}" não encontrado.`);
        }
    }

    console.log('--- CONCLUÍDO ---');
    process.exit(0);
}

start().catch(err => { console.error(err); process.exit(1); });
