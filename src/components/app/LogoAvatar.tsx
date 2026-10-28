import { UserRound } from "lucide-react";
import { useState } from "react";

/** Public assets must be addressed through the deploy base path so the same
 * reference works at "/" in dev and at "/<repo>/" on GitHub Pages. */
const logoSrc = `${import.meta.env.BASE_URL}logo.svg`;

/**
 * The app's own logo rendered as a round avatar — the default profile
 * picture everywhere until the principal uploads their own photo.
 * Falls back to the generic user icon if the asset ever fails to load.
 */
export function LogoAvatar({ className = "size-9" }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <UserRound className={`${className} text-muted-foreground`} />;
  }
  return (
    <img
      src={logoSrc}
      alt="شعار حاضِر"
      onError={() => setFailed(true)}
      className={`${className} rounded-full object-cover`}
    />
  );
}
