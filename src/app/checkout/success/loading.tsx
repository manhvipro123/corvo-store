import { LoaderCircle } from "lucide-react";

import { Container } from "@/components/ui/container";

export default function Loading() {
  return (
    <Container inset="tile" className="py-12 md:py-20">
      <p role="status" className="text-body text-muted flex items-center gap-3">
        <LoaderCircle
          className="size-4 animate-spin"
          strokeWidth={1.5}
          aria-hidden
        />
        Loading your order…
      </p>
    </Container>
  );
}
