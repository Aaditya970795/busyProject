import { useLocation } from "react-router-dom";

// A subtle fade+slide on route change — re-keyed by pathname so React remounts (and re-plays
// the animation on) the wrapper every time the URL changes, without touching the page underneath.
export function PageTransition({ children }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-fade-in">
      {children}
    </div>
  );
}
