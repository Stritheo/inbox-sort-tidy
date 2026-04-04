/**
 * security.js -- Input sanitisation and auth guard helpers.
 */

const ESCAPE_MAP = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * HTML-escape a string. Belt-and-suspenders backup for textContent.
 * @param {string} str
 * @returns {string}
 */
export function sanitise(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"']/g, c => ESCAPE_MAP[c]);
}

/**
 * Wrap a function so it throws if the user is not authenticated.
 * @param {() => boolean} authCheck -- function that returns true when authenticated
 * @param {Function} fn -- function to guard
 * @returns {Function}
 */
export function requireAuth(authCheck, fn) {
  return (...args) => {
    if (!authCheck()) {
      throw new Error('Session expired. Please reconnect Gmail.');
    }
    return fn(...args);
  };
}
