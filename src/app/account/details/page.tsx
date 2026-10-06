import type { Metadata } from "next";

import { PasswordForm } from "@/components/account/password-form";
import { ProfileForm } from "@/components/account/profile-form";
import { SectionHeader } from "@/components/ui/section-header";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Account details",
  robots: { index: false },
};

export default async function AccountDetailsPage() {
  const { user } = await requireUser("/account/details");

  return (
    <div className="flex flex-col gap-14">
      <section>
        <SectionHeader
          title="Account details"
          description="The name we use on your account."
        />
        <ProfileForm name={user.name} email={user.email} />
      </section>

      <section className="border-border border-t pt-14">
        <SectionHeader
          title="Password"
          description="Changing it signs you out on all other devices."
        />
        <PasswordForm email={user.email} />
      </section>
    </div>
  );
}
