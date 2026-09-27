#!/usr/bin/env bash
set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
MARKER_FILE="$PROJECT_DIR/.claude/tmp/rules-review-pass"

# 作業ツリーの内容ハッシュ。一時 index に全ファイル（追跡 + 未追跡、.gitignore 除外）を
# ステージして tree oid を得る。実際の index には触れない。HEAD に依存しないため
# コミットで失効せず、ファイル内容の変更でのみ変わる。
state_hash() {
  cd "$PROJECT_DIR" || return 1
  local tmp_index
  tmp_index=$(mktemp) || return 1
  (
    export GIT_INDEX_FILE="$tmp_index"
    git read-tree --empty
    git add -A 2>/dev/null
    git rm -r --cached -q --ignore-unmatch .claude/tmp 2>/dev/null
    git write-tree
  )
  local status=$?
  rm -f "$tmp_index"
  return $status
}

case "${1:-}" in
  --pass)
    mkdir -p "$(dirname "$MARKER_FILE")"
    state_hash > "$MARKER_FILE"
    echo "rules-review: 現在の変更をレビュー済みとして記録しました（${MARKER_FILE}）"
    ;;
  --check)
    input="$(cat)"
    # stdin の hook JSON から実行コマンドを抜く。異常時は fail-open（コミットを妨げない）
    command=$(printf '%s' "$input" | python3 -c \
      'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' \
      2>/dev/null || true)
    [ -z "$command" ] && exit 0
    printf '%s' "$command" | grep -qE '\bgit\b[^|;&]*\bcommit\b' || exit 0
    case "$command" in *SKIP_RULES_REVIEW=1*) exit 0 ;; esac

    if [ -f "$MARKER_FILE" ] && [ "$(cat "$MARKER_FILE")" = "$(state_hash)" ]; then
      exit 0
    fi
    {
      echo "コミットをブロックしました: 規約レビュー未実施か、前回レビュー後にファイルが変更されています。"
      echo "rules-review スキルを実行し、違反を解消してから再度コミットしてください。"
    } >&2
    exit 2
    ;;
esac
