import { signOut } from "@/app/(auth)/actions";
import { AccountNav } from "@/components/account/account-nav";
import { Container } from "@/components/ui/container";
import { isAdmin } from "@/lib/auth-redirect";
import { getSession } from "@/lib/session";

/**
 * Shell of the customer area: greeting, section nav and sign-out. Not an
 * access check: every page under /account calls `requireUser` itself, so
 * without a session this renders only the page (which redirects).
 */
export default async function AccountLayout({
  children,
}: LayoutProps<"/account">) {
  const session = await getSession();
  if (!session) return children;
  const { user } = session;

  return (
    <Container inset="tile" className="py-12 md:py-20">
      <header className="mb-8 lg:mb-14">
        <h1 className="text-title">Account</h1>
        <p className="text-body text-muted mt-2">Hello, {user.name}.</p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10">
        <AccountNav showAdmin={isAdmin(user.role)} />

        <div className="max-w-2xl lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {children}
        </div>

        {/* After the content on mobile, under the nav from `lg` up. */}
        <form
          action={signOut}
          className="self-start lg:col-start-1 lg:row-start-2"
        >
          <button
            type="submit"
            className="text-label text-muted hover:text-foreground py-2 underline underline-offset-4 transition-colors lg:pl-5"
          >
            Sign out
          </button>
        </form>
      </div>
    </Container>
  );
}
