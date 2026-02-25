// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCQod8ApYVMhDf0eW6uUDemZcbZPzcw2TE",
  authDomain: "schedulix-de3be.firebaseapp.com",
  databaseURL: "https://schedulix-de3be-default-rtdb.firebaseio.com",
  // Realtime Database URL set above — ensure your Realtime Database rules allow writes for signup tests.
  projectId: "schedulix-de3be",
  storageBucket: "schedulix-de3be.firebasestorage.app",
  messagingSenderId: "555062503511",
  appId: "1:555062503511:web:dd212e3cf7e16ec1e8db12",
  measurementId: "G-QZRM2PD4DX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);
const cloudFunctions = getFunctions(app);

export { db, rtdb, auth, storage, firebaseConfig, analytics, cloudFunctions };