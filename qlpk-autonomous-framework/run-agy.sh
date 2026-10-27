#!/usr/bin/env bash
# QLPK Autonomous Framework — Safe Multi-Model Orchestrator
# Verified against AGY CLI v1.4.7 on macOS.

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

# ==============================================================================
# 1. PATHS & DIRECTORY SEPARATION (Rule 4.E)
# ==============================================================================
FRAMEWORK_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd -- "${FRAMEWORK_DIR}/.." && pwd)}"
STATE_DIR="${STATE_DIR:-${FRAMEWORK_DIR}/.agy-state}"
LOG_DIR="${LOG_DIR:-${FRAMEWORK_DIR}/logs}"
REPORTS_DIR="${REPORTS_DIR:-${FRAMEWORK_DIR}/reports}"
LOCK_DIR="${STATE_DIR}/run.lock"
STOP_FILE="${STATE_DIR}/STOP"
STOP_AT_HOUR_FILE="${STATE_DIR}/STOP_AT_HOUR"
ROADMAP_FILE="${ROADMAP_FILE:-${FRAMEWORK_DIR}/ROADMAP.md}"
PROGRESS_FILE="${PROGRESS_FILE:-${FRAMEWORK_DIR}/PROGRESS.md}"

# ==============================================================================
# 2. VERIFIED MODEL ROUTING CONFIGURATION (Rule 3 & 4.A)
# ==============================================================================
AGY_BIN="${AGY_BIN:-agy}"
PLANNER_MODEL="${PLANNER_MODEL:-claude-sonnet-5-5-high}"
CODER_MODEL="${CODER_MODEL:-gemini-3.8-flash-high}"
REVIEWER_MODEL="${REVIEWER_MODEL:-gemini-4-argon-high}"
DEBUG_FALLBACK_MODEL="${DEBUG_FALLBACK_MODEL:-claude-sonnet-5-5-high}"
ARCH_ESCALATION_MODEL="${ARCH_ESCALATION_MODEL:-claude-opus-5-5-high}"
ALLOW_FALLBACK="${ALLOW_FALLBACK:-0}"

VALID_AGY_MODELS=(
  "gemini-4-argon-medium"
  "gemini-4-argon-high"
  "gemini-4-argon-low"
  "gemini-3.8-flash-high"
  "gemini-3.8-flash-medium"
  "gemini-3.8-flash-low"
  "claude-opus-5-5-low"
  "claude-opus-5-5-medium"
  "claude-opus-5-5-high"
  "claude-sonnet-5-5-low"
  "claude-sonnet-5-5-medium"
  "claude-sonnet-5-5-high"
  "gpt-oss-120b-medium"
)

# ==============================================================================
# 3. CPU, RAM, COOLDOWN, TIMEOUT & RETRY CONFIGURATION (Rule 4.C)
# ==============================================================================
TASK_COOLDOWN_SECONDS="${TASK_COOLDOWN_SECONDS:-30}"
ERROR_COOLDOWN_SECONDS="${ERROR_COOLDOWN_SECONDS:-120}"
QUOTA_BACKOFF_SECONDS="${QUOTA_BACKOFF_SECONDS:-900}"
CPU_LOAD_PER_CORE_LIMIT="${CPU_LOAD_PER_CORE_LIMIT:-0.85}"
MIN_FREE_MEMORY_PERCENT="${MIN_FREE_MEMORY_PERCENT:-15}"
RESOURCE_WAIT_SECONDS="${RESOURCE_WAIT_SECONDS:-300}"
RESOURCE_POLL_INTERVAL_SECONDS="${RESOURCE_POLL_INTERVAL_SECONDS:-15}"
MODEL_TIMEOUT_SECONDS="${MODEL_TIMEOUT_SECONDS:-900}"
TASK_TIMEOUT_SECONDS="${TASK_TIMEOUT_SECONDS:-2700}"
SESSION_TIMEOUT_SECONDS="${SESSION_TIMEOUT_SECONDS:-43200}"
MAX_TASKS_PER_SESSION="${MAX_TASKS_PER_SESSION:-30}"
MAX_CONSECUTIVE_FAILURES="${MAX_CONSECUTIVE_FAILURES:-5}"
MAX_REVIEW_ROUNDS="${MAX_REVIEW_ROUNDS:-3}"
MAX_TEST_FIX_RETRIES="${MAX_TEST_FIX_RETRIES:-2}"
MAX_MODEL_RETRIES="${MAX_MODEL_RETRIES:-2}"
RETRY_BASE_SECONDS="${RETRY_BASE_SECONDS:-5}"

# ==============================================================================
# 4. GIT & SECURITY CONFIGURATION (Rule 4.D)
# ==============================================================================
ALLOWED_BRANCHES="${ALLOWED_BRANCHES:-main,dev}"
ALLOW_UNTRACKED_REGEX="${ALLOW_UNTRACKED_REGEX:-^(\.DS_Store|qlpk-autonomous-framework(-v2\.zip|/.*)?|docs/.*|be/.*|fe/.*)$}"
AUTO_COMMIT_ON_DONE="${AUTO_COMMIT_ON_DONE:-1}"
TARGET_COMMIT_BRANCH="${TARGET_COMMIT_BRANCH:-dev}"

SESSION_START_EPOCH="$(date +%s)"
ACTIVE_CHILD_PID=""
LOCK_ACQUIRED=0

# ==============================================================================
# 5. LOGGING, SECRET REDACTION & RUNTIME INITIALIZATION
# ==============================================================================
ensure_runtime_dirs() {
  mkdir -p "$STATE_DIR" "$LOG_DIR" "${REPORTS_DIR}/tasks" "${REPORTS_DIR}/features"
  chmod 700 "$STATE_DIR" "$LOG_DIR" 2>/dev/null || true
}

redact_secrets() {
  sed -E \
    -e 's/(DB_PASSWORD|APP_KEY|AWS_SECRET_ACCESS_KEY|REDIS_PASSWORD|MAIL_PASSWORD|PASSWORD|SECRET|TOKEN|API_KEY)[[:space:]]*=[[:space:]]*[^[:space:]"'\'']+/\1=[REDACTED]/Ig' \
    -e 's/(Bearer[[:space:]]+)[A-Za-z0-9._-]+/\1[REDACTED]/Ig' \
    -e 's/(-p)123456/\1[REDACTED]/g'
}

log() {
  ensure_runtime_dirs
  local ts
  ts="$(date '+%Y-%m-%dT%H:%M:%S%z')"
  printf '[%s] %s\n' "$ts" "$*" | redact_secrets | tee -a "${LOG_DIR}/orchestrator.log"
}

usage() {
  cat <<'USAGE'
Usage:
  ./run-agy.sh status
  ./run-agy.sh check-resources
  ./run-agy.sh dry-run
  ./run-agy.sh self-test
  ./run-agy.sh run [TASK_ID]
  ./run-agy.sh stop
  ./run-agy.sh clear-stop
USAGE
}

# ==============================================================================
# 6. LOCKING, SIGNAL HANDLING & CHILD PROCESS CLEANUP (Rule 4.C.11)
# ==============================================================================
kill_active_child() {
  if [[ -n "${ACTIVE_CHILD_PID:-}" ]]; then
    if kill -0 "$ACTIVE_CHILD_PID" 2>/dev/null; then
      kill -TERM "$ACTIVE_CHILD_PID" 2>/dev/null || true
      sleep 1
      kill -KILL "$ACTIVE_CHILD_PID" 2>/dev/null || true
    fi
    ACTIVE_CHILD_PID=""
  fi
}

cleanup_lock() {
  kill_active_child
  if [[ "$LOCK_ACQUIRED" -eq 1 && -d "$LOCK_DIR" ]]; then
    rm -rf -- "$LOCK_DIR"
    LOCK_ACQUIRED=0
  fi
}

on_signal() {
  local sig="${1:-TERM}"
  log "SIGNAL_RECEIVED: Caught SIG${sig}. Terminating child processes and releasing lock safely."
  cleanup_lock
  exit 130
}

acquire_lock() {
  ensure_runtime_dirs
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    local existing_pid=""
    if [[ -f "${LOCK_DIR}/pid" ]]; then
      existing_pid="$(cat "${LOCK_DIR}/pid" 2>/dev/null || true)"
    fi
    if [[ -n "$existing_pid" ]] && ! kill -0 "$existing_pid" 2>/dev/null; then
      log "WARN: Stale lock detected for dead PID ${existing_pid}. Cleaning up stale lock."
      rm -rf -- "$LOCK_DIR"
      mkdir "$LOCK_DIR"
    else
      log "ERROR: Lock exists at ${LOCK_DIR} (active PID: ${existing_pid:-unknown}). Refusing concurrent execution."
      exit 3
    fi
  fi
  printf '%s\n' "$$" > "${LOCK_DIR}/pid"
  LOCK_ACQUIRED=1
  trap 'on_signal INT' INT
  trap 'on_signal TERM' TERM
  trap 'cleanup_lock' EXIT
}

# ==============================================================================
# 7. STOP CONDITIONS & COOLDOWN SLEEP (Rule 4.C.2, 4.C.5, 4.C.10)
# ==============================================================================
should_stop() {
  if [[ -f "$STOP_FILE" ]]; then
    log "STOP_GATE: Manual stop file detected at ${STOP_FILE}."
    return 0
  fi
  if [[ -f "$STOP_AT_HOUR_FILE" ]]; then
    local target_hour current_hour
    target_hour="$(tr -d '[:space:]' < "$STOP_AT_HOUR_FILE" 2>/dev/null || true)"
    current_hour="$(date '+%H')"
    if [[ -n "$target_hour" && "$current_hour" == "$target_hour" ]]; then
      log "STOP_GATE: Reached configured stop hour (${target_hour})."
      return 0
    fi
  fi
  local now_epoch elapsed
  now_epoch="$(date +%s)"
  elapsed=$(( now_epoch - SESSION_START_EPOCH ))
  if (( elapsed >= SESSION_TIMEOUT_SECONDS )); then
    log "STOP_GATE: Session timeout reached (${elapsed}s >= ${SESSION_TIMEOUT_SECONDS}s)."
    return 0
  fi
  return 1
}

cooldown_sleep() {
  local seconds="${1:-0}"
  local reason="${2:-TASK_COOLDOWN}"
  if (( seconds <= 0 )); then
    return 0
  fi
  log "COOLDOWN: Sleeping ${seconds}s (${reason})..."
  local waited=0
  while (( waited < seconds )); do
    if should_stop; then
      log "COOLDOWN: Interrupted early due to stop condition."
      return 1
    fi
    sleep 1
    waited=$(( waited + 1 ))
  done
  return 0
}

# ==============================================================================
# 8. OS-AWARE CPU & MEMORY CHECKS (macOS & Linux) (Rule 4.C.6 - 4.C.9)
# ==============================================================================
get_cpu_load_per_core() {
  if [[ -n "${OVERRIDE_CPU_LOAD_PER_CORE:-}" ]]; then
    printf '%s\n' "$OVERRIDE_CPU_LOAD_PER_CORE"
    return 0
  fi
  local os_name cores load_1m
  os_name="$(uname -s)"
  if [[ "$os_name" == "Darwin" ]]; then
    cores="$(sysctl -n hw.ncpu 2>/dev/null || echo 1)"
    load_1m="$(sysctl -n vm.loadavg 2>/dev/null | awk '{gsub(/[{}]/,""); print $1}')"
  else
    cores="$(nproc 2>/dev/null || echo 1)"
    load_1m="$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo 0)"
  fi
  awk -v l="${load_1m:-0}" -v c="${cores:-1}" 'BEGIN { if (c <= 0) c = 1; printf "%.4f", l / c }'
}

get_free_memory_percent() {
  if [[ -n "${OVERRIDE_FREE_MEM_PERCENT:-}" ]]; then
    printf '%s\n' "$OVERRIDE_FREE_MEM_PERCENT"
    return 0
  fi
  local os_name
  os_name="$(uname -s)"
  if [[ "$os_name" == "Darwin" ]]; then
    local total_bytes page_size free_pages inactive_pages spec_pages
    total_bytes="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
    page_size="$(vm_stat 2>/dev/null | awk '/page size of/ {for(i=1;i<=NF;i++) if($i ~ /^[0-9]+$/) print $i; exit}')"
    free_pages="$(vm_stat 2>/dev/null | awk '/Pages free:/ {gsub(/\./,"",$3); print $3}')"
    inactive_pages="$(vm_stat 2>/dev/null | awk '/Pages inactive:/ {gsub(/\./,"",$3); print $3}')"
    spec_pages="$(vm_stat 2>/dev/null | awk '/Pages speculative:/ {gsub(/\./,"",$3); print $3}')"
    awk -v tb="${total_bytes:-1}" -v ps="${page_size:-4096}" \
        -v fp="${free_pages:-0}" -v ip="${inactive_pages:-0}" -v sp="${spec_pages:-0}" \
        'BEGIN {
          if (tb <= 0) { print "0.00"; exit }
          avail = (fp + ip + sp) * ps;
          printf "%.2f", (avail / tb) * 100.0
        }'
  else
    awk '
      /MemTotal:/ { total=$2 }
      /MemAvailable:/ { avail=$2 }
      END {
        if (total <= 0) { print "0.00"; exit }
        printf "%.2f", (avail / total) * 100.0
      }
    ' /proc/meminfo 2>/dev/null || echo "50.00"
  fi
}

check_system_resources() {
  local cpu_load_per_core free_mem_pct cpu_ok mem_ok
  cpu_load_per_core="$(get_cpu_load_per_core)"
  free_mem_pct="$(get_free_memory_percent)"

  cpu_ok="$(awk -v cur="$cpu_load_per_core" -v lim="$CPU_LOAD_PER_CORE_LIMIT" 'BEGIN { print (cur <= lim) ? 1 : 0 }')"
  mem_ok="$(awk -v cur="$free_mem_pct" -v min="$MIN_FREE_MEMORY_PERCENT" 'BEGIN { print (cur >= min) ? 1 : 0 }')"

  if [[ "$cpu_ok" -eq 1 && "$mem_ok" -eq 1 ]]; then
    log "RESOURCE_OK: cpu_load_per_core=${cpu_load_per_core} (limit=${CPU_LOAD_PER_CORE_LIMIT}), free_mem_pct=${free_mem_pct}% (min=${MIN_FREE_MEMORY_PERCENT}%)"
    return 0
  fi

  log "RESOURCE_THROTTLE: cpu_load_per_core=${cpu_load_per_core} (limit=${CPU_LOAD_PER_CORE_LIMIT}), free_mem_pct=${free_mem_pct}% (min=${MIN_FREE_MEMORY_PERCENT}%)"
  return 1
}

wait_for_resources() {
  local waited=0
  while ! check_system_resources; do
    if (( waited >= RESOURCE_WAIT_SECONDS )); then
      log "BLOCKED: RESOURCE_OVERLOAD — System resources did not recover within ${RESOURCE_WAIT_SECONDS}s."
      return 1
    fi
    if should_stop; then
      return 1
    fi
    local sleep_step="$RESOURCE_POLL_INTERVAL_SECONDS"
    if (( waited + sleep_step > RESOURCE_WAIT_SECONDS )); then
      sleep_step=$(( RESOURCE_WAIT_SECONDS - waited ))
    fi
    log "RESOURCE_WAIT: Waiting ${sleep_step}s for CPU/RAM recovery (${waited}/${RESOURCE_WAIT_SECONDS}s elapsed)..."
    sleep "$sleep_step"
    waited=$(( waited + sleep_step ))
  done
  return 0
}

# ==============================================================================
# 9. GIT & COMMAND SAFETY GUARDS (Rule 4.D)
# ==============================================================================
assert_clean_git_tree() {
  if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log "BLOCKED: PROJECT_ROOT (${PROJECT_ROOT}) is not a valid Git repository."
    return 1
  fi

  local current_branch
  current_branch="$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || true)"
  local branch_ok=0
  local b
  while IFS= read -r b; do
    [[ -z "$b" ]] && continue
    if [[ "$current_branch" == "$b" ]]; then
      branch_ok=1
      break
    fi
  done < <(tr ',' '\n' <<<"$ALLOWED_BRANCHES")
  if [[ "$branch_ok" -eq 0 ]]; then
    log "BLOCKED: Current branch '${current_branch}' is not in ALLOWED_BRANCHES (${ALLOWED_BRANCHES})."
    return 1
  fi

  local dirty_lines=""
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local file_path="${line:3}"
    if [[ -n "$ALLOW_UNTRACKED_REGEX" && "$file_path" =~ $ALLOW_UNTRACKED_REGEX ]]; then
      continue
    fi
    dirty_lines+="${line}"$'\n'
  done < <(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null)

  if [[ -n "$dirty_lines" ]]; then
    log "BLOCKED: DIRTY_WORKING_TREE — Uncommitted or unknown changes detected in ${PROJECT_ROOT}. Refusing to overwrite or continue:"
    printf '%s' "$dirty_lines" | while IFS= read -r dline; do
      [[ -n "$dline" ]] && log "  dirty: $dline"
    done
    return 1
  fi

  log "GIT_OK: Branch '${current_branch}' is allowed and working tree is clean."
  return 0
}

assert_safe_command() {
  local cmd="$1"
  local forbidden_regex='(migrate:(fresh|reset|refresh)|db:wipe|DROP[[:space:]]+(DATABASE|TABLE)|TRUNCATE[[:space:]]+TABLE|git[[:space:]]+(reset[[:space:]]+--hard|clean|push[[:space:]]+--force|stash)|--dangerously-skip-permissions)'
  if [[ "$cmd" =~ $forbidden_regex ]]; then
    log "BLOCKED: FORBIDDEN_DESTRUCTIVE_COMMAND rejected: ${cmd}"
    return 1
  fi
  return 0
}

assert_valid_model_id() {
  local model_id="$1"
  local m
  for m in "${VALID_AGY_MODELS[@]}"; do
    if [[ "$m" == "$model_id" ]]; then
      return 0
    fi
  done
  log "BLOCKED: INVALID_MODEL_ID '${model_id}' is not in verified agy models list."
  return 1
}

# ==============================================================================
# 10. MODEL INVOCATION, WATCHDOG TIMEOUT & ERROR CLASSIFICATION (Rule 4.A)
# ==============================================================================
run_with_timeout() {
  local timeout_sec="$1"
  shift
  local out_file="$1"
  shift
  local err_file="$1"
  shift

  "$@" >"$out_file" 2>"$err_file" &
  ACTIVE_CHILD_PID=$!
  local start_ts
  start_ts="$(date +%s)"

  while kill -0 "$ACTIVE_CHILD_PID" 2>/dev/null; do
    local now_ts elapsed
    now_ts="$(date +%s)"
    elapsed=$(( now_ts - start_ts ))
    if (( elapsed >= timeout_sec )); then
      log "TIMEOUT_WATCHDOG: Process ${ACTIVE_CHILD_PID} exceeded ${timeout_sec}s; terminating safely."
      kill -TERM "$ACTIVE_CHILD_PID" 2>/dev/null || true
      sleep 1
      kill -KILL "$ACTIVE_CHILD_PID" 2>/dev/null || true
      wait "$ACTIVE_CHILD_PID" 2>/dev/null || true
      ACTIVE_CHILD_PID=""
      return 124
    fi
    sleep 1
  done

  local rc=0
  wait "$ACTIVE_CHILD_PID" || rc=$?
  ACTIVE_CHILD_PID=""
  return "$rc"
}

classify_agy_error() {
  local exit_code="$1"
  local combined_output="$2"

  if [[ "$exit_code" -eq 124 || "$exit_code" -eq 137 ]] || grep -qiE '(timed out|deadline exceeded|print-timeout)' <<<"$combined_output"; then
    printf 'TIMEOUT_ERROR\n'
    return 0
  fi
  if grep -qiE '(429|RESOURCE_EXHAUSTED|quota exceeded|insufficient_quota|rate[ -]?limit|Too Many Requests)' <<<"$combined_output"; then
    printf 'QUOTA_ERROR\n'
    return 0
  fi
  if grep -qiE '(ECONNRESET|ETIMEDOUT|EAI_AGAIN|connection refused|network unreachable|502 Bad Gateway|503 Service Unavailable|504 Gateway Timeout)' <<<"$combined_output"; then
    printf 'NETWORK_ERROR\n'
    return 0
  fi
  if [[ "$exit_code" -eq 2 ]] || grep -qiE '(unknown flag|unknown option|invalid model|flag needs an argument)' <<<"$combined_output"; then
    printf 'CLI_ERROR\n'
    return 0
  fi
  if [[ "$exit_code" -ne 0 ]]; then
    printf 'CLI_ERROR\n'
    return 0
  fi
  printf 'NONE\n'
}

invoke_agy_model() {
  local role="$1"
  local model_id="$2"
  local mode_flag="$3"
  local prompt_text="$4"
  local out_file="$5"

  assert_valid_model_id "$model_id" || return 22

  local err_file="${out_file}.stderr"
  local cli_log="${out_file}.cli.log"
  local attempt=1
  local max_attempts=$(( MAX_MODEL_RETRIES + 1 ))

  while (( attempt <= max_attempts )); do
    log "MODEL_CALL: role=${role} model=${model_id} mode=${mode_flag} attempt=${attempt}/${max_attempts} timeout=${MODEL_TIMEOUT_SECONDS}s"

    local cmd_args=(
      "$AGY_BIN"
      "--model" "$model_id"
      "--mode" "$mode_flag"
      "--disable-slash-commands"
      "--output-format" "json"
      "--print-timeout" "${MODEL_TIMEOUT_SECONDS}s"
      "--log-file" "$cli_log"
    )
    if [[ "$mode_flag" == "plan" ]]; then
      cmd_args+=("--sandbox")
    else
      cmd_args+=("--add-dir" "$PROJECT_ROOT")
    fi
    cmd_args+=("--print" "$prompt_text")

    local rc=0
    run_with_timeout "$MODEL_TIMEOUT_SECONDS" "$out_file" "$err_file" "${cmd_args[@]}" || rc=$?

    local combined
    combined="$(cat "$out_file" "$err_file" 2>/dev/null | redact_secrets || true)"
    local err_type="NONE"
    if [[ "$rc" -ne 0 ]]; then
      err_type="$(classify_agy_error "$rc" "$combined")"
    elif [[ ! -s "$out_file" ]]; then
      err_type="CONTENT_ERROR"
      rc=65
    fi

    if [[ "$err_type" == "NONE" ]]; then
      log "MODEL_SUCCESS: role=${role} model=${model_id} attempt=${attempt} exit_code=0"
      return 0
    fi

    log "MODEL_ERROR: role=${role} model=${model_id} attempt=${attempt} exit_code=${rc} error_type=${err_type}"

    case "$err_type" in
      QUOTA_ERROR)
        log "QUOTA_EXCEEDED: Model ${model_id} hit quota/rate limit. Working tree is preserved untouched (no reset/clean/stash). Backing off for ${QUOTA_BACKOFF_SECONDS}s."
        if (( attempt < max_attempts )); then
          cooldown_sleep "$QUOTA_BACKOFF_SECONDS" "QUOTA_BACKOFF" || return 75
          attempt=$(( attempt + 1 ))
          continue
        fi
        return 75
        ;;
      NETWORK_ERROR|TIMEOUT_ERROR)
        if (( attempt < max_attempts )); then
          local jitter=$(( RANDOM % 3 ))
          local backoff=$(( RETRY_BASE_SECONDS * (1 << (attempt - 1)) + jitter ))
          log "RETRY_BACKOFF: Transient ${err_type}; sleeping ${backoff}s before retry..."
          cooldown_sleep "$backoff" "RETRY_${err_type}" || return "$rc"
          attempt=$(( attempt + 1 ))
          continue
        fi
        if [[ "$ALLOW_FALLBACK" -eq 1 && "$model_id" != "$DEBUG_FALLBACK_MODEL" ]]; then
          log "FALLBACK_TRIGGERED: role=${role} from=${model_id} to=${DEBUG_FALLBACK_MODEL} reason=${err_type}_AFTER_${max_attempts}_ATTEMPTS"
          model_id="$DEBUG_FALLBACK_MODEL"
          max_attempts=$(( attempt + 1 ))
          attempt=$(( attempt + 1 ))
          continue
        fi
        return "$rc"
        ;;
      CLI_ERROR|CONTENT_ERROR|*)
        if [[ "$ALLOW_FALLBACK" -eq 1 && "$err_type" == "CONTENT_ERROR" && "$model_id" != "$DEBUG_FALLBACK_MODEL" ]]; then
          log "FALLBACK_TRIGGERED: role=${role} from=${model_id} to=${DEBUG_FALLBACK_MODEL} reason=CONTENT_ERROR"
          model_id="$DEBUG_FALLBACK_MODEL"
          max_attempts=$(( attempt + 1 ))
          attempt=$(( attempt + 1 ))
          continue
        fi
        return "$rc"
        ;;
    esac
  done
  return 1
}

# ==============================================================================
# 11. AUTOMATED TESTER, REVIEWER LOOP & ANTI-FAKE-DONE GATE (Rule 4.B)
# ==============================================================================
run_task_tests() {
  local task_id="$1"
  local run_id="$2"
  local test_report="${REPORTS_DIR}/tasks/${task_id}-test.md"
  shift 2
  local test_cmds=("$@")

  log "TESTER_START: task=${task_id} run_id=${run_id} commands=${#test_cmds[@]}"

  {
    printf '# Automated Test Report — %s\n\n' "$task_id"
    printf -- '- `RUN_ID`: `%s`\n' "$run_id"
    printf -- '- `TIMESTAMP`: `%s`\n\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')"
    printf '| Command | Exit Code | Result |\n|---|---:|---|\n'
  } > "$test_report"

  local overall_rc=0
  local cmd_outputs=""
  local cmd
  for cmd in "${test_cmds[@]}"; do
    if ! assert_safe_command "$cmd"; then
      overall_rc=99
      printf '| `%s` | `99` | `BLOCKED_FORBIDDEN` |\n' "$cmd" >> "$test_report"
      break
    fi
    local cmd_out_file="${STATE_DIR}/test_${task_id}_$$.out"
    local cmd_rc=0
    (
      export PROJECT_ROOT FRAMEWORK_DIR
      cd "$PROJECT_ROOT"
      bash -c "$cmd"
    ) >"$cmd_out_file" 2>&1 || cmd_rc=$?

    local sanitized_out
    sanitized_out="$(redact_secrets < "$cmd_out_file" || true)"
    rm -f -- "$cmd_out_file"

    if [[ "$cmd_rc" -eq 0 ]]; then
      printf '| `%s` | `0` | `PASS` |\n' "$cmd" >> "$test_report"
      log "TEST_COMMAND_PASS: task=${task_id} cmd='${cmd}' exit_code=0"
    else
      printf '| `%s` | `%d` | `FAIL` |\n' "$cmd" "$cmd_rc" >> "$test_report"
      log "TEST_COMMAND_FAIL: task=${task_id} cmd='${cmd}' exit_code=${cmd_rc}"
      overall_rc="$cmd_rc"
    fi
    cmd_outputs+=$'\n'"### Command: \`${cmd}\` (exit_code=${cmd_rc})"$'\n```text\n'"${sanitized_out}"$'\n```\n'
    if [[ "$overall_rc" -ne 0 ]]; then
      break
    fi
  done

  {
    printf '\n## Summary\n'
    if [[ "$overall_rc" -eq 0 ]]; then
      printf -- '- `OVERALL_TEST_RESULT`: `PASS`\n'
      printf -- '- `EXIT_CODE`: `0`\n'
    else
      printf -- '- `OVERALL_TEST_RESULT`: `FAIL`\n'
      printf -- '- `EXIT_CODE`: `%d`\n' "$overall_rc"
    fi
    printf '%s\n' "$cmd_outputs"
  } >> "$test_report"

  return "$overall_rc"
}

verify_done_gate() {
  local task_id="$1"
  local expected_run_id="$2"
  local review_round="$3"

  local test_report="${REPORTS_DIR}/tasks/${task_id}-test.md"
  local review_report="${REPORTS_DIR}/tasks/${task_id}-review-round-${review_round}.md"

  if [[ ! -f "$test_report" ]]; then
    log "FAKE_OR_STALE_DONE_REJECTED: Missing test report at ${test_report}"
    return 1
  fi
  if [[ ! -f "$review_report" ]]; then
    log "FAKE_OR_STALE_DONE_REJECTED: Missing review report at ${review_report}"
    return 1
  fi
  if ! grep -Fq "RUN_ID: ${expected_run_id}" "$test_report" && ! grep -Fq "\`RUN_ID\`: \`${expected_run_id}\`" "$test_report"; then
    log "FAKE_OR_STALE_DONE_REJECTED: Test report RUN_ID does not match current session ${expected_run_id}"
    return 1
  fi
  if ! grep -Fq "RUN_ID: ${expected_run_id}" "$review_report" && ! grep -Fq "\`RUN_ID\`: \`${expected_run_id}\`" "$review_report"; then
    log "FAKE_OR_STALE_DONE_REJECTED: Review report RUN_ID does not match current session ${expected_run_id}"
    return 1
  fi
  if ! grep -Fq "\`OVERALL_TEST_RESULT\`: \`PASS\`" "$test_report"; then
    log "FAKE_OR_STALE_DONE_REJECTED: Test report does not record OVERALL_TEST_RESULT: PASS"
    return 1
  fi
  if ! grep -Fq "\`OVERALL_REVIEW_RESULT\`: \`PASS\`" "$review_report"; then
    log "FAKE_OR_STALE_DONE_REJECTED: Review report does not record OVERALL_REVIEW_RESULT: PASS"
    return 1
  fi

  log "DONE_GATE_VERIFIED: task=${task_id} run_id=${expected_run_id} review_round=${review_round} -> APPROVED FOR DONE"
  return 0
}

execute_task_lifecycle() {
  local task_id="$1"
  local task_goal="$2"
  shift 2
  local test_cmds=("$@")

  local run_id="run-$(date '+%Y%m%d%H%M%S')-$$-${RANDOM}"
  local task_start_ts
  task_start_ts="$(date +%s)"

  log "TASK_START: task=${task_id} run_id=${run_id} coder_model=${CODER_MODEL} reviewer_model=${REVIEWER_MODEL}"

  assert_clean_git_tree || return 10
  wait_for_resources || return 11

  local coder_out="${REPORTS_DIR}/tasks/${task_id}-coder.json"
  local coder_prompt="ROLE=CODER TASK_ID=${task_id} RUN_ID=${run_id} GOAL=${task_goal} — Read ${ROADMAP_FILE} section for ${task_id}. IMPORTANT: (1) Do NOT use run_command (shell execution is disabled in non-interactive print mode and Automated Tester runs test_commands after you finish). (2) Work fast and concisely: do NOT read all 30 migrations/models one by one; read only 2-3 directly relevant files and immediately create/update the required deliverable files using write_file or edit_file with absolute paths under ${PROJECT_ROOT}."
  if ! invoke_agy_model "CODER" "$CODER_MODEL" "accept-edits" "$coder_prompt" "$coder_out"; then
    log "TASK_ABORTED: Coder model invocation failed for ${task_id}."
    return 12
  fi

  {
    printf '# Task Execution Report — %s\n\n' "$task_id"
    printf -- '- `RUN_ID`: `%s`\n' "$run_id"
    printf -- '- `CODER_MODEL`: `%s`\n' "$CODER_MODEL"
    printf -- '- `STATUS`: `IN_PROGRESS`\n\n'
    printf '## Coder Output\n```json\n'
    redact_secrets < "$coder_out"
    printf '\n```\n'
  } > "${REPORTS_DIR}/tasks/${task_id}.md"

  local test_fix_attempt=0
  while ! run_task_tests "$task_id" "$run_id" "${test_cmds[@]}"; do
    if (( test_fix_attempt >= MAX_TEST_FIX_RETRIES )); then
      log "GATE_BLOCKED: Automated tests FAILED for ${task_id}. Reviewer (${REVIEWER_MODEL}) will NOT be called."
      return 13
    fi
    test_fix_attempt=$(( test_fix_attempt + 1 ))
    log "TEST_FIX_LOOP: Automated test failed on attempt ${test_fix_attempt}/${MAX_TEST_FIX_RETRIES} for ${task_id}; invoking ${CODER_MODEL} to fix test failure..."
    local tfix_out="${REPORTS_DIR}/tasks/${task_id}-test-fix-${test_fix_attempt}.json"
    local tfix_prompt="ROLE=CODER_TEST_FIX TASK_ID=${task_id} RUN_ID=${run_id} ATTEMPT=${test_fix_attempt} — Read ${REPORTS_DIR}/tasks/${task_id}-test.md and ${ROADMAP_FILE} for ${task_id}. IMPORTANT: Do NOT use run_command; use ONLY read_file, write_file, and edit_file with absolute paths under ${PROJECT_ROOT} to fix the test failure shown in ${REPORTS_DIR}/tasks/${task_id}-test.md."
    if ! invoke_agy_model "CODER" "$CODER_MODEL" "accept-edits" "$tfix_prompt" "$tfix_out"; then
      log "GATE_BLOCKED: Coder test-fix invocation failed for ${task_id}."
      return 13
    fi
  done

  local round=1
  while (( round <= MAX_REVIEW_ROUNDS )); do
    local now_ts
    now_ts="$(date +%s)"
    if (( now_ts - task_start_ts >= TASK_TIMEOUT_SECONDS )); then
      log "BLOCKED: TASK_TIMEOUT — Task ${task_id} exceeded ${TASK_TIMEOUT_SECONDS}s."
      return 14
    fi

    local review_out="${REPORTS_DIR}/tasks/${task_id}-review-round-${round}.json"
    local review_md="${REPORTS_DIR}/tasks/${task_id}-review-round-${round}.md"
    local review_prompt="ROLE=REVIEWER TASK_ID=${task_id} RUN_ID=${run_id} ROUND=${round}/${MAX_REVIEW_ROUNDS} TEST_RESULT=PASS — Read ${ROADMAP_FILE} for ${task_id} and ${REPORTS_DIR}/tasks/${task_id}-test.md using read_file ONLY (do NOT use run_command). Verify deliverables and respond with JSON containing \"verdict\": \"PASS\" (or \"FAIL\" with findings)."

    if ! invoke_agy_model "REVIEWER" "$REVIEWER_MODEL" "plan" "$review_prompt" "$review_out"; then
      log "BLOCKED: Reviewer invocation failed on round ${round} for ${task_id}."
      return 15
    fi

    local verdict="FAIL"
    if grep -qiE '"verdict"[[:space:]]*:[[:space:]]*"PASS"|\\"verdict\\"[[:space:]]*:[[:space:]]*\\"PASS\\"|^PASS$|OVERALL_REVIEW_RESULT:[[:space:]]*PASS' "$review_out"; then
      verdict="PASS"
    elif grep -qiE '"verdict"[[:space:]]*:[[:space:]]*"BLOCKED"|\\"verdict\\"[[:space:]]*:[[:space:]]*\\"BLOCKED\\"|^BLOCKED$' "$review_out"; then
      verdict="BLOCKED"
    fi

    {
      printf '# Feature/Task Review Report — %s (Round %d/%d)\n\n' "$task_id" "$round" "$MAX_REVIEW_ROUNDS"
      printf -- '- `RUN_ID`: `%s`\n' "$run_id"
      printf -- '- `REVIEWER_MODEL`: `%s`\n' "$REVIEWER_MODEL"
      printf -- '- `REVIEW_ROUND`: `%d/%d`\n' "$round" "$MAX_REVIEW_ROUNDS"
      printf -- '- `OVERALL_REVIEW_RESULT`: `%s`\n\n' "$verdict"
      printf '## Reviewer Raw Output\n```json\n'
      redact_secrets < "$review_out"
      printf '\n```\n'
    } > "$review_md"

    if [[ "$verdict" == "PASS" ]]; then
      log "REVIEW_PASS: task=${task_id} round=${round}/${MAX_REVIEW_ROUNDS} model=${REVIEWER_MODEL}"
      if verify_done_gate "$task_id" "$run_id" "$round"; then
        local duration=$(( $(date +%s) - task_start_ts ))
        log "TASK_DONE: task=${task_id} run_id=${run_id} duration=${duration}s rounds=${round}"
        return 0
      fi
      return 16
    fi

    if [[ "$verdict" == "BLOCKED" ]]; then
      log "BLOCKED: Reviewer returned BLOCKED for ${task_id} on round ${round}."
      return 17
    fi

    log "REVIEW_FAIL: task=${task_id} round=${round}/${MAX_REVIEW_ROUNDS}"
    if (( round >= MAX_REVIEW_ROUNDS )); then
      log "BLOCKED: MAX_REVIEW_ROUNDS_EXCEEDED — Task ${task_id} failed review after ${MAX_REVIEW_ROUNDS} rounds."
      return 18
    fi

    log "FIX_LOOP: Starting fix attempt ${round} for ${task_id} with ${CODER_MODEL}..."
    local fix_out="${REPORTS_DIR}/tasks/${task_id}-fix-${round}.json"
    local fix_prompt="ROLE=CODER_FIX TASK_ID=${task_id} RUN_ID=${run_id} FIX_ROUND=${round} FINDINGS_FILE=${review_md} — Read ${review_md} and ${ROADMAP_FILE} for ${task_id}. IMPORTANT: Do NOT use run_command; use ONLY read_file, write_file, and edit_file to fix the findings."
    if ! invoke_agy_model "CODER" "$CODER_MODEL" "accept-edits" "$fix_prompt" "$fix_out"; then
      log "BLOCKED: Coder fix attempt ${round} failed for ${task_id}."
      return 19
    fi

    log "FIX_LOOP_RETEST: Re-running all mandatory tests for ${task_id} after fix ${round}..."
    if ! run_task_tests "$task_id" "$run_id" "${test_cmds[@]}"; then
      log "GATE_BLOCKED: Mandatory re-test FAILED after fix round ${round} for ${task_id}. Reviewer will NOT be called."
      return 13
    fi

    round=$(( round + 1 ))
  done

  return 18
}

# ==============================================================================
# 12. PHASE-1 TASK SPECIFICATIONS & SEQUENTIAL SESSION ENGINE
# ==============================================================================
get_demo_task_spec() {
  local task_id="$1"
  case "$task_id" in
    T-DEMO-001)
      printf 'Inventory repository structure safely without modifying source\n'
      printf 'git -C "$PROJECT_ROOT" status --short --branch\n'
      printf 'php -v\n'
      printf 'composer validate --no-check-publish --working-dir="$PROJECT_ROOT/be"\n'
      printf 'node --version && npm --version\n'
      ;;
    T-DEMO-002)
      printf 'Verify AGY CLI v1.4.7 flags and capability matrix\n'
      printf 'agy --version\n'
      printf 'agy --help >/dev/null\n'
      printf 'test -f "$FRAMEWORK_DIR/reports/agy-cli-capability-matrix.md"\n'
      ;;
    T-DEMO-003)
      printf 'Validate orchestrator syntax and workflow dry-run report\n'
      printf 'bash -n "$FRAMEWORK_DIR/run-agy.sh"\n'
      ;;
    P1-001)
      printf 'Audit repository state and create docs/phase-1/INITIAL_AUDIT.md without modifying application code\n'
      printf 'test -s "$PROJECT_ROOT/docs/phase-1/INITIAL_AUDIT.md"\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan --version\n'
      ;;
    P1-002)
      printf 'Establish backend/frontend technical architecture in docs/phase-1/ARCHITECTURE.md\n'
      printf 'test -s "$PROJECT_ROOT/docs/phase-1/ARCHITECTURE.md"\n'
      ;;
    P1-003)
      printf 'Standardize development environment, /api/v1/health endpoint, and docs/phase-1/DEVELOPMENT.md\n'
      printf 'test -s "$PROJECT_ROOT/docs/phase-1/DEVELOPMENT.md"\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test && ./vendor/bin/pint --test\n'
      printf 'cd "$PROJECT_ROOT/fe" && npx tsc --noEmit\n'
      ;;
    P1-004)
      printf 'Document 30-table database design and relationships in docs/phase-1/DATABASE_DESIGN.md and DATABASE_RELATIONSHIPS.md\n'
      printf 'test -s "$PROJECT_ROOT/docs/phase-1/DATABASE_DESIGN.md"\n'
      printf 'test -s "$PROJECT_ROOT/docs/phase-1/DATABASE_RELATIONSHIPS.md"\n'
      ;;
    P1-005)
      printf 'Verify 30-table Laravel migrations and DatabaseSchemaTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=DatabaseSchemaTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan migrate:status\n'
      ;;
    P1-006)
      printf 'Verify 30 Eloquent models and EloquentModelsRelationshipTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=EloquentModelsRelationshipTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-007)
      printf 'Implement idempotent seeders for 8 roles, permissions matrix, and demo catalog with DatabaseSeederTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=DatabaseSeederTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-008)
      printf 'Implement authentication API (/api/v1/auth/login, /me, /logout) with active status check, rate limiting, and AuthApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=AuthApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-009)
      printf 'Implement RBAC role and permission middleware, endpoints, and RbacAuthorizationTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=RbacAuthorizationTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-010)
      printf 'Implement Next.js login page, auth API client, and protected admin layout in fe/\n'
      printf 'cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build\n'
      ;;
    P1-011)
      printf 'Implement Employee CRUD API (/api/v1/employees) with unique code generation, search/filter, RBAC, and EmployeeApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=EmployeeApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-012)
      printf 'Implement User Account & Role Management API (/api/v1/users) with last-admin protection and UserManagementApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=UserManagementApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-013)
      printf 'Implement Next.js Employees and Users management UI in fe/\n'
      printf 'cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build\n'
      ;;
    P1-014)
      printf 'Implement Patient CRUD API (/api/v1/patients) with concurrency-safe patient_code, duplicate warnings, and PatientApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=PatientApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-015)
      printf 'Implement Next.js Patients list, create/edit form with duplicate warnings, and patient detail profile in fe/\n'
      printf 'cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build\n'
      ;;
    P1-016)
      printf 'Implement Service catalog CRUD API (/api/v1/services) and ServiceApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=ServiceApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-017)
      printf 'Implement ServicePackage CRUD API (/api/v1/service-packages) and ServicePackageApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=ServicePackageApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-018)
      printf 'Implement PackageService composition API (/api/v1/service-packages/{package}/services) and PackageServiceConfigApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=PackageServiceConfigApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-019)
      printf 'Implement PatientPackage assignment API (/api/v1/patients/{patient}/packages), UI for Services/Packages, and PatientPackageApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=PatientPackageApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-020)
      printf 'Implement Appointment API (/api/v1/appointments) with employee time-slot overlap prevention and AppointmentApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=AppointmentApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-021)
      printf 'Implement Next.js Appointments management UI with conflict error handling in fe/\n'
      printf 'cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build\n'
      ;;
    P1-022)
      printf 'Implement Visit creation and lifecycle management API (/api/v1/visits) and VisitApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=VisitApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-023)
      printf 'Implement concurrency-safe PatientPackage session deduction in Visit workflow and VisitPackageUsageTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=VisitPackageUsageTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-024)
      printf 'Implement MedicalRecord API (/api/v1/visits/{visit}/medical-record) with clinical RBAC protection, audit logging, and MedicalRecordApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=MedicalRecordApiTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-025)
      printf 'Implement Next.js Visits and Medical Records UI in fe/\n'
      printf 'cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build\n'
      ;;
    P1-026)
      printf 'Complete comprehensive Backend test suite across all Phase 1 modules\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test && ./vendor/bin/pint --test\n'
      ;;
    P1-027)
      printf 'Complete Frontend type-checking, linting, API integration, and production build verification\n'
      printf 'cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run lint && npm run build\n'
      ;;
    P1-028)
      printf 'Implement and verify end-to-end Phase 1 workflow tests in Phase1EndToEndWorkflowTest\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test --filter=Phase1EndToEndWorkflowTest\n'
      printf 'cd "$PROJECT_ROOT/be" && ./vendor/bin/pint --test\n'
      ;;
    P1-029)
      printf 'Complete Phase 1 technical documentation (API_DOCUMENTATION.md, DATABASE_DESIGN.md, DEVELOPMENT.md, KNOWN_ISSUES.md)\n'
      printf 'test -s "$PROJECT_ROOT/docs/phase-1/API_DOCUMENTATION.md"\n'
      printf 'test -s "$PROJECT_ROOT/docs/phase-1/DATABASE_DESIGN.md"\n'
      printf 'test -s "$PROJECT_ROOT/docs/phase-1/DEVELOPMENT.md"\n'
      printf 'test -s "$PROJECT_ROOT/docs/phase-1/KNOWN_ISSUES.md"\n'
      ;;
    P1-030)
      printf 'Run final Phase 1 quality gates and generate docs/phase-1/PHASE_1_REPORT.md for user review\n'
      printf 'test -s "$PROJECT_ROOT/docs/phase-1/PHASE_1_REPORT.md"\n'
      printf 'cd "$PROJECT_ROOT/be" && php artisan test && ./vendor/bin/pint --test\n'
      printf 'cd "$PROJECT_ROOT/fe" && npx tsc --noEmit && npm run build\n'
      ;;
    *)
      return 1
      ;;
  esac
}

is_task_done_in_progress() {
  local task_id="$1"
  if [[ -f "$PROGRESS_FILE" ]] && grep -Eq "^\|[[:space:]]*\`?${task_id}\`?[[:space:]]*\|.*\|[[:space:]]*\`?DONE\`?[[:space:]]*\|" "$PROGRESS_FILE"; then
    return 0
  fi
  return 1
}

update_progress_table() {
  local task_id="$1"
  local new_status="$2"
  local test_status="$3"
  local review_status="$4"
  if [[ ! -f "$PROGRESS_FILE" ]]; then
    return 0
  fi
  local tmp_prog="${PROGRESS_FILE}.tmp.$$"
  awk -F'|' -v OFS='|' -v tid="$task_id" -v st="$new_status" -v tst="$test_status" -v rst="$review_status" '
    $2 ~ ("^[[:space:]]*`?" tid "`?[[:space:]]*$") {
      $5 = " `" st "` "
      $6 = " `" tst "` "
      $7 = " `" rst "` "
    }
    { print }
  ' "$PROGRESS_FILE" > "$tmp_prog" && mv "$tmp_prog" "$PROGRESS_FILE"
}

auto_commit_task_on_dev() {
  local task_id="$1"
  local task_goal="$2"

  if [[ "${AUTO_COMMIT_ON_DONE:-1}" != "1" ]]; then
    return 0
  fi

  local current_branch
  current_branch="$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || true)"
  if [[ "$current_branch" != "$TARGET_COMMIT_BRANCH" ]]; then
    log "GIT_AUTO_COMMIT_SKIP: Current branch '${current_branch}' != target branch '${TARGET_COMMIT_BRANCH}' (never auto-committing onto main)."
    return 0
  fi

  git -C "$PROJECT_ROOT" add -- \
    be/ fe/ docs/ \
    qlpk-autonomous-framework/PROGRESS.md \
    qlpk-autonomous-framework/ROADMAP.md \
    qlpk-autonomous-framework/MORNING.md \
    qlpk-autonomous-framework/run-agy.sh 2>/dev/null || true

  local rpt
  for rpt in "${REPORTS_DIR}/tasks/${task_id}"*.md; do
    if [[ -f "$rpt" ]]; then
      git -C "$PROJECT_ROOT" add -- "$rpt" 2>/dev/null || true
    fi
  done

  # Defense-in-depth: ensure runtime state, logs, and .env secrets are never staged
  git -C "$PROJECT_ROOT" reset HEAD -- \
    .env be/.env fe/.env \
    qlpk-autonomous-framework/.agy-state \
    qlpk-autonomous-framework/logs 2>/dev/null || true

  if ! git -C "$PROJECT_ROOT" diff --cached --quiet; then
    local commit_msg="feat(phase-1): complete ${task_id} - ${task_goal}"
    if git -C "$PROJECT_ROOT" commit -m "$commit_msg" >/dev/null 2>&1; then
      local commit_hash
      commit_hash="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
      log "GIT_AUTO_COMMIT: task=${task_id} branch=${current_branch} commit=${commit_hash} msg='${commit_msg}'"
    else
      log "WARN: GIT_AUTO_COMMIT failed for task=${task_id} on branch=${current_branch}."
    fi
  else
    log "GIT_AUTO_COMMIT_NOOP: task=${task_id} branch=${current_branch} (no staged changes to commit)."
  fi
  return 0
}

run_session() {
  local requested_task="${1:-}"
  local tasks_to_run=()
  if [[ -n "$requested_task" ]]; then
    tasks_to_run=("$requested_task")
  else
    local all_p1_tasks=(
      "P1-001" "P1-002" "P1-003" "P1-004" "P1-005" "P1-006" "P1-007"
      "P1-008" "P1-009" "P1-010" "P1-011" "P1-012" "P1-013" "P1-014"
      "P1-015" "P1-016" "P1-017" "P1-018" "P1-019" "P1-020" "P1-021"
      "P1-022" "P1-023" "P1-024" "P1-025" "P1-026" "P1-027" "P1-028"
      "P1-029" "P1-030"
    )
    local t
    for t in "${all_p1_tasks[@]}"; do
      if is_task_done_in_progress "$t"; then
        log "SKIP_DONE_TASK: ${t} is already marked DONE in PROGRESS.md."
        continue
      fi
      tasks_to_run+=("$t")
    done
  fi

  local executed_count=0
  local consecutive_failures=0
  local total_tasks="${#tasks_to_run[@]}"
  local idx=0

  for task_id in "${tasks_to_run[@]}"; do
    idx=$(( idx + 1 ))
    if should_stop; then
      log "SESSION_STOP: Stop condition active before starting ${task_id}."
      break
    fi
    if (( executed_count >= MAX_TASKS_PER_SESSION )); then
      log "SESSION_LIMIT: Reached MAX_TASKS_PER_SESSION (${MAX_TASKS_PER_SESSION}). Stopping session safely."
      break
    fi

    local spec_lines=()
    while IFS= read -r line; do
      spec_lines+=("$line")
    done < <(get_demo_task_spec "$task_id")

    if [[ "${#spec_lines[@]}" -lt 2 ]]; then
      log "BLOCKED: Unknown or incomplete task specification for ${task_id}."
      return 21
    fi

    local goal="${spec_lines[0]}"
    local cmds=()
    local c_idx
    for (( c_idx=1; c_idx<${#spec_lines[@]}; c_idx++ )); do
      cmds+=("${spec_lines[$c_idx]}")
    done

    update_progress_table "$task_id" "IN_PROGRESS" "RUNNING" "PENDING"
    local task_rc=0
    execute_task_lifecycle "$task_id" "$goal" "${cmds[@]}" || task_rc=$?
    executed_count=$(( executed_count + 1 ))

    if [[ "$task_rc" -eq 0 ]]; then
      update_progress_table "$task_id" "DONE" "PASS" "PASS"
      auto_commit_task_on_dev "$task_id" "$goal"
      consecutive_failures=0
      if (( idx < total_tasks )); then
        cooldown_sleep "$TASK_COOLDOWN_SECONDS" "TASK_COOLDOWN_AFTER_${task_id}" || break
      fi
    else
      update_progress_table "$task_id" "BLOCKED" "FAIL" "FAIL"
      consecutive_failures=$(( consecutive_failures + 1 ))
      log "TASK_FAILED: task=${task_id} exit_code=${task_rc} consecutive_failures=${consecutive_failures}/${MAX_CONSECUTIVE_FAILURES}"
      if (( consecutive_failures >= MAX_CONSECUTIVE_FAILURES )); then
        log "BLOCKED: MAX_CONSECUTIVE_FAILURES (${MAX_CONSECUTIVE_FAILURES}) reached. Halting session."
        return "$task_rc"
      fi
      if (( idx < total_tasks )); then
        cooldown_sleep "$ERROR_COOLDOWN_SECONDS" "ERROR_COOLDOWN_AFTER_${task_id}" || break
      fi
    fi
  done

  return 0
}

# ==============================================================================
# 13. STATUS, DRY-RUN & ISOLATED SELF-TEST SUITE (AT-00 .. AT-11)
# ==============================================================================
status() {
  local cpu_load free_mem cur_branch
  cpu_load="$(get_cpu_load_per_core)"
  free_mem="$(get_free_memory_percent)"
  cur_branch="$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo unknown)"
  printf 'framework_dir=%s\n' "$FRAMEWORK_DIR"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  printf 'git_branch=%s\n' "$cur_branch"
  printf 'auto_commit_on_done=%s (target_branch=%s)\n' "$AUTO_COMMIT_ON_DONE" "$TARGET_COMMIT_BRANCH"
  printf 'roadmap=%s\n' "$([[ -f "$ROADMAP_FILE" ]] && echo present || echo missing)"
  printf 'agy_cli_verification=%s\n' "$([[ -f "${REPORTS_DIR}/agy-cli-capability-matrix.md" ]] && echo verified_v1.4.7 || echo not_verified)"
  printf 'stop_requested=%s\n' "$([[ -f "$STOP_FILE" ]] && echo yes || echo no)"
  printf 'planner_model=%s\n' "$PLANNER_MODEL"
  printf 'coder_model=%s\n' "$CODER_MODEL"
  printf 'reviewer_model=%s\n' "$REVIEWER_MODEL"
  printf 'debug_fallback_model=%s\n' "$DEBUG_FALLBACK_MODEL"
  printf 'arch_escalation_model=%s\n' "$ARCH_ESCALATION_MODEL"
  printf 'cpu_load_per_core=%s (limit=%s)\n' "$cpu_load" "$CPU_LOAD_PER_CORE_LIMIT"
  printf 'free_memory_percent=%s%% (min=%s%%)\n' "$free_mem" "$MIN_FREE_MEMORY_PERCENT"
  printf 'task_cooldown_seconds=%s\n' "$TASK_COOLDOWN_SECONDS"
  printf 'error_cooldown_seconds=%s\n' "$ERROR_COOLDOWN_SECONDS"
  printf 'quota_backoff_seconds=%s\n' "$QUOTA_BACKOFF_SECONDS"
  printf 'max_review_rounds=%s\n' "$MAX_REVIEW_ROUNDS"
}

dry_run() {
  log "DRY-RUN: Verifying paths, models, Git state and system resources without invoking external models."
  log "Paths: FRAMEWORK_DIR=${FRAMEWORK_DIR} | PROJECT_ROOT=${PROJECT_ROOT}"
  log "Models: PLANNER=${PLANNER_MODEL} | CODER=${CODER_MODEL} | REVIEWER=${REVIEWER_MODEL} | FALLBACK=${DEBUG_FALLBACK_MODEL} | ARCH=${ARCH_ESCALATION_MODEL}"
  assert_valid_model_id "$PLANNER_MODEL"
  assert_valid_model_id "$CODER_MODEL"
  assert_valid_model_id "$REVIEWER_MODEL"
  assert_valid_model_id "$DEBUG_FALLBACK_MODEL"
  assert_valid_model_id "$ARCH_ESCALATION_MODEL"
  check_system_resources || log "DRY-RUN NOTE: System resources currently exceed threshold; live run would wait up to ${RESOURCE_WAIT_SECONDS}s."
  log "DRY-RUN COMPLETED SUCCESSFULLY."
}

run_self_tests() {
  ensure_runtime_dirs
  local report_file="${REPORTS_DIR}/workflow-dry-run.md"
  local tmp_base
  tmp_base="$(mktemp -d "${TMPDIR:-/tmp}/qlpk-selftest.XXXXXX")"

  # Create an isolated mock Git repo and mock agy binary inside $tmp_base
  local mock_repo="${tmp_base}/repo"
  local mock_bin="${tmp_base}/mock-agy"
  local mock_calls="${tmp_base}/mock_calls.log"
  mkdir -p "$mock_repo"
  git -C "$mock_repo" init -q
  git -C "$mock_repo" checkout -q -b main 2>/dev/null || git -C "$mock_repo" branch -M main
  git -C "$mock_repo" config user.email "audit@qlpk.local"
  git -C "$mock_repo" config user.name "QLPK Audit Harness"
  printf 'initial\n' > "${mock_repo}/README.md"
  git -C "$mock_repo" add README.md
  git -C "$mock_repo" commit -q -m "Initial commit"

  cat > "$mock_bin" <<'MOCK_EOF'
#!/usr/bin/env bash
set -euo pipefail
CALLS_LOG="${MOCK_CALLS_LOG:-/tmp/mock_calls.log}"
STATE_COUNTER_FILE="${MOCK_COUNTER_FILE:-/tmp/mock_counter}"
SCENARIO="${MOCK_SCENARIO:-PASS_ALL}"

model=""
mode=""
prompt=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --model) model="$2"; shift 2 ;;
    --mode) mode="$2"; shift 2 ;;
    --print) prompt="$2"; shift 2 ;;
    *) shift ;;
  esac
done

count=0
if [[ -f "$STATE_COUNTER_FILE" ]]; then
  count="$(cat "$STATE_COUNTER_FILE")"
fi
count=$(( count + 1 ))
printf '%d' "$count" > "$STATE_COUNTER_FILE"
printf 'call=%d model=%s mode=%s prompt=%s\n' "$count" "$model" "$mode" "$prompt" >> "$CALLS_LOG"

case "$SCENARIO" in
  HANG_TIMEOUT)
    sleep 20
    ;;
  QUOTA_429)
    printf 'Error 429: RESOURCE_EXHAUSTED quota exceeded for model %s\n' "$model" >&2
    exit 1
    ;;
  CONTENT_FALLBACK)
    if [[ "$model" == "gemini-3.8-flash-high" ]]; then
      # Empty output triggers CONTENT_ERROR -> fallback to claude-sonnet-5-5-high
      exit 0
    fi
    printf '{"status":"ok","verdict":"PASS"}\n'
    exit 0
    ;;
  REVIEW_FAIL_ONCE_THEN_PASS)
    if [[ "$prompt" == *"ROLE=REVIEWER"* ]]; then
      if [[ "$prompt" == *"ROUND=1/"* ]]; then
        printf '{"verdict":"FAIL","findings":[{"finding_id":"FND-01","severity":"HIGH"}]}\n'
      else
        printf '{"verdict":"PASS","findings":[]}\n'
      fi
    else
      printf '{"status":"coded"}\n'
    fi
    exit 0
    ;;
  REVIEW_ALWAYS_FAIL)
    if [[ "$prompt" == *"ROLE=REVIEWER"* ]]; then
      printf '{"verdict":"FAIL","findings":[{"finding_id":"FND-99","severity":"HIGH"}]}\n'
    else
      printf '{"status":"coded"}\n'
    fi
    exit 0
    ;;
  *)
    printf '{"status":"ok","verdict":"PASS"}\n'
    exit 0
    ;;
esac
MOCK_EOF
  chmod +x "$mock_bin"

  local pass_count=0
  local fail_count=0
  local table_rows=""

  record_test() {
    local tid="$1"
    local desc="$2"
    local expected="$3"
    local actual="$4"
    local status_str="$5"
    if [[ "$status_str" == "PASS" ]]; then
      pass_count=$(( pass_count + 1 ))
    else
      fail_count=$(( fail_count + 1 ))
    fi
    table_rows+="| \`${tid}\` | ${desc} | ${expected} | ${actual} | **${status_str}** |"$'\n'
  }

  # AT-00: bash -n syntax check
  if bash -n "${FRAMEWORK_DIR}/run-agy.sh"; then
    record_test "AT-00" "Kiểm tra cú pháp \`bash -n run-agy.sh\`" "Exit code 0" "Exit code 0" "PASS"
  else
    record_test "AT-00" "Kiểm tra cú pháp \`bash -n run-agy.sh\`" "Exit code 0" "Syntax error" "FAIL"
  fi

  # Helper to run isolated orchestrator subshell
  # AT-01: Test FAIL does NOT call Reviewer
  : > "$mock_calls"
  rm -f "${tmp_base}/counter"
  local rc=0
  (
    export PROJECT_ROOT="$mock_repo"
    export STATE_DIR="${tmp_base}/state_at01"
    export LOG_DIR="${tmp_base}/logs_at01"
    export REPORTS_DIR="${tmp_base}/reports_at01"
    export AGY_BIN="$mock_bin"
    export MOCK_CALLS_LOG="$mock_calls"
    export MOCK_COUNTER_FILE="${tmp_base}/counter"
    export MOCK_SCENARIO="PASS_ALL"
    export MAX_TEST_FIX_RETRIES=0
    export OVERRIDE_CPU_LOAD_PER_CORE="0.20"
    export OVERRIDE_FREE_MEM_PERCENT="50.00"
    execute_task_lifecycle "T-AT01" "Test fail gate" "exit 1"
  ) >/dev/null 2>&1 || rc=$?
  local rev_calls
  rev_calls="$(grep -c 'model=gemini-4-argon-high' "$mock_calls" 2>/dev/null || true)"
  if [[ "$rc" -eq 13 && "$rev_calls" -eq 0 ]]; then
    record_test "AT-01" "Test FAIL chặn gọi Reviewer" "rc=13, reviewer_calls=0" "rc=${rc}, reviewer_calls=${rev_calls}" "PASS"
  else
    record_test "AT-01" "Test FAIL chặn gọi Reviewer" "rc=13, reviewer_calls=0" "rc=${rc}, reviewer_calls=${rev_calls}" "FAIL"
  fi

  # AT-02: Test PASS invokes Reviewer (gemini-4-argon-high) and completes DONE
  : > "$mock_calls"
  rm -f "${tmp_base}/counter"
  rc=0
  (
    export PROJECT_ROOT="$mock_repo"
    export STATE_DIR="${tmp_base}/state_at02"
    export LOG_DIR="${tmp_base}/logs_at02"
    export REPORTS_DIR="${tmp_base}/reports_at02"
    export AGY_BIN="$mock_bin"
    export MOCK_CALLS_LOG="$mock_calls"
    export MOCK_COUNTER_FILE="${tmp_base}/counter"
    export MOCK_SCENARIO="PASS_ALL"
    export OVERRIDE_CPU_LOAD_PER_CORE="0.20"
    export OVERRIDE_FREE_MEM_PERCENT="50.00"
    execute_task_lifecycle "T-AT02" "Test pass calls Reviewer" "true"
  ) >/dev/null 2>&1 || rc=$?
  local coder_calls
  coder_calls="$(grep -c 'model=gemini-3.8-flash-high' "$mock_calls" 2>/dev/null || true)"
  rev_calls="$(grep -c 'model=gemini-4-argon-high' "$mock_calls" 2>/dev/null || true)"
  if [[ "$rc" -eq 0 && "$coder_calls" -eq 1 && "$rev_calls" -eq 1 ]]; then
    record_test "AT-02" "Test PASS gọi đúng Reviewer \`gemini-4-argon-high\`" "rc=0, coder=1, reviewer=1" "rc=${rc}, coder=${coder_calls}, reviewer=${rev_calls}" "PASS"
  else
    record_test "AT-02" "Test PASS gọi đúng Reviewer \`gemini-4-argon-high\`" "rc=0, coder=1, reviewer=1" "rc=${rc}, coder=${coder_calls}, reviewer=${rev_calls}" "FAIL"
  fi

  # AT-03: Reviewer FAIL round 1 -> Fix -> Re-test -> Reviewer PASS round 2 -> DONE
  : > "$mock_calls"
  rm -f "${tmp_base}/counter"
  rc=0
  (
    export PROJECT_ROOT="$mock_repo"
    export STATE_DIR="${tmp_base}/state_at03"
    export LOG_DIR="${tmp_base}/logs_at03"
    export REPORTS_DIR="${tmp_base}/reports_at03"
    export AGY_BIN="$mock_bin"
    export MOCK_CALLS_LOG="$mock_calls"
    export MOCK_COUNTER_FILE="${tmp_base}/counter"
    export MOCK_SCENARIO="REVIEW_FAIL_ONCE_THEN_PASS"
    export OVERRIDE_CPU_LOAD_PER_CORE="0.20"
    export OVERRIDE_FREE_MEM_PERCENT="50.00"
    execute_task_lifecycle "T-AT03" "Fix loop round 1 fail then round 2 pass" "true"
  ) >/dev/null 2>&1 || rc=$?
  coder_calls="$(grep -c 'model=gemini-3.8-flash-high' "$mock_calls" 2>/dev/null || true)"
  rev_calls="$(grep -c 'model=gemini-4-argon-high' "$mock_calls" 2>/dev/null || true)"
  if [[ "$rc" -eq 0 && "$coder_calls" -eq 2 && "$rev_calls" -eq 2 ]]; then
    record_test "AT-03" "Reviewer FAIL kích hoạt Fix Loop -> Retest -> Re-review PASS" "rc=0, coder=2, reviewer=2" "rc=${rc}, coder=${coder_calls}, reviewer=${rev_calls}" "PASS"
  else
    record_test "AT-03" "Reviewer FAIL kích hoạt Fix Loop -> Retest -> Re-review PASS" "rc=0, coder=2, reviewer=2" "rc=${rc}, coder=${coder_calls}, reviewer=${rev_calls}" "FAIL"
  fi

  # AT-04: Reviewer FAIL > 3 rounds -> BLOCKED (rc=18)
  : > "$mock_calls"
  rm -f "${tmp_base}/counter"
  rc=0
  (
    export PROJECT_ROOT="$mock_repo"
    export STATE_DIR="${tmp_base}/state_at04"
    export LOG_DIR="${tmp_base}/logs_at04"
    export REPORTS_DIR="${tmp_base}/reports_at04"
    export AGY_BIN="$mock_bin"
    export MOCK_CALLS_LOG="$mock_calls"
    export MOCK_COUNTER_FILE="${tmp_base}/counter"
    export MOCK_SCENARIO="REVIEW_ALWAYS_FAIL"
    export MAX_REVIEW_ROUNDS=3
    export OVERRIDE_CPU_LOAD_PER_CORE="0.20"
    export OVERRIDE_FREE_MEM_PERCENT="50.00"
    execute_task_lifecycle "T-AT04" "Review fails 3 times -> BLOCKED" "true"
  ) >/dev/null 2>&1 || rc=$?
  rev_calls="$(grep -c 'model=gemini-4-argon-high' "$mock_calls" 2>/dev/null || true)"
  if [[ "$rc" -eq 18 && "$rev_calls" -eq 3 ]]; then
    record_test "AT-04" "Review FAIL 3 vòng liên tiếp chuyển \`BLOCKED\`" "rc=18, reviewer_calls=3" "rc=${rc}, reviewer_calls=${rev_calls}" "PASS"
  else
    record_test "AT-04" "Review FAIL 3 vòng liên tiếp chuyển \`BLOCKED\`" "rc=18, reviewer_calls=3" "rc=${rc}, reviewer_calls=${rev_calls}" "FAIL"
  fi

  # AT-05: CPU/RAM overload waits and blocks without calling model
  : > "$mock_calls"
  rm -f "${tmp_base}/counter"
  rc=0
  (
    export PROJECT_ROOT="$mock_repo"
    export STATE_DIR="${tmp_base}/state_at05"
    export LOG_DIR="${tmp_base}/logs_at05"
    export REPORTS_DIR="${tmp_base}/reports_at05"
    export AGY_BIN="$mock_bin"
    export MOCK_CALLS_LOG="$mock_calls"
    export OVERRIDE_CPU_LOAD_PER_CORE="2.50"
    export CPU_LOAD_PER_CORE_LIMIT="0.85"
    export OVERRIDE_FREE_MEM_PERCENT="5.00"
    export MIN_FREE_MEMORY_PERCENT="15"
    export RESOURCE_WAIT_SECONDS="2"
    export RESOURCE_POLL_INTERVAL_SECONDS="1"
    execute_task_lifecycle "T-AT05" "Resource overload gate" "true"
  ) >/dev/null 2>&1 || rc=$?
  local total_calls
  total_calls="$(wc -l < "$mock_calls" | tr -d ' ')"
  if [[ "$rc" -eq 11 && "$total_calls" -eq 0 ]]; then
    record_test "AT-05" "CPU/RAM vượt ngưỡng chờ có giới hạn rồi chuyển \`BLOCKED\`" "rc=11, model_calls=0" "rc=${rc}, model_calls=${total_calls}" "PASS"
  else
    record_test "AT-05" "CPU/RAM vượt ngưỡng chờ có giới hạn rồi chuyển \`BLOCKED\`" "rc=11, model_calls=0" "rc=${rc}, model_calls=${total_calls}" "FAIL"
  fi

  # AT-06: Cooldown between two sequential tasks
  local t0 t1 elapsed_cd
  t0="$(date +%s)"
  (
    export STATE_DIR="${tmp_base}/state_at06"
    export LOG_DIR="${tmp_base}/logs_at06"
    export REPORTS_DIR="${tmp_base}/reports_at06"
    cooldown_sleep 2 "TEST_BETWEEN_TASKS"
  ) >/dev/null 2>&1
  t1="$(date +%s)"
  elapsed_cd=$(( t1 - t0 ))
  if (( elapsed_cd >= 2 )); then
    record_test "AT-06" "Nghỉ \`TASK_COOLDOWN_SECONDS\` giữa hai task" "elapsed >= 2s" "elapsed=${elapsed_cd}s" "PASS"
  else
    record_test "AT-06" "Nghỉ \`TASK_COOLDOWN_SECONDS\` giữa hai task" "elapsed >= 2s" "elapsed=${elapsed_cd}s" "FAIL"
  fi

  # AT-07: Timeout kills hung process and releases lock cleanly
  rc=0
  (
    export PROJECT_ROOT="$mock_repo"
    export STATE_DIR="${tmp_base}/state_at07"
    export LOG_DIR="${tmp_base}/logs_at07"
    export REPORTS_DIR="${tmp_base}/reports_at07"
    export LOCK_DIR="${tmp_base}/state_at07/run.lock"
    export AGY_BIN="$mock_bin"
    export MOCK_CALLS_LOG="$mock_calls"
    export MOCK_SCENARIO="HANG_TIMEOUT"
    export MODEL_TIMEOUT_SECONDS="2"
    export MAX_MODEL_RETRIES="0"
    export OVERRIDE_CPU_LOAD_PER_CORE="0.20"
    export OVERRIDE_FREE_MEM_PERCENT="50.00"
    acquire_lock
    execute_task_lifecycle "T-AT07" "Hung model timeout test" "true"
  ) >/dev/null 2>&1 || rc=$?
  local lock_Gone=0
  [[ ! -d "${tmp_base}/state_at07/run.lock" ]] && lock_Gone=1
  if [[ "$rc" -ne 0 && "$lock_Gone" -eq 1 ]]; then
    record_test "AT-07" "Timeout cắt tiến trình treo và giải phóng \`run.lock\`" "rc!=0, lock_removed=1" "rc=${rc}, lock_removed=${lock_Gone}" "PASS"
  else
    record_test "AT-07" "Timeout cắt tiến trình treo và giải phóng \`run.lock\`" "rc!=0, lock_removed=1" "rc=${rc}, lock_removed=${lock_Gone}" "FAIL"
  fi

  # AT-08: Quota exhaustion (429) backs off and preserves uncommitted user file changes
  local tracked_file="${mock_repo}/README.md"
  rc=0
  (
    export PROJECT_ROOT="$mock_repo"
    export STATE_DIR="${tmp_base}/state_at08"
    export LOG_DIR="${tmp_base}/logs_at08"
    export REPORTS_DIR="${tmp_base}/reports_at08"
    export AGY_BIN="$mock_bin"
    export MOCK_CALLS_LOG="$mock_calls"
    export MOCK_SCENARIO="QUOTA_429"
    export QUOTA_BACKOFF_SECONDS="1"
    export MAX_MODEL_RETRIES="1"
    # Simulate in-progress task modification after initial clean check
    printf 'important-uncommitted-work\n' > "$tracked_file"
    invoke_agy_model "CODER" "$CODER_MODEL" "accept-edits" "test quota" "${tmp_base}/at08.out"
  ) >/dev/null 2>&1 || rc=$?
  local file_content
  file_content="$(cat "$tracked_file")"
  # Restore mock_repo README for subsequent tests
  printf 'initial\n' > "$tracked_file"
  if [[ "$rc" -eq 75 && "$file_content" == "important-uncommitted-work" ]]; then
    record_test "AT-08" "Hết quota (\`429\`) chờ \`QUOTA_BACKOFF_SECONDS\` & giữ nguyên file chưa commit" "rc=75, file preserved" "rc=${rc}, content='${file_content}'" "PASS"
  else
    record_test "AT-08" "Hết quota (\`429\`) chờ \`QUOTA_BACKOFF_SECONDS\` & giữ nguyên file chưa commit" "rc=75, file preserved" "rc=${rc}, content='${file_content}'" "FAIL"
  fi

  # AT-09: Dirty working tree causes immediate safe stop before any model call
  : > "$mock_calls"
  printf 'untracked-user-work\n' > "${mock_repo}/untracked_user_file.txt"
  rc=0
  (
    export PROJECT_ROOT="$mock_repo"
    export STATE_DIR="${tmp_base}/state_at09"
    export LOG_DIR="${tmp_base}/logs_at09"
    export REPORTS_DIR="${tmp_base}/reports_at09"
    export AGY_BIN="$mock_bin"
    export MOCK_CALLS_LOG="$mock_calls"
    export ALLOW_UNTRACKED_REGEX=""
    export OVERRIDE_CPU_LOAD_PER_CORE="0.20"
    export OVERRIDE_FREE_MEM_PERCENT="50.00"
    execute_task_lifecycle "T-AT09" "Dirty git tree check" "true"
  ) >/dev/null 2>&1 || rc=$?
  local untracked_still_there=0
  [[ -f "${mock_repo}/untracked_user_file.txt" ]] && untracked_still_there=1
  rm -f "${mock_repo}/untracked_user_file.txt"
  total_calls="$(wc -l < "$mock_calls" | tr -d ' ')"
  if [[ "$rc" -eq 10 && "$untracked_still_there" -eq 1 && "$total_calls" -eq 0 ]]; then
    record_test "AT-09" "Working tree bẩn khiến framework dừng an toàn & bảo toàn file" "rc=10, file_kept=1, calls=0" "rc=${rc}, file_kept=${untracked_still_there}, calls=${total_calls}" "PASS"
  else
    record_test "AT-09" "Working tree bẩn khiến framework dừng an toàn & bảo toàn file" "rc=10, file_kept=1, calls=0" "rc=${rc}, file_kept=${untracked_still_there}, calls=${total_calls}" "FAIL"
  fi

  # AT-10: Model fallback is explicitly logged when enabled
  : > "$mock_calls"
  rc=0
  (
    export PROJECT_ROOT="$mock_repo"
    export STATE_DIR="${tmp_base}/state_at10"
    export LOG_DIR="${tmp_base}/logs_at10"
    export REPORTS_DIR="${tmp_base}/reports_at10"
    export AGY_BIN="$mock_bin"
    export MOCK_CALLS_LOG="$mock_calls"
    export MOCK_SCENARIO="CONTENT_FALLBACK"
    export ALLOW_FALLBACK="1"
    export MAX_MODEL_RETRIES="0"
    invoke_agy_model "CODER" "$CODER_MODEL" "accept-edits" "test fallback" "${tmp_base}/at10.out"
  ) >/dev/null 2>&1 || rc=$?
  local fb_logged=0
  if grep -Fq "FALLBACK_TRIGGERED: role=CODER from=gemini-3.8-flash-high to=claude-sonnet-5-5-high" "${tmp_base}/logs_at10/orchestrator.log" 2>/dev/null; then
    fb_logged=1
  fi
  if [[ "$rc" -eq 0 && "$fb_logged" -eq 1 ]]; then
    record_test "AT-10" "Model fallback ghi log tường minh (\`FALLBACK_TRIGGERED\`)" "rc=0, fallback_logged=1" "rc=${rc}, fallback_logged=${fb_logged}" "PASS"
  else
    record_test "AT-10" "Model fallback ghi log tường minh (\`FALLBACK_TRIGGERED\`)" "rc=0, fallback_logged=1" "rc=${rc}, fallback_logged=${fb_logged}" "FAIL"
  fi

  # AT-11: Fake or stale DONE report (mismatched RUN_ID) is rejected by verify_done_gate
  rc=0
  (
    export STATE_DIR="${tmp_base}/state_at11"
    export LOG_DIR="${tmp_base}/logs_at11"
    export REPORTS_DIR="${tmp_base}/reports_at11"
    mkdir -p "${REPORTS_DIR}/tasks"
    cat > "${REPORTS_DIR}/tasks/T-AT11-test.md" <<'EOF'
- `RUN_ID`: `run-OLD-STALE-111`
- `OVERALL_TEST_RESULT`: `PASS`
EOF
    cat > "${REPORTS_DIR}/tasks/T-AT11-review-round-1.md" <<'EOF'
- `RUN_ID`: `run-OLD-STALE-111`
- `OVERALL_REVIEW_RESULT`: `PASS`
EOF
    verify_done_gate "T-AT11" "run-CURRENT-NEW-222" "1"
  ) >/dev/null 2>&1 || rc=$?
  if [[ "$rc" -ne 0 ]]; then
    record_test "AT-11" "Chống trạng thái \`DONE\` giả / báo cáo từ \`RUN_ID\` cũ" "rc!=0 (Rejected)" "rc=${rc} (Rejected)" "PASS"
  else
    record_test "AT-11" "Chống trạng thái \`DONE\` giả / báo cáo từ \`RUN_ID\` cũ" "rc!=0 (Rejected)" "rc=0 (Accepted)" "FAIL"
  fi

  rm -rf -- "$tmp_base"

  {
    printf '# Workflow Isolated Self-Test Report (AT-00 .. AT-11)\n\n'
    printf -- '- **Executed at:** `%s`\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')"
    printf -- '- **Total Tests:** `%d`\n' "$(( pass_count + fail_count ))"
    printf -- '- **Passed:** `%d`\n' "$pass_count"
    printf -- '- **Failed:** `%d`\n' "$fail_count"
    printf -- '- **Overall Result:** `%s`\n\n' "$([[ "$fail_count" -eq 0 ]] && echo PASS || echo FAIL)"
    printf '| Test ID | Scenario | Expected | Actual | Result |\n|---|---|---|---|---|\n'
    printf '%s' "$table_rows"
  } > "$report_file"

  log "SELF_TEST_SUMMARY: passed=${pass_count} failed=${fail_count} report=${report_file}"
  [[ "$fail_count" -eq 0 ]]
}

request_stop() {
  ensure_runtime_dirs
  : > "$STOP_FILE"
  log "STOP requested at ${STOP_FILE}."
}

clear_stop() {
  ensure_runtime_dirs
  rm -f -- "$STOP_FILE"
  log "STOP flag cleared."
}

main() {
  case "${1:-}" in
    status) status ;;
    check-resources) check_system_resources ;;
    dry-run) acquire_lock; dry_run ;;
    self-test) acquire_lock; run_self_tests ;;
    stop) request_stop ;;
    clear-stop) clear_stop ;;
    run)
      acquire_lock
      shift
      run_session "${1:-}"
      ;;
    -h|--help|help|'') usage ;;
    *) usage; exit 2 ;;
  esac
}

main "$@"
