---
layout: post
title: "Data Engineering: Notes of Designing Data-Intensive Applications"
author: Carlos Pena
date: 2026-11-08
---

# Chapter 10 - Batch Processing

> A system cannot be successful if it is too strongly influenced by a single person.
>
> — Donald Knuth

## Unix Philosophy

- Do one thing and do it well.
- Expect the output of every program to become the input to another, as yet unknown, program.
- Uniform interface: every program reads from `stdin` and writes to `stdout`, so any tool can be piped into any other.
- Inputs are treated as immutable. You can rerun a pipeline as often as you like without side effects.

Limitations:

- Runs on a single machine.
- Multiple inputs/outputs are possible but tricky (a pipe has one input and one output).

## MapReduce / Hadoop

Blunt, brute-force, but effective. Think of it as Unix tools distributed across thousands of machines: a MapReduce job is like a Unix process, and HDFS is like the filesystem.

### HDFS (Hadoop Distributed File System)

- **Shared-nothing principle:** every node in the cluster is an independent machine with its own CPU, RAM and local disks. Nodes don't share memory or storage. The only way they cooperate is by passing messages over an ordinary network, and software handles all the coordination.
- A daemon process (DataNode) runs on each machine and exposes a network service that lets other nodes access the files stored on it.
- A central server (NameNode) keeps track of which file blocks are stored on which machine. It holds only metadata, not the data itself.
- File blocks are replicated on multiple machines, so the failure of one machine doesn't lose data.

### Job Execution

1. Read a set of input files and break them into records.
2. **Map:** call the mapper function to extract a key and a value from each input record.
3. **Sort:** sort all the key-value pairs by key.
4. **Reduce:** call the reducer function to iterate over the sorted key-value pairs.

You only write steps 2 and 4. The framework handles steps 1 and 3.

- **Mapper:** called once for every input record to extract the key-value pair(s). It is stateless, so each record is handled independently.
- **Reducer:** receives all the values that share a key and is called with an iterator over that collection of values.

### Distributed Execution

- The input is split into partitions (usually one per HDFS block), and each mapper processes one partition.
- **Put the computation near the data:** the scheduler tries to run each mapper on a machine that already holds a replica of its input block. Shipping the code is much cheaper than shipping the data.
- **Shuffle:** mapper output is partitioned by a hash of the key, sorted, and copied to the reducers. All values for the same key end up at the same reducer. This is the only step where nodes exchange data, and it is usually the most expensive part of the job.
- **Fault tolerance:** tasks have no side effects, so a failed task is simply re-run on another machine and its partial output is discarded.
