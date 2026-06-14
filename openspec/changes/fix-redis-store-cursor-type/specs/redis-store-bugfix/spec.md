## ADDED Requirements

### Requirement: Redis cursor type compatibility

`RedisStore.keys()` SHALL use a `string`-typed cursor for the SCAN command to be compatible with ioredis-style Redis clients in versions ^5.0.0 and ^6.0.0.

#### Scenario: keys() uses string cursor
- **WHEN** `keys(pattern)` is called with a valid pattern
- **THEN** the SCAN command is invoked with a `string`-typed cursor
- **AND** the cursor comparison uses string equality (`!== "0"`)

#### Scenario: keys() returns correct results
- **WHEN** `keys("*")` is called on a store with keys `["a", "b", "c"]`
- **THEN** the result contains all matching keys
- **AND** no errors related to cursor type are thrown
