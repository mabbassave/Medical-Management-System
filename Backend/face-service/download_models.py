from hashlib import sha256
from pathlib import Path
from urllib.request import urlopen


REVISION = "47534e27c9851bb1128ccc0102f1145e27f23f98"
MODELS = {
    "face_detection_yunet_2023mar.onnx": (
        "models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    ),
    "face_recognition_sface_2021dec.onnx": (
        "models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    ),
}


def main() -> None:
    destination = Path(__file__).resolve().parent / "models"
    destination.mkdir(parents=True, exist_ok=True)

    for filename, (relative_url, expected_hash) in MODELS.items():
        output = destination / filename
        url = f"https://github.com/opencv/opencv_zoo/raw/{REVISION}/{relative_url}"
        with urlopen(url, timeout=60) as response:
            content = response.read()

        actual_hash = sha256(content).hexdigest()
        if actual_hash != expected_hash:
            raise RuntimeError(f"Checksum validation failed for {filename}.")

        temporary = output.with_suffix(output.suffix + ".part")
        temporary.write_bytes(content)
        temporary.replace(output)
        print(f"Installed and checksum-verified {filename}.")


if __name__ == "__main__":
    main()
