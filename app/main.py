from __future__ import annotations

import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.app_controller import AppController
from core.config import AppConfig
from core.logger import configure_logging


def main() -> None:
    config = AppConfig.from_env()
    logger = configure_logging(config.log_path, config.debug_mode)

    try:
        controller = AppController(config=config, logger=logger)
        controller.run()
    except KeyboardInterrupt:
        logger.info("Encerrado pelo usuario.")
    except Exception:
        logger.exception("Falha fatal na aplicacao.")
        raise


if __name__ == "__main__":
    main()
