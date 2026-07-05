#!/usr/bin/env python3
"""Hermes MCP launcher wrapper for study-pulse.

Ensures PYTHONPATH is set before starting the actual MCP server,
because Hermes stdio transport on Windows may not propagate cwd
correctly for `python -m` module execution.
"""
import os
import sys

# Ensure project root is on the path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
os.environ.setdefault("PYTHONPATH", PROJECT_ROOT)

# Hand off to the real server module
if __name__ == "__main__":
    from apps.mcp.server import mcp
    mcp.run()
