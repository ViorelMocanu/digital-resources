# Resurse digitale

Proiectul de resurse digitale, prin care transformăm link-urile din Google Doc-ul ăsta <https://bit.ly/vio-digital> într-un website funcțional care să ajute oamenii să parcurgă resursele mai eficient. Găsiți toată seria de video-uri 🔴LIVE de pe YouTube în care am generat codul pentru acest proiect aici: <https://youtube.com/playlist?list=PLfTqvIG4roBphVLnYuDTkfweQ2GmmcHOq>

## Link-uri utile

1. Lista de resurse generale <https://bit.ly/vio-digital>
2. Lista de resurse JS-only <https://bit.ly/vio-vue>
3. Design-ul în Figma <https://www.figma.com/file/FpXckvA4HYOJ1HIvsq62GS/Untitled?node-id=0%3A1>
4. Inspirație de design <https://www.behance.net/gallery/143657541/Female-Faces>

---------------

- Tutorial at: <https://docs.astro.build/en/tutorial/0-introduction/>
- Components at: <https://github.com/markteekman/accessible-astro-starter> + <https://www.accessible-astro.dev/accessible-components/> + <https://github.com/markteekman/accessible-astro-components> + <https://github.com/shaunchander/astro-pwa-starter>
- Migration & next steps: <https://docs.astro.build/en/guides/migrate-to-astro/from-wordpress/> editable at <https://github.com/withastro/docs/blob/main/src/content/docs/en/guides/migrate-to-astro/from-wordpress.mdx> and then <https://docs.astro.build/en/guides/cms/> and then maybe <https://astro.build/themes/submit>
- Integrations at: <https://astro.build/integrations/>

List of interesting integrations to consider:

- `@astrojs/mdx`
- `@astrojs/sitemap`
- `astro-compress` vs `astro-compressor` vs `astro-html-minifier`
- `astro-seo`
- `astro-robots-txt`
- `vite-plugin-pwa` + `astro-webmanifest`
- `@astrojs/partytown`
- `astro-i18next`
- `typescript` + `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`
- `eslint` + `eslint-plugin-astro` + `eslint-plugin-jsx-a11y`
- `sass`
- `svgo`
- `@astro-community/astro-embed-youtube` + `@astro-community/astro-embed-twitter`
- `astro-purgecss`
- `astro-seo-meta`
- `astro-seo-schema`
- `@astrojs/vercel` or `@astrojs/netlify` or `@astrojs/cloudflare` or `@astrojs/deno` for deployment
- `astro-icon` test out
- `@sendgrid` for emailing?
- <del>`@astrojs/image` but may not work on Netlify/Vercel/Deno</del> <ins>Astro 3.0 uses `astro:assets`</ins> <https://www.youtube.com/watch?v=vekQmqRXeDg>
- `accessible-astro-components` just to steal code from
- `@astrojs/tailwind` + `tailwindcss` (optional)
- `prettier` + `prettier-plugin-astro` + `prettier-plugin-tailwindcss` (optional)

[![Netlify Status](https://api.netlify.com/api/v1/badges/01e40750-bc4b-447c-9cd2-7cadacf27fdc/deploy-status)](https://app.netlify.com/sites/ssg-test-1-astro/deploys)


-------

# Astro Starter Kit: Basics

```
npm create astro@latest -- --template basics
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/basics)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/basics)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/basics/devcontainer.json)

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

![just-the-basics](https://github.com/withastro/astro/assets/2244813/a0a5533c-a856-4198-8470-2d67b1d7c554)

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```
/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   └── Card.astro
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
