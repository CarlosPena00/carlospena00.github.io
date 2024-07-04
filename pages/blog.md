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

<h2>Some Quotes To Remember</h2>
<ul>
    <li> Without data you’re just a person with an opinion - W. Edwards Deming</li>
    <li> You can't manage what you don't measure, you can't measure what you don't define, you can't define what you don't understand, and you can't understand what you don't manage - W. Edwards Deming?</li>
    <li> A good architect must maximize the number of decisions not made. - Robert C. Martin (Clean Architecture)</li>
    <li>Some decisions are consequential and irreversible (one-way doors) and these decisions must be made methodically, carefully, slowly, with great deliberation and consultation. But most decisions aren't like that, they are changeable, reversible (two-way doors). If you've made a suboptimal decision, you don't have to live with the consequences for that long. You can reopen the door and go back through. - Jeff Bezos (adapted)</li>
    <li>All of your employees are adults and you must trust them. If you don't trust them, it's better to fire than manage. - ?</li>
    <li>Not everyone is an adult</li>

</ul>


</content>
