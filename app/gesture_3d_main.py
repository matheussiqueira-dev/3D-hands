from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.gesture_3d_controller import Gesture3DController
from core.config import AppConfig
from core.logger import configure_logging


def main() -> None:
    parser = argparse.ArgumentParser(description="Gesture AI 3D Hands")
    parser.add_argument("--simple", action="store_true", help="Executa a versao simplificada")
    args = parser.parse_args()

    config = AppConfig.from_env()
    logger = configure_logging(config.log_path, config.debug_mode)

    controller = Gesture3DController(config=config, logger=logger, simple_mode=args.simple)
    controller.run()


if __name__ == "__main__":
    main()
