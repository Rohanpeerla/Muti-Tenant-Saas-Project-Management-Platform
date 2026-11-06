from django.core.management.base import BaseCommand
from apps.billing.models import SubscriptionPlan


class Command(BaseCommand):
    help = 'Seeds initial subscription plans (Free, Pro, Business) into the database.'

    def handle(self, *args, **options):
        plans_data = [
            {
                'name': 'Free',
                'slug': 'free',
                'description': 'Essential agile project management for small teams and personal initiatives.',
                'monthly_price': 0,
                'yearly_price': 0,
                'currency': 'usd',
                'max_members': 5,
                'max_projects': 3,
                'max_tasks': 100,
                'max_storage_bytes': 100 * 1024 * 1024,  # 100 MB
                'max_webhooks': 0,
                'features': {
                    'custom_workflows': False,
                    'priority_support': False,
                    'webhooks': False,
                    'audit_logs': False,
                    'file_attachments': True,
                    'kanban_boards': True,
                    'sprint_management': True,
                },
                'is_active': True,
            },
            {
                'name': 'Pro',
                'slug': 'pro',
                'description': 'Advanced collaboration, custom Kanban workflows, higher limits, and webhooks.',
                'monthly_price': 1900,
                'yearly_price': 19000,
                'currency': 'usd',
                'max_members': 25,
                'max_projects': 20,
                'max_tasks': 2500,
                'max_storage_bytes': 5 * 1024 * 1024 * 1024,  # 5 GB
                'max_webhooks': 5,
                'features': {
                    'custom_workflows': True,
                    'priority_support': False,
                    'webhooks': True,
                    'audit_logs': True,
                    'file_attachments': True,
                    'kanban_boards': True,
                    'sprint_management': True,
                },
                'is_active': True,
            },
            {
                'name': 'Business',
                'slug': 'business',
                'description': 'Enterprise-grade capacity, unlimited custom workflows, maximum storage, and priority support.',
                'monthly_price': 4900,
                'yearly_price': 49000,
                'currency': 'usd',
                'max_members': 100,
                'max_projects': 100,
                'max_tasks': 50000,
                'max_storage_bytes': 50 * 1024 * 1024 * 1024,  # 50 GB
                'max_webhooks': 25,
                'features': {
                    'custom_workflows': True,
                    'priority_support': True,
                    'webhooks': True,
                    'audit_logs': True,
                    'file_attachments': True,
                    'kanban_boards': True,
                    'sprint_management': True,
                },
                'is_active': True,
            },
        ]

        created_count = 0
        updated_count = 0

        for plan_info in plans_data:
            slug = plan_info.pop('slug')
            plan, created = SubscriptionPlan.objects.update_or_create(
                slug=slug,
                defaults=plan_info
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created plan: {plan.name}'))
            else:
                updated_count += 1
                self.stdout.write(self.style.SUCCESS(f'Updated plan: {plan.name}'))

        self.stdout.write(self.style.SUCCESS(f'Successfully seeded {created_count + updated_count} plans.'))

