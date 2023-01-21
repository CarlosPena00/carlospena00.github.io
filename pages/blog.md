---
title: Blog
layout: default
order: 2
---
<content>
{% assign sort_post = site.posts | sort: 'title' %}
{% for post in sort_post %}
<ul>
    <li><a href='{{ site.baseurl }}{{ post.url }}'>{{ post.title }}</a></li>
</ul>
{% endfor %}
</content>
