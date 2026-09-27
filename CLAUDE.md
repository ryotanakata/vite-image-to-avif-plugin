# CLAUDE.md

## コマンド

```bash
npm run dev     # tsup --watch（esm/cjs/dts 出力）
npm run build   # プロダクションビルド（esm/cjs/dts）
npm test        # vitest run
npm run lint    # ESLint実行（src配下、拡張子 .ts）
```

`prepublishOnly` が `lint && test && build` を束ねている。**`npm publish` を手元で直接実行しない**（`main` へのマージをトリガーに CI が自動で行う。詳細は「リリース自動化」を参照）。

## アーキテクチャ概要

**vite-image-to-avif-plugin** は、Viteのビルド完了時（`buildEnd`フック）に指定ディレクトリ配下の画像をAVIF形式へ自動変換するViteプラグイン。単一ファイル構成の小さなnpmパッケージ。

- **エントリポイント**: `src/index.ts` 1ファイルに実装が集約されている（変換ロジック・キャッシュ管理・ファイル探索を分離するほどの規模ではない）
- **変換**: [sharp](https://sharp.pixelplumbing.com/) で画像→AVIF変換。`p-limit` で並行数を制御
- **キャッシュ**: 変換済みファイルのmtimeを `cacheDir/image-mtimes.json` に記録し、未変更ファイルの再変換をスキップ
- **ビルド出力**: `tsup` で ESM/CJS/型定義(.d.ts)の3種を `dist/` に生成
- **テスト**: `src/index.test.ts` に集約（vitest）

## 主要な技術的判断

- **named export のみ**（`export default` 禁止）。`viteImageToAVIFPlugin` を named export する
- **peerDependencies** に `vite` を持つ（プラグインなのでVite本体は同梱しない）。`dependencies` は `sharp` と `p-limit` のみに絞る
- **ライブラリ公開物は `dist/` のみ**（`package.json` の `files`）。ソースやテストは配布物に含めない

## リリース自動化

`main` へのマージをトリガーに、コミット履歴（Conventional Commits）から semver を自動判定して npm へ公開する。

- **バージョン判定・公開**: [semantic-release](https://semantic-release.gitbook.io/)（設定は `.releaserc.json`）。`feat` → minor、`fix`/`perf` → patch、`BREAKING CHANGE:` フッター → major
- **ワークフロー**: `.github/workflows/release.yml`（`main` への push で発火。lint・test・build を通してから `npx semantic-release` を実行）
- **副産物**: `CHANGELOG.md` の自動生成・更新、`vX.Y.Z` 形式のGitタグ、GitHub Releaseの作成
- **前提**: リポジトリの GitHub Secrets に `NPM_TOKEN`（npmのautomationトークン）が登録されていること。無いとリリースジョブが `ENONPMTOKEN` で失敗する
- **依存関係の定期更新**: `.github/dependabot.yml`（npm・github-actions を週次でチェックし、更新PRを自動作成。マージすれば次のリリースに自動的に含まれる）
- **ループ防止**: `@semantic-release/git` が push するリリースコミットは `chore(release): ... [skip ci]` を含むため、このコミット自身では release ワークフローが再発火しない

自律開発ループのルーチンは `npm publish` を直接実行しない（`.claude/routine-prompt.md` の禁止事項を参照）。バージョニング・公開は上記の自動化に委ねる。

## 自律開発ループ（Notion連携）

Notion をタスク管理に使った自律開発ループを導入している。開発フローは次のとおり:

```
Notion起票（背景・要求・受け入れ条件AC） → ルーチン実行（実装・自己レビュー・PR作成） → 人間レビュー → マージ
```

- **Notion 参照元**: `.claude/notion.json`（DB ID・Statusプロパティの値・base ブランチ・テストコマンドを集約。値をコード側に直書きしない）
- **ルーチンのプロンプト**: `.claude/routine-prompt.md`（クラウド側ルーチンの設定にはこのファイルの内容をそのまま使う）
- **コミット前の規約レビュー**: `.claude/skills/rules-review/SKILL.md`（`.claude/agents/rules-reviewer.md` を並列起動して照合）。`git commit` は `.claude/hooks/review-gate.sh` のゲート（`.claude/settings.json` の `PreToolUse` hook）を通過しないとブロックされる。`.claude/rules/*.md` は現時点で未整備のため、規約レビューは実質0件で通過する（今後コーディング規約を追加したら自動的に対象化される）
- **出荷（レビュー→意味単位コミット→PR作成）**: `.claude/skills/ship/SKILL.md`
- **PRテンプレート**: `.github/pull_request_template.md`。`## 受け入れ条件（AC）` の見出しは表記を変えない（AC の箇条書きを差分と照合する仕組みが前提のため）
- ルーチンが作った PR は、人間がレビュー・マージするまで Notion 上のタスクを完了にしない
