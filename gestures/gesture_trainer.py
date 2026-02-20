from __future__ import annotations

import logging
from dataclasses import dataclass

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix, precision_score, recall_score
from sklearn.model_selection import train_test_split

from core.config import AppConfig
from gestures.gesture_classifier import build_classifier
from gestures.gesture_dataset import GestureDataset


@dataclass
class TrainingReport:
    accuracy: float
    precision: float
    recall: float
    confusion_matrix: np.ndarray
    labels: list[str]
    samples: int


class GestureTrainer:
    def __init__(self, config: AppConfig, logger: logging.Logger) -> None:
        self.config = config
        self.logger = logger
        self.dataset = GestureDataset(self.config.dataset_path)

    def train(self) -> TrainingReport:
        df = self.dataset.load_dataframe()
        if "label" not in df.columns:
            raise ValueError("Dataset invalido: coluna 'label' nao encontrada.")
        if len(df.index) < 20:
            raise ValueError("Dataset insuficiente para treino. Colete ao menos 20 amostras.")

        y = df["label"].astype(str).values
        x = df.drop(columns=["label"]).astype(np.float32).values
        unique_labels = sorted(pd.Series(y).unique().tolist())
        if len(unique_labels) < 2:
            raise ValueError("Treino requer ao menos 2 classes de gesto.")

        stratify = y
        class_counts = pd.Series(y).value_counts()
        if (class_counts < 2).any():
            stratify = None

        x_train, x_test, y_train, y_test = train_test_split(
            x,
            y,
            test_size=self.config.test_size,
            random_state=self.config.random_state,
            stratify=stratify,
        )

        model = build_classifier(self.config.classifier_type, self.config.random_state)
        model.fit(x_train, y_train)
        y_pred = model.predict(x_test)

        acc = float(accuracy_score(y_test, y_pred))
        precision = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
        recall = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
        labels = sorted(pd.Series(np.concatenate([y_test, y_pred])).unique().tolist())
        cm = confusion_matrix(y_test, y_pred, labels=labels)

        bundle = {
            "model": model,
            "labels": labels,
            "feature_count": int(x.shape[1]),
            "classifier_type": self.config.classifier_type,
        }
        joblib.dump(bundle, self.config.model_path)

        self.logger.info("Modelo salvo em %s", self.config.model_path)
        return TrainingReport(
            accuracy=acc,
            precision=precision,
            recall=recall,
            confusion_matrix=cm,
            labels=labels,
            samples=len(df.index),
        )
