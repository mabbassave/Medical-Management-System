import base64
import json
import sys
from pathlib import Path

import cv2
import numpy as np


MODEL_VERSION = "opencv-sface-2021dec-yunet-2023mar-v1"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 12_000_000
MIN_FACE_WIDTH = 80


def load_models(model_dir: Path):
    detector_path = model_dir / "face_detection_yunet_2023mar.onnx"
    recognizer_path = model_dir / "face_recognition_sface_2021dec.onnx"
    if not detector_path.is_file() or not recognizer_path.is_file():
        raise FileNotFoundError("Face model files are missing.")

    detector = cv2.FaceDetectorYN.create(
        str(detector_path), "", (320, 320), 0.85, 0.3, 5000
    )
    recognizer = cv2.FaceRecognizerSF.create(str(recognizer_path), "")
    return detector, recognizer


def extract_template(detector, recognizer, encoded_image: str) -> bytes:
    image_bytes = base64.b64decode(encoded_image, validate=True)
    if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("invalid_image")

    image = cv2.imdecode(
        np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR
    )
    if image is None or image.size == 0:
        raise ValueError("invalid_image")
    height, width = image.shape[:2]
    if width * height > MAX_IMAGE_PIXELS:
        raise ValueError("invalid_image")

    detector.setInputSize((width, height))
    _, faces = detector.detect(image)
    if faces is None or len(faces) == 0:
        raise ValueError("no_face")
    if len(faces) != 1:
        raise ValueError("multiple_faces")
    if faces[0][2] < MIN_FACE_WIDTH or faces[0][3] < MIN_FACE_WIDTH:
        raise ValueError("face_too_small")

    aligned = recognizer.alignCrop(image, faces[0])
    features = recognizer.feature(aligned).reshape(-1).astype(np.float32)
    norm = float(np.linalg.norm(features))
    if not np.isfinite(norm) or norm <= 0 or not np.isfinite(features).all():
        raise ValueError("invalid_image")
    features /= norm
    return features.tobytes()


def main() -> None:
    model_dir = Path(__file__).resolve().parent / "models"
    try:
        cv2.setNumThreads(1)
        detector, recognizer = load_models(model_dir)
    except Exception as error:
        print(f"Face model worker startup failed ({type(error).__name__}).", file=sys.stderr)
        raise SystemExit(1)

    print(json.dumps({"ready": True, "model": MODEL_VERSION}), flush=True)
    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            identifier = request.get("id")
            template = extract_template(detector, recognizer, request["image"])
            result = {
                "id": identifier,
                "ok": True,
                "model": MODEL_VERSION,
                "template": base64.b64encode(template).decode("ascii"),
            }
        except ValueError as error:
            code = str(error)
            result = {
                "id": request.get("id"),
                "ok": False,
                "code": code if code in {
                    "invalid_image",
                    "no_face",
                    "multiple_faces",
                    "face_too_small",
                } else "invalid_image",
            }
        except Exception as error:
            print(f"Face model inference failed ({type(error).__name__}).", file=sys.stderr)
            result = {
                "id": request.get("id"),
                "ok": False,
                "code": "model_error",
            }
        print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
