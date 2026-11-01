import { C } from "@/theme/theme";
import { Link } from "react-router-dom";
import { BRAND } from "@/lib/site";

export const Logo = ({ compact, light, to = '/' }: { compact?: boolean; light?: boolean; to?: string }) => (
  <Link
    to={to}
    style={{ textDecoration: 'none' }}
    aria-label={`${BRAND} Home`}
  >
    <span className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden">
        <img
          src="/favicon.png"
          alt={`${BRAND} Logo`}
          className="h-full w-full object-contain"
        />
      </span>
      {!compact && (
        <span
          className="whitespace-nowrap font-display text-lg font-semibold ft-logo-text sm:text-xl"
          style={light ? { color: '#ffffff' } : undefined}
        >
          The Fluency<span className="ft-gradient-text" style={{ color: light ? '#ffffff' : C.indigo }}>Talks</span>
        </span>
      )}
    </span>
  </Link>
);
