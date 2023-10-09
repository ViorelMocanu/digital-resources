# Contributing to Resurse.dev

I'm really glad you're reading this, because we need volunteer developers to
help this project come to fruition. First off, thank you for considering
contributing to Resurse.dev. It's people like you that make Resurse.dev such a
great index of resources.

If you haven't already, come find us on [Discord]. We want you
working on things you're excited about.

New features, new resources, new relevant tags, better information architecture,
improving documentation, bug triaging, or writing tutorials are all examples of
helpful contributions we're looking for any time. We're greatful for your time
and energy!

## Where do I go from here?

If you've noticed a bug or have a feature request, [make one][new issue]! It's
generally best if you get confirmation of your bug or approval for your feature
request this way before starting to code.

**Do not open up a GitHub issue if the bug is a security vulnerability**, and
instead to refer to our [security policy].

If you have a general question about Resurse.dev, you can ask on [Discord], the
issue tracker is only for bugs and feature requests.

If you'd like to see our project roadmap, see it on [GitHub Projects].

## 1. Fork & create a branch

If this is something you think you can fix, then [fork Resurse.dev] and create
a branch with a descriptive name.

A good branch name would be (where issue #325 is the ticket you're working on):

```sh
git checkout -b 325-add-japanese-translations
```

## 2. Get the server running

Install javascript dependencies with [PNPM] (requires a current version of [Node.js]):

```sh
pnpm install
```

Then start the Astro server:

```sh
pnpm dev
```

## 3. Implement your fix or feature

At this point, you're ready to make your changes! Feel free to ask for help;
everyone is a beginner at first :smile_cat:

## 4. View your changes

Resurse.dev is meant to be used by humans, not cucumbers. So make sure to take
a look at your changes in a browser.

You should now be able to open <http://localhost:4321> in your browser.

## 5. Commit your changes

Always write a clear log message for your commits. One-line messages are fine
for small changes, but bigger changes should look like this:

```sh
$ git commit -m "A brief summary of the commit
> 
> A paragraph describing what changed and its impact."
```

## 6. Make a Pull Request

At this point, you should switch back to your main branch and make sure it's
up to date with Resurse.dev's main branch:

```sh
git fetch
git checkout main
git pull upstream main
```

Then update your feature branch from your local copy of main, and push it!

```sh
git checkout 325-add-japanese-translations
git merge main
git push --set-upstream origin 325-add-japanese-translations
```

Finally, go to GitHub and [make a Pull Request][] :D

Github Actions will run our test suite against all supported Rails versions. We
care about quality, so your PR won't be merged until all tests pass. It's
unlikely, but it's possible that your changes pass tests in one Rails version
but fail in another. In that case, you'll have to setup your development
environment (as explained in step 3) to use the problematic Rails version, and
investigate what's going on!

## 7. Keeping your Pull Request updated

If a maintainer asks you to "rebase" your PR, they're saying that a lot of code
has changed, and that you need to update your branch so it's easier to merge.

To learn more about rebasing in Git, there are a lot of [good][git rebasing]
[resources][interactive rebase] but here's the suggested workflow:

```sh
git checkout 325-add-japanese-translations
git pull --rebase upstream main
git push --force-with-lease 325-add-japanese-translations
```

## 8. Merging a PR (maintainers only)

A PR can only be merged into main by a maintainer if:

* It is passing CI.
* It has been approved by at least one maintainer. If it was a maintainer who
  opened the PR, another  maintainer approval is needed.
* It has no requested changes.
* It is up to date with current main.

Any maintainer is allowed to merge a PR if all of these conditions are
met.

## 9. Shipping a release (maintainers only)

Maintainers need to do the following to push out a release:

* Switch to the main branch and make sure it's up to date.
* Submit GitHub release notes from the changelog.
* Push the result and create a PR.
* Review and merge the PR. The generated changelog in the PR should include all
  user visible changes you intend to ship.

Resurse.dev is a volunteer effort. We encourage you to pitch in and join the team!

Thanks! :heart:

[Viorel Mocanu], [Digital consultant] and [content creator].

[new issue]: https://github.com/ViorelMocanu/digital-resources/issues/new
[fork Resurse.dev]: https://help.github.com/articles/fork-a-repo
[make a pull request]: https://help.github.com/articles/creating-a-pull-request
[git rebasing]: https://git-scm.com/book/en/Git-Branching-Rebasing
[interactive rebase]: https://help.github.com/en/github/using-git/about-git-rebase
[shortcut reference links]: https://github.github.com/gfm/#shortcut-reference-link
[PNPM]: https://pnpm.io/installation
[Node.js]: https://nodejs.org/en/
[Discord]: https://discord.com/invite/UpnAutz
[GitHub Projects]: https://github.com/users/ViorelMocanu/projects/2
[Viorel Mocanu]: https://github.com/ViorelMocanu
[Digital consultant]: https://www.viorelmocanu.ro/
[content creator]: https://www.youtube.com/@ViorelMocanu
[security policy]: https://resurse.dev/politica-de-securitate
