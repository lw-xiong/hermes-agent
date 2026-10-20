#!/usr/bin/env python3
"""
Ciel CLI launcher.

This wrapper should behave like the installed `ciel` command, including
subcommands such as `gateway`, `cron`, and `doctor`.
"""

if __name__ == "__main__":
    from ciel_cli.main import main
    main()
