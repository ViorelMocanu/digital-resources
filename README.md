# Resurse digitale: **Resurse.dev**

![GitHub Pages Deploy Status](https://github.com/ViorelMocanu/resurse-digitale/actions/workflows/static.yml/badge.svg)

Salutare, 🧑‍🚀 Astronaut!

Bine-ai venit în proiectul de *resurse digitale*, prin care transformăm link-urile din [Google Doc-ul făcut de mine acum mai mult timp] într-un website funcțional care să ajute oamenii să parcurgă resursele de învățare mai eficient.

Vezi toată seria de video-uri 🔴LIVE de pe YouTube în care am generat codul pentru acest proiect în [playlist-ul Resurse.dev de aici &rarr;].

Proiectul e abia la început, și dacă vrei să te implici, orice contribuție de-a ta este binevenită! Citește [regulile] și [ghidul despre cum să contribui] și ajută-ne să facem proiectul ăsta *cel mai bun loc din care să alegi ce resurse să folosești pentru învățare*! Contribuitorii majori vor fi menționați în [`humans.txt`].

Documentul curent este momentan în 🇷🇴 Română, însă cel mai probabil la finalul [v1.0] va fi bilingv (inclusiv în 🇬🇧 Engleză) pentru a stimula oameni din toate colțurile lumii să se alăture pentru a contribui la proiect și a semnala potențiale probleme. Restul documentației și task-urile din [GitHub Project-ul] unde poți vedea statusul tuturor issue-urilor create vor fi exclusiv în 🇬🇧 Engleză.

## Quick note in 🇬🇧 English

This project began in a 🇷🇴 Romanian community, so please excluse the almost entirely Romanian content in this `README.md` - we will translate this document in 🇬🇧 English by the end of [v1.0].

## ✅ Link-uri utile

1. [Lista de resurse generale] - 1600 link-uri pe care le transformăm din Google Docs în website (bonus: [Lista de resurse de JS pentru cine vrea să învețe Vue])
2. Design-ul [în Figma]
3. Inspirația [de design]

Ne-am mai inspirat de aici ca să facem proiectul curent:

- [Tutorial oficial al Astro 3.0]
- Componente: <https://github.com/markteekman/accessible-astro-starter> + <https://www.accessible-astro.dev/accessible-components/> + <https://github.com/markteekman/accessible-astro-components> + <https://github.com/shaunchander/astro-pwa-starter>
- [Integrări] din care vrem să testăm:
    - [ ] `@astrojs/mdx`
    - [x] `@astrojs/sitemap`
    - [ ] `astro-compress` vs `astro-compressor` vs `astro-html-minifier`
    - [ ] `astro-seo`
    - [ ] `astro-seo-meta`
    - [ ] `astro-seo-schema`
    - [ ] `astro-robots-txt`
    - [x] `vite-plugin-pwa` + `astro-webmanifest`
    - [x] `@astrojs/partytown`
    - [ ] `astro-i18next`
    - [x] `typescript` + `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`
    - [x] `eslint` + `eslint-plugin-astro` + `eslint-plugin-jsx-a11y`
    - [x] `sass`
    - [ ] `svgo`
    - [ ] `@astro-community/astro-embed-youtube` + `@astro-community/astro-embed-twitter`
    - [ ] `astro-purgecss`
    - [ ] `@astrojs/vercel` vs `@astrojs/netlify` vs `@astrojs/cloudflare` vs `@astrojs/deno` pentru deploy
    - [ ] `astro-icon` (optional) testat?
    - [ ] `@sendgrid` (optional) pentru email?
    - [ ] `accessible-astro-components` (optional) ca să „furăm” cod de aici?
    - [ ] `@astrojs/tailwind` + `tailwindcss` (optional)
    - [x] `prettier` + `prettier-plugin-astro` + `prettier-plugin-tailwindcss` (optional)

---------------

## 🕹️ Cum pornești proiectul?

Întâi, clonează repository-ul curent:

```bash
git clone https://github.com/ViorelMocanu/digital-resources.git
```

**BONUS:** dacă ești pe <del>Winblows</del> <ins>Windows</ins>, asigură-te că faci pașii următori într-o consolă cu drepturi de Administrator. Fie deschide VSCode sau IDE-ul tău preferat cu consolă atașată cu *`click dreapta > Run as Administrator`* fie rulează `cmd.exe` sau `powershell.exe` cu drepturi de Admin.

Asigură-te că ai ultima versiune de Node instalată de pe [site-ul oficial Node.js]. Ideal e să ai minim versiunea `18.18.0`. Poți verifica versiunea instalată cu comanda:

```bash
node -v
```

Mai asigură-te că ai instalat și ultima variantă de PNPM, urmând [instrucțiunile de pe site-ul PNPM], sau rulează una din comenzile următoare.

Pentru Windows:

```bash
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

Pentru POSIX / Mac / Linux / *nix cu librăria `curl` disponibilă:

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

Ideal e să ai minim versiunea de PNPM `8.8.0`. Poți verifica versiunea instalată cu comanda:

```bash
pnpm -v
```

Apoi, instalează dependințele din `package.json`:

```bash
pnpm install
```

Apoi, pornește proiectul local:

```bash
pnpm dev
```

Deschide browser-ul la adresa: <http://localhost:4321> ca să vezi proiectul rulând la tine local.

Dacă faci schimbări în arhitectura informațională din `./content` în special în `./content/config.ts` asigură-te că se re-construiește referința de **TypeScript** pentru conținut rulând:

```bash
pnpm astro sync
```

Dacă vrei să compilezi o variantă deployabilă a proiectului care generează toate rutele statice și fișierele necesare pentru deploy, rulează:

```bash
pnpm build
```

## 🧞 Comenzile disponibile

Toate comenzile sunt rulate din root-ul proiectului, dintr-un terminal:

| Command                | Action                                                                                     |
| :--------------------- | :----------------------------------------------------------------------------------------- |
| `pnpm install`         | Instalează dependințele                                                                    |
| `pnpm dev`             | Pornește serverul local de Astro la `localhost:4321`                                       |
| `pnpm start`           | Pornește serverul local de Astro la `localhost:4321`                                       |
| `pnpm build`           | Construiește site-ul de producție la `./dist/`                                             |
| `pnpm preview`         | Fă un preview al site-ului local înainte de deploy                                         |
| `pnpm astro ...`       | Rulează comenzi CLI cum ar fi `astro add`, `astro check`                                   |
| `pnpm astro -- --help` | Afișează comenzile disponibile în Astro CLI                                                |
| `pnpm format`          | Validează codul local folosind `Prettier` și `prettier-plugin-astro`                       |
| `pnpm format:fix`      | Validează și **corectează** codul folosind `Prettier` (atenție: poate fi distructiv)       |
| `pnpm lint:js`         | Validează fișierele JavaScript, TypeScript și Astro locale folosind `ESLint`               |
| `pnpm lint:md`         | Validează fișierele Markdown locale folosind `MarkdownLint`                                |
| `pnpm lint:fix`        | Validează și **corectează** fișierele JavaScript, TypeScript și Markdown locale            |
| `pnpm lint`            | Validează fișierele JavaScript, TypeScript, Astro și Markdown cu `ESLint` / `MarkdownLint` |
| `pnpm typecheck`       | Validează type-urile de TypeScript folosind TSC și `tsconfig.json`                         |

## 🛑 Semnalează un bug

Dacă ai observat un bug <https://github.com/ViorelMocanu/digital-resources/labels/bug> și vrei să-l semnalezi, urmează documentația aferentă de aici: [CONTRIBUTING.md].

## 🚀 Structura proiectului

Înăuntrul proiectului Astro, vei vedea următoarele foldere și fișiere:

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   └── Header.astro
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
└── package.json
```

Astro caută fișiere cu extensia `.astro` sau `.md` în interiorul folder-ului `src/pages/` și le randează. Fiecare pagină este expusă ca o rută bazată pe numele fișierului.

Nu e nimic special cu folder-ul `src/components/`, doar că acolo ne punem în mod uzual componentele de tip Astro/React/Vue/Svelte/Preact.

Toate resursele statice în afară de imagini ar trebui puse în directorul `public/`, iar imaginile ar trebui puse în `src/img/` pentru a folosi [noile componente] `<Image />` și `<Picture />` din Astro 3.0.


## 👋 Vrei să discuți cu noi?

Te așteptăm pe [server-ul de Discord] cu drag!

Merci! ❤️

[Viorel Mocanu], [Consultant digital] și [creator de conținut].

[Google Doc-ul făcut de mine acum mai mult timp]: https://bit.ly/vio-digital
[playlist-ul Resurse.dev de aici &rarr;]: https://youtube.com/playlist?list=PLfTqvIG4roBphVLnYuDTkfweQ2GmmcHOq
[regulile]: https://github.com/ViorelMocanu/digital-resources/blob/main/CODE_OF_CONDUCT.md
[ghidul despre cum să contribui]: https://github.com/ViorelMocanu/digital-resources/blob/main/CONTRIBUTING.md
[`humans.txt`]: https://github.com/ViorelMocanu/digital-resources/blob/main/humans.txt
[v1.0]: https://github.com/ViorelMocanu/digital-resources/milestone/1
[GitHub Project-ul]: https://github.com/users/ViorelMocanu/projects/2
[Lista de resurse generale]: https://bit.ly/vio-digital
[Lista de resurse de JS pentru cine vrea să învețe Vue]: https://bit.ly/vio-vue
[în Figma]: https://www.figma.com/file/FpXckvA4HYOJ1HIvsq62GS/Untitled?node-id=0%3A1
[de design]: https://www.behance.net/gallery/143657541/Female-Faces
[Tutorial oficial al Astro 3.0]: https://docs.astro.build/en/tutorial/0-introduction/
[Integrări]: https://astro.build/integrations/
[site-ul oficial Node.js]: https://nodejs.org/en
[instrucțiunile de pe site-ul PNPM]: https://pnpm.io/installation
[CONTRIBUTING.md]: https://github.com/ViorelMocanu/digital-resources/blob/main/CONTRIBUTING.md
[server-ul de Discord]: https://discord.com/invite/UpnAutz
[Viorel Mocanu]: https://github.com/ViorelMocanu
[Consultant digital]: https://www.viorelmocanu.ro/
[creator de conținut]: https://www.youtube.com/@ViorelMocanu
[noile componente]: https://docs.astro.build/en/guides/images/
