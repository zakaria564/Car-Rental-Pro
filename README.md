# Car-Rental-Pro

Logiciel de gestion de location de voitures complet construit avec Next.js, Firebase et Genkit.

## Fonctionnalités
- Gestion de la flotte (Voitures)
- Gestion des clients
- Contrats de location (Départ/Retour)
- Comptabilité et suivi des paiements
- Archives des contrats et paiements
- Historique d'entretien des véhicules
- Alertes documents (Assurance, Visite technique) et entretien

## Déploiement sur GitHub

1. Créez un dépôt vide sur GitHub nommé `Car-Rental-Pro`.
2. Dans votre terminal, à la racine du projet :
   ```bash
   git init
   git add .
   git commit -m "Version stable"
   git branch -M main
   git remote add origin https://github.com/zakaria564/Car-Rental-Pro.git
   git push -u origin main
   ```

## Déploiement sur Vercel

1. Connectez votre compte GitHub à [Vercel](https://vercel.com).
2. Importez le projet `Car-Rental-Pro`.
3. **IMPORTANT** : Avant de cliquer sur "Deploy", allez dans la section **Environment Variables**.
4. Ajoutez toutes les variables listées dans le fichier `.env.example` avec leurs valeurs respectives (que vous trouverez dans votre fichier `.env` local ou sur la console Firebase).
5. Cliquez sur **Deploy**.
