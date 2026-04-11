const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const fbConfig = require('./firebase-applet-config.json');

const app = initializeApp(fbConfig);
const db = getFirestore(app);

const TARGET_COMP_NAME = 'Danilo e Davi';
const CORRECT_EMAIL = 'mlopesmenechini@gmail.com';

async function start() {
    console.log('--- LIMPANDO CONTAS MATHEUS DUPLICADAS ---');
    
    // Pegar ID da Competição
    const compsSnap = await getDocs(collection(db, 'competitions'));
    const targetComp = compsSnap.docs.find(d => d.data().title.includes(TARGET_COMP_NAME));
    const compId = targetComp.id;

    // Pegar Todos os Usuários
    const usersSnap = await getDocs(collection(db, 'users'));
    
    for (const d of usersSnap.docs) {
        const data = d.data();
        const email = data.email?.toLowerCase().trim();
        const name = data.displayName?.toLowerCase() || '';

        // Se o nome contém Matheus Menechini mas o email NÃO é o seu
        if (name.includes('matheus menechini') && email !== CORRECT_EMAIL) {
            console.log(`Limpando conta não oficial: ${data.displayName} (${data.email || 'sem email'})`);
            
            const userRef = doc(db, 'users', d.id);
            
            // Zerar TUDO da competição e globais desta conta
            await updateDoc(userRef, {
                [`competitionStats.${compId}`]: {}, // Reseta o objeto da competição
                dailyViews: 0,
                dailyLikes: 0,
                dailyPosts: 0,
                totalViews: 0,
                totalLikes: 0,
                totalPosts: 0
            });
            console.log('\t-> Limpo com sucesso.');
        }
    }

    console.log('--- LIMPEZA CONCLUÍDA ---');
    process.exit(0);
}

start().catch(err => { console.error(err); process.exit(1); });
