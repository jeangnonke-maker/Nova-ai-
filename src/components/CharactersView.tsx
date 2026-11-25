import { useEffect, useState } from 'react';
import { ImagePlus, Plus, Trash2, UserPlus } from 'lucide-react';
import type { Character, CharacterRole, FilmProject, GeminiVoiceName } from '../types/film';
import { CinemaImage } from './CinemaImage';

interface CharactersViewProps {
  project: FilmProject;
  onUpdateProject: (updater: (prev: FilmProject) => FilmProject) => void;
}

const ROLES: CharacterRole[] = ['Protagoniste', 'Antagoniste', 'Secondaire', 'Figurant'];
const GEMINI_VOICES: Array<{ id: GeminiVoiceName; label: string }> = [
  { id: 'Kore', label: 'Kore (Féminin posé)' },
  { id: 'Zephyr', label: 'Zephyr (Féminin lumineux)' },
  { id: 'Charon', label: 'Charon (Masculin grave)' },
  { id: 'Fenrir', label: 'Fenrir (Masculin chaleureux)' },
  { id: 'Puck', label: 'Puck (Dynamique / Jeune)' },
];

export function CharactersView({ project, onUpdateProject }: CharactersViewProps) {
  const [selectedId, setSelectedId] = useState<string>(project.characters[0]?.id || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [generatingPortrait, setGeneratingPortrait] = useState(false);
  const [portraitNotice, setPortraitNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!project.characters.some((c) => c.id === selectedId)) {
      setSelectedId(project.characters[0]?.id || '');
    }
    setConfirmDelete(false);
    setPortraitNotice(null);
  }, [project.characters, selectedId]);

  const activeCharacter =
    project.characters.find((c) => c.id === selectedId) ?? project.characters[0] ?? null;

  const getCharacterUsage = (char: Character) => {
    let dialogues = 0;
    let scenes = 0;
    for (const scene of project.scenes) {
      let inScene = false;
      for (const blk of scene.blocks) {
        if (
          blk.type === 'dialogue' &&
          (blk.characterId === char.id || blk.characterName === char.name)
        ) {
          dialogues += 1;
          inScene = true;
        }
      }
      if (inScene) scenes += 1;
    }
    return { dialogues, scenes };
  };

  const handleAddCharacter = () => {
    const newChar: Character = {
      id: `char-${Date.now()}`,
      name: `NOUVEAU PERSONNAGE ${project.characters.length + 1}`,
      role: 'Secondaire',
      age: '35 ans',
      physicalDescription: '',
      psychologicalArc: '',
      costumeVisualPrompt: '',
      voiceProfile: {
        provider: 'gemini-tts',
        voiceName: 'Kore',
        language: 'fr-FR',
        defaultEmotion: 'Neutre',
        styleNotes: 'Voix naturelle équilibrée',
      },
    };
    onUpdateProject((prev) => ({
      ...prev,
      characters: [...prev.characters, newChar],
    }));
    setSelectedId(newChar.id);
  };

  const updateActiveCharacter = (updater: (c: Character) => Character) => {
    if (!activeCharacter) return;
    onUpdateProject((prev) => ({
      ...prev,
      characters: prev.characters.map((c) => (c.id === activeCharacter.id ? updater(c) : c)),
    }));
  };

  const handleDeleteCharacter = (charId: string) => {
    onUpdateProject((prev) => ({
      ...prev,
      characters: prev.characters.filter((c) => c.id !== charId),
    }));
    setConfirmDelete(false);
  };

  const handleGeneratePortrait = async () => {
    if (!activeCharacter) return;
    const prompt =
      activeCharacter.costumeVisualPrompt.trim() ||
      activeCharacter.physicalDescription.trim() ||
      `Portrait cinématographique de ${activeCharacter.name}, ${activeCharacter.age}`;

    setGeneratingPortrait(true);
    setPortraitNotice(null);
    try {
      const res = await fetch('/api/connectors/gemini/generate-shot-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspectRatio: '1:1',
          shotId: activeCharacter.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.imageUrl) {
        setPortraitNotice(
          data.message || "Impossible de générer le portrait avec Gemini.",
        );
        return;
      }
      updateActiveCharacter((c) => ({ ...c, portraitUrl: data.imageUrl }));
    } catch {
      setPortraitNotice('Erreur de connexion au serveur studio.');
    } finally {
      setGeneratingPortrait(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Character Roster */}
      <aside className="lg:col-span-4 border border-white/10 bg-[#11131C] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
          <h2 className="text-sm font-semibold text-zinc-100">
            Distribution ({project.characters.length})
          </h2>
          <button
            type="button"
            onClick={handleAddCharacter}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-md transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        </div>

        {project.characters.length === 0 ? (
          <div className="p-6 text-center">
            <UserPlus className="w-8 h-8 text-zinc-600 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-xs text-zinc-400 mb-3">
              Aucun personnage défini pour ce film.
            </p>
            <button
              type="button"
              onClick={handleAddCharacter}
              className="px-3 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 rounded-lg"
            >
              Créer un personnage
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {project.characters.map((char) => {
              const selected = activeCharacter?.id === char.id;
              const usage = getCharacterUsage(char);
              return (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => setSelectedId(char.id)}
                  className={`w-full text-left p-3.5 flex items-center gap-3.5 transition-colors ${
                    selected ? 'bg-amber-500/10' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-[#090A0F]">
                    <CinemaImage
                      src={char.portraitUrl}
                      alt={char.name}
                      variant="portrait"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-100 truncate">
                      {char.name}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">
                      {char.role} · {char.age}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                      {usage.scenes} scènes · {usage.dialogues} répliques
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* Right Character Detail Editor */}
      <div className="lg:col-span-8">
        {!activeCharacter ? (
          <div className="border border-white/10 bg-[#11131C] rounded-xl p-10 text-center">
            <p className="text-sm text-zinc-400">
              Sélectionnez ou créez un personnage pour configurer sa fiche narrative, son apparence storyboard Gemini et sa voix de dialogue.
            </p>
          </div>
        ) : (
          <div className="border border-white/10 bg-[#11131C] rounded-xl p-5 sm:p-6 space-y-6">
            {/* Header with Portrait */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-white/10">
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-[#090A0F] shrink-0">
                <CinemaImage
                  src={activeCharacter.portraitUrl}
                  alt={`Portrait de ${activeCharacter.name}`}
                  variant="portrait"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-100 truncate">
                      {activeCharacter.name}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      {activeCharacter.role} · {activeCharacter.age}
                    </p>
                  </div>

                  {confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteCharacter(activeCharacter.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Confirmer suppression
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors"
                      title="Supprimer ce personnage"
                      aria-label="Supprimer ce personnage"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={generatingPortrait}
                    onClick={handleGeneratePortrait}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-100 bg-white/10 hover:bg-white/15 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ImagePlus className="w-3.5 h-3.5 text-amber-400" />
                    {generatingPortrait
                      ? 'Génération en cours...'
                      : 'Générer portrait (Gemini AI Studio)'}
                  </button>
                </div>

                {portraitNotice && (
                  <p className="mt-2 text-xs text-amber-300">{portraitNotice}</p>
                )}
              </div>
            </div>

            {/* Identity & Psychology */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Nom (Scénario)</label>
                <input
                  type="text"
                  value={activeCharacter.name}
                  onChange={(e) =>
                    updateActiveCharacter((c) => ({
                      ...c,
                      name: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm font-mono uppercase text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Rôle narratif</label>
                <select
                  value={activeCharacter.role}
                  onChange={(e) =>
                    updateActiveCharacter((c) => ({
                      ...c,
                      role: e.target.value as CharacterRole,
                    }))
                  }
                  className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Âge</label>
                <input
                  type="text"
                  value={activeCharacter.age}
                  onChange={(e) =>
                    updateActiveCharacter((c) => ({ ...c, age: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Description physique & présence
                </label>
                <textarea
                  rows={3}
                  value={activeCharacter.physicalDescription}
                  onChange={(e) =>
                    updateActiveCharacter((c) => ({
                      ...c,
                      physicalDescription: e.target.value,
                    }))
                  }
                  placeholder="Morphologie, posture, traits distinctifs..."
                  className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Psychologie & arc dramatique
                </label>
                <textarea
                  rows={3}
                  value={activeCharacter.psychologicalArc}
                  onChange={(e) =>
                    updateActiveCharacter((c) => ({
                      ...c,
                      psychologicalArc: e.target.value,
                    }))
                  }
                  placeholder="Motivations, conflit interne, évolution..."
                  className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            {/* Gemini Image Continuity Prompt */}
            <div className="pt-4 border-t border-white/10">
              <label className="block text-xs font-medium text-amber-400 mb-1.5">
                Prompt de continuité visuelle (Images Storyboard Gemini)
              </label>
              <textarea
                rows={2}
                value={activeCharacter.costumeVisualPrompt}
                onChange={(e) =>
                  updateActiveCharacter((c) => ({
                    ...c,
                    costumeVisualPrompt: e.target.value,
                  }))
                }
                placeholder="Descriptif précis du costume, éclairage et apparence utilisé dans chaque image storyboard..."
                className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Gemini TTS Voice Configuration */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-zinc-100">
                  Voix du personnage (Gemini TTS · Clé AI Studio)
                </h4>
                <span className="text-xs text-zinc-400">
                  Inclus avec votre clé GEMINI_API_KEY
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">
                    Voix Gemini
                  </label>
                  <select
                    value={activeCharacter.voiceProfile.voiceName}
                    onChange={(e) =>
                      updateActiveCharacter((c) => ({
                        ...c,
                        voiceProfile: {
                          ...c.voiceProfile,
                          voiceName: e.target.value as GeminiVoiceName,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    {GEMINI_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Langue</label>
                  <input
                    type="text"
                    value={activeCharacter.voiceProfile.language}
                    onChange={(e) =>
                      updateActiveCharacter((c) => ({
                        ...c,
                        voiceProfile: { ...c.voiceProfile, language: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">
                    Émotion par défaut
                  </label>
                  <input
                    type="text"
                    value={activeCharacter.voiceProfile.defaultEmotion}
                    onChange={(e) =>
                      updateActiveCharacter((c) => ({
                        ...c,
                        voiceProfile: {
                          ...c.voiceProfile,
                          defaultEmotion: e.target.value,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Notes de diction & jeu vocal
                </label>
                <input
                  type="text"
                  value={activeCharacter.voiceProfile.styleNotes}
                  onChange={(e) =>
                    updateActiveCharacter((c) => ({
                      ...c,
                      voiceProfile: { ...c.voiceProfile, styleNotes: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
