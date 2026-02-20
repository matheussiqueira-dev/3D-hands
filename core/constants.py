from pathlib import Path


APP_NAME = "Gesture AI System"
WINDOW_NAME = "Gesture AI - Commercial Prototype"
WINDOW_NAME_3D = "Gesture AI - 3D Hands"

DEFAULT_DATASET_PATH = Path("data/dataset.csv")
DEFAULT_MODEL_PATH = Path("models/saved_models/gesture_model.pkl")
DEFAULT_LOG_PATH = Path("logs/gesture_ai.log")

STATE_IDLE = "IDLE"
STATE_CREATING = "CREATING"
STATE_MOVING = "MOVING"
STATE_RESIZING = "RESIZING"
STATE_DELETING = "DELETING"

KEY_ESC = 27
KEY_T = ord("t")
KEY_R = ord("r")

GESTURE_TO_STATE = {
    "open_palm": STATE_CREATING,
    "pinch": STATE_MOVING,
    "spread": STATE_RESIZING,
    "thumb_down": STATE_DELETING,
    "fist": STATE_IDLE,
    "unknown": STATE_IDLE,
}
