# Escape Room Queue — API Reference

Base URL: `https://your-vercel-app.vercel.app`

All endpoints return JSON. All endpoints accept cross-origin requests (CORS enabled).

---

## Setup: Locking CORS to your GitHub Pages domain

In your Vercel project dashboard → Settings → Environment Variables, add:

| Key | Value |
|-----|-------|
| `ALLOWED_ORIGIN` | `https://yourusername.github.io` |

Leave it unset (or set to `*`) during local development.

---

## Endpoints

### 1. `GET /api/token`
Generate a one-time QR token. Encode this into a QR code on your main webapp.
The token encodes the current timestamp as base64 and is valid for **2 minutes**.

**Request**
```
GET /api/token
```

**Response `200`**
```json
{
  "token": "MTc0NTg0NjQwMDAwMA==",
  "generatedAt": 1745846400000,
  "expiresAt":   1745846520000
}
```

**Usage — generate a QR code URL:**
```
https://your-vercel-app.vercel.app/?t=<token>
```
Pass this full URL to your QR code library. When the user scans it, your webapp receives `?t=<token>` and proceeds to the join flow.

**Validating the token client-side (optional pre-check before calling `/api/join`):**
```js
const tokenTime = parseInt(atob(token), 10);
const isValid = (Date.now() - tokenTime) < 2 * 60 * 1000;
```

---

### 2. `POST /api/join`
Add a user to the queue. Consumes the token — it cannot be reused.

**Request**
```
POST /api/join
Content-Type: application/json
```
```json
{
  "token": "MTc0NTg0NjQwMDAwMA==",
  "name": "Alice"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | ✅ | Token from `/api/token` |
| `name` | string | ✅ | User's display name, max 50 chars |

**Response `200` — joined successfully**
```json
{
  "id": "uuid-assigned-to-this-user",
  "label": "Alice",
  "position": 3,
  "total": 3,
  "status": "waiting",
  "notifiedAt": null
}
```
If the user joins an empty queue, `status` will be `"notified"` and `notifiedAt` will be a timestamp immediately.

| Field | Description |
|-------|-------------|
| `id` | Save this — used for all subsequent calls for this user |
| `label` | The name they entered |
| `position` | Their place in queue (1 = next up) |
| `total` | Total number of people in queue |
| `status` | `"waiting"` or `"notified"` |
| `notifiedAt` | Timestamp (ms) when they were notified, or `null` |

**Error responses**

| Status | `error` value | Meaning |
|--------|--------------|---------|
| `400` | `"Missing token"` | No token sent |
| `400` | `"Missing name"` | No name sent |
| `400` | `"Invalid token"` | Token could not be decoded |
| `400` | `"Token expired"` | Token is older than 2 minutes |
| `400` | `"This QR code has already been used to join."` | Token already consumed |

---

### 3. `GET /api/status?id=<id>`
Poll the user's current queue position and status. Call this every 3 seconds after joining.

**Request**
```
GET /api/status?id=uuid-assigned-to-this-user
```

**Response `200`**
```json
{
  "id": "uuid-assigned-to-this-user",
  "label": "Alice",
  "position": 1,
  "total": 4,
  "status": "notified",
  "notifiedAt": 1745846500000,
  "timeRemainingMs": 547000,
  "expired": false
}
```

| Field | Description |
|-------|-------------|
| `position` | Current position in queue. 1 = they are next |
| `total` | Total people in queue right now |
| `status` | `"waiting"` or `"notified"` |
| `notifiedAt` | Timestamp (ms) when they were called, or `null` |
| `timeRemainingMs` | Ms left in their 10-min window, or `null` if not yet notified |
| `expired` | `true` if their 10-min window has lapsed |

**Polling logic:**
```js
// Run every 3 seconds after joining
async function poll(id) {
  const res = await fetch(`https://your-vercel-app.vercel.app/api/status?id=${id}&t=${Date.now()}`, {
    cache: "no-store"
  });

  if (res.status === 404) {
    // User no longer in queue (removed by admin or left)
    return;
  }

  const data = await res.json();

  if (data.status === "notified" && !data.expired) {
    // 🔔 Show "It's your turn!" UI — start 10-min countdown using data.timeRemainingMs
  }

  if (data.expired) {
    // ⏰ Their window lapsed — show "time's up" UI
  }
}
```

**Error responses**

| Status | Meaning |
|--------|---------|
| `400` | Missing `id` query param |
| `404` | User not found in queue (left, removed, or never joined) |

---

### 4. `POST /api/next`
**Admin only.** Dismiss the current first person and notify the next in line.

**Request**
```
POST /api/next
```
No body required.

**Response `200`**
```json
{
  "served": "Alice",
  "next": "Bob",
  "remaining": 2
}
```
If queue was empty:
```json
{
  "message": "Queue empty",
  "served": null,
  "next": null,
  "remaining": 0
}
```

| Field | Description |
|-------|-------------|
| `served` | Name of the person just dismissed |
| `next` | Name of the person now being notified, or `null` |
| `remaining` | People still in queue after this action |

---

### 5. `GET /api/queue`
**Admin only.** Get the full current queue state.

**Request**
```
GET /api/queue
```

**Response `200`**
```json
{
  "queue": [
    {
      "id": "uuid",
      "label": "Alice",
      "position": 1,
      "status": "notified",
      "joinedAt": 1745846400000,
      "notifiedAt": 1745846500000,
      "timeRemainingMs": 547000,
      "expired": false
    },
    {
      "id": "uuid",
      "label": "Bob",
      "position": 2,
      "status": "waiting",
      "joinedAt": 1745846460000,
      "notifiedAt": null,
      "timeRemainingMs": null,
      "expired": false
    }
  ],
  "total": 2,
  "served": 5
}
```

---

### 6. `POST /api/leave?id=<id>`
Remove a user from the queue voluntarily. If they were first, the next person is auto-notified.

**Request**
```
POST /api/leave?id=uuid-assigned-to-this-user
```

**Response `200`**
```json
{ "ok": true }
```

**Error responses**

| Status | Meaning |
|--------|---------|
| `400` | Missing `id` |
| `404` | User not in queue |

---

## Full user flow (what to implement on your webapp)

```
1. Admin clicks "Generate QR"
      → GET /api/token
      → encode { token } into a QR code using your QR library

2. User scans QR → your webapp receives ?t=<token> in the URL

3. Validate token age client-side:
      tokenTime = parseInt(atob(token), 10)
      if Date.now() - tokenTime > 120000 → show "QR expired"

4. Show name input field → user types name → clicks Join

5. POST /api/join { token, name }
      → on success: save { id, label } to localStorage
      → if status === "notified" → skip to step 7

6. Poll GET /api/status?id=<id> every 3 seconds
      → update position display: "You are 3rd in line"
      → when status flips to "notified" → go to step 7

7. Show "It's your turn!" + countdown from timeRemainingMs
      → fire a Web Notification if permission granted

8. If expired === true → show "Time's up, rejoin" screen

9. Admin panel polls GET /api/queue every 3–5 seconds
      → shows live list with statuses
      → on "Serve Next" click → POST /api/next
```

---

## Error handling summary

Always check `res.ok` before using response data. On failure, `response.json().error` contains a human-readable message you can show directly to the user.

```js
const res = await fetch(".../api/join", { method: "POST", ... });
if (!res.ok) {
  const { error } = await res.json();
  showError(error); // e.g. "Token expired" or "This QR code has already been used"
  return;
}
const data = await res.json();
```
