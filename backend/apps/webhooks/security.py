import ipaddress
import socket
from urllib.parse import urlparse
from django.conf import settings
from rest_framework.exceptions import ValidationError

# Sensitive internal service ports that should never be reachable via webhooks
DISALLOWED_PORTS = {
    21, 22, 23, 25, 53, 110, 143, 389, 445,
    5432,  # PostgreSQL
    6379,  # Redis
    11211, # Memcached
    27017, # MongoDB
    9200,  # Elasticsearch
}

# Cloud metadata addresses to explicitly reject
BLOCKED_IPS = {
    '169.254.169.254',  # AWS, GCP, Azure, OpenStack instance metadata
    'fd00:ec2::254',     # AWS IPv6 instance metadata
    '100.100.100.200',  # Alibaba Cloud metadata
}


def validate_webhook_url(url, allow_local=None):
    """
    Validates a target webhook URL to prevent Server-Side Request Forgery (SSRF).
    Checks scheme, host resolution, IP space (loopback, private, link-local, cloud metadata),
    and port numbers.
    """
    if allow_local is None:
        allow_local = getattr(settings, 'WEBHOOK_ALLOW_LOCAL_DESTINATIONS', False)

    if not url or not isinstance(url, str):
        raise ValidationError('Webhook target URL cannot be empty.')

    try:
        parsed = urlparse(url.strip())
    except Exception as e:
        raise ValidationError(f'Invalid URL format: {e}')

    scheme = parsed.scheme.lower()
    if scheme not in ('http', 'https'):
        raise ValidationError('Webhook URL must use HTTP or HTTPS protocol.')

    # Require HTTPS in production (when DEBUG is False) unless explicitly allowed
    if not settings.DEBUG and scheme != 'https' and not allow_local:
        raise ValidationError('Webhook URL must use HTTPS in production.')

    hostname = parsed.hostname
    if not hostname:
        raise ValidationError('Webhook URL must include a valid hostname.')

    # Reject localhost or 0.0.0.0 hostnames explicitly unless local destinations are allowed
    if not allow_local and hostname.lower() in ('localhost', '127.0.0.1', '::1', '0.0.0.0'):
        raise ValidationError('Localhost and loopback destinations are not permitted.')

    # Check port
    port = parsed.port
    if port:
        if port in DISALLOWED_PORTS:
            raise ValidationError(f'Port {port} is restricted and cannot be used for webhooks.')
        if port < 1 or port > 65535:
            raise ValidationError('Invalid port number.')

    # Resolve hostname to IP addresses and inspect each resolved IP
    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        # If hostname cannot be resolved, reject it
        raise ValidationError(f'Unable to resolve hostname: "{hostname}".')

    resolved_ips = set()
    for item in addr_info:
        sockaddr = item[4]
        ip_str = sockaddr[0]
        resolved_ips.add(ip_str)

    if not resolved_ips:
        raise ValidationError('No IP addresses could be resolved for the target URL.')

    for ip_str in resolved_ips:
        if ip_str in BLOCKED_IPS:
            raise ValidationError('Cloud instance metadata services are strictly blocked.')

        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError:
            raise ValidationError(f'Resolved invalid IP address: {ip_str}')

        if not allow_local:
            if ip_obj.is_loopback:
                raise ValidationError('Loopback addresses (127.0.0.0/8, ::1) are not permitted.')
            if ip_obj.is_private:
                raise ValidationError('Private network destinations (RFC 1918) are not permitted.')
            if ip_obj.is_link_local:
                raise ValidationError('Link-local destinations are not permitted.')
            if ip_obj.is_multicast:
                raise ValidationError('Multicast destinations are not permitted.')
            if ip_obj.is_reserved:
                raise ValidationError('Reserved IP destinations are not permitted.')
            if ip_obj.is_unspecified:
                raise ValidationError('Unspecified destinations (0.0.0.0) are not permitted.')

    return True

