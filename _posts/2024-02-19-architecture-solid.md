---
layout: post
title: "Architecture: SOLID"
author: Carlos Pena
date: 2024-02-19
---

The idea of ​​this article is not to explain SOLID, but rather to show examples and counter-examples of the principles to make it easier to remember.

## Single Responsibility Principle (SRP):

- A module should be responsible to one, and only one, actor. - Martin, Robert C.


## Open/Closed Principle (OCP):

## Liskov Substitution Principle (LSP):

## Interface Segregation Principle (ISP):

## Dependency Inversion Principle (DIP)

- Depend on abstractions, not on concretions
  - Especially, do not depend on (concrete and volatile)
- Avoid using override on concrete methods


```c++
#include <iostream>

class Ventilator {
public:
    bool isOn;

    void turnOn() {
        isOn = true;
    }

    void turnOff() {
        isOn = false;
    }
};


class Switch {
private:
    Ventilator ventilator;
    // it should also work with light bulb, air conditioning, ...
    // however the `Ventilator` is ensured


public:
    void activate() {
        if (!ventilator.isOn)
            ventilator.turnOn();
        else
            ventilator.turnOff();
    }
};
```

```c++
class Device
{
public:
    virtual ~Device() = default;
    virtual bool isOn() const = 0;
    virtual void activate() = 0;
    virtual void turnOn() = 0;
    virtual void turnOff() = 0;
};

// class Lamp : public Device
// class AirConditioner : public Device
class Ventilator : public Device
{
private:
    bool isTurnedOn;

public:
    Ventilator() : isTurnedOn(false) {}

    bool isOn() const override
    {
        return isTurnedOn;
    }

    void activate() override
    {
        if (!isTurnedOn)
            turnOn();
        else
            turnOff();
    }

    void turnOn() override
    {
        isTurnedOn = true;
    }

    void turnOff() override
    {
        isTurnedOn = false;
    }
};

class Switch
{
private:
    Device *device;

public:
    Switch(Device *device) : device(device) {}

    void activateDevice()
    {
        device->activate();
    }
};
```

code adapted from: https://medium.com/@tbaragao/solid-d-i-p-dependency-inversion-principle-e87527f8d0be
