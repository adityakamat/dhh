import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { completeSignIn } from "./lib/oauth";
import "./styles.css";

// Finish a web OAuth redirect before the hash router reads the URL.
async function boot() {
  let authError: string | null = null;
  try {
    const returnTo = await completeSignIn(location.href);
    if (returnTo) history.replaceState(null, "", `${location.pathname}${returnTo}`);
  } catch (e) {
    authError = (e as Error).message;
    history.replaceState(null, "", `${location.pathname}#/`);
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App initialError={authError} />
    </StrictMode>,
  );
}
boot();
