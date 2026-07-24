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

export function loginLocal(role, pin) {
  const u = LOCAL_USERS.find((x) => x.role === role);
  if (!u || u.pin !== pin) throw new Error('wrong-pin');
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ uid: u.uid, name: u.name, role: u.role, shopId: 'demo' })
  );
  location.reload();
}

export async function loginFirebase(email, pass) {
  await fb.login(email, pass);
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
