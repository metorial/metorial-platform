#!/usr/bin/env python3
"""
Setup script for Metorial Python SDK.

This creates a unified installation for all Metorial Python packages.
"""

from setuptools import setup, find_packages
import os
import sys

# Ensure we're in the right directory
if not os.path.exists('packages'):
  print("Error: This script must be run from the metorial-py root directory")
  sys.exit(1)

def read_file(filename):
  """Read a file and return its contents."""
  with open(filename, 'r', encoding='utf-8') as f:
    return f.read()

def get_version():
  """Get version from version file or return default."""
  try:
    return read_file('VERSION').strip()
  except FileNotFoundError:
    return "1.0.0"

def get_packages():
  """Find all packages."""
  packages = find_packages()
  print(f"Found packages: {packages}")
  return packages

setup(
  name="metorial",
  version=get_version(),
  description="Python SDK for Metorial - AI-powered tool calling and session management",
  long_description=read_file('README.md') if os.path.exists('README.md') else "Metorial Python SDK",
  long_description_content_type="text/markdown",
  author="Metorial Team",
  author_email="support@metorial.com",
  url="https://github.com/metorial/metorial-enterprise",
  
  # Package configuration
  packages=get_packages(),
  include_package_data=True,
  zip_safe=False,
  
  # Python version requirement
  python_requires=">=3.8",
  
  # Metadata for PyPI
  classifiers=[
    "Development Status :: 4 - Beta",
    "Intended Audience :: Developers",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.8",
    "Programming Language :: Python :: 3.9",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Topic :: Software Development :: Libraries :: Python Modules",
    "Topic :: Scientific/Engineering :: Artificial Intelligence",
    "Topic :: Internet :: WWW/HTTP :: HTTP Servers",
  ],
  
  keywords=[
    "metorial", "ai", "llm", "openai", "anthropic", "tools", "mcp", 
    "model-context-protocol", "chat", "completions", "sessions"
  ],
  
  # Entry points
  # entry_points={
  #   'console_scripts': [
  #     'metorial=metorial.cli:main',
  #   ],
  # },
  
  # Project URLs
  project_urls={
    "Homepage": "https://metorial.com",
    "Documentation": "https://metorial.com/docs",
    "Repository": "https://github.com/metorial/metorial-enterprise",
    "Bug Tracker": "https://github.com/metorial/metorial-enterprise/issues",
    "Changelog": "https://github.com/metorial/metorial-enterprise/blob/main/CHANGELOG.md",
  },
)
