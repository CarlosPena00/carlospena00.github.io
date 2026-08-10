---
name: Carlos Henrique Caloete Pena
header:
  - text: |
      <span style="font-size: 1.2em; font-weight: bold;">Lead Data Engineer</span>
  - text: <span class="iconify" data-icon="tabler:phone"></span> (+55) 81 9 9168-5843
    newLine: true
  - text: <span class="iconify" data-icon="tabler:mail"></span> carloshenriquecpena@gmail.com
    link: mailto:carloshenriquecpena@gmail.com
  - text: <span class="iconify" data-icon="tabler:mail"></span> chcp@cin.ufpe.br
    link: mailto:chcp@cin.ufpe.br
  - text: <span class="iconify" data-icon="tabler:brand-linkedin"></span> in/chcp
    link: https://linkedin.com/in/chcp
    newLine: true
  - text: <span class="iconify" data-icon="tabler:brand-github"></span> CarlosPena00
    link: https://github.com/CarlosPena00
  - text: <span class="iconify" data-icon="charm:person"></span> carlospena.com.br
    link: https://carlospena.com.br
  - text: <span class="iconify" data-icon="tabler:map-pin"></span> Recife, Brazil · Brazilian/Portuguese citizenship (EU work authorization)
    newLine: true
---

## Summary

Lead Data Engineer with 8+ years and an M.Sc. in Computer Science (UFPE, GPA 4.0/4.0). Currently leading a multi-squad R&D group that spans both sides of the data/AI boundary: dimensional warehouses and event-driven services alongside computer vision and LLM systems, all running in production at retail scale.


## Experience

**Ferreira Costa**
  ~ Top 5 Retail/E-commerce in Brazil
  ~ Recife, Brazil · Jul 2021 - Present

**Lead Data Engineer**
  ~ Apr 2025 - Present

- **Lead** 6 cross-functional agile squads (~17 data engineers, data scientists, and backend developers) across data platform, computer vision, search, and generative AI, owning delivery alignment with Product Owners plus hiring, performance reviews, and career development.
- **Migrated** enterprise analytics off a legacy **Oracle** system into **BigQuery**, decoupling reporting from the operational database.
- **Modeled** the warehouse as Kimball star schemas across Bronze/Silver/Gold layers: 30+ models spanning conformed dimensions (branch, category, product, customer, date) over sales, inventory, and pricing facts, orchestrated with **SQLMesh** and **Dagster** with continuous testing, schema contracts, and lineage. Now extending into operational workflows, starting with automated price calculation (in development).
- **Shipped** **semantic search** for long-tail queries using AWS SageMaker-hosted embeddings, increasing CTR by +3.4 pp (+9.6% relative) with no material impact on response latency.
- **Built and scaled** the product **catalog** platform from initial design (MongoDB, RabbitMQ) to an event-driven architecture (FastAPI, FastStream) centralizing inventory, pricing, and media, with Google Merchant Center integration; load-tested (k6) to 55 req/s per pod.
- **Delivered** a secure FastAPI/FastMCP platform exposing enterprise data (Oracle, GCP, internal APIs) to LLM agents via MCP interfaces, with authentication, rate limiting, and governance controls, giving ~36 internal users self-service access without direct database exposure.

**Data Engineer Specialist**
  ~ Jun 2024 - Mar 2025

- **Led** four agile squads (12-15 data engineers, data scientists, and backend developers) in **R&D** of computer vision and generative AI solutions, translating high-level business objectives into technical roadmaps with Product Owners.
- **Architected** an image processing pipeline combining generative AI, deep learning, and traditional computer vision on AWS SageMaker (Python, OpenCV, FastAPI) for hands-off product media enhancement and quality control.
- **Built** chatbots and workflows using Generative AI with RAG, orchestrated via n8n.

**Senior Data Engineer**
  ~ Jul 2021 - May 2024

- **Engineered** a 24/7 **Shipping System** capable of handling over 13K concurrent users during peak events like Black Friday, with integrated observability and a stack of Python, Oracle, PostgreSQL, Redis, and AWS (ECR, EKS, S3).
- **Designed** and maintained **query acceleration layers** (materialized views, scheduled jobs, Redis caches) and **workflow orchestration** with Dagster.
- **Oversaw** CI/CD for 19 production deployments (APIs, workers, and DAGs) using GitLab CI/CD, AWS, and Rancher.
- **Built** a custom **product search engine** using Elasticsearch, ranked on Google Analytics behavioral signals, reaching 41.8% search-page CTR on head queries and 31.4% on tail queries.


**NCR** (formerly OKI Brasil)
  ~ Banking automation and self-service technology
  ~ Recife, Brazil

**Data Scientist**
  ~ Jun 2018 - Jun 2021

- **Designed** image quality measures for capturing ID photos (facial close-up) in compliance with ICAO standards.
- **Researched and prototyped** computer vision and deep learning solutions.
- **Presented** weekly progress to administrative and technical stakeholders at NCR São Paulo, leading discussions on emerging AI techniques and defining next steps from new requirements and system limitations.


**RobôCIn - UFPE**
  ~ Student robotics research group
  ~ Recife, Brazil

**Co-founder**
  ~ 2015 - 2021

- **Led** research teams applying deep learning and reinforcement learning to autonomous robot soccer at UFPE's Centro de Informática (see [~P2]).
- **Engineered** vision and control systems (OpenCV, ROS, Qt), including a human-size domestic robot for the RoboCup@Home category.


## Education

**Universidade Federal de Pernambuco (UFPE)**
  ~ Recife, Brazil

Master of Science in Computer Science - GPA 4.0/4.0
  ~ Graduated Oct 2022

- Thesis: Segmentation of medical images (Advisor: Tsang Ing Ren); see [~P1]

**Universidade Federal de Pernambuco (UFPE)**
  ~ Recife, Brazil

Bachelor of Science in Computer Engineering - GPA 8.67/10 (2nd in class)
  ~ Graduated Dec 2019


## Publications

[~P1]: **[An Ensemble Learning Method for Segmentation Fusion](https://doi.org/10.1109/IJCNN55064.2022.9892717)**

    <u>Carlos H. C. Pena</u>, Tsang Ing Ren, Pedro D. Marrero Fernandez, Fidel A. Guerrero-Peña, Alexandre Cunha

    *International Joint Conference on Neural Networks (IJCNN), 2022*

[~P2]: **[An Analysis of Reinforcement Learning Applied to Coach Task in IEEE Very Small Size Soccer](https://ieeexplore.ieee.org/abstract/document/9307069)**

    <u>Carlos H. C. Pena</u>, M. G. Machado, M. S. Barros, J. D. P. Silva, L. D. Maciel, T. Ing Ren, E. N. S. Barros, P. H. M. Braga, H. F. Bassani

    *Latin American Robotics Symposium (LARS), 2020*


## Skills

**Programming Languages:** Python, SQL, PL/SQL, C/C++

**AI and Machine Learning:** Computer Vision, Deep Learning, Machine Learning, PyTorch, Generative AI, RAG, OpenCV, MCP

**Data and Cloud:** AWS (EKS, SageMaker, ECR, S3), GCP (BigQuery), Oracle, PostgreSQL, Elasticsearch, MongoDB, Redis, RabbitMQ, Dagster (Airflow equivalent), SQLMesh (dbt equivalent), Pandas, Polars

**Tools and Practices:** Git, GitLab CI/CD, Docker, Kubernetes, Rancher, FastAPI, FastStream, n8n, k6, Agile/Scrum

**Leadership:** Hiring and mentoring, performance management, stakeholder alignment, cross-functional delivery

**Spoken Languages:** Portuguese (native), English (full professional proficiency)


## Awards and Honors

**IT Professional of the Year**, FerreiraCosta/FCxLabs
  ~ 2023

**1st Place Team**, Microsoft College Code Competition UFPE
  ~ 2019

**Latin American IEEE Very Small Size Soccer**, top-5 finishes across multiple years
  ~ 2017, 2020


## Certifications

- Data Engineering Specialization (DeepLearning.AI / AWS, 2025): Data Storage and Queries; Data Modeling, Transformation, and Serving; Source Systems, Data Ingestion, and Pipelines; Introduction to Data Engineering (coursework includes Apache Spark, AWS Glue)
- Claude Certified Architect - Foundations (Anthropic, 2026); Kafka (Alura, 2023); Retrieval Augmented Generation (DeepLearning.AI, 2025); LlamaIndex: creating a chatbot with the RAG technique (Alura, 2024)
- Agile Management Practices SC-AMP (Agile Institute Brazil, 2022); Scrum (Alura, 2022)
