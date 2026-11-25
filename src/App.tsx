import { useState, type ComponentType } from 'react';
import {
  Clapperboard,
  Cpu,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Users,
} from 'lucide-react';
import { CharactersView } from './components/CharactersView';
import { DashboardView, type StudioTab } from './components/DashboardView';
import { NewProjectModal } from './components/NewProjectModal';
import { PipelineView } from './components/PipelineView';
import { ProjectLibraryView } from './components/ProjectLibraryView';
import { ScenePrepView } from './components/ScenePrepView';
import { ScreenplayEditorView } from './components/ScreenplayEditorView';
import { useFilmStudio } from './hooks/useFilmStudio';

interface NavItem {
  id: StudioTab;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', shortLabel: 'Tableau', icon: LayoutDashboard },
  { id: 'projects', label: 'Bibliothèque', shortLabel: 'Projets', icon: FolderKanban },
  { id: 'screenplay', label: 'Scénario', shortLabel: 'Scénario', icon: FileText },
  { id: 'characters', label: 'Personnages', shortLabel: 'Casting', icon: Users },
  { id: 'scene-prep', label: 'Préparation scènes', shortLabel: 'Scènes', icon: Clapperboard },
  { id: 'pipeline', label: 'Connecteurs API', shortLabel: 'Pipeline', icon: Cpu },
];

export default function App() {
  const {
    projects,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    updateProject,
    createProject,
    duplicateProject,
    deleteProject,
    pipelineStatus,
    statusLoading,
    statusError,
    refreshPipelineStatus,
  } = useFilmStudio();

  const [activeTab, setActiveTab] = useState<StudioTab>('dashboard');
  const [focusedSceneId, setFocusedSceneId] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const handleNavigate = (tab: StudioTab, sceneId?: string) => {
    if (sceneId) setFocusedSceneId(sceneId);
    setActiveTab(tab);
  };

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 flex flex-col lg:flex-row">
      {/* Desktop Studio Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-white/10 bg-[#0D0F17] z-30">
        <div className="h-16 px-6 flex items-center border-b border-white/10">
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
            NOVA AI FILM
          </span>
        </div>

        <div className="p-4 border-b border-white/10">
          <label
            htmlFor="desktop-project-switch"
            className="block text-[11px] font-medium text-zinc-400 mb-1.5"
          >
            Projet actif
          </label>
          <select
            id="desktop-project-switch"
            value={activeProject?.id || ''}
            onChange={(e) => {
              setActiveProjectId(e.target.value);
              setFocusedSceneId(null);
            }}
            className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-lg text-xs font-medium text-zinc-100 focus:outline-none focus:border-amber-500 truncate"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 text-xs text-zinc-500">
          <p className="text-zinc-400 font-medium">Mode AI Studio & FFmpeg</p>
          <p className="mt-0.5 leading-relaxed">
            100 % gratuit via Gemini AI Studio et montage diaporama MP4 local.
          </p>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-16 lg:pb-0">
        {/* Top Bar (Strict 3-zone / Breadcrumb + Single Primary CTA) */}
        <header className="sticky top-0 z-20 h-14 lg:h-16 bg-[#090A0F]/95 backdrop-blur-xs border-b border-white/10 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden font-display text-sm font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              NOVA AI FILM
            </span>
            <span className="lg:hidden text-zinc-600" aria-hidden="true">/</span>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="hidden lg:inline text-zinc-400 truncate max-w-[200px]">
                {activeProject ? activeProject.title : 'Studio'}
              </span>
              <span className="hidden lg:inline text-zinc-600" aria-hidden="true">/</span>
              <h1 className="font-semibold text-zinc-100 truncate">
                {activeNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setNewProjectOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau projet</span>
            </button>
          </div>
        </header>

        {/* Mobile Project Selector Strip */}
        <div className="lg:hidden px-4 py-2.5 border-b border-white/10 bg-[#0D0F17] flex items-center justify-between gap-3">
          <label htmlFor="mobile-project-switch" className="text-xs text-zinc-400 shrink-0">
            Film :
          </label>
          <select
            id="mobile-project-switch"
            value={activeProject?.id || ''}
            onChange={(e) => {
              setActiveProjectId(e.target.value);
              setFocusedSceneId(null);
            }}
            className="flex-1 min-w-0 px-2.5 py-1.5 bg-[#090A0F] border border-white/10 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        {/* Active View Canvas */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              project={activeProject}
              allProjectsCount={projects.length}
              pipelineStatus={pipelineStatus}
              statusLoading={statusLoading}
              onNavigate={handleNavigate}
              onOpenNewProject={() => setNewProjectOpen(true)}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectLibraryView
              projects={projects}
              activeProjectId={activeProjectId}
              onSelectProject={(id) => {
                setActiveProjectId(id);
                setFocusedSceneId(null);
                setActiveTab('dashboard');
              }}
              onDuplicateProject={duplicateProject}
              onDeleteProject={deleteProject}
              onOpenNewProject={() => setNewProjectOpen(true)}
            />
          )}

          {(activeTab === 'screenplay' ||
            activeTab === 'characters' ||
            activeTab === 'scene-prep') &&
            !activeProject && (
              <div className="border border-white/10 bg-[#11131C] rounded-xl p-10 text-center max-w-lg mx-auto mt-8">
                <p className="text-sm text-zinc-400 mb-4">
                  Aucun projet actif sélectionné. Créez un projet ou sélectionnez-en un dans la bibliothèque.
                </p>
                <button
                  type="button"
                  onClick={() => setNewProjectOpen(true)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors"
                >
                  Nouveau projet
                </button>
              </div>
            )}

          {activeTab === 'screenplay' && activeProject && (
            <ScreenplayEditorView
              project={activeProject}
              initialSceneId={focusedSceneId}
              onUpdateProject={(updater) => updateProject(activeProject.id, updater)}
              onOpenScenePrep={(sceneId) => handleNavigate('scene-prep', sceneId)}
            />
          )}

          {activeTab === 'characters' && activeProject && (
            <CharactersView
              project={activeProject}
              onUpdateProject={(updater) => updateProject(activeProject.id, updater)}
            />
          )}

          {activeTab === 'scene-prep' && activeProject && (
            <ScenePrepView
              project={activeProject}
              initialSceneId={focusedSceneId}
              onUpdateProject={(updater) => updateProject(activeProject.id, updater)}
            />
          )}

          {activeTab === 'pipeline' && (
            <PipelineView
              project={activeProject}
              pipelineStatus={pipelineStatus}
              statusLoading={statusLoading}
              statusError={statusError}
              onRefreshStatus={refreshPipelineStatus}
            />
          )}
        </main>

        {/* Quiet Studio Attribution Footer */}
        <footer className="px-4 sm:px-6 lg:px-8 py-4 border-t border-white/10 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-2 max-w-[1440px] w-full mx-auto">
          <span>NOVA AI FILM</span>
          <span>Créé par Gnonke Kacou Aude Jean</span>
        </footer>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-[#0D0F17]/95 backdrop-blur-xs border-t border-white/10 z-30 grid grid-cols-6"
        aria-label="Navigation mobile"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors px-1 ${
                active ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      <NewProjectModal
        isOpen={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreate={(proj) => {
          createProject(proj);
          setActiveTab('screenplay');
        }}
      />
    </div>
  );
}
