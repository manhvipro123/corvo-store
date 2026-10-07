import { siteConfig } from "@/config/site";

/** Geometric crow head ("corvo"); the eye is cut out, so it inherits the text colour. */
const CROW_PATH =
  "M6 60V36L12 22L24 12L38 8L47 11L62 23L46 27L42 38L40 60Z M33 16H38V21H33Z";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path fillRule="evenodd" d={CROW_PATH} />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="text-heading flex items-center gap-2">
      <LogoMark className="size-6" />
      {siteConfig.name}
    </span>
  );
}
