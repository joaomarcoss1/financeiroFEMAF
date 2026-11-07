import { supabase } from '@/integrations/supabase/client';

// Converte chave VAPID base64url para Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

let cachedKey: string | null = null;

export async function getVapidPublicKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  try {
    const { data } = await supabase.functions.invoke('vapid-public-key', { body: {} });
    cachedKey = (data as any)?.key || null;
    return cachedKey;
  } catch { return null; }
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'default') {
    return await Notification.requestPermission();
  }
  return Notification.permission;
}

export async function subscribePush(opts: { professor_id?: string; pin?: string; role?: 'professor' | 'admin' }): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const perm = await ensureNotificationPermission();
  if (perm !== 'granted') return false;
  const key = await getVapidPublicKey();
  if (!key) return false;

  const reg = await navigator.serviceWorker.register('/sw-push.js');
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
  }
  const json = sub.toJSON() as any;
  if (opts.professor_id) {
    if (!opts.pin) return false;
    const { error } = await (supabase as any).rpc('push_subscribe_professor', {
      p_prof_id: opts.professor_id,
      p_pin: opts.pin,
      p_endpoint: json.endpoint,
      p_p256dh: json.keys?.p256dh,
      p_auth: json.keys?.auth,
      p_user_agent: navigator.userAgent,
    });
    return !error;
  }
  const { data: authData } = await supabase.auth.getUser();
  await supabase.from('push_subscriptions').upsert({
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    professor_id: null,
    user_id: authData.user?.id || null,
    role: opts.role || 'professor',
    user_agent: navigator.userAgent,
  }, { onConflict: 'endpoint' });
  return true;
}

// Toca um som curto de alerta usando Web Audio API (sem dependência de arquivo).
let audioCtx: AudioContext | null = null;
export function playAlertSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    [880, 660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.18);
    });
  } catch (_) {}
}
