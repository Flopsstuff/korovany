# Getting started

## Prerequisites

- **Node.js 22+** and npm 10+
- **Git** with [Git LFS](https://git-lfs.com/) installed (binary assets are
  tracked via LFS — see [Project rules](/guide/project-rules)).

```bash
git lfs install   # one time, per machine
git clone https://github.com/Flopsstuff/korovany.git
cd korovany
npm install
```

## Everyday commands

| Command            | What it does                                          |
| ------------------ | ---------------------------------------------------- |
| `npm run dev`      | Start the Vite dev server (http://localhost:5173)     |
| `npm run build`    | Type-check + production build into `./dist`            |
| `npm run preview`  | Serve the production build locally                     |
| `npm test`         | Run the test suite once (Vitest)                      |
| `npm run test:watch` | Run tests in watch mode                             |
| `npm run lint`     | Type-check without emitting                            |
| `npm run docs:dev` | Preview this documentation site locally               |

## Project layout

See [Architecture](/guide/architecture) for the folder structure and where new
code belongs.
