export const siteConfig = {
  name: "Corvo",
  description: "Quiet luxury, carefully made.",
  nav: [
    { label: "New arrivals", href: "/new-arrivals" },
    { label: "Shop", href: "/products" },
  ],
  /** Sections of the signed-in customer area (`/account`). */
  accountNav: [
    { label: "Overview", href: "/account" },
    { label: "Account details", href: "/account/details" },
  ],
} as const;
