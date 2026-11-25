import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { AspectRatio, FilmProject, ProjectFormat } from '../types/film';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: FilmProject) => void;
}

const FORMATS: ProjectFormat[] = [
  'Court-métrage',
  'Long-métrage',
  'Série',
  'Documentaire',
  'Film publicitaire',
];

const RATIOS: AspectRatio[] = ['2.39:1', '16:9', '1.85:1', '9:16', '1:1'];

export function NewProjectModal({ isOpen, onClose, onCreate }: NewProjectModalProps) {
  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [genre, setGenre] = useState('Drame');
  const [format, setFormat] = useState<ProjectFormat>('Court-métrage');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('2.39:1');
  const [fps, setFps] = useState<24 | 25 | 30>(24);
  const [visualStyle, setVisualStyle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Veuillez saisir un titre pour le projet.');
      return;
    }

    const now = new Date().toISOString();
    const projectId = `proj-${Date.now()}`;
    const newProject: FilmProject = {
      id: projectId,
      title: title.trim(),
      logline:
        logline.trim() ||
        'Synopsis en cours de rédaction sur NOVA AI FILM.',
      genre: genre.trim() || 'Drame',
      format,
      aspectRatio,
      fps,
      status: 'Développement',
      visualStyle:
        visualStyle.trim() ||
        'Cinématographie naturelle 35mm, éclairage directionnel doux, grain subtil.',
      directorNotes: '',
      createdAt: now,
      updatedAt: now,
      characters: [],
      scenes: [
        {
          id: `scene-${Date.now()}`,
          number: 1,
          heading: {
            intExt: 'INT.',
            location: 'PREMIER DÉCOR',
            timeOfDay: 'JOUR',
          },
          synopsis: 'Scène d’ouverture à rédiger.',
          mood: 'Atmosphère initiale',
          status: 'Brouillon',
          blocks: [
            {
              id: `blk-${Date.now()}`,
              type: 'action',
              content: "Décrivez l'action et l'atmosphère de la scène d'ouverture.",
            },
          ],
          shots: [],
        },
      ],
    };

    onCreate(newProject);
    setTitle('');
    setLogline('');
    setVisualStyle('');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-title"
    >
      <div className="w-full max-w-xl bg-[#11131C] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 id="new-project-title" className="text-lg font-semibold text-zinc-100">
            Nouveau projet de film
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Fermer la fenêtre"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="proj-title" className="block text-xs font-medium text-zinc-400 mb-1.5">
              Titre du film
            </label>
            <input
              id="proj-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="Ex. : Le Dernier Signal"
              className="w-full px-3.5 py-2.5 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label htmlFor="proj-logline" className="block text-xs font-medium text-zinc-400 mb-1.5">
              Logline / Pitch court
            </label>
            <textarea
              id="proj-logline"
              rows={2}
              value={logline}
              onChange={(e) => setLogline(e.target.value)}
              placeholder="Résumez l'enjeu dramatique principal en une ou deux phrases..."
              className="w-full px-3.5 py-2.5 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="proj-genre" className="block text-xs font-medium text-zinc-400 mb-1.5">
                Genre
              </label>
              <input
                id="proj-genre"
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Science-fiction, Polar, Drame..."
                className="w-full px-3.5 py-2.5 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label htmlFor="proj-format" className="block text-xs font-medium text-zinc-400 mb-1.5">
                Format
              </label>
              <select
                id="proj-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as ProjectFormat)}
                className="w-full px-3.5 py-2.5 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="proj-ratio" className="block text-xs font-medium text-zinc-400 mb-1.5">
                Ratio d’aspect (Gemini / FFmpeg)
              </label>
              <select
                id="proj-ratio"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className="w-full px-3.5 py-2.5 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                {RATIOS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="proj-fps" className="block text-xs font-medium text-zinc-400 mb-1.5">
                Cadence d’images
              </label>
              <select
                id="proj-fps"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as 24 | 25 | 30)}
                className="w-full px-3.5 py-2.5 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value={24}>24 fps (Cinéma)</option>
                <option value={25}>25 fps (Broadcast Europe)</option>
                <option value={30}>30 fps (Numérique)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="proj-style" className="block text-xs font-medium text-zinc-400 mb-1.5">
              Direction artistique & style visuel
            </label>
            <input
              id="proj-style"
              type="text"
              value={visualStyle}
              onChange={(e) => setVisualStyle(e.target.value)}
              placeholder="Ex. : Anamorphique 35mm, lumière naturelle douce, tons froids..."
              className="w-full px-3.5 py-2.5 bg-[#090A0F] border border-white/10 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Créer le projet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
