const AUTH_CHANGE_EVENT = "veloop:auth-change";

export function saveSessionToken(token) {
  localStorage.setItem("veloop_token", token);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearSessionToken() {
  localStorage.removeItem("veloop_token");
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export const authChangeEvent = AUTH_CHANGE_EVENT;

