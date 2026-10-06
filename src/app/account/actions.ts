"use server";

import { APIError } from "better-auth/api";
import { refresh } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { TOO_MANY_ATTEMPTS, tooManyAttempts } from "@/lib/auth-rate-limit";
import {
  type PasswordChangeErrors,
  validateField,
  validatePasswordChange,
} from "@/lib/auth-validation";
import { requireUser } from "@/lib/session";

export type ProfileFormState = {
  /** Problem with the submission as a whole. */
  formError?: string;
  fieldErrors?: { name?: string };
  /** Echoed back so the form keeps what was typed. */
  values?: { name?: string };
  /** True right after a successful save. */
  saved?: boolean;
};

export async function updateProfile(
  _prev: ProfileFormState,
  data: FormData,
): Promise<ProfileFormState> {
  await requireUser("/account/details");

  const raw = data.get("name");
  const name = typeof raw === "string" ? raw.trim() : "";
  const values = { name };
  // Name rules are the same as at sign-up.
  const error = validateField("sign-up", "name", name);
  if (error) return { fieldErrors: { name: error }, values };

  try {
    // Only `name` is sent; `role` is input: false in the admin plugin.
    await auth.api.updateUser({ body: { name }, headers: await headers() });
  } catch (error) {
    console.error("[account] profile update failed", error);
    return {
      formError: "We couldn't save your changes. Please try again.",
      values,
    };
  }

  // Re-render the layout too, so the greeting shows the new name.
  refresh();
  return { saved: true, values };
}

export type PasswordFormState = {
  formError?: string;
  fieldErrors?: PasswordChangeErrors;
  /** True right after a successful change. Passwords are never echoed. */
  saved?: boolean;
};

export async function changePassword(
  _prev: PasswordFormState,
  data: FormData,
): Promise<PasswordFormState> {
  const { user } = await requireUser("/account/details");

  const text = (key: string) => {
    const value = data.get(key);
    return typeof value === "string" ? value : "";
  };
  const values = {
    currentPassword: text("currentPassword"),
    newPassword: text("newPassword"),
  };
  const errors = validatePasswordChange(values);
  if (Object.keys(errors).length) return { fieldErrors: errors };

  const requestHeaders = await headers();
  // Limits guessing the current password with a stolen session.
  if (
    await tooManyAttempts("change-password", {
      headers: requestHeaders,
      account: user.id,
    })
  )
    return { formError: TOO_MANY_ATTEMPTS };

  try {
    // Not `revokeOtherSessions: true`: that also replaces this browser's
    // session, and the re-render in this same request would still send the
    // old cookie and bounce through sign-in. Revoke the others separately.
    await auth.api.changePassword({
      body: values,
      headers: requestHeaders,
    });
    await auth.api.revokeOtherSessions({ headers: requestHeaders });
  } catch (error) {
    if (error instanceof APIError) {
      const code = String(error.body?.code ?? "");
      if (code === "INVALID_PASSWORD")
        return {
          fieldErrors: {
            currentPassword: "Your current password is incorrect.",
          },
        };
      if (code.startsWith("PASSWORD_TOO"))
        return { fieldErrors: { newPassword: error.message } };
    } else {
      console.error("[account] password change failed", error);
    }
    return {
      formError: "We couldn't change your password. Please try again.",
    };
  }

  return { saved: true };
}
