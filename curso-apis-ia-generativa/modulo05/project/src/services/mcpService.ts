import { MultiServerMCPClient } from "@langchain/mcp-adapters";

async function loadTools() {
  const mcpClient = new MultiServerMCPClient({
    filesystem: {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    },
  });

  return mcpClient.getTools();
}

// Memoizado: o transporte `stdio` sobe o servidor MCP como um processo local
// separado — não faz sentido (nem é rápido) subir um novo processo a cada
// mensagem trocada na conversa.
let toolsPromise: ReturnType<typeof loadTools> | undefined;

export function getMcpTools() {
  if (!toolsPromise) toolsPromise = loadTools();
  return toolsPromise;
}
