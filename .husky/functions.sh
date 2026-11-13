#!/usr/bin/env bash
NC='\033[0m' # No Color
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'

# A notice only: it returns 0 whatever it finds, so it never fails the hook that calls it.
notify_about_actions_required() {
	changed_files="$(git diff-tree -r --name-status --no-commit-id $1 $2)" || return 0
	is_changed() {
		echo "$changed_files" | grep -Eq "$1"
	}
	is_added() {
		echo "$changed_files" | grep -Eq "^A\s+$1"
	}
	is_modified() {
		echo "$changed_files" | grep -Eq "^M\s+$1"
	}
	is_deleted() {
		echo "$changed_files" | grep -Eq "^D\s+$1"
	}
	print_notification() {
		filename="$1"
		shift
		action="$@"
		echo -e "${YELLOW}${filename}${NC} changed. Please run ${CYAN}${action}${NC}"
	}
	if is_changed pnpm-lock.yaml; then print_notification "pnpm-lock.yaml" "pnpm install"; fi
}
