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
| src/server.ts | Les trois routes du serveur : groupes, emploi du temps et santé. |
| src/ics.ts | Transforme le format ICS d’ADE en cours utilisables par le site. |
| scripts/build-pages.ts | Prépare les fichiers statiques pour GitHub Pages. |

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

1. Crée un dépôt GitHub et pousse ce dossier sur la branche main.
2. Dans GitHub, ouvre **Settings → Secrets and variables → Actions**.
3. Ajoute le secret ADE_ICS_URL avec ton lien ICS ADE.
4. Dans **Settings → Pages**, choisis **Source : GitHub Actions**.

Le fichier [deploy-pages.yml](.github/workflows/deploy-pages.yml) publie le site à chaque push sur master, à la demande, et toutes les heures. L’adresse du site sera :

~~~text
https://TON-UTILISATEUR.github.io/NOM-DU-DEPOT/
~~~

La version publiée est statique : ses données sont actualisées au maximum une fois par heure. En local ou avec Docker, le serveur récupère ADE toutes les 15 minutes.

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
