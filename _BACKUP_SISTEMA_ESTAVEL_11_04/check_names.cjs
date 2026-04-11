const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fbConfig = require('./firebase-applet-config.json');

const app = initializeApp(fbConfig);
const db = getFirestore(app);

async function check() {
    console.log('--- COMPETIÇÕES ---');
    const compsSnap = await getDocs(collection(db, 'competitions'));
    compsSnap.docs.forEach(d => console.log(`ID: ${d.id} | Titulo: ${d.data().title} | Active: ${d.data().isActive}`));

    console.log('\n--- USUÁRIOS (DisplayName) ---');
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.docs.forEach(d => console.log(`UID: ${d.id} | Name: ${d.data().displayName}`));
    
    process.exit(0);
}

check().catch(console.error);
