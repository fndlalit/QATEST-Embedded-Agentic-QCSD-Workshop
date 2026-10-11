# Acceptance Criteria: OTA Firmware Update for BCM-7 (Epic OTA-100)

Criteria tagged **[SAFETY]** trace to a safety requirement and need a verified test case before release (ISO 26262-6). Criteria tagged **[SECURITY]** trace to the cybersecurity concept (UN R155).

---

## AC-01: Preconditions (US-01) [SAFETY]

```gherkin
Scenario: Update refused while the vehicle is moving
  Given the vehicle speed is 30 km/h
  When an update is requested
  Then the update is refused with reason "vehicleMoving"
  And no block is transferred

Scenario: Update refused at low battery voltage
  Given the battery voltage is 10.8 V
  When an update is requested
  Then the update is refused with reason "voltageTooLow"

Scenario: Vehicle starts moving during the update
  Given an update is downloading
  When the vehicle speed becomes greater than 0 km/h
  Then the update is aborted quickly
  And the previous image stays active
```

## AC-02: SecurityAccess (US-02) [SECURITY]

```gherkin
Scenario: Correct key unlocks programming
  Given a seed was requested
  When the tester sends the matching key
  Then programming services are accepted

Scenario: Lockout after repeated wrong keys
  Given 3 wrong keys were sent
  When the tester sends another key
  Then the ECU answers "requiredTimeDelayNotExpired"
  And the lockout lasts 10 minutes
```

## AC-03: Block transfer (US-03)

```gherkin
Scenario: Blocks are accepted in sequence
  Given block 1 was accepted
  When block 2 is received
  Then block 2 is written to the inactive slot

Scenario: A skipped block is rejected
  Given block 1 was accepted
  When block 4 is received
  Then the ECU answers "wrongBlockSequenceCounter"
```

## AC-04: Retry (US-04) [SAFETY]

```gherkin
Scenario: Busy ECU is retried
  Given the ECU answers "busyRepeatRequest"
  When the tester retries
  Then the block is sent again after a backoff delay
  And the delay is never longer than 5 s

Scenario: Programming failure is not retried
  Given the ECU answers "generalProgrammingFailure"
  Then the update fails immediately
  And the fault "U3000-42" is logged

Scenario: Retries are exhausted
  Given the ECU is busy for 4 attempts in a row
  Then the update fails
  And the number of attempts is reported
```

## AC-05: Image verification (US-05) [SAFETY]

```gherkin
Scenario: Corrupted image is rejected
  Given the CRC-32 of the received payload differs from the header
  Then the image is rejected with reason "CRC mismatch"
  And the inactive slot is not bootable

Scenario: Image for another hardware variant is rejected
  Given the image targets "BCM7-H3"
  And the ECU is "BCM7-H2"
  Then the image is rejected
```

## AC-06: Anti-rollback (US-06) [SECURITY]

```gherkin
Scenario: Older image is rejected
  Given version "2.4.10" is installed
  When an image with version "2.4.9" is offered
  Then the image is rejected with reason "Image is not newer than the installed version"

Scenario: Newer image is accepted
  Given version "2.9.0" is installed
  When an image with version "2.10.0" is offered
  Then the image is accepted
```

## AC-07: Activation and rollback (US-07) [SAFETY]

```gherkin
Scenario: Healthy image is committed
  Given the new image was verified
  When the ECU reboots into the new slot and reports healthy
  Then the update state is "committed"

Scenario: Unhealthy image is rolled back
  Given the new image was verified
  When the ECU does not report healthy
  Then the previous slot becomes active
  And the update state is "rolledBack"
  And the rollback completes within 60 s
```

## AC-08: Session handling (US-09)

```gherkin
Scenario: Silent tester loses the session
  Given the programming session is active
  And no transfer is running
  When no frame is received for more than 5 s
  Then the ECU falls back to the default session
  And SecurityAccess is locked again
```

## AC-09: Event logging (US-10)

```gherkin
Scenario: Successful update is reported
  Given an update was committed
  Then the event "U3000-00" is sent to the campaign backend

Scenario: Events survive a power cycle
  Given an event was logged
  When the ECU loses power before the next flush
  Then the event is still reported after restart
```

---

## Stories without acceptance criteria

US-08 (resume), US-11 (progress display) and US-12 (update while charging) have no acceptance criteria yet.
