# EDT R&T

Un petit emploi du temps pour un groupe R&T. Il lit le calendrier ADE partagé, affiche le prochain cours et la semaine, et fonctionne aussi bien sur téléphone.

Le projet ne contient aucun framework front : l’interface est faite avec **HTML + CSS + JavaScript**. Bootstrap sert uniquement aux boutons et aux champs de formulaire.

## Démarrer en local

Il faut installer [Node.js](https://nodejs.org/) (version 22 ou plus récente).

~~~sh
npm install
cp config/groups.example.json config/groups.json
npm run dev
~~~

Ouvre ensuite [http://localhost:3000](http://localhost:3000).

La commande démarre le front **et** le back en même temps. Arrête-la avec Ctrl+C.

Pour tester les devoirs en local, ajoute aussi ces deux lignes dans .env :

~~~text
SUPABASE_URL=https://ton-projet.supabase.co
SUPABASE_ANON_KEY=ta-cle-publique
~~~

La commande npm run dev charge automatiquement ce fichier et fournit ces valeurs au navigateur. Ne mets jamais la clé service_role dans .env.

## Ajouter son lien ADE

Ouvre config/groups.json et remplace le lien d’exemple par ton lien ICS ADE :

~~~json
[
  {
    "id": "fi1g2",
    "label": "R&T — FI1G2",
    "icsUrl": "https://planning.univ-rennes.fr/..."
  }
]
~~~

Pour ajouter un groupe au menu, copie un objet et donne-lui un id différent. Redémarre ensuite npm run dev.

> config/groups.json est ignoré par Git. C’est volontaire : ne publie pas un lien ADE dans un dépôt public.

## Les fichiers à connaître

| Fichier | Rôle |
| --- | --- |
| public/index.html | La page et la barre bleue. |
| public/styles.css | Les couleurs, l’affichage desktop et mobile. |
| public/app.js | Tout le comportement du calendrier. Commence par start(), puis lis loadSchedule() et renderWeek(). |
| public/todo.js | L’onglet Devoirs : Supabase, brouillon local, formulaires et affichage. |
| src/server.ts | Les trois routes du serveur : groupes, emploi du temps et santé. |
| src/ics.ts | Transforme le format ICS d’ADE en cours utilisables par le site. |
| scripts/build-pages.ts | Prépare les fichiers statiques pour GitHub Pages. |
| supabase/migrations/ | Le schéma sécurisé de la base de devoirs. |

## Les commandes utiles

~~~sh
npm run dev          # développer : http://localhost:3000
npm test             # lancer les tests
npm run check        # vérifier TypeScript
npm run build        # créer la version serveur dans dist/
npm run build:pages  # créer la version GitHub Pages dans site/
~~~

## Publier sur GitHub Pages

GitHub Pages ne peut pas lancer un serveur Node.js. Le workflow prépare donc le calendrier avant la publication, avec un secret GitHub. Le lien ADE reste privé.

1. Crée un dépôt GitHub et pousse ce dossier sur la branche master.
2. Dans GitHub, ouvre **Settings → Secrets and variables → Actions**.
3. Ajoute le secret ADE_ICS_URL avec ton lien ICS ADE.
4. Dans **Settings → Pages**, choisis **Source : GitHub Actions**.

Le fichier [deploy-pages.yml](.github/workflows/deploy-pages.yml) publie le site à chaque push sur master, à la demande, et toutes les heures. L’adresse du site sera :

~~~text
https://TON-UTILISATEUR.github.io/NOM-DU-DEPOT/
~~~

La version publiée est statique : ses données sont actualisées au maximum une fois par heure. En local ou avec Docker, le serveur récupère ADE toutes les 15 minutes.

## Activer les devoirs avec Supabase

Les devoirs sont partagés avec Supabase, sans demander d’adresse e-mail ou de mot de passe aux étudiants. Chaque navigateur reçoit une identité anonyme ; supprimer les données du navigateur fait perdre les droits de modification de ses anciens devoirs.

1. Crée un projet sur [Supabase](https://supabase.com/).
2. Dans **Authentication → Providers**, active **Anonymous sign-ins**.
3. Dans **SQL Editor**, colle et exécute le contenu de supabase/migrations/20260909_homeworks.sql.
   - Si tu avais déjà exécuté cette migration avant le correctif des coches, exécute aussi supabase/migrations/20260909_fix_homework_progress_upsert.sql.
4. Dans **Project Settings → API**, récupère l’URL du projet et la clé publique anon ou publishable.
5. Ajoute deux secrets GitHub dans **Settings → Secrets and variables → Actions** :

| Secret | Valeur |
| --- | --- |
| SUPABASE_URL | L’URL HTTPS du projet Supabase |
| SUPABASE_ANON_KEY | La clé publique anon/publishable |

6. Push sur master ou relance le workflow Pages.

La clé publique est visible dans le navigateur : c’est normal. La sécurité repose sur les règles RLS installées par la migration. Ne mets jamais la clé service_role dans GitHub Pages ou dans le code.

Pour tester la configuration localement, exporte les deux variables avant de lancer le build Pages :

~~~sh
export SUPABASE_URL="https://ton-projet.supabase.co"
export SUPABASE_ANON_KEY="ta-cle-publique"
npm run build:pages
~~~

Le formulaire garde automatiquement un brouillon dans le navigateur. La publication est limitée à un devoir toutes les 10 secondes par navigateur ; les coches « fait » restent instantanées et personnelles.

## Docker (facultatif)

~~~sh
docker compose up -d --build
~~~

Le site est alors disponible sur http://localhost:3000.

## En cas de problème

| Problème | Solution |
| --- | --- |
| Le calendrier ne se charge pas | Vérifie que le lien ADE dans config/groups.json est valide. |
| GitHub Pages échoue | Vérifie que le secret s’appelle exactement ADE_ICS_URL. |
| Les modifications ne s’affichent pas | Recharge la page avec Ctrl+F5, puis regarde l’onglet **Actions** de GitHub. |
| Le port 3000 est déjà utilisé | Lance PORT=3001 npm run dev, puis ouvre le port 3001. |

Le workflow Pages reprend le modèle officiel GitHub : [documentation GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
