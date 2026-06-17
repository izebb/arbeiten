// Cuts an Arbeiten release for Homebrew distribution:
//   1. bump package.json version
//   2. build the .dmg (electron-builder)
//   3. compute its sha256
//   4. create/update the GitHub Release and upload the .dmg (via `gh`)
//   5. rewrite homebrew-tap/Casks/arbeiten.rb (version, sha256, owner/repo URL)
//
// Usage:
//   node scripts/release.mjs <version> [--skip-build] [--skip-publish]
//   npm run release -- 1.0.1
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const version = args.find((a) => !a.startsWith('--'))
const skipBuild = args.includes('--skip-build')
const skipPublish = args.includes('--skip-publish')

if (!version || !/^\d+\.\d+\.\d+([.-].+)?$/.test(version)) {
  console.error('Usage: node scripts/release.mjs <version> [--skip-build] [--skip-publish]')
  process.exit(1)
}

const pkgPath = resolve(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

const repoUrl = typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? '')
const match = repoUrl.match(/github[:/]+(?:.*github\.com\/)?([^/]+)\/([^/.]+)/i)
if (!match) {
  console.error('Set "repository" in package.json to "github:OWNER/arbeiten".')
  process.exit(1)
}
const [, owner, repo] = match
if (owner === 'OWNER') {
  console.error(
    'Replace OWNER in package.json "repository"/"homepage" with your GitHub username first.'
  )
  process.exit(1)
}

const run = (cmd) => {
  console.log(`$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: root })
}

function sha256(file) {
  return new Promise((res, rej) => {
    const hash = createHash('sha256')
    const stream = createReadStream(file)
    stream.on('data', (d) => hash.update(d))
    stream.on('end', () => res(hash.digest('hex')))
    stream.on('error', rej)
  })
}

// 1. version
if (pkg.version !== version) {
  pkg.version = version
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`• package.json version -> ${version}`)
}

// 2. build
if (!skipBuild) run('npm run dist')

const dmg = resolve(root, 'dist', `Arbeiten-${version}.dmg`)
if (!existsSync(dmg)) {
  console.error(`DMG not found: ${dmg}\nRun without --skip-build, or build first.`)
  process.exit(1)
}

// 3. sha256
const sha = await sha256(dmg)
console.log(`• sha256 ${sha}`)

// 4. GitHub Release
const tag = `v${version}`
if (!skipPublish) {
  try {
    execSync('gh --version', { stdio: 'ignore' })
  } catch {
    console.error('GitHub CLI (`gh`) not found. Install it and run `gh auth login`.')
    process.exit(1)
  }
  const exists = (() => {
    try {
      execSync(`gh release view ${tag} --repo ${owner}/${repo}`, { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })()
  if (exists) {
    run(`gh release upload ${tag} "${dmg}" --repo ${owner}/${repo} --clobber`)
  } else {
    run(
      `gh release create ${tag} "${dmg}" --repo ${owner}/${repo} --title "Arbeiten ${version}" --generate-notes`
    )
  }
}

// 5. rewrite cask
const caskPath = resolve(root, 'homebrew-tap', 'Casks', 'arbeiten.rb')
let cask = readFileSync(caskPath, 'utf8')
cask = cask
  .replace(/version "[^"]*"/, `version "${version}"`)
  .replace(/sha256 "[^"]*"/, `sha256 "${sha}"`)
  // Sync owner/repo everywhere it appears (url, verified, homepage).
  .replace(/github\.com\/[\w.-]+\/[\w.-]+/g, `github.com/${owner}/${repo}`)
writeFileSync(caskPath, cask)
console.log(`• updated ${caskPath}`)

console.log(`
Done. Publish the cask update to your tap repo:

  cd homebrew-tap
  git add -A && git commit -m "arbeiten ${version}" && git push

Users install with:

  brew tap ${owner}/tap
  brew install --cask --no-quarantine arbeiten
`)
