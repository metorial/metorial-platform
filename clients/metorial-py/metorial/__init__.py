"""
Metorial Python SDK

AI-powered tool calling and session management for Python.
"""

__version__ = "1.0.0"
__author__ = "Metorial Team"
__email__ = "support@metorial.com"

# Core imports
from .client import Metorial
from .openai import metorial_openai

# Export main classes
__all__ = [
  "Metorial",
  "metorial_openai",
  "__version__",
]
