# KICKTACTIC

A polished, local hot-seat tabletop football game built with Next.js, React, TypeScript, Phaser 3 and Phaser's Matter.js physics integration.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a production build, run `npm run build` then `npm start`.

## Play

1. Choose **Play Match**, edit team/player names and kits if you like, then set both formations.
2. Drag your seven red or blue tokens to arrange each side. Setup presets are optional; tokens stay in their team's half and cannot overlap.
3. Red takes the first turn. Click-hold one of your team's pieces, pull backward from the direction you want it to travel, and release. A longer pull has more power; very small pulls are ignored.
4. All pieces and the ball resolve their physics before the other team gets its shot. A missed shot still uses the turn.
5. Score by sending the whole ball through the goal mouth. The conceding side takes kickoff. First to five goals wins.

Team names, player names, jersey numbers, kit themes, formations and preferences are stored in versioned LocalStorage on the current device. No account or server is required.

## Checks

- `npm test` — focused rules tests for goals, kickoff, first-to-five, flick vector/power limits and rest detection.
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm audit`

The physics scene is client-only and uses Phaser's bundled Matter engine. Sound is synthesized locally (shot and goal cues); browser audio policies may require the first shot to activate sound. The match is deliberately mouse-first and currently has no save/resume for an in-progress match.
