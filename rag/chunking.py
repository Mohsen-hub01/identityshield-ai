import re
from pathlib import Path


def _split_long_text(
    text: str,
    max_chars: int,
    overlap_chars: int,
) -> list[str]:
    """Split long text into overlapping chunks without usually cutting words."""
    chunks = []
    start = 0

    while start < len(text):
        end = min(start + max_chars, len(text))

        if end < len(text):
            split_at = text.rfind(" ", start, end)

            if split_at > start + max_chars // 2:
                end = split_at

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break

        start = max(end - overlap_chars, start + 1)

        while start < len(text) and text[start].isspace():
            start += 1

    return chunks


def _pack_paragraphs(
    paragraphs: list[str],
    max_chars: int,
    overlap_chars: int,
) -> list[str]:
    """Pack short paragraphs together and split oversized paragraphs."""
    chunks = []
    current = ""

    for paragraph in paragraphs:
        if len(paragraph) > max_chars:
            if current:
                chunks.append(current)
                current = ""

            chunks.extend(
                _split_long_text(
                    paragraph,
                    max_chars=max_chars,
                    overlap_chars=overlap_chars,
                )
            )
            continue

        candidate = (
            f"{current}\n\n{paragraph}"
            if current
            else paragraph
        )

        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                chunks.append(current)

            current = paragraph

    if current:
        chunks.append(current)

    return chunks


def split_markdown_document(
    markdown: str,
    source: str,
    max_chars: int = 1000,
    overlap_chars: int = 120,
) -> list[dict]:
    """Turn one Markdown playbook into chunks with source metadata."""
    if max_chars <= 0:
        raise ValueError("max_chars doit être strictement positif.")

    if overlap_chars < 0 or overlap_chars >= max_chars:
        raise ValueError(
            "overlap_chars doit être positif ou nul et inférieur à max_chars."
        )

    if not markdown.strip():
        return []

    source_path = Path(source).as_posix()
    headings = re.findall(
        r"(?m)^#\s+(.+?)\s*$",
        markdown,
    )

    title = headings[0].strip() if headings else Path(source).stem

    sections = []
    current_heading = title
    section_index = 0
    buffer = []

    def flush_section():
        body = "\n".join(buffer).strip()

        if body:
            sections.append(
                (current_heading, section_index, body)
            )

    for line in markdown.splitlines():
        match = re.match(r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$", line)

        if match:
            flush_section()
            buffer.clear()

            level = len(match.group(1))
            heading = match.group(2).strip()

            if level == 1:
                title_value = heading
                current_heading_value = heading
                current_index = 0
            else:
                title_value = title
                current_heading_value = heading
                current_index = section_index + 1

            # Update the enclosing function's current section state.
            if level == 1:
                sections_title = title_value
            else:
                sections_title = title

            current_heading = current_heading_value
            section_index = current_index
        else:
            buffer.append(line)

    flush_section()

    chunks = []
    chunk_index = 0

    for heading, heading_index, body in sections:
        paragraphs = [
            paragraph.strip()
            for paragraph in re.split(r"\n\s*\n", body)
            if paragraph.strip()
        ]

        text_chunks = _pack_paragraphs(
            paragraphs,
            max_chars=max_chars,
            overlap_chars=overlap_chars,
        )

        for text in text_chunks:
            chunks.append({
                "id": f"{source_path}::chunk-{chunk_index:04d}",
                "text": (
                    f"Document: {title}\n"
                    f"Section: {heading}\n\n"
                    f"{text}"
                ),
                "metadata": {
                    "source": source_path,
                    "title": title,
                    "section": heading,
                    "section_index": heading_index,
                    "chunk_index": chunk_index,
                },
            })

            chunk_index += 1

    return chunks
