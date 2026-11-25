import type { Character, FilmProject, Scene, ShotPlan } from '../types/film';

export interface ProjectStats {
  sceneCount: number;
  validatedSceneCount: number;
  shotCount: number;
  dialogueCount: number;
  characterCount: number;
  wordCount: number;
  estimatedDurationSec: number;
}

export function computeSceneDurationSec(scene: Scene): number {
  if (scene.shots.length > 0) {
    return scene.shots.reduce((sum, s) => sum + (Number(s.durationSec) || 0), 0);
  }
  const wordCount = scene.blocks.reduce(
    (sum, b) => sum + b.content.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
  return Math.max(5, Math.round(wordCount * 0.45));
}

export function computeProjectStats(project: FilmProject): ProjectStats {
  let shotCount = 0;
  let dialogueCount = 0;
  let wordCount = 0;
  let estimatedDurationSec = 0;
  let validatedSceneCount = 0;

  for (const scene of project.scenes) {
    if (scene.status === 'Validée') validatedSceneCount += 1;
    shotCount += scene.shots.length;
    estimatedDurationSec += computeSceneDurationSec(scene);
    for (const block of scene.blocks) {
      if (block.type === 'dialogue') dialogueCount += 1;
      wordCount += block.content.trim().split(/\s+/).filter(Boolean).length;
    }
  }

  return {
    sceneCount: project.scenes.length,
    validatedSceneCount,
    shotCount,
    dialogueCount,
    characterCount: project.characters.length,
    wordCount,
    estimatedDurationSec,
  };
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatSceneHeading(scene: Scene): string {
  return `${scene.heading.intExt} ${scene.heading.location || 'LIEU À DÉFINIR'} - ${scene.heading.timeOfDay}`;
}

export function buildDefaultImagePrompt(
  project: FilmProject,
  scene: Scene,
  shot: Pick<ShotPlan, 'shotSize' | 'cameraMovement' | 'lens' | 'description' | 'lightingNotes'>,
  charactersInScene: Character[],
): string {
  const parts: string[] = [];
  parts.push(`${shot.shotSize}, optique ${shot.lens}`);
  parts.push(`${scene.heading.intExt} ${scene.heading.location}, ${scene.heading.timeOfDay.toLowerCase()}`);
  if (shot.description.trim()) parts.push(shot.description.trim());
  if (charactersInScene.length > 0) {
    const charDescriptions = charactersInScene
      .map((c) => `${c.name} (${c.costumeVisualPrompt || c.physicalDescription})`)
      .join('; ');
    parts.push(`Personnages : ${charDescriptions}`);
  }
  if (shot.lightingNotes.trim()) parts.push(`Lumière : ${shot.lightingNotes.trim()}`);
  if (project.visualStyle.trim()) parts.push(project.visualStyle.trim());
  return parts.join('. ');
}

export function exportProjectToFountain(project: FilmProject): string {
  const lines: string[] = [
    `Title: ${project.title.toUpperCase()}`,
    `Credit: Écrit sur NOVA AI FILM — Créé par Gnonke Kacou Aude Jean`,
    `Notes: Format ${project.format} | Ratio ${project.aspectRatio} | ${project.fps} fps`,
    `Draft date: ${new Date(project.updatedAt).toLocaleDateString('fr-FR')}`,
    '',
    `/* Logline : ${project.logline} */`,
    '',
  ];

  for (const scene of project.scenes) {
    lines.push(`${scene.number}. ${formatSceneHeading(scene)}`);
    lines.push('');

    for (const block of scene.blocks) {
      switch (block.type) {
        case 'action':
          lines.push(block.content);
          lines.push('');
          break;
        case 'character':
          lines.push(block.content.toUpperCase());
          break;
        case 'parenthetical':
          lines.push(block.content.startsWith('(') ? block.content : `(${block.content})`);
          break;
        case 'dialogue':
          lines.push(block.content);
          lines.push('');
          break;
        case 'transition':
          lines.push(`> ${block.content.toUpperCase()}`);
          lines.push('');
          break;
      }
    }
  }

  return lines.join('\n');
}

export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'projet-nova'
  );
}
