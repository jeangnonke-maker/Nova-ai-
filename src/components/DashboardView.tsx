import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  FileText,
  Film,
  Users,
} from 'lucide-react';
import type { FilmProject, PipelineStatusResponse } from '../types/film';
import {
  computeProjectStats,
  computeSceneDurationSec,
  formatDuration,
  formatSceneHeading,
} from '../utils/filmMetrics';
import { CinemaImage } from './CinemaImage';

export type StudioTab =
  | 'dashboard'
  | 'projects'
  | 'screenplay'
  | 'characters'
  | 'scene-prep'
  | 'pipeline';

interface DashboardViewProps {
  project: FilmProject | null;
  allProjectsCount: number;
  pipelineStatus: PipelineStatusResponse | null;
  statusLoading: boolean;
  onNavigate: (tab: StudioTab, sceneId?: string) => void;
  onOpenNewProject: () => void;
}

export function DashboardView({
  project,
  allProjectsCount,
  pipelineStatus,
  statusLoading,
  onNavigate,
  onOpenNewProject,
}: DashboardViewProps) {
  if (!project) {
    return (
      <div className="border border-white/10 bg-[#11131C] rounded-xl p-10 text-center max-w-2xl mx-auto mt-10">
        <Film className="w-10 h-10 text-zinc-500 mx-auto mb-3" strokeWidth={1.5} />
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">
          Aucun projet de film actif
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Créez un premier projet pour commencer l’écriture du scénario, le casting de vos personnages et le découpage technique.
        </p>
        <button
          type="button"
          onClick={onOpenNewProject}
          className="px-4 py-2.5 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors"
        >
          Créer un projet
        </button>
      </div>
    );
  }

  const stats = computeProjectStats(project);

  return (
    <div className="space-y-8">
      {/* Active Project Spotlight */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 relative rounded-xl overflow-hidden border border-white/10 bg-[#11131C] min-h-[260px] lg:min-h-[320px]">
          <CinemaImage
            src={project.coverImage}
            alt={`Photogramme de référence pour ${project.title}`}
            fallbackTitle={project.title}
            className="w-full h-full object-cover absolute inset-0"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090A0F] via-[#090A0F]/65 to-transparent" />
          <div className="relative z-10 h-full flex flex-col justify-end p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300 mb-2">
              <span>{project.format}</span>
              <span aria-hidden="true">·</span>
              <span>{project.genre}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{project.aspectRatio}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{project.fps} fps</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-medium">{project.status}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance mb-2">
              {project.title}
            </h2>
            <p className="text-sm text-zinc-300 max-w-2xl leading-relaxed mb-5">
              {project.logline}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('screenplay')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <FileText className="w-4 h-4" />
                Ouvrir le scénario
              </button>
              <button
                type="button"
                onClick={() => onNavigate('scene-prep')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-100 bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Clapperboard className="w-4 h-4" />
                Préparer les scènes
              </button>
            </div>
          </div>
        </div>

        {/* Studio Summary & Direction Notes */}
        <div className="lg:col-span-5 border border-white/10 bg-[#11131C] rounded-xl p-6 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <h3 className="text-sm font-semibold text-zinc-100">
                Direction artistique & Réalisation
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('projects')}
                className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                {allProjectsCount} projets en bibliothèque
              </button>
            </div>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs text-zinc-400 mb-1">Style visuel (Storyboard Gemini)</dt>
                <dd className="text-zinc-200 leading-relaxed">
                  {project.visualStyle || 'Non défini'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400 mb-1">Notes de réalisation</dt>
                <dd className="text-zinc-300 leading-relaxed">
                  {project.directorNotes ||
                    'Aucune note ajoutée. Complétez vos directives dans la préparation des scènes.'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-400">
              <span>Dernière mise à jour : </span>
              <span className="text-zinc-200 tabular-nums">
                {new Date(project.updatedAt).toLocaleDateString('fr-FR')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('characters')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200 hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              Gérer les personnages
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 4-column KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border border-white/10 bg-[#11131C] rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-white/10">
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Scènes écrites</p>
          <p className="text-2xl font-semibold text-zinc-100 font-mono tabular-nums">
            {stats.sceneCount}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            {stats.validatedSceneCount} validées
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Plans découpés</p>
          <p className="text-2xl font-semibold text-zinc-100 font-mono tabular-nums">
            {stats.shotCount}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Storyboard & Diaporama MP4
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Répliques & Personnages</p>
          <p className="text-2xl font-semibold text-zinc-100 font-mono tabular-nums">
            {stats.dialogueCount}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            {stats.characterCount} personnages actifs
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-400 mb-1">Durée estimée</p>
          <p className="text-2xl font-semibold text-amber-400 font-mono tabular-nums">
            {formatDuration(stats.estimatedDurationSec)}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            {stats.wordCount} mots au scénario
          </p>
        </div>
      </section>

      {/* Two-Column Breakdown: Scene Table + API Connectors Status */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Scene Table */}
        <div className="xl:col-span-7 border border-white/10 bg-[#11131C] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Découpage du projet actif
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Cliquez sur une scène pour accéder à son écriture ou à sa préparation technique.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('scene-prep')}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Tout préparer
            </button>
          </div>

          {project.scenes.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-zinc-400 mb-4">
                Aucune scène enregistrée dans ce projet.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('screenplay')}
                className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 rounded-lg"
              >
                Ajouter la première scène
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-zinc-400">
                    <th className="py-3 px-4 font-medium">Scène</th>
                    <th className="py-3 px-4 font-medium">Statut</th>
                    <th className="py-3 px-4 font-medium text-right">Plans</th>
                    <th className="py-3 px-4 font-medium text-right">Durée</th>
                    <th className="py-3 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {project.scenes.map((scene) => (
                    <tr key={scene.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-100">
                          <span className="font-mono text-xs text-amber-400 mr-2 tabular-nums">
                            {String(scene.number).padStart(2, '0')}
                          </span>
                          {formatSceneHeading(scene)}
                        </div>
                        <p className="text-xs text-zinc-400 truncate max-w-md mt-0.5">
                          {scene.synopsis}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-zinc-300 whitespace-nowrap">
                        {scene.status}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-zinc-300 tabular-nums">
                        {scene.shots.length}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-zinc-300 tabular-nums">
                        {formatDuration(computeSceneDurationSec(scene))}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onNavigate('scene-prep', scene.id)}
                          className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          Préparer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pipeline Connectors Summary */}
        <div className="xl:col-span-5 border border-white/10 bg-[#11131C] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Pipeline Diaporama IA & FFmpeg
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Clé Gemini AI Studio + assemblage vidéo diaporama MP4 local gratuit.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('pipeline')}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </button>
          </div>

          <div className="divide-y divide-white/5">
            {statusLoading && !pipelineStatus ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              (pipelineStatus?.connectors ?? []).map((connector) => (
                <div
                  key={connector.id}
                  className="px-6 py-4 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-100">
                        {connector.name}
                      </span>
                      <span className="text-xs text-zinc-500">·</span>
                      <span className="text-xs text-zinc-400 truncate">
                        {connector.stage}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {connector.requirementLabel}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 text-xs font-medium">
                    {connector.configured ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Prêt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        API requise
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
