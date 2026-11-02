import { useEffect, useState } from "react";
import { HashRouter, Link, Route, Routes, useNavigate } from "react-router-dom";
import { Header } from "./components/Header";
import { SUGGEST_URL } from "./data/artists";
import { listenForNativeRedirects } from "./lib/oauth";
import { ArtistPage, ArtistsPage } from "./pages/ArtistPage";
import { BuildPage } from "./pages/BuildPage";
import { ChartPage } from "./pages/ChartPage";
import { GenrePage } from "./pages/GenrePage";
import { HomePage } from "./pages/HomePage";

export function App({ initialError }: { initialError: string | null }) {
  return (
    <HashRouter>
      <Shell initialError={initialError} />
    </HashRouter>
  );
}

function Shell({ initialError }: { initialError: string | null }) {
  const [error, setError] = useState(initialError);
  const navigate = useNavigate();

  useEffect(() => {
    listenForNativeRedirects((returnTo, err) => {
      if (err) setError(err.message);
      else if (returnTo) navigate(returnTo.replace(/^#/, ""));
    });
  }, [navigate]);

  return (
    <>
      <Header />
      {error && (
        <div className="banner banner--error" role="alert">
          {error} <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/chart" element={<ChartPage />} />
          <Route path="/genre/:id" element={<GenrePage />} />
          <Route path="/build" element={<BuildPage />} />
          <Route path="/artists" element={<ArtistsPage />} />
          <Route path="/artist/:id" element={<ArtistPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      <footer className="footer">
        DHH chart: YouTube view velocity, growth, reach, engagement and community votes, recomputed every Monday. New releases
        are picked up from every <Link to="/artists">artist we track</Link>.{" "}
        <a href={SUGGEST_URL} target="_blank" rel="noreferrer">
          Suggest an artist
        </a>
      </footer>
    </>
  );
}
