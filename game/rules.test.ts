import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD } from './types';
import { allBodiesSettled, goalScorerAt, kickoffTeamAfterGoal, velocityFromPull, winnerAt } from './rules';

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
  it('ignores a tiny pull, reverses pull direction, and caps power', () => {
    assert.equal(velocityFromPull(8, 0), null);
    assert.deepEqual(velocityFromPull(40, 0), { x: 3, y: 0 });
    const powerful = velocityFromPull(400, 0)!;
    assert.equal(powerful.x, 10.5);
    assert.equal(powerful.y, 0);
  });
  it('waits until every body is under both rest thresholds', () => {
    assert.equal(allBodiesSettled([{ velocity: { x: .1, y: -.1 }, angularVelocity: .02 }]), true);
    assert.equal(allBodiesSettled([{ velocity: { x: .2, y: 0 }, angularVelocity: 0 }]), false);
  });
});
