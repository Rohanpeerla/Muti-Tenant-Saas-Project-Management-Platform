# SprintSync Subscription Plans & Tiers

## 1. Overview of Plans

SprintSync offers 3 tiers designed to support teams of all sizes, from solo developers to growing organizations:

| Tier | Monthly Price | Annual Price | Active Members | Projects | Tasks / Issues | Cloud Storage | Webhooks | Custom Workflows |
|---|---|---|---|---|---|---|---|---|
| **Free** | $0 / mo | $0 / yr | 5 | 3 | 100 | 100 MB | 0 | Disabled |
| **Pro** | $29 / mo | $290 / yr | 25 | 15 | 1,000 | 1 GB | 5 | Enabled |
| **Business** | $79 / mo | $790 / yr | 100 | 50 | 10,000 | 10 GB | 25 | Enabled |

---

## 2. Plan Seeding Command

Plans can be seeded or re-synchronized at any time using the Django management command:
```bash
python backend/manage.py seed_plans
```
This initializes or updates the `SubscriptionPlan` database records with the canonical allocations and prices.

---

## 3. Plan Capabilities Details

### Free Tier
- **Target**: Personal projects, evaluations, and small teams.
- **Includes**:
  - Up to 5 team members with role-based access control.
  - Up to 3 active projects.
  - Up to 100 tasks and issues.
  - 100 MB storage quota for file attachments.
  - Standard Kanban boards and sprint management.
  - In-app and email notifications.

### Pro Tier ($29/month or $290/year)
- **Target**: Fast-growing startups and active software development squads.
- **Includes**:
  - Up to 25 team members.
  - Up to 15 active projects.
  - Up to 1,000 tasks and issues.
  - 1 GB storage quota for attachments.
  - Up to 5 outbound webhooks with HMAC signatures and automated retry delivery.
  - Custom Kanban workflow transitions and state enforcement.
  - Stripe Customer Portal self-service billing management.

### Business Tier ($79/month or $790/year)
- **Target**: Scaling organizations and cross-functional engineering teams.
- **Includes**:
  - Up to 100 team members.
  - Up to 50 active projects.
  - Up to 10,000 tasks and issues.
  - 10 GB storage capacity.
  - Up to 25 outbound webhooks.
  - Custom Kanban workflows and transition permissions.
  - Full workspace audit logs and activity timeline analytics.
  - Dedicated priority background job queues.

