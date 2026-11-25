import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { AspectRatio, GeminiVoiceName, Scene } from '../../src/types/film';
import {
  ConnectorNotConfiguredError,
  isEnvConfigured,
  sanitizeSecretError,
} from './types';

export const GEMINI_TEXT_MODEL = 'gemini-4-hydrogen';
export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
export const GEMINI_TTS_MODEL = 'gemini-3.8-flash-lite-tts';

export const MEDIA_DIR = path.resolve('/tmp/nova-ai-film');

export function ensureMediaDir(): string {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
  return MEDIA_DIR;
}

export function isGeminiConfigured(): boolean {
  return isEnvConfigured('GEMINI_API_KEY', ['MY_GEMINI_API_KEY']);
}

function createGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const isTransient =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('DEADLINE_EXCEEDED');
      if (!isTransient || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }
  }
  throw lastError;
}

function mapGeminiUpstreamError(
  error: unknown,
  modelId: string,
): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const clean = sanitizeSecretError(raw);

  if (
    clean.includes('API_KEY_INVALID') ||
    clean.includes('PERMISSION_DENIED') ||
    clean.includes('403') ||
    clean.includes('401')
  ) {
    return {
      status: 403,
      message:
        'Clé API Google Gemini invalide ou refusée. Vérifiez la variable GEMINI_API_KEY dans le panneau Settings > Secrets.',
    };
  }

  if (clean.includes('RESOURCE_EXHAUSTED') || clean.includes('429')) {
    return {
      status: 429,
      message: `Quota gratuit temporairement atteint pour le modèle ${modelId} (429). Vous pouvez utiliser des images locales/importées pour le diaporama FFmpeg ou vérifier votre quota dans AI Studio (Settings > Secrets).`,
    };
  }

  if (clean.includes('503') || clean.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message:
        'Le service Google Gemini répond bien à votre clé AI Studio, mais connaît un pic de charge temporaire (503). Réessayez dans quelques secondes.',
    };
  }

  if (clean.includes('NOT_FOUND') || clean.includes('404')) {
    return {
      status: 404,
      message: `Le modèle ${modelId} n'est pas accessible avec cette clé AI Studio.`,
    };
  }

  return {
    status: 502,
    message: `Erreur de communication avec Google Gemini (${modelId}) : ${clean}`,
  };
}

function mapProjectRatioToGeminiImageRatio(
  aspectRatio: AspectRatio,
): '16:9' | '9:16' | '1:1' | '4:3' | '3:4' {
  switch (aspectRatio) {
    case '9:16':
      return '9:16';
    case '1:1':
      return '1:1';
    default:
      return '16:9';
  }
}

export const GEMINI_TEXT_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

function isTransientOverloadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('aborted') ||
    msg.includes('timeout')
  );
}

export interface GeminiConnectionTestResult {
  ok: boolean;
  configured: boolean;
  connector: 'gemini-text';
  model: string;
  latencyMs: number;
  replyText: string;
  checkedAt: string;
}

export async function testGeminiConnection(): Promise<GeminiConnectionTestResult> {
  if (!isGeminiConfigured()) {
    throw new ConnectorNotConfiguredError(
      'gemini-text',
      "Variable serveur GEMINI_API_KEY absente ou non configurée. Définissez-la dans Settings > Secrets d'AI Studio.",
      'GEMINI_API_KEY (AI Studio)',
    );
  }

  const ai = createGeminiClient();
  const startedAt = Date.now();
  let usedModel = GEMINI_TEXT_MODEL;

  const callModel = async (model: string, maxAttempts: number, timeoutMs?: number) =>
    generateWithRetry(
      () =>
        ai.models.generateContent({
          model,
          contents:
            'Réponds uniquement par "OK" suivi d’une courte confirmation en français de 6 mots maximum.',
          config: {
            ...(timeoutMs ? { abortSignal: AbortSignal.timeout(timeoutMs) } : {}),
            ...(model === GEMINI_TEXT_MODEL
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            systemInstruction:
              'Tu es le service de vérification technique du studio NOVA AI FILM. Réponds de façon brève et factuelle.',
          },
        }),
      maxAttempts,
    );

  try {
    let response;
    try {
      response = await callModel(GEMINI_TEXT_MODEL, 1, 7000);
    } catch (primaryError) {
      if (!isTransientOverloadError(primaryError)) {
        throw primaryError;
      }
      usedModel = GEMINI_TEXT_FALLBACK_MODEL;
      response = await callModel(GEMINI_TEXT_FALLBACK_MODEL, 2, 15000);
    }

    const latencyMs = Date.now() - startedAt;
    const replyText = (response.text ?? '').trim();

    if (!replyText) {
      throw new Error('Réponse vide retournée par Google Gemini.');
    }

    return {
      ok: true,
      configured: true,
      connector: 'gemini-text',
      model: usedModel,
      latencyMs,
      replyText,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const mapped = mapGeminiUpstreamError(error, usedModel);
    throw new ConnectorNotConfiguredError(
      'gemini-text',
      mapped.message,
      'GEMINI_API_KEY (AI Studio)',
      mapped.status,
    );
  }
}

export interface GeminiSceneAnalysisResult {
  connector: 'gemini-text';
  model: string;
  sceneId: string;
  analysisText: string;
}

export async function analyzeSceneWithGemini(
  projectTitle: string,
  visualStyle: string,
  scene: Scene,
): Promise<GeminiSceneAnalysisResult> {
  if (!isGeminiConfigured()) {
    throw new ConnectorNotConfiguredError(
      'gemini-text',
      'Connexion AI Studio GEMINI_API_KEY requise dans Settings > Secrets.',
      'GEMINI_API_KEY (AI Studio)',
    );
  }

  const ai = createGeminiClient();

  const formattedBlocks = scene.blocks
    .slice(0, 120)
    .map((b) => {
      if (b.type === 'character') return `\n${b.content.toUpperCase()}`;
      if (b.type === 'parenthetical') return `  ${b.content}`;
      if (b.type === 'dialogue') return `  "${b.content}"`;
      return b.content;
    })
    .join('\n');

  const prompt = [
    `Projet : ${projectTitle}`,
    `Style visuel : ${visualStyle || 'Non précisé'}`,
    `Scène ${scene.number} : ${scene.heading.intExt} ${scene.heading.location} - ${scene.heading.timeOfDay}`,
    `Synopsis : ${scene.synopsis || 'Non précisé'}`,
    `Contenu du scénario :\n${formattedBlocks}`,
    '',
    'En tant que script-doctor et directeur de la photographie, donne en français une analyse concise en 3 points :',
    '1. Rythme dramatique et tension des dialogues.',
    '2. Clarté visuelle pour le storyboard photo et le diaporama.',
    '3. Une suggestion concrète de mise en scène.',
  ].join('\n');

  let usedModel = GEMINI_TEXT_MODEL;
  const callAnalyze = (model: string, maxAttempts: number, timeoutMs?: number) =>
    generateWithRetry(
      () =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            ...(timeoutMs ? { abortSignal: AbortSignal.timeout(timeoutMs) } : {}),
            systemInstruction:
              'Tu es un script-doctor professionnel pour le studio NOVA AI FILM. Réponds uniquement en français, de manière structurée et pragmatique.',
          },
        }),
      maxAttempts,
    );

  try {
    let response;
    try {
      response = await callAnalyze(GEMINI_TEXT_MODEL, 1, 9000);
    } catch (primaryError) {
      if (!isTransientOverloadError(primaryError)) {
        throw primaryError;
      }
      usedModel = GEMINI_TEXT_FALLBACK_MODEL;
      response = await callAnalyze(GEMINI_TEXT_FALLBACK_MODEL, 2, 20000);
    }

    return {
      connector: 'gemini-text',
      model: usedModel,
      sceneId: scene.id,
      analysisText: response.text ?? '',
    };
  } catch (error) {
    const mapped = mapGeminiUpstreamError(error, usedModel);
    throw new ConnectorNotConfiguredError(
      'gemini-text',
      mapped.message,
      'GEMINI_API_KEY (AI Studio)',
      mapped.status,
    );
  }
}

export interface GeminiShotImageResult {
  ok: boolean;
  connector: 'gemini-image';
  model: string;
  imageUrl: string;
  filename: string;
}

export async function generateShotImageWithGemini(
  prompt: string,
  aspectRatio: AspectRatio,
  shotId: string,
): Promise<GeminiShotImageResult> {
  if (!isGeminiConfigured()) {
    throw new ConnectorNotConfiguredError(
      'gemini-image',
      'Clé AI Studio GEMINI_API_KEY requise dans Settings > Secrets pour générer une image storyboard.',
      'GEMINI_API_KEY (AI Studio)',
    );
  }

  const ai = createGeminiClient();
  const safeId = shotId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'shot';
  const mappedRatio = mapProjectRatioToGeminiImageRatio(aspectRatio);

  try {
    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: {
          parts: [
            {
              text: `${prompt}. Photogramme cinématographique réaliste, sans texte ni filigrane.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: mappedRatio,
          },
        },
      }),
    );

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? 'image/png';
        const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
        const filename = `shot_${safeId}_${Date.now()}.${ext}`;
        const mediaDir = ensureMediaDir();
        const filePath = path.resolve(mediaDir, filename);
        fs.writeFileSync(filePath, Buffer.from(part.inlineData.data, 'base64'));
        return {
          ok: true,
          connector: 'gemini-image',
          model: GEMINI_IMAGE_MODEL,
          imageUrl: `/api/media/${filename}`,
          filename,
        };
      }
    }

    throw new Error("Aucune donnée image n'a été retournée par le modèle Gemini.");
  } catch (error) {
    const mapped = mapGeminiUpstreamError(error, GEMINI_IMAGE_MODEL);
    throw new ConnectorNotConfiguredError(
      'gemini-image',
      mapped.message,
      'GEMINI_API_KEY (AI Studio)',
      mapped.status,
    );
  }
}

export interface GeminiTtsResult {
  ok: boolean;
  connector: 'gemini-tts';
  model: string;
  audioUrl: string;
  filename: string;
}

export async function generateDialogueAudioWithGemini(
  text: string,
  voiceName: GeminiVoiceName,
  styleDirective: string,
  blockId: string,
): Promise<GeminiTtsResult> {
  if (!isGeminiConfigured()) {
    throw new ConnectorNotConfiguredError(
      'gemini-tts',
      'Clé AI Studio GEMINI_API_KEY requise dans Settings > Secrets pour la synthèse vocale.',
      'GEMINI_API_KEY (AI Studio)',
    );
  }

  const ai = createGeminiClient();
  const safeId = blockId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'dlg';

  try {
    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: GEMINI_TTS_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: styleDirective || 'Cinéma naturel français',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }),
    );

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error("Aucune piste audio WAV n'a été retournée par Gemini TTS.");
    }

    const filename = `tts_${safeId}_${Date.now()}.wav`;
    const mediaDir = ensureMediaDir();
    const filePath = path.resolve(mediaDir, filename);
    fs.writeFileSync(filePath, Buffer.from(base64Audio, 'base64'));

    return {
      ok: true,
      connector: 'gemini-tts',
      model: GEMINI_TTS_MODEL,
      audioUrl: `/api/media/${filename}`,
      filename,
    };
  } catch (error) {
    const mapped = mapGeminiUpstreamError(error, GEMINI_TTS_MODEL);
    throw new ConnectorNotConfiguredError(
      'gemini-tts',
      mapped.message,
      'GEMINI_API_KEY (AI Studio)',
      mapped.status,
    );
  }
}
