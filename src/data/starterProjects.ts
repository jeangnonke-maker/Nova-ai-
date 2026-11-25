import type { FilmProject } from '../types/film';

export const STARTER_PROJECTS: FilmProject[] = [
  {
    id: 'proj-meridien',
    title: 'Les Ombres de Méridien',
    logline:
      "Dans un Paris brutaliste balayé par la pluie, une archiviste sonore découvre un enregistrement magnétique capable d'effacer la mémoire collective.",
    genre: 'Thriller Néo-Noir',
    format: 'Court-métrage',
    aspectRatio: '2.39:1',
    fps: 24,
    status: 'Pré-production',
    visualStyle:
      'Cinématographie anamorphique 35mm, contrastes profonds, lumière sodium ambrée et bleus nocturnes désaturés, grain organique.',
    directorNotes:
      'Maintenir une continuité stricte sur le manteau anthracite d’Elena et le studio analogique de Marcus. Privilégier des plans fixes ou travellings lents.',
    coverImage: '/src/assets/images/cinema_project_meridien_1795610259688.jpg',
    createdAt: '2026-10-12T09:00:00.000Z',
    updatedAt: '2026-11-24T18:30:00.000Z',
    characters: [
      {
        id: 'char-elena',
        name: 'ELENA VANCE',
        role: 'Protagoniste',
        age: '34 ans',
        physicalDescription:
          'Silhouette élancée, cheveux bruns relevés en chignon lâche, regard incisif, cernes discrets de veille nocturne.',
        psychologicalArc:
          "Archiviste rigoureuse persuadée de préserver l'objectivité, contrainte de choisir entre la vérité et sa propre mémoire.",
        costumeVisualPrompt:
          'Femme française de 34 ans en manteau de laine sombre ajusté, pull noir, gouttes de pluie discrètes, lumière cinématographique naturelle',
        portraitUrl: '/src/assets/images/character_elena_portrait_1795610261163.jpg',
        voiceProfile: {
          provider: 'gemini-tts',
          voiceName: 'Kore',
          language: 'fr-FR',
          defaultEmotion: 'Calme concentré',
          styleNotes: 'Voix posée, diction précise, retenue dramatique',
        },
      },
      {
        id: 'char-marcus',
        name: 'MARCUS MOREAU',
        role: 'Antagoniste',
        age: '52 ans',
        physicalDescription:
          'Barbe poivre et sel soignée, col roulé anthracite, mains marquées par le montage sur bande magnétique.',
        psychologicalArc:
          'Ancien ingénieur du son convaincu que certains souvenirs doivent être détruits pour préserver la paix sociale.',
        costumeVisualPrompt:
          'Homme français de 52 ans à barbe poivre et sel, col roulé anthracite, casque studio autour du cou, clair-obscur ambré',
        portraitUrl: '/src/assets/images/character_marcus_portrait_1795610261113.jpg',
        voiceProfile: {
          provider: 'gemini-tts',
          voiceName: 'Charon',
          language: 'fr-FR',
          defaultEmotion: 'Autorité contenue',
          styleNotes: 'Voix grave, grain chaleureux, rythme lent',
        },
      },
    ],
    scenes: [
      {
        id: 'scene-meridien-1',
        number: 1,
        heading: {
          intExt: 'EXT.',
          location: 'RUE DU MÉRIDIEN - PAVÉS',
          timeOfDay: 'NUIT',
        },
        synopsis:
          "Elena traverse l'avenue déserte sous la pluie nocturne, serrant une bobine magnétique scellée contre son manteau.",
        mood: 'Suspense atmosphérique, solitude urbaine',
        status: 'Validée',
        blocks: [
          {
            id: 'blk-m1-1',
            type: 'action',
            content:
              'La pluie bat les pavés sombres. Les réverbères au sodium tracent de longs reflets ambrés entre les façades de béton brutaliste.',
          },
          {
            id: 'blk-m1-2',
            type: 'action',
            content:
              "ELENA VANCE (34 ans) avance d'un pas rapide, le col de son manteau relevé. Elle vérifie brièvement la boîte métallique dans sa main gauche.",
          },
          {
            id: 'blk-m1-3',
            type: 'character',
            characterId: 'char-elena',
            characterName: 'ELENA VANCE',
            content: 'ELENA VANCE',
          },
          {
            id: 'blk-m1-4',
            type: 'parenthetical',
            content: '(à voix basse, dictant dans son magnétophone)',
          },
          {
            id: 'blk-m1-5',
            type: 'dialogue',
            characterId: 'char-elena',
            characterName: 'ELENA VANCE',
            voiceEmotion: 'Murmure tendu',
            content:
              "Bande quarante-deux récupérée à 23 h 14. Si Marcus a déjà effacé le master, c'est le dernier témoin acoustique.",
          },
          {
            id: 'blk-m1-6',
            type: 'transition',
            content: 'COUPE FRANCHE :',
          },
        ],
        shots: [
          {
            id: 'shot-m1-1',
            number: 1,
            shotSize: 'Plan large',
            cameraMovement: 'Travelling avant',
            lens: '35mm Anamorphique',
            durationSec: 5,
            description:
              'Vue en perspective sur la rue pavée mouillée par la pluie, silhouette d’Elena s’éloignant vers la lumière ambrée du dernier réverbère.',
            lightingNotes: 'Contre-jour sodium chaud, remplissage bleu nuit froid.',
            imagePrompt:
              'Cinematic 35mm anamorphic wide shot of rain-slicked brutalist Parisian cobblestone street at night, warm amber streetlamps, lone woman in dark wool coat walking away, wet reflections, neo-noir film still',
            generatedImageUrl: '/src/assets/images/cinema_project_meridien_1795610259688.jpg',
            subtitleText: 'Rue du Méridien — 23 h 14. Dernière bande magnétique.',
            dialogueBlockIds: [],
          },
          {
            id: 'shot-m1-2',
            number: 2,
            shotSize: 'Plan rapproché',
            cameraMovement: 'Steadicam',
            lens: '50mm',
            durationSec: 5,
            description:
              'Elena porte son dictaphone près des lèvres tout en jetant un regard inquiet par-dessus son épaule.',
            lightingNotes: 'Éclairage latéral doux reflété par la vitrine humide.',
            imagePrompt:
              'Medium close-up film still of 34yo French woman archivist in dark wool coat in light night rain, moody amber side light, 50mm shallow depth of field',
            generatedImageUrl: '/src/assets/images/character_elena_portrait_1795610261163.jpg',
            subtitleText:
              "« Si Marcus a déjà effacé le master, c'est le dernier témoin acoustique. »",
            dialogueBlockIds: ['blk-m1-5'],
          },
        ],
      },
      {
        id: 'scene-meridien-2',
        number: 2,
        heading: {
          intExt: 'INT.',
          location: 'STUDIO DE MONTAGE ANALOGIQUE',
          timeOfDay: 'NUIT',
        },
        synopsis:
          'Confrontation feutrée entre Elena et Marcus devant les magnétophones à bandes tournant au ralenti.',
        mood: 'Tension psychologique, précision technique',
        status: 'Découpée',
        blocks: [
          {
            id: 'blk-m2-1',
            type: 'action',
            content:
              'Une console de mixage éclaire la pénombre de ses VU-mètres orangés. MARCUS MOREAU (52 ans) écoute au casque, immobile devant un magnétophone Studer.',
          },
          {
            id: 'blk-m2-2',
            type: 'character',
            characterId: 'char-marcus',
            characterName: 'MARCUS MOREAU',
            content: 'MARCUS MOREAU',
          },
          {
            id: 'blk-m2-3',
            type: 'dialogue',
            characterId: 'char-marcus',
            characterName: 'MARCUS MOREAU',
            voiceEmotion: 'Posé, grave',
            content:
              "Tu es arrivée dix minutes trop tard, Elena. Ou dix minutes trop tôt, selon ce que tu comptes faire de cette bande.",
          },
          {
            id: 'blk-m2-4',
            type: 'character',
            characterId: 'char-elena',
            characterName: 'ELENA VANCE',
            content: 'ELENA VANCE',
          },
          {
            id: 'blk-m2-5',
            type: 'dialogue',
            characterId: 'char-elena',
            characterName: 'ELENA VANCE',
            voiceEmotion: 'Déterminée',
            content:
              "Personne ne t'a donné le droit de réécrire l'archive. Mets-la sur la platine.",
          },
        ],
        shots: [
          {
            id: 'shot-m2-1',
            number: 1,
            shotSize: 'Plan moyen',
            cameraMovement: 'Panoramique',
            lens: '40mm Anamorphique',
            durationSec: 5,
            description:
              'Marcus devant le rack analogique et les VU-mètres lumineux, abaissant son casque audio lorsque la porte s’ouvre.',
            lightingNotes: 'Lueur chaude des consoles + rim light ambré.',
            imagePrompt:
              'Medium cinematic still inside dark analog mastering studio, 52yo French sound engineer with salt-and-pepper beard lowering headphones, glowing amber rim light',
            generatedImageUrl: '/src/assets/images/character_marcus_portrait_1795610261113.jpg',
            subtitleText:
              '« Tu es arrivée dix minutes trop tard, Elena. »',
            dialogueBlockIds: ['blk-m2-3'],
          },
        ],
      },
    ],
  },
  {
    id: 'proj-horloger',
    title: "L'Horloger de Lyon",
    logline:
      "En 1943, un maître horloger lyonnais dissimule des messages codés au cœur de mécanismes d'horloges destinés au réseau de résistance.",
    genre: 'Drame Historique',
    format: 'Long-métrage',
    aspectRatio: '1.85:1',
    fps: 24,
    status: 'Développement',
    visualStyle:
      'Lumière naturelle directionnelle façon Clair-obscur flamand, teintes chaudes de laiton et chêne patiné, objectifs vintage.',
    directorNotes:
      'Mettre en valeur la précision tactile des engrenages et le silence tendu de l’atelier face aux bruits de la rue.',
    coverImage: '/src/assets/images/cinema_project_horloger_1795610260090.jpg',
    createdAt: '2026-09-04T11:15:00.000Z',
    updatedAt: '2026-11-20T14:10:00.000Z',
    characters: [
      {
        id: 'char-henri',
        name: 'HENRI DELACROIX',
        role: 'Protagoniste',
        age: '68 ans',
        physicalDescription:
          'Cheveux blancs peignés en arrière, loupe d’horloger sur lunettes fines, tablier de cuir usé par quarante ans de métier.',
        psychologicalArc:
          'Artisan discret qui refuse l’héroïsme spectaculaire mais accomplit chaque jour un geste décisif.',
        costumeVisualPrompt:
          'Maître horloger français de 68 ans à cheveux blancs, loupe sur lunettes, tablier de cuir brun usé, lumière dorée d’atelier',
        voiceProfile: {
          provider: 'gemini-tts',
          voiceName: 'Fenrir',
          language: 'fr-FR',
          defaultEmotion: 'Sagesse calme',
          styleNotes: 'Voix douce, posée, patine chaleureuse',
        },
      },
    ],
    scenes: [
      {
        id: 'scene-horloger-1',
        number: 1,
        heading: {
          intExt: 'INT.',
          location: 'ATELIER DE LA RUE SAINT-JEAN',
          timeOfDay: 'JOUR',
        },
        synopsis:
          'Henri ajuste un échappement en laiton dans la poussière dorée du matin avant l’arrivée d’un coursier.',
        mood: 'Recueillement artisanal, tension sous-jacente',
        status: 'Découpée',
        blocks: [
          {
            id: 'blk-h1-1',
            type: 'action',
            content:
              'Un rayon de soleil oblique traverse les hautes fenêtres cintrées et révèle des poussières flottant au-dessus de l’établi en chêne.',
          },
          {
            id: 'blk-h1-2',
            type: 'character',
            characterId: 'char-henri',
            characterName: 'HENRI DELACROIX',
            content: 'HENRI DELACROIX',
          },
          {
            id: 'blk-h1-3',
            type: 'dialogue',
            characterId: 'char-henri',
            characterName: 'HENRI DELACROIX',
            voiceEmotion: 'Calme, concentré',
            content:
              'Chaque seconde de retard coûte un train. Il faut que le balancier tienne jusqu’à Grenoble.',
          },
        ],
        shots: [
          {
            id: 'shot-h1-1',
            number: 1,
            shotSize: 'Plan moyen',
            cameraMovement: 'Travelling latéral',
            lens: '35mm',
            durationSec: 5,
            description:
              'Travelling lent longeant l’établi couvert d’engrenages en laiton jusqu’à Henri penché sur son ouvrage.',
            lightingNotes: 'Soleil matinal naturel à travers vitrage ancien, contraste doux.',
            imagePrompt:
              'Cinematic film still inside old watchmaker workshop in Lyon, sunlit dust motes from tall arched windows, antique brass clockwork gears on oak workbench, 68yo craftsman',
            generatedImageUrl: '/src/assets/images/cinema_project_horloger_1795610260090.jpg',
            subtitleText:
              '« Chaque seconde de retard coûte un train. »',
            dialogueBlockIds: ['blk-h1-3'],
          },
        ],
      },
    ],
  },
];
