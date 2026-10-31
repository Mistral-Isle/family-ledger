import { useEffect, useState } from "react";
import { createSubmissionGuard } from "../domain/submission";

export function useSubmissionGuard(formKey?: unknown) {
  const [guard] = useState(createSubmissionGuard);
  // Reset only after a different form has committed, never between queued taps.
  useEffect(() => guard.reset(), [guard, formKey]);
  return guard;
}
