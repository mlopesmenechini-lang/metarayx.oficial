const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const fbConfig = require('./firebase-applet-config.json');

const app = initializeApp(fbConfig);
const db = getFirestore(app);

async function start() {
    console.log('--- LIMPANDO ESTATÍSTICAS RESIDUAIS ---');
    
    const usersSnap = await getDocs(collection(db, 'users'));
    const compsSnap = await getDocs(collection(db, 'competitions'));
    const activeComps = compsSnap.docs.filter(d => d.data().isActive).map(d => d.id);

    for (const uDoc of usersSnap.docs) {
        const userData = uDoc.data();
        const updates = {};
        let needsUpdate = false;

        if (userData.competitionStats) {
            activeComps.forEach(compId => {
                if (userData.competitionStats[compId]) {
                    updates[`competitionStats.${compId}.dailyInstaPosts`] = 0;
                    updates[`competitionStats.${compId}.dailyPosts`] = 0;
                    updates[`competitionStats.${compId}.dailyViews`] = 0;
                    needsUpdate = true;
                }
            });
        }

        if (needsUpdate) {
            console.log(`Limpando usuário: ${userData.displayName || uDoc.id}`);
            await updateDoc(doc(db, 'users', uDoc.id), updates);
        }
    }

    console.log('--- LIMPEZA CONCLUÍDA ---');
    process.exit(0);
}

start().catch(err => {
    console.error('Erro na limpeza:', err);
    process.exit(1);
});
