'use client';
import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { KickScene } from '@/game/KickScene';
import type { Formation, Team, TeamId } from '@/game/types';

export type BoardStatus = { phase: string; activeTeam: TeamId; score: { red: number; blue: number }; selected: string | null };
type Props = { mode: 'formation' | 'match'; teams: Team[]; formations: Record<TeamId, Formation>; editableTeam: TeamId; settings: { aimGuide: boolean; trajectory: boolean; reducedMotion: boolean }; onStatus?: (s: BoardStatus) => void; onGoal?: (team: TeamId, score: { red: number; blue: number }) => void; onWinner?: (team: TeamId) => void; onFormation?: (f: Formation) => void };
export default function GameBoard(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef(props); callbacks.current = props;
  useEffect(() => {
    if (!host.current) return;
    const scene = new KickScene({
      mode: props.mode,
      teams: props.teams,
      formations: props.formations,
      editableTeam: props.editableTeam,
      settings: props.settings,
      callbacks: {
        onStatus: status => callbacks.current.onStatus?.(status),
        onGoal: (team, score) => callbacks.current.onGoal?.(team, score),
        onWinner: team => callbacks.current.onWinner?.(team),
        onFormation: formation => callbacks.current.onFormation?.(formation),
      },
    });
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, width: 1000, height: 600, backgroundColor: '#0c3929', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true, roundPixels: true }, physics: { default: 'matter', matter: { gravity: { x: 0, y: 0 }, debug: false, enableSleeping: true } }, scene: [scene], input: { mouse: { preventDefaultDown: true } } });
    return () => { game.destroy(true); };
  // Scene intentionally mounts once per board mode. Dynamic values are updated via callback refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode]);
  return <div ref={host} className="board-canvas" aria-label={props.mode === 'match' ? 'Interactive football game board' : 'Interactive formation editor'} onContextMenu={e => e.preventDefault()} />;
}
