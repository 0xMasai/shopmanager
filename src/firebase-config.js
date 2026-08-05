// Firebase web app config.
//
// Two ways to set this (pick one):
//
// 1) Environment variables (recommended — keeps secrets out of git).
//    Create a `.env` file in the project root:
//      VITE_FB_API_KEY=...
//      VITE_FB_AUTH_DOMAIN=your-project.firebaseapp.com
//      VITE_FB_PROJECT_ID=your-project
//      VITE_FB_STORAGE_BUCKET=your-project.appspot.com
//      VITE_FB_MESSAGING_SENDER_ID=...
//      VITE_FB_APP_ID=...
//
// 2) Paste the object directly into `PASTED_CONFIG` below.
//
// Get the values from: Firebase console → Project settings → Your apps → Web app.
// Leave everything blank/null to run in demo mode (data saved on this device only).

const env = import.meta.env;

// Option 2: paste your config here (overrides env vars if filled in).
const PASTED_CONFIG = null;
// Example:
// const PASTED_CONFIG = {
//   apiKey: '...',
//   authDomain: 'your-project.firebaseapp.com',
//   projectId: 'your-project',
//   storageBucket: 'your-project.appspot.com',
//   messagingSenderId: '...',
//   appId: '...',
// };

const envConfig = env?.VITE_FB_API_KEY
  ? {
      apiKey: env.VITE_FB_API_KEY,
      authDomain: env.VITE_FB_AUTH_DOMAIN,
      projectId: env.VITE_FB_PROJECT_ID,
      storageBucket: env.VITE_FB_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FB_MESSAGING_SENDER_ID,
      appId: env.VITE_FB_APP_ID,
      measurementId: env.VITE_FB_MEASUREMENT_ID,
    }
  : null;

export const firebaseConfig = PASTED_CONFIG || envConfig || null;
