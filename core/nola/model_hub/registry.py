"""Curated model registry used by model-management flows."""

from __future__ import annotations

from nola.model_hub.contracts import ModelInfo
from nola.model_hub.errors import UnknownModelError

_REGISTERED_MODELS: tuple[ModelInfo, ...] = (
    ModelInfo(
        model_id="tiny",
        name="Tiny",
        repo_id="Systran/faster-whisper-tiny",
        runtime="faster-whisper",
        languages="multilingual",
        size_bytes=78_207_087,
        speed_rank=1,
        accuracy_rank=1,
        description="Favor minimal download size and fastest startup.",
    ),
    ModelInfo(
        model_id="base",
        name="Base",
        repo_id="Systran/faster-whisper-base",
        runtime="faster-whisper",
        languages="multilingual",
        size_bytes=147_886_409,
        speed_rank=2,
        accuracy_rank=2,
        description="Favor low resource usage with broader language support.",
    ),
    ModelInfo(
        model_id="small",
        name="Small",
        repo_id="Systran/faster-whisper-small",
        runtime="faster-whisper",
        languages="multilingual",
        size_bytes=486_215_847,
        speed_rank=3,
        accuracy_rank=3,
        description="Balance latency, quality, and footprint for general use.",
    ),
    ModelInfo(
        model_id="medium",
        name="Medium",
        repo_id="Systran/faster-whisper-medium",
        runtime="faster-whisper",
        languages="multilingual",
        size_bytes=1_530_575_217,
        speed_rank=4,
        accuracy_rank=4,
        description="Favor higher quality for multilingual transcription.",
    ),
    ModelInfo(
        model_id="large-v1",
        name="Large V1",
        repo_id="Systran/faster-whisper-large-v1",
        runtime="faster-whisper",
        languages="multilingual",
        size_bytes=3_089_581_898,
        speed_rank=5,
        accuracy_rank=4,
        description="Favor maximum context and legacy large-model compatibility.",
    ),
    ModelInfo(
        model_id="large-v2",
        name="Large V2",
        repo_id="Systran/faster-whisper-large-v2",
        runtime="faster-whisper",
        languages="multilingual",
        size_bytes=3_089_582_354,
        speed_rank=5,
        accuracy_rank=5,
        description="Favor high multilingual quality on capable hardware.",
    ),
    ModelInfo(
        model_id="large-v3",
        name="Large V3",
        repo_id="Systran/faster-whisper-large-v3",
        runtime="faster-whisper",
        languages="multilingual",
        size_bytes=3_090_839_273,
        speed_rank=5,
        accuracy_rank=5,
        description="Favor the strongest Whisper-family quality profile.",
        aliases=("large",),
    ),
    ModelInfo(
        model_id="large-v3-turbo",
        name="Large V3 Turbo",
        repo_id="mobiuslabsgmbh/faster-whisper-large-v3-turbo",
        runtime="faster-whisper",
        languages="multilingual",
        size_bytes=1_621_668_947,
        speed_rank=4,
        accuracy_rank=4,
        description="Favor faster large-model throughput with multilingual support.",
        aliases=("turbo",),
    ),
    ModelInfo(
        model_id="tiny.en",
        name="Tiny English",
        repo_id="Systran/faster-whisper-tiny.en",
        runtime="faster-whisper",
        languages="english-only",
        size_bytes=78_093_394,
        speed_rank=1,
        accuracy_rank=1,
        description="Favor the smallest English-only footprint.",
    ),
    ModelInfo(
        model_id="base.en",
        name="Base English",
        repo_id="Systran/faster-whisper-base.en",
        runtime="faster-whisper",
        languages="english-only",
        size_bytes=147_772_310,
        speed_rank=2,
        accuracy_rank=2,
        description="Favor lightweight English transcription for modest hardware.",
    ),
    ModelInfo(
        model_id="small.en",
        name="Small English",
        repo_id="Systran/faster-whisper-small.en",
        runtime="faster-whisper",
        languages="english-only",
        size_bytes=486_101_605,
        speed_rank=3,
        accuracy_rank=3,
        description="Balance English quality and throughput.",
    ),
    ModelInfo(
        model_id="medium.en",
        name="Medium English",
        repo_id="Systran/faster-whisper-medium.en",
        runtime="faster-whisper",
        languages="english-only",
        size_bytes=1_530_460_562,
        speed_rank=4,
        accuracy_rank=4,
        description="Favor stronger English accuracy without full large-model cost.",
    ),
    ModelInfo(
        model_id="distil-small.en",
        name="Distil Small English",
        repo_id="Systran/faster-distil-whisper-small.en",
        runtime="faster-whisper",
        languages="english-only",
        size_bytes=335_545_316,
        speed_rank=2,
        accuracy_rank=2,
        description="Favor a distilled English model for quick turnarounds.",
    ),
    ModelInfo(
        model_id="distil-medium.en",
        name="Distil Medium English",
        repo_id="Systran/faster-distil-whisper-medium.en",
        runtime="faster-whisper",
        languages="english-only",
        size_bytes=792_063_595,
        speed_rank=3,
        accuracy_rank=3,
        description="Favor a distilled English model with stronger quality.",
    ),
    ModelInfo(
        model_id="distil-large-v2",
        name="Distil Large V2",
        repo_id="Systran/faster-distil-whisper-large-v2",
        runtime="faster-whisper",
        languages="english-only",
        size_bytes=1_516_111_921,
        speed_rank=4,
        accuracy_rank=4,
        description="Favor a distilled English large model for faster runs.",
    ),
    ModelInfo(
        model_id="distil-large-v3",
        name="Distil Large V3",
        repo_id="Systran/faster-distil-whisper-large-v3",
        runtime="faster-whisper",
        languages="english-only",
        size_bytes=1_516_482_645,
        speed_rank=4,
        accuracy_rank=4,
        description="Favor distilled English large-model quality with lower latency.",
    ),
    ModelInfo(
        model_id="distil-large-v3.5",
        name="Distil Large V3.5",
        repo_id="distil-whisper/distil-large-v3.5-ct2",
        runtime="faster-whisper",
        languages="english-only",
        size_bytes=1_516_487_390,
        speed_rank=4,
        accuracy_rank=4,
        description="Favor the latest distilled English large-model release.",
    ),
)

_MODEL_BY_ID: dict[str, ModelInfo] = {}
_MODEL_BY_REPO_ID = {model.repo_id: model for model in _REGISTERED_MODELS}

for _model in _REGISTERED_MODELS:
    for _lookup_id in (_model.model_id, *_model.aliases):
        _MODEL_BY_ID[_lookup_id] = _model


def list_models() -> list[ModelInfo]:
    """Return canonical models in display order."""
    return list(_REGISTERED_MODELS)


def list_model_ids(*, include_aliases: bool = False) -> list[str]:
    """Return supported model ids, with aliases when requested."""
    if include_aliases:
        return list(_MODEL_BY_ID)
    return [model.model_id for model in _REGISTERED_MODELS]


def get_model(model_id: str) -> ModelInfo | None:
    """Return one model by canonical id or alias."""
    return _MODEL_BY_ID.get(model_id)


def get_model_by_repo_id(repo_id: str) -> ModelInfo | None:
    """Return one model by the Hugging Face repository id."""
    return _MODEL_BY_REPO_ID.get(repo_id)


def is_supported_model(model_id: str) -> bool:
    """Return whether one model id resolves in the registry."""
    return get_model(model_id) is not None


def require_model(model_id: str) -> ModelInfo:
    """Return one model or raise a stable domain error."""
    model = get_model(model_id)
    if model is None:
        raise UnknownModelError(model_id)
    return model


__all__ = [
    "get_model",
    "get_model_by_repo_id",
    "is_supported_model",
    "list_model_ids",
    "list_models",
    "require_model",
]
