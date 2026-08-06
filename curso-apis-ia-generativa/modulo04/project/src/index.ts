// Ponto de entrada do projeto: diferente dos módulos anteriores (que subiam
// um servidor HTTP), este módulo roda como um script de linha de comando.
// Toda a lógica do loop de conversa vive em `cli.ts` — este arquivo existe só
// para casar com a convenção `main -> src/index.ts` usada nos outros módulos.
import "./cli.ts";
