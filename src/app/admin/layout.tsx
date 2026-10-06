import type { Metadata } from "next";
import Link from "next/link";

import { SectionNav } from "@/components/layout/section-nav";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import { isAdmin } from "@/lib/auth-redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Shell of the admin area. Not an access check: every page and Server
 * Action under /admin calls `requireAdmin` itself (a layout doesn't re-run
 * on client navigation, and doesn't know the page's path for the sign-in
 * redirect). Without an admin session this renders only the page, which
 * then redirects or 404s.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await getSession();
  if (!session || !isAdmin(session.user.role)) return children;

  return (
    <Container inset="tile" className="py-12 md:py-20">
      <header className="mb-8 lg:mb-14">
        <h1 className="text-title">Admin</h1>
        <p className="text-body text-muted mt-2">
          Signed in as {session.user.email}.
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10">
        <SectionNav
          label="Admin"
          items={siteConfig.adminNav}
          rootHref="/admin"
        />

        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {children}
        </div>

        <Link
          href="/account"
          className="text-label text-muted hover:text-foreground self-start py-2 underline underline-offset-4 transition-colors lg:col-start-1 lg:row-start-2 lg:pl-5"
        >
          Your account
        </Link>
      </div>
    </Container>
  );
}
