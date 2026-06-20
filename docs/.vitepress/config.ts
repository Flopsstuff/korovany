import { defineConfig } from 'vitepress'

// Docs are published to GitHub Pages at https://flopsstuff.github.io/korovany/
// so the base path must match the repo name.
export default defineConfig({
  base: '/korovany/',
  title: 'Korovany',
  description: '3D action game / browser SPA — documentation',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Plan', link: '/plan/game-plan' },
      { text: 'Live app', link: 'https://korovany.aimost.pl/' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Project rules', link: '/guide/project-rules' },
          { text: 'Architecture', link: '/guide/architecture' },
        ],
      },
      {
        text: 'Plan',
        items: [{ text: 'Game development plan', link: '/plan/game-plan' }],
      },
      {
        text: 'Operations',
        items: [
          { text: 'Deployment', link: '/operations/deployment' },
          { text: 'Cloudflare credentials', link: '/operations/cloudflare-deploy' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/Flopsstuff/korovany' }],
    search: { provider: 'local' },
  },
})
