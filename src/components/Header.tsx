import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { canSignIn, isSignedIn, onAuthChange, signIn, signOut, type Provider } from "../lib/oauth";

const LABEL: Record<Provider, string> = { spotify: "Spotify", google: "YouTube Music" };

export function Header() {
  const [, force] = useState(0);
  useEffect(() => {
    const off = onAuthChange(() => force((n) => n + 1));
    return () => void off();
  }, []);

  return (
    <header className="header">
      <NavLink to="/" className="logo">
        DHH<span>.</span>
      </NavLink>
      <nav>
        <NavLink to="/chart">Chart</NavLink>
        <NavLink to="/artists">Artists</NavLink>
        <NavLink to="/build">Build playlist</NavLink>
      </nav>
      <div className="connect">
        {(["spotify", "google"] as Provider[]).map((p) =>
          !canSignIn(p) ? null : isSignedIn(p) ? (
            <button key={p} className={`pill pill--${p} pill--on`} onClick={() => signOut(p)} title="Sign out">
              {LABEL[p]} ✓
            </button>
          ) : (
            <button key={p} className={`pill pill--${p}`} onClick={() => signIn(p)}>
              Connect {LABEL[p]}
            </button>
          ),
        )}
      </div>
    </header>
  );
}
