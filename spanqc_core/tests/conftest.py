import io, json, sys
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from spanqc_core.extract import ModelReply

FIX = Path(__file__).parent / "fixtures"


class FakeClient:
    model = "fake-model"

    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = 0

    def create(self, *, system, image, media_type, max_tokens):
        self.calls += 1
        r = self.replies.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def reply(wires, stop="end_turn", extra=None):
    return ModelReply(json.dumps({"sheet_name": "T", "wires": wires, "uncertain": extra or []}), stop)


def wire(no="122A", col="WH", size=1.5, src="CFB1", dst="CN-36", ev=None, conf=0.95):
    return {"wire_no": no, "colour": col, "size_mm2": size, "source": src, "destination": dst,
            "evidence_text": ev if ev is not None else f"{no} {col} {size}", "confidence": conf}


@pytest.fixture
def png_bytes():
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), "white").save(buf, "PNG")
    return buf.getvalue()
