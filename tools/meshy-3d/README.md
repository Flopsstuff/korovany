# tools/meshy-3d

Reusable wrapper + skill for generating web-ready 3D assets via the Meshy AI API
for the `korovany` browser game.

- `meshy.py` — CLI wrapping the create→poll→fetch→export lifecycle.
- `SKILL.md` — how to invoke it (auth, modes, options, output contract).
- `API-FITNESS.md` — measured fitness report (modes, credits, latency, licensing).

Quick start:

```bash
export MESHY_API_KEY=...        # provided to the agent runtime; never commit it
python tools/meshy-3d/meshy.py balance
python tools/meshy-3d/meshy.py text "a low-poly treasure chest" --out ./out/chest --download
```

Generated binaries are gitignored; host them per CTO (Daedalus) guidance.
