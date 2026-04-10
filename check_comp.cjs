const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fbConfig = require('./firebase-applet-config.json');

const app = initializeApp(fbConfig);
const db = getFirestore(app);

async function check() {
    const compsSnap = await getDocs(collection(db, 'competitions'));
    const comp = compsSnap.docs.find(d => d.data().title.includes('Danilo e Davi'));
    
    if (comp) {
        console.log(JSON.stringify(comp.data(), null, 2));
    } else {
        console.log('Competição não encontrada');
    }
    process.exit(0);
}

check().catch(console.error);
