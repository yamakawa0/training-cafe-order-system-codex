INSERT INTO payment_refunds (
    id,
    payment_id,
    refund_no,
    amount,
    reason,
    status,
    actor_user_id,
    actor_user_display_name,
    actor_user_role,
    actor_terminal_code
)
VALUES (
    /*id*/'refund-dev',
    /*payment_id*/'pay-dev',
    /*refund_no*/'REF-DEV',
    /*amount*/1,
    /*reason*/'',
    'refunded',
    NULLIF(/*actor_user_id*/'', ''),
    NULLIF(/*actor_user_display_name*/'', ''),
    NULLIF(/*actor_user_role*/'', ''),
    NULLIF(/*actor_terminal_code*/'', '')
)
RETURNING
    id,
    payment_id,
    refund_no,
    amount,
    reason,
    status,
    refunded_at,
    actor_user_id,
    actor_user_display_name,
    actor_user_role,
    actor_terminal_code;
