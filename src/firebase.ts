import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCK5ua2HWKuJPvTz3k1UeG9_P4J6gV9Q2M",
  authDomain: "expense-management-pcdepot.firebaseapp.com",
  projectId: "expense-management-pcdepot",
  storageBucket: "expense-management-pcdepot.firebasestorage.app",
  messagingSenderId: "748756390310",
  appId: "1:748756390310:web:e823a9976d4c1ec8bdbf67"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");
