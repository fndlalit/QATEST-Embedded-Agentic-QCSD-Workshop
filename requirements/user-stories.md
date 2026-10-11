# User Stories: OTA Firmware Update for BCM-7 (Epic OTA-100)

Stories are written from the point of view of the role that benefits. "Tester" means the diagnostic tester role played by the vehicle gateway.

---

## US-01: Start an update only in a safe vehicle state

**As a** vehicle owner
**I want** the update to start only when my vehicle is safely parked
**So that** vehicle functions I rely on are not disturbed while driving

**Notes**
- Preconditions: speed is 0 km/h, ignition on, battery voltage at least 9.0 V.
- The update is refused with a clear reason when a precondition fails.
- Safety relevance: ASIL B.

## US-02: Unlock programming with SecurityAccess

**As a** security engineer
**I want** programming services to be available only after a successful seed and key exchange
**So that** no unauthorised party can write firmware

**Notes**
- After 5 failed key attempts the ECU locks for 10 minutes.
- Requesting a new seed starts a fresh attempt count.
- Security relevance: UN R155.

## US-03: Transfer the image in blocks

**As a** tester
**I want** to transfer the firmware image in numbered blocks
**So that** a lost block can be detected and sent again

**Notes**
- Block sequence counter starts at 1 and wraps from 0xFF to 0x00.
- The ECU accepts a repeated block with the same counter as the last accepted one.
- Negotiated block length comes from the RequestDownload response.

## US-04: Retry a failed block

**As a** tester
**I want** a failed block transfer to be retried automatically
**So that** a short disturbance on the bus does not abort the whole update

**Notes**
- Up to 3 retries with exponential backoff and jitter.
- Retry on busyRepeatRequest, responsePending and transport timeouts.
- Do not retry securityAccessDenied, requestOutOfRange, wrongBlockSequenceCounter, generalProgrammingFailure, uploadDownloadNotAccepted or voltageTooLow.
- The ECU may mark a response as retryable. The tester follows that mark.

## US-05: Verify the image before activation

**As a** safety engineer
**I want** the image verified before it can become active
**So that** a corrupted or manipulated image never runs

**Notes**
- Check CRC-32 over the payload, signature, hardware variant and version.
- The image is marked bootable once the last block has been written.
- Safety relevance: ASIL B.

## US-06: Reject older firmware

**As a** security engineer
**I want** an image that is not newer than the installed one to be rejected
**So that** a known vulnerability cannot be reintroduced

**Notes**
- Versions follow MAJOR.MINOR.PATCH.

## US-07: Activate and roll back automatically

**As a** vehicle owner
**I want** my vehicle to return to the previous firmware if the new one does not start correctly
**So that** I am never left with a vehicle that does not work

**Notes**
- The bootloader gives the new slot 3 boot attempts.
- If the new image does not report healthy, the previous slot becomes active again.
- Safety relevance: ASIL B.

## US-08: Resume after an interruption

**As a** vehicle owner
**I want** an interrupted update to continue later
**So that** I do not have to start again after switching the ignition off

**Notes**
- After an interruption the update restarts from the first block.

## US-09: Keep the diagnostic session alive

**As a** tester
**I want** the programming session to stay open during a long transfer
**So that** the ECU does not fall back to the default session mid-update

**Notes**
- The session falls back to default after S3 = 5 s without tester activity.
- TesterPresent keeps the session alive.
- The S3 timer is suspended while a transfer is active.

## US-10: Log update events

**As a** campaign manager
**I want** every update event and fault reported
**So that** I can see the state of the fleet and react to failures

**Notes**
- Events are buffered and sent in batches.
- When the buffer is full the oldest event is discarded.

## US-11: Show update progress in the infotainment system

**As a** vehicle owner
**I want** to see the progress of the update on the central display
**So that** I know how long I have to wait

## US-12: Update while charging overnight

**As a** vehicle owner of an electric vehicle
**I want** the update to run while the vehicle charges with the ignition off
**So that** it does not cost me any time
