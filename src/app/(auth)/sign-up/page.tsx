import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signUp } from "@/app/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/text-link";
import { safeCallbackURL } from "@/lib/auth-redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({
  searchParams,
}: PageProps<"/sign-up">) {
  const callbackURL = safeCallbackURL((await searchParams).callbackURL);
  if (await getSession()) redirect(callbackURL);

  return (
    <Container inset="tile" className="py-12 md:py-20">
      <div className="max-w-md">
        <h1 className="text-title">Create an account</h1>
        <p className="text-body text-muted mt-2 mb-10">
          Save your details for a faster checkout later.
        </p>
        <AuthForm
          mode="sign-up"
          action={signUp}
          callbackURL={callbackURL}
          submitLabel="Create account"
          pendingLabel="Creating account…"
        />
        <p className="text-meta text-muted mt-8">
          Already have an account?{" "}
          <TextLink
            variant="inline"
            href={`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`}
            className="text-foreground"
          >
            Sign in
          </TextLink>
        </p>
      </div>
    </Container>
  );
}
