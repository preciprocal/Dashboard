// scripts/verify-transcript-analysis.ts
// The annotated transcript on the interview results page: turn merging,
// filler and hedge detection, and validation of the model's critique.
//
//   npm run verify:transcript-analysis
//
// Pure, no network. False positives matter as much as misses: a highlight on
// "I like Python" or "what kind of database" teaches people to ignore the
// highlights, so the literal uses are tested as hard as the filler ones.

import {
  buildTurns, findMarkers, transcriptStats, isTooShort, locateQuote,
  validateReview, transcriptHash, segmentAnswer, stripDashes,
} from '../lib/interview/transcript-analysis';

let pass = 0;
let fail = 0;
function eq<T>(label: string, got: T, want: T) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
}
const labels = (text: string) => findMarkers(text).map((m) => `${m.kind}:${m.label}`);
const spans = (text: string) => findMarkers(text).map((m) => text.slice(m.start, m.end));

// ─── Turns ───────────────────────────────────────────────────────────────────
const turns = buildTurns([
  { role: 'assistant', content: 'Hi, tell me about yourself.' },
  { role: 'user', content: 'So, um, I am a backend engineer.' },
  { role: 'user', content: '  I built a payments service.  ' },
  { role: 'system', content: 'Move to the technical half.' },
  { role: 'assistant', content: 'What kind of database did you use?' },
  { role: 'user', content: '' },
  { role: 'user', content: 'Postgres, I think maybe with Redis or something.' },
  { role: 'tool', content: 'ignored' },
  null,
  { role: 'user' },
]);
eq('merges consecutive same-speaker messages, drops system/empty/junk',
  turns.map((t) => [t.index, t.speaker, t.text]),
  [
    [0, 'interviewer', 'Hi, tell me about yourself.'],
    [1, 'candidate', 'So, um, I am a backend engineer. I built a payments service.'],
    [2, 'interviewer', 'What kind of database did you use?'],
    [3, 'candidate', 'Postgres, I think maybe with Redis or something.'],
  ]);
eq('non-array transcript gives no turns', buildTurns(null), []);
eq('object transcript gives no turns', buildTurns({ role: 'user' }), []);

// ─── Fillers: should fire ────────────────────────────────────────────────────
eq('vocal fillers', labels('Um, I uh did it, umm, ah, er, hmm.'),
  ['filler:um', 'filler:uh', 'filler:um', 'filler:ah', 'filler:er', 'filler:hmm']);
eq('basically', labels('It basically caches reads.'), ['filler:basically']);
eq('sentence-opening so', labels('So I built the API. So, then we shipped it.'), ['filler:so', 'filler:so']);
eq('comma-wrapped so', labels('We tried it, so, it worked.'), ['filler:so']);
eq('like with a pause', labels('It was like, really slow.'), ['filler:like']);
eq('like after a sentence break', labels('Like I said, we cached it.'), ['filler:like']);
eq('like after um', labels('We um like the team split it.'), ['filler:um', 'filler:like']);
eq('you know as an aside', labels('We had, you know, three services.'), ['filler:you know']);
eq('you know at the end', labels('It was hard, you know.'), ['filler:you know']);
eq('kind of as a softener', labels('I kind of led the migration.'), ['filler:kind of']);
eq('sort of as a softener', labels('It sort of worked.'), ['filler:sort of']);
eq('I mean with a pause', labels('I mean, it was fine.'), ['filler:i mean']);

// ─── Fillers: literal uses must NOT fire ─────────────────────────────────────
eq('I like Python', labels('I like Python and I like the team.'), []);
eq('things like Kafka', labels('We used tools like Kafka.'), []);
eq('what kind of database', labels('What kind of database is it?'), []);
eq('a sort of queue', labels('It is a sort of queue.'), []);
eq('kind of a problem', labels('That was kind of a problem.'), []);
eq('do you know how', labels('Do you know how it works?'), []);
eq('you know how mid-sentence', labels('You know how caching works.'), []);
eq('so that (purpose)', labels('We split it so that we could scale.'), []);
eq('so much / so far', labels('So far it works. It was so much faster.'), []);
eq('mid-sentence so (because)', labels('It was slow so we cached it.'), []);
eq('umbrella and summer are not um', labels('An umbrella in summer.'), []);
eq('ahead and errors are not ah/er', labels('We got ahead of errors.'), []);

// ─── Hedges ──────────────────────────────────────────────────────────────────
eq('I think maybe wins over maybe', labels('I think maybe it was Redis.'), ['hedge:i think maybe']);
eq('plain I think is fine', labels('I think the trade-off was worth it.'), []);
eq("I'm not sure (straight and curly)", labels("I'm not sure. I’m not really sure but ok."), ["hedge:i'm not sure", "hedge:i'm not sure"]);
eq('I am not sure', labels('I am not 100% sure.'), ["hedge:i'm not sure"]);
eq("I don't know", labels("I don't really know."), ["hedge:i don't know"]);
eq('or something like that', spans('We used Redis or something like that.'), ['or something like that']);
eq('assorted hedges', labels('I guess it works, hopefully, if that makes sense, or whatever.'),
  ['hedge:i guess', 'hedge:hopefully', 'hedge:if that makes sense', 'hedge:or whatever']);
eq('markers never overlap and are in order', (() => {
  const ms = findMarkers('So, um, I think maybe, you know, it kind of worked or something.');
  return ms.every((m, i) => i === 0 || m.start >= ms[i - 1].end);
})(), true);

// ─── Stats ───────────────────────────────────────────────────────────────────
const stats = transcriptStats(turns);
eq('stats: candidate turns', stats.candidateTurns, 2);
eq('stats: fillers counted only in candidate turns', stats.fillerCount, 2);
eq('stats: hedges', stats.hedgeCount, 2);
eq('stats: words', stats.candidateWords, 20);
eq('stats: rate per 100 words', stats.fillersPer100Words, 10);
eq('stats: level', stats.fillerLevel, 'high');
eq('stats: top fillers', stats.topFillers, [{ label: 'so', count: 1 }, { label: 'um', count: 1 }]);
eq('stats: empty transcript', transcriptStats([]).fillersPer100Words, 0);

eq('too short: no candidate turns', isTooShort(buildTurns([{ role: 'assistant', content: 'Hello?' }])), true);
eq('too short: a few words', isTooShort(buildTurns([{ role: 'user', content: 'Yes I can hear you.' }])), true);
eq('not too short', isTooShort(buildTurns([{ role: 'user', content: 'word '.repeat(30) }])), false);

// ─── Quote matching ──────────────────────────────────────────────────────────
const answer = 'We improved latency a lot. I’m pretty sure it was the cache.';
eq('exact quote', locateQuote(answer, 'improved latency a lot'), { start: 3, end: 25 });
eq('case and curly quotes tolerated', locateQuote(answer, "i'm pretty sure"), { start: 27, end: 42 });
eq('surrounding quote marks stripped', locateQuote(answer, '"a lot"'), { start: 20, end: 25 });
eq('paraphrase rejected', locateQuote(answer, 'improved the latency a lot'), null);
eq('too short rejected', locateQuote(answer, 'a'), null);

// ─── Review validation ───────────────────────────────────────────────────────
const reviewTurns = buildTurns([
  { role: 'assistant', content: 'Tell me about a time you led a project.' },
  { role: 'user', content: 'We improved latency a lot. I’m pretty sure it was the cache. Also I like hiking.' },
  { role: 'assistant', content: 'How does a B-tree index work?' },
  { role: 'user', content: 'It hashes every key into a bucket so lookups are constant time.' },
]);
const validated = validateReview({
  patterns: ['Add numbers — they make claims believable.', '', 'Use STAR.', 'Fourth is dropped.'],
  answers: [
    {
      turn: 1, verdict: 'weak',
      issues: [
        { quote: 'improved latency a lot', type: 'vague', why: 'No number.' },
        { quote: 'latency', type: 'rambling', why: 'Overlaps the first, dropped.' },
        { quote: 'we cut costs by 40%', type: 'vague', why: 'Not in the answer, dropped.' },
        { quote: 'Also I like hiking.', type: 'off_topic', why: 'Not about the project.' },
        { quote: 'the cache', type: 'made_up_type', why: 'Unknown type, dropped.' },
      ],
      betterAnswer: 'As the lead, I found the cache was the bottleneck and cut latency by [X%].',
      why: 'Vague result – no number.',
      practiseTip: 'Say one number for every result.',
    },
    { turn: 0, verdict: 'weak', issues: [], betterAnswer: 'x', why: 'Interviewer turn, dropped.' },
    { turn: 1, verdict: 'ok', issues: [], why: 'Duplicate, dropped.' },
    { turn: 3, verdict: 'strong', issues: [{ quote: 'hashes every key', type: 'wrong', why: 'That is a hash index.' }], betterAnswer: 'ignored for strong' },
    { turn: 99, verdict: 'weak' },
    'junk',
  ],
}, reviewTurns);
eq('patterns: trimmed, dash-free, capped at 3', validated.patterns,
  ['Add numbers - they make claims believable.', 'Use STAR.', 'Fourth is dropped.']);
eq('answers: only real candidate turns, once each', validated.answers.map((a) => a.turnIndex), [1, 3]);
eq('issues: unfound, overlapping and unknown-type quotes dropped',
  validated.answers[0].issues.map((i) => [i.type, i.quote]),
  [['vague', 'improved latency a lot'], ['off_topic', 'Also I like hiking.']]);
eq('placeholder kept, dash stripped from why',
  [validated.answers[0].betterAnswer, validated.answers[0].why],
  ['As the lead, I found the cache was the bottleneck and cut latency by [X%].', 'Vague result - no number.']);
eq('strong answer has no better answer', validated.answers[1].betterAnswer, null);
eq('garbage input degrades to empty', validateReview('not json', reviewTurns), { patterns: [], answers: [] });
eq('stripDashes', stripDashes('a — b – c'), 'a - b - c');

// ─── Hash ────────────────────────────────────────────────────────────────────
eq('hash is stable', transcriptHash(reviewTurns), transcriptHash(buildTurns([
  { role: 'assistant', content: 'Tell me about a time you led a project.' },
  { role: 'user', content: 'We improved latency a lot.' },
  { role: 'user', content: 'I’m pretty sure it was the cache. Also I like hiking.' },
  { role: 'assistant', content: 'How does a B-tree index work?' },
  { role: 'user', content: 'It hashes every key into a bucket so lookups are constant time.' },
])));
eq('hash changes with the transcript', transcriptHash(reviewTurns) === transcriptHash(turns), false);

// ─── Segmenting for render ───────────────────────────────────────────────────
const segText = 'So um we improved latency a lot.';
const segs = segmentAnswer(segText, findMarkers(segText), [{ quote: 'um we improved latency a lot', type: 'vague', why: '' }]);
eq('segments rejoin to the original text', segs.map((s) => s.text).join(''), segText);
eq('filler inside an issue keeps both', segs.map((s) => [s.text, s.marker ?? null, s.issue ?? null]),
  [['So', 'filler', null], [' ', null, null], ['um', 'filler', 'vague'], [' we improved latency a lot', null, 'vague'], ['.', null, null]]);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
