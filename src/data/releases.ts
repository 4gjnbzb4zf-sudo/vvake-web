import type { Locale } from "@/i18n/config";

/**
 * What changed in each app release, newest first (vvake.com/<lang>/releases/). The apps' TestFlight builds are the
 * source: add one entry per build that reaches testers, in plain words (what people notice, not code). The site
 * follows the apps: the same day a build ships.
 */
export interface Release {
  /** App version and build, as TestFlight shows it: "1.0.0 (12)". */
  version: string;
  /** ISO date the build reached testers. */
  date: string;
  /** "beta" (TestFlight testers) or "store" (App Store / Google Play). */
  channel: "beta" | "store";
  /** Phone, watch or both. */
  devices: ("iphone" | "watch" | "android" | "wear")[];
  notes: Record<Locale, { added?: string[]; improved?: string[]; fixed?: string[] }>;
}

export const releases: Release[] = [
  {
    version: "1.0.0 (51)",
    date: "2026-10-27",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        improved: [
          "Settings has one Tailor my app row at the top (change your answers or retake the survey), instead of two rows doing almost the same.",
        ],
        fixed: [
          "Everywhere the app talks about your plan, it now names the one you have: VVake Coach Premium (early testers included) or VVake Coach Plus.",
          "Your watch shows your plan by its name too: Coach Premium or Coach Plus.",
          "The coach calls your plan by its right name if it comes up.",
        ],
      },
      fr: {
        improved: [
          "Les Réglages ont une seule ligne Personnaliser mon app en haut (modifier vos réponses ou refaire le questionnaire), au lieu de deux lignes presque identiques.",
        ],
        fixed: [
          "Partout où l'app parle de votre formule, elle nomme celle que vous avez : VVake Coach Premium (testeurs pionniers compris) ou VVake Coach Plus.",
          "Votre montre affiche aussi votre formule sous son nom : Coach Premium ou Coach Plus.",
          "Le coach appelle votre formule par son vrai nom si le sujet vient.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (50)",
    date: "2026-10-27",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          "Before a camera workout starts you see all of it: the order, sets × reps or time, your last weight, the rests, the rounds and about how long, then Start.",
          'During the workout the screen says "Set 2 of 3 · Round 1 of 2", and the coach tells you when the moves start again ("Round 2 of 2: same moves again.").',
          'Finish set: a button and a voice command ("finish set") to end a set yourself.',
          "For workouts mixing standing and floor moves, VVake tells you once where to put the phone (low, 2–2.5 m away) so you only turn between moves, never move the phone.",
          "Camera workouts show the weight before a weighted move's first set, filled in with last time's, and let you change it between sets with − and + or keep the same.",
          'Each set keeps its own weight, and the summary says "+2 kg vs last time" or a new best for each move.',
          'A new "Your weights" page lists each move\'s last sessions, your best set and a suggested weight for next time, which you always choose to use or not.',
          "With an active skill, you can add about 10 minutes of its practice at the start or the end of a camera routine, and it counts as that skill's session.",
          "Every camera move and every Skills drill now has a How to sheet: the demo, the setup, numbered steps, what good form looks like, common mistakes, an easier and a harder version, and safety tips.",
          "Open How to from the demo before a set, the Get ready screen, the next move during a rest, the move pickers, the training builder, your own workout preview and each Skills drill; the workout pauses while you read.",
          'Ask the coach "how do I do a pike push-up?" and it answers from the same guide.',
        ],
        improved: [
          'The demo and the Get ready screen name the exact variation (for example "Goblet squat: feet shoulder-width, one dumbbell held upright at your chest") with one or two form tips, and the demo shows where the weight is.',
          "Between moves the coach only says what changes (turn sideways, face the phone), not the whole setup again.",
          "The plank is now tracked from a diagonal; facing the phone straight on, VVake asks you to turn diagonal or sideways.",
          "Floor moves start only once your whole body is in the picture.",
          "The coach says the weight once before a weighted move, and the workout still runs on its own without a tap.",
          'Skills drills lead with How to; the YouTube link stays as a small "More videos" line.',
          "With the preview on, Settings opens with Tailor my app, Retake the survey and All features at the top.",
          '"Your VVake" is now called "Tailor my app" everywhere: Settings, notifications, the coach and the watches.',
        ],
        fixed: [
          'A short rest in the middle of a set (lying down for a few seconds) no longer ends the set: it stays open until your reps or your hold are done. After a long pause VVake asks "Done with this set?" and never moves on by itself.',
          "A long planned strength day no longer runs the whole routine twice: longer sessions add at most one set per main move.",
        ],
      },
      fr: {
        added: [
          "Avant une séance caméra, vous voyez tout : l'ordre, séries × répétitions ou durée, votre dernière charge, les repos, les tours et la durée environ, puis Commencer.",
          "Pendant la séance l'écran affiche « Série 2 sur 3 · Tour 1 sur 2 », et le coach annonce quand les mouvements recommencent (« Tour 2 sur 2 : les mêmes mouvements. »).",
          "Finir la série : un bouton et une commande vocale (« série finie ») pour terminer une série vous-même.",
          "Pour les séances qui mélangent mouvements debout et au sol, VVake vous dit une seule fois où poser le téléphone (bas, à 2–2,5 m) : entre les mouvements vous vous tournez, sans déplacer le téléphone.",
          "Les séances caméra affichent la charge avant la première série d'un mouvement lesté, préremplie avec celle de la dernière fois, et on la change entre les séries avec − et + ou on garde la même.",
          "Chaque série garde sa propre charge, et le résumé indique « +2 kg par rapport à la dernière fois » ou un nouveau record pour chaque mouvement.",
          "Une nouvelle page « Tes charges » liste les dernières séances de chaque mouvement, la meilleure série et une charge suggérée pour la prochaine fois, qu'on choisit toujours d'utiliser ou non.",
          "Avec un skill actif, on peut ajouter environ 10 minutes de pratique au début ou à la fin d'une routine caméra, et elles comptent comme une séance de ce skill.",
          "Chaque mouvement caméra et chaque exercice des Skills a maintenant une fiche Comment faire : la démo, la mise en place, les étapes numérotées, la bonne forme, les erreurs fréquentes, une version plus facile et une plus dure, et les conseils de sécurité.",
          "Ouvrez Comment faire depuis la démo avant une série, l'écran Prépare-toi, le mouvement suivant pendant le repos, les listes de mouvements, le créateur d'entraînement, l'aperçu de votre séance et chaque exercice des Skills ; la séance se met en pause pendant la lecture.",
          "Demandez au coach « comment on fait une pompe pike ? » : il répond à partir de la même fiche.",
        ],
        improved: [
          "La démo et l'écran Prépare-toi nomment la variante exacte (par exemple « Squat goblet : pieds largeur d'épaules, un haltère tenu debout contre la poitrine ») avec un ou deux conseils, et la démo montre où est la charge.",
          "Entre deux mouvements le coach ne dit que ce qui change (de profil, face au téléphone), pas toute la mise en place.",
          "La planche est maintenant suivie en diagonale ; face au téléphone, VVake vous demande de vous mettre en diagonale ou de profil.",
          "Les mouvements au sol ne démarrent qu'avec tout le corps dans le cadre.",
          "Le coach annonce la charge une fois avant un mouvement lesté, et la séance continue toute seule sans toucher l'écran.",
          "Les exercices des Skills mettent Comment faire en avant ; le lien YouTube reste en petit, « Plus de vidéos ».",
          "Avec l'aperçu activé, les Réglages commencent par Personnaliser mon app, Refaire le questionnaire et Toutes les fonctions.",
          "« Ton VVake » s'appelle maintenant « Personnaliser mon app » partout : Réglages, notifications, coach et montres.",
        ],
        fixed: [
          "Une courte pause au milieu d'une série (allongé quelques secondes) ne termine plus la série : elle reste ouverte jusqu'à ce que vos répétitions ou votre gainage soient faits. Après une longue pause VVake demande « Série terminée ? » et ne passe jamais à la suite tout seul.",
          "Une longue séance de renfo planifiée ne répète plus toute la routine deux fois : une séance plus longue ajoute au plus une série par mouvement principal.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (49)",
    date: "2026-10-27",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          'Your VVake (preview for early testers: You › Preview): a 10-card survey, one tap per answer with the suggested answer already picked, that keeps only the features you want. "Here\'s your VVake" lists every feature with its switch before you start, and rewards stay hidden unless you turn them on.',
          "With Your VVake on, Today shows at most four cards: your one next thing to do, this week in three numbers, one result and one thing waiting for your answer. The tabs follow your answers, and every feature stays one tap away in All features, with a search that finds the hidden ones too.",
          "Settings › Your VVake: all your answers on one screen, tap one to change it and see what turns on or off before saving, or retake the survey.",
          "Already using VVake? Turning it on sets it up from your last 30 days, with a card on Today to check it or undo it in one tap.",
          'Tell your coach "I want to train for a 10K" or "change my VVake" and it asks just the 2 or 3 questions that matter.',
          "With Your VVake on (preview, test builds only), You shows your results first: streak, this week, VV points, your VVaker and your latest sessions, with every setting behind one Settings row.",
          "Settings lists only the features you use, and its search still finds the hidden ones; language, units, theme and formats are one Display row.",
          "Notifications are all on one screen, with a switch for each kind, crew quests and training challenges included.",
          "About three notifications a day by default, never more than six, nothing between 21:30 and 7:00 but your bedtime cue, and what can wait comes in one evening summary.",
          "Desk puts the Focus lock and the Claude lock behind one entry.",
          "Your own workout: paste it, say it, or snap a photo of it (a gym board, a coach's sheet, a screenshot), check what VVake read, then Start guided and the camera takes you through it.",
          'Find it on the camera workout\'s start, in the coach chat (type or say a workout there), and as "Fill from text or a photo" in the training builder.',
          "Moves VVake doesn't know yet are kept with your words: you count them, or a timer runs them.",
          "Learn a skill step by step: front and middle splits, handstand, muscle-up, pull-up, push-up, pistol squat, L-sit, bridge and toe touch, each a ladder of levels with drills and a clear target.",
          "A short skill block (5 to 12 minutes) shows on Today on the days you pick, and wrist and shoulder skills wait a day after a hard upper-body session.",
          "The camera counts or times the drills it can see (split depth, holds, reps); for the others a timer and one tap on how it went: Easy, OK, Too hard or Pain.",
          'You move up a level after meeting the target on 2 sessions, the work eases off after "Too hard" twice, and "Pain" stops the skill for 2 days.',
          'Every drill has a "Watch examples" link that opens a YouTube search for it.',
          "Ask your coach for any other skill: it drafts a ladder you check before starting, and it knows your skills and celebrates your level-ups.",
        ],
        improved: [
          "With \"Your VVake\" switched on (Developer settings for now), your Apple Watch shows only what you picked: its pages, Today's shortcuts and the rows below Start follow your choices. Nothing changes while it's off.",
          "The You page puts your sessions first, with one Voice row and one Zones row for the settings.",
          "No Coach Plus offer while the coach is off, and no music page in a workout when you train with your own music.",
          "A move reminder you ask the watch for always rings, whatever you picked.",
          "With \"Your VVake\" switched on (Developer settings for now), your Wear OS watch shows only what you picked: its pages, Today's shortcuts and the rows below Start follow your choices. Nothing changes while it's off.",
          "The You page puts your sessions first, with one Voice row and one Zones row for the settings.",
          "No Coach Plus offer while the coach is off, and no music page in a workout when you train with your own music.",
          "A move reminder you ask the watch for always rings, whatever you picked.",
          "The sport picker starts with your sports; the whole list is one tap away in All sports.",
          'One challenge screen: pick "Who moves more?" or "Beat my mark", and old 24-hour challenge links still open.',
          "Before starting, change any reps, sets or rests, make a move easier, or save the workout as one of your trainings.",
        ],
      },
      fr: {
        added: [
          "Ton VVake (aperçu pour les testeurs pionniers : Toi › Aperçu) : un questionnaire de 10 cartes, une touche par réponse, la réponse suggérée déjà choisie, qui ne garde que les fonctions que tu veux. « Voici ton VVake » liste chaque fonction avec son interrupteur avant de commencer, et les récompenses restent cachées sauf si tu les actives.",
          "Avec Ton VVake activé, Aujourd'hui affiche au plus quatre cartes : la prochaine chose à faire, ta semaine en trois chiffres, un résultat et une chose qui attend ta réponse. Les onglets suivent tes réponses, et chaque fonction reste à une touche dans Toutes les fonctions, avec une recherche qui trouve aussi celles qui sont cachées.",
          "Réglages › Ton VVake : toutes tes réponses sur un écran, touche-en une pour la changer et voir ce qui s'active ou se désactive avant d'enregistrer, ou refais le questionnaire.",
          "Tu utilises déjà VVake ? En l'activant, il se règle d'après tes 30 derniers jours, avec une carte sur Aujourd'hui pour vérifier ou annuler en une touche.",
          "Dis à ton coach « Je veux m'entraîner pour un 10 km » ou « change mon VVake » : il ne pose que les 2 ou 3 questions utiles.",
          "Avec Ton VVake activé (aperçu, versions de test uniquement), Toi montre d'abord tes résultats : ta série, ta semaine, tes points VV, ton VVaker et tes dernières séances, et tous les réglages derrière une seule ligne Réglages.",
          "Les réglages ne listent que les fonctions que tu utilises, et la recherche trouve aussi celles qui sont cachées ; langue, unités, thème et formats tiennent dans une ligne Affichage.",
          "Toutes les notifications sont sur un seul écran, avec un interrupteur par type, quêtes d'équipe et défis d'entraînement compris.",
          "Environ trois notifications par jour par défaut, jamais plus de six, rien entre 21 h 30 et 7 h sauf ton rappel du coucher, et ce qui peut attendre arrive dans un seul résumé le soir.",
          "Bureau réunit le verrou Focus et le verrou Claude derrière une seule entrée.",
          "Ta propre séance : colle-la, dis-la ou prends-la en photo (un tableau de salle, la fiche de ton coach, une capture d'écran), vérifie ce que VVake a lu, puis lance la séance guidée et la caméra t'accompagne.",
          "Elle est au départ de la séance caméra, dans le chat du coach (tape ou dis une séance), et dans le créateur d'entraînement avec « Remplir depuis un texte ou une photo ».",
          "Les mouvements que VVake ne connaît pas encore sont gardés avec tes mots : tu les comptes, ou un chrono les rythme.",
          "Apprenez un skill pas à pas : grand écart facial et latéral, équilibre sur les mains, muscle-up, traction, pompes, pistol squat, L-sit, pont et toucher les orteils, chacun avec ses niveaux, ses exercices et un objectif clair.",
          "Un court bloc skill (5 à 12 minutes) s'affiche dans Aujourd'hui les jours choisis, et les skills poignets et épaules attendent un jour après une séance dure du haut du corps.",
          "La caméra compte ou chronomètre les exercices qu'elle voit (profondeur de l'écart, maintiens, répétitions) ; pour les autres, un minuteur et une touche pour dire comment ça s'est passé : Facile, OK, Trop dur ou Douleur.",
          "Vous montez de niveau après avoir atteint l'objectif sur 2 séances, l'effort s'allège après « Trop dur » deux fois, et « Douleur » met le skill en pause 2 jours.",
          "Chaque exercice a un lien « Voir des exemples » qui ouvre une recherche YouTube.",
          "Demandez à votre coach n'importe quel autre skill : il prépare une progression que vous vérifiez avant de commencer, et il connaît vos skills et fête vos passages de niveau.",
        ],
        improved: [
          "Avec « Ton VVake » activé (dans les réglages Développeur pour l’instant), ton Apple Watch ne montre que ce que tu as choisi : ses pages, les raccourcis d’Aujourd’hui et les lignes sous Démarrer suivent tes choix. Rien ne change tant qu’il est désactivé.",
          "La page Toi met tes séances en premier, avec une ligne Voix et une ligne Zones pour les réglages.",
          "Pas d’offre Coach Plus quand le coach est désactivé, et pas de page musique pendant une séance si tu t’entraînes avec ta propre musique.",
          "Un rappel pour bouger que tu demandes à la montre sonne toujours, quels que soient tes choix.",
          "Avec « Ton VVake » activé (dans les réglages Développeur pour l’instant), ta montre Wear OS ne montre que ce que tu as choisi : ses pages, les raccourcis d’Aujourd’hui et les lignes sous Démarrer suivent tes choix. Rien ne change tant qu’il est désactivé.",
          "La page Toi met tes séances en premier, avec une ligne Voix et une ligne Zones pour les réglages.",
          "Pas d’offre Coach Plus quand le coach est désactivé, et pas de page musique pendant une séance si tu t’entraînes avec ta propre musique.",
          "Un rappel pour bouger que tu demandes à la montre sonne toujours, quels que soient tes choix.",
          "Le choix du sport commence par tes sports ; la liste complète est à une touche dans Tous les sports.",
          "Un seul écran de défi : choisis « Qui bouge le plus ? » ou « Bats ma marque », et les anciens liens de défi de 24 h s'ouvrent toujours.",
          "Avant de commencer, change les répétitions, les séries ou les repos, rends un mouvement plus facile, ou enregistre la séance dans tes entraînements.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (48)",
    date: "2026-10-26",
    channel: "beta",
    devices: ["iphone", "android"],
    notes: {
      en: {
        added: [
          'Before every exercise of a camera workout, VVake shows where to put the phone (facing it or side-on, how far, how high) and checks that it can see what it needs. It tells you what to change, like "Move back", "Turn sideways so I can track you" or "Your legs are out of frame", and counts down only once you\'re ready. A Start button is there if you want to go anyway.',
          "During the rest, the next exercise is previewed: its name and target, its demo on a loop, the camera angle and one or two form tips. In the last seconds, VVake asks you to get into position.",
          "Rest controls that are never covered: +15 s, +30 s, a rest length you can change for the rest of the workout, Replay demo, Skip preview, Skip rest, and Easier when the move has an easier version (knee push-ups for push-ups, chair squats for squats).",
          'Voice controls on the mic button: "pause", "more rest", "skip", "I\'m ready", "replay the demo" and "easier". Siri\'s "Wake pause" works on the camera workout too.',
          "New camera moves: chair squat, wall or incline push-up, march in place, standing knee raise and arm circles. The starter routines use them.",
          "Four starter routines: Beginner full body, Low impact (no jumps), Morning activation (7 minutes, also offered under Wake up in your daily rhythm) and Intermediate full body.",
          "The summary has a Tracking card that says honestly when VVake lost sight of you, when a hold was timed by you, when shorter reps weren't counted, and when the form wasn't judged from that angle.",
        ],
        improved: [
          'The coach says your progress, like "10 of 15 done", "3 more" and "Last one", with a word of encouragement now and then, instead of every single rep.',
          "When VVake loses sight of you during a set, the screen and the voice say so and what to change, instead of going quiet.",
          "The camera screen says plainly that your pose is read on the phone and nothing is recorded or sent.",
          "Camera workouts count push-ups side-on or facing the phone, with the phone on the floor.",
          "Camera workouts count lunges facing the phone too, even when your feet are out of the picture.",
          "When your range is limited but steady, your reps count after the first few.",
        ],
        fixed: [
          "iPhone: lying down (plank, push-ups seen from the side on the floor), the camera now keeps finding you: when it loses a body lying flat, it looks again with the picture turned a quarter turn.",
          "A plank's timer no longer starts before you're in the plank: VVake waits for the position, counts down, and times only the plank.",
          'A tracking loss of a second or two no longer pauses a hold. A real break pauses it and says so, and "Start the timer myself" times it by hand when the camera can\'t see you well.',
          "A row, a curl or high knees no longer count as push-ups or lunges.",
          "Tapping a coach call's notification right away no longer says \"This call isn't available any more\" when the phone simply wasn't online yet. VVake tries again by itself, and offers Try again if the connection stays down.",
          "After switching the coach's voice (Woman / Man), the new voice downloads as soon as the phone is online, on any network, instead of waiting for Wi-Fi.",
        ],
      },
      fr: {
        added: [
          "Avant chaque exercice d'une séance caméra, VVake montre où poser le téléphone (de face ou de profil, à quelle distance, à quelle hauteur) et vérifie qu'il voit ce qu'il faut. Il dit quoi changer, comme « Recule un peu », « Mets-toi de profil pour que je te suive » ou « Tes jambes sont hors du cadre », et ne lance le décompte qu'une fois que tu es prêt. Un bouton Démarrer est là si tu veux y aller quand même.",
          "Pendant le repos, l'exercice suivant est présenté : son nom et son objectif, sa démo en boucle, l'angle de la caméra et un ou deux conseils de posture. Dans les dernières secondes, VVake te demande de te mettre en position.",
          "Des commandes de repos jamais masquées : +15 s, +30 s, une durée de repos à changer pour le reste de la séance, Revoir la démo, Passer l'aperçu, Passer le repos, et Plus facile quand le mouvement a une version plus facile (pompes sur les genoux au lieu des pompes, squats sur chaise au lieu des squats).",
          "Des commandes vocales sur le bouton micro : « pause », « plus de repos », « on passe », « je suis prêt », « rejoue la démo » et « plus facile ». « Wake pause » avec Siri marche aussi pendant la séance caméra.",
          "Nouveaux mouvements caméra : squat sur chaise, pompe au mur ou inclinée, marche sur place, montée de genou debout et moulinets de bras. Les routines pour commencer les utilisent.",
          "Quatre routines pour commencer : Corps complet débutant, Sans impact (sans saut), Réveil musculaire (7 minutes, aussi proposé sous Réveil dans ton rythme du jour) et Corps complet intermédiaire.",
          "Le résumé a une carte Suivi qui dit honnêtement quand VVake ne t'a plus vu, quand un gainage a été chronométré par toi, quand des répétitions plus courtes n'ont pas été comptées et quand la posture n'a pas été jugée depuis cet angle.",
        ],
        improved: [
          "Le coach annonce ta progression, comme « 10 sur 15 », « Plus que 3 » et « Encore une », avec un encouragement de temps en temps, au lieu de chaque répétition.",
          "Quand VVake ne te voit plus pendant une série, l'écran et la voix le disent et indiquent quoi changer, au lieu de se taire.",
          "L'écran caméra dit clairement que ta posture est lue sur le téléphone et que rien n'est enregistré ni envoyé.",
          "Les séances caméra comptent les pompes de profil ou face au téléphone, posé au sol.",
          "Les séances caméra comptent aussi les fentes face au téléphone, même quand tes pieds sont hors du cadre.",
          "Quand ton amplitude est limitée mais régulière, tes répétitions comptent après les premières.",
        ],
        fixed: [
          "iPhone : allongé (gainage, pompes vues de côté au sol), la caméra continue de te trouver : quand elle perd un corps à l'horizontale, elle regarde à nouveau avec l'image tournée d'un quart de tour.",
          "Le chrono de la planche ne démarre plus avant que tu sois en planche : VVake attend la position, lance le décompte et ne chronomètre que la planche.",
          "Une perte de suivi d'une ou deux secondes ne met plus un gainage en pause. Une vraie pause le met en pause et le dit, et « Lancer le chrono moi-même » le chronomètre à la main quand la caméra te voit mal.",
          "Un rowing, un curl ou des montées de genoux ne comptent plus comme des pompes ou des fentes.",
          "Toucher tout de suite la notification d'un appel du coach n'affiche plus « Cet appel n'est plus disponible » quand le téléphone n'était simplement pas encore en ligne. VVake réessaie tout seul, et propose Réessayer si la connexion reste coupée.",
          "Après avoir changé la voix du coach (Femme / Homme), la nouvelle voix se télécharge dès que le téléphone est en ligne, sur n'importe quel réseau, au lieu d'attendre le Wi-Fi.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (47)",
    date: "2026-10-23",
    channel: "beta",
    devices: ["iphone", "watch", "android"],
    notes: {
      en: {
        improved: [
          "Walks and runs with the phone alone now earn a few points for your steps: 1 point for every 5 minutes your steps back, from 10 minutes, up to 10 points a day. Wear your watch or a heart-rate strap for full points.",
          'Music moved from the watch to the iPhone, and you want it back on the watch: VVake now says the one way that works, "In Spotify on the watch, tap the device button and pick Apple Watch". Spotify only offers the watch as a place to play while it plays there, so no app can send it back on its own.',
        ],
        fixed: [
          "iPhone: a walk or run recorded with the phone alone keeps its route and distance with the phone locked in a pocket. Before, it stopped until you opened VVake again. The blue location indicator shows while it records.",
          'The watch no longer shows "Try opening Spotify here": watchOS doesn\'t let VVake open Spotify on the watch.',
        ],
      },
      fr: {
        improved: [
          "La marche et la course avec le téléphone seul rapportent maintenant quelques points pour tes pas : 1 point toutes les 5 minutes appuyées par tes pas, dès 10 minutes, jusqu'à 10 points par jour. Porte ta montre ou une ceinture cardio pour tous les points.",
          "La musique est passée de la montre à l'iPhone et tu veux la remettre sur la montre : VVake indique maintenant la seule façon qui marche, « Dans Spotify sur la montre, touche le bouton des appareils et choisis Apple Watch ». Spotify ne propose la montre comme appareil que pendant qu'elle y joue : aucune app ne peut l'y renvoyer seule.",
        ],
        fixed: [
          "iPhone : une marche ou une course avec le téléphone seul garde son tracé et sa distance téléphone verrouillé dans la poche. Avant, elle s'arrêtait jusqu'à ce que tu rouvres VVake. L'indicateur bleu de localisation s'affiche pendant l'enregistrement.",
          "La montre n'affiche plus « Essayer d'ouvrir Spotify ici » : watchOS ne laisse pas VVake ouvrir Spotify sur la montre.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (46)",
    date: "2026-10-23",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          "Detailed music log: a switch in Connections › Spotify on the phone and in the watch's Spotify settings (off by default, off by itself after 7 days). While it's on, VVake records each music step, without your account or song names. Send music log gives you a short code, and the phone and the watch send theirs together, so a problem can be found and fixed.",
          "Play on now says in one line how each choice plays: on this watch, on your phone, or on another device, and what to do if it needs you.",
        ],
        improved: [
          "The watch talks to Spotify itself whenever it's online (its Wi-Fi, its cellular, or through your phone), instead of waiting for the phone app. Playing, the device list and the checks are back to fast.",
          "Play on › This watch starts at once when Spotify already plays on the watch or was there a few minutes ago. The one-minute wait shows only when Spotify really isn't on the watch.",
          "VVake checks that the music started within half a second, and counts music playing on the watch as started.",
          "From the phone, Play on › your watch: on a Wear OS watch VVake opens Spotify there itself; on an Apple Watch it tells you the one step to take (open Spotify there and press play).",
        ],
        fixed: [
          "From the watch, playing on the phone no longer waits for the phone app before starting.",
          'A play the phone was still starting no longer ended with "Your iPhone is busy" after 6 seconds.',
          "When Spotify is asleep on the iPhone, VVake opens it and says the one thing to do: press play there (no play button? open a playlist and press play), and VVake controls it from then on. Music already playing moves at once.",
          "With the watch on its charger, Spotify can't play on it: VVake now says so at once, with Play on iPhone instead, instead of waiting.",
        ],
      },
      fr: {
        added: [
          "Journal musique détaillé : un interrupteur dans Connexions › Spotify sur le téléphone et dans les réglages Spotify de la montre (coupé par défaut, se coupe tout seul après 7 jours). Tant qu'il est activé, VVake note chaque étape musique, sans ton compte ni les titres. Envoyer le journal musique te donne un code court, et le téléphone et la montre envoient le leur ensemble, pour trouver et corriger un problème.",
          "Lire sur indique maintenant en une ligne comment joue chaque choix : sur cette montre, sur ton téléphone ou sur un autre appareil, et quoi faire s'il a besoin de toi.",
        ],
        improved: [
          "La montre parle elle-même à Spotify dès qu'elle est en ligne (son Wi-Fi, son réseau mobile ou via ton téléphone), au lieu d'attendre l'app du téléphone. La lecture, la liste des appareils et les vérifications redeviennent rapides.",
          "Lire sur › Cette montre démarre aussitôt quand Spotify joue déjà sur la montre ou y était il y a quelques minutes. L'attente d'une minute ne s'affiche que si Spotify n'est vraiment pas sur la montre.",
          "VVake vérifie en une demi-seconde que la musique a démarré, et compte la musique qui joue sur la montre comme démarrée.",
          "Depuis le téléphone, Lire sur › ta montre : sur une montre Wear OS, VVake y ouvre Spotify lui-même ; sur une Apple Watch, il t'indique le seul geste à faire (ouvrir Spotify là-bas et lancer la lecture).",
        ],
        fixed: [
          "Depuis la montre, lire sur le téléphone n'attend plus l'app du téléphone avant de démarrer.",
          "Une lecture que le téléphone était encore en train de lancer ne finit plus par « Ton iPhone est occupé » au bout de 6 secondes.",
          "Quand Spotify dort sur l'iPhone, VVake l'ouvre et dit la seule chose à faire : appuyer sur lecture (pas de bouton ? ouvrir une playlist et lancer la lecture), puis VVake le pilote. La musique qui joue déjà passe aussitôt.",
          "Montre sur son chargeur, Spotify ne peut pas y jouer : VVake le dit tout de suite, avec Plutôt sur l'iPhone, au lieu d'attendre.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (45)",
    date: "2026-10-23",
    channel: "beta",
    devices: ["watch", "wear"],
    notes: {
      en: {
        fixed: [
          'Play on › This watch no longer seems to retry forever. While VVake waits for Spotify on the watch, it says so: "Waiting for Spotify on this watch… Open Spotify on the watch and press play there; VVake takes over." A countdown shows the time left, with Cancel and Send Spotify report on the same screen.',
          "The wait now lasts one minute at most. If Spotify doesn't show up on the watch, VVake stops and says \"Spotify didn't appear on this watch\", with Try again, Play on the phone instead and Send Spotify report.",
          "If Spotify already plays on the watch, VVake takes over right away, without waiting.",
          "The Spotify report now says how long VVake waited, how many times it checked, and whether the wait ran out.",
        ],
      },
      fr: {
        fixed: [
          "Lire sur › Cette montre ne semble plus réessayer sans fin. Pendant que VVake attend Spotify sur la montre, il le dit : « En attente de Spotify sur cette montre… Ouvre Spotify sur la montre et lance la lecture : VVake prend le relais. » Un compte à rebours montre le temps restant, avec Annuler et Envoyer un rapport Spotify sur le même écran.",
          "L'attente dure maintenant une minute au plus. Si Spotify n'apparaît pas sur la montre, VVake s'arrête et indique « Spotify n'est pas apparu sur cette montre », avec Réessayer, Plutôt sur le téléphone et Envoyer un rapport Spotify.",
          "Si Spotify joue déjà sur la montre, VVake prend la main tout de suite, sans attendre.",
          "Le rapport Spotify indique maintenant combien de temps VVake a attendu, combien de fois il a vérifié et si l'attente a expiré.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (44)",
    date: "2026-10-23",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          "On the watch, You → Coach voice lets you pick a woman's or a man's voice, with a button to hear each one; your iPhone and your account follow the same choice.",
          "Choose your coach's voice: a woman's or a man's, in English or French (it follows the app's language). Coach › Coach voice has a \"Hear it\" button for each, onboarding asks once (skip it and nothing changes), and your watch and vvake.com follow the same choice.",
          "Coach calls are now about you: the coach opens with something only you would hear (your race countdown, yesterday's session, a short night or a lower heart-rate variability, your week, a missed session, your streak), asks you one question, and may offer one concrete change that you approve on screen or by saying yes.",
          "Coach › Coach voice has a Voice check: which voice said your last coach lines, and a button that sends a voice report (which voice and why, never the words).",
          "A workout your phone records on its own now shows on the watch's Today: sport and time, with pause, resume and end right there. Starting a workout on the watch then asks first, so the same outing isn't recorded twice by mistake.",
          "Started the same outing on both devices within 2 minutes? The one you started second offers to follow the first (or keep both).",
        ],
        improved: [
          "After you switch voices, the watch downloads the new voice and never mixes the two voices, and when it falls back to its built-in voice it uses one of the gender you chose.",
          "You → Get a better voice shows which voice said your last coach lines, and a button sends a voice report (no words, only which voice and why).",
          "Everything the coach says uses your chosen voice: workout cues, cheers, camera lines, replies, the live coach and calls. Switching voices downloads the new one and never mixes the two.",
          "When the phone's own voice has to stand in, it picks one of the gender you chose.",
          "The web app on vvake.com speaks in the same chosen coach voice, for workouts and camera sessions too.",
          "The coach remembers what you answered on a call and won't ask the same question next time.",
          '"This watch (Apple Watch)" in Play on is Spotify on the watch, and VVake finds it by name too. The watch\'s speaker or headphones choice only shows while something plays on the watch.',
          "Send Spotify report is always there: in Play on (also during a workout and while Spotify plays from its own watch app) and in Spotify settings on the watch. It also says what VVake saw after the play, whether VVake was open on the phone, how long the phone took, which Play on entry you tapped and how VVake used the watch's sound. Still no names, devices or songs.",
          "On the Apple Watch, Try opening Spotify here asks the watch to open Spotify's app.",
        ],
        fixed: [
          "The coach's recorded cheers and lines now reach a watch that sits next to its iPhone, with no Wi-Fi or charger needed, so far fewer lines fall back to the watch's built-in voice.",
          "One cue that failed to download no longer silences every cue of the pack in the coach's voice.",
          "With Coach Plus or Premium, every coach line on the watch is in your coach's voice: lines without a recording are recorded for you, a workout's lines are fetched before it starts, and the watch's built-in voice only fills in when the watch is offline or the voice service refuses.",
          "With VVake Coach Plus or Premium, the coach could still talk in the phone's built-in voice when that had been chosen long ago. That old choice is reset once to the coach's voice. You can still pick the phone's voice, and the screen now says plainly when it's on.",
          "Coach lines kept playing when the phone locks during a workout.",
          "A new coach line that takes a moment to come now streams in the coach's voice instead of falling back to the phone's voice.",
          "Play from the watch no longer says it worked when nothing plays. VVake now waits until Spotify really plays where you picked; otherwise it says what happened and what to do, with Try again.",
          "Spotify asleep on the phone: VVake wakes it and starts the music again by itself. With VVake open on the phone, Spotify can open there for a moment so the music really starts. With the phone in your pocket, a notification shows; tap it and the music starts, while the watch waits and shows when it plays.",
          'The phone keeps answering the watch while it opens Spotify, so the watch no longer gets "no answer" in the middle of a play.',
          "VVake's music on the watch no longer starts over Spotify playing on the watch, and lets go as soon as Spotify takes over. After you talk to the coach, Spotify comes back to full volume.",
          "On the watch's music page, where the music plays is now a small button in the corner. It no longer covers the play buttons or the page dots.",
          'A workout started on your watch no longer leaves the phone stuck on "Starting on your watch…". The phone knows a workout runs on the watch, even when it was closed at the start. It shows it live, and Start on the phone opens that workout instead of starting a second one.',
          "If the live link between the watch and the phone fails when a workout starts, the watch keeps trying again every 20 seconds and as soon as the phone asks.",
        ],
      },
      fr: {
        added: [
          "Sur la montre, Toi → Voix du coach te permet de choisir une voix de femme ou d'homme, avec un bouton pour écouter chacune ; ton iPhone et ton compte suivent le même choix.",
          "Choisis la voix de ton coach : une voix de femme ou d'homme, en français ou en anglais (elle suit la langue de l'app). Coach › Voix du coach a un bouton « Écouter » pour chacune, l'accueil te le demande une fois (passe et rien ne change), et ta montre et vvake.com suivent le même choix.",
          "Les appels du coach parlent de toi : il commence par quelque chose que toi seul entendrais (le compte à rebours de ta course, ta séance d'hier, une nuit courte ou une variabilité cardiaque plus basse, ta semaine, une séance manquée, ta série), te pose une question et peut te proposer un changement concret, que tu valides à l'écran ou en disant oui.",
          "Coach › Voix du coach a une vérification de la voix : quelle voix a dit tes dernières phrases du coach, et un bouton qui envoie un rapport de voix (quelle voix et pourquoi, jamais les mots).",
          "Une séance que le téléphone enregistre seul s'affiche maintenant sur Aujourd'hui sur la montre : sport et durée, avec pause, reprise et fin juste là. Démarrer une séance sur la montre demande alors d'abord, pour ne pas enregistrer deux fois la même sortie par erreur.",
          "Même sortie lancée sur les deux appareils à moins de 2 minutes d'écart ? Celui démarré en second propose de suivre le premier (ou de garder les deux).",
        ],
        improved: [
          "Quand tu changes de voix, la montre télécharge la nouvelle voix et ne mélange jamais les deux, et quand elle passe à sa voix intégrée, elle en prend une du genre que tu as choisi.",
          "Toi → Obtenir une meilleure voix montre quelle voix a dit tes dernières phrases du coach, et un bouton envoie un rapport de voix (sans les mots, seulement quelle voix et pourquoi).",
          "Tout ce que dit le coach utilise la voix choisie : consignes de séance, encouragements, séances caméra, réponses, coach en direct et appels. Changer de voix télécharge la nouvelle et ne mélange jamais les deux.",
          "Quand la voix du téléphone doit remplacer le coach, elle en prend une du genre choisi.",
          "L'app web sur vvake.com parle avec la même voix de coach choisie, en séance et en séance caméra aussi.",
          "Le coach se souvient de ce que tu as répondu pendant un appel et ne repose pas la même question la fois suivante.",
          "« Cette montre (Apple Watch) » dans Lire sur, c'est Spotify sur la montre, et VVake la trouve aussi par son nom. Le choix haut-parleur ou écouteurs de la montre n'apparaît que lorsque quelque chose joue sur la montre.",
          "Envoyer un rapport Spotify est toujours là : dans Lire sur (aussi pendant une séance et quand Spotify joue depuis sa propre app montre) et dans les réglages Spotify de la montre. Il indique aussi ce que VVake a vu après la lecture, si VVake était ouvert sur le téléphone, le temps de réponse du téléphone, l'entrée de Lire sur touchée et comment VVake a utilisé le son de la montre. Toujours sans noms, appareils ni morceaux.",
          "Sur l'Apple Watch, Essayer d'ouvrir Spotify ici demande à la montre d'ouvrir l'app Spotify.",
        ],
        fixed: [
          "Les encouragements et phrases enregistrés du coach arrivent maintenant sur une montre posée près de son iPhone, sans Wi-Fi ni chargeur, donc bien moins de phrases passent à la voix intégrée de la montre.",
          "Un signal qui n'a pas pu se télécharger ne coupe plus tous les signaux du pack dans la voix du coach.",
          "Avec Coach Plus ou Premium, chaque phrase du coach sur la montre est dans la voix de ton coach : les phrases sans enregistrement sont enregistrées pour toi, celles d'une séance sont récupérées avant qu'elle commence, et la voix intégrée de la montre ne prend le relais que si la montre est hors ligne ou si le service de voix refuse.",
          "Avec VVake Coach Plus ou Premium, le coach pouvait encore parler avec la voix intégrée du téléphone si elle avait été choisie il y a longtemps. Cet ancien choix est remis une fois sur la voix du coach. Tu peux toujours choisir la voix du téléphone, et l'écran l'indique clairement quand elle est active.",
          "Les phrases du coach continuent quand le téléphone se verrouille pendant une séance.",
          "Une nouvelle phrase du coach qui met un instant à arriver est lue en continu dans sa voix au lieu de passer à la voix du téléphone.",
          "Lecture depuis la montre ne dit plus que ça a marché quand rien ne joue. VVake attend maintenant que Spotify joue vraiment là où vous l'avez choisi ; sinon il dit ce qui s'est passé et quoi faire, avec Réessayer.",
          "Spotify en veille sur le téléphone : VVake le réveille et relance la musique tout seul. Avec VVake ouvert sur le téléphone, Spotify peut s'y ouvrir un instant pour que la musique démarre vraiment. Téléphone en poche, une notification s'affiche ; touchez-la et la musique démarre, pendant que la montre attend et indique quand ça joue.",
          "Le téléphone continue de répondre à la montre pendant qu'il ouvre Spotify : la montre n'a plus « pas de réponse » au milieu d'une lecture.",
          "La musique de VVake sur la montre ne démarre plus par-dessus Spotify qui joue sur la montre, et s'efface dès que Spotify prend la main. Après avoir parlé au coach, Spotify revient à plein volume.",
          "Sur la page musique de la montre, l'endroit où joue la musique est maintenant un petit bouton dans le coin. Il ne cache plus les boutons de lecture ni les points de page.",
          "Une séance démarrée sur la montre ne bloque plus le téléphone sur « Démarrage sur ta montre… ». Le téléphone sait qu'une séance tourne sur la montre, même s'il était fermé au départ. Il l'affiche en direct, et Démarrer sur le téléphone ouvre cette séance au lieu d'en lancer une deuxième.",
          "Si le lien en direct entre la montre et le téléphone échoue au départ d'une séance, la montre réessaie toutes les 20 secondes et dès que le téléphone le demande.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (43)",
    date: "2026-10-22",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          'Headphones connecting to your phone or watch while Spotify plays elsewhere: "Headphones connected. Play here?" in one tap. Say Switch once and it follows your headphones by itself next time.',
        ],
        improved: [
          "The watch and the phone find each other as soon as VVake opens on either one: with both open, within a few seconds. Once linked, they keep checking now and then (more often during a workout), without draining the battery.",
          "Connections on the phone says whether the watch is reachable now or when it was last seen, or that you should open VVake on the watch to link it.",
          "A heart-rate strap you paired before connects as soon as the workout start screen shows. On the web app, a paired sensor that drops keeps being tried every 30 seconds while the page is open.",
          "Send Spotify report now includes the link state and recent headphone changes (still no names, devices or songs).",
        ],
        fixed: [
          "The watch's Spotify page always shows where the music plays again, with Play on one tap away: also while Spotify plays on the watch itself, when Spotify isn't open anywhere yet, and when the phone is away. Play on always lists the phone, this watch, the watch's headphones or speaker and every device Spotify sees, and your pick is ticked.",
          "A watch picked for Spotify on an earlier day no longer makes Play wait for it: after 30 minutes, the device Spotify has open is the default again. A pick you just made still wins: pick the watch and it plays on the watch, pick the phone and it plays on the phone.",
        ],
      },
      fr: {
        added: [
          "Des écouteurs qui se connectent à votre téléphone ou à votre montre pendant que Spotify joue ailleurs : « Écouteurs connectés. Jouer ici ? » en un appui. Dites Basculer une fois, et la musique suit vos écouteurs d'elle-même la fois suivante.",
        ],
        improved: [
          "La montre et le téléphone se retrouvent dès que VVake s'ouvre sur l'un ou l'autre : tous les deux ouverts, en quelques secondes. Une fois liés, ils vérifient le lien de temps en temps (plus souvent pendant une séance), sans vider la batterie.",
          "Connexions sur le téléphone dit si la montre est joignable maintenant ou quand elle a été vue pour la dernière fois, ou qu'il faut ouvrir VVake sur la montre pour la lier.",
          "Une ceinture cardio déjà jumelée se connecte dès l'écran de départ de la séance. Dans l'app web, un capteur jumelé qui décroche est réessayé toutes les 30 secondes tant que la page est ouverte.",
          "Envoyer le rapport Spotify inclut maintenant l'état du lien et les derniers changements d'écouteurs (toujours sans noms, appareils ni chansons).",
        ],
        fixed: [
          "La page Spotify de la montre montre de nouveau toujours où joue la musique, avec Lire sur à un appui : aussi quand Spotify joue sur la montre elle-même, quand Spotify n'est encore ouvert nulle part, et quand le téléphone est loin. Lire sur propose toujours le téléphone, cette montre, les écouteurs ou le haut-parleur de la montre et chaque appareil que voit Spotify, et votre choix est coché.",
          "Une montre choisie pour Spotify un autre jour ne fait plus attendre Lecture : après 30 minutes, l'appareil ouvert dans Spotify redevient le choix par défaut. Un choix que vous venez de faire l'emporte toujours : choisissez la montre et ça joue sur la montre, le téléphone et ça joue sur le téléphone.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (42)",
    date: "2026-10-22",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        improved: [
          "The watch finds itself in Spotify faster: while it waits, it checks Spotify's device list every second (every 2 seconds after 30 s) and starts the music as soon as the watch shows up.",
          "A watch that has just appeared in Spotify sometimes refuses the first play. VVake now tries again up to 3 times, with short pauses.",
          "Send Spotify report now includes timings, how long the watch waited, its audio output (speaker or headphones) and the route the request really took, so we can fix the next problem faster. Still no names, devices or songs.",
        ],
        fixed: [
          'Picking "this watch" for Spotify no longer fails silently. VVake used to send the music to the watch\'s old Spotify id, which Spotify refused. It now waits until Spotify really lists the watch, then starts the music there.',
          "When Spotify doesn't list the watch, the watch now says exactly what to do: in Spotify on the watch, pick Apple Watch (or this watch) as the device. Next to Try again you get Play on iPhone instead and Now Playing. VVake never switches to another device without asking.",
          'A first Play that went through a sleeping iPhone could end with "Your iPhone didn\'t answer". VVake now asks a second time on its own.',
        ],
      },
      fr: {
        improved: [
          "La montre se trouve plus vite dans Spotify : pendant l'attente, elle consulte la liste des appareils Spotify chaque seconde (toutes les 2 secondes après 30 s) et lance la musique dès que la montre y apparaît.",
          "Une montre qui vient d'apparaître dans Spotify refuse parfois la première lecture. VVake réessaie maintenant jusqu'à 3 fois, avec de courtes pauses.",
          "Envoyer un rapport Spotify inclut maintenant les temps de réponse, la durée d'attente de la montre, sa sortie audio (haut-parleur ou écouteurs) et le chemin réellement pris, pour corriger plus vite le prochain problème. Toujours sans nom, appareil ni morceau.",
        ],
        fixed: [
          "Choisir « cette montre » pour Spotify n'échoue plus en silence. VVake envoyait la musique à l'ancien identifiant Spotify de la montre, que Spotify refusait. Il attend maintenant que Spotify affiche vraiment la montre, puis y lance la musique.",
          "Quand Spotify n'affiche pas la montre, la montre dit exactement quoi faire : dans Spotify sur la montre, choisissez Apple Watch (ou cette montre) comme appareil. À côté de Réessayer, vous avez Plutôt sur l'iPhone et À l'écoute. VVake ne passe jamais sur un autre appareil sans vous demander.",
          "Une première Lecture passée par un iPhone en veille pouvait finir sur « Ton iPhone n'a pas répondu ». VVake redemande maintenant tout seul.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (41)",
    date: "2026-10-22",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          "Your coach now says your splits, times, paces, distances, points, heart rate and counts in her own recorded voice, on every account and offline, instead of the robot voice.",
          "The same recorded voice reads these lines on the Apple Watch, on Wear OS and in the web app at vvake.com.",
          "Get a better voice: in Coach › voice settings, how to install a better system voice for anything the coach hasn't recorded, with one tap to the voice settings on Android, and a one-time tip after a workout where the phone's voice had to step in.",
        ],
        improved: [
          "The coach's voice for these lines downloads once (a few MB, on Wi-Fi) and plays from your phone, so it starts at once even with no signal.",
        ],
      },
      fr: {
        added: [
          "Ton coach dit maintenant tes temps au kilomètre, tes temps, tes allures, tes distances, tes points, ton pouls et tes comptes avec sa propre voix enregistrée, pour tous les comptes et hors ligne, au lieu de la voix robotique.",
          "La même voix enregistrée lit ces lignes sur l'Apple Watch, sur Wear OS et dans l'appli web sur vvake.com.",
          "Obtenir une meilleure voix : dans Coach › réglages de la voix, comment installer une meilleure voix système pour ce que le coach n'a pas enregistré, avec un accès en un geste aux réglages de voix sur Android, et un conseil unique après une séance où la voix du téléphone a pris le relais.",
        ],
        improved: [
          "La voix du coach pour ces lignes se télécharge une fois (quelques Mo, en Wi-Fi) et se joue depuis ton téléphone : elle démarre tout de suite, même sans réseau.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (40)",
    date: "2026-10-22",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          'Coach plans: Free, VVake Coach Plus and the new VVake Coach Premium side by side (VVake Coach Plus › Compare plans), with the minute packs. Prices are shown as "Coming soon": nothing can be bought yet.',
          "VVake Coach Premium: 15 live coach minutes a week and everything in VVake Coach Plus. VVake Coach Plus keeps 5 live minutes a week.",
          "Minute packs of 5, 10 or 15 live coach minutes, for any plan, free included: used only after your weekly minutes, during a real workout, and valid 12 months.",
          'In the last minute of live coach, a small "+10 min" button appears between turns, once per workout, and never while the coach is talking (only once packs are on sale).',
          'Skipped a session? VVake asks once, kindly: "You skipped Tempo run · 45 min. Postpone it?" on Today, on top of your week, on vvake.com and as a notification (never at night, off when reminders are off). Tomorrow, Pick a day, Make it shorter today, or Skip it (no guilt). One tap, with Undo.',
          'Postponing places it smartly: your long day stays, hard days stay apart, nothing hard right before a race, and it comes back easy in a taper week. When the week is full, it tells you in one line what gives way ("Thursday\'s easy run moves to Saturday").',
          'Edit any planned session in one sheet: sport (your own trainings too), minutes and distance, type (easy, long, tempo, intervals, recovery, strength), a target zone with its heart range or an effort out of 10, day and time, a note. Duplicate it, remove it, or add a session on any day. A live summary shows what it will be: "Ride · 60 min · Zone 2 · Sat 9:00".',
          "Lock a session: automatic changes never move it.",
          'After an edit, your coach may add a gentle note ("3 hard days in a row: want me to rebalance?") with a one-tap rebalance. Your edit always stays.',
          "Apple Watch and Wear OS: the skipped question with Tomorrow or Skip it, and a quick change of today's session: shorter or longer, easier or harder, or another of your sports.",
          "No season? Your weekly plan is editable the same way, and Today follows your changes.",
          'Early testers: if you used VVake during the beta, your account is marked as an early tester for good, with a small "Early tester · VVake Coach Premium" badge in You, on the plans screen and on vvake.com/account.',
          "Beta and early testers have VVake Coach Premium during the beta, so everything can be tested. Nothing is charged.",
        ],
        improved: [
          'The live coach shows what\'s left as "12 of 15 min this week · 10 pack min" on the iPhone, Android, both watches and vvake.com/account.',
          "Beta testers get VVake Coach Premium automatically, so everything can be tested; nothing is charged.",
          "Today's suggestion starts at the time you set for the session, while it's still ahead.",
          "Feeling unwell: the skipped question suggests rest instead of moving the session.",
          "New names for the plans: Plus is now VVake Coach Plus, and the higher plan is VVake Coach Premium (Coach Plus and Coach Premium where space is tight), on the iPhone, Android, both watches and vvake.com.",
          "The plans page on the website moved to vvake.com/plans (the old /plus link still works).",
          "More of your coach's real voice: VVake Coach Plus now says up to 1,000 new characters a day in the coach's voice, VVake Coach Premium up to 2,000. With VVake Coach Premium, coach calls can go up to one a day.",
          'Searching settings for "Plus", "Premium" or the old names finds the plans.',
        ],
      },
      fr: {
        added: [
          "Formules du coach : Gratuit, VVake Coach Plus et le nouveau VVake Coach Premium côte à côte (VVake Coach Plus › Comparer les formules), avec les packs de minutes. Les prix sont affichés « Bientôt » : rien ne peut encore être acheté.",
          "VVake Coach Premium : 15 minutes de coach en direct par semaine et tout VVake Coach Plus. VVake Coach Plus garde 5 minutes par semaine.",
          "Packs de 5, 10 ou 15 minutes de coach en direct, pour toutes les formules, même gratuite : utilisés seulement après tes minutes de la semaine, pendant une vraie séance, et valables 12 mois.",
          "Dans la dernière minute du coach en direct, un petit bouton « +10 min » apparaît entre deux échanges, une fois par séance, jamais pendant que le coach parle (seulement quand les packs seront en vente).",
          "Une séance sautée ? VVake demande une fois, gentiment : « Tu as sauté Tempo course · 45 min. On la reporte ? » sur Aujourd’hui, en haut de ta semaine, sur vvake.com et en notification (jamais la nuit, coupée si les rappels le sont). Demain, Choisir un jour, Plus court aujourd’hui, ou La laisser (sans culpabilité). Un geste, avec Annuler.",
          "Le report trouve la bonne place : ton jour de sortie longue reste, les jours durs restent espacés, rien de dur juste avant une course, et elle revient en facile en semaine d’affûtage. Quand la semaine est pleine, une ligne dit ce qui bouge (« La course facile de jeudi passe au samedi »).",
          "Modifie n’importe quelle séance prévue sur un seul écran : sport (tes entraînements aussi), durée et distance, type (facile, longue, tempo, fractionné, récup, renfo), une zone cible avec sa fréquence cardiaque ou un effort sur 10, jour et heure, une note. Duplique-la, retire-la, ou ajoute une séance n’importe quel jour. Un résumé en direct montre le résultat : « Vélo · 60 min · Zone 2 · sam. 9:00 ».",
          "Verrouille une séance : les changements automatiques ne la bougent jamais.",
          "Après une modification, ton coach peut ajouter une note douce (« 3 jours durs d’affilée : je rééquilibre ? ») avec un rééquilibrage en un geste. Ta modification reste toujours.",
          "Apple Watch et Wear OS : la question de la séance sautée avec Demain ou La laisser, et un changement rapide de la séance du jour : plus courte ou plus longue, plus facile ou plus dure, ou un autre de tes sports.",
          "Pas de saison ? Ton plan de la semaine se modifie de la même façon, et Aujourd’hui suit tes changements.",
          "Testeurs pionniers : si tu as utilisé VVake pendant la bêta, ton compte est marqué testeur pionnier pour de bon, avec un petit badge « Testeur pionnier · VVake Coach Premium » dans Toi, sur l'écran des formules et sur vvake.com/account.",
          "Les testeurs de la bêta ont VVake Coach Premium pendant la bêta, pour tout tester. Rien n'est facturé.",
        ],
        improved: [
          "Le coach en direct affiche ce qu'il reste, par exemple « 12 sur 15 min cette semaine · 10 min de pack », sur l'iPhone, Android, les deux montres et vvake.com/account.",
          "Les testeurs de la bêta ont VVake Coach Premium automatiquement pour tout tester ; rien n'est facturé.",
          "La suggestion du jour démarre à l’heure que tu as fixée pour la séance, tant qu’elle est à venir.",
          "Pas en forme : la question de la séance sautée propose le repos plutôt que de la déplacer.",
          "Nouveaux noms pour les formules : Plus devient VVake Coach Plus, et la formule supérieure s'appelle VVake Coach Premium (Coach Plus et Coach Premium quand la place manque), sur l'iPhone, Android, les deux montres et vvake.com.",
          "La page des formules du site passe à vvake.com/plans (l'ancien lien /plus marche toujours).",
          "Plus de la vraie voix de ton coach : VVake Coach Plus dit jusqu'à 1 000 nouveaux caractères par jour avec la voix du coach, VVake Coach Premium jusqu'à 2 000. Avec VVake Coach Premium, les appels du coach peuvent aller jusqu'à un par jour.",
          "Chercher « Plus », « Premium » ou les anciens noms dans les réglages trouve les formules.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (39)",
    date: "2026-10-22",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          "Your season: tell your coach what you're training for (a 10K in August, a marathon, an Ironman, an ultra trail, getting stronger, or free training) and it plans the months ahead in phases: base, build, peak, taper, race and recovery.",
          "Several goals at once, each A (the big one), B (on the way) or C (for fun).",
          "The coach's review of every goal: realistic, a stretch or too risky, with the reasons in plain words, a readiness score, safer options you apply in one tap, and notes for your health. Move the date or your hours a week and the review updates at once.",
          "A season timeline by month, quarter, 6 months or year, with phases, races, test weeks and today.",
          "Your week: pick your sports and how often, the days you can train, a time slot per day and your hours a week.",
          'On the Plan tab, change the week yourself (move, swap, easier, shorter, remove, a day off, add a sport or one of your own trainings), or ask your coach: "easier week", "travelling Tuesday", "add a swim". You approve every change, can undo it, and see the history.',
          "When life happens (missed sessions, short sleep, sick, a race done), the plan proposes a change and waits for your OK.",
          'Race-week tips, a fitness test every few weeks that updates your zones, and "How did it go?" after a race with recovery planned.',
          "Share my season: your goal, the countdown and your phases as a card. No health data.",
          "On the Apple Watch and Wear OS: today's session with why it matters, the phase, the countdown to your goal and your target zones, plus a Season screen.",
        ],
        improved: [
          "Train now shows why today's session matters, its steps and the phase you're in, even on rest days.",
          "Today's goal card shows each goal's countdown, phase and readiness; the Week plan door starts with your phase.",
          "The weekly recap shows your goal's readiness change.",
          "The coach knows your season in chat, live and on calls.",
        ],
      },
      fr: {
        added: [
          "Votre saison : dites à votre coach ce que vous préparez (un 10 km en août, un marathon, un Ironman, un ultra-trail, devenir plus fort ou un entraînement libre) et il planifie les mois à venir en phases : fond, développement, pic, affûtage, course et récupération.",
          "Plusieurs objectifs à la fois, chacun A (le grand), B (en route) ou C (pour le plaisir).",
          "L'avis du coach sur chaque objectif : réaliste, ambitieux ou trop risqué, avec les raisons en clair, un score de forme, des options plus sûres à appliquer d'une touche et des notes pour votre santé. Changez la date ou vos heures par semaine et l'avis se met à jour aussitôt.",
          "Une frise de la saison par mois, trimestre, 6 mois ou année, avec les phases, les courses, les semaines de test et aujourd'hui.",
          "Votre semaine : choisissez vos sports et leur fréquence, vos jours d'entraînement, un créneau par jour et vos heures par semaine.",
          "Dans l'onglet Plan, modifiez la semaine vous-même (déplacer, inverser, plus facile, plus courte, retirer, un jour off, ajouter un sport ou un de vos entraînements), ou demandez à votre coach : « semaine plus légère », « en déplacement mardi », « ajoute une natation ». Vous validez chaque changement, pouvez l'annuler et voyez l'historique.",
          "Quand la vie s'en mêle (séances manquées, peu de sommeil, malade, une course terminée), le plan propose un changement et attend votre accord.",
          "Des conseils pour la semaine de course, un test de forme toutes les quelques semaines qui met vos zones à jour, et « Comment ça s'est passé ? » après une course, avec la récupération planifiée.",
          "Partager ma saison : votre objectif, le compte à rebours et vos phases en carte. Aucune donnée de santé.",
          "Sur l'Apple Watch et Wear OS : la séance du jour et pourquoi elle compte, la phase, le compte à rebours jusqu'à votre objectif et vos zones cibles, plus un écran Saison.",
        ],
        improved: [
          "S'entraîner montre pourquoi la séance du jour compte, ses étapes et votre phase, même les jours de repos.",
          "La carte des objectifs d'Aujourd'hui affiche le compte à rebours, la phase et la forme de chaque objectif ; la porte Semaine commence par votre phase.",
          "Le bilan de la semaine montre l'évolution de la forme pour votre objectif.",
          "Le coach connaît votre saison dans le chat, en direct et pendant les appels.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (38)",
    date: "2026-10-22",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          "Today's habits on Today: water, each meal and bedtime as chips you check off in one tap, with today's habit score and the points it earns tonight (on the web app too).",
          'A daily rhythm reminder ("Had lunch?") that rings while VVake is open shows a card at the top with Done ✓ · In 15 min · Not this time: answer it right there.',
          'Answers given on a notification or on the watch are confirmed with a quiet line when you open VVake ("Lunch logged ✓").',
          "On the Apple Watch, the reminder from your iPhone has its own Done ✓ · In 15 min · Not this time buttons: one tap, nothing to open.",
          "Where to train near me: find places to practise any sport around you (trailheads and hiking routes, pools and beaches, tracks and parks, bike paths, climbing gyms and crags, courts and pitches, gyms and studios, rinks, ski areas, water sports clubs and more), on a map and a list, nearest first.",
          "Each place shows its distance and direction, whether it is open now when its hours are known, and the surface and length of routes and paths.",
          "Tap a place for directions in Apple Maps or Google Maps, or Start here to begin that sport right away.",
          "Save your favourite spots on your phone; Today's session then suggests your spot for that sport.",
          'Ask your coach "Where can I swim near me?" and it answers with the nearest spots.',
          "Open it from the sport picker, from a sport's start screen and from today's session.",
          "On your watch, Spots near me lists the places your phone found for a sport, with distance, direction and an arrow; tap one for a big arrow and Open in Maps (Apple Watch and Wear OS, on Today and in the sport picker).",
          "VVake on the web: Places near me, with the same list and map in your browser.",
          "Brag cards come in three formats: Story (9:16), Post (4:5) and Square. Pick one before you share.",
          'Each card tells the story behind your numbers when it\'s true: "Fastest 5K this year", "First 10K on VVake", "Longest ride this month", "3rd in Montreal this week", or your camera reps.',
          "Each achievement has its own card: a personal best, a streak milestone, a ghost beaten, a challenge won, a training you made or joined, your city rank. Session cards take your sport's colours.",
          "Cards show your splits as a small bar chart and print their short vvake.com link.",
          "Now and then a card gets a special finish (a glow, a foil, confetti). You earn it with a personal best, a win or a streak milestone, and sometimes it just happens. It's only for looks: it costs nothing and gives no points.",
          "Pokes in a friend challenge: a poke, a brag (only when you're really ahead, and VVake writes the lead), a cheer, or your VVaker doing a little dance, flex or salute. You can send 3 a day to each person.",
          "Only the two people in the challenge see pokes. You can mute them or report them, blocks are respected, and they never ring at night or when Health says to keep effort easy.",
          "A result screen when a challenge ends. A win gets confetti and a happy tap, a loss gets kind words. The coach says a line in the app's voice (unless you turned the voice off). From there you can share, ask for a rematch, or send a cheer back.",
          "Challenge seasons, three months each, with badges for fun: first win, hat trick, comeback, revenge, good sport and more. They don't change your points.",
          'Challenge notifications that matter: when your friend accepts, in the last hours when it\'s close enough to turn around, and the result. "Answer now" on the notification opens a workout.',
          'You → Settings has a new "Challenge alerts" switch.',
          "Your city rank this week, from 10 people moving in your city, with a card to share it. Only your own place ever shows.",
          'Coaches see their week: "23 people trained your Leg Day this week", plus the latest joins, finishes and follows. Only people with a public profile are named; everyone else shows as "someone".',
          'Discover has a Trending sort and "This week\'s coaches".',
          'New share pages on vvake.com: "Think you can beat me?" after a challenge, and your city rank, each with its own preview picture.',
          "Sports & zones (You › Sports & zones): every sport now has its own heart-rate zones and its own pace or speed zones.",
          "Heart-rate zones per sport start automatic: your max is a little lower on a bike (−6 bpm), in the water (−12) and in arm-only sports (−15) than on a run.",
          "You can set a sport's zones yourself in bpm or in % of max, set your own max for that sport, and reset them any time.",
          "Pace zones show in each sport's unit: per km or mile for walking, running and hiking, km/h or mph for riding, per 100 m for swimming and per 500 m on the rower.",
          "Strength, yoga and team sports say pace is not used there.",
          "Effort by feel: when medicine or a device keeps your heart rate low or irregular, zones show how hard it should feel (the talk test) instead of beats, on the phone, both watches and the web.",
          "Learn from my workouts: after a few sessions of a sport, VVake suggests your max or your paces for it, and nothing changes until you tap to use them.",
          "Your coach can suggest new pace zones for a sport, and you approve or undo them like other coach suggestions.",
          "Your sport zones follow you to your Apple Watch, your Wear OS watch and vvake.com.",
          "Today opens on Train now: one tap starts today's session, or pick a sport, with your watch, GPS, strap and camera shown before you start.",
          "Four quick doors on Today: Challenge, Week plan, Coach and Habits, each with a live line (challenges to answer, your next session, today's habits).",
          "A new Points page explains VV points and rival points, how to get them and what's next, with your VVaker wearing its effect.",
          "Your points this week and your next milestone show on Today.",
          "After a session, its review opens with your VVaker celebrating, the points, your week, your goal and one next step.",
          "On Sunday evening and Monday, Today shows your week's recap, ready to share.",
          "Onboarding asks what brings you here and ends on your first week with a first action.",
          "The sport picker shows your sports first.",
          "You has a section index and a settings search, in English or French.",
          "You explains which device records what: watch, phone, strap or camera.",
          "\"Hear my coach\" in Coach › Coach voice (and in You on the web): play your coach's voice and see whether it was the real voice or your phone's.",
        ],
        improved: [
          "After tapping a reminder, the answer sheet also shows your other habits for today, one tap each, instead of sending you to the daily rhythm screen.",
          'On Android and Wear OS, a reminder answered with one of its buttons turns into a short "Logged ✓" that goes away by itself, instead of staying up as if nothing happened.',
          "Your exact position never leaves your phone: only a point rounded to about 1 km is used to search. Place data © OpenStreetMap contributors.",
          "Training challenge pages on vvake.com feel live: a countdown, the last hours, the final result with the winner, and a rematch button.",
          "Coach pages show how many people trained with the coach this week.",
          "Shared moments on vvake.com look like the card you posted, with one clear button to try VVake.",
          "Challenge links explain every step: invite, accept, live, result, rematch.",
          'Crew shows how far you are from your rival in plain words ("You\'re 300 m behind: one short loop does it."), and pokes sit right under each live challenge.',
          "Live workouts, camera workouts, Today and the training builder show the zones of the sport you're doing.",
          "With a heart rate outdoors, the workout screen also shows your pace zone.",
          "Pool swimming and the rower now have pace zones.",
          "Onboarding picks up where you left it, and the optional steps can be skipped.",
          "You is grouped into clear sections: Profile and VVaker, Progress, Points and rewards, Devices, Sports and zones, Habits, Privacy and safety, and App settings.",
          "The workout picker only warns about the heart sensor when you have neither a watch nor a strap, and links straight to pairing one.",
          "The app opens faster: account syncs start just after the first screen is up.",
          "Key taps answer with a light haptic, and it stays quiet when Reduce Motion is on.",
          "Clearer words: Train now, VV points, rival points, and Challenge a friend on Crew's plus button.",
          "Today shows the challenge that matters now (one to answer, a live duel, a fresh result) and your habits to tick in one tap, right under the doors.",
          "Where to train near me, Sports & zones and Coach voice are one tap from You and found by the settings search.",
          "One coach voice across the app: camera workouts (counts, countdowns, form tips, sets, rests, heart rests, the target zone), teaching a move, the daily move, the five-minute check-ins, the rematch offer and Siri answers said in the app now use your coach's real voice, like workout cues and calls.",
          "These lines are recorded once for everyone, so free accounts hear the coach's real voice for them too. Lines with your own words or exact numbers use the coach's voice with Plus.",
          "Your phone's own voice only stands in when the coach's voice can't load (offline), always for a whole sentence, and it is now the closest match installed: a woman's voice, US English or French from France.",
          "Your points at the end of a workout are said in the coach's voice, or shown on screen only, never in a second voice right after hers.",
          "French lines are recorded in French.",
          "Wear OS: the watch's own lines (the five-minute check-ins, energy, voice answers) use the coach's recorded voice too.",
          "The Apple Watch says its own lines (the five-minute check-in, your points, voice-command answers, the live coach's short replies) in your coach's real voice too, with the watch's voice only as a stand-in.",
        ],
        fixed: [
          'On iPhone, tapping a reminder opens its question with the three buttons again, instead of "This check has passed" and a trip to the You tab.',
          "Your rival's reactions on a live challenge show up again.",
          "The phone's live zone now uses the zones you set for that sport. Before, it ignored them and used the automatic zones.",
          "The VVaker effects page now says rival points instead of just points.",
          "A watch workout linked to a camera workout on the phone no longer talks at the same time as the phone: the phone speaks, the watch shows the lines.",
          "On both watches, the coach's check-in button now asks your coach for a real call (Plus) instead of playing a sample.",
        ],
      },
      fr: {
        added: [
          "Les habitudes du jour sur Aujourd'hui : l'eau, chaque repas et le coucher en pastilles à cocher d'une touche, avec le score d'habitude du jour et les points qu'il rapporte ce soir (sur l'app web aussi).",
          "Un rappel du rythme du jour (« Repas du midi pris ? ») qui sonne pendant que VVake est ouvert affiche une carte en haut avec Fait ✓ · Dans 15 min · Pas cette fois : répondez directement.",
          "Les réponses données sur une notification ou sur la montre sont confirmées discrètement à l'ouverture de VVake (« Repas du midi noté ✓ »).",
          "Sur l'Apple Watch, le rappel venu de l'iPhone a ses propres boutons Fait ✓ · Dans 15 min · Pas cette fois : une touche, rien à ouvrir.",
          "Où m'entraîner près d'ici : trouvez où pratiquer n'importe quel sport autour de vous (départs de sentiers et randonnées, piscines et plages, pistes et parcs, pistes cyclables, salles et sites d'escalade, terrains, salles de sport et studios, patinoires, domaines skiables, clubs nautiques et plus), sur une carte et une liste, du plus proche au plus loin.",
          "Chaque lieu indique sa distance et sa direction, s'il est ouvert maintenant quand ses horaires sont connus, et le revêtement et la longueur des parcours.",
          "Touchez un lieu pour l'itinéraire dans Plans ou Google Maps, ou Commencer ici pour lancer ce sport tout de suite.",
          "Gardez vos spots favoris sur votre téléphone ; la séance du jour vous propose alors votre spot pour ce sport.",
          "Demandez au coach « Où nager près de chez moi ? » et il répond avec les spots les plus proches.",
          "Ouvrez-le depuis le choix du sport, l'écran de départ d'un sport et la séance du jour.",
          "Sur votre montre, Spots près de moi liste les lieux trouvés par votre téléphone pour un sport, avec la distance, la direction et une flèche ; touchez-en un pour une grande flèche et l'ouvrir dans les cartes (Apple Watch et Wear OS, sur Aujourd'hui et dans le choix du sport).",
          "VVake sur le web : Lieux près de moi, avec la même liste et la même carte dans votre navigateur.",
          "Les cartes à partager existent en trois formats : Story (9:16), Post (4:5) et Carré. Choisis-en un avant de partager.",
          "Chaque carte raconte l'histoire derrière tes chiffres quand elle est vraie : « 5K le plus rapide de l'année », « Premier 10K sur VVake », « Sortie vélo la plus longue du mois », « 3e à Montréal cette semaine », ou tes répétitions à la caméra.",
          "Chaque exploit a sa carte : un record perso, un palier de série, un fantôme battu, un défi gagné, un entraînement créé ou rejoint, ton classement de ville. Les cartes de séance prennent les couleurs de ton sport.",
          "Les cartes montrent tes temps au kilomètre en petites barres et affichent leur lien court vvake.com.",
          "De temps en temps, une carte a une finition spéciale (une lueur, un reflet, des confettis). Tu la gagnes avec un record, une victoire ou un palier de série, et parfois elle arrive par surprise. C'est juste pour le look : ça ne coûte rien et ne donne aucun point.",
          "Les coucous dans un défi entre amis : un coucou, une frime (seulement quand tu es vraiment devant, et c'est VVake qui écrit l'avance), un bravo, ou ton VVaker qui danse, montre ses muscles ou salue. Tu peux en envoyer 3 par jour à chaque personne.",
          "Seules les deux personnes du défi voient les coucous. Tu peux les couper ou les signaler, les blocages sont respectés, et ils ne sonnent jamais la nuit ni quand Santé demande de garder un effort facile.",
          "Un écran de résultat à la fin d'un défi. Une victoire a ses confettis et une petite vibration, une défaite a des mots gentils. Le coach dit une phrase avec la voix de l'app (sauf si tu as coupé la voix). De là, tu peux partager, demander une revanche ou renvoyer un bravo.",
          "Des saisons de défis, de trois mois chacune, avec des badges pour le plaisir : première victoire, coup du chapeau, remontada, revanche, fair-play et d'autres. Ils ne changent pas tes points.",
          "Des notifications de défi qui comptent : quand ton ami accepte, dans les dernières heures quand c'est assez serré pour tout changer, et le résultat. « Réponds maintenant » sur la notification ouvre une séance.",
          "Toi → Réglages a un nouvel interrupteur « Alertes de défi ».",
          "Ton classement de ville cette semaine, dès 10 personnes qui bougent dans ta ville, avec une carte à partager. Seule ta place s'affiche, jamais celle des autres.",
          "Les coachs voient leur semaine : « 23 personnes ont fait ton « Leg Day » cette semaine », avec les dernières inscriptions, séances finies et abonnements. Seuls ceux qui ont un profil public sont nommés ; les autres s'affichent comme « quelqu'un ».",
          "Découvrir a un tri Tendance et « Les coachs de la semaine ».",
          "De nouvelles pages de partage sur vvake.com : « Tu crois pouvoir me battre ? » après un défi, et ton classement de ville, chacune avec sa propre image d'aperçu.",
          "Sports et zones (Vous › Sports et zones) : chaque sport a désormais ses propres zones cardiaques et ses propres zones d'allure ou de vitesse.",
          "Les zones cardiaques par sport sont d'abord automatiques : votre max est un peu plus bas à vélo (−6 bpm), dans l'eau (−12) et dans les sports des bras (−15) qu'en course.",
          "Vous pouvez régler vous-même les zones d'un sport en bpm ou en % du max, fixer votre max pour ce sport, et tout réinitialiser quand vous voulez.",
          "Les zones d'allure s'affichent dans l'unité de chaque sport : au km ou au mile pour la marche, la course et la randonnée, en km/h ou mph à vélo, aux 100 m en natation et aux 500 m au rameur.",
          "La musculation, le yoga et les sports collectifs indiquent que l'allure n'y est pas utilisée.",
          "Effort au ressenti : quand un médicament ou un appareil garde votre cœur bas ou irrégulier, les zones disent quelle sensation viser (test de la parole) au lieu des battements, sur le téléphone, les deux montres et le web.",
          "Apprendre de mes séances : après quelques séances d'un sport, VVake vous suggère votre max ou vos allures pour ce sport, et rien ne change tant que vous n'avez pas touché pour les utiliser.",
          "Votre coach peut proposer de nouvelles zones d'allure pour un sport, que vous approuvez ou annulez comme ses autres propositions.",
          "Vos zones par sport vous suivent sur votre Apple Watch, votre montre Wear OS et vvake.com.",
          "Aujourd'hui s'ouvre sur S'entraîner : un geste lance la séance du jour ou le choix d'un sport, avec la montre, le GPS, la ceinture et la caméra affichés avant le départ.",
          "Quatre accès rapides sur Aujourd'hui : Défi, Ma semaine, Coach et Habitudes, chacun avec une ligne à jour (défis à relever, prochaine séance, habitudes du jour).",
          "Une nouvelle page Points explique les points VV et les points de rival, comment les obtenir et la suite, avec votre VVaker et son effet.",
          "Vos points de la semaine et votre prochaine étape s'affichent sur Aujourd'hui.",
          "Après une séance, sa fiche s'ouvre sur votre VVaker qui fête ça, les points, votre semaine, votre objectif et une prochaine étape.",
          "Le dimanche soir et le lundi, Aujourd'hui montre le bilan de votre semaine, prêt à partager.",
          "L'accueil demande ce qui vous amène et se termine sur votre première semaine avec une première action.",
          "Le choix du sport montre vos sports en premier.",
          "Vous a un index des sections et une recherche des réglages, en français ou en anglais.",
          "Vous explique quel appareil enregistre quoi : montre, téléphone, ceinture ou caméra.",
          "« Écouter mon coach » dans Coach › Voix du coach (et dans Vous sur le web) : écoutez la voix de votre coach et voyez si c'était sa vraie voix ou celle du téléphone.",
        ],
        improved: [
          "Après avoir touché un rappel, la fiche de réponse montre aussi vos autres habitudes du jour, une touche chacune, au lieu de vous envoyer vers l'écran du rythme du jour.",
          "Sur Android et Wear OS, un rappel auquel vous répondez avec un de ses boutons devient un court « C'est noté ✓ » qui disparaît tout seul, au lieu de rester affiché comme si de rien n'était.",
          "Votre position exacte ne quitte jamais votre téléphone : seul un point arrondi à environ 1 km sert à la recherche. Données des lieux © les contributeurs d'OpenStreetMap.",
          "Les pages de défi sur une séance, sur vvake.com, sont en direct : un compte à rebours, les dernières heures, le résultat final avec le gagnant, et un bouton revanche.",
          "Les pages de coach montrent combien de personnes se sont entraînées avec le coach cette semaine.",
          "Les moments partagés sur vvake.com ressemblent à la carte publiée, avec un seul bouton clair pour essayer VVake.",
          "Les liens de défi expliquent chaque étape : invitation, acceptation, en direct, résultat, revanche.",
          "Crew dit en mots simples où tu en es face à ton adversaire (« Tu es à 300 m : une petite boucle suffit. »), et les coucous sont juste sous chaque défi en cours.",
          "Les séances en direct, les séances caméra, Aujourd'hui et le créateur d'entraînements montrent les zones du sport en cours.",
          "Avec un cardio en extérieur, l'écran de séance montre aussi votre zone d'allure.",
          "La natation en piscine et le rameur ont maintenant des zones d'allure.",
          "L'accueil reprend là où vous l'avez laissé, et les étapes facultatives se passent.",
          "Vous est rangé en sections claires : Profil et VVaker, Progrès, Points et récompenses, Appareils, Sports et zones, Habitudes, Confidentialité et sécurité, et Réglages de l'app.",
          "Le choix du sport ne prévient du capteur cardio que sans montre ni ceinture, avec un lien direct pour en associer une.",
          "L'app s'ouvre plus vite : les synchros du compte démarrent juste après le premier écran.",
          "Les gestes clés répondent par une légère vibration, coupée quand Réduire les animations est activé.",
          "Des mots plus clairs : S'entraîner, points VV, points de rival, et Défier un ami sur le bouton plus de Crew.",
          "Aujourd'hui montre le défi du moment (à relever, un duel en cours, un résultat tout frais) et vos habitudes à cocher d'un geste, juste sous les accès rapides.",
          "Où s'entraîner près de moi, Sports et zones et Voix du coach sont à un geste depuis Vous et se trouvent avec la recherche des réglages.",
          "Une seule voix de coach dans toute l'app : les séances caméra (comptes, décomptes, conseils de posture, séries, repos, repos selon le cœur, zone visée), l'apprentissage d'un mouvement, le mouvement du jour, les points d'étape toutes les cinq minutes, la proposition de revanche et les réponses de Siri dites dans l'app utilisent maintenant la vraie voix de votre coach, comme les annonces de séance et les appels.",
          "Ces phrases sont enregistrées une fois pour tout le monde : les comptes gratuits entendent aussi la vraie voix du coach pour elles. Les phrases avec vos propres mots ou des chiffres exacts passent dans la voix du coach avec Plus.",
          "La voix du téléphone ne prend le relais que si la voix du coach ne peut pas se charger (hors ligne), toujours pour une phrase entière, et c'est maintenant la plus proche installée : une voix de femme, en anglais américain ou en français de France.",
          "Vos points en fin de séance sont dits avec la voix du coach, ou seulement affichés, jamais avec une deuxième voix juste après la sienne.",
          "Les phrases en français sont enregistrées en français.",
          "Wear OS : les phrases que la montre dit elle-même (points d'étape, énergie, réponses vocales) passent aussi dans la vraie voix du coach.",
          "L'Apple Watch dit aussi ses propres phrases (le point d'étape toutes les cinq minutes, vos points, les réponses aux commandes vocales, les réponses courtes du coach en direct) avec la vraie voix de votre coach, la voix de la montre ne servant que de relais.",
        ],
        fixed: [
          "Sur iPhone, toucher un rappel ouvre de nouveau sa question avec les trois boutons, au lieu de « Ce rappel est passé » et d'un détour par l'onglet Toi.",
          "Les réactions de ton adversaire sur un défi en cours s'affichent à nouveau.",
          "La zone en direct du téléphone utilise maintenant les zones que vous avez réglées pour ce sport. Avant, il les ignorait et prenait les zones automatiques.",
          "La page des effets VVaker parle maintenant de points de rival et plus seulement de points.",
          "Une séance sur la montre liée à une séance caméra sur le téléphone ne parle plus en même temps que le téléphone : le téléphone parle, la montre affiche les phrases.",
          "Sur les deux montres, le bouton d'appel du coach demande maintenant un vrai appel à votre coach (Plus) au lieu de jouer un exemple.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (37)",
    date: "2026-10-21",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          'Teach VVake a new move. In front of the camera, do it 3 to 5 times (or hold the position a few seconds), then 3 more to check that VVake counts it right. Give it a name and an icon. From then on VVake counts it in your sets and recognises it in "Just start moving". VVake keeps no video and no picture, only numbers about how your joints moved.',
          "Build your own video training. Pick a move for each set (one from VVake or one you taught), the reps or the hold time, the intensity (a heart-rate zone, or an effort out of 10 without a sensor) and the rest. Add rounds, a name, a description and a level. VVake estimates how long it takes.",
          "Your trainings run hands-free like the built-in routines: each move's demo plays twice (your own moves show the rep you taught), and the coach says the target zone. During a set the screen shows whether your heart is below, in or above the target, and a calm line reminds you now and then.",
          "On the watch, during a training, you see the current set, the target and the target zone, with your heart zone against it.",
          "Share a training with a link. Friends open it in the app or on vvake.com, where it also runs in the browser with the webcam. The moves you taught travel with it.",
          "Challenge friends to beat your score on your training, for 24 hours, 3 days or a week, with a leaderboard.",
          "A brag card for your training: how many people trained it, total reps, heart points and your coach score.",
          "Discover: search trainings and coaches by name, sport, level or city. Join a training to add it to your plan, follow coaches, and see their profile.",
          "Coach points: when other people finish your training with their heart rate from a watch or strap, you get 5 points each time (100 a day at most). Each person counts once a week per training.",
          "Public profile, if you want one: a handle, a short bio and your public trainings. It's off until you turn it on.",
          "Report or block: you can report any training, move or profile, and block its author.",
        ],
        improved: [
          '"Just start moving" now recognises every move the camera can count, plus planks, wall sits and stretches once you\'re still in them. It waits until it\'s sure, so it no longer names a squat "deadlift" when it starts.',
          "Push-ups need a straight body line and a burpee's plank needs your hands down, so a bent-over row or a sit-up isn't counted as one.",
        ],
        fixed: ["Free training's first guess no longer depends on when it starts looking."],
      },
      fr: {
        added: [
          "Apprenez un nouveau mouvement à VVake. Devant la caméra, faites-le 3 à 5 fois (ou tenez la position quelques secondes), puis 3 fois de plus pour vérifier que VVake le compte bien. Donnez-lui un nom et une icône. Ensuite, VVake le compte dans vos séries et le reconnaît dans « Commence simplement à bouger ». VVake ne garde aucune vidéo ni aucune image, seulement des chiffres sur le mouvement de vos articulations.",
          "Créez votre propre entraînement vidéo. Pour chaque série, choisissez le mouvement (un de VVake ou un des vôtres), les répétitions ou le temps de maintien, l'intensité (une zone cardiaque, ou un effort sur 10 sans capteur) et le repos. Ajoutez des tours, un nom, une description et un niveau. VVake estime sa durée.",
          "Vos entraînements se déroulent sans les mains, comme les routines intégrées : la démo de chaque mouvement passe deux fois (vos mouvements montrent la répétition que vous avez apprise à VVake), et le coach annonce la zone visée. Pendant une série, l'écran indique si votre cœur est sous la zone, dedans ou au-dessus, et une phrase calme vous le rappelle de temps en temps.",
          "Sur la montre, pendant un entraînement, vous voyez la série en cours, l'objectif et la zone visée, avec votre zone cardiaque en face.",
          "Partagez un entraînement avec un lien. Vos amis l'ouvrent dans l'app ou sur vvake.com, où il se lance aussi dans le navigateur avec la webcam. Les mouvements que vous avez appris l'accompagnent.",
          "Défiez vos amis de battre votre score sur votre entraînement, pendant 24 heures, 3 jours ou une semaine, avec un classement.",
          "Une carte à partager pour votre entraînement : le nombre de personnes qui l'ont fait, le total de répétitions, les points cardio et votre score de coach.",
          "Découvrir : cherchez des entraînements et des coachs par nom, sport, niveau ou ville. Rejoignez un entraînement pour l'ajouter à votre programme, suivez des coachs et voyez leur profil.",
          "Points de coach : quand d'autres personnes terminent votre entraînement avec leur fréquence cardiaque d'une montre ou d'une ceinture, vous gagnez 5 points à chaque fois (100 par jour au maximum). Chaque personne compte une fois par semaine et par entraînement.",
          "Un profil public si vous le souhaitez : un pseudo, une courte bio et vos entraînements publics. Il reste désactivé tant que vous ne l'activez pas.",
          "Signaler ou bloquer : vous pouvez signaler un entraînement, un mouvement ou un profil, et bloquer son auteur.",
        ],
        improved: [
          "« Commence simplement à bouger » reconnaît maintenant tous les mouvements que la caméra sait compter, ainsi que la planche, la chaise et les étirements une fois que vous êtes immobile dans la position. Il attend d'être sûr, donc il n'appelle plus un squat « soulevé de terre » au début.",
          "Les pompes demandent un corps aligné et la planche du burpee les mains au sol : un rowing buste penché ou un redressement assis ne compte plus comme l'un d'eux.",
        ],
        fixed: ["La première proposition de l'entraînement libre ne dépend plus du moment où il commence à regarder."],
      },
    },
  },
  {
    version: "1.0.0 (36)",
    date: "2026-10-21",
    channel: "beta",
    devices: ["iphone", "android"],
    notes: {
      en: {
        added: [
          "During a camera workout, your heart rate now shows live on screen when your watch or a Bluetooth heart-rate strap sends it: the beats per minute in big numbers, the zone's colour and name (your own zones when you set them), and whether it comes from the watch or the strap.",
          'If the heart rate stops arriving for 15 seconds, the screen says "No heart signal" instead of showing an old number.',
          "Rests now follow your heart: if it's still high when the rest ends, the coach gives you 15 more seconds (45 at most), and in a long rest it starts the next set sooner once your heart has recovered. The interval routine keeps its rests short.",
          "The summary shows your heart effort: average and maximum heart rate and the time in each zone.",
        ],
        improved: [
          "The summary now says which points the workout earns: heart points when your watch or strap recorded your heart rate, camera points otherwise. They're never added together.",
          "If the watch can't start its workout, a paired heart-rate strap takes over the heart rate.",
        ],
        fixed: [
          "The rest timer, the hold timer, the rep count and the 3, 2, 1 always fit on one line, also on small phones and with large text.",
          'Free training now recognises your moves: with "Just start moving", VVake names the move you\'re doing and counts it (it never did on the phone or the web).',
          "The camera workout's header and its close button no longer sit under the clock, the notch or the Dynamic Island: the ✕ is always easy to tap.",
          "Every screen now keeps clear of the clock, the notch or the Dynamic Island, the home bar, and Android's status bar, camera cutout and navigation bar, in the same way everywhere.",
          "Sheets such as VVake Plus and Rewards no longer leave an extra empty band at the top on iPhone.",
          "The sheets that slide up from the bottom (music, voice commands, ending a workout) stay above the home bar and Android's navigation buttons.",
          '"Pick a move" in the camera workout and "Add a sport" keep their buttons clear of the system bars on Android.',
          "Your VVaker no longer disappears from Today, You and the other screens after a camera workout or an app update.",
          "If your VVaker's picture is missing on the phone, the cast stand-in shows while your own picture downloads again, for free.",
        ],
      },
      fr: {
        added: [
          "Pendant une séance caméra, votre fréquence cardiaque s'affiche en direct quand votre montre ou une ceinture cardio Bluetooth l'envoie : les battements par minute en grand, la couleur et le nom de la zone (vos propres zones si vous les avez réglées), et sa source, montre ou ceinture.",
          "Si la fréquence cardiaque n'arrive plus pendant 15 secondes, l'écran indique « Pas de signal cardiaque » au lieu d'un ancien chiffre.",
          "Les repos suivent votre cœur : s'il est encore haut à la fin du repos, le coach vous laisse 15 secondes de plus (45 au maximum), et pendant un long repos il lance la série suivante plus tôt une fois votre cœur récupéré. La routine par intervalles garde ses repos courts.",
          "Le résumé montre votre effort cardiaque : fréquence moyenne et maximale, et le temps passé dans chaque zone.",
        ],
        improved: [
          "Le résumé indique maintenant quels points la séance rapporte : des points cœur quand votre montre ou votre ceinture a enregistré votre cœur, sinon des points caméra. Ils ne s'additionnent jamais.",
          "Si la montre ne peut pas lancer sa séance, une ceinture cardio appairée prend le relais pour la fréquence cardiaque.",
        ],
        fixed: [
          "Le minuteur de repos, celui des maintiens, le nombre de répétitions et le 3, 2, 1 tiennent toujours sur une seule ligne, aussi sur les petits téléphones et avec le texte agrandi.",
          "L'entraînement libre reconnaît maintenant vos mouvements : avec « Bouge, je reconnais », VVake nomme le mouvement que vous faites et le compte (ce n'était jamais le cas sur le téléphone ni sur le web).",
          "L'en-tête de la séance caméra et son bouton de fermeture ne passent plus sous l'heure, l'encoche ou la Dynamic Island : le ✕ se touche toujours facilement.",
          "Chaque écran reste maintenant à l'écart de l'heure, de l'encoche ou de la Dynamic Island, de la barre d'accueil, et de la barre d'état, de la découpe de la caméra et de la barre de navigation d'Android, de la même façon partout.",
          "Les fenêtres comme VVake Plus et Récompenses ne laissent plus de bande vide en haut sur iPhone.",
          "Les fenêtres qui montent du bas (musique, commandes vocales, fin de séance) restent au-dessus de la barre d'accueil et des boutons de navigation d'Android.",
          "« Choisir un mouvement » dans la séance caméra et « Ajouter un sport » gardent leurs boutons à l'écart des barres du système sur Android.",
          "Votre VVaker ne disparaît plus d’Aujourd’hui, de Toi et des autres écrans après une séance caméra ou une mise à jour de l'app.",
          "Si l'image de votre VVaker manque sur le téléphone, le remplaçant du casting s'affiche le temps que la vôtre se télécharge à nouveau, gratuitement.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (35)",
    date: "2026-10-21",
    channel: "beta",
    devices: ["iphone", "android"],
    notes: {
      en: {
        added: [
          "Camera workouts are now hands-free. Tap Start once, then step back: the phone runs the whole workout and you never need to come back to it.",
          "Before each new move, its demo plays full screen twice: your VVaker does the move, with its name, the target (reps or seconds) and one key tip. Then a 3, 2, 1 and counting starts.",
          "Each set ends by itself when you reach the target, when a hold's time is up, or when you stop moving for a few seconds. The rest timer runs on its own, then the next set or the next move starts.",
          "During the rest you see the next move doing itself in a small preview.",
          '"Just start moving" now recognises the move you\'re doing, ends the set when you stop, starts a new set when you move again, and switches by itself when you change moves.',
          "When the workout is done, the summary saves itself after 20 seconds unless you touch the screen.",
        ],
        improved: [
          "The rep count, the move's name and the rest timer are much bigger, readable from 2 to 3 metres.",
          "Weights are no longer asked during the workout. Each weighted set starts with the last weight you used for that move, and you can change the weights once on the summary if you like.",
          "Moves the camera can't count, like calf raises, become timed sets that move on by themselves.",
          "The +1 and −1 buttons are still there to fix a count, but you never need them.",
        ],
        fixed: ["A set with nothing counted no longer waits forever for a tap: after a minute the workout moves on."],
      },
      fr: {
        added: [
          "Les séances caméra se font maintenant mains libres. Appuyez une fois sur Démarrer, puis reculez : le téléphone mène toute la séance et vous n'avez plus besoin d'y revenir.",
          "Avant chaque nouveau mouvement, sa démonstration passe deux fois en plein écran : votre VVaker fait le mouvement, avec son nom, l'objectif (répétitions ou secondes) et un conseil clé. Puis 3, 2, 1, et le comptage commence.",
          "Chaque série se termine toute seule quand vous atteignez l'objectif, quand le temps d'un maintien est écoulé, ou quand vous arrêtez de bouger quelques secondes. Le repos se décompte tout seul, puis la série ou le mouvement suivant démarre.",
          "Pendant le repos, une petite fenêtre montre le mouvement suivant.",
          "« Bouge, je reconnais » reconnaît maintenant le mouvement que vous faites, termine la série quand vous vous arrêtez, en commence une nouvelle quand vous reprenez, et change tout seul quand vous changez de mouvement.",
          "À la fin de la séance, le résumé s'enregistre tout seul au bout de 20 secondes, sauf si vous touchez l'écran.",
        ],
        improved: [
          "Le nombre de répétitions, le nom du mouvement et le minuteur de repos sont beaucoup plus grands, lisibles à 2 ou 3 mètres.",
          "Les charges ne sont plus demandées pendant la séance. Chaque série avec charge reprend la dernière charge utilisée pour ce mouvement, et vous pouvez les modifier une fois sur le résumé si vous le souhaitez.",
          "Les mouvements que la caméra ne peut pas compter, comme les extensions des mollets, deviennent des séries chronométrées qui s'enchaînent toutes seules.",
          "Les boutons +1 et −1 restent là pour corriger un compte, mais vous n'en avez jamais besoin.",
        ],
        fixed: ["Une série où rien n'est compté n'attend plus un appui indéfiniment : au bout d'une minute, la séance passe à la suite."],
      },
    },
  },
  {
    version: "1.0.0 (34)",
    date: "2026-10-21",
    channel: "beta",
    devices: ["iphone", "android"],
    notes: {
      en: {
        added: [
          'New setting in camera workouts: "Show my body outline". When it\'s on, the stick figure shows for 35 seconds to help you get in position, then fades out so you can train.',
          '"Show outline" brings the stick figure back for 35 seconds, and it also comes back by itself when the camera lost you for a few seconds.',
        ],
        improved: [
          "Camera workouts now count from your shoulders, arms, hips and knees. Your head and feet can be out of the picture or hard to see.",
          'Positioning tips are written on the screen and name what the camera can\'t see, for example "Tilt the phone down or step back: your knees are cut off". Other tips suggest more light or turning side-on for moves that need it.',
          "The voice says one short positioning line when the camera starts, and one reminder at most if you're still not in view after 20 seconds. It no longer talks about framing during your sets.",
        ],
        fixed: [
          "Lunges, wall sits, planks and other leg moves no longer miss reps or stop the timer when the camera can't see your feet.",
          "Quick checks during rest (\"hands on your head\") pass even when the camera can't see your head, and you're no longer asked to touch a knee that's out of the picture.",
        ],
      },
      fr: {
        added: [
          "Nouveau réglage dans les séances caméra : « Afficher ma silhouette ». Quand il est activé, le bonhomme en traits s'affiche 35 secondes pour vous aider à vous placer, puis s'efface pour vous laisser vous entraîner.",
          "« Afficher la silhouette » fait revenir le bonhomme pendant 35 secondes. Il revient aussi tout seul quand la caméra vous a perdu quelques secondes.",
        ],
        improved: [
          "Les séances caméra comptent maintenant à partir de vos épaules, bras, hanches et genoux. Votre tête et vos pieds peuvent sortir du cadre ou être mal vus.",
          "Les conseils de placement s'affichent à l'écran et disent ce que la caméra ne voit pas, par exemple « Incline le téléphone vers le bas ou recule : tes genoux sont coupés ». D'autres conseils proposent plus de lumière, ou de se mettre de profil pour les mouvements qui le demandent.",
          "La voix dit une seule phrase courte pour vous placer quand la caméra démarre, et au plus un rappel si vous n'êtes toujours pas dans le cadre après 20 secondes. Elle ne parle plus du cadrage pendant vos séries.",
        ],
        fixed: [
          "Les fentes, la chaise contre le mur, le gainage et les autres mouvements de jambes ne ratent plus de répétitions et n'arrêtent plus le chrono quand la caméra ne voit pas vos pieds.",
          "Les petits contrôles pendant le repos (« mains sur la tête ») passent même quand la caméra ne voit pas votre tête, et on ne vous demande plus de toucher un genou hors du cadre.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (33)",
    date: "2026-10-20",
    channel: "beta",
    devices: ["iphone", "android"],
    notes: {
      en: {
        improved: [
          'Picking Strength, Core, HIIT, Yoga or Mobility now asks first: "With the camera (counts your reps)" or "Watch / heart only", and remembers your choice for that sport.',
          "The workout picker has a Camera workout tile, and Today has a full Camera workout button instead of a small link.",
          "A camera workout starts with a camera step: it explains why, asks for the camera, then shows you live with your skeleton, the framing guide and your VVaker copying you before you press Start.",
          'With a watch paired, "Wear your watch for heart rate" sits right by the camera step and is on by default.',
        ],
        fixed: [
          "Starting a strength workout no longer skips the camera without saying so: the camera mode was easy to miss.",
          "The camera workout never shows a blank screen: camera off (with Open Settings), no camera, an app update needed, the camera not starting, or nobody in the picture (too dark or too close) each say what to do.",
        ],
      },
      fr: {
        improved: [
          "Choisir Musculation, Gainage, HIIT, Yoga ou Mobilité demande d'abord : « Avec la caméra (compte vos répétitions) » ou « Montre / cœur seulement », et retient votre choix pour ce sport.",
          "Le choix du sport a une tuile Séance caméra, et Aujourd'hui un vrai bouton Séance caméra au lieu d'un petit lien.",
          "Une séance caméra commence par une étape caméra : elle explique pourquoi, demande la caméra, puis vous montre en direct avec votre squelette, le cadre et votre VVaker qui vous imite avant d'appuyer sur Démarrer.",
          "Avec une montre jumelée, « Portez votre montre pour le rythme cardiaque » est juste à côté de l'étape caméra et activé par défaut.",
        ],
        fixed: [
          "Lancer une séance de musculation ne passe plus à côté de la caméra sans le dire : le mode caméra était facile à manquer.",
          "La séance caméra ne montre jamais d'écran vide : caméra refusée (avec Ouvrir Réglages), pas de caméra, mise à jour nécessaire, caméra qui ne démarre pas, ou personne dans le cadre (trop sombre ou trop près) disent chacun quoi faire.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (32)",
    date: "2026-10-20",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          "Heart-rate strap on the phone: pair any Bluetooth heart-rate strap or arm band in You › Heart-rate strap (live bpm, battery, forget). The phone reconnects to it at your next workout.",
          "With a strap, phone workouts and camera workouts record your heart rate like the watch does, and earn heart points (never prizes).",
          'Camera workout + watch = one session: turn on "Wear your watch for heart rate" and your watch starts a linked workout. It shows "Linked to camera workout", your heart rate and the phone\'s rep count, and it ends or is discarded with the phone.',
        ],
        improved: [
          "A camera workout with your watch is one session in your journal: the watch's heart rate and calories with the camera's sets, reps and loads, and the full heart points.",
          "Camera points without a heart sensor: 1 a counted minute from 5 minutes, at most 15 a day (no session or weekly limit any more).",
        ],
        fixed: [
          "A camera workout and the watch session recorded at the same time could count twice, depending on which one synced first. They now count once, in whatever order they arrive.",
        ],
      },
      fr: {
        added: [
          "Ceinture cardio sur le téléphone : jumelez une ceinture ou un brassard cardio Bluetooth dans Vous › Ceinture cardio (bpm en direct, batterie, oublier). Le téléphone s'y reconnecte à la séance suivante.",
          "Avec une ceinture, les séances au téléphone et les séances caméra enregistrent votre fréquence cardiaque comme la montre, et rapportent des points cardio (jamais de prix).",
          "Séance caméra + montre = une seule séance : activez « Porte ta montre pour le cardio » et la montre lance une séance liée. Elle affiche « Lié à l'entraînement caméra », votre fréquence cardiaque et le compte de répétitions du téléphone, et se termine ou s'annule avec le téléphone.",
        ],
        improved: [
          "Une séance caméra avec votre montre est une seule séance dans votre journal : la fréquence cardiaque et les calories de la montre avec les séries, répétitions et charges de la caméra, et les points cardio complets.",
          "Points caméra sans capteur cardio : 1 par minute comptée à partir de 5 minutes, 15 au plus par jour (plus de limite par séance ni par semaine).",
        ],
        fixed: [
          "Une séance caméra et la séance de la montre enregistrées en même temps pouvaient compter deux fois, selon celle qui se synchronisait en premier. Elles comptent maintenant une seule fois, dans n'importe quel ordre.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (31)",
    date: "2026-10-20",
    channel: "beta",
    devices: ["iphone", "android"],
    notes: {
      en: {
        added: [
          "Camera workout: prop your phone 2–3 m away and VVake counts your reps and holds from your pose, no watch or phone to wear.",
          "It knows bodyweight moves, weights (dumbbell, barbell, kettlebell; you enter the load per set) and stretches, or recognises your move when you just start.",
          "The coach voice gives form cues (depth, knees, back, elbows, lockout, left and right even) and follows your workout voice switch.",
          "Sets, rest timer, routines and today's strength, core or mobility plan; your VVaker moves with you on screen.",
          'Without a heart sensor it earns small points (at most 15 a session, 45 a week, with quick live checks like "raise your left arm"), never prizes; wear your watch and its session carries the heart points.',
          "The video never leaves your phone and nothing is recorded: only the counts are saved with the session.",
        ],
      },
      fr: {
        added: [
          "Séance caméra : posez votre téléphone à 2–3 m et VVake compte vos répétitions et vos maintiens à partir de votre posture, sans montre ni téléphone sur vous.",
          "Elle connaît les mouvements au poids du corps, les charges (haltères, barre, kettlebell ; vous saisissez la charge à chaque série) et les étirements, ou reconnaît votre mouvement quand vous commencez.",
          "La voix du coach corrige votre posture (profondeur, genoux, dos, coudes, verrouillage, équilibre gauche-droite) et suit votre réglage de voix pendant la séance.",
          "Séries, minuteur de repos, routines et votre plan du jour en renfo, gainage ou mobilité ; votre VVaker bouge avec vous à l'écran.",
          "Sans capteur cardiaque elle rapporte quelques points (15 au plus par séance, 45 par semaine, avec de petits contrôles en direct comme « levez le bras gauche »), jamais de prix ; avec votre montre, c'est sa séance qui porte les points cardio.",
          "La vidéo ne quitte jamais votre téléphone et rien n'est enregistré : seuls les comptes sont gardés avec la séance.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (30)",
    date: "2026-10-19",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        fixed: [
          "Spotify just opened on your watch, nothing playing yet: VVake now shows the last song you played, and Play starts it on the watch (inside its playlist or album, or your Liked Songs). No more trip back to Spotify to press Play there first.",
          "The same on the phone's player bar: with Spotify open but nothing loaded, the last song shows and Play starts it.",
          "If Play still can't start the music, the watch now says why and offers Send Spotify report, so we can see exactly what Spotify answered (no names, devices or songs are sent).",
        ],
      },
      fr: {
        fixed: [
          "Spotify vient d'être ouvert sur la montre et rien ne joue encore : VVake affiche maintenant le dernier morceau écouté, et Lecture le lance sur la montre (dans sa playlist ou son album, ou vos Titres likés). Plus besoin de repasser par Spotify pour appuyer sur Lecture.",
          "Pareil dans le lecteur du téléphone : Spotify ouvert mais rien de chargé, le dernier morceau s'affiche et Lecture le lance.",
          "Si Lecture n'arrive toujours pas à lancer la musique, la montre dit pourquoi et propose Envoyer un rapport Spotify, pour qu'on voie exactement ce que Spotify a répondu (sans nom, appareil ni morceau).",
        ],
      },
    },
  },
  {
    version: "1.0.0 (29)",
    date: "2026-10-18",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        improved: [
          "Picking a device in Play on now starts the music there, not just moves it.",
          "With nothing playing anywhere, the watch offers Play on this watch or On phone, instead of sending you to your phone.",
          "Apple Watch: if Spotify isn't open on the watch, VVake asks once to open Spotify there, then starts the music by itself as soon as Spotify shows the watch.",
          "Wear OS: picking this watch opens Spotify's watch app for you, then starts the music on the watch.",
        ],
        fixed: [
          'Siri answers VVake commands right away instead of "Something went wrong": starting a workout, pausing, music and the coach all reply in under a second, and the app finishes the rest.',
          'Say the app\'s name and a sport to start it: "Wake run", "Wake walk", or in French "Wake marche", "Wake course", "Wake démarre une course".',
          'Siri finds your sport in English and in French whatever language your iPhone is set to (for example "marche" with Siri in French on an English iPhone).',
          "When the coach takes longer than Siri waits, VVake says the answer itself instead of it being lost.",
          "Spotify plays where you picked: choose your watch, your phone or a speaker in Play on, press Play, and the music starts there, never somewhere else.",
          "If Spotify can't reach the device you picked, the watch says so and offers Try again instead of playing on another device.",
        ],
      },
      fr: {
        improved: [
          "Choisir un appareil dans Écouter sur y lance maintenant la musique, au lieu de seulement l'y déplacer.",
          "Quand rien ne joue nulle part, la montre propose Écouter sur cette montre ou Sur le téléphone, au lieu de vous envoyer vers votre téléphone.",
          "Apple Watch : si Spotify n'est pas ouvert sur la montre, VVake demande une fois de l'y ouvrir, puis lance la musique tout seul dès que Spotify affiche la montre.",
          "Wear OS : choisir cette montre ouvre l'app Spotify de la montre pour vous, puis lance la musique sur la montre.",
        ],
        fixed: [
          "Siri répond tout de suite aux commandes VVake au lieu de « Un problème est survenu » : lancer une séance, la pause, la musique et le coach répondent en moins d'une seconde, et l'app termine le reste.",
          "Dites le nom de l'app et un sport pour le lancer : « Wake marche », « Wake course », « Wake démarre une course », ou en anglais « Wake run ».",
          "Siri trouve votre sport en français et en anglais quelle que soit la langue de l'iPhone (par exemple « marche » avec Siri en français sur un iPhone en anglais).",
          "Quand le coach met plus de temps que Siri n'attend, VVake dit la réponse lui-même au lieu de la perdre.",
          "Spotify joue là où vous l'avez choisi : choisissez votre montre, votre téléphone ou une enceinte dans Écouter sur, appuyez sur Lecture, et la musique démarre là, jamais ailleurs.",
          "Si Spotify ne joint pas l'appareil choisi, la montre le dit et propose Réessayer au lieu de jouer sur un autre appareil.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (28)",
    date: "2026-10-17",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          'Turn the coach\'s voice off in one tap during a workout: the speaker in the top corner of the workout screen silences it at once (what it was saying stops). Tap again to turn it back on, or hold for "Essential only" (start, pause, end and a zone 5 warning). Your choice stays for your next workouts and follows you to your iPhone.',
          "Speed zones on Apple Watch: when there's no heart rate, your zone now comes from your speed, set per sport in You → Speed zones (your easy and hard pace). They guide you and the coach's cues; points still need a heart rate.",
          'Wear OS: a voice switch on the workout screen. One tap on the voice button (top right of the controls page, and in the workout controls from any page) silences the coach at once; tap again to bring it back. Hold it for "Essential only": just the start, pause, end and a zone 5 warning. Your choice is kept for your next workout and follows you to your phone.',
          "Wear OS: speed zones without a heart rate. On a walk, run, hike or ride with GPS but no heart reading, your zone now comes from your speed over the last 30 seconds, marked with a speedometer, and the coach's zone cues follow it. Set your easy and hard pace for each sport in You → Speed zones (the crown or − / +, a preview of the five zones, Reset to default). Points still need a heart rate.",
          "Speed zones per sport: set your easy and hard pace (or speed for rides and other fast sports) in You › Settings › Speed zones, or from Your zones on the health screen. See your five zones in your units, go back to the default, set your own five values, or let VVake learn them from your sessions.",
          'With no heart rate, an outdoor GPS session now shows your zone from your speed over the last 30 seconds ("ZONE 2 · SPEED"), and the coach\'s zone announcements and pace hints follow it. Points still need a heart rate.',
        ],
        improved: [
          "Today shows your goals in one card: with Plus, the coach's note about your goals now sits at the top of it instead of a second card saying almost the same thing.",
          "The map styles really look different on the watch: City is a quiet blue-grey map, and Outdoor shows the terrain with relief shading and contour lines. Satellite is no longer offered on the watch, which can't show imagery.",
          "Wear OS: the Outdoor map is now clearly a hiking map: Google's terrain map with relief shading and contour lines, light, a little further out so the terrain shows.",
          "Wear OS: with the voice off, zone and coach lines still show on screen and the taps on your wrist stay.",
          'The voice button on the workout screen silences the coach at once with one tap, and turns it back on with another. Hold it for "Essential only" (start, pause, end, and a word in zone 5).',
          'Your voice choice is remembered for your next workouts on every account, free included, and follows you to your watch, the website and your other phones. It is also in Coach › voice settings, "During workouts".',
          "The voice button is on the screen of a workout mirrored from your watch too: the watch follows it.",
        ],
      },
      fr: {
        added: [
          "Coupez la voix du coach d'un geste pendant une séance : le haut-parleur en haut de l'écran de séance la coupe tout de suite (ce qu'elle disait s'arrête). Touchez à nouveau pour la réactiver, ou maintenez pour « L'essentiel seulement » (départ, pause, fin et l'alerte zone 5). Votre choix reste pour les prochaines séances et vous suit sur l'iPhone.",
          "Zones de vitesse sur l'Apple Watch : sans fréquence cardiaque, votre zone vient maintenant de votre vitesse, réglée par sport dans Toi → Zones de vitesse (votre allure facile et soutenue). Elles vous guident, vous et les annonces du coach ; les points demandent toujours une fréquence cardiaque.",
          "Wear OS : un bouton de voix sur l'écran de séance. Un appui sur le bouton de voix (en haut à droite de la page des commandes, et dans les commandes de séance depuis n'importe quelle page) coupe le coach tout de suite ; un autre appui le réactive. Un appui long propose « L'essentiel seulement » : le départ, la pause, la fin et l'alerte zone 5. Votre choix est gardé pour la prochaine séance et suit votre téléphone.",
          "Wear OS : des zones de vitesse sans fréquence cardiaque. En marche, course, randonnée ou vélo avec le GPS mais sans pouls, votre zone vient maintenant de votre vitesse sur les 30 dernières secondes, signalée par un compteur, et les annonces de zone du coach la suivent. Réglez votre allure facile et soutenue pour chaque sport dans Vous → Zones de vitesse (la couronne ou − / +, un aperçu des cinq zones, Revenir au réglage par défaut). Les points demandent toujours une fréquence cardiaque.",
          "Zones de vitesse par sport : réglez votre allure facile et votre allure soutenue (ou votre vitesse pour le vélo et les autres sports rapides) dans Vous › Réglages › Zones de vitesse, ou depuis Vos zones dans l'écran santé. Voyez vos cinq zones dans vos unités, revenez au réglage par défaut, entrez vos cinq valeurs, ou laissez VVake les apprendre de vos séances.",
          "Sans fréquence cardiaque, une séance GPS en extérieur affiche maintenant votre zone selon votre vitesse sur les 30 dernières secondes (« ZONE 2 · VITESSE »), et les annonces de zone du coach et les conseils d'allure la suivent. Les points demandent toujours une fréquence cardiaque.",
        ],
        improved: [
          "Aujourd'hui montre vos objectifs dans une seule carte : avec Plus, le mot du coach sur vos objectifs s'affiche en haut de cette carte au lieu d'une deuxième carte qui disait presque la même chose.",
          "Les styles de carte sont vraiment différents sur la montre : Ville est une carte gris-bleu discrète, et Plein air montre le terrain avec l'ombrage du relief et les courbes de niveau. Satellite n'est plus proposé sur la montre, qui ne peut pas afficher d'imagerie.",
          "Wear OS : la carte Outdoor est maintenant clairement une carte de randonnée : la carte relief de Google avec ombrage et courbes de niveau, claire, un peu plus éloignée pour que le relief apparaisse.",
          "Wear OS : voix coupée, les annonces de zone et du coach restent affichées à l'écran et les vibrations au poignet restent.",
          "Le bouton de voix de l'écran de séance coupe le coach tout de suite d'un seul appui, et le réactive d'un autre. Maintenez-le pour « L'essentiel seulement » (départ, pause, fin, et un mot en zone 5).",
          "Votre choix de voix est gardé pour vos prochaines séances sur tous les comptes, gratuits compris, et vous suit sur votre montre, le site et vos autres téléphones. Il est aussi dans Coach › réglages de la voix, « Pendant les séances ».",
          "Le bouton de voix est aussi sur l'écran d'une séance de la montre suivie sur le téléphone : la montre le suit.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (27)",
    date: "2026-10-17",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        improved: [
          "With Plus, a coach call stays in one voice from the hello to the last answer: the voice you chose, never switching mid-call.",
        ],
        fixed: [
          "During a coach call, two voices no longer talk at the same time: only the phone or the watch that answered speaks, and workout announcements wait until you hang up.",
          "The coach never starts a slow answer over the phone's own voice: one or the other, never both.",
        ],
      },
      fr: {
        improved: [
          "Avec Plus, un appel du coach garde une seule voix du bonjour à la dernière réponse : celle que vous avez choisie, sans changer en cours d'appel.",
        ],
        fixed: [
          "Pendant un appel du coach, deux voix ne parlent plus en même temps : seul le téléphone ou la montre qui a répondu parle, et les annonces de séance attendent la fin de l'appel.",
          "Le coach ne lance plus une réponse lente par-dessus la voix du téléphone : l'une ou l'autre, jamais les deux.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (26)",
    date: "2026-10-15",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          "Spotify: when nothing plays, your last song shows; one tap plays it.",
          "Your VVaker on almost every screen, phone and watch.",
          "Watch maps: Standard, City, Outdoor or Satellite.",
          "Spotify on the watch (Plus + Premium) turns on from the watch.",
          "Its route stays on your account, the same everywhere.",
          "vvake.com/account: your settings, connections, agenda and coach memory.",
        ],
      },
      fr: {
        added: [
          "Spotify : quand rien ne joue, votre dernier titre s'affiche ; une touche le relance.",
          "Votre VVaker sur presque tous les écrans, téléphone et montre.",
          "Cartes de la montre : Standard, Ville, Plein air ou Satellite.",
          "Spotify sur la montre (Plus + Premium) s'active depuis la montre.",
          "Son chemin reste sur votre compte, le même partout.",
          "vvake.com/account : vos réglages, connexions, agenda et mémoire du coach.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (25)",
    date: "2026-10-15",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          "The coach reads your last 2 weeks and proposes settings changes: zones, heart rate, reminders, focus lock, goals.",
          "Approve by tap or by saying yes, undo for 30 days; delete what the coach remembers.",
          "Spotify on your watch without your phone (Plus + Spotify Premium): Connections › Spotify.",
        ],
        improved: ["Live coach (Plus): 15 minutes a week during a workout (5 per workout), yoga and strength included."],
      },
      fr: {
        added: [
          "Le coach lit vos 2 dernières semaines et propose des réglages : zones, cardio, rappels, verrou, objectifs.",
          "Acceptez d'une touche ou d'un oui, annulez sous 30 jours ; effacez ce qu'il retient.",
          "Spotify sur la montre sans le téléphone (Plus + Spotify Premium) : Connexions › Spotify.",
        ],
        improved: ["Coach en direct (Plus) : 15 min par semaine en séance (5 par séance), yoga et muscu compris."],
      },
    },
  },
  {
    version: "1.0.0 (24)",
    date: "2026-10-15",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          "Talk with your coach hands-free during a session: one tap, the coach answers out loud and listens again.",
          "With Plus, it's a live conversation during a workout, up to 15 minutes a week; say bye or tap End to stop.",
          "Without Plus, each tap asks one spoken question, answered out loud.",
        ],
        improved: [
          "No keyboard during a session: on the phone, no more holding to talk; on the watch, Answer by voice.",
          'Siri on the Apple Watch understands VVake when you say "Vee Wake", "Wake" or "The Wake".',
          '"Talk to my coach in VVake" opens the coach on the watch, already listening, hands-free.',
          'New phrase: "Start a run with VVake".',
          "Previous song is now in the Shortcuts app on the watch.",
        ],
      },
      fr: {
        added: [
          "Parlez à votre coach sans les mains en séance : une touche, il répond à voix haute et vous réécoute.",
          "Avec Plus, une vraie conversation pendant une séance, jusqu'à 15 minutes par semaine ; dites au revoir pour arrêter.",
          "Sans Plus, une question parlée par touche, avec une réponse à voix haute.",
        ],
        improved: [
          "Plus de clavier en séance : plus besoin de maintenir pour parler sur le téléphone, réponse à la voix sur la montre.",
          "Siri sur l'Apple Watch comprend VVake quand vous dites « Vee Wake », « Wake » ou « The Wake ».",
          "« Parle à mon coach VVake » ouvre le coach sur la montre, déjà à l'écoute, sans les mains.",
          "Nouvelle phrase : « Démarre une course avec VVake ».",
          "Chanson précédente se trouve maintenant dans l'app Raccourcis de la montre.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (23)",
    date: "2026-10-15",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        improved: [
          "The live map follows you like a car GPS on every map (Apple or Google, City, Outdoor): you stay in the middle, at street level, and the map turns with you.",
          "The map opens straight on your position, or waits until it finds you: never a wrong city or the whole world.",
          "Move the map with a finger to look around, then tap Recenter on me to follow you again.",
          "The watch's route page follows you too, on Apple Watch and on round and square Wear OS watches.",
        ],
      },
      fr: {
        improved: [
          "La carte en direct vous suit comme un GPS de voiture, sur toutes les cartes : vous au centre, à l'échelle de la rue, et elle tourne avec vous.",
          "Elle s'ouvre directement sur vous, ou attend de vous trouver : jamais une mauvaise ville ni le monde entier.",
          "Déplacez-la du doigt pour regarder autour, puis Recentrer sur moi pour qu'elle vous suive à nouveau.",
          "La page du parcours de la montre vous suit aussi (Apple Watch, Wear OS rond ou carré).",
        ],
      },
    },
  },
  {
    version: "1.0.0 (22)",
    date: "2026-10-15",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          "Fresh start: coming back after a break, start again at Day 1 from You › Settings, on the phone or the watch (hold to confirm).",
          "A fresh start resets your plan and schedule, streak, daily habits, custom health settings, focus lock and the coach's memory.",
          "Your VVaker, Health data, sessions, points, prizes, wallets, Plus and goals stay, and the other devices follow on their own.",
        ],
        improved: [
          "Weekly prizes now need movement with your heart rate: a raised heart while sitting (sauna, bath, coffee, stress) still earns points in your journal, but no longer counts toward prizes.",
          "The watch now records when your wrist moves during a workout, so strength sessions, wheelchair pushes and other workouts without steps count toward prizes.",
          "A session that didn't count toward prizes because no movement was detected says so in its details, on the phone and on the watch.",
        ],
      },
      fr: {
        added: [
          "Repartir à zéro : de retour après une pause, recommencez au jour 1 depuis Vous › Réglages, sur le téléphone ou la montre (maintenir pour confirmer).",
          "Repartir à zéro remet à neuf votre plan et votre programme, votre série, vos habitudes, vos réglages santé perso, le verrou de concentration et la mémoire du coach.",
          "Votre VVaker, vos données santé, séances, points, prix, portefeuilles, Plus et objectifs restent, et les autres appareils suivent d'eux-mêmes.",
        ],
        improved: [
          "Les prix de la semaine demandent maintenant du mouvement avec votre fréquence cardiaque : un cœur qui monte en restant assis (sauna, bain, café, stress) donne toujours des points dans votre journal, mais ne compte plus pour les prix.",
          "La montre enregistre maintenant quand votre poignet bouge pendant une séance : la musculation, les poussées en fauteuil et les autres séances sans pas comptent pour les prix.",
          "Une séance qui ne compte pas pour les prix faute de mouvement le dit dans son détail, sur le téléphone et sur la montre.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (21)",
    date: "2026-10-14",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: [
          "When a city is challenged, everyone in both cities gets a notification to jump in, and another when the 12 hours start.",
          "City Clash shows your city's points against the other city's, a tug bar and a live countdown on the phone and the watch.",
          "A Jump in button starts a workout while your city's clash is live.",
          "You can turn City Clash alerts off in the settings.",
        ],
        improved: [
          "Every City Clash lasts a fixed 12 hours from 8 AM in each city, and the countdown follows the server's clock.",
          "Racing a ghost, the map keeps you both in view without zooming out too far, and a Recenter on me button brings it back after you move the map.",
        ],
        fixed: [
          "During a workout the map follows you up close, at street level, with your VVaker clearly visible, instead of starting zoomed far out.",
        ],
      },
      fr: {
        added: [
          "Quand une ville est défiée, tout le monde dans les deux villes reçoit une notification pour s'y mettre, puis une autre quand les 12 heures commencent.",
          "Le City Clash montre les points de votre ville face à ceux de l'autre, une barre de duel et un compte à rebours en direct sur le téléphone et la montre.",
          "Un bouton J'y vais lance une séance pendant que le clash de votre ville est en cours.",
          "Vous pouvez couper les alertes City Clash dans les réglages.",
        ],
        improved: [
          "Chaque City Clash dure 12 heures fixes à partir de 8 h dans chaque ville, et le compte à rebours suit l'horloge du serveur.",
          "Pendant une course contre un fantôme, la carte vous garde tous les deux en vue sans trop dézoomer, et un bouton Recentrer sur moi la ramène sur vous après l'avoir déplacée.",
        ],
        fixed: [
          "Pendant une séance, la carte vous suit de près, au niveau de la rue, avec votre VVaker bien visible, au lieu de s'ouvrir très dézoomée.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (20)",
    date: "2026-10-13",
    channel: "beta",
    devices: ["iphone", "watch", "android", "wear"],
    notes: {
      en: {
        added: ["Hikes now show a topographic map with contour lines and relief; tap the map button to switch."],
        improved: [
          "Snow sessions (skiing, snowboarding, snowshoeing) and shared hike routes also open on the topographic map, and the map you pick is remembered for each sport.",
          "Buttons that need Spotify now open it right on the playlist, song or album, and VVake comes back when it can.",
          'On the watch, one "Start playing" button: it starts your music on the phone or where Spotify last played, and only opens Spotify if it has to.',
          "On the watch, the heart in the corner of every workout page now shows a pause sign: tap it for big Pause and End workout buttons.",
          "Ending a workout asks once, on one screen, with your time and distance: End and save, or Keep going.",
          "The workout banner on your phone's other screens has Pause and End buttons too.",
        ],
      },
      fr: {
        added: [
          "Les randonnées affichent maintenant une carte topographique avec courbes de niveau et relief ; touchez le bouton de la carte pour changer.",
        ],
        improved: [
          "Les séances sur neige (ski, snowboard, raquettes) et les parcours de rando partagés s'ouvrent aussi sur la carte topographique, et la carte choisie est gardée pour chaque sport.",
          "Les boutons qui ont besoin de Spotify l'ouvrent directement sur la playlist, le titre ou l'album, et VVake revient quand c'est possible.",
          "Sur la montre, un seul bouton « Lancer la musique » : il démarre ta musique sur le téléphone ou là où Spotify jouait, et n'ouvre Spotify que si c'est nécessaire.",
          "Sur la montre, le cœur dans le coin de chaque page de séance affiche un signe pause : touchez-le pour de grands boutons Pause et Terminer la séance.",
          "Terminer une séance ne demande qu'une confirmation, sur un seul écran, avec votre temps et votre distance : Terminer et enregistrer, ou Je continue.",
          "Le bandeau de séance sur les autres écrans du téléphone a aussi des boutons Pause et Fin.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (19)",
    date: "2026-10-13",
    channel: "beta",
    devices: ["watch"],
    notes: {
      en: {
        fixed: [
          "When Spotify plays from its own watch app, VVake's watch music page gives the whole screen to the player, so previous, play/pause and next are always in view, also during a workout.",
        ],
      },
      fr: {
        fixed: [
          "Quand Spotify joue depuis son app de montre, la page musique de VVake laisse tout l'écran au lecteur : précédent, lecture/pause et suivant restent toujours visibles, aussi pendant une séance.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (18)",
    date: "2026-10-13",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        fixed: [
          "On the watch's Today screen, the Race, Move, Quest and Coach buttons now sit fully inside the screen's rounded corners on every watch size, including Ultra.",
          'When Spotify plays from its own watch app, VVake\'s watch player shows and controls it instead of "Open Spotify on your iPhone".',
        ],
      },
      fr: {
        fixed: [
          "Sur l'écran Aujourd'hui de la montre, les boutons Course, Bouger, Quête et Coach restent entièrement dans les coins arrondis de l'écran, sur toutes les tailles, Ultra compris.",
          "Quand Spotify joue depuis son app de montre, le lecteur VVake de la montre l'affiche et le contrôle au lieu de « Ouvre Spotify sur ton iPhone ».",
        ],
      },
    },
  },
  {
    version: "1.0.0 (17)",
    date: "2026-10-13",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        added: [
          'Tap a quick-check reminder (like "Had a meal?") and VVake opens right on that question, on the iPhone and on the Apple Watch.',
        ],
        improved: [
          "Spotify from the watch: every music control drives Spotify, and the watch shows what Spotify is actually playing, even when you change it in the Spotify app.",
          "The watch player shows Spotify as a neat chip at the top, with the album art next to the song.",
          "The watch's Today screen keeps its shortcuts in a row inside the round corners, all visible at first sight.",
        ],
        fixed: [
          "Spotify controls on the watch now work with the iPhone locked in your pocket.",
          "Tapping the output device that is playing unselects it.",
          '"Play on iPhone" and "Open Spotify" from the watch no longer ask you to update VVake.',
        ],
      },
      fr: {
        added: [
          "Touchez un rappel rapide (comme « Tu as mangé ? ») et VVake s'ouvre directement sur cette question, sur l'iPhone et sur l'Apple Watch.",
        ],
        improved: [
          "Spotify depuis la montre : chaque commande pilote Spotify, et la montre affiche ce que Spotify joue vraiment, même si vous changez dans l'app Spotify.",
          "Le lecteur de la montre affiche Spotify dans une étiquette en haut, avec la pochette à côté du titre.",
          "L'écran Aujourd'hui de la montre garde ses raccourcis sur une ligne dans les coins arrondis, tous visibles d'emblée.",
        ],
        fixed: [
          "Les commandes Spotify de la montre fonctionnent avec l'iPhone verrouillé dans la poche.",
          "Toucher l'appareil de sortie qui joue le désélectionne.",
          "« Lire sur l'iPhone » et « Ouvrir Spotify » depuis la montre ne demandent plus de mettre VVake à jour.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (15)",
    date: "2026-10-13",
    channel: "beta",
    devices: ["iphone"],
    notes: {
      en: {
        fixed: ["Changing the language or theme during a workout no longer ends it: the change applies as soon as the workout closes."],
      },
      fr: {
        fixed: ["Changer la langue ou le thème pendant une séance ne l'arrête plus : le changement s'applique dès la fin de la séance."],
      },
    },
  },
  {
    version: "1.0.0 (14)",
    date: "2026-10-13",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        improved: [
          'During a workout, "back to your workout" is now a slim bar at the very bottom of the phone, and screens move up so it never covers anything.',
          "The watch's Today shows your VVaker in the background.",
          "Every watch screen was checked on small and large watches in English and French, so text and buttons are no longer cut by the rounded corners.",
          "When no free slot is left today, the phone and the watch say so plainly and offer a short daily move instead.",
        ],
        fixed: [
          'On the watch\'s coach page, the "Your coaching" button is no longer cut off.',
          "On the watch's music page, the page dots no longer sit on the speaker button.",
        ],
      },
      fr: {
        improved: [
          "Pendant une séance, « Retour à ta séance » devient une fine barre tout en bas du téléphone, et les écrans remontent pour qu'elle ne cache rien.",
          "L'écran Aujourd'hui de la montre affiche votre VVaker en fond.",
          "Chaque écran de la montre a été vérifié sur petites et grandes montres, en anglais et en français : textes et boutons ne sont plus coupés par les coins arrondis.",
          "Quand il ne reste plus de créneau libre aujourd'hui, le téléphone et la montre le disent clairement et proposent un petit mouvement du jour.",
        ],
        fixed: [
          "Sur la page coach de la montre, le bouton « Ton coaching » n'est plus coupé.",
          "Sur la page musique de la montre, les points de page ne recouvrent plus le bouton haut-parleur.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (13)",
    date: "2026-10-12",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        added: [
          "Coach calls ring on your iPhone and your Apple Watch: answer on either one, the other follows (in call on your watch, ended, declined).",
          "A full call screen on the watch: your VVaker, the coach's voice, captions and Hang up.",
          "Add a moment after a run, walk or ride: a selfie, the view, or a 6-second clip, kept on your phone.",
          "Brag cards: your moment with your VVaker and the session's highlights, ready to share, with no map and no location.",
          "Plus: a small + on the VVake logo when Plus is on, and Plus can be bought in the app through Apple once it opens (beta testers keep the free preview).",
        ],
        improved: [
          "Shares on X come with a fun line for the moment and a link that shows a proper preview card.",
          "After an outdoor workout, the watch reminds you that you can add a moment on your iPhone.",
        ],
        fixed: ["The coach call screen shows your whole VVaker in the circle, and the header no longer sits under the camera."],
      },
      fr: {
        added: [
          "Les appels du coach sonnent sur l'iPhone et sur l'Apple Watch : répondez sur l'un, l'autre suit (en appel sur la montre, terminé, refusé).",
          "Un vrai écran d'appel sur la montre : votre VVaker, la voix du coach, les sous-titres et Raccrocher.",
          "Ajoutez un moment après une course, une marche ou une sortie vélo : un selfie, la vue ou une vidéo de 6 secondes, gardés sur votre téléphone.",
          "Les cartes à partager : votre moment avec votre VVaker et les temps forts de la séance, sans carte ni lieu.",
          "Plus : un petit + sur le logo VVake quand Plus est actif, et Plus pourra s'acheter dans l'app via Apple dès son ouverture (les testeurs gardent l'aperçu gratuit).",
        ],
        improved: [
          "Les partages sur X arrivent avec une phrase drôle pour le moment et un lien qui affiche un vrai aperçu.",
          "Après une séance en extérieur, la montre rappelle qu'on peut ajouter un moment sur l'iPhone.",
        ],
        fixed: ["L'écran d'appel du coach montre votre VVaker en entier dans le cercle, et l'en-tête ne passe plus sous la caméra."],
      },
    },
  },
  {
    version: "1.0.0 (12)",
    date: "2026-10-12",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        improved: ["Every VVaker the app makes shows the VVake sign: three fingers up in a row, thumb and little finger touching."],
        fixed: [
          "A generated VVaker no longer sits on a white box on the dark theme: the background is always made transparent, and pictures made before are cleaned up for free.",
          "The watch picks up your cleaned-up VVaker too.",
        ],
      },
      fr: {
        improved: [
          "Chaque VVaker créé par l'app fait le signe VVake : trois doigts levés côte à côte, pouce et auriculaire qui se touchent.",
        ],
        fixed: [
          "Un VVaker généré ne s'affiche plus dans un carré blanc en thème sombre : le fond est toujours rendu transparent, et les images déjà faites sont nettoyées gratuitement.",
          "La montre récupère aussi votre VVaker nettoyé.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (11)",
    date: "2026-10-11",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        added: [
          "Live speed during a workout.",
          "Stop a workout from either your iPhone or your watch.",
          "Plus preview for beta testers: try Plus for 30 days, nothing charged.",
          "Up to 3 VVaker renders per account during the beta.",
        ],
        improved: ["One coach voice at a time, and your music on the iPhone gets quieter while the watch coach talks."],
      },
      fr: {
        added: [
          "Vitesse en direct pendant une séance.",
          "Arrêtez une séance depuis l'iPhone ou la montre.",
          "Aperçu de Plus pour les bêta-testeurs : 30 jours de Plus, rien n'est facturé.",
          "Jusqu'à 3 rendus de VVaker par compte pendant la bêta.",
        ],
        improved: ["Une seule voix de coach à la fois, et votre musique sur l'iPhone baisse quand le coach de la montre parle."],
      },
    },
  },
  {
    version: "1.0.0 (10)",
    date: "2026-10-10",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        improved: [
          "Every watch screen reviewed in English and French on the smallest and largest watches: nothing cut by the round corners, no text running off the screen.",
          "Ghost races: the ghost moves at exactly the same pace on the watch and the phone, and pauses with you.",
        ],
        fixed: [
          "A loop route only counts as finished after at least 80% of its distance and of its path, never just because you're back at the start.",
        ],
      },
      fr: {
        improved: [
          "Tous les écrans de la montre revus en français et en anglais, sur la plus petite et la plus grande montre : rien de coupé par les coins arrondis, aucun texte qui déborde.",
          "Courses contre son fantôme : le fantôme avance exactement au même rythme sur la montre et sur le téléphone, et s'arrête avec vous.",
        ],
        fixed: [
          "Un parcours en boucle n'est terminé qu'après au moins 80 % de sa distance et de son tracé, jamais juste parce que vous êtes revenu au départ.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (9)",
    date: "2026-10-09",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        added: [
          "Coach calls (Plus): your coach rings you, like a call, about what matters today.",
          "Ghost races synced between phone and watch: the ghost runs its recorded path, and your VVaker is your marker on the map.",
        ],
      },
      fr: {
        added: [
          "Appels du coach (Plus) : votre coach vous appelle, comme un vrai appel, pour ce qui compte aujourd'hui.",
          "Courses contre son fantôme synchronisées entre téléphone et montre : le fantôme suit son tracé enregistré, et votre VVaker est votre repère sur la carte.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (8)",
    date: "2026-10-09",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        added: [
          "The live workout on one screen: heart rate, map and route, zone block, coach and music.",
          "Zone blocks with a real countdown, and a 10% bonus when you hold the zone 80% of the time.",
          "Your own heart-rate zones, per sport.",
          "On the watch: your route, challenges, and discarding a workout.",
          "A pace indicator, and a notice when you're offline.",
        ],
        improved: ["The coach can vibrate instead of speaking over your music."],
      },
      fr: {
        added: [
          "La séance en direct sur un seul écran : cardio, carte et tracé, bloc de zone, coach et musique.",
          "Des blocs de zone avec un vrai compte à rebours, et 10 % de bonus quand vous tenez la zone 80 % du temps.",
          "Vos propres zones cardio, par sport.",
          "Sur la montre : votre tracé, les défis, et l'abandon d'une séance.",
          "Un indicateur d'allure, et un avertissement hors connexion.",
        ],
        improved: ["Le coach peut vibrer au lieu de parler par-dessus votre musique."],
      },
    },
  },
  {
    version: "1.0.0 (7)",
    date: "2026-10-09",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: {
        added: [
          "Habit points: water, meals and sleep earn or cost points, with a daily history and a good-habits streak.",
          "New perks, some of them hard to get, and trophies to be proud of.",
          'Start a workout with Siri using "wake up" phrases.',
        ],
        fixed: ["Siri recognizes VVake again (too many phrases had been registered)."],
      },
      fr: {
        added: [
          "Points d'habitudes : eau, repas et sommeil rapportent ou coûtent des points, avec un historique par jour et une série de bonnes habitudes.",
          "De nouveaux bonus, certains difficiles à obtenir, et des trophées dont être fier.",
          "Lancez une séance avec Siri grâce aux phrases « wake up ».",
        ],
        fixed: ["Siri reconnaît de nouveau VVake (trop de phrases avaient été enregistrées)."],
      },
    },
  },
  {
    version: "1.0.0 (6)",
    date: "2026-10-08",
    channel: "beta",
    devices: ["iphone"],
    notes: {
      en: {
        added: [
          "Answer reminders right from the notification: Done, In 15 min, or Not this time.",
          "Your reminder settings are saved with your account.",
        ],
      },
      fr: {
        added: [
          "Répondez aux rappels directement depuis la notification : Fait, Dans 15 min, ou Pas cette fois.",
          "Vos réglages de rappels sont enregistrés avec votre compte.",
        ],
      },
    },
  },
  {
    version: "1.0.0 (5)",
    date: "2026-10-07",
    channel: "beta",
    devices: ["iphone", "watch"],
    notes: {
      en: { added: ["The first beta of VVake on iPhone and Apple Watch, in English and French."] },
      fr: { added: ["La première bêta de VVake sur iPhone et Apple Watch, en français et en anglais."] },
    },
  },
];
