let audioCtx: AudioContext | null = null;
let permGranted: boolean | null = null; // null = not yet checked, true = granted, false = denied

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

export function requestNotifPermission() {
  if (!('Notification' in window) || permGranted !== null) return;
  if (Notification.permission === 'granted') {
    permGranted = true;
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      permGranted = p === 'granted';
    });
  } else {
    permGranted = false;
  }
}

export function showBrowserNotification(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (permGranted === null) {
    if (Notification.permission === 'granted') {
      permGranted = true;
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => {
        permGranted = p === 'granted';
        if (permGranted) new Notification(title, { body, icon: '/favicon.ico' });
      });
      return;
    } else {
      permGranted = false;
      return;
    }
  }
  if (permGranted) {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

export function notifySoundAndBrowser(title: string, body: string) {
  playNotificationSound();
  showBrowserNotification(title, body);
}
