const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const fbConfig = require('./firebase-applet-config.json');

const app = initializeApp(fbConfig);
const db = getFirestore(app);

async function start() {
    console.log('--- DIAGNÓSTICO DE COMPETIÇÕES ---');
    const compsSnap = await getDocs(collection(db, 'competitions'));
    compsSnap.docs.forEach(d => {
        console.log(`Comp: ${d.data().title} | ID: ${d.id} | Status: ${d.data().status}`);
    });

    const targetCompId = 'WlE7K32y1bAn3Qv2nZ9t'; // ID que vi no log anterior
    
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
      { name: 'Matheus Menechini', views: 4791, likes: 105, comms: 0, shares: 0, saves: 1, posts: 9, email: 'mlopesmenechini@gmail.com' },
      { name: 'Rafaela cardoso', views: 6539, likes: 96, comms: 2, shares: 0, saves: 1, posts: 9 },
      { name: 'Vive', views: 4763, likes: 85, comms: 0, shares: 1, saves: 0, posts: 9 },
      { name: 'Francielli Silva', views: 4278, likes: 75, comms: 0, shares: 0, saves: 0, posts: 7 }
    ];

    const usersSnap = await getDocs(collection(db, 'users'));
    const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log('\n--- INJETANDO DADOS ---');
    for (const item of manualRanking) {
        let user;
        if (item.email) {
            user = allUsers.find(u => u.email?.toLowerCase() === item.email.toLowerCase());
        } else {
            user = allUsers.find(u => u.displayName?.toLowerCase().includes(item.name.toLowerCase()));
        }

        if (user) {
            console.log(`Atualizando ${user.displayName} (${user.email || 'sem email'})...`);
            const userRef = doc(db, 'users', user.id);
            const stats = {
                views: item.views,
                likes: item.likes,
                comments: item.comms,
                shares: item.shares,
                saves: item.saves,
                posts: item.posts,
                dailyViews: item.views,
                dailyLikes: item.likes,
                dailyComments: item.comms,
                dailyShares: item.shares,
                dailySaves: item.saves,
                dailyPosts: item.posts,
                balance: 0 // Forçar saldo 0 para nova competição se necessário
            };

            await updateDoc(userRef, {
                [`competitionStats.${targetCompId}`]: stats,
                // redundância global
                totalViews: item.views,
                totalLikes: item.likes,
                totalPosts: item.posts,
                dailyViews: item.views,
                dailyLikes: item.likes
            });
            console.log('\tOK.');
        } else {
            console.warn(`AVISO: ${item.name} não encontrado.`);
        }
    }

    console.log('\n--- VERIFICAÇÃO FINAL ---');
    // Checar apenas um como prova
    const checkUser = allUsers.find(u => u.displayName === 'Protta 💡- MRX');
    if (checkUser) {
        console.log(`Provando injeção em Protta: ${JSON.stringify(checkUser.competitionStats?.[targetCompId])}`);
    }

    process.exit(0);
}

start().catch(console.error);
