import { readFile } from "node:fs/promises";
import { usersFilePath } from "../config.ts";

export type Role = "admin" | "member";

export type UserRecord = {
  name: string;
  role: Role;
  permissions: string[];
};

// Cache simples em memória: o arquivo é lido uma única vez por processo — não
// há necessidade de reler `users.json` do disco a cada mensagem da conversa.
let usersCache: Record<string, UserRecord> | undefined;

async function loadUsers(): Promise<Record<string, UserRecord>> {
  if (!usersCache) {
    const raw = await readFile(usersFilePath, "utf-8");
    usersCache = JSON.parse(raw);
  }
  return usersCache!;
}

export async function getUser(userId: string): Promise<UserRecord | undefined> {
  const users = await loadUsers();
  return users[userId];
}
