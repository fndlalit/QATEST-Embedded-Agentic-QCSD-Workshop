#include "block_transfer.h"

const bt_retry_config_t BT_DEFAULT_RETRY_CONFIG = {
    .max_retries = 3,
    .base_delay_ms = 500u,
    /* The wait before a retry must never exceed the enhanced response timeout. */
    .max_delay_ms = P2_STAR_SERVER_MAX_MS,
    .backoff_multiplier = 2,
};

static uint32_t saturating_pow(uint32_t base, uint8_t exponent)
{
    uint32_t value = 1u;
    if (base == 0u) {
        return exponent == 0u ? 1u : 0u;
    }
    while (exponent-- > 0u) {
        if (value > (UINT32_MAX / base)) {
            return UINT32_MAX;
        }
        value *= base;
    }
    return value;
}

/* Delay before a given retry attempt: exponential backoff with jitter. */
uint32_t bt_calculate_backoff_delay(uint8_t attempt, const bt_retry_config_t *config, bt_random_fn random_fn, void *ctx)
{
    if (config == NULL) {
        config = &BT_DEFAULT_RETRY_CONFIG;
    }
    uint32_t factor = saturating_pow(config->backoff_multiplier, attempt);
    uint32_t exponential_delay = 0u;
    if (config->base_delay_ms > 0u) {
        exponential_delay = (factor > UINT32_MAX / config->base_delay_ms) ? UINT32_MAX : config->base_delay_ms * factor;
    }
    uint32_t capped_delay = exponential_delay < config->max_delay_ms ? exponential_delay : config->max_delay_ms;
    /* Jitter: between 0 and 50% of the delay. */
    uint32_t r = random_fn != NULL ? (random_fn(ctx) % 1000u) : 0u;
    uint32_t jitter = (uint32_t)(((uint64_t)capped_delay * r) / 2000u);
    return capped_delay + jitter;
}

/* Whether a negative response from the ECU may be retried. */
bool bt_is_retryable_response(const bt_response_t *response)
{
    if (response->retryable_override == 1u) {
        return true;
    }
    if (response->retryable_override == 2u) {
        return false;
    }
    switch (response->nrc) {
    /* Negative response codes that must never be retried. */
    case NRC_SECURITY_ACCESS_DENIED:
    case NRC_REQUEST_OUT_OF_RANGE:
    case NRC_WRONG_BLOCK_SEQUENCE_COUNTER:
    case NRC_GENERAL_PROGRAMMING_FAILURE:
    case NRC_UPLOAD_DOWNLOAD_NOT_ACCEPTED:
    case NRC_VOLTAGE_TOO_LOW:
        return false;
    /* busyRepeatRequest, responsePending and transport timeouts are retryable by default. */
    default:
        return true;
    }
}

/* Sends one firmware block and retries on transient failures. */
void bt_transfer_block_with_retry(const bt_request_t *request, bt_send_fn send_fn, const bt_retry_config_t *config,
                                  bt_sleep_fn sleep_fn, bt_random_fn random_fn, void *ctx, bt_result_t *result)
{
    if (config == NULL) {
        config = &BT_DEFAULT_RETRY_CONFIG;
    }
    result->total_delay_ms = 0u;
    result->attempts = 0u;

    for (uint8_t attempt = 0u; attempt <= config->max_retries; attempt++) {
        bt_response_t response = {0};
        bool answered = send_fn(request, &response, ctx);
        result->attempts = (uint8_t)(attempt + 1u);

        if (!answered) {
            /* Transport errors (CAN bus-off, ISO-TP timeout) are always retried. */
            if (attempt == config->max_retries) {
                result->response.success = false;
                result->response.nrc = NRC_TRANSPORT_TIMEOUT;
                result->response.retryable_override = 2u;
                return;
            }
        } else {
            if (response.success) {
                result->response = response;
                return;
            }
            if (!bt_is_retryable_response(&response) || attempt == config->max_retries) {
                result->response = response;
                return;
            }
        }

        uint32_t delay = bt_calculate_backoff_delay(attempt, config, random_fn, ctx);
        result->total_delay_ms += delay;
        if (sleep_fn != NULL) {
            sleep_fn(delay, ctx);
        }
    }

    result->response.success = false;
    result->response.nrc = NRC_GENERAL_REJECT;
    result->response.retryable_override = 2u;
    result->attempts = (uint8_t)(config->max_retries + 1u);
}

/* Validates a block before it is sent. */
const char *bt_validate_transfer_block(const bt_request_t *request, size_t max_block_length)
{
    if (request->update_id == 0u) {
        return "Update ID is required";
    }
    if (request->payload == NULL || request->payload_length == 0u) {
        return "Payload must not be empty";
    }
    if (request->payload_length > max_block_length) {
        return "Payload exceeds the negotiated block length";
    }
    return NULL;
}
