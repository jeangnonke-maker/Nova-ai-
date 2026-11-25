import { useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Download,
  FileJson,
  Info,
  RefreshCw,
} from 'lucide-react';
import type {
  ConnectorId,
  FilmProject,
  PipelineStatusResponse,
  ProductionManifest,
} from '../types/film';
import { fetchApiJson } from '../utils/apiClient';
import { downloadTextFile, slugify } from '../utils/filmMetrics';
import { compileProductionManifestClient } from '../utils/manifestCompiler';

interface PipelineViewProps {
  project: FilmProject | null;
  pipelineStatus: PipelineStatusResponse | null;
  statusLoading: boolean;
  statusError: string | null;
  isStaticMode?: boolean;
  onRefreshStatus: () => void;
}

interface ConnectorTestFeedback {
  loading: boolean;
  ok: boolean | null;
  message: string | null;
  replyText?: string;
  latencyMs?: number;
}

export function PipelineView({
  project,
  pipelineStatus,
  statusLoading,
  statusError,
  isStaticMode = false,
  onRefreshStatus,
}: PipelineViewProps) {
  const [manifest, setManifest] = useState<ProductionManifest | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [geminiTest, setGeminiTest] = useState<ConnectorTestFeedback>({
    loading: false,
    ok: null,
    message: null,
  });

  const handleTestGemini = async () => {
    setGeminiTest({ loading: true, ok: null, message: null });
    const res = await fetchApiJson<{
      ok?: boolean;
      message?: string;
      replyText?: string;
      latencyMs?: number;
    }>('/api/connectors/gemini/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.isStaticHosting) {
      setGeminiTest({
        loading: false,
        ok: false,
        message:
          'Site hébergé en mode statique : ce test requiert le serveur Node.js avec GEMINI_API_KEY côté serveur.',
      });
      return;
    }

    setGeminiTest({
      loading: false,
      ok: Boolean(res.ok && res.data?.ok),
      message:
        res.data?.message ||
        res.errorMessage ||
        (res.ok
          ? 'Connexion AI Studio vérifiée avec succès.'
          : 'Clé AI Studio GEMINI_API_KEY requise côté serveur.'),
      replyText: res.data?.replyText,
      latencyMs: res.data?.latencyMs,
    });
  };

  const handleCompileManifest = async () => {
    if (!project) return;
    setCompiling(true);
    setCompileError(null);

    const res = await fetchApiJson<ProductionManifest>('/api/pipeline/compile-manifest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    });

    if (res.ok && res.data) {
      setManifest(res.data);
    } else if (res.isStaticHosting || res.status === 0) {
      setManifest(compileProductionManifestClient(project));
    } else {
      setCompileError(res.errorMessage || 'Erreur lors de la compilation.');
    }

    setCompiling(false);
  };

  const handleDownloadManifest = () => {
    if (!manifest || !project) return;
    downloadTextFile(
      `manifeste-${slugify(project.title)}.json`,
      JSON.stringify(manifest, null, 2),
      'application/json;charset=utf-8',
    );
  };

  const canTestCard = (id: ConnectorId) => id === 'gemini-text';

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      {/* Architecture Header */}
      <section className="border border-white/10 bg-[#11131C] rounded-xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="max-w-2xl min-w-0">
          <h2 className="text-lg font-semibold text-zinc-100">
            Architecture 100 % gratuite : AI Studio Gemini & FFmpeg
          </h2>
          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
            L’application utilise uniquement votre clé Gemini d’AI Studio côté serveur et le moteur local FFmpeg pour générer des images storyboard, des voix et un montage diaporama MP4 complet (transitions, texte et musique), sans Vertex AI ni compte de service.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshStatus}
          disabled={statusLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-zinc-100 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
          Vérifier l’état serveur
        </button>
      </section>

      {isStaticMode && (
        <div className="border border-sky-500/30 bg-sky-500/10 rounded-xl p-4 flex items-start gap-3 text-xs sm:text-sm text-sky-200">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold text-sky-100">Mode hébergement web statique actif</p>
            <p className="text-xs text-sky-200/90 mt-1 leading-relaxed">
              L’édition de scénario, le casting, le découpage en plans, l’import d’images locales et l’export (.fountain / manifeste JSON) fonctionnent entièrement dans votre navigateur. Les fonctions serveur (Gemini et encodage FFmpeg MP4) s’activent lorsque l’application tourne avec son serveur Node.js.
            </p>
          </div>
        </div>
      )}

      {statusError && (
        <div className="border border-rose-500/30 bg-rose-500/10 rounded-xl p-4 text-sm text-rose-300">
          Erreur de lecture du statut serveur : {statusError}
        </div>
      )}

      {/* 4 Modules Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {(pipelineStatus?.connectors ?? []).map((connector) => (
          <article
            key={connector.id}
            className="border border-white/10 bg-[#11131C] rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-5 min-w-0"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-white/10">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400">{connector.stage}</p>
                  <h3 className="text-base sm:text-lg font-semibold text-zinc-100 mt-0.5">
                    {connector.name}
                  </h3>
                  <p className="text-xs font-mono text-zinc-500 mt-1 break-words">
                    {connector.modelOrEngine} · {connector.provider}
                  </p>
                </div>

                {connector.configured ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    Prêt
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 shrink-0">
                    <AlertCircle className="w-4 h-4" />
                    Serveur requis
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="text-xs font-medium text-zinc-400 mb-2">
                    Fonctionnalités intégrées
                  </h4>
                  <ul className="space-y-1.5 text-sm text-zinc-200">
                    {connector.capabilities.map((cap) => (
                      <li key={cap} className="flex items-start gap-2">
                        <span className="text-amber-400 mt-1 text-xs">•</span>
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {canTestCard(connector.id) && !geminiTest.loading && geminiTest.message && (
                  <div
                    className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      geminiTest.ok
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    }`}
                  >
                    <p className="font-medium">{geminiTest.message}</p>
                    {geminiTest.replyText && (
                      <p className="font-mono text-[11px] text-zinc-100 bg-[#090A0F] px-2.5 py-1.5 rounded border border-white/10 break-words">
                        Réponse serveur : « {geminiTest.replyText} »
                        {typeof geminiTest.latencyMs === 'number' && (
                          <span className="text-emerald-400 ml-2 tabular-nums">
                            ({geminiTest.latencyMs} ms)
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-mono text-zinc-400 truncate max-w-full sm:max-w-[60%]">
                {connector.requirementLabel}
              </span>

              {canTestCard(connector.id) && (
                <button
                  type="button"
                  disabled={geminiTest.loading}
                  onClick={handleTestGemini}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-100 bg-white/10 hover:bg-white/15 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  {geminiTest.loading ? 'Test en cours...' : 'Tester la réponse Gemini'}
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* Production Manifest Compiler */}
      <section className="border border-white/10 bg-[#11131C] rounded-xl p-5 sm:p-6 space-y-5 min-w-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-zinc-100">
              Export du manifeste de diaporama
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {project
                ? `Compile la structure complète de "${project.title}" (images Gemini, voix Gemini TTS et script FFmpeg).`
                : 'Sélectionnez un projet pour compiler son manifeste.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCompileManifest}
              disabled={!project || compiling}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <FileJson className="w-3.5 h-3.5" />
              {compiling ? 'Compilation...' : 'Compiler le manifeste'}
            </button>
            {manifest && (
              <button
                type="button"
                onClick={handleDownloadManifest}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-100 bg-white/10 hover:bg-white/15 rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger JSON
              </button>
            )}
          </div>
        </div>

        {compileError && <p className="text-xs text-rose-400">{compileError}</p>}

        {manifest ? (
          <div className="space-y-4 min-w-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#090A0F] border border-white/10 rounded-lg text-xs">
              <div>
                <span className="text-zinc-500 block">Images Storyboard</span>
                <span className="font-mono text-base text-zinc-100 tabular-nums">
                  {manifest.geminiImageQueue.length}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Pistes Gemini TTS</span>
                <span className="font-mono text-base text-zinc-100 tabular-nums">
                  {manifest.geminiTtsQueue.length}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Segments FFmpeg</span>
                <span className="font-mono text-base text-zinc-100 tabular-nums">
                  {manifest.ffmpegSlideshow.timelineSegments.length}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Durée cible</span>
                <span className="font-mono text-base text-amber-400 tabular-nums">
                  {manifest.videoSpec.totalDurationSec} s
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-400 mb-2">
                Aperçu de commande FFmpeg pour le diaporama :
              </p>
              <pre className="p-4 bg-[#090A0F] border border-white/10 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto max-h-60 max-w-full">
                {manifest.ffmpegSlideshow.commandBlueprint}
              </pre>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-[#090A0F] border border-white/10 rounded-lg text-xs text-zinc-400">
            Cliquez sur « Compiler le manifeste » pour inspecter ou exporter la structure complète du projet.
          </div>
        )}
      </section>
    </div>
  );
}
