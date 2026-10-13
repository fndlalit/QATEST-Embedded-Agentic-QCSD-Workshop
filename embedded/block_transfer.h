/*
 * Firmware block transfer with retry and exponential backoff, C twin of
 * src/lib/block-transfer.ts. Sends one firmware block to the ECU over UDS
 * TransferData (0x36) and retries transient failures.
 *
 * Written for a bare-metal or RTOS target: no heap, no dynamic strings,
 * no dependency beyond <stdint.h> and <stdbool.h>. The caller supplies the
 * transport function, the sleep function and the random source so the
 * module can be unit tested on a host.
 */
#ifndef BLOCK_TRANSFER_H
#define BLOCK_TRANSFER_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/* Enhanced response timeout P2*server_max, ISO 14229-2, in milliseconds. */
#define P2_STAR_SERVER_MAX_MS 5000u

/* UDS negative response codes used by the transfer. */
typedef enum {
    NRC_NONE = 0x00,
    NRC_GENERAL_REJECT = 0x10,
    NRC_BUSY_REPEAT_REQUEST = 0x21,
    NRC_REQUEST_SEQUENCE_ERROR = 0x24,
    NRC_REQUEST_OUT_OF_RANGE = 0x31,
    NRC_SECURITY_ACCESS_DENIED = 0x33,
    NRC_UPLOAD_DOWNLOAD_NOT_ACCEPTED = 0x70,
    NRC_WRONG_BLOCK_SEQUENCE_COUNTER = 0x73,
    NRC_GENERAL_PROGRAMMING_FAILURE = 0x72,
    NRC_RESPONSE_PENDING = 0x78,
    NRC_VOLTAGE_TOO_LOW = 0x93,
    /* Not a UDS code: the transport layer reported no response at all. */
    NRC_TRANSPORT_TIMEOUT = 0xFF
} bt_nrc_t;

typedef struct {
    uint32_t update_id;
    /* UDS blockSequenceCounter, 0x00 to 0xFF, wraps after 0xFF. */
    uint8_t block_sequence_counter;
    /* Start address of this block inside the target partition. */
    uint32_t address;
    const uint8_t *payload;
    size_t payload_length;
} bt_request_t;

typedef struct {
    bool success;
    /* Counter echoed by the ECU in the positive response. */
    uint8_t acknowledged_counter;
    bt_nrc_t nrc;
    /* Tri-state override: 0 = decide from the NRC, 1 = retryable, 2 = not retryable. */
    uint8_t retryable_override;
} bt_response_t;

typedef struct {
    uint8_t max_retries;
    uint32_t base_delay_ms;
    uint32_t max_delay_ms;
    uint8_t backoff_multiplier;
} bt_retry_config_t;

typedef struct {
    bt_response_t response;
    uint8_t attempts;
    uint32_t total_delay_ms;
} bt_result_t;

/* Transport: sends one block and fills the response. Returns false when no response arrived. */
typedef bool (*bt_send_fn)(const bt_request_t *request, bt_response_t *response, void *ctx);
typedef void (*bt_sleep_fn)(uint32_t ms, void *ctx);
/* Random source in the range [0, 1000) used for jitter. */
typedef uint32_t (*bt_random_fn)(void *ctx);

extern const bt_retry_config_t BT_DEFAULT_RETRY_CONFIG;

uint32_t bt_calculate_backoff_delay(uint8_t attempt, const bt_retry_config_t *config, bt_random_fn random_fn, void *ctx);
bool bt_is_retryable_response(const bt_response_t *response);
void bt_transfer_block_with_retry(const bt_request_t *request, bt_send_fn send_fn, const bt_retry_config_t *config,
                                  bt_sleep_fn sleep_fn, bt_random_fn random_fn, void *ctx, bt_result_t *result);
/* Returns NULL when the request is valid, otherwise a short reason. */
const char *bt_validate_transfer_block(const bt_request_t *request, size_t max_block_length);

#endif
