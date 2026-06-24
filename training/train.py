"""
Train a 3-class YouTube comment classifier (ai / bot / human).
Outputs classifier_model.json in the project root for JS inference.

Usage:
    cd training
    python train.py
"""

import json
import re
import sys
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline


def preprocess(text: str) -> str:
    text = text.lower()
    text = re.sub(r"https?://\S+|www\.\S+", " url ", text)
    text = re.sub(r"[\+]?[\d][\d\s\-\.\(\)]{8,}\d", " phone ", text)
    text = re.sub(r"@\w{3,}", " handle ", text)
    text = re.sub(r"t\.me/\S+|wa\.me/\S+|bit\.ly/\S+|tinyurl\.com/\S+|rb\.gy/\S+|cutt\.ly/\S+|ow\.ly/\S+", " shortlink ", text)
    text = re.sub(r"(.)\1{5,}", r"\1\1\1", text)
    text = re.sub(r"[^\w\s]", " ", text)
    return text.strip()


def load_data(path: Path):
    raw = json.loads(path.read_text(encoding="utf-8"))
    texts  = [preprocess(d["text"])  for d in raw]
    labels = [d["label"] for d in raw]
    return texts, labels


def main():
    data_path = Path(__file__).parent / "data.json"
    if not data_path.exists():
        sys.exit(f"data.json not found at {data_path}")

    texts, labels = load_data(data_path)
    print(f"Loaded {len(texts)} examples")

    from collections import Counter
    dist = Counter(labels)
    for cls, n in sorted(dist.items()):
        print(f"  {cls}: {n}")

    vectorizer = TfidfVectorizer(
        analyzer="word",
        ngram_range=(1, 2),
        max_features=500,
        sublinear_tf=True,
        min_df=2,
        strip_accents="unicode",
    )
    clf = LogisticRegression(C=1.5, max_iter=1000, solver="lbfgs")
    pipe = Pipeline([("tfidf", vectorizer), ("clf", clf)])

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(pipe, texts, labels, cv=cv, scoring="f1_macro")
    print(f"\nCV F1 macro: {scores.mean():.3f} ± {scores.std():.3f}")

    per_class = cross_val_score(pipe, texts, labels, cv=cv, scoring="f1_weighted")
    print(f"CV F1 weighted: {per_class.mean():.3f} ± {per_class.std():.3f}")

    pipe.fit(texts, labels)

    tfidf: TfidfVectorizer = pipe.named_steps["tfidf"]
    lr: LogisticRegression = pipe.named_steps["clf"]

    model = {
        "vocab":     {k: int(v) for k, v in tfidf.vocabulary_.items()},
        "idf":       tfidf.idf_.tolist(),
        "coef":      lr.coef_.tolist(),
        "intercept": lr.intercept_.tolist(),
        "classes":   lr.classes_.tolist(),
    }

    out = Path(__file__).parent.parent / "classifier_model.json"
    out.write_text(json.dumps(model, separators=(",", ":")), encoding="utf-8")

    size_kb = out.stat().st_size / 1024
    print(f"\nModel saved → {out}")
    print(f"  Size:    {size_kb:.1f} KB")
    print(f"  Classes: {model['classes']}")
    print(f"  Vocab:   {len(model['vocab'])} features")

    eval_lines = [
        f"CV F1 macro:    {scores.mean():.3f} ± {scores.std():.3f}",
        f"CV F1 weighted: {per_class.mean():.3f} ± {per_class.std():.3f}",
        f"Training set:   {len(texts)} examples — {dict(dist)}",
        f"Vocab size:     {len(model['vocab'])}",
        f"Model size:     {size_kb:.1f} KB",
    ]
    (Path(__file__).parent / "eval_report.txt").write_text("\n".join(eval_lines), encoding="utf-8")
    print("\nEval report saved → training/eval_report.txt")


if __name__ == "__main__":
    main()
