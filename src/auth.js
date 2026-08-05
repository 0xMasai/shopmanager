// Unified auth for both modes. Demo mode: fixed users with PINs, session-scoped.
// Firebase mode: email/password accounts with a profile doc in users/{uid}.
import { firebaseConfig } from './firebase-config.js';

const LOCAL_USERS = [
  { uid: 'demo-owner', name: 'Owner', role: 'owner', pin: '1234' },
  { uid: 'demo-staff', name: 'Staff', role: 'staff', pin: '1111' },
];

const SESSION_KEY = 'shopms-user';

let fb = null; // lazily imported firebase module (only in live mode)

export const isFirebaseMode = () => !!firebaseConfig;

export async function initAuth(onChange) {
  if (firebaseConfig) {
    fb = await import('./data/firebase.js');
    fb.initFirebase(firebaseConfig);
    fb.watchAuth(onChange);
  } else {
    const raw = sessionStorage.getItem(SESSION_KEY);
    onChange(raw ? JSON.parse(raw) : null);
  }
}

// Demo mode still has a real shopId — auto-generated once and kept on the device,
// instead of a hardcoded 'demo'. Mirrors how the live app assigns one per shop.
const SHOP_ID_KEY = 'shopms-shop-id';
export function demoShopId() {
  let id = localStorage.getItem(SHOP_ID_KEY);
  if (!id) {
    id = 'shop_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    localStorage.setItem(SHOP_ID_KEY, id);
  }
  return id;
}

export function loginLocal(role, pin) {
  const u = LOCAL_USERS.find((x) => x.role === role);
  if (!u || u.pin !== pin) throw new Error('wrong-pin');
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ uid: u.uid, name: u.name, role: u.role, shopId: demoShopId() })
  );
  location.reload();
}

export async function loginFirebase(email, pass) {
  await fb.login(email, pass);
}

// Owner sign-up: creates the account and auto-generates the shop. Reload so the
// auth watcher re-reads the freshly written profile instead of the "no profile
// yet" state that briefly exists between account creation and the profile write.
export async function signupFirebase(data) {
  const res = await fb.registerOwner(data);
  location.reload();
  return res;
}

// Finish setup for a signed-in account that has no shop yet (creates/links the
// profile and the shop). Used by the in-app "set up your shop" recovery screen.
export async function setupShopFirebase(data) {
  const res = await fb.setupShop(data);
  location.reload();
  return res;
}

// Staff join an existing shop with the owner's shop code.
export async function joinFirebase(data) {
  await fb.joinShop(data);
  location.reload();
}

export async function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  if (fb) await fb.logout();
  location.reload();
}

export async function makeAdapter(user) {
  if (firebaseConfig) return fb.createFirebaseAdapter(user.shopId);
  const { createLocalAdapter } = await import('./data/local.js');
  return createLocalAdapter();
}
