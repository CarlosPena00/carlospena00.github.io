---
layout: post
title: "Learning Resources"
author: Giovanni Paolo, et al.
date: 2025-12-06
---

Python
======

- [video] [The Clean Architecture in Python](https://www.youtube.com/watch?v=DJtef410XaM), Brandon Rhodes (2013)
    - Good practices about code structure and designing for decoupling
- [video] [When Python practices go wrong](https://www.youtube.com/watch?v=S0No2zSJmks), Brandon Rhodes (2019)
    - Tips to avoid overdoing "best practices" and making code less readable
- [article] [How to Write a Spelling Corrector](https://norvig.com/spell-correct.html), Peter Norvig (2007)
    - A good write up on how to break down and solve a problem.  Norvig has a great style in general.
- [video] [How to write a function](https://www.youtube.com/watch?v=rrBJVMyD-Gs), Jack Diedrich (2018)
    - Good design considerations for creating good functions
- [video] [Stop writing classes](https://www.youtube.com/watch?v=o9pEzgHorH0), Jack Diedrich (2012)
    - Why most uses of classes are unnecessary and what are the alternatives
- [video] [Name things once](https://www.youtube.com/watch?v=hZ7hgYKKnF0), Jack Diedrich (2015)
    - Giving things descriptive and concise names
- [video] [Writing simpler and more maintainable Python](https://www.youtube.com/watch?v=dqdsNoApJ80), Anthony Shaw
    - Bits on cyclomatic complexity, visualizing it, and considerations to write code that is more linear and simpler to understand
- [video] [Introduction to Python Typing](https://www.youtube.com/watch?v=H5CnZQDKfhU), Anthony Sottile (2020)
    - Quick start with Python Type hints and mypy
- [course] [Design of Computer Programs](https://www.udacity.com/course/design-of-computer-programs--cs212), Peter Norvig
    - Modelling and solving problems with a Pythonic style and performance considerations
- [article] [Python Packaging for Developers in a Hurry](https://giovannipcarvalho.github.io/2023/01/08/python-packaging-in-a-hurry.html), Giovanni Carvalho (2023)
    - Managing Python packaging environments, dependencies, structure and publishing.


Practices
=========

- [list] [Programming best practices tidbits](https://github.com/timoxley/best-practices)
    - Common knowledge and aphorisms compiled from various authors.
- [article] [Tidy First?](https://henrikwarne.com/2024/01/10/tidy-first/)
    - A short summary for the namesake book about simple to execute refactorings that improve readibility and maintanability.  Also makes distinctions about structure and behavior changes, which are importat to not mix up.
- [article] [Canon TDD](https://tidyfirst.substack.com/p/canon-tdd), Kent Beck (2023)
    - A breakdown of the canon process for test-driven development by *the man himself*.
- [course] [Gestão Ágil: explorando conceitos da agilidade](https://cursos.alura.com.br/course/gestao-agil-conceitos-agilidade)
    - What is `Agile Thinking`, and how to use `Scrum` and `Kanban`.
- [article] [The 12-factor app](https://12factor.net/) (2012)
    - Good practices for building reproducible and easy-to-deploy software.
- [article] [Developer philosophy](https://qntm.org/devphilo) (2025)
    - Good article about software development, practices and how to avoid common pitfalls

SQL
===

- [book] [A Curious Moon](https://sales.bigmachine.io/curious-moon), Rob Conery (2017)
    - Analytical patterns for Data Science with PostgresSQL in an interactive exercise book.
- [article] [The Querynomicon](https://gvwilson.github.io/sql-tutorial/), Greg Wilson (2024)
    - Analytical SQL query patterns from the ground up.
- [course] [Formação Consultas com Oracle Database](https://cursos.alura.com.br/formacao-oracle-database-sql-plsql)
    - Beginner Oracle PL/SQL course (85h)


git
===

- [video] [Advanced git](https://www.youtube.com/watch?v=4EOZvow1mk4), David Baumgold (2015)
    - Advanced usage of git, such as bisect, rebase, cherry-pick.
- [course] [Git e Github: estratégias de ramificação, Conflitos e Pull Requests](https://www.alura.com.br/curso-online-git-github-dominando-controle-versao-codigo)
    - Intermediary usage of git, how to resolve merge conflicts, etc.
- [slide] [Git Productive!](../assets/slides/2024-07-03-Git-Productive!.pdf), Giovanni Carvalho (2024)
    - A little bit of git, testing and code review.


Shell
=====

- [article] [The Art of the Command line](https://github.com/jlevy/the-art-of-command-line)
    - A guide becoming proficient with the shell.


Concepts
========

- [pattern] Early return: rather than nesting ifs, consider checking for invalid cases and returning early


# Contributing

## Workflow
1. Branch from master starting with your initials, e.g. `gpsc-my-feature`;
2. Create a PR and mark it as `Draft` during development;
3. Unmark `Draft` status when you finish your changes, and then request a code review;
4. Discuss the questions and implement the requested changes
    - Don't make non-trivial changes before clearing all questions
    - "rename foo to bar" can be done without discussing, if you accept the suggestion
    - "why did you do X instead of Y?" should not be replied with "I've changed it to Y"
    - Let the reviewer mark discussions as resolved, so that they can verify your changes
5. Iterate until agreed and merged.


## Requirements
1. Your branch must be fast-forwardable from master
    - i.e. merge latest changes from master into your branch fix conflicts before requesting a review
2. Use **a short title** and **a descriptive message** on your commits
    - The title should describe **what**
    - The description should describe **why**
    - The diff should describe **how**
3. Your patch must be atomic
    - Small, cohesive, self-contained and without unrelated changes.

We strive to keep a clean and linear history in the `master` branch, so no merge-commits should land in `master`.


## Other recommendations
- Aim for simple, clean and tested code;
- Name things consciously[^1];
- Keep PRs short to facilitate reviewing;
- If you have to refactor or fix other parts of the project while working on your task, feel free to open additional PRs;
- Don't rewrite the commit history while making the requested changes in your branch, as this makes it hard to isolate them from what has already been reviewed.
- Commit as often as you want: as long as it remains atomic and well-written (code, title and description) it can be safely squash-merged.


## General guidelines
* **Authors:** Strive for simple, clean, tested and type-checked code. Your PR should prove why it works and why it's important. Optimize towards simple and readable. Make your changes small and atomic. **Always** self-review first.
* **Reviewers:** Don't over nitpick. Provide actionable suggestions. Focus on correctness and clearness over style. Compromise, as long as the PR solves more problems than it creates.
* Prioritize tasks that unblocks other people first, and tasks that only depends on you afterward.
* Don't remain busy-waiting, ask for others to unblock you when necessary.


[^1]: https://google.github.io/styleguide/pyguide.html#316-naming

Created by [Giovanni Paolo](https://carvalho.sh/), maintained by FCxAI team