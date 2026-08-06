import type { GraphState } from "./graph.ts";
import type { PreferencesService } from "../services/preferencesService.ts";

export function createSavePreferencesNode(preferencesService: PreferencesService) {
  return async function savePreferencesNode(state: GraphState): Promise<Partial<GraphState>> {
    if (!state.extractedPreferences) {
      return {};
    }

    const userId = state.userId ?? "desconhecido";
    await preferencesService.mergePreferences(userId, state.extractedPreferences);

    console.log("preferências salvas para", userId, ":", state.extractedPreferences);

    // Depois de persistir, o campo é limpo do estado — já cumpriu seu papel e
    // não precisa continuar sendo carregado adiante.
    return { extractedPreferences: undefined };
  };
}
