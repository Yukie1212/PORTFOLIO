# Angelo Miguel Cua — Portfolio

A responsive computer engineering and IT portfolio built with React and Vite. Includes original SVG concept diagrams, project links, mobile navigation, reduced-motion support, and a GitHub Pages workflow.

## Local preview

Requires Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

## Build

```sh
npm run build
npm run lint
```

The generated HTML site is in `dist/`. Serve this folder using a static web server; the React app should not be opened directly as a file.

## Publish on GitHub Pages

1. Create a GitHub repository and push this project's source to its `main` branch.
2. In the repository, open **Settings → Pages → Build and deployment**, and choose **GitHub Actions** as the source.
3. Run **Deploy portfolio to GitHub Pages** from the Actions tab, or push a change to `main`.
4. The completed deployment provides the live portfolio URL.

The workflow in `.github/workflows/deploy.yml` builds and deploys the site automatically. Relative asset paths support both repository and account-level Pages sites.

Official instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## Content

Edit `src/App.jsx` to update the name, biography, capabilities, project links, and contact information. Professional details and the email address were updated from Angelo_Miguel_Cua_CV.docx. The user-provided CV from OneDrive/Desktop is available as a download. Local project evidence includes attendancemonitoring and attendance-mobile-app; the latter is presented as a prototype. Project artwork is an illustrative concept diagram, not a render of the linked CAD files. No unverified career statistics are included.

Colors, layout, and responsive styles are in `src/App.css` and `src/index.css`. Page title and description are in `index.html`.
