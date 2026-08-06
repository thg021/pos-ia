import { createServer } from "./server.ts";
import { graph } from "./graph/factory.ts";

const app = createServer(graph);
await app.listen({ port: 3000, host: "localhost" });
