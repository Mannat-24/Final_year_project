from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from flask import Flask, jsonify, request
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


@dataclass
class ModelBundle:
    pipeline: Pipeline


RISK_MAP = {0: "Low", 1: "Medium", 2: "High"}


def generate_dataset(samples: int = 1600, seed: int = 42):
    rng = np.random.default_rng(seed)

    marks = rng.uniform(20, 100, samples)
    attendance = rng.uniform(35, 100, samples)
    past_performance = np.clip(marks + rng.normal(0, 10, samples), 0, 100)

    risk = []
    for m, a, p in zip(marks, attendance, past_performance):
        weighted = m * 0.45 + a * 0.3 + p * 0.25
        if weighted < 45 or a < 55:
            risk.append(2)
        elif weighted < 65:
            risk.append(1)
        else:
            risk.append(0)

    x = np.column_stack([marks, attendance, past_performance])
    y = np.array(risk)
    return x, y


def train_model() -> ModelBundle:
    x, y = generate_dataset()
    x_train, _, y_train, _ = train_test_split(
        x, y, test_size=0.2, random_state=7, stratify=y
    )

    pipeline = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            (
                "classifier",
                LogisticRegression(
                    max_iter=250,
                    multi_class="multinomial",
                    solver="lbfgs",
                    random_state=7,
                ),
            ),
        ]
    )

    pipeline.fit(x_train, y_train)
    return ModelBundle(pipeline=pipeline)


bundle = train_model()
app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/predict")
def predict():
    payload = request.get_json(force=True, silent=True) or {}

    try:
        marks = float(payload.get("marks", 0))
        attendance = float(payload.get("attendance", 0))
        past_performance = float(payload.get("past_performance", 0))
    except (TypeError, ValueError):
        return jsonify({"message": "Invalid numeric fields"}), 400

    features = np.array([[marks, attendance, past_performance]])
    prediction = int(bundle.pipeline.predict(features)[0])
    probabilities = bundle.pipeline.predict_proba(features)[0].tolist()

    return jsonify(
        {
            "riskLevel": RISK_MAP[prediction],
            "model": "logistic-regression",
            "classProbabilities": {
                "Low": round(probabilities[0], 4),
                "Medium": round(probabilities[1], 4),
                "High": round(probabilities[2], 4),
            },
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)