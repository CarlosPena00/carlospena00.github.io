---
layout: post
title: "Python: RabbitMQ"
author: Carlos Pena
date: 2025-03-22
---

Simulate a queue system, which will process a message, being able to process it successfully, perform a retry or send it to DQL

```js
Published: {'message': 'Default msg', 'time': '2025-03-22 18:12:52.352250', 'idx': 0} // OK
Published: {'message': 'Default msg', 'time': '2025-03-22 18:12:52.853598', 'idx': 1} // OK
Published: {'message': 'Default msg', 'time': '2025-03-22 18:12:53.356248', 'idx': 2} // OK, After retry
Published: {'message': 'Default msg', 'time': '2025-03-22 18:12:53.859188', 'idx': 3} // FAIL, DQL
```

# Docker Compose
```js
version: '3'

services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"   # main port
      - "15672:15672" # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: user
      RABBITMQ_DEFAULT_PASS: password
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  rabbitmq_data:
```

# Setup MQ and utils

```py
from enum import Enum
from enum import auto
from typing import Any

import pika

credentials = pika.PlainCredentials("user", "password")
params = pika.ConnectionParameters("localhost", 5672, "/", credentials)

EXCHANGE = ""
RETRY_DELAY_MS = 5000


class AutoName(Enum):
    @staticmethod
    def _generate_next_value_(
        name: str, start: int, count: int, last_values: list[Any]
    ) -> Any:
        _ = start, count, last_values
        return name


class MQChannelName(AutoName):
    DEFAULT = auto()
    RETRY_QUEUE = auto()
    DLQ_QUEUE = auto()


class MQManager:
    _instance = None

    @classmethod
    def instance(cls) -> pika.BlockingConnection:
        if cls._instance is None:
            cls._instance = pika.BlockingConnection(params)
        return cls._instance


def setup_queues():
    connection = MQManager.instance()
    channel = connection.channel()
    channel.queue_declare(queue=MQChannelName.DLQ_QUEUE.name, durable=True)

    # Once published to the RETRY_QUEUE, the message will remain there for RETRY_DELAY_MS.
    # If it is not captured within that time, it will automatically be sent to the DEFAULT queue.
    # There will purposely be no consumer for RETTY_QUEUE so that all messages go to DEFAULT after x seconds.
    channel.queue_declare(
        queue=MQChannelName.RETRY_QUEUE.name,
        durable=True,
        arguments={
            "x-message-ttl": RETRY_DELAY_MS,
            "x-dead-letter-exchange": EXCHANGE,
            "x-dead-letter-routing-key": MQChannelName.DEFAULT.name,
        },
    )
    # Once published to the DEFAULT, if the message recieves an NACK
    # it will automatically be sent to the DLQ
    channel.queue_declare(
        queue=MQChannelName.DEFAULT.name,
        durable=True,
        arguments={
            "x-dead-letter-exchange": EXCHANGE,
            "x-dead-letter-routing-key": MQChannelName.DLQ_QUEUE.name,
        },
    )

    print("Queues created/setup.")
    connection.close()


if __name__ == "__main__":
    setup_queues()

```

# Producer

```py
import json
import time
from datetime import datetime
from typing import Any

import pika

from mq import MQChannelName
from mq import MQManager


def publish_message(body: Any, connection: pika.BlockingConnection):
    channel = connection.channel()

    headers = {"x-retries": 0}
    channel.basic_publish(
        exchange="",
        routing_key=MQChannelName.DEFAULT.name,
        body=json.dumps(body),
        properties=pika.BasicProperties(headers=headers),
    )
    print(f"Published: {body}")


if __name__ == "__main__":
    connection = MQManager.instance()

    for idx in range(4):
        message = {
            "message": "Default msg",
            "time": str(datetime.now()),
            "idx": idx,
        }
        publish_message(message, connection=connection)
        time.sleep(0.5)
    connection.close()
```

# Consumer

```py
import json
from datetime import datetime

import pika

from mq import MQChannelName
from mq import MQManager

MAX_RETRIES = 3


def consume_with_retry():
    def callback(ch, method, properties, body):
        print(datetime.now(), method.routing_key, "*" * 88)
        headers = properties.headers or {}
        retries = headers.get("x-retries", 0)
        try:
            data = json.loads(body)
            print(f"Received: {data}, Retry #: {retries}")
            if (data["idx"] > 1 and retries == 0) or (data["idx"] >= 3 and retries > 0):
                raise Exception("Simulated processing error")
            print(data["idx"], " Done!")
            ch.basic_ack(delivery_tag=method.delivery_tag)

        except Exception as e:
            print(f"Processing error: {e}")
            if retries < MAX_RETRIES:
                new_headers = headers.copy()
                new_headers["x-retries"] = retries + 1
                ch.basic_publish(
                    exchange="",
                    routing_key=MQChannelName.RETRY_QUEUE.name,
                    body=body,
                    properties=pika.BasicProperties(headers=new_headers),
                )
                print(f"Requeued for retry #{retries + 1}")
                # Even though the message was processed with failure,
                # as we inserted it into a new queue,
                # we must return an ACK for the original message,
                # otherwise the message would be processed again in the DEFAULT queue.
                ch.basic_ack(delivery_tag=method.delivery_tag)

            else:
                print("Exceeded retries. Sending to DLQ.")
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    connection = MQManager.instance()
    channel = connection.channel()

    channel.basic_consume(
        queue=MQChannelName.DEFAULT.name, on_message_callback=callback
    )
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        print("Stopped by user")
        connection.close()


if __name__ == "__main__":
    consume_with_retry()
```

- To consume from DQL: `channel.basic_consume(queue=DLQ_QUEUE, on_message_callback=callback_dql)`


# Consumer Logs

```js
2025-03-22 18:14:53.110677 DEFAULT *************************************************************
Received: {'message': 'Default msg', 'time': '2025-03-22 18:12:52.352250', 'idx': 0}, Retry #: 0
0  Done!
2025-03-22 18:14:53.110812 DEFAULT *************************************************************
Received: {'message': 'Default msg', 'time': '2025-03-22 18:12:52.853598', 'idx': 1}, Retry #: 0
1  Done!
2025-03-22 18:14:53.110898 DEFAULT *************************************************************
Received: {'message': 'Default msg', 'time': '2025-03-22 18:12:53.356248', 'idx': 2}, Retry #: 0
Processing error: Simulated processing error
Requeued for retry #1
2025-03-22 18:14:53.111116 DEFAULT *************************************************************
Received: {'message': 'Default msg', 'time': '2025-03-22 18:12:53.859188', 'idx': 3}, Retry #: 0
Processing error: Simulated processing error
Requeued for retry #1
2025-03-22 18:14:58.116101 DEFAULT *************************************************************
Received: {'message': 'Default msg', 'time': '2025-03-22 18:12:53.356248', 'idx': 2}, Retry #: 1
2  Done!
2025-03-22 18:14:58.116329 DEFAULT *************************************************************
Received: {'message': 'Default msg', 'time': '2025-03-22 18:12:53.859188', 'idx': 3}, Retry #: 1
Processing error: Simulated processing error
Requeued for retry #2
2025-03-22 18:15:03.119723 DEFAULT *************************************************************
Received: {'message': 'Default msg', 'time': '2025-03-22 18:12:53.859188', 'idx': 3}, Retry #: 2
Processing error: Simulated processing error
Requeued for retry #3
2025-03-22 18:15:08.123252 DEFAULT *************************************************************
Received: {'message': 'Default msg', 'time': '2025-03-22 18:12:53.859188', 'idx': 3}, Retry #: 3
Processing error: Simulated processing error
Exceeded retries. Sending to DLQ.
```
