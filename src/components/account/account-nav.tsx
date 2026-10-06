import { SectionNav } from "@/components/layout/section-nav";
import { siteConfig } from "@/config/site";

/** Account sections, plus a link into the admin area for admins. */
export function AccountNav({ showAdmin }: { showAdmin: boolean }) {
  const items = [
    ...siteConfig.accountNav,
    ...(showAdmin ? [{ label: "Admin", href: "/admin" }] : []),
  ];
  return <SectionNav label="Account" items={items} rootHref="/account" />;
}
