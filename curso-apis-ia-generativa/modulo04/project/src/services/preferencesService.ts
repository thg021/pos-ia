import knex, { type Knex } from "knex";

export type UserPreferencesRow = {
  user_id: string;
  name?: string | null;
  age?: number | null;
  genres?: string | null;
  bands?: string | null;
  conversation_summary?: string | null;
  updated_at?: string;
};

const TABLE_NAME = "user_preferences";

export class PreferencesService {
  private db: Knex;
  private ready: Promise<void>;

  constructor(dbPath: string) {
    this.db = knex({ client: "better-sqlite3", connection: { filename: dbPath }, useNullAsDefault: true });
    this.ready = this.migrate();
  }

  private async migrate(): Promise<void> {
    const exists = await this.db.schema.hasTable(TABLE_NAME);
    if (exists) return;

    await this.db.schema.createTable(TABLE_NAME, (table) => {
      table.string("user_id").primary();
      table.string("name");
      table.integer("age");
      // genres/bands são arrays no domínio, mas o SQLite não tem tipo array
      // nativo — guardamos como JSON serializado nesta coluna de texto.
      table.text("genres");
      table.text("bands");
      table.text("conversation_summary");
      table.string("updated_at");
    });
  }

  private serialize(data: Record<string, unknown>): Record<string, unknown> {
    const output: Record<string, unknown> = { ...data };
    if (Array.isArray(output.genres)) output.genres = JSON.stringify(output.genres);
    if (Array.isArray(output.bands)) output.bands = JSON.stringify(output.bands);
    return output;
  }

  private deserialize(row: UserPreferencesRow | undefined): Record<string, unknown> | undefined {
    if (!row) return undefined;
    return {
      ...row,
      genres: row.genres ? JSON.parse(row.genres) : undefined,
      bands: row.bands ? JSON.parse(row.bands) : undefined,
    };
  }

  async getBasicInfo(userId: string): Promise<Record<string, unknown> | undefined> {
    await this.ready;
    const row = await this.db<UserPreferencesRow>(TABLE_NAME).where({ user_id: userId }).first();
    return this.deserialize(row);
  }

  // O ponto-chave de mergePreferences: ele mescla o que já existia com o dado
  // novo, em vez de sobrescrever tudo — assim, se o cliente já tinha dito o
  // nome numa conversa anterior e agora só menciona uma banda nova, o nome
  // não se perde.
  async mergePreferences(userId: string, newData: Record<string, unknown>): Promise<void> {
    await this.ready;
    const existing = await this.getBasicInfo(userId);
    const merged = this.serialize({
      ...existing,
      ...newData,
      user_id: userId,
      updated_at: new Date().toISOString(),
    });

    await this.db(TABLE_NAME).insert(merged).onConflict("user_id").merge();
  }

  async storeSummary(userId: string, summary: string): Promise<void> {
    await this.ready;
    const existing = await this.getBasicInfo(userId);
    if (!existing) {
      await this.db(TABLE_NAME).insert({
        user_id: userId,
        conversation_summary: summary,
        updated_at: new Date().toISOString(),
      });
      return;
    }

    await this.db(TABLE_NAME).where({ user_id: userId }).update({ conversation_summary: summary });
  }

  async destroy(): Promise<void> {
    await this.db.destroy();
  }
}
