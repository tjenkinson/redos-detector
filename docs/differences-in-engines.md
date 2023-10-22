# Differences In Engines

Different regex engines behave in different ways.

## Example 1

Behaviors for unmatched capturing groups differ. In JS, a backreference to an unmatched capturing groups is equivalent to the empty string (epsilon), but in Python it's equivalent to the empty set (as in, reject all).

### JS

```js
$ /^(?:(a)|b)\1$/.test("b")
true
```

### Python

```python
$ re.match(r"^(?:(a)|b)\1$", "b") is not None
False
```

## Example 2

This behaves differently because the captured text is reset in JS but not in Python.

### JS

```js
$ /^(?:(a)|\1\1){2}$/.test("a")
true

$ /^(?:(a)|\1\1){2}$/.test("aaa")
false
```

### Python

```python
$ re.match(r"^(?:(a)|\1\1){2}$", "a") is not None
False

$ re.match(r"^(?:(a)|\1\1){2}$", "aaa") is not None
True
```
