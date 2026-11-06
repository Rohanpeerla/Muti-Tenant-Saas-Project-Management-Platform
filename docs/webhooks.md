# Workspace Webhooks & Event Delivery System

## 1. Overview
SprintSync allows workspace administrators to configure external webhook endpoints to receive real-time JSON notifications when key resources are created, updated, moved, or deleted.

---

## 2. Supported Webhook Events

| Event Identifier | Trigger Condition |
|---|---|
| `task.created` | New task created in project |
| `task.updated` | Task title, priority, due date, or sprint modified |
| `task.assigned` | Task assignee added or modified |
| `task.status_changed` | Task transitioned to a different column or status |
| `task.completed` | Task moved to completion column (`DONE`) |
| `comment.created` | Team member commented on task |
| `project.created` | New project added to workspace |
| `sprint.started` | Agile sprint transitioned to `ACTIVE` |
| `sprint.completed` | Agile sprint transitioned to `COMPLETED` |
| `member.invited` | New user invited to workspace |

---

## 3. Webhook Delivery & HMAC Signature Verification

### Request Headers
Every webhook HTTP POST request dispatched by SprintSync contains the following headers:
```http
POST /your-webhook-endpoint HTTP/1.1
Host: your-server.com
Content-Type: application/json
User-Agent: SprintSync-Webhook/1.0
X-SprintSync-Event: task.created
X-SprintSync-Event-ID: 7b844bf2-10f5-46aa-9dcb-3129486c99c5
X-SprintSync-Signature: sha256=d3b07384d113edec49eaa6238ad5ff00...
```

### Signature Computation
The signature is an HMAC-SHA256 hex digest calculated over the exact UTF-8 encoded JSON request body using the webhook's secret key:
```python
import hmac
import hashlib
import json

def verify_signature(secret: str, raw_body: bytes, received_sig: str) -> bool:
    expected = 'sha256=' + hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received_sig)
```

---

## 4. Server-Side Request Forgery (SSRF) Defenses

Webhook destinations are user-supplied URLs. To protect the host environment and internal network services, the following server-side checks are strictly enforced before saving and before delivering any payload:

1. **Protocol Restrictions**: Only `http` and `https` schemes are accepted (`ftp`, `file`, `gopher`, etc. are rejected). In non-debug production environments, `https` is strictly required.
2. **DNS Resolution & IP Whitelist/Blacklist**: Hostnames are resolved to IP addresses via DNS. Every resolved IP address is verified:
   - Loopback addresses (`127.0.0.0/8`, `::1`) are blocked.
   - RFC 1918 Private addresses (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) are blocked.
   - Link-local addresses (`169.254.0.0/16`, `fe80::/10`) are blocked.
   - Cloud instance metadata services (`169.254.169.254`, `fd00:ec2::254`, `100.100.100.200`) are explicitly blocked.
   - Multicast, broadcast, and unspecified addresses are blocked.
3. **Port Filtering**: Restricted internal ports (e.g. 22 SSH, 25 SMTP, 5432 PostgreSQL, 6379 Redis, 27017 MongoDB) are rejected.
4. **Transport Hardening**:
   - Connection timeout: 5 seconds.
   - Read/response timeout: 10 seconds.
   - Redirects disabled (`allow_redirects=False`) to prevent open redirect bypasses.
   - Response capture limit: First 500 characters only to prevent memory bloat.

---

## 5. Delivery Lifecycle & Retry Policy

When an event fires:
1. A `WebhookDelivery` record is created with `status = PENDING`.
2. Celery executes `deliver_webhook_task` asynchronously.
3. If the destination returns a `2xx` HTTP status code:
   - `status = SUCCESS`
   - `completed_at` is set to `now()`.
   - `webhook.last_delivery_at` is updated.
4. If the destination times out, returns `4xx` or `5xx`, or is unreachable:
   - For attempts 1 and 2: `status = RETRYING`, with exponential backoff delay (30s, 60s).
   - After 3 failed attempts: `status = FAILED`, `completed_at` is stamped, and a `WEBHOOK_FAILURE` notification is generated for the workspace owner.
5. Manual retry is supported at any time via `POST /api/webhook-deliveries/{id}/retry/`.

---

## 6. REST API Reference

| Method | Endpoint | Description | Role Required |
|---|---|---|---|
| `GET` | `/api/workspaces/{workspace_id}/webhooks/` | List webhooks in workspace (secrets masked) | OWNER, ADMIN |
| `POST` | `/api/workspaces/{workspace_id}/webhooks/` | Create a webhook (returns secret in response once) | OWNER, ADMIN |
| `PATCH` | `/api/webhooks/{id}/` | Update webhook name, URL, events, or active status | OWNER, ADMIN |
| `DELETE` | `/api/webhooks/{id}/` | Delete webhook and all delivery history | OWNER, ADMIN |
| `POST` | `/api/webhooks/{id}/test/` | Dispatch a `test.ping` event to the webhook | OWNER, ADMIN |
| `POST` | `/api/webhooks/{id}/rotate-secret/` | Rotate secret and return new secret once | OWNER, ADMIN |
| `GET` | `/api/webhooks/{id}/deliveries/` | Paginated delivery log history | OWNER, ADMIN |
| `POST` | `/api/webhook-deliveries/{id}/retry/` | Manually re-attempt a delivery | OWNER, ADMIN |

