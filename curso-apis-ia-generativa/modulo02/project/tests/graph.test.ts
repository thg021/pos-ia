import { test } from "node:test";
import assert from "node:assert";
import { createServer } from "../src/server.ts";

test("command upper - transforma a mensagem em upper case", async () => {
  const app = createServer();

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: { question: "make this message upper please" },
  });

  const expected = "MAKE THIS MESSAGE UPPER PLEASE";
  assert.deepEqual(response.body, expected);
});

test("command lower - transforma a mensagem em lower case", async () => {
  const app = createServer();

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: { question: "make this message lower please" },
  });

  const expected = "make this message lower please";
  assert.deepEqual(response.body, expected);
});

test("comando desconhecido - retorna mensagem de fallback", async () => {
  const app = createServer();

  const response = await app.inject({
    method: "POST",
    url: "/chat",
    payload: { question: "unknown command" },
  });

  const expected =
    "Não sei que comando é esse. Tente 'upper case' ou 'convert lower case'.";
  assert.deepEqual(response.body, expected);
});
