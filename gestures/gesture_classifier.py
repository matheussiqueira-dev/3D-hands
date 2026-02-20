from __future__ import annotations

from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC


def build_classifier(classifier_type: str, random_state: int = 42):
    classifier_type = (classifier_type or "random_forest").strip().lower()

    if classifier_type == "random_forest":
        return Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "classifier",
                    RandomForestClassifier(
                        n_estimators=320,
                        random_state=random_state,
                        n_jobs=-1,
                        class_weight="balanced_subsample",
                    ),
                ),
            ]
        )

    if classifier_type == "svm":
        return Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "classifier",
                    SVC(
                        kernel="rbf",
                        C=3.0,
                        gamma="scale",
                        probability=True,
                        random_state=random_state,
                    ),
                ),
            ]
        )

    if classifier_type == "mlp":
        return Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "classifier",
                    MLPClassifier(
                        hidden_layer_sizes=(128, 64),
                        max_iter=600,
                        early_stopping=True,
                        random_state=random_state,
                    ),
                ),
            ]
        )

    raise ValueError(
        f"classifier_type '{classifier_type}' nao suportado. "
        "Use random_forest, svm ou mlp."
    )
