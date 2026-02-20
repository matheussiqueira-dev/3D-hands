from __future__ import annotations

import csv
from pathlib import Path
from typing import Dict, Optional

import numpy as np
import pandas as pd


class GestureDataset:
    def __init__(self, csv_path: Path) -> None:
        self.csv_path = Path(csv_path)
        self.csv_path.parent.mkdir(parents=True, exist_ok=True)

    def _read_feature_count_from_header(self) -> Optional[int]:
        if not self.csv_path.exists() or self.csv_path.stat().st_size == 0:
            return None
        with open(self.csv_path, "r", newline="", encoding="utf-8") as fp:
            first = fp.readline().strip()
        if not first:
            return None
        return max(0, len(first.split(",")) - 1)

    def ensure_schema(self, feature_count: int) -> None:
        existing = self._read_feature_count_from_header()
        if existing is None:
            header = [f"feature_{idx + 1}" for idx in range(feature_count)] + ["label"]
            with open(self.csv_path, "w", newline="", encoding="utf-8") as fp:
                writer = csv.writer(fp)
                writer.writerow(header)
            return
        if existing != feature_count:
            raise ValueError(
                f"Schema de dataset inconsistente. Esperado {existing}, recebido {feature_count}."
            )

    def append_sample(self, features, label: str) -> None:
        vector = np.asarray(features, dtype=np.float32).flatten()
        self.ensure_schema(vector.size)
        row = vector.tolist() + [label]
        with open(self.csv_path, "a", newline="", encoding="utf-8") as fp:
            writer = csv.writer(fp)
            writer.writerow(row)

    def load_dataframe(self) -> pd.DataFrame:
        if not self.csv_path.exists() or self.csv_path.stat().st_size == 0:
            raise FileNotFoundError(f"Dataset nao encontrado em {self.csv_path}")
        return pd.read_csv(self.csv_path)

    def labels_distribution(self) -> Dict[str, int]:
        df = self.load_dataframe()
        if "label" not in df.columns:
            return {}
        series = df["label"].value_counts()
        return {str(idx): int(val) for idx, val in series.items()}
