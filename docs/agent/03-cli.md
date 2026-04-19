# CLI Reference

## `pascal-agent doctor`

Check agent health, providers, and configuration.

```bash
pascal-agent doctor
pascal-agent doctor --json
```

## `pascal-agent models list`

List available model providers.

```bash
pascal-agent models list
pascal-agent models list --json
```

## `pascal-agent models test`

Test a provider's connectivity.

```bash
pascal-agent models test --provider ollama
pascal-agent models test --provider mock --json
```

## `pascal-agent scene summary`

Get a summary of the current scene.

```bash
pascal-agent scene summary --scene ./scene.json --json
```

## `pascal-agent inspect <id>`

Inspect a wall or node by its ID.

```bash
pascal-agent inspect wall_kitchen_north --json
```

## `pascal-agent resolve <reference>`

Resolve an English wall reference to a wall ID.

```bash
pascal-agent resolve "the north wall of the kitchen"
pascal-agent resolve "wall_h1"
```

## `pascal-agent ask <prompt>`

Ask the agent to make a scene edit.

```bash
pascal-agent ask "move the kitchen north wall out 40cm" --dry-run
pascal-agent ask "add a window to the west wall" --provider ollama --json
```

## `pascal-agent validate`

Validate the current scene.

```bash
pascal-agent validate --scene ./scene.json --json
```

## `pascal-agent apply <planPath>`

Apply a plan from a JSON file.

```bash
pascal-agent apply plan.json --json
```