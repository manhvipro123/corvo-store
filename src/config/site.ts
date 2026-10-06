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
    { label: "Orders", href: "/account/orders" },
    { label: "Account details", href: "/account/details" },
  ],
  /** Sections of the admin area (`/admin`). */
  adminNav: [{ label: "Overview", href: "/admin" }],
} as const;
