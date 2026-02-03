"""ASS (Advanced SubStation Alpha) subtitle formatter."""

from collections.abc import Sequence

from nola.services.formatters.base import (
    OutputFormatter,
    SegmentData,
    format_timestamp_ass,
)


class ASSFormatter(OutputFormatter):
    """ASS subtitle formatter with default styling.

    Uses centisecond precision (H:MM:SS.cc) per ASS specification.
    """

    @property
    def name(self) -> str:
        """
        Identifier for the Advanced SubStation Alpha (ASS) formatter.
        
        Returns:
            name (str): The formatter name "ass".
        """
        return "ass"

    @property
    def file_extension(self) -> str:
        """
        ASS subtitle file extension.
        
        Returns:
            The string "ass".
        """
        return "ass"

    @property
    def content_type(self) -> str:
        """
        Content MIME type for ASS/SSA subtitle files.
        
        Returns:
            The content type string "text/x-ssa".
        """
        return "text/x-ssa"

    def format(self, segments: Sequence[SegmentData]) -> str:
        """
        Render a sequence of subtitle segments into a complete ASS (Advanced SubStation Alpha) file.
        
        Converts each SegmentData item into an ASS Dialogue line, replaces newline characters in segment text with the ASS line-break marker `\N`, and emits a single-file string that includes [Script Info], [V4+ Styles] (with a default style), and [Events] sections.
        
        Parameters:
            segments (Sequence[SegmentData]): Subtitle segments; each item must provide `start`, `end`, and `text` attributes used for timing and dialogue content.
        
        Returns:
            str: The full ASS file content as a single string (sections and Dialogue lines).
        """
        lines: list[str] = []

        # Script Info
        lines.append("[Script Info]")
        lines.append("ScriptType: v4.00+")
        lines.append("PlayResX: 1920")
        lines.append("PlayResY: 1080")
        lines.append("")

        # Default style - Arial 48pt, white text with black outline
        lines.append("[V4+ Styles]")
        lines.append(
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
            "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
            "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
            "Alignment, MarginL, MarginR, MarginV, Encoding"
        )
        lines.append(
            "Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,"
            "0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1"
        )
        lines.append("")

        # Events
        lines.append("[Events]")
        lines.append(
            "Format: Layer, Start, End, Style, Name, "
            "MarginL, MarginR, MarginV, Effect, Text"
        )

        for segment in segments:
            start = format_timestamp_ass(segment.start)
            end = format_timestamp_ass(segment.end)
            # ASS uses \N for line breaks within dialogue
            text = segment.text.strip().replace("\n", "\\N")
            lines.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

        return "\n".join(lines)