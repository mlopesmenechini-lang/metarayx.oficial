import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, onAuthStateChanged } from 'firebase/auth';

import { getFirestore, doc, getDoc, getDocs, collection, onSnapshot, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, getDocFromServer, addDoc, serverTimestamp } from 'firebase/firestore';
import fallbackFirebaseConfig from './firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackFirebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || fallbackFirebaseConfig.measurementId,
};

// Debug: Mostrar apenas início e fim da chave para segurança
console.log('Firebase Init - Project:', firebaseConfig.projectId);
if (firebaseConfig.apiKey) {
  console.log('API Key Check:', `${firebaseConfig.apiKey.slice(0, 5)}...${firebaseConfig.apiKey.slice(-4)}`);
}


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(err => console.error('Persistence Error:', err));

const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || fallbackFirebaseConfig.firestoreDatabaseId;
export const db = getFirestore(app, databaseId && databaseId !== '(default)' ? databaseId : undefined);
export const googleProvider = new GoogleAuthProvider();


export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection
async function testConnection() {
  try {
    console.log('Testing Firestore connection...');
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firestore connection test successful (doc might not exist, but no permission error)');
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    } else {
      console.error('Firestore connection test failed:', error);
    }
  }
}
testConnection();

export { doc, getDoc, getDocs, collection, onSnapshot, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, addDoc, serverTimestamp, onAuthStateChanged };

