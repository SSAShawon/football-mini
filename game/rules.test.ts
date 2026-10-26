import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD } from './types';
import { allBodiesSettled, goalScorerAt, kickoffTeamAfterGoal, velocityFromPull, wakeAndLaunch, winnerAt } from './rules';

describe('goal scoring', () => {
  it('awards the correct side only after a full crossing inside the mouth', () => {
    assert.equal(goalScorerAt({ x: FIELD.left - FIELD.ballRadius - 1, y: 300 }), 'blue');
    assert.equal(goalScorerAt({ x: FIELD.right + FIELD.ballRadius + 1, y: 300 }), 'red');
    assert.equal(goalScorerAt({ x: FIELD.left - 30, y: FIELD.goalTop + FIELD.ballRadius }), null);
    assert.equal(goalScorerAt({ x: FIELD.right + 30, y: FIELD.goalBottom - FIELD.ballRadius }), null);
    assert.equal(goalScorerAt({ x: FIELD.left - 5, y: 300 }), null);
  });
  it('awards kickoff to the conceding side', () => {
    assert.equal(kickoffTeamAfterGoal('red'), 'blue');
    assert.equal(kickoffTeamAfterGoal('blue'), 'red');
  });
});

describe('match and flick rules', () => {
  it('ends at five, including a 4-4 match', () => {
    assert.equal(winnerAt({ red: 4, blue: 4 }), null);
    assert.equal(winnerAt({ red: 5, blue: 4 }), 'red');
    assert.equal(winnerAt({ red: 4, blue: 5 }), 'blue');
    assert.equal(winnerAt({ red: 5, blue: 5 }), 'red');
  });
  it('ignores tiny pulls, follows the flick direction, scales power, and caps it', () => {
    assert.equal(velocityFromPull(8, 0), null);
    assert.deepEqual(velocityFromPull(40, 0), { x: 3, y: 0 });
    assert.deepEqual(velocityFromPull(0, -40), { x: 0, y: -3 });
    const shortShot = velocityFromPull(-20, 0)!;
    const longerShot = velocityFromPull(-80, 0)!;
    assert.ok(Math.abs(shortShot.x) < Math.abs(longerShot.x));
    assert.ok(shortShot.x < 0 && longerShot.x < 0);
    const powerful = velocityFromPull(400, 0)!;
    assert.equal(powerful.x, 10.5);
    assert.equal(powerful.y, 0);
  });
  it('wakes a sleeping Matter body before setting its flick velocity', () => {
    const body = { isSleeping: true, velocity: { x: 0, y: 0 } };
    const calls: string[] = [];
    wakeAndLaunch(body, { x: 4, y: -2 }, {
      set(target, property, value) {
        calls.push('wake');
        assert.equal(property, 'isSleeping');
        target.isSleeping = value;
      },
      setVelocity(target, velocity) {
        calls.push('velocity');
        assert.equal(target.isSleeping, false, 'body must be awake before applying velocity');
        target.velocity = velocity;
      },
    });
    assert.deepEqual(calls, ['wake', 'velocity']);
    assert.deepEqual(body.velocity, { x: 4, y: -2 });
  });
  it('waits for awake bodies to settle and treats Matter sleeping bodies as settled', () => {
    assert.equal(allBodiesSettled([{ velocity: { x: .1, y: -.1 }, angularVelocity: .02 }]), true);
    assert.equal(allBodiesSettled([{ velocity: { x: .2, y: 0 }, angularVelocity: 0 }]), false);
    assert.equal(allBodiesSettled([{ velocity: { x: 6, y: 0 }, angularVelocity: .2, isSleeping: true }]), true);
    assert.equal(allBodiesSettled([{ velocity: { x: 6, y: 0 }, angularVelocity: .2, isSleeping: false }]), false);
  });
});
