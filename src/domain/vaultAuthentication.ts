/** iOS biometric UI temporarily makes the app inactive. A real background
 * transition cancels the attempt; a success waits for foreground activation. */
export class VaultAuthentication {
  private generation = 0;
  private pending: number | null = null;
  private state = "active";
  constructor(private unlock: (value: boolean) => void) {}
  begin(state: string) {
    this.pending = null;
    this.state = state;
    return ++this.generation;
  }
  complete(token: number, success: boolean) {
    if (token !== this.generation || !success || this.state === "background")
      return false;
    if (this.state === "active") this.unlock(true);
    else this.pending = token;
    return true;
  }
  change(state: string) {
    this.state = state;
    if (state === "background") this.cancel();
    else if (state === "inactive") this.unlock(false);
    else if (state === "active" && this.pending === this.generation) {
      this.pending = null;
      this.unlock(true);
    }
  }
  invalidate() {
    this.generation++;
    this.pending = null;
  }
  cancel() {
    this.invalidate();
    this.unlock(false);
  }
}
