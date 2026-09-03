---
title: Blog
layout: default
order: 2
---
<content>
{% comment %} Tópicos (prefixo do título antes do ":") que NÃO são de programação. Adicione novos aqui: Receitas, Economia, etc. {% endcomment %}
{% assign nonprog = "Economy,Economia,Investimentos,Finanças,Receitas,Cozinha,Culinária,Pessoal,Vida,Saúde,Musica,Música,Music" | split: "," %}
{% comment %} Idioma do post: defina `lang:` no front matter (ex.: `lang: pt-br`). Sem o campo, assume EN. {% endcomment %}
{% assign sort_post = site.posts | sort: 'title' %}

<h2>Programming</h2>
<ul>
    {% for post in sort_post %}
    {% assign topic = post.title | split: ":" | first | strip %}
    {% unless nonprog contains topic %}
    {% assign post_lang = post.lang | default: "EN" | upcase %}
    <li class='list_padding'><a href='{{ site.baseurl }}{{ post.url }}'>{{ post.title }}</a>{% unless post_lang == "EN" %} <span class='lang-tag'>{{ post_lang }}</span>{% endunless %}</li>
    {% endunless %}
    {% endfor %}
</ul>

<h2>Outros PT-BR</h2>
<p>Economia, música, receitas e demais assuntos.</p>
<ul>
    {% for post in sort_post %}
    {% assign topic = post.title | split: ":" | first | strip %}
    {% if nonprog contains topic %}
    <li class='list_padding'><a href='{{ site.baseurl }}{{ post.url }}'>{{ post.title }}</a></li>
    {% endif %}
    {% endfor %}
</ul>

<h2>Some Quotes To Remember</h2>
<ul>
    <li> Without data you’re just a person with an opinion - W. Edwards Deming</li>
    <li> You can't manage what you don't measure, you can't measure what you don't define, you can't define what you don't understand, and you can't understand what you don't manage - W. Edwards Deming?</li>
    <li> A good architect must maximize the number of decisions not made. - Robert C. Martin (Clean Architecture)</li>
    <li>Some decisions are consequential and irreversible (one-way doors) and these decisions must be made methodically, carefully, slowly, with great deliberation and consultation. But most decisions aren't like that, they are changeable, reversible (two-way doors). If you've made a suboptimal decision, you don't have to live with the consequences for that long. You can reopen the door and go back through. - Jeff Bezos (adapted)</li>
    <li>All of your employees are adults and you must trust them. If you don't trust them, it's better to fire than manage. - ?</li>
    <li>Not everyone is an adult</li>
    <li>You can't be more interested than the interested party.</li>

</ul>


</content>
