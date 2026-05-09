Looking at your schema and API, here's a thorough integration plan. The core challenge is that your RLS denies all public table access, so you can't use `postgres_changes` for public users — you'll need a hybrid approach.

---

## Architecture Overview

| Actor | Realtime Method | Channel |
|---|---|---|
| **Admin dashboard** | `postgres_changes` (authenticated) | `queue` table |
| **Public user** | Broadcast (server-pushed) | `queue-status:<queue_number>` |
| **Cross-tab dedup** | Presence | `admin-presence` |

---

## Phase 1 — Database Changes

### 1.1 Enable Realtime on the queue table

```sql
-- Add queue to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE queue;

-- DO NOT add used_tokens — no need to stream token data
```

### 1.2 RLS policy for admin reads via Realtime

`postgres_changes` subscriptions are filtered by RLS. Your current policy blocks everything, so add a read-only policy for authenticated (admin) users:

```sql
-- Allows authenticated users (your admin JWTs) to SELECT via Realtime
CREATE POLICY "admin can read queue"
  ON queue FOR SELECT
  TO authenticated
  USING (true);
```

This does NOT expose anything publicly — `TO authenticated` means only valid JWTs pass through.

### 1.3 Supabase Function for broadcasting (server-to-client)

For public users, the server will call the Realtime REST broadcast endpoint directly. No extra SQL needed, but you'll use the `service_role` key for this — which you already have in `adminClient()`.

---

## Phase 2 — Server-side Changes

### 2.1 New `_realtime.js` helper

```js
// _realtime.js
const { createClient } = require("@supabase/supabase-js");

let _rt;
function realtimeClient() {
  if (!_rt) {
    _rt = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY, // service_role bypasses RLS for broadcast
      { realtime: { params: { eventsPerSecond: 10 } } }
    );
  }
  return _rt;
}

/**
 * Broadcast a queue-status update to a specific user's channel.
 * Channel name: queue-status:<queue_number>
 */
async function broadcastStatusUpdate(queueNumber, payload) {
  const client = realtimeClient();
  await client
    .channel(`queue-status:${queueNumber}`)
    .send({
      type: "broadcast",
      event: "status_update",
      payload,
    });
}

/**
 * Broadcast a full queue change event to the admin channel.
 * Admins already get postgres_changes, but this is useful for
 * cross-server fan-out (e.g. multiple Vercel instances).
 */
async function broadcastAdminEvent(event, payload) {
  const client = realtimeClient();
  await client
    .channel("admin-queue")
    .send({
      type: "broadcast",
      event,    // "join" | "call" | "serve" | "noshow" | "leave" | "clear"
      payload,
    });
}

module.exports = { broadcastStatusUpdate, broadcastAdminEvent };
```

### 2.2 Augment `_queue.js` — fire broadcasts after mutations

Add a `broadcast` param to `updateStatus` so callers can opt in:

```js
// _queue.js (additions at top)
const { broadcastStatusUpdate } = require("./_realtime");

async function updateStatus(queueNumber, status, notifiedAt = null, broadcastPayload = null) {
  const updates = { status };
  if (notifiedAt) updates.notified_at = notifiedAt;

  const { error } = await db()
    .from("queue")
    .update(updates)
    .eq("queue_number", queueNumber);
  if (error) throw error;

  // Push real-time update to the specific user's channel
  if (broadcastPayload) {
    await broadcastStatusUpdate(queueNumber, {
      status,
      notifiedAt: notifiedAt ? new Date(notifiedAt).toISOString() : null,
      ...broadcastPayload,
    }).catch(err => console.error("[Realtime] broadcastStatusUpdate failed:", err));
  }
}
```

### 2.3 Augment `queue.js` — add broadcasts to each PATCH/POST action

**POST (join):**
```js
// After insertEntry succeeds:
const { broadcastAdminEvent } = require("./_realtime");

await broadcastAdminEvent("join", {
  id:          row.queue_number,
  name:        row.name,
  theme:       row.theme,
  position:    active.length + 1,
  status:      "waiting",
  joinedAt:    row.joined_at,
});
```

**PATCH — call:**
```js
// After updateStatus for "call" action:
await updateStatus(next.queue_number, "notified", Date.now(), {
  // broadcast to user's personal channel
  message: "You are being called! Please proceed.",
});
await broadcastAdminEvent("call", {
  id:    next.queue_number,
  name:  next.name,
  theme,
});
```

**PATCH — serve/noshow:**
```js
await updateStatus(id, newStatus, null, {
  message: action === "serve" ? "Thank you, you have been served." : "Marked as no-show.",
});
// If promoting next person in theme:
if (nextWaiting) {
  await updateStatus(nextWaiting.queue_number, "notified", Date.now(), {
    message: "You are being called! Please proceed.",
  });
}
await broadcastAdminEvent(action, {
  id:    entry.queue_number,
  name:  entry.name,
  theme: entry.theme,
});
```

**PATCH — leave:**
```js
await updateStatus(id, "served", null, {
  message: "You have left the queue.",
});
await broadcastAdminEvent("leave", { id, theme: entry.theme });
```

**DELETE (clear):**
```js
await broadcastAdminEvent("clear", { theme: theme || "all" });
```

---

## Phase 3 — Client-side Integration

### 3.1 Public user — personal status channel

The user gets their `queue_number` from the POST response. Subscribe immediately:

```js
import { createClient } from "@supabase/supabase-js";

// Public anon key — safe to expose
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function subscribeToMyStatus(queueNumber, onUpdate) {
  const channel = supabase
    .channel(`queue-status:${queueNumber}`)
    .on("broadcast", { event: "status_update" }, ({ payload }) => {
      onUpdate(payload);
      // e.g. payload = { status: "notified", notifiedAt: "...", message: "You are being called!" }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") console.log("Listening for queue updates...");
    });

  return () => supabase.removeChannel(channel); // cleanup
}
```

> **Why no position updates?** Broadcasting every user's position on every join/leave is O(n) messages. Instead, only push **status transitions** (waiting→notified, notified→served). For position, keep a lightweight poll every 30s as a fallback — or see Phase 4.

### 3.2 Admin dashboard — two layers

**Layer 1: `postgres_changes`** (low latency, structural changes)

```js
const adminSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${adminJWT}` } }
});

function subscribeAdminQueueChanges(onInsert, onUpdate) {
  return adminSupabase
    .channel("admin-postgres-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "queue" },
      ({ new: row }) => onInsert(row)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "queue" },
      ({ new: row, old: prev }) => onUpdate(row, prev)
    )
    .subscribe();
}
```

**Layer 2: Broadcast channel** (for semantic events — nice for UI toasts)

```js
function subscribeAdminBroadcast(onEvent) {
  return supabase
    .channel("admin-queue")
    .on("broadcast", { event: "*" }, ({ event, payload }) => {
      onEvent(event, payload);
      // event = "join" | "call" | "serve" | "noshow" | "leave" | "clear"
    })
    .subscribe();
}
```

### 3.3 Admin Presence — prevent double-calling

If multiple admin tabs/devices are open, Presence prevents them from calling the same person twice:

```js
function trackAdminPresence(adminId) {
  const channel = supabase.channel("admin-presence", {
    config: { presence: { key: adminId } }
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const activeAdmins = Object.keys(state).length;
      console.log(`${activeAdmins} admin tab(s) active`);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ adminId, joinedAt: Date.now() });
      }
    });

  return channel;
}
```

---

## Phase 4 — Position Updates for Public Users (Optional but Recommended)

Since broadcasting position to every user on every queue change is expensive, use a **shared theme channel** with client-side filtering:

```js
// Server — broadcast to theme channel on any queue mutation
async function broadcastThemeSnapshot(theme, activeQueue) {
  await realtimeClient()
    .channel(`queue-theme:${theme}`)
    .send({
      type: "broadcast",
      event: "queue_snapshot",
      payload: {
        total: activeQueue.length,
        // Only send queue_numbers + statuses, not names (privacy)
        order: activeQueue.map(e => e.queue_number),
      },
    });
}

// Client — user derives their own position from the snapshot
supabase
  .channel(`queue-theme:${myTheme}`)
  .on("broadcast", { event: "queue_snapshot" }, ({ payload }) => {
    const myPosition = payload.order.indexOf(myQueueNumber) + 1;
    const peopleAhead = myPosition - 1;
    updateUI({ position: myPosition, peopleAhead, total: payload.total });
  })
  .subscribe();
```

This is O(1) messages per queue change regardless of queue size.

---

## Phase 5 — Connection Resilience

Supabase Realtime connections drop (network changes, serverless cold starts, etc). Always have a fallback:

```js
function createResilientSubscription(subscribeFn, pollFn, pollIntervalMs = 30_000) {
  let channel = subscribeFn();
  let pollTimer;

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      clearInterval(pollTimer); // realtime is live, stop polling
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      // Fall back to polling until reconnected
      pollTimer = setInterval(pollFn, pollIntervalMs);
    }
  });

  return () => {
    supabase.removeChannel(channel);
    clearInterval(pollTimer);
  };
}
```

---

## Summary of What Changes

| File | Change |
|---|---|
| `_realtime.js` | **New** — `broadcastStatusUpdate`, `broadcastAdminEvent` |
| `_queue.js` | `updateStatus` accepts optional `broadcastPayload` |
| `queue.js` | Every mutating action fires a broadcast after DB write |
| **SQL** | Add `queue` to publication, add admin SELECT policy |
| **Client** | Public: personal channel; Admin: `postgres_changes` + broadcast |

The key principle throughout: **the server is the single source of truth** — clients never trust their own Realtime events alone and always reconcile with a GET on reconnect. 