import { defaults, type SaveData } from './types';
const KEY = 'kicktactic-save-v1';
const copyDefaults = () => structuredClone(defaults);
const kits = { red: ['Crimson', 'Scarlet', 'Classic'], blue: ['Azure', 'Royal', 'Ice'] } as const;

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return copyDefaults();
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return copyDefaults();
    const candidate = data as Partial<SaveData>;
    if (candidate.version !== 1 || !Array.isArray(candidate.teams) || candidate.teams.length !== 2) return copyDefaults();
    for (const id of ['red', 'blue'] as const) {
      const team = candidate.teams.find(item => item?.id === id);
      const expected = defaults.teams.find(item => item.id === id)!;
      if (!team || typeof team.name !== 'string' || team.name.length > 22 || !kits[id].includes(team.kit as never) || !Array.isArray(team.players) || team.players.length !== 7) return copyDefaults();
      for (let i = 0; i < expected.players.length; i++) {
        const player = team.players[i];
        if (!player || player.id !== expected.players[i].id || player.team !== id || typeof player.name !== 'string' || player.name.length > 18 || !Number.isInteger(player.number) || player.number < 1 || player.number > 99) return copyDefaults();
      }
      const formation = candidate.formations?.[id];
      if (!formation || typeof formation !== 'object') return copyDefaults();
      for (const player of expected.players) {
        const point = formation[player.id];
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1000 || point.y < 0 || point.y > 600) return copyDefaults();
      }
    }
    const settings = candidate.settings;
    if (!settings || !['sound', 'reducedMotion', 'trajectory', 'aimGuide'].every(key => typeof settings[key as keyof typeof settings] === 'boolean')) return copyDefaults();
    const teams = candidate.teams.map(team => {
      const fallback = defaults.teams.find(item => item.id === team.id)!;
      return { ...team, name: team.name.trim() || fallback.name, players: team.players.map((player, index) => ({ ...player, name: player.name.trim() || fallback.players[index].name })) };
    });
    return { version: 1, teams, formations: candidate.formations!, settings };
  } catch { return copyDefaults(); }
}

export function saveData(data: SaveData) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private browsing / storage unavailable */ } }
