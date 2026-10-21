#!/usr/bin/env python3
"""Audit an Obsidian vault knowledge graph: pages, wikilinks, dead links, orphans.

Usage:
    python3 graph_audit.py [VAULT_PATH] [--regen-tags] [--exclude DIR ...]

VAULT_PATH defaults to /media/hdd/Obsidian Vault/vault. On this machine the wiki graph
lives at vault/HermesAgent/wiki/, so point the script at that subtree:
    python3 graph_audit.py "/media/hdd/Obsidian Vault/vault/Ciel Agent/wiki"

node_modules is always excluded; --exclude adds more directory names (e.g. ClaudeCode,
OpenCode, and any other agent workspace dir holding non-graph files).

Prints each page with inbound/outgoing link counts so near-duplicate nodes
(similar topic split across pages) stand out, then dead links and orphans.
With --regen-tags, rewrites <VAULT>/wiki/tags.md from page frontmatter.
"""
import collections
import os
import re
import sys

DEFAULT_VAULT = '/media/hdd/Obsidian Vault/vault/Ciel Agent/wiki'
# Infrastructure files that are not graph neurons and legitimately have no links.
INFRA = {'index', 'log', 'tags', 'MEMORY', 'USER'}


def collect(root, exclude):
    pages = {}
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d not in exclude and d != 'node_modules']
        for f in fn:
            if f.endswith('.md'):
                p = os.path.join(dp, f)
                pages[f[:-3]] = p
    return pages


def link_targets(text):
    out = set()
    for m in re.findall(r'\[\[([^\]|#]+)', text):
        t = m.strip().split('/')[-1].split('#')[0].strip()
        if t:
            out.add(t)
    return out


def main():
    argv = sys.argv[1:]
    exclude = set()
    if '--exclude' in argv:
        i = argv.index('--exclude')
        exclude = set(argv[i + 1:])
        argv = argv[:i]
    root = argv[0] if argv else DEFAULT_VAULT

    pages = collect(root, exclude)
    links = {n: link_targets(open(p, encoding='utf-8', errors='ignore').read())
             for n, p in pages.items()}

    inbound = collections.Counter()
    for n, outs in links.items():
        for t in outs:
            if t in pages:
                inbound[t] += 1

    print('pages=%d' % len(pages))
    print('\n== INBOUND (hub strength; low counts flag weak/leaf nodes) ==')
    for n in sorted(pages, key=lambda x: (-inbound[x], x)):
        print('  %-24s in=%d out=%d' % (n, inbound[n], len(links[n])))

    dead = [(n, t) for n in sorted(links) for t in sorted(links[n]) if t not in pages]
    print('\n== DEAD LINKS (%d) ==' % len(dead))
    for n, t in dead:
        print('  %s -> [[%s]]' % (n, t))

    orphans = sorted(n for n in pages if not links[n] and n not in INFRA)
    print('\n== ORPHANS (no outgoing links, %d) ==' % len(orphans))
    for o in orphans:
        print('  ' + o)

    if '--regen-tags' in argv:
        tagc = collections.Counter()
        for path in pages.values():
            for line in open(path, encoding='utf-8', errors='ignore'):
                m = re.match(r'\s*tags:\s*\[(.*)\]', line)
                if m:
                    for t in m.group(1).split(','):
                        t = t.strip().strip('"\'')
                        if t:
                            tagc[t] += 1
        tags_path = os.path.join(root, 'tags.md')
        if not os.path.exists(os.path.join(root, 'tags.md')) and \
                os.path.exists(os.path.join(root, 'wiki', 'tags.md')):
            tags_path = os.path.join(root, 'wiki', 'tags.md')
        body = ', '.join('%s (%d)' % (t, c)
                         for t, c in sorted(tagc.items(), key=lambda x: (-x[1], x[0])))
        with open(tags_path, 'w', encoding='utf-8') as fh:
            fh.write('# Vault Tags\n\n' + body + '\n')
        print('\nwrote %s' % tags_path)


if __name__ == '__main__':
    main()
