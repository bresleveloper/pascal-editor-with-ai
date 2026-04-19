# Example Task: Move Kitchen Wall

## Prompt
"move the kitchen north wall out 40cm"

## Expected Plan

1. Resolve reference "kitchen north wall" → wall_kitchen_north
2. Simulate change: wall_kitchen_north end [4, 0] → [4.4, 0]
3. Validate scene
4. If dry-run, stop here. If apply, execute change.

## Expected Impact

- Connected wall: wall_kitchen_west (shared endpoint at [0, 0])
  - If north wall extends, west wall may need adjustment
- Window on wall: window_kitchen_north
  - Window center shifts relative to new wall length
- Zone boundary: zone_kitchen may need polygon update