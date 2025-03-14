// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Cấu hình Firebase (THAY BẰNG THÔNG TIN CỦA BẠN)
const firebaseConfig = {
    apiKey: "AIzaSyDXoCbgrZsvLkmwG1ODrK5QCB2fdztPGPk",
  authDomain: "qlyktx.firebaseapp.com",
  databaseURL: "https://qlyktx-default-rtdb.firebaseio.com",
  projectId: "qlyktx",
  storageBucket: "qlyktx.firebasestorage.app",
  messagingSenderId: "477852817347",
  appId: "1:477852817347:web:f8f4cd29c995b300a5cf76",
  measurementId: "G-DP5Y2602CX"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, onAuthStateChanged, signOut };
