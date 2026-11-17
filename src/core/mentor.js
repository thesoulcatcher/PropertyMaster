// Property Mentor: courses, lessons, quizzes and progress (brief module 3).
// Quiz answers are marked here on the server; the correct answers are never sent
// to the browser before a member answers.

import { AppError, iso, newId } from './context.js';
import { record } from './audit.js';
import { COURSES, PASS_MARK, MENTOR_DISCLAIMER, FIT, TEMPLATES, findCourse } from '../data/courses.js';
import { lawTable } from '../data/law-by-nation.js';

function course(courseId) {
  const c = findCourse(courseId);
  if (!c) {
    throw new AppError('not_found', 'That course was not found.', 404);
  }
  return c;
}

// Progress rows store "<course>/<lesson>", so lesson ids never clash across courses.
function completedLessons(ctx, userId, courseId) {
  const prefix = `${courseId}/`;
  return new Set(
    ctx.db
      .prepare('SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND course_id = ?')
      .all(userId, courseId)
      .map((r) => (r.lesson_id.startsWith(prefix) ? r.lesson_id.slice(prefix.length) : r.lesson_id)),
  );
}

function bestAttempt(ctx, userId, courseId) {
  return ctx.db.prepare('SELECT score, total, passed, at FROM quiz_attempts WHERE user_id = ? AND course_id = ? ORDER BY passed DESC, score DESC, at DESC LIMIT 1').get(userId, courseId) || null;
}

export function listCourses(ctx, userId) {
  return COURSES.map((c) => {
    const done = completedLessons(ctx, userId, c.id);
    const best = bestAttempt(ctx, userId, c.id);
    return {
      id: c.id,
      title: c.title,
      summary: c.summary,
      reviewStatus: c.reviewStatus,
      lessonCount: c.lessons.length,
      lessonsDone: c.lessons.filter((l) => done.has(l.id)).length,
      quizPassed: Boolean(best && best.passed),
      complete: c.lessons.every((l) => done.has(l.id)) && Boolean(best && best.passed),
    };
  });
}

// The quiz without its answers, ready for the browser.
function publicQuiz(c) {
  return c.quiz.map((item, i) => ({ index: i, q: item.q, options: item.options }));
}

export function getCourse(ctx, userId, courseId) {
  const c = course(courseId);
  const done = completedLessons(ctx, userId, courseId);
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
    reviewStatus: c.reviewStatus,
    disclaimer: MENTOR_DISCLAIMER,
    lessons: c.lessons.map((l) => ({ id: l.id, title: l.title, done: done.has(l.id) })),
    quiz: publicQuiz(c),
    passMark: PASS_MARK,
    bestAttempt: bestAttempt(ctx, userId, courseId),
  };
}

export function getLesson(ctx, userId, courseId, lessonId) {
  const c = course(courseId);
  const lesson = c.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    throw new AppError('not_found', 'That lesson was not found.', 404);
  }
  const done = completedLessons(ctx, userId, courseId);
  return {
    courseId,
    id: lesson.id,
    title: lesson.title,
    body: lesson.body,
    done: done.has(lesson.id),
    disclaimer: MENTOR_DISCLAIMER,
    nationTable: lesson.nationTable ? lesson.nationTable.map((r) => ({ ...r, fitLabel: FIT[r.fit] })) : null,
    law: (lesson.lawTopics || []).map((id) => lawTable(id)),
    calculators: lesson.calculators || [],
    templates: (lesson.templates || []).map((id) => ({ id, text: TEMPLATES[id] })),
    complianceRows: lesson.complianceRows || [],
  };
}

export function completeLesson(ctx, userId, courseId, lessonId) {
  const c = course(courseId);
  if (!c.lessons.some((l) => l.id === lessonId)) {
    throw new AppError('not_found', 'That lesson was not found.', 404);
  }
  ctx.db
    .prepare('INSERT INTO lesson_progress (user_id, lesson_id, course_id, completed_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, lesson_id) DO NOTHING')
    .run(userId, `${courseId}/${lessonId}`, courseId, iso(ctx));
  return getCourse(ctx, userId, courseId);
}

// answers: an array of chosen option indexes, one per question.
export function submitQuiz(ctx, userId, courseId, answers) {
  const c = course(courseId);
  if (!Array.isArray(answers) || answers.length !== c.quiz.length) {
    throw new AppError('bad_answers', `Answer all ${c.quiz.length} questions.`);
  }
  const feedback = c.quiz.map((item, i) => {
    const chosen = answers[i];
    if (!Number.isInteger(chosen) || chosen < 0 || chosen >= item.options.length) {
      throw new AppError('bad_answers', `Choose one answer for question ${i + 1}.`);
    }
    return { index: i, correct: chosen === item.answer, correctAnswer: item.answer, why: item.why };
  });
  const score = feedback.filter((f) => f.correct).length;
  const total = c.quiz.length;
  const passed = score / total >= PASS_MARK;
  ctx.db.prepare('INSERT INTO quiz_attempts (id, user_id, course_id, score, total, passed, at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(newId(), userId, courseId, score, total, passed ? 1 : 0, iso(ctx));
  record(ctx, { actorId: userId, action: 'mentor.quiz_submitted', target: courseId, detail: { score, total, passed } });
  return { score, total, passed, feedback };
}
