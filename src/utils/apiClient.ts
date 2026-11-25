export interface SafeApiResult<T> {
  ok: boolean;
  status: number;
  isStaticHosting: boolean;
  data: T | null;
  errorMessage: string | null;
}

export async function fetchApiJson<T>(
  url: string,
  init?: RequestInit,
): Promise<SafeApiResult<T>> {
  try {
    const response = await fetch(url, init);
    const contentType = response.headers.get('content-type') || '';

    // When deployed on static hosting (Firebase Hosting, Netlify, GitHub Pages),
    // SPA rewrites return HTML (index.html) or 404/405 for /api/* paths.
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        status: response.status,
        isStaticHosting: true,
        data: null,
        errorMessage:
          'Serveur API Node.js absent (mode hébergement web statique). Les fonctions locales du studio restent 100 % actives dans votre navigateur.',
      };
    }

    const data = (await response.json()) as T & {
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        isStaticHosting: false,
        data,
        errorMessage: data?.message || data?.error || `Erreur serveur HTTP ${response.status}.`,
      };
    }

    return {
      ok: true,
      status: response.status,
      isStaticHosting: false,
      data,
      errorMessage: null,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      isStaticHosting: false,
      data: null,
      errorMessage: 'Impossible de joindre le serveur API du studio.',
    };
  }
}
