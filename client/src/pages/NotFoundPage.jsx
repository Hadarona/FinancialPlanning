import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Page not found</h1>
      <p>The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link to="/">Go back home</Link>
    </main>
  );
}
