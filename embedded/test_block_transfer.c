/* Unity tests for the C twin of the block transfer module. Mirrors the
 * existing vitest suite for src/lib/block-transfer.ts. */
#include "block_transfer.h"
#include "unity/unity.h"

static const uint8_t PAYLOAD[4] = {1, 2, 3, 4};
static const bt_request_t REQUEST = {
    .update_id = 1u, .block_sequence_counter = 1u, .address = 0u, .payload = PAYLOAD, .payload_length = 4u};
static const bt_retry_config_t FAST = {.max_retries = 3, .base_delay_ms = 10, .max_delay_ms = 100, .backoff_multiplier = 2};

/* Test double for the transport: a scripted list of answers. */
typedef struct {
    bool answered[8];
    bt_response_t responses[8];
    uint8_t calls;
    uint32_t random_value;
    uint32_t slept_ms;
} fake_ecu_t;

static bool fake_send(const bt_request_t *request, bt_response_t *response, void *ctx)
{
    (void)request;
    fake_ecu_t *ecu = (fake_ecu_t *)ctx;
    uint8_t i = ecu->calls++;
    *response = ecu->responses[i];
    return ecu->answered[i];
}

static void fake_sleep(uint32_t ms, void *ctx)
{
    ((fake_ecu_t *)ctx)->slept_ms += ms;
}

static uint32_t fake_random(void *ctx)
{
    return ((fake_ecu_t *)ctx)->random_value;
}

static fake_ecu_t ecu;

void setUp(void)
{
    fake_ecu_t empty = {0};
    ecu = empty;
    for (int i = 0; i < 8; i++) {
        ecu.answered[i] = true;
        ecu.responses[i].success = true;
        ecu.responses[i].acknowledged_counter = 1u;
    }
}

void tearDown(void) {}

/* calculate_backoff_delay */
static void test_delay_grows_exponentially(void)
{
    TEST_ASSERT_EQUAL_UINT32(10u, bt_calculate_backoff_delay(0, &FAST, fake_random, &ecu));
    TEST_ASSERT_EQUAL_UINT32(20u, bt_calculate_backoff_delay(1, &FAST, fake_random, &ecu));
    TEST_ASSERT_EQUAL_UINT32(40u, bt_calculate_backoff_delay(2, &FAST, fake_random, &ecu));
}

static void test_delay_caps_exponential_part(void)
{
    TEST_ASSERT_EQUAL_UINT32(100u, bt_calculate_backoff_delay(10, &FAST, fake_random, &ecu));
}

static void test_delay_adds_jitter(void)
{
    ecu.random_value = 500u; /* 50% of the jitter range */
    TEST_ASSERT_EQUAL_UINT32(12u, bt_calculate_backoff_delay(0, &FAST, fake_random, &ecu));
}

static void test_delay_uses_default_config(void)
{
    TEST_ASSERT_EQUAL_UINT32(BT_DEFAULT_RETRY_CONFIG.base_delay_ms, bt_calculate_backoff_delay(0, NULL, fake_random, &ecu));
}

static void test_delay_without_random_source_has_no_jitter(void)
{
    TEST_ASSERT_EQUAL_UINT32(40u, bt_calculate_backoff_delay(2, &FAST, NULL, NULL));
}

/* is_retryable_response */
static void test_retryable_honours_override(void)
{
    bt_response_t yes = {.success = false, .nrc = NRC_SECURITY_ACCESS_DENIED, .retryable_override = 1u};
    bt_response_t no = {.success = false, .nrc = NRC_BUSY_REPEAT_REQUEST, .retryable_override = 2u};
    TEST_ASSERT_TRUE(bt_is_retryable_response(&yes));
    TEST_ASSERT_FALSE(bt_is_retryable_response(&no));
}

static void test_retryable_rejects_programming_failure(void)
{
    bt_response_t r = {.success = false, .nrc = NRC_GENERAL_PROGRAMMING_FAILURE};
    TEST_ASSERT_FALSE(bt_is_retryable_response(&r));
}

static void test_retryable_rejects_wrong_sequence_counter(void)
{
    bt_response_t r = {.success = false, .nrc = NRC_WRONG_BLOCK_SEQUENCE_COUNTER};
    TEST_ASSERT_FALSE(bt_is_retryable_response(&r));
}

static void test_retryable_accepts_busy(void)
{
    bt_response_t r = {.success = false, .nrc = NRC_BUSY_REPEAT_REQUEST};
    TEST_ASSERT_TRUE(bt_is_retryable_response(&r));
}

/* transfer_block_with_retry */
static void test_transfer_succeeds_first_time(void)
{
    bt_result_t result;
    bt_transfer_block_with_retry(&REQUEST, fake_send, &FAST, fake_sleep, fake_random, &ecu, &result);
    TEST_ASSERT_TRUE(result.response.success);
    TEST_ASSERT_EQUAL_UINT8(1u, result.attempts);
    TEST_ASSERT_EQUAL_UINT32(0u, result.total_delay_ms);
}

static void test_transfer_retries_busy_then_succeeds(void)
{
    ecu.responses[0].success = false;
    ecu.responses[0].nrc = NRC_BUSY_REPEAT_REQUEST;
    bt_result_t result;
    bt_transfer_block_with_retry(&REQUEST, fake_send, &FAST, fake_sleep, fake_random, &ecu, &result);
    TEST_ASSERT_TRUE(result.response.success);
    TEST_ASSERT_EQUAL_UINT8(2u, result.attempts);
    TEST_ASSERT_EQUAL_UINT32(10u, result.total_delay_ms);
    TEST_ASSERT_EQUAL_UINT32(10u, ecu.slept_ms);
}

static void test_transfer_does_not_retry_programming_failure(void)
{
    ecu.responses[0].success = false;
    ecu.responses[0].nrc = NRC_GENERAL_PROGRAMMING_FAILURE;
    bt_result_t result;
    bt_transfer_block_with_retry(&REQUEST, fake_send, &FAST, fake_sleep, fake_random, &ecu, &result);
    TEST_ASSERT_FALSE(result.response.success);
    TEST_ASSERT_EQUAL_UINT8(1u, result.attempts);
    TEST_ASSERT_EQUAL(NRC_GENERAL_PROGRAMMING_FAILURE, result.response.nrc);
}

static void test_transfer_gives_up_after_max_retries(void)
{
    for (int i = 0; i < 8; i++) {
        ecu.responses[i].success = false;
        ecu.responses[i].nrc = NRC_BUSY_REPEAT_REQUEST;
    }
    bt_result_t result;
    bt_transfer_block_with_retry(&REQUEST, fake_send, &FAST, fake_sleep, fake_random, &ecu, &result);
    TEST_ASSERT_FALSE(result.response.success);
    TEST_ASSERT_EQUAL_UINT8(4u, result.attempts);
    TEST_ASSERT_EQUAL_UINT32(10u + 20u + 40u, result.total_delay_ms);
}

static void test_transfer_retries_transport_timeout(void)
{
    ecu.answered[0] = false;
    bt_result_t result;
    bt_transfer_block_with_retry(&REQUEST, fake_send, &FAST, fake_sleep, fake_random, &ecu, &result);
    TEST_ASSERT_TRUE(result.response.success);
    TEST_ASSERT_EQUAL_UINT8(2u, result.attempts);
}

static void test_transfer_reports_transport_timeout_when_exhausted(void)
{
    for (int i = 0; i < 8; i++) {
        ecu.answered[i] = false;
    }
    bt_result_t result;
    bt_transfer_block_with_retry(&REQUEST, fake_send, &FAST, fake_sleep, fake_random, &ecu, &result);
    TEST_ASSERT_FALSE(result.response.success);
    TEST_ASSERT_EQUAL(NRC_TRANSPORT_TIMEOUT, result.response.nrc);
    TEST_ASSERT_EQUAL_UINT8(4u, result.attempts);
}

/* validate_transfer_block */
static void test_validate_accepts_good_request(void)
{
    TEST_ASSERT_NULL(bt_validate_transfer_block(&REQUEST, 1024u));
}

static void test_validate_rejects_missing_update_id(void)
{
    bt_request_t r = REQUEST;
    r.update_id = 0u;
    TEST_ASSERT_EQUAL_STRING("Update ID is required", bt_validate_transfer_block(&r, 1024u));
}

static void test_validate_rejects_empty_payload(void)
{
    bt_request_t r = REQUEST;
    r.payload_length = 0u;
    TEST_ASSERT_EQUAL_STRING("Payload must not be empty", bt_validate_transfer_block(&r, 1024u));
}

static void test_validate_rejects_oversized_payload(void)
{
    TEST_ASSERT_EQUAL_STRING("Payload exceeds the negotiated block length", bt_validate_transfer_block(&REQUEST, 2u));
}

int main(void)
{
    UNITY_BEGIN();
    RUN_TEST(test_delay_grows_exponentially);
    RUN_TEST(test_delay_caps_exponential_part);
    RUN_TEST(test_delay_adds_jitter);
    RUN_TEST(test_delay_uses_default_config);
    RUN_TEST(test_delay_without_random_source_has_no_jitter);
    RUN_TEST(test_retryable_honours_override);
    RUN_TEST(test_retryable_rejects_programming_failure);
    RUN_TEST(test_retryable_rejects_wrong_sequence_counter);
    RUN_TEST(test_retryable_accepts_busy);
    RUN_TEST(test_transfer_succeeds_first_time);
    RUN_TEST(test_transfer_retries_busy_then_succeeds);
    RUN_TEST(test_transfer_does_not_retry_programming_failure);
    RUN_TEST(test_transfer_gives_up_after_max_retries);
    RUN_TEST(test_transfer_retries_transport_timeout);
    RUN_TEST(test_transfer_reports_transport_timeout_when_exhausted);
    RUN_TEST(test_validate_accepts_good_request);
    RUN_TEST(test_validate_rejects_missing_update_id);
    RUN_TEST(test_validate_rejects_empty_payload);
    RUN_TEST(test_validate_rejects_oversized_payload);
    return UNITY_END();
}
