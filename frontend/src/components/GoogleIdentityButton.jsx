import { useEffect, useRef } from "react";

let googleScriptPromise;
function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google sign-in could not load. Check your internet connection."));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

export default function GoogleIdentityButton({ mode = "login", theme = "filled_black", width = 360, onCredential, onError }) {
  const buttonRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;
    let active = true;
    loadGoogleIdentityScript().then(() => {
      if (!active || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: response => response.credential
          ? onCredential(response.credential)
          : onError("Google did not return a sign-in credential.")
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme,
        size: "large",
        shape: "rectangular",
        text: mode === "signup" ? "signup_with" : "signin_with",
        width
      });
    }).catch(error => { if (active) onError(error.message); });
    return () => { active = false; };
  }, [clientId, mode, theme, width, onCredential, onError]);

  if (!clientId) return <div className="google-unconfigured">
    <button type="button" disabled aria-label="Google sign-in requires configuration">
      <span aria-hidden="true">G</span>{mode === "signup" ? "Sign up with Google" : "Continue with Google"}
    </button>
    <small>Configure a Google OAuth client ID to enable this option.</small>
  </div>;
  return <div className="google-signin-wrap"><div className="google-signin" ref={buttonRef} /></div>;
}

