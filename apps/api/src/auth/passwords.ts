import { hash, verify } from '@node-rs/argon2';

/**
 * Password rules follow the shape of NIST SP 800-63B rev. 4: a minimum length, a generous
 * maximum, a check for obviously guessable passwords, and nothing else (no "must contain
 * a symbol", no forced changes, no hints). NIST also asks for a blocklist of common and
 * breached passwords; that's left out of this demo.
 * https://pages.nist.gov/800-63-4/sp800-63b/authenticators
 */

/**
 * Deliberately short, so trying the demo is quick. NIST asks for 15 when a password is
 * the only thing needed to sign in (as here), or 8 with a second factor. For real users,
 * raise this to 15 and update the hint in apps/web's CreateAccountForm to match.
 */
export const PASSWORD_MIN_LENGTH = 6;
/** NIST asks for at least 64. The cap mostly stops someone sending megabytes to hash. */
export const PASSWORD_MAX_LENGTH = 256;

/**
 * The same characters can be encoded in more than one way in Unicode (é as one code point,
 * or e plus an accent). NFC picks one, so a password typed on another device still matches.
 * Everything that hashes or checks a password goes through this. Nothing is trimmed: spaces
 * are part of the password.
 */
function normalize(password: string): string {
  return password.normalize('NFC');
}

/** Length in characters as a person counts them: an emoji is 1, not JavaScript's 2. */
function characterCount(password: string): number {
  return [...password].length;
}

// Keyboard rows and counting runs, twice over so a run can wrap ("7890123456789…").
const PREDICTABLE_RUNS = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'qwertyuiopasdfghjklzxcvbnm'].flatMap(
  (run) => {
    const twice = run + run;
    return [twice, [...twice].reverse().join('')];
  },
);

/**
 * True for passwords an attacker would try first, checked as a whole (not words inside it):
 * - a short chunk repeated ("aaaaaa", "abcabc", "passwordpassword");
 * - a run along the keyboard or the alphabet or digits ("654321", "qwerty", "asdfghjk");
 * - the account's own email address, or the part before the @.
 */
function isPredictable(password: string, email: string): boolean {
  const lower = password.toLowerCase();
  const emailLower = email.trim().toLowerCase();
  if (/^(.{1,8})\1+$/su.test(lower)) return true;
  if (PREDICTABLE_RUNS.some((run) => run.includes(lower))) return true;
  return lower === emailLower || lower === emailLower.split('@')[0];
}

/**
 * Checks a password someone is choosing (sign-up, later password changes). Returns a
 * message saying what's wrong, ready to show the user, or null if it's acceptable.
 * Sign-in never runs these: rules can change, and enforcing them there would lock out
 * people who signed up under the old ones (and hint at what the rules are).
 */
export function newPasswordProblem(password: string, { email }: { email: string }): string | null {
  const normalized = normalize(password);
  const length = characterCount(normalized);
  if (length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }
  if (isPredictable(normalized, email)) {
    return 'That password is too easy to guess. Choose a different one.';
  }
  return null;
}

/** Argon2id with the library defaults: 19 MiB of memory, 2 passes, 1 thread. */
export function hashPassword(password: string): Promise<string> {
  return hash(normalize(password));
}

// A real hash of a throwaway password, made once, for sign-ins with an unknown email.
// Started when the module loads (not awaited), so it's ready long before anyone signs in.
const dummyHash = hash('this is not anyone’s password');

/**
 * True if the password matches the stored hash. Pass null when no account has that email:
 * it still verifies (against a dummy hash) and returns false, so an unknown email takes as
 * long as a wrong password and response times can't reveal who has an account.
 */
export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  const matches = await verify(passwordHash ?? (await dummyHash), normalize(password));
  return passwordHash !== null && matches;
}
