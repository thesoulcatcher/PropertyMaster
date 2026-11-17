import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../src/core/context.js';
import * as auth from '../src/core/auth.js';
import * as mentor from '../src/core/mentor.js';
import { COURSES, FIT, TEMPLATES } from '../src/data/courses.js';
import { LAW_TOPICS } from '../src/data/law-by-nation.js';

function setup() {
  const ctx = createContext({ config: { scryptCost: 2 ** 10 } });
  const id = auth.signUp(ctx, { email: 'learner@example.com', password: 'correct horse battery', displayName: 'Example Learner', consents: { terms: true, privacy: true } }).userId;
  return { ctx, id };
}

test('the six courses from the brief are present', () => {
  const ids = COURSES.map((c) => c.id);
  for (const need of ['strategies-by-nation', 'auctions', 'marketing', 'conveyancing', 'surveying', 'brokers']) {
    assert.ok(ids.includes(need), need);
  }
});

test('every strategy lesson has a four-nation table, Scotland first, with a reason for each', () => {
  const strategies = COURSES.find((c) => c.id === 'strategies-by-nation');
  for (const l of strategies.lessons) {
    assert.deepEqual(l.nationTable.map((r) => r.nation), ['scotland', 'england', 'wales', 'northern_ireland'], l.id);
    for (const r of l.nationTable) {
      assert.ok(FIT[r.fit], `${l.id} ${r.nation} fit`);
      assert.ok(r.why.length > 20, `${l.id} ${r.nation} reason`);
    }
  }
});

test('lessons only point at law topics and templates that exist', () => {
  const topics = new Set(LAW_TOPICS.map((t) => t.id));
  for (const c of COURSES) {
    for (const l of c.lessons) {
      for (const t of l.lawTopics || []) assert.ok(topics.has(t), `${c.id}/${l.id} -> ${t}`);
      for (const t of l.templates || []) assert.ok(TEMPLATES[t], `${c.id}/${l.id} template ${t}`);
    }
  }
});

test('every quiz answer index is valid and every question explains itself', () => {
  for (const c of COURSES) {
    assert.ok(c.quiz.length >= 3, c.id);
    for (const q of c.quiz) {
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${c.id}: ${q.q}`);
      assert.ok(q.why.length > 0);
    }
  }
});

test('the course view never sends the quiz answers to the browser', () => {
  const { ctx, id } = setup();
  const view = mentor.getCourse(ctx, id, 'auctions');
  assert.ok(view.quiz.every((q) => !('answer' in q) && !('why' in q)));
});

test('progress: lessons complete once, and the course completes on passing the quiz', () => {
  const { ctx, id } = setup();
  const c = COURSES.find((x) => x.id === 'surveying');
  for (const l of c.lessons) {
    mentor.completeLesson(ctx, id, c.id, l.id);
    mentor.completeLesson(ctx, id, c.id, l.id);
  }
  let row = mentor.listCourses(ctx, id).find((x) => x.id === c.id);
  assert.equal(row.lessonsDone, c.lessons.length);
  assert.equal(row.complete, false);

  const wrong = c.quiz.map((q) => (q.answer + 1) % q.options.length);
  const fail = mentor.submitQuiz(ctx, id, c.id, wrong);
  assert.equal(fail.passed, false);
  assert.equal(fail.score, 0);

  const right = mentor.submitQuiz(ctx, id, c.id, c.quiz.map((q) => q.answer));
  assert.equal(right.passed, true);
  row = mentor.listCourses(ctx, id).find((x) => x.id === c.id);
  assert.equal(row.complete, true);
});

test('a lesson with the same name in two courses is tracked separately', () => {
  const { ctx, id } = setup();
  mentor.completeLesson(ctx, id, 'conveyancing', 'scotland');
  assert.equal(mentor.listCourses(ctx, id).find((x) => x.id === 'conveyancing').lessonsDone, 1);
  assert.equal(mentor.listCourses(ctx, id).find((x) => x.id === 'strategies-by-nation').lessonsDone, 0);
});

test('quiz input is checked: wrong length, blank and out-of-range answers are refused', () => {
  const { ctx, id } = setup();
  assert.throws(() => mentor.submitQuiz(ctx, id, 'auctions', [0]), /Answer all/);
  assert.throws(() => mentor.submitQuiz(ctx, id, 'auctions', [0, 1, null]), /Choose one answer/);
  assert.throws(() => mentor.submitQuiz(ctx, id, 'auctions', [0, 1, 9]), /Choose one answer/);
  assert.throws(() => mentor.submitQuiz(ctx, id, 'nope', []), /not found/);
});

test('a lesson view carries its law tables and the training disclaimer', () => {
  const { ctx, id } = setup();
  const l = mentor.getLesson(ctx, id, 'strategies-by-nation', 'hmo');
  assert.ok(l.law.some((t) => t.id === 'hmo_licensing'));
  assert.match(l.disclaimer, /not advice/);
  assert.equal(l.nationTable[0].nation, 'scotland');
  assert.ok(l.nationTable[0].fitLabel);
});
