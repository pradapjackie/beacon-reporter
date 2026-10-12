Feature: Discount codes
  Checkout applies promotional discount codes.

  @smoke
  Scenario: Valid code reduces the total
    Given a cart totalling 100 euros
    When the customer applies the code "WELCOME10"
    Then the total becomes 90 euros

  Scenario: Expired code is rejected
    Given a cart totalling 100 euros
    When the customer applies the code "EXPIRED"
    Then the total stays 100 euros
    And an error "code expired" is shown

  Scenario Outline: Tiered discounts
    Given a cart totalling <total> euros
    When the customer applies the code "TIER"
    Then the total becomes <discounted> euros

    Examples:
      | total | discounted |
      | 100   | 95         |
      | 200   | 180        |
