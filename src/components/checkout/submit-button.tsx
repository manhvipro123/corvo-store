"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/** Submit button that shows a spinner and `pendingLabel` while its form posts. */
export function SubmitButton({
  children,
  pendingLabel,
  variant,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} fullWidth disabled={pending}>
      {pending && (
        <LoaderCircle
          className="size-4 animate-spin"
          strokeWidth={1.5}
          aria-hidden
        />
      )}
      {pending ? pendingLabel : children}
    </Button>
  );
}
