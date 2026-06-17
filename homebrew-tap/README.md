# homebrew-tap

A [Homebrew tap](https://docs.brew.sh/Taps) for the **Arbeiten** desktop app.

## Install

```bash
brew tap OWNER/tap
brew install --cask --no-quarantine arbeiten
```

`--no-quarantine` is required because the app is ad-hoc signed (not notarized with an
Apple Developer ID); it lets Gatekeeper open the app. To upgrade later:

```bash
brew upgrade --cask arbeiten
```

## Publishing this tap (maintainer, one time)

A tap must live in a GitHub repo named **`homebrew-tap`** under your account. From a
copy of this directory:

```bash
gh repo create OWNER/homebrew-tap --public --source . --remote origin --push
```

(Replace `OWNER` here and in `Casks/arbeiten.rb` with your GitHub username — the
release script keeps the URL in sync from `package.json` "repository" on each release.)

## Releasing a new version

From the app repo, `npm run release -- <version>` builds the DMG, uploads it to the
app's GitHub Release, and rewrites `Casks/arbeiten.rb`. Then commit + push this tap.
