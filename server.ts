import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import type {
  AspectRatio,
  FilmProject,
  GeminiVoiceName,
  MusicMood,
  PipelineStatusResponse,
  Scene,
  SlideshowTransition,
} from './src/types/film';
import {
  checkFfmpegBinary,
  renderSlideshowVideo,
  type SlideshowSlideInput,
} from './server/connectors/ffmpeg';
import {
  GEMINI_IMAGE_MODEL,
  GEMINI_TEXT_MODEL,
  GEMINI_TTS_MODEL,
  MEDIA_DIR,
  analyzeSceneWithGemini,
  generateDialogueAudioWithGemini,
  generateShotImageWithGemini,
  isGeminiConfigured,
  testGeminiConnection,
} from './server/connectors/gemini';
import { ConnectorNotConfiguredError, sanitizeSecretError } from './server/connectors/types';
import { compileProductionManifest } from './server/pipeline/manifest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/pipeline/status', async (_req, res) => {
    const ffmpegCheck = await checkFfmpegBinary();
    const geminiReady = isGeminiConfigured();

    const payload: PipelineStatusResponse = {
      checkedAt: new Date().toISOString(),
      connectors: [
        {
          id: 'gemini-text',
          name: 'Google Gemini (Scénario)',
          provider: 'Google AI Studio',
          stage: 'Analyse & Écriture',
          configured: geminiReady,
          requirementLabel: geminiReady
            ? 'Clé AI Studio GEMINI_API_KEY active'
            : 'Clé AI Studio GEMINI_API_KEY requise (Settings > Secrets)',
          modelOrEngine: GEMINI_TEXT_MODEL,
          endpointPath: '/api/connectors/gemini/test',
          capabilities: [
            'Analyse dramaturgique et continuité des scènes',
            'Enrichissement des dialogues et mise en scène',
            'Vérification gratuite via quota AI Studio',
          ],
          blockedFeatures: geminiReady ? [] : ['Analyse IA de scène'],
        },
        {
          id: 'gemini-image',
          name: 'Gemini Images (Storyboard)',
          provider: 'Google AI Studio',
          stage: 'Série d’images par plan',
          configured: geminiReady,
          requirementLabel: geminiReady
            ? 'Clé AI Studio GEMINI_API_KEY active (quota AI Studio)'
            : 'Clé AI Studio GEMINI_API_KEY requise (Settings > Secrets)',
          modelOrEngine: GEMINI_IMAGE_MODEL,
          endpointPath: '/api/connectors/gemini/generate-shot-image',
          capabilities: [
            'Génération d’images cinématographiques plan par plan',
            'Respect du cadrage et de la direction artistique',
            'Compatible avec l’import d’images locales en secours',
          ],
          blockedFeatures: geminiReady ? [] : ['Génération d’images storyboard Gemini'],
        },
        {
          id: 'gemini-tts',
          name: 'Gemini Voix (Dialogues)',
          provider: 'Google AI Studio',
          stage: 'Synthèse vocale gratuite',
          configured: geminiReady,
          requirementLabel: geminiReady
            ? 'Clé AI Studio GEMINI_API_KEY active'
            : 'Clé AI Studio GEMINI_API_KEY requise (Settings > Secrets)',
          modelOrEngine: GEMINI_TTS_MODEL,
          endpointPath: '/api/connectors/gemini/generate-dialogue-audio',
          capabilities: [
            'Voix françaises naturelles (Kore, Puck, Charon, Fenrir, Zephyr)',
            'Export WAV intégré directement dans le diaporama vidéo',
          ],
          blockedFeatures: geminiReady ? [] : ['Synthèse vocale des répliques'],
        },
        {
          id: 'ffmpeg',
          name: 'FFmpeg Diaporama MP4',
          provider: 'Moteur média local serveur',
          stage: 'Transitions, Texte & Musique',
          configured: ffmpegCheck.available,
          requirementLabel: ffmpegCheck.available
            ? ffmpegCheck.version
            : 'Binaire ffmpeg serveur requis',
          modelOrEngine: 'libx264 · xfade · drawtext · aac',
          endpointPath: '/api/slideshow/render',
          capabilities: [
            'Assemblage des images en vidéo diaporama MP4 gratuite',
            'Transitions en fondu enchaîné (xfade) et sous-titres',
            'Musique d’ambiance synthétisée + mixage des dialogues',
          ],
          blockedFeatures: ffmpegCheck.available ? [] : ['Export diaporama MP4'],
        },
      ],
    };

    res.json(payload);
  });

  app.post('/api/connectors/gemini/test', async (_req, res) => {
    try {
      const result = await testGeminiConnection();
      res.json(result);
    } catch (error) {
      if (error instanceof ConnectorNotConfiguredError) {
        res.status(error.statusCode).json({
          ok: false,
          configured: isGeminiConfigured(),
          connector: error.connectorId,
          model: GEMINI_TEXT_MODEL,
          message: sanitizeSecretError(error.message),
        });
        return;
      }
      res.status(502).json({
        ok: false,
        configured: isGeminiConfigured(),
        connector: 'gemini-text',
        message: sanitizeSecretError(
          error instanceof Error ? error.message : 'Erreur Gemini inattendue',
        ),
      });
    }
  });

  app.post('/api/connectors/gemini/analyze-scene', async (req, res) => {
    const { projectTitle, visualStyle, scene } = req.body as {
      projectTitle?: string;
      visualStyle?: string;
      scene?: Scene;
    };

    if (
      !scene ||
      typeof scene.id !== 'string' ||
      !scene.heading ||
      !Array.isArray(scene.blocks)
    ) {
      res.status(400).json({ error: 'Scène invalide ou manquante dans la requête.' });
      return;
    }

    try {
      const result = await analyzeSceneWithGemini(
        typeof projectTitle === 'string' ? projectTitle.slice(0, 200) : 'Projet sans titre',
        typeof visualStyle === 'string' ? visualStyle.slice(0, 500) : '',
        scene,
      );
      res.json(result);
    } catch (error) {
      if (error instanceof ConnectorNotConfiguredError) {
        res.status(error.statusCode).json({
          requiresApiConnection: true,
          connector: error.connectorId,
          message: sanitizeSecretError(error.message),
        });
        return;
      }
      res.status(502).json({
        error: sanitizeSecretError(
          error instanceof Error ? error.message : 'Erreur Gemini inattendue',
        ),
      });
    }
  });

  app.post('/api/connectors/gemini/generate-shot-image', async (req, res) => {
    const { prompt, aspectRatio, shotId } = req.body as {
      prompt?: string;
      aspectRatio?: AspectRatio;
      shotId?: string;
    };

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Prompt image manquant.' });
      return;
    }

    try {
      const result = await generateShotImageWithGemini(
        prompt.trim().slice(0, 1500),
        aspectRatio || '16:9',
        typeof shotId === 'string' ? shotId : 'shot',
      );
      res.json(result);
    } catch (error) {
      if (error instanceof ConnectorNotConfiguredError) {
        res.status(error.statusCode).json({
          ok: false,
          connector: error.connectorId,
          message: sanitizeSecretError(error.message),
        });
        return;
      }
      res.status(502).json({
        ok: false,
        message: sanitizeSecretError(
          error instanceof Error ? error.message : "Erreur de génération d'image",
        ),
      });
    }
  });

  app.post('/api/connectors/gemini/generate-dialogue-audio', async (req, res) => {
    const { text, voiceName, styleDirective, blockId } = req.body as {
      text?: string;
      voiceName?: GeminiVoiceName;
      styleDirective?: string;
      blockId?: string;
    };

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Texte du dialogue manquant.' });
      return;
    }

    const validVoices: GeminiVoiceName[] = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
    const safeVoice = validVoices.includes(voiceName as GeminiVoiceName)
      ? (voiceName as GeminiVoiceName)
      : 'Kore';

    try {
      const result = await generateDialogueAudioWithGemini(
        text.trim().slice(0, 800),
        safeVoice,
        typeof styleDirective === 'string' ? styleDirective.slice(0, 200) : '',
        typeof blockId === 'string' ? blockId : 'dlg',
      );
      res.json(result);
    } catch (error) {
      if (error instanceof ConnectorNotConfiguredError) {
        res.status(error.statusCode).json({
          ok: false,
          connector: error.connectorId,
          message: sanitizeSecretError(error.message),
        });
        return;
      }
      res.status(502).json({
        ok: false,
        message: sanitizeSecretError(
          error instanceof Error ? error.message : 'Erreur de synthèse vocale',
        ),
      });
    }
  });

  app.post('/api/slideshow/render', async (req, res) => {
    const {
      projectTitle,
      aspectRatio,
      fps,
      transition,
      musicMood,
      showTextOverlay,
      slides,
    } = req.body as {
      projectTitle?: string;
      aspectRatio?: AspectRatio;
      fps?: 24 | 25 | 30;
      transition?: SlideshowTransition;
      musicMood?: MusicMood;
      showTextOverlay?: boolean;
      slides?: SlideshowSlideInput[];
    };

    if (!Array.isArray(slides) || slides.length === 0) {
      res.status(400).json({
        error: 'Sélectionnez ou générez au moins une image de plan pour assembler le diaporama.',
      });
      return;
    }

    try {
      const result = await renderSlideshowVideo({
        projectTitle: typeof projectTitle === 'string' ? projectTitle.slice(0, 120) : 'NOVA Film',
        aspectRatio: aspectRatio || '16:9',
        fps: fps === 25 || fps === 30 ? fps : 24,
        transition:
          transition === 'dissolve' || transition === 'slideleft' ? transition : 'fade',
        musicMood:
          musicMood === 'drama' || musicMood === 'suspense' || musicMood === 'none'
            ? musicMood
            : 'noir',
        showTextOverlay: showTextOverlay !== false,
        slides: slides.slice(0, 30),
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: sanitizeSecretError(
          error instanceof Error ? error.message : "Erreur lors de l'assemblage FFmpeg.",
        ),
      });
    }
  });

  app.get('/api/media/:filename', (req, res) => {
    const { filename } = req.params;
    if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|wav|mp4)$/.test(filename)) {
      res.status(400).json({ error: 'Nom de fichier média invalide.' });
      return;
    }
    const resolved = path.resolve(MEDIA_DIR, filename);
    if (!resolved.startsWith(MEDIA_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Fichier média introuvable.' });
      return;
    }
    res.sendFile(resolved);
  });

  app.post('/api/pipeline/compile-manifest', (req, res) => {
    const project = req.body?.project as FilmProject | undefined;
    if (
      !project ||
      typeof project.id !== 'string' ||
      typeof project.title !== 'string' ||
      !Array.isArray(project.scenes)
    ) {
      res.status(400).json({ error: 'Données de projet invalides pour la compilation du manifeste.' });
      return;
    }
    const manifest = compileProductionManifest(project);
    res.json(manifest);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NOVA AI FILM studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
