# Active Member

An **active member** is a member of the workspace who has performed at least one
qualifying act within the filter window. Qualifying acts are: authoring or editing
a node, submitting or deciding a proposal, or sending a message in a room thread.

Paused members **remain in the population** — pausing suspends notification and
billing, not membership; a paused member's activity simply falls outside the
window naturally. Excluding them would make the figure jump at pause/unpause
boundaries without any change in actual activity.

## Shape

```shape
kind: metric-definition
population: workspace.members (paused included)
filter: qualifying-act within 90d
grain: member
unit: count
owner: actor:user:christiangruender
state: valid
```

The shape is declared against `.koine/types/metric-definition.schema.json`.
A `unit: rate` variant of this definition MUST declare a `denominator` field —
the schema makes its absence mechanically detectable.
