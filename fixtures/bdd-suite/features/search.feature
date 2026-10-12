Feature: Catalog search

  Scenario: Finds products by keyword
    Given the catalog contains "aurora lamp"
    When the customer searches for "aurora"
    Then the results include "aurora lamp"
