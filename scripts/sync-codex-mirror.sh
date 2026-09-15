#!/usr/bin/env bash
# sync-codex-mirror.sh
#
# Ensure that .codex/skills/ mirrors .agents/skills/ as a symlink farm.
#
# See scripts/sync-claude-mirror.sh for the full design notes. This script
# is the same logic with MIRROR = .codex/skills.
#
# Usage:
#
#   bash scripts/sync-codex-mirror.sh           # apply safe repairs
#   bash scripts/sync-codex-mirror.sh --check   # report only, exit 1 on drift
#   bash scripts/sync-codex-mirror.sh --prune   # also remove orphan symlinks
#
# Exit codes:
#
#   0  mirror is in sync
#   1  drift detected or repair refused (real directory)
#   2  usage / argument error
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CANONICAL="$REPO_ROOT/.agents/skills"
MIRROR="$REPO_ROOT/.codex/skills"
MIRROR_LABEL=".codex/skills"

CHECK_ONLY=false
PRUNE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --check)
            CHECK_ONLY=true
            ;;
        --prune)
            PRUNE=true
            ;;
        -h|--help)
            sed -n '2,18p' "$0"
            exit 0
            ;;
        *)
            echo "ERROR: unknown argument: $1" >&2
            echo "Run with --help for usage." >&2
            exit 2
            ;;
    esac
    shift
done

if [[ ! -d "$CANONICAL" ]]; then
    echo "ERROR: canonical tree missing: $CANONICAL" >&2
    exit 2
fi

if [[ ! -d "$MIRROR" ]]; then
    if [[ "$CHECK_ONLY" == true ]]; then
        echo "ERROR: mirror tree missing: $MIRROR" >&2
        exit 1
    fi
    mkdir -p "$MIRROR"
fi

# Relative path from the mirror's parent to the canonical skill.
# A Skill symlink lives at <root>/.codex/skills/<skill>, so the
# relative target is resolved starting from .codex/skills/ - we go
# up two levels to reach the repo root, then down into .agents/skills/.
# That makes the target "../../.agents/skills/<skill>".
relative_target() {
    local skill_name="$1"
    printf -- "../../.agents/skills/%s" "$skill_name"
}

expected_link() {
    local skill_name="$1"
    printf -- "%s/%s" "$MIRROR" "$skill_name"
}

declare -i made=0
declare -i repaired=0
declare -i skipped=0
declare -i problems=0
declare -i pruned=0

shopt -s nullglob dotglob
for entry in "$CANONICAL"/*; do
    [[ -d "$entry" || -L "$entry" ]] || continue
    name="$(basename "$entry")"
    link_path="$(expected_link "$name")"
    target="$(relative_target "$name")"

    if [[ -L "$link_path" ]]; then
        current_target="$(readlink "$link_path")"
        if [[ "$current_target" == "$target" ]]; then
            skipped=$((skipped + 1))
            continue
        fi
        if [[ "$CHECK_ONLY" == true ]]; then
            echo "WOULD REPAIR: $MIRROR_LABEL/$name (currently -> $current_target, expected -> $target)" >&2
            problems=$((problems + 1))
            continue
        fi
        rm "$link_path"
        ln -s "$target" "$link_path"
        echo "REPAIRED: $MIRROR_LABEL/$name -> $target"
        repaired=$((repaired + 1))
    elif [[ -e "$link_path" ]]; then
        echo "ERROR: $MIRROR_LABEL/$name is a real path; refusing to overwrite." >&2
        echo "       Convert it manually (e.g. mv $MIRROR_LABEL/$name /tmp && ln -s $target $MIRROR_LABEL/$name)" >&2
        problems=$((problems + 1))
    else
        if [[ "$CHECK_ONLY" == true ]]; then
            echo "WOULD CREATE: $MIRROR_LABEL/$name -> $target" >&2
            problems=$((problems + 1))
            continue
        fi
        ln -s "$target" "$link_path"
        echo "CREATED: $MIRROR_LABEL/$name -> $target"
        made=$((made + 1))
    fi
done
shopt -u nullglob dotglob

if [[ "$PRUNE" == true ]]; then
    for entry in "$MIRROR"/*; do
        [[ -L "$entry" ]] || continue
        name="$(basename "$entry")"
        if [[ ! -e "$CANONICAL/$name" ]]; then
            if [[ "$CHECK_ONLY" == true ]]; then
                echo "WOULD PRUNE: $MIRROR_LABEL/$name (orphan)" >&2
                problems=$((problems + 1))
                continue
            fi
            rm "$entry"
            echo "PRUNED: $MIRROR_LABEL/$name"
            pruned=$((pruned + 1))
        fi
    done
fi

echo
echo "Summary: created=$made repaired=$repaired skipped=$skipped pruned=$pruned problems=$problems"

if [[ "$problems" -gt 0 ]]; then
    if [[ "$CHECK_ONLY" == true ]]; then
        echo "$MIRROR_LABEL is OUT OF SYNC. Run without --check to repair." >&2
    else
        echo "Some entries need a human decision - see messages above." >&2
    fi
    exit 1
fi

if [[ "$CHECK_ONLY" == true ]]; then
    echo "$MIRROR_LABEL is in sync."
fi
exit 0