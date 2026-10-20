"""Shared platform registry for Ciel."""

from collections import OrderedDict
from typing import NamedTuple


class PlatformInfo(NamedTuple):
    """Metadata for a single platform entry."""
    label: str
    default_toolset: str


# Ordered so that TUI menus are deterministic.
PLATFORMS: OrderedDict[str, PlatformInfo] = OrderedDict([
    ("cli",            PlatformInfo(label="🖥️  CLI",            default_toolset="ciel-cli")),
    ("telegram",       PlatformInfo(label="📱 Telegram",        default_toolset="ciel-telegram")),
    ("discord",        PlatformInfo(label="💬 Discord",         default_toolset="ciel-discord")),
    ("slack",          PlatformInfo(label="💼 Slack",           default_toolset="ciel-slack")),
    ("whatsapp",       PlatformInfo(label="📱 WhatsApp",        default_toolset="ciel-whatsapp")),
    ("whatsapp_cloud", PlatformInfo(label="📱 WhatsApp Business (Cloud)", default_toolset="ciel-whatsapp")),
    ("signal",         PlatformInfo(label="📡 Signal",          default_toolset="ciel-signal")),
    ("bluebubbles",    PlatformInfo(label="💙 BlueBubbles",     default_toolset="ciel-bluebubbles")),
    ("email",          PlatformInfo(label="📧 Email",           default_toolset="ciel-email")),
    ("mattermost",     PlatformInfo(label="💬 Mattermost",      default_toolset="ciel-mattermost")),
    ("matrix",         PlatformInfo(label="💬 Matrix",          default_toolset="ciel-matrix")),
    ("dingtalk",       PlatformInfo(label="💬 DingTalk",        default_toolset="ciel-dingtalk")),
    ("feishu",         PlatformInfo(label="🪽 Feishu",          default_toolset="ciel-feishu")),
    ("wecom",          PlatformInfo(label="💬 WeCom",           default_toolset="ciel-wecom")),
    ("wecom_callback", PlatformInfo(label="💬 WeCom Callback",  default_toolset="ciel-wecom-callback")),
    ("weixin",         PlatformInfo(label="💬 Weixin",          default_toolset="ciel-weixin")),
    ("qqbot",          PlatformInfo(label="💬 QQBot",           default_toolset="ciel-qqbot")),
    ("yuanbao",        PlatformInfo(label="🤖 Yuanbao",         default_toolset="ciel-yuanbao")),
    ("webhook",        PlatformInfo(label="🔗 Webhook",         default_toolset="ciel-webhook")),
    ("api_server",     PlatformInfo(label="🌐 API Server",      default_toolset="ciel-api-server")),
    ("cron",           PlatformInfo(label="⏰ Cron",            default_toolset="ciel-cron")),
])


def _plugin_label(entry) -> str:
    return f"{entry.emoji}  {entry.label}" if entry.emoji else entry.label


def platform_label(key: str, default: str = "") -> str:
    """Return the display label for a platform key (builtin, then plugin registry), or *default*."""
    info = PLATFORMS.get(key)
    if info is not None:
        return info.label
    try:
        from gateway.platform_registry import platform_registry
        entry = platform_registry.get(key)
        if entry:
            return _plugin_label(entry)
    except Exception:
        pass
    return default


def get_all_platforms() -> OrderedDict[str, PlatformInfo]:
    """PLATFORMS plus plugin-registered platforms (appended after builtins) — use for menus."""
    merged = OrderedDict(PLATFORMS)
    try:
        from gateway.platform_registry import platform_registry
        for entry in platform_registry.plugin_entries():
            if entry.name not in merged:
                merged[entry.name] = PlatformInfo(_plugin_label(entry), f"ciel-{entry.name}")
    except Exception:
        pass
    return merged
