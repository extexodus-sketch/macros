/* maCros cloud layer: Firebase Auth (Google + email/password) and per-user Firestore storage.
 * Data layout:  users/{uid}            -> { email, terms, settings, custom, recent }
 *               users/{uid}/days/{id}  -> { n, start, entries[] }
 * Access is restricted to the signed-in owner by firestore.rules. */
const V = '10.12.2';
const BASE = `https://www.gstatic.com/firebasejs/${V}/`;

export async function initCloud(config) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(BASE + 'firebase-app.js'), import(BASE + 'firebase-auth.js'), import(BASE + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(config);
  const auth = A.getAuth(app);
  let db;
  try {
    // keeps a copy on the device so the app works offline and syncs when back online
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch {
    db = F.getFirestore(app);
  }
  const userRef = uid => F.doc(db, 'users', uid);
  const daysCol = uid => F.collection(db, 'users', uid, 'days');
  const clean = o => JSON.parse(JSON.stringify(o));   // drops undefined fields, which Firestore rejects
  const googleProvider = () => { const p = new A.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; };
  const NEEDS_REDIRECT = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'];

  return {
    onAuth: cb => A.onAuthStateChanged(auth, cb),
    async redirectResult() { try { return await A.getRedirectResult(auth); } catch (e) { return { error: e }; } },
    async google() {
      try { return await A.signInWithPopup(auth, googleProvider()); }
      catch (e) { if (NEEDS_REDIRECT.includes(e.code)) return A.signInWithRedirect(auth, googleProvider()); throw e; }
    },
    async signUp(email, pass) {
      const cred = await A.createUserWithEmailAndPassword(auth, email, pass);
      A.sendEmailVerification(cred.user).catch(() => {});
      return cred;
    },
    signIn: (email, pass) => A.signInWithEmailAndPassword(auth, email, pass),
    reset: email => A.sendPasswordResetEmail(auth, email),
    signOut: () => A.signOut(auth),
    provider: () => (auth.currentUser && auth.currentUser.providerData[0] ? auth.currentUser.providerData[0].providerId : 'password'),

    async loadProfile(uid) { const s = await F.getDoc(userRef(uid)); return s.exists() ? s.data() : null; },
    async loadDays(uid) { const s = await F.getDocs(daysCol(uid)); return s.docs.map(d => ({ id: d.id, ...d.data() })); },
    // Firestore refuses fields set to undefined; a JSON round trip drops them so a save never fails over one
    saveProfile: (uid, data) => F.setDoc(userRef(uid), clean(data), { merge: true }),
    saveDay: (uid, day) => { const { id, ...rest } = day; return F.setDoc(F.doc(daysCol(uid), id), clean(rest)); },
    deleteDay: (uid, id) => F.deleteDoc(F.doc(daysCol(uid), id)),
    // live updates from your other devices (ignores echoes of this device's own unsent writes)
    watch(uid, onProfile, onDays) {
      const a = F.onSnapshot(userRef(uid), s => { if (!s.metadata.hasPendingWrites && s.exists()) onProfile(s.data()); });
      const b = F.onSnapshot(daysCol(uid), s => { if (!s.metadata.hasPendingWrites) onDays(s.docs.map(d => ({ id: d.id, ...d.data() }))); });
      return () => { a(); b(); };
    },

    async reauth(password) {
      const user = auth.currentUser;
      if (this.provider() === 'google.com') return A.reauthenticateWithPopup(user, googleProvider());
      return A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, password || ''));
    },
    async deleteEverything(uid) {
      const s = await F.getDocs(daysCol(uid));
      await Promise.all(s.docs.map(d => F.deleteDoc(d.ref)));
      await F.deleteDoc(userRef(uid));
      await A.deleteUser(auth.currentUser);
    },
  };
}
