// Where to send someone after they sign in. The destination travels in the URL
// (/sign-in?next=/events/abc), so anyone can craft a link with any `next`; only paths on
// this site are followed. Without that check, ?next=https://evil.example would be an
// open redirect: a link that starts on Usher and lands somewhere that looks like it.

/** The page to sign in on, coming back to `returnTo` (a path on this site) afterwards. */
export function signInPath(returnTo: string, mode?: 'create-account'): string {
  const params = new URLSearchParams({ next: returnTo });
  if (mode) params.set('mode', mode);
  return `/sign-in?${params}`;
}

/**
 * `next` if it's a page on this site, else the home page. Parsing it as a URL against our
 * own origin catches every way of leaving the site: "https://…", "//evil.example",
 * "/\evil.example" (browsers read \ as /) and "javascript:…" all end up on another origin.
 */
export function safeNext(next: string | null): string {
  if (!next) return '/';
  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) return '/';
    // Never send someone back to the sign-in page itself.
    if (url.pathname === '/sign-in') return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
