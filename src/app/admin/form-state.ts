/** What an admin form's Server Action returns (see `useActionState`). */
export type AdminFormState<F extends string> = {
  /** Problem with the submission as a whole. */
  formError?: string;
  fieldErrors?: Partial<Record<F, string>>;
  /** Echoed back so the form keeps what was typed. */
  values?: Partial<Record<F, string>>;
  /** True right after a successful save. */
  saved?: boolean;
};

export const SAVE_FAILED = "We couldn't save your changes. Please try again.";
