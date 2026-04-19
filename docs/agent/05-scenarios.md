# Example Scenarios

## 1. Inspect a Wall

```bash
pascal-agent inspect wall_kitchen_north --json
```

Returns: wall ID, start/end points, length, angle, thickness, height, sides, openings.

## 2. Resolve Wall Reference

```bash
pascal-agent resolve "the north wall of the kitchen"
```

Returns: matched wall ID with confidence score and reason.

## 3. Dry-run Wall Move

```bash
pascal-agent ask "move the kitchen north wall out 40cm" --dry-run
```

Returns: impact report showing connected walls, openings affected, zone boundary changes.

## 4. Add a Window

```bash
pascal-agent ask "add a window to the west wall" --dry-run
```

Returns: simulation of window placement on the target wall.

## 5. Detect Ambiguity

```bash
pascal-agent resolve "the wall"
```

Returns: ambiguous result with multiple candidates and their confidence scores.

## 6. Validate Impacted Walls

```bash
pascal-agent validate --json
```

Returns: validation issues including zero-length walls, orphans, and bounds violations.