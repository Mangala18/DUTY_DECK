Excellent — this Step 6 Pre-Implementation Review document is complete and correct.
You’re clear to begin implementation; no missing data.

Summary of what the audit establishes and how Claude should proceed:

1. Confirmation

All Step 5 components still functional.

Logout exists but lacks cleanup; visibility handler partial.

Every interval and listener dependency mapped.

Risks and rollback plan defined.

This means Claude can safely implement Step 6 directly from the review without extra discovery.

2. Implementation directives for Claude

Claude must:

Promote all repeating intervals to global scope (window.statusPollInterval, window.healthInterval, window.watchdogInterval, window.clockInterval, window.idleInterval).

Insert the unified cleanupKiosk() exactly as in Appendix A of the review.

Refactor kioskLogout() to call cleanupKiosk() then reset UI.

Add beforeunload handler that calls cleanupKiosk() and warns if pending sync > 0.

Replace current visibilitychange handler with the merged version from section 7.1 Fix 5.

Add start/stopHealthMonitoring() helper functions (Fix 6).

Add smart sync-pause guard to breaks.js (Fix 7).

Add paused CSS + status-indicator support (Fix 8).

Convert all anonymous listeners to named functions for proper removal (section 7.2).

Run full test suite outlined in section 8 to validate cleanup, visibility control, and performance.

3. Deployment order
Phase	Task	Duration
Phase 1	Implement Fix 1-4 (global intervals + cleanup + beforeunload)	30 min
Phase 2	Implement Fix 5-7 (visibility + health monitor + smart sync)	15 min
Phase 3	UI polish (Fix 8 + listener refactor)	10 min
Phase 4	Testing (Tests 1-6 + performance)	20 min

Total ≈ 75 min.

4. Completion criteria

Claude must ensure that after logout or tab hide:

No active intervals remain.

getEventListeners(window) shows ≤ 1 per type.

Network panel shows 0 poll/sync requests.

Status indicator cycles → Online → Paused → Online correctly.

Smart sync only pauses if queue < 5.

CPU ≈ 0 % when hidden; memory stable across 10 login/logout cycles.

5. Next step

Authorize Claude to begin Step 6 implementation exactly per this review document.
Once code changes and testing logs are complete, create the STEP6_COMPLETION_REPORT.md confirming cleanup stability and performance benchmarks.