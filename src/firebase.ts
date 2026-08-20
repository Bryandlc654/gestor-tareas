import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let messaging: ReturnType<typeof getMessaging> | null = null;
let appInitialized = false;

async function ensureApp() {
  if (appInitialized) return;
  const hasConfig = Object.values(firebaseConfig).some(v => v);
  if (!hasConfig) {
    console.warn('[FCM] Firebase client not configured. Set VITE_FIREBASE_* env vars.');
    return;
  }
  const supported = await isSupported();
  if (!supported) {
    console.warn('[FCM] Firebase Cloud Messaging is not supported in this browser.');
    return;
  }
  try {
    const app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    appInitialized = true;
    console.log('[FCM] Firebase client initialized.');
  } catch (err) {
    console.error('[FCM] Failed to initialize Firebase client:', err);
  }
}

export async function getFCMToken(): Promise<string | null> {
  await ensureApp();
  if (!messaging) return null;
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    console.info('[FCM] Notification permission blocked by user. Skipping FCM token.');
    return null;
  }
  try {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[FCM] VITE_FIREBASE_VAPID_KEY not set. Cannot get push token.');
      return null;
    }
    const currentToken = await getToken(messaging, { vapidKey });
    if (currentToken) return currentToken;
    console.warn('[FCM] No registration token available. Request permission to generate one.');
    return null;
  } catch (err) {
    console.warn('[FCM] Unable to get FCM token (notifications may be blocked or unavailable).');
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void): void {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    callback(payload);
  });
}
