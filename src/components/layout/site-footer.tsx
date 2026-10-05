import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <Container className="text-meta text-muted py-8">
        © {new Date().getFullYear()} {siteConfig.name}
      </Container>
    </footer>
  );
}
