/**
 * auth.js -- Google Identity Services Token Model integration.
 *
 * Token stored in module-scoped closure. Never on window, localStorage, or cookies.
 */

let _accessToken = null;
let _tokenExpiry = 0;
let _tokenClient = null;

const SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

/**
 * Initialise the GIS token client. Call once on page load.
 * @param {string} clientId -- Google OAuth Client ID
 */
export function initAuth(clientId) {
  if (typeof google === 'undefined' || !google.accounts) {
    document.dispatchEvent(new CustomEvent('auth:error', {
      detail: { message: 'Could not load Google authentication. Check ad blockers.' },
    }));
    return;
  }

  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: handleTokenResponse,
    error_callback: handleTokenError,
  });
}

/**
 * Open the Google consent popup. Must be called from a user gesture (click).
 */
export function requestAuth() {
  if (!_tokenClient) {
    document.dispatchEvent(new CustomEvent('auth:error', {
      detail: { message: 'Authentication not initialised. Reload the page.' },
    }));
    return;
  }
  _tokenClient.requestAccessToken({ prompt: 'consent' });
}

/**
 * @param {object} response -- GIS token response
 */
function handleTokenResponse(response) {
  if (response.error) {
    document.dispatchEvent(new CustomEvent('auth:error', {
      detail: { message: response.error_description || response.error },
    }));
    return;
  }

  _accessToken = response.access_token;
  _tokenExpiry = Date.now() + (response.expires_in * 1000);

  if (!google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) {
    _accessToken = null;
    _tokenExpiry = 0;
    document.dispatchEvent(new CustomEvent('auth:scope_denied', {
      detail: {
        message: 'Gmail modify permission is required to archive and label emails. Please grant access and try again.',
      },
    }));
    return;
  }

  document.dispatchEvent(new CustomEvent('auth:connected'));
}

/**
 * @param {object} error -- GIS error object
 */
function handleTokenError(error) {
  if (error.type === 'popup_closed') return; // user closed popup, not an error
  document.dispatchEvent(new CustomEvent('auth:error', {
    detail: { message: error.message || 'Authentication failed. Please try again.' },
  }));
}

/**
 * Get the current access token, or null if expired/missing.
 * @returns {string|null}
 */
export function getToken() {
  if (!_accessToken || Date.now() > _tokenExpiry) return null;
  return _accessToken;
}

/**
 * Check if the user is currently authenticated.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return _accessToken !== null && Date.now() < _tokenExpiry;
}

/**
 * Revoke the token and clear state.
 */
export function revokeAuth() {
  if (_accessToken) {
    google.accounts.oauth2.revoke(_accessToken);
    _accessToken = null;
    _tokenExpiry = 0;
  }
  document.dispatchEvent(new CustomEvent('auth:disconnected'));
}
