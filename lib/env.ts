/** Lit les cles .env.local avec trim (espaces / retours ligne). */
export function getOpenAIKey(): string | undefined {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || key === "..." || key.length < 20) return undefined;
  return key;
}

/** Modele avec recherche web (Responses API). Defaut: gpt-4o */
export function getOpenAIModel(): string {
  const model = process.env.OPENAI_MODEL?.trim();
  return model && model.length > 2 ? model : "gpt-4o";
}
