"""Small deterministic image fixtures; no resource exhaustion payloads."""

import base64
import struct
import subprocess
import zlib
from io import BytesIO
from unittest.mock import patch

import pytest
from PIL import Image

from app.core.errors import ApplicationError
from app.modules.boutique import logo_worker
from app.modules.boutique.service import clean_logo


def picture(format: str = "PNG", size: tuple[int, int] = (20, 10)) -> bytes:
    output = BytesIO()
    image = Image.new("RGBA" if format == "PNG" else "RGB", size, "red")
    image.save(output, format=format)
    return output.getvalue()


@pytest.mark.parametrize("format", ["PNG", "JPEG", "WEBP"])
def test_f03_valid_logos_preserve_supported_formats_and_resize(format):
    result = clean_logo(base64.b64encode(picture(format, (1200, 600))).decode())
    with Image.open(BytesIO(result)) as image:
        assert image.format == "PNG"
        assert image.size == (600, 300)
        assert not image.info


@pytest.mark.parametrize("format", ["BMP", "GIF", "TIFF"])
def test_f03_unsupported_decoders_are_not_tried(format):
    raw = picture(format)
    with patch.object(Image, "open", wraps=Image.open) as opened:
        with pytest.raises(ValueError):
            logo_worker.sanitize(raw)
        assert opened.call_args.kwargs["formats"] == ("PNG", "JPEG", "WEBP")


@pytest.mark.parametrize(
    "raw", [b"", b"<svg onload='bad()'/>", b"invalid", picture()[:30]]
)
def test_f03_invalid_or_truncated_images_are_rejected(raw):
    with pytest.raises(ApplicationError) as error:
        clean_logo(base64.b64encode(raw).decode())
    assert error.value.code == "invalid_logo"


@pytest.mark.parametrize("width,height", [(3001, 1), (2001, 2000), (0, 1)])
def test_f03_dimensions_rejected_from_small_header_without_allocating_pixels(
    width, height
):
    raw = picture()
    header = struct.pack(">II", width, height) + raw[24:29]
    raw = raw[:16] + header + struct.pack(">I", zlib.crc32(b"IHDR" + header)) + raw[33:]
    with pytest.raises(ApplicationError) as error:
        clean_logo(base64.b64encode(raw).decode())
    assert error.value.code == "invalid_logo"


def test_f03_exact_file_limit_is_accepted_and_over_limit_never_starts_decoder():
    raw = picture()
    maximum = raw + b"\0" * (logo_worker.MAX_LOGO_BYTES - len(raw))
    assert clean_logo(base64.b64encode(maximum).decode()).startswith(b"\x89PNG")
    with patch("app.modules.boutique.service.subprocess.run") as process:
        with pytest.raises(ApplicationError):
            clean_logo(base64.b64encode(maximum + b"\0").decode())
        process.assert_not_called()


def test_f03_worker_timeout_and_native_failure_are_controlled():
    encoded = base64.b64encode(picture()).decode()
    with patch(
        "app.modules.boutique.service.subprocess.run",
        side_effect=subprocess.TimeoutExpired("logo-worker", 5),
    ):
        with pytest.raises(ApplicationError) as error:
            clean_logo(encoded)
        assert error.value.status == 422
    with patch(
        "app.modules.boutique.service.subprocess.run",
        return_value=subprocess.CompletedProcess([], -9, b""),
    ):
        with pytest.raises(ApplicationError) as error:
            clean_logo(encoded)
        assert error.value.code == "invalid_logo"


def test_f03_worker_gets_no_database_credentials(monkeypatch):
    monkeypatch.setenv("HDB_DATABASE_PASSWORD", "synthetic-not-a-real-secret")
    with patch(
        "app.modules.boutique.service.subprocess.run",
        return_value=subprocess.CompletedProcess([], 0, picture()),
    ) as process:
        clean_logo(base64.b64encode(picture()).decode())
        assert "HDB_DATABASE_PASSWORD" not in process.call_args.kwargs["env"]
        assert process.call_args.args[0][1] == "-I"


def test_f03_existing_sanitized_png_and_alpha_still_work():
    image = Image.new("RGBA", (40, 20), (100, 50, 10, 80))
    output = BytesIO()
    image.save(output, format="PNG")
    legacy = output.getvalue()
    result = clean_logo(base64.b64encode(legacy).decode())
    with Image.open(BytesIO(result)) as restored:
        assert restored.size == (40, 20)
        assert restored.getpixel((0, 0)) == (100, 50, 10, 80)
