---
layout: ../layouts/LayoutMarkdown.astro
title: Bine ai venit pe Resurse.dev
description: Un proiect open source și pro bono în care Viorel Mocanu și comunitatea Carieră în IT dezvoltă un website cu resurse digitale pentru Front End, Back End, Design, Marketing, Security și IT în general.
ogImage:
modDate: 2023-10-11T19:35:55+03:00
addDate: 2023-10-11T19:35:55+03:00
canonical: README
template: MarkdownPage
activeMenu: /
breadcrumbArray: []
---

## Resurse digitale: **Resurse.dev**

[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/ViorelMocanu/digital-resources/static.yml)](https://github.com/ViorelMocanu/digital-resources/actions) [![GitHub Pages Deploy Status](https://github.com/ViorelMocanu/digital-resources/actions/workflows/static.yml/badge.svg)](https://github.com/ViorelMocanu/digital-resources/deployments) [![Uptime Robot status](https://img.shields.io/uptimerobot/status/m795450488-8340b637195100fd9eb8309b)](https://resurse.dev) [![GitHub contributors](https://img.shields.io/github/contributors/ViorelMocanu/digital-resources.svg)](https://github.com/ViorelMocanu/digital-resources/graphs/contributors) [![GitHub Sponsors](https://img.shields.io/github/sponsors/ViorelMocanu)](https://github.com/sponsors/ViorelMocanu/) [![ISC license](https://img.shields.io/badge/License-ISC-blue.svg?style=flat)](https://github.com/ViorelMocanu/digital-resources/blob/main/LICENSE) [![W3C Validation](https://img.shields.io/w3c-validation/html?targetUrl=https%3A%2F%2Fresurse.dev)](https://validator.w3.org/nu/?doc=https%3A%2F%2Fresurse.dev%2F&showsource=yes&showoutline=yes) ![Libraries.io dependency status for GitHub repo](https://img.shields.io/librariesio/github/ViorelMocanu/digital-resources)

Salutare!

Bine-ai venit în proiectul de _resurse digitale_, prin care transformăm link-urile din [Google Doc-ul făcut de mine acum mai mult timp] într-un website funcțional care să ajute oamenii să parcurgă resursele de învățare mai eficient.

Vezi toată seria de video-uri 🔴LIVE de pe YouTube în care am generat codul pentru acest proiect în [playlist-ul Resurse.dev de aici →].

Proiectul e abia la început, și dacă vrei să te implici, orice contribuție de-a ta este binevenită! Citește [regulile] și [ghidul despre cum să contribui] și ajută-ne să facem proiectul ăsta _cel mai bun loc din care să alegi ce resurse să folosești pentru învățare_! Contribuitorii majori vor fi menționați în [`humans.txt`].

Documentul curent este momentan în 🇷🇴 Română, însă cel mai probabil la finalul [v1.0] va fi bilingv (inclusiv în 🇬🇧 Engleză) pentru a stimula oameni din toate colțurile lumii să se alăture pentru a contribui la proiect și a semnala potențiale probleme. Restul documentației și task-urile din [GitHub Project-ul] unde poți vedea statusul tuturor issue-urilor create vor fi exclusiv în 🇬🇧 Engleză.

## Quick note in 🇬🇧 English

This project began in a 🇷🇴 Romanian community, so please excuse the almost entirely Romanian content in this `README.md` - we will translate this document in 🇬🇧 English by the end of [v1.0].

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
    - [ ] `vite-plugin-pwa` + `astro-webmanifest`
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

---

## 🕹️ Cum pornești proiectul?

Întâi, clonează repository-ul curent:

```bash
git clone https://github.com/ViorelMocanu/digital-resources.git
```

**BONUS:** dacă ești pe <del>Winblows</del> <ins>Windows</ins>, asigură-te că faci pașii următori într-o consolă cu drepturi de Administrator. Fie deschide VSCode sau IDE-ul tău preferat cu consolă atașată cu _`click dreapta > Run as Administrator`_ fie rulează `cmd.exe` sau `powershell.exe` cu drepturi de Admin.

Asigură-te că ai ultima versiune de Node instalată de pe [site-ul oficial Node.js]. Ideal e să ai minim versiunea `18.18.0`. Poți verifica versiunea instalată cu comanda:

```bash
node -v
```

Mai asigură-te că ai instalat și ultima variantă de PNPM, urmând [instrucțiunile de pe site-ul PNPM], sau rulează una din comenzile următoare.

Pentru Windows:

```bash
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

Pentru POSIX / Mac / Linux / \*nix cu librăria `curl` disponibilă:

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

## 🛑 Semnalează un bug sau contribuie

![GitHub issues](https://img.shields.io/github/issues/ViorelMocanu/digital-resources) ![GitHub issues by-label](https://img.shields.io/github/issues/ViorelMocanu/digital-resources/bug) ![GitHub pull requests](https://img.shields.io/github/issues-pr/ViorelMocanu/digital-resources) ![GitHub milestone details](https://img.shields.io/github/milestones/progress/ViorelMocanu/digital-resources/2) ![GitHub milestone details](https://img.shields.io/github/milestones/progress/ViorelMocanu/digital-resources/1) ![GitHub milestone details](https://img.shields.io/github/milestones/progress/ViorelMocanu/digital-resources/3)

Dacă ai observat un bug [![GitHub label: bug](https://img.shields.io/github/labels/ViorelMocanu/digital-resources/bug) ](https://github.com/ViorelMocanu/digital-resources/labels/bug) și vrei să-l semnalezi, urmează documentația aferentă de aici: [CONTRIBUTING.md].

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

Te așteptăm pe [server-ul de Discord], [canalul de YouTube] sau [grupul de Facebook] cu drag!

Pe serverul de Discord sunt: [![Discord](https://img.shields.io/discord/715653203273842850)](https://discord.com/invite/UpnAutz)

Pe canalul de YouTube am strâns până acum: [![YouTube Channel Views](https://img.shields.io/youtube/channel/views/UCwCxt0pJ4DrKtbSjkcqcgCA) ![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCwCxt0pJ4DrKtbSjkcqcgCA)](https://www.youtube.com/@ViorelMocanu?sub_confirmation=1)

[![YouTube](https://img.shields.io/badge/YouTube-%23FF0000.svg?style=for-the-badge&logo=YouTube&logoColor=white)](https://www.youtube.com/@ViorelMocanu) [![Discord](https://img.shields.io/badge/Discord-%235865F2.svg?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/invite/UpnAutz) [![Facebook](https://img.shields.io/badge/Facebook-%231877F2.svg?style=for-the-badge&logo=Facebook&logoColor=white)](https://www.facebook.com/groups/carierait) [![Instagram](https://img.shields.io/badge/Instagram-%23E4405F.svg?style=for-the-badge&logo=Instagram&logoColor=white)](https://www.instagram.com/viorelmocanu.ro/) [![LinkedIn](https://img.shields.io/badge/linkedin-%230077B5.svg?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/viorelmocanu/) [![Twitter](https://img.shields.io/badge/Twitter-%231DA1F2.svg?style=for-the-badge&logo=Twitter&logoColor=white)](https://twitter.com/ViorelMocanu) [![Gmail](https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white)](https://viorelmocanu.ck.page/newsletter) [![WordPress](https://img.shields.io/badge/WordPress-%23117AC9.svg?style=for-the-badge&logo=WordPress&logoColor=white)](https://www.viorelmocanu.ro/blog/)

## 💸 Sponsorizează inițiativa

Dacă simți că poți contribui financiar la această inițiativă, inclusiv să susții video-urile lui Viorel și materialele ajutătoare pe care le produce, îl poți sponsoriza aici:

[![Github-sponsors](https://img.shields.io/badge/sponsor-30363D?style=for-the-badge&logo=GitHub-Sponsors&logoColor=#EA4AAA)](https://github.com/sponsors/ViorelMocanu) [![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/ViorelMocanu) [![BuyMeACoffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/viorel)

Contribuțiile voastre vor ajuta la crearea de mai mult conținut pentru voi și la finalizarea mai rapidă a proiectului actual. Toți banii din investiții se întorc la comunitate, indirect, prin sprijinul acordat lui [Viorel](https://github.com/ViorelMocanu).

Merci! ❤️

[Viorel Mocanu], [Consultant digital] și [creator de conținut].

[Google Doc-ul făcut de mine acum mai mult timp]: https://bit.ly/vio-digital
[playlist-ul Resurse.dev de aici →]: https://youtube.com/playlist?list=PLfTqvIG4roBphVLnYuDTkfweQ2GmmcHOq
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
[canalul de YouTube]: https://www.youtube.com/@ViorelMocanu
[grupul de Facebook]: https://www.facebook.com/groups/carierait
