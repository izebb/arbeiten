// Generates the Arbeiten "Ar" app icon: a Todoist-red rounded square with a
// white "Ar" monogram. Renders the SVG to a macOS .iconset via sharp, then
// assembles build/icon.icns with iconutil. Also emits build/icon.png and the
// in-app logo SVG. The "Ar" letters are drawn as vector paths (not <text>) so
// rendering does not depend on any installed font.
import sharp from 'sharp'
import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const buildDir = resolve(root, 'build')
const iconsetDir = resolve(buildDir, 'icon.iconset')

const SIZE = 1024
const RADIUS = 230

// Monogram drawn as paths. Coordinate system: 1024x1024.
// "A": a triangle with a crossbar. "r": a stem with a shoulder.
const monogram = `
  <g fill="#ffffff">
    <!-- A -->
    <path d="M300 720 L430 304 L520 304 L650 720 L566 720 L538 626 L412 626 L384 720 Z
             M433 552 L517 552 L475 412 Z" />
    <!-- r -->
    <path d="M690 720 L690 430 L764 430 L764 470
             C788 440 820 424 858 424 L858 502
             C812 502 770 520 764 566 L764 720 Z" />
  </g>`

const svg = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8584c"/>
      <stop offset="1" stop-color="#d1453b"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="url(#bg)"/>
  ${monogram}
</svg>`

// In-app logo (reused by the renderer <Logo/> component).
const logoPath = resolve(root, 'src/renderer/src/assets/logo.svg')
mkdirSync(dirname(logoPath), { recursive: true })
writeFileSync(logoPath, svg)

// Build the iconset.
rmSync(iconsetDir, { recursive: true, force: true })
mkdirSync(iconsetDir, { recursive: true })

const variants = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png']
]

const svgBuf = Buffer.from(svg)
for (const [size, name] of variants) {
  await sharp(svgBuf, { density: 384 }).resize(size, size).png().toFile(resolve(iconsetDir, name))
}
await sharp(svgBuf, { density: 384 }).resize(512, 512).png().toFile(resolve(buildDir, 'icon.png'))

try {
  execSync(`iconutil -c icns "${iconsetDir}" -o "${resolve(buildDir, 'icon.icns')}"`, {
    stdio: 'inherit'
  })
  console.log('Wrote build/icon.icns')
} catch (e) {
  console.warn('iconutil failed (macOS only):', e.message)
}
console.log('Wrote build/icon.png and src/renderer/src/assets/logo.svg')
