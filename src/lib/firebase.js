// src/lib/firebase.js
// ════════════════════════════════════════════════════════════
//  Inicialização do Firebase — singleton seguro para Next.js
//  Lê credenciais do .env.local via process.env
// ════════════════════════════════════════════════════════════

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

// ── Configuração via variáveis de ambiente ──
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ── Singleton: evita reinicializar no hot-reload do Next.js ──
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Providers para login social ──
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

export {
  // App
  app,
  auth,
  db,

  // Auth functions
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  signInWithPopup,

  // Providers
  googleProvider,
  githubProvider,

  // Firestore functions
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
};
