"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { safeCallbackURL } from "@/lib/auth-redirect";
import {
  type AuthMode,
  type FieldErrors,
  validateAuthForm,
} from "@/lib/auth-validation";

export type AuthFormState = {
  /** Problem with the submission as a whole (shown above the fields). */
  formError?: string;
  /** Per-field problems (shown under each field). */
  fieldErrors?: FieldErrors;
  /** Echoed back so the form keeps what was typed (never the password). */
  values?: { name?: string; email?: string };
};

const text = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

function readForm(mode: AuthMode, data: FormData) {
  const values = {
    name: text(data, "name").trim(),
    email: text(data, "email").trim(),
    password: text(data, "password"),
  };
  return { values, errors: validateAuthForm(mode, values) };
}

const TOO_MANY_ATTEMPTS =
  "Too many attempts. Please wait a minute and try again.";
const UNEXPECTED = "Something went wrong on our side. Please try again.";

export async function signIn(
  _prev: AuthFormState,
  data: FormData,
): Promise<AuthFormState> {
  const { values, errors } = readForm("sign-in", data);
  const echo = { email: values.email };
  if (Object.keys(errors).length) return { fieldErrors: errors, values: echo };

  try {
    await auth.api.signInEmail({
      body: { email: values.email, password: values.password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.statusCode === 429)
        return { formError: TOO_MANY_ATTEMPTS, values: echo };
      // Same message whether or not the email exists.
      return { formError: "Email or password is incorrect.", values: echo };
    }
    console.error("[auth] sign-in failed", error);
    return { formError: UNEXPECTED, values: echo };
  }

  // Outside try/catch: redirect() works by throwing.
  redirect(safeCallbackURL(data.get("callbackURL")));
}

export async function signUp(
  _prev: AuthFormState,
  data: FormData,
): Promise<AuthFormState> {
  const { values, errors } = readForm("sign-up", data);
  const echo = { name: values.name, email: values.email };
  if (Object.keys(errors).length) return { fieldErrors: errors, values: echo };

  try {
    await auth.api.signUpEmail({
      body: {
        name: values.name,
        email: values.email,
        password: values.password,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      const code = String(error.body?.code ?? "");
      if (error.statusCode === 429)
        return { formError: TOO_MANY_ATTEMPTS, values: echo };
      if (code.startsWith("USER_ALREADY_EXISTS"))
        return {
          fieldErrors: {
            email:
              "An account with this email already exists. Sign in instead.",
          },
          values: echo,
        };
      if (code === "INVALID_EMAIL")
        return {
          fieldErrors: { email: "Enter a valid email address." },
          values: echo,
        };
      if (code.startsWith("PASSWORD_TOO"))
        return {
          fieldErrors: { password: error.message },
          values: echo,
        };
      return {
        formError: "We couldn't create your account. Please try again.",
        values: echo,
      };
    }
    console.error("[auth] sign-up failed", error);
    return { formError: UNEXPECTED, values: echo };
  }

  redirect(safeCallbackURL(data.get("callbackURL")));
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
