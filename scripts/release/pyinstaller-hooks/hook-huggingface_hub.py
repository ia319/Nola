"""PyInstaller collection rules for the Hugging Face Xet backend."""

from PyInstaller.utils.hooks import copy_metadata

# Hugging Face checks distribution metadata before importing the native backend.
datas = copy_metadata("hf-xet")
hiddenimports = ["hf_xet"]
