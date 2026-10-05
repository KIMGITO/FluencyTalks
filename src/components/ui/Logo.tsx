import { C } from "@/theme/theme";
import { Link } from "react-router-dom";

export const Logo = ({ compact }: { compact?: boolean }) => (
  <Link
              to="/"
              style={{ textDecoration: 'none' }}
              aria-label="FluencyTalks Home"
            >
  <span className="flex items-center gap-2">
    <span className="flex h-9 w-9 items-center justify-center overflow-hidden">
      <img
        src="/favicon.png"
        alt="FluencyTalks Logo"
        className="h-full w-full object-contain"
      />
    </span>
    {!compact && (
      <span className="font-display text-xl font-bold">
        Fluency<span className="ft-gradient-text" style={{color: C.indigo}} >Talks</span>
      </span>
    )}
  </span>
  </Link>
);
