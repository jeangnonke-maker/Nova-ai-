import { useCallback, useEffect, useState } from 'react';
import { STARTER_PROJECTS } from '../data/starterProjects';
import type { FilmProject, PipelineStatusResponse } from '../types/film';
import { fetchApiJson } from '../utils/apiClient';

const STORAGE_KEY_PROJECTS = 'nova_ai_film_projects_v1';
const STORAGE_KEY_ACTIVE_ID = 'nova_ai_film_active_id_v1';

function buildStaticHostingStatus(): PipelineStatusResponse {
  return {
    checkedAt: new Date().toISOString(),
    connectors: [
      {
        id: 'gemini-text',
        name: 'Google Gemini (Scénario)',
        provider: 'Google AI Studio',
        stage: 'Analyse & Écriture',
        configured: false,
        requirementLabel: 'Serveur Node.js requis (mode statique actif)',
        modelOrEngine: 'gemini-4-hydrogen',
        endpointPath: '/api/connectors/gemini/test',
        capabilities: [
          'Rédaction complète et export .fountain 100 % actifs dans le navigateur',
          'Analyse dramaturgique IA disponible avec le serveur Node.js',
        ],
        blockedFeatures: ['Analyse IA côté serveur'],
      },
      {
        id: 'gemini-image',
        name: 'Gemini Images (Storyboard)',
        provider: 'Google AI Studio',
        stage: 'Série d’images par plan',
        configured: false,
        requirementLabel: 'Import d’images locales actif · Gemini requiert serveur Node.js',
        modelOrEngine: 'gemini-3.1-flash-lite-image',
        endpointPath: '/api/connectors/gemini/generate-shot-image',
        capabilities: [
          'Import et recadrage d’images locales fonctionnels dans le navigateur',
          'Génération IA par plan active avec le backend AI Studio',
        ],
        blockedFeatures: ['Génération IA par plan'],
      },
      {
        id: 'gemini-tts',
        name: 'Gemini Voix (Dialogues)',
        provider: 'Google AI Studio',
        stage: 'Synthèse vocale gratuite',
        configured: false,
        requirementLabel: 'Serveur Node.js requis (mode statique actif)',
        modelOrEngine: 'gemini-3.8-flash-lite-tts',
        endpointPath: '/api/connectors/gemini/generate-dialogue-audio',
        capabilities: [
          'Préparation et annotation des répliques disponibles hors ligne',
          'Synthèse vocale WAV active avec le backend Node.js',
        ],
        blockedFeatures: ['Synthèse vocale serveur'],
      },
      {
        id: 'ffmpeg',
        name: 'FFmpeg Diaporama MP4',
        provider: 'Moteur média serveur',
        stage: 'Transitions, Texte & Musique',
        configured: false,
        requirementLabel: 'Binaire serveur requis · Manifeste JSON prêt dans le navigateur',
        modelOrEngine: 'libx264 · xfade · drawtext · aac',
        endpointPath: '/api/slideshow/render',
        capabilities: [
          'Compilation et téléchargement du manifeste FFmpeg 100 % actifs',
          'Encodage MP4 automatique actif avec le serveur Node.js + FFmpeg',
        ],
        blockedFeatures: ['Encodage MP4 serveur'],
      },
    ],
  };
}

function migrateProjectShape(raw: FilmProject): FilmProject {
  return {
    ...raw,
    characters: (raw.characters || []).map((c) => {
      const legacyVoice = c.voiceProfile as unknown as {
        voiceName?: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
        timbre?: string;
        language?: string;
        defaultEmotion?: string;
        styleNotes?: string;
      };
      return {
        ...c,
        voiceProfile: {
          provider: 'gemini-tts',
          voiceName: legacyVoice?.voiceName || 'Kore',
          language: legacyVoice?.language || 'fr-FR',
          defaultEmotion: legacyVoice?.defaultEmotion || 'Neutre',
          styleNotes: legacyVoice?.styleNotes || legacyVoice?.timbre || 'Voix posée',
        },
      };
    }),
    scenes: (raw.scenes || []).map((s) => ({
      ...s,
      shots: (s.shots || []).map((sh) => {
        const legacyShot = sh as unknown as { veoPrompt?: string; imagePrompt?: string };
        return {
          ...sh,
          imagePrompt: legacyShot.imagePrompt ?? legacyShot.veoPrompt ?? '',
        };
      }),
    })),
  };
}

function loadInitialProjects(): FilmProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (!raw) return STARTER_PROJECTS;
    const parsed = JSON.parse(raw) as FilmProject[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(migrateProjectShape);
    }
  } catch {
    // Fallback to starter projects
  }
  return STARTER_PROJECTS;
}

export function useFilmStudio() {
  const [projects, setProjects] = useState<FilmProject[]>(loadInitialProjects);
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
      if (savedId) return savedId;
    } catch {
      // ignore
    }
    return STARTER_PROJECTS[0].id;
  });

  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isStaticMode, setIsStaticMode] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    } catch {
      // ignore quota errors
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeProjectId);
    } catch {
      // ignore
    }
  }, [activeProjectId]);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null;

  const refreshPipelineStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    const res = await fetchApiJson<PipelineStatusResponse>('/api/pipeline/status');
    if (res.ok && res.data) {
      setIsStaticMode(false);
      setPipelineStatus(res.data);
    } else if (res.isStaticHosting) {
      setIsStaticMode(true);
      setPipelineStatus(buildStaticHostingStatus());
    } else {
      setIsStaticMode(false);
      setStatusError(res.errorMessage || 'Impossible de joindre le serveur studio.');
    }
    setStatusLoading(false);
  }, []);

  useEffect(() => {
    refreshPipelineStatus();
  }, [refreshPipelineStatus]);

  const updateProject = useCallback(
    (projectId: string, updater: (prev: FilmProject) => FilmProject) => {
      setProjects((prevList) =>
        prevList.map((proj) =>
          proj.id === projectId
            ? { ...updater(proj), updatedAt: new Date().toISOString() }
            : proj,
        ),
      );
    },
    [],
  );

  const createProject = useCallback((newProject: FilmProject) => {
    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
  }, []);

  const duplicateProject = useCallback((projectId: string) => {
    setProjects((prev) => {
      const target = prev.find((p) => p.id === projectId);
      if (!target) return prev;
      const now = new Date().toISOString();
      const copy: FilmProject = {
        ...JSON.parse(JSON.stringify(target)),
        id: `proj-${Date.now()}`,
        title: `${target.title} (Copie)`,
        createdAt: now,
        updatedAt: now,
      };
      setActiveProjectId(copy.id);
      return [copy, ...prev];
    });
  }, []);

  const deleteProject = useCallback(
    (projectId: string) => {
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== projectId);
        if (activeProjectId === projectId) {
          setActiveProjectId(next[0]?.id ?? '');
        }
        return next;
      });
    },
    [activeProjectId],
  );

  return {
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
    isStaticMode,
    refreshPipelineStatus,
  };
}
