---
layout: post
title: "MLOps: AWS SageMaker and MLflow"
author: Carlos Pena
date: 2026-10-15
---

[MLflow](https://mlflow.org) tracks experiments, stores model artifacts and keeps a model registry. Hosting it yourself means running a server, a database and an S3 bucket, then working out authentication for all of them. [SageMaker managed MLflow](https://docs.aws.amazon.com/sagemaker/latest/dg/mlflow.html) runs that part for you. The examples use the SageMaker Python SDK v3 (`sagemaker>=3.17`), which already installs `mlflow` and the `sagemaker-mlflow` plugin.

This part covers the experiment side of MLOps: setting up the MLflow App, logging a training run properly, comparing models until one is ready to register, and moving that training onto SageMaker instances with `@remote`.

---

## 1. Creating the MLflow App

SageMaker offers MLflow in two forms:

| | MLflow App | MLflow Tracking Server |
|---|---|---|
| API | `CreateMlflowApp` | `CreateMlflowTrackingServer` |
| Capacity | Serverless, nothing to size | You choose a server size (`Small`, `Medium`, `Large`) |
| Status | **Use this one for new setups** | Legacy |

The app is the part every later section depends on. Training runs log to it, models are compared in it, and the registry lives in it.

```python
from sagemaker.core.helper.session_helper import Session, get_execution_role
from sagemaker.core.resources import MlflowApp, Tag

session = Session()
role_arn = get_execution_role()
bucket = session.default_bucket()  # sagemaker-<region>-<account-id>

mlflow_app = MlflowApp.create(
    name="semantic-search",
    artifact_store_uri=f"s3://{bucket}/mlflow",
    role_arn=role_arn,
    model_registration_mode="AutoModelRegistrationEnabled",
    weekly_maintenance_window_start="Sun:03:00",  # UTC
    tags=[Tag(key="project", value="semantic-search")],
)

# create() returns as soon as the request is accepted, with status "Creating"
mlflow_app.wait_for_status("Created", timeout=15 * 60)

print(f"MLflow App ARN: {mlflow_app.arn}")
```

What each parameter does:

| Parameter | Required | Notes |
|---|---|---|
| `name` | Yes | Letters, numbers and hyphens. The name is not part of the ARN, so code refers to the app by its ARN. |
| `artifact_store_uri` | Yes | An S3 prefix for artifacts (models, plots, files). |
| `role_arn` | Yes | The role **the app** uses to read and write the artifact store. It needs `sagemaker.amazonaws.com` in its trust policy and access to that bucket. |
| `model_registration_mode` | No | `AutoModelRegistrationEnabled` copies every model registered in MLflow to the **SageMaker Model Registry**. Default: `AutoModelRegistrationDisabled`. |
| `tags` | No | Up to 50. Useful for cost allocation per project. |

### Connecting to it

The `sagemaker-mlflow` plugin turns the app ARN into an authenticated endpoint using the standard AWS credential chain, so the tracking URI is just the ARN: `mlflow.set_tracking_uri(mlflow_app.arn)`. You never handle a URL or a token. The example in the next section starts with that call.

From the CLI, or inside a training container, set an environment variable instead:

```bash
export MLFLOW_TRACKING_URI=arn:aws:sagemaker:<region>:<account-id>:mlflow-app/<app-id>
```

Pass the ARN to training jobs this way rather than hardcoding it in the training script, so the same code can log to a dev app or a prod app.

### What a run should log

A run is only useful later if someone can answer "what produced this model, on what data, and how good was it?" without asking the person who trained it. This is the checklist I use:

| What | MLflow call | Why |
|---|---|---|
| Tags | `set_tags` | Owner, git commit, project. Lets you filter runs and trace a model back to its code. |
| Params | `log_params` | Every hyperparameter, so the run can be reproduced. |
| Datasets | `log_input` | Which data, which version, which split. "Better metric" means nothing if the eval set changed. |
| Metrics per step | `log_metrics(..., step=)` | The training curve. Shows overfitting and runs that stopped too early. |
| Model | `<flavor>.log_model` | The model plus a **signature** (input/output schema) and an **input example**. The registry and the endpoint depend on these. |
| Final metrics | `log_metrics(..., model_id=, dataset=)` | Evaluation results linked to the exact model and dataset, so you can compare versions in the UI. |
| Artifacts | `log_figure`, `log_table`, `log_dict`, `log_text` | Plots, sample predictions, the resolved config, notes. |

Here it is in one run, with dummy data: a small re-ranker that predicts whether a document is relevant to a query from a few made-up features.

```python
import os

import matplotlib.pyplot as plt
import mlflow
import numpy as np
import pandas as pd
from mlflow.models import infer_signature
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    f1_score,
    log_loss,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

mlflow.set_tracking_uri(mlflow_app.arn)
mlflow.set_experiment("semantic-search")

# dummy data: one row per (query, document) pair, label = relevant or not
rng = np.random.default_rng(42)
n = 2_000
df = pd.DataFrame(
    {
        "cosine_similarity": rng.uniform(-1, 1, n),
        "bm25_score": rng.exponential(5, n),
        "doc_length": rng.integers(50, 2_000, n).astype(float),
        "query_length": rng.integers(1, 20, n).astype(float),
    }
)
df["relevant"] = (
    (2 * df.cosine_similarity + 0.1 * df.bm25_score + rng.normal(0, 0.5, n)) > 0.5
).astype(int)

train_df, eval_df = train_test_split(df, test_size=0.2, random_state=42)
features = ["cosine_similarity", "bm25_score", "doc_length", "query_length"]
X_train, y_train = train_df[features], train_df["relevant"]
X_eval, y_eval = eval_df[features], eval_df["relevant"]

params = {
    "loss": "log_loss",
    "alpha": 1e-4,
    "learning_rate": "optimal",
    "epochs": 4,
    "random_state": 42,
}

with mlflow.start_run(run_name="logreg-baseline") as run:
    # 1. tags: who, which code, what for
    mlflow.set_tags(
        {
            "project": "semantic-search",
            "owner": "carlos.pena",
            "git_commit": os.getenv("GIT_COMMIT", "local"),
            "stage": "experiment",
        }
    )

    # 2. params: everything needed to reproduce the run
    mlflow.log_params(params)
    mlflow.log_param("features", ",".join(features))

    # 3. datasets: which data, which version, which split
    source = "s3://my-bucket/datasets/v3/pairs.parquet"
    train_ds = mlflow.data.from_pandas(
        train_df, source=source, targets="relevant", name="pairs-v3-train"
    )
    eval_ds = mlflow.data.from_pandas(
        eval_df, source=source, targets="relevant", name="pairs-v3-eval"
    )
    mlflow.log_input(train_ds, context="training")
    mlflow.log_input(eval_ds, context="evaluation")

    # 4. metrics per step: the training curve, one pass over the data per epoch
    scaler = StandardScaler().fit(X_train)
    X_train_s, X_eval_s = scaler.transform(X_train), scaler.transform(X_eval)
    clf = SGDClassifier(
        loss=params["loss"],
        alpha=params["alpha"],
        learning_rate=params["learning_rate"],
        random_state=params["random_state"],
    )
    for epoch in range(params["epochs"]):
        clf.partial_fit(X_train_s, y_train, classes=[0, 1])
        mlflow.log_metrics(
            {
                "train_loss": log_loss(y_train, clf.predict_proba(X_train_s)),
                "eval_loss": log_loss(y_eval, clf.predict_proba(X_eval_s)),
            },
            step=epoch,
        )

    # scaler + classifier in one object, so the logged model takes raw features
    model = Pipeline([("scaler", scaler), ("clf", clf)])

    # 5. model: signature + input example, served as probabilities, registered under a name
    signature = infer_signature(X_eval, model.predict_proba(X_eval))
    model_info = mlflow.sklearn.log_model(
        sk_model=model,
        name="model",
        signature=signature,
        input_example=X_eval.head(5),
        pyfunc_predict_fn="predict_proba",
        registered_model_name="semantic-search-reranker",
    )

    # 6. final metrics, linked to the model and the eval dataset
    y_proba = model.predict_proba(X_eval)[:, 1]
    y_pred = (y_proba >= 0.5).astype(int)
    mlflow.log_metrics(
        {
            "accuracy": accuracy_score(y_eval, y_pred),
            "f1": f1_score(y_eval, y_pred),
            "roc_auc": roc_auc_score(y_eval, y_proba),
        },
        model_id=model_info.model_id,
        dataset=eval_ds,
    )

    # 7. artifacts: plots, sample predictions, config, notes
    fig, ax = plt.subplots()
    ConfusionMatrixDisplay.from_predictions(y_eval, y_pred, ax=ax)
    mlflow.log_figure(fig, "plots/confusion_matrix.png")
    plt.close(fig)

    predictions = eval_df.assign(score=y_proba, predicted=y_pred)
    mlflow.log_table(predictions.head(200), artifact_file="eval/predictions.json")
    mlflow.log_dict(
        {"features": features, "threshold": 0.5, **params}, "config/train_config.json"
    )
    mlflow.log_text(
        "Baseline: logistic regression on similarity + BM25 features.", "notes.md"
    )

print(f"run: {run.info.run_id}")
print(f"model: {model_info.model_uri} (version {model_info.registered_model_version})")
```

Notes on the less obvious parts:

- **`SGDClassifier` with `partial_fit`** is logistic regression trained one pass over the data at a time, so each call is a real epoch with a loss to log. The scaler goes into a `Pipeline` with the classifier, so the logged model takes raw features. In PyTorch or Hugging Face you log inside the real training loop. [Autologging](https://mlflow.org/docs/latest/ml/tracking/autolog/) covers most of this for you: `mlflow.pytorch.autolog()` (PyTorch Lightning only) and `mlflow.transformers.autolog()`.
- **`pyfunc_predict_fn="predict_proba"`** decides what the model returns when it is loaded with `mlflow.pyfunc` or served from an endpoint. The default is `predict`, which returns class labels (`[1, 0]`). A re-ranker needs scores to sort by, and the signature has to describe the same output, so both come from `predict_proba`.
- **`name="model"`** replaces `artifact_path` in MLflow 3. Each logged model gets its own `model_id` (`models:/m-...`), and metrics logged with `model_id=` show up on that model's page as well as on the run.
- **`registered_model_name`** creates a new version in the MLflow registry. Because the app was created with `AutoModelRegistrationEnabled`, the same version also appears in the SageMaker Model Registry.
- **The dataset `source`** is only metadata. MLflow records the URI and a digest of the DataFrame, not the data itself, so keep versioned datasets in S3.
- **`Hint: Inferred schema contains integer column(s)`** is printed by `log_input`, because the dataset schema includes the integer label `relevant`. It matters for model inputs that might have missing values at serving time. The label is never a model input, and the model's features are all floats, so it's safe to ignore here.
- **`log_table`** saves sample predictions that you can browse in the UI. Keep it to a sample: it's stored as an artifact, not built for millions of rows.

---

## 2. Comparing models in one experiment

When you try several models for the same problem, keep **one experiment** for the problem and give **each model its own run**. A new experiment per model splits results that should sit side by side.

| MLflow level | What it holds | Here |
|---|---|---|
| Experiment | One problem, one evaluation dataset | `semantic-search` |
| Parent run | One comparison or tuning session | `model-comparison` |
| Child run | One model with one configuration | `sgd-logreg`, `random-forest`, `gradient-boosting` |
| Registered model | Only the version you might deploy | `semantic-search-reranker@challenger` |

What keeps the runs comparable:

- **Same evaluation dataset and same metric names in every run.** If one run logs `auc` and another `roc_auc`, or they use different eval splits, the comparison means nothing.
- **A `model_family` tag on each run**, so you can filter and group by it in the UI.
- **One parent run per session.** All candidates from today sit under one row, separate from last week's attempts.
- **Register only the winner.** Candidates log a model but don't pass `registered_model_name`. Otherwise the registry fills up with models nobody will deploy.

Reusing the data and imports from section 1:

```python
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.pipeline import make_pipeline

candidates = {
    "sgd-logreg": {
        "model": make_pipeline(
            StandardScaler(),
            SGDClassifier(loss="log_loss", alpha=1e-4, random_state=42),
        ),
        "params": {"loss": "log_loss", "alpha": 1e-4},
        "trusted_types": [],
    },
    "random-forest": {
        "model": RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42),
        "params": {"n_estimators": 200, "max_depth": 8},
        "trusted_types": ["sklearn.tree._tree.Tree"],
    },
    "gradient-boosting": {
        "model": HistGradientBoostingClassifier(
            learning_rate=0.1, max_iter=200, random_state=42
        ),
        "params": {"learning_rate": 0.1, "max_iter": 200},
        "trusted_types": [
            "sklearn.ensemble._hist_gradient_boosting.predictor.TreePredictor"
        ],
    },
}

mlflow.set_experiment("semantic-search")
model_uris = {}  # child run id -> logged model URI

with mlflow.start_run(run_name="model-comparison") as parent:
    mlflow.set_tags({"project": "semantic-search", "stage": "model-selection"})
    mlflow.log_input(train_ds, context="training")
    mlflow.log_input(eval_ds, context="evaluation")

    for name, candidate in candidates.items():
        with mlflow.start_run(run_name=name, nested=True) as child:
            mlflow.set_tag("model_family", name)
            mlflow.log_params(candidate["params"])

            model = candidate["model"].fit(X_train, y_train)
            y_proba = model.predict_proba(X_eval)[:, 1]

            model_info = mlflow.sklearn.log_model(
                sk_model=model,
                name="model",
                signature=infer_signature(X_eval, model.predict_proba(X_eval)),
                input_example=X_eval.head(5),
                pyfunc_predict_fn="predict_proba",
                skops_trusted_types=candidate["trusted_types"],
            )
            model_uris[child.info.run_id] = model_info.model_uri
            mlflow.log_metrics(
                {
                    "roc_auc": roc_auc_score(y_eval, y_proba),
                    "f1": f1_score(y_eval, (y_proba >= 0.5).astype(int)),
                },
                model_id=model_info.model_id,
                dataset=eval_ds,
            )

# best child run of this comparison, by the metric we care about
best = mlflow.search_runs(
    filter_string=f"tags.mlflow.parentRunId = '{parent.info.run_id}'",
    order_by=["metrics.roc_auc DESC"],
    max_results=1,
).iloc[0]
print(f"best: {best['tags.mlflow.runName']} (roc_auc={best['metrics.roc_auc']:.3f})")

# register only the winner
version = mlflow.register_model(model_uris[best.run_id], "semantic-search-reranker")
mlflow.MlflowClient().set_registered_model_alias(
    "semantic-search-reranker", "challenger", version.version
)
print(f"registered version {version.version} as @challenger")
```

Notes:

- **`skops_trusted_types`**: recent MLflow versions save scikit-learn models with [skops](https://skops.readthedocs.io) instead of pickle, and skops refuses to load types it can't verify. Tree models fail at `log_model` with `Untrusted types found in the file: ['sklearn.tree._tree.Tree']`. List only the types the error names, for models you trained yourself. Don't trust everything just to make the error go away.
- **`search_runs` with `tags.mlflow.parentRunId`** selects only this session's candidates, so older runs in the experiment don't win by accident.
- **Register by model URI (`models:/m-...`), not `runs:/<run_id>/model`.** In MLflow 3 a logged model is stored on its own, not inside the run's artifacts, so the `runs:/` form only works through a fallback that prints a warning.
- **The `challenger` alias** marks the version waiting for review. Deployment code loads `models:/semantic-search-reranker@champion`. Promoting a version after review means moving `champion` to it (`set_registered_model_alias(..., "champion", version)`), so the deployment code never changes. Aliases belong to the MLflow registry. The SageMaker Model Registry tracks approval with its own status (`PendingManualApproval`, `Approved`, `Rejected`) instead.
- **On this dummy data the linear model wins** (ROC AUC 0.971 against 0.966 for the random forest and 0.961 for gradient boosting), because the label was generated from a linear rule. On real data, run the comparison before assuming the bigger model is better.
- **To compare in the UI**, open the experiment, expand the parent run, select the child runs and click **Compare**. You get parallel-coordinate and scatter plots of params against metrics.
- **Hyperparameter tuning uses the same layout**: a parent run for the search and a child run per trial. Optuna, for example, can run each trial inside `mlflow.start_run(nested=True)`.

---

## 3. Training on remote machines with `@remote` and `RemoteExecutor`

So far everything ran in the notebook's own kernel. That's fine for dummy data, but real training needs a bigger machine, a GPU, or just a notebook you can close while the job runs. The [`@remote` decorator](https://docs.aws.amazon.com/sagemaker/latest/dg/train-remote-decorator-invocation.html) turns a plain Python function into a **SageMaker training job**: calling the function starts the job on a new instance, waits for it, and returns the function's result as if it had run locally.

```text
  notebook                                         SageMaker training job (ml.m5.xlarge)
  --------                                         -------------------------------------
  train_sgd(train_df, eval_df, params)
     |  1. pickle function + arguments ---> S3
     |  2. CreateTrainingJob  ---------------------> install requirements.txt
     |                                               load function + arguments from S3
     |                                               run train_sgd(...)  ---- logs ----> MLflow App
     |  3. wait                                      pickle the return value ---> S3
     v
  result = {"run_id": ..., "model_uri": ...}  <--- S3
```

The job and the notebook only share what goes through S3 (arguments and return value) and the MLflow App (everything the run logs). That shapes how the functions are written.

### `@remote` or `RemoteExecutor`

The SDK has two separate ways to run a function as a job. Each one launches jobs on its own, so a function uses one or the other, never both:

| | `@remote` | `RemoteExecutor` |
|---|---|---|
| What turns the function into a job | The decorator, when the function is defined | `executor.submit(func, ...)`, when it's called |
| How you call it | `train_sgd(...)`, like a normal function | `executor.submit(train_candidate, ...)` |
| What the call returns | The result, after the job finishes (it blocks) | A future, right away |
| Jobs at once | One per call, in sequence | Up to `max_parallel_jobs` in parallel |
| Use it for | "Run this on a bigger machine and give me the result" | Several jobs at the same time, like a model comparison |

A function passed to `RemoteExecutor` is a plain Python function with no decorator. You can even call it locally to test it.

The two scripts below show one each. Both only assume the MLflow App from section 1 exists, and both repeat the same setup (the MLflow App lookup, `requirements.txt`, `JOB_SETTINGS` and the dummy data), so each one runs on its own. In SDK v3 both live in `sagemaker.core.remote_function` (the AWS docs still show the v2 import, `sagemaker.remote_function`).

### Script 1: one model with `@remote`

```python
# train_remote.py: one model, one remote job with @remote
from importlib.metadata import version

import mlflow
import numpy as np
import pandas as pd
from sagemaker.core.helper.session_helper import Session, get_execution_role
from sagemaker.core.remote_function import remote
from sagemaker.core.resources import MlflowApp
from sklearn.model_selection import train_test_split

APP_NAME = "semantic-search"
EXPERIMENT = "semantic-search"
DATA_SOURCE = "s3://my-bucket/datasets/v3/pairs.parquet"
FEATURES = ["cosine_similarity", "bm25_score", "doc_length", "query_length"]

session = Session()
role_arn = get_execution_role()
bucket = session.default_bucket()
mlflow_app = next(app for app in MlflowApp.get_all() if app.name == APP_NAME)

mlflow.set_tracking_uri(mlflow_app.arn)
mlflow.set_experiment(EXPERIMENT)

PACKAGES = ["mlflow", "sagemaker-mlflow", "scikit-learn", "pandas", "numpy"]
with open("requirements.txt", "w") as f:
    f.writelines(f"{package}=={version(package)}\n" for package in PACKAGES)

JOB_SETTINGS = dict(
    instance_type="ml.m5.xlarge",
    role=role_arn,
    dependencies="./requirements.txt",
    environment_variables={
        "MLFLOW_TRACKING_URI": mlflow_app.arn,
        "MLFLOW_EXPERIMENT_NAME": EXPERIMENT,
    },
    s3_root_uri=f"s3://{bucket}/remote-functions",
    job_name_prefix="semantic-search-train",
    keep_alive_period_in_seconds=600,  # warm pool: the next job skips provisioning
    max_runtime_in_seconds=60 * 60,
    tags={"project": "semantic-search"},  # a dict: a list of tuples fails in SDK v3
)


def make_dummy_data(n=2_000, seed=42):
    rng = np.random.default_rng(seed)
    df = pd.DataFrame(
        {
            "cosine_similarity": rng.uniform(-1, 1, n),
            "bm25_score": rng.exponential(5, n),
            "doc_length": rng.integers(50, 2_000, n).astype(float),
            "query_length": rng.integers(1, 20, n).astype(float),
        }
    )
    df["relevant"] = (
        (2 * df.cosine_similarity + 0.1 * df.bm25_score + rng.normal(0, 0.5, n)) > 0.5
    ).astype(int)
    return train_test_split(df, test_size=0.2, random_state=seed)


@remote(**JOB_SETTINGS)
def train_sgd(train_df, eval_df, params):
    # imports inside the function: they run on the remote machine
    import mlflow
    from mlflow.models import infer_signature
    from sklearn.linear_model import SGDClassifier
    from sklearn.metrics import f1_score, log_loss, roc_auc_score
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler

    X_train, y_train = train_df[FEATURES], train_df["relevant"]
    X_eval, y_eval = eval_df[FEATURES], eval_df["relevant"]

    with mlflow.start_run(run_name="sgd-remote") as run:
        mlflow.set_tags({"project": "semantic-search", "compute": "sagemaker-remote"})
        mlflow.log_params(params)

        eval_ds = mlflow.data.from_pandas(
            eval_df, source=DATA_SOURCE, targets="relevant", name="pairs-v3-eval"
        )
        mlflow.log_input(
            mlflow.data.from_pandas(
                train_df, source=DATA_SOURCE, targets="relevant", name="pairs-v3-train"
            ),
            context="training",
        )
        mlflow.log_input(eval_ds, context="evaluation")

        scaler = StandardScaler().fit(X_train)
        X_train_s, X_eval_s = scaler.transform(X_train), scaler.transform(X_eval)
        clf = SGDClassifier(
            loss=params["loss"],
            alpha=params["alpha"],
            learning_rate=params["learning_rate"],
            random_state=params["random_state"],
        )
        for epoch in range(params["epochs"]):
            clf.partial_fit(X_train_s, y_train, classes=[0, 1])
            mlflow.log_metrics(
                {
                    "train_loss": log_loss(y_train, clf.predict_proba(X_train_s)),
                    "eval_loss": log_loss(y_eval, clf.predict_proba(X_eval_s)),
                },
                step=epoch,
            )

        model = Pipeline([("scaler", scaler), ("clf", clf)])
        model_info = mlflow.sklearn.log_model(
            sk_model=model,
            name="model",
            signature=infer_signature(X_eval, model.predict_proba(X_eval)),
            input_example=X_eval.head(5),
            pyfunc_predict_fn="predict_proba",
        )

        y_proba = model.predict_proba(X_eval)[:, 1]
        metrics = {
            "roc_auc": roc_auc_score(y_eval, y_proba),
            "f1": f1_score(y_eval, (y_proba >= 0.5).astype(int)),
        }
        mlflow.log_metrics(metrics, model_id=model_info.model_id, dataset=eval_ds)

    # return small, plain values; the model itself already lives in MLflow
    return {"run_id": run.info.run_id, "model_uri": model_info.model_uri, **metrics}


train_df, eval_df = make_dummy_data()

params = {
    "loss": "log_loss",
    "alpha": 1e-4,
    "learning_rate": "optimal",
    "epochs": 4,
    "random_state": 42,
}
result = train_sgd(train_df, eval_df, params)  # starts the job and waits for it
print(result)
```

### Script 2: several models in parallel with `RemoteExecutor`

The same three candidates as section 2, each trained in its own job at the same time. The parent run is created locally, and each job attaches its child run to it with `parent_run_id`.

```python
# compare_remote.py: several models, parallel remote jobs with RemoteExecutor
from importlib.metadata import version

import mlflow
import numpy as np
import pandas as pd
from sagemaker.core.helper.session_helper import Session, get_execution_role
from sagemaker.core.remote_function import RemoteExecutor
from sagemaker.core.resources import MlflowApp
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import SGDClassifier
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

APP_NAME = "semantic-search"
EXPERIMENT = "semantic-search"
REGISTERED_MODEL = "semantic-search-reranker"
DATA_SOURCE = "s3://my-bucket/datasets/v3/pairs.parquet"
FEATURES = ["cosine_similarity", "bm25_score", "doc_length", "query_length"]

session = Session()
role_arn = get_execution_role()
bucket = session.default_bucket()
mlflow_app = next(app for app in MlflowApp.get_all() if app.name == APP_NAME)

mlflow.set_tracking_uri(mlflow_app.arn)
mlflow.set_experiment(EXPERIMENT)

PACKAGES = ["mlflow", "sagemaker-mlflow", "scikit-learn", "pandas", "numpy"]
with open("requirements.txt", "w") as f:
    f.writelines(f"{package}=={version(package)}\n" for package in PACKAGES)

JOB_SETTINGS = dict(
    instance_type="ml.m5.xlarge",
    role=role_arn,
    dependencies="./requirements.txt",
    environment_variables={
        "MLFLOW_TRACKING_URI": mlflow_app.arn,
        "MLFLOW_EXPERIMENT_NAME": EXPERIMENT,
    },
    s3_root_uri=f"s3://{bucket}/remote-functions",
    job_name_prefix="semantic-search-compare",
    keep_alive_period_in_seconds=600,  # warm pool: the next job skips provisioning
    max_runtime_in_seconds=60 * 60,
    tags={"project": "semantic-search"},  # a dict: a list of tuples fails in SDK v3
)


def make_dummy_data(n=2_000, seed=42):
    rng = np.random.default_rng(seed)
    df = pd.DataFrame(
        {
            "cosine_similarity": rng.uniform(-1, 1, n),
            "bm25_score": rng.exponential(5, n),
            "doc_length": rng.integers(50, 2_000, n).astype(float),
            "query_length": rng.integers(1, 20, n).astype(float),
        }
    )
    df["relevant"] = (
        (2 * df.cosine_similarity + 0.1 * df.bm25_score + rng.normal(0, 0.5, n)) > 0.5
    ).astype(int)
    return train_test_split(df, test_size=0.2, random_state=seed)


# a plain function: RemoteExecutor.submit() is what runs it as a job
def train_candidate(
    name, model, model_params, trusted_types, parent_run_id, train_df, eval_df
):
    import mlflow
    from mlflow.models import infer_signature
    from sklearn.metrics import f1_score, roc_auc_score

    X_train, y_train = train_df[FEATURES], train_df["relevant"]
    X_eval, y_eval = eval_df[FEATURES], eval_df["relevant"]

    with mlflow.start_run(run_name=name, parent_run_id=parent_run_id) as run:
        mlflow.set_tags({"model_family": name, "compute": "sagemaker-remote"})
        mlflow.log_params(model_params)

        model.fit(X_train, y_train)
        y_proba = model.predict_proba(X_eval)[:, 1]

        model_info = mlflow.sklearn.log_model(
            sk_model=model,
            name="model",
            signature=infer_signature(X_eval, model.predict_proba(X_eval)),
            input_example=X_eval.head(5),
            pyfunc_predict_fn="predict_proba",
            skops_trusted_types=trusted_types,
        )
        metrics = {
            "roc_auc": roc_auc_score(y_eval, y_proba),
            "f1": f1_score(y_eval, (y_proba >= 0.5).astype(int)),
        }
        mlflow.log_metrics(metrics, model_id=model_info.model_id)

    return {
        "name": name,
        "run_id": run.info.run_id,
        "model_uri": model_info.model_uri,
        **metrics,
    }


candidates = {
    "sgd-logreg": {
        "model": make_pipeline(
            StandardScaler(),
            SGDClassifier(loss="log_loss", alpha=1e-4, random_state=42),
        ),
        "params": {"loss": "log_loss", "alpha": 1e-4},
        "trusted_types": [],
    },
    "random-forest": {
        "model": RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42),
        "params": {"n_estimators": 200, "max_depth": 8},
        "trusted_types": ["sklearn.tree._tree.Tree"],
    },
    "gradient-boosting": {
        "model": HistGradientBoostingClassifier(
            learning_rate=0.1, max_iter=200, random_state=42
        ),
        "params": {"learning_rate": 0.1, "max_iter": 200},
        "trusted_types": [
            "sklearn.ensemble._hist_gradient_boosting.predictor.TreePredictor"
        ],
    },
}

train_df, eval_df = make_dummy_data()

with mlflow.start_run(run_name="model-comparison-remote") as parent:
    mlflow.set_tags({"project": "semantic-search", "stage": "model-selection"})
    for df, context, name in [
        (train_df, "training", "pairs-v3-train"),
        (eval_df, "evaluation", "pairs-v3-eval"),
    ]:
        mlflow.log_input(
            mlflow.data.from_pandas(
                df, source=DATA_SOURCE, targets="relevant", name=name
            ),
            context=context,
        )

    with RemoteExecutor(max_parallel_jobs=3, **JOB_SETTINGS) as executor:
        futures = [
            executor.submit(
                train_candidate,
                name,
                c["model"],
                c["params"],
                c["trusted_types"],
                parent.info.run_id,
                train_df,
                eval_df,
            )
            for name, c in candidates.items()
        ]
        results = [f.result() for f in futures]  # waits for all three jobs

best = max(results, key=lambda r: r["roc_auc"])
print(f"best: {best['name']} (roc_auc={best['roc_auc']:.3f})")

# registration stays local: jobs only train and log
model_version = mlflow.register_model(best["model_uri"], REGISTERED_MODEL)
mlflow.MlflowClient().set_registered_model_alias(
    REGISTERED_MODEL, "challenger", model_version.version
)
print(f"registered version {model_version.version} as @challenger")
```

### Job settings

| Setting | Why |
|---|---|
| `instance_type` | Required. The machine the function runs on, for example `ml.g5.xlarge` for a GPU. |
| `role` | The execution role **the job** runs with. Inside SageMaker Studio it defaults to the notebook's role. Anywhere else it's required. |
| `dependencies` | A `requirements.txt` (or conda `environment.yml`) installed before the function runs. |
| `environment_variables` | How the job finds the MLflow App. MLflow reads `MLFLOW_TRACKING_URI` and `MLFLOW_EXPERIMENT_NAME` on its own, so the functions need no `set_tracking_uri`. |
| `s3_root_uri` | Where the pickled function, arguments and results go. The default is the shared SageMaker bucket. A dedicated prefix lets you restrict who can write there (see below). |
| `keep_alive_period_in_seconds` | Keeps the instance in a [warm pool](https://docs.aws.amazon.com/sagemaker/latest/dg/train-warm-pools.html) after the job, so the next job starts in seconds instead of minutes. Warm pool time is billed. |
| `max_runtime_in_seconds` | A hard stop. The default is one day. |
| `tags` | Tags on the training job, for cost allocation. Pass a **dict** (or a list of `{"Key": ..., "Value": ...}`). The v3 signature says `List[Tuple[str, str]]`, but tuples reach the API unchanged and fail with `ParamValidationError: Invalid type for parameter Tags[0]`. |
| `use_spot_instances` + `max_wait_time_in_seconds` | Not used here, but worth it for long jobs that can be retried. |

### Permissions: two roles

There are two IAM roles involved, and they're easy to mix up:

| Role | Used by | Needs |
|---|---|---|
| `role_arn` passed to `MlflowApp.create` | The MLflow App | S3 access to the artifact store, and the SageMaker Model Registry actions for automatic registration |
| `role` in `JOB_SETTINGS` | The training job | `sagemaker:CallMlflowAppApi` on the app, so the job can log to it, plus read/write on `s3_root_uri` |

In a notebook, `get_execution_role()` often returns the same role for both. That's fine to get started, but the job role is the one that runs your code, so it's the one to keep narrow.

### What changes when the code runs remotely

- **Imports go inside the functions.** Each function is pickled and run in a fresh Python process. Imports at the top of the script aren't guaranteed to come with it. Plain constants like `FEATURES` and `DATA_SOURCE` are pickled along with the function.
- **No `set_tracking_uri` or `set_experiment` inside the jobs.** Both come from the environment variables, so the same functions log to a dev or a prod app depending only on `JOB_SETTINGS`.
- **The functions return IDs and metrics, not the model.** The model is already in MLflow. Returning it would pickle it again through S3, and a model trained on a GPU can fail to unpickle on a CPU-only notebook.
- **The DataFrames are passed as arguments**, which works for this dummy data: they're pickled to S3 and loaded in the job. For real datasets, pass the S3 path and read it inside the function, so gigabytes of data don't go through pickle.
- **Exceptions come back too.** If a function raises, the job fails and the same exception is raised locally. If you interrupt the notebook, though, the job keeps running: stop it from the console or with `aws sagemaker stop-training-job`.
- **Local variables are never changed.** Anything a function modifies stays on the remote machine. Only the return value comes back.

### Parallel jobs with `RemoteExecutor`

- **`RemoteExecutor` takes the same settings as `@remote` plus `max_parallel_jobs`.** Here it starts one job per candidate at the same time.
- **`parent_run_id`** attaches each job's run to the parent created locally, even though it runs on another machine. The MLflow UI shows them nested just like section 2.
- **Each job is a separate instance**, so check your account's training-job quota for that instance type before raising `max_parallel_jobs`.
- **The candidates are untrained estimators**, so pickling them as arguments is cheap. Each job trains its own copy.
- **The winner is picked from the returned results**, not with `search_runs`. Every job already sent back its metrics and model URI.
- **Registration stays local.** Jobs only train and log. Deciding what goes into the registry is a separate, deliberate step.

### Keep the S3 prefix private

Everything under `s3_root_uri` is pickled data that the job will load and run. Anyone who can write there can make the next job run their code with the job's role. Use a dedicated prefix, grant write access only to the roles that start jobs, and add an S3 lifecycle rule to expire it: the pickles are tied to your Python and library versions anyway, so they're not useful as long-term storage.

---

## References

- [What is SageMaker managed MLflow](https://docs.aws.amazon.com/sagemaker/latest/dg/mlflow.html)
- [CreateMlflowApp API reference](https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_CreateMlflowApp.html)
- [MLflow App IAM prerequisites](https://docs.aws.amazon.com/sagemaker/latest/dg/mlflow-app-setup-prerequisites-iam.html)
- [Integrate MLflow with your environment](https://docs.aws.amazon.com/sagemaker/latest/dg/mlflow-track-experiments.html)
- [Migrate MLflow tracking servers to serverless MLflow](https://aws.amazon.com/blogs/machine-learning/migrate-mlflow-tracking-servers-to-amazon-sagemaker-ai-with-serverless-mlflow/)
- [Invoke a remote function (`@remote` and `RemoteExecutor`)](https://docs.aws.amazon.com/sagemaker/latest/dg/train-remote-decorator-invocation.html)
- [SageMaker managed warm pools](https://docs.aws.amazon.com/sagemaker/latest/dg/train-warm-pools.html)
- [MLflow datasets](https://mlflow.org/docs/latest/ml/dataset/) / [MLflow models and signatures](https://mlflow.org/docs/latest/ml/model/)
- [MLflow Model Registry and aliases](https://mlflow.org/docs/latest/ml/model-registry/)
- [MLflow scikit-learn flavor](https://mlflow.org/docs/latest/ml/traditional-ml/sklearn/) / [skops persistence](https://skops.readthedocs.io/en/stable/persistence.html)
- Related posts: [LLM: Large Language Models with Semantic Search](../../../2026/09/02/llm-semantic-search.html)
