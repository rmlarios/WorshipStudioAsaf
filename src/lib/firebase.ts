import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD5yz_2XYJgtuL8KvCVUemD5mRDwX228rw",
  authDomain: "worshipstudioasaf.firebaseapp.com",
  projectId: "worshipstudioasaf",
  storageBucket: "worshipstudioasaf.firebasestorage.app",
  messagingSenderId: "988428253410",
  appId: "1:988428253410:web:d7519d14c02fff6f2ac6bb",
  measurementId: "G-H1RX38D6J1"
};

// Evitar inicializar la app nuevamente si ya existe (Next.js HMR)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const firestore = getFirestore(app);

export { app, firestore };
