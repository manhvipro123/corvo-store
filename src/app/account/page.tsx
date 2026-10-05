import type { Metadata } from "next";

import { SectionHeader } from "@/components/ui/section-header";
import { TextLink } from "@/components/ui/text-link";
import { siteConfig } from "@/config/site";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false },
};

const memberSince = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default async function AccountPage() {
  const { user } = await requireUser("/account");
  const details = [
    ["Name", user.name],
    ["Email", user.email],
    ["Member since", memberSince.format(user.createdAt)],
  ] as const;

  return (
    <div className="flex flex-col gap-14">
      <section>
        <SectionHeader
          title="Account details"
          action={{ label: "Edit", href: "/account/details" }}
        />
        <dl className="border-border border-t">
          {details.map(([label, value]) => (
            <div
              key={label}
              className="border-border flex justify-between gap-6 border-b py-4"
            >
              <dt className="text-label shrink-0">{label}</dt>
              <dd className="text-body text-muted min-w-0 truncate">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <SectionHeader
          title="Continue shopping"
          description="Pick up where you left off."
        />
        <ul className="flex flex-wrap gap-x-8 gap-y-3">
          {siteConfig.nav.map((item) => (
            <li key={item.href}>
              <TextLink variant="action" href={item.href}>
                {item.label}
              </TextLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
