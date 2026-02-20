from __future__ import annotations

import logging
from typing import Optional

import cv2

from core.config import AppConfig
from core.constants import KEY_ESC, KEY_R, KEY_T, WINDOW_NAME
from gestures.gesture_dataset import GestureDataset
from gestures.gesture_predictor import GesturePredictor
from gestures.gesture_trainer import GestureTrainer
from interaction.interaction_engine import InteractionEngine
from interaction.object_manager import ObjectManager
from ui.renderer import Renderer
from utils.fps_counter import FPSCounter
from vision.camera import CameraError, ThreadedCamera
from vision.hand_tracker import HandTracker
from vision.landmark_processor import HandAnalysis, LandmarkProcessor


class AppController:
    def __init__(
        self,
        config: Optional[AppConfig] = None,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        self.config = config or AppConfig.from_env()
        self.config.ensure_paths()
        self.logger = logger or logging.getLogger("gesture_ai")

        self.camera = ThreadedCamera(self.config)
        self.hand_tracker = HandTracker(self.config)
        self.landmark_processor = LandmarkProcessor()

        self.dataset = GestureDataset(self.config.dataset_path)
        self.trainer = GestureTrainer(self.config, logger=self.logger)
        self.predictor = GesturePredictor(
            model_path=self.config.model_path,
            threshold=self.config.prediction_threshold,
            smoothing_window=self.config.smoothing_window,
            auto_reload_sec=self.config.model_auto_reload_sec,
            logger=self.logger,
        )

        self.object_manager = ObjectManager()
        self.interaction_engine = InteractionEngine(self.object_manager)
        self.renderer = Renderer(WINDOW_NAME)
        self.fps_counter = FPSCounter(window_size=45)

        self.collect_mode = False
        self.collect_label = ""
        self.collect_count = 0

    def run(self) -> None:
        self.logger.info(
            "Iniciando sistema | resolucao=%s | threshold=%.2f | modelo=%s",
            self.config.resolution,
            self.config.prediction_threshold,
            self.config.classifier_type,
        )

        try:
            self.camera.start()
        except CameraError:
            self.logger.exception("Falha ao iniciar a camera.")
            self._shutdown()
            return

        try:
            while True:
                frame = self.camera.read(timeout=0.1)
                if frame is None:
                    continue

                self._process_frame(frame)

                key = cv2.waitKey(1) & 0xFF
                if key in (KEY_ESC,):
                    break
                if key in (KEY_T, ord("T")):
                    self._start_collection()
                if key in (KEY_R, ord("R")):
                    self._train_model()
        except Exception:
            self.logger.exception("Erro inesperado no loop principal.")
        finally:
            self._shutdown()

    def _process_frame(self, frame) -> None:
        gesture_label = "unknown"
        confidence = 0.0
        hand_bbox = None
        hand_points = None
        hand_analysis: Optional[HandAnalysis] = None

        detections = self.hand_tracker.process(frame)
        if detections:
            detection = detections[0]
            hand_bbox = detection.bbox
            hand_analysis = self.landmark_processor.process(
                detection.landmarks,
                frame.shape,
                detection.handedness,
            )
            hand_points = hand_analysis.points_px

            prediction = self.predictor.predict(hand_analysis.features)
            if prediction and prediction.label != "unknown":
                gesture_label = prediction.label
                confidence = prediction.confidence
            else:
                gesture_label = hand_analysis.builtin_gesture
                confidence = 0.65 if gesture_label != "unknown" else 0.0

            self._collect_sample_if_needed(hand_analysis.features)

        snapshot = self.interaction_engine.update(
            gesture_label=gesture_label,
            analysis=hand_analysis,
            frame_shape=frame.shape,
        )

        self.fps_counter.tick()
        self.renderer.render(
            frame=frame,
            objects=self.object_manager.objects(),
            fps=self.fps_counter.get_fps(),
            gesture_label=gesture_label,
            confidence=confidence,
            state=snapshot.state,
            status=snapshot.status,
            training_mode=self.collect_mode,
            training_label=self.collect_label,
            training_count=self.collect_count,
            training_target=self.config.training_samples,
            hand_bbox=hand_bbox,
            hand_points=hand_points,
        )

    def _start_collection(self) -> None:
        if self.collect_mode:
            self.logger.info(
                "Coleta em andamento (%s %s/%s).",
                self.collect_label,
                self.collect_count,
                self.config.training_samples,
            )
            return

        print("\nDigite o nome do gesto e pressione ENTER.")
        label = input("Nome do gesto: ").strip().lower().replace(" ", "_")
        if not label:
            self.logger.warning("Coleta cancelada: nome do gesto vazio.")
            return

        self.collect_mode = True
        self.collect_label = label
        self.collect_count = 0
        self.logger.info(
            "Coleta iniciada: gesto=%s | alvo=%s amostras",
            label,
            self.config.training_samples,
        )

    def _collect_sample_if_needed(self, features) -> None:
        if not self.collect_mode:
            return

        try:
            self.dataset.append_sample(features=features, label=self.collect_label)
            self.collect_count += 1

            if self.collect_count >= self.config.training_samples:
                self.collect_mode = False
                self.logger.info("Coleta finalizada para '%s'.", self.collect_label)
        except Exception:
            self.collect_mode = False
            self.logger.exception("Erro na coleta de dados.")

    def _train_model(self) -> None:
        try:
            report = self.trainer.train()
            self.predictor.reload_model(force=True)
            self.logger.info(
                "Treino concluido | amostras=%s | accuracy=%.4f | precision=%.4f | recall=%.4f",
                report.samples,
                report.accuracy,
                report.precision,
                report.recall,
            )
            self.logger.info("Matriz de confusao:\n%s", report.confusion_matrix)
        except Exception:
            self.logger.exception("Falha ao treinar modelo.")

    def _shutdown(self) -> None:
        self.camera.stop()
        self.hand_tracker.close()
        self.renderer.close()
