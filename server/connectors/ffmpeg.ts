import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  AspectRatio,
  FilmProject,
  MusicMood,
  Scene,
  SlideshowRenderResult,
  SlideshowTransition,
} from '../../src/types/film';
import { writeAmbientMusicWav } from '../media/ambientMusic';
import { ensureMediaDir, MEDIA_DIR } from './gemini';

const execFileAsync = promisify(execFile);

const PROJECT_ASSETS_DIR = path.resolve(process.cwd(), 'src', 'assets', 'images');
const SAFE_FONT_PATH = '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf';

export async function checkFfmpegBinary(): Promise<{ available: boolean; version: string }> {
  const bin = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
  try {
    const { stdout } = await execFileAsync(bin, ['-version'], { timeout: 2000 });
    const firstLine = stdout.split('\n')[0]?.trim() || 'ffmpeg disponible';
    return { available: true, version: firstLine };
  } catch {
    return { available: false, version: 'Binaire ffmpeg absent du PATH serveur' };
  }
}

export function getSlideshowResolution(aspectRatio: AspectRatio): {
  width: number;
  height: number;
} {
  switch (aspectRatio) {
    case '2.39:1':
      return { width: 1280, height: 536 };
    case '1.85:1':
      return { width: 1280, height: 692 };
    case '9:16':
      return { width: 720, height: 1280 };
    case '1:1':
      return { width: 720, height: 720 };
    default:
      return { width: 1280, height: 720 };
  }
}

function resolveLocalMediaFile(
  mediaUrl: string,
  workDir: string,
  index: number,
  kind: 'image' | 'audio',
): string {
  if (kind === 'image' && mediaUrl.startsWith('data:image/')) {
    const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
      mediaUrl,
    );
    if (!match) {
      throw new Error(`Format d'image encodée invalide pour le plan ${index + 1}.`);
    }
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const target = path.resolve(workDir, `upload_${index}.${ext}`);
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) {
      throw new Error(`Image trop volumineuse (> 8 Mo) au plan ${index + 1}.`);
    }
    fs.writeFileSync(target, buf);
    return target;
  }

  if (mediaUrl.startsWith('/api/media/')) {
    const filename = mediaUrl.slice('/api/media/'.length);
    if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|wav|mp4)$/.test(filename)) {
      throw new Error(`Nom de fichier média invalide : ${filename}`);
    }
    const resolved = path.resolve(MEDIA_DIR, filename);
    if (!resolved.startsWith(MEDIA_DIR + path.sep) || !fs.existsSync(resolved)) {
      throw new Error(`Média introuvable sur le serveur : ${filename}`);
    }
    return resolved;
  }

  if (kind === 'image' && mediaUrl.startsWith('/src/assets/images/')) {
    const filename = mediaUrl.slice('/src/assets/images/'.length);
    if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(filename)) {
      throw new Error(`Nom d'image projet invalide : ${filename}`);
    }
    const resolved = path.resolve(PROJECT_ASSETS_DIR, filename);
    if (
      !resolved.startsWith(PROJECT_ASSETS_DIR + path.sep) ||
      !fs.existsSync(resolved)
    ) {
      throw new Error(`Image projet introuvable : ${filename}`);
    }
    return resolved;
  }

  throw new Error(
    `Source média non autorisée ou introuvable au segment ${index + 1}. Utilisez une image générée par Gemini ou importée localement.`,
  );
}

export interface SlideshowSlideInput {
  imageUrl: string;
  durationSec: number;
  titleText: string;
  subtitleText: string;
  audioUrl?: string;
}

export interface RenderSlideshowRequest {
  projectTitle: string;
  aspectRatio: AspectRatio;
  fps: 24 | 25 | 30;
  transition: SlideshowTransition;
  musicMood: MusicMood;
  showTextOverlay: boolean;
  slides: SlideshowSlideInput[];
}

export async function renderSlideshowVideo(
  req: RenderSlideshowRequest,
): Promise<SlideshowRenderResult> {
  const bin = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
  const ffmpegCheck = await checkFfmpegBinary();
  if (!ffmpegCheck.available) {
    throw new Error("Le binaire FFmpeg n'est pas disponible sur le serveur.");
  }

  if (!req.slides || req.slides.length === 0) {
    throw new Error('Ajoutez au moins une image de plan pour assembler le diaporama vidéo.');
  }

  const mediaDir = ensureMediaDir();
  const jobId = `job_${Date.now()}`;
  const workDir = path.resolve(mediaDir, jobId);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    const { width, height } = getSlideshowResolution(req.aspectRatio);
    const fps = req.fps || 24;
    const transitionDuration = 0.6;
    const hasFont = fs.existsSync(SAFE_FONT_PATH);

    const args: string[] = ['-y'];
    const resolvedAudioTracks: Array<{ filePath: string; startMs: number }> = [];

    // 1. Add each slide image as an input stream
    let cursorSec = 0;
    const slideDurations: number[] = [];

    for (let i = 0; i < req.slides.length; i++) {
      const slide = req.slides[i];
      const dur = Math.max(2, Math.min(20, Number(slide.durationSec) || 4));
      slideDurations.push(dur);

      const imagePath = resolveLocalMediaFile(slide.imageUrl, workDir, i, 'image');
      args.push('-loop', '1', '-t', String(dur), '-i', imagePath);

      if (slide.audioUrl) {
        try {
          const audioPath = resolveLocalMediaFile(slide.audioUrl, workDir, i, 'audio');
          resolvedAudioTracks.push({
            filePath: audioPath,
            startMs: Math.round(cursorSec * 1000),
          });
        } catch {
          // Skip missing optional audio track without failing video assembly
        }
      }

      // Compute cumulative start offset taking crossfade overlap into account
      cursorSec += i < req.slides.length - 1 ? Math.max(0.5, dur - transitionDuration) : dur;
    }

    const totalDurationSec = Number(cursorSec.toFixed(2));

    // 2. Synthesize ambient background music WAV (free local PCM synthesis)
    const musicPath = path.resolve(workDir, 'music.wav');
    writeAmbientMusicWav(musicPath, totalDurationSec, req.musicMood);
    const musicInputIndex = req.slides.length;
    args.push('-i', musicPath);

    // 3. Add optional Gemini TTS dialogue audio tracks
    const firstDialogueInputIndex = musicInputIndex + 1;
    for (const track of resolvedAudioTracks) {
      args.push('-i', track.filePath);
    }

    // 4. Build filter_complex for scaling, text overlays, xfade transitions, and audio mix
    const filterParts: string[] = [];

    for (let i = 0; i < req.slides.length; i++) {
      const slide = req.slides[i];
      const chain: string[] = [
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase`,
        `crop=${width}:${height}`,
        `setsar=1`,
        `fps=${fps}`,
        `format=yuv420p`,
      ];

      if (req.showTextOverlay && hasFont) {
        if (slide.titleText.trim()) {
          const titleFile = path.resolve(workDir, `title_${i}.txt`);
          fs.writeFileSync(titleFile, slide.titleText.trim().slice(0, 80), 'utf8');
          chain.push(
            `drawtext=fontfile=${SAFE_FONT_PATH}:textfile=${titleFile}:fontsize=20:fontcolor=white@0.92:x=32:y=28:box=1:boxcolor=black@0.55:boxborderw=10`,
          );
        }

        if (slide.subtitleText.trim()) {
          const subFile = path.resolve(workDir, `sub_${i}.txt`);
          fs.writeFileSync(subFile, slide.subtitleText.trim().slice(0, 140), 'utf8');
          chain.push(
            `drawtext=fontfile=${SAFE_FONT_PATH}:textfile=${subFile}:fontsize=24:fontcolor=white:x=(w-text_w)/2:y=h-th-36:box=1:boxcolor=black@0.68:boxborderw=12`,
          );
        }
      }

      filterParts.push(`${chain.join(',')}[v${i}]`);
    }

    // Chain xfade transitions
    let lastVideoLabel = 'v0';
    if (req.slides.length > 1) {
      let runningOffset = slideDurations[0] - transitionDuration;
      for (let i = 1; i < req.slides.length; i++) {
        const nextLabel = i === req.slides.length - 1 ? 'vout' : `vx${i}`;
        const safeOffset = Math.max(0.2, Number(runningOffset.toFixed(2)));
        filterParts.push(
          `[${lastVideoLabel}][v${i}]xfade=transition=${req.transition}:duration=${transitionDuration}:offset=${safeOffset}[${nextLabel}]`,
        );
        lastVideoLabel = nextLabel;
        runningOffset += slideDurations[i] - transitionDuration;
      }
    } else {
      filterParts.push(`[v0]fade=t=in:st=0:d=0.4[vout]`);
      lastVideoLabel = 'vout';
    }

    // Audio mix: ambient music + optional Gemini TTS cues
    if (resolvedAudioTracks.length === 0) {
      filterParts.push(`[${musicInputIndex}:a]anull[aout]`);
    } else {
      const mixLabels: string[] = [`[${musicInputIndex}:a]volume=0.55[amusic]`];
      const mixInputs: string[] = ['[amusic]'];
      resolvedAudioTracks.forEach((track, idx) => {
        const inputIdx = firstDialogueInputIndex + idx;
        const label = `adlg${idx}`;
        mixLabels.push(
          `[${inputIdx}:a]adelay=${track.startMs}|${track.startMs},volume=1.35[${label}]`,
        );
        mixInputs.push(`[${label}]`);
      });
      filterParts.push(...mixLabels);
      filterParts.push(
        `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:normalize=0[aout]`,
      );
    }

    const outFilename = `diaporama_${Date.now()}.mp4`;
    const outPath = path.resolve(mediaDir, outFilename);

    args.push(
      '-filter_complex',
      filterParts.join(';'),
      '-map',
      `[${lastVideoLabel}]`,
      '-map',
      '[aout]',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
      '-t',
      String(totalDurationSec),
      outPath,
    );

    await execFileAsync(bin, args, { timeout: 60000, maxBuffer: 8 * 1024 * 1024 });

    return {
      ok: true,
      videoUrl: `/api/media/${outFilename}`,
      filename: outFilename,
      durationSec: totalDurationSec,
      slideCount: req.slides.length,
      transition: req.transition,
      musicMood: req.musicMood,
      createdAt: new Date().toISOString(),
    };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

export function buildFfmpegCommandBlueprint(
  project: FilmProject,
  scenesOverride?: Scene[],
): string {
  const scenes = scenesOverride ?? project.scenes;
  const { width, height } = getSlideshowResolution(project.aspectRatio);
  const slug =
    project.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'nova-film';

  const shotInputs: string[] = [];
  for (const scene of scenes) {
    for (const shot of scene.shots) {
      shotInputs.push(
        `-loop 1 -t ${shot.durationSec} -i slides/s${scene.number}_p${shot.number}.png`,
      );
    }
  }

  if (shotInputs.length === 0) {
    return `# Aucun plan découpé pour ${project.title}. Ajoutez des plans pour préparer le diaporama FFmpeg.`;
  }

  return [
    'ffmpeg -y',
    ...shotInputs,
    '-i audio/musique_ambiance.wav',
    `-filter_complex "scale=${width}:${height},drawtext=...,xfade=transition=fade:duration=0.6"`,
    '-c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart',
    `exports/${slug}_diaporama_${width}x${height}.mp4`,
  ].join(' \\\n  ');
}
