"""Nola Core - Speech-to-text engine powered by Faster Whisper."""

import os
import sys

# CTranslate2's default cuda_malloc_async allocator can abort on Windows when
# faster-whisper destroys a CUDA model after inference. Keep this before any
# faster_whisper import. See:
# https://github.com/SYSTRAN/faster-whisper/issues/71
# https://github.com/OpenNMT/CTranslate2/pull/2027
if sys.platform == "win32":
    os.environ.setdefault("CT2_CUDA_ALLOCATOR", "cub_caching")

__version__ = "0.1.0"
