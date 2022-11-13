---
layout: post
title: "Git: Squash old commits (rebase -i)"
author: Carlos Pena
date: 2022-11-06
---

I woke up with an urge to make git commits less extensive,
for that I will rebase untill <strong>x</strong> previous commit.

<img  src="../../../assets/images/git-log.png" alt="image git log" width="40%">

Rebase Instructions

```py
$ git rebase -i HEAD^x

# Rebase X..Y onto X (1 command)

Commands:
p, pick <commit> = use commit
r, reword <commit> = use commit, but edit the commit message
e, edit <commit> = use commit, but stop for amending
s, squash <commit> = use commit, but meld into previous commit
f, fixup <commit> = like "squash", but discard this commits log message
x, exec <command> = run command (the rest of the line) using shell
b, break = stop here (continue rebase later with 'git rebase --continue')
d, drop <commit> = remove commit
l, label <label> = label current HEAD with a name
t, reset <label> = reset HEAD to a label
m, merge [-C <commit> | -c <commit>] <label> [# <oneline>]
.       create a merge commit using the original merge commits
.       message (or the oneline, if no original merge commit was
.       specified). Use -c <commit> to reword the commit message.

These lines can be re-ordered; they are executed from top to bottom.
```

I chose to ignore three commit messages

```c
pick b25912d Create the base project
s 0171b2f update gitignore
s 58bc434 Finished tutorial
s 9ac239c update index page
pick b6ee3ee Add wip blog of python precommit
```

The squashed commits `0171b2f, 58bc434, 9ac239c` are merged into `b25912d - Create the base project`, the previous commit (Note that the commit date has changed to today).

<img  src="../../../assets/images/git-log-2.png" alt="image git log" width="40%">
