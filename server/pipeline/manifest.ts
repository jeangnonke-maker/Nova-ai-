import type { FilmProject, ProductionManifest } from '../../src/types/film';
import { buildFfmpegCommandBlueprint } from '../connectors/ffmpeg';
import {
  GEMINI_IMAGE_MODEL,
  GEMINI_TEXT_MODEL,
  GEMINI_TTS_MODEL,
  isGeminiConfigured,
} from '../connectors/gemini';

export function compileProductionManifest(project: FilmProject): ProductionManifest {
  const geminiImageQueue: ProductionManifest['geminiImageQueue'] = [];
  const geminiTtsQueue: ProductionManifest['geminiTtsQueue'] = [];
  const timelineSegments: ProductionManifest['ffmpegSlideshow']['timelineSegments'] = [];

  let cursorSec = 0;
  let segmentIndex = 1;

  for (const scene of project.scenes) {
    for (const block of scene.blocks) {
      if (block.type === 'dialogue') {
        const character = project.characters.find(
          (c) => c.id === block.characterId || c.name === block.characterName,
        );
        geminiTtsQueue.push({
          sceneNumber: scene.number,
          blockId: block.id,
          characterName: block.characterName || character?.name || 'PERSONNAGE',
          voiceName: character?.voiceProfile.voiceName || 'Kore',
          model: GEMINI_TTS_MODEL,
          emotion: block.voiceEmotion || character?.voiceProfile.defaultEmotion || 'Neutre',
          text: block.content,
          hasAudio: Boolean(block.generatedAudioUrl),
        });
      }
    }

    for (const shot of scene.shots) {
      const prompt = [shot.imagePrompt?.trim() || shot.description, project.visualStyle]
        .filter(Boolean)
        .join(' — ');

      geminiImageQueue.push({
        sceneNumber: scene.number,
        shotId: shot.id,
        shotNumber: shot.number,
        durationSec: shot.durationSec,
        aspectRatio: project.aspectRatio,
        model: GEMINI_IMAGE_MODEL,
        prompt,
        hasImage: Boolean(shot.generatedImageUrl),
      });

      const firstDialogueId = shot.dialogueBlockIds[0] ?? null;
      const matchedDialogue = firstDialogueId
        ? scene.blocks.find((b) => b.id === firstDialogueId)
        : undefined;

      timelineSegments.push({
        index: segmentIndex++,
        imageSource: shot.generatedImageUrl || `slides/s${scene.number}_p${shot.number}.png`,
        audioSource: matchedDialogue?.generatedAudioUrl || null,
        startSec: cursorSec,
        durationSec: shot.durationSec,
        subtitleText: shot.subtitleText || matchedDialogue?.content || shot.description,
      });

      cursorSec += shot.durationSec;
    }
  }

  const slug =
    project.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'nova-film';

  return {
    manifestVersion: '2.0-free-aistudio',
    generatedAt: new Date().toISOString(),
    projectId: project.id,
    projectTitle: project.title,
    videoSpec: {
      aspectRatio: project.aspectRatio,
      fps: project.fps,
      visualStyle: project.visualStyle,
      totalDurationSec: cursorSec,
    },
    geminiTextStage: {
      role: 'Analyse dramaturgique et aide à l’écriture via clé Gemini AI Studio',
      configured: isGeminiConfigured(),
      model: GEMINI_TEXT_MODEL,
      sceneCount: project.scenes.length,
    },
    geminiImageQueue,
    geminiTtsQueue,
    ffmpegSlideshow: {
      outputFilename: `${slug}_diaporama.mp4`,
      timelineSegments,
      commandBlueprint: buildFfmpegCommandBlueprint(project),
    },
  };
}
