---
layout: post
title: "Python: Simple Concurrency"
author: Carlos Pena
date: 2022-11-13
---

I came here to add something to [Giovanni Carvalho's](https://giovannipcarvalho.github.io/2019/01/28/python-concurrency.html) post.

# I/O-bound

As an I/O-bound example we use 20 get requests to the site 'http://example.org'. As a baseline we have the time with sequential requests arround 3.88 seconds.

```py
import requests # for making http requests

results = [requests.get('http://example.org') for _ in range(20)]
# 3.88 s ± 23.7 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
```

As recommended by Giovanni, the `concurrent.futures` library is one of the fastest and simplest ways to accomplish concurrency.

```py
import concurrent.futures

with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
    futures = [executor.submit(requests.get, 'http://example.org') for _ in range(20)]
    results = [j.result() for j in concurrent.futures.as_completed(futures)]
# 341 ms ± 166 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
```

Another way to do it is using the [pqdm](https://pypi.org/project/pqdm/) library.
We can summarize the library in (TQDM progress bar + parallelism)

```py
from pqdm.threads import pqdm

inputs = ['http://example.org'] * 20
results = pqdm(inputs, requests.get, n_jobs=20)
# 392 ms ± 134 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
```

<img  src="../../../assets/images/pqdm_sample.png" alt="PQDM output" width="100%">

Finally, another way is using asynchronous calls, previously, the request library had its own asynchronous call module. However, the module has been converted into the grequests library.

```py
import grequests

urls = ['http://example.org'] * 20
rs = (grequests.get(u) for u in urls)
results = grequests.map(rs)
# 300 ms ± 60 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
```

# CPU-Bound

In the previous step, we will use the get request as an I/O example. For the CPU-Bound example, we create the `cpu_bound` function that calculates the number of the Fibonacci sequence twice (without cache). The numbers 34 and 30 were chosen so that the total time of the function would be approximately one second (with this Ryzen 5 5600x).

```py
def _slow_fibonacci(n):
    if n in {0, 1}:
        return n
    return _slow_fibonacci(n - 1) + _slow_fibonacci(n - 2)

def cpu_bound():
    result = _slow_fibonacci(34) + _slow_fibonacci(30)
    return result

cpu_bound()
# 998 ms ± 6.88 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
```

As expected, running 20 times takes ± 20 seconds.

```py
results = [cpu_bound() for _ in range(20)]
# 19.9 s ± 48.9 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
```

Also, threads probably won't help. In python only one thread can be running at a time.

```py
with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
    futures = [executor.submit(cpu_bound) for _ in range(20)]
    results = [j.result() for j in concurrent.futures.as_completed(futures)]
# 24.2 s ± 593 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
```

And processes? It depends, if you are on a jupyter notebook it's probably not going to be very easy to get it working (at least for now, and especially on windows)

The following results were run in .py files, their evaluation time was using 'real' time `time python file_name.py`. And because of that, there was a certain initialization/load overhead. In both experiments, 100% of the CPU was used.

```py
from pqdm.processes import pqdm

inputs = [1] * 20
# As PQDM uses the input size to know the number of iterations,
# it was necessary to use a list with N values and add a dummy
# parameter in the cpu_bound function.
results = pqdm(inputs, cpu_bound, n_jobs=20)
# real	0m3,446s
```

```py
import concurrent.futures
with concurrent.futures.ProcessPoolExecutor(max_workers=20) as executor:
    futures = [executor.submit(cpu_bound) for _ in range(20)]
    results = [j.result() for j in concurrent.futures.as_completed(futures)]
# real	0m3,472s
```

Now yes! A decreasing in total runtime from ± 20s to ± 3.5s
