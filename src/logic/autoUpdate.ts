import { Platform } from 'react-native';

// Phones (especially iPhone home-screen apps) can keep showing an old copy of the web app.
// Each time the app is opened or brought back to the front, ask the server which version is
// current; if it's newer than the one running, reload to get it.

const BUNDLE = /\/_expo\/static\/js\/web\/index-[a-f0-9]+\.js/;

function runningBundle(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[src*="/_expo/static/js/web/index-"]');
  return script?.src.match(BUNDLE)?.[0] ?? null;
}

async function latestBundle(): Promise<string | null> {
  const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.text()).match(BUNDLE)?.[0] ?? null;
}

let checking = false;
async function check() {
  if (checking) return;
  checking = true;
  try {
    const running = runningBundle();
    const latest = await latestBundle();
    if (running && latest && running !== latest) {
      // Reload at most once per new version per minute, so a slow server can't cause a reload loop.
      const key = 'familycar:reloadedFor';
      let last: { v: string; at: number } | null = null;
      try {
        last = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      } catch {}
      if (last?.v === latest && Date.now() - last.at < 60_000) return;
      try {
        sessionStorage.setItem(key, JSON.stringify({ v: latest, at: Date.now() }));
      } catch {}
      window.location.reload();
    }
  } catch {
    // Offline or the server is unreachable: keep using this version.
  } finally {
    checking = false;
  }
}

/** Starts the update check. Only does anything in the published web app. */
export function startAutoUpdate(): () => void {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !runningBundle()) return () => undefined;
  const onVisible = () => {
    if (document.visibilityState === 'visible') check();
  };
  check();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  const timer = setInterval(check, 30 * 60 * 1000);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    clearInterval(timer);
  };
}
