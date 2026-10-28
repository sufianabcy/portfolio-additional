# Sufian Choudhury · Portfolio

A one-page portfolio in a quiet, typographic style: a narrow column, monospace labels, one amber accent, and light and
dark themes. It has:

- **Search** (⌘K / Ctrl K, or /): jump to any project, section or write-up, switch the theme, or copy the email address.
- **Live GitHub activity**: each project shows when it was last pushed and a 12-week commit sparkline. Data comes from
  the public GitHub API in the visitor's browser and is cached for an hour. If GitHub can't be reached, it's left out.
- **Today's seed**: the little network next to the name is drawn from the day of the year, so it changes daily. Click
  it for a random one.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. `npm run build` puts the finished site in `dist/`, ready for Vercel, Netlify or
GitHub Pages.

## Where things are

- `index.html`: all the text. Each section is a block you can copy to add an entry: a job, a project (`data-repo` is
  its GitHub repo name, for the activity line), a stack group, an award or a write-up. A badge's colour comes from
  `data-tone`: `green`, `amber`, `violet`, or none for grey.
- `src/main.js`: theme switch, the seed drawing, GitHub activity and the search palette. `GITHUB_USER` and `EMAIL` are at
  the top.
- `src/styles.css`: the look. Every colour is a token at the top, written as `light-dark(light, dark)`; change
  `--accent` to change the amber.
- `photos/`: headshots from the earlier design. This design doesn't use them.
