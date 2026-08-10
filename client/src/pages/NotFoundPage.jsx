import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";
import "../components/ui/StatePanel.css";
import "../components/ui/TextButton.css";

/** In-app 404 with a clear route home (D-RESP-B2's client counterpart). */
export function NotFoundPage() {
  return (
    <main className="state-panel">
      <SearchX className="state-panel-icon" size={40} aria-hidden="true" />
      <h1 className="state-panel-title">Page not found</h1>
      <p className="state-panel-description">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link className="text-btn" to="/">
        Go back home
      </Link>
    </main>
  );
}
