cask "arbeiten" do
  version "1.0.0"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"

  url "https://github.com/OWNER/arbeiten/releases/download/v#{version}/Arbeiten-#{version}.dmg",
      verified: "github.com/OWNER/arbeiten/"
  name "Arbeiten"
  desc "Local-first, Todoist-style todo app with a focus timer and Pomodoro"
  homepage "https://github.com/OWNER/arbeiten"

  depends_on :macos

  app "Arbeiten.app"

  zap trash: [
    "~/Library/Application Support/Arbeiten",
    "~/Library/Preferences/com.arbeiten.desktop.plist",
    "~/Library/Saved Application State/com.arbeiten.desktop.savedState",
  ]

  caveats <<~EOS
    Arbeiten is not signed with an Apple Developer ID, so macOS Gatekeeper will
    block it unless the download quarantine flag is skipped. Install it with:

      brew install --cask --no-quarantine arbeiten

    If you already installed it the normal way, clear the quarantine once:

      xattr -dr com.apple.quarantine "/Applications/Arbeiten.app"
  EOS
end
