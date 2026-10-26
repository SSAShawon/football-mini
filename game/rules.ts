import { FIELD, type TeamId } from './types';

export type Score = { red: number; blue: number };
export type Velocity = { x: number; y: number };
export type MovingBody = { velocity: Velocity; angularVelocity: number; isSleeping?: boolean };
type FlickPhysics<TBody> = {
  set: (body: TBody, property: 'isSleeping', value: false) => void;
  setVelocity: (body: TBody, velocity: Velocity) => void;
};

/** Matter does not wake a sleeping body when Body.setVelocity is called. */
export function wakeAndLaunch<TBody>(body: TBody, velocity: Velocity, physics: FlickPhysics<TBody>): void {
  physics.set(body, 'isSleeping', false);
  physics.setVelocity(body, velocity);
}

/** Returns the scoring side only after the full ball has crossed a legal goal mouth. */
export function goalScorerAt(ball: { x: number; y: number }): TeamId | null {
  const throughMouth = ball.y > FIELD.goalTop + FIELD.ballRadius && ball.y < FIELD.goalBottom - FIELD.ballRadius;
  if (!throughMouth) return null;
  if (ball.x < FIELD.left - FIELD.ballRadius) return 'blue';
  if (ball.x > FIELD.right + FIELD.ballRadius) return 'red';
  return null;
}

export function winnerAt(score: Score): TeamId | null {
  if (score.red >= 5) return 'red';
  if (score.blue >= 5) return 'blue';
  return null;
}

/** Kickoff belongs to the team that conceded the goal. */
export function kickoffTeamAfterGoal(scored: TeamId): TeamId {
  return scored === 'red' ? 'blue' : 'red';
}

/** A tiny drag is ignored; longer drags gain force up to a fixed maximum. */
export function velocityFromPull(dx: number, dy: number): Velocity | null {
  const distance = Math.hypot(dx, dy);
  if (distance < 13) return null;
  const speed = Math.max(1.15, Math.min(10.5, distance * .075));
  return { x: (dx / distance) * speed, y: (dy / distance) * speed };
}

export function allBodiesSettled(bodies: MovingBody[], threshold = .16, angularThreshold = .04): boolean {
  return bodies.every(body => body.isSleeping === true || (Math.hypot(body.velocity.x, body.velocity.y) <= threshold && Math.abs(body.angularVelocity) <= angularThreshold));
}
