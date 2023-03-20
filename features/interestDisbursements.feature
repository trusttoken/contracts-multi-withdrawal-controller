Feature: Manager Disburses interest

  Some Portfolios require lenders to lock their funds for an long time, like 2 years. In such a case many lenders prefer
  to receive interest throughout the portfolio lifetime.

  In Archblock it is the Portfolio Manager who initiates and executes the action of disbursing interest to lenders.

  In order for the Disburse Interest action to be available, following conditions must be met:
  * Free-for-all withdrawals need to be disabled on the Portfolio.
  * Portfolio needs to be set-up to support interest disbursement (configured with MultiWithdrawalController).
  * Interest needs to be available, for example after a loan has been successfully repaid.

  By default, the Archblock app suggest distributing interest pro-rata, with regards to current shares of each lender.

  However, the manager has discretion over the exact distribution.

  Note
  ====

  > The TrueFi protocol, which Archblock builds upon, requires shares to be burned alongside any money outflow from the
  > Portfolio to the lender's wallet.
  >
  > This means that disbursing interest will result in burning prorated shares of each lender. Follow the examples
  > below for details.

  Background: Portfolio is configured for disbursing interest
    Given a Portfolio with MultiWithdrawController

  Rule: (1) Manager can disburse interest pro-rata

  The default way of disbursing interest is pro-rata, with respect to current shares of the lenders.

    Example: Pro-rata disbursement - 2 lenders, equal shares

      Given lenders
        | name  | shares | assets |
        | Alice | 1,000  | 1,000  |
        | Bob   | 1,000  | 1,000  |
      When a loan is made and repaid
        | principal | 2,000 |
        | interest  | 1,000 |
      Then portfolio has
        | shares | 2,000 |
        | assets | 3,000 |
      When an interest disbursement is made
        | name  | assets | shares burned |
        | Alice | 500    | 333.333       |
        | Bob   | 500    | 333.333       |
      Then portfolio has
        | assets      | 2,000     |
        | shares      | 1,333.333 |
        | share price | 1.5       |
      And lenders have
        | name  | shares  | assets |
        | Alice | 666.666 | 1,000  |
        | Bob   | 666.666 | 1,000  |

    Example: Pro-rata disbursement - 2 lenders, Alice has twice as much as Bob

      Given lenders
        | name  | shares | assets |
        | Alice | 2,000  | 2,000  |
        | Bob   | 1,000  | 1,000  |
      And portfolio receives interest of 1,000
      And portfolio has
        | assets      | 4,000 |
        | share price | 1.33  |
      When an interest disbursement is made
        | name  | assets  | shares burned |
        | Alice | 666.666 | 500           |
        | Bob   | 333.333 | 250           |
      Then portfolio has
        | assets      | 3,000 |
        | shares      | 2,250 |
        | share price | 1.33  |
      And lenders have
        | name  | shares | assets |
        | Alice | 1,500  | 2000   |
        | Bob   | 750    | 1000   |

  Rule: (2) Manager can disburse interest at her discretion

    Example: Bob's interest goes to Alice

      Given lenders
        | name  | shares | assets |
        | Alice | 2,000  | 2,000  |
        | Bob   | 1,000  | 1,000  |
      And portfolio receives interest of 1,000
      And portfolio has
        | assets      | 4,000 |
        | share price | 1.33  |
      When an interest disbursement is made
        | name  | assets | shares burned |
        | Alice | 1,000  | 500           |
        | Bob   | 0.001  | 250           |
      Then portfolio has
        | assets      | 3,000 |
        | shares      | 2,250 |
        | share price | 1.33  |
      And lenders have
        | name  | shares | assets | token balance |
        | Alice | 1,500  | 2000   | 1,000         |
        | Bob   | 750    | 1000   | 0.001         |

  Rule: (4) Interest of lenders who did not approve shares cannot be given to other lenders

    It is impossible do divert interest of a lender who did not approve shares to other lenders. Without burning any
    of the shares, we cannot at the same time: burn shares of other lenders **and** keep the share price.

    Example: 3 lenders, all have approved - for comparison with next case

      Given lenders
        | name    | shares | assets |
        | Alice   | 1,000  | 1,000  |
        | Bob     | 1,000  | 1,000  |
        | Charlie | 1,000  | 1,000  |
      And portfolio receives interest of 1,500
      And portfolio has
        | assets      | 4,500 |
        | share price | 1.5   |
      When an interest disbursement is made
        | name    | assets | shares burned |
        | Alice   | 500    | 333.3333      |
        | Bob     | 500    | 333.3333      |
        | Charlie | 500    | 333.3333      |
      Then portfolio has
        | assets      | 3,000 |
        | shares      | 2,000 |
        | share price | 1.5   |
      And lenders have
        | name    | shares   | assets | token balance |
        | Alice   | 666.6667 | 1,000  | 500           |
        | Bob     | 666.6667 | 1,000  | 500           |
        | Charlie | 666.6667 | 1,000  | 500           |

    Example: Charlie didn't approve shares

    In the case when Charlie didn't approve shares, his assets need to stay in the portfolio. Effectively, those assets
    are "reinvested", or compounded.

      Given lenders
        | name    | shares | assets |
        | Alice   | 1,000  | 1,000  |
        | Bob     | 1,000  | 1,000  |
        | Charlie | 1,000  | 1,000  |
      And portfolio receives interest of 1,500
      And portfolio has
        | assets      | 4,500 |
        | share price | 1.5   |
      When an interest disbursement is made
        | name  | assets | shares burned |
        | Alice | 500    | 333.3333      |
        | Bob   | 500    | 333.3333      |
      Then portfolio has
        | assets      | 3,500      |
        | shares      | 2,333.3334 |
        | share price | 1.5        |
      And lenders have
        | name    | shares   | assets | token balance |
        | Alice   | 666.6667 | 1,000  | 500           |
        | Bob     | 666.6667 | 1,000  | 500           |
        | Charlie | 1000     | 1,500  | 0             |
