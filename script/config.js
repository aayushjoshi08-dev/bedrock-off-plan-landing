import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAYaapYNFYyaYdMjSPvWATNJWlmADVMMP4",
    authDomain: "business-labs.firebaseapp.com",
    projectId: "business-labs",
    storageBucket: "business-labs.firebasestorage.app",
    messagingSenderId: "236065431433",
    appId: "1:236065431433:web:bc293dede0e88eef8a8b58",
    measurementId: "G-F07DNBNQW4",
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };