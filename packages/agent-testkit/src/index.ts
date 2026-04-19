/**
 * @pascal/agent-testkit
 * Test fixtures, scenario harnesses, deterministic model stubs, matchers, golden tests.
 */

export { MockProvider } from '@pascal/agent-models'
export {
  complexWallFixture,
  createEmptyScene,
  createMinimalScene,
  kitchenFixture,
  multiLevelFixture,
  SceneApi,
} from '@pascal/scene-api'

export {
  createScenarioHarness,
  type ScenarioExpected,
  type ScenarioHarness,
  type ScenarioInput,
} from './harness/scenario-harness'
export { matchImpactEntries, matchValidationIssues, matchWallResult } from './matchers/matchers'
export { type Scenario, scenarios } from './scenarios/index'
