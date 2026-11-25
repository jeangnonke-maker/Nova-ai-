import { useEffect, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  Camera,
  Download,
  Film,
  ImagePlus,
  Mic,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import type {
  CameraMovement,
  FilmProject,
  MusicMood,
  Scene,
  ShotPlan,
  ShotSize,
  SlideshowRenderResult,
  SlideshowTransition,
} from '../types/film';
import {
  buildDefaultImagePrompt,
  computeSceneDurationSec,
  formatDuration,
  formatSceneHeading,
} from '../utils/filmMetrics';
import { CinemaImage } from './CinemaImage';

interface ScenePrepViewProps {
  project: FilmProject;
  initialSceneId?: string | null;
  onUpdateProject: (updater: (prev: FilmProject) => FilmProject) => void;
}

const SHOT_SIZES: ShotSize[] = [
  'Plan général',
  'Plan large',
  'Plan moyen',
  'Plan américain',
  'Plan rapproché',
  'Gros plan',
  'Très gros plan',
  'Insert',
];

const CAMERA_MOVEMENTS: CameraMovement[] = [
  'Fixe',
  'Travelling avant',
  'Travelling latéral',
  'Panoramique',
  'Steadicam',
  'Porté épaule',
  'Drone / Aérien',
];

export function ScenePrepView({
  project,
  initialSceneId,
  onUpdateProject,
}: ScenePrepViewProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    initialSceneId || project.scenes[0]?.id || '',
  );
  const [prepTab, setPrepTab] = useState<'shots' | 'dialogues' | 'timeline'>('shots');

  const [generatingShotIds, setGeneratingShotIds] = useState<Record<string, boolean>>({});
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [generatingAudioIds, setGeneratingAudioIds] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{
    type: 'info' | 'error' | 'success';
    title: string;
    message: string;
  } | null>(null);

  // Slideshow Assembly State
  const [transition, setTransition] = useState<SlideshowTransition>('fade');
  const [musicMood, setMusicMood] = useState<MusicMood>('noir');
  const [showTextOverlay, setShowTextOverlay] = useState(true);
  const [includeAllScenes, setIncludeAllScenes] = useState(false);
  const [renderingVideo, setRenderingVideo] = useState(false);
  const [renderedVideo, setRenderedVideo] = useState<SlideshowRenderResult | null>(null);

  useEffect(() => {
    if (initialSceneId && project.scenes.some((s) => s.id === initialSceneId)) {
      setSelectedSceneId(initialSceneId);
    } else if (!project.scenes.some((s) => s.id === selectedSceneId)) {
      setSelectedSceneId(project.scenes[0]?.id || '');
    }
  }, [initialSceneId, project.scenes, selectedSceneId]);

  const activeScene =
    project.scenes.find((s) => s.id === selectedSceneId) ?? project.scenes[0] ?? null;

  const updateActiveScene = (updater: (scene: Scene) => Scene) => {
    if (!activeScene) return;
    onUpdateProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === activeScene.id ? updater(s) : s)),
    }));
  };

  const handleAddShot = () => {
    if (!activeScene) return;
    const nextNum = activeScene.shots.length + 1;
    const newShot: ShotPlan = {
      id: `shot-${Date.now()}`,
      number: nextNum,
      shotSize: 'Plan moyen',
      cameraMovement: 'Fixe',
      lens: '35mm',
      durationSec: 5,
      description: '',
      lightingNotes: '',
      imagePrompt: '',
      subtitleText: '',
      dialogueBlockIds: [],
    };
    updateActiveScene((scene) => ({
      ...scene,
      shots: [...scene.shots, newShot],
    }));
  };

  const handleUpdateShot = (shotId: string, patch: Partial<ShotPlan>) => {
    updateActiveScene((scene) => ({
      ...scene,
      shots: scene.shots.map((s) => (s.id === shotId ? { ...s, ...patch } : s)),
    }));
  };

  const handleDeleteShot = (shotId: string) => {
    updateActiveScene((scene) => ({
      ...scene,
      shots: scene.shots
        .filter((s) => s.id !== shotId)
        .map((s, idx) => ({ ...s, number: idx + 1 })),
    }));
  };

  const getComposedPrompt = (shot: ShotPlan): string => {
    if (!activeScene) return shot.imagePrompt;
    const sceneCharIds = new Set(
      activeScene.blocks.map((b) => b.characterId).filter(Boolean),
    );
    const charsInScene = project.characters.filter((c) => sceneCharIds.has(c.id));
    return buildDefaultImagePrompt(project, activeScene, shot, charsInScene);
  };

  const handleAutoComposeImagePrompt = (shot: ShotPlan) => {
    handleUpdateShot(shot.id, { imagePrompt: getComposedPrompt(shot) });
  };

  const handleGenerateShotImage = async (shot: ShotPlan) => {
    const prompt = shot.imagePrompt.trim() || getComposedPrompt(shot);
    setGeneratingShotIds((prev) => ({ ...prev, [shot.id]: true }));
    setNotice(null);

    try {
      const res = await fetch('/api/connectors/gemini/generate-shot-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio: project.aspectRatio,
          shotId: shot.id,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.imageUrl) {
        setNotice({
          type: 'error',
          title: `Plan ${String(shot.number).padStart(2, '0')} — Génération d'image Gemini`,
          message:
            data.message ||
            "Impossible de générer l'image avec Gemini. Vous pouvez importer une image locale pour ce plan.",
        });
        return;
      }

      handleUpdateShot(shot.id, {
        generatedImageUrl: data.imageUrl,
        imagePrompt: prompt,
      });
      setNotice({
        type: 'success',
        title: `Plan ${String(shot.number).padStart(2, '0')} — Image storyboard prête`,
        message: `Image générée via ${data.model} et ajoutée au diaporama.`,
      });
    } catch {
      setNotice({
        type: 'error',
        title: 'Erreur réseau',
        message: 'Impossible de joindre le serveur studio.',
      });
    } finally {
      setGeneratingShotIds((prev) => ({ ...prev, [shot.id]: false }));
    }
  };

  const handleGenerateAllImages = async () => {
    if (!activeScene || activeScene.shots.length === 0) return;
    setBatchGenerating(true);
    setNotice(null);

    let generatedCount = 0;
    for (const shot of activeScene.shots) {
      const prompt = shot.imagePrompt.trim() || getComposedPrompt(shot);
      setGeneratingShotIds((prev) => ({ ...prev, [shot.id]: true }));
      try {
        const res = await fetch('/api/connectors/gemini/generate-shot-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            aspectRatio: project.aspectRatio,
            shotId: shot.id,
          }),
        });
        const data = await res.json();
        if (res.ok && data.imageUrl) {
          handleUpdateShot(shot.id, {
            generatedImageUrl: data.imageUrl,
            imagePrompt: prompt,
          });
          generatedCount += 1;
        } else {
          setNotice({
            type: 'error',
            title: `Plan ${String(shot.number).padStart(2, '0')} interrompu`,
            message:
              data.message ||
              "Quota d'images Gemini indisponible sur cette clé. Utilisez l'import d'images ou les visuels du projet pour assembler votre diaporama.",
          });
          setGeneratingShotIds((prev) => ({ ...prev, [shot.id]: false }));
          break;
        }
      } catch {
        setGeneratingShotIds((prev) => ({ ...prev, [shot.id]: false }));
        break;
      }
      setGeneratingShotIds((prev) => ({ ...prev, [shot.id]: false }));
    }

    if (generatedCount > 0) {
      setNotice({
        type: 'success',
        title: 'Série d’images générée',
        message: `${generatedCount} image(s) storyboard générée(s) avec Gemini. Passez à l’onglet Diaporama MP4 pour assembler la vidéo.`,
      });
    }
    setBatchGenerating(false);
  };

  const handleUploadShotImage = (shotId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 1280;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          handleUpdateShot(shotId, { generatedImageUrl: dataUrl });
        }
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateDialogueAudio = async (blockId: string) => {
    if (!activeScene) return;
    const block = activeScene.blocks.find((b) => b.id === blockId);
    if (!block) return;

    const char = project.characters.find(
      (c) => c.id === block.characterId || c.name === block.characterName,
    );

    setGeneratingAudioIds((prev) => ({ ...prev, [blockId]: true }));
    setNotice(null);

    try {
      const res = await fetch('/api/connectors/gemini/generate-dialogue-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: block.content,
          voiceName: char?.voiceProfile.voiceName || 'Kore',
          styleDirective: block.voiceEmotion || char?.voiceProfile.defaultEmotion || '',
          blockId: block.id,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.audioUrl) {
        setNotice({
          type: 'error',
          title: 'Synthèse vocale Gemini TTS',
          message:
            data.message || 'Impossible de générer la voix pour cette réplique.',
        });
        return;
      }

      updateActiveScene((scene) => ({
        ...scene,
        blocks: scene.blocks.map((b) =>
          b.id === blockId ? { ...b, generatedAudioUrl: data.audioUrl } : b,
        ),
      }));
      setNotice({
        type: 'success',
        title: 'Voix générée avec Gemini TTS',
        message: 'Piste audio WAV prête et prête à être mixée dans le diaporama.',
      });
    } catch {
      setNotice({
        type: 'error',
        title: 'Erreur réseau',
        message: 'Impossible de joindre le serveur studio.',
      });
    } finally {
      setGeneratingAudioIds((prev) => ({ ...prev, [blockId]: false }));
    }
  };

  const handleRenderSlideshow = async () => {
    if (!activeScene) return;

    const targetScenes = includeAllScenes ? project.scenes : [activeScene];
    const slides = targetScenes.flatMap((scene) =>
      scene.shots
        .filter((shot) => Boolean(shot.generatedImageUrl))
        .map((shot) => {
          const linkedDialogue = shot.dialogueBlockIds[0]
            ? scene.blocks.find((b) => b.id === shot.dialogueBlockIds[0])
            : undefined;
          return {
            imageUrl: shot.generatedImageUrl!,
            durationSec: shot.durationSec,
            titleText: `${project.title} — S${String(scene.number).padStart(2, '0')} · Plan ${String(shot.number).padStart(2, '0')}`,
            subtitleText:
              shot.subtitleText?.trim() ||
              linkedDialogue?.content ||
              shot.description,
            audioUrl: linkedDialogue?.generatedAudioUrl,
          };
        }),
    );

    if (slides.length === 0) {
      setNotice({
        type: 'error',
        title: 'Aucune image de plan prête',
        message:
          'Générez des images Gemini ou importez/assignez au moins une image dans vos plans avant de lancer l’assemblage diaporama.',
      });
      return;
    }

    setRenderingVideo(true);
    setNotice(null);

    try {
      const res = await fetch('/api/slideshow/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectTitle: project.title,
          aspectRatio: project.aspectRatio,
          fps: project.fps,
          transition,
          musicMood,
          showTextOverlay,
          slides,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.videoUrl) {
        setNotice({
          type: 'error',
          title: 'Échec de l’assemblage FFmpeg',
          message: data.error || 'Erreur lors de la création de la vidéo diaporama.',
        });
        return;
      }

      setRenderedVideo(data as SlideshowRenderResult);
      setNotice({
        type: 'success',
        title: 'Vidéo diaporama assemblée',
        message: `MP4 généré (${data.slideCount} plans · ${data.durationSec}s) avec transitions, texte et musique.`,
      });
    } catch {
      setNotice({
        type: 'error',
        title: 'Erreur serveur',
        message: 'Impossible de joindre le moteur FFmpeg.',
      });
    } finally {
      setRenderingVideo(false);
    }
  };

  if (!activeScene) {
    return (
      <div className="border border-white/10 bg-[#11131C] rounded-xl p-10 text-center">
        <p className="text-sm text-zinc-400">
          Créez d’abord une scène dans l’éditeur de scénario pour préparer son découpage et son diaporama vidéo.
        </p>
      </div>
    );
  }

  const dialogueBlocks = activeScene.blocks.filter((b) => b.type === 'dialogue');
  const readySlidesCount = (includeAllScenes ? project.scenes : [activeScene]).reduce(
    (sum, sc) => sum + sc.shots.filter((sh) => Boolean(sh.generatedImageUrl)).length,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Scene Switcher Strip */}
      <div className="border border-white/10 bg-[#11131C] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
          <label htmlFor="prep-scene-select" className="text-xs font-medium text-zinc-400 shrink-0">
            Scène active :
          </label>
          <select
            id="prep-scene-select"
            value={activeScene.id}
            onChange={(e) => {
              setSelectedSceneId(e.target.value);
              setNotice(null);
            }}
            className="px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm font-mono text-zinc-100 focus:outline-none focus:border-amber-500 max-w-full"
          >
            {project.scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                S{String(scene.number).padStart(2, '0')} — {formatSceneHeading(scene)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs text-zinc-400 tabular-nums shrink-0">
          <span>{activeScene.shots.length} plans</span>
          <span aria-hidden="true">·</span>
          <span>{dialogueBlocks.length} répliques</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-400 font-mono">
            {formatDuration(computeSceneDurationSec(activeScene))}
          </span>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          className="flex items-center gap-1 p-1 bg-[#11131C] border border-white/10 rounded-lg overflow-x-auto max-w-full"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={prepTab === 'shots'}
            onClick={() => setPrepTab('shots')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              prepTab === 'shots'
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Plans & Images (Gemini)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={prepTab === 'dialogues'}
            onClick={() => setPrepTab('dialogues')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              prepTab === 'dialogues'
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Dialogues & Voix (Gemini TTS)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={prepTab === 'timeline'}
            onClick={() => setPrepTab('timeline')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              prepTab === 'timeline'
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Diaporama Vidéo (FFmpeg MP4)
          </button>
        </div>

        {prepTab === 'shots' && (
          <div className="flex flex-wrap items-center gap-2">
            {activeScene.shots.length > 0 && (
              <button
                type="button"
                disabled={batchGenerating}
                onClick={handleGenerateAllImages}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-100 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {batchGenerating
                  ? 'Génération série en cours...'
                  : 'Générer toute la série (Gemini)'}
              </button>
            )}
            <button
              type="button"
              onClick={handleAddShot}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter un plan
            </button>
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {notice && (
        <div
          className={`border rounded-xl p-4 flex items-start justify-between gap-3 ${
            notice.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : notice.type === 'error'
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-white/15 bg-white/5'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                notice.type === 'success' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            <div>
              <h4 className="text-sm font-semibold text-zinc-100">{notice.title}</h4>
              <p className="text-xs text-zinc-300 mt-1">{notice.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs text-zinc-400 hover:text-white shrink-0"
          >
            Fermer
          </button>
        </div>
      )}

      {/* TAB 1: SHOT BREAKDOWN & STORYBOARD IMAGES */}
      {prepTab === 'shots' && (
        <div className="space-y-4">
          {activeScene.shots.length === 0 ? (
            <div className="border border-white/10 bg-[#11131C] rounded-xl p-10 text-center">
              <p className="text-sm text-zinc-400 mb-4">
                Aucun plan technique découpé pour cette scène.
              </p>
              <button
                type="button"
                onClick={handleAddShot}
                className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 rounded-lg"
              >
                Créer le Plan 01
              </button>
            </div>
          ) : (
            activeScene.shots.map((shot) => {
              const isGenerating = Boolean(generatingShotIds[shot.id]);
              return (
                <div
                  key={shot.id}
                  className="border border-white/10 bg-[#11131C] rounded-xl p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-amber-400 tabular-nums">
                        PLAN {String(shot.number).padStart(2, '0')}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {shot.generatedImageUrl
                          ? 'Image prête pour le diaporama MP4'
                          : 'Aucune image assignée'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isGenerating}
                        onClick={() => handleGenerateShotImage(shot)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-100 bg-white/10 hover:bg-white/15 rounded-md transition-colors whitespace-nowrap disabled:opacity-50"
                      >
                        <ImagePlus className="w-3.5 h-3.5 text-amber-400" />
                        {isGenerating ? 'Génération...' : 'Générer image (Gemini)'}
                      </button>

                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors cursor-pointer whitespace-nowrap">
                        <Upload className="w-3.5 h-3.5" />
                        Importer
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => handleUploadShotImage(shot.id, e)}
                          className="sr-only"
                        />
                      </label>

                      {project.coverImage && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateShot(shot.id, {
                              generatedImageUrl: project.coverImage,
                            })
                          }
                          className="px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors whitespace-nowrap"
                        >
                          Visuel projet
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteShot(shot.id)}
                        aria-label={`Supprimer le plan ${shot.number}`}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-md hover:bg-white/5 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Shot Preview + Specs */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    <div className="lg:col-span-4 aspect-video rounded-lg overflow-hidden border border-white/10 bg-[#090A0F]">
                      <CinemaImage
                        src={shot.generatedImageUrl}
                        alt={`Plan ${shot.number} — ${shot.shotSize}`}
                        fallbackTitle={`Plan ${String(shot.number).padStart(2, '0')}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="lg:col-span-8 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Valeur de plan
                          </label>
                          <select
                            value={shot.shotSize}
                            onChange={(e) =>
                              handleUpdateShot(shot.id, {
                                shotSize: e.target.value as ShotSize,
                              })
                            }
                            className="w-full px-2.5 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                          >
                            {SHOT_SIZES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Mouvement
                          </label>
                          <select
                            value={shot.cameraMovement}
                            onChange={(e) =>
                              handleUpdateShot(shot.id, {
                                cameraMovement: e.target.value as CameraMovement,
                              })
                            }
                            className="w-full px-2.5 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                          >
                            {CAMERA_MOVEMENTS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Optique
                          </label>
                          <input
                            type="text"
                            value={shot.lens}
                            onChange={(e) =>
                              handleUpdateShot(shot.id, { lens: e.target.value })
                            }
                            className="w-full px-2.5 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Durée (sec)
                          </label>
                          <input
                            type="number"
                            min={2}
                            max={20}
                            value={shot.durationSec}
                            onChange={(e) =>
                              handleUpdateShot(shot.id, {
                                durationSec: Math.max(
                                  2,
                                  Math.min(20, Number(e.target.value) || 4),
                                ),
                              })
                            }
                            className="w-full px-2.5 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Description visuelle
                          </label>
                          <textarea
                            rows={2}
                            value={shot.description}
                            onChange={(e) =>
                              handleUpdateShot(shot.id, { description: e.target.value })
                            }
                            placeholder="Cadrage, décor, action des comédiens..."
                            className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Texte / Sous-titre du diaporama
                          </label>
                          <textarea
                            rows={2}
                            value={shot.subtitleText || ''}
                            onChange={(e) =>
                              handleUpdateShot(shot.id, { subtitleText: e.target.value })
                            }
                            placeholder="Texte affiché en bas de cette image dans la vidéo..."
                            className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label className="text-xs font-medium text-amber-400">
                            Prompt image storyboard (Gemini AI Studio)
                          </label>
                          <button
                            type="button"
                            onClick={() => handleAutoComposeImagePrompt(shot)}
                            className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-amber-400 transition-colors"
                          >
                            <Wand2 className="w-3 h-3" />
                            Auto-composer
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={shot.imagePrompt}
                          onChange={(e) =>
                            handleUpdateShot(shot.id, { imagePrompt: e.target.value })
                          }
                          placeholder="Décrivez le photogramme à générer avec Gemini..."
                          className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: DIALOGUES & GEMINI TTS VOICE PREP */}
      {prepTab === 'dialogues' && (
        <div className="border border-white/10 bg-[#11131C] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="text-base font-semibold text-zinc-100">
              Préparation des dialogues & voix (Gemini TTS)
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Générez des pistes vocales WAV directement avec votre clé Gemini d’AI Studio et écoutez-les avant l’assemblage du diaporama.
            </p>
          </div>

          {dialogueBlocks.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-400">
              Aucune réplique dans cette scène. Ajoutez des dialogues depuis l’éditeur de scénario.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {dialogueBlocks.map((blk, idx) => {
                const char = project.characters.find(
                  (c) => c.id === blk.characterId || c.name === blk.characterName,
                );
                const isLoadingAudio = Boolean(generatingAudioIds[blk.id]);
                return (
                  <div
                    key={blk.id}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono text-amber-400 tabular-nums">
                          DLG {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-zinc-100">
                          {char?.name || blk.characterName || 'PERSONNAGE'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-zinc-400">
                          Voix {char?.voiceProfile.voiceName || 'Kore'}
                        </span>
                        {blk.voiceEmotion && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-zinc-300">{blk.voiceEmotion}</span>
                          </>
                        )}
                      </div>

                      <textarea
                        rows={2}
                        value={blk.content}
                        onChange={(e) =>
                          updateActiveScene((scene) => ({
                            ...scene,
                            blocks: scene.blocks.map((b) =>
                              b.id === blk.id ? { ...b, content: e.target.value } : b,
                            ),
                          }))
                        }
                        className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500 resize-none"
                      />

                      {blk.generatedAudioUrl && (
                        <audio
                          controls
                          src={blk.generatedAudioUrl}
                          className="w-full max-w-md h-9 mt-2"
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        disabled={isLoadingAudio}
                        onClick={() => handleGenerateDialogueAudio(blk.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-100 bg-white/10 hover:bg-white/15 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                      >
                        <Mic className="w-3.5 h-3.5 text-amber-400" />
                        {isLoadingAudio
                          ? 'Synthèse...'
                          : blk.generatedAudioUrl
                            ? 'Régénérer voix'
                            : 'Générer voix (Gemini)'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FFMPEG SLIDESHOW VIDEO ASSEMBLY */}
      {prepTab === 'timeline' && (
        <div className="border border-white/10 bg-[#11131C] rounded-xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Assemblage Diaporama Vidéo (FFmpeg 100 % gratuit)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Assemble les images de vos plans avec transitions en fondu, textes incrustés et musique d’ambiance en un véritable fichier MP4.
              </p>
            </div>
            <button
              type="button"
              disabled={renderingVideo || readySlidesCount === 0}
              onClick={handleRenderSlideshow}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Film className="w-4 h-4" />
              {renderingVideo
                ? 'Assemblage MP4 en cours...'
                : `Assembler le diaporama (${readySlidesCount} images)`}
            </button>
          </div>

          {/* Slideshow Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Transition</label>
              <select
                value={transition}
                onChange={(e) => setTransition(e.target.value as SlideshowTransition)}
                className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="fade">Fondu enchaîné</option>
                <option value="dissolve">Dissolution douce</option>
                <option value="slideleft">Glissement latéral</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                Musique d’ambiance
              </label>
              <select
                value={musicMood}
                onChange={(e) => setMusicMood(e.target.value as MusicMood)}
                className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="noir">Néo-Noir sombre</option>
                <option value="drama">Drame chaleureux</option>
                <option value="suspense">Suspense minimaliste</option>
                <option value="none">Sans musique</option>
              </select>
            </div>

            <label className="flex items-center gap-2.5 p-3 bg-[#090A0F] border border-white/10 rounded-lg cursor-pointer text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={showTextOverlay}
                onChange={(e) => setShowTextOverlay(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
              <span>Incruster titres & sous-titres</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 bg-[#090A0F] border border-white/10 rounded-lg cursor-pointer text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={includeAllScenes}
                onChange={(e) => setIncludeAllScenes(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
              <span>Assembler tout le film ({project.scenes.length} scènes)</span>
            </label>
          </div>

          {/* Visual Slide Track */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400">
              Séquence des images sélectionnées ({readySlidesCount} prêtes) :
            </p>
            {readySlidesCount === 0 ? (
              <div className="p-4 border border-dashed border-white/15 rounded-lg text-xs text-zinc-500">
                Aucune image prête dans cette sélection. Générez ou importez des images dans l’onglet « Plans & Images ».
              </div>
            ) : (
              <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
                {(includeAllScenes ? project.scenes : [activeScene]).flatMap((sc) =>
                  sc.shots
                    .filter((sh) => Boolean(sh.generatedImageUrl))
                    .map((sh) => (
                      <div
                        key={sh.id}
                        className="w-48 shrink-0 bg-[#090A0F] border border-white/10 rounded-lg overflow-hidden"
                      >
                        <div className="aspect-video bg-black">
                          <CinemaImage
                            src={sh.generatedImageUrl}
                            alt={`S${sc.number} P${sh.number}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-amber-400 tabular-nums">
                              S{String(sc.number).padStart(2, '0')}·P{String(sh.number).padStart(2, '0')}
                            </span>
                            <span className="font-mono text-zinc-400 tabular-nums">
                              {sh.durationSec}s
                            </span>
                          </div>
                          <p className="text-zinc-300 truncate mt-1">
                            {sh.subtitleText || sh.description || sh.shotSize}
                          </p>
                        </div>
                      </div>
                    )),
                )}
              </div>
            )}
          </div>

          {/* Real Rendered MP4 Video Player */}
          {renderedVideo && (
            <div className="pt-5 border-t border-white/10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-emerald-400">
                    Film diaporama prêt ({renderedVideo.durationSec}s · {renderedVideo.slideCount} plans)
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Encodé en H.264/AAC par FFmpeg avec transitions et piste musicale.
                  </p>
                </div>
                <a
                  href={renderedVideo.videoUrl}
                  download={renderedVideo.filename}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger le MP4
                </a>
              </div>

              <div className="rounded-xl overflow-hidden border border-white/10 bg-black max-w-3xl">
                <video
                  key={renderedVideo.videoUrl}
                  controls
                  src={renderedVideo.videoUrl}
                  className="w-full max-h-[440px]"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
