# PuzzleTogether review and release 1.1.0

Reviewed 24 September 2026. This release reconciles `main` with the newer
`arena/01a09a75-puzzletogether` history, including CARTOGRAF. It retains the
single-process, room-based real-time engine and the existing activity catalogue.

## Delivered

- CoachingHub cream, forest and brass palette; locally hosted Inter Variable
  (including Romanian characters) and the same serif heading stack. OFL license included.
- A shorter bilingual landing page with four accessible, keyboard-operable activity links.
- Same-tab CoachingHub navigation, with RO/EN carried through the `lang` query.
- Intent-based entry to puzzle, team scenarios and the emotions room. Solo map retained.
- Atomic team-note and action edits. Concurrent edits to different fields merge;
  conflicting edits to the same field keep the local draft and offer a choice.
- Notes editable only during debrief/action planning, by participants and facilitator.
  Older whole-document clients receive a refresh instruction to prevent lost updates.
- Public room metadata no longer includes emotions history or shared workshop content.
- Questionnaire submissions respect board lock and non-playing facilitator roles.
- A useful session summary containing saved reflections, debrief and owned actions,
  with a visible copy fallback and a downloadable text file.
- Facilitator guide: intention, agreement, activity, reflection and transfer.
- Discreet break request: the facilitator sees a signal without the sender's name.
  It does not pause automatically. The facilitator chooses when to lock/resume the board.
- Calendar download: dated, named actions become all-day events in an `.ics` file.
  Import is chosen by the user and no invitations are sent.

## Validation

Production TypeScript/Vite build; existing jigsaw, coaching, letter/sentence
canvas, teams, catalogue compatibility, claims and chat protocol tests;
CARTOGRAF protocol/UI/data audits; new workshop protocol and React/jsdom checks.
New checks cover stage/role guards, stale-edit rejection, field merging,
private metadata, questionnaire lock, pause permissions, ICS date boundaries,
escaping, UTF-8 line folding and local draft preservation.

Two existing tests now respect DATA_DIR, and a canvas inventory assertion waits
for the response on the client whose state it reads instead of racing sockets.

## Product priorities after this release

1. Run three facilitated pilots. Observe setup friction, participation and whether
   an agreed experiment actually happens. A successful game is not proof of learning.
2. Review game answer keys and learning claims. Treat self-reflection profiles as
   conversation aids, not validated psychological tests or employee assessments.
3. Add a short, consent-based follow-up after a workshop before building dashboards.
4. Confirm persistent storage and recovery on the actual hosting plan. Local JSON
   snapshots only survive redeploys if the hosting filesystem is persistent.
5. Verify keyboard alternatives for dragging, touch play and small-screen layouts
   with representative devices before advertising comprehensive accessibility.

## Integration boundary

CoachingHub and PuzzleTogether share visual identity and same-tab navigation.
They still run on separate origins. This release does not implement unified
login, cross-origin storage, a single domain, billing or a client-record migration.
The live Render service previously tracked `arena/01a07c4c-puzzletogether`.
That branch and `main` should point to the same release until the service's
configured deploy branch is changed to main.

## Hosting sources

- https://render.com/docs/disks
- https://render.com/docs/free

The broader portfolio audit and sourced ten-author learning review are in the
product plan delivered separately. No private repository content is copied here.
