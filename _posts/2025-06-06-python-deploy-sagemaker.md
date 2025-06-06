---
layout: post
title: "Python: Deploy custom model to AWS SageMaker"
author: Carlos Pena
date: 2025-05-27
---

In this post, I’ll walk you through how to deploy a custom sync/asynchronous inference endpoint on AWS SageMaker using a FastAPI server wrapped in a lightweight Docker container.

# Synchronous Inference (Real-Time Endpoints) vs Asynchronous Inference (Async Endpoints)

When deploying machine learning models to production with SageMaker, one of the key architectural decisions is choosing between synchronous and asynchronous inference modes. It directly impacts throughput, latency, cost, timeout behavior, and scalability strategy.

- In synchronous mode, SageMaker provisions and keeps a dedicated EC2 instance running 24/7, regardless of whether your endpoint is receiving traffic. This guarantees low-latency responses, but it also means you're paying continuously even when idle.
- In asynchronous inference uses a provision-on-demand model: SageMaker spins up infrastructure only when a request is received. This makes it significantly more cost-efficient for sporadic or bursty workloads, since you’re billed primarily for actual inference time.

### Cold Start Latency
The downside of async mode is cold start latency. If your endpoint has been idle for a while, the first request may incur several minutes of delay while SageMaker initializes containers and provisions compute resources. For some applications, this trade-off is completely acceptable. For others especially latency-sensitive ones it’s a deal-breaker.

- Choose synchronous mode when you need always-on, fast responses.
- Choose async mode when you want to minimize idle costs and can tolerate occasional cold starts.

# Required files

```py
# server.py
import time

import uvicorn
from fastapi import FastAPI
from fastapi import Form
from loguru import logger

app = FastAPI()


@app.get("/ping")
async def ping() -> dict[str, str]:
    return {
        "status": "ok",
        "message": "API is healthy.",
    }


@app.post("/invocations")
async def invocations(
    id: str = Form(...),
    request_id: str = Form(...),
) -> str:
    logger.info(f"{request_id}, {id}, starting dummy process")
    time.sleep(1) # your model
    logger.info(f"{request_id}, {id}, ending dummy process")
    # In sync mode: the endpoint should return the model response
    # In async mode: the endpoint should return just an ack,
    #                and the real response will be delivered via SNS
    return "ok"


if __name__ == "__main__":
    uvicorn.run("serve:app", host="0.0.0.0", port=8080)
```


```js
# Dockerfile
FROM python:3.12-slim-bookworm

ENV \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PYTHONHASHSEED=random \
    PIP_DEFAULT_TIMEOUT=100 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# venv
RUN python -m venv /venv
ENV PATH=/venv/bin:$PATH

COPY requirements.txt .
RUN pip install -r requirements.txt

WORKDIR /src
COPY src .

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port 8080"]
```

# Deploy

1) Build/Tag local

```sh
docker build -f Dockerfile -t dummy-inference .
# Test it
docker run --network=host dummy-inference:latest
curl http://localhost:8080/ping
curl -X 'POST' 'http://localhost:8080/invocations' -H 'accept: application/json' \
  -H 'Content-Type: application/x-www-form-urlencoded' -d 'id=abc&request_id=def'

```

2) Publish to AWS-ECR

```sh
docker tag dummy-inference:latest <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/dummy-inference:latest
docker push <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/dummy-inference:latest
```

- How to get aws_account_id

```py
# Inside AWS-SageMaker notebooks
import boto3
sts = boto3.client("sts")
account_id = sts.get_caller_identity()["Account"]
```


3) Link ECR-Image to Sagemaker-Model

```py
import boto3
import sagemaker

image_name = "dummy-inference"
model_name = image_name + "-model"
endpoint_name = image_name + "-endpoint"

sts = boto3.client("sts")
account_id = sts.get_caller_identity()["Account"]
image_uri = f"{account_id}.dkr.ecr.us-east-1.amazonaws.com/{image_name}:latest"

role = sagemaker.get_execution_role()
model = sagemaker.Model(image_uri=image_uri, role=role, name=model_name)
```

- If async

```py
from sagemaker.async_inference import AsyncInferenceConfig

async_output_path = f"s3://{bucket}/async-output/"
async_config = AsyncInferenceConfig(
    output_path=async_output_path,
    max_concurrent_invocations_per_instance=1
    #notification_config=... # configure SNS

)
```

4) Create endpoint configurations and endpoint

```py
predictor = model.deploy(
    initial_instance_count=1,
    instance_type="ml.t2.medium", # One of cheapest machine just for test
    endpoint_name=endpoint_name,
    # async_inference_config=async_config,
)
```

5) Test the endpoint

## Sync

```py
import boto3
import urllib.parse

payload = urllib.parse.urlencode(
    {
        "id": "sku-12345",
        "request_id": "req-003",
    }
)

client = boto3.client("sagemaker-runtime", region_name="us-east-1")
response = client.invoke_endpoint(
    EndpointName="dummy-inference-endpoint", # or sync
    ContentType="application/x-www-form-urlencoded",
    Body=payload,
)

print(response["ResponseMetadata"]["HTTPStatusCode"])
print(response["Body"].read().decode())
```


## Async

- TODO: invoke_endpoint_async
