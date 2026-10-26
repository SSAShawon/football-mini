'use client';
import * as Phaser from 'phaser';
import { FIELD, TEAM_COLORS, type Formation, type Player, type Team, type TeamId, type Point } from './types';
import { allBodiesSettled, goalScorerAt, kickoffTeamAfterGoal, velocityFromPull, wakeAndLaunch, winnerAt } from './rules';

type SceneStatus = { phase: string; activeTeam: TeamId; score: { red: number; blue: number }; selected: string | null };
type SceneCallbacks = { onStatus?: (status: SceneStatus) => void; onGoal?: (team: TeamId, score: { red: number; blue: number }) => void; onWinner?: (team: TeamId) => void; onFormation?: (formation: Formation) => void };
type SceneOptions = { mode: 'formation' | 'match'; teams: Team[]; formations: Record<TeamId, Formation>; editableTeam: TeamId; settings: { aimGuide: boolean; trajectory: boolean; reducedMotion: boolean }; callbacks: SceneCallbacks };
type Token = { player: Player; body: MatterJS.BodyType; label: Phaser.GameObjects.Text; number: Phaser.GameObjects.Text };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const palette = (team: Team) => {
  if (team.id === 'red') {
    if (team.kit === 'Scarlet') return { primary: 0xe45c4e, dark: 0x762a2b, trim: 0xf3d19a, glow: 0xff8271 };
    if (team.kit === 'Classic') return { primary: 0xa93450, dark: 0x521c32, trim: 0xe5d4bb, glow: 0xff7188 };
    return TEAM_COLORS.red;
  }
  if (team.kit === 'Royal') return { primary: 0x5a63d8, dark: 0x272b73, trim: 0xc3c9ff, glow: 0x929aff };
  if (team.kit === 'Ice') return { primary: 0x32aab7, dark: 0x145460, trim: 0xaff8f1, glow: 0x7ff5ea };
  return TEAM_COLORS.blue;
};

export class KickScene extends Phaser.Scene {
  private opts!: SceneOptions;
  private tokens: Token[] = [];
  private ball!: MatterJS.BodyType;
  private ballTail: Point[] = [];
  private fieldG!: Phaser.GameObjects.Graphics;
  private playG!: Phaser.GameObjects.Graphics;
  private aimG!: Phaser.GameObjects.Graphics;
  private activeTeam: TeamId = 'red';
  private phase: 'ready' | 'aiming' | 'simulating' | 'celebration' | 'over' | 'formation' = 'ready';
  private selected: Token | null = null;
  private dragOrigin: Point | null = null;
  private pointerPoint: Point | null = null;
  private restFrames = 0;
  private simFrames = 0;
  private celebrationFrames = 0;
  private score = { red: 0, blue: 0 };
  private lastGoal: TeamId | null = null;
  private impacts: Array<{ x: number; y: number; life: number }> = [];

  constructor(options: SceneOptions) { super({ key: 'KickScene' }); this.opts = options; }
  create() {
    this.phase = this.opts.mode === 'formation' ? 'formation' : 'ready';
    this.matter.world.setBounds(0, 0, FIELD.width, FIELD.height, 48, true, true, true, true);
    this.matter.world.engine.positionIterations = 8;
    this.matter.world.engine.velocityIterations = 6;
    this.fieldG = this.add.graphics(); this.drawField();
    this.playG = this.add.graphics(); this.aimG = this.add.graphics();
    this.physicsBuild();
    this.input.on('pointerdown', this.pointerDown, this);
    this.input.on('pointermove', this.pointerMove, this);
    this.input.on('pointerup', this.pointerUp, this);
    this.matter.world.on('collisionstart', this.handleCollision, this);
    this.notifyStatus(null);
  }
  private drawField() {
    const g = this.fieldG; g.clear();
    g.fillStyle(0x0c3929, 1); g.fillRoundedRect(0, 0, 1000, 600, 18);
    g.fillStyle(0x176b45, 1); g.fillRoundedRect(16, 16, 968, 568, 12);
    const stripeW = (FIELD.right - FIELD.left) / 10;
    for (let i = 0; i < 10; i++) { if (i % 2 === 0) { g.fillStyle(0x1c774c, .42); g.fillRect(FIELD.left + i * stripeW, FIELD.top, stripeW, FIELD.bottom - FIELD.top); } }
    // restrained procedural grass grain
    for (let i = 0; i < 270; i++) { const x = 24 + ((i * 173) % 952), y = 22 + ((i * 97) % 556); g.lineStyle(1, 0x8bbf91, .07); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y - 2); g.strokePath(); }
    g.lineStyle(2, 0xe9f4e7, .86); g.strokeRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);
    g.lineBetween(500, FIELD.top, 500, FIELD.bottom); g.strokeCircle(500, 300, 82); g.fillStyle(0xf2f8ee, .95); g.fillCircle(500, 300, 3.5);
    // penalty boxes and six-yard boxes
    g.strokeRect(FIELD.left, 176, 135, 248); g.strokeRect(FIELD.left, 222, 52, 156);
    g.strokeRect(FIELD.right - 135, 176, 135, 248); g.strokeRect(FIELD.right - 52, 222, 52, 156);
    g.strokeCircle(177, 300, 3); g.strokeCircle(823, 300, 3);
    // corner arcs
    for (const [x, y, start] of [[FIELD.left, FIELD.top, 0], [FIELD.right, FIELD.top, 90], [FIELD.right, FIELD.bottom, 180], [FIELD.left, FIELD.bottom, 270]] as number[][]) { g.beginPath(); g.arc(x, y, 17, Phaser.Math.DegToRad(start), Phaser.Math.DegToRad(start + 90), false); g.strokePath(); }
    // goals
    g.fillStyle(0xe8f0ea, .14); g.fillRect(24, 237, 42, 126); g.fillRect(934, 237, 42, 126);
    g.lineStyle(4, 0xf6f7ee, 1); g.lineBetween(66, 237, 66, 363); g.lineBetween(934, 237, 934, 363);
    g.fillStyle(0xf9faf2, 1); g.fillCircle(66, 237, 5); g.fillCircle(66, 363, 5); g.fillCircle(934, 237, 5); g.fillCircle(934, 363, 5);
  }
  private physicsBuild() {
    const { left, right, top, bottom, goalTop, goalBottom } = FIELD;
    const wall = (x: number, y: number, w: number, h: number) => this.matter.add.rectangle(x, y, w, h, { isStatic: true, restitution: .55, friction: .08, label: 'wall' });
    wall(500, top - 8, right - left + 4, 16); wall(500, bottom + 8, right - left + 4, 16);
    wall(left - 8, (top + goalTop) / 2, 16, goalTop - top); wall(left - 8, (goalBottom + bottom) / 2, 16, bottom - goalBottom);
    wall(right + 8, (top + goalTop) / 2, 16, goalTop - top); wall(right + 8, (goalBottom + bottom) / 2, 16, bottom - goalBottom);
    // Posts collide with both the ball and tokens.
    for (const x of [left, right]) for (const y of [goalTop, goalBottom]) this.matter.add.circle(x, y, 5, { isStatic: true, restitution: .72, label: 'post' });
    for (const team of this.opts.teams) for (const p of team.players) {
      const position = this.opts.formations[team.id][p.id] || { x: team.id === 'red' ? 150 : 850, y: 300 };
      const radius = FIELD.playerRadius;
      const body = this.matter.add.circle(position.x, position.y, radius, { isStatic: this.opts.mode === 'formation', friction: .045, frictionAir: .034, restitution: .57, density: .0021, label: `player:${p.id}` });
      const label = this.add.text(position.x, position.y + 28, p.name, { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#f7f9f5', fontStyle: 'bold', stroke: '#092017', strokeThickness: 3, align: 'center', fixedWidth: 92 }).setOrigin(.5, .5);
      const number = this.add.text(position.x, position.y + 1, String(p.number), { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#ffffff', fontStyle: 'bold', stroke: '#10212a', strokeThickness: 2 }).setOrigin(.5);
      this.tokens.push({ player: p, body, label, number });
    }
    this.ball = this.matter.add.circle(500, 300, FIELD.ballRadius, { friction: .018, frictionAir: .025, restitution: .68, density: .0012, label: 'ball' });
  }
  private pointerDown(pointer: Phaser.Input.Pointer) {
    if (this.opts.mode === 'formation') {
      if (this.phase !== 'formation') return;
      const token = this.hitToken(pointer.worldX, pointer.worldY, this.opts.editableTeam);
      if (token) { this.selected = token; this.dragOrigin = { x: pointer.worldX, y: pointer.worldY }; this.phase = 'aiming'; }
      return;
    }
    if (this.phase !== 'ready') return;
    const token = this.hitToken(pointer.worldX, pointer.worldY, this.activeTeam);
    if (!token) return;
    this.selected = token; this.dragOrigin = { x: pointer.worldX, y: pointer.worldY }; this.pointerPoint = this.dragOrigin; this.phase = 'aiming';
    this.notifyStatus(token.player.id);
  }
  private hitToken(x: number, y: number, team: TeamId) {
    return [...this.tokens].reverse().find(t => t.player.team === team && Phaser.Math.Distance.Between(x, y, t.body.position.x, t.body.position.y) <= FIELD.playerRadius + 8) || null;
  }
  private pointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.selected || !this.dragOrigin) return;
    this.pointerPoint = { x: pointer.worldX, y: pointer.worldY };
    if (this.opts.mode === 'formation') {
      const team = this.selected.player.team;
      const margin = 28;
      const minX = team === 'red' ? FIELD.left + margin : 500 + margin;
      const maxX = team === 'red' ? 500 - margin : FIELD.right - margin;
      const x = clamp(pointer.worldX, minX, maxX), y = clamp(pointer.worldY, FIELD.top + margin, FIELD.bottom - margin);
      const overlap = this.tokens.some(t => t !== this.selected && Phaser.Math.Distance.Between(x, y, t.body.position.x, t.body.position.y) < 42) || Phaser.Math.Distance.Between(x, y, 500, 300) < 34;
      if (!overlap) this.matter.body.setPosition(this.selected.body, { x, y });
    }
  }
  private pointerUp(pointer: Phaser.Input.Pointer) {
    if (!this.selected || !this.dragOrigin) return;
    const token = this.selected;
    if (this.opts.mode === 'formation') {
      this.phase = 'formation'; this.selected = null; this.dragOrigin = null;
      const formation: Formation = {};
      for (const t of this.tokens) formation[t.player.id] = { x: Math.round(t.body.position.x), y: Math.round(t.body.position.y) };
      this.opts.callbacks.onFormation?.(formation); return;
    }
    const dx = this.dragOrigin.x - pointer.worldX, dy = this.dragOrigin.y - pointer.worldY;
    const velocity = velocityFromPull(dx, dy);
    this.selected = null; this.dragOrigin = null; this.pointerPoint = null;
    if (!velocity) { this.phase = 'ready'; this.notifyStatus(null); return; }
    wakeAndLaunch(token.body, velocity, this.matter.body);
    this.phase = 'simulating'; this.restFrames = 0; this.simFrames = 0;
    this.notifyStatus(null);
  }
  private notifyStatus(selected: string | null) {
    this.opts.callbacks.onStatus?.({ phase: this.phase, activeTeam: this.activeTeam, score: { ...this.score }, selected });
  }
  private handleCollision(event: MatterJS.IEventCollision<MatterJS.Engine>) {
    if (this.opts.settings.reducedMotion) return;
    for (const pair of event.pairs) {
      const collision = pair as unknown as MatterJS.ICollisionPair;
      const bodyA = collision.bodyA as MatterJS.BodyType & { label?: string };
      const bodyB = collision.bodyB as MatterJS.BodyType & { label?: string };
      const involved = [bodyA.label ?? '', bodyB.label ?? ''].some(label => label === 'ball' || label.startsWith('player:'));
      if (!involved) continue;
      const contact = collision.collision.supports[0];
      if (contact) this.impacts.push({ x: contact.x, y: contact.y, life: 1 });
    }
    if (this.impacts.length > 18) this.impacts.splice(0, this.impacts.length - 18);
  }
  update(_time: number, delta: number) {
    this.impacts.forEach(impact => { impact.life -= delta / 300; });
    this.impacts = this.impacts.filter(impact => impact.life > 0);
    if (this.opts.mode === 'formation') { this.renderBoard(); return; }
    if (this.phase === 'simulating') {
      this.simFrames++;
      const bx = this.ball.position.x, by = this.ball.position.y;
      const scorer = goalScorerAt({ x: bx, y: by });
      if (scorer) {
        this.goal(scorer);
      } else {
        const bodies = [...this.tokens.map(t => t.body), this.ball];
        this.restFrames = allBodiesSettled(bodies) ? this.restFrames + 1 : 0;
        if (this.restFrames >= 24 || this.simFrames > 720) {
          if (this.simFrames > 720) for (const b of bodies) { this.matter.body.setVelocity(b, { x: 0, y: 0 }); this.matter.body.setAngularVelocity(b, 0); }
          this.phase = 'ready'; this.activeTeam = this.activeTeam === 'red' ? 'blue' : 'red';
          this.notifyStatus(null);
        }
      }
    }
    if (this.phase === 'celebration') {
      this.celebrationFrames++;
      if (this.celebrationFrames > 100) {
        const winner = winnerAt(this.score);
        if (winner) { this.phase = 'over'; this.opts.callbacks.onWinner?.(winner); }
        else { this.kickoffReset(); this.phase = 'ready'; this.activeTeam = kickoffTeamAfterGoal(this.lastGoal!); this.notifyStatus(null); }
      }
    }
    this.renderBoard();
  }
  private goal(team: TeamId) {
    if (this.phase !== 'simulating') return;
    this.phase = 'celebration'; this.celebrationFrames = 0; this.lastGoal = team; this.score[team] += 1;
    for (const t of this.tokens) { this.matter.body.setVelocity(t.body, { x: 0, y: 0 }); this.matter.body.setStatic(t.body, true); }
    this.matter.body.setVelocity(this.ball, { x: 0, y: 0 }); this.matter.body.setStatic(this.ball, true);
    this.opts.callbacks.onGoal?.(team, { ...this.score });
  }
  private kickoffReset() {
    for (const t of this.tokens) {
      const position = this.opts.formations[t.player.team][t.player.id] || { x: t.player.team === 'red' ? 180 : 820, y: 300 };
      this.matter.body.setStatic(t.body, false); this.matter.body.set(t.body, 'isSleeping', false);
      this.matter.body.setPosition(t.body, position); this.matter.body.setVelocity(t.body, { x: 0, y: 0 }); this.matter.body.setAngularVelocity(t.body, 0);
    }
    this.matter.body.setStatic(this.ball, false); this.matter.body.set(this.ball, 'isSleeping', false);
    this.matter.body.setPosition(this.ball, { x: 500, y: 300 }); this.matter.body.setVelocity(this.ball, { x: 0, y: 0 });
    // Any custom layout is kept, but invalid / too-close kickoff spots are corrected deterministically.
    for (let i = 0; i < this.tokens.length; i++) for (let j = i + 1; j < this.tokens.length; j++) {
      const a = this.tokens[i], b = this.tokens[j];
      if (Phaser.Math.Distance.Between(a.body.position.x, a.body.position.y, b.body.position.x, b.body.position.y) < 42) this.matter.body.setPosition(b.body, { x: b.player.team === 'red' ? clamp(b.body.position.x + 45, 90, 465) : clamp(b.body.position.x - 45, 535, 910), y: clamp(b.body.position.y + 24, 70, 530) });
    }
  }
  private renderBoard() {
    const g = this.playG; g.clear();
    if (this.phase === 'simulating' && !this.opts.settings.reducedMotion) {
      this.ballTail.push({ x: this.ball.position.x, y: this.ball.position.y }); if (this.ballTail.length > 9) this.ballTail.shift();
      this.ballTail.forEach((p, i) => { g.fillStyle(0xf8f5e8, .035 + .12 * i / this.ballTail.length); g.fillCircle(p.x, p.y, FIELD.ballRadius * (i + 1) / this.ballTail.length); });
    } else this.ballTail = [];
    for (const impact of this.impacts) { g.lineStyle(1.8, 0xf2c879, impact.life * .68); g.strokeCircle(impact.x, impact.y, 6 + (1 - impact.life) * 13); }
    for (const t of this.tokens) {
      const { x, y } = t.body.position, team = t.player.team, color = palette(this.opts.teams.find(entry => entry.id === team)!);
      const isSelected = this.selected === t;
      g.fillStyle(0x06140f, .35); g.fillCircle(x + 1, y + 4, 22);
      if ((isSelected || (this.opts.mode === 'match' && team === this.activeTeam && this.phase === 'ready')) && this.opts.settings.aimGuide) {
        g.lineStyle(isSelected ? 3 : 1.5, color.trim, isSelected ? .94 : .36); g.strokeCircle(x, y, 25 + (isSelected ? Math.sin(this.time.now / 120) * 1.4 : 0));
      }
      g.fillStyle(color.dark, 1); g.fillCircle(x, y, 20);
      g.fillStyle(color.trim, 1); g.fillCircle(x, y, 18.2);
      g.fillStyle(color.primary, 1); g.fillCircle(x, y, 16.1);
      // Tiny jersey panels and shoulder accents make the pieces read as miniature kits.
      g.fillStyle(color.dark, .65); g.fillRoundedRect(x - 7.2, y - 8, 14.4, 16, 3);
      g.fillStyle(color.trim, .85); g.fillRect(x - 10, y - 9, 3, 7); g.fillRect(x + 7, y - 9, 3, 7);
      g.lineStyle(1, 0xffffff, .62); g.strokeCircle(x - 5, y - 6, 1.7); g.strokeCircle(x + 5, y - 6, 1.7);
      t.label.setPosition(x, y + 29).setText(t.player.name.length > 15 ? `${t.player.name.slice(0, 14)}…` : t.player.name);
      t.number.setPosition(x, y + 1).setText(String(t.player.number));
    }
    const b = this.ball.position;
    g.fillStyle(0x05120d, .32); g.fillCircle(b.x + 2, b.y + 3, 12);
    g.fillStyle(0xf1f2e7, 1); g.fillCircle(b.x, b.y, FIELD.ballRadius);
    g.lineStyle(1.5, 0x27342d, .8); g.strokeCircle(b.x, b.y, FIELD.ballRadius);
    g.fillStyle(0x35433b, .9); g.fillCircle(b.x, b.y, 2.5); g.fillTriangle(b.x - 6, b.y - 1, b.x - 3, b.y - 5, b.x, b.y - 2); g.fillTriangle(b.x + 3, b.y + 1, b.x + 7, b.y + 2, b.x + 4, b.y + 6);
    this.aimG.clear();
    if (this.opts.mode === 'match' && this.phase === 'aiming' && this.selected && this.dragOrigin && this.pointerPoint) {
      const start = this.selected.body.position, dx = start.x - this.pointerPoint.x, dy = start.y - this.pointerPoint.y, d = Math.hypot(dx, dy);
      if (d > 5) {
        const length = Math.min(d, 140), nx = dx / d, ny = dy / d, endX = start.x + nx * length, endY = start.y + ny * length;
        if (this.opts.settings.aimGuide) {
          this.aimG.lineStyle(3, palette(this.opts.teams.find(entry => entry.id === this.activeTeam)!).trim, .9); this.aimG.lineBetween(start.x, start.y, endX, endY);
          this.aimG.fillStyle(TEAM_COLORS[this.activeTeam].trim, .95); this.aimG.fillTriangle(endX, endY, endX - nx * 13 - ny * 6, endY - ny * 13 + nx * 6, endX - nx * 13 + ny * 6, endY - ny * 13 - nx * 6);
        }
        if (this.opts.settings.trajectory && !this.opts.settings.reducedMotion) {
          for (let i = 1; i <= 6; i++) { const factor = i * 8; this.aimG.fillStyle(0xf7f3dc, .34 - i * .035); this.aimG.fillCircle(start.x + nx * Math.min(120, length * .7) + nx * factor * .15, start.y + ny * Math.min(120, length * .7) + ny * factor * .15, 2.5); }
        }
        this.aimG.fillStyle(0x101b20, .85); this.aimG.fillRoundedRect(start.x - 27, start.y - 36, 54, 6, 3);
        this.aimG.fillStyle(0xf2c879, .95); this.aimG.fillRoundedRect(start.x - 26, start.y - 35, 52 * clamp(d / 140, .04, 1), 4, 2);
      }
    }
    if (this.phase === 'celebration') {
      const team = this.lastGoal ? palette(this.opts.teams.find(entry => entry.id === this.lastGoal)!) : TEAM_COLORS.red;
      g.fillStyle(team.primary, .16); g.fillCircle(500, 300, 60 + Math.sin(this.celebrationFrames * .15) * 14);
    }
  }
}
