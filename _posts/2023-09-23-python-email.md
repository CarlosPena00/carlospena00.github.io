---
layout: post
title: "Python: Send e-mail"
author: Carlos Pena
date: 2023-09-23
---

Example of how to send an email in Python.

Some providers (such as Gmail) will require more complex authentication steps.

At the time of writing this code, the test was successfully conducted using Outlook/Hotmail.

```py
import smtplib
from email.mime.text import MIMEText


def send_email(
    subject: str,
    body: str,
    sender: str,
    password: str,
    recipients: list[str],
    # Default host for outlook/hotmail
    smtp_host: str = "smtp-mail.outlook.com",
    # Default port for outlook/hotmail
    smtp_port: int = 587,
) -> bool:
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)
    with smtplib.SMTP(smtp_host, smtp_port) as smtp_server:
        smtp_server.starttls()
        smtp_server.login(sender, password)
        ret = smtp_server.sendmail(sender, recipients, msg.as_string())
    success = len(ret) == 0  # No errors
    return success


send_email(
    subject="The Subject of your email :D",
    body="The body of your email. body!",
    sender="your-email@hotmail.com",
    password="your-pass",
    recipients=["your-recipient01@gmail.com"],
)
```
