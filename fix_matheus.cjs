const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = require('firebase/firestore');
const fbConfig = require('./firebase-applet-config.json');

const app = initializeApp(fbConfig);
const db = getFirestore(app);

const TARGET_COMP_NAME = 'Danilo e Davi';
const CORRECT_EMAIL = 'mlopesmenechini@gmail.com';
const DATA = { views: 4791, likes: 105, comms: 0, shares: 0, saves: 1, posts: 9 };

async function start() {
    console.log('--- CORRIGINDO CONTA MATHEUS ---');
    
    const compsSnap = await getDocs(collection(db, 'competitions'));
    const targetComp = compsSnap.docs.find(d => d.data().title.includes(TARGET_COMP_NAME));
    const compId = targetComp.id;

    // 1. Achar o Matheus correto pelo Email
    const q = query(collection(db, 'users'), where('email', '==', CORRECT_EMAIL));
    const snap = await getDocs(q);
    
    if (snap.empty) {
        console.error('Erro: Usuário com e-mail ' + CORRECT_EMAIL + ' não encontrado!');
        process.exit(1);
    }

    const correctUser = snap.docs[0];
    const userRef = doc(db, 'users', correctUser.id);
    
    console.log(`Atualizando conta correta: ${correctUser.data().displayName} (${CORRECT_EMAIL})`);

    await updateDoc(userRef, {
        [`competitionStats.${compId}.views`]: DATA.views,
        [`competitionStats.${compId}.likes`]: DATA.likes,
        [`competitionStats.${compId}.comments`]: DATA.comms,
        [`competitionStats.${compId}.shares`]: DATA.shares,
        [`competitionStats.${compId}.saves`]: DATA.saves,
        [`competitionStats.${compId}.posts`]: DATA.posts,
        
        [`competitionStats.${compId}.dailyViews`]: DATA.views,
        [`competitionStats.${compId}.dailyLikes`]: DATA.likes,
        [`competitionStats.${compId}.dailyComments`]: DATA.comms,
        [`competitionStats.${compId}.dailyShares`]: DATA.shares,
        [`competitionStats.${compId}.dailySaves`]: DATA.saves,
        [`competitionStats.${compId}.dailyPosts`]: DATA.posts,

        totalViews: DATA.views,
        totalLikes: DATA.likes,
        totalPosts: DATA.posts,
        dailyViews: DATA.views,
        dailyLikes: DATA.likes
    });

    // 2. Zerar o "Matheus" errado (o que tem '18' no nome que achei antes)
    const allUsers = await getDocs(collection(db, 'users'));
    const wrongUser = allUsers.docs.find(d => d.data().displayName?.includes('Matheus Menechini 18'));
    
    if (wrongUser && wrongUser.id !== correctUser.id) {
        console.log(`Zerando conta errada: ${wrongUser.data().displayName}`);
        await updateDoc(doc(db, 'users', wrongUser.id), {
            [`competitionStats.${compId}.views`]: 0,
            [`competitionStats.${compId}.likes`]: 0,
            [`competitionStats.${compId}.posts`]: 0
        });
    }

    console.log('--- CORREÇÃO CONCLUÍDA ---');
    process.exit(0);
}

start().catch(err => { console.error(err); process.exit(1); });
