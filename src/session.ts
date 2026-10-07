const KEY = "amicavar-cle";

/** Lit la clé dans l'adresse (?cle=…), la mémorise sur l'appareil puis la retire de la barre d'adresse. */
export function initialCle(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("cle");
  if (fromUrl) {
    saveCle(fromUrl);
    params.delete("cle");
    const q = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (q ? "?" + q : "") + window.location.hash);
    return fromUrl;
  }
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveCle(cle: string) {
  try {
    window.localStorage.setItem(KEY, cle);
  } catch {
    /* navigation privée : la clé reste en mémoire le temps de la visite */
  }
}

export function clearCle() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* rien à faire */
  }
}

export function personalLink(cle: string): string {
  return `${window.location.origin}${window.location.pathname}?cle=${encodeURIComponent(cle)}`;
}
