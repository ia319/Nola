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
        description_key="models.catalog.tiny.description",
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
        description_key="models.catalog.base.description",
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
        description_key="models.catalog.small.description",
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
        description_key="models.catalog.medium.description",
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
        description_key="models.catalog.largeV1.description",
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
        description_key="models.catalog.largeV2.description",
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
        description_key="models.catalog.largeV3.description",
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
        description_key="models.catalog.largeV3Turbo.description",
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
        description_key="models.catalog.tinyEnglish.description",
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
        description_key="models.catalog.baseEnglish.description",
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
        description_key="models.catalog.smallEnglish.description",
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
        description_key="models.catalog.mediumEnglish.description",
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
        description_key="models.catalog.distilSmallEnglish.description",
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
        description_key="models.catalog.distilMediumEnglish.description",
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
        description_key="models.catalog.distilLargeV2.description",
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
        description_key="models.catalog.distilLargeV3.description",
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
        description_key="models.catalog.distilLargeV35.description",
    ),
)


def _build_model_indexes(
    models: tuple[ModelInfo, ...],
) -> tuple[dict[str, ModelInfo], dict[str, ModelInfo]]:
    """Build stable lookup indexes and reject duplicate curated entries."""
    model_by_id: dict[str, ModelInfo] = {}
    model_by_repo_id: dict[str, ModelInfo] = {}

    for model in models:
        existing_repo_model = model_by_repo_id.get(model.repo_id)
        if existing_repo_model is not None:
            raise ValueError(
                "Duplicate model repo_id "
                f"{model.repo_id!r} for {existing_repo_model.model_id!r} "
                f"and {model.model_id!r}"
            )
        model_by_repo_id[model.repo_id] = model

        for lookup_id in (model.model_id, *model.aliases):
            existing_lookup_model = model_by_id.get(lookup_id)
            if existing_lookup_model is not None:
                raise ValueError(
                    "Duplicate model lookup id "
                    f"{lookup_id!r} for {existing_lookup_model.model_id!r} "
                    f"and {model.model_id!r}"
                )
            model_by_id[lookup_id] = model

    return model_by_id, model_by_repo_id


_MODEL_BY_ID, _MODEL_BY_REPO_ID = _build_model_indexes(_REGISTERED_MODELS)


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
