---
layout: post
title: "Python: gRPC"
author: Carlos Pena
date: 2025-03-08
---

For this example we will create a client/server to send an image via gRPC. It will convert the image to BGR and return it.

## Setup

```js
micromamba create -n my_env python=3.12 grpcio-tools opencv-python numpy
```

## Dummy Task

```py
import cv2
import numpy as np


def flip_channel_and_to_bytes(image_bytes: bytes) -> bytes:
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, -1)
    # Dummy operation
    dst = image[..., ::-1]

    _, buffer = cv2.imencode(".png", dst)
    return buffer.tobytes()


def read_images_to_bytes() -> bytes:
    image_path = "image.jpg"
    image = cv2.imread(image_path)
    _, buffer = cv2.imencode(".png", image)
    return buffer.tobytes()


def bytes_to_image(image_data) -> np.ndarray:
    nparr = np.frombuffer(image_data, np.uint8)
    dst = cv2.imdecode(nparr, -1)
    return dst

```
## gRPC Proto

```js
syntax = "proto3";

package image;

service ImageService {
    rpc ProcessImage (ImageRequest) returns (ImageResponse);
}

message ImageRequest {
    bytes image_data = 1;
}

message ImageResponse {
    bytes image_data = 1;
}
```

## gRPC Client


```py
import grpc
import cv2
import image_pb2
import image_pb2_grpc
from process import read_images_to_bytes
from process import bytes_to_image


def run():
    image_data = read_images_to_bytes()

    with grpc.insecure_channel("localhost:50051") as channel:
        stub = image_pb2_grpc.ImageServiceStub(channel)
        response = stub.ProcessImage(image_pb2.ImageRequest(image_data=image_data))

    dst = bytes_to_image(response.image_data)

    output_path = "output.png"
    cv2.imwrite(output_path, dst)
    print(f"Processed image saved as {output_path}")


if __name__ == "__main__":
    run()
```

## gRPC Server
```py
import os
import grpc
from concurrent import futures
import image_pb2
import image_pb2_grpc
from process import flip_channel_and_to_bytes
from loguru import logger


class ImageServiceServicer(image_pb2_grpc.ImageServiceServicer):
    def ProcessImage(self, request, context):
        data = request.image_data
        logger.info(f"Receive Data: {len(data)} {os.getpid()=}")
        dst = flip_channel_and_to_bytes(data)
        logger.info(f"Response Data: {len(dst)} {os.getpid()=}")
        return image_pb2.ImageResponse(image_data=dst)


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    image_pb2_grpc.add_ImageServiceServicer_to_server(ImageServiceServicer(), server)
    server.add_insecure_port("[::]:50051")
    server.start()
    print("Server started on port 50051...")
    server.wait_for_termination()


if __name__ == "__main__":
    serve()

```

## Load Test (Grafana k6)

> sudo apt install k6

```js
import grpc from 'k6/net/grpc';
import { check, sleep } from 'k6';
import encoding from 'k6/encoding';

const client = new grpc.Client();
client.load(['.'], 'image.proto');

export let options = {
    stages: [
        { duration: '1s', target: 200 },
        { duration: '10s', target: 200 }
    ]
};

let image = open('image.jpg', 'b');
let buff = encoding.b64encode(image)


export default function () {
    client.connect('localhost:50051', { plaintext: true });

    let response = client.invoke('image.ImageService/ProcessImage',
        { image_data: buff });

    check(response, {
        'is status OK': (r) => r && r.status === grpc.StatusOK
    });
}

```
