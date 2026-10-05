import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/text-link";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="bg-background/95 border-border sticky top-0 z-40 border-b backdrop-blur">
      <Container className="h-header flex items-center justify-between">
        <Link href="/" className="text-heading">
          {siteConfig.name}
        </Link>
        <nav className="flex items-center gap-6">
          {siteConfig.nav.map((item) => (
            <TextLink key={item.href} href={item.href}>
              {item.label}
            </TextLink>
          ))}
          <ShoppingBag className="size-5" strokeWidth={1.5} aria-label="Cart" />
        </nav>
      </Container>
    </header>
  );
}
