# Account storage isolation

The old hooks copied account data to shared localStorage keys and automatically
uploaded those values on sign-in. They also keyed synchronization only on auth status,
so switching between authenticated accounts could keep the former account's data.

The new stores are keyed by actual account ID and resource. Account data stays in
memory, comes from its account API, and is cleared when its last subscriber leaves.
Guest data uses new guest-only keys. Loading authentication exposes neither account nor
guest data. Late loads/writes cannot repopulate a store after cleanup, and queued writes
stop on cleanup. Multiple cards share a store, eliminating per-card migration requests
and inconsistent save buttons. Writes are serialized; failed optimistic edits roll back
with a visible error and retry control. Requests are aborted on cleanup, but an already
accepted server write cannot be undone merely by signing out.

Automatic guest-to-account import is removed. It cannot safely distinguish guest data
from another person's previously cached account data. Legacy keys are left untouched
but no longer read, displayed or uploaded. Existing PostgreSQL watchlists/preferences
remain intact. Previously guest-only saved data in the legacy keys will no longer show;
an explicit user-reviewed import feature can be added separately. Do not silently
restore migration from the mixed legacy keys.

No database migration is needed. Tests cover account changes, late responses, effect
replay, shared subscriptions, write order, rollback and retry. Cross-tab live syncing
and server-side revision conflict resolution remain separate work.
