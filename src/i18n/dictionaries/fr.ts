import type { Dictionary } from "./en";

/** French copy. Must match the English structure exactly (checked by the type system). */
export const fr: Dictionary = {
  meta: {
    title: "VVake : la Bourse se réveille, nous on bouge",
    description:
      "VVake (dites « wake ») est le jeu fitness gratuit où ta ville, ton équipe et ton squad bougent ensemble. Le cœur avant la hype. Une équipe à livre ouvert. Débloque ta ville.",
    ogAlt: "VVake : deux V font un W. La Bourse se réveille, nous on bouge.",
  },
  nav: {
    story: "L'histoire",
    how: "Comment ça marche",
    rivalries: "Rivalités",
    openBook: "Livre ouvert",
    vvaker: "Ton VVaker",
    faq: "FAQ",
    join: "Débloque ta ville",
    skip: "Aller au contenu",
    language: "Langue",
  },
  hero: {
    pronounce: "Ça se dit « wake »",
    prefix: "VVake up",
    anthem: ["pour ta santé.", "pour ta richesse.", "pour toi.", "pour ton squad.", "pour ta ville.", "pour ton équipe."],
    lead: "Le jeu fitness gratuit où ta ville, ton équipe et ton marché bougent ensemble. Noté sur ton cœur, pas sur ta vitesse. Construit par une équipe qui ne gagne que quand tu bouges.",
    ctaPrimary: "Débloque ta ville",
    ctaSecondary: "Lire l'histoire",
    chips: ["Gratuit pour commencer", "Le cœur, pas la vitesse", "Équipe à livre ouvert", "Montre & téléphone"],
  },
  story: {
    kicker: "06:00",
    title: "Tu te souviens de cette sensation.",
    paragraphs: [
      "2022. Ton énergie vient de se recharger. Tu lasses tes chaussures, tu ouvres l'app, et tu pars. Partout dans le monde, des centaines de milliers de personnes faisaient la même chose au même moment.",
      "Pour beaucoup d'entre nous, c'était le moment le plus fun de la crypto. Puis tout a cassé. Des sneakers plus chères que des vraies. Un nouveau truc à acheter chaque mois. Ceux qui venaient pour bouger finissaient par payer pour ceux qui venaient pour extraire.",
      "Le rituel était réel. L'économie, non. Alors on a tout reconstruit : on a gardé la magie et jeté tout ce qui l'avait cassée.",
    ],
    fixesTitle: "Ce qu'on a réparé",
    fixes: [
      { was: "1 000 $ pour commencer", now: "Gratuit pour commencer. Jamais de NFT obligatoire." },
      {
        was: "Des récompenses imprimées sans limite",
        now: "Des récompenses financées uniquement par de vrais revenus, jamais par les nouveaux.",
      },
      { was: "La vitesse décidait de tout", now: "Ton cœur décide. Un score d'effort équitable selon l'âge." },
      { was: "Un nouveau truc à acheter chaque mois", now: "Un seul écosystème. Pas de tapis roulant « paie plus pour moins »." },
    ],
  },
  doubleV: {
    title: "Deux V font un W.",
    body: "VV se lit W : wellness, wealth, win. En français, W se dit littéralement « double V ». Prononce-le comme wake, parce que c'est fait pour ça.",
    words: ["Bien-être", "Richesse", "Victoire"],
    healthIsWealth: "La santé, c'est la première richesse.",
  },
  how: {
    kicker: "Comment ça marche",
    title: "Des sessions courtes chaque jour. Un vrai élan.",
    items: [
      {
        title: "L'énergie se recharge à ton heure",
        body: "L'énergie se recharge quatre fois par jour, dans ton fuseau horaire. Une énergie = cinq minutes d'effort réel. Viens, dépense-la, reviens.",
      },
      {
        title: "Le cœur, pas la vitesse",
        body: "L'effort est calculé à partir de tes zones cardiaques, ajusté à ton âge et à ta propre base. Un marcheur de 63 ans et une coureuse de 24 ans partent sur la même ligne.",
      },
      {
        title: "Squads et rivalités",
        body: "Forme un squad, passe le relais à travers les fuseaux horaires, et mets ta ville au tableau lors de clashs de 12 heures.",
      },
      {
        title: "Partout",
        body: "Apple Watch, Wear OS ou téléphone. Pas de réseau sur le sentier ? Les sessions s'enregistrent hors ligne et se synchronisent plus tard : tu ne perds jamais un jour.",
      },
    ],
  },
  pulse: {
    kicker: "Market Pulse",
    title: "La Bourse se réveille. Nous, on bouge.",
    body: "Choisis ta Brand Team. Quand son marché bouge, un moment mondial s'ouvre, et tout le monde bouge ensemble.",
    rally: {
      tag: "Jour rouge",
      title: "Rally",
      body: "La marque baisse ? Un Rally mondial de 45 minutes s'ouvre. Chausse-toi avec des milliers d'autres.",
    },
    recover: {
      tag: "Jour vert",
      title: "Recover",
      body: "La marque monte ? Repos, étirements, bonne nuit. Un défi tombe dans quelques heures.",
    },
    disclaimer:
      "Illustration. Les données de marché ne servent qu'à thématiser des défis gratuits. Les récompenses ne dépendent jamais des cours, et VVake ne vend ni ne donne d'actions.",
  },
  rivalries: {
    kicker: "City Clash",
    title: "Prouve ta ville.",
    body: "Douze heures pour chauffer. Douze heures pour s'affronter. Score par habitant : la taille ne gagne pas, c'est la présence qui gagne.",
    tabs: { FR: "France", US: "États-Unis" },
    toUnlock: "pour débloquer",
    vs: "vs",
    perCapita:
      "Par habitant = l'intensité de l'effort + la part de joueurs présents. Une ville de 330 000 habitants peut battre une métropole de 3,7 millions.",
    stories: {
      "paris-marseille": "Le Classique : la capitale contre le Sud.",
      "lyon-saint-etienne": "Le derby du Rhône, le plus vieux feu de France.",
      "lille-lens": "Le derby du Nord.",
      "bordeaux-toulouse": "Rivaux de la Garonne, au foot comme au rugby.",
      "nantes-rennes": "Le derby breton. Nantes est-elle bretonne ? Réglez ça.",
      "montpellier-nimes": "Le derby du Languedoc.",
      "strasbourg-metz": "L'Alsace contre la Lorraine.",
      "nice-toulon": "La Riviera face à la ville du rugby.",
      "new-york-boston": "Un siècle de rancune au baseball.",
      "los-angeles-san-francisco": "Le nord contre le sud de la Californie.",
      "chicago-st-louis": "Cubs–Cardinals, depuis les années 1890.",
      "dallas-houston": "Pour la fierté du Texas.",
      "philadelphia-pittsburgh": "La bataille de Pennsylvanie.",
      "washington-baltimore": "La rivalité du Beltway.",
      "seattle-portland": "Cascadia : les capitales du running.",
      "miami-tampa": "La suprématie en Floride.",
      "minneapolis-green-bay": "La Border Battle. La preuve que le petit peut gagner.",
    },
  },
  unlock: {
    kicker: "Débloque ta ville",
    title: "VVake n'est pas encore lancé dans ta ville. C'est toi qui décides quand.",
    body: "Chaque ville se lance dès qu'assez de personnes la rejoignent. Les villes rivales se lancent ensemble : le premier clash a lieu dès le premier jour.",
    tiersTitle: "Arrive tôt, reste dans l'histoire",
    tiers: [
      {
        name: "City Founder",
        who: "Les 100 premiers de ta ville",
        perks: "Ton nom sur le Mur des Fondateurs · Skin Founder · Éligible capitaine · Accès 48 h en avance",
      },
      { name: "Pioneer", who: "Les 1 000 premiers", perks: "Skin Pioneer · 2 gels de série · Accès 24 h en avance" },
      { name: "Early Mover", who: "Tous avant le lancement", perks: "Badge Early Mover · 1 gel de série" },
    ],
    tiersNote: "Avantages uniquement dans le jeu, activés après tes 3 premières vraies sessions. Les faux inscrits n'obtiennent rien.",
    form: {
      email: "E-mail",
      emailPlaceholder: "toi@exemple.com",
      city: "Ta ville",
      cityPlaceholder: "Choisis ta ville",
      fanbase: "Ton équipe (optionnel)",
      fanbasePlaceholder: "ex. OM, Stade Toulousain, Packers",
      consent: "J'accepte de recevoir les nouvelles du lancement de VVake. Je peux me désinscrire à tout moment.",
      privacy: "Politique de confidentialité",
      submit: "Rejoindre la liste",
      submitting: "Inscription…",
      rivalLabel: "Ta rivale",
      threshold: "Inscriptions pour débloquer",
      counterLive: "inscrits",
      counterPending: "Les compteurs en direct apparaîtront à l'ouverture de la liste.",
    },
    success: {
      title: "Tu es dedans. Maintenant, ramène ta team.",
      pending: "Vérifie ta boîte mail pour confirmer ton adresse. Seules les inscriptions confirmées font avancer le compteur.",
      rank: "Tu es n°{rank} à {city}.",
      tier: { founder: "Place City Founder réservée", pioneer: "Place Pioneer réservée", early: "Place Early Mover réservée" },
      referralLabel: "Ton lien d'invitation",
      copy: "Copier",
      copied: "Copié",
      shareX: "Partager sur X",
      shareText: "{city} se réveille. Aide-nous à débloquer VVake dans notre ville 👇",
    },
    closed: {
      title: "La liste d'attente ouvre très bientôt.",
      body: "Suis {handle} pour être parmi les premiers quand les compteurs s'allument, et décroche une place de Founder dans ta ville.",
      cta: "Suivre sur X",
    },
    errors: {
      invalid: "Vérifie ton e-mail et ta ville.",
      "rate-limited": "Trop d'essais. Respire, et réessaie dans une minute.",
      network: "Problème de réseau. Vérifie ta connexion et réessaie.",
      server: "Un problème de notre côté. Réessaie, s'il te plaît.",
      "not-configured": "La liste d'attente n'est pas encore ouverte.",
    },
  },
  openBook: {
    kicker: "Livre ouvert",
    title: "Notre salaire est public avant même que tu demandes.",
    body: "L'équipe n'a aucune allocation de tokens et n'est payée que par les frais. Chaque dollar passe par une seule répartition publique.",
    split: [
      { label: "Joueurs", note: "Récompenses de saison, pour l'effort, jamais pour la détention", value: 30 },
      { label: "Équipe", note: "Notre seul revenu : salaires et infrastructure", value: 40 },
      { label: "Croissance", note: "Événements, rivalités, communauté", value: 20 },
      { label: "Réserve", note: "Stabilise les récompenses en saison difficile", value: 10 },
    ],
    promise: "Pas de wallets cachés. Pas de second token. Un rapport public chaque saison.",
  },
  vvaker: {
    kicker: "Ton VVaker",
    title: "Voici ton VVaker.",
    body: "Un petit athlète voxel qui est à toi, qui que tu sois et où que tu sois. Choisis tes couleurs, ton sport et ton humeur, puis fais-en ta photo de profil.",
    controls: { color: "Couleur", sport: "Sport", headgear: "Couvre-chef", mood: "Humeur", energy: "Énergie" },
    colors: { candy: "Bonbon", lilac: "Lilas", butter: "Beurre", mint: "Menthe", sky: "Ciel", olive: "Olive" },
    sports: { runner: "Coureur", lifter: "Muscu", coder: "Codeur", baller: "Basket", walker: "Marche" },
    headgears: { none: "Bandeau", cap: "Casquette", beanie: "Bonnet", headphones: "Casque" },
    moods: { fresh: "Frais", fired: "À fond", sleepy: "Endormi", zen: "Zen" },
    download: "Télécharger le PNG",
    shuffle: "Au hasard",
    note: "Gratuit pour tout le monde. Pas besoin de wallet.",
    alt: "Ton avatar VVaker",
  },
  dev: {
    kicker: "Pour les builders",
    title: "Code dur. Bouge plus fort.",
    body: "Ton IA refactore. Ton dos porte plainte. Le compagnon VVake vit dans ton terminal et ton éditeur, et te pousse dehors quand le build est vert.",
    terminal: [
      "$ vv status",
      "⚡ 3 énergie   🫀 118 min sans bouger",
      "⚔️  PARIS 58.2 vs MARSEILLE 55.9 · encore 3 h",
      "✔ PR mergée. Fenêtre Deploy & Dash : 20 min. Go.",
    ],
    note: "La vie privée d'abord : ni code ni prompt ne quitte jamais ta machine.",
  },
  faq: {
    title: "Questions",
    items: [
      {
        q: "VVake, c'est un investissement ?",
        a: "Non. VVake est un jeu fitness. Les récompenses sont de petits bonus financés par de vrais revenus, et rien sur VVake n'est une promesse de gain. Bouge parce que ça fait du bien.",
      },
      {
        q: "C'est gratuit ?",
        a: "Oui. Bouger, les squads, les rivalités et ton VVaker sont gratuits. Les options (cosmétiques, abonnement Plus) ne seront jamais nécessaires pour participer.",
      },
      {
        q: "Que deviennent mes données de santé ?",
        a: "Elles sont chiffrées avec une clé que toi seul détiens. On ne les vend jamais et on ne les utilise jamais pour de la pub. L'usage pour la recherche est sur consentement et anonymisé.",
      },
      {
        q: "Quels appareils ?",
        a: "Apple Watch et Wear OS dès le premier jour, plus un mode téléphone seul. Les sessions fonctionnent hors ligne et se synchronisent plus tard.",
      },
      {
        q: "Il y a un token ou des NFT ?",
        a: "Une couche web3 est prévue plus tard, sous réserve d'une revue juridique et pas dans tous les pays. Elle ne sera jamais nécessaire pour jouer, et les objets de collection seront purement cosmétiques.",
      },
      {
        q: "Quand est-ce que vous lancez ?",
        a: "Ville par ville, dès que ta ville atteint son nombre d'inscrits. Les villes rivales se lancent ensemble.",
      },
    ],
  },
  footer: {
    tagline: "Deux V font un W.",
    legal:
      "VVake est un jeu fitness, pas un produit financier. Rien sur ce site ne constitue un conseil en investissement ni une offre de token, de titre ou d'instrument financier. Les données de marché sont affichées à titre de divertissement. Les noms d'équipes et les tickers sont utilisés à des fins d'identification uniquement ; aucune affiliation ni aucun partenariat n'est sous-entendu.",
    privacy: "Confidentialité",
    contact: "Contact",
    rights: "Tous droits réservés.",
  },
  privacy: {
    title: "Politique de confidentialité (liste d'attente)",
    updated: "Brouillon, mis à jour le 28 septembre 2026. À faire relire par un conseil juridique avant l'ouverture de la liste.",
    sections: [
      {
        h: "Ce que nous collectons",
        p: "Ton e-mail, ta ville, éventuellement ton équipe, la langue utilisée, et le code de parrainage utilisé ou reçu.",
      },
      {
        h: "Pourquoi",
        p: "Pour faire fonctionner la liste d'attente par ville (compteurs, statuts early, parrainage) et t'envoyer les nouvelles du lancement que tu as acceptées. Base légale : ton consentement.",
      },
      {
        h: "Ce que nous ne faisons jamais",
        p: "Nous ne vendons jamais tes données, ne les partageons jamais à des fins publicitaires, et ce site n'utilise ni cookie de suivi ni outil d'analyse tiers.",
      },
      {
        h: "Combien de temps",
        p: "Jusqu'au lancement plus 12 mois, ou jusqu'à ta désinscription ou ta demande de suppression, selon ce qui arrive en premier.",
      },
      {
        h: "Tes droits",
        p: "Tu peux accéder à tes données, les corriger, les exporter ou les supprimer, et retirer ton consentement à tout moment. Écris à {email}.",
      },
    ],
  },
  notFound: { title: "Perdu en route ?", body: "Cette page fait un jour de repos.", cta: "Retour à l'accueil" },
  root: { choose: "Choisis ta langue" },
};
