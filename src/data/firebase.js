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
  getDocFromCache,
  getDocFromServer,
  getDocs,
  // (getDoc kept for parity, but profile reads use the server-first helper below)
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
  createUserWithEmailAndPassword,
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
  initAnalytics(config);
}

// Analytics only makes sense in a real browser served over http(s). Skip it in
// the Electron desktop app (file://) and when no measurementId is configured.
function initAnalytics(config) {
  if (
    !config.measurementId ||
    typeof window === 'undefined' ||
    window.desktop?.isElectron ||
    !location.protocol.startsWith('http')
  )
    return;
  import('firebase/analytics')
    .then(({ isSupported, getAnalytics }) =>
      isSupported().then((ok) => ok && getAnalytics(app))
    )
    .catch(() => {});
}

export function watchAuth(cb) {
  onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) return cb(null);
    let snap;
    try {
      snap = await readProfile(doc(db, 'users', fbUser.uid));
    } catch (err) {
      // Surface the failure instead of hanging on a blank screen. The most
      // common cause is Firestore security rules denying the read (e.g. rules
      // never deployed, or test-mode rules that have since expired).
      console.error('Could not load profile:', err.code, err.message);
      return cb({
        uid: fbUser.uid,
        error: err.code === 'permission-denied' ? 'denied' : 'load-failed',
        detail: err.message,
      });
    }
    if (!snap.exists())
      return cb({ uid: fbUser.uid, email: fbUser.email, error: 'no-profile' });
    const p = snap.data();
    // A profile with no shopId can't address any shop data (it would build an
    // invalid shops//items path). Route to the shop-setup screen instead.
    if (!p.shopId)
      return cb({
        uid: fbUser.uid,
        email: fbUser.email,
        name: p.name || fbUser.email,
        error: 'no-shop',
      });
    cb({
      uid: fbUser.uid,
      name: p.name || fbUser.email,
      role: p.role || 'staff',
      shopId: p.shopId,
    });
  });
}

// getDoc() can hang indefinitely on a permission-denied read while offline
// persistence is enabled, which leaves the app on a blank screen with no error.
// Read from the server first (which rejects properly), and only fall back to the
// on-device cache when the network is genuinely unavailable.
async function readProfile(ref) {
  try {
    return await getDocFromServer(ref);
  } catch (err) {
    if (err.code === 'unavailable') return getDocFromCache(ref);
    throw err;
  }
}

export const login = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
export const logout = () => signOut(auth);

// A shopId nobody has to invent or type into a console. It is generated here,
// stored on shops/{shopId}, and referenced from the owner's users/{uid} profile.
// It is long and random so it doubles as the (semi-secret) code staff use to join.
function generateShopId() {
  const rand = () =>
    (crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2))
      .replace(/-/g, '');
  return ('shop_' + rand()).slice(0, 24);
}

// Self-service owner sign-up: creates the account, auto-generates the shopId,
// then writes the owner profile and the shop document. No Firebase console needed.
// The profile is written before the shop so the security rules (which check that
// the writer is the owner of that shop) already see the committed profile.
export async function registerOwner({ shopName, ownerName, email, pass }) {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  const uid = cred.user.uid;
  const shopId = generateShopId();
  await setDoc(doc(db, 'users', uid), {
    name: ownerName,
    role: 'owner',
    shopId,
    createdAt: Date.now(),
  });
  await setDoc(doc(db, 'shops', shopId), {
    name: shopName,
    ownerUid: uid,
    createdAt: Date.now(),
  });
  return { shopId };
}

// Finish setup for an account that is already signed in but not linked to a shop
// yet — either it has no profile at all, or a profile missing its shopId. Creates
// (or updates) the owner profile with a fresh shopId, then creates the shop.
// The profile is written first so the shop-create rule already sees them as owner.
export async function setupShop({ shopName, ownerName }) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('not-signed-in');
  const shopId = generateShopId();
  const uref = doc(db, 'users', uid);
  let exists = false;
  try {
    exists = (await readProfile(uref)).exists();
  } catch {
    exists = false;
  }
  if (exists) {
    await updateDoc(uref, { shopId, role: 'owner' });
  } else {
    await setDoc(uref, { name: ownerName, role: 'owner', shopId, createdAt: Date.now() });
  }
  await setDoc(doc(db, 'shops', shopId), {
    name: shopName,
    ownerUid: uid,
    createdAt: Date.now(),
  });
  return { shopId };
}

// Staff join an existing shop using the shop code (its shopId) the owner shares.
export async function joinShop({ staffName, email, pass, shopId }) {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  await setDoc(doc(db, 'users', cred.user.uid), {
    name: staffName,
    role: 'staff',
    shopId,
    createdAt: Date.now(),
  });
}

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
