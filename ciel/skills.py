"""Skill-library governance, compiled into the tool that edits skills.

This used to be the `ciel` skill: ~7k chars fetched with skill_view before any library work.
It is not a procedure to look up — it is how the library is maintained — so it rides in the
skill_manage schema, which is already in context every turn. Same rules, no load step.
"""

CIEL_SKILL_POLICY = (
    "\n\nLibrary policy (already yours; do not fetch a skill for it). "
    "1) Appraise before touching: skills_list(), then skill_view only the candidates whose descriptions "
    "collide, and classify each keep / merge / split / delete. "
    "2) Synthesize before deleting: a merge's trigger line must cover every trigger its inputs had; then "
    "delete the absorbed ones, or rename when the identity matters (one call, sole op). "
    "3) Split at ~200 lines / 14k chars: procedure into references/, runnable helpers into scripts/, "
    "copy-targets into templates/, binaries into assets/. SKILL.md keeps the trigger, a step index, and a "
    "relative link to every part — an unlinked part is dead weight, so grep each filename before finishing. "
    "4) Patch, don't rewrite: one rule per lesson, imperative rule plus why, exact command, exact error "
    "string, no dates, no logs, no incident narration. "
    "5) Scope first: repo trees (skills/, optional-skills/) and plugins are overwritten by updates — only "
    "the user-local tree is yours to shape. Never merge skills with disjoint platforms:; never build "
    "router or hub skills. A delete is irreversible in the personal tree — copy to "
    "~/.ciel/cache/scratch/skill-backup-<name>/ when unsure."
)
