"""Convenience launcher; calculations live in the shared JavaScript engine."""
import pathlib
import shutil
import subprocess
import sys

node = shutil.which("node")
if not node:
    sys.exit("Install Node.js 22 or newer, then rerun this command.")
entry = pathlib.Path(__file__).with_name("analyse.mjs")
sys.exit(subprocess.call([node, str(entry), *sys.argv[1:]]))
