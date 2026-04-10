const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const { readFileSync } = require('fs');

// Lendo a configuração
const fbConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(fbConfig);
const db = getFirestore(app);
const targetCompId = 'bJSz1HZAiLi0aKlIi1es'; // Danilo e Davi

async function safeDailyReset() {
    console.log('--- INICIANDO RESET SEGURO (APENAS DIÁRIO) ---');
    console.log(`Competição Alvo: ${targetCompId}`);
    
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let updatedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (userData.competitionStats && userData.competitionStats[targetCompId]) {
            console.log(`Limpando diário do usuário: ${userData.displayName || userDoc.id}`);
            
            const userRef = doc(db, 'users', userDoc.id);
            const base = `competitionStats.${targetCompId}`;
            
            await updateDoc(userRef, {
                [`${base}.dailyViews`]: 0,
                [`${base}.dailyLikes`]: 0,
                [`${base}.dailyComments`]: 0,
                [`${base}.dailyShares`]: 0,
                [`${base}.dailySaves`]: 0,
                [`${base}.dailyPosts`]: 0,
                [`${base}.dailyInstaPosts`]: 0
            });
            updatedCount++;
        }
    }

    console.log(`\n--- CONCLUSÃO ---`);
    console.log(`Total de usuários resetados (Diário): ${updatedCount}`);
    console.log('O Ranking Mensal NÃO foi alterado.');
    process.exit(0);
}

safeDailyReset().catch(err => {
    console.error('Erro ao resetar diariamente:', err);
    process.exit(1);
});
