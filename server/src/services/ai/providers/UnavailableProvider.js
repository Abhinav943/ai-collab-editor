const AI_DISABLED_MESSAGE = 'AI features are unavailable. Set AI_PROVIDER=mock for local development or configure a valid provider API key.';

export default class UnavailableProvider {
  async chat() { throw new Error(AI_DISABLED_MESSAGE); }
  async generateCode() { throw new Error(AI_DISABLED_MESSAGE); }
  async explainCode() { throw new Error(AI_DISABLED_MESSAGE); }
  async reviewCode() { throw new Error(AI_DISABLED_MESSAGE); }
  async fixError() { throw new Error(AI_DISABLED_MESSAGE); }
  async generateTests() { throw new Error(AI_DISABLED_MESSAGE); }
  async detectBugs() { throw new Error(AI_DISABLED_MESSAGE); }
  async complete() { throw new Error(AI_DISABLED_MESSAGE); }

  async probe() {
    return { ok: false, provider: 'unavailable', message: AI_DISABLED_MESSAGE };
  }
}
