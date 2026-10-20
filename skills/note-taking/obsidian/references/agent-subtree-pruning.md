# Pruning a delegated subtree (another agent's folder)

Use when the user says an agent's subtree is slop / bloated / harmful and wants the useful parts kept. The subtree normally belongs to that agent, so this is always done under explicit permission — confirm scope first, because the agent's engine may regenerate what you delete.

## Procedure

1. **Inventory and size.** Count files and lines per category (real content vs. fixtures vs. per-edge bookkeeping vs. generators). A subsystem that is mostly metadata about connections between test fixtures is scaffolding, not knowledge.

2. **Dependency-scan before deleting.** For every deletion candidate, list inbound `[[wikilinks]]` across the whole vault, excluding the candidate's own folder. Deletion is safe only when the only referrers are the files you are also deleting. A quick check:
   ```bash
   # build name-set across vault, then report referrers of a target
   grep -rl '\[\[<basename>\]\]' --include='*.md' . | grep -v node_modules
   ```

3. **Delete in dependency order** — edge files first, then the nodes that only they referenced, then the engine and its generator scripts. Leaving a generator behind means a later run silently recreates the deleted files; check `metadata/` (or equivalent) for scripts plus any `__pycache__`, lock, and counter YAML.

4. **Strip dangling references.** Deleting edge files orphans every `[[edge_id]]` in the surviving nodes. Strip them with a scoped regex rather than editing by hand:
   ```bash
   python3 - <<'PY'
   import re,os
   for dp,dn,fn in os.walk('.'):
       for f in fn:
           if f.endswith('.md'):
               p=os.path.join(dp,f); t=open(p,encoding='utf-8').read()
               n=re.sub(r'\[\[(syn_[^\]]+)\]\]', r'\1', t)   # edge link -> plain id
               if n!=t: open(p,'w').write(n)
   PY
   ```
   Keep the surviving neuron-to-neuron links; only remove links to files that no longer exist. Then drop whole index sections that listed the deleted files.

5. **Salvage before deleting.** Copy any genuinely unique idea into the main graph (a `##` subsection on the closest existing page) so it survives and becomes indexed by the retrieval layer. Otherwise the knowledge is lost with the files.

6. **Update the subtree's self-description files** (hub, INDEX, README) to describe the pruned structure — including a short note on why the removed mechanism was dropped. A hub that still advertises a deleted engine or folder misleads the next reader.

7. **Verify.** Re-run the audit and a dangling-link sweep across the whole vault. Target: 0 real dangling links, 0 orphans, all remaining nodes linked. Confirm remaining hubs still have inbound links so none became a floating root.

## Verdict test: is a subtree's model worth keeping

Apply this before recommending a prune — it is also how to answer "is this useful to the main setup":

- **Reachable?** If the retrieval layer indexes only part of the vault, notes outside it cannot be recalled at runtime; they are an island that only adds graph noise.
- **Learned or asserted?** Hand-typed weights, constants, and fixture content ("test input") mean nothing has actually been computed. A mechanism whose output never differs from its input is theater, not a capability.
- **Redundant?** If a page restates an existing node in different vocabulary, it duplicates signal rather than adding it.
- **Extractable?** If one or two ideas are genuinely good, extract them into the main graph and delete the apparatus — the idea is the asset, not the file count.

## "Why is the small graph the main brain and the big one isn't"

Users ask why a 19-page graph outranks a 97-page one. Size is not the axis; **signal density** is. Count how much of the large subtree is real content versus metadata-about-connections between fixtures, and compare what the retrieval layer actually indexes. The correct answer to "is this useful to the main setup" names both halves separately: the *idea* is useful (and gets extracted), the *artifacts* are redundant scaffolding the main graph already expresses more densely — plus the cost that a non-indexed subtree still pollutes Obsidian search, "related notes", and embeddings.

Also expect the small graph to be asked to grow. A dense small graph is a feature (every line load-bearing), not a gap; say so rather than padding it.

Report the count before/after (files, lines) so the user sees the reduction, and flag honestly if you edited a folder that is normally the other agent's to manage.
