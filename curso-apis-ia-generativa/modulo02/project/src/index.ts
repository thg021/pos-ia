import { createServer } from "./server.ts";

const app = createServer();
await app.listen({ port: 3000, host: "localhost" });
