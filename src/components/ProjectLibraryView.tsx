import { useMemo, useState } from 'react';
import { Copy, Download, FolderOpen, Plus, Search, Trash2 } from 'lucide-react';
import type { FilmProject, ProjectStatus } from '../types/film';
import { computeProjectStats, downloadTextFile, formatDuration, slugify } from '../utils/filmMetrics';
import { CinemaImage } from './CinemaImage';

interface ProjectLibraryViewProps {
  projects: FilmProject[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenNewProject: () => void;
}

const STATUS_FILTERS: Array<'Tous' | ProjectStatus> = [
  'Tous',
  'Développement',
  'Pré-production',
  'Prêt pour rendu',
];

export function ProjectLibraryView({
  projects,
  activeProjectId,
  onSelectProject,
  onDuplicateProject,
  onDeleteProject,
  onOpenNewProject,
}: ProjectLibraryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Tous' | ProjectStatus>('Tous');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      const matchesStatus = statusFilter === 'Tous' || p.status === statusFilter;
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.genre.toLowerCase().includes(q) ||
        p.logline.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [projects, searchQuery, statusFilter]);

  const handleExportJson = (project: FilmProject) => {
    downloadTextFile(
      `${slugify(project.title)}.nova-project.json`,
      JSON.stringify(project, null, 2),
      'application/json;charset=utf-8',
    );
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un film, genre ou synopsis..."
            aria-label="Rechercher un projet"
            className="w-full pl-10 pr-4 py-2.5 bg-[#11131C] border border-white/10 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-1 p-1 bg-[#11131C] border border-white/10 rounded-lg overflow-x-auto max-w-full"
            role="tablist"
            aria-label="Filtrer par statut"
          >
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={statusFilter === status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === status
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenNewProject}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nouveau film
          </button>
        </div>
      </div>

      {/* Library Grid */}
      {filteredProjects.length === 0 ? (
        <div className="border border-white/10 bg-[#11131C] rounded-xl p-10 text-center">
          <p className="text-sm text-zinc-400 mb-4">
            Aucun projet ne correspond à votre recherche ou au filtre sélectionné.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('Tous');
            }}
            className="px-4 py-2 text-xs font-medium text-zinc-200 bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((proj) => {
            const stats = computeProjectStats(proj);
            const isActive = proj.id === activeProjectId;

            return (
              <article
                key={proj.id}
                className={`border rounded-xl overflow-hidden bg-[#11131C] flex flex-col justify-between transition-colors ${
                  isActive ? 'border-amber-500/60' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div>
                  <div className="aspect-video relative bg-[#090A0F] overflow-hidden border-b border-white/10">
                    <CinemaImage
                      src={proj.coverImage}
                      alt={`Aperçu du projet ${proj.title}`}
                      fallbackTitle={proj.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-zinc-200">
                      <span className="font-mono tabular-nums">
                        {proj.aspectRatio} · {proj.fps} fps
                      </span>
                      {isActive && (
                        <span className="text-amber-400 font-semibold">Projet actif</span>
                      )}
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1.5">
                      <span>{proj.format}</span>
                      <span aria-hidden="true">·</span>
                      <span>{proj.genre}</span>
                      <span aria-hidden="true">·</span>
                      <span>{proj.status}</span>
                    </div>

                    <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                      {proj.title}
                    </h3>
                    <p className="text-sm text-zinc-400 line-clamp-2 leading-relaxed">
                      {proj.logline}
                    </p>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/10 text-xs">
                      <div>
                        <span className="text-zinc-500 block">Scènes</span>
                        <span className="font-mono text-zinc-200 tabular-nums">
                          {stats.sceneCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Plans</span>
                        <span className="font-mono text-zinc-200 tabular-nums">
                          {stats.shotCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Durée est.</span>
                        <span className="font-mono text-zinc-200 tabular-nums">
                          {formatDuration(stats.estimatedDurationSec)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-white/10 bg-[#0D0F17] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectProject(proj.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-white/10 text-zinc-100 hover:bg-white/15'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    {isActive ? 'Ouvrir dans le studio' : 'Sélectionner'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDuplicateProject(proj.id)}
                      title="Dupliquer le projet"
                      aria-label={`Dupliquer ${proj.title}`}
                      className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportJson(proj)}
                      title="Exporter en JSON"
                      aria-label={`Exporter ${proj.title}`}
                      className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {confirmDeleteId === proj.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteProject(proj.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Confirmer
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(proj.id)}
                        title="Supprimer le projet"
                        aria-label={`Supprimer ${proj.title}`}
                        className="p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
