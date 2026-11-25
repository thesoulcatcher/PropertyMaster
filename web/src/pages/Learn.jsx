import { useState } from 'react';
import { get, post } from '../api.js';
import { Notice, Source, useLoad, Loading } from '../ui.jsx';

const NATION_LABEL = { scotland: 'Scotland', england: 'England', wales: 'Wales', northern_ireland: 'Northern Ireland' };
const FIT_BADGE = { works: 'ok', care: '', check: 'off' };

export function MentorList() {
  const state = useLoad(() => get('/mentor/courses'), []);
  return (
    <div className="stack">
      <h1>Property Mentor</h1>
      <p className="muted">AI-led training. Training only: for a decision on your own deal, speak to the professional named in the lesson.</p>
      <Loading state={state}>
        {(courses) => (
          <div className="grid">
            {courses.map((c) => (
              <a key={c.id} className="card link" href={`#/mentor/${c.id}`}>
                <h3>{c.title}</h3>
                <p className="small muted">{c.summary}</p>
                <p className="small">
                  {c.lessonsDone} of {c.lessonCount} lessons{c.quizPassed ? ', quiz passed' : ''}{' '}
                  {c.complete ? <span className="badge ok">Complete</span> : null}
                </p>
              </a>
            ))}
          </div>
        )}
      </Loading>
    </div>
  );
}

export function CoursePage({ courseId }) {
  const state = useLoad(() => get(`/mentor/courses/${courseId}`), [courseId]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const submit = async (quiz) => {
    setErr(null);
    try {
      const r = await post(`/mentor/courses/${courseId}/quiz`, { answers: quiz.map((q) => (answers[q.index] === undefined ? null : answers[q.index])) });
      setResult(r);
      state.reload();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Loading state={state}>
      {(c) => (
        <div className="stack">
          <p className="small"><a href="#/mentor">Property Mentor</a></p>
          <h1>{c.title}</h1>
          <p className="muted">{c.summary}</p>
          <span className="badge">{c.reviewStatus}</span>
          <h2>Lessons</h2>
          <ol>
            {c.lessons.map((l) => (
              <li key={l.id}>
                <a href={`#/mentor/${c.id}/lesson/${l.id}`}>{l.title}</a> {l.done ? <span className="badge ok">Done</span> : null}
              </li>
            ))}
          </ol>
          <h2>Quiz</h2>
          <div className="card">
            {c.quiz.map((q) => {
              const fb = result?.feedback?.[q.index];
              return (
                <fieldset key={q.index} style={{ border: 'none', padding: 0, margin: '0 0 1rem' }}>
                  <legend><strong>{q.index + 1}. {q.q}</strong></legend>
                  {q.options.map((o, i) => (
                    <label key={o} className="check">
                      <input type="radio" name={`q${q.index}`} checked={answers[q.index] === i} onChange={() => setAnswers({ ...answers, [q.index]: i })} />
                      <span>{o}</span>
                    </label>
                  ))}
                  {fb ? <p className="small">{fb.correct ? 'Correct.' : `Not quite: the answer is "${q.options[fb.correctAnswer]}".`} {fb.why}</p> : null}
                </fieldset>
              );
            })}
            <Notice kind="warn">{err}</Notice>
            {result ? <Notice kind={result.passed ? 'info' : 'warn'}>You scored {result.score} out of {result.total}. {result.passed ? 'Passed.' : 'Have another go when you are ready.'}</Notice> : null}
            <button className="btn" type="button" onClick={() => submit(c.quiz)}>Check my answers</button>
          </div>
          <p className="small muted">{c.disclaimer}</p>
        </div>
      )}
    </Loading>
  );
}

function LawTable({ table }) {
  return (
    <div className="stack">
      <h3>{table.title}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{table.columns.map((c) => <th key={c.nation} scope="col">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            <tr>
              {table.columns.map((c) => (
                <td key={c.nation}>
                  <div>{c.summary}</div>
                  {c.points?.length ? <ul>{c.points.map((p) => <li key={p}>{p}</li>)}</ul> : null}
                  <div style={{ marginTop: '0.4rem' }}>{c.verified ? <span className="badge ok">Checked {c.checkedOn}</span> : <span className="badge off">To check</span>}</div>
                  <Source href={c.source}>{c.sourceDate ? `Source date: ${c.sourceDate}.` : ''}</Source>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LessonPage({ courseId, lessonId }) {
  const state = useLoad(() => get(`/mentor/courses/${courseId}/lessons/${lessonId}`), [courseId, lessonId]);
  const [done, setDone] = useState(false);
  const complete = async () => {
    await post(`/mentor/courses/${courseId}/lessons/${lessonId}/complete`);
    setDone(true);
    state.reload();
  };
  return (
    <Loading state={state}>
      {(l) => (
        <div className="stack">
          <p className="small"><a href="#/mentor">Property Mentor</a> / <a href={`#/mentor/${courseId}`}>Course</a></p>
          <h1>{l.title}</h1>
          {l.body.map((p) => <p key={p}>{p}</p>)}

          {l.nationTable ? (
            <>
              <h2>By nation</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th scope="col">Nation</th><th scope="col">Does it work?</th><th scope="col">Why</th></tr></thead>
                  <tbody>
                    {l.nationTable.map((r) => (
                      <tr key={r.nation}>
                        <th scope="row">{NATION_LABEL[r.nation]}</th>
                        <td><span className={`badge ${FIT_BADGE[r.fit]}`}>{r.fitLabel}</span></td>
                        <td>{r.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {l.law.length ? <><h2>The rules behind it</h2>{l.law.map((t) => <LawTable key={t.id} table={t} />)}</> : null}

          {l.calculators.length ? <p>Try the numbers: <a href="#/calculators">open the calculators</a>.</p> : null}

          {l.templates.length ? (
            <>
              <h2>Templates</h2>
              {l.templates.map((t) => <div key={t.id} className="card small">{t.text}</div>)}
            </>
          ) : null}

          {l.complianceRows.length ? <Notice kind="info">This lesson touches regulated areas. Propertymaster explains the rule and names the professional who settles it.</Notice> : null}

          <div className="row">
            {l.done || done ? <span className="badge ok">Lesson done</span> : <button className="btn" type="button" onClick={complete}>Mark as done</button>}
            <a className="btn secondary" href={`#/mentor/${courseId}`}>Back to the course</a>
          </div>
          <p className="small muted">{l.disclaimer}</p>
        </div>
      )}
    </Loading>
  );
}

export function LawPage() {
  const list = useLoad(() => get('/law'), []);
  const [topic, setTopic] = useState('purchase_tax');
  const table = useLoad(() => get(`/law/${topic}`), [topic]);
  return (
    <div className="stack">
      <h1>Law and rights by nation</h1>
      <p className="muted">Scotland first, then England, Wales and Northern Ireland. Each rule shows its source and the date it was checked.</p>
      <Loading state={list}>
        {(d) => (
          <>
            <div className="tabs" role="tablist">
              {d.topics.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={t.id === topic} onClick={() => setTopic(t.id)}>{t.title}</button>
              ))}
            </div>
            <Loading state={table}>{(t) => <><LawTable table={t} /><p className="small muted">{t.disclaimer}</p></>}</Loading>
            <h2>Still to check</h2>
            <ul className="small">{d.toCheck.map((g) => <li key={g.item}>{NATION_LABEL[g.nation]}: {g.item}. To check at {g.where}.</li>)}</ul>
          </>
        )}
      </Loading>
    </div>
  );
}
