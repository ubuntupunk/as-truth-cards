# Identity Retrojection Cluster

The four new cards form a deliberately paired graph cluster rather than a pair of opposing verdicts.

## Cards

1. **Jesus Is a Muslim** — retrospective theological identity.
2. **Jesus Was a Palestinian** — retrospective national/geographical identity.
3. **Muhammad Was a Zionist** — retrospective modern political identity.
4. **The Land of the Children of Israel** — primary-source/reference node.

## Principal mechanism

`RETROSPECTIVE_IDENTITY` / `ANACHRONISM`

The graph should ask whether a modern category is being projected backwards onto a historical figure, and whether the underlying source actually supports that category or only a related proposition.

## Key separation

Do not collapse these propositions:

- Jesus is described within Islamic theology.
- Jesus is historically classified as belonging to a modern Muslim identity.
- Jesus is historically classified as Palestinian in the modern national sense.
- The Qur'an refers to the Children of Israel and land associated with them.
- Muhammad therefore held the modern political ideology of Zionism.

Each proposition is a separate claim node with its own evidence requirements.

## Graph relationships

```text
Jesus Is a Muslim
  ├── DERIVED_FROM → Islamic theological sources
  ├── RELATED → Jesus Was a Palestinian
  └── CONTEXTUALISES → Retrospective Identity

Jesus Was a Palestinian
  ├── RELATED → Jesus Is a Muslim
  └── CONTEXTUALISES → Ancient geography / modern national identity

Muhammad Was a Zionist
  ├── DERIVED_FROM → The Land of the Children of Israel
  └── CHALLENGES → Retrospective Identity

The Land of the Children of Israel
  ├── SUPPORTS → claims about Qur'anic textual content
  └── CONTEXTUALISES → Muhammad Was a Zionist
```

The final relationship between the source card and the Muhammad card must not be encoded as `SUPPORTS` unless the editorial evidence actually establishes the modern political conclusion. At the initial migration stage it should remain contextualising/derived-from.
