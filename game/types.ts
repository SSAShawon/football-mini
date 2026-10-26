export type TeamId = 'red' | 'blue';
export type Point = { x: number; y: number };
export type Player = { id: string; name: string; number: number; team: TeamId };
export type Team = { id: TeamId; name: string; kit: string; players: Player[] };
export type Formation = Record<string, Point>;
export type Settings = { sound: boolean; reducedMotion: boolean; trajectory: boolean; aimGuide: boolean };
export type SaveData = { version: 1; teams: Team[]; formations: Record<TeamId, Formation>; settings: Settings };
export type GameMode = 'menu' | 'team' | 'formation' | 'match' | 'how' | 'settings';

export const FIELD = { width: 1000, height: 600, left: 66, right: 934, top: 42, bottom: 558, goalTop: 237, goalBottom: 363, playerRadius: 19, ballRadius: 10 } as const;
export const TEAM_COLORS = { red: { primary: 0xd9435f, dark: 0x721f35, trim: 0xf2c879, glow: 0xff6b7f }, blue: { primary: 0x3189e8, dark: 0x123b70, trim: 0x6ee7f9, glow: 0x65bdff } } as const;
export const defaultSettings: Settings = { sound: true, reducedMotion: false, trajectory: true, aimGuide: true };

const preset = (team: TeamId): Point[] => {
  const left = team === 'red';
  const sign = left ? 1 : -1;
  const origin = left ? 120 : 880;
  return [
    { x: origin, y: 300 },
    { x: origin + sign * 105, y: 150 }, { x: origin + sign * 105, y: 300 }, { x: origin + sign * 105, y: 450 },
    { x: origin + sign * 220, y: 115 }, { x: origin + sign * 220, y: 300 }, { x: origin + sign * 220, y: 485 },
  ];
};
export const defaultFormation = (team: TeamId): Formation => Object.fromEntries(preset(team).map((p, i) => [`${team}-${i + 1}`, p]));
export const defaultTeams: Team[] = [
  { id: 'red', name: 'Crimson United', kit: 'Crimson', players: ['Keeper','North','Anchor','South','Runner','Maestro','Wing'].map((name, i) => ({ id: `red-${i + 1}`, name, number: i + 1, team: 'red' as const })) },
  { id: 'blue', name: 'Azure FC', kit: 'Azure', players: ['Keeper','North','Anchor','South','Runner','Maestro','Wing'].map((name, i) => ({ id: `blue-${i + 1}`, name, number: i + 1, team: 'blue' as const })) },
];
export const defaults: SaveData = { version: 1, teams: defaultTeams, formations: { red: defaultFormation('red'), blue: defaultFormation('blue') }, settings: defaultSettings };
