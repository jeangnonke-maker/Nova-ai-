import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Clapperboard,
  Download,
  Eye,
  PenLine,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  FilmProject,
  IntExt,
  Scene,
  ScriptBlock,
  ScriptBlockType,
  TimeOfDay,
} from '../types/film';
import {
  computeSceneDurationSec,
  downloadTextFile,
  exportProjectToFountain,
  formatDuration,
  formatSceneHeading,
  slugify,
} from '../utils/filmMetrics';

interface ScreenplayEditorViewProps {
  project: FilmProject;
  initialSceneId?: string | null;
  onUpdateProject: (updater: (prev: FilmProject) => FilmProject) => void;
  onOpenScenePrep: (sceneId: string) => void;
}

const INT_EXT_OPTIONS: IntExt[] = ['INT.', 'EXT.', 'INT./EXT.'];
const TIME_OPTIONS: TimeOfDay[] = ['JOUR', 'NUIT', 'AUBE', 'CRÉPUSCULE'];
const BLOCK_LABELS: Record<ScriptBlockType, string> = {
  action: 'Action',
  character: 'Personnage',
  parenthetical: 'Didascalie',
  dialogue: 'Dialogue',
  transition: 'Transition',
};

export function ScreenplayEditorView({
  project,
  initialSceneId,
  onUpdateProject,
  onOpenScenePrep,
}: ScreenplayEditorViewProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    initialSceneId || project.scenes[0]?.id || '',
  );
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [geminiState, setGeminiState] = useState<{
    loading: boolean;
    result: string | null;
    apiNotice: string | null;
  }>({ loading: false, result: null, apiNotice: null });

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

  const handleAddScene = () => {
    const nextNumber = project.scenes.length + 1;
    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      number: nextNumber,
      heading: {
        intExt: 'INT.',
        location: 'NOUVEAU DÉCOR',
        timeOfDay: 'JOUR',
      },
      synopsis: '',
      mood: '',
      status: 'Brouillon',
      blocks: [
        {
          id: `blk-${Date.now()}`,
          type: 'action',
          content: '',
        },
      ],
      shots: [],
    };
    onUpdateProject((prev) => ({
      ...prev,
      scenes: [...prev.scenes, newScene],
    }));
    setSelectedSceneId(newScene.id);
  };

  const handleMoveScene = (sceneId: string, direction: -1 | 1) => {
    onUpdateProject((prev) => {
      const idx = prev.scenes.findIndex((s) => s.id === sceneId);
      const targetIdx = idx + direction;
      if (idx < 0 || targetIdx < 0 || targetIdx >= prev.scenes.length) return prev;
      const reordered = [...prev.scenes];
      const [moved] = reordered.splice(idx, 1);
      reordered.splice(targetIdx, 0, moved);
      return {
        ...prev,
        scenes: reordered.map((s, i) => ({ ...s, number: i + 1 })),
      };
    });
  };

  const handleDeleteScene = (sceneId: string) => {
    onUpdateProject((prev) => {
      const remaining = prev.scenes
        .filter((s) => s.id !== sceneId)
        .map((s, i) => ({ ...s, number: i + 1 }));
      return { ...prev, scenes: remaining };
    });
  };

  const handleAddBlock = (type: ScriptBlockType) => {
    if (!activeScene) return;
    const firstChar = project.characters[0];

    if (type === 'dialogue') {
      const charName = firstChar?.name || 'PERSONNAGE';
      const charBlock: ScriptBlock = {
        id: `blk-${Date.now()}-c`,
        type: 'character',
        characterId: firstChar?.id,
        characterName: charName,
        content: charName,
      };
      const dlgBlock: ScriptBlock = {
        id: `blk-${Date.now()}-d`,
        type: 'dialogue',
        characterId: firstChar?.id,
        characterName: charName,
        voiceEmotion: firstChar?.voiceProfile.defaultEmotion || 'Neutre',
        content: '',
      };
      updateActiveScene((scene) => ({
        ...scene,
        blocks: [...scene.blocks, charBlock, dlgBlock],
      }));
      return;
    }

    const newBlock: ScriptBlock = {
      id: `blk-${Date.now()}`,
      type,
      characterId: type === 'character' ? firstChar?.id : undefined,
      characterName: type === 'character' ? firstChar?.name : undefined,
      content: type === 'transition' ? 'COUPE FRANCHE :' : '',
    };
    updateActiveScene((scene) => ({
      ...scene,
      blocks: [...scene.blocks, newBlock],
    }));
  };

  const handleUpdateBlock = (blockId: string, patch: Partial<ScriptBlock>) => {
    updateActiveScene((scene) => ({
      ...scene,
      blocks: scene.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
    }));
  };

  const handleDeleteBlock = (blockId: string) => {
    updateActiveScene((scene) => ({
      ...scene,
      blocks: scene.blocks.filter((b) => b.id !== blockId),
    }));
  };

  const handleAnalyzeSceneWithGemini = async () => {
    if (!activeScene) return;
    setGeminiState({ loading: true, result: null, apiNotice: null });
    try {
      const res = await fetch('/api/connectors/gemini/analyze-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectTitle: project.title,
          visualStyle: project.visualStyle,
          scene: activeScene,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGeminiState({
          loading: false,
          result: null,
          apiNotice:
            data.message ||
            "Connexion API Google Gemini requise pour analyser la scène.",
        });
        return;
      }
      setGeminiState({
        loading: false,
        result: data.analysisText,
        apiNotice: null,
      });
    } catch {
      setGeminiState({
        loading: false,
        result: null,
        apiNotice: 'Impossible de joindre le connecteur serveur Gemini.',
      });
    }
  };

  const handleExportFountain = () => {
    const fountain = exportProjectToFountain(project);
    downloadTextFile(`${slugify(project.title)}.fountain`, fountain);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Scene Navigator */}
      <aside className="lg:col-span-4 xl:col-span-3 border border-white/10 bg-[#11131C] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
          <h2 className="text-sm font-semibold text-zinc-100">
            Scènes ({project.scenes.length})
          </h2>
          <button
            type="button"
            onClick={handleAddScene}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-md transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        </div>

        <div className="divide-y divide-white/5 max-h-[340px] lg:max-h-[680px] overflow-y-auto">
          {project.scenes.map((scene, index) => {
            const selected = activeScene?.id === scene.id;
            return (
              <div
                key={scene.id}
                className={`p-3.5 transition-colors ${
                  selected ? 'bg-amber-500/10' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSceneId(scene.id);
                      setGeminiState({ loading: false, result: null, apiNotice: null });
                    }}
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          selected ? 'text-amber-400' : 'text-zinc-500'
                        }`}
                      >
                        S{String(scene.number).padStart(2, '0')}
                      </span>
                      <span className="text-xs font-medium text-zinc-100 truncate">
                        {scene.heading.location || 'LIEU À DÉFINIR'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {scene.heading.intExt} · {scene.heading.timeOfDay} ·{' '}
                      <span className="tabular-nums">
                        {formatDuration(computeSceneDurationSec(scene))}
                      </span>
                    </p>
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveScene(scene.id, -1)}
                      aria-label={`Monter la scène ${scene.number}`}
                      className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === project.scenes.length - 1}
                      onClick={() => handleMoveScene(scene.id, 1)}
                      aria-label={`Descendre la scène ${scene.number}`}
                      className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Screenplay Editor */}
      <div className="lg:col-span-8 xl:col-span-9 space-y-4">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-[#11131C] rounded-xl px-4 py-3">
          <div className="flex items-center gap-1 p-1 bg-[#090A0F] border border-white/10 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'edit'
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <PenLine className="w-3.5 h-3.5" />
              Édition structurée
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'preview'
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Aperçu scénario
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAnalyzeSceneWithGemini}
              disabled={!activeScene || geminiState.loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-100 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {geminiState.loading ? 'Analyse en cours...' : 'Analyser (Gemini)'}
            </button>
            <button
              type="button"
              onClick={handleExportFountain}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export .fountain
            </button>
            {activeScene && (
              <button
                type="button"
                onClick={() => onOpenScenePrep(activeScene.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap"
              >
                <Clapperboard className="w-3.5 h-3.5" />
                Préparer cette scène
              </button>
            )}
          </div>
        </div>

        {/* Gemini Feedback / API Requirement Notice */}
        {(geminiState.apiNotice || geminiState.result) && (
          <div className="border border-white/10 bg-[#11131C] rounded-xl p-4">
            {geminiState.apiNotice ? (
              <div className="flex items-start gap-3 text-sm">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-zinc-100">
                    Connexion API Google Gemini requise
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">{geminiState.apiNotice}</p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-amber-400 mb-2">
                  Analyse dramaturgique Google Gemini
                </p>
                <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {geminiState.result}
                </div>
              </div>
            )}
          </div>
        )}

        {!activeScene ? (
          <div className="border border-white/10 bg-[#11131C] rounded-xl p-10 text-center">
            <p className="text-sm text-zinc-400 mb-4">
              Aucune scène sélectionnée. Ajoutez votre première scène pour commencer l’écriture.
            </p>
            <button
              type="button"
              onClick={handleAddScene}
              className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 rounded-lg"
            >
              Créer la scène 1
            </button>
          </div>
        ) : viewMode === 'preview' ? (
          /* Authentic Fountain-style Screenplay Page Preview */
          <div className="border border-white/10 bg-[#151722] rounded-xl p-6 sm:p-10 font-mono text-sm text-zinc-100 max-w-4xl mx-auto">
            <div className="mb-8 pb-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
              <span>{project.title.toUpperCase()}</span>
              <span className="tabular-nums">
                SCÈNE {activeScene.number} · {formatDuration(computeSceneDurationSec(activeScene))}
              </span>
            </div>

            <p className="font-semibold uppercase tracking-wide text-amber-300 mb-6">
              {activeScene.number}. {formatSceneHeading(activeScene)}
            </p>

            <div className="space-y-4">
              {activeScene.blocks.map((block) => {
                if (block.type === 'action') {
                  return (
                    <p key={block.id} className="leading-relaxed text-zinc-200">
                      {block.content || '—'}
                    </p>
                  );
                }
                if (block.type === 'character') {
                  return (
                    <p
                      key={block.id}
                      className="uppercase font-semibold text-zinc-100 text-center pt-2"
                    >
                      {block.content}
                    </p>
                  );
                }
                if (block.type === 'parenthetical') {
                  return (
                    <p key={block.id} className="text-center text-zinc-400 text-xs italic">
                      {block.content}
                    </p>
                  );
                }
                if (block.type === 'dialogue') {
                  return (
                    <p
                      key={block.id}
                      className="max-w-md mx-auto leading-relaxed text-zinc-100"
                    >
                      {block.content}
                    </p>
                  );
                }
                return (
                  <p key={block.id} className="text-right uppercase text-xs text-zinc-400 pt-2">
                    {block.content}
                  </p>
                );
              })}
            </div>
          </div>
        ) : (
          /* Structured Block Editor */
          <div className="border border-white/10 bg-[#11131C] rounded-xl p-5 sm:p-6 space-y-6">
            {/* Scene Heading Controls */}
            <div className="space-y-4 pb-5 border-b border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-xs font-semibold text-amber-400 tabular-nums">
                  SCÈNE {String(activeScene.number).padStart(2, '0')}
                </span>
                <div className="flex items-center gap-3">
                  <select
                    aria-label="Statut de la scène"
                    value={activeScene.status}
                    onChange={(e) =>
                      updateActiveScene((s) => ({
                        ...s,
                        status: e.target.value as Scene['status'],
                      }))
                    }
                    className="px-2.5 py-1.5 bg-[#090A0F] border border-white/10 rounded-md text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Brouillon">Brouillon</option>
                    <option value="Découpée">Découpée</option>
                    <option value="Validée">Validée</option>
                  </select>
                  {project.scenes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteScene(activeScene.id)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-md hover:bg-white/5 transition-colors"
                      title="Supprimer cette scène"
                      aria-label="Supprimer cette scène"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs text-zinc-400 mb-1">Cadre</label>
                  <select
                    value={activeScene.heading.intExt}
                    onChange={(e) =>
                      updateActiveScene((s) => ({
                        ...s,
                        heading: { ...s.heading, intExt: e.target.value as IntExt },
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    {INT_EXT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs text-zinc-400 mb-1">Lieu / Décor</label>
                  <input
                    type="text"
                    value={activeScene.heading.location}
                    onChange={(e) =>
                      updateActiveScene((s) => ({
                        ...s,
                        heading: { ...s.heading, location: e.target.value.toUpperCase() },
                      }))
                    }
                    placeholder="EX. : GARE DU NORD - QUAI 4"
                    className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm font-mono text-zinc-100 uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs text-zinc-400 mb-1">Moment</label>
                  <select
                    value={activeScene.heading.timeOfDay}
                    onChange={(e) =>
                      updateActiveScene((s) => ({
                        ...s,
                        heading: { ...s.heading, timeOfDay: e.target.value as TimeOfDay },
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    {TIME_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Synopsis de la scène
                </label>
                <input
                  type="text"
                  value={activeScene.synopsis}
                  onChange={(e) =>
                    updateActiveScene((s) => ({ ...s, synopsis: e.target.value }))
                  }
                  placeholder="Enjeu dramatique résumé de cette scène..."
                  className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Blocks */}
            <div className="space-y-3">
              {activeScene.blocks.map((block) => (
                <div
                  key={block.id}
                  className="group flex flex-col sm:flex-row sm:items-start gap-2.5 p-3 rounded-lg bg-[#090A0F] border border-white/10"
                >
                  <div className="flex items-center justify-between sm:w-36 shrink-0 gap-2">
                    <select
                      aria-label="Type de bloc"
                      value={block.type}
                      onChange={(e) =>
                        handleUpdateBlock(block.id, {
                          type: e.target.value as ScriptBlockType,
                        })
                      }
                      className="w-full px-2 py-1.5 bg-[#11131C] border border-white/10 rounded text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
                    >
                      {(Object.keys(BLOCK_LABELS) as ScriptBlockType[]).map((key) => (
                        <option key={key} value={key}>
                          {BLOCK_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 space-y-2">
                    {(block.type === 'character' || block.type === 'dialogue') &&
                      project.characters.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label="Personnage associé"
                            value={block.characterId || ''}
                            onChange={(e) => {
                              const char = project.characters.find(
                                (c) => c.id === e.target.value,
                              );
                              handleUpdateBlock(block.id, {
                                characterId: char?.id,
                                characterName: char?.name,
                                content:
                                  block.type === 'character' && char
                                    ? char.name
                                    : block.content,
                              });
                            }}
                            className="px-2.5 py-1 bg-[#11131C] border border-white/10 rounded text-xs text-amber-400 focus:outline-none"
                          >
                            <option value="">Personnage libre...</option>
                            {project.characters.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          {block.type === 'dialogue' && (
                            <input
                              type="text"
                              value={block.voiceEmotion || ''}
                              onChange={(e) =>
                                handleUpdateBlock(block.id, {
                                  voiceEmotion: e.target.value,
                                })
                              }
                              placeholder="Intonation (ex. : Murmure tendu)"
                              className="px-2.5 py-1 bg-[#11131C] border border-white/10 rounded text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
                            />
                          )}
                        </div>
                      )}

                    <textarea
                      rows={block.type === 'action' || block.type === 'dialogue' ? 2 : 1}
                      value={block.content}
                      onChange={(e) =>
                        handleUpdateBlock(block.id, {
                          content:
                            block.type === 'character' || block.type === 'transition'
                              ? e.target.value.toUpperCase()
                              : e.target.value,
                        })
                      }
                      placeholder={
                        block.type === 'action'
                          ? "Décrivez l'action visuelle..."
                          : block.type === 'dialogue'
                            ? 'Saisissez la réplique...'
                            : block.type === 'parenthetical'
                              ? '(didascalie)'
                              : 'NOM DU PERSONNAGE'
                      }
                      className={`w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-y ${
                        block.type === 'character' || block.type === 'transition'
                          ? 'font-mono uppercase font-semibold'
                          : block.type === 'dialogue'
                            ? 'font-mono'
                            : 'leading-relaxed'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteBlock(block.id)}
                    aria-label="Supprimer le bloc"
                    className="p-1.5 text-zinc-600 hover:text-rose-400 self-end sm:self-start transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Quick Insert Toolbar */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10">
              <span className="text-xs text-zinc-500 mr-1">Insérer :</span>
              <button
                type="button"
                onClick={() => handleAddBlock('action')}
                className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors"
              >
                + Action
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('dialogue')}
                className="px-3 py-1.5 text-xs font-medium text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-md transition-colors"
              >
                + Personnage & Dialogue
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('parenthetical')}
                className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors"
              >
                + Didascalie
              </button>
              <button
                type="button"
                onClick={() => handleAddBlock('transition')}
                className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors"
              >
                + Transition
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
