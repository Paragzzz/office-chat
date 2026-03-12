import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBM4geQ4WL3xwherVQfzgWbWBv_-j3aBbg",
  authDomain: "office-chat-9c821.firebaseapp.com",
  projectId: "office-chat-9c821",
  storageBucket: "office-chat-9c821.firebasestorage.app",
  messagingSenderId: "789220287574",
  appId: "1:789220287574:web:2b845653bad927c4c287f7"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);