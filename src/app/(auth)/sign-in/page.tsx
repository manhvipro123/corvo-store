import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signIn } from "@/app/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/text-link";
import { safeCallbackURL } from "@/lib/auth-redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const callbackURL = safeCallbackURL((await searchParams).callbackURL);
  if (await getSession()) redirect(callbackURL);

  return (
    <Container inset="tile" className="py-12 md:py-20">
      <div className="max-w-md">
        <h1 className="text-title">Sign in</h1>
        <p className="text-body text-muted mt-2 mb-10">
          Welcome back. Sign in to your Corvo account.
        </p>
        <AuthForm
          mode="sign-in"
          action={signIn}
          callbackURL={callbackURL}
          submitLabel="Sign in"
          pendingLabel="Signing in…"
        />
        <p className="text-meta text-muted mt-8">
          New to Corvo?{" "}
          <TextLink
            variant="inline"
            href={`/sign-up?callbackURL=${encodeURIComponent(callbackURL)}`}
            className="text-foreground"
          >
            Create an account
          </TextLink>
        </p>
      </div>
    </Container>
  );
}
