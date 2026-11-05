"""Bounded standalone decoder; invoked with isolated Python and binary pipes."""

import sys
import warnings
from io import BytesIO

MAX_LOGO_BYTES = 2 * 1024 * 1024
MAX_PIXELS = 4_000_000
MAX_SIDE = 3000
OUTPUT_SIDE = 600
WORKER_TIMEOUT = 5
FORMATS = ("PNG", "JPEG", "WEBP")


def sanitize(raw: bytes) -> bytes:
    from PIL import Image

    if not raw or len(raw) > MAX_LOGO_BYTES:
        raise ValueError("size")
    previous_limit = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw), formats=FORMATS) as image:
                if (
                    not (0 < image.width <= MAX_SIDE and 0 < image.height <= MAX_SIDE)
                    or image.width * image.height > MAX_PIXELS
                ):
                    raise ValueError("dimensions")
                image.verify()
            with Image.open(BytesIO(raw), formats=FORMATS) as image:
                # Keep the existing first-frame behavior for animated PNG/WebP.
                image.load()
                image.thumbnail((OUTPUT_SIDE, OUTPUT_SIDE))
                output = BytesIO()
                image.convert("RGBA").save(output, format="PNG", optimize=True)
                return output.getvalue()
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        OSError,
    ) as error:
        raise ValueError("invalid image") from error
    finally:
        Image.MAX_IMAGE_PIXELS = previous_limit


def main() -> None:
    if sys.platform != "win32":
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,) * 2)
        resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    try:
        raw = sys.stdin.buffer.read(MAX_LOGO_BYTES + 1)
        sys.stdout.buffer.write(sanitize(raw))
    except (ValueError, MemoryError):
        sys.exit(2)
    except Exception:
        # Do not expose input bytes, decoder metadata or local paths on stderr.
        sys.exit(3)


if __name__ == "__main__":
    main()
