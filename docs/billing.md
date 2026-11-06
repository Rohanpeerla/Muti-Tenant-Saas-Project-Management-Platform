# SprintSync Billing & Subscription Architecture

## 1. Overview
SprintSync Stage 8 introduces an enterprise-grade multi-tenant subscription and billing infrastructure powered by Stripe (Test Mode). Subscriptions are workspace-scoped (`WorkspaceSubscription`), allowing organizations to upgrade, downgrade, track real-time resource allocations, and enforce plan limits cleanly.

---

## 2. Core Billing Models

### `SubscriptionPlan`
Defines available subscription packages, tiers, limits, and pricing.
- `slug`: Unique identifier (`free`, `pro`, `business`).
- `monthly_price`, `yearly_price`: Integer prices in USD cents.
- `max_members`: Maximum number of active team members.
- `max_projects`: Maximum number of projects.
- `max_tasks`: Maximum number of tasks across projects.
- `max_storage_bytes`: Storage quota in bytes (calculated from task attachments).
- `max_webhooks`: Maximum number of active webhook endpoints.
- `features`: JSONField containing feature gates (`custom_workflows`, `webhooks`, etc.).

### `WorkspaceSubscription`
1-to-1 relationship with `Workspace` tracking subscription state:
- `status`: `FREE`, `ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELED`, `UNPAID`, `INCOMPLETE`.
- `stripe_customer_id`: Unique Stripe customer identifier (`cus_...`).
- `stripe_subscription_id`: Stripe subscription identifier (`sub_...`).
- `billing_interval`: `monthly` or `yearly`.
- `current_period_start`, `current_period_end`: Billing cycle timestamps.
- `cancel_at_period_end`: Boolean flag enabling grace periods prior to expiration.

### `WorkspaceUsage`
Live tracking model with atomic recalculation:
- `active_members`: Number of `ACTIVE` members in `WorkspaceMembership`.
- `active_projects`: Count of workspace projects.
- `total_tasks`: Count of issues/tasks in workspace.
- `storage_bytes`: Sum of `file_size` from all `IssueAttachment` objects.
- `active_webhooks`: Active webhook endpoints.
- `recalculate()`: Aggregates usage metrics from PostgreSQL.

### `BillingInvoice`
Stores Stripe invoice records and links to hosted PDF receipts:
- `stripe_invoice_id`: Stripe invoice ID (`in_...`).
- `amount_paid`, `amount_due`: Values in cents.
- `invoice_pdf_url`: Direct Stripe PDF download link.
- `hosted_invoice_url`: Hosted Stripe web invoice view.

### `StripeWebhookEvent`
Deduplication and audit log for incoming webhook events:
- `stripe_event_id`: Unique event ID (`evt_...`).
- `event_type`: Stripe event name (e.g. `checkout.session.completed`).
- `processed`: Boolean flag ensuring strict idempotency.

---

## 3. REST API Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/billing/plans/` | Public | Lists all active subscription tiers and feature matrices. |
| `GET` | `/api/billing/subscription/?workspace_id=...` | Owner/Admin | Fetches current plan, subscription status, and usage metrics. |
| `POST` | `/api/billing/checkout/` | Owner/Admin | Initializes Stripe hosted Checkout session for upgrades. |
| `POST` | `/api/billing/customer-portal/` | Owner/Admin | Creates Stripe Customer Portal session for payment card updates. |
| `POST` | `/api/billing/cancel-subscription/` | Owner/Admin | Cancels subscription (at period end or immediately). |
| `POST` | `/api/billing/reactivate-subscription/` | Owner/Admin | Reactivates a pending-cancellation subscription. |
| `GET` | `/api/billing/invoices/?workspace_id=...` | Owner/Admin | Retrieves invoice history and payment receipt URLs. |
| `POST` | `/api/billing/stripe/webhook/` | Stripe Only | Webhook ingestion endpoint with signature verification. |

---

## 4. Frontend Billing Modules

1. **Pricing Page (`/pricing`)**:
   - Monthly and annual billing interval switch (with 20% discount highlight).
   - Plan feature breakdown table.
   - Dynamic CTA triggers (Upgrade, Current Plan, Manage).

2. **Workspace Billing Settings (`/workspaces/:workspaceId/settings/billing`)**:
   - Current subscription status badge (`Active`, `Past Due`, `Canceled`, `Free`).
   - Renewal date and plan details.
   - Usage visual progress bars (Members, Projects, Tasks, Storage, Webhooks).
   - Stripe Customer Portal launch button.
   - Invoices and receipt download history table.
   - Cancel / Reactivate subscription dialogs.

3. **Callback Pages**:
   - Success callback (`/billing/success?session_id=...`): Welcomes upgraded workspace.
   - Cancel callback (`/billing/cancel`): Graceful return to pricing/workspace.

