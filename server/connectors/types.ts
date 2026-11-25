export class ConnectorNotConfiguredError extends Error {
  public readonly connectorId: 'gemini-text' | 'gemini-image' | 'gemini-tts' | 'ffmpeg';
  public readonly requirementLabel: string;
  public readonly statusCode: number = 503;

  constructor(
    connectorId: 'gemini-text' | 'gemini-image' | 'gemini-tts' | 'ffmpeg',
    message: string,
    requirementLabel: string,
    statusCode = 503,
  ) {
    super(message);
    this.name = 'ConnectorNotConfiguredError';
    this.connectorId = connectorId;
    this.requirementLabel = requirementLabel;
    this.statusCode = statusCode;
  }
}

export function isEnvConfigured(varName: string, placeholderValues: string[] = []): boolean {
  const val = process.env[varName]?.trim();
  if (!val) return false;
  if (placeholderValues.includes(val)) return false;
  return true;
}

export function sanitizeSecretError(rawMessage: string): string {
  let clean = rawMessage || 'Erreur inattendue du connecteur.';

  const secretVal = process.env.GEMINI_API_KEY?.trim();
  if (secretVal && secretVal.length >= 6) {
    clean = clean.split(secretVal).join('[SECRET_MASQUÉ]');
  }

  clean = clean
    .replace(/AIza[0-9A-Za-z\-_]{10,}/g, '[CLÉ_MASQUÉE]')
    .replace(/(Bearer\s+)[0-9A-Za-z\-_.]+/gi, '$1[JETON_MASQUÉ]')
    .replace(/([?&]key=)[^&\s]+/gi, '$1[CLÉ_MASQUÉE]');

  return clean;
}
