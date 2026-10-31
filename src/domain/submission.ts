/** One successful write per form. Failures remain retryable; a new form resets it. */
export function createSubmissionGuard() {
  let submitted = false;
  return {
    reset() {
      submitted = false;
    },
    run(write: () => void): boolean {
      if (submitted) return false;
      submitted = true;
      try {
        write();
        return true;
      } catch (error) {
        submitted = false;
        throw error;
      }
    },
  };
}
