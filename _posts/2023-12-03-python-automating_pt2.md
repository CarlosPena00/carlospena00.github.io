---
layout: post
title: "Python: Automating Your Life - Part 2 - Selenium"
author: Carlos Pena
date: 2022-11-12
---


Selenium WebDriver is an automation tool that allows you to control web browsers to simulate human interactions in web applications.

```py
$ pip install selenium
```

To use the webdriver you need to have a version of the browser installed on your computer or download the driver, for this example, we will use Chrome

For this example, we aim to create automation to:

- Search for a video on YouTube, randomly click on a video from the top 3 and pause its playback after 1 minute

```py
import time
import random

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

driver = webdriver.Chrome()
driver.get('https://www.youtube.com')
```

The key to being able to automate is finding the a way to identify an element (for example a button, a text_input, ...)

To do this, go to the desired page and click on inspect element and look for any of the [following characteristics](https://selenium-python.readthedocs.io/locating-elements.html):

- [ID, NAME, XPATH, LINK_TEXT, PARTIAL_LINK_TEXT, TAG_NAME, CLASS_NAME, CSS_SELECTOR](https://selenium-python.readthedocs.io/locating-elements.html)


```py
def search(query: str) -> bool:
    """
    type a query on youtube and click search

    Equivalent to go:
        https://www.youtube.com/results?search_query=query
    """
    if "youtube" not in driver.current_url:
        return False

    search_bar = driver.find_element(by=By.NAME, value="search_query")
    search_bar.clear()
    time.sleep(0.1)
    search_bar.send_keys(query)
    time.sleep(0.1)
    search_bar.send_keys(Keys.RETURN)
    # Or click into magnifying glass icon
    # driver.find_element(by=By.ID, value="search-icon-legacy").click()
    return True

def click_in_result(n: int=0):
    if not ("youtube" in driver.current_url and 'results' in driver.current_url):
        return False
    results = driver.find_elements(
        by=By.XPATH, value=r'//*[@id="video-title"]/yt-formatted-string'
    )
    results[n].click()

def toggle_play_pause():
    driver.find_element(by=By.CLASS_NAME, value='video-stream').click()

```

Once identified, we will carry out the application logic. After each iteration it is recommended to have a time.sleep to ensure that the page has been loaded

```py
search(query="cannon rock")
time.sleep(1)
video_rank = random.randint(0, 2)
click_in_result(n=video_rank)
time.sleep(60)
toggle_play_pause()
```
