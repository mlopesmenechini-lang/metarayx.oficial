const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = require('firebase/firestore');
const fbConfig = require('./firebase-applet-config.json');

const app = initializeApp(fbConfig);
const db = getFirestore(app);

const TARGET_COMP_NAME = 'Danilo e Davi';

const manualRanking = [
  { name: '@Protta 💡 - MRX', views: 55251, likes: 709 },
  { name: '@Luiz', views: 21770, likes: 683 },
  { name: '@Regina Ramos', views: 20078, likes: 313 },
  { name: '@Adriana de Lima', views: 15084, likes: 306 },
  { name: '@Jessica Reis de Sena', views: 7212, likes: 233 },
  { name: '@Rodrigo MRX', views: 8475, likes: 185 },
  { name: '@Polyanne Tayane Batista Lo', views: 6420, likes: 142 },
  { name: '@Paula de Paula', views: 10009, likes: 130 },
  { name: '@Abibe MrX', views: 8858, likes: 124 },
  { name: '@Matheus Menechini', views: 4791, likes: 105 },
  { name: '@Rafaela cardoso de souza', views: 6539, likes: 96 },
  { name: '@Vive', views: 4763, likes: 85 },
  { name: '@Francielli Silva de Santana', views: 4278, likes: 75 }
];

async function start() {
    console.log('--- INICIANDO INJEÇÃO DE RANKING ---');
    
    // 1. Achar ID da Competição
    const compsSnap = await getDocs(collection(db, 'competitions'));
    const targetComp = compsSnap.docs.find(d => d.data().title.includes(TARGET_COMP_NAME));
    
    if (!targetComp) {
        console.error('ERRO: Competição "' + TARGET_COMP_NAME + '" não encontrada!');
        process.exit(1);
    }
    
    const compId = targetComp.id;
    console.log('Competição encontrada: ' + targetComp.data().title + ' (ID: ' + compId + ')');

    // 2. Buscar Todos os Usuários para Mapeamento
    const usersSnap = await getDocs(collection(db, 'users'));
    const usersMap = {};
    usersSnap.docs.forEach(d => {
        const data = d.data();
        // Limpar o nome para comparação facilitada
        const cleanName = data.displayName?.trim().toLowerCase();
        if (cleanName) usersMap[cleanName] = { id: d.id, ...data };
    });

    // 3. Processar cada usuário do Ranking Manual
    for (const item of manualRanking) {
        const searchName = item.name.replace('@', '').trim().toLowerCase();
        
        // Tentar achar por nome exato ou que contenha o nome
        let userMatch = usersMap[searchName] || 
                        Object.values(usersMap).find(u => u.displayName?.toLowerCase().includes(searchName));

        if (userMatch) {
            console.log(`Injetando dados para: ${userMatch.displayName} (UID: ${userMatch.id})`);
            
            const userRef = doc(db, 'users', userMatch.id);
            const currentStats = userMatch.competitionStats || {};
            const compStats = currentStats[compId] || {};

            await updateDoc(userRef, {
                [`competitionStats.${compId}.views`]: item.views,
                [`competitionStats.${compId}.likes`]: item.likes,
                [`competitionStats.${compId}.dailyViews`]: item.views,
                [`competitionStats.${compId}.dailyLikes`]: item.likes,
                [`competitionStats.${compId}.posts`]: compStats.posts || 0, // Manter o que já tem
                // Atualizar totais globais também se necessário
                totalViews: (userMatch.totalViews || 0) + item.views,
                totalLikes: (userMatch.totalLikes || 0) + item.likes,
                dailyViews: item.views,
                dailyLikes: item.likes
            });
            console.log(`\t-> Sucesso: ${item.views} Views / ${item.likes} Likes`);
        } else {
            console.warn(`AVISO: Usuário "${item.name}" não encontrado no banco de dados!`);
        }
    }

    console.log('\n--- INJEÇÃO CONCLUÍDA ---');
    process.exit(0);
}

start().catch(err => {
    console.error('ERRO FATAL:', err);
    process.exit(1);
});
