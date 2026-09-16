# CLOSER — Agent de vente IA pour e-commerçants marocains

CLOSER transforme les conversations WhatsApp, Instagram et web de vos clients en
commandes confirmées (paiement à la livraison), en français, darija et arabe.

- **IA réelle** : Google Gemini avec mémoire de conversation complète et outils
  validés côté serveur (prix, stock et promotions viennent toujours de la base —
  jamais inventés).
- **Multi-tenant strict** : chaque marchand ne voit que ses données, isolation
  appliquée côté serveur sur tous les accès.
- **Canaux officiels** : WhatsApp Cloud API et Instagram Messaging API (Meta).
  Aucun scraping, aucune automatisation de navigateur.
- **Pensé pour le Maroc** : MAD/DH, numéros +212, villes marocaines, paiement à
  la livraison par défaut, interface entièrement en français.

## Stack

| Couche | Technologie |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components) |
| Base de données | Supabase PostgreSQL + Drizzle ORM |
| IA | Google Gemini (`GEMINI_MODEL`, défaut `gemini-2.5-flash`) |
| Auth | JWT httpOnly (double audience marchand / admin plateforme), bcrypt |
| Déploiement | Vercel (cron inclus pour les automatisations) |

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env
#    Renseigner DATABASE_URL (Supabase), JWT_SECRET, GEMINI_API_KEY, etc.
#    Générer les secrets :  openssl rand -base64 48

# 3. Créer le schéma et les données plateforme (forfaits 99/249/499 MAD, admin)
npm run db:setup

# 4. (Optionnel, développement uniquement) Données de démonstration
DEMO_MODE=true npm run db:seed:demo

# 5. Lancer
npm run dev
```

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run check` | Typecheck + lint + build (barre de qualité CI) |
| `npm run db:setup` | Générer les migrations, les appliquer, seeder la plateforme |
| `npm run db:seed:demo` | Seeder la boutique de démo (gated `DEMO_MODE`) |
| `npm run db:studio` | Drizzle Studio sur la base |

## Architecture

```
src/
├── app/
│   ├── dashboard/        # Espace marchand (server components, données réelles)
│   ├── admin/            # Administration plateforme (comptes séparés)
│   └── api/
│       ├── ai/           # Pipeline de réponse IA
│       ├── conversations/ orders/ products/ customers/ settings/
│       ├── automations/ channels/ subscription/
│       ├── webhooks/     # WhatsApp, Instagram, paiements (HMAC vérifié)
│       ├── cron/         # Exécution des automatisations (CRON_SECRET)
│       └── admin/        # API administration plateforme
├── lib/
│   ├── repositories.ts   # UNIQUE point d'accès aux données (tenant-scopé)
│   ├── ai/               # Prompt système, tools, moteur, exécuteur
│   ├── channels/         # WhatsApp Cloud API v21, Instagram, registre
│   ├── orders/status.ts  # Machine à états des commandes (10 statuts)
│   ├── subscriptions/    # Forfaits + évaluation d'accès (essai, grâce)
│   ├── payments/         # Abstraction fournisseur marocain (Payzone/NAPS…)
│   ├── automation/       # 6 types de relances, runner anti-spam
│   └── security/         # Tenant, rate limiting, chiffrement AES-256-GCM
└── middleware.ts         # Garde JWT edge (/dashboard, /admin, /billing)
```

### Règles produit non négociables

1. **Aucune fonctionnalité simulée.** Un canal non branché affiche
   « non connecté » ; un paiement sans fournisseur configuré affiche
   « Fournisseur de paiement non configuré ». Jamais de faux succès.
2. **Aucun Stripe.** Le paiement passe par une abstraction prête pour les
   prestataires marocains ; aucune donnée bancaire n'est stockée.
3. **Les messages clients sont non fiables** (défense injection de prompt) ;
   l'IA ne peut déclencher que des outils validés serveur.
4. **Les prix des forfaits vivent en base** (table `plans`), jamais codés en
   dur côté client.
5. **Données marchand conservées à l'expiration de l'essai** ; l'accès passe en
   lecture seule avec écran de mise à niveau.

## Connecter WhatsApp / Instagram

1. Créer une application sur [developers.facebook.com](https://developers.facebook.com).
2. Renseigner les identifiants dans **Dashboard → Canaux** (chiffrés au repos).
3. Déclarer l'URL de rappel :
   - WhatsApp : `https://VOTRE_DOMAINE/api/webhooks/whatsapp`
   - Instagram : `https://VOTRE_DOMAINE/api/webhooks/instagram`

## Déploiement Vercel

1. Importer le dépôt ; définir toutes les variables de `.env.example`.
2. `vercel.json` programme déjà le cron des automatisations (`*/10 * * * *`).
3. Après déploiement : `npm run db:setup` en local avec le `DATABASE_URL` de
   production (ou exécuter les migrations via drizzle-kit).

## Documentation

- [`docs/AUDIT.md`](docs/AUDIT.md) — audit complet du prototype initial
  (failles de sécurité, IA, base de données, fonctionnalités mortes) et
  correctifs appliqués.
