export type ProjectFormat =
  | 'Court-métrage'
  | 'Long-métrage'
  | 'Série'
  | 'Documentaire'
  | 'Film publicitaire';

export type AspectRatio = '2.39:1' | '16:9' | '1.85:1' | '9:16' | '1:1';

export type ProjectStatus = 'Développement' | 'Pré-production' | 'Prêt pour rendu';

export type IntExt = 'INT.' | 'EXT.' | 'INT./EXT.';
export type TimeOfDay = 'JOUR' | 'NUIT' | 'AUBE' | 'CRÉPUSCULE';

export type ScriptBlockType =
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition';

export type GeminiVoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface ScriptBlock {
  id: string;
  type: ScriptBlockType;
  characterId?: string;
  characterName?: string;
  voiceEmotion?: string;
  generatedAudioUrl?: string;
  content: string;
}

export type ShotSize =
  | 'Plan général'
  | 'Plan large'
  | 'Plan moyen'
  | 'Plan américain'
  | 'Plan rapproché'
  | 'Gros plan'
  | 'Très gros plan'
  | 'Insert';

export type CameraMovement =
  | 'Fixe'
  | 'Travelling avant'
  | 'Travelling latéral'
  | 'Panoramique'
  | 'Steadicam'
  | 'Porté épaule'
  | 'Drone / Aérien';

export interface ShotPlan {
  id: string;
  number: number;
  shotSize: ShotSize;
  cameraMovement: CameraMovement;
  lens: string;
  durationSec: number;
  description: string;
  lightingNotes: string;
  imagePrompt: string;
  generatedImageUrl?: string;
  subtitleText?: string;
  dialogueBlockIds: string[];
}

export interface SceneHeading {
  intExt: IntExt;
  location: string;
  timeOfDay: TimeOfDay;
}

export interface Scene {
  id: string;
  number: number;
  heading: SceneHeading;
  synopsis: string;
  mood: string;
  status: 'Brouillon' | 'Découpée' | 'Validée';
  blocks: ScriptBlock[];
  shots: ShotPlan[];
}

export type CharacterRole = 'Protagoniste' | 'Antagoniste' | 'Secondaire' | 'Figurant';

export interface GeminiVoiceProfile {
  provider: 'gemini-tts';
  voiceName: GeminiVoiceName;
  language: string;
  defaultEmotion: string;
  styleNotes: string;
}

export interface Character {
  id: string;
  name: string;
  role: CharacterRole;
  age: string;
  physicalDescription: string;
  psychologicalArc: string;
  costumeVisualPrompt: string;
  portraitUrl?: string;
  voiceProfile: GeminiVoiceProfile;
}

export interface FilmProject {
  id: string;
  title: string;
  logline: string;
  genre: string;
  format: ProjectFormat;
  aspectRatio: AspectRatio;
  fps: 24 | 25 | 30;
  status: ProjectStatus;
  visualStyle: string;
  directorNotes: string;
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
  characters: Character[];
  scenes: Scene[];
}

export type ConnectorId = 'gemini-text' | 'gemini-image' | 'gemini-tts' | 'ffmpeg';

export type SlideshowTransition = 'fade' | 'dissolve' | 'slideleft';
export type MusicMood = 'noir' | 'drama' | 'suspense' | 'none';

export interface ConnectorStatus {
  id: ConnectorId;
  name: string;
  provider: string;
  stage: string;
  configured: boolean;
  requirementLabel: string;
  modelOrEngine: string;
  endpointPath: string;
  capabilities: string[];
  blockedFeatures: string[];
}

export interface PipelineStatusResponse {
  checkedAt: string;
  connectors: ConnectorStatus[];
}

export interface SlideshowRenderResult {
  ok: boolean;
  videoUrl: string;
  filename: string;
  durationSec: number;
  slideCount: number;
  transition: SlideshowTransition;
  musicMood: MusicMood;
  createdAt: string;
}

export interface ProductionManifest {
  manifestVersion: string;
  generatedAt: string;
  projectId: string;
  projectTitle: string;
  videoSpec: {
    aspectRatio: AspectRatio;
    fps: number;
    visualStyle: string;
    totalDurationSec: number;
  };
  geminiTextStage: {
    role: string;
    configured: boolean;
    model: string;
    sceneCount: number;
  };
  geminiImageQueue: Array<{
    sceneNumber: number;
    shotId: string;
    shotNumber: number;
    durationSec: number;
    aspectRatio: AspectRatio;
    model: string;
    prompt: string;
    hasImage: boolean;
  }>;
  geminiTtsQueue: Array<{
    sceneNumber: number;
    blockId: string;
    characterName: string;
    voiceName: GeminiVoiceName;
    model: string;
    emotion: string;
    text: string;
    hasAudio: boolean;
  }>;
  ffmpegSlideshow: {
    outputFilename: string;
    timelineSegments: Array<{
      index: number;
      imageSource: string;
      audioSource: string | null;
      startSec: number;
      durationSec: number;
      subtitleText: string;
    }>;
    commandBlueprint: string;
  };
}
