'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, AudioLines, Check, ChevronRight, CircleHelp, Crown, Goal, MoveUpRight, Play, RotateCcw, Settings2, Shield, SlidersHorizontal, Sparkles, Trophy, Users, Volume2, VolumeX, X } from 'lucide-react';
import { defaults, defaultFormation, type Formation, type GameMode, type Player, type SaveData, type Team, type TeamId, type Settings, FIELD } from '@/game/types';
import { loadSave, saveData } from '@/game/storage';
import type { BoardStatus } from '@/components/GameBoard';
const GameBoard = dynamic(() => import('@/components/GameBoard'), { ssr: false });

const displayName = (name: string) => name.toUpperCase();
const makePreset = (team: TeamId, kind: string, players: Player[]): Formation => {
  const left = team === 'red', sign = left ? 1 : -1, origin = left ? 118 : 882;
  const shapes: Record<string, number[][]> = {
    Balanced: [[0,300],[105,145],[105,300],[105,455],[220,115],[220,300],[220,485]],
    Attacking: [[0,300],[90,120],[90,480],[190,190],[190,410],[310,230],[310,370]],
    Defensive: [[0,300],[70,125],[70,250],[70,350],[70,475],[175,215],[175,385]],
    'Wide Formation': [[0,300],[120,75],[120,525],[220,145],[220,455],[320,225],[320,375]],
  };
  const cells = shapes[kind] || shapes.Balanced;
  return Object.fromEntries(players.map((p, i) => [p.id, { x: Math.round(origin + sign * cells[i][0]), y: cells[i][1] }]));
};

function MiniToken({ team, number, name, kit }: { team: TeamId; number: number; name: string; kit?: string }) {
  return <span className={`mini-token ${team} ${kit ? `kit-${kit.toLowerCase()}` : ''}`}><b>{number}</b>{name && <small>{name}</small>}</span>;
}

export default function Home() {
  const [save, setSave] = useState<SaveData>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<GameMode>('menu');
  const [teamTab, setTeamTab] = useState<TeamId>('red');
  const [editTeam, setEditTeam] = useState<TeamId>('red');
  const [boardKey, setBoardKey] = useState(0);
  const [status, setStatus] = useState<BoardStatus>({ phase: 'ready', activeTeam: 'red', score: { red: 0, blue: 0 }, selected: null });
  const [winner, setWinner] = useState<TeamId | null>(null);
  const [goalTeam, setGoalTeam] = useState<TeamId | null>(null);
  const [showExit, setShowExit] = useState(false);
  const [placementNote, setPlacementNote] = useState('');
  const audioContext = useRef<AudioContext | null>(null);
  const playEffect = (kind: 'shot' | 'goal') => {
    if (!save.settings.sound || typeof window === 'undefined' || !window.AudioContext) return;
    try {
      const context = audioContext.current ?? (audioContext.current = new window.AudioContext());
      if (context.state === 'suspended') void context.resume();
      const notes = kind === 'goal' ? [523, 659, 784] : [105];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = kind === 'goal' ? 'sine' : 'triangle';
        oscillator.frequency.setValueAtTime(frequency, context.currentTime + index * .09);
        gain.gain.setValueAtTime(kind === 'goal' ? .045 : .035, context.currentTime + index * .09);
        gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + index * .09 + (kind === 'goal' ? .32 : .08));
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(context.currentTime + index * .09); oscillator.stop(context.currentTime + index * .09 + (kind === 'goal' ? .34 : .1));
      });
    } catch { /* audio is optional and may be blocked by browser policy */ }
  };
  const handleBoardStatus = (next: BoardStatus) => { if (next.phase === 'simulating' && status.phase !== 'simulating') playEffect('shot'); setStatus(next); };
  const teams = save.teams;
  useEffect(() => { setSave(loadSave()); setLoaded(true); }, []);
  useEffect(() => { if (loaded) saveData(save); }, [loaded, save]);
  const current = useMemo(() => teams.find(t => t.id === teamTab)!, [teams, teamTab]);
  const red = teams.find(t => t.id === 'red')!; const blue = teams.find(t => t.id === 'blue')!;
  const patchTeam = (id: TeamId, change: Partial<Team>) => setSave(s => ({ ...s, teams: s.teams.map(t => t.id === id ? { ...t, ...change } : t) }));
  const patchPlayer = (id: TeamId, playerId: string, change: Partial<Player>) => setSave(s => ({ ...s, teams: s.teams.map(t => t.id === id ? { ...t, players: t.players.map(p => p.id === playerId ? { ...p, ...change } : p) } : t) }));
  const patchSetting = (key: keyof Settings, value: boolean) => setSave(s => ({ ...s, settings: { ...s.settings, [key]: value } }));
  const startSetup = () => { setWinner(null); setGoalTeam(null); setEditTeam('red'); setMode('formation'); setBoardKey(k => k + 1); };
  const startMatch = () => { setWinner(null); setGoalTeam(null); setStatus({ phase: 'ready', activeTeam: 'red', score: { red: 0, blue: 0 }, selected: null }); setMode('match'); setBoardKey(k => k + 1); };
  const updateFormation = (team: TeamId, f: Formation) => setSave(s => ({ ...s, formations: { ...s.formations, [team]: { ...s.formations[team], ...f } } }));
  const applyPreset = (kind: string) => { const team = teams.find(t => t.id === editTeam)!; updateFormation(editTeam, makePreset(editTeam, kind, team.players)); setBoardKey(k => k + 1); };
  const resetTeam = () => { const defaultsTeam = defaults.teams.find(t => t.id === teamTab)!; patchTeam(teamTab, { name: defaultsTeam.name, kit: defaultsTeam.kit, players: defaultsTeam.players.map(p => ({ ...p })) }); };
  const resetFormation = () => { updateFormation(editTeam, defaultFormation(editTeam)); setBoardKey(k => k + 1); };
  const beginMatch = () => {
    const spots = teams.flatMap(team => team.players.map(p => ({ team: team.id, id: p.id, point: save.formations[team.id]?.[p.id] })));
    const invalid = spots.some(({ team, point }) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.y < FIELD.top + 28 || point.y > FIELD.bottom - 28 || (team === 'red' ? point.x < FIELD.left + 28 || point.x > 472 : point.x < 528 || point.x > FIELD.right - 28));
    const crowded = spots.some(({ point }, i) => point && (Math.hypot(point.x - 500, point.y - 300) < 34 || spots.slice(i + 1).some(other => other.point && Math.hypot(point.x - other.point.x, point.y - other.point.y) < 42)));
    if (invalid || crowded) {
      setSave(s => ({ ...s, formations: { red: defaultFormation('red'), blue: defaultFormation('blue') } }));
      setPlacementNote('We restored a clear kickoff layout so all pieces begin in legal, non-overlapping positions.'); setBoardKey(k => k + 1); return;
    }
    setPlacementNote(''); startMatch();
  };
  const onGoal = (team: TeamId, score: { red: number; blue: number }) => { playEffect('goal'); setGoalTeam(team); setStatus(s => ({ ...s, score, phase: 'celebration' })); window.setTimeout(() => setGoalTeam(null), 1700); };
  const toggleSetting = (key: keyof Settings, value: boolean) => patchSetting(key, value);

  return <main className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => mode === 'match' ? setShowExit(true) : setMode('menu')}><span className="brand-mark"><Goal size={20}/></span><span>KICK<span>TACTIC</span><small>EVERY MOVE MATTERS</small></span></button>
      <div className="topbar-right"><span className="online-dot"/> LOCAL HOT-SEAT <span className="top-divider"/><button className="icon-button" aria-label="Settings" onClick={() => mode === 'match' ? setShowExit(true) : setMode('settings')}><Settings2 size={18}/></button></div>
    </header>

    {mode === 'menu' && <section className="menu-page">
      <div className="menu-copy"><div className="eyebrow"><span className="eyebrow-line"/> THE BEAUTIFUL GAME, REIMAGINED</div><h1>Every move<br/><em>matters.</em></h1><p className="lead">A tactical tabletop football duel. Set your angle, pull back, and let the pitch decide.</p>
        <button className="primary-button large" onClick={startSetup}><Play size={17} fill="currentColor"/> PLAY MATCH <ChevronRight size={18}/></button>
        <div className="menu-links"><button onClick={() => setMode('team')}><Users size={16}/> TEAM EDITOR</button><button onClick={() => setMode('how')}><CircleHelp size={16}/> HOW TO PLAY</button></div>
        <div className="menu-foot"><span><Shield size={14}/> 2 PLAYERS · 1 DEVICE</span><span>FIRST TO 5</span></div>
      </div>
      <div className="menu-art" aria-label="Animated tabletop football preview"><div className="art-glow"/><div className="preview-pitch"><div className="preview-field"><i className="preview-half"/><i className="preview-circle"/><i className="preview-goal left"/><i className="preview-goal right"/><span className="preview-ball"/><MiniToken team="red" number={9} name="ACE"/><MiniToken team="red" number={4} name="MILES"/><MiniToken team="blue" number={7} name="NOVA"/><MiniToken team="blue" number={2} name="KAI"/><span className="preview-aim"/></div></div><div className="art-caption"><span className="caption-index">01 / 03</span><span>READ THE FIELD. <b>MAKE YOUR MOVE.</b></span><span className="caption-dots"><i/><i/><i/></span></div><div className="floating-note"><Sparkles size={14}/> PURE TACTICS. NO TIMER.</div></div>
    </section>}

    {mode === 'team' && <section className="content-page"><div className="page-heading"><button className="back-link" onClick={() => setMode('menu')}><ArrowLeft size={16}/> MAIN MENU</button><div className="eyebrow"><span className="eyebrow-line"/> YOUR SQUAD, YOUR STYLE</div><h2>Team <em>editor</em></h2><p>Name every player, set your kit, and get your side match-ready.</p></div>
      <div className="editor-shell"><div className="team-tabs"><button className={teamTab === 'red' ? 'active red-tab' : ''} onClick={() => setTeamTab('red')}><span className="team-dot red"/>{red.name}</button><button className={teamTab === 'blue' ? 'active blue-tab' : ''} onClick={() => setTeamTab('blue')}><span className="team-dot blue"/>{blue.name}</button></div>
        <div className="editor-main"><div className="editor-fields"><label className="field-label">TEAM NAME <span>MAX 22 CHARACTERS</span><input maxLength={22} value={current.name} onChange={e => patchTeam(teamTab, { name: e.target.value })} onBlur={() => { if (!current.name.trim()) patchTeam(teamTab, { name: teamTab === 'red' ? 'Crimson United' : 'Azure FC' }); }}/></label>
          <div className="section-label">PLAYER ROSTER <small>7 PLAYERS · NAMES UP TO 18 CHARACTERS</small></div><div className="roster-edit">{current.players.map((p, i) => <div className="player-edit" key={p.id}><MiniToken team={teamTab} kit={current.kit} number={p.number} name=""/><div className="player-fields"><span className="player-role">PLAYER {String(i + 1).padStart(2, '0')}</span><input aria-label={`Player ${i + 1} name`} maxLength={18} value={p.name} onChange={e => patchPlayer(teamTab, p.id, { name: e.target.value })} onBlur={() => { if (!p.name.trim()) patchPlayer(teamTab, p.id, { name: `Player ${i + 1}` }); }}/></div><label className="number-field">NO.<input type="number" min={1} max={99} value={p.number} onChange={e => patchPlayer(teamTab, p.id, { number: Math.max(1, Math.min(99, Math.trunc(Number(e.target.value) || 1))) })}/></label></div>)}</div></div>
          <aside className="kit-preview"><span className="section-label">KIT PREVIEW</span><div className="preview-token-large"><MiniToken team={teamTab} kit={current.kit} number={current.players[0].number} name={current.players[0].name}/></div><strong>{current.players[0].name}</strong><small>HOME KIT · #{current.players[0].number}</small><div className="section-label kit-label">KIT THEME</div><div className="kit-options">{(teamTab === 'red' ? ['Crimson', 'Scarlet', 'Classic'] : ['Azure', 'Royal', 'Ice']).map((kit, i) => <button className={`kit-swatch ${current.kit === kit ? 'chosen' : ''} ${teamTab} swatch-${i}`} key={kit} onClick={() => patchTeam(teamTab, { kit })} title={kit}>{current.kit === kit && <Check size={14}/>}</button>)}</div><p>{current.kit} edition</p><button className="subtle-button" onClick={resetTeam}><RotateCcw size={14}/> RESET TEAM</button></aside>
        </div><div className="editor-bottom"><span><Check size={15}/> Changes save automatically on this device.</span><button className="primary-button" onClick={startSetup}>FORMATION SETUP <ArrowRight size={16}/></button></div></div>
    </section>}

    {mode === 'formation' && <section className="game-page setup-page"><div className="game-heading"><div><button className="back-link" onClick={() => setMode('team')}><ArrowLeft size={15}/> BACK TO TEAMS</button><div className="eyebrow"><span className="eyebrow-line"/> PRE-MATCH SETUP</div><h2>Set your <em>formation</em></h2></div><div className="step-pill"><span>01</span> FORMATION <i/><span>02</span> KICK-OFF</div></div>
      <div className="setup-tools"><div className="edit-team-toggle"><span>ARRANGE</span><button className={editTeam === 'red' ? 'active red' : ''} onClick={() => { setEditTeam('red'); setBoardKey(k => k + 1); }}><i/> {red.name}</button><button className={editTeam === 'blue' ? 'active blue' : ''} onClick={() => { setEditTeam('blue'); setBoardKey(k => k + 1); }}><i/> {blue.name}</button></div><div className="preset-row"><span>QUICK SET</span>{['Balanced','Attacking','Defensive','Wide Formation'].map(v => <button key={v} onClick={() => applyPreset(v)}>{v}</button>)}<button className="reset-formation" onClick={resetFormation}><RotateCcw size={13}/> Reset</button></div></div>
      <div className="formation-board-wrap"><div className="board-tip"><MoveUpRight size={15}/> Drag your seven pieces anywhere in your half. Your opponent stays visible.</div><GameBoard key={`${mode}-${boardKey}`} mode="formation" teams={teams} formations={save.formations} editableTeam={editTeam} settings={save.settings} onFormation={f => updateFormation(editTeam, f)}/><div className="field-legend"><span><i className="red-dot"/> {red.name}</span><span>7 A SIDE <i className="legend-separator"/> FIRST TO FIVE</span><span>{blue.name} <i className="blue-dot"/></span></div></div>
      <div className="formation-footer"><div><p><Shield size={15}/> Legal positions stay inside the pitch and will not overlap another piece.</p>{placementNote && <p className="placement-note">{placementNote}</p>}</div><button className="primary-button large" onClick={beginMatch}><Play size={16} fill="currentColor"/> START MATCH <ChevronRight size={17}/></button></div>
    </section>}

    {mode === 'match' && <section className="game-page match-page"><div className="match-top"><div><button className="back-link" onClick={() => setShowExit(true)}><ArrowLeft size={15}/> LEAVE MATCH</button><div className="eyebrow"><span className="eyebrow-line"/> LOCAL MATCH <span className="live-pill"><i/> LIVE</span></div></div><div className="target-pill"><Trophy size={15}/> FIRST TO <b>5</b></div></div>
      <div className="scoreboard"><div className={`score-team red-side ${status.activeTeam === 'red' ? 'on-turn' : ''}`}><span className="team-dot red"/><div><span className="team-label">HOME</span><strong>{displayName(red.name)}</strong></div><b className="score-num">{status.score.red}</b></div><div className="score-center"><span>VS</span><i/></div><div className={`score-team blue-side ${status.activeTeam === 'blue' ? 'on-turn' : ''}`}><b className="score-num">{status.score.blue}</b><div><span className="team-label">AWAY</span><strong>{displayName(blue.name)}</strong></div><span className="team-dot blue"/></div></div>
      <div className="turn-bar"><span className={`turn-icon ${status.activeTeam}`}><AudioLines size={16}/></span><div><strong>{goalTeam ? 'GOAL!' : status.phase === 'simulating' ? 'THE PLAY IS LIVE' : status.phase === 'celebration' ? 'GOAL CELEBRATION' : `${status.activeTeam === 'red' ? red.name : blue.name}’S TURN`}</strong><small>{status.phase === 'simulating' ? 'Wait for every piece to settle…' : status.phase === 'celebration' ? 'Resetting for the next kickoff' : 'SELECT A PLAYER  ·  PULL BACK TO AIM  ·  RELEASE TO SHOOT'}</small></div><span className="turn-team-chip"><i className={status.activeTeam}/>{status.phase === 'simulating' ? 'IN PLAY' : 'YOUR MOVE'}</span></div>
      <div className="match-board"><GameBoard key={`${mode}-${boardKey}`} mode="match" teams={teams} formations={save.formations} editableTeam="red" settings={save.settings} onStatus={handleBoardStatus} onGoal={onGoal} onWinner={setWinner}/></div>
      <div className="match-bottom"><div className="instruction"><span className="mouse-glyph">↖</span><span><b>Flick to play</b><small>Pull opposite your intended direction</small></span></div><div className="roster-strip"><span className="roster-title">ON THE PITCH</span><div className="roster-pieces">{red.players.map(p => <span key={p.id} className={`roster-chip ${status.selected === p.id ? 'selected' : ''}`} title={p.name}><MiniToken team="red" kit={red.kit} number={p.number} name=""/></span>)}<i className="roster-vs">VS</i>{blue.players.map(p => <span key={p.id} className={`roster-chip ${status.selected === p.id ? 'selected' : ''}`} title={p.name}><MiniToken team="blue" kit={blue.kit} number={p.number} name=""/></span>)}</div></div><button className="icon-button sound-button" aria-label={save.settings.sound ? 'Mute sounds' : 'Enable sounds'} onClick={() => toggleSetting('sound', !save.settings.sound)}>{save.settings.sound ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button></div>
      {goalTeam && <div className={`goal-toast ${goalTeam}`}><Sparkles size={18}/><span>{(goalTeam === 'red' ? red.name : blue.name).toUpperCase()}<b>GOAL!</b></span><strong>{status.score[goalTeam]}</strong></div>}
    </section>}

    {mode === 'how' && <section className="content-page"><div className="page-heading"><button className="back-link" onClick={() => setMode('menu')}><ArrowLeft size={16}/> MAIN MENU</button><div className="eyebrow"><span className="eyebrow-line"/> THE QUICK PLAYBOOK</div><h2>How to <em>play</em></h2><p>Think ahead. Pick your angle. Make every flick count.</p></div><div className="how-grid">{[{n:'01', icon:<Users/>, title:'Pick your piece', body:'Choose any of your seven players. Only the team whose turn it is can move.'},{n:'02', icon:<MoveUpRight/>, title:'Pull back to aim', body:'Click and drag away from the direction you want to shoot. A longer pull means more power.'},{n:'03', icon:<AudioLines/>, title:'Let the play settle', body:'Release to flick. Players and the ball collide with real physics; the next turn starts only when everything stops.'},{n:'04', icon:<Trophy/>, title:'First to five wins', body:'Guide the ball through the goal opening. Goals reset the field, and the conceding team takes kickoff.'}].map(x=><article className="how-card" key={x.n}><span>{x.n}</span><i>{x.icon}</i><h3>{x.title}</h3><p>{x.body}</p></article>)}</div><div className="how-note"><Shield size={16}/> Red starts the match. Each side gets one flick per turn. A miss still counts.</div><button className="primary-button large" onClick={startSetup}><Play size={16} fill="currentColor"/> SET UP A MATCH <ArrowRight size={16}/></button></section>}

    {mode === 'settings' && <section className="content-page"><div className="page-heading"><button className="back-link" onClick={() => setMode('menu')}><ArrowLeft size={16}/> MAIN MENU</button><div className="eyebrow"><span className="eyebrow-line"/> MAKE IT YOURS</div><h2>Game <em>settings</em></h2><p>Fine-tune the table to suit your play style.</p></div><div className="settings-card">{[
      ['sound','Sound effects','Lightweight match sounds and feedback.'],['aimGuide','Aim guide','Show the shot arrow and power meter while aiming.'],['trajectory','Trajectory preview','Display a subtle direction preview for each flick.'],['reducedMotion','Reduced effects','Minimize pulsing highlights and movement trails.']
    ].map(([key,title,desc])=><label className="setting-row" key={key}><span><b>{title}</b><small>{desc}</small></span><input type="checkbox" checked={save.settings[key as keyof Settings]} onChange={e => toggleSetting(key as keyof Settings, e.target.checked)}/><i/></label>)}<div className="settings-foot"><SlidersHorizontal size={15}/> Preferences save automatically on this device.</div></div></section>}

    {winner && mode === 'match' && <div className="modal-scrim"><div className="result-modal"><button className="modal-close" onClick={() => {setWinner(null);setMode('menu');}}><X size={17}/></button><span className="winner-crown"><Crown size={27}/></span><span className="eyebrow">FULL TIME · FIRST TO FIVE</span><h2>{winner === 'red' ? red.name : blue.name}<br/><em>take the win.</em></h2><div className="result-score"><span>{red.name}<b>{status.score.red}</b></span><i>—</i><span>{blue.name}<b>{status.score.blue}</b></span></div><div className="result-actions"><button className="secondary-button" onClick={() => {setWinner(null);setMode('menu');}}>MAIN MENU</button><button className="primary-button" onClick={startMatch}><RotateCcw size={15}/> REMATCH</button></div></div></div>}
    {showExit && <div className="modal-scrim"><div className="confirm-modal"><button className="modal-close" onClick={() => setShowExit(false)}><X size={17}/></button><span className="winner-crown"><ArrowLeft size={22}/></span><h3>Leave this match?</h3><p>Your current score and board position will be lost. Your team and formation settings will stay saved.</p><div className="result-actions"><button className="secondary-button" onClick={() => setShowExit(false)}>KEEP PLAYING</button><button className="primary-button" onClick={() => {setShowExit(false);setWinner(null);setMode('menu');}}>LEAVE MATCH</button></div></div></div>}
  </main>;
}
