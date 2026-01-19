---
layout: post
title: "Python: Managing Secrets with .env Files"
author: Carlos Pena
date: 2026-01-17
---

## Securely Manage Secrets in Python Projects

Keeping sensitive data (API keys, client secrets, database credentials) out of your codebase is essential for security. Use environment variables and a `.env` file to store secrets, and load them in Python using the `pydantic-settings` package.

### 1. Install the Required Package

```js
uv add pydantic-settings
```

### 2. Define a Settings Class

Create a settings class to load secrets from your `.env` file:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    CLIENT_ID: str
    CLIENT_SECRET: str
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()  # type: ignore
```

### 3. Usage Example

Access your secrets anywhere in your project:

```python
from src.settings import settings

print(settings.CLIENT_ID)
print(settings.CLIENT_SECRET)
```

### 4. Create a `.env` File

Add your secrets to a `.env` file (never commit this file to version control):

```js
CLIENT_ID=your_client_id_here
CLIENT_SECRET=your_client_secret_here
```

- Add `.env` to your `.gitignore`:

### 5. Load .env in Jupyter Notebooks

To use secrets in Jupyter, load the `.env` file with the `dotenv` extension:

```python
%load_ext dotenv
%dotenv

from src.settings import settings
print(settings.CLIENT_ID)
```
