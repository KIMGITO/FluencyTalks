import { C } from "@/theme/theme";
import { Link } from "react-router-dom";
import { BRAND } from "@/lib/site";
import { useThemeStore } from "@/store/themeStore";

/**
 * The logo. The icon switches with the theme. `light` is for use on the deep indigo bands (footer):
 * those are dark in both themes, so they always get the light-on-dark icon and white text.
 * `to` is where it links (the signed-in top bar links to /home).
 */
export const Logo = ({ compact, light, to = '/' }: { compact?: boolean; light?: boolean; to?: string }) => {
  const { mode } = useThemeStore();

  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const onDark = isDark || !!light;

  return (
    <Link
      to={to}
      style={{ textDecoration: 'none' }}
      aria-label={`${BRAND} Home`}
    >
      <span className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center overflow-hidden">
          <img
            src={onDark ? '/favicon.png' : '/favicon-dark.png'}
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
};
