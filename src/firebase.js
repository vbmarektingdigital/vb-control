import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCK8OnQIj8cbPXqrhnqogHkH2LQPplDq24",
  authDomain: "agencia-planner.firebaseapp.com",
  projectId: "agencia-planner",
  storageBucket: "agencia-planner.firebasestorage.app",
  messagingSenderId: "498011922575",
  appId: "1:498011922575:web:5918df98fc7f46154250fa"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);