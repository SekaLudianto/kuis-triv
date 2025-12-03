import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Ganti dengan konfigurasi Firebase aplikasi web Anda
// Anda bisa mendapatkannya dari Firebase Console -> Project Settings
const firebaseConfig = {
    apiKey: "AIzaSyBmkg2rZNL0D_lpF2QMZmgle4ASTrIT_r0",
    authDomain: "kuis-tiktok-c9272.firebaseapp.com",
    projectId: "kuis-tiktok-c9272",
    storageBucket: "kuis-tiktok-c9272.firebasestorage.app",
    messagingSenderId: "534386964257",
    appId: "1:534386964257:web:215626a682dca4b6baf060",
    measurementId: "G-8HQNYFGB77"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Export instance Firestore Database untuk digunakan di seluruh aplikasi
export const db = getFirestore(app);