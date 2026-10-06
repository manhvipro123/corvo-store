import Link from "next/link";
import { Search, ShoppingBag, User } from "lucide-react";

import { BagCount } from "@/components/bag/bag-count";
import { Logo } from "@/components/layout/logo";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/text-link";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="bg-background/95 border-border sticky top-0 z-40 border-b backdrop-blur">
      <Container className="h-header flex items-center justify-between">
        <Link href="/" aria-label={`${siteConfig.name} home`}>
          <Logo />
        </Link>
        <nav className="flex items-center gap-6">
          {siteConfig.nav.map((item) => (
            <TextLink key={item.href} href={item.href}>
              {item.label}
            </TextLink>
          ))}
          <Link href="/search" aria-label="Search" className="-m-1 p-1">
            <Search className="size-5" strokeWidth={1.5} aria-hidden />
          </Link>
          {/* Static link: the header never reads the session, so cached pages stay static. */}
          <Link href="/account" aria-label="Account" className="-m-1 p-1">
            <User className="size-5" strokeWidth={1.5} aria-hidden />
          </Link>
          {/* The count is read on the client, so the header stays static. */}
          <Link href="/bag" className="-m-1 flex items-center gap-1 p-1">
            <ShoppingBag className="size-5" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">Bag</span>
            <BagCount />
          </Link>
        </nav>
      </Container>
    </header>
  );
}
