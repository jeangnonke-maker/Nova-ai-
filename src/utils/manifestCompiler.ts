import type { FilmProject, ProductionManifest } from '../types/film';
import { slugify } from './filmMetrics';

function mapRatioToResolution(aspectRatio: FilmProject['aspectRatio']): string {
  switch (aspectRatio) {
    case '2.39:1':
      return '1280x536';
    case '1.85:1':
      return '1280x692';
    case '9:16':
      return '720x1280';
    case '1:1':
      return '720x720';
    default:
      return '1280x720';
  }
}

export function compileProductionManifestClient(project: FilmProject): ProductionManifest {
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
          model: 'gemini-3.8-flash-lite-tts',
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
        model: 'gemini-3.1-flash-lite-image',
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

  const slug = slugify(project.title) || 'nova-film';
  const resolution = mapRatioToResolution(project.aspectRatio);
  const commandBlueprint = [
    `ffmpeg -y`,
    ...geminiImageQueue.map(
      (item) => `-loop 1 -t ${item.durationSec} -i slide_s${item.sceneNumber}_p${item.shotNumber}.png`,
    ),
    `-i ambient_score.wav`,
    `-filter_complex "scale=${resolution},xfade=transition=fade:duration=0.6,drawtext=...,amix"`,
    `-c:v libx264 -pix_fmt yuv420p -r ${project.fps} -c:a aac -movflags +faststart ${slug}_diaporama.mp4`,
  ].join(' ');

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
      configured: false,
      model: 'gemini-4-hydrogen',
      sceneCount: project.scenes.length,
    },
    geminiImageQueue,
    geminiTtsQueue,
    ffmpegSlideshow: {
      outputFilename: `${slug}_diaporama.mp4`,
      timelineSegments,
      commandBlueprint,
    },
  };
}
