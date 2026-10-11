# Epic: Over-the-Air Firmware Update for the Body Control Module (BCM-7)

**Epic ID:** OTA-100
**Status:** Ready for sprint planning
**Product Owner:** Vehicle Software Platform
**Target release:** Platform 2027.1
**Safety classification:** ASIL B (ISO 26262), inherited from exterior lighting and central locking

---

## Background

The BCM-7 controls exterior lighting, wipers, central locking and window lifters. Today its firmware can only be updated in a workshop with a diagnostic tester. Field data from the last two model years shows 3 recall campaigns that would have been avoidable with a remote update. This epic delivers an over-the-air (OTA) update path for the BCM-7.

## Goal

A vehicle owner can receive a new BCM-7 firmware version without visiting a workshop. The update is safe, secure, traceable and reversible.

## Scope

**In scope**

- Download of a signed firmware image from the vehicle gateway to the BCM-7 over CAN using UDS (ISO 14229) services RequestDownload, TransferData and RequestTransferExit.
- A/B partition scheme: the new image is written to the inactive slot while the vehicle keeps running from the active slot.
- Image verification (integrity, authenticity, hardware compatibility, anti-rollback) before activation.
- Activation, health check and automatic rollback to the previous image.
- SecurityAccess (seed and key) before any programming service is accepted.
- Logging of update events and faults for the campaign backend.

**Out of scope**

- Updates of any other ECU.
- Delta (differential) images. Only full images are supported in this release.
- Updates while the vehicle is moving.
- User interface in the infotainment system. The HMI team owns the consent screen.

## Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | A complete update (download, verification, activation) finishes within 10 minutes. |
| NFR-02 | The BCM-7 answers every diagnostic request within P2 = 50 ms, or within P2* = 5 s after a responsePending reply. |
| NFR-03 | A failed block transfer is retried up to 3 times with exponential backoff. The wait before a retry never exceeds 5 s. |
| NFR-04 | A stalled transfer is detected and reported within 15 s. |
| NFR-05 | Rollback to the previous image completes within 30 s. |
| NFR-06 | An interrupted update (power loss, ignition off) resumes from the last confirmed block. |
| NFR-07 | No block is written to flash more than once per update. |
| NFR-08 | The update starts only when the vehicle is stationary, ignition is on and battery voltage is at least 11.5 V. These conditions are monitored for the whole update. |
| NFR-09 | SecurityAccess locks for 10 minutes after 3 failed key attempts. The failed-attempt count survives a power cycle. |
| NFR-10 | Every update event and fault is stored in non-volatile memory and reported to the campaign backend. No event is lost. |
| NFR-11 | An image older than or equal to the installed version is rejected (anti-rollback). |
| NFR-12 | The software update management system complies with UN Regulation No. 156 and ISO 24089. |

## Success criteria

- 99.5% of started updates end in the state committed or rolledBack. No vehicle is left without a bootable BCM-7 image.
- Zero safety goal violations attributable to the update function.
- Every requirement in this epic is traceable to at least one verified test case (ISO 26262-6, clause 9).
- Update duration is acceptable for customers.

## Dependencies

- Vehicle gateway (GW-3) provides the image and the tester role.
- Bootloader BL-2.1 supports A/B slots and boot-attempt counting.
- Hardware security module provides signature verification.
- Campaign backend receives update events.

## Open questions

1. Is the update allowed with the engine running, or only with ignition on and engine off?
2. Who owns the secret used for SecurityAccess key derivation, and how is it rotated?
3. What happens to a vehicle that loses power during activation?
4. Which hardware variants (H1, H2, H3) are in scope for the first campaign?
5. How long must update events be retained in the vehicle?
