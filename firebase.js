import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc,
  collection, getDocs, addDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Config ────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDZQCX6rmmih8SQjZqELdkLTK4cbqGD6yY",
  authDomain:        "running-planner-55d30.firebaseapp.com",
  projectId:         "running-planner-55d30",
  storageBucket:     "running-planner-55d30.firebasestorage.app",
  messagingSenderId: "955767507673",
  appId:             "1:955767507673:web:56731ffadf411307e24cc8"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Helpers Firestore ─────────────────────────────────────────────
// Dati "flat" (sessioni, doneDays, profilo) → salvati come unico documento
function docRef(uid, name)    { return doc(db, 'users', uid, 'data', name); }
function colRef(uid, colName) { return collection(db, 'users', uid, colName); }

async function getDocData(uid, name) {
  const snap = await getDoc(docRef(uid, name));
  return snap.exists() ? snap.data() : {};
}

async function getColDocs(uid, colName) {
  const snap = await getDocs(colRef(uid, colName));
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

// ── Esponi API globale per script.js ──────────────────────────────
window._fb = {
  // Auth
  createUser: (email, pass) => createUserWithEmailAndPassword(auth, email, pass),
  signIn:     (email, pass) => signInWithEmailAndPassword(auth, email, pass),
  resetPwd:   (email)       => sendPasswordResetEmail(auth, email),
  signOut:    ()            => signOut(auth),

  // Profilo
  getProfile:  (uid)       => getDocData(uid, 'profile'),
  saveProfile: (uid, data) => setDoc(docRef(uid, 'profile'), data, { merge: true }),

  // Sessioni (oggetto chiave=data)
  getSessions:  (uid)       => getDocData(uid, 'sessions'),
  saveSessions: (uid, data) => setDoc(docRef(uid, 'sessions'), data),

  // Giorni completati
  getDoneDays:  (uid)       => getDocData(uid, 'doneDays'),
  saveDoneDays: (uid, data) => setDoc(docRef(uid, 'doneDays'), data),

  // Gare (collezione)
  getRaces:   (uid)       => getColDocs(uid, 'races'),
  addRace:    (uid, data) => addDoc(colRef(uid, 'races'), data),
  deleteRace: (uid, id)   => deleteDoc(doc(db, 'users', uid, 'races', id)),

  // Personal Best (collezione)
  getPbs:   (uid)       => getColDocs(uid, 'pbs'),
  addPb:    (uid, data) => addDoc(colRef(uid, 'pbs'), data),
  deletePb: (uid, id)   => deleteDoc(doc(db, 'users', uid, 'pbs', id)),

  // Storico gare manuali (collezione)
  getHistory:    (uid)       => getColDocs(uid, 'history'),
  addHistory:    (uid, data) => addDoc(colRef(uid, 'history'), data),
  deleteHistory: (uid, id)   => deleteDoc(doc(db, 'users', uid, 'history', id)),
};

// ── Observer stato autenticazione ────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    window._uid   = user.uid;
    window._email = user.email;

    // Carica tutti i dati utente
    const [prof, sess, done, rcList, pbList, histList] = await Promise.all([
      window._fb.getProfile(user.uid),
      window._fb.getSessions(user.uid),
      window._fb.getDoneDays(user.uid),
      window._fb.getRaces(user.uid),
      window._fb.getPbs(user.uid),
      window._fb.getHistory(user.uid),
    ]);

    // Passa i dati a script.js
    window._userData = { prof, sess, done, rcList, pbList, histList };

    // Mostra app, nascondi auth
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display  = 'block';

    // Avvia app (definita in script.js)
    if (typeof window.bootApp === 'function') window.bootApp();

  } else {
    window._uid   = null;
    window._email = null;
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display  = 'none';
  }
});
