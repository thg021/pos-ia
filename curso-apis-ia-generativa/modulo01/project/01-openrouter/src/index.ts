import { createServer } from "./server.ts";
import { OpenRouterService } from "./openrouter-service.ts";
import { config } from "./config.ts";

const routerService = new OpenRouterService();
const app = createServer(routerService);
await app.listen({ port: config.port, host: "localhost" });
