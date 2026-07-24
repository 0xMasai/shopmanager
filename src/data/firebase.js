// Live adapter: Firestore with offline persistence. Writes are fire-and-forget
// so the shop keeps selling with no data bundle — Firestore applies them to the
// local cache instantly and syncs when the connection returns.
import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  increment,
} from 'firebase/firestore';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { todayStr } from '../ui.js';

let app, db, auth;

export function initFirebase(config) {
  app = initializeApp(config);
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  auth = getAuth(app);
}

export function watchAuth(cb) {
  onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) return cb(null);
    const snap = await getDoc(doc(db, 'users', fbUser.uid));
    if (!snap.exists()) return cb({ uid: fbUser.uid, error: 'no-profile' });
    const p = snap.data();
    cb({
      uid: fbUser.uid,
      name: p.name || fbUser.email,
      role: p.role || 'staff',
      shopId: p.shopId,
    });
  });
}

export const login = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
export const logout = () => signOut(auth);

const logSyncError = (what) => (err) => console.error(`${what} failed to sync:`, err);

export function createFirebaseAdapter(shopId) {
  const col = (name) => collection(db, 'shops', shopId, name);

  return {
    mode: 'firebase',

    async getItems() {
      const snap = await getDocs(col('items'));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((i) => i.active !== false)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async addItem(item) {
      const ref = doc(col('items'));
      setDoc(ref, { active: true, ...item }).catch(logSyncError('addItem'));
      return ref.id;
    },

    async updateItem(id, patch) {
      updateDoc(doc(col('items'), id), patch).catch(logSyncError('updateItem'));
    },

    async addSale(sale) {
      const batch = writeBatch(db);
      const saleRef = doc(col('sales'));
      batch.set(saleRef, sale);
      for (const line of sale.lines) {
        batch.update(doc(col('items'), line.itemId), { stockQty: increment(-line.qty) });
      }
      batch.commit().catch(logSyncError('addSale'));
      return saleRef.id;
    },

    async getSales(date) {
      const snap = await getDocs(query(col('sales'), where('date', '==', date)));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => b.ts - a.ts);
    },

    subscribeSales(date, cb) {
      return onSnapshot(query(col('sales'), where('date', '==', date)), (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.ts - a.ts));
      });
    },

    async receiveStock(itemId, qty, byName, note = '') {
      const batch = writeBatch(db);
      batch.update(doc(col('items'), itemId), { stockQty: increment(qty) });
      batch.set(doc(col('movements')), {
        itemId,
        type: 'received',
        qty,
        byName,
        note,
        ts: Date.now(),
        date: todayStr(),
      });
      batch.commit().catch(logSyncError('receiveStock'));
    },

    async getDayClose(date) {
      const snap = await getDoc(doc(col('dayCloses'), date));
      return snap.exists() ? snap.data() : null;
    },

    async saveDayClose(date, data) {
      setDoc(doc(col('dayCloses'), date), data).catch(logSyncError('saveDayClose'));
    },

    async getDayCloses(n = 14) {
      const snap = await getDocs(query(col('dayCloses'), orderBy('date', 'desc'), limit(n)));
      return snap.docs.map((d) => d.data());
    },
  };
}
