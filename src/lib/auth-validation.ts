/**
 * Sign-in / sign-up rules shared by the browser (instant feedback), the
 * Server Actions (authoritative) and Better Auth's own limits, so the three
 * can't drift apart.
 */

export const PASSWORD_MIN_LENGTH = 8;
/** Better Auth's default maximum; longer input is rejected by the API. */
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;

export type AuthField = "name" | "email" | "password";
export type FieldErrors = Partial<Record<AuthField, string>>;
export type AuthMode = "sign-in" | "sign-up";

// Deliberately loose: one "@", a dot in the domain, no spaces. The server
// (Better Auth) has the final say.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateField(
  mode: AuthMode,
  field: AuthField,
  raw: string,
): string | undefined {
  const value = field === "password" ? raw : raw.trim();

  switch (field) {
    case "name":
      if (!value) return "Enter your name.";
      if (value.length > NAME_MAX_LENGTH)
        return `Use ${NAME_MAX_LENGTH} characters or fewer.`;
      return;
    case "email":
      if (!value) return "Enter your email address.";
      if (value.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(value))
        return "Enter a valid email address, like name@example.com.";
      return;
    case "password":
      if (!value) return "Enter your password.";
      // Length rules only apply when choosing a password; at sign-in any
      // stored password must be accepted.
      if (mode === "sign-up" && value.length < PASSWORD_MIN_LENGTH)
        return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
      if (value.length > PASSWORD_MAX_LENGTH)
        return `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
      return;
  }
}

export const fieldsFor = (mode: AuthMode): AuthField[] =>
  mode === "sign-up" ? ["name", "email", "password"] : ["email", "password"];

/** Errors for every field of the form; empty object when all valid. */
export function validateAuthForm(
  mode: AuthMode,
  values: Partial<Record<AuthField, string>>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fieldsFor(mode)) {
    const error = validateField(mode, field, values[field] ?? "");
    if (error) errors[field] = error;
  }
  return errors;
}

export type PasswordChangeField = "currentPassword" | "newPassword";
export type PasswordChangeErrors = Partial<Record<PasswordChangeField, string>>;

/** Change-password rules, shared by the account form and its Server Action. */
export function validatePasswordChangeField(
  field: PasswordChangeField,
  value: string,
  currentPassword = "",
): string | undefined {
  if (field === "currentPassword") {
    if (!value) return "Enter your current password.";
    // Any stored password is accepted, as at sign-in.
    return validateField("sign-in", "password", value);
  }
  if (!value) return "Enter a new password.";
  const error = validateField("sign-up", "password", value);
  if (error) return error;
  if (value === currentPassword)
    return "Choose a password different from your current one.";
}

export function validatePasswordChange(values: {
  currentPassword: string;
  newPassword: string;
}): PasswordChangeErrors {
  const errors: PasswordChangeErrors = {};
  for (const field of ["currentPassword", "newPassword"] as const) {
    const error = validatePasswordChangeField(
      field,
      values[field],
      values.currentPassword,
    );
    if (error) errors[field] = error;
  }
  return errors;
}
