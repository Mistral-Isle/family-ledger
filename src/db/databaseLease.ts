// Native SQLite handles its own database locks. The web implementation owns
// the entire OPFS pool for one document's lifetime.
export async function acquireDatabaseLease(): Promise<void> {}
