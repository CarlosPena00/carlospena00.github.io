---
title: Blog
layout: default
order: 2
---
<content>
<ul>
    {% assign sort_post = site.posts | sort: 'title' %}
    {% for post in sort_post %}
    <li class='list_padding'><a href='{{ site.baseurl }}{{ post.url }}'>{{ post.title }}</a></li>
    {% endfor %}
</ul>

<h2>Sandboxes</h2>
List of repositories with minimal examples of some application/library

<ul>
    <li class='list_padding'><a href='https://github.com/CarlosPena00/sandbox_celery'>Python - Celery</a></li>
    <li class='list_padding'><a href='https://github.com/CarlosPena00/sandbox_kafka'>Python - Kafka</a></li>
    <li class='list_padding'><a href='https://github.com/CarlosPena00/sandbox_rabbitmq'>Python - RabbitMQ</a></li>
</ul>

</content>
